import { BACK_WALL } from "./envelope";
import { eligiblePhotocards, photoStringSlot, publicPhotoStringHolding, type PublicPhotoStringCard } from "./photoString";
/* eslint-disable react/no-unknown-property -- React Three Fiber JSX uses Three.js properties. */
import "./threeFiberCompat";
import { Suspense, useMemo, useRef, type MutableRefObject } from "react";
import { StyleSheet } from "react-native";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber/native";
import { CatmullRomCurve3, Color, Euler, Group, MeshBasicMaterial, PCFShadowMap, Quaternion, TextureLoader, Vector3 } from "three";
import type { NativeBinderSpread } from "../binder/model";
import type { NativeHolding } from "../api";
import { useCachedSignedMedia } from "../media/cachedMedia";
import { applyExploreOffset, cameraLerpAlpha, DESK_BINDER_AT, exploreAllowedForView, IDENTITY_EXPLORE, poseForView, type ExploreOffset } from "./camera";
import { binderCameraForViewport, inspectionPresentation } from "./composition";
import { NativeOpenBinder } from "./NativeOpenBinder";
import { representationForHolding, boundsForGeometry, extentsForGeometry } from "./representation";
import { layoutX, layoutZ, ROOM_LAYOUT } from "./roomLayout";
import { ContactShadow, prepCollectibleTexture } from "./roomMaterials";
import { ROOM_SHADOW_CAMERA, ROOM_SHADOW_MAP_SIZE } from "./roomRendererQuality";
import { RoomFurniture, RoomShell } from "./roomEnvironment";
import { deskBinderWorld, zoneHotspotFor, type RoomObjectInstance } from "./roomObjects";
import { liveZoneDock, resolveRoomWorldTransform, type FurnitureCarry } from "./roomWorldTransform";
import { defaultStyleForTheme, resolveRoomLook, type NativeRoomStyle } from "./roomStyle";
import { HELD_SCALE } from "./touchEdit";
import { roomTextureIds, type NativeRoomSurface, type RoomRenderable } from "./model";
import { CANONICAL_ZONE_KINDS, zoneInteractive, type CanonicalZoneKind, type NativeWorldView } from "./worldView";

const ZONE_HOTSPOTS: Record<CanonicalZoneKind, { position: [number, number, number]; size: [number, number, number] }> = {
  shelf: { position: [layoutX(-3.15), -0.2, layoutZ(-3.55)], size: [2.4, 3.2, 0.9] },
  wall: { position: [0, (BACK_WALL.minY + BACK_WALL.maxY) / 2, BACK_WALL.z + 0.24], size: [BACK_WALL.maxX - BACK_WALL.minX, BACK_WALL.maxY - BACK_WALL.minY, 0.2] },
  case: { position: [layoutX(3.65), -0.2, layoutZ(-3.52)], size: [1.7, 3.2, 0.8] },
  desk: { position: [layoutX(1.55), -0.55, layoutZ(-2.85)], size: [3.3, 1.1, 1.7] },
  binder: { position: [layoutX(0.45), -0.35, layoutZ(-2.58)], size: [1.05, 0.9, 0.7] },
  archive: { position: [layoutX(-1.2), -1.55, layoutZ(-0.65)], size: [1.9, 0.8, 1.2] },
};

export function NativeRoomRenderer({
  items,
  photoStringHoldings = [],
  publicStringCards = [],
  onConfigurePhotoString,
  selectedId,
  focusedId,
  heldId = null,
  roomId,
  objects = [],
  selectedObjectId = null,
  heldObjectId = null,
  showLegacyBoxes = false,
  themeId,
  style,
  view,
  binderDeskId,
  binderSpread,
  turningSpread,
  turnDir,
  reducedMotion = false,
  paused = false,
  readOnly = false,
  onSelectZone,
  onSelect,
  onSelectObject,
  onClearSelection,
  onOpenBinder,
  onHoldCard,
  onTurnEdge,
  onTurnComplete,
  exploreRef,
  previewRef,
  objectPreviewRef,
  furnitureCarryRef,
  highlightSurfaceIdRef,
  compatibleSurfaces = [],
  onPressStart,
  onPressEnd,
  onObjectPressStart,
  onObjectPressEnd,
  onOpenStorage,
  placingItem = null,
}: {
  items: RoomRenderable[];
  photoStringHoldings?: NativeHolding[];
  publicStringCards?: PublicPhotoStringCard[];
  onConfigurePhotoString?: (objectId: string) => void;
  selectedId: string | null;
  focusedId: string | null;
  heldId?: string | null;
  roomId?: string;
  objects?: RoomObjectInstance[];
  selectedObjectId?: string | null;
  heldObjectId?: string | null;
  showLegacyBoxes?: boolean;
  themeId: import("../api").NativeRoomThemeId;
  style?: NativeRoomStyle;
  view: NativeWorldView;
  binderDeskId?: string | null;
  binderSpread?: NativeBinderSpread;
  turningSpread?: NativeBinderSpread;
  turnDir?: 1 | -1 | 0;
  reducedMotion?: boolean;
  paused?: boolean;
  readOnly?: boolean;
  onSelectZone: (zone: CanonicalZoneKind, objectId?: string) => void;
  onSelect: (holdingId: string) => void;
  onSelectObject?: (objectId: string) => void;
  onClearSelection: () => void;
  onOpenBinder?: () => void;
  onHoldCard?: (holding: NativeHolding | null) => void;
  onTurnEdge?: (dir: 1 | -1) => void;
  onTurnComplete?: () => void;
  exploreRef?: MutableRefObject<ExploreOffset>;
  previewRef?: MutableRefObject<RoomRenderable | null>;
  objectPreviewRef?: MutableRefObject<RoomObjectInstance | null>;
  furnitureCarryRef?: MutableRefObject<FurnitureCarry | null>;
  highlightSurfaceIdRef?: MutableRefObject<string | null>;
  compatibleSurfaces?: NativeRoomSurface[];
  onPressStart?: (holdingId: string) => void;
  onPressEnd?: (holdingId: string) => void;
  onObjectPressStart?: (objectId: string) => void;
  onObjectPressEnd?: (objectId: string) => void;
  onOpenStorage?: (objectId?: string) => void;
  placingItem?: RoomRenderable | null;
}) {
  const focused = items.find((item) => item.holding.id === focusedId) ?? null;
  const theme = resolveRoomLook(style ?? defaultStyleForTheme(themeId));
  const layoutObjects = objects;
  const binderAt = deskBinderWorld(layoutObjects, binderDeskId);
  const textured = roomTextureIds(items, selectedId, focusedId);
  if (placingItem?.imageUrl) textured.add(placingItem.holding.id);
  const binderOpen = view.kind === "binder";
  const placedItems = binderOpen ? items.filter((item) => item.geometry !== "photocard") : items;
  const worldItems = placingItem && !placedItems.some((item) => item.holding.id === placingItem.holding.id)
    ? [...placedItems, placingItem]
    : placedItems;
  return <Canvas
    frameloop={paused ? "never" : "always"}
    shadows
    style={StyleSheet.absoluteFill}
    camera={{ position: [0.68, 1.58, 5.72], fov: 46 }}
    onPointerMissed={onClearSelection}
    onCreated={({ camera, scene, gl }) => {
      camera.lookAt(-0.18, 0.06, -2.38);
      scene.background = new Color(theme.void);
      gl.shadowMap.enabled = true;
      gl.shadowMap.type = PCFShadowMap;
    }}
  >
    <color attach="background" args={[theme.void]} />
    <ambientLight intensity={0.64 * theme.brightness} color={theme.fill} />
    <directionalLight
      color={theme.light}
      intensity={1.22 * theme.brightness}
      position={[layoutX(-3.8), 3.4, layoutZ(1.2)]}
      castShadow
      shadow-mapSize={[ROOM_SHADOW_MAP_SIZE, ROOM_SHADOW_MAP_SIZE]}
      shadow-bias={-0.0008}
      shadow-camera-near={ROOM_SHADOW_CAMERA.near}
      shadow-camera-far={ROOM_SHADOW_CAMERA.far}
      shadow-camera-left={ROOM_SHADOW_CAMERA.left}
      shadow-camera-right={ROOM_SHADOW_CAMERA.right}
      shadow-camera-top={ROOM_SHADOW_CAMERA.top}
      shadow-camera-bottom={ROOM_SHADOW_CAMERA.bottom}
    />
    <pointLight color={theme.light} intensity={(reducedMotion ? 0.16 : 0.28) * theme.brightness} position={[-ROOM_LAYOUT.wallX + 0.28, 0.86, ROOM_LAYOUT.windowZ]} />
    <pointLight color={theme.fill} intensity={0.32 * theme.brightness} position={[layoutX(2.4), 1.55, layoutZ(0.55)]} />
    <AuthoredCamera
      view={view}
      focused={focused}
      roomId={roomId}
      objects={layoutObjects}
      reducedMotion={reducedMotion}
      paused={paused}
      exploreRef={exploreRef}
      binderAt={binderAt ?? DESK_BINDER_AT}
    />
    <Suspense fallback={null}>
      <RoomShell theme={theme} onSelectZone={view.kind === "home" || view.kind === "zone" ? onSelectZone : undefined} />
      <RoomFurniture
      theme={theme}
      photoStringVisuals={(object) => <PhotoStringForm object={object} holdings={photoStringHoldings} publicCards={publicStringCards} readOnly={readOnly} color={theme.metal} />}
      onConfigurePhotoString={onConfigurePhotoString}
      objects={layoutObjects}
      hideClosedBinder
      binderAt={binderAt}
      showLegacyBoxes={false}
      selectedObjectId={selectedObjectId}
      heldObjectId={heldObjectId}
      objectPreviewRef={objectPreviewRef}
      editing={view.kind === "edit" && !readOnly}
      onOpenBinder={view.kind === "binder" || view.kind === "edit" || Boolean(heldId) || Boolean(heldObjectId) ? undefined : onOpenBinder}
      onOpenStorage={readOnly || view.kind === "binder" || Boolean(heldId) || Boolean(heldObjectId) ? undefined : onOpenStorage}
      onSelectZone={view.kind === "home" || view.kind === "zone" ? onSelectZone : undefined}
      onSelectObject={view.kind === "edit" && !readOnly ? onSelectObject : undefined}
      onObjectPressStart={view.kind === "edit" && !readOnly ? onObjectPressStart : undefined}
      onObjectPressEnd={view.kind === "edit" && !readOnly ? onObjectPressEnd : undefined}
    />
    </Suspense>
    {view.kind === "home" ? CANONICAL_ZONE_KINDS.filter((zone) => zone !== "archive" && zone !== "binder").map((zone) => {
      if (zone === "wall") return <ZoneHotspot key={zone} zone={zone} onSelect={onSelectZone} />;
      return layoutObjects.filter((object) => object.kind === zone).map((object) => {
        const spot = zoneHotspotFor(zone as "shelf" | "case" | "desk" | "archive", layoutObjects, object.id);
        return spot ? <ZoneHotspot key={object.id} zone={zone} onSelect={(selectedZone) => onSelectZone(selectedZone, object.id)} spot={spot} /> : null;
      });
    }) : null}
    {(heldId || heldObjectId) && compatibleSurfaces.length ? <LandingHighlights
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
        roomId={roomId}
        objects={layoutObjects}
        furnitureCarryRef={furnitureCarryRef}
        reducedMotion={reducedMotion}
        paused={paused}
        onSelect={onSelect}
        onPressStart={view.kind === "edit" && !readOnly ? onPressStart : undefined}
        onPressEnd={view.kind === "edit" && !readOnly ? onPressEnd : undefined}
      />;
    })}
    {binderAt ? <NativeOpenBinder
      open={binderOpen}
      spread={binderSpread}
      turningTo={turningSpread}
      turnDir={turnDir ?? 0}
      heldHoldingId={view.kind === "binder" ? view.heldHoldingId : undefined}
      reducedMotion={reducedMotion}
      paused={paused}
      cover={theme.binder}
      paper={theme.paper}
      binderAt={binderAt}
      objects={layoutObjects}
      deskInstanceId={binderDeskId}
      objectPreviewRef={objectPreviewRef}
      onOpen={view.kind === "binder" || view.kind === "edit" || Boolean(heldId) || Boolean(heldObjectId) ? undefined : onOpenBinder}
      onHold={(holding) => onHoldCard?.(holding)}
      onTurnComplete={() => onTurnComplete?.()}
      onTurnEdge={(dir) => onTurnEdge?.(dir)}
    /> : null}
  </Canvas>;
}

function AuthoredCamera({
  view,
  focused,
  roomId,
  objects,
  reducedMotion,
  paused,
  exploreRef,
  binderAt,
}: {
  view: NativeWorldView;
  focused: RoomRenderable | null;
  roomId?: string;
  objects: RoomObjectInstance[];
  reducedMotion: boolean;
  paused: boolean;
  exploreRef?: MutableRefObject<ExploreOffset>;
  binderAt: { x: number; y: number; z: number };
}) {
  const { camera, size } = useThree();
  const targetPosition = useMemo(() => new Vector3(), []);
  const lookAt = useMemo(() => new Vector3(0.18, -0.12, -2.35), []);
  const desiredLook = useMemo(() => new Vector3(), []);
  useFrame((_, delta) => {
    if (paused) return;
    const aspect = size.width / Math.max(1, size.height);
    const liveFocused = focused ? { ...focused, ...resolveRoomWorldTransform(focused, roomId, objects) } : null;
    const authored = view.kind === "inspect" && liveFocused
      ? inspectionPresentation(liveFocused, aspect).camera
      : view.kind === "binder"
        ? binderCameraForViewport(aspect, binderAt)
        : view.kind === "inspect" || view.kind === "zone"
          ? liveZoneDock(view.zone, objects, view.objectId)
          : poseForView(view, liveFocused);
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

function ZoneHotspot({
  zone,
  onSelect,
  spot = ZONE_HOTSPOTS[zone],
}: {
  zone: CanonicalZoneKind;
  onSelect: (zone: CanonicalZoneKind) => void;
  spot?: { position: [number, number, number]; size: [number, number, number]; rotateY?: number };
}) {
  return <mesh
    position={spot.position}
    rotation={[0, (spot.rotateY ?? 0) * Math.PI / 180, 0]}
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
  return <group position={[surface.x, surface.y + 0.02, surface.z]} rotation={[0, (surface.rotateY ?? 0) * Math.PI / 180, 0]}><mesh rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={[surface.width, surface.depth]} />
    <meshBasicMaterial ref={material} color={color} transparent opacity={0.12} depthWrite={false} />
  </mesh></group>;
}

function RoomObject({
  item,
  selected,
  focused,
  held,
  loadTexture,
  interactive,
  previewRef,
  roomId,
  objects,
  furnitureCarryRef,
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
  roomId?: string;
  objects: RoomObjectInstance[];
  furnitureCarryRef?: MutableRefObject<FurnitureCarry | null>;
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
  const restWorld = resolveRoomWorldTransform(item, roomId, objects);
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
    const world = resolveRoomWorldTransform(item, roomId, objects, furnitureCarryRef?.current);
    const aspect = size.width / Math.max(1, size.height);
    const presented = focused ? inspectionPresentation({ ...item, position: world.position, rotation: world.rotation }, aspect) : null;
    const restScale = item.scale * (held ? HELD_SCALE : 1);
    targetPos.set(
      presented?.position.x ?? world.position.x,
      presented?.position.y ?? world.position.y,
      presented?.position.z ?? world.position.z,
    );
    targetEuler.set(
      presented?.rotation.x ?? world.rotation.x,
      presented?.rotation.y ?? world.rotation.y,
      presented?.rotation.z ?? world.rotation.z,
    );
    targetQuat.setFromEuler(targetEuler);
    const alpha = cameraLerpAlpha(delta, reducedMotion);
    mesh.position.lerp(targetPos, alpha);
    mesh.quaternion.slerp(targetQuat, alpha);
    mesh.scale.setScalar(mesh.scale.x + (restScale - mesh.scale.x) * alpha);
  });
  return <group
    ref={group}
    position={[restWorld.position.x, restWorld.position.y, restWorld.position.z]}
    rotation={[restWorld.rotation.x, restWorld.rotation.y, restWorld.rotation.z]}
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
    {!focused && !held && !item.placement?.surfaceId?.endsWith("-wall") ? (
      <group position={[0, boundsForGeometry(item.geometry).minY - 0.001, 0]}>
        <ContactShadow width={0.26} depth={0.2} opacity={0.1} />
      </group>
    ) : null}
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
      return <FlatPaperForm width={size.x} depth={size.z} thickness={Math.max(size.y, 0.016)} color={color} edge={item.accent} imageUrl={loadTexture ? item.imageUrl : undefined} cacheKey={item.holding.id} />;
    case "disc-case":
      return <AlbumForm width={Math.max(size.x, 0.06)} height={size.y} depth={size.z} color={color} accent={item.accent} imageUrl={loadTexture ? item.imageUrl : undefined} cacheKey={item.holding.id} slim />;
    case "memorabilia":
      return <FlatPaperForm width={size.x} depth={size.z} thickness={Math.max(size.y, 0.016)} color={color} edge={item.accent} imageUrl={loadTexture ? item.imageUrl : undefined} cacheKey={item.holding.id} />;
    default:
      return <mesh><boxGeometry args={[size.x, size.y, size.z]} /><meshStandardMaterial color={color} roughness={0.62} /></mesh>;
  }
}

function FlatPaperForm({ width, depth, thickness, color, edge, imageUrl, cacheKey }: { width: number; depth: number; thickness: number; color: string; edge: string; imageUrl?: string; cacheKey: string }) {
  return <group rotation={[-Math.PI / 2, 0, 0]}>
    <Cardstock width={width} height={depth} depth={thickness} color={color} edge={edge} imageUrl={imageUrl} cacheKey={cacheKey} />
  </group>;
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
    <mesh position={[0, -0.36, 0]}><cylinderGeometry args={[0.18, 0.18, 0.04, 28]} /><meshStandardMaterial color="#d8d4cc" roughness={0.25} metalness={0.15} /></mesh>
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
  const map = useMemo(() => prepCollectibleTexture(texture), [texture]);
  return <mesh position={position} rotation={rotation}>
    <planeGeometry args={[width, height]} />
    <meshBasicMaterial map={map} toneMapped={false} />
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

/** Static sag and card poses. FurniturePose owns the single live instance transform. */
function PhotoStringForm({ object, holdings, publicCards, readOnly, color }: {
  object: RoomObjectInstance; holdings: NativeHolding[]; publicCards: PublicPhotoStringCard[]; readOnly: boolean; color: string;
}) {
  const curve = useMemo(() => new CatmullRomCurve3(Array.from({ length: 17 }, (_, i) => {
    const x = -1.35 + i * 2.7 / 16;
    return new Vector3(x, -0.17 * (1 - (x / 1.35) ** 2), 0);
  })), []);
  const owned = new Map(eligiblePhotocards(holdings).map((h) => [h.id, h]));
  return <group>
    <mesh position={[0, -0.25, 0]}><boxGeometry args={[2.78, 0.9, 0.09]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    <mesh><tubeGeometry args={[curve, 32, 0.012, 4, false]} /><meshStandardMaterial color={color} roughness={0.9} /></mesh>
    {[-1.35, 1.35].map((x) => <mesh key={x} position={[x, 0, 0]}><sphereGeometry args={[0.035, 8, 6]} /><meshStandardMaterial color={color} roughness={0.65} /></mesh>)}
    {Array.from({ length: 5 }, (_, slot) => {
      const local = photoStringSlot(slot);
      const publicCard = publicCards.find((c) => c.objectId === object.id && c.slot === slot);
      const id = object.photoString?.slots[slot];
      const holding = readOnly ? (publicCard ? publicPhotoStringHolding(publicCard) : undefined) : id ? owned.get(id) : undefined;
      const look = holding ? representationForHolding(holding) : null;
      return <group key={slot} position={[local.x, local.y, local.z]}>
        <mesh position={[0, -0.025, 0.006]}><boxGeometry args={[0.035, 0.065, 0.025]} /><meshStandardMaterial color="#bdab8d" roughness={0.8} /></mesh>
        {look && holding ? <group position={[0, -0.27, 0.014]} rotation={[0, 0, local.angle]}>
          <Cardstock width={0.3} height={0.46} depth={0.018} color={look.color} edge={look.accent} imageUrl={look.imageUrl} cacheKey={holding.id} glossy />
        </group> : null}
      </group>;
    })}
  </group>;
}
