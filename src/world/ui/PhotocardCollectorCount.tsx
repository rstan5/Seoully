"use client";
import { useEffect, useState } from "react";
import { createCollectorCountStore, formatCollectorCount, isCanonicalPhotocard } from "@/domain/photocard-collector-count";
import { useT } from "@/locale/store";
import { IconGroup } from "./SocialIcons";
const store = createCollectorCountStore(async templateIds => {
  const response = await fetch("/api/catalog/collector-counts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateIds }) });
  if (!response.ok) throw new Error("collector_counts_unavailable");
  return (await response.json() as { counts: Record<string, number> }).counts;
});
let subscribers = 0;
const refresh = () => store.refresh();
const invalidate = () => store.invalidate();
function subscribeLifecycle() {
  if (subscribers++ === 0) {
    window.addEventListener("focus", refresh);
    window.addEventListener("seoully:ownership-changed", invalidate);
  }
  return () => { if (--subscribers === 0) {
    window.removeEventListener("focus", refresh);
    window.removeEventListener("seoully:ownership-changed", invalidate);
  } };
}
export function PhotocardCollectorCount({ templateId, kind }: { templateId: string; kind: string }) {
  const t = useT();
  const eligible = isCanonicalPhotocard(templateId, kind);
  const [, rerender] = useState(0);
  const state = store.get(templateId);
  useEffect(() => {
    if (!eligible) return;
    const stop = store.subscribe(templateId, () => rerender(value => value + 1));
    const stopLifecycle = subscribeLifecycle();
    return () => { stop(); stopLifecycle(); };
  }, [eligible, templateId]);
  if (!eligible) return null;
  const label = state.count === null ? t("photocardCollectors.unknown") : t("photocardCollectors.count", { count: state.count });
  const explanation = t("photocardCollectors.explanation");
  return <span className="s-photocard-collector-count" role="img" aria-label={label} title={explanation}><IconGroup /><span>{state.count === null ? "—" : formatCollectorCount(state.count)}</span></span>;
}
