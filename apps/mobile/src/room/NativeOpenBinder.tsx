import { composeParentYaw } from "./roomWorldTransform";
/* eslint-disable react/no-unknown-property -- React Three Fiber JSX uses Three.js properties. */
import { Suspense, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber/native";
import { DoubleSide, Euler, Group, Quaternion, TextureLoader, Vector3 } from "three";
import type { NativeHolding } from "../api";
import { useCachedSignedMedia } from "../media/cachedMedia";
import type { NativeBinderPage, NativeBinderSpread } from "../binder/model";
import { BINDER_POCKETS_PER_PAGE } from "../binder/model";
import { cameraLerpAlpha, DESK_BINDER_AT } from "./camera";
import { prepCollectibleTexture } from "./roomMaterials";
import { liveDeskBinderYaw, liveDeskBinderWorld, type RoomObjectInstance } from "./roomObjects";
import {
  BINDER_CARD_H,
  BINDER_CARD_W,
  BINDER_PAGE_H as COMP_PAGE_H,
  BINDER_PAGE_W as COMP_PAGE_W,
  BINDER_SPINE_W as COMP_SPINE_W,
  BINDER_V_ANGLE,
  binderCardInspectionWorld,
  openBinderWorldAt,
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

export const BINDER_TRAVEL_RATE = 5.6;
export const BINDER_TRAVEL_RATE_REDUCED = 14;

export function NativeOpenBinder({
  open,
  spread,
  turningTo,
  turnDir,
  heldHoldingId,
  reducedMotion,
  paused,
  cover,
  paper,
  binderAt = DESK_BINDER_AT,
  objects = [],
  deskInstanceId,
  objectPreviewRef,
  onOpen,
  onHold,
  onTurnComplete,
  onTurnEdge,
}: {
  open: boolean;
  spread: NativeBinderSpread | undefined;
  turningTo: NativeBinderSpread | undefined;
  turnDir: 1 | -1 | 0;
  heldHoldingId?: string;
  reducedMotion: boolean;
  paused: boolean;
  cover: string;
  paper: string;
  binderAt?: { x: number; y: number; z: number };
  objects?: RoomObjectInstance[];
  deskInstanceId?: string | null;
  objectPreviewRef?: MutableRefObject<RoomObjectInstance | null>;
  onOpen?: () => void;
  onHold: (holding: NativeHolding | null) => void;
  onTurnComplete: () => void;
  onTurnEdge: (dir: 1 | -1) => void;
}) {
  const group = useRef<Group>(null);
  const closedRef = useRef<Group>(null);
  const readingRef = useRef<Group>(null);
  const leftRef = useRef<Group>(null);
  const rightRef = useRef<Group>(null);
  const progress = useRef(0);
  const [lastSpread, setLastSpread] = useState(spread);
  if (open && spread !== lastSpread) setLastSpread(spread);
  const visibleSpread = open ? spread : lastSpread;
  const left = turnDir === -1 && turningTo ? turningTo.left : visibleSpread?.left;
  const right = turnDir === 1 && turningTo ? turningTo.right : visibleSpread?.right;
  const leaf = turnDir === 1 ? spread?.right : turnDir === -1 ? spread?.left : undefined;
  const leafBack = turnDir === 1 ? turningTo?.left : turningTo?.right;
  const liveHeld = findHeldCard(spread, turningTo, heldHoldingId, binderAt);
  const [flight, setFlight] = useState<typeof liveHeld>(null);
  const [keepFlight, setKeepFlight] = useState(false);
  if (liveHeld && flight?.holding.id !== liveHeld.holding.id) setFlight(liveHeld);
  if (heldHoldingId && !keepFlight) setKeepFlight(true);
  const shown = liveHeld ?? (keepFlight ? flight : null);

  useFrame((_, delta) => {
    if (paused) return;
    const rate = reducedMotion ? BINDER_TRAVEL_RATE_REDUCED : BINDER_TRAVEL_RATE;
    progress.current = Math.max(0, Math.min(1, progress.current + (open ? 1 : -1) * delta * rate / 3));
    const ease = progress.current * progress.current * (3 - 2 * progress.current);
    const rest = liveDeskBinderWorld(objects, objectPreviewRef?.current, deskInstanceId) ?? binderAt;
    const lifted = openBinderWorldAt(rest);
    if (group.current) {
      group.current.visible = true;
      if (closedRef.current) closedRef.current.visible = ease < 0.06;
      if (readingRef.current) readingRef.current.visible = ease >= 0.06;
      group.current.position.set(
        rest.x + (lifted.x - rest.x) * ease,
        rest.y + (lifted.y - rest.y) * ease,
        rest.z + (lifted.z - rest.z) * ease,
      );
      const rotation = composeParentYaw({ x: -0.08 * ease, y: 0, z: 0 }, liveDeskBinderYaw(objects, objectPreviewRef?.current, deskInstanceId) * (1 - ease));
      group.current.rotation.set(rotation.x, rotation.y, rotation.z);
      group.current.scale.setScalar(0.62 + 0.38 * ease);
    }
    const spreadAmount = Math.max(0, Math.min(1, (ease - 0.28) / 0.72));
    if (leftRef.current) leftRef.current.rotation.y = 0.38 * (1 - spreadAmount) + V_ANGLE * spreadAmount;
    if (rightRef.current) rightRef.current.rotation.y = -0.38 * (1 - spreadAmount) - V_ANGLE * spreadAmount;
  });

  const rest = binderAt;
  const restRotation = composeParentYaw({ x: 0, y: 0, z: 0 }, liveDeskBinderYaw(objects, undefined, deskInstanceId));
  return <>
    <group
      ref={group}
      visible
      position={[rest.x, rest.y, rest.z]}
      rotation={[restRotation.x, restRotation.y, restRotation.z]}
      scale={0.62}
      onClick={(event) => {
        event.stopPropagation();
        if (!open) onOpen?.();
      }}
    >
      <group ref={closedRef} visible><StandingBinder cover={cover} paper={paper} /></group>
      <group ref={readingRef} visible={false}>
        <mesh position={[0, 0, -0.06]}><boxGeometry args={[BINDER_SPINE_W, BINDER_PAGE_H + 0.08, 0.08]} /><meshStandardMaterial color={cover} roughness={0.55} /></mesh>
        {left ? <BinderLeaf page={left} side="left" leafRef={leftRef} heldHoldingId={heldHoldingId} paper={paper} cover={cover} interactive={open} onHold={open ? onHold : () => onOpen?.()} onTurnEdge={() => onTurnEdge(-1)} /> : null}
        {right ? <BinderLeaf page={right} side="right" leafRef={rightRef} heldHoldingId={heldHoldingId} paper={paper} cover={cover} interactive={open} onHold={open ? onHold : () => onOpen?.()} onTurnEdge={() => onTurnEdge(1)} /> : null}
        {open && leaf && turnDir !== 0 ? <TurningLeaf page={leaf} back={leafBack} dir={turnDir} reducedMotion={reducedMotion} paused={paused} paper={paper} cover={cover} heldHoldingId={heldHoldingId} onHold={onHold} onComplete={onTurnComplete} /> : null}
      </group>
    </group>
    {open && shown ? <InspectedBinderCard
      holding={shown.holding}
      rest={shown.rest}
      binderAt={binderAt}
      active={Boolean(heldHoldingId)}
      reducedMotion={reducedMotion}
      paused={paused}
      paper={paper}
      onHold={onHold}
      onHome={() => setKeepFlight(false)}
    /> : null}
  </>;
}

/** Recognizable inactive portal: two covers, layered sheets, spine and three rings. */
export function StandingBinder({ cover, paper }: { cover: string; paper: string }) {
  return <group>
    <mesh position={[0,-0.635,0]}><boxGeometry args={[0.16,0.03,0.16]} /><meshStandardMaterial color={cover} roughness={0.6} /></mesh>
    <group position={[0,-0.62,0]} rotation={[-0.16,0,0]}>
      <mesh position={[0,0.62,0]}><boxGeometry args={[0.13,1.24,0.1]} /><meshStandardMaterial color={cover} roughness={0.62} /></mesh>
      {[-1,1].map(side=><group key={side} position={[side*0.065,0,0]} rotation={[0,side===-1?0.38:-0.38,0]}>
        <mesh position={[side*0.49,0.62,-0.035]}><boxGeometry args={[0.98,1.24,0.055]} /><meshStandardMaterial color={cover} roughness={0.64} /></mesh>
        {[0,1,2,3].map(sheet=><mesh key={sheet} position={[side*0.48,0.62,0.004+sheet*0.013]}><boxGeometry args={[0.92-sheet*0.008,1.16,0.009]} /><meshStandardMaterial color={paper} roughness={0.88} /></mesh>)}
        <mesh position={[side*0.48,0.62,0.055]}><boxGeometry args={[0.82,1.05,0.004]} /><meshStandardMaterial color={paper} roughness={0.9} /></mesh>
      </group>)}
      {[0.24,0.62,1].map(y=><mesh key={y} position={[0,y,0.075]} rotation={[0,Math.PI/2,0]}><torusGeometry args={[0.055,0.009,5,10]} /><meshStandardMaterial color="#b5b0a6" metalness={0.65} roughness={0.32} /></mesh>)}
    </group>
  </group>;
}

function BinderLeaf({
  page,
  side,
  leafRef,
  heldHoldingId,
  paper,
  cover,
  interactive,
  onHold,
  onTurnEdge,
}: {
  page: NativeBinderPage;
  side: "left" | "right";
  leafRef: MutableRefObject<Group | null>;
  heldHoldingId?: string;
  paper: string;
  cover: string;
  interactive: boolean;
  onHold: (holding: NativeHolding | null) => void;
  onTurnEdge: () => void;
}) {
  const x = pageLocalX(side);
  const angle = side === "left" ? V_ANGLE : -V_ANGLE;
  return <group ref={leafRef} position={[side === "left" ? -BINDER_SPINE_W / 2 : BINDER_SPINE_W / 2, 0, 0]} rotation={[0, angle, 0]}>
    <group position={[x - (side === "left" ? -BINDER_SPINE_W / 2 : BINDER_SPINE_W / 2), 0, 0]}>
    <mesh position={[side === "left" ? -0.04 : 0.04, 0, -0.025]} onClick={(event) => { if (interactive) { event.stopPropagation(); onTurnEdge(); } }}>
      <boxGeometry args={[BINDER_PAGE_W + 0.08, BINDER_PAGE_H + 0.1, 0.03]} />
      <meshStandardMaterial color={cover} roughness={0.6} />
    </mesh>
    <mesh position={[0, 0, 0.002]}>
      <planeGeometry args={[BINDER_PAGE_W, BINDER_PAGE_H]} />
      <meshStandardMaterial color={paper} roughness={0.82} side={DoubleSide} />
    </mesh>
    <PagePockets page={page} heldHoldingId={heldHoldingId} paper={paper} onHold={onHold} />
    </group>
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
  const y = useRef(start);
  useFrame((_, delta) => {
    if (paused || done.current) return;
    if (reducedMotion) {
      done.current = true;
      onComplete();
      return;
    }
    const next = y.current + (end - start) * Math.min(1, delta * 1.7);
    const clamped = dir === 1 ? Math.max(end, next) : Math.min(end, next);
    y.current = clamped;
    if (group.current) group.current.rotation.y = clamped;
    if (Math.abs(clamped - end) < 0.02) {
      done.current = true;
      onComplete();
    }
  });
  return <group ref={group} position={[originX, 0, 0.04]} rotation={[0, start, 0]}>
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
  binderAt,
  active,
  reducedMotion,
  paused,
  paper,
  onHold,
  onHome,
}: {
  holding: NativeHolding;
  rest: { x: number; y: number; z: number };
  binderAt: { x: number; y: number; z: number };
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
    const presented = binderCardInspectionWorld(aspect, binderAt);
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
  const map = useMemo(() => prepCollectibleTexture(texture), [texture]);
  void onError;
  return <mesh position={[0, 0, 0.008]}>
    <planeGeometry args={[CARD_W * 0.92, CARD_H * 0.92]} />
    <meshBasicMaterial map={map} toneMapped={false} />
  </mesh>;
}

function findHeldCard(
  spread: NativeBinderSpread | undefined,
  turningTo: NativeBinderSpread | undefined,
  heldHoldingId?: string,
  binderAt: { x: number; y: number; z: number } = DESK_BINDER_AT,
) {
  if (!heldHoldingId) return null;
  for (const page of [spread?.left, spread?.right, turningTo?.left, turningTo?.right]) {
    if (!page) continue;
    const pocket = page.pockets.find((entry) => entry.holding?.id === heldHoldingId);
    if (!pocket?.holding) continue;
    const side = page === spread?.left || page === turningTo?.left ? "left" : "right";
    return { holding: pocket.holding, rest: pocketWorldPosition(side, pocket.index % BINDER_POCKETS_PER_PAGE, binderAt) };
  }
  return null;
}
