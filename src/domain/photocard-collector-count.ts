/** Current live ownership of one canonical catalog identity, never local fixtures. */
export const isCanonicalPhotocard = (id: string, kind: string) => kind === "photocard" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
export function formatCollectorCount(count: number): string {
  if (!Number.isSafeInteger(count) || count < 0) return "—";
  if (count < 1000) return String(count);
  const divisor = count < 1_000_000 ? 1000 : 1_000_000;
  const compact = Math.floor(count / (divisor / 10)) / 10;
  return `${compact}${divisor === 1000 ? "k" : "m"}`;
}
export type CollectorCountState = { count: number | null; pending: boolean };
const unknown = (): CollectorCountState => ({ count: null, pending: false });
/** One microtask batch for all mounted listings; no request per card. No polling.
 * Refresh on navigation focus/foreground and after ownership changes. Never
 * synthesize zero for missing/restricted/failed results. Generations reject late reads. */
export function createCollectorCountStore(fetchCounts: (ids: string[]) => Promise<Record<string, number>>) {
  const states = new Map<string, CollectorCountState>();
  const listeners = new Map<string, Set<() => void>>();
  const queued = new Set<string>();
  const versions = new Map<string, number>();
  let scheduled = false, generation = 0, nextVersion = 0;
  const emit = (id: string) => listeners.get(id)?.forEach(fn => fn());
  function queue(id: string) {
    if (queued.has(id) || states.get(id)?.pending) return;
    versions.set(id, ++nextVersion);
    queued.add(id); states.set(id, { count: null, pending: true }); emit(id);
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      const ids = [...queued]; queued.clear(); const epoch = generation;
      for (let start = 0; start < ids.length; start += 100) {
        const batch = ids.slice(start, start + 100);
        const requestVersions = new Map(batch.map(id => [id, versions.get(id)]));
        void fetchCounts(batch).then(result => {
          if (epoch !== generation) return;
          for (const id of batch) { if (requestVersions.get(id) !== versions.get(id)) continue; const n = result?.[id]; states.set(id, { count: Number.isSafeInteger(n) && n! >= 0 ? n! : null, pending: false }); emit(id); }
        }, () => {
          if (epoch !== generation) return;
          for (const id of batch) { if (requestVersions.get(id) !== versions.get(id)) continue; states.set(id, unknown()); emit(id); }
        });
      }
    });
  }
  return {
    get(id: string) { return states.get(id) ?? { count: null, pending: false }; },
    subscribe(id: string, listener: () => void) {
      const set = listeners.get(id) ?? new Set(); set.add(listener); listeners.set(id,set);
      // Fresh read when returning to a listing, shared by other mounted instances.
      if (set.size === 1) { states.delete(id); queue(id); } else listener();
      return () => { set.delete(listener); if (!set.size) { listeners.delete(id); states.delete(id); versions.delete(id); queued.delete(id); } };
    },
    refresh() { for (const id of listeners.keys()) if (!states.get(id)?.pending) { states.delete(id); queue(id); } },
    invalidate() { generation++; states.clear(); queued.clear(); for (const id of listeners.keys()) queue(id); },
  };
}
