"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield } from "lucide-react";
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
  const [victimEmergencyId, setVictimEmergencyId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("crisisbridge_active_emergency");
  });
  const supabase = createClient();

  const handleEmergencyCreated = useCallback((id: string) => {
    setVictimEmergencyId(id);
    sessionStorage.setItem("crisisbridge_active_emergency", id);
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem("crisisbridge_active_emergency");
    if (stored && !victimEmergencyId) setVictimEmergencyId(stored);
  }, [victimEmergencyId]);

  useEffect(() => {
    async function loadProfileForUser(u: User) {
      setUser(u);
      const fallbackName = u.user_metadata?.full_name ?? u.email ?? "User";

      try {
        const { data: row, error } = await supabase
          .from("profiles")
          .select("name, age, medical_context, language")
          .eq("id", u.id)
          .single();

        if (!error && row) {
          const p: UserProfile = {
            name: row.name || fallbackName,
            age: row.age ?? "",
            medicalContext: row.medical_context ?? "",
            language: row.language ?? "",
          };
          setProfile(p);
          localStorage.setItem("crisisbridge_profile", JSON.stringify(p));
          setView("app");
          return;
        }
      } catch {
        /* profiles table missing or RLS: fall back to localStorage */
      }

      const saved = localStorage.getItem("crisisbridge_profile");
      const parsed = saved ? JSON.parse(saved) : {};
      const p: UserProfile = {
        name: fallbackName,
        age: parsed.age ?? "",
        medicalContext: parsed.medicalContext ?? "",
        language: parsed.language ?? "",
      };
      setProfile(p);
      setView("app");

      void supabase
        .from("profiles")
        .upsert({
          id: u.id,
          name: p.name,
          age: p.age,
          medical_context: p.medicalContext,
          language: p.language,
        })
        .then(() => {}, () => {});
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        loadProfileForUser(user).catch(() => {
          setView("onboarding");
        });
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
        loadProfileForUser(session.user).catch(() => {});
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
        void supabase
          .from("profiles")
          .upsert({
            id: user.id,
            name: p.name,
            age: p.age,
            medical_context: p.medicalContext,
            language: p.language,
          })
          .then(() => {}, () => {});
      }
    },
    [user, supabase, view],
  );

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setView("onboarding");
    setVictimEmergencyId(null);
    localStorage.removeItem("crisisbridge_profile");
    sessionStorage.removeItem("crisisbridge_active_emergency");
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
    <main className="flex min-h-dvh flex-col bg-[#0a0a0f] text-white">
      <header className="sticky top-0 z-40 flex flex-col border-b border-white/[0.06] bg-[#0a0a0f]/95 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setActiveTab("sos")}
            className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-red-600 shadow-lg shadow-orange-500/20">
              <span className="text-sm font-bold text-white">SOS</span>
            </span>
            CrisisBridge
          </button>
          <div className="flex items-center gap-2">
            <a
              href="/dispatcher"
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition-all hover:border-orange-500/30 hover:bg-white/10 hover:text-white"
            >
              <Shield className="h-4 w-4" />
              Dispatcher
            </a>
            <span className="rounded-lg bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-400">
              {user ? profile?.name : `Guest${profile?.name !== "Guest" ? `: ${profile?.name}` : ""}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-white/[0.04] px-4 py-2">
          <span className="text-slate-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </span>
          <span className="text-xs text-slate-400">Location shared when you send SOS</span>
        </div>
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
    <main className="relative flex min-h-dvh flex-col items-center justify-center gap-8 bg-[#0a0a0f] p-6">
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 shadow-xl shadow-orange-500/30">
          <span className="text-xl font-black text-white">SOS</span>
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-white">CrisisBridge</h1>
        <p className="max-w-sm text-center text-slate-400">
          Emergency help when you need it most.
        </p>
      </div>
      <a
        href="/dispatcher"
        className="absolute right-4 top-4 flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition-all hover:border-orange-500/30 hover:bg-white/10 hover:text-white"
      >
        <Shield className="h-4 w-4" />
        Dispatcher
      </a>
      <div className="flex w-full max-w-sm flex-col gap-4">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 shadow-xl">
          <h2 className="font-semibold text-white">Quick Access</h2>
          <p className="mt-1 text-sm text-slate-400">
            Continue as a guest for immediate help.
          </p>
          <Button
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-orange-500 to-red-600 py-6 text-lg font-bold text-white shadow-lg shadow-orange-500/20 hover:brightness-110"
            onClick={onGuest}
          >
            Continue as Guest
          </Button>
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 shadow-xl">
          <h2 className="font-semibold text-white">Sign In</h2>
          <p className="mt-1 text-sm text-slate-400">
            Sign in to save your profile across devices.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <Button
              variant="outline"
              className="w-full rounded-xl border-white/10 bg-white/5 py-5 text-slate-200 hover:bg-white/10 hover:text-white"
              onClick={handleGoogle}
              disabled={authLoading}
            >
              <svg className="mr-2 h-5 w-5 shrink-0" viewBox="0 0 24 24">
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
                className="w-full text-slate-400 hover:text-white"
                onClick={() => setShowEmailAuth(true)}
              >
                Use email instead
              </Button>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Separator className="flex-1 bg-white/10" />
                  <span className="text-xs text-slate-500">or</span>
                  <Separator className="flex-1 bg-white/10" />
                </div>
                <div className="flex flex-col gap-3">
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="rounded-xl border-white/10 bg-white/5 text-white placeholder:text-slate-500" />
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="rounded-xl border-white/10 bg-white/5 text-white placeholder:text-slate-500" onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()} />
                  <Button className="w-full rounded-xl py-5" onClick={handleEmailAuth} disabled={authLoading || !email || !password}>
                    {authMode === "signin" ? "Sign In" : "Sign Up"}
                  </Button>
                  <p className="text-center text-xs text-slate-500">
                    {authMode === "signin" ? "No account? " : "Have an account? "}
                    <button className="text-slate-300 underline underline-offset-2 hover:text-white" onClick={() => { setAuthMode(authMode === "signin" ? "signup" : "signin"); setAuthError(null); setAuthMessage(null); }}>
                      {authMode === "signin" ? "Sign up" : "Sign in"}
                    </button>
                  </p>
                </div>
              </>
            )}

            {authError && <p className="text-center text-sm text-red-400">{authError}</p>}
            {authMessage && <p className="text-center text-sm text-emerald-400">{authMessage}</p>}
          </div>
        </div>
      </div>
    </main>
  );
}
