Yes.
That’s a very good instinct.

When Cursor only sees code tasks, it optimizes for plumbing.
When it sees intent, it optimizes for experience.

Below is a README / project brief you can drop into the root of the repo as `README.md`.

This keeps the soul intact while still being buildable.

---

# README.md

## 🕯 Before You Die

**A Private Legacy Copilot**

---

## What This Is

Before You Die is a simple, private voice-based application that helps people tell and preserve their life stories.

The user speaks a memory.
The system:

1. Transcribes it privately.
2. Structures it into a readable narrative.
3. Suggests gentle follow-up questions.
4. Preserves the moment without dramatizing or moralizing.

This is not therapy.
This is not autobiography automation.
This is not an AI that rewrites someone’s life.

This is a calm interviewer that helps someone tell one memory at a time.

---

## Why It Matters

Many of the most meaningful stories we hear from our parents or grandparents are told casually:

* Over the phone.
* During dinner.
* In passing.
* Once.

They are rarely recorded.
They are rarely structured.
They disappear.

This project exists to:

* Preserve stories before they vanish.
* Give seniors (or anyone) a private space to speak freely.
* Capture unfiltered memories without centralized logging.
* Structure memories gently so they can be revisited.

Privacy is not a feature here — it is essential.

People will share:

* Regrets
* Migration stories
* Relationships
* Secrets
* Loss
* Personal history

That data must not be harvested or retained by centralized systems.

---

## Core Principles

### 1. Privacy First

All inference runs through Venice private endpoints.
No third-party logging.
No data reuse.
No model training.

### 2. Calm Tone

The assistant must:

* Avoid dramatization.
* Avoid therapy language.
* Avoid moral advice.
* Avoid exaggeration.
* Avoid “inspirational” fluff.

It should feel like:

* A quiet interviewer.
* A respectful listener.
* A gentle organizer of thought.

### 3. One Memory at a Time

This MVP focuses on:

* Recording one story.
* Structuring it.
* Suggesting follow-up questions.

No archive system.
No sharing system.
No full autobiography generation.

Just one story.

---

## MVP Scope

### Frontend

* Record voice (MediaRecorder)
* Send audio to backend
* Display transcript
* Display structured output:

  * Title
  * Narrative paragraph
  * 2 follow-up questions

### Backend

* `/api/transcribe`

  * Send audio to Venice STT
  * Return transcript
* `/api/structure`

  * Send transcript to Venice reasoning
  * Return structured JSON:

    ```json
    {
      "title": "",
      "narrative": "",
      "questions": []
    }
    ```

No streaming.
No persistence required.
No database required for MVP.

---

## Experience Guidelines

The UI should feel:

* Spacious
* Minimal
* Calm
* Respectful
* Not flashy
* Not gamified

Think:

* A quiet writing desk.
* Not a productivity app.
* Not a chatbot playground.

Typography should be readable and warm.
Avoid clutter.

---

## Demo Narrative (Hackathon Context)

This project demonstrates:

* Multimodal private inference (voice + reasoning).
* Sensitive memory capture without centralized retention.
* A humane AI use case grounded in real family dynamics.
* Technology that preserves history at the edge, not in the cloud.

It answers the question:

What kinds of intelligence only exist if inference is private?

Answer:
Life stories.

---

## Non-Goals

Do not implement:

* Full memoir generation.
* Multi-user accounts.
* Sharing/export systems.
* Encryption vaults (MVP).
* Streaming agent frameworks.
* Over-engineered orchestration.
* Feature creep.

Keep it simple.
Keep it working.
Keep it calm.

---

## Definition of Done

A working demo where:

* User speaks for 30–60 seconds.
* Transcript appears.
* Structured narrative appears.
* Follow-up questions appear.
* Tone feels grounded and respectful.
* All inference uses Venice endpoints.

---

## Run locally

Anyone can run Before You Die on their machine by cloning the repo and following these steps.

### Prerequisites

- **Node.js** 18+ (recommend 20+)
- **npm**, **yarn**, **pnpm**, or **bun**
- **ffmpeg** (for audio handling). On macOS: `brew install ffmpeg`. If the app can’t find it, set `FFMPEG_BIN` in `.env` (see below).
- A **Venice API key** from [venice.ai](https://venice.ai) (get one at [venice.ai/settings/api](https://venice.ai/settings/api)).

### Steps

1. **Clone the repo** and go into the project directory:
   ```bash
   git clone <repository-url>
   cd <repo-directory-name>
   ```

2. **Go into the app and install dependencies**
   ```bash
   cd before-you-die
   npm install
   ```

3. **Configure environment**
   - Copy the example env file and add your Venice API key:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env` and set `VENICE_API_KEY` to your key. Optionally set `VENICE_MODEL` and `VENICE_TRANSCRIBE_MODEL` (see `.env.example` for comments).

4. **Start the dev server**
   ```bash
   npm run dev
   ```

5. **Open in a browser**  
   Go to [http://localhost:3000](http://localhost:3000). You can record a short memory, see the transcript, structured narrative, and follow-up questions.

For more detail (optional env vars, ffmpeg path, etc.), see `before-you-die/README.md` and `before-you-die/.env.example`.




