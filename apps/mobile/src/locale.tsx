import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { copy, type Locale } from "./i18n";

const LOCALE_KEY = "seoully.mobile.locale";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    let mounted = true;
    void SecureStore.getItemAsync(LOCALE_KEY).then((stored) => {
      if (mounted && (stored === "en" || stored === "ko")) setLocaleState(stored);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    setLocale: (next) => {
      setLocaleState(next);
      void SecureStore.setItemAsync(LOCALE_KEY, next);
    },
    toggleLocale: () => {
      const next = locale === "en" ? "ko" : "en";
      setLocaleState(next);
      void SecureStore.setItemAsync(LOCALE_KEY, next);
    },
  }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside LocaleProvider");
  return value;
}

export function useCopy() {
  return copy(useLocale().locale);
}
