export interface LangEntry {
  code: string;
  name: string;
  flag: string;
}

export const LANGS: LangEntry[] = [
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "pt", name: "Português", flag: "🇵🇹" },
  { code: "nl", name: "Nederlands", flag: "🇳🇱" },
  { code: "tr", name: "Türkçe", flag: "🇹🇷" },
  { code: "pl", name: "Polski", flag: "🇵🇱" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "uk", name: "Українська", flag: "🇺🇦" },
  { code: "cs", name: "Čeština", flag: "🇨🇿" },
  { code: "sk", name: "Slovenčina", flag: "🇸🇰" },
  { code: "sv", name: "Svenska", flag: "🇸🇪" },
  { code: "da", name: "Dansk", flag: "🇩🇰" },
  { code: "no", name: "Norsk", flag: "🇳🇴" },
  { code: "fi", name: "Suomi", flag: "🇫🇮" },
  { code: "el", name: "Ελληνικά", flag: "🇬🇷" },
  { code: "hu", name: "Magyar", flag: "🇭🇺" },
  { code: "ro", name: "Română", flag: "🇷🇴" },
  { code: "ar", name: "العربية", flag: "🇸🇦" },
  { code: "he", name: "עברית", flag: "🇮🇱" },
  { code: "hi", name: "हिन्दी", flag: "🇮🇳" },
  { code: "id", name: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
];

export const STORAGE_KEY = "ryp_lang";

export const SUPPORTED = new Set(LANGS.map((l) => l.code));

export function isSupported(code: string): boolean {
  return SUPPORTED.has(code);
}

export function langFromNavigator(nav?: string): string {
  if (!nav) return "en";
  const base = nav.split("-")[0].toLowerCase();
  if (base === "nb" || base === "nn") return "no";
  return isSupported(base) ? base : "en";
}

export function codeToName(code: string): string {
  return LANGS.find((l) => l.code === code)?.name ?? "English";
}

export function codeToFlag(code: string): string {
  return LANGS.find((l) => l.code === code)?.flag ?? "🇬🇧";
}

const UI_EN = {
  tagline:
    "Upload a photo. Get a score, a bit of well-earned praise, and a roast that actually teaches you something.",
  dropHint1: "Drag your masterpiece here",
  dropHint2: "…or click to browse. Anything your browser can open.",
  roastIt: "Roast it",
  discard: "Discard",
  processing: "Sizing your photo down to fighting weight…",
  loading: [
    "Warming up the roasting oven...",
    "Measuring the pixels against the Pyramids...",
    "Asking the AI what your photo did to deserve this...",
    "Sharpening the wit, blurring the excuses...",
    "Checking if even the lighting takes itself seriously...",
  ],
  errType: "That file is too heavy. Keep it under 50 MB.",
  errDecode: "Couldn't read that file. Is it really an image?",
  errGeneric: "Something went wrong. Try again.",
  retry: "Try again",
  tryAnother: "Try another photo",
  workingTitle: "What’s working — keep it going",
  roastTitle: "The roast",
  roastSub: "Every burn comes with a fix. You’re welcome.",
  cachedNote:
    "This exact photo was roasted before — same score and verdict.",
  fixLabel: "Fix:",
  roastAnother: "Roast another photo",
  top5: "Top 5",
  footer:
    "No photos are stored. The critic forgets you the second it looks away.",
  languageLabel: "Language",
  leaderboardTitle: "Leaderboard",
  leaderboardSub: "The five photos that made even the critic jealous.",
  leaderboardEmpty: "No ratings yet. Go get roasted first.",
  backHome: "← Back to rating",
  scoreOfTen: "/10",
};

const UI_DE: typeof UI_EN = {
  tagline:
    "Lad ein Foto hoch. Du bekommst eine Punktzahl, etwas wohlverdientes Lob – und einen Roast, der dir wirklich was beibringt.",
  dropHint1: "Zieh dein Meisterwerk hierher",
  dropHint2: "…oder klick zum Durchsuchen. Alles, was dein Browser öffnen kann.",
  roastIt: "Bewerten lassen",
  discard: "Verwerfen",
  processing: "Dein Foto wird auf Kampfgewicht geschrumpft…",
  loading: [
    "Der Roast-Ofen heizt auf…",
    "Ich vermesse die Pixel an den Pyramiden…",
    "Ich frage die KI, was dein Foto dir angetan hat…",
    "Witz schärfen, Ausreden weichzeichnen…",
    "Ich prüfe, ob sich selbst die Belichtung ernst nimmt…",
  ],
  errType: "Diese Datei ist zu schwer. Halte sie unter 50 MB.",
  errDecode: "Diese Datei konnte nicht gelesen werden. Ist das wirklich ein Bild?",
  errGeneric: "Da ist etwas schiefgelaufen. Versuch es nochmal.",
  retry: "Nochmal versuchen",
  tryAnother: "Anderes Foto probieren",
  workingTitle: "Was funktioniert — weiter so",
  roastTitle: "Der Roast",
  roastSub: "Tut weh, hilft aber.",
  cachedNote:
    "Genau dieses Foto wurde schon mal gerostet — gleicher Score und Verdict.",
  fixLabel: "So fixierst du’s:",
  roastAnother: "Nächstes Foto bewerten",
  top5: "Top 5",
  footer:
    "Es werden keine Fotos gespeichert. Der Kritiker vergisst dich, sobald er wegschaut.",
  languageLabel: "Sprache",
  leaderboardTitle: "Bestenliste",
  leaderboardSub: "Die fünf Fotos, die selbst den Kritiker neidisch gemacht haben.",
  leaderboardEmpty: "Noch keine Bewertungen. Lass dich erstmal roasten.",
  backHome: "← Zurück zum Bewerten",
  scoreOfTen: "/10",
};

export type UiStrings = typeof UI_EN;

export function uiStrings(lang: string): UiStrings {
  return lang === "de" ? UI_DE : UI_EN;
}
