import { boundsForGeometry, type NativeRepresentationKind } from "./representation";
import type { NativeRoomSurface, NativeRoomVector } from "./model";

export const SURFACE_FIT_MARGIN = 0.012;
/** Bounds in the surface's local axes, before parent yaw. No data is mutated. */
export function rotatedRepresentationSize(geometry: NativeRepresentationKind, rotation: NativeRoomVector) {
  const b = boundsForGeometry(geometry);
  const sx = Math.sin(rotation.x), cx = Math.cos(rotation.x);
  const sy = Math.sin(rotation.y), cy = Math.cos(rotation.y);
  const sz = Math.sin(rotation.z), cz = Math.cos(rotation.z);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const x of [b.minX,b.maxX]) for (const y of [b.minY,b.maxY]) for (const z of [b.minZ,b.maxZ]) {
    const a = cz*x-sz*y, d = sz*x+cz*y;
    const e = -sy*a+cy*z;
    const p = [cy*a+sy*z, cx*d-sx*e, sx*d+cx*e];
    p.forEach((v,i) => { min[i]=Math.min(min[i],v); max[i]=Math.max(max[i],v); });
  }
  return { x:max[0]-min[0], y:max[1]-min[1], z:max[2]-min[2] };
}
export function surfaceFitScale(geometry: NativeRepresentationKind, authoredScale: number, localRotation: NativeRoomVector, surface?: NativeRoomSurface) {
  if (!surface || surface.kind === "wall" || surface.id.endsWith("-floor")) return authoredScale;
  const size = rotatedRepresentationSize(geometry, localRotation);
  const ratio = (available: number, dimension: number) => Math.max(0.001, available-SURFACE_FIT_MARGIN*2)/(dimension*authoredScale);
  const factor = Math.min(1, ratio(surface.width,size.x), ratio(surface.depth,size.z),
    surface.clearanceHeight === undefined ? 1 : ratio(surface.clearanceHeight,size.y));
  return authoredScale*factor;
}
