const API_TIMEOUT = 30_000;

export async function transcribeAudio(audioUrl: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set");

  const audioResponse = await fetch(audioUrl, {
    signal: AbortSignal.timeout(API_TIMEOUT),
  });
  if (!audioResponse.ok) throw new Error("Failed to fetch audio file");
  const audioBlob = await audioResponse.blob();

  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");
  formData.append("model_id", "scribe_v1");

  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: formData,
    signal: AbortSignal.timeout(API_TIMEOUT),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ElevenLabs STT failed: ${text}`);
  }

  const data = await response.json();
  return data.text ?? "";
}

export async function generateTTS(text: string): Promise<string | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.75, similarity_boost: 0.75 },
        }),
        signal: AbortSignal.timeout(API_TIMEOUT),
      },
    );

    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  } catch {
    return null;
  }
}

export async function chatWithAI(
  messages: { role: string; content: string }[],
): Promise<string> {
  const apiKey = process.env.FEATHERLESS_API_KEY;
  if (!apiKey) throw new Error("FEATHERLESS_API_KEY not set");

  const response = await fetch(
    "https://api.featherless.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-V3-0324",
        messages,
        temperature: 0.3,
        max_tokens: 512,
      }),
      signal: AbortSignal.timeout(60_000),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Featherless AI failed: ${text}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}
