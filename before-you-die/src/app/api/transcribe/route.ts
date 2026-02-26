import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";

const VENICE_BASE = process.env.VENICE_API_BASE_URL ?? "https://api.venice.ai/api/v1";
/** Audio transcription endpoint (OpenAI-compatible: POST with FormData file + model). Not chat/completions. */
const VENICE_TRANSCRIBE_URL =
  process.env.VENICE_TRANSCRIBE_ENDPOINT ?? `${VENICE_BASE}/audio/transcriptions`;

/** Cached ASR model id so we don't call /models on every request. */
let cachedAsrModelId: string | null = null;

/**
 * Resolve the model id to use for transcription. Must be an ASR (speech-to-text) model,
 * not a text chat model. See https://docs.venice.ai/api-reference/endpoint/models/list (type=asr).
 */
async function getTranscribeModelId(apiKey: string): Promise<string> {
  if (process.env.VENICE_TRANSCRIBE_MODEL) return process.env.VENICE_TRANSCRIBE_MODEL;
  if (cachedAsrModelId) return cachedAsrModelId;
  const res = await fetch(`${VENICE_BASE}/models?type=asr`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(
      "Could not list ASR models. Set VENICE_TRANSCRIBE_MODEL to an audio/transcription model id (see Venice docs: models?type=asr)."
    );
  }
  const json = (await res.json()) as { data?: Array<{ id?: string }> };
  const first = json.data?.[0]?.id;
  if (!first) {
    throw new Error(
      "No ASR models found. Set VENICE_TRANSCRIBE_MODEL to a Venice transcription model id."
    );
  }
  cachedAsrModelId = first;
  return first;
}

/** Venice accepts: wav | mp3 | aiff | aac | ogg | flac | m4a | pcm16 | pcm24. Browser records webm. */
const VENICE_AUDIO_FORMATS = new Set([
  "wav", "mp3", "aiff", "aac", "ogg", "flac", "m4a", "pcm16", "pcm24",
]);

/** Resolve path to ffmpeg binary so it works when __dirname is wrong (e.g. bundler/sandbox). */
function getFfmpegPath(): string {
  if (process.env.FFMPEG_BIN) return process.env.FFMPEG_BIN;
  const fromCwd = path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg");
  try {
    const fsSync = require("fs") as typeof import("fs");
    fsSync.accessSync(fromCwd, fsSync.constants.X_OK);
    return fromCwd;
  } catch {
    // ffmpeg-static export (uses __dirname; can be wrong in some runtimes)
    if (typeof ffmpegStatic === "string") return ffmpegStatic;
    return "ffmpeg";
  }
}

/** Convert webm (or other) buffer to wav using ffmpeg. Returns wav buffer. */
async function toWav(inputBuffer: Buffer, inputExt: string): Promise<Buffer> {
  (ffmpeg as unknown as { setFfmpegPath: (p: string) => void }).setFfmpegPath(getFfmpegPath());
  const tmpDir = os.tmpdir();
  const inPath = path.join(tmpDir, `byd-in-${Date.now()}.${inputExt}`);
  const outPath = path.join(tmpDir, `byd-out-${Date.now()}.wav`);
  await fs.writeFile(inPath, inputBuffer);
  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inPath)
        .output(outPath)
        .audioCodec("pcm_s16le")
        .on("end", () => resolve())
        .on("error", reject)
        .run();
    });
    const wav = await fs.readFile(outPath);
    return wav;
  } finally {
    await fs.unlink(inPath).catch(() => {});
    await fs.unlink(outPath).catch(() => {});
  }
}

/**
 * POST /api/transcribe
 * Accepts audio (FormData with "file"), converts to wav if needed, then POSTs to
 * Venice audio transcriptions endpoint (not chat/completions). Returns { transcript }.
 * Endpoint: POST /v1/audio/transcriptions with FormData (file, model).
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
  let buffer: Buffer = Buffer.from(arrayBuffer);
  let format = (file.type?.replace("audio/", "") as string) || "webm";

  if (!VENICE_AUDIO_FORMATS.has(format)) {
    const inputExt = format || "webm";
    try {
      buffer = (await toWav(buffer, inputExt)) as Buffer;
      format = "wav";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Conversion failed";
      return NextResponse.json(
        { error: "Could not convert audio to a format Venice accepts (wav)", details: message },
        { status: 400 }
      );
    }
  }

  let modelId: string;
  try {
    modelId = await getTranscribeModelId(apiKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Transcription model not configured", details: message },
      { status: 503 }
    );
  }

  const form = new FormData();
  form.append("file", new Blob([buffer as BlobPart], { type: "audio/wav" }), "audio.wav");
  form.append("model", modelId);

  try {
    const veniceRes = await fetch(VENICE_TRANSCRIBE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!veniceRes.ok) {
      const text = await veniceRes.text();
      console.error("[transcribe] Venice error:", veniceRes.status, text);

      let details = text;
      try {
        const errJson = JSON.parse(text) as { error?: { message?: string; code?: string } };
        if (errJson.error?.message) details = errJson.error.message;
        if (errJson.error?.code) details = `${errJson.error.code}: ${details}`;
      } catch {
        // keep raw text
      }

      return NextResponse.json(
        {
          error: "Venice transcription request failed",
          details: details || `HTTP ${veniceRes.status}`,
          status: veniceRes.status,
        },
        { status: 502 }
      );
    }

    const data = (await veniceRes.json()) as { text?: string; transcript?: string };
    const transcript = data.text ?? data.transcript ?? "";

    return NextResponse.json({ transcript });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Transcribe failed", details: message },
      { status: 500 }
    );
  }
}
