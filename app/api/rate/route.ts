import type { RateResult, RoastItem } from "@/lib/types";
import { codeToName, isSupported } from "@/lib/i18n";
import { createHash } from "node:crypto";
import {
  countRatings,
  findByHash,
  insertRating,
  rankFor,
  saveThumbnail,
} from "@/lib/db";

export const runtime = "nodejs";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-v4-flash-vision-exp";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

const MAX_FILE_BYTES = 8 * 1024 * 1024;

const SYSTEM_PROMPT = `You are "The Rater", a brutally honest but secretly supportive photo critic.
Voice: edgy, informal, funny. Use sarcasm and jokes, but every piece of feedback must be grounded in what is actually in the photo, specific, and genuinely useful. Never vague bashing, never fake positivity.

Critique like a real photography critic: composition and framing (rule of thirds, balance), subject and focus, sharpness, exposure and lighting, color, background and clutter, mood and story, and any technical artifacts.

Respond ONLY in JSON, exactly this shape, no markdown, no code fences:
{
  "name": "a short, catchy title for the photo, 2 to 3 words, never more than 4",
  "score": 7.5,
  "verdict": "one punchy sentence summing up the rating, in your edgy voice",
  "working": ["one thing that genuinely works and why, phrased so the person keeps it up and builds on it"],
  "roast": [
    { "burn": "a funny, edgy one-liner about a specific flaw", "fix": "one concrete, actionable way to improve it" }
  ]
}

Rules:
- name: short and catchy, 2 to 3 words (maximum 4), in the target language.
- score is a number from 1 to 10 with at most one decimal.
- working must contain 2 to 4 items.
- roast must contain 2 to 3 items, ordered roughly by how much fixing them would help.
- The "burn" can be funny and pointed, but the "fix" must be specific and actionable — the roast has to actually help.
- The JSON keys stay English, but ALL prose values (name, verdict, working, burn, fix) must be written in {TARGET_LANG}.
- Output only the JSON object.`;

const ERRORS = {
  missingKey: {
    en: "Missing DEEPSEEK_API_KEY. Put it in .env.local (see .env.example).",
    de: "DEEPSEEK_API_KEY fehlt. Trag ihn in .env.local ein (siehe .env.example).",
  },
  readFailed: {
    en: "Could not read the upload. Send the image as multipart/form-data with a field named \"file\".",
    de: "Upload konnte nicht gelesen werden. Sende das Bild als multipart/form-data mit dem Feld \"file\".",
  },
  noFile: {
    en: "No image received. Send the image as multipart/form-data with a field named \"file\".",
    de: "Kein Bild erhalten. Sende das Bild als multipart/form-data mit dem Feld \"file\".",
  },
  badType: {
    en: "Unsupported file type. Allowed: JPEG, PNG, GIF, WebP.",
    de: "Nicht unterstützter Dateityp. Erlaubt: JPEG, PNG, GIF, WebP.",
  },
  tooLarge: {
    en: "That image is too heavy to carry. Keep it under 8 MB.",
    de: "Das Bild ist zu schwer. Halte es unter 8 MB.",
  },
  apiError: {
    en: "The critic's brain overheated (API error). Give it another shot in a few seconds.",
    de: "Das Gehirn des Kritikers ist überhitzt (API-Fehler). Versuch es gleich nochmal.",
  },
  netError: {
    en: "Could not reach the critic. Check your internet and try again.",
    de: "Der Kritiker war nicht erreichbar. Prüf deine Internetverbindung und versuch es nochmal.",
  },
  parseError: {
    en: "The critic mumbled something unintelligible. Please try again.",
    de: "Der Kritiker hat etwas Unverständliches gemurmelt. Bitte nochmal versuchen.",
  },
} as const;

type ErrorKey = keyof typeof ERRORS;

function pick(lang: string, key: ErrorKey): string {
  const msg = ERRORS[key];
  return lang === "de" ? msg.de : msg.en;
}

function makeError(status: number, lang: string, key: ErrorKey): Response {
  return Response.json({ ok: false, error: pick(lang, key) }, { status });
}

function sanitizeResult(raw: unknown): RateResult {
  const r = (raw ?? {}) as Record<string, unknown>;

  const parsedScore =
    typeof r.score === "number"
      ? r.score
      : typeof r.score === "string"
        ? Number.parseFloat(r.score)
        : NaN;
  const score = Number.isFinite(parsedScore)
    ? Math.min(10, Math.max(0, Math.round(parsedScore * 10) / 10))
    : 0;

  const asStringArray = (v: unknown, max: number): string[] =>
    Array.isArray(v)
      ? v
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .slice(0, max)
      : [];

  const rawRoast = Array.isArray(r.roast) ? r.roast : [];
  const roast: RoastItem[] = rawRoast
    .map((item) => {
      const i = (item ?? {}) as Record<string, unknown>;
      return {
        burn: typeof i.burn === "string" ? i.burn : "",
        fix: typeof i.fix === "string" ? i.fix : "",
      };
    })
    .filter((i) => i.burn || i.fix)
    .slice(0, 3);

  const name = typeof r.name === "string" ? r.name.trim().slice(0, 80) : "";

  return {
    name,
    score,
    verdict: typeof r.verdict === "string" ? r.verdict : "",
    working: asStringArray(r.working, 4),
    roast,
  };
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const headerLang = request.headers.get("x-lang") ?? "en";
  const lang = isSupported(headerLang) ? headerLang : "en";

  if (!apiKey) {
    return makeError(500, lang, "missingKey");
  }

  let file: File | null = null;
  let thumb: File | null = null;
  let metaText = "";
  try {
    const form = await request.formData();
    const candidate = form.get("file");
    if (candidate instanceof File) {
      file = candidate;
    }
    const thumbCandidate = form.get("thumb");
    if (thumbCandidate instanceof File) {
      thumb = thumbCandidate;
    }
    const metaCandidate = form.get("meta");
    if (typeof metaCandidate === "string") {
      metaText = metaCandidate.trim().slice(0, 2000);
    }
  } catch {
    return makeError(400, lang, "readFailed");
  }

  if (!file) {
    return makeError(400, lang, "noFile");
  }

  if (!ALLOWED_TYPES[file.type]) {
    return makeError(400, lang, "badType");
  }

  if (file.size > MAX_FILE_BYTES) {
    return makeError(400, lang, "tooLarge");
  }

  const fileBytes = Buffer.from(await file.arrayBuffer());
  const imgHash = createHash("sha256").update(fileBytes).digest("hex");
  const base64 = fileBytes.toString("base64");
  const dataUrl = `data:${file.type};base64,${base64}`;

  const existing = findByHash(imgHash);
  if (existing) {
    let result: RateResult;
    try {
      result = JSON.parse(existing.resultJson) as RateResult;
    } catch {
      result = {
        name: existing.name,
        score: existing.score,
        verdict: existing.verdict,
        working: [],
        roast: [],
      };
    }
    return Response.json({
      ok: true,
      cached: true,
      id: existing.id,
      result,
    });
  }

  const targetLangName = codeToName(lang);
  const systemPrompt = SYSTEM_PROMPT.replace("{TARGET_LANG}", targetLangName);

  const userContent: Array<Record<string, unknown>> = [
    { type: "text", text: "Here is the photo. Do your thing." },
    { type: "image_url", image_url: { url: dataUrl } },
  ];
  if (metaText) {
    userContent.push({
      type: "text",
      text: `Camera settings / EXIF metadata embedded in the file: ${metaText}. Use it to give concrete tips on the settings if relevant — only mention what actually helps.`,
    });
  }

  let payload: unknown;
  try {
    const res = await fetch(DEEPSEEK_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: userContent,
          },
        ],
        response_format: { type: "json_object" },
        stream: false,
      }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("DeepSeek error:", res.status, body.slice(0, 500));
      return makeError(502, lang, "apiError");
    }

    payload = await res.json();
  } catch (err) {
    console.error("DeepSeek request failed:", err);
    return makeError(502, lang, "netError");
  }

  const data = payload as {
    choices?: { message?: { content?: string } }[];
  };
  const rawContent = data.choices?.[0]?.message?.content ?? "";

  const stripped = rawContent
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  let result: RateResult;
  try {
    result = sanitizeResult(JSON.parse(stripped));
  } catch {
    console.error("Failed to parse DeepSeek JSON:", rawContent.slice(0, 500));
    return makeError(502, lang, "parseError");
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const entry = {
    id,
    name: result.name,
    score: result.score,
    verdict: result.verdict,
    imgExt: "",
    imgHash,
    resultJson: JSON.stringify(result),
    createdAt,
  };

  try {
    const thumbBytes = Buffer.from(await (thumb ?? file).arrayBuffer());
    entry.imgExt = thumb ? "jpg" : ALLOWED_TYPES[file.type] ?? "jpg";
    saveThumbnail(id, entry.imgExt, thumbBytes);
    const countBefore = countRatings();
    insertRating(entry);
    const rank = rankFor(entry);

    let celebrate = false;
    if (countBefore >= 5) {
      celebrate = rank <= 5;
    } else if (countBefore >= 1) {
      celebrate = rank === 1;
    }

    return Response.json({
      ok: true,
      cached: false,
      id,
      rank,
      celebrate,
      result,
    });
  } catch (err) {
    console.error("Failed to persist rating:", err);
    return Response.json({
      ok: true,
      cached: false,
      id,
      rank: -1,
      celebrate: false,
      result,
    });
  }
}
