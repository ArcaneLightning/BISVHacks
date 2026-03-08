"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Emergency } from "@/lib/supabase";

type Toast = {
  id: string;
  message: string;
  severity: number;
  summary: string;
};

const severityColors: Record<number, string> = {
  5: "border-red-600 bg-red-950",
  4: "border-orange-500 bg-orange-950",
  3: "border-yellow-500 bg-yellow-950",
  2: "border-blue-500 bg-blue-950",
  1: "border-gray-500 bg-gray-900",
};

function playAlertSound(severity: number) {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.value = 0.2;
    gain.connect(ctx.destination);

    const freq = severity >= 4 ? 880 : 660;
    const beeps = severity >= 4 ? 3 : 2;

    for (let i = 0; i < beeps; i++) {
      const osc = ctx.createOscillator();
      osc.frequency.value = freq;
      osc.type = "sine";
      osc.connect(gain);
      osc.start(ctx.currentTime + i * 0.25);
      osc.stop(ctx.currentTime + i * 0.25 + 0.12);
    }

    setTimeout(() => ctx.close(), beeps * 250 + 500);
  } catch {
    /* AudioContext unavailable */
  }
}

export default function NotificationToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const supabase = createClient();

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("notifications")
      .on<Emergency>(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "emergencies" },
        (payload) => {
          const e = payload.new;
          const toast: Toast = {
            id: e.id,
            message: `${e.incident_type ?? "Emergency"} - Severity ${e.severity ?? "?"}`,
            severity: e.severity ?? 1,
            summary: e.translated_summary ?? "New emergency reported",
          };
          setToasts((prev) => [...prev, toast]);
          playAlertSound(toast.severity);
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== toast.id));
          }, 8000);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`animate-in slide-in-from-right w-80 rounded-lg border px-4 py-3 text-left shadow-lg transition-opacity hover:opacity-90 ${
            severityColors[t.severity] ?? severityColors[1]
          }`}
        >
          <p className="text-sm font-semibold text-white">{t.message}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-white/70">
            {t.summary}
          </p>
        </button>
      ))}
    </div>
  );
}
