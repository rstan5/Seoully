import { ROOM_FOCUS_PLANE, ROOM_HEIGHT, ROOM_WIDTH } from "@/domain/fixtures/collectors";
import type { CameraDock, Room, ZoneId } from "@/domain/types";
import type { WorldView } from "@/world/store/worldStore";

/**
 * Camera math.
 *
 * The camera is a single transform on one element. Reading right to left, it:
 *   1. moves the world so the look-at point sits at the origin,
 *   2. rotates around that point,
 *   3. pushes the result forward by `dolly` toward the viewer.
 *
 * Expressing it this way means a zone author says "look at this thing, from
 * about this far", and never has to reason about an inverse view matrix.
 */

export const PERSPECTIVE = 2400;

export interface CameraPose {
  x: number;
  y: number;
  z: number;
  dolly: number;
  rotateX: number;
  rotateY: number;
}

export function poseToTransform(pose: CameraPose): string {
  return [
    `translate3d(0px, 0px, ${pose.dolly.toFixed(2)}px)`,
    `rotateX(${pose.rotateX.toFixed(3)}deg)`,
    `rotateY(${pose.rotateY.toFixed(3)}deg)`,
    `translate3d(${(-pose.x).toFixed(2)}px, ${(-pose.y).toFixed(2)}px, ${(-pose.z).toFixed(2)}px)`,
  ].join(" ");
}

/**
 * Apparent scale of an object sitting at `worldZ` under a given pose.
 * Used for progressive fidelity and for handing objects to the flight layer.
 */
export function scaleAtDepth(pose: CameraPose, worldZ: number): number {
  const screenZ = worldZ - pose.z + pose.dolly;
  return PERSPECTIVE / Math.max(1, PERSPECTIVE - screenZ);
}

/**
 * Overview framing, solved rather than hardcoded.
 *
 * Given the viewport, find the dolly that fits the whole room with a margin.
 * Doing this analytically instead of picking a magic number is what lets the
 * same scene frame correctly on a laptop and an ultrawide, and it's the hook
 * a mobile camera rig will later use to frame zone-by-zone instead.
 */
export function overviewPose(viewportWidth: number, viewportHeight: number): CameraPose {
  // Slightly over 1 so the room bleeds past the frame edges. Fitting it inside
  // with a margin makes it read as a diorama sitting in a black page; letting
  // the walls run off-screen is what puts the viewer *inside* the room.
  const margin = 1.04;
  const fitScale = Math.min(
    (viewportWidth * margin) / ROOM_WIDTH,
    (viewportHeight * margin) / ROOM_HEIGHT,
  );
  // Solve P / (P - z) = s  for the screen-space z that produces that scale.
  const screenZ = PERSPECTIVE * (1 - 1 / clampScale(fitScale));
  // Standing a little above the midline, looking slightly down and slightly
  // off-axis.
  //
  // Two reasons this isn't a dead-on, level camera. A level camera renders
  // every horizontal surface — desk, shelf boards, floor — perfectly edge-on,
  // so they vanish and objects appear to float. And a perfectly square-on
  // camera reads as an architectural elevation; a few degrees of yaw is the
  // difference between looking *at* a wall and standing *in* a room.
  const lookAt = { x: -40, y: -10, z: -450 };
  return {
    ...lookAt,
    dolly: screenZ - ROOM_FOCUS_PLANE + lookAt.z,
    rotateX: 6,
    rotateY: -3.5,
  };
}

function clampScale(s: number): number {
  // Below ~0.25 the room is a postage stamp; above 1 the camera is inside the
  // back wall. Both are worse than cropping slightly.
  return Math.min(1, Math.max(0.25, s));
}

function dockToPose(dock: CameraDock): CameraPose {
  return {
    x: dock.x,
    y: dock.y,
    z: dock.z,
    dolly: dock.dolly,
    rotateX: dock.rotateX ?? 0,
    rotateY: dock.rotateY ?? 0,
  };
}

/**
 * Resolve the camera pose for the current view.
 *
 * Every navigation in the product funnels through here, which is what
 * guarantees the camera can never contradict the app's state.
 */
export function poseForView(
  view: WorldView,
  room: Room,
  viewport: { width: number; height: number },
): CameraPose {
  const overview = overviewPose(viewport.width, viewport.height);

  const zoneById = (zoneId: ZoneId) => room.zones.find((z) => z.id === zoneId);

  switch (view.kind) {
    case "arrival":
      // Start marginally further back and lower, so arrival is a settle
      // *into* the room rather than a fade of a static frame.
      return { ...overview, dolly: overview.dolly - 260, y: overview.y + 40, rotateX: 1.6 };

    case "room":
      return overview;

    case "zone": {
      const zone = zoneById(view.zoneId);
      return zone ? dockToPose(zone.dock) : overview;
    }

    case "inspect": {
      const zone = zoneById(view.zoneId);
      if (!zone) return overview;
      // Inspection pulls in past the zone dock and centers slightly high, the
      // way you'd actually hold an object up to look at it.
      const dock = dockToPose(zone.dock);
      return { ...dock, y: dock.y - 30, dolly: dock.dolly + 300 };
    }

    case "binder": {
      const zone = zoneById(view.zoneId);
      if (!zone) return overview;
      const dock = dockToPose(zone.dock);
      // An open binder is a wide spread, so the camera squares up to it and
      // backs off enough to hold both pages in frame.
      return { ...dock, y: dock.y - 10, dolly: dock.dolly + 120, rotateX: 2.5 };
    }

    case "profile":
      // The profile floats over the room; the camera eases back and the scene
      // behind it defocuses. Keeping the room visible is the point — you are
      // reading about someone while standing in their doorway.
      return { ...overview, dolly: overview.dolly - 340, rotateX: -1 };

    case "feed":
      return { ...overview, dolly: overview.dolly - 620, rotateX: -2 };

    default:
      return overview;
  }
}

/**
 * Pointer parallax, applied on top of the resolved pose.
 *
 * Kept very small. Enough that the room breathes with the pointer and reads as
 * volumetric; not so much that it becomes a novelty or induces motion sickness.
 * Damped further when the camera is docked close to an object, because at that
 * distance the same angular change is a much larger apparent movement.
 */
export function parallaxFor(view: WorldView): { rotateY: number; rotateX: number } {
  const close = view.kind === "inspect" || view.kind === "binder";
  return close ? { rotateY: 0.9, rotateX: 0.5 } : { rotateY: 2.6, rotateX: 1.4 };
}
