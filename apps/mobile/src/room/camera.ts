import type { CanonicalZoneKind, NativeWorldView } from "./worldView";

type RoomVector = { x: number; y: number; z: number };

/** Authored camera docks. Not orbit controls. Units match the native Three room. */
export type CameraPose = {
  position: RoomVector;
  lookAt: RoomVector;
};

type FocusedItem = {
  position: RoomVector;
  geometry?: string;
  placement?: { surfaceId?: string | null };
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
  focused: FocusedItem | null,
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

export function inspectPose(item: FocusedItem): CameraPose {
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

/** Constrained diorama explore — not free orbit / CAD. */
export type ExploreOffset = {
  yaw: number;
  pitch: number;
  dolly: number;
};

export const IDENTITY_EXPLORE: ExploreOffset = { yaw: 0, pitch: 0, dolly: 1 };

export const EXPLORE_LIMITS = {
  homeYaw: 0.55,
  homePitchMin: -0.18,
  homePitchMax: 0.28,
  homeDollyMin: 0.78,
  homeDollyMax: 1.22,
  homeX: [-1.8, 2.4] as const,
  homeY: [1.15, 2.62] as const,
  homeZ: [3.55, 6.75] as const,
  zoneYaw: 0.28,
  zonePitchMin: -0.1,
  zonePitchMax: 0.16,
  zoneDollyMin: 0.88,
  zoneDollyMax: 1.12,
} as const;

export type ExploreSpace = "home" | "zone";

export function exploreAllowedForView(view: NativeWorldView): boolean {
  return view.kind === "home" || view.kind === "zone";
}

export function clampExplore(offset: ExploreOffset, space: ExploreSpace = "home"): ExploreOffset {
  const yawMax = space === "zone" ? EXPLORE_LIMITS.zoneYaw : EXPLORE_LIMITS.homeYaw;
  const pitchMin = space === "zone" ? EXPLORE_LIMITS.zonePitchMin : EXPLORE_LIMITS.homePitchMin;
  const pitchMax = space === "zone" ? EXPLORE_LIMITS.zonePitchMax : EXPLORE_LIMITS.homePitchMax;
  const dollyMin = space === "zone" ? EXPLORE_LIMITS.zoneDollyMin : EXPLORE_LIMITS.homeDollyMin;
  const dollyMax = space === "zone" ? EXPLORE_LIMITS.zoneDollyMax : EXPLORE_LIMITS.homeDollyMax;
  return {
    yaw: clampNumber(offset.yaw, -yawMax, yawMax),
    pitch: clampNumber(offset.pitch, pitchMin, pitchMax),
    dolly: clampNumber(offset.dolly, dollyMin, dollyMax),
  };
}

export function nudgeExploreFromDrag(
  current: ExploreOffset,
  dx: number,
  dy: number,
  space: ExploreSpace = "home",
): ExploreOffset {
  const yawSense = space === "zone" ? 0.0032 : 0.0042;
  const pitchSense = space === "zone" ? 0.0024 : 0.0031;
  return clampExplore({
    yaw: current.yaw - dx * yawSense,
    pitch: current.pitch + dy * pitchSense,
    dolly: current.dolly,
  }, space);
}

export function nudgeExploreFromPinch(
  current: ExploreOffset,
  startDolly: number,
  startSpan: number,
  span: number,
  space: ExploreSpace = "home",
): ExploreOffset {
  if (!(startSpan > 0) || !(span > 0) || !Number.isFinite(startDolly)) return current;
  return clampExplore({
    yaw: current.yaw,
    pitch: current.pitch,
    dolly: startDolly * (startSpan / span),
  }, space);
}

export function applyExploreOffset(
  base: CameraPose,
  offset: ExploreOffset,
  space: ExploreSpace = "home",
): CameraPose {
  const clamped = clampExplore(offset, space);
  const ox = base.position.x - base.lookAt.x;
  const oy = base.position.y - base.lookAt.y;
  const oz = base.position.z - base.lookAt.z;
  const dist = Math.hypot(ox, oy, oz) || 1;
  const horiz = Math.hypot(ox, oz) || 0.001;
  const baseYaw = Math.atan2(ox, oz);
  const basePitch = Math.atan2(oy, horiz);
  const pitch = clampNumber(basePitch + clamped.pitch, -0.72, 0.82);
  const yaw = baseYaw + clamped.yaw;
  const distance = dist * clamped.dolly;
  const cosPitch = Math.cos(pitch);
  let x = base.lookAt.x + Math.sin(yaw) * distance * cosPitch;
  let y = base.lookAt.y + Math.sin(pitch) * distance;
  let z = base.lookAt.z + Math.cos(yaw) * distance * cosPitch;
  const authoredHoriz = ox * (x - base.lookAt.x) + oz * (z - base.lookAt.z);
  if (authoredHoriz < 0) {
    const scale = distance / dist;
    x = base.lookAt.x + ox * scale;
    z = base.lookAt.z + oz * scale;
  }
  y = Math.max(base.lookAt.y + 0.22, y);
  if (space === "home") {
    x = clampNumber(x, EXPLORE_LIMITS.homeX[0], EXPLORE_LIMITS.homeX[1]);
    y = clampNumber(y, EXPLORE_LIMITS.homeY[0], EXPLORE_LIMITS.homeY[1]);
    z = clampNumber(z, EXPLORE_LIMITS.homeZ[0], EXPLORE_LIMITS.homeZ[1]);
  }
  return { position: { x, y, z }, lookAt: base.lookAt };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
