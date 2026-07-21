import { assertCssoccerTeamState } from "./teamState.mjs";

const FIXTURE_ID = "spain-argentina-full-match";
const USER_NUMBER = 1;
const PLAYER_COUNT = 22;
const PLAYERS_PER_TEAM = 11;
const TAKER_NUMBER = 7;
const RECEIVER_NUMBER = 10;
const ACTION_SCHEMA = "cssoccer-opening-control-action@1";
const OWNERSHIP_SCHEMA = "cssoccer-opening-control-ownership@1";
const HANDOFF_EVENT_SCHEMA = "cssoccer-opening-control-handoff-event@1";

export const CSSOCCER_OPENING_CONTROL_STATE_SCHEMA =
  "cssoccer-opening-control-state@1";
export const CSSOCCER_OPENING_CONTROL_ACTION_SCHEMA = ACTION_SCHEMA;
export const CSSOCCER_OPENING_CONTROL_OWNERSHIP_SCHEMA = OWNERSHIP_SCHEMA;
export const CSSOCCER_OPENING_CONTROL_HANDOFF_EVENT_SCHEMA = HANDOFF_EVENT_SCHEMA;

export const CSSOCCER_OPENING_CONTROL_SOURCE = deepFreeze({
  fixtureId: FIXTURE_ID,
  sourceRevision: "b40bd6d1e50e052030c5f0884fbe3deda7e9fa4b",
  files: [
    {
      file: "USER.CPP",
      sha256: "d4e9a3bc0192780eadb7a32d766a6f40a63115e5fa3e3a39cf8a6e7849c6e1bc",
      producers: ["clear_auto", "auto_select_a", "auto_select_b", "reselect"],
    },
    {
      file: "ACTIONS.CPP",
      sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
      producers: ["go_team", "process_teams", "user_conts"],
    },
    {
      file: "INTELL.CPP",
      sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
      producers: ["pass_ball", "new_interceptor"],
    },
  ],
  sourceOrder: [
    "the accepted centre launch enters USER.CPP reselection with one auto-player user",
    "clear_auto removes that user's previous control byte before auto_select assigns one player",
    "the opening assignment owns fixture player 7 in the selected country's current native team slot",
    "INTELL.CPP pass_ball/new_interceptor triggers the accepted release handoff to fixture player 10",
    "ACTIONS.CPP reads the resulting control byte when routing user or computer play",
  ],
  supported: [
    "one selected-country auto-player user",
    "the accepted native 7 to 10 opening centre-pass assignment",
    "opening and post-end-swap stable identity to native-slot mapping",
    "holding the accepted receiver assignment while the source ownership producer keeps player 10 active",
  ],
  handoffEvent: {
    schema: HANDOFF_EVENT_SCHEMA,
    producer: "INTELL.CPP pass_ball/new_interceptor -> USER.CPP reselect",
    producerByNativeTeamSlot: {
      A: "USER.CPP reselect_a/auto_select_a",
      B: "USER.CPP reselect_b/auto_select_b",
    },
    semantics:
      "the first source release edge clears the centre taker before assigning the receiver",
  },
  unsupportedNext: {
    boundary: "post-centre-pass-auto-select",
    producer: "USER.CPP auto_select_a/auto_select_b",
    reason:
      "The next ownership change depends on live tm_dist, receiver/interceptor priority, and sel_circle state owned by the general player-selection reducer.",
  },
});

export class CssoccerUnsupportedOpeningControlError extends Error {
  constructor(boundary, message, detail = {}) {
    super(message);
    this.name = "CssoccerUnsupportedOpeningControlError";
    this.code = "CSSOCCER_UNSUPPORTED_OPENING_CONTROL";
    this.boundary = boundary;
    this.detail = deepFreeze(clone(detail));
  }
}

/**
 * Project the source action owner into the narrow control handoff input.
 * The caller supplies source-resolved release/completion events; this module
 * never derives them from a replay tick or a native value.
 */
export function createCssoccerOpeningControlAction({
  tick,
  launch,
  releaseApplied = false,
  complete = false,
} = {}) {
  requireUint32(tick, "opening control action tick");
  const accepted = requireCentrePassLaunch(launch);
  if (tick < accepted.tick) {
    throw new Error("Opening control action cannot precede its centre-pass launch.");
  }
  if (typeof releaseApplied !== "boolean" || typeof complete !== "boolean") {
    throw new TypeError("Opening control action release/completion flags must be booleans.");
  }
  if (complete && !releaseApplied) {
    throw new Error("A completed centre-pass action must already have applied its release.");
  }
  return requireActionInput(deepFreeze({
    schema: ACTION_SCHEMA,
    fixtureId: FIXTURE_ID,
    tick,
    startTick: accepted.tick,
    matchHalf: accepted.matchHalf,
    owner: clone(accepted.owner),
    bindings: clone(accepted.bindings),
    releaseApplied,
    complete,
  }));
}

/**
 * Project the live team/selection owner into a browser-safe assignment input.
 * activePlayerId must come from source gameplay state, never native evidence.
 */
export function createCssoccerOpeningControlOwnership({
  tick,
  teamState,
  activePlayerId,
} = {}) {
  requireUint32(tick, "opening control ownership tick");
  const team = assertCssoccerTeamState(teamState);
  const selectedCountry = team.control.selectedCountry;
  const selectedNativeTeamSlot = team.control.currentNativeTeamSlot;
  const expectedCountry = team.current.nativeTeamBySlot[selectedNativeTeamSlot];
  if (expectedCountry !== selectedCountry) {
    throw new Error("Opening control selected-country ownership changed native team slot.");
  }
  requirePlayerId(activePlayerId, "opening control active player");
  if (!activePlayerId.startsWith(`${selectedCountry}-player-`)) {
    throw new Error("Opening control active player must belong to the selected country.");
  }
  const players = team.players
    .map((player) => ({
      id: player.id,
      country: player.country,
      fixturePlayerNumber: fixturePlayerNumber(player.id),
      nativePlayerNumber: player.current.nativePlayerNumber,
    }))
    .sort((left, right) => left.nativePlayerNumber - right.nativePlayerNumber);
  return requireOwnershipInput(deepFreeze({
    schema: OWNERSHIP_SCHEMA,
    fixtureId: FIXTURE_ID,
    tick,
    matchHalf: team.current.matchHalf,
    selectedCountry,
    selectedNativeTeamSlot,
    activePlayerId,
    nativeTeamBySlot: clone(team.current.nativeTeamBySlot),
    bindings: clone(team.bindings),
    players,
  }));
}

/** Materialize the source-owned centre-pass release edge as one typed handoff. */
export function createCssoccerOpeningControlHandoffEvent(state, {
  action,
  ownership,
} = {}) {
  const current = assertCssoccerOpeningControlState(state);
  const nextAction = requireActionInput(action);
  const nextOwnership = requireOwnershipInput(ownership);
  if (nextAction.tick !== current.tick + 1 || nextOwnership.tick !== nextAction.tick) {
    throw new Error(`Opening control handoff inputs must be contiguous at tick ${current.tick + 1}.`);
  }
  requireSameActionLineage(current.action, nextAction);
  requireSameOwnershipLineage(current.ownership, nextOwnership);
  requireSameHalfAndBindings(nextAction, nextOwnership);
  if (current.action.releaseApplied || !nextAction.releaseApplied) {
    throw new Error("Opening control handoff requires the first centre-pass release edge.");
  }
  requireExpectedOwner(current.ownership, TAKER_NUMBER, "handoff-taker");
  requireExpectedOwner(nextOwnership, RECEIVER_NUMBER, "handoff-receiver");
  const previousPlayerId = playerId(nextOwnership.selectedCountry, TAKER_NUMBER);
  const activePlayerId = playerId(nextOwnership.selectedCountry, RECEIVER_NUMBER);
  const previousPlayer = nextOwnership.players.find(({ id }) => id === previousPlayerId);
  const activePlayer = nextOwnership.players.find(({ id }) => id === activePlayerId);
  return requireHandoffEvent(deepFreeze({
    schema: HANDOFF_EVENT_SCHEMA,
    fixtureId: FIXTURE_ID,
    kind: "centre-pass-receiver-handoff",
    producer: handoffProducer(nextOwnership.selectedNativeTeamSlot),
    tick: nextAction.tick,
    startTick: nextAction.startTick,
    matchHalf: nextAction.matchHalf,
    selectedCountry: nextOwnership.selectedCountry,
    selectedNativeTeamSlot: nextOwnership.selectedNativeTeamSlot,
    previousPlayerId,
    activePlayerId,
    previousNativePlayer: typedI16(
      `players.${previousPlayerId}.native_player.before_centre_pass_handoff`,
      previousPlayer.nativePlayerNumber,
    ),
    activeNativePlayer: typedI16(
      `players.${activePlayerId}.native_player.after_centre_pass_handoff`,
      activePlayer.nativePlayerNumber,
    ),
    controlWrites: [
      {
        operation: "clear",
        field: typedU8(`players.${previousPlayerId}.control`, 0),
      },
      {
        operation: "assign",
        field: typedU8(`players.${activePlayerId}.control`, USER_NUMBER),
      },
    ],
    bindings: {
      gameplayProfileHash: nextAction.bindings.gameplayProfileHash,
      nativeRawSha256: nextOwnership.bindings.nativeRawSha256,
      nativeStateSha256: nextOwnership.bindings.nativeStateSha256,
      nativeFieldContractSha256: nextOwnership.bindings.nativeFieldContractSha256,
      teamAuthoritySha256: nextOwnership.bindings.teamAuthoritySha256,
    },
  }), { action: nextAction, ownership: nextOwnership });
}

/** Create the first accepted post-launch assignment. */
export function createCssoccerOpeningControlState({
  launch,
  action,
  ownership,
} = {}) {
  const acceptedLaunch = requireCentrePassLaunch(launch);
  const acceptedAction = requireActionInput(action);
  const acceptedOwnership = requireOwnershipInput(ownership);
  requireSharedInputs(acceptedLaunch, acceptedAction, acceptedOwnership);
  if (acceptedAction.tick !== acceptedLaunch.tick) {
    throw new Error("Opening control must begin on the accepted launch tick.");
  }
  if (acceptedAction.releaseApplied || acceptedAction.complete) {
    throw new Error("Opening control must begin before the centre-pass release handoff.");
  }
  requireExpectedOwner(acceptedOwnership, TAKER_NUMBER, "launch-reselection");
  return assemble({ action: acceptedAction, ownership: acceptedOwnership, handoffEvent: null });
}

/** Advance one contiguous source-owned action/selection assignment. */
export function stepCssoccerOpeningControlState(state, {
  action,
  ownership,
} = {}) {
  const current = assertCssoccerOpeningControlState(state);
  const nextAction = requireActionInput(action);
  const nextOwnership = requireOwnershipInput(ownership);
  const nextTick = current.tick + 1;
  if (nextAction.tick !== nextTick || nextOwnership.tick !== nextTick) {
    throw new Error(`Opening control inputs must be contiguous at tick ${nextTick}.`);
  }
  requireSameActionLineage(current.action, nextAction);
  requireSameOwnershipLineage(current.ownership, nextOwnership);
  if (current.action.releaseApplied && !nextAction.releaseApplied) {
    throw new Error("Opening control action cannot revoke an applied pass release.");
  }
  if (current.action.complete && !nextAction.complete) {
    throw new Error("Opening control action cannot leave its completed state.");
  }

  const expectedPlayerNumber = nextAction.releaseApplied
    ? RECEIVER_NUMBER
    : TAKER_NUMBER;
  const expectedId = playerId(nextOwnership.selectedCountry, expectedPlayerNumber);
  if (nextOwnership.activePlayerId !== expectedId) {
    if (current.action.releaseApplied || current.action.complete) {
      throw new CssoccerUnsupportedOpeningControlError(
        CSSOCCER_OPENING_CONTROL_SOURCE.unsupportedNext.boundary,
        "The opening receiver assignment ended at the general auto-selection producer.",
        {
          producer: CSSOCCER_OPENING_CONTROL_SOURCE.unsupportedNext.producer,
          previousActivePlayerId: current.ownership.activePlayerId,
          activePlayerId: nextOwnership.activePlayerId,
          expectedOpeningPlayerId: expectedId,
        },
      );
    }
    throw new CssoccerUnsupportedOpeningControlError(
      "opening-control-ownership",
      "The source opening assignment diverged before its centre-pass handoff.",
      {
        activePlayerId: nextOwnership.activePlayerId,
        expectedOpeningPlayerId: expectedId,
      },
    );
  }
  const handoffEvent = !current.action.releaseApplied && nextAction.releaseApplied
    ? createCssoccerOpeningControlHandoffEvent(current, {
        action: nextAction,
        ownership: nextOwnership,
      })
    : current.handoffEvent;
  return assemble({ action: nextAction, ownership: nextOwnership, handoffEvent });
}

export function projectCssoccerOpeningControlNativeFields(state) {
  const current = assertCssoccerOpeningControlState(state);
  return deepFreeze(current.players.map((player) => ({
    schema: "cssoccer-parity-stream@1",
    recordType: "sample",
    tick: current.tick,
    phase: "post_tick",
    fieldId: player.control.fieldId,
    valueType: player.control.valueType,
    value: player.control.value,
    numericBits: player.control.numericBits,
  })));
}

export function assertCssoccerOpeningControlState(state) {
  requirePlainObject(state, "opening control state");
  requireExactKeys(state, [
    "action",
    "fixtureId",
    "handoffEvent",
    "ownership",
    "phase",
    "players",
    "schema",
    "tick",
  ], "opening control state");
  if (
    state.schema !== CSSOCCER_OPENING_CONTROL_STATE_SCHEMA
    || state.fixtureId !== FIXTURE_ID
  ) {
    throw new Error(`Opening control state must use ${CSSOCCER_OPENING_CONTROL_STATE_SCHEMA}.`);
  }
  requireUint32(state.tick, "opening control state tick");
  const action = requireActionInput(state.action);
  const ownership = requireOwnershipInput(state.ownership);
  if (action.tick !== state.tick || ownership.tick !== state.tick) {
    throw new Error("Opening control action/ownership ticks diverged from state.");
  }
  requireSameHalfAndBindings(action, ownership);
  const expectedPlayerNumber = action.releaseApplied ? RECEIVER_NUMBER : TAKER_NUMBER;
  const expectedPhase = action.releaseApplied ? "receiver-controlled" : "taker-controlled";
  if (state.phase !== expectedPhase) {
    throw new Error("Opening control phase diverged from the source release state.");
  }
  requireExpectedOwner(ownership, expectedPlayerNumber, "state-ownership");
  if (action.releaseApplied) {
    requireHandoffEvent(state.handoffEvent, { action, ownership });
  } else if (state.handoffEvent !== null) {
    throw new Error("Opening control cannot carry a handoff event before the release edge.");
  }
  if (!Array.isArray(state.players) || state.players.length !== PLAYER_COUNT) {
    throw new Error("Opening control state requires exactly 22 players.");
  }
  const expectedPlayers = controlledPlayers(ownership);
  if (!sameValue(state.players, expectedPlayers)) {
    throw new Error("Opening control players changed identity, native slot, u8 type, or bits.");
  }
  return state;
}

function assemble({ action, ownership, handoffEvent }) {
  const state = deepFreeze({
    schema: CSSOCCER_OPENING_CONTROL_STATE_SCHEMA,
    fixtureId: FIXTURE_ID,
    tick: action.tick,
    phase: action.releaseApplied ? "receiver-controlled" : "taker-controlled",
    handoffEvent: clone(handoffEvent),
    action: clone(action),
    ownership: clone(ownership),
    players: controlledPlayers(ownership),
  });
  return assertCssoccerOpeningControlState(state);
}

export function assertCssoccerOpeningControlHandoffEvent(event, {
  action,
  ownership,
} = {}) {
  return requireHandoffEvent(
    event,
    { action: requireActionInput(action), ownership: requireOwnershipInput(ownership) },
  );
}

function requireHandoffEvent(event, { action, ownership }) {
  requirePlainObject(event, "opening control handoff event");
  requireExactKeys(event, [
    "activeNativePlayer",
    "activePlayerId",
    "bindings",
    "controlWrites",
    "fixtureId",
    "kind",
    "matchHalf",
    "previousNativePlayer",
    "previousPlayerId",
    "producer",
    "schema",
    "selectedCountry",
    "selectedNativeTeamSlot",
    "startTick",
    "tick",
  ], "opening control handoff event");
  requireUint32(event.tick, "opening control handoff tick");
  requireUint32(event.startTick, "opening control handoff start tick");
  if (
    event.schema !== HANDOFF_EVENT_SCHEMA
    || event.fixtureId !== FIXTURE_ID
    || event.kind !== "centre-pass-receiver-handoff"
    || event.producer !== handoffProducer(ownership.selectedNativeTeamSlot)
    || event.tick < event.startTick
    || event.tick > action.tick
    || event.startTick !== action.startTick
    || event.matchHalf !== action.matchHalf
    || event.matchHalf !== ownership.matchHalf
    || event.selectedCountry !== ownership.selectedCountry
    || event.selectedNativeTeamSlot !== ownership.selectedNativeTeamSlot
  ) {
    throw new Error(`Opening control handoff event must use ${HANDOFF_EVENT_SCHEMA}.`);
  }
  const previousPlayerId = playerId(ownership.selectedCountry, TAKER_NUMBER);
  const activePlayerId = playerId(ownership.selectedCountry, RECEIVER_NUMBER);
  const previousPlayer = ownership.players.find(({ id }) => id === previousPlayerId);
  const activePlayer = ownership.players.find(({ id }) => id === activePlayerId);
  const expected = {
    schema: HANDOFF_EVENT_SCHEMA,
    fixtureId: FIXTURE_ID,
    kind: "centre-pass-receiver-handoff",
    producer: handoffProducer(ownership.selectedNativeTeamSlot),
    tick: event.tick,
    startTick: action.startTick,
    matchHalf: action.matchHalf,
    selectedCountry: ownership.selectedCountry,
    selectedNativeTeamSlot: ownership.selectedNativeTeamSlot,
    previousPlayerId,
    activePlayerId,
    previousNativePlayer: typedI16(
      `players.${previousPlayerId}.native_player.before_centre_pass_handoff`,
      previousPlayer.nativePlayerNumber,
    ),
    activeNativePlayer: typedI16(
      `players.${activePlayerId}.native_player.after_centre_pass_handoff`,
      activePlayer.nativePlayerNumber,
    ),
    controlWrites: [
      { operation: "clear", field: typedU8(`players.${previousPlayerId}.control`, 0) },
      { operation: "assign", field: typedU8(`players.${activePlayerId}.control`, USER_NUMBER) },
    ],
    bindings: {
      gameplayProfileHash: action.bindings.gameplayProfileHash,
      nativeRawSha256: ownership.bindings.nativeRawSha256,
      nativeStateSha256: ownership.bindings.nativeStateSha256,
      nativeFieldContractSha256: ownership.bindings.nativeFieldContractSha256,
      teamAuthoritySha256: ownership.bindings.teamAuthoritySha256,
    },
  };
  if (!sameValue(event, expected)) {
    throw new Error("Opening control handoff event changed source identity, type, bits, order, or bindings.");
  }
  return event;
}

function controlledPlayers(ownership) {
  return deepFreeze(ownership.players.map((player) => ({
    ...clone(player),
    control: typedU8(
      `players.${player.id}.control`,
      player.id === ownership.activePlayerId ? USER_NUMBER : 0,
    ),
  })));
}

function requireSharedInputs(launch, action, ownership) {
  if (
    launch.tick !== action.startTick
    || launch.matchHalf !== action.matchHalf
    || launch.matchHalf !== ownership.matchHalf
    || !sameValue(launch.owner, action.owner)
    || !sameValue(launch.bindings, action.bindings)
  ) {
    throw new Error("Opening control launch, action, and ownership lineage diverged.");
  }
  requireSameHalfAndBindings(action, ownership);
}

function requireSameActionLineage(previous, next) {
  if (
    previous.startTick !== next.startTick
    || previous.matchHalf !== next.matchHalf
    || !sameValue(previous.owner, next.owner)
    || !sameValue(previous.bindings, next.bindings)
  ) {
    throw new Error("Opening control action lineage changed while stepping.");
  }
}

function requireSameOwnershipLineage(previous, next) {
  const withoutTickAndActive = (value) => ({
    ...clone(value),
    tick: null,
    activePlayerId: null,
  });
  if (!sameValue(withoutTickAndActive(previous), withoutTickAndActive(next))) {
    throw new Error("Opening control ownership identity/native-slot lineage changed while stepping.");
  }
}

function requireSameHalfAndBindings(action, ownership) {
  if (
    action.matchHalf !== ownership.matchHalf
    || !isSha256(ownership.bindings.nativeRawSha256)
    || !isSha256(ownership.bindings.nativeStateSha256)
    || !isSha256(ownership.bindings.nativeFieldContractSha256)
    || !isSha256(ownership.bindings.teamAuthoritySha256)
  ) {
    throw new Error("Opening control action and team-ownership bindings diverged.");
  }
}

function requireExpectedOwner(ownership, fixtureNumber, boundary) {
  const expected = playerId(ownership.selectedCountry, fixtureNumber);
  if (ownership.activePlayerId !== expected) {
    throw new CssoccerUnsupportedOpeningControlError(
      boundary,
      `Opening control expected ${expected}, got ${ownership.activePlayerId}.`,
      { expected, actual: ownership.activePlayerId },
    );
  }
  const player = ownership.players.find(({ id }) => id === expected);
  const slotBase = ownership.selectedNativeTeamSlot === "A" ? 0 : PLAYERS_PER_TEAM;
  if (
    player?.fixturePlayerNumber !== fixtureNumber
    || player.nativePlayerNumber !== slotBase + fixtureNumber
  ) {
    throw new Error("Opening control stable identity/native-slot mapping changed.");
  }
}

function requireCentrePassLaunch(value) {
  requirePlainObject(value, "opening control centre-pass launch");
  const owner = value.owner;
  const request = value.request;
  if (
    value.schema !== "cssoccer-centre-pass-launch@1"
    || !Number.isInteger(value.tick)
    || value.tick < 1
    || (value.matchHalf !== 0 && value.matchHalf !== 1)
    || request?.type !== "pass"
    || request.nativePlayerNumber !== TAKER_NUMBER
    || request.targetPlayerNumber !== RECEIVER_NUMBER
    || request.passType !== 5
    || owner?.nativeTeamSlot !== "A"
    || owner.takerNativePlayerNumber !== TAKER_NUMBER
    || owner.receiverNativePlayerNumber !== RECEIVER_NUMBER
    || owner.takerId !== playerId(owner.country, TAKER_NUMBER)
    || owner.receiverId !== playerId(owner.country, RECEIVER_NUMBER)
    || !isSha256(value.bindings?.gameplayProfileHash)
    || value.bindings.gameplayProfileHash !== value.bindings.kickoffProfileHash
  ) {
    throw new CssoccerUnsupportedOpeningControlError(
      "centre-pass-launch",
      "Opening control requires the accepted native 7 to 10 centre-pass launch.",
    );
  }
  return value;
}

function requireActionInput(value) {
  requirePlainObject(value, "opening control action");
  requireExactKeys(value, [
    "bindings",
    "complete",
    "fixtureId",
    "matchHalf",
    "owner",
    "releaseApplied",
    "schema",
    "startTick",
    "tick",
  ], "opening control action");
  requireUint32(value.tick, "opening control action tick");
  requireUint32(value.startTick, "opening control action start tick");
  if (
    value.schema !== ACTION_SCHEMA
    || value.fixtureId !== FIXTURE_ID
    || value.tick < value.startTick
    || (value.matchHalf !== 0 && value.matchHalf !== 1)
    || typeof value.releaseApplied !== "boolean"
    || typeof value.complete !== "boolean"
    || (value.complete && !value.releaseApplied)
  ) {
    throw new Error(`Opening control action must use ${ACTION_SCHEMA}.`);
  }
  const owner = value.owner;
  if (
    owner?.nativeTeamSlot !== "A"
    || owner.takerNativePlayerNumber !== TAKER_NUMBER
    || owner.receiverNativePlayerNumber !== RECEIVER_NUMBER
    || owner.takerId !== playerId(owner.country, TAKER_NUMBER)
    || owner.receiverId !== playerId(owner.country, RECEIVER_NUMBER)
    || !isSha256(value.bindings?.gameplayProfileHash)
    || value.bindings.gameplayProfileHash !== value.bindings.kickoffProfileHash
  ) {
    throw new Error("Opening control action owner/profile binding changed.");
  }
  return value;
}

function requireOwnershipInput(value) {
  requirePlainObject(value, "opening control ownership");
  requireExactKeys(value, [
    "activePlayerId",
    "bindings",
    "fixtureId",
    "matchHalf",
    "nativeTeamBySlot",
    "players",
    "schema",
    "selectedCountry",
    "selectedNativeTeamSlot",
    "tick",
  ], "opening control ownership");
  requireUint32(value.tick, "opening control ownership tick");
  if (
    value.schema !== OWNERSHIP_SCHEMA
    || value.fixtureId !== FIXTURE_ID
    || (value.matchHalf !== 0 && value.matchHalf !== 1)
    || !["spain", "argentina"].includes(value.selectedCountry)
    || !["A", "B"].includes(value.selectedNativeTeamSlot)
    || value.nativeTeamBySlot?.[value.selectedNativeTeamSlot] !== value.selectedCountry
    || value.nativeTeamBySlot?.A === value.nativeTeamBySlot?.B
  ) {
    throw new Error(`Opening control ownership must use ${OWNERSHIP_SCHEMA}.`);
  }
  requirePlayerId(value.activePlayerId, "opening control ownership active player");
  if (!value.activePlayerId.startsWith(`${value.selectedCountry}-player-`)) {
    throw new Error("Opening control ownership active player changed selected country.");
  }
  if (!Array.isArray(value.players) || value.players.length !== PLAYER_COUNT) {
    throw new Error("Opening control ownership requires exactly 22 mapped players.");
  }
  const nativeNumbers = new Set();
  const ids = new Set();
  for (let index = 0; index < value.players.length; index += 1) {
    const player = value.players[index];
    requirePlainObject(player, `opening control ownership players[${index}]`);
    requireExactKeys(
      player,
      ["country", "fixturePlayerNumber", "id", "nativePlayerNumber"],
      `opening control ownership players[${index}]`,
    );
    requirePlayerId(player.id, `opening control ownership players[${index}].id`);
    if (
      player.country !== countryFromPlayerId(player.id)
      || player.fixturePlayerNumber !== fixturePlayerNumber(player.id)
      || !Number.isInteger(player.nativePlayerNumber)
      || player.nativePlayerNumber !== index + 1
    ) {
      throw new Error("Opening control ownership player identity/native order changed.");
    }
    ids.add(player.id);
    nativeNumbers.add(player.nativePlayerNumber);
  }
  if (
    ids.size !== PLAYER_COUNT
    || nativeNumbers.size !== PLAYER_COUNT
    || !ids.has(value.activePlayerId)
  ) {
    throw new Error("Opening control ownership player mapping is incomplete or duplicated.");
  }
  const expectedA = value.matchHalf === 0 ? "spain" : "argentina";
  const expectedB = value.matchHalf === 0 ? "argentina" : "spain";
  if (value.nativeTeamBySlot.A !== expectedA || value.nativeTeamBySlot.B !== expectedB) {
    throw new Error("Opening control ownership changed the one source end swap.");
  }
  for (const player of value.players) {
    const expectedCountry = player.nativePlayerNumber <= PLAYERS_PER_TEAM
      ? expectedA
      : expectedB;
    const expectedFixtureNumber = ((player.nativePlayerNumber - 1) % PLAYERS_PER_TEAM) + 1;
    if (
      player.country !== expectedCountry
      || player.fixturePlayerNumber !== expectedFixtureNumber
    ) {
      throw new Error("Opening control ownership stable identity/native slot diverged.");
    }
  }
  for (const key of [
    "nativeRawSha256",
    "nativeStateSha256",
    "nativeFieldContractSha256",
    "teamAuthoritySha256",
  ]) {
    if (!isSha256(value.bindings?.[key])) {
      throw new Error(`Opening control ownership ${key} binding is invalid.`);
    }
  }
  return value;
}

function typedU8(fieldId, value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new TypeError(`${fieldId} must be an exact u8.`);
  }
  return deepFreeze({
    fieldId,
    valueType: "u8",
    value,
    numericBits: value.toString(16).padStart(2, "0"),
  });
}

function typedI16(fieldId, value) {
  if (!Number.isInteger(value) || value < -32768 || value > 32767) {
    throw new TypeError(`${fieldId} must be an exact i16.`);
  }
  return deepFreeze({
    fieldId,
    valueType: "i16",
    value,
    numericBits: (value & 0xffff).toString(16).padStart(4, "0"),
  });
}

function handoffProducer(nativeTeamSlot) {
  const selector = CSSOCCER_OPENING_CONTROL_SOURCE
    .handoffEvent
    .producerByNativeTeamSlot[nativeTeamSlot];
  if (!selector) {
    throw new Error("Opening control handoff native team slot is invalid.");
  }
  return `${CSSOCCER_OPENING_CONTROL_SOURCE.handoffEvent.producer} -> ${selector}`;
}

function playerId(country, number) {
  if (!["spain", "argentina"].includes(country)) {
    throw new Error("Opening control country must be Spain or Argentina.");
  }
  if (!Number.isInteger(number) || number < 1 || number > PLAYERS_PER_TEAM) {
    throw new Error("Opening control fixture player number must be 1..11.");
  }
  return `${country}-player-${String(number).padStart(2, "0")}`;
}

function requirePlayerId(value, label) {
  if (!/^(spain|argentina)-player-(0[1-9]|1[01])$/u.test(value ?? "")) {
    throw new Error(`${label} is not a fixed-fixture player id.`);
  }
}

function fixturePlayerNumber(id) {
  requirePlayerId(id, "opening control player id");
  return Number(id.slice(-2));
}

function countryFromPlayerId(id) {
  requirePlayerId(id, "opening control player id");
  return id.startsWith("spain-") ? "spain" : "argentina";
}

function requireUint32(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new TypeError(`${label} must be an exact uint32.`);
  }
}

function requireExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (!sameValue(actual, expected)) {
    throw new Error(`${label} must contain exactly ${expected.join(", ")}.`);
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

function isSha256(value) {
  return /^[a-f0-9]{64}$/u.test(value ?? "");
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
