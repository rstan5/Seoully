/** Existing physical Binder card dimensions; every native card uses this ratio. */
export const PHOTOCARD = { width: 0.24, height: 0.37, aspect: 24 / 37 } as const;
/** Centered cover UVs crop any source without stretching or changing card geometry. */
export function photocardCoverUV(width: number, height: number) {
  const ratio = width > 0 && height > 0 ? width / height : PHOTOCARD.aspect;
  const x = Math.min(1, PHOTOCARD.aspect / ratio);
  const y = Math.min(1, ratio / PHOTOCARD.aspect);
  return { repeatX: x, repeatY: y, offsetX: (1 - x) / 2, offsetY: (1 - y) / 2 };
}
export function centeredPhotocardCrop(width: number, height: number) {
  const cropWidth = Math.min(width, height * PHOTOCARD.aspect);
  const cropHeight = cropWidth / PHOTOCARD.aspect;
  return { originX: (width - cropWidth) / 2, originY: (height - cropHeight) / 2, width: cropWidth, height: cropHeight };
}
