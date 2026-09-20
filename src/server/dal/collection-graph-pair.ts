import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { getCurrentIdentity } from "@/server/dal/profile";

const uuid = z.string().uuid();
const holdingSchema = z.object({
  holding_id: uuid,
  template_id: uuid,
  template_name: z.string(),
  group_id: uuid,
  member_id: uuid.nullable(),
  release_id: uuid.nullable(),
  kind: z.string(),
  trade_status: z.string(),
}).strict();

const personSchema = z.object({
  user_id: uuid,
  holdings: z.array(holdingSchema).max(500),
  wishlist_template_ids: z.array(uuid).max(500),
  favorite_group_ids: z.array(z.string().max(128)).max(24),
  bias_member_ids: z.array(z.string().max(128)).max(48),
  favorite_era_ids: z.array(z.string().max(128)).max(48),
  collector_interests: z.array(z.string().max(64)).max(7),
}).strict();

const snapshotSchema = z.object({
  target_user_id: uuid,
  visible: z.boolean(),
  target_collection_public: z.boolean().optional(),
  target_wishlist_public: z.boolean().optional(),
  actor: personSchema.optional(),
  target: personSchema.optional(),
}).strict();

export type PairHolding = z.infer<typeof holdingSchema>;
export type PairPerson = z.infer<typeof personSchema>;
export type PairSnapshot = z.infer<typeof snapshotSchema>;

export async function getCollectionPairSnapshot(targetUserId: string): Promise<PairSnapshot> {
  const parsedTarget = uuid.parse(targetUserId);
  const identity = await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  if (identity.user.id === parsedTarget) throw new Error("same_collector");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("graph_pair_snapshot", { p_target_user_id: parsedTarget });
  if (error) throw new Error("graph_pair_read_failed");
  const snapshot = snapshotSchema.parse(data);
  if (!snapshot.visible || !snapshot.actor || !snapshot.target) throw new Error("collector_not_visible");
  return snapshot;
}
