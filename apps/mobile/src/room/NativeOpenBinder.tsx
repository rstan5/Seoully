/* eslint-disable react/no-unknown-property -- React Three Fiber JSX uses Three.js properties. */
import { Suspense, useRef, useState } from "react";
import { useFrame, useLoader } from "@react-three/fiber/native";
import { DoubleSide, TextureLoader } from "three";
import type { NativeHolding } from "../api";
import { useCachedSignedMedia } from "../media/cachedMedia";
import type { NativeBinderPage, NativeBinderSpread } from "../binder/model";
import { BINDER_POCKETS_PER_PAGE } from "../binder/model";
import { DESK_BINDER_AT, OPEN_BINDER_LIFT } from "./camera";

export const BINDER_PAGE_W = 1.02;
export const BINDER_PAGE_H = 1.22;
export const BINDER_SPINE_W = 0.15;
const V_ANGLE = 0.12;
const CARD_W = 0.24;
const CARD_H = 0.37;

export function NativeOpenBinder({
  spread,
  turningTo,
  turnDir,
  heldHoldingId,
  reducedMotion,
  paused,
  cover,
  paper,
  onHold,
  onTurnComplete,
  onTurnEdge,
}: {
  spread: NativeBinderSpread | undefined;
  turningTo: NativeBinderSpread | undefined;
  turnDir: 1 | -1 | 0;
  heldHoldingId?: string;
  reducedMotion: boolean;
  paused: boolean;
  cover: string;
  paper: string;
  onHold: (holding: NativeHolding | null) => void;
  onTurnComplete: () => void;
  onTurnEdge: (dir: 1 | -1) => void;
}) {
  const x = DESK_BINDER_AT.x;
  const y = DESK_BINDER_AT.y + OPEN_BINDER_LIFT.y;
  const z = DESK_BINDER_AT.z + OPEN_BINDER_LIFT.z;
  const left = turnDir === -1 && turningTo ? turningTo.left : spread?.left;
  const right = turnDir === 1 && turningTo ? turningTo.right : spread?.right;
  const leaf = turnDir === 1 ? spread?.right : turnDir === -1 ? spread?.left : undefined;
  const leafBack = turnDir === 1 ? turningTo?.left : turningTo?.right;

  return <group position={[x, y, z]} rotation={[-0.08, 0, 0]}>
    <mesh position={[0, 0, -0.06]}><boxGeometry args={[BINDER_SPINE_W, BINDER_PAGE_H + 0.08, 0.08]} /><meshStandardMaterial color={cover} roughness={0.55} /></mesh>
    {left ? <BinderLeaf page={left} side="left" heldHoldingId={heldHoldingId} paper={paper} cover={cover} onHold={onHold} onTurnEdge={() => onTurnEdge(-1)} /> : null}
    {right ? <BinderLeaf page={right} side="right" heldHoldingId={heldHoldingId} paper={paper} cover={cover} onHold={onHold} onTurnEdge={() => onTurnEdge(1)} /> : null}
    {leaf && turnDir !== 0 ? <TurningLeaf page={leaf} back={leafBack} dir={turnDir} reducedMotion={reducedMotion} paused={paused} paper={paper} cover={cover} heldHoldingId={heldHoldingId} onHold={onHold} onComplete={onTurnComplete} /> : null}
  </group>;
}

function BinderLeaf({
  page,
  side,
  heldHoldingId,
  paper,
  cover,
  onHold,
  onTurnEdge,
}: {
  page: NativeBinderPage;
  side: "left" | "right";
  heldHoldingId?: string;
  paper: string;
  cover: string;
  onHold: (holding: NativeHolding | null) => void;
  onTurnEdge: () => void;
}) {
  const x = side === "left" ? -(BINDER_PAGE_W + BINDER_SPINE_W) / 2 : (BINDER_PAGE_W + BINDER_SPINE_W) / 2;
  const angle = side === "left" ? V_ANGLE : -V_ANGLE;
  return <group position={[x, 0, 0]} rotation={[0, angle, 0]}>
    <mesh position={[side === "left" ? -0.04 : 0.04, 0, -0.025]} onClick={(event) => { event.stopPropagation(); onTurnEdge(); }}>
      <boxGeometry args={[BINDER_PAGE_W + 0.08, BINDER_PAGE_H + 0.1, 0.03]} />
      <meshStandardMaterial color={cover} roughness={0.6} />
    </mesh>
    <mesh position={[0, 0, 0.002]}>
      <planeGeometry args={[BINDER_PAGE_W, BINDER_PAGE_H]} />
      <meshStandardMaterial color={paper} roughness={0.82} side={DoubleSide} />
    </mesh>
    <PagePockets page={page} heldHoldingId={heldHoldingId} paper={paper} onHold={onHold} />
  </group>;
}

function TurningLeaf({
  page,
  back,
  dir,
  reducedMotion,
  paused,
  paper,
  cover,
  heldHoldingId,
  onHold,
  onComplete,
}: {
  page: NativeBinderPage;
  back?: NativeBinderPage;
  dir: 1 | -1;
  reducedMotion: boolean;
  paused: boolean;
  paper: string;
  cover: string;
  heldHoldingId?: string;
  onHold: (holding: NativeHolding | null) => void;
  onComplete: () => void;
}) {
  const group = useRef<{ rotation: { y: number } }>(null);
  const done = useRef(false);
  const originX = dir === 1 ? BINDER_SPINE_W / 2 : -BINDER_SPINE_W / 2;
  const start = dir === 1 ? -V_ANGLE : V_ANGLE;
  const end = dir === 1 ? -Math.PI + V_ANGLE : Math.PI - V_ANGLE;
  const [y, setY] = useState(start);
  useFrame((_, delta) => {
    if (paused || done.current) return;
    if (reducedMotion) {
      done.current = true;
      onComplete();
      return;
    }
    const next = y + (end - start) * Math.min(1, delta * 1.7);
    const clamped = dir === 1 ? Math.max(end, next) : Math.min(end, next);
    setY(clamped);
    if (Math.abs(clamped - end) < 0.02) {
      done.current = true;
      onComplete();
    }
  });
  return <group ref={group} position={[originX, 0, 0.04]} rotation={[0, y, 0]}>
    <group position={[dir === 1 ? BINDER_PAGE_W / 2 : -BINDER_PAGE_W / 2, 0, 0]}>
      <mesh position={[0, 0, -0.02]}><boxGeometry args={[BINDER_PAGE_W, BINDER_PAGE_H, 0.02]} /><meshStandardMaterial color={cover} roughness={0.62} /></mesh>
      <mesh position={[0, 0, 0.012]}><planeGeometry args={[BINDER_PAGE_W, BINDER_PAGE_H]} /><meshStandardMaterial color={paper} roughness={0.82} side={DoubleSide} /></mesh>
      <PagePockets page={page} heldHoldingId={heldHoldingId} paper={paper} onHold={onHold} />
      {back ? <group rotation={[0, Math.PI, 0]}><PagePockets page={back} paper={paper} onHold={onHold} /></group> : null}
    </group>
  </group>;
}

function PagePockets({
  page,
  heldHoldingId,
  paper,
  onHold,
}: {
  page: NativeBinderPage;
  heldHoldingId?: string;
  paper: string;
  onHold: (holding: NativeHolding | null) => void;
}) {
  return <>
    {page.pockets.slice(0, BINDER_POCKETS_PER_PAGE).map((pocket) => {
      const col = pocket.index % 3;
      const row = Math.floor((pocket.index % BINDER_POCKETS_PER_PAGE) / 3);
      const px = (col - 1) * 0.31;
      const py = (0.5 - row) * 0.46;
      const held = Boolean(pocket.holding && pocket.holding.id === heldHoldingId);
      return <group key={`${page.setId}-${pocket.index}`} position={[px, py, held ? 0.42 : 0.02]} scale={held ? 1.85 : 1}>
        <mesh>
          <planeGeometry args={[CARD_W + 0.02, CARD_H + 0.02]} />
          <meshStandardMaterial color="#d8cfc0" roughness={0.5} transparent opacity={0.55} />
        </mesh>
        {pocket.holding && !held ? <PocketCard holding={pocket.holding} paper={paper} onHold={onHold} /> : null}
        {pocket.holding && held ? <PocketCard holding={pocket.holding} paper={paper} lifted onHold={onHold} /> : null}
      </group>;
    })}
  </>;
}

function PocketCard({
  holding,
  paper,
  lifted,
  onHold,
}: {
  holding: NativeHolding;
  paper: string;
  lifted?: boolean;
  onHold: (holding: NativeHolding | null) => void;
}) {
  const [failed, setFailed] = useState(false);
  return <group onClick={(event) => { event.stopPropagation(); onHold(lifted ? null : holding); }}>
    <mesh>
      <boxGeometry args={[CARD_W, CARD_H, 0.012]} />
      <meshStandardMaterial color={paper} roughness={0.45} />
    </mesh>
    {holding.personalMediaUrl && !failed
      ? <CachedCardFace cacheKey={holding.id} url={holding.personalMediaUrl} onError={() => setFailed(true)} />
      : <mesh position={[0, 0, 0.008]}><planeGeometry args={[CARD_W * 0.92, CARD_H * 0.92]} /><meshStandardMaterial color="#e6c9d0" roughness={0.5} /></mesh>}
  </group>;
}

function CachedCardFace({ cacheKey, url, onError }: { cacheKey: string; url: string; onError: () => void }) {
  const localUri = useCachedSignedMedia(cacheKey, url);
  void onError;
  if (!localUri) return <mesh position={[0, 0, 0.008]}><planeGeometry args={[CARD_W * 0.92, CARD_H * 0.92]} /><meshStandardMaterial color="#e6c9d0" roughness={0.5} /></mesh>;
  return <Suspense fallback={<mesh position={[0, 0, 0.008]}><planeGeometry args={[CARD_W * 0.92, CARD_H * 0.92]} /><meshStandardMaterial color="#e6c9d0" roughness={0.5} /></mesh>}>
    <CardFace uri={localUri} />
  </Suspense>;
}

function CardFace({ uri }: { uri: string }) {
  const texture = useLoader(TextureLoader, uri);
  return <mesh position={[0, 0, 0.008]}>
    <planeGeometry args={[CARD_W * 0.92, CARD_H * 0.92]} />
    <meshBasicMaterial map={texture} toneMapped={false} />
  </mesh>;
}
