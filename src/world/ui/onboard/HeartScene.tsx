"use client";

import { useEffect, useRef, useState } from "react";
import { heartScene } from "@/design/motion";
import { useT } from "@/locale/store";
import { useReducedMotion } from "@/world/stage/useViewport";
import { useHeartCompanion } from "@/world/store/heartCompanionStore";
import { SeoullyHeartMark } from "@/world/ui/onboard/SeoullyHeartMark";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type Phase = "cover" | "enter" | "talk" | "exit" | "leave";

function readingMs(text: string, reduced: boolean) {
  const extra = Math.max(0, Array.from(text).length - 18) * heartScene.readPerCharMs;
  const min = reduced ? 1200 : heartScene.readMinMs;
  return min + extra;
}

function useTyped(text: string, active: boolean, ms: number) {
  const [count, setCount] = useState(0);
  const [forText, setForText] = useState(text);

  if (text !== forText) {
    setForText(text);
    setCount(0);
  }
  if (!active && count !== 0) setCount(0);

  useEffect(() => {
    if (!active) return;
    const chars = Array.from(text);
    if (chars.length === 0) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= chars.length) window.clearInterval(id);
    }, ms);
    return () => window.clearInterval(id);
  }, [text, active, ms]);

  return Array.from(text).slice(0, active ? count : 0).join("");
}

/**
 * Full-screen character beat. Same heart as the welcome mascot.
 * A later assistant can reuse this scene without a second character.
 */
export function HeartScene() {
  const mode = useHeartCompanion((s) => s.mode);
  const messages = useHeartCompanion((s) => s.messages);
  const token = useHeartCompanion((s) => s.token);
  const finish = useHeartCompanion((s) => s.finish);
  const reduced = useReducedMotion() || prefersReducedMotion();
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const t = useT();
  const [phase, setPhase] = useState<Phase>("cover");
  const [line, setLine] = useState(0);

  const open = mode === "scene" && messages.length > 0;
  const message = open ? t(messages[line] ?? messages[0]!) : "";
  const typing = phase === "talk";
  const typed = useTyped(message, typing, reduced ? heartScene.typeReducedMs : heartScene.typeMs);
  const typedOut = typing && typed.length >= Array.from(message).length && message.length > 0;
  const finale = messages.length > 1;

  useEffect(() => {
    if (!open) {
      setPhase("cover");
      setLine(0);
      return;
    }
    setPhase("cover");
    setLine(0);
    const still = reducedRef.current;
    const enterAt = still ? heartScene.coverReducedMs : heartScene.coverMs;
    const enterFor = still ? heartScene.enterReducedMs : heartScene.enterMs;
    const start = window.setTimeout(() => setPhase("enter"), enterAt);
    const talk = window.setTimeout(() => setPhase("talk"), enterAt + enterFor);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(talk);
    };
  }, [open, token]);

  useEffect(() => {
    if (!open || !typedOut) return;
    const pause = readingMs(message, reduced);
    const timer = window.setTimeout(() => {
      if (line + 1 < messages.length) setLine(line + 1);
      else setPhase("exit");
    }, pause);
    return () => window.clearTimeout(timer);
  }, [open, typedOut, message, line, messages.length, reduced]);

  useEffect(() => {
    if (phase !== "exit") return;
    const exitFor = reduced ? heartScene.exitReducedMs : heartScene.exitMs;
    const timer = window.setTimeout(() => setPhase("leave"), exitFor);
    return () => window.clearTimeout(timer);
  }, [phase, reduced]);

  useEffect(() => {
    if (phase !== "leave") return;
    const leaveFor = reduced ? heartScene.coverReducedMs : heartScene.coverMs;
    const timer = window.setTimeout(finish, leaveFor);
    return () => window.clearTimeout(timer);
  }, [phase, reduced, finish]);

  if (!open) return null;

  const actorOn = phase === "enter" || phase === "talk" || phase === "exit";
  const bubbleOn = phase === "talk";
  const shown = phase !== "leave";

  return (
    <div
      className={`heart-scene is-${phase}${reduced ? " is-still" : ""}${finale ? " is-finale" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("heart.aria")}
    >
      <div className={`heart-scene-veil${shown ? " is-on" : ""}`} />
      <div className={`heart-scene-stage${shown ? " is-on" : ""}`}>
        {actorOn && (
          <div className={`heart-scene-actor is-${phase}`}>
            <div className="heart-scene-float">
              <SeoullyHeartMark className="heart-scene-art" alt="" />
            </div>
            <div className="heart-scene-shadow" aria-hidden="true" />
          </div>
        )}
        {bubbleOn && (
          <p className="heart-scene-bubble" role="status" aria-live="polite">
            {typed}
            {!typedOut && <span className="heart-scene-caret" aria-hidden="true" />}
          </p>
        )}
      </div>
    </div>
  );
}
