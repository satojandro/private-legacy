"use client";

import { useState, useRef } from "react";

// Type for the structured memory returned by /api/structure
interface StructuredResult {
  title: string;
  narrative: string;
  questions: string[];
}

export default function Home() {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<StructuredResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setError(null);

      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("file", blob);

      try {
        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          const msg = data.details
            ? `${data.error ?? "Transcribe failed"}: ${data.details}`
            : (data.error ?? data.details ?? "Transcribe failed");
          setError(msg);
          return;
        }
        setTranscript(data.transcript);

        const structureRes = await fetch("/api/structure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript: data.transcript }),
        });
        const structured = await structureRes.json();
        if (!structureRes.ok) {
          const msg = structured.details
            ? `${structured.error ?? "Structure failed"}: ${structured.details}`
            : (structured.error ?? structured.details ?? "Structure failed");
          setError(msg);
          return;
        }
        setResult(structured);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    };

    mediaRecorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <main className="p-10 max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Before You Die</h1>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Record a short memory. You’ll see the transcript and a structured version with follow-up questions.
      </p>

      {!recording ? (
        <button
          type="button"
          onClick={startRecording}
          className="min-h-[48px] min-w-[200px] cursor-pointer rounded-lg border-2 border-black bg-black px-6 py-3 text-lg font-medium text-white transition hover:bg-zinc-800 dark:border-white dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          style={{
            minHeight: "48px",
            minWidth: "200px",
            cursor: "pointer",
            borderRadius: "8px",
            border: "2px solid #171717",
            background: "#171717",
            color: "#fff",
            padding: "12px 24px",
            fontSize: "1.125rem",
            fontWeight: 500,
          }}
        >
          Start Story
        </button>
      ) : (
        <button
          type="button"
          onClick={stopRecording}
          className="min-h-[48px] min-w-[200px] cursor-pointer rounded-lg border-2 border-red-600 bg-red-600 px-6 py-3 text-lg font-medium text-white transition hover:bg-red-700"
          style={{
            minHeight: "48px",
            minWidth: "200px",
            cursor: "pointer",
            borderRadius: "8px",
            border: "2px solid #b91c1c",
            background: "#b91c1c",
            color: "#fff",
            padding: "12px 24px",
            fontSize: "1.125rem",
            fontWeight: 500,
          }}
        >
          Stop Recording
        </button>
      )}

      {error && (
        <p className="text-red-600 text-sm mt-2" role="alert">
          {error}
        </p>
      )}

      {transcript && (
        <div>
          <h2 className="font-semibold mt-4">Transcript</h2>
          <p className="text-gray-700">{transcript}</p>
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <h2 className="font-semibold mt-4">Structured Memory</h2>
          <p>
            <strong>Title:</strong> {result.title}
          </p>
          <p>{result.narrative}</p>
          <div>
            <strong>Follow Up:</strong>
            <ul className="list-disc ml-6">
              {result.questions.map((q: string, i: number) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
