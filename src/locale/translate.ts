import { en, type MessageKey } from "./en";
import { ko } from "./ko";

export type Locale = "en" | "ko";
export type TranslateParams = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: TranslateParams) => string;

const DICTS: Record<Locale, Record<MessageKey, string>> = { en, ko };

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ko";
}

export function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    return value === undefined ? `{${name}}` : String(value);
  });
}

export function translate(locale: Locale, key: MessageKey, params?: TranslateParams): string {
  const dict = DICTS[locale] ?? en;
  return interpolate(dict[key] ?? en[key] ?? key, params);
}

export function dateLocale(locale: Locale): string {
  return locale === "ko" ? "ko-KR" : "en-US";
}

export function formatShortDate(iso: string, locale: Locale): string {
  const date = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(dateLocale(locale), { month: "short", day: "numeric" });
}

export function formatMonthYear(iso: string, locale: Locale): string {
  const date = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(dateLocale(locale), { month: "long", year: "numeric" });
}

export function formatMessageWhen(iso: string, locale: Locale): string {
  const date = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  const tag = dateLocale(locale);
  const time = date.toLocaleTimeString(tag, { hour: "numeric", minute: "2-digit" });
  if (!iso.includes("T")) {
    return date.toLocaleDateString(tag, { month: "short", day: "numeric" });
  }
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return time;
  return `${date.toLocaleDateString(tag, { month: "short", day: "numeric" })} · ${time}`;
}
