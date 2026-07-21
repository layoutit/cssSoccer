export const CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_SCHEMA =
  "cssoccer-native-fixture-player-profile@1";

export const CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH =
  "412e210fa430ea0c78474e26e71629cdfaf8bb9ac8360ee91e1edac8f67e3eec";

const ATTRIBUTE_KEYS = Object.freeze([
  "pace",
  "power",
  "control",
  "flair",
  "vision",
  "accuracy",
  "stamina",
  "discipline",
]);

const BINDING_KEYS = Object.freeze([
  "sourceRevision",
  "sourceDataSha256",
  "nativeBuildSha256",
  "nativeScenarioSha256",
  "nativeFieldContractSha256",
  "nativeRawSha256",
  "nativeStateSha256",
  "nativeGameplayProfileHash",
]);

const PLAYERS = [
  player("spain-player-01", 1, [62, 78, 30, 43, 89, 65, 89, 44]),
  player("spain-player-02", 2, [43, 102, 70, 78, 65, 78, 85, 39]),
  player("spain-player-03", 3, [90, 72, 65, 88, 43, 70, 90, 34]),
  player("spain-player-04", 4, [24, 83, 61, 70, 96, 64, 87, 56]),
  player("spain-player-05", 5, [34, 60, 70, 51, 62, 67, 94, 92]),
  player("spain-player-06", 6, [85, 76, 70, 61, 88, 75, 84, 65]),
  player("spain-player-07", 7, [76, 87, 76, 74, 80, 88, 72, 103]),
  player("spain-player-08", 8, [90, 83, 87, 51, 66, 70, 55, 15]),
  player("spain-player-09", 9, [47, 74, 70, 90, 58, 88, 70, 67]),
  player("spain-player-10", 10, [33, 92, 76, 83, 47, 104, 71, 48]),
  player("spain-player-11", 11, [97, 76, 62, 38, 75, 62, 34, 85]),
  player("argentina-player-01", 12, [38, 30, 60, 25, 67, 80, 93, 92]),
  player("argentina-player-02", 13, [35, 57, 67, 70, 76, 67, 74, 52]),
  player("argentina-player-03", 14, [44, 72, 47, 85, 69, 70, 96, 44]),
  player("argentina-player-04", 15, [55, 58, 66, 71, 60, 79, 74, 24]),
  player("argentina-player-05", 16, [35, 53, 51, 57, 65, 89, 65, 85]),
  player("argentina-player-06", 17, [98, 79, 83, 96, 88, 72, 53, 37]),
  player("argentina-player-07", 18, [96, 88, 92, 79, 90, 88, 49, 24]),
  player("argentina-player-08", 19, [89, 70, 90, 85, 113, 99, 92, 83]),
  player("argentina-player-09", 20, [75, 96, 94, 83, 70, 103, 94, 49]),
  player("argentina-player-10", 21, [81, 119, 89, 94, 88, 101, 79, 66]),
  player("argentina-player-11", 22, [83, 58, 79, 67, 79, 70, 85, 23]),
];

/**
 * Fixed initialization data owned by the pinned native fixture profile.
 *
 * These values are ordinary browser inputs after build-time qualification;
 * no native capture, source checkout, or prepared evidence is read at runtime.
 */
export const CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE = deepFreeze({
  schema: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_SCHEMA,
  fixtureId: "spain-argentina-full-match",
  attributeValueType: "u8",
  bindings: {
    sourceRevision: "b40bd6d1e50e052030c5f0884fbe3deda7e9fa4b",
    sourceDataSha256: "a8728b797e5164e1529c4150453735d7045ae1e90e7cba96338b3d1fac029492",
    nativeBuildSha256: "5db9d52f4dec6e71d2a1df1009c803967455a3683b1c87e271669165ef43a3e3",
    nativeScenarioSha256: "5fc29151faf3ff344c37562b42148322ae0b976385cd8615fcccfcf8b529eb81",
    nativeFieldContractSha256: "6d21511c288f9553628079ffeaa4a6538d4eb1a8e4b36acb4f1d0c44de42a76e",
    nativeRawSha256: "1b46cb63a708d6af237d3af91d6c5846bc456e93ef6b5d731a1d36cbcaffabdb",
    nativeStateSha256: "eb858bed9ad9d36670e97a98ea49235d8009246ded16e00dcb54c5dc1aef2fdd",
    nativeGameplayProfileHash: "9961b831e5dc4d8efc602cb00b8c2fd506010d9072f4903eeb5c55e498dd8a82",
  },
  players: PLAYERS,
  profileHash: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH,
});

export function assertCssoccerNativeFixturePlayerProfile(value) {
  requirePlainObject(value, "native fixture player profile");
  requireExactKeys(value, [
    "attributeValueType",
    "bindings",
    "fixtureId",
    "players",
    "profileHash",
    "schema",
  ], "native fixture player profile");
  if (
    value.schema !== CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_SCHEMA
    || value.fixtureId !== "spain-argentina-full-match"
    || value.attributeValueType !== "u8"
    || value.profileHash !== CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH
  ) {
    throw new Error(
      `Native fixture player profile must use ${CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_SCHEMA}.`,
    );
  }
  requireBindings(value.bindings);
  if (JSON.stringify(value.bindings) !== JSON.stringify(
    CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE.bindings,
  )) {
    throw new Error("Native fixture player profile binding changed.");
  }
  if (!Array.isArray(value.players) || value.players.length !== 22) {
    throw new Error("Native fixture player profile must contain exactly 22 players.");
  }
  for (const [index, entry] of value.players.entries()) {
    const nativePlayerNumber = index + 1;
    const country = nativePlayerNumber <= 11 ? "spain" : "argentina";
    const shirt = ((nativePlayerNumber - 1) % 11) + 1;
    const expectedId = `${country}-player-${String(shirt).padStart(2, "0")}`;
    requirePlainObject(entry, `native fixture player ${nativePlayerNumber}`);
    requireExactKeys(
      entry,
      ["attributes", "id", "kickoffNativePlayerNumber"],
      `native fixture player ${nativePlayerNumber}`,
    );
    if (
      entry.id !== expectedId
      || entry.kickoffNativePlayerNumber !== nativePlayerNumber
    ) {
      throw new Error(`Native fixture player ${nativePlayerNumber} identity or order changed.`);
    }
    requireAttributes(entry.attributes, entry.id);
    if (JSON.stringify(entry.attributes) !== JSON.stringify(PLAYERS[index].attributes)) {
      throw new Error(`Native fixture player ${nativePlayerNumber} profile value changed.`);
    }
  }
  return value;
}

/** Return all eight exact attributes in current native-slot order. */
export function projectCssoccerNativePlayerAttributes(profile, options = {}) {
  const exact = assertCssoccerNativeFixturePlayerProfile(profile);
  requirePlainObject(options, "native player attribute projection options");
  requireExactKeys(options, ["matchHalf"], "native player attribute projection options", {
    optional: true,
  });
  const matchHalf = options.matchHalf ?? 0;
  if (matchHalf !== 0 && matchHalf !== 1) {
    throw new Error("Native player attribute projection matchHalf must be 0 or 1.");
  }
  return deepFreeze(exact.players
    .map((entry) => ({
      id: entry.id,
      nativePlayerNumber: nativeNumberForHalf(
        entry.kickoffNativePlayerNumber,
        matchHalf,
      ),
      attributes: clone(entry.attributes),
    }))
    .sort((left, right) => left.nativePlayerNumber - right.nativePlayerNumber));
}

/** Return the strict typed rate seam consumed by player motion reducers. */
export function projectCssoccerNativeTeamRates(profile, options = {}) {
  return deepFreeze(projectCssoccerNativePlayerAttributes(profile, options).map((entry) => ({
    id: entry.id,
    nativePlayerNumber: entry.nativePlayerNumber,
    valueType: "u8",
    value: entry.attributes.pace,
    numericBits: entry.attributes.pace.toString(16).padStart(2, "0"),
  })));
}

function player(id, kickoffNativePlayerNumber, values) {
  if (values.length !== ATTRIBUTE_KEYS.length) {
    throw new Error(`Native fixture attributes are incomplete for ${id}.`);
  }
  return {
    id,
    kickoffNativePlayerNumber,
    attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((key, index) => [key, values[index]])),
  };
}

function nativeNumberForHalf(kickoffNativePlayerNumber, matchHalf) {
  if (matchHalf === 0) return kickoffNativePlayerNumber;
  return kickoffNativePlayerNumber <= 11
    ? kickoffNativePlayerNumber + 11
    : kickoffNativePlayerNumber - 11;
}

function requireBindings(value) {
  requirePlainObject(value, "native fixture player profile bindings");
  requireExactKeys(value, BINDING_KEYS, "native fixture player profile bindings");
  if (!/^[a-f0-9]{40}$/u.test(value.sourceRevision ?? "")) {
    throw new Error("Native fixture player sourceRevision must be a lowercase Git revision.");
  }
  for (const key of BINDING_KEYS.slice(1)) {
    if (!/^[a-f0-9]{64}$/u.test(value[key] ?? "")) {
      throw new Error(`Native fixture player ${key} must be a lowercase SHA-256 digest.`);
    }
  }
}

function requireAttributes(value, id) {
  requirePlainObject(value, `${id} native attributes`);
  requireExactKeys(value, ATTRIBUTE_KEYS, `${id} native attributes`);
  for (const key of ATTRIBUTE_KEYS) {
    if (!Number.isInteger(value[key]) || value[key] < 0 || value[key] > 0xff) {
      throw new TypeError(`${id} native ${key} must be an exact u8.`);
    }
  }
}

function requirePlainObject(value, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

function requireExactKeys(value, keys, label, { optional = false } = {}) {
  const expected = [...keys].sort();
  const actual = Object.keys(value).sort();
  if (optional && actual.length === 0) return;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} must contain exactly ${expected.join(", ")}.`);
  }
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)]));
  }
  return value;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
