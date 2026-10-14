/** Heart fits at the upper-third boundary of the safe viewport; resting pose is unchanged. */
export function dialogueArcHeight(height: number, top: number, bottom: number, restingTop: number, heartSize: number) {
  const safeHeight = Math.max(0, height - top - bottom);
  const endpointTop = Math.max(top + 16, top + safeHeight / 3 - heartSize);
  return Math.max(0, restingTop - endpointTop);
}
