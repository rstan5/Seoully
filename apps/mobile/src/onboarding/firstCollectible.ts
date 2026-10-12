/** Durable orchestration around the existing Add API, not a second Add flow. */
export type FirstCollectibleDraft = { templateId: string; templateInfo?: { name: string; kind: string; groupName?: string; memberName?: string | null; releaseName?: string | null }; holdingId: string; photoUri: string | null; shareReference: boolean; newTemplate: boolean };
export async function confirmFirstCollectible(draft: FirstCollectibleDraft, deps: {
  read(id: string): Promise<{ id: string; personalMediaUrl?: string; hasPersonalMedia?: boolean } | null>;
  create(templateId: string, id: string): Promise<{ holding: { id: string; personalMediaUrl?: string; hasPersonalMedia?: boolean } }>;
  photo(id: string, uri: string): Promise<unknown>;
  reference(templateId: string, uri: string): Promise<unknown>;
  save(draft: FirstCollectibleDraft): Promise<void>;
}) {
  let holding = await deps.read(draft.holdingId);
  if (!holding) {
    try { holding = (await deps.create(draft.templateId, draft.holdingId)).holding; }
    catch (error) {
      // Creation/hydration may have committed before its response was lost.
      holding = await deps.read(draft.holdingId);
      if (!holding) throw error;
    }
  }
  if (holding.id !== draft.holdingId) throw new Error("holding_identity_mismatch");
  if (draft.photoUri && !holding.hasPersonalMedia && !holding.personalMediaUrl) {
    try { await deps.photo(holding.id, draft.photoUri); }
    catch (error) {
      // The upload may have committed but its response was lost. Read first;
      // a failed read remains a retryable failure, never a second ownership write.
      holding = await deps.read(draft.holdingId);
      if (!holding?.hasPersonalMedia && !holding?.personalMediaUrl) throw error;
    }
  }
  if (draft.photoUri && draft.shareReference && draft.newTemplate) {
    await deps.reference(draft.templateId, draft.photoUri);
    await deps.save({ ...draft, shareReference: false });
  }
  return holding;
}
