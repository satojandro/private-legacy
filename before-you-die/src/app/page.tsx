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
          setError(data.error ?? data.details ?? "Transcribe failed");
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
          setError(structured.error ?? structured.details ?? "Structure failed");
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

      {!recording ? (
        <button
          onClick={startRecording}
          className="bg-black text-white px-4 py-2 rounded"
        >
          Start Story
        </button>
      ) : (
        <button
          onClick={stopRecording}
          className="bg-red-600 text-white px-4 py-2 rounded"
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
