"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ease } from "@/design/motion";
import { repository } from "@/domain/memory-repository";
import type { DecorAsset, HoldingView, Room, RoomObject } from "@/domain/types";
import { DecorMesh } from "@/world/edit/DecorObject";
import type { PlacedSubject } from "@/world/edit/useRoomEdit";
import { useSession } from "@/world/store/sessionStore";

export function EditChrome({
  room,
  selected,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onStore,
  onDone,
  onPlaceDecor,
  onRestoreHolding,
  onRestoreDecor,
}: {
  room: Room;
  selected: PlacedSubject | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onStore: () => void;
  onDone: () => void;
  onPlaceDecor: (asset: DecorAsset, event: React.PointerEvent) => void;
  onRestoreHolding: (view: HoldingView, event: React.PointerEvent) => void;
  onRestoreDecor: (object: RoomObject, event: React.PointerEvent) => void;
}) {
  const catalog = repository.listDecorCatalog();
  const storedHoldings = repository.listStoredHoldings(room.ownerId);
  const storedDecor = repository.listStoredDecor(room.id);
  const placementHint = useSession((s) => s.placementHint);
  const dismissPlacementHint = useSession((s) => s.dismissPlacementHint);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) onRedo();
        else onUndo();
      }
      if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        onRedo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onRedo, onUndo]);

  return (
    <div className="edit-chrome" style={{ color: "var(--room-ink)" }}>
      {placementHint && (
        <p className="edit-place-hint">
          Move anything you want. Your room is yours.
          <button type="button" className="u-eyebrow" style={{ marginLeft: 12 }} onClick={dismissPlacementHint}>
            Got it
          </button>
        </p>
      )}
      <div className="edit-chrome-top">
        <span className="u-eyebrow" style={{ color: "var(--room-ink-soft)" }}>
          Arranging
        </span>
        <div className="edit-chrome-history">
          <button
            className="u-eyebrow edit-quiet"
            disabled={!canUndo}
            onClick={onUndo}
            style={{ fontSize: 8.5, opacity: canUndo ? 1 : 0.35 }}
          >
            Undo
          </button>
          <button
            className="u-eyebrow edit-quiet"
            disabled={!canRedo}
            onClick={onRedo}
            style={{ fontSize: 8.5, opacity: canRedo ? 1 : 0.35 }}
          >
            Redo
          </button>
        </div>
        <button className="u-eyebrow" style={{ fontSize: 8.5 }} onClick={() => { dismissPlacementHint(); onDone(); }}>
          Done
        </button>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            className="edit-context"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={ease.ui}
          >
            <button className="u-eyebrow" onClick={onStore}>
              Store
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="edit-tray">
        <div className="edit-tray-label u-eyebrow">Add</div>
        <div className="edit-tray-row">
          {catalog.map((asset) => (
            <button
              key={asset.id}
              className="edit-chip"
              onPointerDown={(event) => {
                event.preventDefault();
                onPlaceDecor(asset, event);
              }}
              aria-label={`Place ${asset.name}`}
            >
              <span className="edit-mini">
                <span
                  className="edit-mini-stage"
                  style={{
                    width: asset.size.w,
                    height: asset.size.h,
                    marginLeft: -asset.size.w / 2,
                    marginTop: -asset.size.h,
                    transform: `rotateX(16deg) scale(${36 / Math.max(asset.size.h, asset.size.w * 0.8)})`,
                  }}
                >
                  <DecorMesh
                    assetId={asset.id}
                    w={asset.size.w}
                    h={asset.size.h}
                    d={asset.size.d ?? 60}
                  />
                </span>
              </span>
              <span className="u-eyebrow" style={{ fontSize: 7.5 }}>
                {asset.name}
              </span>
            </button>
          ))}
        </div>
        {(storedHoldings.length > 0 || storedDecor.length > 0) && (
          <>
            <div className="edit-tray-label u-eyebrow" style={{ marginTop: 10 }}>
              Storage
            </div>
            <div className="edit-tray-row">
              {storedHoldings.map((view) => (
                <button
                  key={view.holding.id}
                  className="edit-chip"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    onRestoreHolding(view, event);
                  }}
                >
                  <span
                    className="edit-chip-swatch"
                    style={{ background: view.template.colorway.base }}
                  />
                  <span className="u-eyebrow" style={{ fontSize: 7.5 }}>
                    {view.template.name}
                  </span>
                </button>
              ))}
              {storedDecor.map((object) => {
                const asset = repository.getDecorAsset(object.assetId);
                if (!asset) return null;
                return (
                  <button
                    key={object.id}
                    className="edit-chip"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      onRestoreDecor(object, event);
                    }}
                  >
                    <span className="edit-mini">
                      <span
                        className="edit-mini-stage"
                        style={{
                          width: asset.size.w,
                          height: asset.size.h,
                          marginLeft: -asset.size.w / 2,
                          marginTop: -asset.size.h,
                          transform: `rotateX(16deg) scale(${36 / Math.max(asset.size.h, asset.size.w * 0.8)})`,
                        }}
                      >
                        <DecorMesh
                          assetId={asset.id}
                          w={asset.size.w}
                          h={asset.size.h}
                          d={asset.size.d ?? 60}
                        />
                      </span>
                    </span>
                    <span className="u-eyebrow" style={{ fontSize: 7.5 }}>
                      {asset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
