/** Character timing, not network/loading timing. Adapted from web HeartScene. */
export const heartSceneTiming = { entrance: 860, bubble: 240, character: 32, reading: 3000, retract: 240, exit: 640 } as const;
/** Stage-to-stage dialogue motion; the final Room corner handoff stays unchanged. */
export const dialogueMotionTiming = { entrance: 600, bubble: 250, retract: 200, exit: 500 } as const;
/** Unicode character count, including punctuation/spaces; typing time is separate. */
export function dialogueReadingMs(characterCount: number): number {
  return Math.min(5500, Math.max(2500, characterCount * 35));
}
export type HeartSceneStage = "enter" | "bubble" | "typing" | "reading" | "retract" | "exit" | "waiting";
export type HeartSceneState = { stage: HeartSceneStage; count: number };
export function advanceHeartScene(state: HeartSceneState, event: "motionEnd" | "tick" | "tap" | "readEnd", length: number): HeartSceneState {
  if (event === "tap") {
    if (state.stage === "enter" || state.stage === "bubble") return { ...state, count: length };
    if (state.stage === "typing") return { stage: "reading", count: length };
    if (state.stage === "reading") return { ...state, stage: "retract" };
    return state;
  }
  if (event === "motionEnd") {
    if (state.stage === "bubble" && state.count === length) return { ...state, stage: "reading" };
    const next = { enter: "bubble", bubble: "typing", retract: "exit", exit: "waiting" } as const;
    if (state.stage in next) return { ...state, stage: next[state.stage as keyof typeof next] };
  }
  if (event === "tick" && state.stage === "typing") {
    const count = Math.min(length, state.count + 1);
    return { count, stage: count === length ? "reading" : "typing" };
  }
  if (event === "readEnd" && state.stage === "reading") return { ...state, stage: "retract" };
  return state;
}
