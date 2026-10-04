import {
  CAMERA_FOV_DEG,
  DESK_BINDER_AT,
  OPEN_BINDER_LIFT,
  PORTRAIT_ASPECT,
  type CameraPose,
} from "./camera";
import { extentsForGeometry, type NativeRepresentationKind } from "./representation";

export type RoomVec = { x: number; y: number; z: number };

export type FrontFaceAxis = "+x" | "+z";

/** Portrait overlay reservations as fractions of the full viewport. */
export type ViewportReservations = {
  top: number;
  bottom: number;
  side: number;
};

export const INSPECT_RESERVATIONS: ViewportReservations = {
  top: 0.13,
  bottom: 0.2,
  side: 0.07,
};

export const BINDER_RESERVATIONS: ViewportReservations = {
  top: 0.12,
  bottom: 0.12,
  side: 0.05,
};

export const BINDER_CARD_RESERVATIONS: ViewportReservations = {
  top: 0.13,
  bottom: 0.18,
  side: 0.08,
};

/** Hero fill — readable, with Room still visible around the object. */
export const INSPECT_FILL = 0.58;
export const BINDER_FILL = 0.86;
export const BINDER_CARD_FILL = 0.52;

export const BINDER_PAGE_W = 1.02;
export const BINDER_PAGE_H = 1.22;
export const BINDER_SPINE_W = 0.15;
export const BINDER_CARD_W = 0.24;
export const BINDER_CARD_H = 0.37;
export const BINDER_V_ANGLE = 0.12;

export function frontFaceAxis(geometry: NativeRepresentationKind): FrontFaceAxis {
  switch (geometry) {
    case "album":
    case "book":
    case "disc-case":
      return "+x";
    default:
      return "+z";
  }
}

/**
 * Extra local Euler that turns the textured/hero face toward a +Z camera.
 * Album/book/disc covers live on +X; cards/posters/vinyl already face +Z.
 */
export function inspectionOrientationDelta(geometry: NativeRepresentationKind): RoomVec {
  if (frontFaceAxis(geometry) === "+x") {
    return { x: -0.1, y: -Math.PI / 2, z: 0 };
  }
  if (geometry === "photocard" || geometry === "ticket") {
    return { x: 0.05, y: -0.06, z: 0 };
  }
  if (geometry === "poster") {
    return { x: -0.04, y: 0, z: 0 };
  }
  return { x: -0.05, y: -0.04, z: 0 };
}

/** Face size after the cover/image is turned toward the camera. */
export function presentedFaceSize(geometry: NativeRepresentationKind, scale = 1) {
  const extents = extentsForGeometry(geometry);
  if (frontFaceAxis(geometry) === "+x") {
    return { width: extents.z * scale, height: extents.y * scale, depth: extents.x * scale };
  }
  return { width: extents.x * scale, height: extents.y * scale, depth: extents.z * scale };
}

export function binderSpreadSize() {
  return {
    width: BINDER_PAGE_W * 2 + BINDER_SPINE_W,
    height: BINDER_PAGE_H,
  };
}

export function openBinderWorldAt(binderAt: RoomVec = DESK_BINDER_AT): RoomVec {
  return {
    x: binderAt.x,
    y: binderAt.y + OPEN_BINDER_LIFT.y,
    z: binderAt.z + OPEN_BINDER_LIFT.z,
  };
}

export function distanceToFitFace(
  face: { width: number; height: number },
  aspect = PORTRAIT_ASPECT,
  reservations: ViewportReservations = INSPECT_RESERVATIONS,
  fill = INSPECT_FILL,
  fovDeg = CAMERA_FOV_DEG,
) {
  const usable = usableViewportFractions(reservations);
  const tan = Math.tan((fovDeg * Math.PI) / 360);
  const distH = face.height / (2 * tan * usable.height * fill);
  const distW = face.width / (2 * tan * aspect * usable.width * fill);
  return Math.max(distH, distW, 1.15);
}

export function usableViewportFractions(reservations: ViewportReservations) {
  return {
    width: Math.max(0.45, 1 - reservations.side * 2),
    height: Math.max(0.36, 1 - reservations.top - reservations.bottom),
    centerNdcY: reservations.bottom - reservations.top,
  };
}

/** Shift look-at so the object sits in the usable band, not under the detail tray. */
export function lookBiasY(distance: number, reservations: ViewportReservations, fovDeg = CAMERA_FOV_DEG) {
  const halfH = Math.tan((fovDeg * Math.PI) / 360) * distance;
  return usableViewportFractions(reservations).centerNdcY * halfH;
}

export function isWallPlacement(position: RoomVec, surfaceId?: string | null) {
  return Boolean(surfaceId?.endsWith("-wall") || position.z < -3.9);
}

export function inspectionLift(geometry: NativeRepresentationKind, wall: boolean): RoomVec {
  if (wall) return { x: 0, y: 0.05, z: 0.26 };
  if (geometry === "album" || geometry === "book" || geometry === "disc-case") {
    return { x: 0, y: 0.3, z: 0.7 };
  }
  if (geometry === "poster") return { x: 0, y: 0.04, z: 0.2 };
  return { x: 0, y: 0.2, z: 0.46 };
}

export type InspectableItem = {
  geometry: NativeRepresentationKind;
  position: RoomVec;
  rotation: RoomVec;
  scale: number;
  placement?: { surfaceId?: string | null };
};

export function inspectionPresentation(item: InspectableItem, aspect = PORTRAIT_ASPECT) {
  const wall = isWallPlacement(item.position, item.placement?.surfaceId);
  const lift = inspectionLift(item.geometry, wall);
  const delta = wall && item.geometry === "poster"
    ? { x: -0.12, y: 0, z: 0 }
    : inspectionOrientationDelta(item.geometry);
  const position = {
    x: item.position.x + lift.x,
    y: item.position.y + lift.y,
    z: item.position.z + lift.z,
  };
  const rotation = {
    x: item.rotation.x + delta.x,
    y: item.rotation.y + delta.y,
    z: item.rotation.z + delta.z,
  };
  const face = presentedFaceSize(item.geometry, item.scale);
  const distance = distanceToFitFace(face, aspect, INSPECT_RESERVATIONS, INSPECT_FILL);
  const bias = lookBiasY(distance, INSPECT_RESERVATIONS);
  const camera: CameraPose = {
    position: { x: position.x, y: position.y + 0.1, z: position.z + distance },
    lookAt: { x: position.x, y: position.y - bias, z: position.z },
  };
  return { position, rotation, scale: item.scale, camera, distance, face, wall };
}

export function binderCameraForViewport(aspect = PORTRAIT_ASPECT, binderAt: RoomVec = DESK_BINDER_AT): CameraPose {
  const at = openBinderWorldAt(binderAt);
  const face = binderSpreadSize();
  const distance = distanceToFitFace(face, aspect, BINDER_RESERVATIONS, BINDER_FILL);
  const bias = lookBiasY(distance, BINDER_RESERVATIONS);
  return {
    position: { x: at.x, y: at.y + 0.58, z: at.z + distance },
    lookAt: { x: at.x, y: at.y - bias, z: at.z },
  };
}

export function binderCardInspectionWorld(aspect = PORTRAIT_ASPECT, binderAt: RoomVec = DESK_BINDER_AT) {
  const camera = binderCameraForViewport(aspect, binderAt);
  const face = { width: BINDER_CARD_W, height: BINDER_CARD_H };
  const distance = distanceToFitFace(face, aspect, BINDER_CARD_RESERVATIONS, BINDER_CARD_FILL);
  const dx = camera.lookAt.x - camera.position.x;
  const dy = camera.lookAt.y - camera.position.y;
  const dz = camera.lookAt.z - camera.position.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  const bias = lookBiasY(distance, BINDER_CARD_RESERVATIONS);
  return {
    position: {
      x: camera.position.x + (dx / len) * distance,
      y: camera.position.y + (dy / len) * distance + bias,
      z: camera.position.z + (dz / len) * distance,
    },
    rotation: { x: 0.04, y: 0, z: 0 },
    scale: 1,
    camera,
    distance,
  };
}

export function pocketLocalPosition(index: number) {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return {
    x: (col - 1) * 0.31,
    y: (0.5 - row) * 0.46,
    z: 0.02,
  };
}

export function pageLocalX(side: "left" | "right") {
  return side === "left" ? -(BINDER_PAGE_W + BINDER_SPINE_W) / 2 : (BINDER_PAGE_W + BINDER_SPINE_W) / 2;
}

/** Resting pocket position in world space — used to lift a card out and put it back. */
export function pocketWorldPosition(side: "left" | "right", index: number, binderAt: RoomVec = DESK_BINDER_AT): RoomVec {
  const binder = openBinderWorldAt(binderAt);
  const pageX = pageLocalX(side);
  const angle = side === "left" ? BINDER_V_ANGLE : -BINDER_V_ANGLE;
  const pocket = pocketLocalPosition(index);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const lx = pageX + pocket.x * cos + pocket.z * sin;
  const ly = pocket.y;
  const lz = -pocket.x * sin + pocket.z * cos;
  const tilt = -0.08;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  return {
    x: binder.x + lx,
    y: binder.y + ly * ct - lz * st,
    z: binder.z + ly * st + lz * ct,
  };
}

export function binderFitsPortrait(aspect = PORTRAIT_ASPECT, binderAt: RoomVec = DESK_BINDER_AT) {
  const pose = binderCameraForViewport(aspect, binderAt);
  const at = openBinderWorldAt(binderAt);
  const depth = Math.hypot(pose.position.x - at.x, pose.position.y - at.y, pose.position.z - at.z);
  const halfW = Math.tan((CAMERA_FOV_DEG * Math.PI) / 360) * depth * aspect;
  const halfH = Math.tan((CAMERA_FOV_DEG * Math.PI) / 360) * depth;
  const spread = binderSpreadSize();
  const usable = usableViewportFractions(BINDER_RESERVATIONS);
  return {
    depth,
    fitsWidth: spread.width / 2 <= halfW * usable.width + 1e-6,
    fitsHeight: spread.height / 2 <= halfH * usable.height + 1e-6,
  };
}
