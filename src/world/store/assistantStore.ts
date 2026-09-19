"use client";

import { create } from "zustand";
import type { AssistantCard } from "@/domain/assistant-tools";

export interface AssistantMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  cards?: AssistantCard[];
}

interface AssistantState {
  open: boolean;
  pending: boolean;
  viewerId: string | null;
  messages: AssistantMessage[];
  setOpen: (open: boolean) => void;
  setPending: (pending: boolean) => void;
  addMessage: (message: Omit<AssistantMessage, "id">) => void;
  ensureViewer: (viewerId: string) => void;
}

export const useAssistantStore = create<AssistantState>((set) => ({
  open: false,
  pending: false,
  viewerId: null,
  messages: [],
  setOpen: (open) => set({ open }),
  setPending: (pending) => set({ pending }),
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, { ...message, id: Date.now() + state.messages.length }].slice(-18),
  })),
  ensureViewer: (viewerId) => set((state) => state.viewerId === viewerId
    ? state
    : { viewerId, open: false, pending: false, messages: [] }),
}));
