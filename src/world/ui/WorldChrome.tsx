"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ease } from "@/design/motion";
import type { CollectionStats, HoldingView, Profile, Room, User } from "@/domain/types";
import { useSession } from "@/world/store/sessionStore";
import { isSocialView, useWorld } from "@/world/store/worldStore";
import { useViewport } from "@/world/stage/useViewport";
import { useTraversal } from "@/world/useTraversal";
import { localizeError } from "@/locale/copy";
import { useT } from "@/locale/store";
import { LanguageToggle } from "@/world/ui/LanguageToggle";
import { Portrait } from "@/world/ui/Portrait";

/**
 * The interface layer that sits over the room.
 *
 * Held to a deliberate minimum. Every control added here is a control that
 * isn't an object in the world, and the product's whole claim is that the room
 * *is* the interface. So this is limited to three things a spatial scene
 * genuinely can't express by itself: whose room you're in, what you're
 * currently looking at, and how to get back out.
 */
export function WorldChrome({
  user,
  profile,
  stats,
  room,
  inspected,
  onOpenProfile,
}: {
  user: User;
  profile: Profile;
  stats: CollectionStats;
  room: Room;
  inspected: HoldingView | null;
  onOpenProfile: () => void;
}) {
  const view = useWorld((s) => s.view);
  const back = useWorld((s) => s.back);
  const viewerId = useWorld((s) => s.viewerId);
  const showFeed = useWorld((s) => s.showFeed);
  const enterEdit = useWorld((s) => s.enterEdit);
  const { travelToRoomOf } = useTraversal();
  const visiting = room.ownerId !== viewerId;
  const compact = useViewport().width < 800;
  const placementHint = useSession((s) => s.placementHint);
  const added = useSession((s) => s.error === "catalog.added");
  const clearError = useSession((s) => s.clearError);
  const finishRoomIntro = useSession((s) => s.finishRoomIntro);
  const t = useT();

  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(clearError, 3200);
    return () => window.clearTimeout(timer);
  }, [added, clearError]);

  // Escape is the universal "step back out" in a spatial interface. Bound
  // globally rather than on a focused element, because the thing you want to
  // back out of is usually the thing that has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back]);

  if (view.kind === "arrival" || isSocialView(view)) return null;

  const zone =
    view.kind === "zone" || view.kind === "inspect" || view.kind === "binder"
      ? room.zones.find((z) => z.id === view.zoneId)
      : undefined;

  const canGoBack = view.kind !== "room" && view.kind !== "edit";

  return (
    <div
      className="atmo"
      style={{ zIndex: 40, color: "var(--room-ink)", pointerEvents: "none" }}
    >
      {/* --- Whose room this is ---------------------------------------- */}
      <div className="world-chrome-name">
        <button
          onClick={onOpenProfile}
          style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}
        >
          <Portrait user={user} profile={profile} size={28} />
          <span>
            <span
              className="u-display"
              style={{ display: "block", fontSize: 21, letterSpacing: "0.01em" }}
            >
              {user.displayName}
            </span>
            <span
              className="u-eyebrow"
              style={{ display: "block", fontSize: 8.5, color: "var(--room-ink-soft)", marginTop: 3 }}
            >
              @{user.handle}
              {!compact && (profile.tagline ? ` · ${profile.tagline}` : ` · ${room.theme.name}`)}
              {` · ${t("room.collected", { count: stats.totalItems })}`}
            </span>
          </span>
        </button>
      </div>

      {/* --- What you're looking at ------------------------------------- */}
      <AnimatePresence mode="wait">
        {zone && !inspected && (
          <motion.div
            key={zone.id}
            style={{ position: "absolute", left: 34, bottom: 34, maxWidth: 340 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={ease.ui}
          >
            <div className="u-eyebrow" style={{ color: "var(--room-ink-soft)" }}>
              {zone.label}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {placementHint && !visiting && (
        <div className="world-first-hint">
          <p>{t("room.yourCollectible")}</p>
          <button type="button" className="u-eyebrow" onClick={finishRoomIntro}>
            {t("room.continue")}
          </button>
        </div>
      )}

      {added && !visiting && (
        <div className="world-first-hint" role="status">
          <p>{localizeError("catalog.added", t)}</p>
        </div>
      )}

      {/* --- Discovery, and the way home when you're visiting ---------- */}
      {view.kind === "room" && (
        <div className="world-chrome-nav">
          {visiting && (
            <button
              className="u-eyebrow"
              style={{ fontSize: 8.5, color: "var(--room-ink-soft)" }}
              onClick={() => travelToRoomOf(viewerId)}
            >
              {t("room.yourRoom")}
            </button>
          )}
          {!visiting && (
            <button
              className="u-eyebrow"
              style={{ fontSize: 8.5, color: "var(--room-ink-soft)" }}
              onClick={enterEdit}
            >
              {t("room.editRoom")}
            </button>
          )}
          <LanguageToggle />
          <button
            type="button"
            className="u-eyebrow"
            aria-label={t("nav.discover")}
            style={{ fontSize: 8.5, color: "var(--room-ink-soft)", padding: "10px 2px" }}
            onClick={showFeed}
          >
            {t("room.discover")}
          </button>
        </div>
      )}

      {/* --- Getting back out ------------------------------------------- */}
      <AnimatePresence>
        {canGoBack && (
          <motion.button
            style={{
              position: "absolute",
              right: 34,
              top: 32,
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              gap: 9,
            }}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={ease.ui}
            onClick={back}
          >
            <span
              className="u-eyebrow"
              style={{ fontSize: 8.5, color: "var(--room-ink-soft)" }}
            >
              {t("room.stepBack")}
            </span>
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                border: "1px solid color-mix(in oklab, var(--room-ink) 30%, transparent)",
                display: "grid",
                placeItems: "center",
                fontSize: 11,
                color: "var(--room-ink-soft)",
              }}
            >
              ⎋
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}