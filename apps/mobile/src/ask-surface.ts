import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { AskSurfaceContext } from "seoully-domain/ask-context";

let overlay: Partial<AskSurfaceContext> | null = null;
const listeners = new Set<() => void>();

export function setAskSurfaceOverlay(next: Partial<AskSurfaceContext> | null) {
  overlay = next;
  listeners.forEach((listener) => listener());
}

export function getAskSurfaceOverlay() {
  return overlay;
}

export function useAskSurfaceOverlay() {
  const [value, setValue] = useState(overlay);
  useEffect(() => {
    const onChange = () => setValue(overlay);
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);
  return value;
}

export function useReportAskSurface(context: Partial<AskSurfaceContext>) {
  const key = JSON.stringify(context);
  useFocusEffect(useCallback(() => {
    setAskSurfaceOverlay(JSON.parse(key) as Partial<AskSurfaceContext>);
    return () => setAskSurfaceOverlay(null);
  }, [key]));
}
