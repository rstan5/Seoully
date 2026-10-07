// Survives route unmounts: a newly opened Room must wait for older screen saves.
let liveWrites: Promise<unknown> = Promise.resolve();

/** Live-only save ordering. Accepted edits are visible before any network work. */
export class LiveRoomSync {
  private versions = new Map<string, number>();
  private confirmed = new Map<string, unknown>();
  private revision = 0;
  private load = 0;

  beginLoad() { return { load: ++this.load, revision: this.revision }; }
  acceptsLoad(ticket: { load: number; revision: number }) {
    return ticket.load === this.load && ticket.revision === this.revision;
  }
  cancelLoad() { this.load++; }
  async idle() {
    let pending;
    do {
      pending = liveWrites;
      await pending;
    } while (pending !== liveWrites);
  }
  resetConfirmed() { this.confirmed.clear(); }

  save<T>(key: string, next: T, baseline: T, apply: (value: T) => void, write: () => Promise<unknown>) {
    const version = (this.versions.get(key) ?? 0) + 1;
    this.versions.set(key, version);
    this.revision++;
    if (!this.confirmed.has(key)) this.confirmed.set(key, baseline);
    apply(next);
    const result = liveWrites.then(async () => {
      try {
        await write();
        this.confirmed.set(key, next);
        return true;
      } catch (error) {
        // A newer edit stays visible and is still queued for saving.
        if (this.versions.get(key) === version) apply(this.confirmed.get(key) as T);
        throw error;
      }
    });
    // Failure must not poison later saves or reads.
    liveWrites = result.catch(() => undefined);
    return result;
  }
}

export function liveRoomNeedsHydration(demo: boolean, loading: boolean, hasSnapshot: boolean) {
  return !demo && (loading || !hasSnapshot);
}
