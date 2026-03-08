"use client";

import { useCallback, useRef, useState } from "react";
import { Mic, MicOff, Send, ArrowLeft, CheckCircle2, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";
import { useGeolocation } from "@/hooks/useGeolocation";
import { createClient } from "@/lib/supabase/client";
import FollowUpChat from "./FollowUpChat";

type UserProfile = {
  name: string;
  age: string;
  medicalContext: string;
  language: string;
};

export default function SOSView({
  profile,
  onEmergencyCreated,
}: {
  profile: UserProfile | null;
  onEmergencyCreated?: (id: string) => void;
}) {
  const [status, setStatus] = useState("");
  const [processing, setProcessing] = useState(false);
  const [emergencyId, setEmergencyId] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState<{
    question: string;
    ttsAudio: string | null;
  } | null>(null);
  const [silentMode, setSilentMode] = useState(false);
  const [silentText, setSilentText] = useState("");
  const { isRecording, startRecording, stopRecording } = useMediaRecorder();
  const { getPosition } = useGeolocation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const supabase = createClient();

  const submitSOS = useCallback(
    async (audioUrl: string | null, textMessage: string | null) => {
      setStatus("Getting your location...");
      setProcessing(true);

      try {
        let coords: { lat: number; lng: number };
        try {
          coords = await getPosition();
        } catch {
          setStatus("Location unavailable. Sending with approximate location...");
          coords = { lat: 0, lng: 0 };
        }

        setStatus("AI is analyzing your emergency...");
        const res = await fetch("/api/process-sos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioUrl,
            textMessage,
            lat: coords.lat,
            lng: coords.lng,
            profile: profile ?? { name: "Guest", age: "", medicalContext: "", language: "" },
          }),
          signal: AbortSignal.timeout(180_000),
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          throw new Error(`Server error ${res.status}: ${errBody}`);
        }
        const data = await res.json();

        setEmergencyId(data.emergencyId);
        onEmergencyCreated?.(data.emergencyId);
        if (data.followUpQuestion) {
          setFollowUp({
            question: data.followUpQuestion,
            ttsAudio: data.ttsAudio,
          });
          setStatus("Help is on the way. Please answer follow-up questions.");
        } else {
          setStatus("Help is on the way. Stay calm.");
        }
      } catch (err) {
        console.error(err);
        setStatus("Something went wrong. Please try again or call 911.");
      } finally {
        setProcessing(false);
      }
    },
    [getPosition, profile],
  );

  const handleSOS = useCallback(async () => {
    if (isRecording) {
      setStatus("Processing your emergency...");
      setProcessing(true);

      try {
        const audioBlob = await stopRecording();
        setStatus("Uploading audio...");
        const filename = `sos-${Date.now()}.webm`;
        const { error: uploadError } = await supabase.storage
          .from("audio-files")
          .upload(filename, audioBlob, { contentType: "audio/webm" });
        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("audio-files").getPublicUrl(filename);

        await submitSOS(publicUrl, null);
      } catch (err) {
        console.error(err);
        setStatus("Something went wrong. Please try again or call 911.");
        setProcessing(false);
      }
    } else {
      try {
        await startRecording();
        setStatus("Recording... Describe your emergency. Tap again to send.");
      } catch {
        setStatus("Microphone access denied. Please enable it.");
      }
    }
  }, [isRecording, stopRecording, startRecording, supabase.storage, submitSOS]);

  const handleSilentSOS = useCallback(async () => {
    await submitSOS(null, silentText || null);
  }, [silentText, submitSOS]);

  const handleSkipFollowUps = () => {
    setFollowUp(null);
    setStatus("Help is on the way. Stay calm.");
  };

  if (emergencyId) {
    return (
      <div className="flex flex-1 flex-col items-center gap-4 overflow-hidden px-4 pb-20 pt-4">
        <Card className="w-full max-w-sm shrink-0 border-green-900/50 bg-green-950/30">
          <CardContent className="flex items-center gap-3 py-3">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-green-500" />
            <p className="text-sm text-green-300">{status}</p>
          </CardContent>
        </Card>
        {followUp ? (
          <div className="flex min-h-0 w-full max-w-sm flex-1 flex-col">
            <FollowUpChat
              emergencyId={emergencyId}
              initialQuestion={followUp.question}
              initialTtsAudio={followUp.ttsAudio}
              onSkip={handleSkipFollowUps}
            />
          </div>
        ) : (
          <Card className="w-full max-w-sm border-gray-800 bg-gray-950">
            <CardContent className="flex flex-col items-center gap-2 py-6">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="text-center text-lg font-medium text-green-400">
                Dispatchers have been notified.
              </p>
            </CardContent>
          </Card>
        )}
        <audio ref={audioRef} className="hidden" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 pb-20">
      {!silentMode ? (
        <>
          <div className="grid w-full max-w-xs grid-cols-2 gap-4">
            {/* Voice SOS */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={handleSOS}
                disabled={processing}
                className={`group relative flex aspect-square w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border text-white shadow-[0_8px_30px_rgba(220,38,38,0.25)] transition-all active:scale-[0.97] disabled:opacity-50 ${
                  isRecording
                    ? "animate-pulse border-red-500 bg-red-600 ring-4 ring-red-500/30"
                    : "border-red-900/50 bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 hover:shadow-[0_8px_32px_rgba(220,38,38,0.35)]"
                }`}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.12),transparent)]" />
                <div className="relative">
                  {isRecording ? (
                    <Send className="h-10 w-10" strokeWidth={2} />
                  ) : processing ? (
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
                  ) : (
                    <Mic className="h-10 w-10" strokeWidth={2} />
                  )}
                </div>
                <div className="relative text-center">
                  <span className="block text-lg font-black tracking-wide">
                    {processing ? "SENDING" : isRecording ? "SEND" : "SOS"}
                  </span>
                  <span className="block text-sm font-bold uppercase tracking-widest opacity-90">
                    {isRecording ? "Tap to send" : "Voice"}
                  </span>
                </div>
              </button>
              <p className="text-center text-xs text-gray-500">
                Notifies dispatchers
              </p>
            </div>

            {/* Silent SOS */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={() => setSilentMode(true)}
                disabled={processing || isRecording}
                className="group relative flex aspect-square w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-amber-900/50 bg-gradient-to-br from-amber-500 to-amber-700 text-white shadow-[0_8px_30px_rgba(245,158,11,0.25)] transition-all hover:from-amber-400 hover:to-amber-600 hover:shadow-[0_8px_32px_rgba(245,158,11,0.35)] active:scale-[0.97] disabled:opacity-50"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.12),transparent)]" />
                <MicOff className="relative h-10 w-10" strokeWidth={2} />
                <div className="relative text-center">
                  <span className="block text-lg font-black tracking-wide">SOS</span>
                  <span className="block text-sm font-bold uppercase tracking-widest opacity-90">
                    Silent
                  </span>
                </div>
              </button>
              <p className="text-center text-xs text-gray-500">
                Location + optional message
              </p>
            </div>
          </div>

          {status && (
            <Card className="w-full max-w-xs border-gray-800 bg-gray-900/50">
              <CardContent className="py-3">
                <p className="text-center text-sm text-gray-300">{status}</p>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card className="w-full max-w-sm border-gray-800 bg-gray-950">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-gray-400 hover:text-white"
                onClick={() => setSilentMode(false)}
                disabled={processing}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <CardTitle className="text-white">Silent SOS</CardTitle>
                <CardDescription>
                  Location sent automatically. Add details if you can.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <Separator className="bg-gray-800" />

          <CardContent className="flex flex-col gap-3 pt-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MessageSquareText className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                <Input
                  value={silentText}
                  onChange={(e) => setSilentText(e.target.value)}
                  placeholder="Describe your emergency..."
                  className="border-gray-700 bg-gray-900 pl-10 text-white placeholder:text-gray-600"
                  onKeyDown={(e) => e.key === "Enter" && handleSilentSOS()}
                />
              </div>
            </div>

            <Button
              className="w-full bg-red-600 py-6 text-lg font-bold text-white shadow-lg shadow-red-900/30 hover:bg-red-500"
              onClick={handleSilentSOS}
              disabled={processing}
            >
              {processing ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Sending...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Send Silent SOS
                </div>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
