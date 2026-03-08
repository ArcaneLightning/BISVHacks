"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="flex flex-1 flex-col items-center gap-4 px-4 pb-20 pt-4">
      <Card className="w-full max-w-sm border-gray-800 bg-gray-950">
        <CardHeader>
          <CardTitle className="text-white">Your Profile</CardTitle>
          <CardDescription>
            {user
              ? `Signed in as ${user.email}`
              : "Stored locally on your device"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-name" className="text-white">
              Name
            </Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="border-gray-700 bg-gray-900 text-white"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-age" className="text-white">
              Age
            </Label>
            <Input
              id="p-age"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="Your age"
              type="number"
              className="border-gray-700 bg-gray-900 text-white"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-medical" className="text-white">
              Medical Context
            </Label>
            <Input
              id="p-medical"
              value={medicalContext}
              onChange={(e) => setMedicalContext(e.target.value)}
              placeholder="Allergies, conditions, medications..."
              className="border-gray-700 bg-gray-900 text-white"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-language" className="text-white">
              Preferred Language
            </Label>
            <Input
              id="p-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="e.g. Spanish, French, Arabic..."
              className="border-gray-700 bg-gray-900 text-white"
            />
            <p className="text-xs text-gray-600">
              AI will respond in this language during emergencies
            </p>
          </div>
          <Button
            variant="default"
            className="w-full py-5"
            onClick={handleSave}
          >
            {saved ? "Saved!" : "Save Profile"}
          </Button>
        </CardContent>
      </Card>

      {user && (
        <Button
          variant="ghost"
          className="text-gray-500 hover:text-white"
          onClick={onSignOut}
        >
          Sign out
        </Button>
      )}
    </div>
  );
}
