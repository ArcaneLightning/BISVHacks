"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Emergency } from "@/lib/supabase";

const severityConfig: Record<number, { label: string; className: string }> = {
  5: { label: "CRITICAL", className: "bg-red-600 text-white hover:bg-red-600" },
  4: { label: "HIGH", className: "bg-orange-500 text-white hover:bg-orange-500" },
  3: { label: "MEDIUM", className: "bg-yellow-500 text-black hover:bg-yellow-500" },
  2: { label: "LOW", className: "bg-blue-500 text-white hover:bg-blue-500" },
  1: { label: "MINOR", className: "bg-gray-500 text-white hover:bg-gray-500" },
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function PriorityQueue({
  emergencies,
  onSelect,
}: {
  emergencies: Emergency[];
  onSelect: (e: Emergency) => void;
}) {
  const sorted = [...emergencies].sort(
    (a, b) => (b.severity ?? 0) - (a.severity ?? 0),
  );

  return (
    <div className="flex h-full flex-col border-r border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-lg font-bold text-white">Priority Queue</h2>
        <Badge className="bg-slate-800 text-slate-300">
          {emergencies.length}
        </Badge>
      </div>
      <Separator className="bg-slate-800" />
      <ScrollArea className="min-h-0 flex-1">
        {sorted.length === 0 && (
          <p className="p-4 text-sm text-slate-500">
            No active emergencies.
          </p>
        )}
        {sorted.map((e) => {
          const config = severityConfig[e.severity ?? 1] ?? severityConfig[1];
          return (
            <button
              key={e.id}
              onClick={() => onSelect(e)}
              className="flex w-full flex-col gap-1 border-b border-slate-800/50 px-4 py-3 text-left transition-colors hover:bg-slate-900"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-white">
                  {e.incident_type ?? "Unknown"}
                </span>
                <Badge className={config.className}>{config.label}</Badge>
              </div>
              <p className="line-clamp-2 text-xs text-slate-400">
                {e.translated_summary ?? "Pending analysis..."}
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>{e.user_name ?? "Anonymous"}</span>
                <span>&middot;</span>
                <span>{formatTime(e.created_at)}</span>
              </div>
            </button>
          );
        })}
      </ScrollArea>
    </div>
  );
}
