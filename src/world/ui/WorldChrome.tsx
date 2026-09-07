"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ease } from "@/design/motion";
import type { CollectionStats, HoldingView, Profile, Room, User } from "@/domain/types";
import { useWorld } from "@/world/store/worldStore";

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

  if (view.kind === "arrival" || view.kind === "profile" || view.kind === "feed") return null;

  const zone =
    view.kind === "zone" || view.kind === "inspect" || view.kind === "binder"
      ? room.zones.find((z) => z.id === view.zoneId)
      : undefined;

  const canGoBack = view.kind !== "room";

  return (
    <div
      className="atmo"
      style={{ zIndex: 40, color: "var(--room-ink)", pointerEvents: "none" }}
    >
      {/* --- Whose room this is ---------------------------------------- */}
      <div style={{ position: "absolute", left: 34, top: 30, pointerEvents: "auto" }}>
        <button
          onClick={onOpenProfile}
          style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}
        >
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: `linear-gradient(150deg, ${profile.avatarColor}, color-mix(in oklab, ${profile.avatarColor} 40%, #000))`,
              boxShadow: `0 0 16px color-mix(in oklab, ${profile.avatarColor} 45%, transparent)`,
              flexShrink: 0,
            }}
          />
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
              {room.theme.name} · {stats.totalItems} items
            </span>
          </span>
        </button>
      </div>

      {/* --- What you're looking at ------------------------------------- */}
      <AnimatePresence mode="wait">
        {(zone || inspected) && (
          <motion.div
            key={inspected?.holding.id ?? zone?.id ?? "none"}
            style={{ position: "absolute", left: 34, bottom: 34, maxWidth: 340 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={ease.ui}
          >
            {inspected ? <ObjectCaption view={inspected} /> : (
              <div className="u-eyebrow" style={{ color: "var(--room-ink-soft)" }}>
                {zone?.label}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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
              Step back
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

/**
 * The caption for an object under inspection.
 *
 * Reads as a museum label — eyebrow, name, then the provenance details a
 * collector actually cares about. Condition and acquisition are surfaced
 * because they're what makes it *this* copy rather than a catalog entry.
 */
function ObjectCaption({ view }: { view: HoldingView }) {
  const { template, holding, member, era, version } = view;
  const accent = member?.color ?? template.colorway.accent;

  return (
    <div>
      <div className="u-eyebrow" style={{ color: accent, fontSize: 8.5 }}>
        {view.group.name}
        {era ? ` · ${era.name}` : ""}
      </div>
      <div className="u-display" style={{ fontSize: 34, marginTop: 8 }}>
        {view.release?.title ?? template.name}
      </div>
      {version && (
        <div
          className="u-eyebrow"
          style={{ fontSize: 8, color: "var(--room-ink-soft)", marginTop: 6 }}
        >
          {version.name}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 22,
          marginTop: 18,
          paddingTop: 14,
          borderTop: "1px solid color-mix(in oklab, var(--room-ink) 16%, transparent)",
        }}
      >
        <Detail label="Condition" value={holding.condition.replace("-", " ")} />
        <Detail label="Acquired" value={formatDate(holding.acquisition.acquiredAt)} />
        {template.rarity !== "common" && <Detail label="Rarity" value={template.rarity} />}
      </div>

      {holding.acquisition.source && (
        <div
          style={{
            marginTop: 14,
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: 15,
            color: "var(--room-ink-soft)",
          }}
        >
          {holding.acquisition.source}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="u-eyebrow" style={{ fontSize: 7.5, color: "var(--room-ink-soft)" }}>
        {label}
      </div>
      <div
        className="u-stat"
        style={{ fontSize: 12, marginTop: 5, textTransform: "capitalize" }}
      >
        {value}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
