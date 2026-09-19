"use client";

import { useLocaleStore } from "@/locale/store";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const korean = locale === "en";

  return (
    <button
      type="button"
      className={`s-lang${className ? ` ${className}` : ""}`}
      onClick={() => setLocale(korean ? "ko" : "en")}
      aria-label={korean ? "한국어로 변경" : "Switch to English"}
    >
      {korean ? "한국어" : "English"}
    </button>
  );
}
