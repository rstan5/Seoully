import type { ManualCatalogDetails } from "./catalogSubmission";

/** A resumable operation, not a second catalog or ownership model. */
export type CatalogPublicationDraft = {
  details: ManualCatalogDetails;
  submissionKey: string;
  referenceUri: string;
};
export function createCatalogPublisher<T extends { id: string; imageUrl?: string; publicationState?: string }>(deps: {
  contribute(input: ManualCatalogDetails & { submissionKey: string }): Promise<{ contribution: { template: T } }>;
  reference(id: string, uri: string, key: string): Promise<unknown>;
  read(id: string): Promise<T>;
}) {
  const flights = new Map<string, Promise<T>>();
  return (draft: CatalogPublicationDraft): Promise<T> => {
    const current = flights.get(draft.submissionKey);
    if (current) return current;
    const task = (async () => {
      if (!draft.referenceUri) throw new Error("catalog_reference_required");
      // Replay the same collector-scoped key after interruption, including a lost response.
      const { contribution } = await deps.contribute({ ...draft.details, submissionKey: draft.submissionKey });
      // Existing published identity wins; never replace its reference unnecessarily.
      if (!contribution.template.imageUrl) {
        await deps.reference(contribution.template.id, draft.referenceUri, draft.submissionKey);
      }
      const confirmed = await deps.read(contribution.template.id);
      if (!confirmed.imageUrl || confirmed.publicationState !== "published") throw new Error("catalog_publication_unconfirmed");
      return confirmed;
    })();
    flights.set(draft.submissionKey, task);
    void task.finally(() => flights.delete(draft.submissionKey)).catch(() => {});
    return task;
  };
}
