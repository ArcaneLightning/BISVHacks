import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { transcribeAudio, generateTTS, chatWithAI } from "@/lib/ai";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

interface ProcessSOSBody {
  audioUrl: string | null;
  textMessage: string | null;
  lat: number;
  lng: number;
  profile: {
    name: string;
    age: string;
    medicalContext: string;
    language: string;
  };
}

interface TriageResult {
  severity: number;
  incident_type: string;
  translated_summary: string;
  critical_context: string;
}

export async function POST(request: Request) {
  try {
    const body: ProcessSOSBody = await request.json();
    const { audioUrl, textMessage, lat, lng, profile } = body;

    let transcript = "";

    if (audioUrl) {
      transcript = await transcribeAudio(audioUrl);
    } else if (textMessage) {
      transcript = textMessage;
    }

    const hasAudio = !!audioUrl;
    const hasText = !!transcript.trim();
    const profileStr = `Name: ${profile.name}, Age: ${profile.age}, Medical: ${profile.medicalContext}`;

    const triage = hasText
      ? await triageWithAI(transcript, lat, lng, profileStr)
      : ({
          severity: 3,
          incident_type: "Other",
          translated_summary: `Silent SOS from ${profile.name || "anonymous user"} at GPS ${lat.toFixed(4)}, ${lng.toFixed(4)}. No details provided.`,
          critical_context: profile.medicalContext || "None provided",
        } as TriageResult);

    const supabase = getSupabase();
    const baseRow = {
      user_name: profile.name || "Anonymous",
      medical_context: profile.medicalContext || null,
      lat,
      lng,
      audio_url: audioUrl,
      transcript: transcript || "(Silent SOS - no voice/text provided)",
      severity: triage.severity,
      incident_type: triage.incident_type,
      translated_summary: triage.translated_summary,
      status: "active",
    };

    let { data: inserted, error: insertError } = await supabase
      .from("emergencies")
      .insert({ ...baseRow, preferred_language: profile.language || null })
      .select("id")
      .single();

    if (insertError) {
      console.error("Insert attempt 1 failed:", insertError.message);
      const retry = await supabase
        .from("emergencies")
        .insert(baseRow)
        .select("id")
        .single();
      inserted = retry.data;
      insertError = retry.error;
    }

    if (insertError || !inserted) {
      console.error("Supabase insert error:", insertError);
      throw new Error("Failed to store emergency");
    }

    const emergencyId = inserted.id;

    if (hasAudio || hasText) {
      await supabase.from("messages").insert({
        emergency_id: emergencyId,
        role: "user",
        content: transcript,
        audio_url: audioUrl,
      });
    }

    const knownData = buildKnownDataContext(lat, lng, profile, transcript, hasAudio);

    const followUpQuestion = await generateFollowUp(triage, transcript, knownData, profile.language);

    const [ttsAudio] = await Promise.all([
      generateTTS(followUpQuestion).catch(() => null),
      supabase.from("messages").insert({
        emergency_id: emergencyId,
        role: "ai",
        content: followUpQuestion,
      }),
      sendPushNotifications(supabase, triage).catch((e) =>
        console.error("Push notification error:", e),
      ),
    ]);

    return NextResponse.json({
      success: true,
      emergencyId,
      triage,
      followUpQuestion,
      ttsAudio,
    });
  } catch (err) {
    console.error("Process SOS error:", err);
    return NextResponse.json(
      { error: "Failed to process emergency" },
      { status: 500 },
    );
  }
}

function buildKnownDataContext(
  lat: number,
  lng: number,
  profile: ProcessSOSBody["profile"],
  transcript: string,
  hasAudio: boolean,
): string {
  const parts: string[] = [];

  parts.push(`GPS coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)} (already captured from device)`);

  if (profile.name) parts.push(`Name: ${profile.name}`);
  if (profile.age) parts.push(`Age: ${profile.age}`);
  if (profile.medicalContext) parts.push(`Known medical conditions: ${profile.medicalContext}`);

  if (!hasAudio && !transcript.trim()) {
    parts.push("The user sent a SILENT SOS (no audio or text). They may be unable to speak.");
  }

  return parts.join("\n");
}

async function triageWithAI(
  transcript: string,
  lat: number,
  lng: number,
  profileStr: string,
): Promise<TriageResult> {
  const systemPrompt =
    'You are CrisisBridge, an expert AI emergency triage system. Output ONLY raw, valid JSON. Evaluate the provided text, GPS location, and User Profile. Calculate the severity (1-5). Schema: { "severity": INTEGER, "incident_type": "Fire | Medical | Assault | Natural Disaster | Other", "translated_summary": "A clear, 2-sentence English summary.", "critical_context": "Vital info extracted from the User Profile." }';

  const userPrompt = `Transcript: '${transcript}' | GPS: ${lat}, ${lng} | User Profile: ${profileStr}`;

  const content = await chatWithAI([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in AI response");

  return JSON.parse(jsonMatch[0]) as TriageResult;
}

async function generateFollowUp(
  triage: TriageResult,
  transcript: string,
  knownData: string,
  preferredLanguage?: string,
): Promise<string> {
  const langInstruction = preferredLanguage
    ? `IMPORTANT: You MUST respond in ${preferredLanguage}.`
    : `IMPORTANT: Detect the language of the user's message and respond in the SAME language. If the message is in Spanish, respond in Spanish. If in Arabic, respond in Arabic. Default to English only if you cannot detect the language.`;

  const systemPrompt = `You are CrisisBridge, an AI emergency assistant. You just triaged an emergency: ${triage.incident_type} (Severity ${triage.severity}). Summary: ${triage.translated_summary}.

${langInstruction}

DATA ALREADY COLLECTED (DO NOT ask for these again):
${knownData}

Your task: Ask ONE clear, concise follow-up question to gather the most critical MISSING information for first responders. Be calm and reassuring.

Rules:
- NEVER ask for the user's location or GPS coordinates — we already have them from the device.
- NEVER ask for the user's name, age, or medical info if already provided above.
- Focus on: what happened, how many people are affected, their current condition, immediate dangers, whether they are safe, if anyone is trapped, etc.
- If the user sent a silent SOS, keep your question short and acknowledge they may not be able to speak. Suggest they can type a response.
- Keep it under 2 sentences.`;

  return chatWithAI([
    { role: "system", content: systemPrompt },
    { role: "user", content: transcript || "(Silent SOS — no message provided)" },
  ]);
}

async function sendPushNotifications(
  supabase: ReturnType<typeof getSupabase>,
  triage: TriageResult,
) {
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("subscription");

  if (!subs || subs.length === 0) return;

  const payload = JSON.stringify({
    title: `${triage.incident_type} Alert - Severity ${triage.severity}`,
    body: triage.translated_summary,
    icon: "/icons/icon-192.png",
  });

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublicKey || !vapidPrivateKey) return;

  const { default: webpush } = await import("web-push");
  webpush.setVapidDetails(
    "mailto:admin@crisisbridge.app",
    vapidPublicKey,
    vapidPrivateKey,
  );

  await Promise.allSettled(
    subs.map((s) => webpush.sendNotification(JSON.parse(s.subscription), payload)),
  );
}
