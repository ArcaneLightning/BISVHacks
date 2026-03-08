"use client";

import { AlertCircle, LayoutList, UserCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const tabs: { id: TabId; label: string; Icon: LucideIcon }[] = [
  { id: "sos", label: "SOS", Icon: AlertCircle },
  { id: "feed", label: "Feed", Icon: LayoutList },
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-800 bg-gray-950/95 backdrop-blur-lg">
      <div className="mx-auto flex max-w-lg">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                isActive
                  ? tab.id === "sos"
                    ? "text-red-500"
                    : "text-white"
                  : "text-gray-300 hover:text-white"
              }`}
            >
              <tab.Icon
                className={`h-5 w-5 ${isActive && tab.id === "sos" ? "fill-red-500/20" : ""}`}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
