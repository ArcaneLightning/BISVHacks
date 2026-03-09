"use client";

import { AlertCircle, LayoutList, UserCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const tabs: { id: TabId; label: string; Icon: LucideIcon }[] = [
  { id: "sos", label: "Home", Icon: AlertCircle },
  { id: "feed", label: "Alerts", Icon: LayoutList },
  { id: "profile", label: "Profile", Icon: UserCircle },
];

export type TabId = "sos" | "feed" | "profile";

export default function BottomNav({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] bg-[#0a0a0f]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          const isSos = tab.id === "sos";
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex flex-1 flex-col items-center gap-1.5 py-3 text-xs font-medium transition-all ${
                isActive
                  ? isSos
                    ? "text-orange-400"
                    : "text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {isSos && isActive ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-600 shadow-lg shadow-orange-500/30">
                  <tab.Icon className="h-4 w-4 text-white" strokeWidth={2.5} />
                </span>
              ) : (
                <tab.Icon
                  className="h-5 w-5"
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
              )}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
