"use client";

import { useCallback, useMemo, useState } from "react";
import { repository } from "@/domain/memory-repository";
import type {
  CollectibleTemplate,
  Member,
  RoomZone,
  SetProgress,
  UserId,
} from "@/domain/types";
import {
  POCKETS_PER_PAGE,
  pocketWorldPoint,
  sideOfPocket,
} from "@/world/objects/binderGeometry";
import { DROP_POINT, dropPointFor } from "@/world/room/PendingCardDrop";
import type { FlightPath } from "./CardFlight";

export type ArrivalPhase = "waiting" | "flying" | "landed";

/**
 * The flagship sequence: the last card of a set crossing the room into its
 * binder.
 *
 * Kept as a hook so the room stays a composition of objects and the *story*
 * lives in one place. The phases matter: `flying` is the only moment the card
 * exists in the world rather than in the collection, and the repository write
 * happens on landing, not on click — so the collection changes at the instant
 * the object arrives, which is the whole point of animating it at all.
 */
export function useCardArrival({
  ownerId,
  progress,
  binderZone,
  archiveZone,
  onOpenBinder,
  onCollectionChanged,
}: {
  ownerId: UserId;
  progress: SetProgress[];
  binderZone: RoomZone | undefined;
  archiveZone?: RoomZone | undefined;
  onOpenBinder: (spreadHint: string) => void;
  onCollectionChanged: () => void;
}) {
  const [phase, setPhase] = useState<ArrivalPhase>("waiting");
  // The card is captured when it's sent, not read live. The moment it lands,
  // the set is complete and the "closest to done" candidate below evaporates —
  // and the celebration needs to know what just happened.
  const [sent, setSent] = useState<Candidate | null>(null);

  /**
   * The card worth animating: from the set closest to done. A set two cards
   * short would make the same flight and land on an incomplete page, which
   * turns the product's best moment into an anticlimax.
   */
  const candidate = useMemo<Candidate | null>(() => {
    const closest = progress
      .filter((entry) => !entry.complete && entry.missingTemplateIds.length === 1)
      .sort((a, b) => b.owned - a.owned)[0];
    if (!closest) return null;

    const templateId = closest.missingTemplateIds[0];
    if (!templateId) return null;
    const template = repository.getTemplate(templateId);
    if (!template) return null;

    const pocketIndex = closest.set.templateIds.indexOf(templateId);
    return {
      setId: closest.set.id,
      setName: closest.set.name,
      template,
      member: template.memberId ? repository.getMember(template.memberId) : undefined,
      pocketIndex,
      remaining: closest.total - closest.owned,
    };
  }, [progress]);

  const inFlight = sent ?? candidate;

  const origin = useMemo(
    () => (archiveZone ? dropPointFor(archiveZone) : DROP_POINT),
    [archiveZone],
  );

  const path: FlightPath | null = useMemo(() => {
    if (!inFlight || !binderZone) return null;
    return {
      from: origin,
      to: pocketWorldPoint(
        binderZone.transform,
        sideOfPocket(inFlight.pocketIndex),
        inFlight.pocketIndex % POCKETS_PER_PAGE,
      ),
    };
  }, [inFlight, binderZone, origin]);

  const send = useCallback(() => {
    if (!candidate || phase !== "waiting") return;
    setSent(candidate);
    setPhase("flying");
    // The binder opens while the card is still in the air. Two things happening
    // at once is what makes it read as one continuous event rather than a
    // sequence of steps the interface is walking you through.
    onOpenBinder(candidate.setId);
  }, [candidate, phase, onOpenBinder]);

  const land = useCallback(() => {
    if (!sent || !binderZone) return;
    repository.addHolding({
      ownerId,
      templateId: sent.template.id,
      zoneId: binderZone.id,
      slot: sent.pocketIndex,
    });
    onCollectionChanged();
    setPhase("landed");
  }, [sent, binderZone, ownerId, onCollectionChanged]);

  return {
    phase,
    /** Shown in the room before the flight; null once it's been sent. */
    candidate: phase === "waiting" ? candidate : null,
    origin,
    inFlight,
    path,
    send,
    land,
    /** Non-null once the card is in the page, for the settle and celebration. */
    landedTemplateId: phase === "landed" ? sent?.template.id ?? null : null,
    celebratingSetId: phase === "landed" ? sent?.setId ?? null : null,
  };
}

interface Candidate {
  setId: string;
  setName: string;
  template: CollectibleTemplate;
  member: Member | undefined;
  /** Position in the set, which is also the pocket it belongs in. */
  pocketIndex: number;
  remaining: number;
}
