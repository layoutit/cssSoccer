export const CSSOCCER_RUN_ON_INTELLIGENCE_MOVE = 8;

/**
 * Read the source-global want_pass_stat through its unique I_RUN_ON owner.
 *
 * The browser snapshot stores the scalar on the owning player's live motion
 * because the native global can have only one requester. The scalar's lifetime
 * follows I_RUN_ON, not the current run/stand journey: user_run may replace the
 * journey while the request remains live.
 */
export function readCssoccerActiveWantPassStat(
  sourcePlayer,
  intelligence = sourcePlayer?.intelligence,
) {
  if (
    intelligence?.move !== CSSOCCER_RUN_ON_INTELLIGENCE_MOVE
    || intelligence.count <= 0
  ) return null;
  const wantPassStat = sourcePlayer?.liveMotion?.wantPassStat;
  if (
    !Number.isSafeInteger(wantPassStat)
    || wantPassStat < 1
    || wantPassStat > 22
  ) {
    throw new Error(
      `Source want_pass owner ${sourcePlayer?.id ?? "missing"} has motion `
      + `${sourcePlayer?.liveMotion?.kind ?? "missing"}, action `
      + `${sourcePlayer?.action?.action?.value ?? "missing"}, intelligence `
      + `${intelligence.move}/${intelligence.count}, and want_pass_stat `
      + `${wantPassStat ?? "missing"}.`,
    );
  }
  return wantPassStat;
}

/**
 * Attach or clear want_pass_stat when a source visit replaces liveMotion.
 */
export function projectCssoccerWantPassMotion({
  sourcePlayer,
  intelligence,
  liveMotion,
}) {
  const projected = { ...liveMotion };
  delete projected.wantPassStat;
  delete projected.wantPassOffset;
  delete projected.wantPassFaced;
  if (
    intelligence.move !== CSSOCCER_RUN_ON_INTELLIGENCE_MOVE
    || intelligence.count <= 0
  ) return projected;
  const wantPassStat = readCssoccerActiveWantPassStat(sourcePlayer);
  if (wantPassStat === null) {
    throw new Error(
      `Source want_pass owner ${sourcePlayer?.id ?? "missing"} became active `
      + "without an active source request.",
    );
  }
  const wantPassOffset = liveMotion?.wantPassOffset
    ?? sourcePlayer?.liveMotion?.wantPassOffset;
  if (
    !Number.isFinite(wantPassOffset?.x)
    || !Number.isFinite(wantPassOffset?.y)
  ) {
    throw new Error(
      `Source want_pass owner ${sourcePlayer?.id ?? "missing"} lost its `
      + "original go_xoff/go_yoff vector.",
    );
  }
  const wantPassFaced = liveMotion?.wantPassFaced
    ?? sourcePlayer?.liveMotion?.wantPassFaced;
  if (typeof wantPassFaced !== "boolean") {
    throw new Error(
      `Source want_pass owner ${sourcePlayer?.id ?? "missing"} lost its `
      + "communication-facing state.",
    );
  }
  projected.wantPassStat = wantPassStat;
  projected.wantPassOffset = {
    x: wantPassOffset.x,
    y: wantPassOffset.y,
  };
  projected.wantPassFaced = wantPassFaced;
  return projected;
}
