"use client";

import { useEffect, useRef, useState } from "react";
import {
  LANGS,
  codeToFlag,
  codeToName,
} from "@/lib/i18n";

export default function LanguagePicker({
  lang,
  onSelect,
  label,
}: {
  lang: string;
  onSelect: (code: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 transition-colors hover:border-zinc-500"
      >
        <span aria-hidden>{codeToFlag(lang)}</span>
        <span className="hidden text-zinc-400 sm:inline">{codeToName(lang)}</span>
        <svg
          aria-hidden
          className={`h-3 w-3 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-zinc-700 bg-zinc-900 p-2 shadow-2xl">
          <div className="max-h-80 grid grid-cols-2 gap-1 overflow-y-auto pr-1">
            {LANGS.map((entry) => (
              <button
                key={entry.code}
                type="button"
                onClick={() => {
                  onSelect(entry.code);
                  setOpen(false);
                }}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                  entry.code === lang
                    ? "bg-orange-500/20 text-orange-200"
                    : "text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                <span aria-hidden>{entry.flag}</span>
                <span className="truncate">{entry.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
