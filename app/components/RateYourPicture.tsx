"use client";

import Image from "next/image";
import Link from "next/link";
import confetti from "canvas-confetti";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { RateResult } from "@/lib/types";
import { uiStrings } from "@/lib/i18n";
import { useLanguage } from "@/lib/useLanguage";
import { processImage, readMetadataText, MAX_SOURCE_BYTES } from "@/lib/imageProcessing";
import LanguagePicker from "./LanguagePicker";

type Stage = "processing" | "upload" | "loading" | "done" | "error";

const LAST_RESULT_KEY = "ryp_last_result";

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 rounded-full border-4 border-zinc-800" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-orange-400" />
      </div>
      <p className="text-sm text-zinc-400">{label}</p>
    </div>
  );
}

export default function RateYourPicture() {
  const { lang, setLang } = useLanguage();
  const t = uiStrings(lang);

  const [stage, setStage] = useState<Stage>("upload");
  const [analysis, setAnalysis] = useState<Blob | null>(null);
  const [thumb, setThumb] = useState<Blob | null>(null);
  const [metaText, setMetaText] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<RateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [loadingLine, setLoadingLine] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const celebrateFiredRef = useRef(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(LAST_RESULT_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as { result: RateResult; dataUrl: string };
      if (parsed.result && parsed.dataUrl) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restore persisted result once after mount
        setResult(parsed.result);
        setPreview(parsed.dataUrl);
        setStage("done");
      }
    } catch {
      window.localStorage.removeItem(LAST_RESULT_KEY);
    }
  }, []);

  useEffect(() => {
    if (stage !== "loading") return;
    const interval = setInterval(
      () => setLoadingLine((i) => (i + 1) % t.loading.length),
      1600,
    );
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const revokePreview = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const pickFile = useCallback(
    async (candidate: File | null | undefined) => {
      if (!candidate) return;
      if (candidate.size > MAX_SOURCE_BYTES) {
        setStage("error");
        setError(uiStrings(lang).errType);
        return;
      }
      revokePreview();
      setAnalysis(null);
      setThumb(null);
      setPreview(null);
      setResult(null);
      setError(null);
      setCached(false);
      setCelebrate(false);
      celebrateFiredRef.current = false;
      setStage("processing");

      try {
        const [{ analysis: a, thumb: th }, meta] = await Promise.all([
          processImage(candidate),
          readMetadataText(candidate),
        ]);
        const url = URL.createObjectURL(a);
        objectUrlRef.current = url;
        setAnalysis(a);
        setThumb(th);
        setMetaText(meta);
        setPreview(url);
        setStage("upload");
      } catch {
        setStage("error");
        setError(uiStrings(lang).errDecode);
      }
    },
    [lang, revokePreview],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      pickFile(e.dataTransfer.files?.[0]);
    },
    [pickFile],
  );

  const submit = useCallback(async () => {
    if (!analysis) return;
    setStage("loading");
    setResult(null);
    setError(null);
    setCached(false);
    setCelebrate(false);
    celebrateFiredRef.current = false;

    const body = new FormData();
    body.append("file", analysis, "photo.jpg");
    if (thumb) body.append("thumb", thumb, "thumb.jpg");
    if (metaText) body.append("meta", metaText);

    try {
      const res = await fetch("/api/rate", {
        method: "POST",
        headers: { "x-lang": lang },
        body,
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        id?: string;
        cached?: boolean;
        celebrate?: boolean;
        result?: RateResult;
      };
      if (!res.ok || !data.ok || !data.result) {
        throw new Error(data.error || t.errGeneric);
      }
      setResult(data.result);
      setCached(Boolean(data.cached));
      setCelebrate(Boolean(data.celebrate));
      setStage("done");

      try {
        const dataUrl = await blobToDataURL(thumb ?? analysis);
        window.localStorage.setItem(
          LAST_RESULT_KEY,
          JSON.stringify({ result: data.result, dataUrl }),
        );
      } catch {
        // not critical — only affects restoring after navigation
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errGeneric);
      setStage("error");
    }
  }, [analysis, thumb, metaText, lang, t.errGeneric]);

  const reset = useCallback(() => {
    revokePreview();
    setAnalysis(null);
    setThumb(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setCached(false);
    setCelebrate(false);
    celebrateFiredRef.current = false;
    setMetaText(null);
    setStage("upload");
    try {
      window.localStorage.removeItem(LAST_RESULT_KEY);
    } catch {
      // ignore
    }
    if (inputRef.current) inputRef.current.value = "";
  }, [revokePreview]);

  useEffect(() => () => revokePreview(), [revokePreview]);

  useEffect(() => {
    if (stage !== "done" || !celebrate || !result || celebrateFiredRef.current) {
      return;
    }
    celebrateFiredRef.current = true;
    const timer = setTimeout(() => {
      confetti({
        particleCount: 130,
        spread: 80,
        startVelocity: 40,
        origin: { x: 0.5, y: 0.65 },
        colors: ["#fb923c", "#f43f5e", "#fbbf24", "#34d399", "#ffffff"],
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [stage, celebrate, result]);

  useEffect(() => {
    const glow = glowRef.current;
    const card = cardRef.current;
    if (!preview || !glow || !card) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = card.getBoundingClientRect();
      const gx = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
      const gy = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
      glow.style.setProperty("--gx", `${gx.toFixed(2)}%`);
      glow.style.setProperty("--gy", `${gy.toFixed(2)}%`);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [preview]);

  return (
    <div className="isolate flex min-h-dvh w-full flex-col items-center overflow-x-clip bg-zinc-950 px-4 py-6 text-zinc-100">
      {preview && (
        <div
          ref={glowRef}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
          style={{ "--gx": "50%", "--gy": "50%" } as CSSProperties}
        >
          <Image
            src={preview}
            alt=""
            unoptimized
            fill
            sizes="100%"
            className="scale-110 object-cover opacity-20 blur-3xl saturate-150"
          />
          <Image
            src={preview}
            alt=""
            unoptimized
            fill
            sizes="100%"
            className="scale-110 object-cover opacity-70 blur-2xl saturate-150"
            style={{
              maskImage:
                "radial-gradient(circle at var(--gx) var(--gy), black 0%, rgba(0,0,0,0.7) 14%, transparent 68%)",
              WebkitMaskImage:
                "radial-gradient(circle at var(--gx) var(--gy), black 0%, rgba(0,0,0,0.7) 14%, transparent 68%)",
            }}
          />
        </div>
      )}

      <div className="relative flex w-full max-w-3xl items-center justify-end gap-3">
        <Link
          href="/leaderboard"
          className="flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 transition-colors hover:border-orange-400/70 hover:text-orange-200"
        >
          <span aria-hidden>🏆</span>
          <span>{t.top5}</span>
        </Link>
        <LanguagePicker lang={lang} onSelect={setLang} label={t.languageLabel} />
      </div>

      <header className="relative mb-8 mt-6 text-center">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          RATE YOUR{" "}
          <span className="bg-gradient-to-r from-rose-400 via-orange-400 to-amber-300 bg-clip-text text-transparent">
            PICTURE
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-zinc-400">
          {t.tagline}
        </p>
      </header>

      <main className="relative flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8">
        {stage === "upload" && !preview && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            className={`flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-16 text-center transition-colors ${
              dragging
                ? "border-orange-400 bg-orange-400/10"
                : "border-zinc-700 bg-zinc-900/60 hover:border-zinc-500 hover:bg-zinc-900"
            }`}
          >
            <div className="text-5xl" aria-hidden>
              📸
            </div>
            <p className="text-lg font-semibold text-zinc-200">{t.dropHint1}</p>
            <p className="text-sm text-zinc-500">{t.dropHint2}</p>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </div>
        )}

        {stage === "processing" && <Spinner label={t.processing} />}

        {preview && stage !== "done" && (
          <div className="relative flex w-full flex-col items-center">
            <div
              ref={cardRef}
              className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 shadow-2xl"
            >
              <Image
                src={preview}
                alt="Your upload"
                unoptimized
                width={1024}
                height={1024}
                className="h-auto w-full object-contain"
              />
            </div>

            <div className="relative flex w-full flex-col items-center gap-6">
              {stage === "upload" && (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={submit}
                    className="rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-8 py-3 text-base font-bold text-white shadow-lg transition-transform hover:scale-105"
                  >
                    {t.roastIt}
                  </button>
                  <button
                    onClick={reset}
                    className="rounded-full border border-zinc-700 px-6 py-3 text-base font-semibold text-zinc-300 transition-colors hover:border-zinc-500"
                  >
                    {t.discard}
                  </button>
                </div>
              )}

              {stage === "loading" && <Spinner label={t.loading[loadingLine]} />}

              {stage === "error" && (
                <div className="w-full max-w-md rounded-2xl border border-rose-800/60 bg-rose-950/40 p-5 text-center">
                  <p className="text-rose-200">{error}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={submit}
                      className="rounded-full bg-zinc-200 px-5 py-2 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white"
                    >
                      {t.retry}
                    </button>
                    <button
                      onClick={reset}
                      className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-500"
                    >
                      {t.tryAnother}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {preview && stage === "done" && result && (
          <div className="relative flex w-full flex-col items-center gap-8">
            <div className="flex w-full flex-col items-center gap-5 md:flex-row md:items-start md:justify-center md:gap-4">
              <div aria-hidden className="hidden md:block md:flex-1" />
              <div
                ref={cardRef}
                className="relative w-full max-w-md shrink-0 overflow-hidden rounded-2xl border border-zinc-800 shadow-2xl"
              >
                <Image
                  src={preview}
                  alt="Your upload"
                  unoptimized
                  width={1024}
                  height={1024}
                  className="h-auto w-full object-contain"
                />
              </div>
              <div className="flex w-full max-w-md flex-row items-center justify-center gap-3 md:w-auto md:max-w-none md:flex-1 md:flex-col md:items-start">
                <button
                  onClick={reset}
                  className="whitespace-nowrap rounded-full bg-gradient-to-r from-rose-500 to-orange-500 px-7 py-3 text-base font-bold text-white shadow-lg transition-transform hover:scale-105"
                >
                  {t.roastAnother}
                </button>
                {cached && (
                  <p className="rounded-full border border-zinc-700/70 bg-zinc-900/70 px-3 py-1 text-xs text-zinc-400">
                    {t.cachedNote}
                  </p>
                )}
              </div>
            </div>

            <div className="flex w-full flex-col items-center gap-8">
              {result.name && (
                <p className="text-center text-sm font-semibold uppercase tracking-[0.3em] text-orange-300/90">
                  {result.name}
                </p>
              )}
              <div className="flex flex-col items-center gap-4">
                <div className="text-7xl font-black tracking-tight sm:text-8xl">
                  <span
                    className={
                      result.score >= 7
                        ? "text-emerald-400"
                        : result.score >= 4.5
                          ? "text-amber-300"
                          : "text-rose-400"
                    }
                  >
                    {result.score.toFixed(1)}
                  </span>
                  <span className="text-3xl text-zinc-600 sm:text-4xl">
                    {t.scoreOfTen}
                  </span>
                </div>
                {result.verdict && (
                  <p className="max-w-xl text-center text-xl italic leading-relaxed text-zinc-200">
                    “{result.verdict}”
                  </p>
                )}
              </div>

              {result.working.length > 0 && (
                <section className="w-full rounded-2xl border border-emerald-900/60 bg-emerald-950/20 p-6">
                  <h2 className="mb-4 text-lg font-bold text-emerald-300">
                    {t.workingTitle}
                  </h2>
                  <ul className="flex flex-col gap-3">
                    {result.working.map((item, i) => (
                      <li key={i} className="flex gap-3 text-zinc-200">
                        <span className="mt-0.5 text-emerald-400" aria-hidden>
                          ✓
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {result.roast.length > 0 && (
                <section className="w-full rounded-2xl border border-rose-900/60 bg-rose-950/20 p-6">
                  <h2 className="mb-1 text-lg font-bold text-rose-300">
                    {t.roastTitle}
                  </h2>
                  <p className="mb-4 text-sm text-zinc-500">{t.roastSub}</p>
                  <ol className="flex flex-col gap-5">
                    {result.roast.map((item, i) => (
                      <li key={i} className="border-l-2 border-rose-800 pl-4">
                        <p className="text-zinc-200">{item.burn}</p>
                        <p className="mt-2 text-emerald-300">
                          → {t.fixLabel}{" "}
                          <span className="text-zinc-300">{item.fix}</span>
                        </p>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="relative mt-10 text-center text-xs text-zinc-600">
        {t.footer}
      </footer>
    </div>
  );
}
