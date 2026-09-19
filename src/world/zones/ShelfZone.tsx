"use client";

import { useState } from "react";
import type { HoldingView, RoomZone, Transform3D } from "@/domain/types";
import { neighborResponse } from "@/design/motion";
import type { InspectTarget } from "@/world/store/worldStore";
import { WorldNode } from "@/world/stage/WorldNode";
import {
  ALBUM_HEIGHT,
  ALBUM_INSPECT_LIFT,
  AlbumSpine,
  spineWidth,
} from "@/world/objects/AlbumSpine";
import { FaceOutRecord, LeaningBook } from "@/world/objects/ShelfExtras";
import { targetFor, type ArrangeContext } from "@/world/edit/arrange";

const DEPTH = 168;
/** Thickness of the carcass timber. Real shelving is chunky; thin reads as CG. */
const FRAME = 20;
const BOARD = 16;

interface ShelfZoneProps {
  zone: RoomZone;
  items: HoldingView[];
  interactive: boolean;
  selectedId?: string | null;
  far?: boolean;
  personality?: "neat" | "overflow";
  arrange?: ArrangeContext;
  /** Receives the object's resolved world position so the camera can frame it. */
  onSelect: (view: HoldingView, at: InspectTarget) => void;
}

/**
 * The album shelf: a freestanding carcass with real timber thickness.
 *
 * The critical detail is the **front frame** — the four faces of the carcass
 * that point at the camera. Without them a shelf is a few thin rectangles
 * floating in space; with them the unit reads as a solid object you could
 * knock on. Those front faces also catch the room's key light directly, which
 * is what anchors the furniture into the same lighting environment as the wall
 * behind it.
 *
 * Contents are routed by format rather than by slot: records stand face-out,
 * books lean, and CD-format releases pack spine-out. A shelf where a vinyl box
 * is filed like a jewel case immediately looks wrong to anyone who owns either.
 */
export function ShelfZone({ zone, items, interactive, selectedId, far = false, personality = "neat", arrange, onSelect }: ShelfZoneProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { w, h } = zone.size;

  const spineItems = items.filter((i) => i.template.kind === "album");
  const records = items.filter((i) => i.template.kind === "vinyl");
  const books = items.filter((i) => i.template.kind === "book");

  const interiorW = w - FRAME * 2;
  const interiorH = h - FRAME * 2;
  // Three bays: albums up top at eye level, records and books below, storage
  // at the bottom where you'd actually put the things you reach for least.
  const bayH = (interiorH - BOARD * 2) / 3;

  const bayTop = (index: number) => FRAME + index * (bayH + BOARD);

  return (
    <WorldNode x={zone.transform.x} y={zone.transform.y} z={zone.transform.z} w={w} h={h} className={far ? "fidelity-far" : undefined}>
      {/* --- Interior back panel, recessed and in shadow ------------------ */}
      <div
        className="world-face m-warm-wood"
        style={{
          ["--base" as string]: "var(--room-furniture)",
          transform: `translateZ(${-DEPTH}px)`,
          background: "color-mix(in oklab, var(--room-furniture) 52%, #000)",
        }}
      />

      {/* --- Interior side walls ----------------------------------------- */}
      {(["left", "right"] as const).map((side) => (
        <div
          key={side}
          className="m-warm-wood"
          style={{
            ["--base" as string]: "var(--room-furniture)",
            position: "absolute",
            top: 0,
            [side]: FRAME,
            width: DEPTH,
            height: h,
            transformOrigin: side === "left" ? "0% 50%" : "100% 50%",
            transform: `rotateY(${side === "left" ? -90 : 90}deg)`,
            background: `color-mix(in oklab, var(--room-furniture) ${side === "left" ? 78 : 52}%, #000)`,
          }}
        />
      ))}

      {/* --- Bays --------------------------------------------------------- */}
      <ShelfBay
        top={bayTop(0)}
        left={FRAME}
        width={interiorW}
        height={bayH}
        depth={DEPTH}
      >
        <SpineRun
          items={spineItems}
          usableWidth={interiorW - 10}
          hoveredId={hoveredId}
          selectedId={selectedId ?? null}
          personality={personality}
          interactive={interactive}
          arrange={arrange}
          worldAt={(localX, localWidth, itemH) => ({
            x: zone.transform.x - w / 2 + FRAME + localX + localWidth / 2,
            y: zone.transform.y - h / 2 + bayTop(0) + bayH - itemH / 2,
            z: zone.transform.z - 48,
          })}
          onHover={setHoveredId}
          onSelect={(view, localX, localWidth) => {
            // Resolve the album's own world position from the zone's transform
            // plus its offset within the bay, then add where the album swings
            // to once it's pulled out. Computing this analytically rather than
            // measuring the DOM keeps it exact through parallax and mid-flight
            // camera moves, when a getBoundingClientRect would be reading a
            // moving target.
            const lift = ALBUM_INSPECT_LIFT;
            onSelect(view, {
              x: zone.transform.x - w / 2 + FRAME + localX + localWidth / 2 + lift.x,
              y: zone.transform.y - h / 2 + bayTop(0) + bayH - ALBUM_HEIGHT / 2 + lift.y,
              z: zone.transform.z + lift.z,
              height: ALBUM_HEIGHT,
            });
          }}
        />
      </ShelfBay>

      <ShelfBay top={bayTop(1)} left={FRAME} width={interiorW} height={bayH} depth={DEPTH}>
        {records.map((record, i) => (
          <FaceOutRecord
            key={record.holding.id}
            view={record}
            offsetX={8 + i * 200}
            height={bayH - 18}
            hovered={hoveredId === record.holding.id}
            interactive={interactive}
            arrange={targetFor(arrange, record.holding.id, {
              x: zone.transform.x - w / 2 + FRAME + 8 + i * 200 + 95,
              y: zone.transform.y - h / 2 + bayTop(1) + bayH - (bayH - 18) / 2,
              z: zone.transform.z - 48,
            })}
            onHover={(hovering) => setHoveredId(hovering ? record.holding.id : null)}
            onSelect={() =>
              onSelect(record, {
                x: zone.transform.x - w / 2 + FRAME + 8 + i * 200 + 95,
                y: zone.transform.y - h / 2 + bayTop(1) + bayH / 2,
                z: zone.transform.z,
              })
            }
          />
        ))}
        {books.map((book, i) => (
          <LeaningBook
            key={book.holding.id}
            view={book}
            offsetX={interiorW - 130 - i * 60}
            height={bayH - 34}
            hovered={hoveredId === book.holding.id}
            interactive={interactive}
            arrange={targetFor(arrange, book.holding.id, {
              x: zone.transform.x - w / 2 + FRAME + interiorW - 130 - i * 60 + 52,
              y: zone.transform.y - h / 2 + bayTop(1) + bayH / 2,
              z: zone.transform.z - 48,
            })}
            onHover={(hovering) => setHoveredId(hovering ? book.holding.id : null)}
            onSelect={() =>
              onSelect(book, {
                x: zone.transform.x - w / 2 + FRAME + interiorW - 130 - i * 60 + 52,
                y: zone.transform.y - h / 2 + bayTop(1) + bayH / 2,
                z: zone.transform.z,
              })
            }
          />
        ))}
      </ShelfBay>

      {/* Bottom bay: deliberately holds storage rather than collection items.
          Every real collector's shelf has one shelf of boxes. */}
      <ShelfBay top={bayTop(2)} left={FRAME} width={interiorW} height={bayH} depth={DEPTH}>
        <StorageBoxes width={interiorW - 16} height={bayH - 14} />
      </ShelfBay>

      {/* --- Front frame: the faces that make it furniture ---------------- */}
      <FrontFrame w={w} h={h} frame={FRAME} />

      {/* Boards' front edges, sitting proud of the interior. */}
      {[0, 1].map((i) => (
        <div
          key={i}
          className="m-warm-wood"
          style={{
            ["--base" as string]: "var(--room-furniture)",
            position: "absolute",
            left: FRAME,
            top: bayTop(i) + bayH,
            width: interiorW,
            height: BOARD,
            boxShadow: "0 -12px 22px color-mix(in oklab, #000 46%, transparent)",
            background:
              "linear-gradient(180deg, color-mix(in oklab, var(--room-furniture-edge) 55%, var(--room-furniture)), var(--room-furniture))",
          }}
        />
      ))}

      {/* Contact shadow where the unit meets the floor. */}
      <div
        className="contact-shadow"
        style={{
          left: -20,
          bottom: -18,
          width: w + 40,
          height: 46,
          ["--shadow-blur" as string]: "16px",
        }}
      />
    </WorldNode>
  );
}

/**
 * One bay of the carcass. Provides the horizontal surface its contents stand
 * on, folded back into the shelf so objects visually rest on something.
 */
function ShelfBay({
  top,
  left,
  width,
  height,
  depth,
  children,
}: {
  top: number;
  left: number;
  width: number;
  height: number;
  depth: number;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        transformStyle: "preserve-3d",
      }}
    >
      {/* The surface objects sit on. */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width,
          height: depth,
          transformOrigin: "50% 100%",
          transform: "rotateX(-90deg)",
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--room-furniture) 72%, #000), color-mix(in oklab, var(--room-furniture-edge) 26%, var(--room-furniture)))",
        }}
      />
      <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d" }}>{children}</div>
    </div>
  );
}

/** Albums packed spine-out, with neighbors displacing around the hovered one. */
function SpineRun({
  items,
  usableWidth,
  hoveredId,
  selectedId,
  personality,
  interactive,
  arrange,
  worldAt,
  onHover,
  onSelect,
}: {
  items: HoldingView[];
  usableWidth: number;
  hoveredId: string | null;
  selectedId: string | null;
  personality: "neat" | "overflow";
  interactive: boolean;
  arrange?: ArrangeContext;
  worldAt?: (localX: number, localWidth: number, height: number) => Transform3D;
  onHover: (id: string | null) => void;
  onSelect: (view: HoldingView, localX: number, localWidth: number) => void;
}) {
  let cursor = 6;
  const placed = items.map((view) => {
    const width = spineWidth(view);
    const x = cursor;
    cursor += width + 1.5;
    return { view, x, width };
  });

  const hoveredIndex = placed.findIndex((p) => p.view.holding.id === hoveredId);
  const selectedIndex = placed.findIndex((p) => p.view.holding.id === selectedId);
  const slack = usableWidth - cursor;

  return (
    <>
      {placed.map((entry, index) => {
        const isHovered = entry.view.holding.id === hoveredId;
        const isSelected = entry.view.holding.id === selectedId;
        const distance = hoveredIndex >= 0 ? index - hoveredIndex : 0;
        const response = hoveredIndex >= 0 && !isHovered ? neighborResponse(distance) : null;

        // Neighbors lean away from whatever is being pulled. The last album
        // leans into the empty end of the row when nothing is hovered, because
        // a partly-filled shelf always has one album tipping over.
        const isLast = index === placed.length - 1;
        const lastLean = isLast && slack > 40 ? 8 : 0;
        const personalityLean =
          personality === "overflow"
            ? index % 3 === 1
              ? -3.4
              : index % 4 === 2
                ? 2.8
                : 0
            : index % 5 === 2
              ? -1.6
              : 0;
        const restLean = lastLean + personalityLean;
        const lean = response
          ? Math.sign(distance) * response.falloff * 3.6 + restLean * (1 - response.falloff)
          : restLean;

        // When an album is drawn out for inspection, the row closes the gap it
        // left behind. This is the single most convincing detail in the whole
        // shelf: it proves the albums are occupying space rather than sitting
        // in fixed slots.
        let displaced = 0;
        if (selectedIndex >= 0 && !isSelected) {
          const gap = placed[selectedIndex]!.width + 1.5;
          displaced = index > selectedIndex ? -gap * 0.55 : gap * 0.2;
        }

        return (
          <AlbumSpine
            key={entry.view.holding.id}
            view={entry.view}
            offsetX={entry.x}
            lean={lean}
            hovered={isHovered && selectedIndex < 0}
            inspecting={isSelected}
            displaced={displaced}
            interactive={interactive}
            showSide={isLast}
            arrange={targetFor(
              arrange,
              entry.view.holding.id,
              worldAt?.(
                entry.x,
                entry.width,
                entry.view.template.kind === "vinyl" ? ALBUM_HEIGHT + 34 : ALBUM_HEIGHT,
              ),
            )}
            onHover={(hovering) => onHover(hovering ? entry.view.holding.id : null)}
            onSelect={() => onSelect(entry.view, entry.x, entry.width)}
          />
        );
      })}
    </>
  );
}

/**
 * The four front faces of the carcass. Drawn last so they sit at z = 0 and
 * occlude the interior correctly.
 */
function FrontFrame({ w, h, frame }: { w: number; h: number; frame: number }) {
  const common: React.CSSProperties = {
    position: "absolute",
    background:
      "linear-gradient(var(--lit-angle), color-mix(in oklab, var(--room-furniture-edge) 52%, var(--room-furniture)), color-mix(in oklab, var(--room-furniture) 88%, #000))",
    boxShadow:
      "inset 0 1px 0 color-mix(in oklab, #fff 12%, transparent), 0 0 22px color-mix(in oklab, #000 40%, transparent)",
  };
  return (
    <>
      <div style={{ ...common, left: 0, top: 0, width: frame, height: h }} />
      <div style={{ ...common, right: 0, top: 0, width: frame, height: h }} />
      <div style={{ ...common, left: 0, top: 0, width: w, height: frame }} />
      <div style={{ ...common, left: 0, bottom: 0, width: w, height: frame }} />
    </>
  );
}

/** Storage boxes on the bottom shelf. Not collection items — set dressing. */
function StorageBoxes({ width, height }: { width: number; height: number }) {
  const boxes = [
    { w: width * 0.42, tone: 0.9 },
    { w: width * 0.3, tone: 0.72 },
    { w: width * 0.24, tone: 0.82 },
  ];
  let x = 8;
  return (
    <>
      {boxes.map((box, i) => {
        const left = x;
        x += box.w + 6;
        return (
          <div
            key={i}
            className="m-paper"
            style={{
              ["--base" as string]: "color-mix(in oklab, var(--room-furniture-edge) 30%, #2b2533)",
              position: "absolute",
              left,
              bottom: 0,
              width: box.w,
              height: height * (0.72 + i * 0.06),
              filter: `brightness(${box.tone})`,
              boxShadow: "inset 0 0 0 1px color-mix(in oklab, #000 40%, transparent)",
            }}
          >
            {/* Label card, the way collectors actually tag their storage. */}
            <div
              style={{
                position: "absolute",
                left: "14%",
                right: "14%",
                top: "26%",
                height: 16,
                background: "color-mix(in oklab, var(--room-ink) 62%, transparent)",
                opacity: 0.24,
              }}
            />
          </div>
        );
      })}
    </>
  );
}
