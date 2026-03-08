"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import type { Emergency, Message } from "@/lib/supabase";
import { useWebRTC } from "@/hooks/useWebRTC";

const severityConfig: Record<number, { label: string; className: string }> = {
  5: { label: "CRITICAL", className: "bg-red-600 text-white hover:bg-red-600" },
  4: { label: "HIGH", className: "bg-orange-500 text-white hover:bg-orange-500" },
  3: { label: "MEDIUM", className: "bg-yellow-500 text-black hover:bg-yellow-500" },
  2: { label: "LOW", className: "bg-blue-500 text-white hover:bg-blue-500" },
  1: { label: "MINOR", className: "bg-gray-500 text-white hover:bg-gray-500" },
};

const roleStyles: Record<string, { label: string; bg: string }> = {
  user: { label: "Victim", bg: "bg-red-900/30" },
  ai: { label: "AI", bg: "bg-blue-900/30" },
  dispatcher: { label: "Dispatcher", bg: "bg-green-900/30" },
};

type Tab = "overview" | "transcript";

export default function CrisisCard({
  emergency,
  open,
  onOpenChange,
  onUpdate,
}: {
  emergency: Emergency | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: (updated: Emergency) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [liveEmergency, setLiveEmergency] = useState<Emergency | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const supabase = createClient();
  const { callState, startCall, endCall, remoteAudioRef } = useWebRTC(
    emergency?.id ?? null,
  );

  const current = liveEmergency ?? emergency;
  const emergencyId = emergency?.id ?? null;

  useEffect(() => {
    setLiveEmergency(emergency);
  }, [emergency]);

  useEffect(() => {
    if (!emergencyId || !open) return;

    async function load() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("emergency_id", emergencyId!)
        .order("created_at", { ascending: true });
      setMessages((data as Message[]) ?? []);
    }
    load();

    const msgChannel = supabase
      .channel(`transcript-${emergencyId}`)
      .on<Message>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `emergency_id=eq.${emergencyId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        },
      )
      .subscribe();

    const emergencyChannel = supabase
      .channel(`emergency-live-${emergencyId}`)
      .on<Emergency>(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "emergencies",
          filter: `id=eq.${emergencyId}`,
        },
        (payload) => {
          setLiveEmergency(payload.new);
          onUpdate?.(payload.new);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(emergencyChannel);
    };
  }, [emergencyId, open, supabase, onUpdate]);

  useEffect(() => {
    if (tab === "transcript") {
      scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, tab]);

  useEffect(() => {
    setTab("overview");
  }, [emergencyId]);

  const config = current
    ? (severityConfig[current.severity ?? 1] ?? severityConfig[1])
    : severityConfig[1];

  const handlePlayAudio = (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = url;
      audioRef.current.play().catch(() => {});
    }
  };

  const handleSeverityChange = async (newSeverity: number) => {
    if (!emergencyId) return;
    await supabase
      .from("emergencies")
      .update({ severity: newSeverity })
      .eq("id", emergencyId);
    setLiveEmergency((prev) =>
      prev ? { ...prev, severity: newSeverity } : prev,
    );
  };

  const handleResolve = async () => {
    if (!emergencyId) return;
    await supabase
      .from("emergencies")
      .update({ status: "resolved" })
      .eq("id", emergencyId);
    setLiveEmergency((prev) =>
      prev ? { ...prev, status: "resolved" } : prev,
    );
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="z-[1100] flex w-full flex-col border-slate-800 bg-slate-950 sm:max-w-lg"
      >
        {current ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <SheetTitle className="text-white">
                  {current.incident_type ?? "Unknown Incident"}
                </SheetTitle>
                <Badge className={config.className}>{config.label}</Badge>
                {current.status === "resolved" && (
                  <Badge className="bg-green-800 text-green-200">RESOLVED</Badge>
                )}
              </div>
              <SheetDescription>
                {new Date(current.created_at).toLocaleString()}
              </SheetDescription>
            </SheetHeader>

            {/* Tab switcher */}
            <div className="flex border-b border-slate-800">
              <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
                Overview
              </TabButton>
              <TabButton active={tab === "transcript"} onClick={() => setTab("transcript")}>
                Transcript ({messages.length})
              </TabButton>
            </div>

            {/* Call controls */}
            <div className="flex shrink-0 items-center gap-2 px-4">
              {callState === "idle" && (
                <Button
                  variant="default"
                  className="flex-1 bg-green-700 hover:bg-green-600"
                  onClick={startCall}
                >
                  Call Victim
                </Button>
              )}
              {callState === "calling" && (
                <Button
                  variant="outline"
                  className="flex-1 animate-pulse border-yellow-600 text-yellow-400"
                  onClick={endCall}
                >
                  Ringing... Cancel
                </Button>
              )}
              {callState === "connected" && (
                <Button
                  variant="destructive"
                  className="flex-1 bg-red-700"
                  onClick={endCall}
                >
                  End Call
                </Button>
              )}
              {current.audio_url && (
                <Button
                  size="sm"
                  className="flex-1 border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  onClick={() => handlePlayAudio(current.audio_url!)}
                >
                  Play SOS Audio
                </Button>
              )}
            </div>

            <Separator className="shrink-0 bg-slate-800" />

            {/* Tab content */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {tab === "overview" ? (
                <ScrollArea className="h-full px-4">
                  <div className="flex flex-col gap-4 pb-4">
                    <Section title="AI Summary">
                      <p className="text-sm leading-relaxed text-slate-300">
                        {current.translated_summary ?? "No summary available."}
                      </p>
                    </Section>

                    <Section title="Initial Report">
                      <p className="text-sm leading-relaxed text-slate-300">
                        {current.transcript ?? "No transcript available."}
                      </p>
                    </Section>

                    <Section title="Victim Info">
                      <div className="grid grid-cols-2 gap-3">
                        <InfoItem label="Name" value={current.user_name ?? "Anonymous"} />
                        <InfoItem label="Medical" value={current.medical_context ?? "None"} />
                        <InfoItem
                          label="Location"
                          value={
                            current.lat != null && current.lng != null
                              ? `${current.lat.toFixed(5)}, ${current.lng.toFixed(5)}`
                              : "Unknown"
                          }
                        />
                        <InfoItem label="Status" value={current.status ?? "active"} />
                      </div>
                    </Section>

                    {/* Severity control */}
                    <Section title="Update Severity">
                      <div className="flex flex-wrap gap-1.5">
                        {[1, 2, 3, 4, 5].map((s) => {
                          const sc = severityConfig[s];
                          const isActive = (current.severity ?? 1) === s;
                          return (
                            <button
                              key={s}
                              onClick={() => handleSeverityChange(s)}
                              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                                isActive
                                  ? `${sc.className} ring-2 ring-white/50`
                                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                              }`}
                            >
                              {s} - {sc.label}
                            </button>
                          );
                        })}
                      </div>
                    </Section>

                    {/* Resolve button */}
                    {current.status !== "resolved" && (
                      <Button
                        className="w-full bg-green-800 text-green-200 hover:bg-green-700"
                        onClick={handleResolve}
                      >
                        Mark as Resolved
                      </Button>
                    )}

                    {messages.length > 0 && (
                      <Section title="Quick Glance">
                        <div className="flex flex-col gap-1.5">
                          {messages.slice(-3).map((m) => {
                            const style = roleStyles[m.role] ?? roleStyles.user;
                            return (
                              <div key={m.id} className="flex items-start gap-2 text-xs">
                                <span className="mt-0.5 shrink-0 font-semibold text-slate-500">
                                  {style.label}:
                                </span>
                                <span className="line-clamp-1 text-slate-400">{m.content}</span>
                              </div>
                            );
                          })}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 text-xs text-blue-400 hover:text-blue-300"
                          onClick={() => setTab("transcript")}
                        >
                          View full transcript →
                        </Button>
                      </Section>
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <ScrollArea className="h-full px-4">
                  {messages.length === 0 ? (
                    <p className="py-8 text-center text-xs text-slate-600">
                      No messages yet.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2 pb-4">
                      {messages.map((m) => {
                        const style = roleStyles[m.role] ?? roleStyles.user;
                        return (
                          <div
                            key={m.id}
                            className={`rounded-lg px-3 py-2 ${style.bg}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-400">
                                {style.label}
                              </span>
                              <span className="text-xs text-slate-600">
                                {new Date(m.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <p className="mt-0.5 text-sm text-slate-300">
                              {m.content}
                            </p>
                            {m.audio_url && (
                              <button
                                onClick={() => handlePlayAudio(m.audio_url!)}
                                className="mt-1 text-xs text-blue-400 underline"
                              >
                                Play audio
                              </button>
                            )}
                          </div>
                        );
                      })}
                      <div ref={scrollEndRef} />
                    </div>
                  )}
                </ScrollArea>
              )}
            </div>

            <audio ref={audioRef} className="hidden" />
            <audio ref={remoteAudioRef} autoPlay className="hidden" />
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="text-white">No incident selected</SheetTitle>
              <SheetDescription>Select an incident to view details.</SheetDescription>
            </SheetHeader>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-b-2 border-blue-500 text-white"
          : "text-slate-500 hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
        {label}
      </span>
      <span className="text-sm text-slate-300">{value}</span>
    </div>
  );
}
