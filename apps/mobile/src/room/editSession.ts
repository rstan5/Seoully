/** Store removes RoomPlacement only. Ownership (Holding) is untouched. */

export function storeRenderable<T extends { holding: { id: string } }>(items: T[], holdingId: string): T[] {
  return items.filter((item) => item.holding.id !== holdingId);
}

export function holdingRemainsAfterStore(holdings: { id: string }[], holdingId: string) {
  return holdings.some((holding) => holding.id === holdingId);
}

export function restoreEditBaseline<T extends { position: object; rotation: object }>(baseline: T[]): T[] {
  return baseline.map((item) => ({
    ...item,
    position: { ...item.position },
    rotation: { ...item.rotation },
  }));
}

export function revertDrop<T extends { holding: { id: string }; position: object; rotation: object }>(items: T[], origin: T): T[] {
  return items.map((item) => (item.holding.id === origin.holding.id ? {
    ...origin,
    position: { ...origin.position },
    rotation: { ...origin.rotation },
  } : item));
}

export function cloneRenderables<T extends { position: object; rotation: object }>(items: T[]): T[] {
  return restoreEditBaseline(items);
}
