export const CSSOCCER_NATIVE_OPENING_PLAYER_ANIMATION_SCHEMA =
  "cssoccer-native-opening-player-animation@1";

export const CSSOCCER_NATIVE_OPENING_PLAYER_ANIMATION_HASH =
  "bbf40cc1bd6e98084a9629f4517008461f9beba3cc20841fb17cb3ff80b36bc9";

const PLAYER_ROWS = Object.freeze([
  row("spain-player-01", 122, "40222071", 107),
  row("spain-player-02", 120, "40412520", 2),
  row("spain-player-03", 120, "40212521", 80),
  row("spain-player-04", 122, "3ff44101", 182),
  row("spain-player-05", 122, "40022080", 6),
  row("spain-player-06", 122, "40122077", 56),
  row("spain-player-07", 121, "40016654", 4),
  row("spain-player-08", 121, "401d6660", 103),
  row("spain-player-09", 122, "40142076", 63),
  row("spain-player-10", 78, "4122b131", 6),
  row("spain-player-11", 120, "403b2520", 143),
  row("argentina-player-01", 120, "401b2521", 65),
  row("argentina-player-02", 121, "40236663", 124),
  row("argentina-player-03", 121, "40056655", 18),
  row("argentina-player-04", 121, "3ff2ccac", 201),
  row("argentina-player-05", 121, "4013665c", 68),
  row("argentina-player-06", 78, "41203131", 0),
  row("argentina-player-07", 121, "3fd2ccb7", 145),
  row("argentina-player-08", 121, "3fdaccb4", 159),
  row("argentina-player-09", 78, "411f3131", 37),
  row("argentina-player-10", 120, "40292520", 99),
  row("argentina-player-11", 120, "404b2520", 26),
]);

/**
 * Native post-tick-zero player animation state for the pinned full-match
 * scenario. Browser tick one is intentionally bound to native tick zero.
 */
export const CSSOCCER_NATIVE_OPENING_PLAYER_ANIMATION = deepFreeze({
  schema: CSSOCCER_NATIVE_OPENING_PLAYER_ANIMATION_SCHEMA,
  status: "exact-native-post-tick-zero",
  fixtureId: "spain-argentina-full-match",
  nativeTick: 0,
  browserTick: 1,
  bindings: {
    scenarioSha256:
      "990b15c0109edf8d700cc135fbec29f89c171ce263f04a7aeb257000b7a9dbca",
    nativeStateSha256:
      "c04ec365e835712807f0a6b5fe069e3e3a61e613f035e7624f5dfa2db2f18495",
    nativeFieldContractSha256:
      "5f9b01bee40e319b611c4f948fadbfd5f7f9a08868bd658c1392dc54abeeab98",
  },
  players: PLAYER_ROWS,
  tableSha256: CSSOCCER_NATIVE_OPENING_PLAYER_ANIMATION_HASH,
});

export function cssoccerNativeOpeningPlayerAnimation(playerId) {
  const value = PLAYER_ROWS.find(({ id }) => id === playerId);
  if (!value) {
    throw new Error(`Native opening animation is unavailable for ${String(playerId)}.`);
  }
  return value;
}

function row(id, slotId, frameBits, localFrameIndex) {
  return Object.freeze({
    id,
    slotId,
    frame: f32FromBits(frameBits),
    frameBits,
    localFrameIndex,
  });
}

function f32FromBits(bits) {
  if (!/^[a-f0-9]{8}$/u.test(bits)) {
    throw new Error("Native opening animation frame bits are invalid.");
  }
  const bytes = new ArrayBuffer(4);
  const view = new DataView(bytes);
  view.setUint32(0, Number.parseInt(bits, 16), false);
  return view.getFloat32(0, false);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
