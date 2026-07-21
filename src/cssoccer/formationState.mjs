export const CSSOCCER_FORMATION_STATE_SCHEMA = "cssoccer-formation-state@1";

const PLAYER_SOURCE_VALUE_TYPES = Object.freeze({
  action: "i16",
  animation: "u16",
  animationFrame: "f32",
  nativePlayer: "i16",
  on: "i16",
  stableId: "string",
  x: "f32",
  xDisplacement: "f32",
  y: "f32",
  yDisplacement: "f32",
  z: "f32",
});

const HALF_ZERO = 0;
const HALF_ONE = 1;
const EXACT_PLAYER_RENDER_BINDING_ID = "exact-actua-player-one-basis";

/**
 * Bind one prepared player root to its prepared mesh without consulting any
 * source/runtime oracle. The typed tick-zero samples remain intact so later
 * parity work can compare value type and numeric bits, not only JS values.
 */
export function createCssoccerFormationState({ root, mesh } = {}) {
  requirePlainObject(root, "prepared player root");
  requirePlainObject(mesh, "prepared player mesh");
  requirePlayerIdentity(root);
  if (
    mesh.id !== root.id
    || mesh.kind !== "player"
    || mesh.stableDom !== true
    || mesh.bundleId !== EXACT_PLAYER_RENDER_BINDING_ID
    || mesh.frameSetId !== null
    || mesh.initialFrameIndex !== null
  ) {
    throw new Error(`Prepared player mesh does not bind root ${root.id}.`);
  }

  const binding = requireInitialBinding(root.initialBinding, root.id);
  const transform = requireTransform(mesh.transform, binding, root.id);
  const animation = requireAnimationBinding(
    binding.animation,
    binding.sourceValues,
    root.id,
  );
  if (animation.frameSetId !== mesh.frameSetId) {
    throw new Error(`Prepared animation frame set changed for ${root.id}.`);
  }
  const kickoffNativeTeamSlot = nativeTeamSlot(root.nativeRuntimeIndex);
  const kickoff = deepFreeze({
    tick: 0,
    phase: "post_tick",
    nativeRuntimeIndex: root.nativeRuntimeIndex,
    nativePlayerNumber: binding.sourceValues.nativePlayer.value,
    nativeTeamSlot: kickoffNativeTeamSlot,
    sourceValues: binding.sourceValues,
    renderer: {
      transform,
      initialFrameIndex: animation.preparedFrameIndex,
      rendererMapping: binding.rendererMapping,
      rendererFacing: binding.rendererFacing,
    },
    animation,
    lineage: binding.lineage,
  });

  return deepFreeze({
    schema: CSSOCCER_FORMATION_STATE_SCHEMA,
    id: root.id,
    country: root.country,
    kickoff,
    current: currentFromKickoff(kickoff),
  });
}

/**
 * RULES.CPP swaps complete player structs between the two 11-player runtime
 * slots and then rewrites tm_player. A stable fixture identity therefore moves
 * by exactly 11 slots while its world transform remains with the struct.
 */
export function swapCssoccerFormationEnds(state) {
  assertCssoccerFormationState(state);
  if (state.current.matchHalf !== HALF_ZERO || state.current.endSwapCount !== 0) {
    throw new Error("cssoccer formation ends may be swapped exactly once after the first half.");
  }
  const kickoff = clone(state.kickoff);
  const current = {
    ...clone(state.current),
    matchHalf: HALF_ONE,
    endSwapCount: 1,
    nativeRuntimeIndex: swapRuntimeIndex(state.current.nativeRuntimeIndex),
    nativePlayerNumber: swapPlayerNumber(state.current.nativePlayerNumber),
    nativeTeamSlot: oppositeTeamSlot(state.current.nativeTeamSlot),
    transformStatus: "preserved-by-native-struct-slot-swap",
  };
  return deepFreeze({
    schema: CSSOCCER_FORMATION_STATE_SCHEMA,
    id: state.id,
    country: state.country,
    kickoff,
    current,
  });
}

export function resetCssoccerFormationState(state) {
  assertCssoccerFormationState(state);
  const kickoff = clone(state.kickoff);
  return deepFreeze({
    schema: CSSOCCER_FORMATION_STATE_SCHEMA,
    id: state.id,
    country: state.country,
    kickoff,
    current: currentFromKickoff(kickoff),
  });
}

export function assertCssoccerFormationState(state) {
  requirePlainObject(state, "cssoccer formation state");
  if (state.schema !== CSSOCCER_FORMATION_STATE_SCHEMA) {
    throw new Error(`cssoccer formation state must use ${CSSOCCER_FORMATION_STATE_SCHEMA}.`);
  }
  requirePlayerId(state.id, "formation state id");
  requireCountry(state.country, "formation state country");
  requirePlainObject(state.kickoff, "formation kickoff state");
  requirePlainObject(state.current, "formation current state");
  if (
    state.kickoff.tick !== 0
    || state.kickoff.phase !== "post_tick"
    || !Number.isInteger(state.kickoff.nativeRuntimeIndex)
    || state.kickoff.nativeRuntimeIndex < 0
    || state.kickoff.nativeRuntimeIndex > 21
    || state.kickoff.nativePlayerNumber !== state.kickoff.nativeRuntimeIndex + 1
    || state.kickoff.nativeTeamSlot !== nativeTeamSlot(state.kickoff.nativeRuntimeIndex)
  ) {
    throw new Error(`Formation kickoff state is invalid for ${state.id}.`);
  }
  requireSourceValues(state.kickoff.sourceValues, state.id);
  requirePlainObject(state.kickoff.renderer, `formation kickoff renderer for ${state.id}`);
  requireTransform(
    state.kickoff.renderer.transform,
    {
      sourceValues: state.kickoff.sourceValues,
      rendererFacing: state.kickoff.renderer.rendererFacing,
    },
    state.id,
  );
  requireAnimationBinding(
    state.kickoff.animation,
    state.kickoff.sourceValues,
    state.id,
  );
  if (state.kickoff.renderer.initialFrameIndex
      !== state.kickoff.animation.preparedFrameIndex) {
    throw new Error(`Prepared tick-zero animation changed for ${state.id}.`);
  }
  requireCurrentState(state.current, state.kickoff, state.id);
  return state;
}

function requireInitialBinding(value, playerId) {
  requirePlainObject(value, `initial binding for ${playerId}`);
  if (value.status !== "exact-native-tick-zero") {
    throw new Error(`Initial binding for ${playerId} must be exact native tick zero.`);
  }
  if (value.tick !== 0 || value.phase !== "post_tick") {
    throw new Error(`Initial binding for ${playerId} must be retained tick 0 post_tick.`);
  }
  const sourceValues = requireSourceValues(value.sourceValues, playerId);
  requirePlainObject(value.rendererMapping, `renderer mapping for ${playerId}`);
  const rendererFacing = requireRendererFacing(
    value.rendererFacing,
    sourceValues,
    playerId,
  );
  const lineage = requireLineage(value.lineage, playerId);
  return deepFreeze({
    status: value.status,
    tick: value.tick,
    phase: value.phase,
    sourceValues,
    rendererMapping: clone(value.rendererMapping),
    rendererFacing,
    animation: clone(value.animation),
    lineage,
  });
}

function requireSourceValues(value, playerId) {
  requirePlainObject(value, `typed source values for ${playerId}`);
  const prefix = `players.${playerId}.`;
  const typed = {};
  for (const [name, valueType] of Object.entries(PLAYER_SOURCE_VALUE_TYPES)) {
    typed[name] = requireTypedValue(value[name], {
      fieldId: prefix + sourceFieldSuffix(name),
      label: `${playerId} ${name}`,
      valueType,
    });
  }
  if (typed.stableId.value !== playerId) {
    throw new Error(`Typed stable id changed for ${playerId}.`);
  }
  if (typed.on.value !== 1 || typed.action.value !== 0) {
    throw new Error(`Prepared kickoff active/action state changed for ${playerId}.`);
  }
  return deepFreeze(typed);
}

function sourceFieldSuffix(name) {
  return ({
    animationFrame: "animation_frame",
    nativePlayer: "native_player",
    stableId: "stable_id",
    xDisplacement: "x_displacement",
    yDisplacement: "y_displacement",
  })[name] ?? name;
}

function requireTypedValue(value, { fieldId, label, valueType }) {
  requirePlainObject(value, `typed value ${label}`);
  if (value.fieldId !== fieldId || value.valueType !== valueType) {
    throw new Error(`Typed value contract changed for ${label}.`);
  }
  if (valueType === "string") {
    if (typeof value.value !== "string" || value.numericBits !== null) {
      throw new Error(`Typed string value is invalid for ${label}.`);
    }
  } else {
    requireNumericValue(value.value, valueType, label);
    const bits = numericBits(value.value, valueType);
    if (value.numericBits !== bits) {
      throw new Error(`Typed numeric bits changed for ${label}.`);
    }
  }
  return deepFreeze({
    fieldId: value.fieldId,
    valueType: value.valueType,
    value: value.value,
    numericBits: value.numericBits,
  });
}

function requireTransform(value, binding, playerId) {
  requirePlainObject(value, `prepared transform for ${playerId}`);
  const position = requireVector(value.position, `prepared position for ${playerId}`);
  const rotation = requireVector(value.rotation, `prepared rotation for ${playerId}`);
  if (value.scale !== 1) {
    throw new Error(`Prepared scale changed for ${playerId}.`);
  }
  const sourceValues = binding.sourceValues;
  const expectedPosition = [
    sourceValues.x.value,
    sourceValues.z.value,
    -sourceValues.y.value,
  ];
  const expectedYaw = Math.atan2(
    sourceValues.yDisplacement.value,
    sourceValues.xDisplacement.value,
  ) * 180 / Math.PI;
  if (
    !sameNumbers(position, expectedPosition)
    || !sameNumbers(rotation, [0, Object.is(expectedYaw, -0) ? 0 : expectedYaw, 0])
  ) {
    throw new Error(`Prepared kickoff transform changed for ${playerId}.`);
  }
  return deepFreeze({ position, rotation, scale: 1 });
}

function requireAnimationBinding(value, sourceValues, playerId) {
  requirePlainObject(value, `animation binding for ${playerId}`);
  requirePlainObject(value.lookup, `animation lookup for ${playerId}`);
  const lookup = value.lookup;
  for (const [key, entry] of Object.entries({
    sourceSlotId: lookup.sourceSlotId,
    preparedFrameStart: lookup.preparedFrameStart,
    frameCount: lookup.frameCount,
    preparedFrameEnd: lookup.preparedFrameEnd,
  })) {
    if (!Number.isInteger(entry) || entry < 0) {
      throw new Error(`Animation lookup ${key} is invalid for ${playerId}.`);
    }
  }
  if (
    lookup.frameCount < 1
    || lookup.preparedFrameEnd !== lookup.preparedFrameStart + lookup.frameCount
    || value.slotId !== sourceValues.animation.value
    || !Object.is(value.nativeFrame, sourceValues.animationFrame.value)
  ) {
    throw new Error(`Animation slot/frame changed for ${playerId}.`);
  }
  const fraction = value.nativeFrame - Math.floor(value.nativeFrame);
  const localFrameIndex = Math.floor(fraction * lookup.frameCount);
  const preparedFrameIndex = lookup.preparedFrameStart + localFrameIndex;
  if (
    !Object.is(value.fractionalFrame, fraction)
    || value.localFrameIndex !== localFrameIndex
    || value.preparedFrameIndex !== preparedFrameIndex
    || typeof value.preparedFrameId !== "string"
    || value.preparedFrameId.length === 0
    || value.frameSetId !== null
    || typeof value.selectionFormula !== "string"
    || value.selectionFormula.length === 0
  ) {
    throw new Error(`Prepared animation frame changed for ${playerId}.`);
  }
  return deepFreeze({
    slotId: value.slotId,
    nativeFrame: value.nativeFrame,
    fractionalFrame: value.fractionalFrame,
    localFrameIndex: value.localFrameIndex,
    preparedFrameIndex: value.preparedFrameIndex,
    preparedFrameId: value.preparedFrameId,
    frameSetId: value.frameSetId,
    lookup: clone(value.lookup),
    selectionFormula: value.selectionFormula,
  });
}

function requireRendererFacing(value, sourceValues, playerId) {
  requirePlainObject(value, `renderer facing for ${playerId}`);
  const expectedYaw = Math.atan2(
    sourceValues.yDisplacement.value,
    sourceValues.xDisplacement.value,
  ) * 180 / Math.PI;
  const yawDegrees = Object.is(expectedYaw, -0) ? 0 : expectedYaw;
  if (
    !Object.is(value.cosine, sourceValues.xDisplacement.value)
    || !Object.is(value.sine, sourceValues.yDisplacement.value)
    || !(Object.is(value.yawDegrees, yawDegrees) || Math.abs(value.yawDegrees - yawDegrees) <= 1e-12)
  ) {
    throw new Error(`Prepared renderer facing changed for ${playerId}.`);
  }
  return deepFreeze({
    cosine: value.cosine,
    sine: value.sine,
    yawDegrees: value.yawDegrees,
  });
}

function requireLineage(value, playerId) {
  requirePlainObject(value, `initial binding lineage for ${playerId}`);
  for (const key of ["rawSha256", "stateSha256", "fieldContractSha256"]) {
    if (!/^[a-f0-9]{64}$/u.test(value[key] ?? "")) {
      throw new Error(`Initial binding ${key} is invalid for ${playerId}.`);
    }
  }
  return deepFreeze({
    rawSha256: value.rawSha256,
    stateSha256: value.stateSha256,
    fieldContractSha256: value.fieldContractSha256,
  });
}

function requireCurrentState(current, kickoff, playerId) {
  if (
    ![HALF_ZERO, HALF_ONE].includes(current.matchHalf)
    || ![0, 1].includes(current.endSwapCount)
    || current.endSwapCount !== current.matchHalf
    || !Number.isInteger(current.nativeRuntimeIndex)
    || current.nativeRuntimeIndex < 0
    || current.nativeRuntimeIndex > 21
    || current.nativePlayerNumber !== current.nativeRuntimeIndex + 1
    || current.nativeTeamSlot !== nativeTeamSlot(current.nativeRuntimeIndex)
    || !["prepared-kickoff", "preserved-by-native-struct-slot-swap"].includes(
      current.transformStatus,
    )
  ) {
    throw new Error(`Current formation state is invalid for ${playerId}.`);
  }
  const expectedIndex = current.matchHalf === HALF_ZERO
    ? kickoff.nativeRuntimeIndex
    : swapRuntimeIndex(kickoff.nativeRuntimeIndex);
  if (
    current.nativeRuntimeIndex !== expectedIndex
    || !sameValue(current.renderer, kickoff.renderer)
    || !sameValue(current.animation, kickoff.animation)
  ) {
    throw new Error(`Current formation state diverged from the exact end-swap contract for ${playerId}.`);
  }
}

function currentFromKickoff(kickoff) {
  return {
    matchHalf: HALF_ZERO,
    endSwapCount: 0,
    nativeRuntimeIndex: kickoff.nativeRuntimeIndex,
    nativePlayerNumber: kickoff.nativePlayerNumber,
    nativeTeamSlot: kickoff.nativeTeamSlot,
    transformStatus: "prepared-kickoff",
    renderer: clone(kickoff.renderer),
    animation: clone(kickoff.animation),
  };
}

function requirePlayerIdentity(root) {
  requirePlayerId(root.id, "prepared player root id");
  requireCountry(root.country, `country for ${root.id}`);
  if (
    root.kind !== "player"
    || root.stableDom !== true
    || !Number.isInteger(root.nativeRuntimeIndex)
    || root.nativeRuntimeIndex < 0
    || root.nativeRuntimeIndex > 21
  ) {
    throw new Error(`Prepared player root is invalid for ${root.id}.`);
  }
  const expectedCountry = root.nativeRuntimeIndex < 11 ? "spain" : "argentina";
  if (root.country !== expectedCountry) {
    throw new Error(`Prepared player root country/slot changed for ${root.id}.`);
  }
}

function requirePlayerId(value, label) {
  if (!/^(spain|argentina)-player-(0[1-9]|1[01])$/u.test(value ?? "")) {
    throw new Error(`${label} is not a fixed-fixture starter id.`);
  }
}

function requireCountry(value, label) {
  if (value !== "spain" && value !== "argentina") {
    throw new Error(`${label} must be spain or argentina.`);
  }
}

function nativeTeamSlot(runtimeIndex) {
  return runtimeIndex < 11 ? "A" : "B";
}

function oppositeTeamSlot(slot) {
  if (slot === "A") return "B";
  if (slot === "B") return "A";
  throw new Error("Native team slot must be A or B.");
}

function swapRuntimeIndex(index) {
  return index < 11 ? index + 11 : index - 11;
}

function swapPlayerNumber(value) {
  return value < 12 ? value + 11 : value - 11;
}

function requireVector(value, label) {
  if (
    !Array.isArray(value)
    || value.length !== 3
    || value.some((entry) => !Number.isFinite(entry))
  ) {
    throw new TypeError(`${label} must be a finite three-number vector.`);
  }
  return Object.freeze([...value]);
}

function sameNumbers(left, right) {
  return left.length === right.length && left.every((value, index) => (
    Object.is(value, right[index]) || Math.abs(value - right[index]) <= 1e-12
  ));
}

function requireNumericValue(value, valueType, label) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite ${valueType} value.`);
  }
  if (valueType === "f32") {
    if (!Object.is(value, Math.fround(value))) {
      throw new Error(`${label} is not an exact float32 value.`);
    }
    return;
  }
  if (!Number.isInteger(value)) {
    throw new TypeError(`${label} must be an integer ${valueType} value.`);
  }
  const [minimum, maximum] = ({
    i16: [-32768, 32767],
    u16: [0, 65535],
    u8: [0, 255],
  })[valueType];
  if (value < minimum || value > maximum) {
    throw new RangeError(`${label} is outside ${valueType}.`);
  }
}

function numericBits(value, valueType) {
  const bytes = ({ f32: 4, i16: 2, u16: 2, u8: 1 })[valueType];
  const buffer = new ArrayBuffer(bytes);
  const view = new DataView(buffer);
  if (valueType === "f32") view.setFloat32(0, value, false);
  else if (valueType === "i16") view.setInt16(0, value, false);
  else if (valueType === "u16") view.setUint16(0, value, false);
  else view.setUint8(0, value);
  return [...new Uint8Array(buffer)]
    .map((entry) => entry.toString(16).padStart(2, "0"))
    .join("");
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
