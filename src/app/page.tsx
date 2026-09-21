"use client";

import { useEffect, useState } from "react";
import { repository } from "@/domain/memory-repository";
import type { PostId, TemplateId, UserId } from "@/domain/types";
import { Room } from "@/world/Room";
import { CollectorProfile } from "@/world/ui/CollectorProfile";
import { CollectorFeed } from "@/world/ui/CollectorFeed";
import { ProductionFeed } from "@/world/ui/ProductionFeed";
import { CollectorInbox } from "@/world/ui/CollectorInbox";
import { CollectorNotices } from "@/world/ui/CollectorNotices";
import { CollectorSearch } from "@/world/ui/CollectorSearch";
import { CollectorThread } from "@/world/ui/CollectorThread";
import { Composer } from "@/world/ui/Composer";
import { SocialShell } from "@/world/ui/SocialShell";
import { OnboardingFlow } from "@/world/ui/onboard/OnboardingFlow";
import { BrandMark } from "@/world/ui/BrandMark";
import { WelcomeGate } from "@/world/ui/onboard/WelcomeGate";
import { Doorway } from "@/world/room/Doorway";
import { useTraversal } from "@/world/useTraversal";
import { isSocialView, useWorld } from "@/world/store/worldStore";
import { useSession } from "@/world/store/sessionStore";
import { useAssistantStore } from "@/world/store/assistantStore";
import { SeoullyHeartCompanion } from "@/world/ui/onboard/SeoullyHeartCompanion";

/**
 * The whole product, on one page.
 *
 * First-time users meet a welcome gate. After identity exists, social UI is a
 * familiar light app over the world. Entering a room puts the social layer
 * away and leaves you in the physical scene.
 */
export default function Page() {
  const gate = useSession((s) => s.gate);
  const boot = useSession((s) => s.boot);
  const roomId = useWorld((s) => s.roomId);
  const viewerId = useWorld((s) => s.viewerId);
  const session = useSession((s) => s.session);
  const view = useWorld((s) => s.view);
  const traversal = useWorld((s) => s.traversal);
  const showProfile = useWorld((s) => s.showProfile);
  const showFeed = useWorld((s) => s.showFeed);
  const showInbox = useWorld((s) => s.showInbox);
  const back = useWorld((s) => s.back);
  const { travelToRoomOf, destination } = useTraversal();
  const [thread, setThread] = useState<{
    peerId: UserId;
    trade: boolean;
    templateIds?: TemplateId[];
    postId?: PostId;
  } | null>(null);
  const [sharePostId, setSharePostId] = useState<PostId | null>(null);

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    if (view.kind !== "inbox") setSharePostId(null);
  }, [view.kind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (thread) {
        e.stopImmediatePropagation();
        setThread(null);
        return;
      }
      if (useAssistantStore.getState().open) {
        e.stopImmediatePropagation();
        useAssistantStore.getState().setOpen(false);
        return;
      }
      if (isSocialView(useWorld.getState().view)) {
        e.stopImmediatePropagation();
        back();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [thread, back]);

  const enterRoomOf = (userId: typeof viewerId) => {
    const currentOwner = repository.getRoom(roomId)?.ownerId;
    if (userId === currentOwner) {
      back();
      return;
    }
    travelToRoomOf(userId);
  };

  const openMessage = (
    peerId: UserId,
    opts?: { trade?: boolean; templateIds?: TemplateId[]; postId?: PostId },
  ) => {
    const conversation = repository.getThread(viewerId, peerId);
    if (conversation && opts?.templateIds && opts.templateIds.length > 0) {
      repository.setThreadAbout(conversation.id, opts.templateIds);
    } else if (conversation && opts?.postId) {
      repository.setThreadAbout(conversation.id, []);
    }
    setThread({
      peerId,
      trade: !!opts?.trade,
      ...(opts?.templateIds ? { templateIds: opts.templateIds } : {}),
      ...(opts?.postId ? { postId: opts.postId } : {}),
    });
  };

  const startShare = (postId: PostId) => {
    setSharePostId(postId);
    showInbox();
  };

  if (gate === "booting") {
    return (
      <div className="onboard">
        <div className="onboard-frame">
          <p className="onboard-kicker">
            <BrandMark />
          </p>
        </div>
      </div>
    );
  }

  if (gate === "welcome") {
    return <WelcomeGate />;
  }

  if (gate === "onboarding") {
    return <OnboardingFlow />;
  }

  return (
    <main>
      <Room roomId={roomId} onMessage={openMessage} />

      {view.kind === "profile" && (
        <CollectorProfile
          userId={view.userId}
          viewerId={viewerId}
          onEnterRoom={enterRoomOf}
          onViewProfile={showProfile}
          onMessage={openMessage}
          onShare={startShare}
        />
      )}
      {view.kind === "feed" && (
        isUuid(viewerId) && session.kind === "auth"
          ? <ProductionFeed viewerId={viewerId} onViewProfile={showProfile} />
          : <CollectorFeed viewerId={viewerId} onViewProfile={showProfile} onShare={startShare} />
      )}
      {view.kind === "search" && (
        <CollectorSearch
          viewerId={viewerId}
          onViewProfile={showProfile}
          onEnterRoom={enterRoomOf}
          onShare={startShare}
        />
      )}
      {view.kind === "inbox" && (
        <CollectorInbox
          viewerId={viewerId}
          {...(sharePostId ? { sharePostId } : {})}
          onOpenThread={(peerId) => {
            openMessage(peerId, sharePostId ? { postId: sharePostId } : undefined);
            setSharePostId(null);
          }}
        />
      )}
      {view.kind === "notices" && (
        <CollectorNotices
          viewerId={viewerId}
          onViewProfile={showProfile}
          onOpenThread={openMessage}
        />
      )}
      {view.kind === "compose" && (
        <SocialShell tab="compose">
          <Composer viewerId={viewerId} onPosted={showFeed} />
        </SocialShell>
      )}

      {thread && (
        <CollectorThread
          peerId={thread.peerId}
          viewerId={viewerId}
          highlightTrade={thread.trade}
          aboutTemplateIds={thread.templateIds ?? []}
          aboutPostId={thread.postId}
          onClose={() => setThread(null)}
        />
      )}

      <Doorway phase={traversal} destination={destination} />
      <SeoullyHeartCompanion social={isSocialView(view)} hasNav={isSocialView(view) && view.kind !== "compose"} />
    </main>
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
