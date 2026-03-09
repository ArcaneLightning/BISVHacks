"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Emergency } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import PriorityQueue from "@/components/dispatcher/PriorityQueue";
import CrisisCard from "@/components/dispatcher/CrisisCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import NotificationToast from "@/components/NotificationToast";

const MapView = dynamic(() => import("@/components/dispatcher/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-900 text-slate-500">
      Loading map...
    </div>
  ),
});

export default function DispatcherPage() {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [selected, setSelected] = useState<Emergency | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, [supabase.auth]);

  useEffect(() => {
    async function checkAccess() {
      const res = await fetch("/api/check-dispatcher");
      const { allowed } = await res.json();
      setAccessChecked(true);
      if (!allowed) {
        router.replace("/access-denied");
      }
    }
    checkAccess();
  }, [router]);

  useEffect(() => {
    async function fetchAll() {
      const { data } = await supabase
        .from("emergencies")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setEmergencies(data as Emergency[]);
    }
    fetchAll();

    const channel = supabase
      .channel("live-map")
      .on<Emergency>(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "emergencies" },
        (payload) => {
          setEmergencies((prev) => [payload.new, ...prev]);
        },
      )
      .on<Emergency>(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "emergencies" },
        (payload) => {
          const updated = payload.new;
          if (updated.status === "resolved") {
            setEmergencies((prev) => prev.filter((e) => e.id !== updated.id));
            if (selected?.id === updated.id) {
              setSelected(null);
              setSheetOpen(false);
            }
          } else {
            setEmergencies((prev) =>
              prev.map((e) => (e.id === updated.id ? updated : e)),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, selected?.id]);

  const handleSelect = useCallback((e: Emergency) => {
    setSelected(e);
    setSheetOpen(true);
  }, []);

  const handleEmergencyUpdate = useCallback((updated: Emergency) => {
    setEmergencies((prev) =>
      updated.status === "resolved"
        ? prev.filter((e) => e.id !== updated.id)
        : prev.map((e) => (e.id === updated.id ? updated : e)),
    );
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? "??";

  if (!accessChecked) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-950">
        <p className="text-slate-500">Checking access...</p>
      </div>
    );
  }

  return (
    <div className="flex h-dvh bg-slate-950">
      <aside className="hidden w-80 flex-shrink-0 flex-col overflow-hidden md:flex">
        <PriorityQueue emergencies={emergencies} onSelect={handleSelect} />
      </aside>

      <main className="relative flex-1">
        {/* Top bar with user info */}
        <div className="absolute right-4 top-4 z-[1000] flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/90 px-3 py-2 backdrop-blur">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-slate-700 text-xs text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm text-slate-300 sm:inline">
            {user?.user_metadata?.full_name ?? user?.email ?? "Dispatcher"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-slate-500 hover:text-white"
            onClick={handleSignOut}
          >
            Sign out
          </Button>
        </div>

        <MapView emergencies={emergencies} onSelect={handleSelect} selectedId={selected?.id ?? null} />

        <div className="absolute bottom-4 left-4 right-4 md:hidden">
          <MobileQueue emergencies={emergencies} onSelect={handleSelect} />
        </div>
      </main>

      <CrisisCard
        emergency={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdate={handleEmergencyUpdate}
      />
      <NotificationToast />
    </div>
  );
}

function MobileQueue({
  emergencies,
  onSelect,
}: {
  emergencies: Emergency[];
  onSelect: (e: Emergency) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...emergencies]
    .sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0))
    .slice(0, 5);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/95 backdrop-blur">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm font-semibold text-white"
      >
        <span>Active Incidents ({emergencies.length})</span>
        <span className="text-slate-500">{expanded ? "▼" : "▲"}</span>
      </button>
      {expanded && (
        <div className="max-h-60 overflow-y-auto border-t border-slate-800">
          {sorted.map((e) => (
            <button
              key={e.id}
              onClick={() => onSelect(e)}
              className="flex w-full items-center justify-between border-b border-slate-800/50 px-4 py-2 text-left hover:bg-slate-900"
            >
              <span className="text-xs text-white">
                {e.incident_type ?? "Unknown"}
              </span>
              <span className="text-xs text-slate-500">
                Sev {e.severity ?? "?"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
