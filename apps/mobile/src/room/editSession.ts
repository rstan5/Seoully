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

/** One committed placement change. Canceled / invalid drags must not push. */
export type PlacementHistoryEntry<T, TObject = unknown> = {
  before: T | { storedHoldingId: string };
  after: T | { storedHoldingId: string };
  objectsBefore?: TObject[];
  objectsAfter?: TObject[];
  childrenBefore?: T[];
  childrenAfter?: T[];
};

export function isObjectHistory<T, TObject>(entry: PlacementHistoryEntry<T, TObject>) {
  return Array.isArray(entry.objectsBefore) && Array.isArray(entry.objectsAfter);
}

export function isStoredHistoryMarker(value: object): value is { storedHoldingId: string } {
  return "storedHoldingId" in value;
}

export function pushPlacementHistory<T>(
  undo: PlacementHistoryEntry<T>[],
  redo: PlacementHistoryEntry<T>[],
  entry: PlacementHistoryEntry<T>,
) {
  undo.push(entry);
  redo.length = 0;
  return { undo, redo };
}
