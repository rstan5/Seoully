"use client";

import { useState } from "react";
import type { Room, ZoneId } from "@/domain/types";
import { WorldNode } from "@/world/stage/WorldNode";

/**
 * Clickable regions for each zone, used to focus the camera on an area rather
 * than a specific object.
 *
 * Placed *behind* the zone's contents in depth, so an album or poster always
 * wins the pointer. That ordering matters: clicking a thing should inspect the
 * thing, and clicking the empty space around it should approach the area. A
 * hotspot layered on top would swallow every object interaction in the room.
 */
export function ZoneHotspots({
  room,
  active,
  onFocus,
}: {
  room: Room;
  active: boolean;
  onFocus: (zoneId: ZoneId) => void;
}) {
  const [hovered, setHovered] = useState<ZoneId | null>(null);
  if (!active) return null;

  return (
    <>
      {room.zones.map((zone) => (
        <WorldNode
          key={zone.id}
          x={zone.transform.x}
          y={zone.transform.y}
          z={zone.transform.z - 12}
          w={zone.size.w + 40}
          h={zone.size.h + 40}
          className="zone-hotspot"
        >
          <div
            style={{ position: "absolute", inset: 0 }}
            onPointerEnter={() => setHovered(zone.id)}
            onPointerLeave={() => setHovered((id) => (id === zone.id ? null : id))}
            onClick={() => onFocus(zone.id)}
            role="button"
            tabIndex={0}
            aria-label={`Approach the ${zone.label.toLowerCase()}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onFocus(zone.id);
              }
            }}
          />

          {/* Label. Appears only on hover and sits in the world, angled with
              the surface it belongs to, so it reads as a tag on the furniture
              rather than a tooltip floating over a screenshot. */}
          <div
            style={{
              position: "absolute",
              left: 20,
              bottom: -6,
              opacity: hovered === zone.id ? 1 : 0,
              transform: `translateY(${hovered === zone.id ? 0 : 6}px)`,
              transition: "opacity 220ms var(--ease-physical), transform 220ms var(--ease-physical)",
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            <span
              className="u-eyebrow"
              style={{
                fontSize: 9,
                color: "var(--room-ink)",
                textShadow: "0 2px 10px rgba(0,0,0,0.7)",
              }}
            >
              {zone.label}
            </span>
          </div>
        </WorldNode>
      ))}
    </>
  );
}
