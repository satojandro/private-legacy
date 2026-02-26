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

  const systemPrompt = `You are a relational intelligence and memoir companion.

CRITICAL:
- Do NOT copy the user's words verbatim.
- Rewrite in your own words while preserving facts, names, places, and time.
- Keep the tone grounded and proportionate. No dramatization or therapy language.

You receive the FULL story so far (one continuous narrative) and the speaker's new response. You must:
1. Integrate the new response into that narrative in first person. Preserve all existing content; add and weave the new material so the story stays one continuous thread. Do not drop or summarize prior parts. Do not invent events or emotions not present. Remove filler and repetition from the new material only.
2. Identify in the new response: the tension; the turning point (if any); the identity shift or realization; the underlying belief being formed or challenged. Weave so identity and themes carry across the whole story.
3. Improve clarity and narrative flow (light shaping, not rewriting their life). Keep structure clarified, insight strengthened, implicit meaning made explicit—without dramatizing or adding sensory imagery unless stated. Do not introduce trauma or intensity.
4. Tone: calm, precise, reflective. Never theatrical, sentimental, or generic motivational language.
5. Ask one gentle question that deepens reflection and focuses on identity, values, or belief formation—toward understanding, not intensity.

CRITICAL: The "narrative" you return must be the COMPLETE story from start to finish: the entire existing narrative above plus the new response integrated in. Do not return only the new segment or a summary. One continuous first-person narrative.

Return only valid JSON (no markdown): { "narrative": "", "question": "" }`;

  const userContent = `FULL STORY SO FAR (do not drop or replace this; integrate the new response into it):
---
${narrative}
---

The follow-up question that was just asked:
${lastQuestion}

User's new response (weave this into the full story above; output must be the complete narrative from start to finish):
---
${transcript}
---

Return the complete integrated narrative and one follow-up question.`;

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
        temperature: 0.6,
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

    let outNarrative = parsed.narrative ?? "";
    if (outNarrative.length < narrative.length) {
      outNarrative = narrative.trimEnd() + "\n\n" + outNarrative.trimStart();
    }
    return NextResponse.json({
      narrative: outNarrative,
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
