import { MINJI, SOO } from "./fixtures/collectors";
import type { Session, UserId } from "./types";

const SESSION_KEY = "seoully.session.v1";

export const FIXTURE_USER_IDS: ReadonlySet<string> = new Set([SOO, MINJI]);

export function isFixtureUser(userId: UserId): boolean {
  return FIXTURE_USER_IDS.has(userId);
}

export function readSession(): Session {
  if (typeof window === "undefined") return { kind: "none" };
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return { kind: "none" };
    const parsed = JSON.parse(raw) as Session;
    if (parsed.kind === "demo" && parsed.userId && FIXTURE_USER_IDS.has(parsed.userId)) return parsed;
    return { kind: "none" };
  } catch {
    return { kind: "none" };
  }
}

export function writeSession(session: Session): void {
  if (typeof window === "undefined") return;
  try {
    if (session.kind === "none" || session.kind === "auth") window.localStorage.removeItem(SESSION_KEY);
    else if (session.kind === "demo" && FIXTURE_USER_IDS.has(session.userId)) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Quota / private mode — stay in-memory for the tab.
  }
}

export function normalizeHandle(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_]/g, "");
}

export function handleError(handle: string): string | null {
  if (handle.length < 3) return "error.handleShort";
  if (handle.length > 16) return "error.handleLong";
  if (!/^[a-z][a-z0-9_]*$/.test(handle)) return "error.handleFormat";
  return null;
}
