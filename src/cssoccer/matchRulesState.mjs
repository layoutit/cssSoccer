import {
  classifyCssoccerBoundary,
} from "./boundaryState.mjs";
import {
  CSSOCCER_OUT_OF_PLAY_DELAY_SCHEMA,
  assertCssoccerRestartState,
  createCssoccerOutOfPlayDelay,
  initializeCssoccerRestart,
  stepCssoccerOutOfPlayDelay,
} from "./restartState.mjs";
import {
  CSSOCCER_SET_PIECE_STATE_SCHEMA,
  advanceCssoccerSetPiece,
  assertCssoccerSetPieceState,
  createCssoccerSetPieceState,
} from "./setPieceState.mjs";
import {
  materializeCssoccerFoulTakerPlacement,
} from "./foulState.mjs";
import {
  assertCssoccerRuleState,
  clearCssoccerRuleRestart,
  completeCssoccerRuleDismissal,
  createCssoccerRuleState,
  remapCssoccerRulePlayers,
  resolveCssoccerRuleAdvantage,
  resolveCssoccerRuleFoul,
  stepCssoccerRuleOffside,
} from "./ruleState.mjs";

export const CSSOCCER_MATCH_RULES_SCHEMA = "cssoccer-match-rules-state@1";
export const CSSOCCER_RULE_SET_PIECE_SCHEMA = "cssoccer-rule-set-piece@1";
export const CSSOCCER_DIRECT_WALL_MEMBERSHIP_SCHEMA = "cssoccer-direct-wall-membership@1";
export const CSSOCCER_PARENT_LAUNCH_RECEIPT_SCHEMA = "cssoccer-parent-launch-receipt@1";

export const CSSOCCER_MATCH_RULES_SOURCE = deepFreeze({
  coordinator: "pure integration over accepted boundary, restart, set-piece, foul, offside, and discipline reducers",
  files: [
    {
      file: "RULES.CPP",
      sha256: "e0e3ebab5f36ec4d60f2ec6f1b4c797661855017c770a6820dc3152ce75a0ef8",
      producers: ["bounds_rules", "process_flags", "init_match_mode", "await_set_kick", "ready_set_kick"],
    },
    {
      file: "INTELL.CPP",
      sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
      producers: ["offside_rule", "remove_player", "restart special positions"],
    },
    {
      file: "ACTIONS.CPP",
      sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
      producers: ["set-piece action launch", "throw action", "pickup action"],
    },
  ],
  unresolvedInputs: [
    "BESIDE_BALL or PEN_RUNUP_DIST prepared value for foul taker placement",
    "source-backed direct-free-kick wall membership",
    "parent-owned pass, shot, punt, or throw launch receipt",
  ],
});

export class CssoccerUnsupportedMatchRulesError extends Error {
  constructor(code, message, detail = {}) {
    super(message);
    this.name = "CssoccerUnsupportedMatchRulesError";
    this.code = code;
    this.detail = deepFreeze(clone(detail));
  }
}

export function createCssoccerMatchRulesState({ players, ...ruleConfig } = {}) {
  const rules = createCssoccerRuleState({ players, ...ruleConfig });
  return deepFreeze({
    schema: CSSOCCER_MATCH_RULES_SCHEMA,
    source: CSSOCCER_MATCH_RULES_SOURCE,
    playState: "normal",
    phase: "normal-play",
    matchMode: 0,
    matchHalf: 1,
    nativeSlotSwapCount: 0,
    rules,
    activeIncident: null,
    boundaryDelay: null,
    restart: null,
    setPiece: null,
    pendingAction: null,
    lastLaunchReceipt: null,
  });
}

/** Route one coordinator incident through its accepted producer reducer. */
export function routeCssoccerMatchRulesIncident(state, event) {
  requirePlainObject(event, "match-rules incident");
  requireExactKeys(event, ["type", "context"], "match-rules incident");
  if (event.type === "boundary") return routeCssoccerMatchRulesBoundary(state, event.context);
  if (event.type === "foul") return routeCssoccerMatchRulesFoul(state, event.context);
  if (event.type === "offside") return stepCssoccerMatchRulesOffside(state, event.context);
  if (event.type === "dismissal-complete") {
    return deepFreeze({
      state: completeCssoccerMatchRulesDismissal(state, event.context),
      decision: { status: "dismissal-complete", playerId: event.context?.playerId },
    });
  }
  throw new Error(`Unsupported match-rules incident ${String(event.type)}.`);
}

export function routeCssoccerMatchRulesBoundary(state, context) {
  const current = requireOpenIncidentState(state, "boundary");
  requirePlainObject(context, "boundary context");
  const boundary = classifyCssoccerBoundary(context);
  if (boundary === null) {
    return deepFreeze({ state: current, decision: null });
  }
  const boundaryDelay = createCssoccerOutOfPlayDelay(boundary);
  return deepFreeze({
    state: transition(current, {
      playState: "dead-ball",
      phase: "boundary-delay",
      matchMode: boundary.matchMode,
      activeIncident: { type: "boundary", decision: boundary },
      boundaryDelay,
      restart: null,
      setPiece: null,
      pendingAction: null,
    }),
    decision: boundary,
  });
}

export function stepCssoccerMatchRulesBoundaryDelay(state) {
  const current = assertCssoccerMatchRulesState(state);
  if (current.phase !== "boundary-delay") {
    throw new Error("boundary delay can advance only during the native out-of-play countdown.");
  }
  const boundaryDelay = stepCssoccerOutOfPlayDelay(current.boundaryDelay);
  return transition(current, {
    phase: boundaryDelay.restartRequired ? "boundary-restart-required" : "boundary-delay",
    boundaryDelay,
  });
}

export function initializeCssoccerMatchRulesBoundaryRestart(state, {
  tacticsState,
  seed,
  ballZones,
  preferredKickers,
} = {}) {
  const current = assertCssoccerMatchRulesState(state);
  if (current.phase !== "boundary-restart-required") {
    throw new Error("boundary restart initialization requires the completed 25-tick delay.");
  }
  requireNoDismissalTransition(current, "boundary restart initialization");
  const args = {
    boundary: current.activeIncident.decision,
    players: restartRoster(current.rules),
    tacticsState,
    seed,
  };
  if (ballZones !== undefined) args.ballZones = ballZones;
  if (preferredKickers !== undefined) args.preferredKickers = preferredKickers;
  const descriptor = initializeCssoccerRestart(args);
  return transition(current, {
    phase: "set-piece",
    restart: { family: "boundary", descriptor },
    setPiece: createCssoccerSetPieceState(descriptor),
  });
}

export function routeCssoccerMatchRulesFoul(state, context) {
  const current = requireOpenIncidentState(state, "foul");
  const routed = resolveCssoccerRuleFoul(current.rules, context);
  return integrateRuleDecision(current, routed, "foul");
}

export function resolveCssoccerMatchRulesAdvantage(state, context) {
  const current = assertCssoccerMatchRulesState(state);
  if (current.phase !== "advantage-pending") {
    throw new Error("advantage resolution requires the coordinator's pending foul incident.");
  }
  const routed = resolveCssoccerRuleAdvantage(current.rules, context);
  return integrateRuleDecision(current, routed, "foul-advantage");
}

export function stepCssoccerMatchRulesOffside(state, context) {
  const current = requireOpenIncidentState(state, "offside");
  const routed = stepCssoccerRuleOffside(current.rules, context);
  if (routed.restart !== null) return integrateRuleDecision(current, routed, "offside");
  const next = transition(current, {
    rules: routed.state,
    activeIncident: null,
  });
  return deepFreeze({ ...clone(routed), state: next });
}

export function completeCssoccerMatchRulesDismissal(state, { playerId } = {}) {
  const current = assertCssoccerMatchRulesState(state);
  if (current.playState !== "dead-ball" || current.rules.discipline.playerOnOff === 0) {
    throw new Error("dismissal completion requires the one active dead-ball dismissal transition.");
  }
  return transition(current, {
    rules: completeCssoccerRuleDismissal(current.rules, { playerId }),
  });
}

/**
 * Advance the accepted boundary set-piece reducer or the coordinator's narrow
 * foul/offside profile seam. A released decision remains blocked until its
 * parent launch receipt is supplied.
 */
export function advanceCssoccerMatchRulesSetPiece(state, event) {
  const current = assertCssoccerMatchRulesState(state);
  if (current.phase !== "set-piece") {
    throw new Error("set-piece advancement requires an active initialized restart.");
  }
  requireNoDismissalTransition(current, "set-piece advancement");
  if (current.restart.family === "boundary") {
    const setPiece = advanceCssoccerSetPiece(current.setPiece, event);
    if (setPiece.phase === "released-to-action") {
      return enterActionPending(current, setPiece, setPiece.actionRequest);
    }
    return transition(current, {
      matchMode: setPiece.rules.matchMode,
      setPiece,
    });
  }
  return advanceRuleSetPiece(current, event);
}

export function completeCssoccerMatchRulesLaunch(state, receipt) {
  const current = assertCssoccerMatchRulesState(state);
  if (current.phase !== "action-pending" || current.pendingAction === null) {
    throw new Error("launch completion requires the current parent-owned action request.");
  }
  const checkedReceipt = requireLaunchReceipt(receipt, current.pendingAction);
  const rules = current.restart.family === "rule"
    ? clearCssoccerRuleRestart(current.rules)
    : current.rules;
  return transition(current, {
    playState: "normal",
    phase: "normal-play",
    matchMode: 0,
    rules,
    activeIncident: null,
    boundaryDelay: null,
    restart: null,
    setPiece: null,
    pendingAction: null,
    lastLaunchReceipt: checkedReceipt,
  });
}

/** Swap native A/B player numbers once, while stable fixture ids remain fixed. */
export function swapCssoccerMatchRulesHalftime(state, mappings) {
  const current = assertCssoccerMatchRulesState(state);
  if (
    current.phase !== "normal-play"
    || current.matchHalf !== 1
    || current.nativeSlotSwapCount !== 0
    || current.rules.discipline.playerOnOff !== 0
  ) {
    throw new Error("native rule slots may swap exactly once at a clear first-half boundary.");
  }
  return transition(current, {
    matchHalf: 2,
    nativeSlotSwapCount: 1,
    rules: remapCssoccerRulePlayers(current.rules, mappings),
  });
}

export function assertCssoccerMatchRulesState(state) {
  requirePlainObject(state, "match-rules state");
  if (state.schema !== CSSOCCER_MATCH_RULES_SCHEMA) {
    throw new Error(`match-rules state must use ${CSSOCCER_MATCH_RULES_SCHEMA}.`);
  }
  assertCssoccerRuleState(state.rules);
  requireIntegerRange(state.matchMode, 0, 19, "match-rules matchMode");
  requireIntegerRange(state.matchHalf, 1, 2, "match-rules matchHalf");
  requireIntegerRange(state.nativeSlotSwapCount, 0, 1, "match-rules nativeSlotSwapCount");
  if (state.matchHalf !== state.nativeSlotSwapCount + 1) {
    throw new Error("match half and native slot swap count diverged.");
  }

  if (state.phase === "normal-play") {
    requireNormalShape(state);
  } else if (state.phase === "advantage-pending") {
    if (
      state.playState !== "normal"
      || state.matchMode !== 0
      || state.rules.foul.playAdvantage !== 1
      || state.activeIncident?.type !== "foul-advantage"
      || state.boundaryDelay !== null
      || state.restart !== null
      || state.setPiece !== null
      || state.pendingAction !== null
    ) {
      throw new Error("pending advantage coordinator state is inconsistent.");
    }
  } else if (state.phase === "boundary-delay" || state.phase === "boundary-restart-required") {
    requireDeadBallBase(state);
    if (
      state.activeIncident?.type !== "boundary"
      || state.boundaryDelay?.schema !== CSSOCCER_OUT_OF_PLAY_DELAY_SCHEMA
      || state.restart !== null
      || state.setPiece !== null
      || state.pendingAction !== null
      || state.matchMode !== state.activeIncident.decision.matchMode
    ) {
      throw new Error("boundary countdown coordinator state is inconsistent.");
    }
    const required = state.phase === "boundary-restart-required";
    if (state.boundaryDelay.restartRequired !== required) {
      throw new Error("boundary countdown phase and restart flag diverged.");
    }
  } else if (state.phase === "set-piece") {
    requireDeadBallBase(state);
    requireRestartWrapper(state.restart);
    if (state.restart.family === "boundary") {
      assertCssoccerRestartState(state.restart.descriptor);
      assertCssoccerSetPieceState(state.setPiece);
      if (state.setPiece.schema !== CSSOCCER_SET_PIECE_STATE_SCHEMA) {
        throw new Error("boundary set-piece schema changed.");
      }
    } else {
      requireRuleSetPiece(state.setPiece, state.restart.descriptor);
    }
    if (state.pendingAction !== null || state.matchMode !== state.setPiece.rules.matchMode) {
      throw new Error("active set-piece coordinator flags diverged from its restart.");
    }
  } else if (state.phase === "action-pending") {
    requireDeadBallBase(state);
    requireRestartWrapper(state.restart);
    requirePlainObject(state.pendingAction, "pending action");
    if (state.matchMode !== 0 || state.setPiece?.phase !== "released-to-action") {
      throw new Error("parent action pending state must have cleared the native match mode.");
    }
  } else {
    throw new Error(`Unsupported match-rules phase ${String(state.phase)}.`);
  }
  return state;
}

function integrateRuleDecision(current, routed, incidentType) {
  const rules = routed.state;
  const status = routed.decision?.status ?? null;
  let next;
  if (routed.restart !== null) {
    const restart = { family: "rule", descriptor: clone(routed.restart) };
    next = transition(current, {
      playState: "dead-ball",
      phase: "set-piece",
      matchMode: routed.restart.matchMode,
      rules,
      activeIncident: {
        type: incidentType,
        decision: clone(routed.decision),
        disciplineEvent: clone(routed.disciplineEvent),
      },
      boundaryDelay: null,
      restart,
      setPiece: createRuleSetPiece(routed.restart),
      pendingAction: null,
    });
  } else if (status === "advantage-pending") {
    next = transition(current, {
      playState: "normal",
      phase: "advantage-pending",
      matchMode: 0,
      rules,
      activeIncident: { type: "foul-advantage", decision: clone(routed.decision) },
      boundaryDelay: null,
      restart: null,
      setPiece: null,
      pendingAction: null,
    });
  } else {
    next = transition(current, {
      playState: "normal",
      phase: "normal-play",
      matchMode: 0,
      rules,
      activeIncident: null,
      boundaryDelay: null,
      restart: null,
      setPiece: null,
      pendingAction: null,
    });
  }
  return deepFreeze({ ...clone(routed), state: next });
}

function createRuleSetPiece(restart) {
  requirePlainObject(restart, "rule restart");
  if (restart.schema !== "cssoccer-foul-restart@1") {
    throw new Error("rule coordinator requires an accepted foul restart descriptor.");
  }
  const allowedActions = restart.kind === "penalty"
    ? ["shot"]
    : restart.kind === "direct"
      ? ["pass", "punt", "shot"]
      : ["pass", "punt"];
  return deepFreeze({
    schema: CSSOCCER_RULE_SET_PIECE_SCHEMA,
    kind: restart.kind,
    mode: restart.mode,
    phase: "awaiting-source-profile",
    taker: clone(restart.taker),
    ballPosition: clone(restart.ballPosition),
    takerPlacement: null,
    directWallMembership: null,
    sourceConstantBinding: {
      status: "required",
      symbol: restart.takerPlacement.constant,
      value: null,
    },
    readiness: { alreadyThere: 0, support: 0 },
    rules: {
      matchMode: restart.matchMode,
      deadBallCount: restart.deadBallCount,
      gameAction: restart.gameAction,
      canBeOffside: restart.canBeOffside,
      setPieceCode: "not-published-by-consumed-reducer",
    },
    allowedActions,
    actionRequest: null,
  });
}

function advanceRuleSetPiece(current, event) {
  requirePlainObject(event, "rule set-piece event");
  const setPiece = current.setPiece;
  if (event.type === "bind-source-profile") {
    if (setPiece.phase !== "awaiting-source-profile") {
      throw new Error("source profile can bind only once before rule set-piece positioning.");
    }
    requireExactKeys(
      event,
      ["type", "sourceConstant", "directWallMembership"],
      "rule source-profile event",
    );
    const wall = setPiece.kind === "direct"
      ? requireDirectWallMembership(event.directWallMembership, current.rules, current.restart.descriptor)
      : requireNoDirectWallMembership(event.directWallMembership);
    const takerPlacement = materializeCssoccerFoulTakerPlacement(
      current.restart.descriptor,
      event.sourceConstant,
    );
    return transition(current, {
      setPiece: deepFreeze({
        ...clone(setPiece),
        phase: "awaiting-position",
        takerPlacement,
        directWallMembership: wall,
        sourceConstantBinding: {
          status: "bound-parent-input",
          symbol: setPiece.sourceConstantBinding.symbol,
          value: event.sourceConstant,
        },
      }),
    });
  }
  if (event.type === "readiness") {
    if (setPiece.phase !== "awaiting-position") {
      throw new Error("rule readiness requires a bound source placement profile.");
    }
    requireExactKeys(
      event,
      ["type", "alreadyThere", "playerOnOff", "allStanding", "support", "holdUpPlay"],
      "rule readiness event",
    );
    requireFlag(event.alreadyThere, "rule readiness alreadyThere");
    requireFlag(event.playerOnOff, "rule readiness playerOnOff");
    requireFlag(event.allStanding, "rule readiness allStanding");
    requireFlag(event.support, "rule readiness support");
    requireIntegerRange(event.holdUpPlay, 0, Number.MAX_SAFE_INTEGER, "rule readiness holdUpPlay");
    const ready = event.holdUpPlay === 0 && (
      (event.playerOnOff === 0 && event.allStanding === 1 && event.alreadyThere === 1)
      || event.support === 1
    );
    const nextSetPiece = {
      ...clone(setPiece),
      phase: ready ? "awaiting-decision" : "awaiting-position",
      readiness: { alreadyThere: event.alreadyThere, support: event.support },
      actionRequest: ready ? {
        type: "request-external-decision",
        nativePlayerNumber: setPiece.taker.nativePlayerNumber,
        allowedActions: clone(setPiece.allowedActions),
      } : null,
    };
    return transition(current, { setPiece: deepFreeze(nextSetPiece) });
  }
  if (event.type === "decision") {
    if (setPiece.phase !== "awaiting-decision") {
      throw new Error("rule decision requires source readiness.");
    }
    const action = requireRuleDecision(event, setPiece, current.rules);
    const released = deepFreeze({
      ...clone(setPiece),
      phase: "released-to-action",
      rules: {
        ...clone(setPiece.rules),
        matchMode: 0,
        deadBallCount: 0,
        gameAction: 0,
      },
      readiness: { alreadyThere: 0, support: 0 },
      actionRequest: action,
    });
    return enterActionPending(current, released, action);
  }
  throw new Error(`Unsupported rule set-piece event ${String(event.type)}.`);
}

function requireRuleDecision(event, setPiece, rules) {
  if (!setPiece.allowedActions.includes(event.action)) {
    throw new CssoccerUnsupportedMatchRulesError(
      "unsupported-rule-launch",
      `${setPiece.kind} restart does not bind the requested ${String(event.action)} launch.`,
      { allowedActions: setPiece.allowedActions },
    );
  }
  if (event.action === "pass") {
    requireExactKeys(event, ["type", "action", "targetPlayerNumber"], "rule pass decision");
    requireIntegerRange(event.targetPlayerNumber, 1, 22, "rule pass targetPlayerNumber");
    const target = rules.discipline.players.find(
      ({ nativePlayerNumber }) => nativePlayerNumber === event.targetPlayerNumber,
    );
    const sameTeam = nativeTeamFor(event.targetPlayerNumber) === setPiece.taker.nativeTeam;
    if (
      !target
      || !sameTeam
      || target.id === setPiece.taker.playerId
      || target.guyOn !== 1
      || !target.ruleEligible
    ) {
      throw new Error("rule pass target must be another active eligible player in the awarded native team.");
    }
    return deepFreeze({
      type: "pass",
      nativePlayerNumber: setPiece.taker.nativePlayerNumber,
      targetPlayerNumber: event.targetPlayerNumber,
      launch: "parent-owned",
    });
  }
  requireExactKeys(event, ["type", "action"], "rule launch decision");
  return deepFreeze({
    type: event.action,
    nativePlayerNumber: setPiece.taker.nativePlayerNumber,
    launch: "parent-owned",
  });
}

function enterActionPending(current, setPiece, action) {
  return transition(current, {
    playState: "dead-ball",
    phase: "action-pending",
    matchMode: 0,
    setPiece,
    pendingAction: clone(action),
  });
}

function requireLaunchReceipt(value, request) {
  requirePlainObject(value, "parent launch receipt");
  const expectedKeys = [
    "schema",
    "type",
    "actionType",
    "nativePlayerNumber",
    "profileHash",
    ...(request.targetPlayerNumber === undefined ? [] : ["targetPlayerNumber"]),
  ];
  requireExactKeys(value, expectedKeys, "parent launch receipt");
  if (
    value.schema !== CSSOCCER_PARENT_LAUNCH_RECEIPT_SCHEMA
    || value.type !== "launch-applied"
    || value.actionType !== request.type
    || value.nativePlayerNumber !== request.nativePlayerNumber
    || value.targetPlayerNumber !== request.targetPlayerNumber
    || !/^[a-f0-9]{64}$/u.test(value.profileHash ?? "")
  ) {
    throw new Error("parent launch receipt does not match the pending source action request.");
  }
  return deepFreeze(clone(value));
}

function requireDirectWallMembership(value, rules, restart) {
  if (value === null || value === undefined) {
    throw new CssoccerUnsupportedMatchRulesError(
      "direct-wall-membership-required",
      "Direct free-kick setup requires explicit source-backed wall membership.",
      { mode: restart.mode },
    );
  }
  requirePlainObject(value, "direct wall membership");
  requireExactKeys(value, ["schema", "profileHash", "members"], "direct wall membership");
  if (
    value.schema !== CSSOCCER_DIRECT_WALL_MEMBERSHIP_SCHEMA
    || !/^[a-f0-9]{64}$/u.test(value.profileHash ?? "")
    || !Array.isArray(value.members)
  ) {
    throw new Error("direct wall membership must bind its schema, profile hash, and members.");
  }
  const ids = new Set();
  const numbers = new Set();
  const defendingTeam = restart.awardedNativeTeam === "A" ? "B" : "A";
  const members = value.members.map((member, index) => {
    requirePlainObject(member, `direct wall member ${index}`);
    requireExactKeys(member, ["playerId", "nativePlayerNumber"], `direct wall member ${index}`);
    requireIntegerRange(member.nativePlayerNumber, 1, 22, "direct wall nativePlayerNumber");
    const mapped = rules.discipline.players.find(({ id }) => id === member.playerId);
    if (
      !mapped
      || mapped.nativePlayerNumber !== member.nativePlayerNumber
      || nativeTeamFor(member.nativePlayerNumber) !== defendingTeam
      || mapped.guyOn !== 1
      || !mapped.ruleEligible
      || ids.has(member.playerId)
      || numbers.has(member.nativePlayerNumber)
    ) {
      throw new Error("direct wall members must be unique active defenders with stable mapped identities.");
    }
    ids.add(member.playerId);
    numbers.add(member.nativePlayerNumber);
    return clone(member);
  });
  return deepFreeze({
    schema: CSSOCCER_DIRECT_WALL_MEMBERSHIP_SCHEMA,
    profileHash: value.profileHash,
    members,
  });
}

function requireNoDirectWallMembership(value) {
  if (value !== null) {
    throw new Error("direct wall membership is accepted only for a direct free kick.");
  }
  return null;
}

function requireRuleSetPiece(value, restart) {
  requirePlainObject(value, "rule set-piece");
  if (
    value.schema !== CSSOCCER_RULE_SET_PIECE_SCHEMA
    || value.kind !== restart.kind
    || value.mode !== restart.mode
    || !["awaiting-source-profile", "awaiting-position", "awaiting-decision"].includes(value.phase)
  ) {
    throw new Error("rule set-piece diverged from its accepted restart descriptor.");
  }
}

function requireRestartWrapper(value) {
  requirePlainObject(value, "restart wrapper");
  if (value.family !== "boundary" && value.family !== "rule") {
    throw new Error("restart family must be boundary or rule.");
  }
  requirePlainObject(value.descriptor, "restart descriptor");
  if (value.family === "rule" && value.descriptor.schema !== "cssoccer-foul-restart@1") {
    throw new Error("rule restart wrapper must contain an accepted foul restart.");
  }
}

function requireOpenIncidentState(state, incomingType) {
  const current = assertCssoccerMatchRulesState(state);
  if (
    current.phase !== "normal-play"
    || current.activeIncident !== null
    || current.rules.foul.playAdvantage !== 0
    || current.rules.lastRestart !== null
    || current.rules.discipline.playerOnOff !== 0
  ) {
    throw new CssoccerUnsupportedMatchRulesError(
      "overlapping-rule-incident",
      `Cannot route ${incomingType} while ${current.phase} owns the rule seam.`,
      { activeIncident: current.activeIncident?.type ?? null },
    );
  }
  return current;
}

function requireNoDismissalTransition(state, operation) {
  if (state.rules.discipline.playerOnOff !== 0) {
    throw new CssoccerUnsupportedMatchRulesError(
      "dismissal-transition-active",
      `${operation} cannot continue until the source dismissal transition completes.`,
      { playerOnOff: state.rules.discipline.playerOnOff },
    );
  }
}

function restartRoster(rules) {
  return rules.discipline.players
    .map(({ nativePlayerNumber, guyOn, ruleEligible }) => ({
      nativePlayerNumber,
      active: guyOn === 1 && ruleEligible ? 1 : 0,
    }))
    .sort((left, right) => left.nativePlayerNumber - right.nativePlayerNumber);
}

function requireNormalShape(state) {
  if (
    state.playState !== "normal"
    || state.matchMode !== 0
    || state.rules.foul.playAdvantage !== 0
    || state.rules.lastRestart !== null
    || state.activeIncident !== null
    || state.boundaryDelay !== null
    || state.restart !== null
    || state.setPiece !== null
    || state.pendingAction !== null
  ) {
    throw new Error("normal-play coordinator state contains an active dead-ball incident.");
  }
}

function requireDeadBallBase(state) {
  if (state.playState !== "dead-ball" || state.activeIncident === null) {
    throw new Error("dead-ball coordinator state requires one active incident.");
  }
}

function transition(state, patch) {
  return deepFreeze({
    ...clone(state),
    ...clone(patch),
    schema: CSSOCCER_MATCH_RULES_SCHEMA,
  });
}

function nativeTeamFor(nativePlayerNumber) {
  return nativePlayerNumber < 12 ? "A" : "B";
}

function requireFlag(value, label) {
  if (value !== 0 && value !== 1) throw new TypeError(`${label} must be 0 or 1.`);
}

function requireIntegerRange(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer in ${minimum}..${maximum}.`);
  }
}

function requireExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} must contain exactly ${wanted.join(", ")}.`);
  }
}

function requirePlainObject(value, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
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
