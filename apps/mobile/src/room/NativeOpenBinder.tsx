/* eslint-disable react/no-unknown-property -- React Three Fiber JSX uses Three.js properties. */
import { Suspense, useMemo, useRef, useState } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber/native";
import { DoubleSide, Euler, Group, Quaternion, TextureLoader, Vector3 } from "three";
import type { NativeHolding } from "../api";
import { useCachedSignedMedia } from "../media/cachedMedia";
import type { NativeBinderPage, NativeBinderSpread } from "../binder/model";
import { BINDER_POCKETS_PER_PAGE } from "../binder/model";
import { cameraLerpAlpha, DESK_BINDER_AT, OPEN_BINDER_LIFT } from "./camera";
import {
  BINDER_CARD_H,
  BINDER_CARD_W,
  BINDER_PAGE_H as COMP_PAGE_H,
  BINDER_PAGE_W as COMP_PAGE_W,
  BINDER_SPINE_W as COMP_SPINE_W,
  BINDER_V_ANGLE,
  binderCardInspectionWorld,
  pageLocalX,
  pocketLocalPosition,
  pocketWorldPosition,
} from "./composition";

export const BINDER_PAGE_W = COMP_PAGE_W;
export const BINDER_PAGE_H = COMP_PAGE_H;
export const BINDER_SPINE_W = COMP_SPINE_W;
const V_ANGLE = BINDER_V_ANGLE;
const CARD_W = BINDER_CARD_W;
const CARD_H = BINDER_CARD_H;

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
  const liveHeld = findHeldCard(spread, turningTo, heldHoldingId);
  const [flight, setFlight] = useState<typeof liveHeld>(null);
  const [keepFlight, setKeepFlight] = useState(false);
  if (liveHeld && flight?.holding.id !== liveHeld.holding.id) setFlight(liveHeld);
  if (heldHoldingId && !keepFlight) setKeepFlight(true);
  const shown = liveHeld ?? (keepFlight ? flight : null);

  return <>
    <group position={[x, y, z]} rotation={[-0.08, 0, 0]}>
      <mesh position={[0, 0, -0.06]}><boxGeometry args={[BINDER_SPINE_W, BINDER_PAGE_H + 0.08, 0.08]} /><meshStandardMaterial color={cover} roughness={0.55} /></mesh>
      {left ? <BinderLeaf page={left} side="left" heldHoldingId={heldHoldingId} paper={paper} cover={cover} onHold={onHold} onTurnEdge={() => onTurnEdge(-1)} /> : null}
      {right ? <BinderLeaf page={right} side="right" heldHoldingId={heldHoldingId} paper={paper} cover={cover} onHold={onHold} onTurnEdge={() => onTurnEdge(1)} /> : null}
      {leaf && turnDir !== 0 ? <TurningLeaf page={leaf} back={leafBack} dir={turnDir} reducedMotion={reducedMotion} paused={paused} paper={paper} cover={cover} heldHoldingId={heldHoldingId} onHold={onHold} onComplete={onTurnComplete} /> : null}
    </group>
    {shown ? <InspectedBinderCard
      holding={shown.holding}
      rest={shown.rest}
      active={Boolean(heldHoldingId)}
      reducedMotion={reducedMotion}
      paused={paused}
      paper={paper}
      onHold={onHold}
      onHome={() => setKeepFlight(false)}
    /> : null}
  </>;
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
  const x = pageLocalX(side);
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
      const local = pocketLocalPosition(pocket.index % BINDER_POCKETS_PER_PAGE);
      const held = Boolean(pocket.holding && pocket.holding.id === heldHoldingId);
      return <group key={`${page.setId}-${pocket.index}`} position={[local.x, local.y, local.z]}>
        <mesh position={[0, 0, -0.006]}>
          <boxGeometry args={[CARD_W + 0.03, CARD_H + 0.03, 0.01]} />
          <meshStandardMaterial color="#c8b8a8" roughness={0.62} />
        </mesh>
        <mesh>
          <planeGeometry args={[CARD_W + 0.02, CARD_H + 0.02]} />
          <meshStandardMaterial color="#d8cfc0" roughness={0.5} transparent opacity={held ? 0.18 : 0.42} />
        </mesh>
        {pocket.holding && !held ? <PocketCard holding={pocket.holding} paper={paper} onHold={onHold} /> : null}
      </group>;
    })}
  </>;
}

function InspectedBinderCard({
  holding,
  rest,
  active,
  reducedMotion,
  paused,
  paper,
  onHold,
  onHome,
}: {
  holding: NativeHolding;
  rest: { x: number; y: number; z: number };
  active: boolean;
  reducedMotion: boolean;
  paused: boolean;
  paper: string;
  onHold: (holding: NativeHolding | null) => void;
  onHome: () => void;
}) {
  const group = useRef<Group>(null);
  const { size } = useThree();
  const targetPos = useMemo(() => new Vector3(rest.x, rest.y, rest.z), [rest.x, rest.y, rest.z]);
  const targetQuat = useMemo(() => new Quaternion(), []);
  const targetEuler = useMemo(() => new Euler(), []);
  const seeded = useRef(false);
  useFrame((_, delta) => {
    const mesh = group.current;
    if (!mesh || paused) return;
    if (!seeded.current) {
      mesh.position.set(rest.x, rest.y, rest.z);
      seeded.current = true;
    }
    const aspect = size.width / Math.max(1, size.height);
    const presented = binderCardInspectionWorld(aspect);
    const dest = active ? presented.position : rest;
    const destRot = active ? presented.rotation : { x: 0, y: 0, z: 0 };
    const destScale = active ? presented.scale : 1;
    targetPos.set(dest.x, dest.y, dest.z);
    targetEuler.set(destRot.x, destRot.y, destRot.z);
    targetQuat.setFromEuler(targetEuler);
    const alpha = cameraLerpAlpha(delta, reducedMotion);
    mesh.position.lerp(targetPos, alpha);
    mesh.quaternion.slerp(targetQuat, alpha);
    mesh.scale.setScalar(mesh.scale.x + (destScale - mesh.scale.x) * alpha);
    if (!active && mesh.position.distanceTo(targetPos) < 0.03) onHome();
  });
  return <group
    ref={group}
    position={[rest.x, rest.y, rest.z]}
    onClick={(event) => { event.stopPropagation(); onHold(null); }}
  >
    <PocketCard holding={holding} paper={paper} lifted onHold={onHold} />
  </group>;
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
  const imageUrl = !failed ? (holding.personalMediaUrl ?? holding.template.imageUrl) : undefined;
  return <group onClick={(event) => { event.stopPropagation(); onHold(lifted ? null : holding); }}>
    <mesh>
      <boxGeometry args={[CARD_W, CARD_H, 0.012]} />
      <meshStandardMaterial color={paper} roughness={0.45} />
    </mesh>
    {imageUrl
      ? <CachedCardFace cacheKey={holding.id} url={imageUrl} onError={() => setFailed(true)} />
      : <mesh position={[0, 0, 0.008]}><planeGeometry args={[CARD_W * 0.92, CARD_H * 0.92]} /><meshStandardMaterial color="#e6c9d0" roughness={0.5} /></mesh>}
  </group>;
}

function CachedCardFace({ cacheKey, url, onError }: { cacheKey: string; url: string; onError: () => void }) {
  const localUri = useCachedSignedMedia(cacheKey, url);
  if (!localUri) return <mesh position={[0, 0, 0.008]}><planeGeometry args={[CARD_W * 0.92, CARD_H * 0.92]} /><meshStandardMaterial color="#e6c9d0" roughness={0.5} /></mesh>;
  return <Suspense fallback={<mesh position={[0, 0, 0.008]}><planeGeometry args={[CARD_W * 0.92, CARD_H * 0.92]} /><meshStandardMaterial color="#e6c9d0" roughness={0.5} /></mesh>}>
    <CardFace uri={localUri} onError={onError} />
  </Suspense>;
}

function CardFace({ uri, onError }: { uri: string; onError: () => void }) {
  const texture = useLoader(TextureLoader, uri);
  void onError;
  return <mesh position={[0, 0, 0.008]}>
    <planeGeometry args={[CARD_W * 0.92, CARD_H * 0.92]} />
    <meshBasicMaterial map={texture} toneMapped={false} />
  </mesh>;
}

function findHeldCard(
  spread: NativeBinderSpread | undefined,
  turningTo: NativeBinderSpread | undefined,
  heldHoldingId?: string,
) {
  if (!heldHoldingId) return null;
  for (const page of [spread?.left, spread?.right, turningTo?.left, turningTo?.right]) {
    if (!page) continue;
    const pocket = page.pockets.find((entry) => entry.holding?.id === heldHoldingId);
    if (!pocket?.holding) continue;
    const side = page === spread?.left || page === turningTo?.left ? "left" : "right";
    return { holding: pocket.holding, rest: pocketWorldPosition(side, pocket.index % BINDER_POCKETS_PER_PAGE) };
  }
  return null;
}
