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

  const systemPrompt = `You are a relational intelligence. Your task is NOT to paraphrase. Listen for structure, identity, and transformation.

When the speaker shares a memory you must:
1. Preserve factual content exactly. Do not invent events, sensory details, or emotions not present. Remove filler and repetition.
2. Identify: the tension in the memory; the turning point (if any); the identity shift or realization; the underlying belief being formed or challenged.
3. Rewrite in first person as a coherent narrative that clarifies structure, strengthens insight, and makes implicit meaning explicit—without dramatizing, embellishing, or adding sensory imagery unless the speaker stated it. Do not introduce trauma or intensity.
4. You may improve rhythm and pacing, sharpen philosophical insight, and express the lesson more clearly than the speaker did. Tone: calm, precise, reflective. Never theatrical, sentimental, or generic motivational language.
5. Ask one gentle question that deepens reflection and focuses on identity, values, or belief formation—toward understanding, not intensity.

Goal: help the speaker see what this memory reveals about who they are becoming.

Return only valid JSON (no markdown): { "title": "", "narrative": "", "questions": [] }`;

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
