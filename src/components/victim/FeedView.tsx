"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Emergency } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import EmergencyMap from "./EmergencyMiniMap";

const severityConfig: Record<number, { label: string; className: string }> = {
  5: { label: "CRITICAL", className: "bg-red-600 text-white" },
  4: { label: "HIGH", className: "bg-orange-500 text-white" },
  3: { label: "MEDIUM", className: "bg-yellow-500 text-black" },
  2: { label: "LOW", className: "bg-blue-500 text-white" },
  1: { label: "MINOR", className: "bg-gray-500 text-white" },
};

export default function FeedView() {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [selected, setSelected] = useState<Emergency | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const sortBySeverity = (list: Emergency[]) =>
      [...list].sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0));

    const shouldShow = (e: Emergency) => {
      const s = e.severity ?? 0;
      return s >= 4 || (s === 3 && e.affects_public === true);
    };

    async function load() {
      const { data } = await supabase
        .from("emergencies")
        .select("*")
        .eq("status", "active")
        .gte("severity", 3)
        .order("severity", { ascending: false })
        .limit(50);
      const filtered = (data ?? []).filter((e) => shouldShow(e as Emergency));
      setEmergencies(filtered as Emergency[]);
    }
    load();

    const channel = supabase
      .channel("feed")
      .on<Emergency>(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "emergencies" },
        (payload) => {
          if (shouldShow(payload.new)) {
            setEmergencies((prev) => sortBySeverity([payload.new, ...prev]));
          }
        },
      )
      .on<Emergency>(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "emergencies" },
        (payload) => {
          const updated = payload.new;
          if (updated.status === "resolved" || !shouldShow(updated)) {
            setEmergencies((prev) => prev.filter((e) => e.id !== updated.id));
          } else {
            setEmergencies((prev) => {
              const exists = prev.some((e) => e.id === updated.id);
              if (exists) {
                return sortBySeverity(
                  prev.map((e) => (e.id === updated.id ? updated : e)),
                );
              }
              return sortBySeverity([updated, ...prev]);
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleSelect = (e: Emergency) => {
    setSelected(e);
    setSheetOpen(true);
  };

  return (
    <div className="flex flex-1 flex-col pb-24">
      <div className="border-b border-white/[0.06] px-4 py-4">
        <h2 className="text-lg font-semibold text-white">Nearby Alerts</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          {emergencies.length} alert{emergencies.length !== 1 ? "s" : ""} (high severity or public impact)
        </p>
      </div>
      <ScrollArea className="flex-1">
        {emergencies.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
              <span className="text-2xl text-emerald-400">✓</span>
            </div>
            <p className="text-sm text-slate-500">No active emergencies</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            {emergencies.map((e) => {
              const config =
                severityConfig[e.severity ?? 1] ?? severityConfig[1];
              const time = new Date(e.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <button
                  key={e.id}
                  onClick={() => handleSelect(e)}
                  className="group flex flex-col gap-1.5 rounded-xl bg-gradient-to-br from-orange-500/50 to-red-600/50 p-[1px] transition-all hover:from-orange-500/70 hover:to-red-600/70"
                >
                  <div className="flex flex-col gap-1.5 rounded-[10px] bg-[#0a0a0f] px-4 py-4 text-left transition-colors group-hover:bg-white/[0.03]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">
                        {e.incident_type ?? "Unknown"}
                      </span>
                      <Badge className={`rounded-lg ${config.className}`}>{config.label}</Badge>
                    </div>
                    <p className="line-clamp-2 text-xs leading-relaxed text-slate-400">
                      {e.translated_summary ?? "Pending analysis..."}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{e.user_name ?? "Anonymous"}</span>
                      <span>&middot;</span>
                      <span>{time}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="flex max-h-[85dvh] flex-col border-white/[0.06] bg-[#0a0a0f]"
        >
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <SheetTitle className="text-white">
                    {selected.incident_type ?? "Unknown Incident"}
                  </SheetTitle>
                  <Badge
                    className={
                      (severityConfig[selected.severity ?? 1] ?? severityConfig[1])
                        .className
                    }
                  >
                    {(severityConfig[selected.severity ?? 1] ?? severityConfig[1])
                      .label}
                  </Badge>
                </div>
                <SheetDescription>
                  {new Date(selected.created_at).toLocaleString()}
                </SheetDescription>
              </SheetHeader>

              <Separator className="bg-white/[0.06]" />

              <ScrollArea className="flex-1 px-4">
                <div className="flex flex-col gap-4 pb-4">
                  {selected.lat != null && selected.lng != null && (
                    <EmergencyMap lat={selected.lat} lng={selected.lng} />
                  )}

                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Summary
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-300">
                      {selected.translated_summary ?? "No summary available."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <InfoItem label="Reported by" value={selected.user_name ?? "Anonymous"} />
                    <InfoItem label="Medical" value={selected.medical_context ?? "None"} />
                    <InfoItem
                      label="Location"
                      value={
                        selected.lat != null && selected.lng != null
                          ? `${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}`
                          : "Unknown"
                      }
                    />
                    <InfoItem
                      label="Status"
                      value={selected.status ?? "active"}
                    />
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      <span className="text-sm text-slate-300">{value}</span>
    </div>
  );
}
