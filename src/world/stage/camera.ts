import { ROOM_FOCUS_PLANE, ROOM_HEIGHT, ROOM_WIDTH } from "@/domain/fixtures/collectors";
import type { CameraDock, Room, ZoneId } from "@/domain/types";
import { OPEN_LIFT, PAGE_H } from "@/world/objects/binderGeometry";
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
export function editPose(viewportWidth: number, viewportHeight: number): CameraPose {
  const overview = overviewPose(viewportWidth, viewportHeight);
  return { ...overview, y: overview.y + 42, rotateX: overview.rotateX + 4 };
}

export function overviewPose(viewportWidth: number, viewportHeight: number): CameraPose {
  const compact = viewportWidth < 800;
  // Compact screens crop into the room rather than shrinking the whole
  // diorama. A phone that shows the entire back wall turns the space into a
  // dollhouse; cropping to the furniture puts you inside it.
  const margin = compact ? 1.12 : 0.95;
  const fitScale = Math.min(
    (viewportWidth * margin) / ROOM_WIDTH,
    (viewportHeight * margin) / ROOM_HEIGHT,
  );
  const screenZ = PERSPECTIVE * (1 - 1 / clampScale(fitScale));
  const lookAt = { x: compact ? 40 : 10, y: compact ? 168 : 110, z: compact ? -360 : -430 };
  return {
    ...lookAt,
    dolly: screenZ - ROOM_FOCUS_PLANE + lookAt.z,
    rotateX: compact ? 14.2 : 9.3,
    rotateY: compact ? -4 : -7,
  };
}

/**
 * Distance at which an object of a given world height fills a set share of the
 * frame.
 *
 * The inverse of `scaleAtDepth`. Deriving the examine distance from the
 * object's own size is what makes a photocard and a vinyl box both arrive at a
 * comfortable reading size, instead of one fixed distance that flatters
 * whichever object it was tuned against.
 */
function dollyToFill(worldHeight: number, viewportHeight: number, fill = 0.56): number {
  const wanted = (fill * viewportHeight) / Math.max(1, worldHeight);
  const s = Math.min(4.5, Math.max(1.05, wanted));
  return PERSPECTIVE * (1 - 1 / s);
}

/**
 * Keep a docked pose's frame inside the room box.
 *
 * A dock is authored as "look at this thing from about this far", which is the
 * right thing for an author to think about and says nothing about whether the
 * resulting frame runs off the end of the wall. Close to a corner it always
 * does, and the void outside the room appears as a black band — the single most
 * illusion-breaking artifact this scene can produce. Solving it here means no
 * dock can ever be authored wrong.
 */
function frameInsideRoom(
  pose: CameraPose,
  viewport: { width: number; height: number },
): CameraPose {
  const scale = scaleAtDepth(pose, pose.z);
  const halfW = viewport.width / 2 / scale;
  const halfH = viewport.height / 2 / scale;
  const slackX = Math.max(0, ROOM_WIDTH / 2 - halfW);
  const slackY = Math.max(0, ROOM_HEIGHT / 2 - halfH);
  return {
    ...pose,
    x: Math.max(-slackX, Math.min(slackX, pose.x)),
    y: Math.max(-slackY, Math.min(slackY, pose.y)),
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
    // Docks keep a few degrees of the overview's angle by default. Squaring up
    // perfectly on arrival at a zone reads as a slide deck cutting to a
    // diagram; keeping a residual tilt means you approached the thing and are
    // still standing in the room while you look at it.
    rotateX: dock.rotateX ?? 3,
    rotateY: dock.rotateY ?? -2.5,
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
  examining = false,
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

    case "edit":
      return editPose(viewport.width, viewport.height);

    case "zone": {
      const zone = zoneById(view.zoneId);
      return zone ? frameInsideRoom(dockToPose(zone.dock), viewport) : overview;
    }

    case "inspect": {
      const zone = zoneById(view.zoneId);
      if (!zone) return overview;
      // Frame the object itself, not its zone, and raise the look-at slightly:
      // you hold something up to look at it rather than examining it at waist
      // height. Dolly scales with the zone's own so a wall poster and a shelf
      // `at` is where the object comes to rest once it's been picked up, not
      // where it sits on the shelf — the object owns that offset, because only
      // it knows how far it swings out.
      const cardLike = (view.at.height ?? 220) < 150;
      return frameInsideRoom(
        {
          x: view.at.x,
          y: view.at.y,
          z: view.at.z,
          dolly: dollyToFill(view.at.height ?? 220, viewport.height, cardLike ? 0.44 : 0.56),
          // A photocard gets a natural hand-held tilt; larger objects stay
          // almost square-on so they still read as solids in the room.
          rotateX: cardLike ? 6 : 1,
          rotateY: cardLike ? -9 : -1.5,
        },
        viewport,
      );
    }

    case "binder": {
      const zone = zoneById(view.zoneId);
      if (!zone) return overview;
      // The binder leaves the desk when it opens, so the camera frames where
      // it ends up rather than where it was standing, and holds the whole
      // spread with a little air around it. Holding a card pulls the camera
      // a little closer so the room falls back behind the object.
      return frameInsideRoom(
        {
          x: zone.dock.x + (examining ? 12 : 0),
          y: zone.dock.y + OPEN_LIFT.y + (examining ? -10 : 0),
          z: zone.dock.z + OPEN_LIFT.z,
          dolly: dollyToFill(PAGE_H, viewport.height, examining ? 0.58 : 0.66),
          rotateX: examining ? 4 : 2,
          rotateY: examining ? -4 : -1.5,
        },
        viewport,
      );
    }

    case "profile":
      return { ...overview, dolly: overview.dolly - 280, rotateX: -0.5 };

    case "feed":
    case "search":
    case "inbox":
    case "notices":
    case "compose":
      return { ...overview, dolly: overview.dolly - 420, rotateX: -1 };

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
