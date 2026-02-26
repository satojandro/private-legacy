# Before You Die — app

Next.js app for the Before You Die voice-based legacy copilot.

## Run locally (from a fresh clone)

### Prerequisites

- **Node.js** 18+ (20+ recommended)
- **ffmpeg** — for audio processing. Install: `brew install ffmpeg` (macOS) or your system package manager. If you get `spawn ffmpeg ENOENT`, set `FFMPEG_BIN` in `.env` to your ffmpeg path (e.g. `/opt/homebrew/bin/ffmpeg`).
- **Venice API key** — get one at [venice.ai/settings/api](https://venice.ai/settings/api). See [Venice API docs](https://docs.venice.ai/api-reference/api-spec).

### Steps

1. **From the repo root**, go into this directory and install dependencies:
   ```bash
   cd before-you-die
   npm install
   ```

2. **Environment variables**  
   Copy the example env and add your Venice API key:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set:
   - `VENICE_API_KEY` — **required**
   - `VENICE_MODEL` — optional; default `venice-uncensored` (model for structuring the memory)
   - `VENICE_TRANSCRIBE_MODEL` — optional; must be an ASR (speech-to-text) model id from Venice; see `.env.example` for details

3. **Start the dev server**
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser. Record a short memory to see transcription, structured narrative, and follow-up questions.

### Scripts

- `npm run dev` — start Next.js dev server
- `npm run build` — production build
- `npm run start` — run production server after `npm run build`
- `npm run lint` — run ESLint

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [Venice API](https://docs.venice.ai/api-reference/api-spec)
