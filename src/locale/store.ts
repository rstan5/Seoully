"use client";

import { useCallback } from "react";
import { create } from "zustand";
import { getPersistedLocale, setPersistedLocale } from "@/domain/memory-repository";
import type { MessageKey } from "./en";
import { type Locale, type Translate, type TranslateParams, translate } from "./translate";

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

function applyHtmlLang(locale: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale === "ko" ? "ko" : "en";
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: "en",
  setLocale: (locale) => {
    const next = locale === "ko" ? "ko" : "en";
    set({ locale: next });
    setPersistedLocale(next);
    applyHtmlLang(next);
  },
}));

export function hydrateLocale() {
  const locale = getPersistedLocale();
  useLocaleStore.setState({ locale });
  applyHtmlLang(locale);
}

export function useLocale(): Locale {
  return useLocaleStore((state) => state.locale);
}

export function useT(): Translate {
  const locale = useLocale();
  return useCallback((key: MessageKey, params?: TranslateParams) => translate(locale, key, params), [locale]);
}
