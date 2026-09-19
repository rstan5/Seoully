"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { HoldingView } from "@/domain/types";
import { ease, objectSpring, spring } from "@/design/motion";
import { WorldNode } from "@/world/stage/WorldNode";
import { Photocard } from "./Photocard";
import {
  OPEN_LIFT,
  PAGE_H,
  PAGE_W,
  POCKETS_PER_PAGE,
  POCKET_CARD_H,
  SPINE_W,
  SPREAD_W,
  type BinderPage,
  type BinderPocket,
  pocketRect,
} from "./binderGeometry";

/** Rest angle of each page off the spine. A held binder never lies flat. */
const V_ANGLE = 7;

interface OpenBinderProps {
  /** Zone position of the closed binder; the open one lifts off from here. */
  at: { x: number; y: number; z: number };
  pages: BinderPage[];
  spread: number;
  /** Card currently pulled out of its sleeve, by template id. */
  heldTemplateId: string | null;
  /** Card that just landed, so it can settle into its sleeve rather than appear. */
  arrivedTemplateId?: string | null;
  /** Set that just completed. Drives the celebration on its pages. */
  celebratingSetId?: string | null;
  cover?: string;
  onHold: (view: HoldingView | null) => void;
  onTurn: (spread: number) => void;
}

/**
 * The binder, open.
 *
 * Modeled as an object rather than as a page layout: the pages hinge on a real
 * spine, the sleeves are plastic over cardstock, and turning a page rotates a
 * physical leaf whose two faces are the page you were reading and the page
 * you're about to. That last detail is the one that matters — a cross-fade
 * between two grids of cards reads as a slideshow, and everything the room has
 * earned up to this point is spent.
 */
export function OpenBinder({
  at,
  pages,
  spread,
  heldTemplateId,
  arrivedTemplateId = null,
  celebratingSetId = null,
  cover = "#4a1c2c",
  onHold,
  onTurn,
}: OpenBinderProps) {
  // A turn in flight. While set, the leaf is mid-rotation and the spread
  // underneath is already showing what will be revealed behind it.
  const [turning, setTurning] = useState<{ to: number; dir: 1 | -1 } | null>(null);

  const current = { left: pages[spread * 2], right: pages[spread * 2 + 1] };
  const next = turning
    ? { left: pages[turning.to * 2], right: pages[turning.to * 2 + 1] }
    : null;

  const lastSpread = Math.max(0, Math.ceil(pages.length / 2) - 1);

  const turn = (dir: 1 | -1) => {
    if (turning || heldTemplateId) return;
    const to = spread + dir;
    if (to < 0 || to > lastSpread) return;
    setTurning({ to, dir });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") turn(1);
      if (e.key === "ArrowLeft") turn(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spread, turning, lastSpread]);

  // During a forward turn the right-hand page underneath is already the one
  // being uncovered; during a backward turn it's the left-hand page.
  const staticLeft = turning?.dir === -1 ? next?.left : current.left;
  const staticRight = turning?.dir === 1 ? next?.right : current.right;

  return (
    <WorldNode
      x={at.x}
      y={at.y + OPEN_LIFT.y}
      z={at.z + OPEN_LIFT.z}
      w={SPREAD_W}
      h={PAGE_H}
    >
      <motion.div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
        }}
        initial={{ rotateX: 24, y: 60, opacity: 0 }}
        animate={{ rotateX: 3, y: 0, opacity: 1 }}
        transition={objectSpring("binder")}
      >
        {/* --- Spine ---------------------------------------------------- */}
        <div
          className="m-velvet"
          style={{
            ["--base" as string]: cover,
            position: "absolute",
            left: PAGE_W,
            top: -4,
            width: SPINE_W,
            height: PAGE_H + 8,
            transform: "translateZ(-10px)",
            borderRadius: 3,
            boxShadow: "inset 0 0 14px rgba(0,0,0,0.55)",
          }}
        >
          {[0.22, 0.5, 0.78].map((t) => (
            <div
              key={t}
              className="m-brushed-metal"
              style={{
                position: "absolute",
                left: "50%",
                top: `${t * 100}%`,
                width: SPINE_W - 8,
                height: 9,
                marginLeft: -(SPINE_W - 8) / 2,
                marginTop: -4.5,
                borderRadius: 999,
                transform: "translateZ(11px)",
              }}
            />
          ))}
        </div>

        {/* --- Left page ------------------------------------------------ */}
        {staticLeft && (
          <BinderLeaf
            page={staticLeft}
            side="left"
            angle={V_ANGLE}
            heldTemplateId={heldTemplateId}
            arrivedTemplateId={arrivedTemplateId}
            celebratingSetId={celebratingSetId}
            cover={cover}
            onHold={onHold}
            onTurnEdge={() => turn(-1)}
            canTurnEdge={spread > 0}
          />
        )}

        {/* --- Right page ----------------------------------------------- */}
        {staticRight && (
          <BinderLeaf
            page={staticRight}
            side="right"
            angle={-V_ANGLE}
            heldTemplateId={heldTemplateId}
            arrivedTemplateId={arrivedTemplateId}
            celebratingSetId={celebratingSetId}
            cover={cover}
            onHold={onHold}
            onTurnEdge={() => turn(1)}
            canTurnEdge={spread < lastSpread}
          />
        )}

        {/* --- The leaf in flight --------------------------------------- */}
        <AnimatePresence>
          {turning && (
            <motion.div
              key={`turn-${turning.to}-${turning.dir}`}
              style={{
                position: "absolute",
                left: turning.dir === 1 ? PAGE_W + SPINE_W : 0,
                top: 0,
                width: PAGE_W,
                height: PAGE_H,
                transformStyle: "preserve-3d",
                transformOrigin: turning.dir === 1 ? "0% 50%" : "100% 50%",
                zIndex: 5,
              }}
              initial={{ rotateY: turning.dir === 1 ? -V_ANGLE : V_ANGLE }}
              animate={{ rotateY: turning.dir === 1 ? -180 + V_ANGLE : 180 - V_ANGLE }}
              transition={spring.pageturn}
              onAnimationComplete={() => {
                onTurn(turning.to);
                setTurning(null);
              }}
            >
              {/* Face you were reading. */}
              <PageFace
                page={turning.dir === 1 ? current.right : current.left}
                side={turning.dir === 1 ? "right" : "left"}
                interactive={false}
                heldTemplateId={null}
                onHold={onHold}
              />
              {/* Reverse of the same leaf: the page you're turning to. */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  transform: "rotateY(180deg)",
                  backfaceVisibility: "hidden",
                }}
              >
                <PageFace
                  page={turning.dir === 1 ? next?.left : next?.right}
                  side={turning.dir === 1 ? "left" : "right"}
                  interactive={false}
                  heldTemplateId={null}
                  onHold={onHold}
                />
              </div>

              {/* Shading across the leaf as it passes through the light. A page
                  turning under a lamp darkens at mid-rotation and brightens as
                  it lands; without it the leaf reads as a flat card being
                  spun rather than paper moving through a room. */}
              <motion.div
                style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.42, 0] }}
                transition={{ duration: 0.62, times: [0, 0.55, 1] }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(90deg, rgba(6,4,10,0.9), rgba(6,4,10,0.2))",
                  }}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </WorldNode>
  );
}

/**
 * One page hinged on the spine.
 *
 * The hinge is the point: a page's transform origin is the spine, never its own
 * centre, so every page motion in the binder pivots where a real page pivots.
 */
function BinderLeaf({
  page,
  side,
  angle,
  heldTemplateId,
  arrivedTemplateId,
  celebratingSetId,
  cover,
  onHold,
  onTurnEdge,
  canTurnEdge,
}: {
  page: BinderPage;
  side: "left" | "right";
  angle: number;
  heldTemplateId: string | null;
  arrivedTemplateId: string | null;
  celebratingSetId: string | null;
  cover: string;
  onHold: (view: HoldingView | null) => void;
  onTurnEdge: () => void;
  canTurnEdge: boolean;
}) {
  const [edgeHover, setEdgeHover] = useState(false);

  return (
    <motion.div
      style={{
        position: "absolute",
        left: side === "left" ? 0 : PAGE_W + SPINE_W,
        top: 0,
        width: PAGE_W,
        height: PAGE_H,
        transformStyle: "preserve-3d",
        transformOrigin: side === "left" ? "100% 50%" : "0% 50%",
      }}
      initial={{ rotateY: side === "left" ? 92 : -92 }}
      animate={{
        // Hovering the outer edge lifts the page a few degrees, the way you'd
        // catch a corner before turning it. The affordance is the object
        // moving, not a chevron appearing.
        rotateY: angle + (edgeHover ? (side === "left" ? 5 : -5) : 0),
      }}
      transition={objectSpring("book")}
    >
      {/* Cover, a few millimetres proud of the page on three sides. Without a
          body behind them the pages read as two sheets floating in the air,
          and the object stops being a binder. */}
      <div
        className="m-velvet"
        style={{
          ["--base" as string]: cover,
          position: "absolute",
          top: -9,
          bottom: -9,
          [side === "left" ? "left" : "right"]: -9,
          [side === "left" ? "right" : "left"]: 0,
          transform: "translateZ(-7px)",
          borderRadius: side === "left" ? "5px 0 0 5px" : "0 5px 5px 0",
          boxShadow: "0 14px 34px color-mix(in oklab, #000 55%, transparent)",
        }}
      />
      {/* Page block: the other leaves in the binder, seen along the edge. */}
      <div
        style={{
          position: "absolute",
          top: 2,
          bottom: 2,
          [side === "left" ? "left" : "right"]: -4,
          width: 5,
          transform: "translateZ(-3px)",
          background:
            "repeating-linear-gradient(180deg, #efe8da 0px, #cfc5b2 1.5px, #f4efe4 3px)",
        }}
      />

      {/* Outer-edge turn zone. The cover overhang, not the cards. Under the
          page in DOM so a photocard on the outer column still wins. */}
      {canTurnEdge && (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            [side === "left" ? "left" : "right"]: -10,
            width: 16,
            cursor: "pointer",
            transform: "translateZ(-2px)",
          }}
          role="button"
          tabIndex={0}
          aria-label={side === "left" ? "Previous page" : "Next page"}
          onPointerEnter={() => setEdgeHover(true)}
          onPointerLeave={() => setEdgeHover(false)}
          onClick={onTurnEdge}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onTurnEdge();
            }
          }}
        />
      )}

      <PageFace
        page={page}
        side={side}
        interactive
        heldTemplateId={heldTemplateId}
        arrivedTemplateId={arrivedTemplateId}
        celebrating={celebratingSetId === page.setId}
        onHold={onHold}
      />
    </motion.div>
  );
}

/** The printed page itself: cardstock, sleeves, and what's in them. */
function PageFace({
  page,
  side,
  interactive,
  heldTemplateId,
  arrivedTemplateId = null,
  celebrating = false,
  onHold,
}: {
  page: BinderPage | undefined;
  side: "left" | "right";
  interactive: boolean;
  heldTemplateId: string | null;
  arrivedTemplateId?: string | null;
  celebrating?: boolean;
  onHold: (view: HoldingView | null) => void;
}) {
  if (!page) {
    return (
      <div
        className="world-face m-paper"
        style={{ ["--base" as string]: "#efe7d8", backfaceVisibility: "hidden" }}
      />
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transformStyle: "preserve-3d",
        backfaceVisibility: "hidden",
        borderRadius: side === "left" ? "4px 1px 1px 4px" : "1px 4px 4px 1px",
        pointerEvents: "none",
      }}
    >
      {/* Paper is a flat substrate. Cards live in a preserve-3d sibling so
          they can lift off the page without the page flattening them, and so
          a click hits the card instead of the plastic over it. */}
      <div
        className="world-face m-paper"
        style={{
          ["--base" as string]: "#efe7d8",
          borderRadius: side === "left" ? "4px 1px 1px 4px" : "1px 4px 4px 1px",
          pointerEvents: "none",
        }}
      />
      {/* Punch holes along the spine edge. */}
      {[0.22, 0.5, 0.78].map((t) => (
        <div
          key={t}
          style={{
            position: "absolute",
            [side === "left" ? "right" : "left"]: 7,
            top: `${t * 100}%`,
            width: 8,
            height: 8,
            marginTop: -4,
            borderRadius: 999,
            background: "rgba(0,0,0,0.42)",
            boxShadow: "inset 0 1px 1px rgba(0,0,0,0.5)",
            pointerEvents: "none",
          }}
        />
      ))}

      {page.pockets.map((pocket, slot) => (
        <Sleeve
          key={pocket.index}
          pocket={pocket}
          side={side}
          interactive={interactive}
          held={!!pocket.template && pocket.template.id === heldTemplateId}
          arrived={!!pocket.template && pocket.template.id === arrivedTemplateId}
          // The shimmer runs left-to-right across the spread rather than all at
          // once, so the completion reads as light travelling over the page.
          shimmerDelay={celebrating ? 0.34 + slot * 0.075 : null}
          onHold={onHold}
        />
      ))}


      {/* Printed page label. Editorial, not a UI chip. */}
      <div
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 5,
          display: "flex",
          justifyContent: side === "left" ? "flex-start" : "flex-end",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        {/* The page footer carries the completion mark rather than a stamp
            slapped over the cards. A full page has no free space, and a badge
            covering someone's collection to announce that their collection is
            finished would be an odd thing to do to them. */}
        <motion.span
          className="u-eyebrow"
          style={{ fontSize: 5.5, letterSpacing: "0.22em" }}
          animate={{ color: celebrating ? "#a9752a" : "#6b5c46" }}
          transition={ease.uiSlow}
        >
          {page.setName.split("—")[0]?.trim()}
          {celebrating && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ ...ease.text, delay: 0.9 }}
            >
              {" · Complete"}
            </motion.span>
          )}
        </motion.span>
      </div>
    </div>
  );
}

/**
 * A plastic pocket with, or without, a card in it.
 *
 * An empty pocket renders as an empty pocket. That restraint is doing real
 * work: the gap has to look like something missing from a physical page, and
 * anything that reads as a UI placeholder would turn the product's central
 * emotional beat into a loading state.
 */
function Sleeve({
  pocket,
  side,
  interactive,
  held,
  arrived = false,
  shimmerDelay = null,
  onHold,
}: {
  pocket: BinderPocket;
  side: "left" | "right";
  interactive: boolean;
  held: boolean;
  arrived?: boolean;
  shimmerDelay?: number | null;
  onHold: (view: HoldingView | null) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const rect = pocketRect(pocket.index % POCKETS_PER_PAGE);
  const { template, holding } = pocket;
  const canHold = interactive && !!holding;

  return (
    <div
      style={{
        position: "absolute",
        left: rect.left,
        top: rect.top,
        width: rect.w,
        height: rect.h,
        transformStyle: "preserve-3d",
        cursor: canHold ? "pointer" : "default",
        pointerEvents: template ? "auto" : "none",
      }}
      {...(template ? { "data-pocket": template.id } : {})}
      {...(holding ? { "data-hold-card": template!.id } : {})}
      role={canHold ? "button" : undefined}
      tabIndex={canHold ? 0 : -1}
      aria-label={holding ? `${template!.name}. Take out of sleeve.` : undefined}
      onPointerEnter={canHold ? () => setHovered(true) : undefined}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={
        canHold
          ? (e) => {
              e.stopPropagation();
            }
          : undefined
      }
      onClick={
        canHold
          ? (e) => {
              e.stopPropagation();
              onHold(held ? null : holding);
            }
          : undefined
      }
      onKeyDown={
        canHold
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onHold(held ? null : holding);
              }
            }
          : undefined
      }
    >
      {/* The sleeve: a slot with a lip, sitting just off the page. Plastic
          never takes the pointer — the card underneath is the object. */}
      <div
        className="m-plastic-sleeve"
        style={{
          position: "absolute",
          inset: -3,
          borderRadius: 3,
          transform: "translateZ(3px)",
          pointerEvents: "none",
        }}
      />

      {template && (
        <motion.div
          style={{
            position: "absolute",
            inset: 0,
            transformStyle: "preserve-3d",
          }}
          // A card that just flew in finishes its journey here: the flight hands
          // over a few centimetres out of the sleeve, and the sleeve slides it
          // the rest of the way. Splitting the landing across the handoff is
          // what hides the small mismatch between the flight's target and the
          // page's real angle.
          initial={arrived ? { z: 56, y: -22, scale: 1.2, rotateZ: -4 } : false}
          animate={
            held
              ? {
                  // Out of the pocket and toward the camera, as if pinched
                  // between two fingers. These numbers assume the page is
                  // preserve-3d — if the page flattens them, the card never
                  // actually leaves the sleeve.
                  x: side === "right" ? 18 : -18,
                  z: 132,
                  y: -36,
                  scale: 1.72,
                  rotateX: 8,
                  rotateY: side === "right" ? -14 : 14,
                  rotateZ: side === "right" ? -3 : 3,
                }
              : {
                  x: 0,
                  z: hovered ? 16 : 0,
                  y: hovered ? -7 : 0,
                  scale: 1,
                  rotateX: 0,
                  rotateY: 0,
                  rotateZ: 0,
                }
          }
          transition={arrived ? spring.snap : objectSpring("photocard")}
        >
          <motion.div
            className="contact-shadow"
            aria-hidden
            style={{
              left: "-18%",
              right: "-18%",
              bottom: "-8%",
              height: "36%",
              ["--shadow-blur" as string]: "10px",
            }}
            animate={{
              opacity: held ? 0.72 : hovered ? 0.38 : 0.18,
              scale: held ? 1.85 : 1,
              z: held ? -48 : -4,
            }}
            transition={objectSpring("photocard")}
          />

          <Photocard
            template={template}
            {...(holding?.member ? { member: holding.member } : {})}
            height={POCKET_CARD_H}
            ghost={!holding}
            examining={held}
          />

          {/* Completion shimmer: a specular band crossing the card, as though
              the page were tilted into the light. */}
          {shimmerDelay !== null && holding && (
            <motion.div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 4,
                overflow: "hidden",
                pointerEvents: "none",
                transform: "translateZ(1px)",
              }}
            >
              <motion.div
                style={{
                  position: "absolute",
                  top: "-40%",
                  bottom: "-40%",
                  width: "62%",
                  background:
                    "linear-gradient(100deg, transparent, rgba(255,240,205,0.82), transparent)",
                  filter: "blur(1px)",
                }}
                initial={{ x: "-160%", opacity: 0 }}
                animate={{ x: "260%", opacity: [0, 1, 0] }}
                transition={{ duration: 0.72, delay: shimmerDelay, ease: "easeInOut" }}
              />
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}

