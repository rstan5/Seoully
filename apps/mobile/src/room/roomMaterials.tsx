/* eslint-disable react/no-unknown-property -- React Three Fiber JSX uses Three.js properties. */
import { useLayoutEffect, useMemo } from "react";
import { useLoader, useThree } from "@react-three/fiber/native";
import { Asset } from "expo-asset";
import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from "three";
import {
  ROOM_ANISOTROPY_LARGE_CAP,
  ROOM_ANISOTROPY_SMALL_CAP,
  ROOM_TEXTURE_MAX_EDGE,
  ROOM_TEXTURE_REPEAT,
} from "./roomRendererQuality";

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
  maxEdge: ROOM_TEXTURE_MAX_EDGE,
  count: 7,
} as const;

function capAnisotropy(requested: number, maxAnisotropy: number) {
  return Math.max(1, Math.min(requested, maxAnisotropy || 1));
}

function queryMaxAnisotropy(gl: { capabilities?: { getMaxAnisotropy?: () => number } }) {
  try {
    const value = gl.capabilities?.getMaxAnisotropy?.();
    return typeof value === "number" && value > 0 ? value : 1;
  } catch {
    return 1;
  }
}

function prep(texture: Texture, repeatX: number, repeatY: number) {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 1;
  texture.needsUpdate = true;
  return texture;
}

export function prepCollectibleTexture(texture: Texture) {
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 1;
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
    plaster: prep(plaster, ROOM_TEXTURE_REPEAT.plaster[0], ROOM_TEXTURE_REPEAT.plaster[1]),
    woodFloor: prep(woodFloor, ROOM_TEXTURE_REPEAT.woodFloor[0], ROOM_TEXTURE_REPEAT.woodFloor[1]),
    woodFine: prep(woodFine, ROOM_TEXTURE_REPEAT.woodFine[0], ROOM_TEXTURE_REPEAT.woodFine[1]),
    fabric: prep(fabric, ROOM_TEXTURE_REPEAT.fabric[0], ROOM_TEXTURE_REPEAT.fabric[1]),
    cardboard: prep(cardboard, ROOM_TEXTURE_REPEAT.cardboard[0], ROOM_TEXTURE_REPEAT.cardboard[1]),
    vinyl: prep(vinyl, ROOM_TEXTURE_REPEAT.vinyl[0], ROOM_TEXTURE_REPEAT.vinyl[1]),
    paper: prep(paper, ROOM_TEXTURE_REPEAT.paper[0], ROOM_TEXTURE_REPEAT.paper[1]),
  }), [plaster, woodFloor, woodFine, fabric, cardboard, vinyl, paper]);
}

export function RoomTextureQuality({ maps }: { maps: RoomMaps }) {
  const gl = useThree((state) => state.gl);
  useLayoutEffect(() => {
    const max = queryMaxAnisotropy(gl);
    const large = capAnisotropy(ROOM_ANISOTROPY_LARGE_CAP, max);
    const small = capAnisotropy(ROOM_ANISOTROPY_SMALL_CAP, max);
    const apply = (texture: Texture, anisotropy: number) => {
      texture.anisotropy = anisotropy;
      texture.needsUpdate = true;
    };
    apply(maps.woodFloor, large);
    apply(maps.plaster, large);
    apply(maps.woodFine, large);
    apply(maps.fabric, large);
    apply(maps.cardboard, small);
    apply(maps.vinyl, small);
    apply(maps.paper, small);
  }, [gl, maps]);
  return null;
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
