import {
  applyExploreOffset,
  CAMERA_FOV_DEG,
  EDIT_POSE,
  EXPLORE_LIMITS,
  HOME_POSE,
  IDENTITY_EXPLORE,
  IMMERSIVE_HOME,
  PORTRAIT_ASPECT,
  ROOM_INTERIOR,
  type CameraPose,
  type ExploreOffset,
} from "./camera";

/**
 * Authored world box that must cover every permitted camera frustum.
 * Extends past accepted 7A/7B/7C clamps — bounds are not shrunk to hide gaps.
 */
export const WORLD_ENVELOPE = {
  floorTop: -2.08,
  floorBottom: -2.72,
  floorX: 7.35,
  floorNearZ: 26.4,
  floorFarZ: -6.8,
  wallX: 6.25,
  wallBottom: -2.65,
  wallTop: 4.35,
  wallNearZ: 25.8,
  wallFarZ: -6.6,
  backZ: -4.72,
  ceilingY: 4.25,
  ceilingX: 7.35,
  ceilingNearZ: 25.8,
  ceilingFarZ: -6.6,
} as const;

/** Visible bedroom box. Coverage envelope may extend farther; this is what the viewer stands in. */
export const ROOM_BOX = {
  wallX: 4.52,
  backZ: -4.48,
  windowZ: -0.82,
  furnitureZ: -3.58,
  wallNearZ: 8.6,
} as const;

type Vec = { x: number; y: number; z: number };

function norm(value: Vec): Vec {
  const length = Math.hypot(value.x, value.y, value.z) || 1;
  return { x: value.x / length, y: value.y / length, z: value.z / length };
}

function cross(a: Vec, b: Vec): Vec {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function frustumCornerRays(pose: CameraPose, aspect = PORTRAIT_ASPECT): Vec[] {
  const forward = norm({
    x: pose.lookAt.x - pose.position.x,
    y: pose.lookAt.y - pose.position.y,
    z: pose.lookAt.z - pose.position.z,
  });
  const right = norm(cross(forward, { x: 0, y: 1, z: 0 }));
  const up = cross(right, forward);
  const tanHalf = Math.tan((CAMERA_FOV_DEG * Math.PI) / 360);
  const dirs: Vec[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      dirs.push(norm({
        x: forward.x + right.x * tanHalf * aspect * sx + up.x * tanHalf * sy,
        y: forward.y + right.y * tanHalf * aspect * sx + up.y * tanHalf * sy,
        z: forward.z + right.z * tanHalf * aspect * sx + up.z * tanHalf * sy,
      }));
    }
  }
  return dirs;
}

function hitPlane(origin: Vec, dir: Vec, axis: keyof Vec, value: number) {
  const d = dir[axis];
  if (Math.abs(d) < 1e-6) return null;
  const t = (value - origin[axis]) / d;
  if (t < 0.05) return null;
  return { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t, t };
}

function insideFloor(point: { x: number; z: number }) {
  return Math.abs(point.x) <= WORLD_ENVELOPE.floorX
    && point.z <= WORLD_ENVELOPE.floorNearZ
    && point.z >= WORLD_ENVELOPE.floorFarZ;
}

function insideWall(point: { y: number; z: number }) {
  return point.y >= WORLD_ENVELOPE.wallBottom
    && point.y <= WORLD_ENVELOPE.wallTop
    && point.z <= WORLD_ENVELOPE.wallNearZ
    && point.z >= WORLD_ENVELOPE.wallFarZ;
}

function insideCeiling(point: { x: number; z: number }) {
  return Math.abs(point.x) <= WORLD_ENVELOPE.ceilingX
    && point.z <= WORLD_ENVELOPE.ceilingNearZ
    && point.z >= WORLD_ENVELOPE.ceilingFarZ;
}

export function envelopeCoversPose(pose: CameraPose) {
  const origin = pose.position;
  for (const dir of frustumCornerRays(pose)) {
    const hits = [
      (() => {
        const hit = hitPlane(origin, dir, "y", WORLD_ENVELOPE.floorTop);
        return hit && insideFloor(hit) ? hit.t : null;
      })(),
      (() => {
        const hit = hitPlane(origin, dir, "y", WORLD_ENVELOPE.ceilingY);
        return hit && insideCeiling(hit) ? hit.t : null;
      })(),
      (() => {
        const hit = hitPlane(origin, dir, "x", WORLD_ENVELOPE.wallX);
        return hit && insideWall(hit) ? hit.t : null;
      })(),
      (() => {
        const hit = hitPlane(origin, dir, "x", -WORLD_ENVELOPE.wallX);
        return hit && insideWall(hit) ? hit.t : null;
      })(),
      (() => {
        const hit = hitPlane(origin, dir, "z", WORLD_ENVELOPE.backZ);
        return hit && Math.abs(hit.x) <= WORLD_ENVELOPE.wallX && hit.y >= WORLD_ENVELOPE.wallBottom && hit.y <= WORLD_ENVELOPE.wallTop ? hit.t : null;
      })(),
    ].filter((value): value is number => value != null);
    if (!hits.length) return false;
  }
  return true;
}

export function visibleXAtZ(pose: CameraPose, planeZ: number) {
  const oz = pose.lookAt.z - pose.position.z;
  const t = Math.abs(oz) < 1e-6 ? 1 : (planeZ - pose.position.z) / oz;
  const center = pose.position.x + t * (pose.lookAt.x - pose.position.x);
  const lookY = pose.position.y + t * (pose.lookAt.y - pose.position.y);
  const dist = Math.hypot(center - pose.position.x, lookY - pose.position.y, planeZ - pose.position.z) || 1;
  const halfW = Math.tan((CAMERA_FOV_DEG * Math.PI) / 360) * dist * PORTRAIT_ASPECT;
  return { center, min: center - halfW, max: center + halfW };
}

/** Safety: viewer stays inside the bedroom. Does not require the whole Room to fit. */
export function immersiveRoomHolds(pose: CameraPose) {
  return pose.position.z <= IMMERSIVE_HOME.maxZ + 0.02
    && pose.position.z >= ROOM_INTERIOR.cameraMinZ - 0.02
    && pose.position.z < ROOM_BOX.wallNearZ
    && Math.abs(pose.position.x) < ROOM_BOX.wallX - 0.2;
}

export function permittedExploreSamples(): CameraPose[] {
  const offsets: ExploreOffset[] = [
    { ...IDENTITY_EXPLORE },
    { panX: -0.85, panY: -EXPLORE_LIMITS.homePanY, dolly: EXPLORE_LIMITS.homeDollyMin },
    { panX: 0.85, panY: EXPLORE_LIMITS.homePanY, dolly: EXPLORE_LIMITS.homeDollyMax },
    { panX: -0.85, panY: EXPLORE_LIMITS.homePanY, dolly: EXPLORE_LIMITS.homeDollyMin },
    { panX: 0.85, panY: -EXPLORE_LIMITS.homePanY, dolly: EXPLORE_LIMITS.homeDollyMax },
    { panX: 0, panY: 0, dolly: EXPLORE_LIMITS.homeDollyMax },
    { panX: -0.85, panY: 0, dolly: EXPLORE_LIMITS.homeDollyMax },
    { panX: 0.85, panY: 0, dolly: EXPLORE_LIMITS.homeDollyMax },
  ];
  return [
    ...offsets.map((offset) => applyExploreOffset(HOME_POSE, offset, "home")),
    ...offsets.map((offset) => applyExploreOffset(EDIT_POSE, offset, "home")),
  ];
}
