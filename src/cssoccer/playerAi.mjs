import {
  isCssoccerKeeperNumber,
  selectCssoccerKeeperIntent,
} from "./keeperAi.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  projectCssoccerKickoffSourceProfile,
} from "./nativeGameplayProfile.mjs";
import { resolveCssoccerZonalTarget } from "./tacticsState.mjs";

export const CSSOCCER_PLAYER_AI_STATE_SCHEMA = "cssoccer-player-ai-state@1";
export const CSSOCCER_PLAYER_AI_INTENT_SCHEMA = "cssoccer-player-ai-intent@1";

const SOURCE_ACTION_IDS = projectCssoccerKickoffSourceProfile(
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
).actionIds;

export const CSSOCCER_PLAYER_AI_SOURCE = deepFreeze({
  file: "INTELL.CPP",
  sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
  boundaries: {
    rethink: "thinking/intelligence",
    freeBall: "free_ball",
    possession: "got_ball",
    support: "we_have_ball/help_chance",
    retrieve: "opp_has_ball",
    zonal: "find_zonal_target",
  },
  closeInNumber: 2,
  interactiveActionIds: [SOURCE_ACTION_IDS.stand, SOURCE_ACTION_IDS.run],
});

export const CSSOCCER_PLAYER_AI_GAPS = deepFreeze([
  {
    id: "native-intelligence-state",
    status: "unsupported",
    reason: "The native field contract omits match_player int_move, int_cnt, tm_notme, tm_leave, and tm_stopped, so internal AI state cannot yet be compared exactly.",
  },
  {
    id: "numeric-action-semantics",
    status: "unsupported",
    reason: "Stand/run classification is profile-bound, but pass, shot, punt, tackle, and save initializer payloads remain owned by their action/contact reducers.",
  },
  {
    id: "possession-candidate-evaluation",
    status: "required-input",
    reason: "Pass, shot, punt, and run eligibility facts must be computed by their source-owned reducers.",
  },
]);

export function createCssoccerPlayerAiState(player, nativeAttributes) {
  requirePlainObject(player, "team player state");
  requirePlayerId(player.id);
  requirePlainObject(nativeAttributes, `native fixture attributes for ${player.id}`);
  requirePlainObject(player.current, `current state for ${player.id}`);
  requirePlainObject(player.formation?.kickoff?.sourceValues, `source values for ${player.id}`);
  const source = player.formation.kickoff.sourceValues;
  const nativePlayerNumber = requireIntegerRange(
    player.current.nativePlayerNumber,
    1,
    22,
    `${player.id} native player number`,
  );
  const action = typedScalar(
    player.current.action,
    "i16",
    `players.${player.id}.action`,
  );
  const on = typedScalar(
    player.kickoff?.active?.value ?? source.on?.value,
    "i16",
    `players.${player.id}.on`,
  );
  return deepFreeze({
    schema: CSSOCCER_PLAYER_AI_STATE_SCHEMA,
    id: player.id,
    country: player.country,
    nativePlayerNumber,
    nativeTeamSlot: nativeTeamSlot(nativePlayerNumber),
    keeper: isCssoccerKeeperNumber(nativePlayerNumber),
    position: sourcePosition(source, player.id),
    facing: sourceFacing(source, player.id),
    attributes: requireAttributes(nativeAttributes, player.id),
    native: {
      action,
      control: typedScalar(0, "u8", `players.${player.id}.control`),
      on,
    },
    actionClass: action.value === 0 ? "stand-run-turn" : "unbound-numeric-action",
    intelligence: {
      move: "none",
      count: 0,
      notMe: 0,
      stopped: false,
      leave: false,
      offside: 0,
    },
    tick: 0,
    lastIntent: null,
  });
}

export function syncCssoccerPlayerAiState(state, snapshot = {}) {
  const current = assertCssoccerPlayerAiState(state);
  requirePlainObject(snapshot, `runtime snapshot for ${current.id}`);
  const nativePlayerNumber = snapshot.nativePlayerNumber ?? current.nativePlayerNumber;
  requireIntegerRange(nativePlayerNumber, 1, 22, `${current.id} nativePlayerNumber`);
  const position = snapshot.position === undefined
    ? current.position
    : requirePoint(snapshot.position, `${current.id} position`, true, true);
  const facing = snapshot.facing === undefined
    ? current.facing
    : requireFacing(snapshot.facing, `${current.id} facing`);
  const native = {
    action: snapshot.action === undefined
      ? current.native.action
      : requireTypedScalar(snapshot.action, "i16", `players.${current.id}.action`),
    control: snapshot.control === undefined
      ? current.native.control
      : requireTypedScalar(snapshot.control, "u8", `players.${current.id}.control`),
    on: snapshot.on === undefined
      ? current.native.on
      : requireTypedScalar(snapshot.on, "i16", `players.${current.id}.on`),
  };
  const inferredActionClass = snapshot.action === undefined
    ? current.actionClass
    : actionClassFor(snapshot.action.value);
  const actionClass = snapshot.actionClass ?? inferredActionClass;
  if (!["stand-run-turn", "busy", "unbound-numeric-action"].includes(actionClass)) {
    throw new Error(`${current.id} actionClass is unsupported.`);
  }
  if (snapshot.action !== undefined && snapshot.actionClass !== undefined
      && snapshot.actionClass !== inferredActionClass) {
    throw new Error(`${current.id} actionClass contradicts its bound native action.`);
  }
  const intelligence = snapshot.intelligence === undefined
    ? current.intelligence
    : requireIntelligence(snapshot.intelligence, current.id);
  return deepFreeze({
    ...clone(current),
    nativePlayerNumber,
    nativeTeamSlot: nativeTeamSlot(nativePlayerNumber),
    keeper: isCssoccerKeeperNumber(nativePlayerNumber),
    position,
    facing,
    native,
    actionClass,
    intelligence,
  });
}

/** Advance only the intelligence boundary for one computer-controlled player. */
export function stepCssoccerPlayerAi(state, context = {}) {
  const current = assertCssoccerPlayerAiState(state);
  requirePlainObject(context, `AI context for ${current.id}`);
  if (context.selectedTeamSlot !== undefined) {
    requireTeamSlot(context.selectedTeamSlot, "selectedTeamSlot");
  }
  if (current.native.control.value !== 0) {
    throw new Error(`AI cannot advance user-controlled player ${current.id}.`);
  }
  if (current.native.on.value <= 0) {
    return finish(current, current.intelligence, playerIntent(current, "inactive"));
  }

  const match = requireMatchContext(context.match);
  const busy = advanceBusyCounter(current, match);
  if (busy.busy) {
    return finish(current, busy.intelligence, playerIntent(current, "busy", {
      move: busy.intelligence.move,
      remaining: busy.intelligence.count,
    }));
  }
  if (!match.livePlay) {
    return finish(current, busy.intelligence, playerIntent(current, "non-live-play"));
  }
  if (current.actionClass !== "stand-run-turn") {
    return finish(current, busy.intelligence, playerIntent(current, "preserve-action", {
      action: current.native.action,
      reason: "numeric-action-semantics-unbound",
    }));
  }

  const player = { ...clone(current), intelligence: busy.intelligence };
  let decision;
  if (match.possession === current.nativePlayerNumber) {
    decision = current.keeper
      ? keeperDecision(player, context, match)
      : chooseCssoccerPossessionIntent(player, context.possessionChoice);
  } else if (match.possession === 0) {
    decision = current.keeper
      ? keeperDecision(player, context, match)
      : freeBallDecision(player, context, match);
  } else if (sameNativeTeam(current.nativePlayerNumber, match.possession)) {
    decision = current.keeper
      ? keeperDecision(player, context, match)
      : teammatePossessionDecision(player, context, match);
  } else {
    decision = current.keeper
      ? keeperDecision(player, context, match)
      : opponentPossessionDecision(player, context, match);
  }
  return finish(current, decision.intelligence ?? busy.intelligence, decision.intent ?? decision);
}

export function chooseCssoccerPossessionIntent(player, choice) {
  const current = assertCssoccerPlayerAiState(player);
  if (current.keeper) throw new Error("Outfield possession choice cannot drive a keeper.");
  requirePlainObject(choice, `possession choice for ${current.id}`);
  if (choice.shoot === true) {
    return playerIntent(current, "shoot", { actionStatus: "requires-action-semantics" });
  }
  if (choice.crossPassTarget !== null && choice.crossPassTarget !== undefined) {
    const target = requireTeamMate(choice.crossPassTarget, current);
    return playerIntent(current, "pass", {
      mode: "cross",
      targetPlayerId: target.id,
      targetNativePlayerNumber: target.nativePlayerNumber,
      actionStatus: "requires-action-semantics",
    });
  }
  if (choice.passTarget !== null && choice.passTarget !== undefined) {
    const target = requireTeamMate(choice.passTarget, current);
    return playerIntent(current, "pass", {
      mode: "normal",
      targetPlayerId: target.id,
      targetNativePlayerNumber: target.nativePlayerNumber,
      actionStatus: "requires-action-semantics",
    });
  }
  if (choice.punt === true) {
    return playerIntent(current, "punt", { actionStatus: "requires-action-semantics" });
  }
  if (choice.runTarget !== null && choice.runTarget !== undefined) {
    return playerIntent(current, "run", {
      target: requirePoint(choice.runTarget, `${current.id} run target`),
      actionStatus: "requires-action-semantics",
    });
  }
  throw new Error(
    `Possession choice for ${current.id} requires source-backed shoot/pass/punt/run facts.`,
  );
}

export function materializeCssoccerPlayerIntent(intent, semantics) {
  requirePlainObject(intent, "player intent");
  if (intent.schema !== CSSOCCER_PLAYER_AI_INTENT_SCHEMA) {
    throw new Error(`Player intent must use ${CSSOCCER_PLAYER_AI_INTENT_SCHEMA}.`);
  }
  requirePlainObject(semantics, "player action semantics");
  if (
    semantics.schema !== "cssoccer-player-action-semantics@1"
    || semantics.sourceStatus !== "prepared-exact"
    || !/^[a-f0-9]{64}$/u.test(semantics.sha256 ?? "")
  ) {
    throw new Error(
      "Player action semantics are unavailable; a prepared exact action binding is required.",
    );
  }
  const binding = semantics.intents?.[intent.kind];
  if (!binding) {
    throw new Error(`No prepared action binding exists for intent ${intent.kind}.`);
  }
  return deepFreeze({ intent: clone(intent), binding: clone(binding) });
}

export function cssoccerThinkingTick(logicCount, flair) {
  requireIntegerRange(logicCount, 0, 0x7fffffff, "logicCount");
  requireIntegerRange(flair, 0, 128, "flair");
  const period = Math.trunc((130 - flair) / 2);
  return logicCount % period === 0;
}

export function assertCssoccerPlayerAiState(state) {
  requirePlainObject(state, "player AI state");
  if (state.schema !== CSSOCCER_PLAYER_AI_STATE_SCHEMA) {
    throw new Error(`Player AI state must use ${CSSOCCER_PLAYER_AI_STATE_SCHEMA}.`);
  }
  requirePlayerId(state.id);
  requireIntegerRange(state.nativePlayerNumber, 1, 22, `${state.id} nativePlayerNumber`);
  if (state.nativeTeamSlot !== nativeTeamSlot(state.nativePlayerNumber)) {
    throw new Error(`${state.id} native team slot diverged from its native player number.`);
  }
  if (state.keeper !== isCssoccerKeeperNumber(state.nativePlayerNumber)) {
    throw new Error(`${state.id} keeper identity diverged from its native player number.`);
  }
  requirePoint(state.position, `${state.id} position`, true, true);
  requireFacing(state.facing, `${state.id} facing`);
  requireAttributes(state.attributes, state.id);
  requireTypedScalar(state.native?.action, "i16", `players.${state.id}.action`);
  requireTypedScalar(state.native?.control, "u8", `players.${state.id}.control`);
  requireTypedScalar(state.native?.on, "i16", `players.${state.id}.on`);
  requireIntelligence(state.intelligence, state.id);
  requireIntegerRange(state.tick, 0, Number.MAX_SAFE_INTEGER, `${state.id} tick`);
  return state;
}

function freeBallDecision(player, context) {
  const selectors = requireSelectors(context.selectors);
  if (
    selectors.interceptorBySlot[player.nativeTeamSlot] === 0
    && selectors.nearPathBySlot[player.nativeTeamSlot] === player.nativePlayerNumber
  ) {
    const target = requirePoint(
      context.pathTargets?.[player.nativeTeamSlot],
      `${player.id} interception target`,
      true,
    );
    const count = rethinkCount(player.attributes.flair);
    return {
      intelligence: { ...clone(player.intelligence), move: "intercept", count },
      intent: playerIntent(player, "intercept", { target, rethinkCount: count }),
    };
  }
  return zonalDecision(player, context, false, "free-ball-shape");
}

function teammatePossessionDecision(player, context) {
  const facts = context.supportFacts?.[player.id];
  if (
    cssoccerThinkingTick(context.match.logicCount, player.attributes.flair)
    && player.intelligence.offside === 0
    && player.intelligence.stopped === false
    && facts?.askForPass === true
  ) {
    const target = requirePoint(facts.runTarget, `${player.id} support run target`);
    const count = requireIntegerRange(
      facts.runTicks,
      1,
      0x7fff,
      `${player.id} support run ticks`,
    );
    return {
      intelligence: { ...clone(player.intelligence), move: "run-on", count },
      intent: playerIntent(player, "support", {
        target,
        rethinkCount: count,
        call: facts.crossCall === true ? "cross" : "pass",
      }),
    };
  }
  if (player.intelligence.offside !== 0) {
    const target = requirePoint(context.retreatTargets?.[player.id], `${player.id} retreat target`);
    return playerIntent(player, "retreat-onside", { target });
  }
  return zonalDecision(player, context, true, "support-shape");
}

function opponentPossessionDecision(player, context, match) {
  if (match.ballInHands || match.ballOutOfPlay) {
    return zonalDecision(player, context, false, "keeper-possession-shape");
  }
  const rank = requireIntegerRange(
    context.selectors?.distanceRankById?.[player.id],
    1,
    11,
    `${player.id} distance rank`,
  );
  if (rank <= CSSOCCER_PLAYER_AI_SOURCE.closeInNumber || rank === 1) {
    const facts = context.retrieveFacts?.[player.id];
    requirePlainObject(facts, `${player.id} retrieve facts`);
    if (typeof facts.inClose !== "boolean") {
      throw new TypeError(`${player.id} retrieve facts inClose must be boolean.`);
    }
    if (facts.inClose) {
      if (!["behind", "side", "front"].includes(facts.holderFacing)) {
        throw new Error(`${player.id} retrieve holderFacing must be behind, side, or front.`);
      }
      if (
        context.selectedTeamSlot === player.nativeTeamSlot
        && (facts.holderFacing === "side" || facts.holderFacing === "front")
      ) {
        return playerIntent(player, "preserve-action", {
          action: player.native.action,
          reason: "source-auto-user-pressure-guard",
        });
      }
      const style = facts.holderFacing === "side"
        ? "forceful"
        : facts.holderFacing === "behind" ? "between" : "force-error";
      const target = requirePoint(facts.target, `${player.id} retrieve target`);
      const count = rethinkCount(player.attributes.flair);
      return {
        intelligence: { ...clone(player.intelligence), move: "intercept", count },
        intent: playerIntent(player, "retrieve", { style, target, rethinkCount: count }),
      };
    }
    if (context.selectors.nearestBySlot[player.nativeTeamSlot] === player.nativePlayerNumber) {
      const count = Math.trunc(player.attributes.flair / 4);
      return {
        intelligence: { ...clone(player.intelligence), move: "close-down", count },
        intent: playerIntent(player, "close-down", {
          target: { ...match.ball.position },
          rethinkCount: count,
        }),
      };
    }
  }
  return zonalDecision(player, context, false, "mark-shape", "mark");
}

function zonalDecision(player, context, teamInPossession, reason, kind = "zonal") {
  const target = resolveCssoccerZonalTarget(context.tactics, {
    nativeTeamSlot: player.nativeTeamSlot,
    nativePlayerNumber: player.nativePlayerNumber,
    ballZone: context.match.ballZoneBySlot[player.nativeTeamSlot],
    zoneCenter: context.match.ballZoneCenterBySlot?.[player.nativeTeamSlot],
    teamInPossession,
    pitchLength: context.match.pitch.length,
    pitchWidth: context.match.pitch.width,
    analogue: context.match.analogue,
    ballPosition: context.match.ball.position,
  });
  return playerIntent(player, kind, { reason, target });
}

function keeperDecision(player, context, match) {
  const result = selectCssoccerKeeperIntent(player, {
    pitch: match.pitch,
    ball: match.ball,
    possession: match.possession,
    cannotPickUp: match.cannotPickUp,
    opponentNear: context.keeperFacts?.[player.id]?.opponentNear,
    shotPending: match.shotPending,
    shotAcknowledged: match.shotAcknowledged,
    seed: match.seed,
    predictions: context.predictions,
    sourceConstants: context.sourceConstants?.keeper,
    distribution: context.keeperFacts?.[player.id]?.distribution,
    possessionChoice: context.keeperFacts?.[player.id]?.possessionChoice,
  });
  return playerIntent(player, `keeper-${result.kind}`, { keeper: result });
}

function advanceBusyCounter(player, match) {
  const intelligence = clone(player.intelligence);
  if (intelligence.count === 0) return { busy: false, intelligence };
  intelligence.count -= 1;
  if (intelligence.count === 0) {
    intelligence.move = "none";
    return { busy: false, intelligence };
  }
  const keeperShotOverride = player.keeper
    && intelligence.move === "intercept"
    && match.shotPending;
  return { busy: !keeperShotOverride, intelligence };
}

function finish(state, intelligence, intent) {
  return deepFreeze({
    ...clone(state),
    intelligence: clone(intelligence),
    tick: state.tick + 1,
    lastIntent: clone(intent),
  });
}

function playerIntent(player, kind, details = {}) {
  return deepFreeze({
    schema: CSSOCCER_PLAYER_AI_INTENT_SCHEMA,
    playerId: player.id,
    nativePlayerNumber: player.nativePlayerNumber,
    nativeTeamSlot: player.nativeTeamSlot,
    kind,
    ...details,
  });
}

function requireMatchContext(value) {
  requirePlainObject(value, "player AI match context");
  const pitch = value.pitch ?? { length: 1280, width: 800 };
  requirePlainObject(pitch, "player AI pitch");
  requirePositiveFinite(pitch.length, "pitch length");
  requirePositiveFinite(pitch.width, "pitch width");
  const ball = value.ball;
  requirePlainObject(ball, "player AI ball");
  const position = requirePoint(ball.position, "player AI ball position", true, true);
  const ballZoneBySlot = value.ballZoneBySlot;
  requirePlainObject(ballZoneBySlot, "ballZoneBySlot");
  for (const slot of ["A", "B"]) {
    const zone = requireIntegerRange(ballZoneBySlot[slot], 0, 69, `ballZoneBySlot.${slot}`);
    if (zone > 31 && zone < 64) {
      throw new RangeError(`ballZoneBySlot.${slot} must be a live zone or restart row.`);
    }
  }
  const zoneCenters = value.ballZoneCenterBySlot === undefined
    ? null
    : {
        A: requirePoint(value.ballZoneCenterBySlot.A, "ballZoneCenterBySlot.A"),
        B: requirePoint(value.ballZoneCenterBySlot.B, "ballZoneCenterBySlot.B"),
      };
  return deepFreeze({
    livePlay: value.livePlay === true,
    possession: requireIntegerRange(value.possession ?? 0, 0, 22, "possession"),
    ball: { position, inHands: value.ballInHands === true, inAir: value.ballInAir === true },
    ballInHands: value.ballInHands === true,
    ballOutOfPlay: value.ballOutOfPlay === true,
    ballZoneBySlot: { A: ballZoneBySlot.A, B: ballZoneBySlot.B },
    ...(zoneCenters === null ? {} : { ballZoneCenterBySlot: zoneCenters }),
    pitch: { length: pitch.length, width: pitch.width, ratio: pitch.ratio ?? pitch.length / 120 },
    logicCount: requireIntegerRange(value.logicCount, 0, 0x7fffffff, "logicCount"),
    shotPending: value.shotPending === true,
    shotAcknowledged: value.shotAcknowledged === true,
    cannotPickUp: requireIntegerRange(value.cannotPickUp ?? 0, -22, 22, "cannotPickUp"),
    seed: requireIntegerRange(value.seed, 0, 127, "seed"),
    analogue: value.analogue === true,
  });
}

function requireSelectors(value) {
  requirePlainObject(value, "team AI selectors");
  for (const key of ["nearestBySlot", "nearPathBySlot", "interceptorBySlot", "distanceRankById"]) {
    requirePlainObject(value[key], `team AI selectors.${key}`);
  }
  return value;
}

function requireTeamMate(value, player) {
  requirePlainObject(value, `${player.id} team-mate target`);
  requirePlayerId(value.id);
  const nativePlayerNumber = requireIntegerRange(
    value.nativePlayerNumber,
    1,
    22,
    `${value.id} nativePlayerNumber`,
  );
  if (!sameNativeTeam(player.nativePlayerNumber, nativePlayerNumber)) {
    throw new Error(`${value.id} is not on ${player.id}'s native team.`);
  }
  if (value.id === player.id) throw new Error("A player cannot target itself for a pass.");
  return { id: value.id, nativePlayerNumber };
}

function requireIntelligence(value, id) {
  requirePlainObject(value, `intelligence for ${id}`);
  if (typeof value.move !== "string" || value.move.length === 0) {
    throw new TypeError(`${id} intelligence move must be a non-empty string.`);
  }
  return deepFreeze({
    move: value.move,
    count: requireIntegerRange(value.count, 0, 0x7fff, `${id} intelligence count`),
    notMe: requireIntegerRange(value.notMe, 0, 0x7fff, `${id} notMe`),
    stopped: requireBoolean(value.stopped, `${id} stopped`),
    leave: requireBoolean(value.leave, `${id} leave`),
    offside: requireIntegerRange(value.offside, -2, 1, `${id} offside`),
  });
}

function requireAttributes(value, id) {
  return deepFreeze(Object.fromEntries([
    "pace", "power", "control", "flair", "vision", "accuracy", "stamina", "discipline",
  ].map((key) => [
    key,
    requireIntegerRange(value[key], -128, 128, `${id} ${key}`),
  ])));
}

function sourcePosition(source, id) {
  return requirePoint({
    x: source.x?.value,
    y: source.y?.value,
    z: source.z?.value,
  }, `${id} source position`, true, true);
}

function sourceFacing(source, id) {
  return requireFacing({
    x: source.xDisplacement?.value,
    y: source.yDisplacement?.value,
  }, `${id} source facing`);
}

function requireFacing(value, label) {
  const point = requirePoint(value, label, false, true);
  const length = Math.hypot(point.x, point.y);
  if (length === 0) throw new Error(`${label} cannot be zero.`);
  return deepFreeze({ x: point.x, y: point.y });
}

function requirePoint(value, label, includeZ = false, requireF32 = false) {
  requirePlainObject(value, label);
  const point = { x: value.x, y: value.y };
  if (includeZ) point.z = value.z ?? 0;
  for (const entry of Object.values(point)) {
    if (!Number.isFinite(entry)) throw new TypeError(`${label} must contain finite coordinates.`);
    if (requireF32 && !Object.is(entry, Math.fround(entry))) {
      throw new Error(`${label} must retain exact float32 coordinates.`);
    }
  }
  return deepFreeze(point);
}

function typedScalar(value, valueType, fieldId) {
  return deepFreeze({ fieldId, valueType, value, numericBits: numericBits(value, valueType) });
}

function requireTypedScalar(value, valueType, fieldId) {
  requirePlainObject(value, `typed ${fieldId}`);
  if (value.fieldId !== fieldId || value.valueType !== valueType) {
    throw new Error(`Typed ${fieldId} must retain ${valueType}.`);
  }
  const limits = valueType === "u8" ? [0, 255] : [-32768, 32767];
  requireIntegerRange(value.value, limits[0], limits[1], fieldId);
  if (value.numericBits !== numericBits(value.value, valueType)) {
    throw new Error(`Typed ${fieldId} numeric bits changed.`);
  }
  return deepFreeze({
    fieldId: value.fieldId,
    valueType: value.valueType,
    value: value.value,
    numericBits: value.numericBits,
  });
}

function numericBits(value, valueType) {
  const bytes = valueType === "u8" ? 1 : 2;
  const buffer = new ArrayBuffer(bytes);
  const view = new DataView(buffer);
  if (valueType === "u8") view.setUint8(0, value);
  else view.setInt16(0, value, false);
  return [...new Uint8Array(buffer)]
    .map((entry) => entry.toString(16).padStart(2, "0"))
    .join("");
}

function rethinkCount(flair) {
  return 33 - Math.trunc(flair / 4);
}

function actionClassFor(action) {
  return CSSOCCER_PLAYER_AI_SOURCE.interactiveActionIds.includes(action)
    ? "stand-run-turn"
    : "unbound-numeric-action";
}

function nativeTeamSlot(nativePlayerNumber) {
  return nativePlayerNumber <= 11 ? "A" : "B";
}

function sameNativeTeam(left, right) {
  return nativeTeamSlot(left) === nativeTeamSlot(right);
}

function requireTeamSlot(value, label) {
  if (value !== "A" && value !== "B") {
    throw new TypeError(`${label} must be A or B.`);
  }
  return value;
}

function planarDistance(left, right) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function requirePlayerId(value) {
  if (!/^(spain|argentina)-player-(0[1-9]|1[01])$/u.test(value ?? "")) {
    throw new Error("Player AI requires a fixed-fixture stable player id.");
  }
}

function requireIntegerRange(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer in ${minimum}..${maximum}.`);
  }
  return value;
}

function requirePositiveFinite(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive finite number.`);
  }
  return value;
}

function requireBoolean(value, label) {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be boolean.`);
  return value;
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
