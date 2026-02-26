"use client";

import { useState, useRef, useEffect } from "react";

const STORAGE_KEY = "stories";
const MAX_STORIES = 20;

/** Total AI turns (1 structure + 2 continue) before showing save/download. */
const TOTAL_AI_TURNS = 3;

interface StructuredResult {
  title: string;
  narrative: string;
  questions: string[];
}

interface SavedStory {
  id: string;
  title: string;
  narrative: string;
  createdAt: string;
}

export default function Home() {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [recordingMode, setRecordingMode] = useState<"initial" | "respond">("initial");
  const [error, setError] = useState<string | null>(null);

  // Session state: turn 0 = not started, 1 = after structure, 2 = after first continue, 3 = after second continue
  const [turn, setTurn] = useState(0);
  const [title, setTitle] = useState("");
  const [narrative, setNarrative] = useState("");
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [transcript, setTranscript] = useState("");
  const [sessionComplete, setSessionComplete] = useState(false);
  const [saved, setSaved] = useState(false);

  const [stories, setStories] = useState<SavedStory[]>([]);
  const [expandedStoryId, setExpandedStoryId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Refs so the continue API always gets the latest narrative (avoids stale closure
  // where the first structured narrative wasn’t sent and the first chunk was lost).
  const narrativeRef = useRef("");
  const titleRef = useRef("");
  const followUpQuestionRef = useRef("");

  // Ref for turn count so we count structure + continue consistently (avoids stale
  // state in async onstop where turn could still be 0 and we'd need 4 turns to complete).
  const turnRef = useRef(0);

  // Mode at click time so onstop doesn't rely on React state (avoids stale closure).
  const recordingModeRef = useRef<"initial" | "respond">("initial");

  useEffect(() => {
    narrativeRef.current = narrative;
    titleRef.current = title;
    followUpQuestionRef.current = followUpQuestion;
  }, [narrative, title, followUpQuestion]);

  useEffect(() => {
    turnRef.current = turn;
  }, [turn]);

  // Load previous memories from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedStory[];
        setStories(Array.isArray(parsed) ? parsed.slice(-MAX_STORIES) : []);
      }
    } catch {
      setStories([]);
    }
  }, []);

  const doStartRecording = async (mode: "initial" | "respond") => {
    recordingModeRef.current = mode;
    setRecordingMode(mode);
    setError(null);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      console.log("mode:", recordingModeRef.current);
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
          setRecording(false);
          setProcessing(false);
          return;
        }
        const newTranscript = data.transcript;

        if (recordingModeRef.current === "initial") {
          const structureRes = await fetch("/api/structure", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transcript: newTranscript }),
          });
          const structured = (await structureRes.json()) as StructuredResult & { error?: string; details?: string };
          if (!structureRes.ok) {
            const msg = structured.details
              ? `${structured.error ?? "Structure failed"}: ${structured.details}`
              : (structured.error ?? structured.details ?? "Structure failed");
            setError(msg);
            setRecording(false);
            setProcessing(false);
            return;
          }
          const firstTitle = structured.title ?? "";
          const firstNarrative = structured.narrative ?? "";
          const firstQuestion = structured.questions?.[0] ?? "";
          setTitle(firstTitle);
          setNarrative(firstNarrative);
          setFollowUpQuestion(firstQuestion);
          setTranscript(newTranscript);
          narrativeRef.current = firstNarrative;
          titleRef.current = firstTitle;
          followUpQuestionRef.current = firstQuestion;
          turnRef.current = 1;
          setTurn(1);
        } else {
          // Use refs so we always send the latest narrative (including first turn from structure).
          const currentNarrative = narrativeRef.current;
          const currentQuestion = followUpQuestionRef.current;
          const continueRes = await fetch("/api/continue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              narrative: currentNarrative,
              lastQuestion: currentQuestion,
              transcript: newTranscript,
            }),
          });
          const continued = (await continueRes.json()) as { narrative?: string; question?: string; error?: string; details?: string };
          if (!continueRes.ok) {
            const msg = continued.details
              ? `${continued.error ?? "Continue failed"}: ${continued.details}`
              : (continued.error ?? continued.details ?? "Continue failed");
            setError(msg);
            setRecording(false);
            setProcessing(false);
            return;
          }
          const nextNarrative = continued.narrative ?? "";
          const nextQuestion = continued.question ?? "";
          setNarrative(nextNarrative);
          setFollowUpQuestion(nextQuestion);
          setTranscript(newTranscript);
          // Sync refs immediately so the next continue call sends this full narrative
          // even if the user continues before useEffect runs (avoids losing prior turns).
          narrativeRef.current = nextNarrative;
          followUpQuestionRef.current = nextQuestion;
          // Use ref so we count structure + continue (3 total: 1 structure + 2 continue).
          const prevTurn = turnRef.current;
          const nextTurn = prevTurn + 1;
          turnRef.current = nextTurn;
          if (nextTurn >= TOTAL_AI_TURNS) setSessionComplete(true);
          setTurn(nextTurn);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
      setRecording(false);
      setProcessing(false);
    };

    mediaRecorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setRecording(false);
      setProcessing(true);
    }
  };

  const handleSave = () => {
    const entry: SavedStory = {
      id: crypto.randomUUID(),
      title: title || "Untitled memory",
      narrative,
      createdAt: new Date().toISOString(),
    };
    const next = [...stories, entry].slice(-MAX_STORIES);
    setStories(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSaved(true);
  };

  const resetSession = () => {
    turnRef.current = 0;
    setTurn(0);
    setTitle("");
    setNarrative("");
    setFollowUpQuestion("");
    setTranscript("");
    setSessionComplete(false);
    setSaved(false);
    setError(null);
    setProcessing(false);
  };

  const downloadMemory = (format: "txt" | "md") => {
    const safeTitle =
      (title || "memory")
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 50) || "memory";
    const ext = format === "txt" ? "txt" : "md";
    const displayTitle = title || "Untitled memory";
    const gentleBlock =
      followUpQuestion?.trim() ?
        `\n\n---\n\nA gentle question:\n${followUpQuestion.trim()}\n\n---\n\n`
      : "\n\n---\n\n";
    let content: string;
    if (format === "txt") {
      content =
        `Title: ${displayTitle}\n\n${narrative}${gentleBlock}Processed privately.`;
    } else {
      content =
        `# ${displayTitle}\n\n${narrative}${gentleBlock}_Processed privately._`;
    }
    const blob = new Blob([content], {
      type: format === "txt" ? "text/plain" : "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const showRespond =
    (turn === 1 || turn === 2) &&
    !!narrative &&
    !!followUpQuestion &&
    !recording &&
    !processing;
  const showSessionComplete = sessionComplete && turn >= TOTAL_AI_TURNS;

  return (
    <main className="p-10 max-w-xl mx-auto space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-bold">Before You Die</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          A private space to remember.
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Say something that happened — big or small. I'll listen and gently ask you one question.
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
          <span aria-hidden>🔒</span> Processed privately. Nothing is stored unless you choose to save.
        </p>
        {turn === 0 && !narrative && (
          <div className="text-xs text-zinc-400 dark:text-zinc-500 space-y-1 pt-1">
            <p>Not sure what to say? Try:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>A small moment from today</li>
              <li>The first time you felt independent</li>
              <li>A place that feels like home</li>
            </ul>
          </div>
        )}
      </header>


      {processing && (
        <p className="text-zinc-600 dark:text-zinc-400" role="status">
          Processing your memory… (this may take a minute)
        </p>
      )}

      {/* Recording: Begin (turn 0), Continue (turn 1–2), Stop Recording when active */}
      {!recording && !processing && turn === 0 && (
        <button
          type="button"
          onClick={() => doStartRecording("initial")}
          className="min-h-[48px] min-w-[200px] cursor-pointer rounded-lg border-2 border-black bg-black px-6 py-3 text-lg font-medium text-white transition hover:bg-zinc-800 dark:border-white dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Begin
        </button>
      )}

      {!recording && !processing && showRespond && (
        <button
          type="button"
          onClick={() => doStartRecording("respond")}
          className="min-h-[48px] min-w-[200px] cursor-pointer rounded-lg border-2 border-zinc-700 bg-zinc-700 px-6 py-3 text-lg font-medium text-white transition hover:bg-zinc-600 dark:border-zinc-500 dark:bg-zinc-500 dark:hover:bg-zinc-400"
        >
          Continue
        </button>
      )}

      {recording && (
        <button
          type="button"
          onClick={stopRecording}
          className="min-h-[48px] min-w-[200px] cursor-pointer rounded-lg border-2 border-red-600 bg-red-600 px-6 py-3 text-lg font-medium text-white transition hover:bg-red-700"
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
        <div className="mt-6">
          <h2 className="font-semibold">What you said</h2>
          <p className="mt-1 text-zinc-500 dark:text-zinc-400">{transcript}</p>
        </div>
      )}

      {narrative && (
        <div className="space-y-2 mt-8" style={{ animation: "fadeIn 0.2s ease-out both" }}>
          <h2 className="font-semibold">Your story so far</h2>
          {title && (
            <p>
              <strong>Title:</strong> {title}
            </p>
          )}
          <p className="text-stone-700 dark:text-stone-300 whitespace-pre-wrap">{narrative}</p>

          {!showSessionComplete && followUpQuestion && (
            <div className="pt-2">
              <strong>A gentle question:</strong>{" "}
              <span className="text-stone-700 dark:text-stone-300">{followUpQuestion}</span>
            </div>
          )}

          {showSessionComplete && (
            <div className="pt-4 space-y-3">
              <p className="text-zinc-600 dark:text-zinc-400 italic">
                This memory feels complete for now. Would you like to save it or download it?
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {!saved ? (
                  <button
                    type="button"
                    onClick={handleSave}
                    className="rounded-lg border-2 border-zinc-400 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-200 dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
                  >
                    Save this memory
                  </button>
                ) : (
                  <p className="text-sm text-green-700 dark:text-green-400">Saved.</p>
                )}
                <button
                  type="button"
                  onClick={() => downloadMemory("txt")}
                  className="rounded-lg border border-zinc-400 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  aria-label="Download as plain text"
                >
                  Download as .txt
                </button>
                <button
                  type="button"
                  onClick={() => downloadMemory("md")}
                  className="rounded-lg border border-zinc-400 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  aria-label="Download as Markdown"
                >
                  Download as .md
                </button>
              </div>
              <button
                type="button"
                onClick={resetSession}
                className="text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Start new memory
              </button>
            </div>
          )}
        </div>
      )}

      {narrative && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
          <span aria-hidden>🔒</span> Processed privately. Nothing is stored unless you choose to save.
        </p>
      )}

      {/* Previous memories */}
      {stories.length > 0 && (
        <section className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-700">
          <h2 className="font-semibold mb-2">Previous memories</h2>
          <ul className="space-y-2">
            {stories.slice().reverse().map((s) => (
              <li key={s.id} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
                <button
                  type="button"
                  onClick={() => setExpandedStoryId(expandedStoryId === s.id ? null : s.id)}
                  className="text-left w-full font-medium text-zinc-800 dark:text-zinc-200"
                >
                  {s.title}
                </button>
                {expandedStoryId === s.id && (
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                    {s.narrative}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
