"use client";

import { useT } from "@/locale/store";
import { useWorld } from "@/world/store/worldStore";
import { useHeartCompanion } from "@/world/store/heartCompanionStore";
import { useAssistantStore } from "@/world/store/assistantStore";
import { SeoullyHeartMark } from "@/world/ui/onboard/SeoullyHeartMark";
import { AskSeoullyPanel } from "@/world/ui/onboard/AskSeoullyPanel";

/**
 * Persistent corner heart after onboarding. Same mark as the welcome mascot
 * and HeartScene character. Decorative for now; later the assistant entry.
 */
export function SeoullyHeartCompanion({ social, hasNav }: { social: boolean; hasNav: boolean }) {
  const mode = useHeartCompanion((s) => s.mode);
  const viewerId = useWorld((s) => s.viewerId);
  const open = useAssistantStore((s) => s.open);
  const t = useT();
  if (mode !== "corner") return null;

  return (
    <div className={`heart-companion is-corner${social ? " is-social" : " is-room"}${hasNav ? "" : " is-no-nav"}`} aria-hidden={false}>
      <div className="heart-companion-body">
        <div className="heart-companion-stage">
          <button
            type="button"
            className={`heart-companion-float${open ? " is-reacting" : ""}`}
            aria-label={t("assistant.open")}
            aria-expanded={open}
            aria-controls="ask-seoully-panel"
            onClick={() => {
              const assistant = useAssistantStore.getState();
              assistant.ensureViewer(viewerId);
              assistant.setOpen(!assistant.open);
            }}
          >
            <SeoullyHeartMark className="heart-companion-art" alt="" />
          </button>
          <div className="heart-companion-shadow" aria-hidden="true" />
        </div>
      </div>
      {open && <AskSeoullyPanel key="ask-seoully-panel" viewerId={viewerId} />}
    </div>
  );
}
