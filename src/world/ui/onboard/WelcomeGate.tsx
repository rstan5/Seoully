"use client";

import { useT } from "@/locale/store";
import { BrandMark } from "@/world/ui/BrandMark";
import { LanguageToggle } from "@/world/ui/LanguageToggle";
import { SeoullyHeart } from "@/world/ui/onboard/SeoullyHeart";
import { useSession } from "@/world/store/sessionStore";
import { localizeError } from "@/locale/copy";

export function WelcomeGate() {
  const showCreate = useSession((s) => s.showCreate);
  const showSignIn = useSession((s) => s.showSignIn);
  const enterDemo = useSession((s) => s.enterDemo);
  const error = useSession((s) => s.error);
  const t = useT();

  return (
    <div className="onboard">
      <div className="onboard-frame onboard-welcome">
        <div className="onboard-lang">
          <LanguageToggle />
        </div>
        <p className="onboard-logo">
          <BrandMark />
        </p>
        <SeoullyHeart />
        <h1>
          {t("welcome.line1")}
          <br />
          {t("welcome.line2")}
        </h1>
        <p className="onboard-lede">{t("welcome.lede")}</p>
        {error && <p className="onboard-error">{localizeError(error, t)}</p>}
        <div className="onboard-stack">
          <button type="button" className="onboard-btn" onClick={showCreate}>
            {t("welcome.create")}
          </button>
          <button type="button" className="onboard-btn is-ghost" onClick={enterDemo}>
            {t("welcome.explore")}
          </button>
          <button type="button" className="onboard-skip" onClick={showSignIn}>
            {t("welcome.signin")}
          </button>
        </div>
      </div>
    </div>
  );
}
