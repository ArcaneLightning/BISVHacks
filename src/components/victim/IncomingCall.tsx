"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWebRTC } from "@/hooks/useWebRTC";
import { Button } from "@/components/ui/button";
import type { RealtimeChannel } from "@supabase/supabase-js";

function createIncomingRing(): { start: () => void; stop: () => void } {
  let ctx: AudioContext | null = null;
  let gainNode: GainNode | null = null;
  let osc: OscillatorNode | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  return {
    start() {
      try {
        ctx = new AudioContext();
        gainNode = ctx.createGain();
        gainNode.gain.value = 0;
        gainNode.connect(ctx.destination);

        osc = ctx.createOscillator();
        osc.frequency.value = 750;
        osc.type = "sine";
        osc.connect(gainNode);
        osc.start();

        let on = true;
        gainNode.gain.value = 0.2;
        intervalId = setInterval(() => {
          if (gainNode) {
            on = !on;
            gainNode.gain.setTargetAtTime(
              on ? 0.2 : 0,
              ctx!.currentTime,
              0.03,
            );
          }
        }, 500);
      } catch {
        /* AudioContext may not be available */
      }
    },
    stop() {
      if (intervalId) clearInterval(intervalId);
      try { osc?.stop(); } catch { /* already stopped */ }
      try { ctx?.close(); } catch { /* already closed */ }
      ctx = null;
      gainNode = null;
      osc = null;
      intervalId = null;
    },
  };
}

export default function IncomingCall({
  emergencyId,
}: {
  emergencyId: string | null;
}) {
  const [incomingOffer, setIncomingOffer] =
    useState<RTCSessionDescriptionInit | null>(null);
  const hasOfferRef = useRef(false);
  const offerChannelRef = useRef<RealtimeChannel | null>(null);
  const ringRef = useRef<ReturnType<typeof createIncomingRing> | null>(null);
  const supabase = createClient();
  const { callState, answerCall, endCall, remoteAudioRef, setCallState } =
    useWebRTC(emergencyId);

  const stopRing = useCallback(() => {
    ringRef.current?.stop();
    ringRef.current = null;
  }, []);

  useEffect(() => {
    if (!emergencyId) return;

    const channel = supabase
      .channel(`call:${emergencyId}`, {
        config: { broadcast: { self: false, ack: true } },
      })
      .on("broadcast", { event: "offer" }, ({ payload }) => {
        if (payload.from === "dispatcher" && !hasOfferRef.current) {
          hasOfferRef.current = true;
          setIncomingOffer(payload.offer);
          offerChannelRef.current = channel;

          stopRing();
          const ring = createIncomingRing();
          ringRef.current = ring;
          ring.start();
        }
      })
      .on("broadcast", { event: "call-ended" }, () => {
        stopRing();
        setIncomingOffer(null);
        setCallState("idle");
      })
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          console.log("[IncomingCall] Listening for calls on", emergencyId);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      stopRing();
    };
  }, [emergencyId, supabase, setCallState, stopRing]);

  const handleAccept = async () => {
    stopRing();
    if (incomingOffer && offerChannelRef.current) {
      await answerCall(incomingOffer, offerChannelRef.current);
      setIncomingOffer(null);
    }
  };

  const handleDecline = () => {
    stopRing();
    if (offerChannelRef.current) {
      offerChannelRef.current.send({
        type: "broadcast",
        event: "call-declined",
        payload: {},
      });
    }
    hasOfferRef.current = false;
    setIncomingOffer(null);
    setCallState("idle");
  };

  const handleEndCall = () => {
    stopRing();
    hasOfferRef.current = false;
    endCall();
    setCallState("idle");
  };

  if (!incomingOffer && callState !== "connected") return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 rounded-2xl border border-gray-700 bg-gray-900 p-8">
        {callState === "connected" ? (
          <>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-900/50">
              <Phone className="h-8 w-8 text-green-400" />
            </div>
            <p className="text-lg font-semibold text-white">Call Connected</p>
            <p className="text-sm text-gray-400">Speaking with dispatcher...</p>
            <Button
              variant="destructive"
              className="w-48 bg-red-700 py-5 text-lg"
              onClick={handleEndCall}
            >
              <PhoneOff className="mr-2 h-5 w-5" />
              End Call
            </Button>
          </>
        ) : (
          <>
            <div className="flex h-20 w-20 animate-bounce items-center justify-center rounded-full bg-green-900/50">
              <Phone className="h-8 w-8 text-green-400" />
            </div>
            <p className="text-lg font-semibold text-white">Incoming Call</p>
            <p className="text-sm text-gray-400">
              A dispatcher is calling you
            </p>
            <div className="flex gap-4">
              <Button
                variant="destructive"
                className="w-32 bg-red-700 py-5 text-white"
                onClick={handleDecline}
              >
                <PhoneOff className="mr-2 h-4 w-4" />
                Decline
              </Button>
              <Button
                variant="default"
                className="w-32 bg-green-700 py-5 hover:bg-green-600"
                onClick={handleAccept}
              >
                <Phone className="mr-2 h-4 w-4" />
                Accept
              </Button>
            </div>
          </>
        )}
      </div>
      <audio ref={remoteAudioRef} autoPlay className="hidden" />
    </div>
  );
}
