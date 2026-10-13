"use client";

import { useEffect, useRef } from "react";
import { useWorld, isSocialView } from "@/world/store/worldStore";
import { repository } from "@/domain/memory-repository";
import { useRepoRevision } from "@/domain/use-repository";
import { resolveProfileTheme } from "@/domain/profile-theme";
import { useSession } from "@/world/store/sessionStore";
import { LanguageToggle } from "./LanguageToggle";

/** One viewport anchor; existing toggle and persisted locale store stay unchanged. */
export function GlobalLanguageControl() {
  const gate = useSession(state => state.gate);
  const looking = useSession(state => state.looking);
  const view = useWorld(state => state.view);
  const roomId = useWorld(state => state.roomId);
  useRepoRevision();
  const anchor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = anchor.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      const width = Math.ceil(node.getBoundingClientRect().width);
      document.documentElement.style.setProperty("--language-control-width", `${width}px`);
    });
    observer.observe(node);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty("--language-control-width"); };
  }, [gate, looking]);
  const profile = view.kind === "profile" ? repository.getProfile(view.userId) : undefined;
  const room = view.kind === "profile" ? repository.getRoomByOwner(view.userId) : repository.getRoom(roomId);
  const palette = resolveProfileTheme(profile?.appearance ?? (!isSocialView(view) && gate === "ready" ? { mode: "room-sync" } : { mode: "default" }), room);
  if (gate === "booting" || looking) return null;
  return <div ref={anchor} className="global-language-control" style={{ color: palette.ink }}><LanguageToggle /></div>;
}
