import {
  CSSOCCER_ACTION_COMMAND_SCHEMA,
  CSSOCCER_NATIVE_ACTIONS,
  createCssoccerActionState,
} from "./actionState.mjs";
import {
  CSSOCCER_SPEED_INTENT,
  actualPlayerSpeed,
  sourceFacingDirection,
  sourceForwardDisplacement,
  turnSourceFacing,
  updateSourcePosition2d,
} from "./motionState.mjs";
import { assertCssoccerKickoffPlayerMotion } from "./kickoffPlayerMotion.mjs";
import {
  assertCssoccerNativeGameplayProfile,
  projectCssoccerMotionSourceProfile,
} from "./nativeGameplayProfile.mjs";
import { CSSOCCER_PLAYER_AI_INTENT_SCHEMA } from "./playerAi.mjs";
import { createCssoccerTeamAiState } from "./teamAi.mjs";
import { assertCssoccerTeamState } from "./teamState.mjs";
import { CSSOCCER_USER_CONTROL_RESULT_SCHEMA } from "./userControl.mjs";

const f32 = Math.fround;
const PLAYER_ID = /^(spain|argentina)-player-(0[1-9]|1[01])$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

export const CSSOCCER_PLAYER_MOTION_STATE_SCHEMA = "cssoccer-player-motion-state@1";
export const CSSOCCER_PLAYER_MOTION_COMMAND_SCHEMA = "cssoccer-player-motion-command@1";

export const CSSOCCER_PLAYER_MOTION_CONSTANTS = deepFreeze({
  pitchLength: 1280,
  pitchWidth: 800,
  keeperNativePlayers: [1, 12],
  userControlIndex: 1,
  standAction: CSSOCCER_NATIVE_ACTIONS.STAND,
  runAction: CSSOCCER_NATIVE_ACTIONS.RUN,
});

export const CSSOCCER_PLAYER_MOTION_SOURCE = deepFreeze({
  files: [
    {
      file: "ACTIONS.CPP",
      sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
      producers: [
        "actual_spd",
        "go_forward",
        "go_toward_target",
        "do_action",
        "process_dir",
        "new_dir",
        "go_team",
        "process_teams",
      ],
    },
    {
      file: "INTELL.CPP",
      sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
      producers: ["user_intelligence", "intelligence", "explicit target intents"],
    },
    {
      file: "USER.CPP",
      sha256: "d4e9a3bc0192780eadb7a32d766a6f40a63115e5fa3e3a39cf8a6e7849c6e1bc",
      producers: ["convert_inputs", "users_dir"],
    },
  ],
  processOrder: [
    "toggle source frame",
    "visit native A then B when true, B then A when false",
    "visit ascending native player numbers within each team",
    "apply explicit action and action movement",
    "turn facing in process_dir after the action",
  ],
  requiredInputs: [
    "22 source/data-bound current tm_rate values in native-slot order",
    "one accepted native gameplay profile binding",
    "one explicit user-control result and 21 explicit AI motion commands per tick",
  ],
  supported: [
    "exact settled-kickoff to live-motion state handoff",
    "stand/hold",
    "run toward an explicit target",
    "run or stand with an explicit direct-facing vector",
    "normal and explicitly bound intercept speed intents",
  ],
  unsupported: [
    "kick, tackle, contact, keeper, restart, and rule actions",
    "unmaterialized AI pass, shot, punt, run, or keeper semantics",
    "side-step displacement/countdown construction",
    "pitch-edge user clipping once its source branch is active",
    "vertical or animation movement",
    "prepared roster pace as a fallback for native tm_rate",
  ],
});

export class CssoccerUnsupportedPlayerMotionError extends Error {
  constructor(boundary, message, detail = {}) {
    super(message);
    this.name = "CssoccerUnsupportedPlayerMotionError";
    this.code = "CSSOCCER_UNSUPPORTED_PLAYER_MOTION";
    this.boundary = boundary;
    this.detail = deepFreeze(clone(detail));
  }
}

/** Create the exact 22-player prepared live-motion baseline. */
export function createCssoccerPlayerMotionState({
  teamState,
  gameplayProfile,
  teamRates,
} = {}) {
  assertCssoccerTeamState(teamState);
  const profile = assertCssoccerNativeGameplayProfile(gameplayProfile);
  if (teamState.current.matchHalf !== 0) {
    throw new CssoccerUnsupportedPlayerMotionError(
      "initial-half",
      "Live player motion must be created from the prepared opening mapping; use halftime remap later.",
    );
  }
  const teamAi = createCssoccerTeamAiState(teamState);
  const ratesById = requireTeamRates(teamRates, teamAi.players);
  const players = teamAi.players.map((player) => (
    createDynamicPlayer(player, 0, ratesById.get(player.id))
  ));
  return assertCssoccerPlayerMotionState(deepFreeze({
    schema: CSSOCCER_PLAYER_MOTION_STATE_SCHEMA,
    fixtureId: "spain-argentina-full-match",
    selectedCountry: teamState.control.selectedCountry,
    profileHash: profile.profileHash,
    tick: 0,
    matchHalf: 0,
    sourceFrame: false,
    players,
    lastProcessedOrder: [],
  }));
}

export function resetCssoccerPlayerMotionState(state, {
  teamState,
  gameplayProfile,
  teamRates,
} = {}) {
  const current = assertCssoccerPlayerMotionState(state);
  const reset = createCssoccerPlayerMotionState({ teamState, gameplayProfile, teamRates });
  if (reset.selectedCountry !== current.selectedCountry) {
    throw new Error("Player-motion reset cannot change the selected country.");
  }
  const currentRates = new Map(current.players.map(({ id, teamRate }) => [id, teamRate]));
  if (reset.players.some(({ id, teamRate }) => !sameValue(teamRate, currentRates.get(id)))) {
    throw new CssoccerUnsupportedPlayerMotionError(
      "team-rate-materialization",
      "Player-motion reset cannot change a stable player's native tm_rate.",
    );
  }
  return reset;
}

/** Apply only the accepted stable-id/native-slot remap at halftime. */
export function remapCssoccerPlayerMotionHalf(state, {
  teamState,
  gameplayProfile,
} = {}) {
  const current = assertCssoccerPlayerMotionState(state);
  assertCssoccerTeamState(teamState);
  const profile = requireBoundProfile(gameplayProfile, current.profileHash);
  if (
    current.matchHalf !== 0
    || teamState.current.matchHalf !== 1
    || teamState.current.endSwapCount !== 1
    || teamState.control.selectedCountry !== current.selectedCountry
  ) {
    throw new CssoccerUnsupportedPlayerMotionError(
      "halftime-remap",
      "Player motion accepts exactly the first-to-second-half stable-id/native-slot remap.",
    );
  }
  const byId = new Map(teamState.players.map((player) => [player.id, player]));
  const players = current.players.map((player) => {
    const mapped = byId.get(player.id);
    if (mapped === undefined || mapped.country !== player.country) {
      throw new Error(`Halftime player mapping is missing ${player.id}.`);
    }
    return deepFreeze({
      ...clone(player),
      nativePlayerNumber: mapped.current.nativePlayerNumber,
      nativeTeamSlot: mapped.current.nativeTeamSlot,
    });
  });
  return assertCssoccerPlayerMotionState(deepFreeze({
    ...clone(current),
    profileHash: profile.profileHash,
    matchHalf: 1,
    players,
    lastProcessedOrder: [],
  }));
}

/** Rebase the exact settled centre-positioning state into live-motion storage. */
export function rebaseCssoccerPlayerMotionFromKickoff(state, input = {}) {
  const current = assertCssoccerPlayerMotionState(state);
  requirePlainObject(input, "player-motion kickoff handoff input");
  requireExactKeys(input, [
    "controlledPlayerId",
    "kickoffMotion",
    "teamRates",
  ], "player-motion kickoff handoff input");
  const kickoff = assertCssoccerKickoffPlayerMotion(input.kickoffMotion);
  if (
    current.tick !== 0
    || current.matchHalf !== 0
    || current.lastProcessedOrder.length !== 0
    || kickoff.matchHalf !== current.matchHalf
    || kickoff.selectedCountry !== current.selectedCountry
    || kickoff.bindings.nativeGameplayProfileHash !== current.profileHash
    || kickoff.status !== "settled"
  ) {
    throw new CssoccerUnsupportedPlayerMotionError(
      "kickoff-handoff",
      "Live player motion can rebase only from the exact settled opening kickoff state.",
    );
  }
  const ratesById = requireTeamRates(input.teamRates, current.players);
  const kickoffById = new Map(kickoff.players.map((player) => [player.id, player]));
  const controlledPlayerId = requireControlledHandoffPlayer(
    input.controlledPlayerId,
    current,
    kickoffById,
  );
  const players = current.players.map((player) => {
    const motion = kickoffById.get(player.id);
    const teamRate = ratesById.get(player.id);
    if (
      motion === undefined
      || motion.country !== player.country
      || motion.nativePlayerNumber !== player.nativePlayerNumber
      || motion.nativeTeamSlot !== player.nativeTeamSlot
      || motion.teamRate !== teamRate
    ) {
      throw new CssoccerUnsupportedPlayerMotionError(
        "kickoff-handoff",
        `Settled kickoff motion changed the live identity, slot, or tm_rate for ${player.id}.`,
      );
    }
    return deepFreeze({
      ...clone(player),
      tick: kickoff.tick,
      teamRate: typedValue(`players.${player.id}.team_rate`, "u8", teamRate),
      position: {
        x: motion.position.x,
        y: motion.position.y,
        z: player.position.z,
      },
      facing: {
        x: motion.facing.x,
        y: motion.facing.y,
        direction: typedValue(
          `players.${player.id}.face_direction`,
          "i16",
          motion.faceDirection,
        ),
      },
      native: {
        action: typedValue(`players.${player.id}.action`, "i16", motion.action),
        control: typedValue(
          `players.${player.id}.control`,
          "u8",
          player.id === controlledPlayerId ? 1 : 0,
        ),
        on: clone(player.native.on),
      },
    });
  });
  return assertCssoccerPlayerMotionState(deepFreeze({
    ...clone(current),
    tick: kickoff.tick,
    sourceFrame: kickoff.tick % 2 === 1,
    players,
    lastProcessedOrder: [],
  }));
}

/**
 * Bind one explicit AI decision to supported planar action semantics. The AI
 * decides the target; the caller must state the action id and motion mode.
 */
export function createCssoccerAiMotionCommand(input = {}) {
  requirePlainObject(input, "AI player-motion command input");
  requireExactKeys(input, [
    "actionAfter",
    "actionBefore",
    "intent",
    "intentionCount",
    "motion",
    "sideStep",
    "speedIntent",
    "tick",
  ], "AI player-motion command input");
  requireUint32(input.tick, "AI player-motion tick");
  const intent = requireAiIntent(input.intent);
  const actionBefore = requireSupportedAction(input.actionBefore, "AI actionBefore");
  const actionAfter = requireSupportedAction(input.actionAfter, "AI actionAfter");
  const motion = requireMotionDirective(input.motion, `AI motion for ${intent.playerId}`);
  const speedIntent = requireSpeedIntent(input.speedIntent);
  requireNonNegativeInt32(input.intentionCount, "AI intentionCount");
  requireBoolean(input.sideStep, "AI sideStep");
  if (input.sideStep) {
    throw new CssoccerUnsupportedPlayerMotionError(
      "side-step",
      "Side-step motion requires source countdown/displacement materialization.",
    );
  }
  if (intent.actionStatus === "requires-action-semantics") {
    throw new CssoccerUnsupportedPlayerMotionError(
      "ai-action-semantics",
      `AI intent ${intent.kind} is explicitly unmaterialized by its source owner.`,
      { playerId: intent.playerId, kind: intent.kind },
    );
  }
  validateAiMotionKind(intent, motion, actionAfter);
  if (speedIntent === CSSOCCER_SPEED_INTENT.intercept && input.intentionCount === 0) {
    throw new Error("AI intercept speed requires a positive source intention count.");
  }
  return deepFreeze({
    schema: CSSOCCER_PLAYER_MOTION_COMMAND_SCHEMA,
    tick: input.tick,
    playerId: intent.playerId,
    authority: "ai",
    actionBefore,
    actionAfter,
    motion,
    speedIntent,
    intentionCount: input.intentionCount,
    sideStep: false,
    sourceIntent: clone(intent),
  });
}

/** Advance all 22 players once in ACTIONS.CPP process_teams order. */
export function stepCssoccerPlayerMotionState(state, {
  tick,
  userResult,
  aiCommands,
  ball,
  pitch,
  gameplayProfile,
  teamRates,
} = {}) {
  let current = assertCssoccerPlayerMotionState(state);
  if (teamRates !== undefined) current = updateDynamicTeamRates(current, teamRates);
  requireUint32(tick, "player-motion tick");
  if (tick !== current.tick + 1) {
    throw new Error(`Player-motion ticks must be contiguous; expected ${current.tick + 1}.`);
  }
  const profile = requireBoundProfile(gameplayProfile, current.profileHash);
  const environment = requireEnvironment(ball, pitch);
  const userCommand = createUserMotionCommand(userResult, current, tick);
  const active = current.players.find(({ id }) => id === userCommand.playerId);
  if (active === undefined || active.country !== current.selectedCountry) {
    throw new CssoccerUnsupportedPlayerMotionError(
      "user-owner",
      "The active user command must belong to the selected stable country.",
    );
  }

  const sourceFrame = !current.sourceFrame;
  const order = nativeProcessOrder(current.players, sourceFrame);
  const expectedAiIds = order
    .filter(({ id }) => id !== userCommand.playerId)
    .map(({ id }) => id);
  if (!Array.isArray(aiCommands) || aiCommands.length !== 21) {
    throw new Error("Player motion requires exactly 21 explicit AI commands.");
  }
  const checkedAi = aiCommands.map((command, index) => {
    const checked = requireAiMotionCommand(command);
    const expectedPlayer = current.players.find(({ id }) => id === expectedAiIds[index]);
    if (
      checked.tick !== tick
      || checked.playerId !== expectedAiIds[index]
      || checked.sourceIntent.nativePlayerNumber !== expectedPlayer?.nativePlayerNumber
      || checked.sourceIntent.nativeTeamSlot !== expectedPlayer?.nativeTeamSlot
    ) {
      throw new CssoccerUnsupportedPlayerMotionError(
        "native-order",
        `AI command ${index} must bind ${expectedAiIds[index]} in its current native slot at tick ${tick}.`,
      );
    }
    return checked;
  });
  const commandsById = new Map([
    [userCommand.playerId, userCommand],
    ...checkedAi.map((command) => [command.playerId, command]),
  ]);
  if (commandsById.size !== 22) {
    throw new Error("Player-motion commands must cover all 22 stable players exactly once.");
  }

  const byId = new Map(current.players.map((player) => [player.id, player]));
  const processed = [];
  for (const ordered of order) {
    const player = byId.get(ordered.id);
    const command = commandsById.get(ordered.id);
    byId.set(player.id, advancePlayer(player, command, {
      tick,
      profile,
      environment,
      user: player.id === userCommand.playerId,
    }));
    processed.push(player.id);
  }

  return assertCssoccerPlayerMotionState(deepFreeze({
    ...clone(current),
    tick,
    sourceFrame,
    players: current.players.map(({ id }) => byId.get(id)),
    lastProcessedOrder: processed,
  }));
}

function updateDynamicTeamRates(state, teamRates) {
  const ratesById = requireTeamRates(teamRates, state.players);
  return assertCssoccerPlayerMotionState(deepFreeze({
    ...clone(state),
    players: state.players.map((player) => deepFreeze({
      ...clone(player),
      teamRate: typedValue(
        `players.${player.id}.team_rate`,
        "u8",
        ratesById.get(player.id),
      ),
    })),
  }));
}

/** Project only source fields owned by planar player motion. */
export function projectCssoccerPlayerMotionNativeFields(state) {
  const current = assertCssoccerPlayerMotionState(state);
  const fields = current.players.flatMap((player) => [
    player.native.action,
    player.native.control,
    player.facing.direction,
    typedValue(`players.${player.id}.native_player`, "i16", player.nativePlayerNumber),
    player.native.on,
    typedValue(`players.${player.id}.stable_id`, "string", player.id),
    typedValue(`players.${player.id}.x`, "f32", player.position.x),
    typedValue(`players.${player.id}.x_displacement`, "f32", player.facing.x),
    typedValue(`players.${player.id}.y`, "f32", player.position.y),
    typedValue(`players.${player.id}.y_displacement`, "f32", player.facing.y),
    typedValue(`players.${player.id}.z`, "f32", player.position.z),
    typedValue(`players.${player.id}.z_displacement`, "f32", f32(0)),
  ]);
  return deepFreeze(fields.sort((left, right) => left.fieldId.localeCompare(right.fieldId)));
}

export function assertCssoccerPlayerMotionState(state) {
  requirePlainObject(state, "player-motion state");
  requireExactKeys(state, [
    "fixtureId",
    "lastProcessedOrder",
    "matchHalf",
    "players",
    "profileHash",
    "schema",
    "selectedCountry",
    "sourceFrame",
    "tick",
  ], "player-motion state");
  if (
    state.schema !== CSSOCCER_PLAYER_MOTION_STATE_SCHEMA
    || state.fixtureId !== "spain-argentina-full-match"
    || !["spain", "argentina"].includes(state.selectedCountry)
    || !SHA256.test(state.profileHash ?? "")
    || ![0, 1].includes(state.matchHalf)
    || typeof state.sourceFrame !== "boolean"
  ) {
    throw new Error(`Player-motion state must use ${CSSOCCER_PLAYER_MOTION_STATE_SCHEMA}.`);
  }
  requireUint32(state.tick, "player-motion state tick");
  if (!Array.isArray(state.players) || state.players.length !== 22) {
    throw new Error("Player-motion state requires exactly 22 dynamic players.");
  }
  const expectedStableOrder = ["spain", "argentina"].flatMap((country) => (
    Array.from({ length: 11 }, (_, index) => (
      `${country}-player-${String(index + 1).padStart(2, "0")}`
    ))
  ));
  if (!sameValue(state.players.map(({ id }) => id), expectedStableOrder)) {
    throw new Error("Player-motion players must retain the prepared stable-id order.");
  }
  const ids = new Set();
  const nativePlayers = new Set();
  let controlled = null;
  for (const player of state.players) {
    requireDynamicPlayer(player, state);
    if (ids.has(player.id) || nativePlayers.has(player.nativePlayerNumber)) {
      throw new Error("Player-motion stable ids and native numbers must be unique.");
    }
    ids.add(player.id);
    nativePlayers.add(player.nativePlayerNumber);
    if (player.native.control.value === 1) {
      if (controlled !== null) throw new Error("Only one player may carry native user control.");
      controlled = player;
    }
  }
  if (
    nativePlayers.size !== 22
    || [...nativePlayers].sort((a, b) => a - b).some((value, index) => value !== index + 1)
  ) {
    throw new Error("Player-motion native slots must cover 1..22 exactly.");
  }
  if (controlled !== null && controlled.country !== state.selectedCountry) {
    throw new Error("Player-motion control escaped the selected stable country.");
  }
  if (!Array.isArray(state.lastProcessedOrder)) {
    throw new Error("Player-motion state requires a processed-order ledger.");
  }
  if (state.lastProcessedOrder.length !== 0) {
    const expected = nativeProcessOrder(state.players, state.sourceFrame).map(({ id }) => id);
    if (!sameValue(state.lastProcessedOrder, expected)) {
      throw new Error("Player-motion processed order diverged from the native source frame.");
    }
  }
  return state;
}

function createDynamicPlayer(player, tick, teamRate) {
  const action = typedValue(
    `players.${player.id}.action`,
    "i16",
    player.native.action.value,
  );
  const facing = {
    x: requireF32(player.facing.x, `${player.id} initial facing x`),
    y: requireF32(player.facing.y, `${player.id} initial facing y`),
  };
  return deepFreeze({
    id: player.id,
    country: player.country,
    nativePlayerNumber: player.nativePlayerNumber,
    nativeTeamSlot: player.nativeTeamSlot,
    teamRate: typedValue(`players.${player.id}.team_rate`, "u8", teamRate),
    tick,
    position: {
      x: requireF32(player.position.x, `${player.id} initial x`),
      y: requireF32(player.position.y, `${player.id} initial y`),
      z: requireF32(player.position.z, `${player.id} initial z`),
    },
    facing: {
      ...facing,
      direction: typedValue(
        `players.${player.id}.face_direction`,
        "i16",
        // The prepared post-setup sample retains the source's zero-initialized
        // direction bucket. process_dir owns the first computed bucket.
        tick === 0 ? 0 : sourceFacingDirection(facing),
      ),
    },
    native: {
      action,
      control: typedValue(`players.${player.id}.control`, "u8", 0),
      on: typedValue(`players.${player.id}.on`, "i16", player.native.on.value),
    },
  });
}

function requireTeamRates(value, players) {
  if (!Array.isArray(value) || value.length !== 22) {
    throw new CssoccerUnsupportedPlayerMotionError(
      "team-rate-materialization",
      "Live player motion requires exactly 22 explicit native tm_rate entries.",
    );
  }
  const expected = players.slice().sort(
    (left, right) => left.nativePlayerNumber - right.nativePlayerNumber,
  );
  const byId = new Map();
  value.forEach((entry, index) => {
    const label = `teamRates[${index}]`;
    requirePlainObject(entry, label);
    requireExactKeys(entry, [
      "id",
      "nativePlayerNumber",
      "numericBits",
      "value",
      "valueType",
    ], label);
    const player = expected[index];
    if (
      entry.id !== player.id
      || entry.nativePlayerNumber !== player.nativePlayerNumber
      || entry.nativePlayerNumber !== index + 1
      || entry.valueType !== "u8"
    ) {
      throw new CssoccerUnsupportedPlayerMotionError(
        "team-rate-materialization",
        `${label} must bind ${player.id} at native slot ${index + 1} as u8.`,
      );
    }
    requireIntegerRange(entry.value, 0, 0xff, `${label}.value`);
    if (entry.numericBits !== numericBits(entry.value, "u8")) {
      throw new Error(`${label} changed its exact u8 numeric bits.`);
    }
    if (byId.has(entry.id)) {
      throw new Error("Native tm_rate materialization cannot duplicate stable players.");
    }
    byId.set(entry.id, entry.value);
  });
  return byId;
}

function requireControlledHandoffPlayer(value, state, kickoffById) {
  if (value === null) return null;
  if (!PLAYER_ID.test(value ?? "")) {
    throw new TypeError("Kickoff handoff controlledPlayerId must be a stable player id or null.");
  }
  const player = state.players.find(({ id }) => id === value);
  const kickoff = kickoffById.get(value);
  if (
    player === undefined
    || kickoff === undefined
    || player.country !== state.selectedCountry
    || kickoff.role === "keeper"
  ) {
    throw new CssoccerUnsupportedPlayerMotionError(
      "kickoff-control",
      "Kickoff handoff control must remain on one selected-country outfield player.",
    );
  }
  return value;
}

function createUserMotionCommand(result, state, tick) {
  requirePlainObject(result, "user-control result");
  requireExactKeys(result, [
    "actionCommand",
    "effectiveInput",
    "schema",
    "selectedCountry",
    "selection",
    "sprint",
    "tick",
  ], "user-control result");
  if (
    result.schema !== CSSOCCER_USER_CONTROL_RESULT_SCHEMA
    || result.tick !== tick
    || result.selectedCountry !== state.selectedCountry
  ) {
    throw new CssoccerUnsupportedPlayerMotionError(
      "user-command",
      "Player motion requires the selected country's current user-control result.",
    );
  }
  const action = requireUserActionCommand(result.actionCommand, tick);
  requirePlainObject(result.selection, "user-control selection result");
  if (result.selection.activePlayerId !== action.playerId) {
    throw new Error("User-control action and selected player diverged.");
  }
  requirePlainObject(result.effectiveInput, "user-control effective input");
  const effectiveMovement = result.effectiveInput.movement;
  requirePlainObject(effectiveMovement, "user-control effective movement");
  if (
    effectiveMovement.active !== action.facingIntent.active
    || effectiveMovement.x !== action.facingIntent.x.value
    || effectiveMovement.y !== action.facingIntent.y.value
  ) {
    throw new Error("User-control result and action-facing intent diverged.");
  }
  const motion = action.facingIntent.active
    ? requireMotionDirective({
      kind: "direct-facing",
      target: null,
      facing: {
        x: f32(action.facingIntent.x.value),
        y: f32(action.facingIntent.y.value),
      },
    }, "user direct-facing motion")
    : requireMotionDirective({ kind: "hold", target: null, facing: null }, "user hold motion");
  if (
    (motion.kind === "direct-facing" && action.actionAfter.value !== CSSOCCER_NATIVE_ACTIONS.RUN)
    || (motion.kind === "hold" && action.actionAfter.value !== CSSOCCER_NATIVE_ACTIONS.STAND)
  ) {
    throw new CssoccerUnsupportedPlayerMotionError(
      "user-action-semantics",
      "Supported user motion requires explicit RUN for movement or STAND for hold.",
      { kind: action.kind, actionAfter: action.actionAfter.value },
    );
  }
  return deepFreeze({
    schema: CSSOCCER_PLAYER_MOTION_COMMAND_SCHEMA,
    tick,
    playerId: action.playerId,
    authority: "user",
    actionBefore: action.actionBefore.value,
    actionAfter: action.actionAfter.value,
    motion,
    speedIntent: CSSOCCER_SPEED_INTENT.normal,
    intentionCount: 0,
    sideStep: false,
    burstTimer: requireUserSprint(result.sprint),
    sourceResult: {
      schema: result.schema,
      selectedCountry: result.selectedCountry,
      actionKind: action.kind,
    },
  });
}

function requireAiMotionCommand(value) {
  requirePlainObject(value, "AI player-motion command");
  requireExactKeys(value, [
    "actionAfter",
    "actionBefore",
    "authority",
    "intentionCount",
    "motion",
    "playerId",
    "schema",
    "sideStep",
    "sourceIntent",
    "speedIntent",
    "tick",
  ], "AI player-motion command");
  if (
    value.schema !== CSSOCCER_PLAYER_MOTION_COMMAND_SCHEMA
    || value.authority !== "ai"
  ) {
    throw new Error(`AI motion command must use ${CSSOCCER_PLAYER_MOTION_COMMAND_SCHEMA}.`);
  }
  return createCssoccerAiMotionCommand({
    tick: value.tick,
    intent: value.sourceIntent,
    actionBefore: value.actionBefore,
    actionAfter: value.actionAfter,
    motion: value.motion,
    speedIntent: value.speedIntent,
    intentionCount: value.intentionCount,
    sideStep: value.sideStep,
  });
}

function advancePlayer(player, command, {
  tick,
  profile,
  environment,
  user,
}) {
  if (
    command.actionBefore !== player.native.action.value
    || command.playerId !== player.id
  ) {
    throw new CssoccerUnsupportedPlayerMotionError(
      "action-order",
      `${player.id} command must bind its exact current action before movement.`,
      { expected: player.native.action.value, actual: command.actionBefore },
    );
  }
  if ((command.authority === "user") !== user) {
    throw new Error(`${player.id} command authority diverged from control ownership.`);
  }
  if (player.native.on.value !== 1) {
    throw new CssoccerUnsupportedPlayerMotionError(
      "inactive-player",
      "The fixed no-substitution live reducer cannot materialize an inactive player.",
    );
  }

  let position = player.position;
  let facing = { x: player.facing.x, y: player.facing.y };
  let vector = motionVector(command.motion, position);
  if (vector !== null && vector.x === 0 && vector.y === 0) {
    throw new CssoccerUnsupportedPlayerMotionError(
      "zero-motion-vector",
      `${player.id} target/direct-facing command cannot use a zero vector.`,
    );
  }
  if (user && vector !== null) {
    requireUserPitchEdge(
      player,
      vector,
      environment.pitch,
      profile.constants.prat.value,
    );
  }

  // ACTIONS.CPP do_action applies the new action and its movement before
  // process_dir/new_dir updates facing.
  if (command.actionAfter === CSSOCCER_NATIVE_ACTIONS.RUN) {
    if (vector === null) {
      throw new CssoccerUnsupportedPlayerMotionError(
        "run-target",
        `${player.id} RUN requires an explicit target or direct-facing vector.`,
      );
    }
    const sourceProfile = projectCssoccerMotionSourceProfile(profile, {
      teamRate: player.teamRate.value,
    });
    const speed = actualPlayerSpeed({
      pitchLength: environment.pitch.length,
      teamRate: player.teamRate.value,
      speedIntent: command.speedIntent,
      intentionCount: command.intentionCount,
      sideStep: false,
      nativePlayer: player.nativePlayerNumber,
      ballPossession: environment.ball.possession,
      ballInHands: environment.ball.inHands,
      keeperNativePlayers: CSSOCCER_PLAYER_MOTION_CONSTANTS.keeperNativePlayers,
      userControlIndex: user ? CSSOCCER_PLAYER_MOTION_CONSTANTS.userControlIndex : 0,
      burstTimer: user ? command.burstTimer : 0,
      celebrationSpeed: sourceProfile.celebrationSpeed,
    });
    const forward = sourceForwardDisplacement({
      facing,
      targetOffset: vector,
      speed,
    });
    position = {
      ...updateSourcePosition2d({
        position: { x: position.x, y: position.y },
        displacement: forward.displacement,
      }),
      z: player.position.z,
    };
  }

  if (vector !== null) {
    vector = motionVector(command.motion, position);
    const sourceProfile = projectCssoccerMotionSourceProfile(profile, {
      teamRate: player.teamRate.value,
    });
    facing = turnSourceFacing({
      facing,
      target: vector,
      maxTurnRadians: sourceProfile.maxTurnRadians,
    }).facing;
  }
  const action = createCssoccerActionState({
    tick,
    playerId: player.id,
    actionId: command.actionAfter,
    facingX: facing.x,
    facingY: facing.y,
  });
  return deepFreeze({
    ...clone(player),
    tick,
    position: { x: position.x, y: position.y, z: position.z },
    facing: {
      x: action.facing.x.value,
      y: action.facing.y.value,
      direction: typedValue(
        `players.${player.id}.face_direction`,
        "i16",
        sourceFacingDirection(facing),
      ),
    },
    native: {
      action: action.action,
      control: typedValue(`players.${player.id}.control`, "u8", user ? 1 : 0),
      on: clone(player.native.on),
    },
  });
}

function requireUserPitchEdge(player, vector, pitch, prat) {
  const margin = f32(2 * prat);
  if (
    (player.position.x < -margin && vector.x < 0)
    || (player.position.x > pitch.length + margin && vector.x > 0)
    || (player.position.y < -margin && vector.y < 0)
    || (player.position.y > pitch.width + margin && vector.y > 0)
  ) {
    throw new CssoccerUnsupportedPlayerMotionError(
      "pitch-edge",
      "USER.CPP pitch-edge clipping changes the requested direction and must be materialized upstream.",
      { playerId: player.id },
    );
  }
}

function requireEnvironment(ball, pitch) {
  requirePlainObject(ball, "player-motion ball context");
  requireExactKeys(ball, ["inHands", "possession"], "player-motion ball context");
  requireIntegerRange(ball.possession, 0, 22, "player-motion ball possession");
  requireBoolean(ball.inHands, "player-motion ball inHands");
  requirePlainObject(pitch, "player-motion pitch");
  requireExactKeys(pitch, ["length", "width"], "player-motion pitch");
  if (
    pitch.length !== CSSOCCER_PLAYER_MOTION_CONSTANTS.pitchLength
    || pitch.width !== CSSOCCER_PLAYER_MOTION_CONSTANTS.pitchWidth
  ) {
    throw new Error("Player motion requires the exact fixed 1280 by 800 native pitch.");
  }
  return deepFreeze({
    ball: { possession: ball.possession, inHands: ball.inHands },
    pitch: { length: pitch.length, width: pitch.width },
  });
}

function requireUserSprint(value) {
  requirePlainObject(value, "user-control sprint result");
  requireExactKeys(value, ["active", "timer"], "user-control sprint result");
  requireBoolean(value.active, "user-control sprint active");
  requireTypedValue(value.timer, "users.0.burst_timer", "i16");
  if (value.active !== (value.timer.value > 0)) {
    throw new Error("User-control sprint state diverged from its burst timer.");
  }
  return value.timer.value;
}

function requireUserActionCommand(value, tick) {
  requirePlainObject(value, "user action command");
  requireExactKeys(value, [
    "actionAfter",
    "actionBefore",
    "burstDirective",
    "decision",
    "facingIntent",
    "kind",
    "playerId",
    "possession",
    "schema",
    "tick",
  ], "user action command");
  if (
    value.schema !== CSSOCCER_ACTION_COMMAND_SCHEMA
    || value.tick !== tick
    || !PLAYER_ID.test(value.playerId ?? "")
    || !["hold", "run", "burst-run", "tackle-rejected"].includes(value.kind)
  ) {
    throw new CssoccerUnsupportedPlayerMotionError(
      "user-action-semantics",
      "Only explicit user stand/run outcomes enter planar live motion.",
    );
  }
  requireTypedValue(value.actionBefore, `players.${value.playerId}.action.before`, "i16");
  requireTypedValue(value.actionAfter, `players.${value.playerId}.action.after`, "i16");
  requireSupportedAction(value.actionBefore.value, "user actionBefore");
  requireSupportedAction(value.actionAfter.value, "user actionAfter");
  requirePlainObject(value.facingIntent, "user action facing intent");
  requireExactKeys(value.facingIntent, ["active", "application", "x", "y"], "user action facing intent");
  requireBoolean(value.facingIntent.active, "user action facing active");
  requireTypedValue(value.facingIntent.x, `players.${value.playerId}.input_facing_x`, "i8");
  requireTypedValue(value.facingIntent.y, `players.${value.playerId}.input_facing_y`, "i8");
  if (
    value.facingIntent.active
      !== (value.facingIntent.x.value !== 0 || value.facingIntent.y.value !== 0)
  ) {
    throw new Error("User action-facing active flag diverged from its axes.");
  }
  return value;
}

function requireAiIntent(value) {
  requirePlainObject(value, "AI player intent");
  if (
    value.schema !== CSSOCCER_PLAYER_AI_INTENT_SCHEMA
    || !PLAYER_ID.test(value.playerId ?? "")
    || !Number.isInteger(value.nativePlayerNumber)
    || value.nativePlayerNumber < 1
    || value.nativePlayerNumber > 22
    || value.nativeTeamSlot !== (value.nativePlayerNumber <= 11 ? "A" : "B")
    || typeof value.kind !== "string"
    || value.kind.length === 0
  ) {
    throw new Error(`AI player intent must use ${CSSOCCER_PLAYER_AI_INTENT_SCHEMA}.`);
  }
  if (containsEvidenceKey(value)) {
    throw new CssoccerUnsupportedPlayerMotionError(
      "evidence-input",
      "AI motion intents may not carry retained/oracle/sample payloads.",
    );
  }
  return deepFreeze(clone(value));
}

function validateAiMotionKind(intent, motion, actionAfter) {
  const targetKinds = new Set([
    "close-down",
    "intercept",
    "mark",
    "retrieve",
    "retreat-onside",
    "support",
    "zonal",
  ]);
  const holdKinds = new Set(["busy", "hold", "inactive", "non-live-play", "preserve-action"]);
  if (targetKinds.has(intent.kind)) {
    if (
      motion.kind !== "target"
      || actionAfter !== CSSOCCER_NATIVE_ACTIONS.RUN
      || intent.target === undefined
      || !samePoint2(motion.target, intent.target)
    ) {
      throw new CssoccerUnsupportedPlayerMotionError(
        "ai-action-semantics",
        `AI ${intent.kind} requires explicit RUN toward its exact source target.`,
      );
    }
    return;
  }
  if (intent.kind === "direct-facing") {
    if (
      motion.kind !== "direct-facing"
      || intent.facing === undefined
      || !samePoint2(motion.facing, intent.facing)
    ) {
      throw new CssoccerUnsupportedPlayerMotionError(
        "ai-action-semantics",
        "AI direct-facing motion must retain its explicit source vector.",
      );
    }
    return;
  }
  if (holdKinds.has(intent.kind)) {
    if (motion.kind !== "hold" || actionAfter !== CSSOCCER_NATIVE_ACTIONS.STAND) {
      throw new CssoccerUnsupportedPlayerMotionError(
        "ai-action-semantics",
        `AI ${intent.kind} is supported only as explicit STAND/hold.`,
      );
    }
    return;
  }
  throw new CssoccerUnsupportedPlayerMotionError(
    "ai-action-semantics",
    `AI intent ${intent.kind} requires an unimplemented action/contact owner.`,
    { playerId: intent.playerId, kind: intent.kind },
  );
}

function requireMotionDirective(value, label) {
  requirePlainObject(value, label);
  requireExactKeys(value, ["facing", "kind", "target"], label);
  if (!['hold', 'target', 'direct-facing'].includes(value.kind)) {
    throw new Error(`${label} kind must be hold, target, or direct-facing.`);
  }
  if (value.kind === "hold") {
    if (value.target !== null || value.facing !== null) {
      throw new Error(`${label} hold cannot retain target/facing values.`);
    }
    return deepFreeze({ kind: "hold", target: null, facing: null });
  }
  if (value.kind === "target") {
    if (value.facing !== null) throw new Error(`${label} target cannot retain direct facing.`);
    return deepFreeze({
      kind: "target",
      target: requirePoint2(value.target, `${label} target`),
      facing: null,
    });
  }
  if (value.target !== null) throw new Error(`${label} direct-facing cannot retain a target.`);
  return deepFreeze({
    kind: "direct-facing",
    target: null,
    facing: requirePoint2(value.facing, `${label} facing`),
  });
}

function motionVector(motion, position) {
  if (motion.kind === "hold") return null;
  if (motion.kind === "direct-facing") return motion.facing;
  return {
    x: f32(motion.target.x - position.x),
    y: f32(motion.target.y - position.y),
  };
}

function requireDynamicPlayer(player, state) {
  requirePlainObject(player, "dynamic player");
  requireExactKeys(player, [
    "country",
    "facing",
    "id",
    "native",
    "nativePlayerNumber",
    "nativeTeamSlot",
    "position",
    "teamRate",
    "tick",
  ], "dynamic player");
  if (!PLAYER_ID.test(player.id ?? "")) throw new Error("Dynamic player stable id is invalid.");
  const country = player.id.startsWith("spain-") ? "spain" : "argentina";
  const rosterNumber = Number(player.id.slice(-2));
  const expectedSlot = state.matchHalf === 0
    ? (country === "spain" ? "A" : "B")
    : (country === "spain" ? "B" : "A");
  const expectedNumber = rosterNumber + (expectedSlot === "A" ? 0 : 11);
  if (
    player.country !== country
    || player.nativeTeamSlot !== expectedSlot
    || player.nativePlayerNumber !== expectedNumber
    || player.tick !== state.tick
  ) {
    throw new Error(`${player.id} stable identity/native half mapping changed.`);
  }
  requireTypedValue(player.teamRate, `players.${player.id}.team_rate`, "u8");
  requirePoint3(player.position, `${player.id} position`);
  requirePlainObject(player.facing, `${player.id} facing`);
  requireExactKeys(player.facing, ["direction", "x", "y"], `${player.id} facing`);
  requireF32(player.facing.x, `${player.id} facing x`);
  requireF32(player.facing.y, `${player.id} facing y`);
  if (player.facing.x === 0 && player.facing.y === 0) {
    throw new Error(`${player.id} facing cannot be the zero vector.`);
  }
  requireTypedValue(player.facing.direction, `players.${player.id}.face_direction`, "i16");
  const expectedDirection = player.tick === 0
    ? 0
    : sourceFacingDirection({ x: player.facing.x, y: player.facing.y });
  if (player.facing.direction.value !== expectedDirection) {
    throw new Error(`${player.id} face direction changed.`);
  }
  requirePlainObject(player.native, `${player.id} native state`);
  requireExactKeys(player.native, ["action", "control", "on"], `${player.id} native state`);
  requireTypedValue(player.native.action, `players.${player.id}.action`, "i16");
  requireSupportedAction(player.native.action.value, `${player.id} action`);
  requireTypedValue(player.native.control, `players.${player.id}.control`, "u8");
  if (![0, 1].includes(player.native.control.value)) throw new Error(`${player.id} control must be 0 or 1.`);
  requireTypedValue(player.native.on, `players.${player.id}.on`, "i16");
  if (player.native.on.value !== 1) throw new Error(`${player.id} must remain active in the fixed match.`);
}

function nativeProcessOrder(players, sourceFrame) {
  const first = sourceFrame ? "A" : "B";
  const second = first === "A" ? "B" : "A";
  return [first, second].flatMap((slot) => players
    .filter((player) => player.nativeTeamSlot === slot)
    .slice()
    .sort((left, right) => left.nativePlayerNumber - right.nativePlayerNumber));
}

function requireBoundProfile(value, expectedHash) {
  const profile = assertCssoccerNativeGameplayProfile(value);
  if (profile.profileHash !== expectedHash) {
    throw new CssoccerUnsupportedPlayerMotionError(
      "gameplay-profile",
      "Player-motion gameplay profile hash changed.",
    );
  }
  return profile;
}

function requireSpeedIntent(value) {
  if (![CSSOCCER_SPEED_INTENT.normal, CSSOCCER_SPEED_INTENT.intercept].includes(value)) {
    throw new CssoccerUnsupportedPlayerMotionError(
      "speed-intent",
      "Planar stand/run supports only explicit normal or intercept speed intent.",
    );
  }
  return value;
}

function requireSupportedAction(value, label) {
  requireInt16(value, label);
  if (![CSSOCCER_NATIVE_ACTIONS.STAND, CSSOCCER_NATIVE_ACTIONS.RUN].includes(value)) {
    throw new CssoccerUnsupportedPlayerMotionError(
      "action-semantics",
      `${label} ${value} is outside supported STAND/RUN motion.`,
    );
  }
  return value;
}

function requireTypedValue(value, fieldId, valueType) {
  requirePlainObject(value, `typed ${fieldId}`);
  requireExactKeys(value, ["fieldId", "numericBits", "value", "valueType"], `typed ${fieldId}`);
  const recreated = typedValue(fieldId, valueType, value.value);
  if (!sameValue(value, recreated)) {
    throw new Error(`Typed ${fieldId} changed value type or numeric bits.`);
  }
  return value;
}

function typedValue(fieldId, valueType, value) {
  requireNumericValue(value, valueType, fieldId);
  return deepFreeze({
    fieldId,
    valueType,
    value,
    numericBits: numericBits(value, valueType),
  });
}

function numericBits(value, valueType) {
  if (valueType === "string") return null;
  const bytes = valueType === "u8" || valueType === "i8"
    ? 1
    : valueType === "i16" ? 2 : 4;
  const buffer = new ArrayBuffer(bytes);
  const view = new DataView(buffer);
  if (valueType === "u8") view.setUint8(0, value);
  else if (valueType === "i16") view.setInt16(0, value, false);
  else if (valueType === "i8") view.setInt8(0, value);
  else view.setFloat32(0, value, false);
  return [...new Uint8Array(buffer)]
    .map((entry) => entry.toString(16).padStart(2, "0"))
    .join("");
}

function requireNumericValue(value, valueType, label) {
  if (valueType === "string") {
    if (typeof value !== "string") throw new TypeError(`${label} must be string.`);
    return;
  }
  if (valueType === "f32") {
    requireF32(value, label);
    return;
  }
  if (valueType === "u8") {
    requireIntegerRange(value, 0, 255, label);
    return;
  }
  if (valueType === "i8") {
    requireIntegerRange(value, -128, 127, label);
    return;
  }
  if (valueType === "i16") {
    requireInt16(value, label);
    return;
  }
  throw new Error(`Unsupported player-motion value type ${valueType}.`);
}

function requirePoint2(value, label) {
  requirePlainObject(value, label);
  requireExactKeys(value, ["x", "y"], label);
  return deepFreeze({
    x: requireF32(value.x, `${label}.x`),
    y: requireF32(value.y, `${label}.y`),
  });
}

function requirePoint3(value, label) {
  requirePlainObject(value, label);
  requireExactKeys(value, ["x", "y", "z"], label);
  requireF32(value.x, `${label}.x`);
  requireF32(value.y, `${label}.y`);
  requireF32(value.z, `${label}.z`);
  return value;
}

function samePoint2(left, right) {
  return left !== null
    && right !== null
    && Object.is(left.x, right.x)
    && Object.is(left.y, right.y);
}

function containsEvidenceKey(value) {
  if (Array.isArray(value)) return value.some(containsEvidenceKey);
  if (value === null || typeof value !== "object") return false;
  return Object.entries(value).some(([key, entry]) => (
    /retained|oracle|sample|stateJsonl|capture/iu.test(key)
    || containsEvidenceKey(entry)
  ));
}

function requireF32(value, label) {
  if (!Number.isFinite(value) || !Object.is(f32(value), value)) {
    throw new TypeError(`${label} must be an exact finite f32.`);
  }
  return value;
}

function requireInt16(value, label) {
  requireIntegerRange(value, -32768, 32767, label);
  return value;
}

function requireNonNegativeInt32(value, label) {
  requireIntegerRange(value, 0, 0x7fffffff, label);
  return value;
}

function requireUint32(value, label) {
  requireIntegerRange(value, 0, 0xffffffff, label);
  return value;
}

function requireIntegerRange(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer in ${minimum}..${maximum}.`);
  }
  return value;
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be boolean.`);
  return value;
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
    || (Object.getPrototypeOf(value) !== Object.prototype
      && Object.getPrototypeOf(value) !== null)
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
