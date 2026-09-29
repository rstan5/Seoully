import type { NativeRoomVector, RoomRenderable } from "./model";
import type { CanonicalZoneKind, NativeWorldView } from "./worldView";

/** Authored camera docks. Not orbit controls. Units match the native Three room. */
export type CameraPose = {
  position: NativeRoomVector;
  lookAt: NativeRoomVector;
};

export const HOME_POSE: CameraPose = {
  position: { x: 0.55, y: 1.92, z: 5.25 },
  lookAt: { x: 0.18, y: -0.12, z: -2.35 },
};

export const EDIT_POSE: CameraPose = {
  position: { x: 0.42, y: 2.45, z: 5.95 },
  lookAt: { x: 0.12, y: -0.28, z: -2.05 },
};

export const PROFILE_GLIMPSE_POSE: CameraPose = {
  position: { x: 0.62, y: 2.55, z: 6.55 },
  lookAt: { x: 0.18, y: 0.08, z: -2.2 },
};

export const BINDER_OPEN_POSE: CameraPose = {
  position: { x: 0.42, y: 1.08, z: 1.72 },
  lookAt: { x: 0.42, y: 0.18, z: -1.48 },
};

export const BINDER_EXAMINE_POSE: CameraPose = {
  position: { x: 0.48, y: 1.02, z: 1.28 },
  lookAt: { x: 0.42, y: 0.28, z: -1.35 },
};

export const ZONE_DOCKS: Record<CanonicalZoneKind, CameraPose> = {
  shelf: { position: { x: -2.18, y: 0.78, z: -0.92 }, lookAt: { x: -3.15, y: -0.12, z: -3.52 } },
  wall: { position: { x: 1.08, y: 1.08, z: -1.28 }, lookAt: { x: 1.1, y: 0.72, z: -4.12 } },
  case: { position: { x: 2.52, y: 0.58, z: -1.08 }, lookAt: { x: 3.65, y: 0.06, z: -3.52 } },
  desk: { position: { x: 1.18, y: 0.88, z: -0.28 }, lookAt: { x: 1.45, y: -0.42, z: -2.82 } },
  binder: { position: { x: 0.52, y: 0.48, z: -0.42 }, lookAt: { x: 0.45, y: -0.32, z: -2.58 } },
  archive: { position: { x: -0.52, y: 0.28, z: 1.62 }, lookAt: { x: -1.2, y: -1.52, z: -0.62 } },
};

export const DESK_BINDER_AT = { x: 0.45, y: -0.52, z: -2.62 };
export const OPEN_BINDER_LIFT = { y: 0.52, z: 1.12 };

export function poseForView(
  view: NativeWorldView,
  focused: RoomRenderable | null,
): CameraPose {
  switch (view.kind) {
    case "home":
      return HOME_POSE;
    case "edit":
      return EDIT_POSE;
    case "zone":
      return ZONE_DOCKS[view.zone];
    case "inspect":
      return focused ? inspectPose(focused) : ZONE_DOCKS[view.zone];
    case "binder":
      return view.heldHoldingId ? BINDER_EXAMINE_POSE : BINDER_OPEN_POSE;
    default:
      return HOME_POSE;
  }
}

export function inspectPose(item: RoomRenderable): CameraPose {
  const wall = Boolean(item.placement?.surfaceId?.endsWith("-wall") || item.position.z < -3.9);
  const cardLike = item.geometry === "photocard" || item.geometry === "ticket";
  return {
    position: {
      x: item.position.x + (cardLike ? 0.18 : 0),
      y: item.position.y + (wall ? 0.06 : cardLike ? 0.22 : 0.28),
      z: item.position.z + (wall ? 1.58 : cardLike ? 1.72 : 2.18),
    },
    lookAt: { x: item.position.x, y: item.position.y, z: item.position.z },
  };
}

export function cameraLerpAlpha(delta: number, reducedMotion: boolean) {
  if (reducedMotion) return 1;
  return 1 - Math.exp(-6.2 * delta);
}
