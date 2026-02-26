import { NextRequest, NextResponse } from "next/server";

const VENICE_CHAT_URL =
  process.env.VENICE_API_BASE_URL ?? "https://api.venice.ai/api/v1";

/**
 * POST /api/continue
 * Accepts { narrative, lastQuestion, transcript }. Integrates the new response
 * into the narrative and returns one follow-up question. Single user payload.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.VENICE_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Server not configured: set VENICE_API_KEY" },
      { status: 503 }
    );
  }

  let body: { narrative?: string; lastQuestion?: string; transcript?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { narrative, lastQuestion, transcript } = body;
  if (typeof narrative !== "string" || !narrative.trim()) {
    return NextResponse.json(
      { error: "Missing or empty 'narrative' in body" },
      { status: 400 }
    );
  }
  if (typeof lastQuestion !== "string" || !lastQuestion.trim()) {
    return NextResponse.json(
      { error: "Missing or empty 'lastQuestion' in body" },
      { status: 400 }
    );
  }
  if (typeof transcript !== "string" || !transcript.trim()) {
    return NextResponse.json(
      { error: "Missing or empty 'transcript' in body" },
      { status: 400 }
    );
  }

  const systemPrompt = `Relational Intelligence Mode (continuation)

You are a relational intelligence.

Your task is not to paraphrase the speaker.
Your task is to listen for structure, identity, and transformation.

You have an existing narrative and the speaker's new response. Your job:

Integrate the new response into the narrative in first person.

Preserve factual content exactly. Do not invent events, sensory details, or emotions not present in what they said.

Remove filler, repetition, and hesitation from the new material.

Identify in the new response: the tension, turning point (if any), identity shift or realization, and the underlying belief being formed or challenged.

Weave it into the narrative so that:
Structure is clarified.
Insight is strengthened.
Implicit meaning is made explicit.
Clarity is elevated without exaggerating emotion.

Do not dramatize. Do not embellish. Do not add sensory imagery unless explicitly stated. Do not introduce trauma or intensity.

You may improve rhythm and pacing, sharpen philosophical insight, and express the lesson more clearly than the speaker did. Make the speaker sound more self-aware and coherent.

Then ask one gentle question that:
Deepens reflection.
Focuses on identity, values, or belief formation.
Moves toward understanding, not intensity.

Tone: Calm, precise, reflective, intelligent. Never theatrical. Never sentimental. Never generic motivational language.

Your goal is to help the speaker understand what their memory reveals about who they are becoming.

Return only valid JSON (no markdown, no extra text): { "narrative": "", "question": "" }`;

  const userContent = `Current narrative:
${narrative}

Previous follow-up question:
${lastQuestion}

User's new response:
${transcript}

Integrate the new response into the narrative using the same relational intelligence approach.`;

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
          { role: "user", content: userContent },
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

    let content = rawContent.trim();
    const codeMatch = content.match(/^```(?:json)?\s*([\s\S]*?)```$/);
    if (codeMatch) content = codeMatch[1].trim();

    const parsed = JSON.parse(content) as {
      narrative?: string;
      question?: string;
    };

    return NextResponse.json({
      narrative: parsed.narrative ?? "",
      question: parsed.question ?? "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Continue failed", details: message },
      { status: 500 }
    );
  }
}
