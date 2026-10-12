import { BinderOwnerLabel } from "./BinderOwnerLabel";
import { BINDER_DISPLAY_TILT, BINDER_DISPLAY_CENTER_Y, BINDER_CLOSED_CENTER_Z, binderTravel } from "./binderPresentation";
import { composeParentYaw } from "./roomWorldTransform";
/* eslint-disable react/no-unknown-property -- React Three Fiber JSX uses Three.js properties. */
import { Component, Suspense, createContext, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber/native";
import { DoubleSide, Euler, Group, Quaternion, TextureLoader, Vector3 } from "three";
import type { NativeHolding } from "../api";
import { useCachedSignedMedia } from "../media/cachedMedia";
import type { NativeBinderPage, NativeBinderSpread } from "../binder/model";
import { BINDER_POCKETS_PER_PAGE } from "../binder/model";
import { cameraLerpAlpha, DESK_BINDER_AT } from "./camera";
import { nativeCardTexture } from "../media/nativeCardTexture";
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
} from "./composition";

const BinderCardMotion = createContext({ heldHoldingId: undefined as string | undefined, reducedMotion: false, paused: false, turning: false, binderAt: DESK_BINDER_AT, onMediaError: undefined as (() => void) | undefined });

export const BINDER_PAGE_W = COMP_PAGE_W;
export const BINDER_PAGE_H = COMP_PAGE_H;
export const BINDER_SPINE_W = COMP_SPINE_W;
const V_ANGLE = BINDER_V_ANGLE;
const CARD_W = BINDER_CARD_W;
const CARD_H = BINDER_CARD_H;

export const BINDER_TRAVEL_RATE = 4.3;
export const BINDER_TRAVEL_RATE_REDUCED = 14;

export function NativeOpenBinder({
  ownerName = "",
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
  motionRef,
  motionResetRef,
  onOpen,
  onHold,
  onTurnComplete,
  onTurnCancel,
  onTurnEdge,
  onMediaError,
}: {
  ownerName?: string;
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
  motionRef?: MutableRefObject<number>;
  motionResetRef?: MutableRefObject<number>;
  onOpen?: () => void;
  onHold: (holding: NativeHolding | null) => void;
  onTurnComplete: () => void;
  onTurnCancel?: () => void;
  onTurnEdge: (dir: 1 | -1) => void;
  onMediaError?: () => void;
}) {
  const group = useRef<Group>(null);
  const stand = useRef<Group>(null);

  const bodyRef = useRef<Group>(null);
  const wasOpen = useRef(false);
  const resetSeen = useRef(0);
  const origin = useRef({position:new Vector3(),quaternion:new Quaternion(),scale:0.62});
  const restQuaternion = useMemo(()=>new Quaternion(),[]);
  const openQuaternion = useMemo(()=>new Quaternion().setFromEuler(new Euler(-0.08,0,0)),[]);
  const leftRef = useRef<Group>(null);
  const rightRef = useRef<Group>(null);
  const progress = useRef(0);
  const [lastSpread, setLastSpread] = useState(spread);
  if (open && spread !== lastSpread) setLastSpread(spread);
  const visibleSpread = open ? spread : lastSpread;
  const [preparedTurn, setPreparedTurn] = useState<string | null>(null);
  const turnKey = turningTo && turnDir !== 0 ? `${turnDir}:${turningTo.index}:${[...turningTo.left.pockets, ...turningTo.right.pockets].map(p => `${p.holding?.id ?? ""}:${p.holding?.personalMediaUrl ?? p.holding?.template.imageUrl ?? ""}`).join("|")}` : null;
  const readyToTurn = Boolean(turnKey && preparedTurn === turnKey);
  const left = readyToTurn && turnDir === -1 && turningTo ? turningTo.left : visibleSpread?.left;
  const right = readyToTurn && turnDir === 1 && turningTo ? turningTo.right : visibleSpread?.right;
  const leaf = turnDir === 1 ? spread?.right : turnDir === -1 ? spread?.left : undefined;
  const leafBack = turnDir === 1 ? turningTo?.left : turningTo?.right;

  useFrame((_, delta) => {
    if (paused) return;
    const rate = reducedMotion ? BINDER_TRAVEL_RATE_REDUCED : BINDER_TRAVEL_RATE;
    const rest = liveDeskBinderWorld(objects, objectPreviewRef?.current, deskInstanceId) ?? binderAt;
    const yaw=liveDeskBinderYaw(objects,objectPreviewRef?.current,deskInstanceId)*Math.PI/180;
    restQuaternion.setFromEuler(new Euler(0,yaw,0)).multiply(new Quaternion().setFromEuler(new Euler(BINDER_DISPLAY_TILT-Math.PI/2,0,0))).multiply(new Quaternion().setFromEuler(new Euler(0,-Math.PI/2,0)));
    if (stand.current) {
      stand.current.position.set(rest.x,rest.y,rest.z);
      stand.current.rotation.y=liveDeskBinderYaw(objects,objectPreviewRef?.current,deskInstanceId)*Math.PI/180;
    }
    if(motionResetRef && resetSeen.current!==motionResetRef.current) {
      resetSeen.current=motionResetRef.current;
      progress.current=0;wasOpen.current=false;
      if(group.current){group.current.position.set(rest.x,rest.y+BINDER_DISPLAY_CENTER_Y*0.62,rest.z);group.current.quaternion.copy(restQuaternion);group.current.scale.setScalar(0.62);}
    }
    // Capture the actual rendered pose, including arbitrary Desk yaw, before advancing.
    const starting=open && !wasOpen.current;
    if(starting && group.current) {
      origin.current.position.copy(group.current.position);
      origin.current.quaternion.copy(group.current.quaternion);
      origin.current.scale=group.current.scale.x;
    }
    wasOpen.current=open;
    if(!starting) progress.current = Math.max(0, Math.min(1, progress.current + (open ? 1 : -1) * delta * rate / 3));
    const travel = binderTravel(progress.current, reducedMotion);
    const ease = travel.ease;
    if(motionRef) motionRef.current=travel.camera;
    const lifted = openBinderWorldAt(rest);
    if (group.current) {
      group.current.visible = true;
      if(progress.current===0 && !open) {
        group.current.position.set(rest.x,rest.y+BINDER_DISPLAY_CENTER_Y*0.62,rest.z);
        group.current.quaternion.copy(restQuaternion);
        group.current.scale.setScalar(0.62);
      } else {
        group.current.position.copy(origin.current.position).lerp(new Vector3(lifted.x,lifted.y,lifted.z),ease);
        group.current.position.y+=travel.lift;
        // Move away from the rear support before major reorientation (Desk-local forward).
        group.current.position.x+=Math.sin(yaw)*0.16*Math.sin(Math.PI*progress.current)**2;
        group.current.position.z+=Math.cos(yaw)*0.16*Math.sin(Math.PI*progress.current)**2;
        group.current.quaternion.copy(origin.current.quaternion).slerp(openQuaternion,travel.orientation);
        group.current.scale.setScalar(origin.current.scale+(1-origin.current.scale)*ease);
      }
    }
    if(bodyRef.current) bodyRef.current.position.z=-BINDER_CLOSED_CENTER_Z*(1-ease);
    const spreadAmount=travel.spread;
    if (leftRef.current) leftRef.current.rotation.y = Math.PI / 2 * (1 - spreadAmount) + V_ANGLE * spreadAmount;
    if (rightRef.current) rightRef.current.rotation.y = -Math.PI / 2 * (1 - spreadAmount) - V_ANGLE * spreadAmount;
  });

  const rest = binderAt;
  const restRotation = composeParentYaw({ x: 0, y: 0, z: 0 }, liveDeskBinderYaw(objects, undefined, deskInstanceId));
  const [initialQuaternion]=useState(()=>new Quaternion().setFromEuler(new Euler(0,restRotation.y,0))
    .multiply(new Quaternion().setFromEuler(new Euler(BINDER_DISPLAY_TILT-Math.PI/2,0,0)))
    .multiply(new Quaternion().setFromEuler(new Euler(0,-Math.PI/2,0))));
  const [initialPosition]=useState<[number,number,number]>(()=>[rest.x,rest.y+BINDER_DISPLAY_CENTER_Y*0.62,rest.z]);
  return <BinderCardMotion.Provider value={{ heldHoldingId, reducedMotion, paused, turning: turnDir !== 0, binderAt, onMediaError }}>
    <group ref={stand} position={[rest.x,rest.y,rest.z]} rotation={[0,restRotation.y,0]} scale={0.62}><BinderDisplayStand /></group>
    <group ref={group} position={initialPosition} quaternion={initialQuaternion} scale={0.62}
      onClick={(event)=>{event.stopPropagation();if (!open && progress.current===0) onOpen?.();}}>
      <group ref={bodyRef} position={[0,0,-BINDER_CLOSED_CENTER_Z]}>
        <DisplayBinder cover={cover} paper={paper} ownerName={ownerName} left={left} right={right} leftRef={leftRef} rightRef={rightRef}
          heldHoldingId={heldHoldingId} interactive={open && turnDir === 0} onHold={onHold} onTurnEdge={onTurnEdge} />
        {open && turningTo && turnKey ? <TurnPreparation key={turnKey} spread={turningTo} onReady={() => setPreparedTurn(turnKey)} onError={() => { onMediaError?.(); onTurnCancel?.(); }} /> : null}
        {open && readyToTurn && leaf && turnDir !== 0 ? <TurningLeaf page={leaf} back={leafBack} dir={turnDir} reducedMotion={reducedMotion} paused={paused} paper={paper} cover={cover} heldHoldingId={heldHoldingId} onHold={onHold} onComplete={onTurnComplete} /> : null}
      </group>
    </group>
  </BinderCardMotion.Provider>;
}

/** Small permanent support; never participates in object picking. */
export function BinderDisplayStand() {
  return <group>
    {[-0.38,0.38].map(x=><mesh key={x} raycast={()=>{}} position={[x,-0.635,0]}><boxGeometry args={[0.035,0.03,0.65]} /><meshStandardMaterial color="#8f9295" metalness={0.7} roughness={0.42} /></mesh>)}
    {[-0.38,0.38].map(x=><mesh key={x} raycast={()=>{}} position={[x,-0.015,-0.11]} rotation={[BINDER_DISPLAY_TILT-Math.PI/2,0,0]}><boxGeometry args={[0.025,1.28,0.025]} /><meshStandardMaterial color="#8f9295" metalness={0.7} roughness={0.42} /></mesh>)}
    {[-0.38,0.38].map(x=><mesh key={x} raycast={()=>{}} position={[x,-0.14,-0.27]} rotation={[0.08,0,0]}><boxGeometry args={[0.025,1.0,0.025]} /><meshStandardMaterial color="#8f9295" metalness={0.7} roughness={0.42} /></mesh>)}
    <mesh raycast={()=>{}} position={[0,-0.64,0.235]}><boxGeometry args={[0.82,0.02,0.14]} /><meshStandardMaterial color="#8f9295" metalness={0.7} roughness={0.42} /></mesh>
    <mesh raycast={()=>{}} position={[0,-0.61,0.305]}><boxGeometry args={[0.82,0.06,0.02]} /><meshStandardMaterial color="#8f9295" metalness={0.7} roughness={0.42} /></mesh>
  </group>;
}
/** The same hinged covers/pages remain mounted from closed rest through reading. */
export function DisplayBinder({cover,paper,ownerName="",left,right,leftRef,rightRef,heldHoldingId,interactive=false,onHold=()=>{},onTurnEdge=()=>{}}:{
 cover:string;paper:string;ownerName?:string;left?:NativeBinderPage;right?:NativeBinderPage;
 leftRef?:MutableRefObject<Group|null>;rightRef?:MutableRefObject<Group|null>;heldHoldingId?:string;interactive?:boolean;
 onHold?:(holding:NativeHolding|null)=>void;onTurnEdge?:(dir:1|-1)=>void;
}) {
 return <group>
  <mesh position={[0,0,-0.06]}><boxGeometry args={[BINDER_SPINE_W,BINDER_PAGE_H+0.08,0.08]} /><meshStandardMaterial color={cover} roughness={0.55} /></mesh>
  {[-0.35,0,0.35].map(y=><mesh key={y} position={[0,y,0.025]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[0.055,0.009,5,10]} /><meshStandardMaterial color="#aeb2b6" metalness={0.7} roughness={0.35} /></mesh>)}
  <BinderLeaf page={left} side="left" leafRef={leftRef} heldHoldingId={heldHoldingId} paper={paper} cover={cover} interactive={interactive} onHold={onHold} onTurnEdge={()=>onTurnEdge(-1)} />
  <BinderLeaf page={right} side="right" leafRef={rightRef} heldHoldingId={heldHoldingId} paper={paper} cover={cover} ownerName={ownerName} interactive={interactive} onHold={onHold} onTurnEdge={()=>onTurnEdge(1)} />
 </group>;
}

function BinderLeaf({
  page,
  ownerName,
  side,
  leafRef,
  heldHoldingId,
  paper,
  cover,
  interactive,
  onHold,
  onTurnEdge,
}: {
  page?: NativeBinderPage;
  ownerName?: string;
  side: "left" | "right";
  leafRef?: MutableRefObject<Group | null>;
  heldHoldingId?: string;
  paper: string;
  cover: string;
  interactive: boolean;
  onHold: (holding: NativeHolding | null) => void;
  onTurnEdge: () => void;
}) {
  const x = pageLocalX(side);
  const angle = side === "left" ? Math.PI/2 : -Math.PI/2;
  return <group ref={leafRef} onClick={(event) => {
    event.stopPropagation();
    if (interactive && !heldHoldingId && event.delta <= 10) onTurnEdge();
  }} position={[side === "left" ? -BINDER_SPINE_W / 2 : BINDER_SPINE_W / 2, 0, 0]} rotation={[0, angle, 0]}>
    <group position={[x - (side === "left" ? -BINDER_SPINE_W / 2 : BINDER_SPINE_W / 2), 0, 0]}>
    <mesh position={[side === "left" ? -0.04 : 0.04, 0, -0.025]}>
      <boxGeometry args={[BINDER_PAGE_W + 0.08, BINDER_PAGE_H + 0.1, 0.03]} />
      <meshStandardMaterial color={cover} roughness={0.6} />
    </mesh>
    <mesh position={[0, 0, 0.002]} onClick={(event) => {
      event.stopPropagation();
      if (interactive && !heldHoldingId && event.delta <= 10) onTurnEdge();
    }}>
      <planeGeometry args={[BINDER_PAGE_W, BINDER_PAGE_H]} />
      <meshStandardMaterial color={paper} roughness={0.82} side={DoubleSide} />
    </mesh>
    {/* Decorative thickness is slightly ahead of the paper; only paper owns blank-area picking. */}
    <mesh raycast={() => {}} position={[0,0,-0.008]}><boxGeometry args={[BINDER_PAGE_W,BINDER_PAGE_H,0.025]} /><meshStandardMaterial color={paper} roughness={0.88} /></mesh>
    {side === "right" ? <BinderOwnerLabel ownerName={ownerName ?? ""} cover={cover} /> : null}
    {page ? <PagePockets page={page} heldHoldingId={heldHoldingId} paper={paper} onHold={onHold} /> : null}
    </group>
  </group>;
}

/** Resolve destination photos before moving paper; no visible placeholder handoff. */
function TurnPreparation({ spread, onReady, onError }: { spread: NativeBinderSpread; onReady: () => void; onError: () => void }) {
  const cards = [...spread.left.pockets, ...spread.right.pockets].flatMap(p => {
    const h = p.holding;
    const url = h?.personalMediaUrl ?? h?.template.imageUrl;
    return h && url ? [{ id: h.id, url }] : [];
  });
  const [ready, setReady] = useState<Set<string>>(() => new Set());
  const done = cards.every(card => ready.has(card.id));
  useEffect(() => { if (done) onReady(); }, [done, onReady]);
  return <>{cards.map(card => <PreparedCard key={card.id} id={card.id} url={card.url} onError={onError} onReady={() => setReady(prior => prior.has(card.id) ? prior : new Set([...prior, card.id]))} />)}</>;
}
function PreparedCard({ id, url, onReady, onError }: { id: string; url: string; onReady: () => void; onError: () => void }) {
  const uri = useCachedSignedMedia(id, url, onError);
  return uri ? <CardImageBoundary key={uri} onError={onError}><Suspense fallback={null}><PreparedTexture uri={uri} onReady={onReady} /></Suspense></CardImageBoundary> : null;
}
function PreparedTexture({ uri, onReady }: { uri: string; onReady: () => void }) {
  useLoader(TextureLoader, uri);
  useEffect(() => { onReady(); }, [onReady]);
  return null;
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
        {pocket.holding ? <PocketCard holding={pocket.holding} paper={paper} onHold={onHold} /> : null}
      </group>;
    })}
  </>;
}

function PocketCard({
  holding,
  paper,
  onHold,
}: {
  holding: NativeHolding;
  paper: string;
  onHold: (holding: NativeHolding | null) => void;
}) {
  const [textureReady, setTextureReady] = useState(false);
  const group = useRef<Group>(null);
  const motion = useContext(BinderCardMotion);
  const { size } = useThree();
  const active = motion.heldHoldingId === holding.id;
  const returning = useRef(false);
  const returned = useRef(false);
  const targetPosition = useMemo(() => new Vector3(), []);
  const targetQuaternion = useMemo(() => new Quaternion(), []);
  const parentQuaternion = useMemo(() => new Quaternion(), []);
  const parentScale = useMemo(() => new Vector3(), []);
  useFrame((_, delta) => {
    const card = group.current;
    if (!card || !card.parent || motion.paused) return;
    if (!active) { returning.current = false; returned.current = false; }
    let scale = 1;
    targetPosition.set(0, 0, 0);
    targetQuaternion.identity();
    if (active && !returning.current) {
      const presented = binderCardInspectionWorld(size.width / Math.max(1, size.height), motion.binderAt);
      card.parent.updateWorldMatrix(true, false);
      targetPosition.set(presented.position.x, presented.position.y, presented.position.z);
      card.parent.worldToLocal(targetPosition);
      card.parent.getWorldQuaternion(parentQuaternion);
      targetQuaternion.setFromEuler(new Euler(presented.rotation.x, presented.rotation.y, presented.rotation.z));
      targetQuaternion.premultiply(parentQuaternion.invert());
      card.parent.getWorldScale(parentScale);
      scale = presented.scale / parentScale.x;
    }
    const alpha = motion.reducedMotion ? 1 : cameraLerpAlpha(delta, false);
    card.position.lerp(targetPosition, alpha);
    card.quaternion.slerp(targetQuaternion, alpha);
    card.scale.setScalar(card.scale.x + (scale - card.scale.x) * alpha);
    if ((!active || returning.current) && card.position.length() < 0.0001 && card.quaternion.angleTo(targetQuaternion) < 0.0001 && Math.abs(card.scale.x - 1) < 0.0001) {
      card.position.set(0, 0, 0); card.quaternion.identity(); card.scale.setScalar(1);
      if (active && !returned.current) { returned.current = true; onHold(null); }
    }
  });
  const imageUrl = holding.personalMediaUrl ?? holding.template.imageUrl;
  return <group ref={group} onClick={(event) => { event.stopPropagation(); if (motion.turning) return; if (active) returning.current = true; else if (!motion.heldHoldingId && (!imageUrl || textureReady)) onHold(holding); }}>
    <mesh>
      <boxGeometry args={[CARD_W, CARD_H, 0.012]} />
      <meshStandardMaterial color={paper} roughness={0.45} />
    </mesh>
    {imageUrl
      ? <CachedCardFace cacheKey={holding.id} url={imageUrl} onError={() => motion.onMediaError?.()} onReady={() => setTextureReady(true)} />
      : <mesh position={[0, 0, 0.008]}><planeGeometry args={[CARD_W, CARD_H]} /><meshStandardMaterial color="#e6c9d0" roughness={0.5} /></mesh>}
  </group>;
}

function CachedCardFace({ cacheKey, url, onError, onReady }: { cacheKey: string; url: string; onError: () => void; onReady: () => void }) {
  const localUri = useCachedSignedMedia(cacheKey, url, onError);
  if (!localUri) return <mesh position={[0, 0, 0.008]}><planeGeometry args={[CARD_W, CARD_H]} /><meshStandardMaterial color="#e6c9d0" roughness={0.5} /></mesh>;
  return <CardImageBoundary key={localUri} onError={onError}><Suspense fallback={<mesh position={[0, 0, 0.008]}><planeGeometry args={[CARD_W, CARD_H]} /><meshStandardMaterial color="#e6c9d0" roughness={0.5} /></mesh>}>
    <CardFace uri={localUri} onError={onError} onReady={onReady} />
  </Suspense></CardImageBoundary>;
}

class CardImageBoundary extends Component<{ children: React.ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function CardFace({ uri, onError, onReady }: { uri: string; onError: () => void; onReady: () => void }) {
  const texture = useLoader(TextureLoader, uri);
  const map = useMemo(() => nativeCardTexture(texture), [texture]);
  useEffect(() => { onReady(); }, [map, onReady]);
  useEffect(() => () => map.dispose(), [map]);
  void onError;
  return <mesh position={[0, 0, 0.008]}>
    <planeGeometry args={[CARD_W, CARD_H]} />
    <meshBasicMaterial map={map} toneMapped={false} />
  </mesh>;
}
