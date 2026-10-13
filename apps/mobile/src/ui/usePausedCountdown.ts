import { useEffect, useRef } from "react";

/** One visible-time countdown; pausing retains the remaining time for this key. */
export function usePausedCountdown(duration: number, enabled: boolean, key: string, onElapsed: () => void) {
  const clock = useRef({ key, duration, remaining: duration });
  const callback = useRef(onElapsed);
  useEffect(() => { callback.current = onElapsed; }, [onElapsed]);
  useEffect(() => {
    if (clock.current.key !== key || clock.current.duration !== duration) clock.current = { key, duration, remaining: duration };
    if (!enabled) return;
    const started = Date.now();
    const timer = setTimeout(() => { clock.current.remaining = 0; callback.current(); }, clock.current.remaining);
    return () => {
      clearTimeout(timer);
      clock.current.remaining = Math.max(0, clock.current.remaining - (Date.now() - started));
    };
  }, [duration, enabled, key]);
}
