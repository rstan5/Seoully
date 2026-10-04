/* eslint-disable react/no-unknown-property -- React Three Fiber JSX uses Three.js properties. */
import { DESK_BINDER_AT } from "./camera";
import { ROOM_BOX, WORLD_ENVELOPE } from "./envelope";
import { layoutX, layoutZ } from "./roomLayout";
import { ContactShadow, EdgeLip, useRoomMaps, type RoomMaps } from "./roomMaterials";
import type { RoomLook } from "./roomStyle";
import type { CanonicalZoneKind } from "./worldView";

export function RoomShell({ theme, onSelectZone }: { theme: RoomLook; onSelectZone?: (zone: CanonicalZoneKind) => void }) {
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
    <mesh position={[0, env.floorTop - floorH / 2, floorZ]} receiveShadow>
      <boxGeometry args={[env.floorX * 2, floorH, floorDepth]} />
      <meshStandardMaterial color={theme.floor} map={maps.woodFloor} roughness={0.88} roughnessMap={maps.woodFloor} />
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
    <mesh position={[0, 0.62, box.backZ + 0.06]} receiveShadow>
      <boxGeometry args={[box.wallX * 2 + 0.12, 5.85, 0.08]} />
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
    <mesh position={[layoutX(1.55), 0.88, box.backZ + 0.12]}><boxGeometry args={[1.28, 1.48, 0.03]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.5} /></mesh>
    <mesh position={[layoutX(1.55), 0.88, box.backZ + 0.15]}><boxGeometry args={[1.1, 1.3, 0.02]} /><meshStandardMaterial color={theme.wallAccent} map={maps.paper} roughness={0.78} /></mesh>
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
  hideClosedBinder,
  onOpenBinder,
  onOpenStorage,
  onSelectZone,
}: {
  theme: RoomLook;
  hideClosedBinder: boolean;
  onOpenBinder?: () => void;
  onOpenStorage?: () => void;
  onSelectZone?: (zone: CanonicalZoneKind) => void;
}) {
  const maps = useRoomMaps();
  return <>
    <ShelfUnit theme={theme} maps={maps} onSelect={() => onSelectZone?.("shelf")} />
    <DeskUnit theme={theme} maps={maps} onSelect={() => onSelectZone?.("desk")} />
    {!hideClosedBinder ? <ClosedBinder theme={theme} maps={maps} onOpen={onOpenBinder} /> : null}
    <CaseUnit theme={theme} maps={maps} onSelect={() => onSelectZone?.("case")} />
    <ArchiveCrate theme={theme} maps={maps} onOpen={onOpenStorage} onSelect={() => onSelectZone?.("archive")} />
    <Rug theme={theme} maps={maps} />
    <FloorLamp theme={theme} />
    <Plant theme={theme} maps={maps} />
    <StorageBoxes theme={theme} maps={maps} />
  </>;
}

function ShelfUnit({ theme, maps, onSelect }: { theme: RoomLook; maps: RoomMaps; onSelect: () => void }) {
  const boards = [-1.45, -0.55, 0.35, 1.18];
  return <group position={[layoutX(-3.15), -0.55, layoutZ(-3.78)]} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
    <mesh position={[0, 0, -0.28]} castShadow receiveShadow><boxGeometry args={[2.18, 3.08, 0.05]} /><meshStandardMaterial color={theme.furniture} map={maps.woodFine} roughness={0.78} /></mesh>
    <mesh position={[-1.06, 0, 0.08]} castShadow><boxGeometry args={[0.055, 3.12, 0.68]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.56} /></mesh>
    <mesh position={[1.06, 0, 0.08]} castShadow><boxGeometry args={[0.055, 3.12, 0.68]} /><meshStandardMaterial color={theme.furniture} map={maps.woodFine} roughness={0.68} /></mesh>
    <mesh position={[0, 1.54, 0.08]} castShadow><boxGeometry args={[2.16, 0.055, 0.68]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.5} /></mesh>
    <mesh position={[0, -1.54, 0.06]} castShadow><boxGeometry args={[2.16, 0.07, 0.64]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.54} /></mesh>
    {boards.map((y) => (
      <group key={y} position={[0, y + 0.55, 0.12]}>
        <mesh receiveShadow><boxGeometry args={[2.04, 0.04, 0.62]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.48} /></mesh>
        <EdgeLip width={2.04} color={theme.metal} depth={0.3} />
        <mesh position={[0, -0.028, 0.28]}><boxGeometry args={[2.04, 0.018, 0.04]} /><meshStandardMaterial color={theme.metal} roughness={0.4} metalness={0.22} /></mesh>
      </group>
    ))}
    <group position={[0, -1.53, 0.08]}><ContactShadow width={2.05} depth={0.72} opacity={0.18} /></group>
  </group>;
}

function DeskUnit({ theme, maps, onSelect }: { theme: RoomLook; maps: RoomMaps; onSelect: () => void }) {
  return <group position={[layoutX(1.45), -0.82, layoutZ(-2.85)]} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
    <mesh position={[0, 0.055, 0]} castShadow receiveShadow><boxGeometry args={[3.28, 0.055, 1.68]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.46} /></mesh>
    <EdgeLip width={3.22} color={theme.metal} depth={0.83} />
    <mesh position={[0, 0.018, 0]} receiveShadow><boxGeometry args={[3.12, 0.04, 1.52]} /><meshStandardMaterial color={theme.furniture} map={maps.woodFine} roughness={0.64} /></mesh>
    <mesh position={[0, 0.03, 0.82]}><boxGeometry args={[3.18, 0.03, 0.04]} /><meshStandardMaterial color={theme.metal} roughness={0.38} metalness={0.18} /></mesh>
    {([[-1.46, -0.58, -0.66], [1.46, -0.58, -0.66], [-1.46, -0.58, 0.64], [1.46, -0.58, 0.64]] as [number, number, number][]).map((pos) => (
      <mesh key={pos.join()} position={pos} castShadow><boxGeometry args={[0.07, 1.02, 0.07]} /><meshStandardMaterial color={theme.furniture} map={maps.woodFine} roughness={0.7} /></mesh>
    ))}
    <mesh position={[0.82, -0.42, 0.02]} castShadow receiveShadow><boxGeometry args={[1.18, 0.78, 1.28]} /><meshStandardMaterial color={theme.furniture} map={maps.woodFine} roughness={0.68} /></mesh>
    {[0.18, -0.08, -0.34].map((y) => (
      <group key={y} position={[0.82, y, 0.66]}>
        <mesh><boxGeometry args={[1.08, 0.22, 0.04]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.5} /></mesh>
        <mesh position={[0, 0.07, 0.018]}><boxGeometry args={[1.08, 0.01, 0.01]} /><meshStandardMaterial color={theme.metal} roughness={0.34} metalness={0.16} /></mesh>
        <mesh position={[0, 0, 0.03]}><boxGeometry args={[0.22, 0.03, 0.03]} /><meshStandardMaterial color={theme.metal} roughness={0.28} metalness={0.42} /></mesh>
      </group>
    ))}
    <group position={[0, -1.26, 0]}><ContactShadow width={3.1} depth={1.55} opacity={0.17} /></group>
  </group>;
}

function ClosedBinder({ theme, maps, onOpen }: { theme: RoomLook; maps: RoomMaps; onOpen?: () => void }) {
  return <group position={[DESK_BINDER_AT.x, DESK_BINDER_AT.y, DESK_BINDER_AT.z]} rotation={[-0.18, -0.22, 0]} onClick={(event) => { event.stopPropagation(); onOpen?.(); }}>
    <mesh position={[0, 0.02, 0.02]}><boxGeometry args={[1.15, 1.02, 0.82]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    <mesh position={[-0.36, 0, 0]}><boxGeometry args={[0.07, 0.74, 0.52]} /><meshStandardMaterial color={theme.binder} map={maps.vinyl} roughness={0.38} /></mesh>
    <mesh position={[0.02, 0.01, -0.02]}><boxGeometry args={[0.64, 0.7, 0.48]} /><meshStandardMaterial color={theme.binder} map={maps.vinyl} roughness={0.48} /></mesh>
    <mesh position={[0.34, 0, 0.02]}><boxGeometry args={[0.06, 0.66, 0.44]} /><meshStandardMaterial color={theme.paper} map={maps.paper} roughness={0.86} /></mesh>
    <mesh position={[0.08, 0.02, 0.22]}><boxGeometry args={[0.46, 0.58, 0.05]} /><meshStandardMaterial color={theme.paper} map={maps.paper} roughness={0.88} /></mesh>
    <mesh position={[-0.08, 0.18, 0.24]}><boxGeometry args={[0.28, 0.08, 0.02]} /><meshStandardMaterial color={theme.edge} roughness={0.42} /></mesh>
  </group>;
}

function CaseUnit({ theme, maps, onSelect }: { theme: RoomLook; maps: RoomMaps; onSelect: () => void }) {
  return <group position={[layoutX(3.65), -0.55, layoutZ(-3.78)]} onClick={(event) => { event.stopPropagation(); onSelect(); }}>
    <mesh position={[0, 0, -0.18]} castShadow receiveShadow><boxGeometry args={[1.48, 3.08, 0.05]} /><meshStandardMaterial color={theme.furniture} map={maps.woodFine} roughness={0.74} /></mesh>
    <mesh position={[-0.72, 0, 0.14]} castShadow><boxGeometry args={[0.055, 3.12, 0.62]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.52} /></mesh>
    <mesh position={[0.72, 0, 0.14]} castShadow><boxGeometry args={[0.055, 3.12, 0.62]} /><meshStandardMaterial color={theme.furniture} map={maps.woodFine} roughness={0.66} /></mesh>
    <mesh position={[0, 1.54, 0.14]} castShadow><boxGeometry args={[1.48, 0.05, 0.62]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.46} /></mesh>
    <mesh position={[0, -1.54, 0.12]} castShadow><boxGeometry args={[1.48, 0.07, 0.58]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.5} /></mesh>
    {[-1.48, -0.55, 0.43, 1.28].map((y) => (
      <group key={`case-${y}`} position={[0, y + 0.55, 0.16]}>
        <mesh receiveShadow><boxGeometry args={[1.36, 0.035, 0.56]} /><meshStandardMaterial color={theme.edge} map={maps.woodFine} roughness={0.44} /></mesh>
        <EdgeLip width={1.34} color={theme.metal} depth={0.26} />
      </group>
    ))}
    <mesh position={[0, 0.05, 0.34]}><boxGeometry args={[1.32, 2.72, 0.02]} /><meshStandardMaterial color="#d8ecec" roughness={0.12} metalness={0.18} transparent opacity={0.16} /></mesh>
    <group position={[0, -1.53, 0.08]}><ContactShadow width={1.42} depth={0.7} opacity={0.17} /></group>
  </group>;
}

function ArchiveCrate({ theme, maps, onOpen, onSelect }: { theme: RoomLook; maps: RoomMaps; onOpen?: () => void; onSelect: () => void }) {
  return <group position={[layoutX(-1.2), -1.86, layoutZ(-0.65)]} onClick={(event) => { event.stopPropagation(); if (onOpen) onOpen(); else onSelect(); }}>
    <mesh position={[0, 0.22, 0]}><boxGeometry args={[2.15, 1.15, 1.55]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    <mesh castShadow receiveShadow><boxGeometry args={[1.72, 0.5, 1.08]} /><meshStandardMaterial color={theme.paper} map={maps.cardboard} roughness={0.9} /></mesh>
    {[-0.52, 0, 0.52].map((z) => (
      <mesh key={`slat-${z}`} position={[0, 0.02, z]}><boxGeometry args={[1.68, 0.46, 0.06]} /><meshStandardMaterial color={theme.paper} map={maps.cardboard} roughness={0.86} /></mesh>
    ))}
    {[-0.82, 0.82].map((x) => <mesh key={`crate-${x}`} position={[x, 0, 0]}><boxGeometry args={[0.06, 0.56, 1.12]} /><meshStandardMaterial color={theme.edge} map={maps.cardboard} roughness={0.72} /></mesh>)}
    <mesh position={[0, 0.34, 0.03]} rotation={[-0.1, 0, 0]}><boxGeometry args={[1.64, 0.05, 1.04]} /><meshStandardMaterial color={theme.paper} map={maps.cardboard} roughness={0.84} /></mesh>
    <mesh position={[0, 0.36, 0.52]}><boxGeometry args={[1.6, 0.01, 0.012]} /><meshStandardMaterial color={theme.edge} roughness={0.5} /></mesh>
    <mesh position={[0, 0.08, 0.56]}><boxGeometry args={[0.62, 0.16, 0.03]} /><meshStandardMaterial color={theme.paper} map={maps.paper} roughness={0.82} /></mesh>
    <group position={[0, -0.26, 0]}><ContactShadow width={1.78} depth={1.12} opacity={0.2} /></group>
  </group>;
}

function Rug({ theme, maps }: { theme: RoomLook; maps: RoomMaps }) {
  return <group position={[layoutX(0.22), -2.05, layoutZ(-1.15)]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><boxGeometry args={[2.3, 1.48, 0.02]} /><meshStandardMaterial color={theme.accent} map={maps.fabric} roughness={0.97} /></mesh>
    <mesh position={[0, 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}><boxGeometry args={[1.96, 1.18, 0.012]} /><meshStandardMaterial color={theme.wallAccent} map={maps.fabric} roughness={0.95} /></mesh>
  </group>;
}

function FloorLamp({ theme }: { theme: RoomLook }) {
  return <group position={[layoutX(-3.72), -2.08, layoutZ(-0.58)]}>
    <mesh position={[0, 0.04, 0]}><cylinderGeometry args={[0.16, 0.2, 0.06, 12]} /><meshStandardMaterial color={theme.metal} roughness={0.32} metalness={0.46} /></mesh>
    <mesh position={[0, 1.05, 0]} castShadow><cylinderGeometry args={[0.03, 0.04, 2.02, 8]} /><meshStandardMaterial color={theme.metal} roughness={0.36} metalness={0.38} /></mesh>
    <mesh position={[0, 2.12, 0]}><cylinderGeometry args={[0.22, 0.28, 0.28, 12]} /><meshStandardMaterial color={theme.paper} roughness={0.74} /></mesh>
    <mesh position={[0, 2.02, 0]}><sphereGeometry args={[0.12, 12, 10]} /><meshStandardMaterial color={theme.light} emissive={theme.light} emissiveIntensity={0.5 * theme.brightness} roughness={0.24} /></mesh>
    <ContactShadow width={0.42} depth={0.42} opacity={0.14} />
  </group>;
}

function Plant({ theme, maps }: { theme: RoomLook; maps: RoomMaps }) {
  return <group position={[layoutX(3.42), -1.95, layoutZ(-1.62)]}>
    <mesh position={[0, 0.12, 0]} castShadow><cylinderGeometry args={[0.14, 0.12, 0.24, 10]} /><meshStandardMaterial color={theme.furniture} map={maps.woodFine} roughness={0.72} /></mesh>
    <mesh position={[0, 0.38, 0]}><sphereGeometry args={[0.22, 12, 10]} /><meshStandardMaterial color="#4a6a52" roughness={0.9} /></mesh>
    <mesh position={[0.12, 0.52, 0.04]}><sphereGeometry args={[0.14, 10, 8]} /><meshStandardMaterial color="#5a7a60" roughness={0.88} /></mesh>
    <mesh position={[-0.1, 0.48, -0.06]}><sphereGeometry args={[0.12, 10, 8]} /><meshStandardMaterial color="#3e5a46" roughness={0.92} /></mesh>
    <ContactShadow width={0.38} depth={0.36} opacity={0.14} />
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
