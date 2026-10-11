import { chrome, type EdgeInsets } from "../ui/shellLayout";
import { heartMotion } from "../ui/heartMotion";

export const ROOM_OVERLAY_GAP = 16;
export const ROOM_NAV_MESSAGE_GAP = 24;
/** Bounds are measured after wrapping/localization; no screen-specific vertical offsets. */
export function roomOverlayLayout({ width, height, insets, headerHeight = 0, footerHeight = 0, hasFooter = false }: {
  width: number; height: number; insets: EdgeInsets; headerHeight?: number; footerHeight?: number; hasFooter?: boolean;
}) {
  const left = insets.left + ROOM_OVERLAY_GAP;
  const right = insets.right + ROOM_OVERLAY_GAP;
  const bottom = insets.bottom + chrome.companionClearance;
  const companionWidth = chrome.companionSize + 8;
  const footerRight = right + companionWidth + ROOM_OVERLAY_GAP;
  const top = Math.max(headerHeight, insets.top + ROOM_OVERLAY_GAP + 44) + ROOM_NAV_MESSAGE_GAP;
  const reservedBottom = bottom + Math.max(companionWidth + heartMotion.travel, hasFooter ? footerHeight || 44 : 0) + ROOM_OVERLAY_GAP;
  const messageWidth = Math.min(360, Math.max(0, width - left - right));
  return {
    navigation: { paddingTop: insets.top + ROOM_OVERLAY_GAP, paddingLeft: left, paddingRight: right },
    footer: { bottom, left, right: footerRight, paddingBottom: 12 },
    messages: { top, left: left + Math.max(0, (width - left - right - messageWidth) / 2), width: messageWidth, maxHeight: Math.max(0, height - top - reservedBottom) },
  };
}
