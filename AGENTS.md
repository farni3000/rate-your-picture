<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Rate Your Picture

A local-first web app: upload a photo, and an AI critic roasts it in a funny,
edgy but genuinely useful way. It returns a short photo name, a score out of
10, a verdict, what works, and up to 3 roasts — each burn with a concrete fix.
Every rating lands in a local SQLite DB; the `/leaderboard` page shows the
all-time Top 5.

The critic's answer language follows the language picked in the UI (flag menu,
top right). The model prompt itself stays English and only instructs the model
to write prose in the chosen language.

## Tech stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4
- DeepSeek vision model `deepseek-v4-flash-vision-exp` (OpenAI-compatible API)
- Zero-dep SQLite via Node built-in `node:sqlite` (`DatabaseSync`)
- Client libs: `exifr` (EXIF), `canvas-confetti` (fireworks)

## Commands

```bash
npm run dev     # dev server → http://localhost:3000
npm run lint    # ESLint
npm run build   # type-check + production build
npm run start   # run production build
```

Code edits hot-reload. A restart is only needed after changing `.env.local`.

## Setup & environment

- `DEEPSEEK_API_KEY` in `.env.local` (gitignored; example in `.env.example`).
  Read **server-side only** in `app/api/rate/route.ts` — never expose it to the
  client. Get a key at https://platform.deepseek.com/api_keys.
- Nothing else is required; everything runs locally.

## Runtime data (`data/`, gitignored)

- `data/ryp.db` — SQLite database.
- `data/thumbnails/<id>.<ext>` — stored thumbnail per rating.

Clear the leaderboard: stop the dev server, delete `data/`, start again.

## Database schema

```sql
CREATE TABLE leaderboard (
  id TEXT PRIMARY KEY,          -- crypto.randomUUID()
  name TEXT NOT NULL DEFAULT '',     -- short photo name (2–3 words)
  score REAL NOT NULL,
  verdict TEXT NOT NULL DEFAULT '',
  img_ext TEXT NOT NULL DEFAULT 'jpg',
  img_hash TEXT NOT NULL DEFAULT '', -- SHA-256 of the normalized upload
  result_json TEXT NOT NULL DEFAULT '', -- full sanitized result incl. working[]/roast[]
  created_at TEXT NOT NULL
);
```

> Gotcha: `node:sqlite` returns snake_case columns. `lib/db.ts` maps rows to
> camelCase `StoredEntry` via `toEntry()` — don't read raw rows and expect
> `imgExt`/`createdAt`. Ranking/tie-break uses `ORDER BY score DESC,
> created_at DESC, id ASC` (equal score → newer entry wins).

## Request / data flow

1. **Client** (`app/components/RateYourPicture.tsx` + `lib/imageProcessing.ts`):
   decode any image the browser can open → re-encode as JPEG (max 2048px long
   edge) for analysis, plus a 400px JPEG thumbnail. EXIF is read from the
   *original* file (camera/lens/aperture/shutter/ISO/…) into a short summary.
2. **Upload** a `multipart/form-data` POST to `/api/rate` with `file`, optional
   `thumb`, optional `meta`, header `x-lang: <code>`.
3. **Server** (`app/api/rate/route.ts`):
   - validates type (JPEG/PNG/GIF/WebP) & size (≤ 8 MB),
   - SHA-256 of the received file → duplicate check,
   - calls DeepSeek with the base64 image + optional EXIF block,
   - sanitizes the JSON result,
   - saves thumbnail + SQLite row (unless duplicate),
   - computes `rank` + `celebrate` and responds.
4. **Client** shows the result, persists it to `localStorage` for restore, and
   fires confetti if `celebrate`.

## API reference

### `POST /api/rate`

multipart form fields:

| field  | type | notes |
| ------ | ---- | ----- |
| `file` | File | required, JPEG/PNG/GIF/WebP ≤ 8 MB |
| `thumb` | File | optional, JPEG thumbnail used for the leaderboard |
| `meta` | text | optional EXIF summary, appended to the model prompt |

Header `x-lang: <code>` selects the critic language (also DE/EN localizes
server error strings).

Response:

```jsonc
{
  "ok": true,
  "id": "<uuid>",
  "cached": false,     // true if this exact photo was already rated (answer came from DB)
  "rank": 3,           // position on the board after insert (-1 if persistence failed)
  "celebrate": false,  // fireworks?
  "result": {
    "name": "Morning Mist",            // 2–3 words (max 4), target language
    "score": 7.5,                      // 0–10, one decimal
    "verdict": "…",
    "working": ["…"],                  // 2–4 items
    "roast": [{ "burn": "…", "fix": "…" }]  // 2–3 items, NO "issue" field
  }
}
```

**Dedupe:** same image → `cached: true`, the full stored `result` is returned
from `result_json`, no AI call, no new board row.

**Fireworks rules (`celebrate`):** `count` = board entries *before* this rating.
`count == 0` → never. `count 1–4` (board filling) → only rank 1. `count ≥ 5`
(board full) → any rank 1–5.

### `GET /api/leaderboard`

`{ ok, entries: [{ id, name, score, verdict, createdAt, thumbnailUrl }] }` —
top 5 by score, newer wins ties.

### `GET /api/thumbnail/:id`

Streams the stored thumbnail (`image/jpeg|png|gif|webp`), long cache headers.
UUIDs only (regex guard); unknown → 404.

## Frontend structure

- `app/page.tsx` → renders `RateYourPicture`.
- `app/leaderboard/page.tsx` → renders `Leaderboard`.
- `app/components/RateYourPicture.tsx` — the main SPA-ish screen. Stages:
  `processing` (canvas downsizing) → `upload` (Roast it / Discard) → `loading`
  (rotating ring + rotating one-liner) → `done` / `error`. In `done`, the photo
  stays centered and the "Roast another photo" button sits to its right.
- `app/components/Leaderboard.tsx` — Top-5 cards (rank medal colors, thumbnail,
  name, verdict, score), empty/loading/error states.
- `app/components/LanguagePicker.tsx` — flag dropdown (27 languages).
- `app/components/RateYourPicture.tsx` also owns:
  - **Ambient glow**: two fixed, full-viewport blurred copies of the photo
    behind the content (base tint to the edges + core glow masked with a radial
    gradient). The mask center tracks the measured photo position via CSS vars
    `--gx/--gy` set imperatively (resize/scroll listeners, rAF-throttled).
    Layering requires `isolate` on the page root + `relative` content blocks
    + glow at `z-0` (never `-z-10`, that hides it behind the opaque bg).
  - **Result restore**: last result + small data-URL preview stored under
    `localStorage["ryp_last_result"]`; restored on mount so it survives the
    trip to `/leaderboard` and back. Cleared by "Roast another"/Discard.
  - **Cached badge**: shown when the answer came from the duplicate cache.

## Client-side libraries (in `lib/`)

- `types.ts` — shared `RateResult`, `RoastItem {burn, fix}`, `RateResponse`,
  `LeaderboardEntry`.
- `i18n.ts` — `LANGS` list (flags + native names), browser-language detection,
  full UI strings for EN + DE (`uiStrings`); other languages fall back to EN.
  Adding/removing a UI string requires editing BOTH `UI_EN` and `UI_DE`
  (typed, so TypeScript enforces parity).
- `useLanguage.ts` — language state hook: default from browser/stored
  `localStorage["ryp_lang"]`, persists + sets `document.documentElement.lang`.
  Reads the persisted value in an effect after mount (avoid hydration mismatch);
  the one intentional sync `setState` carries an eslint-disable comment.
- `db.ts` — schema, `insertRating`, `findByHash`, `countRatings`, `rankFor`,
  `topRatings`, `getRating`, `saveThumbnail`. `THUMBNAILS_DIR`/`DATA_DIR` are
  exported for routes.
- `imageProcessing.ts` — canvas downscale/encode + `readMetadataText` (dynamic
  `import("exifr")`; returns null when there is no/readable EXIF).

## Model / prompt notes

System prompt (`SYSTEM_PROMPT` in the rate route) enforces a strict JSON shape
via `response_format: { type: "json_object" }`. The `{TARGET_LANG}` placeholder
is replaced with the selected language's native name. The sanitizer clamps
score to 0–10, trims arrays (`working` ≤ 4, `roast` ≤ 3) and name to 80 chars —
never trust the raw model output. Strip possible ```json fences before parsing.

## Testing headlessly

Start the dev server, then:

```bash
curl -F "file=@photo.jpg;type=image/jpeg" \
     -F "thumb=@thumb.jpg;type=image/jpeg" \
     -F "meta=Camera: X · f/2.8 · ISO 400" \
     -H "x-lang: de" \
     http://localhost:3000/api/rate
```

- Same `file` twice → second response has `cached: true`.
- Distinct image files (different bytes) count as new ratings → check `rank`
  and `celebrate` against the fireworks rules.
- A sample photo can be downloaded with:
  `curl -ksSL -o /tmp/ryp-test/photo.jpg https://picsum.photos/seed/ryp/900/1200`

## Conventions & gotchas

- No new dependencies unless necessary: SQLite uses the Node built-in
  `node:sqlite`; there is intentionally no `better-sqlite3`.
- `.env.local` and `data/` are gitignored — never commit DB files or keys.
- ESLint (react-hooks v6) rejects synchronous `setState` inside effects; the few
  legitimate post-mount reads carry `eslint-disable-next-line
  react-hooks/set-state-in-effect` with a short justification.
- Do not render `<img>` directly (`@next/next/no-img-element`); use
  `next/image` with `unoptimized` for local/blob/data-URL sources.
- Thumbnail/content-type map lives in the thumbnail route
  (`MIME_BY_EXT`); `img_ext` is stored per row.
- Next.js here is v16 — consult `node_modules/next/dist/docs/` before relying
  on older Next.js API habits (see the agent-rules block at the top).
