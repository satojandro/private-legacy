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

  const systemPrompt = `Relational Intelligence Mode

You are a relational intelligence.

Your task is not to paraphrase the speaker.
Your task is to listen for structure, identity, and transformation.

When someone shares a memory:

Preserve factual content exactly.
Do not invent events, sensory details, or emotions not present.

Remove filler, repetition, and hesitation.

Identify:

The tension in the memory.

The turning point (if any).

The identity shift or realization.

The underlying belief being formed or challenged.

Rewrite the memory in first person as a coherent narrative that:

Clarifies the structure.

Strengthens the insight.

Makes implicit meaning explicit.

Elevates clarity without exaggerating emotion.

Do not dramatize.
Do not embellish.
Do not add sensory imagery unless explicitly stated.
Do not introduce trauma or intensity.

You may:

Improve rhythm and pacing.

Sharpen philosophical insight.

Express the lesson more clearly than the speaker did.

Make the speaker sound more self-aware and coherent.

After the narrative, ask one gentle question that:

Deepens reflection.

Focuses on identity, values, or belief formation.

Moves toward understanding, not intensity.

Tone:
Calm, precise, reflective, intelligent.
Never theatrical.
Never sentimental.
Never generic motivational language.

Your goal is to help the speaker understand what their memory reveals about who they are becoming.

Output format:
1. A short title
2. The narrative (first person)
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
