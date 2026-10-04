/** Repair 02 authored bedroom — scale source for Repair 03 proportions. */
export const REPAIR02_WALL_X = 4.52;
export const REPAIR02_BACK_Z = -4.48;
export const REPAIR02_WINDOW_Z = -0.82;
export const REPAIR02_FURNITURE_Z = -3.58;
export const REPAIR02_WALL_NEAR_Z = 8.6;

export const ROOM_WIDTH_SCALE = 0.9;
export const ROOM_DEPTH_SCALE = 0.8;

export function layoutX(x: number) {
  return x * ROOM_WIDTH_SCALE;
}

export function layoutZ(z: number) {
  return z * ROOM_DEPTH_SCALE;
}

/** Visible bedroom after the 10% / 20% proportion pass. Coverage envelope stays larger. */
export const ROOM_LAYOUT = {
  wallX: REPAIR02_WALL_X * ROOM_WIDTH_SCALE,
  backZ: REPAIR02_BACK_Z * ROOM_DEPTH_SCALE,
  windowZ: REPAIR02_WINDOW_Z * ROOM_DEPTH_SCALE,
  furnitureZ: REPAIR02_FURNITURE_Z * ROOM_DEPTH_SCALE,
  wallNearZ: REPAIR02_WALL_NEAR_Z,
} as const;
