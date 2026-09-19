"use client";

import { create } from "zustand";
import type { MessageKey } from "@/locale/en";

export type HeartMode = "idle" | "scene" | "corner";

export const HEART_FINALE: readonly MessageKey[] = [
  "heart.welcome",
  "heart.home",
  "heart.cornerHint",
];

interface HeartCompanionState {
  mode: HeartMode;
  messages: MessageKey[];
  lastKey: MessageKey | null;
  token: number;
  pendingComplete: (() => void) | null;

  play: (messages: readonly MessageKey[], onComplete?: () => void) => void;
  finish: () => void;
  settleCorner: () => void;
  hide: () => void;
  reset: () => void;
}

const idle: Pick<HeartCompanionState, "mode" | "messages" | "pendingComplete"> = {
  mode: "idle",
  messages: [],
  pendingComplete: null,
};

export const useHeartCompanion = create<HeartCompanionState>((set, get) => ({
  ...idle,
  lastKey: null,
  token: 0,

  play: (messages, onComplete) => {
    if (get().mode === "scene") return;
    const keys = messages.filter(Boolean);
    if (keys.length === 0) {
      onComplete?.();
      return;
    }
    set((state) => ({
      mode: "scene",
      messages: keys,
      lastKey: keys[keys.length - 1] ?? state.lastKey,
      pendingComplete: onComplete ?? null,
      token: state.token + 1,
    }));
  },

  finish: () => {
    const done = get().pendingComplete;
    set({ ...idle });
    done?.();
  },

  settleCorner: () => set({ ...idle, mode: "corner" }),

  hide: () => set({ ...idle, lastKey: get().lastKey }),

  reset: () => set({ ...idle, lastKey: null, token: 0 }),
}));
