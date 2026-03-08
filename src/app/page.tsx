"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import BottomNav, { type TabId } from "@/components/victim/BottomNav";
import SOSView from "@/components/victim/SOSView";
import FeedView from "@/components/victim/FeedView";
import ProfileView from "@/components/victim/ProfileView";
import IncomingCall from "@/components/victim/IncomingCall";
import NotificationToast from "@/components/NotificationToast";

type UserProfile = {
  name: string;
  age: string;
  medicalContext: string;
  language: string;
};

export default function VictimPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<"onboarding" | "app">("onboarding");
  const [activeTab, setActiveTab] = useState<TabId>("sos");
  const [victimEmergencyId, setVictimEmergencyId] = useState<string | null>(null);
  const supabase = createClient();

  const handleEmergencyCreated = useCallback((id: string) => {
    setVictimEmergencyId(id);
  }, []);

  useEffect(() => {
    async function loadProfileForUser(u: User) {
      setUser(u);
      const fallbackName = u.user_metadata?.full_name ?? u.email ?? "User";

      const { data: row } = await supabase
        .from("profiles")
        .select("name, age, medical_context, language")
        .eq("id", u.id)
        .single();

      if (row) {
        const p: UserProfile = {
          name: row.name || fallbackName,
          age: row.age ?? "",
          medicalContext: row.medical_context ?? "",
          language: row.language ?? "",
        };
        setProfile(p);
        localStorage.setItem("crisisbridge_profile", JSON.stringify(p));
      } else {
        const saved = localStorage.getItem("crisisbridge_profile");
        const parsed = saved ? JSON.parse(saved) : {};
        const p: UserProfile = {
          name: fallbackName,
          age: parsed.age ?? "",
          medicalContext: parsed.medicalContext ?? "",
          language: parsed.language ?? "",
        };
        setProfile(p);
        supabase.from("profiles").upsert({
          id: u.id,
          name: p.name,
          age: p.age,
          medical_context: p.medicalContext,
          language: p.language,
        }).then(() => {});
      }
      setView("app");
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        loadProfileForUser(user);
      } else {
        const saved = localStorage.getItem("crisisbridge_profile");
        if (saved) {
          setProfile(JSON.parse(saved));
          setView("app");
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadProfileForUser(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleGuestContinue = () => {
    setProfile({ name: "Guest", age: "", medicalContext: "", language: "" });
    setView("app");
  };

  const handleProfileSave = useCallback(
    (p: UserProfile) => {
      localStorage.setItem("crisisbridge_profile", JSON.stringify(p));
      setProfile(p);
      if (view === "onboarding") setView("app");

      if (user) {
        supabase.from("profiles").upsert({
          id: user.id,
          name: p.name,
          age: p.age,
          medical_context: p.medicalContext,
          language: p.language,
        }).then(() => {});
      }
    },
    [user, supabase, view],
  );

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setView("onboarding");
    localStorage.removeItem("crisisbridge_profile");
  }, [supabase]);

  if (view === "onboarding") {
    return (
      <OnboardingView
        onGuest={handleGuestContinue}
        supabase={supabase}
      />
    );
  }

  return (
    <main className="flex min-h-dvh flex-col bg-black text-white">
      <header className="flex items-center justify-between border-b border-gray-800 px-6 py-3">
        <button onClick={() => setActiveTab("sos")} className="cursor-pointer text-lg font-bold">
          CrisisBridge
        </button>
        <span className="text-xs text-gray-500">
          {user ? profile?.name : `Guest${profile?.name !== "Guest" ? `: ${profile?.name}` : ""}`}
        </span>
      </header>

      {activeTab === "sos" && (
        <SOSView profile={profile} onEmergencyCreated={handleEmergencyCreated} />
      )}
      {activeTab === "feed" && <FeedView />}
      {activeTab === "profile" && (
        <ProfileView
          profile={profile}
          user={user}
          onSave={handleProfileSave}
          onSignOut={handleSignOut}
        />
      )}

      <IncomingCall emergencyId={victimEmergencyId} />
      <NotificationToast />
      <BottomNav active={activeTab} onChange={setActiveTab} />
    </main>
  );
}

function OnboardingView({
  onGuest,
  supabase,
}: {
  onGuest: () => void;
  supabase: ReturnType<typeof createClient>;
}) {
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const handleGoogle = async () => {
    setAuthLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    });
    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);
    if (authMode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
        },
      });
      if (error) setAuthError(error.message);
      else setAuthMessage("Check your email for a confirmation link.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) setAuthError(error.message);
    }
    setAuthLoading(false);
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-black p-6">
      <h1 className="text-4xl font-bold text-white">CrisisBridge</h1>
      <p className="max-w-sm text-center text-lg text-gray-400">
        Emergency help when you need it most.
      </p>
      <div className="flex w-full max-w-sm flex-col gap-4">
        <Card className="border-gray-800 bg-gray-950">
          <CardHeader>
            <CardTitle className="text-white">Quick Access</CardTitle>
            <CardDescription>
              Continue as a guest for immediate help.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              className="w-full bg-red-600 py-6 text-lg font-bold text-white hover:bg-red-700"
              onClick={onGuest}
            >
              Continue as Guest
            </Button>
          </CardContent>
        </Card>

        <Card className="border-gray-800 bg-gray-950">
          <CardHeader>
            <CardTitle className="text-white">Sign In</CardTitle>
            <CardDescription>
              Sign in to save your profile across devices.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              variant="outline"
              className="w-full border-gray-700 py-5 text-white hover:bg-gray-800"
              onClick={handleGoogle}
              disabled={authLoading}
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </Button>

            {!showEmailAuth ? (
              <Button
                variant="ghost"
                className="w-full text-gray-400 hover:text-white"
                onClick={() => setShowEmailAuth(true)}
              >
                Use email instead
              </Button>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Separator className="flex-1 bg-gray-700" />
                  <span className="text-xs text-gray-500">or</span>
                  <Separator className="flex-1 bg-gray-700" />
                </div>
                <div className="flex flex-col gap-3">
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="border-gray-700 bg-gray-900 text-white" />
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="border-gray-700 bg-gray-900 text-white" onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()} />
                  <Button variant="default" className="w-full py-5" onClick={handleEmailAuth} disabled={authLoading || !email || !password}>
                    {authMode === "signin" ? "Sign In" : "Sign Up"}
                  </Button>
                  <p className="text-center text-xs text-gray-500">
                    {authMode === "signin" ? "No account? " : "Have an account? "}
                    <button className="text-gray-300 underline underline-offset-2" onClick={() => { setAuthMode(authMode === "signin" ? "signup" : "signin"); setAuthError(null); setAuthMessage(null); }}>
                      {authMode === "signin" ? "Sign up" : "Sign in"}
                    </button>
                  </p>
                </div>
              </>
            )}

            {authError && <p className="text-center text-sm text-red-400">{authError}</p>}
            {authMessage && <p className="text-center text-sm text-green-400">{authMessage}</p>}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
