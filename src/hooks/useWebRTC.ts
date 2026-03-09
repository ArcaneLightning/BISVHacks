"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type CallState = "idle" | "calling" | "connected" | "ended";
type SubscribeStatus = string;

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
];

function isPCOpen(pc: RTCPeerConnection | null): pc is RTCPeerConnection {
  return pc !== null && pc.signalingState !== "closed";
}

function createRingtone(): { start: () => void; stop: () => void } {
  let ctx: AudioContext | null = null;
  let gainNode: GainNode | null = null;
  let osc1: OscillatorNode | null = null;
  let osc2: OscillatorNode | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  return {
    start() {
      try {
        ctx = new AudioContext();
        gainNode = ctx.createGain();
        gainNode.gain.value = 0;
        gainNode.connect(ctx.destination);

        osc1 = ctx.createOscillator();
        osc1.frequency.value = 440;
        osc1.type = "sine";
        osc1.connect(gainNode);
        osc1.start();

        osc2 = ctx.createOscillator();
        osc2.frequency.value = 480;
        osc2.type = "sine";
        osc2.connect(gainNode);
        osc2.start();

        let on = true;
        gainNode.gain.value = 0.15;
        intervalId = setInterval(() => {
          if (gainNode) {
            on = !on;
            gainNode.gain.setTargetAtTime(
              on ? 0.15 : 0,
              ctx!.currentTime,
              0.05,
            );
          }
        }, 1000);
      } catch {
        /* AudioContext may not be available */
      }
    },
    stop() {
      if (intervalId) clearInterval(intervalId);
      try { osc1?.stop(); } catch { /* already stopped */ }
      try { osc2?.stop(); } catch { /* already stopped */ }
      try { ctx?.close(); } catch { /* already closed */ }
      ctx = null;
      gainNode = null;
      osc1 = null;
      osc2 = null;
      intervalId = null;
    },
  };
}

export function useWebRTC(emergencyId: string | null) {
  const [callState, setCallState] = useState<CallState>("idle");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const ringtoneRef = useRef<ReturnType<typeof createRingtone> | null>(null);
  const cleanedUpRef = useRef(false);
  const offerRetryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answeredRef = useRef(false);
  const supabase = createClient();

  const stopRingtone = useCallback(() => {
    ringtoneRef.current?.stop();
    ringtoneRef.current = null;
  }, []);

  const cleanup = useCallback(() => {
    if (cleanedUpRef.current) return;
    cleanedUpRef.current = true;
    stopRingtone();
    if (offerRetryRef.current) {
      clearInterval(offerRetryRef.current);
      offerRetryRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      try { pcRef.current.close(); } catch { /* already closed */ }
      pcRef.current = null;
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pendingCandidatesRef.current = [];
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, [supabase, stopRingtone]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const flushCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const pending = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const candidate of pending) {
      if (!isPCOpen(pc)) break;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        /* ignore – PC may have closed mid-flush */
      }
    }
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (remoteAudioRef.current && stream) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === "connected" || state === "completed") {
        stopRingtone();
        setCallState("connected");
      } else if (state === "disconnected" || state === "failed") {
        stopRingtone();
        setCallState("ended");
        setTimeout(() => setCallState("idle"), 2000);
        cleanup();
      }
    };

    pcRef.current = pc;
    return pc;
  }, [cleanup, stopRingtone]);

  const addIceCandidate = useCallback(
    async (candidate: RTCIceCandidateInit) => {
      const pc = pcRef.current;
      if (!isPCOpen(pc)) return;
      if (pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {
          /* PC may have closed */
        }
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    },
    [],
  );

  const startCall = useCallback(async () => {
    if (!emergencyId) return;
    cleanedUpRef.current = false;
    answeredRef.current = false;
    setCallState("calling");
    pendingCandidatesRef.current = [];

    const ring = createRingtone();
    ringtoneRef.current = ring;
    ring.start();

    const pc = createPeerConnection();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreamRef.current = stream;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const channel = supabase.channel(`call:${emergencyId}`, {
      config: { broadcast: { self: false, ack: true } },
    });
    channelRef.current = channel;

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        try {
          channel.send({
            type: "broadcast",
            event: "ice-candidate",
            payload: { candidate: event.candidate.toJSON(), from: "dispatcher" },
          });
        } catch { /* channel may be closed */ }
      }
    };

    const sendOffer = async () => {
      if (answeredRef.current || !isPCOpen(pcRef.current)) return;
      try {
        if (!pcRef.current!.localDescription) {
          const offer = await pcRef.current!.createOffer();
          if (!isPCOpen(pcRef.current)) return;
          await pcRef.current!.setLocalDescription(offer);
        }
        await channel.send({
          type: "broadcast",
          event: "offer",
          payload: { offer: pcRef.current!.localDescription, from: "dispatcher" },
        });
      } catch {
        /* PC closed or channel unavailable */
      }
    };

    channel
      .on("broadcast", { event: "answer" }, async (msg) => {
        const data = msg?.payload ?? msg;
        const answer = data?.answer;
        if (!answer) return;
        answeredRef.current = true;
        if (offerRetryRef.current) {
          clearInterval(offerRetryRef.current);
          offerRetryRef.current = null;
        }
        if (!isPCOpen(pcRef.current)) return;
        try {
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription(answer),
          );
          await flushCandidates(pcRef.current);
        } catch {
          /* connection may have closed */
        }
      })
      .on("broadcast", { event: "ice-candidate" }, async (msg) => {
        const data = msg?.payload ?? msg;
        if (data?.from === "dispatcher") return;
        if (data?.candidate) {
          await addIceCandidate(data.candidate);
        }
      })
      .on("broadcast", { event: "call-declined" }, () => {
        answeredRef.current = true;
        stopRingtone();
        setCallState("ended");
        setTimeout(() => setCallState("idle"), 2000);
        cleanup();
      })
      .on("broadcast", { event: "call-ended" }, () => {
        answeredRef.current = true;
        stopRingtone();
        setCallState("ended");
        setTimeout(() => setCallState("idle"), 2000);
        cleanup();
      })
      .subscribe(async (status: SubscribeStatus) => {
        if (status !== "SUBSCRIBED") return;
        await sendOffer();
        offerRetryRef.current = setInterval(() => {
          sendOffer();
        }, 3000);
      });
  }, [
    emergencyId,
    createPeerConnection,
    supabase,
    cleanup,
    flushCandidates,
    addIceCandidate,
    stopRingtone,
  ]);

  const endCall = useCallback(() => {
    stopRingtone();
    const ch = channelRef.current;
    if (ch) {
      try {
        ch.send({
          type: "broadcast",
          event: "call-ended",
          payload: {},
        });
      } catch {
        /* channel may already be removed */
      }
    }
    setCallState("ended");
    setTimeout(() => setCallState("idle"), 2000);
    cleanup();
  }, [cleanup, stopRingtone]);

  const answerCall = useCallback(
    async (offer: RTCSessionDescriptionInit, channel: RealtimeChannel) => {
      cleanedUpRef.current = false;
      pendingCandidatesRef.current = [];
      const pc = createPeerConnection();
      channelRef.current = channel;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate && channelRef.current) {
          channel.send({
            type: "broadcast",
            event: "ice-candidate",
            payload: { candidate: event.candidate.toJSON(), from: "victim" },
          });
        }
      };

      channel.on(
        "broadcast",
        { event: "ice-candidate" },
        async ({ payload }) => {
          if (payload.from !== "victim") {
            await addIceCandidate(payload.candidate);
          }
        },
      );

      channel.on("broadcast", { event: "call-ended" }, () => {
        stopRingtone();
        setCallState("ended");
        setTimeout(() => setCallState("idle"), 2000);
        cleanup();
      });

      if (!isPCOpen(pc)) return;
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushCandidates(pc);
      if (!isPCOpen(pc)) return;
      const answer = await pc.createAnswer();
      if (!isPCOpen(pc)) return;
      await pc.setLocalDescription(answer);

      channel.send({
        type: "broadcast",
        event: "answer",
        payload: { answer },
      });

      setCallState("connected");
    },
    [createPeerConnection, flushCandidates, addIceCandidate, cleanup, stopRingtone],
  );

  return {
    callState,
    startCall,
    endCall,
    answerCall,
    remoteAudioRef,
    setCallState,
  };
}
