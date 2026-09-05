"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { LeaderboardEntry } from "@/lib/types";
import { uiStrings } from "@/lib/i18n";
import { useLanguage } from "@/lib/useLanguage";
import LanguagePicker from "./LanguagePicker";

export default function Leaderboard() {
  const { lang, setLang } = useLanguage();
  const t = uiStrings(lang);

  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/leaderboard", { signal: controller.signal })
      .then((res) => res.json())
      .then((data: { ok?: boolean; entries?: LeaderboardEntry[] }) => {
        if (data.ok && data.entries) {
          setEntries(data.entries);
        } else {
          setError(t.errGeneric);
        }
      })
      .catch((err: unknown) => {
        if ((err as Error).name !== "AbortError") {
          setError(t.errGeneric);
        }
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-dvh w-full flex-col items-center bg-zinc-950 px-4 py-6 text-zinc-100">
      <div className="flex w-full max-w-3xl items-center justify-end gap-3">
        <Link
          href="/"
          className="rounded-full border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 transition-colors hover:border-orange-400/70 hover:text-orange-200"
        >
          {t.backHome}
        </Link>
        <LanguagePicker lang={lang} onSelect={setLang} label={t.languageLabel} />
      </div>

      <header className="mb-8 mt-6 text-center">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          🏆{" "}
          <span className="bg-gradient-to-r from-rose-400 via-orange-400 to-amber-300 bg-clip-text text-transparent">
            {t.leaderboardTitle}
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-zinc-400">
          {t.leaderboardSub}
        </p>
      </header>

      <main className="flex w-full max-w-2xl flex-1 flex-col items-center gap-4">
        {entries === null && !error && (
          <div className="flex flex-col items-center gap-4 py-16 text-zinc-500">
            <div className="relative h-10 w-10">
              <div className="absolute inset-0 rounded-full border-4 border-zinc-800" />
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-orange-400" />
            </div>
          </div>
        )}

        {error && <p className="py-16 text-rose-300">{error}</p>}

        {entries !== null && entries.length === 0 && (
          <p className="py-16 text-center text-zinc-500">
            {t.leaderboardEmpty}
          </p>
        )}

        {entries !== null &&
          entries.map((entry, i) => (
            <div
              key={entry.id}
              className="flex w-full items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"
            >
              <span
                className={`w-10 shrink-0 text-center text-3xl font-black ${
                  i === 0
                    ? "text-amber-300"
                    : i === 1
                      ? "text-zinc-300"
                      : i === 2
                        ? "text-orange-400"
                        : "text-zinc-600"
                }`}
              >
                {i + 1}
              </span>
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                <Image
                  src={entry.thumbnailUrl}
                  alt={entry.name || `Rank ${i + 1}`}
                  unoptimized
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-zinc-100">
                  {entry.name || "—"}
                </p>
                {entry.verdict && (
                  <p className="truncate text-sm italic text-zinc-500">
                    {entry.verdict}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 text-2xl font-black ${
                  entry.score >= 7
                    ? "text-emerald-400"
                    : entry.score >= 4.5
                      ? "text-amber-300"
                      : "text-rose-400"
                }`}
              >
                {entry.score.toFixed(1)}
              </span>
            </div>
          ))}
      </main>

      <footer className="mt-10 text-center text-xs text-zinc-600">
        {t.footer}
      </footer>
    </div>
  );
}
