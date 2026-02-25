import { NextRequest, NextResponse } from "next/server";

const VENICE_CHAT_URL =
  process.env.VENICE_API_BASE_URL ?? "https://api.venice.ai/api/v1";

/**
 * POST /api/transcribe
 * Accepts audio (FormData with "file"), sends to Venice Chat Completions
 * with input_audio (multimodal), returns transcript.
 * See https://docs.venice.ai/api-reference/api-spec and
 * https://docs.venice.ai/api-reference/endpoint/chat/completions
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.VENICE_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Server not configured: set VENICE_API_KEY" },
      { status: 503 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as Blob | null;

  if (!file) {
    return NextResponse.json(
      { error: "Missing audio file in form field 'file'" },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  // Venice accepts wav, mp3, aac, ogg, flac, m4a. Browser sends webm; try webm first.
  const format = (file.type?.replace("audio/", "") as string) || "webm";

  const model =
    process.env.VENICE_TRANSCRIBE_MODEL ?? process.env.VENICE_MODEL ?? "venice-uncensored";

  try {
    const veniceRes = await fetch(`${VENICE_CHAT_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a speech-to-text transcriber. Output only the exact words spoken, with no commentary, punctuation changes, or formatting.",
          },
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: { data: base64, format },
              },
            ],
          },
        ],
        venice_parameters: {
          include_venice_system_prompt: false,
        },
      }),
    });

    if (!veniceRes.ok) {
      const text = await veniceRes.text();
      return NextResponse.json(
        { error: "Venice transcription request failed", details: text },
        { status: 502 }
      );
    }

    const data = (await veniceRes.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const transcript = data.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({ transcript });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Transcribe failed", details: message },
      { status: 500 }
    );
  }
}
