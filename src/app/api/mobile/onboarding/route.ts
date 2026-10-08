import { firstHomeIsComplete } from "@/domain/first-home";
import { readFirstHome } from "@/server/dal/first-home";
import { NextResponse } from "next/server";
import { z } from "zod";
import { GROUPS, MEMBERS } from "@/domain/fixtures/catalog";
import { getCurrentIdentityFromClient } from "@/server/dal/profile";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

const idSchema = z.string().regex(/^[a-z0-9_-]{1,64}$/);
const interestSchema = z.enum([
  "albums",
  "photocards",
  "merch",
  "vinyl",
  "posters",
  "lightsticks",
  "everything",
]);

const onboardingPatchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("groups"),
    favoriteGroupIds: z.array(idSchema).max(24),
  }).strict(),
  z.object({
    action: z.literal("bias"),
    biasMemberIds: z.array(idSchema).max(48),
  }).strict(),
  z.object({
    action: z.literal("interests"),
    collectorInterests: z.array(interestSchema).min(1).max(7),
  }).strict(),
  z.object({
    action: z.literal("complete"),
  }).strict(),
]);

type OnboardingStep = "group" | "bias" | "interest" | "done";
const groupIds = new Set(GROUPS.map((group) => group.id as string));
const membersById = new Map(MEMBERS.map((member) => [member.id as string, member]));

async function currentState(
  request: Request,
): Promise<
  | {
      client: NonNullable<ReturnType<typeof createSupabaseBearerClient>>;
      userId: string;
      step: OnboardingStep;
      favoriteGroupIds: string[];
      biasMemberIds: string[];
      collectorInterests: string[];
      identityReady: boolean;
    }
  | NextResponse
> {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const identity = await getCurrentIdentityFromClient(client);
  if (!identity) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { data, error } = await client
    .from("profiles")
    .select("onboarding_step, favorite_group_ids, bias_member_ids, collector_interests, display_name, handle")
    .eq("user_id", identity.user.id)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "onboarding_unavailable" }, { status: 503 });
  }
  const step = data.onboarding_step;
  if (step !== "group" && step !== "bias" && step !== "interest" && step !== "done") {
    return NextResponse.json({ error: "onboarding_invalid" }, { status: 500 });
  }
  return {
    client,
    userId: identity.user.id,
    step,
    favoriteGroupIds: data.favorite_group_ids ?? [],
    biasMemberIds: data.bias_member_ids ?? [],
    collectorInterests: data.collector_interests ?? [],
    identityReady: Boolean(data.display_name?.trim() && data.handle?.trim() && data.collector_interests?.length),
  };
}

export async function GET(request: Request) {
  try {
    const state = await currentState(request);
    if (state instanceof NextResponse) return state;
    return NextResponse.json({
      step: state.step,
      firstHome: state.step === "interest" ? await readFirstHome(state.client, state.userId, state.identityReady) : null,
      favoriteGroupIds: state.favoriteGroupIds,
      biasMemberIds: state.biasMemberIds,
      collectorInterests: state.collectorInterests,
      groups: GROUPS.map(({ id, name, nativeName, memberIds }) => ({
        id,
        name,
        nativeName,
        memberIds,
      })),
      members: MEMBERS.map(({ id, groupId, stageName, nativeName }) => ({
        id,
        groupId,
        stageName,
        nativeName,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "onboarding_unavailable" }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const state = await currentState(request);
    if (state instanceof NextResponse) return state;
    const parsed = onboardingPatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    const editingComplete = state.step === "done";
    const identityOpen = state.step === "group" || state.step === "bias" || state.step === "interest";
    if (parsed.data.action === "groups" && (identityOpen || editingComplete)) {
      if (parsed.data.favoriteGroupIds.some((id) => !groupIds.has(id))) {
        return NextResponse.json({ error: "invalid_input" }, { status: 400 });
      }
      patch.favorite_group_ids = parsed.data.favoriteGroupIds;
      if (state.step === "group" && !editingComplete) {
        patch.onboarding_step = parsed.data.favoriteGroupIds.length > 0 ? "bias" : "interest";
      }
    } else if (parsed.data.action === "bias" && (state.step === "bias" || state.step === "interest" || editingComplete)) {
      if (parsed.data.biasMemberIds.some((id) => {
        const member = membersById.get(id);
        return !member || !state.favoriteGroupIds.includes(member.groupId);
      })) {
        return NextResponse.json({ error: "invalid_input" }, { status: 400 });
      }
      patch.bias_member_ids = parsed.data.biasMemberIds;
      if (state.step === "bias" && !editingComplete) patch.onboarding_step = "interest";
    } else if (parsed.data.action === "interests" && (state.step === "interest" || editingComplete)) {
      patch.collector_interests = parsed.data.collectorInterests;
      patch.collector_type = parsed.data.collectorInterests.includes("everything")
        ? "Collects everything"
        : "Collector";
    } else if (parsed.data.action === "complete" && state.step === "interest") {
      const firstHome = await readFirstHome(state.client, state.userId, state.identityReady);
      if (!firstHomeIsComplete(firstHome)) {
        return NextResponse.json({ error: firstHome.holdingId ? "first_placement_required" : "first_holding_required", step: state.step }, { status: 409 });
      }
      patch.onboarding_step = "done";
    } else {
      return NextResponse.json({ step: state.step });
    }

    const { data, error } = await state.client
      .from("profiles")
      .update(patch)
      .eq("user_id", state.userId)
      .select("onboarding_step")
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "onboarding_update_failed" }, { status: 400 });
    }
    return NextResponse.json({ step: data.onboarding_step });
  } catch {
    return NextResponse.json({ error: "onboarding_unavailable" }, { status: 503 });
  }
}
