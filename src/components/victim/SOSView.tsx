"use client";

import { useCallback, useRef, useState } from "react";
import { Mic, MicOff, Send, ArrowLeft, CheckCircle2, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
          let errMsg = `Server error ${res.status}`;
          try {
            const parsed = JSON.parse(errBody);
            if (parsed.detail) errMsg += `: ${parsed.detail}`;
            else if (parsed.error) errMsg += `: ${parsed.error}`;
          } catch {
            if (errBody) errMsg += `: ${errBody.slice(0, 200)}`;
          }
          throw new Error(errMsg);
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
        <div className="w-full max-w-sm shrink-0 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
            <p className="text-sm font-medium text-emerald-300">{status}</p>
          </div>
        </div>
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
          <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <p className="text-center text-lg font-semibold text-emerald-300">
              Dispatchers have been notified.
            </p>
          </div>
        )}
        <audio ref={audioRef} className="hidden" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-6 px-4 pb-24 pt-6">
      {!silentMode ? (
        <>
          {/* Emergency prompt card */}
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 shadow-xl">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Are you in an emergency?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Press the SOS button. Your live location will be shared with the nearest help centre and dispatchers.
            </p>
          </div>

          {/* Main SOS button - large, gradient */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={handleSOS}
              disabled={processing}
              className={`group relative flex h-44 w-44 flex-col items-center justify-center gap-2 overflow-hidden rounded-full text-white shadow-2xl transition-all duration-200 active:scale-[0.97] disabled:opacity-60 ${
                isRecording
                  ? "animate-pulse bg-gradient-to-br from-orange-500 to-red-600 ring-4 ring-orange-500/40 ring-offset-4 ring-offset-[#0a0a0f]"
                  : "bg-gradient-to-br from-orange-500 via-red-500 to-red-600 shadow-[0_0_60px_rgba(249,115,22,0.3)] hover:shadow-[0_0_80px_rgba(249,115,22,0.4)] hover:brightness-110"
              }`}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2),transparent_50%)]" />
              <div className="relative flex flex-col items-center gap-1">
                {isRecording ? (
                  <Send className="h-12 w-12" strokeWidth={2.5} />
                ) : processing ? (
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/30 border-t-white" />
                ) : (
                  <span className="text-4xl font-black tracking-tighter">SOS</span>
                )}
                <span className="text-xs font-semibold uppercase tracking-widest opacity-90">
                  {processing ? "Sending..." : isRecording ? "Tap to send" : "Press to record"}
                </span>
              </div>
            </button>
            <p className="text-center text-xs text-slate-500">Voice • Tap to record, tap again to send</p>
          </div>

          {/* Silent SOS option */}
          <button
            onClick={() => setSilentMode(true)}
            disabled={processing || isRecording}
            className="flex w-full max-w-sm flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:border-orange-500/20 hover:bg-white/[0.06] active:scale-[0.98] disabled:opacity-50"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20">
              <MicOff className="h-6 w-6 text-amber-400" strokeWidth={2} />
            </div>
            <span className="text-sm font-semibold text-white">Silent SOS</span>
            <span className="text-xs text-slate-500">Location + message</span>
          </button>

          {status && (
            <div className="w-full max-w-sm rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-center text-sm text-slate-300">{status}</p>
            </div>
          )}
        </>
      ) : (
        <div className="w-full max-w-sm rounded-2xl border border-white/[0.06] bg-white/[0.03] shadow-xl">
          <div className="flex items-center gap-3 border-b border-white/[0.06] p-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-xl text-slate-400 hover:bg-white/10 hover:text-white"
              onClick={() => setSilentMode(false)}
              disabled={processing}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h3 className="font-semibold text-white">Silent SOS</h3>
              <p className="text-xs text-slate-400">
                Location sent automatically. Add details if you can.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 p-4">
            <div className="relative">
              <MessageSquareText className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={silentText}
                onChange={(e) => setSilentText(e.target.value)}
                placeholder="Describe your emergency..."
                className="rounded-xl border-white/10 bg-white/5 pl-10 text-white placeholder:text-slate-500 focus-visible:ring-orange-500/50"
                onKeyDown={(e) => e.key === "Enter" && handleSilentSOS()}
              />
            </div>

            <button
              onClick={handleSilentSOS}
              disabled={processing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 py-5 text-lg font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:brightness-110 disabled:opacity-60"
            >
              {processing ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Send Silent SOS
                </>
              )}
            </button>
          </div>
        </div>
      )}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
