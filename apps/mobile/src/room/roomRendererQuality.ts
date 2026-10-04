/**
 * Repair 05 renderer fidelity constants.
 *
 * R3F native Canvas hardcodes `dpr: PixelRatio.get()` because expo-gl can only
 * render at native resolution. Do not pass a Canvas `dpr` prop — it is ignored
 * and must not be used as a readiness/opacity gate.
 */
export const ROOM_PIXEL_RATIO_CAP = 2;
export const ROOM_SHADOW_MAP_SIZE = 1024;
export const ROOM_SHADOW_CAMERA = {
  near: 0.7,
  far: 13,
  left: -5.2,
  right: 5.2,
  top: 4.2,
  bottom: -3.6,
} as const;
export const ROOM_ANISOTROPY_LARGE_CAP = 4;
export const ROOM_ANISOTROPY_SMALL_CAP = 2;
export const ROOM_TEXTURE_MAX_EDGE = 512;
export const ROOM_TEXTURE_REPEAT = {
  plaster: [3.6, 2.8],
  woodFloor: [3.4, 6.8],
  woodFine: [2.8, 2],
  fabric: [3.6, 2.6],
  cardboard: [2.1, 1.6],
  vinyl: [1.5, 1.2],
  paper: [2, 2],
} as const;
