/* eslint-disable react/no-unknown-property -- React Three Fiber JSX uses Three.js properties. */
import { useMemo } from "react";
import { useLoader } from "@react-three/fiber/native";
import { Asset } from "expo-asset";
import { RepeatWrapping, SRGBColorSpace, Texture, TextureLoader } from "three";

export const ROOM_TEXTURE_MODULES = {
  plaster: require("../../assets/room/plaster.png"),
  woodFloor: require("../../assets/room/wood-floor.png"),
  woodFine: require("../../assets/room/wood-fine.png"),
  fabric: require("../../assets/room/fabric.png"),
  cardboard: require("../../assets/room/cardboard.png"),
  vinyl: require("../../assets/room/vinyl.png"),
  paper: require("../../assets/room/paper.png"),
} as const;

const ROOM_TEXTURE_URIS = Object.fromEntries(
  Object.entries(ROOM_TEXTURE_MODULES).map(([key, mod]) => {
    const asset = Asset.fromModule(mod);
    return [key, asset.localUri ?? asset.uri];
  }),
) as Record<keyof typeof ROOM_TEXTURE_MODULES, string>;

export const ROOM_TEXTURE_BOUNDS = {
  maxEdge: 256,
  count: 7,
} as const;

function prep(texture: Texture, repeatX: number, repeatY: number) {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 2;
  texture.needsUpdate = true;
  return texture;
}

export type RoomMaps = {
  plaster: Texture;
  woodFloor: Texture;
  woodFine: Texture;
  fabric: Texture;
  cardboard: Texture;
  vinyl: Texture;
  paper: Texture;
};

export function useRoomMaps(): RoomMaps {
  const plaster = useLoader(TextureLoader, ROOM_TEXTURE_URIS.plaster);
  const woodFloor = useLoader(TextureLoader, ROOM_TEXTURE_URIS.woodFloor);
  const woodFine = useLoader(TextureLoader, ROOM_TEXTURE_URIS.woodFine);
  const fabric = useLoader(TextureLoader, ROOM_TEXTURE_URIS.fabric);
  const cardboard = useLoader(TextureLoader, ROOM_TEXTURE_URIS.cardboard);
  const vinyl = useLoader(TextureLoader, ROOM_TEXTURE_URIS.vinyl);
  const paper = useLoader(TextureLoader, ROOM_TEXTURE_URIS.paper);
  return useMemo(() => ({
    plaster: prep(plaster, 3.2, 2.4),
    woodFloor: prep(woodFloor, 2.4, 5.2),
    woodFine: prep(woodFine, 2.6, 1.8),
    fabric: prep(fabric, 3.1, 2.2),
    cardboard: prep(cardboard, 2.1, 1.6),
    vinyl: prep(vinyl, 1.5, 1.2),
    paper: prep(paper, 2, 2),
  }), [plaster, woodFloor, woodFine, fabric, cardboard, vinyl, paper]);
}

export function ContactShadow({
  width,
  depth,
  opacity = 0.16,
}: {
  width: number;
  depth: number;
  opacity?: number;
}) {
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} renderOrder={-1}>
    <planeGeometry args={[width, depth]} />
    <meshBasicMaterial color="#1a1214" transparent opacity={opacity} depthWrite={false} />
  </mesh>;
}

export function EdgeLip({
  width,
  color,
  depth = 0.012,
}: {
  width: number;
  color: string;
  depth?: number;
}) {
  return <mesh position={[0, 0.01, depth]}>
    <boxGeometry args={[width, 0.01, 0.012]} />
    <meshStandardMaterial color={color} roughness={0.36} metalness={0.08} />
  </mesh>;
}
