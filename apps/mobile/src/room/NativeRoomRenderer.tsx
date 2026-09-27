/* eslint-disable react/no-unknown-property -- React Three Fiber JSX uses Three.js properties. */
import { Suspense } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber/native";
import { Color, TextureLoader, Vector3 } from "three";
import type { RoomRenderable } from "./model";

export function NativeRoomRenderer({
  items,
  selectedId,
  cameraYaw,
  onSelect,
}: {
  items: RoomRenderable[];
  selectedId: string | null;
  cameraYaw: number;
  onSelect: (holdingId: string) => void;
}) {
  return <Canvas
    camera={{ position: [0, 2.6, 7], fov: 50 }}
    onCreated={({ camera, scene }) => {
      camera.lookAt(0, 0.4, -2);
      scene.background = new Color("#f4e7e5");
    }}
  >
    <ambientLight intensity={1.5} />
    <directionalLight color="#fff1e5" intensity={2.2} position={[-3, 6, 4]} />
    <CameraRig yaw={cameraYaw} />
    <RoomShell />
    <RoomFurniture />
    {items.map((item) => <RoomObject key={item.holding.id} item={item} selected={selectedId === item.holding.id} onSelect={onSelect} />)}
  </Canvas>;
}

function CameraRig({ yaw }: { yaw: number }) {
  const { camera } = useThree();
  const target = new Vector3();
  useFrame(() => {
    target.set(Math.sin(yaw) * 9, 2.6, -2 + Math.cos(yaw) * 9);
    camera.position.lerp(target, 0.12);
    camera.lookAt(0, 0.4, -2);
  });
  return null;
}

function RoomShell() {
  return <>
    <mesh position={[0, 0, -4.2]}><boxGeometry args={[9.5, 6.4, 0.12]} /><meshStandardMaterial color="#b9959b" roughness={0.9} /></mesh>
    <mesh position={[0, -2.15, -1.2]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[9.5, 6.2]} /><meshStandardMaterial color="#6f4c4d" roughness={0.8} /></mesh>
    <mesh position={[-4.7, 0, -1.25]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[5.9, 6.4]} /><meshStandardMaterial color="#a98288" roughness={0.9} /></mesh>
    <mesh position={[4.7, 0, -1.25]} rotation={[0, -Math.PI / 2, 0]}><planeGeometry args={[5.9, 6.4]} /><meshStandardMaterial color="#a98288" roughness={0.9} /></mesh>
  </>;
}

function RoomFurniture() {
  return <>
    <mesh position={[-3.15, -0.55, -3.75]}><boxGeometry args={[2.25, 3.1, 0.38]} /><meshStandardMaterial color="#56383d" roughness={0.8} /></mesh>
    {[-1.45, -0.55, 0.35].map((y) => <mesh key={y} position={[-3.15, y, -3.48]}><boxGeometry args={[2.1, 0.09, 0.62]} /><meshStandardMaterial color="#8a6261" roughness={0.75} /></mesh>)}
    <mesh position={[1.45, -0.82, -2.85]}><boxGeometry args={[3.25, 0.18, 1.65]} /><meshStandardMaterial color="#7b5654" roughness={0.72} /></mesh>
    <mesh position={[0.2, -1.28, -1.15]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.35, 48]} /><meshStandardMaterial color="#8e5265" roughness={1} /></mesh>
  </>;
}

function RoomObject({ item, selected, onSelect }: { item: RoomRenderable; selected: boolean; onSelect: (id: string) => void }) {
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
    {item.imageUrl ? <Suspense fallback={null}><PersonalMediaFace url={item.imageUrl} width={dimensions[0] * 0.92} height={dimensions[1] * 0.92} depth={dimensions[2]} /></Suspense> : null}
  </group>;
}

function PersonalMediaFace({ url, width, height, depth }: { url: string; width: number; height: number; depth: number }) {
  const texture = useLoader(TextureLoader, url);
  return <mesh position={[0, 0, depth / 2 + 0.003]}>
    <planeGeometry args={[width, height]} />
    <meshBasicMaterial map={texture} toneMapped={false} />
  </mesh>;
}
