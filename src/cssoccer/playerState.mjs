import {
  assertCssoccerFormationState,
  createCssoccerFormationState,
  resetCssoccerFormationState,
  swapCssoccerFormationEnds,
} from "./formationState.mjs";

export const CSSOCCER_PLAYER_STATE_SCHEMA = "cssoccer-player-state@1";

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

export function createCssoccerPlayerState({ starter, root, mesh } = {}) {
  const identity = requireStarter(starter);
  if (
    root?.id !== identity.id
    || root.country !== identity.country
    || root.nativeRuntimeIndex !== identity.kickoffNativeRuntimeIndex
    || root.nativeRendererIndex !== identity.nativeRendererIndex
  ) {
    throw new Error(`Prepared starter and actor root diverge for ${identity.id}.`);
  }
  const formation = createCssoccerFormationState({ root, mesh });
  const kickoff = activityFromFormation(formation.kickoff);
  return deepFreeze({
    schema: CSSOCCER_PLAYER_STATE_SCHEMA,
    id: identity.id,
    country: identity.country,
    identity,
    formation,
    kickoff,
    current: currentFromKickoff(kickoff, formation.current),
  });
}

export function swapCssoccerPlayerEnds(state) {
  assertCssoccerPlayerState(state);
  const formation = swapCssoccerFormationEnds(state.formation);
  return deepFreeze({
    schema: CSSOCCER_PLAYER_STATE_SCHEMA,
    id: state.id,
    country: state.country,
    identity: clone(state.identity),
    formation,
    kickoff: clone(state.kickoff),
    current: currentFromKickoff(state.kickoff, formation.current),
  });
}

export function resetCssoccerPlayerState(state) {
  assertCssoccerPlayerState(state);
  const formation = resetCssoccerFormationState(state.formation);
  const kickoff = clone(state.kickoff);
  return deepFreeze({
    schema: CSSOCCER_PLAYER_STATE_SCHEMA,
    id: state.id,
    country: state.country,
    identity: clone(state.identity),
    formation,
    kickoff,
    current: currentFromKickoff(kickoff, formation.current),
  });
}

export function assertCssoccerPlayerState(state) {
  requirePlainObject(state, "cssoccer player state");
  if (state.schema !== CSSOCCER_PLAYER_STATE_SCHEMA || state.id !== state.identity?.id) {
    throw new Error(`cssoccer player state must use ${CSSOCCER_PLAYER_STATE_SCHEMA}.`);
  }
  const identity = requireStarter({
    ...state.identity,
    nativeRuntimeIndex: state.identity.kickoffNativeRuntimeIndex,
  });
  if (identity.country !== state.country) {
    throw new Error(`Player country changed for ${state.id}.`);
  }
  assertCssoccerFormationState(state.formation);
  if (
    state.formation.id !== state.id
    || state.formation.country !== state.country
    || !sameValue(state.kickoff, activityFromFormation(state.formation.kickoff))
    || !sameValue(state.current, currentFromKickoff(state.kickoff, state.formation.current))
  ) {
    throw new Error(`Player state diverged from prepared formation for ${state.id}.`);
  }
  return state;
}

function requireStarter(value) {
  requirePlainObject(value, "prepared starter");
  requirePlayerId(value.id, "prepared starter id");
  const country = value.id.startsWith("spain-") ? "spain" : "argentina";
  const kickoffNativeRuntimeIndex = value.nativeRuntimeIndex
    ?? value.kickoffNativeRuntimeIndex;
  if (
    typeof value.name !== "string"
    || value.name.length === 0
    || !Number.isInteger(value.sourceRosterIndex)
    || value.sourceRosterIndex < 0
    || value.sourceRosterIndex > 10
    || !Number.isInteger(kickoffNativeRuntimeIndex)
    || kickoffNativeRuntimeIndex < 0
    || kickoffNativeRuntimeIndex > 21
    || !Number.isInteger(value.nativeRendererIndex)
    || value.nativeRendererIndex < 0
    || value.nativeRendererIndex > 21
  ) {
    throw new Error(`Prepared starter identity is invalid for ${value.id}.`);
  }
  const expectedRuntimeIndex = country === "spain"
    ? value.sourceRosterIndex
    : value.sourceRosterIndex + 11;
  if (
    kickoffNativeRuntimeIndex !== expectedRuntimeIndex
    || value.nativeRendererIndex !== expectedRuntimeIndex
  ) {
    throw new Error(`Prepared starter native indexes changed for ${value.id}.`);
  }
  const attributes = requireAttributes(value.attributes, value.id);
  for (const key of ["goalIndex", "flags", "squadNumber", "position", "skinTone"]) {
    if (!Number.isInteger(value[key]) || value[key] < -128 || value[key] > 127) {
      throw new Error(`Prepared starter ${key} is invalid for ${value.id}.`);
    }
  }
  if (
    !Array.isArray(value.sourceRecordByteRange)
    || value.sourceRecordByteRange.length !== 2
    || value.sourceRecordByteRange.some((entry) => !Number.isSafeInteger(entry) || entry < 0)
    || value.sourceRecordByteRange[1] - value.sourceRecordByteRange[0] !== 33
    || !/^[a-f0-9]{64}$/u.test(value.sourceRecordSha256 ?? "")
  ) {
    throw new Error(`Prepared starter record binding is invalid for ${value.id}.`);
  }
  return deepFreeze({
    id: value.id,
    country,
    name: value.name,
    sourceRosterIndex: value.sourceRosterIndex,
    kickoffNativeRuntimeIndex,
    nativeRendererIndex: value.nativeRendererIndex,
    goalIndex: value.goalIndex,
    attributes,
    flags: value.flags,
    squadNumber: value.squadNumber,
    position: value.position,
    skinTone: value.skinTone,
    sourceRecordByteRange: Object.freeze([...value.sourceRecordByteRange]),
    sourceRecordSha256: value.sourceRecordSha256,
  });
}

function requireAttributes(value, playerId) {
  requirePlainObject(value, `prepared attributes for ${playerId}`);
  if (
    Object.keys(value).length !== ATTRIBUTE_KEYS.length
    || ATTRIBUTE_KEYS.some((key) => (
      !Object.hasOwn(value, key)
      || !Number.isInteger(value[key])
      || value[key] < -128
      || value[key] > 127
    ))
  ) {
    throw new Error(`Prepared attributes changed for ${playerId}.`);
  }
  return deepFreeze(Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, value[key]])));
}

function activityFromFormation(formation) {
  return {
    active: clone(formation.sourceValues.on),
    action: clone(formation.sourceValues.action),
    animation: clone(formation.animation),
  };
}

function currentFromKickoff(kickoff, formationCurrent) {
  return {
    matchHalf: formationCurrent.matchHalf,
    active: kickoff.active.value === 1,
    action: kickoff.action.value,
    animation: clone(formationCurrent.animation),
    nativeRuntimeIndex: formationCurrent.nativeRuntimeIndex,
    nativePlayerNumber: formationCurrent.nativePlayerNumber,
    nativeTeamSlot: formationCurrent.nativeTeamSlot,
  };
}

function requirePlayerId(value, label) {
  if (!/^(spain|argentina)-player-(0[1-9]|1[01])$/u.test(value ?? "")) {
    throw new Error(`${label} is not a fixed-fixture starter id.`);
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

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
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
