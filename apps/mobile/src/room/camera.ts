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

/** Portrait window into the Room — not a fit-the-whole-set framing. */
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

/**
 * Constrained window travel — not orbit / CAD.
 * The phone is a portrait window into a wider Room. One-finger drag pans the
 * authored camera and look target together; pinch dollies along the look ray.
 */
export type ExploreOffset = {
  panX: number;
  panY: number;
  dolly: number;
};

export const IDENTITY_EXPLORE: ExploreOffset = { panX: 0, panY: 0, dolly: 1 };

/**
 * Interior from RoomShell / furniture: walls ±4.72, back z=-4.22,
 * floor plane y=-2.15 at z=-1.2 size 6.2 (z ∈ [-4.3, 1.9]), wall top y=3.45.
 */
export const ROOM_INTERIOR = {
  xMin: -4.55,
  xMax: 4.55,
  yMin: -1.85,
  ceiling: 3.4,
  floor: -2.15,
  floorGuard: -2.08,
  floorNearZ: 1.9,
  floorFarZ: -4.3,
  backZ: -4.14,
  cameraMinZ: 2.85,
} as const;

export const CAMERA_FOV_DEG = 46;
/** Typical portrait phone, not one device. */
export const PORTRAIT_ASPECT = 9 / 19.5;

export const EXPLORE_LIMITS = {
  homePanY: 0.72,
  homeDollyMin: 0.78,
  homeDollyMax: 1.22,
  zonePanX: 0.55,
  zonePanY: 0.28,
  zoneDollyMin: 0.88,
  zoneDollyMax: 1.12,
} as const;

export type ExploreSpace = "home" | "zone";

export type ExplorePanLimits = {
  panXMin: number;
  panXMax: number;
  panYMin: number;
  panYMax: number;
};

export function exploreAllowedForView(view: NativeWorldView): boolean {
  return view.kind === "home" || view.kind === "zone";
}

export function authoredLookDepth(pose: CameraPose) {
  return Math.abs(pose.position.z - pose.lookAt.z) || 1;
}

export function visibleHalfWidth(depth: number, aspect = PORTRAIT_ASPECT) {
  return Math.tan((CAMERA_FOV_DEG * Math.PI) / 360) * depth * aspect;
}

export function visibleHalfHeight(depth: number) {
  return Math.tan((CAMERA_FOV_DEG * Math.PI) / 360) * depth;
}

/** Translate the authored window without orbiting. */
export function framedPose(base: CameraPose, offset: Pick<ExploreOffset, "panX" | "panY" | "dolly">): CameraPose {
  const ox = base.position.x - base.lookAt.x;
  const oy = base.position.y - base.lookAt.y;
  const oz = base.position.z - base.lookAt.z;
  const lookAt = {
    x: base.lookAt.x + offset.panX,
    y: base.lookAt.y + offset.panY,
    z: base.lookAt.z,
  };
  return {
    position: {
      x: lookAt.x + ox * offset.dolly,
      y: lookAt.y + oy * offset.dolly,
      z: lookAt.z + oz * offset.dolly,
    },
    lookAt,
  };
}

/** Visible world-Y envelope of the portrait frustum at the back-wall plane. */
export function visibleFrustumY(pose: CameraPose, planeZ: number = ROOM_INTERIOR.backZ) {
  const oz = pose.lookAt.z - pose.position.z;
  const t = Math.abs(oz) < 1e-6 ? 1 : (planeZ - pose.position.z) / oz;
  const lookX = pose.position.x + t * (pose.lookAt.x - pose.position.x);
  const lookY = pose.position.y + t * (pose.lookAt.y - pose.position.y);
  const dist = Math.hypot(lookX - pose.position.x, lookY - pose.position.y, planeZ - pose.position.z) || 1;
  const halfH = visibleHalfHeight(dist);
  const vx = pose.lookAt.x - pose.position.x;
  const vy = pose.lookAt.y - pose.position.y;
  const vz = pose.lookAt.z - pose.position.z;
  const inv = 1 / (Math.hypot(vx, vy, vz) || 1);
  const vnx = vx * inv;
  const vnz = vz * inv;
  const rx = -vnz;
  const rz = vnx;
  const rlen = Math.hypot(rx, rz) || 1;
  const upY = (rz / rlen) * vnx - (rx / rlen) * vnz;
  const rise = halfH * Math.abs(upY);
  return { top: lookY + rise, bottom: lookY - rise };
}

function explorePanYRange(space: ExploreSpace) {
  const span = space === "zone" ? EXPLORE_LIMITS.zonePanY : EXPLORE_LIMITS.homePanY;
  return { low: -span, high: span };
}

function framedAt(base: CameraPose, panY: number, dolly: number) {
  return framedPose(base, { panX: 0, panY, dolly });
}

export function maxPanYForCeiling(base: CameraPose, dolly: number, space: ExploreSpace = "home") {
  const { low, high } = explorePanYRange(space);
  if (visibleFrustumY(framedAt(base, low, dolly)).top > ROOM_INTERIOR.ceiling) return low;
  let lo: number = low;
  let hi: number = high;
  for (let step = 0; step < 18; step += 1) {
    const mid = (lo + hi) / 2;
    if (visibleFrustumY(framedAt(base, mid, dolly)).top <= ROOM_INTERIOR.ceiling) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Most downward pan whose visible bottom stays on the authored floor at the floor's near lip. */
export function minPanYForFloor(base: CameraPose, dolly: number, space: ExploreSpace = "home") {
  const { low, high } = explorePanYRange(space);
  const floorHolds = (panY: number) =>
    visibleFrustumY(framedAt(base, panY, dolly), ROOM_INTERIOR.floorNearZ).bottom >= ROOM_INTERIOR.floor;
  if (floorHolds(low)) return low;
  if (!floorHolds(high)) return high;
  let lo: number = low;
  let hi: number = high;
  for (let step = 0; step < 18; step += 1) {
    const mid = (lo + hi) / 2;
    if (floorHolds(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

export function explorePanLimits(
  dolly: number,
  space: ExploreSpace = "home",
  base: CameraPose = HOME_POSE,
): ExplorePanLimits {
  if (space === "zone") {
    const panYMax = maxPanYForCeiling(base, dolly, "zone");
    return {
      panXMin: -EXPLORE_LIMITS.zonePanX,
      panXMax: EXPLORE_LIMITS.zonePanX,
      panYMin: Math.min(minPanYForFloor(base, dolly, "zone"), panYMax),
      panYMax,
    };
  }
  const clampedDolly = clampNumber(dolly, EXPLORE_LIMITS.homeDollyMin, EXPLORE_LIMITS.homeDollyMax);
  const halfW = visibleHalfWidth(authoredLookDepth(base) * clampedDolly);
  const lookX = base.lookAt.x;
  const panYMax = maxPanYForCeiling(base, clampedDolly, "home");
  return {
    panXMin: Math.min(-0.85, ROOM_INTERIOR.xMin + halfW - lookX),
    panXMax: Math.max(0.85, ROOM_INTERIOR.xMax - halfW - lookX),
    panYMin: Math.min(minPanYForFloor(base, clampedDolly, "home"), panYMax),
    panYMax,
  };
}

export function clampExplore(
  offset: ExploreOffset,
  space: ExploreSpace = "home",
  base: CameraPose = HOME_POSE,
): ExploreOffset {
  const dollyMin = space === "zone" ? EXPLORE_LIMITS.zoneDollyMin : EXPLORE_LIMITS.homeDollyMin;
  const dollyMax = space === "zone" ? EXPLORE_LIMITS.zoneDollyMax : EXPLORE_LIMITS.homeDollyMax;
  const dolly = clampNumber(offset.dolly, dollyMin, dollyMax);
  const limits = explorePanLimits(dolly, space, base);
  return {
    panX: clampNumber(offset.panX, limits.panXMin, limits.panXMax),
    panY: clampNumber(offset.panY, limits.panYMin, limits.panYMax),
    dolly,
  };
}

export function nudgeExploreFromDrag(
  current: ExploreOffset,
  dx: number,
  dy: number,
  space: ExploreSpace = "home",
): ExploreOffset {
  const xSense = space === "zone" ? 0.006 : 0.011;
  const ySense = space === "zone" ? 0.003 : 0.005;
  return clampExplore({
    panX: current.panX - dx * xSense,
    panY: current.panY + dy * ySense,
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
    panX: current.panX,
    panY: current.panY,
    dolly: startDolly * (startSpan / span),
  }, space);
}

export function applyExploreOffset(
  base: CameraPose,
  offset: ExploreOffset,
  space: ExploreSpace = "home",
): CameraPose {
  const clamped = clampExplore(offset, space, base);
  const framed = framedPose(base, clamped);
  const lookAt = { ...framed.lookAt };
  const position = { ...framed.position };
  position.y = Math.max(lookAt.y + 0.22, position.y);
  if (space === "home") {
    position.y = Math.max(ROOM_INTERIOR.floorGuard + 1.15, position.y);
    position.z = Math.max(ROOM_INTERIOR.cameraMinZ, position.z);
    lookAt.x = clampNumber(lookAt.x, ROOM_INTERIOR.xMin, ROOM_INTERIOR.xMax);
    lookAt.y = clampNumber(lookAt.y, ROOM_INTERIOR.yMin, ROOM_INTERIOR.ceiling);
  }
  return { position, lookAt };
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
