/* eslint-disable react/no-unknown-property -- React Three Fiber JSX uses Three.js properties. */
import "./threeFiberCompat";
import { Suspense, useMemo, useRef, type MutableRefObject } from "react";
import { StyleSheet } from "react-native";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber/native";
import { Color, Euler, Group, MeshBasicMaterial, Quaternion, TextureLoader, Vector3 } from "three";
import type { NativeBinderSpread } from "../binder/model";
import type { NativeHolding } from "../api";
import { useCachedSignedMedia } from "../media/cachedMedia";
import { applyExploreOffset, cameraLerpAlpha, exploreAllowedForView, IDENTITY_EXPLORE, poseForView, type ExploreOffset } from "./camera";
import { binderCameraForViewport, inspectionPresentation } from "./composition";
import { NativeOpenBinder } from "./NativeOpenBinder";
import { extentsForGeometry } from "./representation";
import { RoomFurniture, RoomShell } from "./roomEnvironment";
import { defaultStyleForTheme, resolveRoomLook, type NativeRoomStyle } from "./roomStyle";
import { HELD_SCALE } from "./touchEdit";
import { roomTextureIds, type NativeRoomSurface, type RoomRenderable } from "./model";
import { CANONICAL_ZONE_KINDS, zoneInteractive, type CanonicalZoneKind, type NativeWorldView } from "./worldView";

const ZONE_HOTSPOTS: Record<CanonicalZoneKind, { position: [number, number, number]; size: [number, number, number] }> = {
  shelf: { position: [-3.15, -0.2, -3.55], size: [2.4, 3.2, 0.9] },
  wall: { position: [1.1, 0.75, -4.12], size: [3.6, 2.6, 0.2] },
  case: { position: [3.65, -0.2, -3.52], size: [1.7, 3.2, 0.8] },
  desk: { position: [1.55, -0.55, -2.85], size: [3.3, 1.1, 1.7] },
  binder: { position: [0.45, -0.35, -2.58], size: [1.05, 0.9, 0.7] },
  archive: { position: [-1.2, -1.55, -0.65], size: [1.9, 0.8, 1.2] },
};

export function NativeRoomRenderer({
  items,
  selectedId,
  focusedId,
  heldId = null,
  themeId,
  style,
  view,
  binderSpread,
  turningSpread,
  turnDir,
  reducedMotion = false,
  paused = false,
  readOnly = false,
  onSelectZone,
  onSelect,
  onClearSelection,
  onOpenBinder,
  onHoldCard,
  onTurnEdge,
  onTurnComplete,
  exploreRef,
  previewRef,
  highlightSurfaceIdRef,
  compatibleSurfaces = [],
  onPressStart,
  onPressEnd,
  onOpenStorage,
  placingItem = null,
}: {
  items: RoomRenderable[];
  selectedId: string | null;
  focusedId: string | null;
  heldId?: string | null;
  themeId: import("../api").NativeRoomThemeId;
  style?: NativeRoomStyle;
  view: NativeWorldView;
  binderSpread?: NativeBinderSpread;
  turningSpread?: NativeBinderSpread;
  turnDir?: 1 | -1 | 0;
  reducedMotion?: boolean;
  paused?: boolean;
  readOnly?: boolean;
  onSelectZone: (zone: CanonicalZoneKind) => void;
  onSelect: (holdingId: string) => void;
  onClearSelection: () => void;
  onOpenBinder?: () => void;
  onHoldCard?: (holding: NativeHolding | null) => void;
  onTurnEdge?: (dir: 1 | -1) => void;
  onTurnComplete?: () => void;
  exploreRef?: MutableRefObject<ExploreOffset>;
  previewRef?: MutableRefObject<RoomRenderable | null>;
  highlightSurfaceIdRef?: MutableRefObject<string | null>;
  compatibleSurfaces?: NativeRoomSurface[];
  onPressStart?: (holdingId: string) => void;
  onPressEnd?: (holdingId: string) => void;
  onOpenStorage?: () => void;
  placingItem?: RoomRenderable | null;
}) {
  const focused = items.find((item) => item.holding.id === focusedId) ?? null;
  const theme = resolveRoomLook(style ?? defaultStyleForTheme(themeId));
  const textured = roomTextureIds(items, selectedId, focusedId);
  if (placingItem?.imageUrl) textured.add(placingItem.holding.id);
  const binderOpen = view.kind === "binder";
  const placedItems = binderOpen ? items.filter((item) => item.geometry !== "photocard") : items;
  const worldItems = placingItem && !placedItems.some((item) => item.holding.id === placingItem.holding.id)
    ? [...placedItems, placingItem]
    : placedItems;
  return <Canvas
    frameloop={paused ? "never" : "always"}
    style={StyleSheet.absoluteFill}
    camera={{ position: [1.22, 2.16, 15.55], fov: 46 }}
    onPointerMissed={onClearSelection}
    onCreated={({ camera, scene }) => {
      camera.lookAt(-0.42, -0.46, -1.52);
      scene.background = new Color(theme.void);
    }}
  >
    <color attach="background" args={[theme.void]} />
    <ambientLight intensity={0.82 * theme.brightness} color={theme.fill} />
    <directionalLight color={theme.light} intensity={1.18 * theme.brightness} position={[-3.8, 3.4, 1.2]} castShadow={false} />
    <pointLight color={theme.light} intensity={(reducedMotion ? 0.2 : 0.36) * theme.brightness} position={[-4.2, 0.86, -0.82]} />
    <pointLight color={theme.fill} intensity={0.28 * theme.brightness} position={[2.4, 1.55, 0.55]} />
    <AuthoredCamera view={view} focused={focused} reducedMotion={reducedMotion} paused={paused} exploreRef={exploreRef} />
    <RoomShell theme={theme} onSelectZone={view.kind === "home" || view.kind === "zone" ? onSelectZone : undefined} />
    <RoomFurniture
      theme={theme}
      hideClosedBinder={binderOpen}
      onOpenBinder={view.kind === "binder" || view.kind === "edit" || Boolean(heldId) ? undefined : onOpenBinder}
      onOpenStorage={readOnly || view.kind === "binder" || Boolean(heldId) ? undefined : onOpenStorage}
      onSelectZone={view.kind === "home" || view.kind === "zone" ? onSelectZone : undefined}
    />
    {view.kind === "home" ? CANONICAL_ZONE_KINDS.filter((zone) => zone !== "archive").map((zone) => (
      <ZoneHotspot key={zone} zone={zone} onSelect={onSelectZone} />
    )) : null}
    {heldId && compatibleSurfaces.length ? <LandingHighlights
      surfaces={compatibleSurfaces}
      activeIdRef={highlightSurfaceIdRef}
      color={theme.light}
    /> : null}
    {worldItems.map((item) => {
      const zone = zoneOfItem(item);
      const live = zoneInteractive(view, zone) || view.kind === "edit" || view.kind === "inspect";
      return <RoomObject
        key={item.holding.id}
        item={item}
        selected={selectedId === item.holding.id}
        focused={focusedId === item.holding.id}
        held={heldId === item.holding.id}
        loadTexture={textured.has(item.holding.id)}
        interactive={live}
        previewRef={previewRef}
        reducedMotion={reducedMotion}
        paused={paused}
        onSelect={onSelect}
        onPressStart={view.kind === "edit" && !readOnly ? onPressStart : undefined}
        onPressEnd={view.kind === "edit" && !readOnly ? onPressEnd : undefined}
      />;
    })}
    {binderOpen ? <NativeOpenBinder
      spread={binderSpread}
      turningTo={turningSpread}
      turnDir={turnDir ?? 0}
      heldHoldingId={view.kind === "binder" ? view.heldHoldingId : undefined}
      reducedMotion={reducedMotion}
      paused={paused}
      cover={theme.binder}
      paper={theme.paper}
      onHold={(holding) => onHoldCard?.(holding)}
      onTurnComplete={() => onTurnComplete?.()}
      onTurnEdge={(dir) => onTurnEdge?.(dir)}
    /> : null}
  </Canvas>;
}

function AuthoredCamera({
  view,
  focused,
  reducedMotion,
  paused,
  exploreRef,
}: {
  view: NativeWorldView;
  focused: RoomRenderable | null;
  reducedMotion: boolean;
  paused: boolean;
  exploreRef?: MutableRefObject<ExploreOffset>;
}) {
  const { camera, size } = useThree();
  const targetPosition = useMemo(() => new Vector3(), []);
  const lookAt = useMemo(() => new Vector3(0.18, -0.12, -2.35), []);
  const desiredLook = useMemo(() => new Vector3(), []);
  useFrame((_, delta) => {
    if (paused) return;
    const aspect = size.width / Math.max(1, size.height);
    const authored = view.kind === "inspect" && focused
      ? inspectionPresentation(focused, aspect).camera
      : view.kind === "binder"
        ? binderCameraForViewport(aspect)
        : poseForView(view, focused);
    const offset = exploreRef?.current ?? IDENTITY_EXPLORE;
    const pose = exploreAllowedForView(view)
      ? applyExploreOffset(authored, offset, view.kind === "zone" ? "zone" : "home")
      : authored;
    targetPosition.set(pose.position.x, pose.position.y, pose.position.z);
    desiredLook.set(pose.lookAt.x, pose.lookAt.y, pose.lookAt.z);
    const alpha = cameraLerpAlpha(delta, reducedMotion);
    camera.position.lerp(targetPosition, alpha);
    lookAt.lerp(desiredLook, alpha);
    camera.lookAt(lookAt);
  });
  return null;
}

function ZoneHotspot({ zone, onSelect }: { zone: CanonicalZoneKind; onSelect: (zone: CanonicalZoneKind) => void }) {
  const spot = ZONE_HOTSPOTS[zone];
  return <mesh
    position={spot.position}
    onClick={(event) => { event.stopPropagation(); onSelect(zone); }}
  >
    <boxGeometry args={spot.size} />
    <meshBasicMaterial transparent opacity={0} depthWrite={false} />
  </mesh>;
}

function LandingHighlights({
  surfaces,
  activeIdRef,
  color,
}: {
  surfaces: NativeRoomSurface[];
  activeIdRef?: MutableRefObject<string | null>;
  color: string;
}) {
  return <>{surfaces.map((surface) => <LandingPlane key={surface.id} surface={surface} activeIdRef={activeIdRef} color={color} />)}</>;
}

function LandingPlane({
  surface,
  activeIdRef,
  color,
}: {
  surface: NativeRoomSurface;
  activeIdRef?: MutableRefObject<string | null>;
  color: string;
}) {
  const material = useRef<MeshBasicMaterial>(null);
  useFrame(() => {
    if (!material.current) return;
    material.current.opacity = activeIdRef?.current === surface.id ? 0.3 : 0.12;
  });
  if (surface.kind === "wall") {
    return <mesh position={[surface.x, surface.y, surface.z + 0.03]}>
      <planeGeometry args={[surface.width, surface.depth]} />
      <meshBasicMaterial ref={material} color={color} transparent opacity={0.12} depthWrite={false} />
    </mesh>;
  }
  return <mesh position={[surface.x, surface.y + 0.02, surface.z]} rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={[surface.width, surface.depth]} />
    <meshBasicMaterial ref={material} color={color} transparent opacity={0.12} depthWrite={false} />
  </mesh>;
}

function RoomObject({
  item,
  selected,
  focused,
  held,
  loadTexture,
  interactive,
  previewRef,
  reducedMotion,
  paused,
  onSelect,
  onPressStart,
  onPressEnd,
}: {
  item: RoomRenderable;
  selected: boolean;
  focused: boolean;
  held: boolean;
  loadTexture: boolean;
  interactive: boolean;
  previewRef?: MutableRefObject<RoomRenderable | null>;
  reducedMotion: boolean;
  paused: boolean;
  onSelect: (id: string) => void;
  onPressStart?: (id: string) => void;
  onPressEnd?: (id: string) => void;
}) {
  const group = useRef<Group>(null);
  const { size } = useThree();
  const targetPos = useMemo(() => new Vector3(), []);
  const targetQuat = useMemo(() => new Quaternion(), []);
  const targetEuler = useMemo(() => new Euler(), []);
  useFrame((_, delta) => {
    const mesh = group.current;
    if (!mesh || paused) return;
    const preview = previewRef?.current;
    if (held && preview && preview.holding.id === item.holding.id) {
      mesh.position.set(preview.position.x, preview.position.y, preview.position.z);
      mesh.rotation.set(preview.rotation.x, preview.rotation.y, preview.rotation.z);
      mesh.scale.setScalar(preview.scale * HELD_SCALE);
      return;
    }
    const aspect = size.width / Math.max(1, size.height);
    const presented = focused ? inspectionPresentation(item, aspect) : null;
    const restScale = item.scale * (held ? HELD_SCALE : selected && !focused ? 1.08 : 1);
    targetPos.set(
      presented?.position.x ?? item.position.x,
      presented?.position.y ?? item.position.y,
      presented?.position.z ?? item.position.z,
    );
    targetEuler.set(
      presented?.rotation.x ?? item.rotation.x,
      presented?.rotation.y ?? item.rotation.y,
      presented?.rotation.z ?? item.rotation.z,
    );
    targetQuat.setFromEuler(targetEuler);
    const alpha = cameraLerpAlpha(delta, reducedMotion);
    mesh.position.lerp(targetPos, alpha);
    mesh.quaternion.slerp(targetQuat, alpha);
    mesh.scale.setScalar(mesh.scale.x + (restScale - mesh.scale.x) * alpha);
  });
  return <group
    ref={group}
    position={[item.position.x, item.position.y, item.position.z]}
    rotation={[item.rotation.x, item.rotation.y, item.rotation.z]}
    scale={item.scale}
    onPointerDown={(event) => {
      if (!interactive) return;
      event.stopPropagation();
      onPressStart?.(item.holding.id);
    }}
    onPointerUp={(event) => {
      if (!interactive) return;
      event.stopPropagation();
      onPressEnd?.(item.holding.id);
    }}
    onClick={(event) => {
      if (!interactive) return;
      event.stopPropagation();
      onSelect(item.holding.id);
    }}
  >
    <CollectibleForm item={item} selected={selected || held} loadTexture={loadTexture} />
  </group>;
}

function CollectibleForm({ item, selected, loadTexture }: { item: RoomRenderable; selected: boolean; loadTexture: boolean }) {
  const size = extentsForGeometry(item.geometry);
  const color = selected ? "#bd4268" : item.color;
  switch (item.geometry) {
    case "photocard":
      return <Cardstock width={size.x} height={size.y} depth={Math.max(size.z, 0.022)} color={color} edge={item.accent} imageUrl={loadTexture ? item.imageUrl : undefined} cacheKey={item.holding.id} glossy />;
    case "poster":
      return <PosterForm width={size.x} height={size.y} color={color} edge={item.accent} imageUrl={loadTexture ? item.imageUrl : undefined} cacheKey={item.holding.id} />;
    case "album":
      return <AlbumForm width={size.x} height={size.y} depth={size.z} color={color} accent={item.accent} imageUrl={loadTexture ? item.imageUrl : undefined} cacheKey={item.holding.id} />;
    case "book":
      return <AlbumForm width={size.x} height={size.y} depth={size.z} color={color} accent={item.accent} imageUrl={loadTexture ? item.imageUrl : undefined} cacheKey={item.holding.id} bound />;
    case "vinyl":
      return <VinylForm size={size.x} color={color} accent={item.accent} imageUrl={loadTexture ? item.imageUrl : undefined} cacheKey={item.holding.id} />;
    case "lightstick":
      return <LightstickForm color={color} accent={item.accent} />;
    case "plushie":
      return <PlushieForm color={color} accent={item.accent} />;
    case "figure":
      return <FigureForm color={color} accent={item.accent} imageUrl={loadTexture ? item.imageUrl : undefined} cacheKey={item.holding.id} />;
    case "apparel":
      return <mesh><boxGeometry args={[size.x, size.y, size.z]} /><meshStandardMaterial color={color} roughness={0.92} /></mesh>;
    case "ticket":
      return <Cardstock width={size.x} height={size.y} depth={Math.max(size.z, 0.014)} color={color} edge={item.accent} imageUrl={loadTexture ? item.imageUrl : undefined} cacheKey={item.holding.id} />;
    case "disc-case":
      return <AlbumForm width={Math.max(size.x, 0.06)} height={size.y} depth={size.z} color={color} accent={item.accent} imageUrl={loadTexture ? item.imageUrl : undefined} cacheKey={item.holding.id} slim />;
    case "memorabilia":
      return <Cardstock width={size.x} height={size.y} depth={0.03} color={color} edge={item.accent} imageUrl={loadTexture ? item.imageUrl : undefined} cacheKey={item.holding.id} />;
    default:
      return <mesh><boxGeometry args={[size.x, size.y, size.z]} /><meshStandardMaterial color={color} roughness={0.62} /></mesh>;
  }
}

function Cardstock({ width, height, depth, color, edge, imageUrl, cacheKey, glossy }: { width: number; height: number; depth: number; color: string; edge: string; imageUrl?: string; cacheKey: string; glossy?: boolean }) {
  return <>
    <mesh><boxGeometry args={[width + 0.012, height + 0.012, depth]} /><meshStandardMaterial color={edge} roughness={0.7} /></mesh>
    <mesh position={[0, 0, 0.001]}><boxGeometry args={[width, height, depth]} /><meshStandardMaterial color={color} roughness={glossy ? 0.28 : 0.55} metalness={glossy ? 0.08 : 0} /></mesh>
    {imageUrl ? <CachedPersonalMediaFace cacheKey={cacheKey} url={imageUrl} width={width * 0.97} height={height * 0.97} depth={depth} /> : null}
  </>;
}

function PosterForm({ width, height, color, edge, imageUrl, cacheKey }: { width: number; height: number; color: string; edge: string; imageUrl?: string; cacheKey: string }) {
  return <>
    <mesh position={[0, 0, -0.012]}><boxGeometry args={[width + 0.05, height + 0.05, 0.018]} /><meshStandardMaterial color={edge} roughness={0.55} /></mesh>
    <mesh position={[0, 0, 0.002]}><boxGeometry args={[width, height, 0.012]} /><meshStandardMaterial color={color} roughness={0.62} /></mesh>
    {imageUrl ? <CachedPersonalMediaFace cacheKey={cacheKey} url={imageUrl} width={width * 0.96} height={height * 0.96} depth={0.014} /> : null}
  </>;
}

function AlbumForm({ width, height, depth, color, accent, imageUrl, cacheKey, bound, slim }: { width: number; height: number; depth: number; color: string; accent: string; imageUrl?: string; cacheKey: string; bound?: boolean; slim?: boolean }) {
  return <>
    <mesh><boxGeometry args={[width, height, depth]} /><meshStandardMaterial color={color} roughness={slim ? 0.4 : 0.58} /></mesh>
    <mesh position={[-width / 2 + 0.008, 0, 0]}><boxGeometry args={[0.012, height * 0.96, depth * 0.96]} /><meshStandardMaterial color={accent} roughness={0.45} /></mesh>
    {bound ? <mesh position={[0, 0, depth / 2 + 0.004]}><boxGeometry args={[width * 0.7, height * 0.08, 0.01]} /><meshStandardMaterial color={accent} roughness={0.5} /></mesh> : null}
    <mesh position={[0, 0, depth / 2 + 0.002]}><planeGeometry args={[width * 0.86, height * 0.88]} /><meshStandardMaterial color={accent} roughness={0.5} /></mesh>
    {imageUrl ? <CachedCoverMedia cacheKey={cacheKey} url={imageUrl} width={depth * 0.9} height={height * 0.9} offset={width / 2} /> : null}
  </>;
}

function VinylForm({ size, color, accent, imageUrl, cacheKey }: { size: number; color: string; accent: string; imageUrl?: string; cacheKey: string }) {
  return <>
    <mesh position={[0, 0.08, -0.03]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[size * 0.42, size * 0.42, 0.012, 48]} /><meshStandardMaterial color="#1a1416" roughness={0.28} metalness={0.2} /></mesh>
    <mesh><boxGeometry args={[size, size, 0.055]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
    <mesh position={[0, 0, 0.03]}><planeGeometry args={[size * 0.88, size * 0.88]} /><meshStandardMaterial color={accent} roughness={0.55} /></mesh>
    {imageUrl ? <CachedPersonalMediaFace cacheKey={cacheKey} url={imageUrl} width={size * 0.86} height={size * 0.86} depth={0.055} /> : null}
  </>;
}

function LightstickForm({ color, accent }: { color: string; accent: string }) {
  return <>
    <mesh position={[0, -0.16, 0]}><cylinderGeometry args={[0.055, 0.06, 0.42, 20]} /><meshStandardMaterial color="#c5c0b8" metalness={0.45} roughness={0.35} /></mesh>
    <mesh position={[0, 0.08, 0]}><cylinderGeometry args={[0.08, 0.08, 0.04, 20]} /><meshStandardMaterial color={color} roughness={0.4} /></mesh>
    <mesh position={[0, 0.26, 0]}><sphereGeometry args={[0.14, 24, 18]} /><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.55} roughness={0.25} /></mesh>
  </>;
}

function PlushieForm({ color, accent }: { color: string; accent: string }) {
  return <>
    <mesh position={[-0.14, 0.26, 0]}><sphereGeometry args={[0.1, 16, 12]} /><meshStandardMaterial color={color} roughness={0.95} /></mesh>
    <mesh position={[0.14, 0.26, 0]}><sphereGeometry args={[0.1, 16, 12]} /><meshStandardMaterial color={color} roughness={0.95} /></mesh>
    <mesh><sphereGeometry args={[0.26, 22, 16]} /><meshStandardMaterial color={color} roughness={0.95} /></mesh>
    <mesh position={[0, -0.06, 0.18]}><sphereGeometry args={[0.08, 12, 10]} /><meshStandardMaterial color={accent} roughness={0.9} /></mesh>
  </>;
}

function FigureForm({ color, accent, imageUrl, cacheKey }: { color: string; accent: string; imageUrl?: string; cacheKey: string }) {
  return <>
    <mesh position={[0, -0.36, 0]} rotation={[-Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.18, 0.18, 0.04, 28]} /><meshStandardMaterial color="#d8d4cc" roughness={0.25} metalness={0.15} /></mesh>
    <mesh position={[0, 0.04, 0]}><boxGeometry args={[0.28, 0.72, 0.04]} /><meshStandardMaterial color={color} roughness={0.35} /></mesh>
    {imageUrl ? <CachedPersonalMediaFace cacheKey={cacheKey} url={imageUrl} width={0.24} height={0.62} depth={0.04} /> : <mesh position={[0, 0.08, 0.022]}><planeGeometry args={[0.16, 0.42]} /><meshStandardMaterial color={accent} roughness={0.4} /></mesh>}
  </>;
}

function CachedPersonalMediaFace({ cacheKey, url, width, height, depth }: { cacheKey: string; url: string; width: number; height: number; depth: number }) {
  const localUri = useCachedSignedMedia(cacheKey, url);
  return localUri ? <Suspense fallback={null}><PersonalMediaFace uri={localUri} width={width} height={height} position={[0, 0, depth / 2 + 0.003]} /></Suspense> : null;
}

function CachedCoverMedia({ cacheKey, url, width, height, offset }: { cacheKey: string; url: string; width: number; height: number; offset: number }) {
  const localUri = useCachedSignedMedia(cacheKey, url);
  return localUri ? <Suspense fallback={null}><PersonalMediaFace uri={localUri} width={width} height={height} position={[offset + 0.003, 0, 0]} rotation={[0, Math.PI / 2, 0]} /></Suspense> : null;
}

function PersonalMediaFace({ uri, width, height, position, rotation = [0, 0, 0] }: { uri: string; width: number; height: number; position: [number, number, number]; rotation?: [number, number, number] }) {
  const texture = useLoader(TextureLoader, uri);
  return <mesh position={position} rotation={rotation}>
    <planeGeometry args={[width, height]} />
    <meshBasicMaterial map={texture} toneMapped={false} />
  </mesh>;
}

function zoneOfItem(item: RoomRenderable): CanonicalZoneKind {
  const surface = item.placement?.surfaceId ?? "";
  if (surface.includes("shelf")) return "shelf";
  if (surface.includes("wall")) return "wall";
  if (surface.includes("display-case") || surface.includes("case")) return "case";
  if (surface.includes("archive")) return "archive";
  if (surface.includes("binder")) return "binder";
  return "desk";
}
