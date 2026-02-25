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

  const systemPrompt = `You are a calm memoir interviewer. Integrate the new response into the existing narrative in first person. Preserve tone. Do not exaggerate. Then ask one thoughtful follow-up question. Return only valid JSON: { "narrative": "", "question": "" }`;

  const userContent = `Current narrative:
${narrative}

Previous follow-up question:
${lastQuestion}

User's new response:
${transcript}

Integrate the new response naturally into the narrative.`;

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
