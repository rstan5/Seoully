/** Ownership and placement are separate. Evidence comes from persisted owner rows. */
export type FirstHomeState = {
  identityReady: boolean;
  holdingId: string | null;
  roomId: string | null;
  placedHoldingId: string | null;
};
export function firstHomeIsComplete(state: FirstHomeState): boolean {
  return state.identityReady && Boolean(state.holdingId && state.roomId && state.placedHoldingId === state.holdingId);
}
