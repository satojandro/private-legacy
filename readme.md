
# 🕯 Before You Die

**A quiet place to remember — and turn moments into stories.**

---

## What This Is

Before You Die is a private, voice-based memoir companion.

You speak a memory.

The system:

1. Transcribes it privately.
2. Clarifies it into a grounded narrative.
3. Gently asks one thoughtful follow-up.
4. Helps you see what the moment meant — without rewriting your life.

This is not therapy.
This is not autobiography automation.
This is not AI “content generation.”

It is a calm, structured listener — one memory at a time.

---

## Why It Exists

For years, long-form memory lived in email.

When people moved countries.
When someone felt alone.
When something changed.

Those messages were reflective. Intentional. Preserved.

Then communication became instant.
Shorter. Fragmented. Ephemeral.

We lost something.

Before You Die explores whether AI can help restore that depth — privately — without turning memory into a product.

Because most meaningful stories are told:

* Once.
* Casually.
* Over dinner.
* On a phone call.
* In passing.

And then they vanish.

This project asks:

What if we could gently preserve those moments before they disappear?

---

## Core Principles

### 1. Privacy Is Structural

All inference runs through Venice private endpoints.

* No centralized logging.
* No third-party analytics.
* No model training on user data.
* No database required for MVP.

Stories are stored locally in the browser unless the user chooses to export them.

This matters because people will speak about:

* Migration.
* Regret.
* Identity.
* Loss.
* Secrets.
* Becoming.

That data must not be harvested.

---

### 2. Calm Over Drama

The assistant:

* Does not exaggerate.
* Does not moralize.
* Does not therapize.
* Does not fabricate emotional intensity.
* Does not “optimize for inspiration.”

It clarifies.

It identifies structure.

It highlights turning points.

It helps the speaker see what was already there.

---

### 3. One Memory at a Time

No full autobiography generation.
No life timeline builder.
No archive system.
No gamification.

Just:

Speak → Reflect → Deepen → Preserve.

Three turns.
Then stop.

---

## What It Does (MVP)

### Frontend

* Voice recording via MediaRecorder
* Private transcription
* Structured narrative display
* Gentle follow-up question
* Local storage (browser only)
* Download as `.txt` or `.md`

### Backend

* `/api/transcribe`
  → Sends audio to Venice STT
  → Returns transcript

* `/api/structure`
  → Sends transcript to Venice reasoning
  → Returns structured JSON:

```json
{
  "title": "",
  "narrative": "",
  "questions": []
}
```

* `/api/continue`
  → Integrates new response into full narrative
  → Preserves identity across turns
  → Returns complete updated story + one question

No streaming.
No database.
No orchestration framework.

Just controlled inference and deliberate structure.

---

## Experience Design

The interface is intentionally minimal.

It should feel like:

* A quiet writing desk.
* A private conversation.
* A space, not a tool.

No chat bubbles.
No flashing UI.
No gamified streaks.
No AI “assistant persona.”

Typography is warm.
Spacing is generous.
Language is restrained.

The goal is psychological safety.

---

## What This Demonstrates

This project demonstrates:

* Multimodal private inference (voice + reasoning).
* Narrative continuity across turns.
* Sensitive memory capture without centralized storage.
* A humane AI use case grounded in real human dynamics.
* Edge-preserved history instead of cloud-harvested content.

It explores a deeper question:

What kinds of intelligence only make sense when inference is private?

Answer:

Memory.

---

## Non-Goals

This is not:

* A full memoir platform.
* A therapy product.
* A journaling SaaS.
* A social network.
* A “memory AI startup.”

It is a proof of concept:

Can intelligence help preserve human meaning without extracting it?

---

## Definition of Done

A working demo where:

* A user speaks for 30–60 seconds.
* Transcript appears.
* A grounded narrative appears.
* One thoughtful follow-up appears.
* The narrative evolves coherently across turns.
* The tone feels restrained and respectful.
* All inference runs through private Venice endpoints.
* The story is stored only locally unless exported.

If that works, the concept works.

---

## Run Locally

### Prerequisites

* Node.js 18+ (20+ recommended)
* npm / yarn / pnpm / bun
* ffmpeg
  macOS:

  ```bash
  brew install ffmpeg
  ```
* Venice API key
  [https://venice.ai/settings/api](https://venice.ai/settings/api)

---

### Setup

```bash
git clone <repository-url>
cd <repo-directory-name>
cd before-you-die
npm install
```

Copy environment file:

```bash
cp .env.example .env
```

Set:

```
VENICE_API_KEY=your_key_here
```

Optional:

* `VENICE_MODEL`
* `VENICE_TRANSCRIBE_MODEL`
* `FFMPEG_BIN` (if needed)

Run:

```bash
npm run dev
```

Open:

```
http://localhost:3000
```

Record a memory.
Watch it take shape.
Save or download it.
Refresh — your saved stories remain in your browser.

---

## Final Note

Before You Die is intentionally simple.

It does not try to be everything.

It tries to do one thing well:

Give someone a private space to speak — and help that moment become something they can keep.

