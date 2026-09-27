/* eslint-disable react/no-unknown-property -- React Three Fiber JSX uses Three.js properties. */
import { Suspense } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber/native";
import { Color, TextureLoader, Vector3 } from "three";
import type { NativeRoomThemeId } from "../api";
import { useCachedSignedMedia } from "../media/cachedMedia";
import { roomTextureIds, type RoomRenderable } from "./model";

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
  onSelect,
  onClearSelection,
}: {
  items: RoomRenderable[];
  selectedId: string | null;
  focusedId: string | null;
  themeId: NativeRoomThemeId;
  cameraYaw: number;
  cameraPitch: number;
  onSelect: (holdingId: string) => void;
  onClearSelection: () => void;
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
    <CameraRig yaw={cameraYaw} pitch={cameraPitch} focused={focused} />
    <RoomShell theme={theme} />
    <RoomFurniture theme={theme} />
    {items.map((item) => <RoomObject key={item.holding.id} item={item} selected={selectedId === item.holding.id} loadTexture={textured.has(item.holding.id)} onSelect={onSelect} />)}
  </Canvas>;
}

function CameraRig({ yaw, pitch, focused }: { yaw: number; pitch: number; focused: RoomRenderable | null }) {
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

function RoomFurniture({ theme }: { theme: typeof ROOM_THEMES[NativeRoomThemeId] }) {
  return <>
    <mesh position={[-3.15, -0.55, -3.75]}><boxGeometry args={[2.25, 3.1, 0.38]} /><meshStandardMaterial color={theme.furniture} roughness={0.8} /></mesh>
    {[-1.45, -0.55, 0.35].map((y) => <mesh key={y} position={[-3.15, y, -3.48]}><boxGeometry args={[2.1, 0.09, 0.62]} /><meshStandardMaterial color={theme.edge} roughness={0.75} /></mesh>)}
    <mesh position={[1.45, -0.82, -2.85]}><boxGeometry args={[3.25, 0.18, 1.65]} /><meshStandardMaterial color={theme.edge} roughness={0.72} /></mesh>
    <mesh position={[0.45, -0.66, -2.7]} rotation={[-0.08, 0, 0]}><boxGeometry args={[1.05, 0.1, 0.78]} /><meshStandardMaterial color={theme.accent} roughness={0.7} /></mesh>
    <mesh position={[3.65, -0.55, -3.76]}><boxGeometry args={[1.58, 3.15, 0.34]} /><meshStandardMaterial color={theme.furniture} roughness={0.78} /></mesh>
    {[-0.55, 0.43].map((y) => <mesh key={`case-${y}`} position={[3.65, y, -3.5]}><boxGeometry args={[1.45, 0.08, 0.66]} /><meshStandardMaterial color={theme.edge} roughness={0.7} /></mesh>)}
    <mesh position={[-1.2, -1.86, -0.65]}><boxGeometry args={[1.82, 0.58, 1.16]} /><meshStandardMaterial color={theme.furniture} roughness={0.9} /></mesh>
    <mesh position={[0.2, -1.28, -1.15]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.35, 48]} /><meshStandardMaterial color={theme.accent} roughness={1} /></mesh>
  </>;
}

function RoomObject({ item, selected, loadTexture, onSelect }: { item: RoomRenderable; selected: boolean; loadTexture: boolean; onSelect: (id: string) => void }) {
  const dimensions: [number, number, number] = item.geometry === "photocard"
    ? [0.72, 1.04, 0.05]
    : item.geometry === "album"
      ? [0.92, 0.92, 0.18]
      : [0.7, 0.7, 0.7];
  return <group
    position={[item.position.x, item.position.y, item.position.z]}
    rotation={[item.rotation.x, item.rotation.y, item.rotation.z]}
    scale={item.scale * (selected ? 1.08 : 1)}
    onClick={(event) => { event.stopPropagation(); onSelect(item.holding.id); }}
  >
    <mesh castShadow><boxGeometry args={dimensions} /><meshStandardMaterial color={selected ? "#bd4268" : "#f2d5dc"} roughness={0.55} /></mesh>
    {loadTexture && item.imageUrl ? <CachedPersonalMediaFace cacheKey={item.holding.id} url={item.imageUrl} width={dimensions[0] * 0.92} height={dimensions[1] * 0.92} depth={dimensions[2]} /> : null}
  </group>;
}

function CachedPersonalMediaFace({ cacheKey, url, width, height, depth }: { cacheKey: string; url: string; width: number; height: number; depth: number }) {
  const localUri = useCachedSignedMedia(cacheKey, url);
  return localUri ? <Suspense fallback={null}><PersonalMediaFace uri={localUri} width={width} height={height} depth={depth} /></Suspense> : null;
}

function PersonalMediaFace({ uri, width, height, depth }: { uri: string; width: number; height: number; depth: number }) {
  const texture = useLoader(TextureLoader, uri);
  return <mesh position={[0, 0, depth / 2 + 0.003]}>
    <planeGeometry args={[width, height]} />
    <meshBasicMaterial map={texture} toneMapped={false} />
  </mesh>;
}
