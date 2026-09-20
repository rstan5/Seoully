"use client";

import { create } from "zustand";
import { repository } from "@/domain/memory-repository";
import type { CatalogDraft, CatalogMatch } from "@/domain/catalog-match";
import { identification } from "@/domain/identification";
import { readLocalImage } from "@/domain/media";
import { homeForTemplate, slotForHome } from "@/domain/homes";
import { handleError, isFixtureUser, normalizeHandle, readSession, writeSession } from "@/domain/session";
import { photoErrorKey } from "@/locale/copy";
import { hydrateLocale } from "@/locale/store";
import type {
  CollectorInterest,
  CollectibleKind,
  GroupId,
  IdentificationCandidate,
  MediaRef,
  MemberId,
  EraId,
  Session,
  TemplateId,
  UserId,
  ZoneKind,
} from "@/domain/types";
import { buildPages, spreadOfTemplate } from "@/world/objects/binderGeometry";
import { useWorld, type WorldView } from "@/world/store/worldStore";
import { HEART_FINALE, useHeartCompanion } from "@/world/store/heartCompanionStore";
import type { MessageKey } from "@/locale/en";
import { createSeoullyAccount, resolveCurrentSeoullyIdentity, signInToSeoully, signOutOfSeoully, updateMySeoullyProfile } from "@/server/auth/actions";
import { contributeCatalogItem } from "@/server/catalog/actions";
import { createHolding } from "@/server/holdings/actions";
import { addWishlist } from "@/server/wishlist/actions";
import { uploadPersonalMedia } from "@/world/store/productionMedia";
import type { CurrentProfilePatch } from "@/domain/identity";

export type Gate = "booting" | "welcome" | "onboarding" | "ready";
export type OnboardStep =
  | "account"
  | "signin"
  | "photo"
  | "group"
  | "bias"
  | "interest"
  | "collect"
  | "describe"
  | "confirm"
  | "reveal"
  | "meet";

export type ConfirmMode = "identify" | "draft" | "found" | "choose" | "fresh";

interface SessionState {
  gate: Gate;
  step: OnboardStep;
  session: Session;
  error: string | null;
  looking: boolean;
  photo: MediaRef | null;
  candidates: IdentificationCandidate[];
  selectedTemplateId: TemplateId | null;
  productionTemplateId: string | null;
  productionHoldingId: string | null;
  pendingDraft: CatalogDraft | null;
  catalogMatches: CatalogMatch[];
  confirmMode: ConfirmMode;
  placementHint: boolean;

  boot: () => void;
  showWelcome: () => void;
  showSignIn: () => void;
  showCreate: () => void;
  enterDemo: () => Promise<void>;
  createAccount: (handle: string, displayName: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  savePhoto: (avatarUrl?: string) => void;
  saveGroups: (favoriteGroupIds: string[]) => void;
  saveBias: (biasMemberIds: string[]) => void;
  saveInterests: (collectorInterests: CollectorInterest[]) => void;
  completeProfile: (input: {
    bio: string;
    avatarUrl?: string;
    favoriteGroupIds: string[];
    biasMemberIds: string[];
    favoriteEraIds: string[];
    collectorInterests: CollectorInterest[];
  }) => void;
  enterFirstRoom: () => void;
  finishRoomIntro: () => void;
  finishFirstSession: (next: "feed" | "profile", userId?: UserId) => void;
  identifyPhoto: (file: File) => Promise<void>;
  identifySample: (templateId: TemplateId) => Promise<void>;
  searchPick: (templateId: TemplateId) => void;
  searchPickProduction: (input: {
    id: string;
    name: string;
    kind: CollectibleKind;
    groupName: string;
    memberName?: string | null;
    releaseName?: string | null;
    descriptor?: string;
  }) => void;
  startDescribe: (name?: string) => void;
  reviewDraft: (draft: CatalogDraft) => void;
  resolveDraft: () => void;
  useCatalogMatch: (templateId: TemplateId) => void;
  createFromDraft: () => Promise<void>;
  confirmHolding: () => Promise<void>;
  wantInstead: () => Promise<void>;
  clearError: () => void;
  openCollect: () => void;
  closeCollect: () => void;
  dismissPlacementHint: () => void;
}

function hideHeart() {
  useHeartCompanion.getState().hide();
}

function resetHeart() {
  useHeartCompanion.getState().reset();
}

let confirmInFlight = false;

function playHeart(messages: MessageKey | readonly MessageKey[], then?: () => void) {
  useHeartCompanion.getState().play(Array.isArray(messages) ? messages : [messages], then);
}

function settleHeart() {
  useHeartCompanion.getState().settleCorner();
}

function heartBusy() {
  return useHeartCompanion.getState().mode === "scene";
}

function productionSession(userId: UserId): Extract<Session, { kind: "auth" }> {
  return { kind: "auth", userId };
}

function translateAuthFailure(reason: string): string {
  const keys: Record<string, string> = {
    configuration: "error.authConfiguration",
    unavailable: "error.authUnavailable",
    "invalid-input": "error.authInvalidInput",
    "handle-taken": "error.handleTaken",
    "email-taken": "error.emailTaken",
    "invalid-credentials": "error.invalidCredentials",
    "profile-missing": "error.profileMissing",
  };
  return keys[reason] ?? "error.authUnavailable";
}

async function persistProfilePatch(userId: UserId, patch: CurrentProfilePatch): Promise<boolean> {
  const result = await updateMySeoullyProfile(patch);
  if (!result.ok) {
    useSession.setState({ error: translateAuthFailure(result.reason) });
    return false;
  }
  if (!("identity" in result)) {
    useSession.setState({ error: "error.authUnavailable" });
    return false;
  }
  repository.adoptAuthenticatedIdentity(result.identity);
  if (result.identity.user.id !== userId) {
    useSession.setState({ error: "error.authUnavailable" });
    return false;
  }
  return true;
}

function adopt(userId: UserId, into: "arrival" | "edit" | "room") {
  const room = repository.getRoomByOwner(userId);
  if (!room) return;
  const view =
    into === "edit" ? ({ kind: "edit" } as const) : into === "room" ? ({ kind: "room" } as const) : ({ kind: "arrival" } as const);
  useWorld.getState().adoptViewer(userId, room.id, view);
}

function showFirstCollectible(userId: UserId) {
  const holdings = repository.listHoldings(userId);
  const holding = holdings.at(-1);
  const template = holding ? repository.getTemplate(holding.templateId) : undefined;
  if (!template) {
    adopt(userId, "room");
    return;
  }
  enterHome(userId, homeForTemplate(template).zone, template.id);
}

function enterHome(userId: UserId, zoneKind: ZoneKind, templateId: TemplateId) {
  const room = repository.getRoomByOwner(userId);
  if (!room) return;
  const zone = room.zones.find((z) => z.kind === zoneKind);
  if (!zone) {
    useWorld.getState().adoptViewer(userId, room.id, { kind: "room" });
    return;
  }
  let view: WorldView = { kind: "zone", zoneId: zone.id };
  if (zoneKind === "binder") {
    const progress = repository.listSetProgress(userId);
    const cards = repository
      .listPlacementsInZone(room.id, zone.id)
      .map((placement) => repository.getHoldingView(placement.holdingId))
      .filter((item): item is NonNullable<typeof item> => item !== undefined);
    const pages = buildPages(progress, cards, (id) => repository.getTemplate(id));
    view = { kind: "binder", zoneId: zone.id, page: spreadOfTemplate(pages, templateId) };
  }
  useWorld.getState().adoptViewer(userId, room.id, view);
}

export const useSession = create<SessionState>((set, get) => ({
  gate: "booting",
  step: "account",
  session: { kind: "none" },
  error: null,
  looking: false,
  photo: null,
  candidates: [],
  selectedTemplateId: null,
  productionTemplateId: null,
  productionHoldingId: null,
  pendingDraft: null,
  catalogMatches: [],
  confirmMode: "identify",
  placementHint: false,

  boot: async () => {
    repository.hydrate();
    hydrateLocale();
    const fixtureSession = readSession();
    const resolvedIdentity = await resolveCurrentSeoullyIdentity();
    if (resolvedIdentity && "unavailable" in resolvedIdentity) {
      resetHeart();
      set({ gate: "welcome", session: { kind: "none" }, error: "error.authUnavailable" });
      return;
    }
    const identity = resolvedIdentity;
    if (identity) {
      repository.adoptAuthenticatedIdentity(identity);
      const session = productionSession(identity.user.id);
      const progress = repository.onboardingState(identity.user.id);
      if (!progress.profileComplete) {
        const step: OnboardStep = progress.identityBeat === "done" ? "interest" : progress.identityBeat;
        adopt(identity.user.id, "room");
        resetHeart();
        set({ gate: "onboarding", step, session, error: null });
        return;
      }
      if (!progress.firstHoldingComplete) {
        adopt(identity.user.id, "room");
        resetHeart();
        set({ gate: "onboarding", step: "collect", session, error: null });
        return;
      }
      if (!progress.firstSessionComplete) {
        if (!progress.roomIntroduced) {
          showFirstCollectible(identity.user.id);
          hideHeart();
          set({ gate: "ready", session, error: null, placementHint: true });
          return;
        }
        adopt(identity.user.id, "room");
        resetHeart();
        set({ gate: "onboarding", step: "meet", session, error: null });
        return;
      }
      adopt(identity.user.id, "arrival");
      settleHeart();
      set({ gate: "ready", session, error: null });
      return;
    }
    if (fixtureSession.kind === "demo") {
      const user = repository.getUser(fixtureSession.userId);
      const room = repository.getRoomByOwner(fixtureSession.userId);
      if (user && room && isFixtureUser(user.id)) {
        adopt(user.id, "arrival");
        settleHeart();
        set({ gate: "ready", session: fixtureSession, error: null });
      } else set({ gate: "welcome", session: { kind: "none" }, error: "error.sessionLost" });
      return;
    }
    const session: Session = { kind: "none" };
    resetHeart();
    writeSession(session);
    set({ gate: "welcome", session, error: null });
  },

  showWelcome: () => {
    resetHeart();
    set({ gate: "welcome", step: "account", error: null, photo: null, candidates: [] });
  },
  showSignIn: () => {
    resetHeart();
    set({ gate: "onboarding", step: "signin", error: null });
  },
  showCreate: () => {
    resetHeart();
    set({ gate: "onboarding", step: "account", error: null });
  },

  enterDemo: async () => {
    const current = get().session.kind !== "none" ? get().session : readSession();
    if (current.kind === "local") {
      get().boot();
      return;
    }
    if (current.kind === "auth") {
      const signedOut = await signOutOfSeoully();
      if (!signedOut.ok) { set({ error: "error.authUnavailable" }); return; }
    }
    const userId = "u-soo" as UserId;
    writeSession({ kind: "demo", userId });
    adopt(userId, "arrival");
    settleHeart();
    set({ gate: "ready", session: { kind: "demo", userId }, error: null });
  },

  createAccount: async (handle, displayName, email, password) => {
    if (heartBusy()) return;
    const normalized = normalizeHandle(handle);
    const invalid = handleError(normalized);
    if (invalid) {
      set({ error: invalid });
      return;
    }
    const result = await createSeoullyAccount({ handle: normalized, displayName, email, password });
    if (!result.ok) {
      set({ error: translateAuthFailure(result.reason) });
      return;
    }
    if (!("identity" in result)) {
      set({ error: "error.emailConfirmation" });
      return;
    }
    repository.adoptAuthenticatedIdentity(result.identity);
    const session = productionSession(result.identity.user.id);
    writeSession(session);
    adopt(result.identity.user.id, "room");
    set({ session, error: null });
    playHeart("heart.meet", () => set({ step: "photo", error: null }));
  },

  signIn: async (email, password) => {
    const result = await signInToSeoully({ email, password });
    if (!result.ok) {
      set({ error: translateAuthFailure(result.reason) });
      return;
    }
    if (!("identity" in result)) { set({ error: "error.authUnavailable" }); return; }
    repository.adoptAuthenticatedIdentity(result.identity);
    const session = productionSession(result.identity.user.id);
    writeSession(session);
    const progress = repository.onboardingState(session.userId);
    if (!progress.profileComplete) {
      const step: OnboardStep = progress.identityBeat === "done" ? "interest" : progress.identityBeat;
      adopt(session.userId, "room"); resetHeart(); set({ gate: "onboarding", step, session, error: null }); return;
    }
    if (!progress.firstHoldingComplete) {
      adopt(session.userId, "room"); resetHeart(); set({ gate: "onboarding", step: "collect", session, error: null }); return;
    }
    if (!progress.firstSessionComplete) {
      if (!progress.roomIntroduced) { showFirstCollectible(session.userId); hideHeart(); set({ gate: "ready", session, error: null, placementHint: true }); return; }
      adopt(session.userId, "room"); resetHeart(); set({ gate: "onboarding", step: "meet", session, error: null }); return;
    }
    adopt(session.userId, "arrival"); settleHeart(); set({ gate: "ready", session, error: null });
  },

  signOut: async () => {
    const result = await signOutOfSeoully();
    if (!result.ok) { set({ error: "error.authUnavailable" }); return; }
    writeSession({ kind: "none" });
    resetHeart();
    set({ gate: "welcome", step: "account", session: { kind: "none" }, error: null });
  },

  savePhoto: (avatarUrl) => {
    if (heartBusy()) return;
    const session = get().session;
    if (session.kind === "none") return;
    if (avatarUrl) repository.updateProfile(session.userId, { avatarUrl });
    repository.markIdentityBeat(session.userId, "group");
    playHeart(avatarUrl ? "heart.photo" : "heart.photoSkip", () => set({ step: "group", error: null }));
  },

  saveGroups: async (favoriteGroupIds) => {
    if (heartBusy()) return;
    const session = get().session;
    if (session.kind === "none") return;
    const patch = { favoriteGroupIds: favoriteGroupIds as GroupId[] };
    if (session.kind === "auth") { if (!(await persistProfilePatch(session.userId, patch))) return; }
    else repository.updateProfile(session.userId, { favoriteGroupIds: favoriteGroupIds as GroupId[] });
    if (favoriteGroupIds.length === 0) {
      repository.markIdentityBeat(session.userId, "interest");
      playHeart("heart.almost", () => set({ step: "interest", error: null }));
      return;
    }
    repository.markIdentityBeat(session.userId, "bias");
    playHeart("heart.group", () => set({ step: "bias", error: null }));
  },

  saveBias: async (biasMemberIds) => {
    if (heartBusy()) return;
    const session = get().session;
    if (session.kind === "none") return;
    const patch = { biasMemberIds: biasMemberIds as MemberId[] };
    if (session.kind === "auth") { if (!(await persistProfilePatch(session.userId, patch))) return; }
    else repository.updateProfile(session.userId, { biasMemberIds: biasMemberIds as MemberId[] });
    repository.markIdentityBeat(session.userId, "interest");
    playHeart(biasMemberIds.length > 0 ? "heart.bias" : "heart.almost", () =>
      set({ step: "interest", error: null }),
    );
  },

  saveInterests: async (collectorInterests) => {
    if (heartBusy()) return;
    const session = get().session;
    if (session.kind === "none") return;
    const interests = collectorInterests.length > 0 ? collectorInterests : (["photocards"] as CollectorInterest[]);
    const patch = {
      collectorInterests: interests,
      collectorType: interests.includes("everything") ? "Collects everything" : "Collector",
    };
    if (session.kind === "auth") { if (!(await persistProfilePatch(session.userId, patch))) return; }
    else repository.updateProfile(session.userId, patch);
    repository.markProfileComplete(session.userId);
    const already = useHeartCompanion.getState().lastKey === "heart.almost";
    const go = () => set({ step: "collect", error: null });
    if (already) go();
    else playHeart("heart.almost", go);
  },

  completeProfile: async (input) => {
    if (heartBusy()) return;
    const session = get().session;
    if (session.kind === "none") return;
    const patch: CurrentProfilePatch = {
      bio: input.bio.trim(),
      favoriteGroupIds: input.favoriteGroupIds as GroupId[],
      biasMemberIds: input.biasMemberIds as MemberId[],
      favoriteEraIds: input.favoriteEraIds as EraId[],
      collectorInterests: input.collectorInterests,
      collectorType: input.collectorInterests.includes("everything")
        ? "Collects everything"
        : "Collector",
    };
    if (session.kind === "auth") {
      if (!(await persistProfilePatch(session.userId, patch))) return;
      if (input.avatarUrl) repository.updateProfile(session.userId, { avatarUrl: input.avatarUrl });
    } else repository.updateProfile(session.userId, {
      bio: patch.bio,
      favoriteGroupIds: input.favoriteGroupIds as GroupId[],
      biasMemberIds: input.biasMemberIds as MemberId[],
      favoriteEraIds: input.favoriteEraIds as EraId[],
      collectorInterests: input.collectorInterests,
      collectorType: patch.collectorType,
      ...(input.avatarUrl ? { avatarUrl: input.avatarUrl } : {}),
    });
    repository.markProfileComplete(session.userId);
    const already = useHeartCompanion.getState().lastKey === "heart.almost";
    const go = () => set({ gate: "onboarding", step: "collect", error: null });
    if (already) go();
    else playHeart("heart.almost", go);
  },

  enterFirstRoom: () => {
    const session = get().session;
    if (session.kind === "none") return;
    showFirstCollectible(session.userId);
    hideHeart();
    set({ gate: "ready", placementHint: true, error: null });
  },

  finishRoomIntro: () => {
    const session = get().session;
    if (session.kind !== "local" && session.kind !== "auth") return;
    const progress = repository.onboardingState(session.userId);
    if (progress.firstSessionComplete) return;
    if (!progress.firstHoldingComplete) return;
    repository.markRoomIntroduced(session.userId);
    hideHeart();
    set({ gate: "onboarding", step: "meet", error: null, placementHint: false });
  },

  finishFirstSession: (next, userId) => {
    if (heartBusy()) return;
    const session = get().session;
    if (session.kind === "none") return;
    repository.markFirstSessionComplete(session.userId);
    playHeart(HEART_FINALE, () => {
      adopt(session.userId, "room");
      if (next === "profile" && userId) useWorld.getState().showProfile(userId);
      else useWorld.getState().showFeed();
      settleHeart();
      set({ gate: "ready", error: null, placementHint: false });
    });
  },

  identifyPhoto: async (file) => {
    set({ looking: true, error: null });
    const read = await readLocalImage(file);
    if (!read.ok) {
      set({ looking: false, error: photoErrorKey(read.code) });
      return;
    }
    const session = get().session;
    const profile = session.kind === "none" ? undefined : repository.getProfile(session.userId);
    try {
      let candidates: IdentificationCandidate[] = [];
      if (session.kind === "auth") {
        const formData = new FormData();
        formData.set("file", file);
        const response = await fetch("/api/identification", { method: "POST", body: formData });
        if (!response.ok) throw new Error("identification_provider_unavailable");
        const payload = await response.json() as { candidates?: Array<{ id: string; name: string; kind: CollectibleKind; groupName: string; memberName?: string | null; releaseName?: string | null; descriptor?: string }> };
        candidates = (payload.candidates ?? []).flatMap((candidate, index) => {
          const localId = repository.adoptProductionCatalogTemplate(candidate);
          return localId ? [{
            templateId: localId,
            productionTemplateId: candidate.id,
            confidence: index === 0 ? 0.8 : 0.62,
            groupId: repository.getTemplate(localId)!.groupId,
            kind: candidate.kind,
            reason: "Possible catalog match",
          }] : [];
        });
      } else {
        candidates = await identification.identify({
          image: read.media,
          filename: file.name,
          favoriteGroupIds: profile?.favoriteGroupIds,
        });
      }
      if (candidates.length === 0) {
        set({
          looking: false,
          error: null,
          photo: read.media,
          candidates: [],
          selectedTemplateId: null,
          pendingDraft: {
            name: "",
            kind: "photocard",
            groupId: (profile?.favoriteGroupIds[0] ?? repository.listGroups()[0]?.id ?? "") as GroupId,
          },
          catalogMatches: [],
          confirmMode: "draft",
          step: "describe",
        });
        return;
      }
      set({
        looking: false,
        photo: read.media,
        candidates,
        selectedTemplateId: candidates[0]!.templateId,
        pendingDraft: null,
        catalogMatches: [],
        confirmMode: "identify",
        step: "confirm",
      });
    } catch {
      set({
        looking: false,
        error: null,
        photo: read.media,
        candidates: [],
        selectedTemplateId: null,
        pendingDraft: {
          name: "",
          kind: "photocard",
          groupId: (profile?.favoriteGroupIds[0] ?? repository.listGroups()[0]?.id ?? "") as GroupId,
        },
        catalogMatches: [],
        confirmMode: "draft",
        step: "describe",
      });
    }
  },

  identifySample: async (templateId) => {
    const template = repository.getTemplate(templateId);
    if (!template) {
      set({ error: "error.catalogMissing" });
      return;
    }
    set({ looking: true, error: null });
    const session = get().session;
    const profile = session.kind === "none" ? undefined : repository.getProfile(session.userId);
    try {
      const candidates = await identification.identify({
        filename: `${template.name}.jpg`,
        favoriteGroupIds: profile?.favoriteGroupIds,
      });
      const top = candidates[0] && candidates.some((c) => c.templateId === templateId)
        ? candidates
        : [
            {
              templateId,
              confidence: 0.91,
              groupId: template.groupId,
              ...(template.memberId ? { memberId: template.memberId } : {}),
              ...(template.eraId ? { eraId: template.eraId } : {}),
              ...(template.releaseId ? { releaseId: template.releaseId } : {}),
              kind: template.kind,
              reason: "Selected from the catalog",
            },
            ...candidates.filter((c) => c.templateId !== templateId),
          ];
      set({
        looking: false,
        photo: null,
        candidates: top.slice(0, 3),
        selectedTemplateId: templateId,
        pendingDraft: null,
        catalogMatches: [],
        confirmMode: "identify",
        step: "confirm",
      });
    } catch {
      set({ looking: false, error: "error.identifyFailed" });
    }
  },

  searchPick: (templateId) => {
    const template = repository.getTemplate(templateId);
    if (!template) {
      set({ error: "error.catalogMissing" });
      return;
    }
    set({
      photo: null,
      selectedTemplateId: templateId,
      candidates: [
        {
          templateId,
          confidence: 1,
          groupId: template.groupId,
          ...(template.memberId ? { memberId: template.memberId } : {}),
          ...(template.eraId ? { eraId: template.eraId } : {}),
          ...(template.releaseId ? { releaseId: template.releaseId } : {}),
          kind: template.kind,
          reason: "You chose this",
        },
      ],
      pendingDraft: null,
      catalogMatches: [],
      confirmMode: "identify",
      step: "confirm",
      error: null,
    });
  },

  searchPickProduction: (input) => {
    const templateId = repository.adoptProductionCatalogTemplate(input);
    if (!templateId) {
      set({ error: "error.catalogMissing" });
      return;
    }
    set({ photo: null, selectedTemplateId: templateId, productionTemplateId: input.id, confirmMode: "found", error: null, step: "confirm" });
  },

  startDescribe: (name) => {
    const session = get().session;
    const profile = session.kind === "none" ? undefined : repository.getProfile(session.userId);
    const groupId = (profile?.favoriteGroupIds[0] ?? repository.listGroups()[0]?.id ?? "") as GroupId;
    set({
      step: "describe",
      confirmMode: "draft",
      selectedTemplateId: null,
      catalogMatches: [],
      pendingDraft: {
        name: name?.trim() ?? "",
        kind: "photocard",
        groupId,
      },
      error: null,
    });
  },

  reviewDraft: (draft) => {
    if (!draft.name.trim() || !draft.groupId) {
      set({ error: "catalog.needDetails" });
      return;
    }
    const photo = get().photo;
    set({
      pendingDraft: {
        ...draft,
        name: draft.name.trim(),
        ...(photo?.url ? { imageUrl: photo.url } : {}),
      },
      selectedTemplateId: null,
      catalogMatches: [],
      confirmMode: "draft",
      step: "confirm",
      error: null,
    });
  },

  resolveDraft: () => {
    const draft = get().pendingDraft;
    if (!draft) return;
    const matches = repository.findCatalogMatches(draft);
    const exact = matches.filter((match) => match.confidence === "exact");
    const plausible = matches.filter((match) => match.confidence === "plausible");
    if (exact.length === 1 && plausible.length === 0) {
      set({
        selectedTemplateId: exact[0]!.template.id,
        catalogMatches: exact,
        confirmMode: "found",
        error: null,
      });
      return;
    }
    if (matches.length > 0) {
      set({
        selectedTemplateId: null,
        catalogMatches: matches,
        confirmMode: "choose",
        error: null,
      });
      return;
    }
    set({
      selectedTemplateId: null,
      catalogMatches: [],
      confirmMode: "fresh",
      error: null,
    });
  },

  useCatalogMatch: (templateId) => {
    set({ selectedTemplateId: templateId, productionTemplateId: null, confirmMode: "found", error: null });
    get().confirmHolding();
  },

  createFromDraft: async () => {
    const draft = get().pendingDraft;
    if (!draft) return;
    const session = get().session;
    let productionTemplateId: string | null = null;
    if (session.kind === "auth") {
      const group = repository.getGroup(draft.groupId);
      const member = draft.memberId ? repository.getMember(draft.memberId) : undefined;
      const release = draft.releaseId ? repository.getRelease(draft.releaseId) : undefined;
      const result = await contributeCatalogItem({
        name: draft.name,
        kind: draft.kind,
        groupName: group?.name ?? draft.groupId,
        ...(member ? { memberName: member.stageName } : {}),
        ...(release ? { releaseName: release.title } : {}),
        ...(draft.imageUrl ? { descriptor: "community photo reference" } : {}),
      });
      if (!result.ok) {
        set({ error: result.reason === "unauthenticated" ? "error.invalidCredentials" : "error.authUnavailable" });
        return;
      }
      productionTemplateId = result.contribution.template.id;
      const ownership = await createHolding({ templateId: productionTemplateId });
      if (!ownership.ok) {
        set({ error: ownership.reason === "unauthenticated" ? "error.invalidCredentials" : "error.authUnavailable" });
        return;
      }
      set({ productionHoldingId: ownership.holding.id });
    }
    const created = repository.createCatalogItem(draft);
    set({ selectedTemplateId: created.id, productionTemplateId, catalogMatches: [] });
    get().confirmHolding();
  },

  confirmHolding: async () => {
    if (confirmInFlight) return;
    confirmInFlight = true;
    const { session, selectedTemplateId, productionTemplateId, productionHoldingId, photo, candidates } = get();
    if (session.kind === "none" || !selectedTemplateId) { confirmInFlight = false; return; }
    const room = repository.getRoomByOwner(session.userId);
    const template = repository.getTemplate(selectedTemplateId);
    if (!room || !template) {
      set({ error: "error.roomNotReady" });
      confirmInFlight = false;
      return;
    }
    let durableHoldingId = productionHoldingId;
    const selectedCandidate = candidates.find((candidate) => candidate.templateId === selectedTemplateId);
    const confirmedProductionTemplateId = productionTemplateId ?? selectedCandidate?.productionTemplateId ?? null;
    if (session.kind === "auth" && confirmedProductionTemplateId && !durableHoldingId) {
      const ownership = await createHolding({ templateId: confirmedProductionTemplateId });
      if (!ownership.ok) {
        set({ error: ownership.reason === "unauthenticated" ? "error.invalidCredentials" : "error.authUnavailable" });
        confirmInFlight = false;
        return;
      }
      durableHoldingId = ownership.holding.id;
    }
    const first =
      (session.kind === "local" || session.kind === "auth") && !repository.onboardingState(session.userId).firstHoldingComplete;
    const owned = repository.listHoldings(session.userId).some((h) => h.templateId === selectedTemplateId);
    const home = homeForTemplate(template);
    const zone = room.zones.find((z) => z.kind === home.zone);
    const used = zone ? repository.listPlacementsInZone(room.id, zone.id).map((p) => p.slot) : [];
    repository.addHolding({
      ownerId: session.userId,
      templateId: selectedTemplateId,
      ...(durableHoldingId ? { productionId: durableHoldingId } : {}),
      ...(zone ? { zoneId: zone.id, slot: slotForHome(template, home.zone, used) } : {}),
    });
    if (session.kind === "auth" && durableHoldingId) {
      const localHolding = repository.listHoldings(session.userId).find((holding) => holding.productionId === durableHoldingId);
      if (localHolding) {
        void import("@/world/store/roomPersistence").then(({ persistLocalPlacement }) =>
          persistLocalPlacement(room.id, localHolding.id));
      }
      if (photo) {
        try {
          const mediaResult = await uploadPersonalMedia(durableHoldingId, photo);
          if (!mediaResult.ok) set({ error: "error.authUnavailable" });
        } catch {
          set({ error: "error.authUnavailable" });
        }
      }
    }
    repository.markFirstHoldingComplete(session.userId);
    if (first) {
      hideHeart();
      set({
        gate: "onboarding",
        step: "reveal",
        looking: false,
        error: owned ? "error.alreadyOwned" : null,
        photo: null,
        candidates: [],
        selectedTemplateId: null,
        productionTemplateId: null,
        productionHoldingId: null,
        pendingDraft: null,
        catalogMatches: [],
        confirmMode: "identify",
      });
      confirmInFlight = false;
      return;
    }
    enterHome(session.userId, home.zone, selectedTemplateId);
    set({
      gate: "ready",
      placementHint: false,
      looking: false,
      error: owned ? "error.alreadyOwned" : "catalog.added",
      photo: null,
      candidates: [],
      selectedTemplateId: null,
      productionTemplateId: null,
      productionHoldingId: null,
      pendingDraft: null,
      catalogMatches: [],
      confirmMode: "identify",
    });
    confirmInFlight = false;
  },

  wantInstead: async () => {
    const { session, selectedTemplateId, productionTemplateId } = get();
    if (session.kind === "none" || !selectedTemplateId) return;
    if (session.kind === "auth" && productionTemplateId) {
      const result = await addWishlist({ templateId: productionTemplateId });
      if (!result.ok) {
        set({ error: result.reason === "unauthenticated" ? "error.invalidCredentials" : "error.authUnavailable" });
        return;
      }
    }
    repository.addToWishlist(session.userId, selectedTemplateId);
    set({
      step: "collect",
      error: "error.savedWishlist",
      photo: null,
      candidates: [],
      selectedTemplateId: null,
      pendingDraft: null,
      catalogMatches: [],
      confirmMode: "identify",
    });
  },

  clearError: () => set({ error: null }),
  openCollect: () =>
    set({
      gate: "onboarding",
      step: "collect",
      error: null,
      selectedTemplateId: null,
      pendingDraft: null,
      catalogMatches: [],
      confirmMode: "identify",
    }),
  closeCollect: () => {
    const session = get().session;
    if (session.kind === "none") return;
    const first =
      (session.kind === "local" || session.kind === "auth") && !repository.onboardingState(session.userId).firstHoldingComplete;
    if (first) return;
    set({
      gate: "ready",
      step: "collect",
      error: null,
      photo: null,
      candidates: [],
      selectedTemplateId: null,
      pendingDraft: null,
      catalogMatches: [],
      confirmMode: "identify",
    });
  },
  dismissPlacementHint: () => set({ placementHint: false }),
}));
