"use client";

import { useEffect, useState } from "react";
import {
  STORAGE_KEY,
  isSupported,
  langFromNavigator,
} from "@/lib/i18n";

export function useLanguage() {
  const [lang, setLang] = useState("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const preferred =
      stored && isSupported(stored)
        ? stored
        : langFromNavigator(window.navigator.language);
    setLang(preferred); // eslint-disable-line react-hooks/set-state-in-effect -- read persisted/browser preference once after mount
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  return { lang, setLang };
}
