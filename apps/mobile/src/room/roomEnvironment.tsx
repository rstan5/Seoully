import { resolveRoomObjectTransform } from "./roomObjects";
import { DESK_DRAWER_CENTERS, SHELF_BOARD_Y, CASE_BOARD_Y, SHELF_BOARD_THICKNESS, CASE_BOARD_THICKNESS, SHELF_ROOF_THICKNESS, CASE_ROOF_THICKNESS } from "./roomGrounding";
/* eslint-disable react/no-unknown-property -- React Three Fiber JSX uses Three.js properties. */
import { useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber/native";
import { Group, BufferGeometry, Float32BufferAttribute, DoubleSide } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mixHex } from "../ui/profileContrast";
import { ROOM_BOX, WORLD_ENVELOPE } from "./envelope";
import type { RoomObjectInstance } from "./roomObjects";
import { layoutX, layoutZ, ROOM_LAYOUT } from "./roomLayout";
import { ContactShadow, EdgeLip, RoomTextureQuality, useRoomMaps, type RoomMaps } from "./roomMaterials";
import type { RoomLook } from "./roomStyle";
import type { CanonicalZoneKind } from "./worldView";

export function RoomShell({ theme, onSelectZone }: { theme: RoomLook; onSelectZone?: (zone: CanonicalZoneKind, objectId?: string) => void }) {
  const maps = useRoomMaps();
  const env = WORLD_ENVELOPE;
  const box = ROOM_BOX;
  const floorH = env.floorTop - env.floorBottom;
  const floorZ = (env.floorNearZ + env.floorFarZ) / 2;
  const floorDepth = env.floorNearZ - env.floorFarZ;
  const wallH = env.wallTop - env.wallBottom;
  const wallZ = (env.wallNearZ + env.wallFarZ) / 2;
  const wallDepth = env.wallNearZ - env.wallFarZ;
  const ceilZ = (env.ceilingNearZ + env.ceilingFarZ) / 2;
  const ceilDepth = env.ceilingNearZ - env.ceilingFarZ;
  const roomWallZ = (box.backZ + box.wallNearZ) / 2;
  const roomWallDepth = box.wallNearZ - box.backZ;
  return <>
    <RoomTextureQuality maps={maps} />
    <mesh position={[0, env.floorTop - floorH / 2, floorZ]} receiveShadow>
      <boxGeometry args={[env.floorX * 2, floorH, floorDepth]} />
      <meshStandardMaterial color={theme.floor} map={maps.woodFloor} roughness={0.84} />
    </mesh>
    {[-2.6, -1.3, 0, 1.3, 2.6].map((x) => (
      <mesh key={`plank-${x}`} position={[layoutX(x), env.floorTop + 0.004, floorZ]}>
        <boxGeometry args={[0.028, 0.005, floorDepth - 0.5]} />
        <meshStandardMaterial color={theme.plank} roughness={0.8} />
      </mesh>
    ))}
    <mesh position={[0, env.ceilingY + 0.12, ceilZ]} receiveShadow>
      <boxGeometry args={[env.ceilingX * 2, 0.24, ceilDepth]} />
      <meshStandardMaterial color={theme.wallAccent} map={maps.plaster} roughness={0.94} />
    </mesh>
    <mesh position={[0, 0.72, env.backZ]} receiveShadow onClick={(event) => { event.stopPropagation(); onSelectZone?.("wall"); }}>
      <boxGeometry args={[env.wallX * 2 + 0.4, 6.9, 0.28]} />
      <meshStandardMaterial color={theme.wall} map={maps.plaster} roughness={0.95} />
    </mesh>
    <mesh position={[0, ROOM_LAYOUT.backWallCenterY, box.backZ + 0.06]} receiveShadow>
      <boxGeometry args={[box.wallX * 2 + 0.12, ROOM_LAYOUT.backWallHeight, 0.08]} />
      <meshStandardMaterial color={theme.wall} map={maps.plaster} roughness={0.92} />
    </mesh>
    <mesh position={[-env.wallX, (env.wallTop + env.wallBottom) / 2, wallZ]} rotation={[0, 0.02, 0]} receiveShadow>
      <boxGeometry args={[0.2, wallH, wallDepth]} />
      <meshStandardMaterial color={theme.sideWall} map={maps.plaster} roughness={0.93} />
    </mesh>
    <mesh position={[env.wallX, (env.wallTop + env.wallBottom) / 2, wallZ]} rotation={[0, -0.02, 0]} receiveShadow>
      <boxGeometry args={[0.2, wallH, wallDepth]} />
      <meshStandardMaterial color={theme.sideWall} map={maps.plaster} roughness={0.93} />
    </mesh>
    <mesh position={[-box.wallX, 0.55, roomWallZ]} rotation={[0, 0.012, 0]} receiveShadow>
      <boxGeometry args={[0.12, 5.55, roomWallDepth]} />
      <meshStandardMaterial color={theme.sideWall} map={maps.plaster} roughness={0.9} />
    </mesh>
    <mesh position={[box.wallX, 0.55, roomWallZ]} rotation={[0, -0.012, 0]} receiveShadow>
      <boxGeometry args={[0.12, 5.55, roomWallDepth]} />
      <meshStandardMaterial color={theme.sideWall} map={maps.plaster} roughness={0.9} />
    </mesh>
    <mesh position={[0, env.floorTop + 0.055, box.backZ + 0.14]}><boxGeometry args={[box.wallX * 2 - 0.12, 0.11, 0.06]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.56} /></mesh>
    <mesh position={[-box.wallX + 0.08, env.floorTop + 0.055, roomWallZ]}><boxGeometry args={[0.055, 0.11, roomWallDepth - 0.2]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.58} /></mesh>
    <mesh position={[box.wallX - 0.08, env.floorTop + 0.055, roomWallZ]}><boxGeometry args={[0.055, 0.11, roomWallDepth - 0.2]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.58} /></mesh>
    <RoomWindow theme={theme} maps={maps} />
  </>;
}

function RoomWindow({ theme, maps }: { theme: RoomLook; maps: RoomMaps }) {
  return <group position={[-ROOM_BOX.wallX + 0.08, 0.58, ROOM_BOX.windowZ]} rotation={[0, Math.PI / 2, 0]}>
    <mesh position={[0, 0, -0.03]}><boxGeometry args={[1.72, 2.36, 0.08]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.42} /></mesh>
    <mesh position={[0, 0, 0.01]}><boxGeometry args={[1.48, 2.12, 0.035]} /><meshStandardMaterial color={theme.furniture} map={maps.woodFine} roughness={0.6} /></mesh>
    <mesh position={[0, 0, 0.035]}><boxGeometry args={[1.28, 1.88, 0.02]} /><meshStandardMaterial color={theme.light} emissive={theme.light} emissiveIntensity={0.48 * theme.brightness} roughness={0.26} /></mesh>
    <mesh position={[0, 0, 0.05]}><boxGeometry args={[0.04, 1.88, 0.018]} /><meshStandardMaterial color={theme.edge} roughness={0.48} /></mesh>
    <mesh position={[0, 0.08, 0.05]}><boxGeometry args={[1.28, 0.04, 0.018]} /><meshStandardMaterial color={theme.edge} roughness={0.48} /></mesh>
    <mesh position={[0, -1.12, 0.07]}><boxGeometry args={[1.68, 0.07, 0.14]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.46} /></mesh>
  </group>;
}

export function RoomFurniture({
  theme,
  objects,
  hideClosedBinder,
  binderAt,
  showLegacyBoxes,
  selectedObjectId,
  heldObjectId,
  objectPreviewRef,
  editing = false,
  onOpenBinder,
  onOpenStorage,
  onSelectZone,
  onSelectObject,
  onObjectPressStart,
  onObjectPressEnd,
  photoStringVisuals,
  onConfigurePhotoString,
}: {
  theme: RoomLook;
  objects: import("./roomObjects").RoomObjectInstance[];
  hideClosedBinder: boolean;
  photoStringVisuals?: (object: RoomObjectInstance) => ReactNode;
  onConfigurePhotoString?: (objectId: string) => void;
  binderAt?: { x: number; y: number; z: number } | null;
  showLegacyBoxes?: boolean;
  selectedObjectId?: string | null;
  heldObjectId?: string | null;
  objectPreviewRef?: MutableRefObject<RoomObjectInstance | null>;
  editing?: boolean;
  onOpenBinder?: () => void;
  onOpenStorage?: (objectId?: string) => void;
  onSelectZone?: (zone: CanonicalZoneKind, objectId?: string) => void;
  onSelectObject?: (objectId: string) => void;
  onObjectPressStart?: (objectId: string, pointerId?: number) => void;
  onObjectPressEnd?: (objectId: string) => void;
}) {
  const maps = useRoomMaps();
  const deskPresent = objects.some((item) => item.kind === "desk");
  return <>
    {objects.map((object) => (
      <FurniturePose
        key={object.id}
        object={object}
        objects={objects}
        held={heldObjectId === object.id}
        previewRef={objectPreviewRef}
        editing={editing}
        onSelectZone={onSelectZone}
        onSelectObject={onSelectObject}
        onObjectPressStart={onObjectPressStart}
        onObjectPressEnd={onObjectPressEnd}
        onOpenStorage={onOpenStorage}
        onConfigurePhotoString={onConfigurePhotoString}
      >
        {object.kind === "shelf" ? <ShelfUnit theme={theme} maps={maps} /> : null}
        {object.kind === "desk" ? <DeskUnit theme={theme} maps={maps} /> : null}
        {object.kind === "chair" ? <ChairUnit theme={theme} maps={maps} /> : null}
        {object.kind === "case" ? <CaseUnit theme={theme} maps={maps} /> : null}
        {object.kind === "archive" ? <ArchiveCrate theme={theme} maps={maps} /> : null}
        {object.kind === "rug" ? <Rug theme={theme} maps={maps} /> : null}
        {object.kind === "lamp" ? <FloorLamp theme={theme} /> : null}
        {object.kind === "table-lamp" ? <TableLamp theme={theme} /> : null}
        {object.kind === "large-plant" ? <LargePlant theme={theme} /> : null}
        {object.kind === "plant" ? <Plant theme={theme} maps={maps} /> : null}
        {object.kind === "photo-string" ? photoStringVisuals?.(object) : null}
        {object.kind === "wall-frame" ? <WallFrame theme={theme} maps={maps} /> : null}
      </FurniturePose>
    ))}
    {!hideClosedBinder && deskPresent && binderAt ? <ClosedBinder theme={theme} maps={maps} at={binderAt} objects={objects} previewRef={objectPreviewRef} onOpen={onOpenBinder} /> : null}
    {showLegacyBoxes ? <StorageBoxes theme={theme} maps={maps} /> : null}
  </>;
}

function FurniturePose({
  object,
  objects,
  held,
  previewRef,
  editing,
  onSelectZone,
  onSelectObject,
  onObjectPressStart,
  onObjectPressEnd,
  onOpenStorage,
  onConfigurePhotoString,
  children,
}: {
  object: RoomObjectInstance;
  objects: RoomObjectInstance[];
  held: boolean;
  previewRef?: MutableRefObject<RoomObjectInstance | null>;
  editing: boolean;
  onSelectZone?: (zone: CanonicalZoneKind, objectId?: string) => void;
  onSelectObject?: (objectId: string) => void;
  onObjectPressStart?: (objectId: string, pointerId?: number) => void;
  onObjectPressEnd?: (objectId: string) => void;
  onOpenStorage?: (objectId?: string) => void;
  onConfigurePhotoString?: (objectId: string) => void;
  children: ReactNode;
}) {
  const group = useRef<Group>(null);
  useFrame(() => {
    const mesh = group.current;
    if (!mesh) return;
    const live = resolveRoomObjectTransform(object, objects, previewRef?.current);
    mesh.position.set(live.x, live.y, live.z);
    mesh.rotation.set(0, (live.rotateY * Math.PI) / 180, 0);
  });
  const world = resolveRoomObjectTransform(object, objects);
  return <group
    ref={group}
    position={[world.x, world.y, world.z]}
    rotation={[0, (world.rotateY * Math.PI) / 180, 0]}
    onPointerDown={(event) => {
      if (!editing) return;
      event.stopPropagation();
      onObjectPressStart?.(object.id, event.pointerId);
    }}
    onPointerUp={(event) => {
      if (!editing) return;
      event.stopPropagation();
      onObjectPressEnd?.(object.id);
    }}
    onClick={(event) => {
      event.stopPropagation();
      if (editing) {
        onSelectObject?.(object.id);
        return;
      }
      if (object.kind === "photo-string") { onConfigurePhotoString?.(object.id); return; }
      if (object.kind === "archive") {
        if (onOpenStorage) onOpenStorage(object.id);
        else onSelectZone?.("archive", object.id);
        return;
      }
      if (object.kind === "shelf") onSelectZone?.("shelf", object.id);
      if (object.kind === "desk") onSelectZone?.("desk", object.id);
      if (object.kind === "case") onSelectZone?.("case", object.id);
    }}
  >
    {children}
  </group>;
}

function ShelfUnit({ theme, maps }: { theme: RoomLook; maps: RoomMaps }) {
  const boards = SHELF_BOARD_Y;
  return <group>
    <mesh position={[0, 0, -0.28]} castShadow receiveShadow><boxGeometry args={[2.18, 3.08, 0.05]} /><meshStandardMaterial color={theme.furniture} map={maps.woodFine} roughness={0.78} /></mesh>
    <mesh position={[-1.06, 0, 0.08]} castShadow><boxGeometry args={[0.055, 3.12, 0.68]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.56} /></mesh>
    <mesh position={[1.06, 0, 0.08]} castShadow><boxGeometry args={[0.055, 3.12, 0.68]} /><meshStandardMaterial color={theme.furniture} map={maps.woodFine} roughness={0.68} /></mesh>
    <mesh position={[0, 1.54, 0.08]} castShadow><boxGeometry args={[2.16, SHELF_ROOF_THICKNESS, 0.68]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.5} /></mesh>
    <mesh position={[0, -1.54, 0.06]} castShadow><boxGeometry args={[2.16, 0.07, 0.64]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.54} /></mesh>
    {boards.map((y) => (
      <group key={y} position={[0, y, 0.12]}>
        <mesh receiveShadow><boxGeometry args={[2.04, SHELF_BOARD_THICKNESS, 0.62]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.48} /></mesh>
        <EdgeLip width={2.04} color={theme.metal} depth={0.3} />
        <mesh position={[0, -0.028, 0.28]}><boxGeometry args={[2.04, 0.018, 0.04]} /><meshStandardMaterial color={theme.metal} roughness={0.4} metalness={0.22} /></mesh>
      </group>
    ))}
    <group position={[0, -1.53, 0.08]}><ContactShadow width={2.05} depth={0.72} opacity={0.18} /></group>
  </group>;
}

function DeskUnit({ theme, maps }: { theme: RoomLook; maps: RoomMaps }) {
  return <group>
    <mesh position={[0, 0.055, 0]} castShadow receiveShadow><boxGeometry args={[3.28, 0.055, 1.68]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.46} /></mesh>
    <EdgeLip width={3.22} color={theme.metal} depth={0.83} />
    <mesh position={[0, 0.018, 0]} receiveShadow><boxGeometry args={[3.12, 0.04, 1.52]} /><meshStandardMaterial color={theme.furniture} map={maps.woodFine} roughness={0.64} /></mesh>
    <mesh position={[0, 0.03, 0.82]}><boxGeometry args={[3.18, 0.03, 0.04]} /><meshStandardMaterial color={theme.metal} roughness={0.38} metalness={0.18} /></mesh>
    {([[-1.46, -0.58, -0.66], [1.46, -0.58, -0.66], [-1.46, -0.58, 0.64], [1.46, -0.58, 0.64]] as [number, number, number][]).map((pos) => (
      <mesh key={pos.join()} position={pos} castShadow><boxGeometry args={[0.07, 1.02, 0.07]} /><meshStandardMaterial color={theme.furniture} map={maps.woodFine} roughness={0.7} /></mesh>
    ))}
    <mesh position={[0.82, -0.42, 0.02]} castShadow receiveShadow><boxGeometry args={[1.18, 0.78, 1.28]} /><meshStandardMaterial color={theme.furniture} map={maps.woodFine} roughness={0.68} /></mesh>
    {DESK_DRAWER_CENTERS.map((y) => (
      <group key={y} position={[0.82, y, 0.66]}>
        <mesh><boxGeometry args={[1.08, 0.22, 0.04]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.5} /></mesh>
        <mesh position={[0, 0.07, 0.018]}><boxGeometry args={[1.08, 0.01, 0.01]} /><meshStandardMaterial color={theme.metal} roughness={0.34} metalness={0.16} /></mesh>
        <mesh position={[0, 0, 0.03]}><boxGeometry args={[0.22, 0.03, 0.03]} /><meshStandardMaterial color={theme.metal} roughness={0.28} metalness={0.42} /></mesh>
      </group>
    ))}
    <group position={[0, -1.26, 0]}><ContactShadow width={3.1} depth={1.55} opacity={0.17} /></group>
  </group>;
}

function ClosedBinder({
  theme,
  maps,
  at,
  objects,
  previewRef,
  onOpen,
}: {
  theme: RoomLook;
  maps: RoomMaps;
  at: { x: number; y: number; z: number };
  objects: RoomObjectInstance[];
  previewRef?: MutableRefObject<RoomObjectInstance | null>;
  onOpen?: () => void;
}) {
  const group = useRef<Group>(null);
  useFrame(() => {
    const mesh = group.current;
    if (!mesh) return;
    const preview = previewRef?.current;
    const desk = preview?.kind === "desk" ? preview : objects.find((item) => item.kind === "desk");
    if (!desk) return;
    const origin = objects.find((item) => item.kind === "desk");
    const dx = origin ? desk.x - origin.x : 0;
    const dy = origin ? desk.y - origin.y : 0;
    const dz = origin ? desk.z - origin.z : 0;
    mesh.position.set(at.x + dx, at.y + dy, at.z + dz);
  });
  return <group ref={group} position={[at.x, at.y, at.z]} rotation={[-0.18, -0.22, 0]} onClick={(event) => { event.stopPropagation(); onOpen?.(); }}>
    <mesh position={[0, 0.02, 0.02]}><boxGeometry args={[1.15, 1.02, 0.82]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    <mesh position={[-0.36, 0, 0]}><boxGeometry args={[0.07, 0.74, 0.52]} /><meshStandardMaterial color={theme.binder} map={maps.vinyl} roughness={0.38} /></mesh>
    <mesh position={[0.02, 0.01, -0.02]}><boxGeometry args={[0.64, 0.7, 0.48]} /><meshStandardMaterial color={theme.binder} map={maps.vinyl} roughness={0.48} /></mesh>
    <mesh position={[0.34, 0, 0.02]}><boxGeometry args={[0.06, 0.66, 0.44]} /><meshStandardMaterial color={theme.paper} map={maps.paper} roughness={0.86} /></mesh>
    <mesh position={[0.08, 0.02, 0.22]}><boxGeometry args={[0.46, 0.58, 0.05]} /><meshStandardMaterial color={theme.paper} map={maps.paper} roughness={0.88} /></mesh>
    <mesh position={[-0.08, 0.18, 0.24]}><boxGeometry args={[0.28, 0.08, 0.02]} /><meshStandardMaterial color={theme.edge} roughness={0.42} /></mesh>
  </group>;
}

function CaseUnit({ theme, maps }: { theme: RoomLook; maps: RoomMaps }) {
  return <group>
    <mesh position={[0, 0, -0.18]} castShadow receiveShadow><boxGeometry args={[1.48, 3.08, 0.05]} /><meshStandardMaterial color={theme.furniture} map={maps.woodFine} roughness={0.74} /></mesh>
    <mesh position={[-0.72, 0, 0.14]} castShadow><boxGeometry args={[0.055, 3.12, 0.62]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.52} /></mesh>
    <mesh position={[0.72, 0, 0.14]} castShadow><boxGeometry args={[0.055, 3.12, 0.62]} /><meshStandardMaterial color={theme.furniture} map={maps.woodFine} roughness={0.66} /></mesh>
    <mesh position={[0, 1.54, 0.14]} castShadow><boxGeometry args={[1.48, CASE_ROOF_THICKNESS, 0.62]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.46} /></mesh>
    <mesh position={[0, -1.54, 0.12]} castShadow><boxGeometry args={[1.48, 0.07, 0.58]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.5} /></mesh>
    {CASE_BOARD_Y.map((y) => (
      <group key={`case-${y}`} position={[0, y, 0.16]}>
        <mesh receiveShadow><boxGeometry args={[1.36, CASE_BOARD_THICKNESS, 0.56]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.44} /></mesh>
        <EdgeLip width={1.34} color={theme.metal} depth={0.26} />
      </group>
    ))}
    <mesh position={[0, 0.05, 0.34]}><boxGeometry args={[1.32, 2.72, 0.02]} /><meshStandardMaterial color="#d8ecec" roughness={0.12} metalness={0.18} transparent opacity={0.16} /></mesh>
    <group position={[0, -1.53, 0.08]}><ContactShadow width={1.42} depth={0.7} opacity={0.17} /></group>
  </group>;
}

function ArchiveCrate({ theme, maps }: { theme: RoomLook; maps: RoomMaps }) {
  return <group>
    <mesh position={[0, 0.22, 0]}><boxGeometry args={[2.15, 1.15, 1.55]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    <mesh castShadow receiveShadow><boxGeometry args={[1.72, 0.5, 1.08]} /><meshStandardMaterial color={theme.paper} map={maps.cardboard} roughness={0.9} /></mesh>
    {[-0.52, 0, 0.52].map((z) => (
      <mesh key={`slat-${z}`} position={[0, 0.02, z]}><boxGeometry args={[1.68, 0.46, 0.06]} /><meshStandardMaterial color={theme.paper} map={maps.cardboard} roughness={0.86} /></mesh>
    ))}
    {[-0.82, 0.82].map((x) => <mesh key={`crate-${x}`} position={[x, 0, 0]}><boxGeometry args={[0.06, 0.56, 1.12]} /><meshStandardMaterial color={theme.edge} map={maps.cardboard} roughness={0.72} /></mesh>)}
    <mesh position={[0, 0.34, 0.03]} ><boxGeometry args={[1.64, 0.05, 1.04]} /><meshStandardMaterial color={theme.paper} map={maps.cardboard} roughness={0.84} /></mesh>
    <mesh position={[0, 0.36, 0.52]}><boxGeometry args={[1.6, 0.01, 0.012]} /><meshStandardMaterial color={theme.edge} roughness={0.5} /></mesh>
    <mesh position={[0, 0.08, 0.56]}><boxGeometry args={[0.62, 0.16, 0.03]} /><meshStandardMaterial color={theme.paper} map={maps.paper} roughness={0.82} /></mesh>
    <group position={[0, -0.26, 0]}><ContactShadow width={1.78} depth={1.12} opacity={0.2} /></group>
  </group>;
}

function Rug({ theme, maps }: { theme: RoomLook; maps: RoomMaps }) {
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><boxGeometry args={[2.3, 1.48, 0.02]} /><meshStandardMaterial color={theme.accent} map={maps.fabric} roughness={0.97} /></mesh>
    <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}><boxGeometry args={[1.96, 1.18, 0.012]} /><meshStandardMaterial color={theme.wallAccent} map={maps.fabric} roughness={0.95} /></mesh>
  </group>;
}

function FloorLamp({ theme }: { theme: RoomLook }) {
  return <group>
    <mesh position={[0, 0.04, 0]}><cylinderGeometry args={[0.16, 0.2, 0.06, 12]} /><meshStandardMaterial color={theme.metal} roughness={0.32} metalness={0.46} /></mesh>
    <mesh position={[0, 1.05, 0]} castShadow><cylinderGeometry args={[0.03, 0.04, 2.02, 8]} /><meshStandardMaterial color={theme.metal} roughness={0.36} metalness={0.38} /></mesh>
    <mesh position={[0, 2.12, 0]}><cylinderGeometry args={[0.22, 0.28, 0.28, 12]} /><meshStandardMaterial color={theme.paper} roughness={0.74} /></mesh>
    <mesh position={[0, 2.02, 0]}><sphereGeometry args={[0.12, 12, 10]} /><meshStandardMaterial color={theme.light} emissive={theme.light} emissiveIntensity={0.5 * theme.brightness} roughness={0.24} /></mesh>
    <ContactShadow width={0.42} depth={0.42} opacity={0.14} />
  </group>;
}

function WallFrame({ theme, maps }: { theme: RoomLook; maps: RoomMaps }) {
  return <group>
    <mesh position={[0, 0, 0]}><boxGeometry args={[1.28, 1.48, 0.03]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.5} /></mesh>
    <mesh position={[0, 0, 0.03]}><boxGeometry args={[1.1, 1.3, 0.02]} /><meshStandardMaterial color={theme.wallAccent} map={maps.paper} roughness={0.78} /></mesh>
  </group>;
}

function Plant({ theme, maps }: { theme: RoomLook; maps: RoomMaps }) {
  return <group>
    <mesh position={[0, 0.1, 0]} castShadow><cylinderGeometry args={[0.13, 0.1, 0.2, 12]} /><meshStandardMaterial color="#fff7ef" roughness={0.42} /></mesh>
    <mesh position={[0, 0.199, 0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[0.115,12]} /><meshStandardMaterial color="#674e3d" roughness={1} /></mesh>
    {[[0,0.43,0],[-0.09,0.36,0.04],[0.09,0.39,-0.03],[-0.04,0.4,-0.08],[0.06,0.34,0.08]].map(([x,y,z],i)=><group key={i}>
      <mesh position={[x,(y+0.2)/2,z]}><cylinderGeometry args={[0.007,0.009,y-0.2,5]} /><meshStandardMaterial color="#5a7860" roughness={0.9} /></mesh>
      <mesh position={[x+0.025,0.26,z]} scale={[0.045,0.012,0.025]} rotation={[0,0,-0.4]}><sphereGeometry args={[1,6,4]} /><meshStandardMaterial color="#668a68" /></mesh>
      <group position={[x,y,z]}>{[0,1,2,3,4].map(petal=><mesh key={petal} position={[Math.cos(petal*Math.PI*2/5)*0.025,Math.sin(petal*Math.PI*2/5)*0.025,0]}><sphereGeometry args={[0.032,6,4]} /><meshStandardMaterial color={i%2 ? "#e6bac7" : "#f1cbd5"} roughness={0.82} /></mesh>)}<mesh position={[0,0,0.025]}><sphereGeometry args={[0.014,6,4]} /><meshStandardMaterial color="#e7c985" /></mesh></group>
    </group>)}
  </group>;
}

function TableLamp({ theme }: { theme: RoomLook }) {
  return <group>
    <mesh position={[0,0.025,0]} castShadow><cylinderGeometry args={[0.12,0.14,0.05,12]} /><meshStandardMaterial color={theme.edge} roughness={0.5} /></mesh>
    <mesh position={[0,0.17,0]}><cylinderGeometry args={[0.024,0.035,0.25,8]} /><meshStandardMaterial color={theme.metal} metalness={0.3} roughness={0.4} /></mesh>
    <mesh position={[0,0.35,0]} castShadow><cylinderGeometry args={[0.12,0.18,0.22,12]} /><meshStandardMaterial color={theme.paper} roughness={0.85} /></mesh>
    <mesh position={[0,0.25,0]}><sphereGeometry args={[0.065,8,6]} /><meshStandardMaterial color={theme.light} emissive={theme.light} emissiveIntensity={0.18} /></mesh>
  </group>;
}

/** Static arching fronds with paired narrow leaflets and visible gaps. */
function LargePlant({ theme }: { theme: RoomLook }) {
  const geometry = useMemo(() => {
    const points = [[0,0.4],[0.08,1.05],[0.28,1.55],[0.52,1.85],[0.76,1.7]];
    const stems: number[] = [], leaves: number[] = [];
    for (let i=1;i<points.length;i++) {
      const [x,y]=points[i], [px,py]=points[i-1];
      stems.push(px,py,0,x,y,0);
      if(i===1) continue;
      for(const side of [-1,1]) for(const t of [0.35,0.75]) {
        const cx=px+(x-px)*t, cy=py+(y-py)*t;
        // Tapered paired leaflets, two triangles each, authored static negative space.
        const root=[cx,cy,0], left=[cx+0.06,cy+0.025,side*0.12], tip=[cx+0.24,cy-0.03,side*0.28], right=[cx+0.1,cy-0.025,side*0.12];
        leaves.push(...root,...left,...tip,...root,...tip,...right);
      }
    }
    const stem = new BufferGeometry().setAttribute("position",new Float32BufferAttribute(stems,3));
    const leaf = new BufferGeometry().setAttribute("position",new Float32BufferAttribute(leaves,3));leaf.computeVertexNormals();
    return { stem, leaf };
  }, []);
  useEffect(() => () => { geometry.stem.dispose(); geometry.leaf.dispose(); }, [geometry]);
  return <group>
    <mesh position={[0,0.2,0]} castShadow><cylinderGeometry args={[0.25,0.2,0.4,12]} /><meshStandardMaterial color={theme.paper} roughness={0.62} /></mesh>
    {[0,0.8,1.7,2.5,3.4,4.3,5.2,5.9].map((yaw,frond)=><group key={frond} rotation={[0,yaw,0]} scale={[1,frond%3===0?1.16:frond%3===1?0.92:1,1]}>
      <lineSegments><primitive attach="geometry" object={geometry.stem} /><lineBasicMaterial color="#587451" /></lineSegments>
      <mesh><primitive attach="geometry" object={geometry.leaf} /><meshStandardMaterial side={DoubleSide} color={frond%2?"#5d8058":"#6d9264"} roughness={0.94} /></mesh>
    </group>)}
  </group>;
}

function StorageBoxes({ theme, maps }: { theme: RoomLook; maps: RoomMaps }) {
  return <group position={[layoutX(-2.55), -1.98, layoutZ(0.15)]}>
    <mesh position={[0, 0.12, 0]} castShadow><boxGeometry args={[0.42, 0.24, 0.32]} /><meshStandardMaterial color={theme.paper} map={maps.cardboard} roughness={0.86} /></mesh>
    <mesh position={[0.38, 0.16, 0.08]} castShadow><boxGeometry args={[0.3, 0.32, 0.24]} /><meshStandardMaterial color={theme.accent} map={maps.cardboard} roughness={0.9} /></mesh>
    <mesh position={[0.18, 0.3, 0.02]}><boxGeometry args={[0.26, 0.08, 0.2]} /><meshStandardMaterial color={theme.edge} map={maps.cardboard} roughness={0.62} /></mesh>
    <mesh position={[0, 0.25, 0.16]}><boxGeometry args={[0.4, 0.01, 0.01]} /><meshStandardMaterial color={theme.edge} roughness={0.48} /></mesh>
    <ContactShadow width={0.82} depth={0.46} opacity={0.15} />
  </group>;
}

function ChairUnit({ theme, maps }: { theme: RoomLook; maps: RoomMaps }) {
  const upholstery = mixHex(theme.furniture, theme.edge, 0.62);
  return <group>
    <ChairCushion position={[0, -0.2, 0]} size={[1.32, 0.3, 1.12]} color={upholstery} fabric={maps.fabric} />
    <ChairCushion position={[0, 0.04, 0.06]} size={[0.98, 0.22, 0.92]} color={upholstery} fabric={maps.fabric} />
    <group position={[0, 0.53, -0.46]} rotation={[-0.14, 0, 0]}>
      <ChairCushion size={[1.22, 0.98, 0.26]} color={upholstery} fabric={maps.fabric} />
    </group>
    {[-0.6, 0.6].map((x) => <ChairCushion key={x} position={[x, 0.18, 0.02]} size={[0.24, 0.5, 1.12]} color={upholstery} fabric={maps.fabric} />)}
    {[-0.51, 0.51].flatMap((x) => [-0.42, 0.42].map((z) => <mesh key={`${x}:${z}`} position={[x, -0.48, z]} castShadow><cylinderGeometry args={[0.065, 0.075, 0.26, 8]} /><meshStandardMaterial color={theme.furniture} map={maps.woodFine} roughness={0.8} /></mesh>))}
  </group>;
}

/** Small beveled cushions, static geometry with a flat usable seat center. */
function ChairCushion({ size, position = [0, 0, 0], color, fabric }: {
  size: [number, number, number]; position?: [number, number, number]; color: string; fabric: RoomMaps["fabric"];
}) {
  const [width, height, depth] = size;
  const geometry = useMemo(() => new RoundedBoxGeometry(width, height, depth, 2, 0.065), [width, height, depth]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh position={position} castShadow receiveShadow>
    <primitive attach="geometry" object={geometry} />
    <meshStandardMaterial color={color} map={fabric} roughness={0.96} />
  </mesh>;
}
