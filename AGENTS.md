<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Rate Your Picture — project notes

Upload a photo, get an edgy-but-useful AI critique (score /10, verdict, what's
working, a constructive roast).

## Commands

- Dev server: `npm run dev` → http://localhost:3000
- Lint: `npm run lint`
- Type-check + production build: `npm run build`

## API key

- Required: `DEEPSEEK_API_KEY` in `.env.local` (gitignored). Example: `.env.example`.
- Only read server-side in `app/api/rate/route.ts`. Never ship it to the client.

## Testing the rating endpoint headlessly

Start the dev server, then:

```bash
curl -F "file=@/path/to/photo.jpg" http://localhost:3000/api/rate
curl -H "x-lang: de" -F "file=@/path/to/photo.jpg" http://localhost:3000/api/rate
```

Expect JSON `{ ok: true, id, result: { score, verdict, working[], roast[] } }`.
A real test photo is fetched to `/tmp/ryp-test/photo.jpg` (picsum) if needed.
Optional header `x-lang: <code>` (e.g. `de`, `fr`, `es`, …) makes the critic
answer in that language and localizes server error messages (DE/EN).

## Architecture / known structure

- `app/api/rate/route.ts` — POST multipart (`file` + optional `thumb` + optional `meta`, header `x-lang`). Validates type/size, base64-encodes, calls DeepSeek `deepseek-v4-flash-vision-exp`, sanitizes JSON (`name`, `score`, `verdict`, `working[]`, `roast[{burn,fix}]` — max 3 roasts, name 2–3 words), then persists every rating (thumbnail file + SQLite row) and returns `{ ok, id, rank, celebrate, cached, result }`.
  - **Dedupe**: SHA-256 of the normalized upload (`img_hash`). Known image → returns `cached: true` with the stored `result` (no AI call, no new row).
  - **`celebrate`** (fireworks): `count` = entries before this rating. `count == 0` → never; `count 1–4` → only rank 1; `count ≥ 5` → rank 1–5.
  - `meta` (EXIF summary from the client, e.g. camera/lens/aperture/shutter/ISO) is appended to the user message so the critic can comment on camera settings.
- Tie-break: equal score → the **newer** entry ranks higher (`ORDER BY score DESC, created_at DESC`).
- `app/api/leaderboard/route.ts` — GET top 5 by score (desc).
- `app/api/thumbnail/[id]/route.ts` — GET stored thumbnail bytes from `data/thumbnails/`.
- `app/components/RateYourPicture.tsx` — client UI: drag & drop, image pipeline, full-viewport ambient glow (image colors bleed toward the screen edges; mask centered on the measured image position via `--gx/--gy`), spinner, result view, fireworks (`canvas-confetti`), localStorage restore of the last result (`ryp_last_result`) so it survives a trip to `/leaderboard`.
- `app/components/Leaderboard.tsx` + `app/leaderboard/page.tsx` — Top-5 page.
- `app/components/LanguagePicker.tsx`, `lib/useLanguage.ts` — language state/persistence (`ryp_lang`).
- `lib/types.ts` — shared `RateResult` / `RoastItem` / `LeaderboardEntry` types.
- `lib/i18n.ts` — language list, detection, UI strings (full DE/EN), `STORAGE_KEY = "ryp_lang"`.
- `lib/db.ts` — `node:sqlite` (built-in, zero dep), DB at `data/ryp.db`, thumbnails in `data/thumbnails/`. `data/` is gitignored.
- `lib/imageProcessing.ts` — client canvas pipeline: decodes any browser-readable image, downscales to max 2048px JPEG (upload) + 400px JPEG thumbnail. Also reads EXIF via `exifr` into a short settings summary (`readMetadataText`), sent as the `meta` field. Prevents oversized images from blanking the UI.
- Languages: picker in the top bar, default from `navigator.language`. The model prompt stays English but instructs the critic to answer in the chosen language (`{TARGET_LANG}`); UI chrome is fully translated for DE, falls back to EN otherwise.
- Response shape is DB-ready (unique `id` per rating) for a future leaderboard.
- The model also returns a short `name` for the photo (2–3 words), shown in the result and on the leaderboard.
- Every completed rating is stored (SQLite + thumbnail) → `/leaderboard` shows the top 5 of all time.

