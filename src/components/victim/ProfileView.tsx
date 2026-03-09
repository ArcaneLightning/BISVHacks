"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { User } from "@supabase/supabase-js";

type UserProfile = {
  name: string;
  age: string;
  medicalContext: string;
  language: string;
};

export default function ProfileView({
  profile,
  user,
  onSave,
  onSignOut,
}: {
  profile: UserProfile | null;
  user: User | null;
  onSave: (p: UserProfile) => void;
  onSignOut: () => void;
}) {
  const [name, setName] = useState(profile?.name ?? "");
  const [age, setAge] = useState(profile?.age ?? "");
  const [medicalContext, setMedicalContext] = useState(
    profile?.medicalContext ?? "",
  );
  const [language, setLanguage] = useState(profile?.language ?? "");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave({ name, age, medicalContext, language });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-1 flex-col items-center gap-4 px-4 pb-24 pt-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 shadow-xl">
        <h2 className="font-semibold text-white">Your Profile</h2>
        <p className="mt-1 text-sm text-slate-400">
          {user
            ? `Signed in as ${user.email}`
            : "Stored locally on your device"}
        </p>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-name" className="text-sm font-medium text-slate-300">
              Name
            </Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="rounded-xl border-white/10 bg-white/5 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-age" className="text-sm font-medium text-slate-300">
              Age
            </Label>
            <Input
              id="p-age"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Your age"
              type="number"
              className="rounded-xl border-white/10 bg-white/5 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-medical" className="text-sm font-medium text-slate-300">
              Medical Context
            </Label>
            <Input
              id="p-medical"
              value={medicalContext}
              onChange={(e) => setMedicalContext(e.target.value)}
              placeholder="Allergies, conditions, medications..."
              className="rounded-xl border-white/10 bg-white/5 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-language" className="text-sm font-medium text-slate-300">
              Preferred Language
            </Label>
            <Input
              id="p-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="e.g. Spanish, French, Arabic..."
              className="rounded-xl border-white/10 bg-white/5 text-white placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-500">
              AI will respond in this language during emergencies
            </p>
          </div>
          <Button
            className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-red-600 py-5 font-semibold text-white shadow-lg shadow-orange-500/20 hover:brightness-110"
            onClick={handleSave}
          >
            {saved ? "Saved!" : "Save Profile"}
          </Button>
        </div>
      </div>

      {user && (
        <Button
          variant="ghost"
          className="text-slate-500 hover:text-white"
          onClick={onSignOut}
        >
          Sign out
        </Button>
      )}
    </div>
  );
}
