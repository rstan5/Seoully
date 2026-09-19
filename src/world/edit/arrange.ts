import type { PointerEvent as ReactPointerEvent } from "react";
import type { Transform3D } from "@/domain/types";
import type { MassKind } from "@/design/motion";

/** Live arrangement overlay applied while editing. */
export interface ArrangeTarget {
  editing: boolean;
  selected: boolean;
  dragging: boolean;
  offset?: Partial<Transform3D>;
  onGrab?: (event: ReactPointerEvent) => void;
  mass?: MassKind;
}

export interface ArrangeContext {
  editing: boolean;
  selectedId: string | null;
  draggingId: string | null;
  offsets: Record<string, Partial<Transform3D>>;
  onGrab: (id: string, event: ReactPointerEvent, world?: Transform3D) => void;
}

export function targetFor(
  context: ArrangeContext | undefined,
  id: string,
  world?: Transform3D,
): ArrangeTarget | undefined {
  if (!context) return undefined;
  return {
    editing: context.editing,
    selected: context.selectedId === id,
    dragging: context.draggingId === id,
    offset: context.offsets[id],
    onGrab: (event) => context.onGrab(id, event, world),
  };
}

export function mergeArrange(
  rest: { x?: number; y?: number; z?: number; rotate?: number; scale?: number },
  arrange?: ArrangeTarget,
) {
  const lifted = Boolean(arrange && arrange.dragging);
  return {
    ...rest,
    x: (rest.x ?? 0) + (arrange?.offset?.x ?? 0),
    y: (rest.y ?? 0) + (arrange?.offset?.y ?? 0) + (lifted ? -28 : 0),
    z: (rest.z ?? 0) + (arrange?.offset?.z ?? 0) + (lifted ? 54 : 0),
    rotate: rest.rotate ?? 0,
    scale: lifted ? 1.055 : (rest.scale ?? 1),
  };
}

export function grabHandlers(
  arrange: ArrangeTarget | undefined,
  interactive: boolean,
  onSelect?: () => void,
) {
  if (arrange?.editing) {
    return {
      onPointerDown: (event: ReactPointerEvent) => {
        event.stopPropagation();
        arrange.onGrab?.(event);
      },
      role: "button" as const,
      tabIndex: 0,
      "aria-pressed": arrange.selected,
    };
  }
  return {
    onClick: interactive ? onSelect : undefined,
    role: interactive ? ("button" as const) : undefined,
    tabIndex: interactive ? 0 : -1,
  };
}
