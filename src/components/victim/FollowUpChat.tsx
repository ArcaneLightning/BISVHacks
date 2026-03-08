"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";
import { createClient } from "@/lib/supabase/client";

type ChatMessage = {
  role: "user" | "ai";
  content: string;
};

export default function FollowUpChat({
  emergencyId,
  initialQuestion,
  initialTtsAudio,
  onSkip,
}: {
  emergencyId: string;
  initialQuestion: string;
  initialTtsAudio: string | null;
  onSkip: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "ai", content: initialQuestion },
  ]);
  const [done, setDone] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [textInput, setTextInput] = useState("");
  const { isRecording, startRecording, stopRecording } = useMediaRecorder();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const autoRecordRef = useRef(false);
  const supabase = createClient();

  useEffect(() => {
    if (initialTtsAudio) playBase64Audio(initialTtsAudio);
  }, [initialTtsAudio]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const playBase64Audio = (base64: string) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "audio/mpeg" });
    const url = URL.createObjectURL(blob);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = url;
      audioRef.current.play().catch(() => {});
      setIsSpeaking(true);
      autoRecordRef.current = true;
    }
  };

  const handleAudioEnded = useCallback(async () => {
    setIsSpeaking(false);
    if (autoRecordRef.current && !done && !textInput.trim()) {
      autoRecordRef.current = false;
      try {
        await startRecording();
      } catch {
        /* mic denied */
      }
    } else {
      autoRecordRef.current = false;
    }
  }, [done, startRecording, textInput]);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsSpeaking(false);
    autoRecordRef.current = false;
  }, []);

  const sendFollowUp = useCallback(
    async (payload: { audioUrl?: string; textMessage?: string; displayText: string }) => {
      setProcessing(true);
      try {
        const res = await fetch("/api/follow-up", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            emergency_id: emergencyId,
            audioUrl: payload.audioUrl,
            textMessage: payload.textMessage,
          }),
          signal: AbortSignal.timeout(60_000),
        });

        if (!res.ok) throw new Error("Follow-up failed");
        const data = await res.json();

        setMessages((prev) => [
          ...prev,
          { role: "user", content: data.userTranscript ?? payload.displayText },
          { role: "ai", content: data.question },
        ]);

        if (data.done) {
          setDone(true);
        } else if (data.ttsAudio) {
          playBase64Audio(data.ttsAudio);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setProcessing(false);
      }
    },
    [emergencyId],
  );

  const handleRecord = useCallback(async () => {
    if (isRecording) {
      const audioBlob = await stopRecording();
      const filename = `followup-${Date.now()}.webm`;
      await supabase.storage
        .from("audio-files")
        .upload(filename, audioBlob, { contentType: "audio/webm" });

      const {
        data: { publicUrl },
      } = supabase.storage.from("audio-files").getPublicUrl(filename);

      await sendFollowUp({ audioUrl: publicUrl, displayText: "Recorded response" });
    } else {
      stopSpeaking();
      try {
        await startRecording();
      } catch {
        /* mic denied */
      }
    }
  }, [isRecording, stopRecording, startRecording, supabase.storage, stopSpeaking, sendFollowUp]);

  const handleTextSend = useCallback(async () => {
    const text = textInput.trim();
    if (!text) return;
    if (isRecording) {
      try { await stopRecording(); } catch { /* ignore */ }
    }
    stopSpeaking();
    setTextInput("");
    await sendFollowUp({ textMessage: text, displayText: text });
  }, [textInput, stopSpeaking, sendFollowUp, isRecording, stopRecording]);

  return (
    <div className="flex w-full flex-1 flex-col gap-3 overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-800 bg-gray-950 p-3">
        <div className="flex flex-col gap-2">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-lg px-3 py-2 text-sm ${
                m.role === "ai"
                  ? "self-start bg-gray-800 text-gray-200"
                  : "self-end bg-red-900/50 text-gray-200"
              }`}
            >
              <span className="text-xs font-semibold uppercase text-gray-500">
                {m.role === "ai" ? "CrisisBridge AI" : "You"}
              </span>
              <p className="mt-0.5">{m.content}</p>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </div>

      <div className="shrink-0">
        {!done ? (
          <div className="flex flex-col gap-2">
            {isSpeaking && (
              <Button
                onClick={stopSpeaking}
                variant="outline"
                className="w-full border-yellow-700 text-yellow-400 hover:bg-yellow-900/20"
              >
                Stop AI Speaking
              </Button>
            )}

            {/* Text input */}
            <div className="flex gap-2">
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !processing && handleTextSend()}
                onFocus={() => {
                  if (isRecording) {
                    stopRecording().catch(() => {});
                  }
                  stopSpeaking();
                }}
                placeholder="Type a response..."
                disabled={processing}
                className="border-gray-700 bg-gray-900 text-white placeholder:text-gray-600"
              />
              <Button
                onClick={handleTextSend}
                disabled={processing || !textInput.trim()}
                className="shrink-0 bg-blue-600 text-white hover:bg-blue-700"
              >
                Send
              </Button>
            </div>

            {/* Voice button */}
            <Button
              onClick={handleRecord}
              disabled={processing}
              variant={isRecording ? "destructive" : "outline"}
              className={`w-full py-5 ${
                isRecording
                  ? "animate-pulse bg-red-600 text-white"
                  : "border-gray-700 text-gray-300"
              }`}
            >
              {processing
                ? "Processing..."
                : isRecording
                  ? "Tap to Send Response"
                  : isSpeaking
                    ? "Tap to Interrupt & Respond"
                    : "Hold to Speak"}
            </Button>

            <Button
              variant="ghost"
              className="text-xs text-gray-600 hover:text-gray-400"
              onClick={onSkip}
            >
              Skip follow-up questions
            </Button>
          </div>
        ) : (
          <p className="text-center text-sm text-green-400">
            All information gathered. Help is on the way.
          </p>
        )}
      </div>

      <audio ref={audioRef} className="hidden" onEnded={handleAudioEnded} />
    </div>
  );
}
