/* eslint-disable react/no-unknown-property -- React Three Fiber JSX uses Three.js properties. */
import { Suspense } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber/native";
import { Color, TextureLoader, Vector3 } from "three";
import type { NativeRoomThemeId } from "../api";
import { useCachedSignedMedia } from "../media/cachedMedia";
import { roomTextureIds, type NativeRoomVector, type RoomRenderable } from "./model";
import { extentsForGeometry } from "./representation";

const ROOM_THEMES = {
  hearth: { background: "#f4e7e5", wall: "#b9959b", sideWall: "#a98288", floor: "#6f4c4d", furniture: "#56383d", edge: "#8a6261", accent: "#8e5265", light: "#fff1e5" },
  blossom: { background: "#fff3f5", wall: "#e8b8c5", sideWall: "#dca4b6", floor: "#a8757e", furniture: "#835765", edge: "#c98b9d", accent: "#d8789a", light: "#fff8ed" },
  midnight: { background: "#171522", wall: "#342d46", sideWall: "#29243a", floor: "#1f1b2d", furniture: "#282237", edge: "#705d86", accent: "#794f72", light: "#d6c9ff" },
} as const;

export function NativeRoomRenderer({
  items,
  selectedId,
  focusedId,
  themeId,
  cameraYaw,
  cameraPitch,
  lookTarget,
  onSelect,
  onClearSelection,
  onOpenBinder,
}: {
  items: RoomRenderable[];
  selectedId: string | null;
  focusedId: string | null;
  themeId: NativeRoomThemeId;
  cameraYaw: number;
  cameraPitch: number;
  lookTarget?: NativeRoomVector | null;
  onSelect: (holdingId: string) => void;
  onClearSelection: () => void;
  onOpenBinder?: () => void;
}) {
  const focused = items.find((item) => item.holding.id === focusedId) ?? null;
  const theme = ROOM_THEMES[themeId] ?? ROOM_THEMES.hearth;
  const textured = roomTextureIds(items, selectedId, focusedId);
  return <Canvas
    camera={{ position: [0, 2.6, 7], fov: 50 }}
    onPointerMissed={onClearSelection}
    onCreated={({ camera, scene }) => {
      camera.lookAt(0, 0.4, -2);
      scene.background = new Color(theme.background);
    }}
  >
    <ambientLight intensity={1.5} />
    <directionalLight color={theme.light} intensity={2.2} position={[-3, 6, 4]} />
    <CameraRig yaw={cameraYaw} pitch={cameraPitch} focused={focused} lookTarget={lookTarget ?? null} />
    <RoomShell theme={theme} />
    <RoomFurniture theme={theme} onOpenBinder={onOpenBinder} />
    {items.map((item) => <RoomObject key={item.holding.id} item={item} selected={selectedId === item.holding.id} focused={focusedId === item.holding.id} loadTexture={textured.has(item.holding.id)} onSelect={onSelect} />)}
  </Canvas>;
}

function CameraRig({ yaw, pitch, focused, lookTarget }: { yaw: number; pitch: number; focused: RoomRenderable | null; lookTarget: NativeRoomVector | null }) {
  const { camera } = useThree();
  const targetPosition = new Vector3();
  const lookAt = new Vector3(0, 0.4, -2);
  const desiredLook = new Vector3();
  useFrame((_, delta) => {
    const alpha = 1 - Math.exp(-7 * delta);
    if (focused) {
      const wall = focused.placement?.surfaceId?.endsWith("-wall") || focused.position.z < -3.9;
      targetPosition.set(focused.position.x, focused.position.y + (wall ? 0.05 : 0.25), focused.position.z + (wall ? 1.55 : 2.45));
      desiredLook.set(focused.position.x, focused.position.y, focused.position.z);
    } else if (lookTarget) {
      targetPosition.set(lookTarget.x, lookTarget.y + 1.15, lookTarget.z + 2.35);
      desiredLook.set(lookTarget.x, lookTarget.y, lookTarget.z);
    } else {
      targetPosition.set(Math.sin(yaw) * 9 * Math.cos(pitch), 2.6 + Math.sin(pitch) * 4.2, -2 + Math.cos(yaw) * 9 * Math.cos(pitch));
      desiredLook.set(0, 0.4 + pitch * 1.1, -2);
    }
    camera.position.lerp(targetPosition, alpha);
    lookAt.lerp(desiredLook, alpha);
    camera.lookAt(lookAt);
  });
  return null;
}

function RoomShell({ theme }: { theme: typeof ROOM_THEMES[NativeRoomThemeId] }) {
  return <>
    <mesh position={[0, 0, -4.2]}><boxGeometry args={[9.5, 6.4, 0.12]} /><meshStandardMaterial color={theme.wall} roughness={0.9} /></mesh>
    <mesh position={[0, -2.15, -1.2]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[9.5, 6.2]} /><meshStandardMaterial color={theme.floor} roughness={0.8} /></mesh>
    <mesh position={[-4.7, 0, -1.25]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[5.9, 6.4]} /><meshStandardMaterial color={theme.sideWall} roughness={0.9} /></mesh>
    <mesh position={[4.7, 0, -1.25]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[5.9, 6.4]} /><meshStandardMaterial color={theme.sideWall} roughness={0.9} /></mesh>
  </>;
}

function RoomFurniture({ theme, onOpenBinder }: { theme: typeof ROOM_THEMES[NativeRoomThemeId]; onOpenBinder?: () => void }) {
  return <>
    <mesh position={[-3.15, -0.55, -3.75]}><boxGeometry args={[2.25, 3.1, 0.38]} /><meshStandardMaterial color={theme.furniture} roughness={0.8} /></mesh>
    {[-1.45, -0.55, 0.35].map((y) => <mesh key={y} position={[-3.15, y, -3.48]}><boxGeometry args={[2.1, 0.09, 0.62]} /><meshStandardMaterial color={theme.edge} roughness={0.75} /></mesh>)}
    <mesh position={[1.45, -0.82, -2.85]}><boxGeometry args={[3.25, 0.18, 1.65]} /><meshStandardMaterial color={theme.edge} roughness={0.72} /></mesh>
    <group position={[0.45, -0.52, -2.62]} rotation={[-0.18, -0.22, 0]} onClick={(event) => { event.stopPropagation(); onOpenBinder?.(); }}>
      <mesh position={[-0.36, 0, 0]}><boxGeometry args={[0.08, 0.72, 0.52]} /><meshStandardMaterial color="#4a1c2c" roughness={0.55} /></mesh>
      <mesh position={[0.04, 0, 0]}><boxGeometry args={[0.7, 0.7, 0.5]} /><meshStandardMaterial color="#6b2a3c" roughness={0.7} /></mesh>
      <mesh position={[0.38, 0, 0]}><boxGeometry args={[0.04, 0.68, 0.46]} /><meshStandardMaterial color="#f4e4d8" roughness={0.85} /></mesh>
    </group>
    <mesh position={[3.65, -0.55, -3.76]}><boxGeometry args={[1.58, 3.15, 0.34]} /><meshStandardMaterial color={theme.furniture} roughness={0.78} /></mesh>
    {[-0.55, 0.43].map((y) => <mesh key={`case-${y}`} position={[3.65, y, -3.5]}><boxGeometry args={[1.45, 0.08, 0.66]} /><meshStandardMaterial color={theme.edge} roughness={0.7} /></mesh>)}
    <mesh position={[-1.2, -1.86, -0.65]}><boxGeometry args={[1.82, 0.58, 1.16]} /><meshStandardMaterial color={theme.furniture} roughness={0.9} /></mesh>
    <mesh position={[0.2, -1.28, -1.15]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.35, 48]} /><meshStandardMaterial color={theme.accent} roughness={1} /></mesh>
  </>;
}

function RoomObject({ item, selected, focused, loadTexture, onSelect }: { item: RoomRenderable; selected: boolean; focused: boolean; loadTexture: boolean; onSelect: (id: string) => void }) {
  const wall = item.placement?.surfaceId?.endsWith("-wall") || item.position.z < -3.9;
  return <group
    position={[item.position.x, item.position.y + (focused && !wall ? 0.16 : 0), item.position.z + (focused && !wall ? 0.14 : 0)]}
    rotation={[item.rotation.x + (focused && wall ? -0.18 : 0), item.rotation.y, item.rotation.z]}
    scale={item.scale * (selected ? 1.08 : 1)}
    onClick={(event) => { event.stopPropagation(); onSelect(item.holding.id); }}
  >
    <CollectibleForm item={item} selected={selected} loadTexture={loadTexture} />
  </group>;
}

function CollectibleForm({ item, selected, loadTexture }: { item: RoomRenderable; selected: boolean; loadTexture: boolean }) {
  const size = extentsForGeometry(item.geometry);
  const color = selected ? "#bd4268" : item.color;
  switch (item.geometry) {
    case "photocard":
      return <Cardstock width={size.x} height={size.y} depth={size.z} color={color} edge={item.accent} imageUrl={loadTexture ? item.imageUrl : undefined} cacheKey={item.holding.id} />;
    case "poster":
      return <Cardstock width={size.x} height={size.y} depth={size.z} color={color} edge={item.accent} imageUrl={loadTexture ? item.imageUrl : undefined} cacheKey={item.holding.id} />;
    case "album":
      return <AlbumForm width={size.x} height={size.y} depth={size.z} color={color} accent={item.accent} imageUrl={loadTexture ? item.imageUrl : undefined} cacheKey={item.holding.id} />;
    case "book":
      return <AlbumForm width={size.x} height={size.y} depth={size.z} color={color} accent={item.accent} imageUrl={loadTexture ? item.imageUrl : undefined} cacheKey={item.holding.id} />;
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
      return <Cardstock width={size.x} height={size.y} depth={size.z} color={color} edge={item.accent} imageUrl={loadTexture ? item.imageUrl : undefined} cacheKey={item.holding.id} />;
    case "disc-case":
      return <AlbumForm width={size.x} height={size.y} depth={size.z} color={color} accent={item.accent} imageUrl={loadTexture ? item.imageUrl : undefined} cacheKey={item.holding.id} />;
    default:
      return <mesh><boxGeometry args={[size.x, size.y, size.z]} /><meshStandardMaterial color={color} roughness={0.62} /></mesh>;
  }
}

function Cardstock({ width, height, depth, color, edge, imageUrl, cacheKey }: { width: number; height: number; depth: number; color: string; edge: string; imageUrl?: string; cacheKey: string }) {
  return <>
    <mesh><boxGeometry args={[width + 0.012, height + 0.012, depth]} /><meshStandardMaterial color={edge} roughness={0.7} /></mesh>
    <mesh position={[0, 0, 0.001]}><boxGeometry args={[width, height, depth]} /><meshStandardMaterial color={color} roughness={0.55} /></mesh>
    {imageUrl ? <CachedPersonalMediaFace cacheKey={cacheKey} url={imageUrl} width={width * 0.97} height={height * 0.97} depth={depth} /> : null}
  </>;
}

function AlbumForm({ width, height, depth, color, accent, imageUrl, cacheKey }: { width: number; height: number; depth: number; color: string; accent: string; imageUrl?: string; cacheKey: string }) {
  return <>
    <mesh><boxGeometry args={[width, height, depth]} /><meshStandardMaterial color={color} roughness={0.58} /></mesh>
    <mesh position={[0, 0, depth / 2 + 0.002]}><planeGeometry args={[width * 0.92, height * 0.92]} /><meshStandardMaterial color={accent} roughness={0.5} /></mesh>
    {imageUrl ? <CachedCoverMedia cacheKey={cacheKey} url={imageUrl} width={depth * 0.9} height={height * 0.9} offset={width / 2} /> : null}
  </>;
}

function VinylForm({ size, color, accent, imageUrl, cacheKey }: { size: number; color: string; accent: string; imageUrl?: string; cacheKey: string }) {
  return <>
    <mesh position={[0, 0.08, -0.03]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[size * 0.42, size * 0.42, 0.012, 48]} /><meshStandardMaterial color="#1a1416" roughness={0.35} /></mesh>
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
