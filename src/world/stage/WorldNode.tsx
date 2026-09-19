import type { CSSProperties, ReactNode } from "react";

interface WorldNodeProps {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  scale?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * A box positioned in world coordinates, centered on (x, y, z).
 *
 * Centering uses negative margins rather than a translate offset so it resolves
 * during layout, before any rotation — see the note in world.css. Everything in
 * the scene is built out of these, which keeps the coordinate convention in
 * exactly one place.
 */
export function WorldNode({
  x,
  y,
  z,
  w,
  h,
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
  scale = 1,
  className,
  style,
  children,
}: WorldNodeProps) {
  const rotation =
    (rotateX ? ` rotateX(${rotateX}deg)` : "") +
    (rotateY ? ` rotateY(${rotateY}deg)` : "") +
    (rotateZ ? ` rotateZ(${rotateZ}deg)` : "");
  const sized = scale !== 1 ? ` scale(${scale})` : "";

  return (
    <div
      className={`world-node${className ? ` ${className}` : ""}`}
      style={{
        width: w,
        height: h,
        marginLeft: -w / 2,
        marginTop: -h / 2,
        transform: `translate3d(${x}px, ${y}px, ${z}px)${rotation}${sized}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
