import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { transcribeAudio, generateTTS, chatWithAI } from "@/lib/ai";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

interface FollowUpBody {
  emergency_id: string;
  audioUrl?: string;
  textMessage?: string;
}

export async function POST(request: Request) {
  try {
    const body: FollowUpBody = await request.json();
    const { emergency_id, audioUrl, textMessage } = body;
    const supabase = getSupabase();

    let transcript = "";
    if (audioUrl) {
      transcript = await transcribeAudio(audioUrl);
    } else if (textMessage) {
      transcript = textMessage;
    }

    await supabase.from("messages").insert({
      emergency_id,
      role: "user",
      content: transcript,
      audio_url: audioUrl ?? null,
    });

    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("emergency_id", emergency_id)
      .order("created_at", { ascending: true });

    let { data: emergency } = await supabase
      .from("emergencies")
      .select("translated_summary, incident_type, severity, medical_context, lat, lng, user_name, transcript, preferred_language")
      .eq("id", emergency_id)
      .single();

    if (!emergency) {
      const retry = await supabase
        .from("emergencies")
        .select("translated_summary, incident_type, severity, medical_context, lat, lng, user_name, transcript")
        .eq("id", emergency_id)
        .single();
      emergency = retry.data;
    }

    const knownParts: string[] = [];
    if (emergency?.lat != null && emergency?.lng != null) {
      knownParts.push(`GPS coordinates: ${emergency.lat}, ${emergency.lng} (already captured from device)`);
    }
    if (emergency?.user_name) knownParts.push(`Name: ${emergency.user_name}`);
    if (emergency?.medical_context) knownParts.push(`Known medical conditions: ${emergency.medical_context}`);
    const knownData = knownParts.join("\n");

    const prefLang = (emergency as Record<string, unknown>)?.preferred_language as string | null;
    const langInstruction = prefLang
      ? `IMPORTANT: You MUST respond in ${prefLang}.`
      : `IMPORTANT: Detect the language of the user's messages and respond in the SAME language. If the user writes in Spanish, respond in Spanish. If in Arabic, respond in Arabic. Default to English only if you cannot detect the language.`;

    const systemPrompt = `You are CrisisBridge, an AI emergency assistant helping a victim during a crisis. You are conducting follow-up questions to gather critical information for first responders.

${langInstruction}

Emergency context: ${emergency?.incident_type ?? "Unknown"} (Severity ${emergency?.severity ?? "?"}). Summary: ${emergency?.translated_summary ?? "N/A"}.

DATA ALREADY COLLECTED (DO NOT ask for any of these again):
${knownData}

Rules:
- Ask ONE clear, concise follow-up question at a time.
- NEVER ask for the user's location, GPS, address, or where they are — we already have precise coordinates.
- NEVER ask for the user's name, age, or medical info if listed above.
- Focus on: what exactly happened, how many people are affected, their current condition, immediate dangers, whether anyone is trapped, if the scene is safe.
- Be calm and reassuring.
- If you have enough information (after 3-5 exchanges), respond with exactly "TRIAGE_COMPLETE" followed by a brief reassuring message.
- Keep responses under 2 sentences.`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...(history ?? []).map((m) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content,
      })),
    ];

    const aiResponse = await chatWithAI(aiMessages);
    const isDone = aiResponse.includes("TRIAGE_COMPLETE");
    const question = isDone
      ? aiResponse.replace("TRIAGE_COMPLETE", "").trim()
      : aiResponse;

    await supabase.from("messages").insert({
      emergency_id,
      role: "ai",
      content: question,
    });

    // Update summary and severity based on new information
    try {
      const allUserMessages = (history ?? [])
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join("\n");

      const updatePrompt = `You are an emergency triage system. Based on ALL information gathered so far, produce an updated assessment.

Original report: ${emergency?.transcript ?? "N/A"}
Original summary: ${emergency?.translated_summary ?? "N/A"}
Original severity: ${emergency?.severity ?? 3}
Incident type: ${emergency?.incident_type ?? "Unknown"}

All victim responses during follow-up:
${allUserMessages}

Latest response: ${transcript}

Output ONLY raw valid JSON with this schema:
{
  "severity": INTEGER (1-5, reassess based on all info — increase if situation is worse than initially thought, decrease if less severe),
  "translated_summary": "Updated 2-3 sentence summary incorporating ALL information gathered including follow-up details. Include key details like number of people affected, injuries, dangers, etc."
}`;

      const updateContent = await chatWithAI([
        { role: "system", content: "Output ONLY raw valid JSON. No markdown, no explanation." },
        { role: "user", content: updatePrompt },
      ]);

      const jsonMatch = updateContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const update = JSON.parse(jsonMatch[0]);
        if (update.severity && update.translated_summary) {
          await supabase
            .from("emergencies")
            .update({
              severity: update.severity,
              translated_summary: update.translated_summary,
            })
            .eq("id", emergency_id);
        }
      }
    } catch (e) {
      console.error("Failed to update summary/severity:", e);
    }

    const ttsAudio = await generateTTS(question);

    return NextResponse.json({
      question,
      ttsAudio,
      done: isDone,
      userTranscript: transcript,
    });
  } catch (err) {
    console.error("Follow-up error:", err);
    return NextResponse.json(
      { error: "Failed to process follow-up" },
      { status: 500 },
    );
  }
}
