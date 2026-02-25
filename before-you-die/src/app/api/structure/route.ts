import { NextRequest, NextResponse } from "next/server";

const VENICE_CHAT_URL =
  process.env.VENICE_API_BASE_URL ?? "https://api.venice.ai/api/v1";

/**
 * POST /api/structure
 * Accepts { transcript }, sends to Venice Chat Completions, returns
 * { title, narrative, questions }.
 * See https://docs.venice.ai/api-reference/api-spec
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.VENICE_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Server not configured: set VENICE_API_KEY" },
      { status: 503 }
    );
  }

  let body: { transcript?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { transcript } = body;
  if (typeof transcript !== "string" || !transcript.trim()) {
    return NextResponse.json(
      { error: "Missing or empty 'transcript' in body" },
      { status: 400 }
    );
  }

  const systemPrompt = `You are a calm, gentle interviewer helping someone reflect on a memory.

Rewrite the spoken memory in first person, staying close to the original wording and tone.

Do not exaggerate, dramatize, or add emotional meaning that was not clearly present.

If the memory is simple or mundane, keep the rewrite simple and concise.

Stay proportionate to the level of detail in the transcript.

Avoid sensory embellishment unless explicitly mentioned in the transcript.

Then ask one thoughtful but grounded follow-up question that helps the speaker add context or clarity — not intensity.

The question should be practical and specific, not abstract or philosophical.

Turn it into:
1. A short title
2. A structured narrative paragraph (first person)
3. One follow-up question (in a "questions" array).

Return only valid JSON in this exact shape (no markdown, no extra text):
{
  "title": "",
  "narrative": "",
  "questions": []
}`;

  const model =
    process.env.VENICE_MODEL ?? "venice-uncensored";

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
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript },
        ],
        venice_parameters: {
          include_venice_system_prompt: false,
        },
      }),
    });

    if (!veniceRes.ok) {
      const text = await veniceRes.text();
      return NextResponse.json(
        { error: "Venice reasoning request failed", details: text },
        { status: 502 }
      );
    }

    const data = (await veniceRes.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rawContent = data.choices?.[0]?.message?.content;

    if (typeof rawContent !== "string") {
      return NextResponse.json(
        { error: "Unexpected Venice response shape" },
        { status: 502 }
      );
    }

    // Strip markdown code block if present
    let content = rawContent.trim();
    const codeMatch = content.match(/^```(?:json)?\s*([\s\S]*?)```$/);
    if (codeMatch) content = codeMatch[1].trim();

    const parsed = JSON.parse(content) as {
      title?: string;
      narrative?: string;
      questions?: string[];
    };

    return NextResponse.json({
      title: parsed.title ?? "",
      narrative: parsed.narrative ?? "",
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Structure failed", details: message },
      { status: 500 }
    );
  }
}
