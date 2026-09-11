# Rate Your Picture

Upload a photo and let a brutally honest (but secretly supportive) AI critic
give it a score out of 100, a punchy verdict, what's already working — and a
roast where every burn comes with a concrete fix. Edgy, informal, funny,
actually useful.

Built with Next.js (App Router, TypeScript, Tailwind). Image analysis runs on
DeepSeek's vision model `deepseek-v4-flash-vision-exp`.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure the API key:

```bash
cp .env.example .env.local
```

3. Open `.env.local` and paste your real DeepSeek API key
   (get one at https://platform.deepseek.com/api_keys). `.env.local` is
   gitignored — never commit it.

## Run

```bash
npm run dev
```

Then open http://localhost:3000

Drag a photo onto the page (or click to browse), hit **Roast it**, and read the
verdict. Supported formats: JPEG, PNG, GIF, WebP (max 8 MB). Photos are sent
directly to the API and never stored.

## Languages

Pick a language via the flag menu in the top-right corner. The default comes
from your browser language; your choice is remembered in `localStorage`. The
critic answers in the selected language (the prompt stays English and simply
instructs the model which language to write in). UI text is fully translated
for German, falls back to English otherwise. See `lib/i18n.ts` for the
supported list.

## Test the API headlessly

With the dev server running:

```bash
curl -F "file=@/path/to/photo.jpg" http://localhost:3000/api/rate
curl -H "x-lang: de" -F "file=@/path/to/photo.jpg" http://localhost:3000/api/rate
```

Optional header `x-lang: <code>` sets the language the critic answers in
(e.g. `de`, `fr`, `es`, `it`, …; supported list in `lib/i18n.ts`).

Response shape:

```jsonc
{
  "ok": true,
  "id": "<uuid>",
  "cached": false,     // true when this exact photo was already rated (answer from DB)
  "rank": 3,           // position on the board
  "celebrate": false,  // true when fireworks should fire (see rules below)
  "result": {
    "name": "Morning Mist",      // short title, 2–3 words
    "score": 7.5,                // 0–10
    "verdict": "…",
    "working": ["…"],
    "roast": [{ "burn": "…", "fix": "…" }]   // max 3
  }
}
```

Duplicate uploads (same pixels → SHA-256 of the normalized JPEG) are detected
and answered from the DB with `cached: true` — no second AI call, no duplicate
board entry.

**Fireworks rules** (`celebrate`): let `count` = board entries before your
rating. `count == 0` → never. `count 1–4` (board still filling) → only rank 1.
`count ≥ 5` (board full) → any rank 1–5.

**Tie-break**: on an equal score the **newer** photo ranks higher.

**Camera metadata**: EXIF (camera, lens, focal length, aperture, shutter, ISO,
…) is read in the browser (`exifr`) and sent along, so the critic can comment
on your actual camera settings. No location data is read.

## Leaderboard

Every completed rating is stored locally (SQLite via Node's built-in
`node:sqlite`, DB + thumbnails under `data/`, gitignored). The **Top 5** page at
`/leaderboard` shows the all-time best photos (thumbnail, model-given name,
score). APIs:

- `GET /api/leaderboard` — top 5 entries
- `GET /api/thumbnail/<id>` — stored thumbnail image

To clear the board, stop the server and delete the `data/` folder.

## Other commands

- `npm run lint` — ESLint
- `npm run build` — type-check + production build

## Features

- Drag & drop any image your browser can open (HEIC included) — it is resized
  on-device to a max 2048px JPEG before upload, so huge photos work and never
  blank the page.
- Ambient glow: the photo's colors bleed toward the edge of the whole screen,
  strongest right around the photo, fading outwards.
- Spinner while the critic works.
- Language picker with flags (top-right); the critic answers in that language.
- Roasts: max 3, start straight with the burn, every one has a concrete fix.
- Little fireworks when a submission earns a board-worthy spot.
- Your last result survives a trip to the leaderboard and back.
