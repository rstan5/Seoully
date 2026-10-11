import { PHOTOCARD } from "./photocard";
export type CropTransform = { x: number; y: number; zoom: number };
export function constrainCrop(next: CropTransform, imageWidth: number, imageHeight: number, frameWidth: number) {
  const frameHeight = frameWidth / PHOTOCARD.aspect;
  const zoom = Math.max(1, Math.min(3, next.zoom));
  const scale = Math.max(frameWidth / imageWidth, frameHeight / imageHeight) * zoom;
  const mx = Math.max(0, (imageWidth * scale - frameWidth) / 2);
  const my = Math.max(0, (imageHeight * scale - frameHeight) / 2);
  return { zoom, x: Math.max(-mx, Math.min(mx, next.x)), y: Math.max(-my, Math.min(my, next.y)) };
}
export function cropRectangle(transform: CropTransform, imageWidth: number, imageHeight: number, frameWidth: number) {
  const value = constrainCrop(transform, imageWidth, imageHeight, frameWidth);
  const frameHeight = frameWidth / PHOTOCARD.aspect;
  const scale = Math.max(frameWidth / imageWidth, frameHeight / imageHeight) * value.zoom;
  const originX = Math.max(0, Math.round((imageWidth * scale / 2 - frameWidth / 2 - value.x) / scale));
  const originY = Math.max(0, Math.round((imageHeight * scale / 2 - frameHeight / 2 - value.y) / scale));
  return { originX, originY, width: Math.min(imageWidth - originX, Math.round(frameWidth / scale)), height: Math.min(imageHeight - originY, Math.round(frameHeight / scale)) };
}
/** Preserve the image point beneath the pinch midpoint, including midpoint translation. */
export function pinchCrop(origin: CropTransform, factor: number, start: { x: number; y: number }, current: { x: number; y: number }) {
  const zoom = Math.max(1, Math.min(3, origin.zoom * factor));
  const ratio = zoom / origin.zoom;
  return { zoom, x: (origin.x - start.x) * ratio + current.x, y: (origin.y - start.y) * ratio + current.y };
}
