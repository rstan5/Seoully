/** Only the catalog create operation lives here; ownership/media are separate. */
export type ManualCatalogDetails = {
  name: string; kind: string; groupName: string;
  memberName?: string; releaseName?: string; descriptor?: string;
};
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };

export function createCatalogSubmitter<T>(storage: Storage, newKey: () => string,
  send: (collector: string, input: ManualCatalogDetails & { submissionKey: string }) => Promise<T>) {
  const flights = new Map<string, Promise<T>>();
  return (collector: string, details: ManualCatalogDetails): Promise<T> => {
    // Fixed field order also makes a re-entered draft after relaunch resumable.
    const payload: ManualCatalogDetails = { name: details.name.trim(), kind: details.kind,
      groupName: details.groupName.trim(),
      ...(details.memberName?.trim() ? { memberName: details.memberName.trim() } : {}),
      ...(details.releaseName?.trim() ? { releaseName: details.releaseName.trim() } : {}),
      ...(details.descriptor?.trim() ? { descriptor: details.descriptor.trim() } : {}) };
    // No token/credential is stored. Different details are a distinct submission;
    // pending keys are retained until a confirmed response, including on failure.
    const slot = `seoully:catalog-submission:v1:${collector}:${JSON.stringify(payload)}`;
    const existing = flights.get(slot);
    if (existing) return existing;
    const flight = (async () => {
      const submissionKey = await storage.getItem(slot) ?? newKey();
      await storage.setItem(slot, submissionKey); // Must be durable BEFORE sending.
      const result = await send(collector, { ...payload, submissionKey });
      await storage.removeItem(slot); // A later intentional submission gets a new key.
      return result;
    })();
    flights.set(slot, flight);
    void flight.finally(() => flights.delete(slot)).catch(() => {});
    return flight;
  };
}
