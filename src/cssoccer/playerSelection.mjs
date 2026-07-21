export const CSSOCCER_PLAYER_SELECTION_SCHEMA = "cssoccer-player-selection@1";
export const CSSOCCER_SELECTION_FRAME_SCHEMA = "cssoccer-player-selection-frame@1";
export const CSSOCCER_RESELECTION_EVENT_SCHEMA = "cssoccer-player-reselection-event@1";
export const CSSOCCER_CONTROL_CLEAR_EVENT_SCHEMA = "cssoccer-control-clear-event@1";
export const CSSOCCER_SET_PIECE_CONTROL_EVENT_SCHEMA = "cssoccer-set-piece-control-event@1";
export const CSSOCCER_HALF_TIME_SLOT_EVENT_SCHEMA = "cssoccer-half-time-slot-event@1";

const FIXTURE_ID = "spain-argentina-full-match";
const USER_NUMBER = 1;
const INITIAL_LOWEST_DISTANCE = Math.fround(2000);

export const CSSOCCER_PLAYER_SELECTION_SOURCE = deepFreeze({
  source: {
    file: "USER.CPP",
    sha256: "d4e9a3bc0192780eadb7a32d766a6f40a63115e5fa3e3a39cf8a6e7849c6e1bc",
    producers: ["auto_select_a", "auto_select_b", "clear_auto"],
  },
  scan: {
    nativeOrder: "ascending native player number",
    initialLowestDistance: INITIAL_LOWEST_DISTANCE,
    comparison: "strict-less-than",
    mainPriority: ["user-taker-2", "receiver", "interceptor", "near-path"],
    mainDistance: Math.fround(1),
  },
  productBoundary: {
    eligible: "all 11 selected-country starters",
    controllable: "10 selected-country outfield players",
    keeper: "AI-owned in general play; source-owned only while an explicit goal-kick taker is bound",
  },
  handoff: {
    input: "all 22 typed control fields from the preceding browser gameplay owner",
    order: "ascending current native player number",
    semantics: "clear the previous user byte before assigning the next user byte",
  },
  reselectionEvents: {
    passBall: {
      source: "INTELL.CPP pass_ball/new_interceptor -> USER.CPP reselect",
      semantics:
        "a completed pass requests both team selectors after source receiver and near-path pointers are updated",
    },
    scheduledPossession: {
      source: "USER.CPP new_users",
      semantics: "ball_travel expiry while normal-play possession is active",
    },
    ballCollected: {
      source: "BALLINT.CPP collect_ball",
      semantics: "a player takes native ball possession",
    },
    freeBallPath: {
      file: "INTELL.CPP",
      sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
      source: "free_ball/go_to_path/reselect_a/reselect_b",
      semantics: "a successful free-ball path claim requests auto-selection",
    },
  },
  setPieceControlEvents: {
    file: "RULES.CPP",
    sha256: "e0e3ebab5f36ec4d60f2ec6f1b4c797661855017c770a6820dc3152ce75a0ef8",
    goalKickAutoUserCleared: {
      source: "init_match_mode/init_gkick -> USER.CPP clear_all_autos/user_taker_a/user_taker_b/clear_auto",
      semantics: "clear the auto user's current player while retaining the selected goal-kick taker",
    },
    goalKickTakerBound: {
      source: "await_set_kick",
      semantics: "bind user_taker to setp_taker after the source reselection gate opens",
    },
  },
  halfTimeSlotEvent: {
    file: "RULES.CPP",
    sha256: "e0e3ebab5f36ec4d60f2ec6f1b4c797661855017c770a6820dc3152ce75a0ef8",
    source: "await_swap -> swap_users/swap_teams -> init_centre",
    semantics:
      "swap the auto user's signed team token and both 11-player native-slot blocks while stable fixture identities persist",
  },
  controlClearEvent: {
    file: "RULES.CPP",
    sha256: "e0e3ebab5f36ec4d60f2ec6f1b4c797661855017c770a6820dc3152ce75a0ef8",
    source: "init_match_mode -> USER.CPP clear_all_autos/clear_auto",
    semantics:
      "every nonzero native match mode clears the auto user's current player before its restart-specific setup",
  },
});

const RESELECTION_EVENT_SOURCE = deepFreeze({
  "pass-ball": "INTELL.CPP pass_ball/new_interceptor -> USER.CPP reselect",
  "scheduled-possession": "USER.CPP new_users",
  "ball-collected": "BALLINT.CPP collect_ball",
  "free-ball-path": "INTELL.CPP free_ball/go_to_path/reselect_a/reselect_b",
});

const SET_PIECE_CONTROL_EVENT_SOURCE = deepFreeze({
  "goal-kick-auto-user-cleared":
    "RULES.CPP init_match_mode/init_gkick -> USER.CPP clear_all_autos/user_taker_a/user_taker_b/clear_auto",
  "goal-kick-taker-bound": "RULES.CPP await_set_kick",
});

const CONTROL_CLEAR_EVENT_SOURCE =
  "RULES.CPP init_match_mode -> USER.CPP clear_all_autos/clear_auto";

const HALF_TIME_SLOT_EVENT_SOURCE =
  "RULES.CPP await_swap -> swap_users/swap_teams -> init_centre";

export class CssoccerUnsupportedSelectionError extends Error {
  constructor(boundary, message) {
    super(message);
    this.name = "CssoccerUnsupportedSelectionError";
    this.code = "CSSOCCER_UNSUPPORTED_SELECTION";
    this.boundary = boundary;
  }
}

/** Bind native auto-selection to the already accepted fixed-fixture team state. */
export function createCssoccerPlayerSelection({ teamState } = {}) {
  const fixture = requireTeamState(teamState);
  return deepFreeze({
    schema: CSSOCCER_PLAYER_SELECTION_SCHEMA,
    fixtureId: FIXTURE_ID,
    selectedCountry: fixture.selectedCountry,
    selectedTeamId: fixture.selectedTeamId,
    currentNativeTeamSlot: fixture.currentNativeTeamSlot,
    eligiblePlayerIds: fixture.eligiblePlayerIds,
    outfieldPlayerIds: fixture.outfieldPlayerIds,
    keeperPlayerId: fixture.keeperPlayerId,
    nativeOrder: fixture.nativeOrder,
    activePlayerId: null,
    controlPhase: "unselected",
    setPieceTakerPlayerId: null,
    tick: -1,
    lastReason: "unselected",
  });
}

/**
 * Rebase the general selector from a preceding source-owned control window.
 * The fields are ordinary browser state; this function never reads evidence.
 * A rules-owned clear_all_autos window legitimately contains no controlled
 * player before the next new_users selection.
 */
export function rebaseCssoccerPlayerSelection(selection, input = {}) {
  assertCssoccerPlayerSelection(selection);
  requirePlainObject(input, "player selection rebase input");
  requireExactKeys(input, ["fields", "tick"], "player selection rebase input");
  const { tick, fields } = input;
  if (selection.tick !== -1 || selection.activePlayerId !== null) {
    throw new Error("Player selection can only rebase from its unstarted state.");
  }
  requireUint32(tick, "player selection rebase tick");
  if (!Array.isArray(fields) || fields.length !== 22) {
    throw new Error("Player selection rebase requires all 22 typed control fields.");
  }
  const order = fixtureNativeOrder(selection);
  const accepted = fields.map((field, index) => (
    requireControlField(field, order[index], tick, `selection rebase field ${index}`)
  ));
  const controlled = accepted.filter(({ value }) => value === USER_NUMBER);
  if (controlled.length > 1) {
    throw new Error("Player selection rebase requires zero or exactly one controlled player.");
  }
  const activePlayerId = controlled.length === 0
    ? null
    : controlled[0].fieldId.slice("players.".length, -".control".length);
  if (activePlayerId !== null && !selection.outfieldPlayerIds.includes(activePlayerId)) {
    throw new Error(
      `Player selection rebase owner ${activePlayerId} must be a ${selection.selectedCountry} outfield player at tick ${tick}.`,
    );
  }
  return deepFreeze({
    ...selection,
    activePlayerId,
    controlPhase: "general-play",
    setPieceTakerPlayerId: null,
    tick,
    lastReason: activePlayerId === null
      ? "rebased-cleared-control-handoff"
      : "rebased-control-handoff",
  });
}

/**
 * Create one exact dynamic frame. Callers must supply source-width values;
 * this module does not derive AI distances, possession, or facing.
 */
export function createCssoccerSelectionFrame(selection, input) {
  assertCssoccerPlayerSelection(selection);
  requirePlainObject(input, "cssoccer selection frame input");
  requireExactKeys(
    input,
    [
      "candidates",
      "interceptorPlayerId",
      "nearPathPlayerId",
      "possessionPlayerId",
      "receiverPlayerId",
      "tick",
      "userTakerPlayerId",
    ],
    "cssoccer selection frame input",
  );
  requireUint32(input.tick, "selection frame tick");
  if (input.tick !== selection.tick + 1) {
    throw new Error(`cssoccer selection frames must be contiguous; expected ${selection.tick + 1}.`);
  }
  if (!Array.isArray(input.candidates) || input.candidates.length !== 11) {
    throw new Error("cssoccer selection frame requires all 11 selected-country candidates.");
  }
  const candidates = input.candidates.map((candidate, index) => (
    requireCandidate(candidate, selection.nativeOrder[index], index)
  ));
  const candidateIds = candidates.map(({ playerId }) => playerId);
  if (!sameValue(candidateIds, selection.nativeOrder.map(({ playerId }) => playerId))) {
    throw new Error("cssoccer selection candidates changed native scan order.");
  }
  const controlledIds = candidates
    .filter(({ controlUser }) => controlUser === USER_NUMBER)
    .map(({ playerId }) => playerId);
  const expectedControlledIds = selection.activePlayerId === null
    ? []
    : [selection.activePlayerId];
  if (!sameValue(controlledIds, expectedControlledIds)) {
    throw new Error("cssoccer dynamic control ownership diverged from the active auto-selected player.");
  }

  return deepFreeze({
    schema: CSSOCCER_SELECTION_FRAME_SCHEMA,
    tick: input.tick,
    candidates,
    possessionPlayerId: requireFixturePlayerIdOrNull(
      input.possessionPlayerId,
      "selection possession player",
    ),
    receiverPlayerId: requireEligiblePointer(
      input.receiverPlayerId,
      selection,
      "selection receiver",
    ),
    interceptorPlayerId: requireEligiblePointer(
      input.interceptorPlayerId,
      selection,
      "selection interceptor",
    ),
    nearPathPlayerId: requireEligiblePointer(
      input.nearPathPlayerId,
      selection,
      "selection near-path player",
    ),
    userTakerPlayerId: requireEligiblePointer(
      input.userTakerPlayerId,
      selection,
      "selection user taker",
    ),
  });
}

/**
 * Bind one source-owned request to the selector without deriving it from
 * rendered state. A free-ball claim carries the exact native path owner.
 */
export function createCssoccerReselectionEvent(selection, input = {}) {
  assertCssoccerPlayerSelection(selection);
  requirePlainObject(input, "cssoccer reselection event input");
  requireExactKeys(
    input,
    ["kind", "pathPlayerId", "tick"],
    "cssoccer reselection event input",
  );
  requireUint32(input.tick, "reselection event tick");
  if (input.tick !== selection.tick + 1) {
    throw new Error(`cssoccer reselection events must be contiguous; expected ${selection.tick + 1}.`);
  }
  if (!Object.hasOwn(RESELECTION_EVENT_SOURCE, input.kind)) {
    throw new Error("cssoccer reselection event kind is unsupported.");
  }
  const requiresPath = input.kind === "free-ball-path";
  if (requiresPath) {
    if (!selection.eligiblePlayerIds.includes(input.pathPlayerId)) {
      throw new Error("Free-ball reselection path owner must be an eligible selected-country player.");
    }
  } else if (input.pathPlayerId !== null) {
    throw new Error(`${input.kind} reselection cannot invent a free-ball path owner.`);
  }
  const nativeEntry = requiresPath
    ? selection.nativeOrder.find(({ playerId }) => playerId === input.pathPlayerId)
    : null;
  return deepFreeze({
    schema: CSSOCCER_RESELECTION_EVENT_SCHEMA,
    kind: input.kind,
    producer: RESELECTION_EVENT_SOURCE[input.kind],
    tick: input.tick,
    pathPlayerId: input.pathPlayerId,
    pathNativePlayer: nativeEntry === null
      ? null
      : {
          fieldId: "selection.free_ball_path.native_player",
          valueType: "u8",
          value: nativeEntry.nativePlayerNumber,
          numericBits: nativeEntry.nativePlayerNumber.toString(16).padStart(2, "0"),
        },
  });
}

/** Bind RULES.CPP's unconditional auto-user clear at nonzero match-mode setup. */
export function createCssoccerControlClearEvent(selection, input = {}) {
  assertCssoccerPlayerSelection(selection);
  requirePlainObject(input, "cssoccer control-clear event input");
  requireExactKeys(input, ["matchMode", "tick"], "cssoccer control-clear event input");
  requireUint32(input.tick, "control-clear event tick");
  if (input.tick !== selection.tick + 1) {
    throw new Error(`cssoccer control-clear events must be contiguous; expected ${selection.tick + 1}.`);
  }
  requireUint8(input.matchMode, "control-clear match mode");
  if (input.matchMode === 0) {
    throw new Error("cssoccer control-clear events require a nonzero native match mode.");
  }
  return deepFreeze({
    schema: CSSOCCER_CONTROL_CLEAR_EVENT_SCHEMA,
    kind: "match-mode-auto-users-cleared",
    producer: CONTROL_CLEAR_EVENT_SOURCE,
    tick: input.tick,
    matchMode: {
      fieldId: "rules.match_mode",
      valueType: "u8",
      value: input.matchMode,
      numericBits: input.matchMode.toString(16).padStart(2, "0"),
    },
  });
}

/** Bind one source-owned goal-kick control write to its exact native taker. */
export function createCssoccerSetPieceControlEvent(selection, input = {}) {
  assertCssoccerPlayerSelection(selection);
  requirePlainObject(input, "cssoccer set-piece control event input");
  requireExactKeys(
    input,
    ["kind", "takerPlayerId", "tick"],
    "cssoccer set-piece control event input",
  );
  requireUint32(input.tick, "set-piece control event tick");
  if (input.tick !== selection.tick + 1) {
    throw new Error(`cssoccer set-piece control events must be contiguous; expected ${selection.tick + 1}.`);
  }
  if (!Object.hasOwn(SET_PIECE_CONTROL_EVENT_SOURCE, input.kind)) {
    throw new Error("cssoccer set-piece control event kind is unsupported.");
  }
  if (!selection.eligiblePlayerIds.includes(input.takerPlayerId)) {
    throw new Error("Goal-kick taker must be an eligible selected-country player.");
  }
  const nativeEntry = selection.nativeOrder.find(
    ({ playerId }) => playerId === input.takerPlayerId,
  );
  return deepFreeze({
    schema: CSSOCCER_SET_PIECE_CONTROL_EVENT_SCHEMA,
    kind: input.kind,
    producer: SET_PIECE_CONTROL_EVENT_SOURCE[input.kind],
    tick: input.tick,
    takerPlayerId: input.takerPlayerId,
    takerNativePlayer: {
      fieldId: "selection.goal_kick_taker.native_player",
      valueType: "i32",
      value: nativeEntry.nativePlayerNumber,
      numericBits: nativeEntry.nativePlayerNumber.toString(16).padStart(8, "0"),
    },
  });
}

/** Create the one source-owned normal-time native-slot remap. */
export function createCssoccerHalfTimeSlotEvent(selection, input = {}) {
  assertCssoccerPlayerSelection(selection);
  requirePlainObject(input, "cssoccer half-time slot event input");
  requireExactKeys(input, ["tick"], "cssoccer half-time slot event input");
  requireUint32(input.tick, "half-time slot event tick");
  if (input.tick !== selection.tick + 1) {
    throw new Error(`cssoccer half-time slot events must be contiguous; expected ${selection.tick + 1}.`);
  }
  const kickoffSlot = selection.selectedCountry === "spain" ? "A" : "B";
  if (selection.currentNativeTeamSlot !== kickoffSlot) {
    throw new Error("cssoccer selected country has already applied its normal-time native-slot swap.");
  }
  const fromNativeTeamSlot = selection.currentNativeTeamSlot;
  const toNativeTeamSlot = oppositeTeamSlot(fromNativeTeamSlot);
  const beforeUserType = userTypeForSlot(fromNativeTeamSlot);
  const afterUserType = userTypeForSlot(toNativeTeamSlot);
  const beforeOrder = nativeOrderForSlot(selection.eligiblePlayerIds, fromNativeTeamSlot);
  const afterOrder = nativeOrderForSlot(selection.eligiblePlayerIds, toNativeTeamSlot);
  return deepFreeze({
    schema: CSSOCCER_HALF_TIME_SLOT_EVENT_SCHEMA,
    kind: "half-time-native-slot-swap",
    producer: HALF_TIME_SLOT_EVENT_SOURCE,
    tick: input.tick,
    selectedCountry: selection.selectedCountry,
    fromNativeTeamSlot,
    toNativeTeamSlot,
    autoUserTypeBefore: typedInt16(
      "selection.auto_user.type.before_half_time_swap",
      beforeUserType,
    ),
    autoUserTypeAfter: typedInt16(
      "selection.auto_user.type.after_half_time_swap",
      afterUserType,
    ),
    matchHalfAfter: {
      fieldId: "clock.match_half",
      valueType: "u8",
      value: 1,
      numericBits: "01",
    },
    playerRemap: beforeOrder.map((before, index) => ({
      playerId: before.playerId,
      nativePlayerBefore: typedInt16(
        `players.${before.playerId}.native_player.before_half_time_swap`,
        before.nativePlayerNumber,
      ),
      nativePlayerAfter: typedInt16(
        `players.${before.playerId}.native_player.after_half_time_swap`,
        afterOrder[index].nativePlayerNumber,
      ),
    })),
  });
}

/** Apply USER.CPP auto_select_a/auto_select_b without keeper ownership. */
export function selectCssoccerPlayer(selection, frame) {
  assertCssoccerPlayerSelection(selection);
  assertCssoccerSelectionFrame(frame, selection);
  if (frame.userTakerPlayerId === selection.keeperPlayerId) {
    throw new CssoccerUnsupportedSelectionError(
      "temporary-user-goal-kick-keeper",
      "Native user_taker2 keeper control is outside the outfield-only product contract.",
    );
  }

  const candidates = new Map(frame.candidates.map((candidate) => [candidate.playerId, candidate]));
  const currentId = selection.activePlayerId;
  const current = currentId === null ? null : candidates.get(currentId);
  let nextId = currentId;
  let selected = false;
  let reason = currentId === null ? "no-candidate" : "held-selection-circle";

  if (
    current !== null
    && frame.possessionPlayerId === currentId
    && current.controlUser === USER_NUMBER
  ) {
    reason = "held-current-possessor";
  } else {
    const possessor = candidates.get(frame.possessionPlayerId);
    if (
      possessor !== undefined
      && possessor.playerId !== selection.keeperPlayerId
      && possessor.controlUser === 0
    ) {
      nextId = possessor.playerId;
      selected = nextId !== currentId;
      reason = "uncontrolled-team-possessor";
    } else {
      const mainPlayerId = firstPresent([
        frame.userTakerPlayerId,
        frame.receiverPlayerId,
        frame.interceptorPlayerId,
        frame.nearPathPlayerId,
      ]);
      let lowest = INITIAL_LOWEST_DISTANCE;
      let closestId = null;
      for (const entry of selection.nativeOrder) {
        const candidate = candidates.get(entry.playerId);
        if (
          candidate.playerId === selection.keeperPlayerId
          || candidate.on <= 0
          || ![0, USER_NUMBER].includes(candidate.controlUser)
          || candidate.falling
        ) {
          continue;
        }
        const distance = candidate.playerId === mainPlayerId
          ? Math.fround(1)
          : candidate.distance;
        if (distance < lowest) {
          closestId = candidate.playerId;
          lowest = distance;
        }
      }

      if (closestId === null) {
        reason = currentId === null ? "no-candidate" : "held-no-candidate";
      } else if (closestId === currentId) {
        reason = "held-closest";
      } else {
        const maySwitch = current === null
          || !current.selectionCircle
          || frame.receiverPlayerId !== null;
        if (maySwitch) {
          nextId = closestId;
          selected = true;
          reason = closestId === mainPlayerId ? "main-priority" : "closest-distance";
        }
      }
    }
  }

  const heldGoalKickTaker = nextId === selection.keeperPlayerId
    && currentId === selection.keeperPlayerId
    && selection.controlPhase === "goal-kick-taker"
    && selection.setPieceTakerPlayerId === selection.keeperPlayerId;
  if (nextId === selection.keeperPlayerId && !heldGoalKickTaker) {
    throw new Error(
      `cssoccer outfield auto-selection attempted to own the keeper at tick ${frame.tick}.`,
    );
  }
  const state = deepFreeze({
    ...selection,
    activePlayerId: nextId,
    controlPhase: heldGoalKickTaker ? "goal-kick-taker" : "general-play",
    setPieceTakerPlayerId: heldGoalKickTaker
      ? selection.setPieceTakerPlayerId
      : null,
    tick: frame.tick,
    lastReason: reason,
  });
  return deepFreeze({
    state,
    result: {
      tick: frame.tick,
      previousPlayerId: currentId,
      activePlayerId: nextId,
      selected,
      reason,
    },
  });
}

/**
 * Advance one contiguous gameplay tick. The caller owns the typed source event
 * that requests reselect; this reducer owns auto_select_a/auto_select_b only.
 */
export function advanceCssoccerPlayerSelection(selection, input = {}) {
  assertCssoccerPlayerSelection(selection);
  requirePlainObject(input, "player selection advance input");
  requireExactKeys(
    input,
    ["frame", "reselectionEvent"],
    "player selection advance input",
  );
  const { frame, reselectionEvent } = input;
  assertCssoccerSelectionFrame(frame, selection);

  if (reselectionEvent === null) {
    const state = deepFreeze({
      ...selection,
      controlPhase: selection.controlPhase === "unselected"
        ? "general-play"
        : selection.controlPhase,
      tick: frame.tick,
      lastReason: "held-no-reselection",
    });
    return deepFreeze({
      state,
      result: {
        tick: frame.tick,
        previousPlayerId: selection.activePlayerId,
        activePlayerId: selection.activePlayerId,
        selected: false,
        reason: "held-no-reselection",
        reselectionRequested: false,
        reselectionEventKind: null,
        controlWrites: [],
      },
    });
  }

  assertCssoccerReselectionEvent(reselectionEvent, selection);
  if (reselectionEvent.tick !== frame.tick) {
    throw new Error("Player reselection event and dynamic frame ticks diverged.");
  }
  if (
    reselectionEvent.kind === "free-ball-path"
    && (
      frame.interceptorPlayerId !== reselectionEvent.pathPlayerId
      || frame.nearPathPlayerId !== reselectionEvent.pathPlayerId
    )
  ) {
    throw new Error("Free-ball path event diverged from the source-owned path pointers.");
  }

  const selected = selectCssoccerPlayer(selection, frame);
  return deepFreeze({
    state: selected.state,
    result: {
      ...selected.result,
      reselectionRequested: true,
      reselectionEventKind: reselectionEvent.kind,
      controlWrites: controlWrites(selection, selected.state),
    },
  });
}

/** Apply the rules-owned clear before centre, set-piece, swap, or terminal setup. */
export function applyCssoccerControlClearEvent(selection, input = {}) {
  assertCssoccerPlayerSelection(selection);
  requirePlainObject(input, "control-clear advance input");
  requireExactKeys(input, ["event", "frame"], "control-clear advance input");
  const { event, frame } = input;
  assertCssoccerSelectionFrame(frame, selection);
  assertCssoccerControlClearEvent(event, selection);
  if (event.tick !== frame.tick) {
    throw new Error("Control-clear event and dynamic frame ticks diverged.");
  }
  const state = deepFreeze({
    ...selection,
    activePlayerId: null,
    controlPhase: "general-play",
    setPieceTakerPlayerId: null,
    tick: frame.tick,
    lastReason: event.kind,
  });
  return deepFreeze({
    state,
    result: {
      tick: frame.tick,
      previousPlayerId: selection.activePlayerId,
      activePlayerId: null,
      selected: selection.activePlayerId !== null,
      reason: event.kind,
      matchMode: event.matchMode,
      controlWrites: controlWrites(selection, state),
    },
  });
}

/** Apply the explicit clear/bind writes owned by native goal-kick setup. */
export function applyCssoccerSetPieceControlEvent(selection, input = {}) {
  assertCssoccerPlayerSelection(selection);
  requirePlainObject(input, "set-piece control advance input");
  requireExactKeys(input, ["event", "frame"], "set-piece control advance input");
  const { event, frame } = input;
  assertCssoccerSelectionFrame(frame, selection);
  assertCssoccerSetPieceControlEvent(event, selection);
  if (event.tick !== frame.tick) {
    throw new Error("Set-piece control event and dynamic frame ticks diverged.");
  }

  let state;
  if (event.kind === "goal-kick-auto-user-cleared") {
    if (selection.controlPhase !== "general-play" || selection.activePlayerId === null) {
      throw new Error("Goal-kick auto-user clear requires one general-play control owner.");
    }
    state = deepFreeze({
      ...selection,
      activePlayerId: null,
      controlPhase: "goal-kick-cleared",
      setPieceTakerPlayerId: event.takerPlayerId,
      tick: frame.tick,
      lastReason: "goal-kick-auto-user-cleared",
    });
  } else {
    if (
      selection.controlPhase !== "goal-kick-cleared"
      || selection.activePlayerId !== null
      || selection.setPieceTakerPlayerId !== event.takerPlayerId
    ) {
      throw new Error("Goal-kick taker bind requires the matching cleared set-piece taker.");
    }
    state = deepFreeze({
      ...selection,
      activePlayerId: event.takerPlayerId,
      controlPhase: "goal-kick-taker",
      tick: frame.tick,
      lastReason: "goal-kick-taker-bound",
    });
  }

  return deepFreeze({
    state,
    result: {
      tick: frame.tick,
      previousPlayerId: selection.activePlayerId,
      activePlayerId: state.activePlayerId,
      selected: state.activePlayerId !== selection.activePlayerId,
      reason: state.lastReason,
      setPieceControlEventKind: event.kind,
      controlWrites: controlWrites(selection, state),
    },
  });
}

/** Apply RULES.CPP's one stable-identity-preserving half-time slot swap. */
export function applyCssoccerHalfTimeSlotEvent(selection, input = {}) {
  assertCssoccerPlayerSelection(selection);
  requirePlainObject(input, "half-time slot advance input");
  requireExactKeys(input, ["event"], "half-time slot advance input");
  const event = assertCssoccerHalfTimeSlotEvent(input.event, selection);
  if (selection.activePlayerId !== null) {
    throw new Error("Half-time native-slot remap requires source-cleared auto-user control.");
  }
  const state = deepFreeze({
    ...selection,
    currentNativeTeamSlot: event.toNativeTeamSlot,
    nativeOrder: nativeOrderForSlot(
      selection.eligiblePlayerIds,
      event.toNativeTeamSlot,
    ),
    controlPhase: "general-play",
    setPieceTakerPlayerId: null,
    tick: event.tick,
    lastReason: "half-time-native-slot-swap",
  });
  return deepFreeze({
    state,
    result: {
      tick: event.tick,
      kind: event.kind,
      previousNativeTeamSlot: event.fromNativeTeamSlot,
      currentNativeTeamSlot: event.toNativeTeamSlot,
      playerRemap: event.playerRemap,
      controlWrites: [],
    },
  });
}

export function assertCssoccerReselectionEvent(event, selection) {
  assertCssoccerPlayerSelection(selection);
  requirePlainObject(event, "cssoccer reselection event");
  requireExactKeys(
    event,
    ["kind", "pathNativePlayer", "pathPlayerId", "producer", "schema", "tick"],
    "cssoccer reselection event",
  );
  if (event.schema !== CSSOCCER_RESELECTION_EVENT_SCHEMA) {
    throw new Error(`cssoccer reselection event must use ${CSSOCCER_RESELECTION_EVENT_SCHEMA}.`);
  }
  const recreated = createCssoccerReselectionEvent(selection, {
    kind: event.kind,
    pathPlayerId: event.pathPlayerId,
    tick: event.tick,
  });
  if (!sameValue(event, recreated)) throw new Error("cssoccer reselection event is corrupt.");
  return event;
}

export function assertCssoccerControlClearEvent(event, selection) {
  assertCssoccerPlayerSelection(selection);
  requirePlainObject(event, "cssoccer control-clear event");
  requireExactKeys(
    event,
    ["kind", "matchMode", "producer", "schema", "tick"],
    "cssoccer control-clear event",
  );
  if (
    event.schema !== CSSOCCER_CONTROL_CLEAR_EVENT_SCHEMA
    || event.kind !== "match-mode-auto-users-cleared"
  ) {
    throw new Error(`cssoccer control-clear event must use ${CSSOCCER_CONTROL_CLEAR_EVENT_SCHEMA}.`);
  }
  const recreated = createCssoccerControlClearEvent(selection, {
    tick: event.tick,
    matchMode: event.matchMode?.value,
  });
  if (!sameValue(event, recreated)) throw new Error("cssoccer control-clear event is corrupt.");
  return event;
}

export function assertCssoccerSetPieceControlEvent(event, selection) {
  assertCssoccerPlayerSelection(selection);
  requirePlainObject(event, "cssoccer set-piece control event");
  requireExactKeys(
    event,
    ["kind", "producer", "schema", "takerNativePlayer", "takerPlayerId", "tick"],
    "cssoccer set-piece control event",
  );
  if (event.schema !== CSSOCCER_SET_PIECE_CONTROL_EVENT_SCHEMA) {
    throw new Error(
      `cssoccer set-piece control event must use ${CSSOCCER_SET_PIECE_CONTROL_EVENT_SCHEMA}.`,
    );
  }
  const recreated = createCssoccerSetPieceControlEvent(selection, {
    kind: event.kind,
    takerPlayerId: event.takerPlayerId,
    tick: event.tick,
  });
  if (!sameValue(event, recreated)) throw new Error("cssoccer set-piece control event is corrupt.");
  return event;
}

export function assertCssoccerHalfTimeSlotEvent(event, selection) {
  assertCssoccerPlayerSelection(selection);
  requirePlainObject(event, "cssoccer half-time slot event");
  requireExactKeys(
    event,
    [
      "autoUserTypeAfter",
      "autoUserTypeBefore",
      "fromNativeTeamSlot",
      "kind",
      "matchHalfAfter",
      "playerRemap",
      "producer",
      "schema",
      "selectedCountry",
      "tick",
      "toNativeTeamSlot",
    ],
    "cssoccer half-time slot event",
  );
  if (event.schema !== CSSOCCER_HALF_TIME_SLOT_EVENT_SCHEMA) {
    throw new Error(`cssoccer half-time slot event must use ${CSSOCCER_HALF_TIME_SLOT_EVENT_SCHEMA}.`);
  }
  const recreated = createCssoccerHalfTimeSlotEvent(selection, { tick: event.tick });
  if (!sameValue(event, recreated)) throw new Error("cssoccer half-time slot event is corrupt.");
  return event;
}

/** Project the selector's all-22 u8 control bytes in current native order. */
export function projectCssoccerPlayerSelectionNativeFields(selection) {
  assertCssoccerPlayerSelection(selection);
  requireUint32(selection.tick, "player selection projection tick");
  return deepFreeze(fixtureNativeOrder(selection).map((entry) => (
    typedControlField(
      selection.tick,
      entry.playerId,
      entry.playerId === selection.activePlayerId ? USER_NUMBER : 0,
    )
  )));
}

export function assertCssoccerPlayerSelection(selection) {
  requirePlainObject(selection, "cssoccer player selection");
  requireExactKeys(
    selection,
    [
      "activePlayerId",
      "controlPhase",
      "currentNativeTeamSlot",
      "eligiblePlayerIds",
      "fixtureId",
      "keeperPlayerId",
      "lastReason",
      "nativeOrder",
      "outfieldPlayerIds",
      "schema",
      "selectedCountry",
      "selectedTeamId",
      "setPieceTakerPlayerId",
      "tick",
    ],
    "cssoccer player selection",
  );
  if (
    selection.schema !== CSSOCCER_PLAYER_SELECTION_SCHEMA
    || selection.fixtureId !== FIXTURE_ID
    || !["spain", "argentina"].includes(selection.selectedCountry)
    || selection.selectedTeamId !== `team-${selection.selectedCountry}`
    || !["A", "B"].includes(selection.currentNativeTeamSlot)
    || !Number.isInteger(selection.tick)
    || selection.tick < -1
    || ![
      "unselected",
      "general-play",
      "goal-kick-cleared",
      "goal-kick-taker",
    ].includes(selection.controlPhase)
    || typeof selection.lastReason !== "string"
  ) {
    throw new Error(`cssoccer player selection must use ${CSSOCCER_PLAYER_SELECTION_SCHEMA}.`);
  }
  const expectedIds = playerIds(selection.selectedCountry);
  if (
    !sameValue(selection.eligiblePlayerIds, expectedIds)
    || selection.keeperPlayerId !== expectedIds[0]
    || !sameValue(selection.outfieldPlayerIds, expectedIds.slice(1))
    || !Array.isArray(selection.nativeOrder)
    || selection.nativeOrder.length !== 11
  ) {
    throw new Error("cssoccer player selection changed its exact selected-country roster.");
  }
  const nativeNumbers = selection.nativeOrder.map((entry, index) => {
    requirePlainObject(entry, `cssoccer native order ${index}`);
    requireExactKeys(entry, ["nativePlayerNumber", "playerId"], `cssoccer native order ${index}`);
    if (!expectedIds.includes(entry.playerId)) throw new Error("cssoccer native order has an ineligible player.");
    requireNativePlayerNumber(entry.nativePlayerNumber, "selection native player number");
    return entry.nativePlayerNumber;
  });
  if (
    new Set(nativeNumbers).size !== 11
    || nativeNumbers.some((value, index) => index > 0 && value <= nativeNumbers[index - 1])
    || !sameValue(
      selection.nativeOrder,
      nativeOrderForSlot(selection.eligiblePlayerIds, selection.currentNativeTeamSlot),
    )
  ) {
    throw new Error("cssoccer selection native order must be unique and ascending.");
  }
  const validGeneralOwner = selection.activePlayerId === null
    || selection.outfieldPlayerIds.includes(selection.activePlayerId);
  if (selection.controlPhase === "unselected") {
    if (
      selection.tick !== -1
      || selection.activePlayerId !== null
      || selection.setPieceTakerPlayerId !== null
    ) {
      throw new Error("cssoccer unselected control phase changed its initial ownership.");
    }
  } else if (selection.controlPhase === "general-play") {
    if (!validGeneralOwner || selection.setPieceTakerPlayerId !== null) {
      throw new Error("cssoccer general-play owner must be null or a selected-country outfield player.");
    }
  } else if (selection.controlPhase === "goal-kick-cleared") {
    if (
      selection.activePlayerId !== null
      || !selection.eligiblePlayerIds.includes(selection.setPieceTakerPlayerId)
    ) {
      throw new Error("cssoccer cleared goal-kick phase requires its selected-country taker.");
    }
  } else if (
    selection.activePlayerId !== selection.setPieceTakerPlayerId
    || !selection.eligiblePlayerIds.includes(selection.activePlayerId)
  ) {
    throw new Error("cssoccer goal-kick taker phase requires the bound selected-country taker.");
  }
  return selection;
}

export function assertCssoccerSelectionFrame(frame, selection) {
  assertCssoccerPlayerSelection(selection);
  requirePlainObject(frame, "cssoccer selection frame");
  if (frame.schema !== CSSOCCER_SELECTION_FRAME_SCHEMA) {
    throw new Error(`cssoccer selection frame must use ${CSSOCCER_SELECTION_FRAME_SCHEMA}.`);
  }
  const recreated = createCssoccerSelectionFrame(selection, {
    tick: frame.tick,
    candidates: frame.candidates,
    possessionPlayerId: frame.possessionPlayerId,
    receiverPlayerId: frame.receiverPlayerId,
    interceptorPlayerId: frame.interceptorPlayerId,
    nearPathPlayerId: frame.nearPathPlayerId,
    userTakerPlayerId: frame.userTakerPlayerId,
  });
  if (!sameValue(frame, recreated)) throw new Error("cssoccer selection frame is corrupt.");
  return frame;
}

function requireTeamState(state) {
  requirePlainObject(state, "cssoccer team state");
  if (
    state.schema !== "cssoccer-team-state@1"
    || state.fixtureId !== FIXTURE_ID
    || !Array.isArray(state.players)
    || state.players.length !== 22
  ) {
    throw new Error("Player selection requires the exact fixed-fixture team state.");
  }
  const control = state.control;
  requirePlainObject(control, "cssoccer team-state control");
  const selectedCountry = control.selectedCountry;
  const expectedIds = playerIds(selectedCountry);
  if (
    !["spain", "argentina"].includes(selectedCountry)
    || control.selectedTeamId !== `team-${selectedCountry}`
    || control.mode !== "auto-player"
    || control.users !== 1
    || control.autoPlayer !== -1
    || control.activePlayerId !== null
    || !sameValue(control.eligiblePlayerIds, expectedIds)
    || !["A", "B"].includes(control.currentNativeTeamSlot)
  ) {
    throw new Error("Player selection requires the accepted auto-player country choice.");
  }
  const selectedPlayers = state.players.filter(({ country }) => country === selectedCountry);
  if (selectedPlayers.length !== 11) {
    throw new Error("Player selection requires exactly 11 selected-country players.");
  }
  const byId = new Map(selectedPlayers.map((player) => [player.id, player]));
  if (byId.size !== 11 || expectedIds.some((id) => !byId.has(id))) {
    throw new Error("Player selection team state changed selected-country player ids.");
  }
  const nativeOrder = expectedIds.map((id, sourceRosterIndex) => {
    const player = byId.get(id);
    if (
      player.identity?.sourceRosterIndex !== sourceRosterIndex
      || player.current?.nativeTeamSlot !== control.currentNativeTeamSlot
    ) {
      throw new Error(`Player selection team binding changed for ${id}.`);
    }
    requireNativePlayerNumber(player.current.nativePlayerNumber, `${id} native player number`);
    return { playerId: id, nativePlayerNumber: player.current.nativePlayerNumber };
  }).sort((left, right) => left.nativePlayerNumber - right.nativePlayerNumber);
  return {
    selectedCountry,
    selectedTeamId: control.selectedTeamId,
    currentNativeTeamSlot: control.currentNativeTeamSlot,
    eligiblePlayerIds: expectedIds,
    outfieldPlayerIds: expectedIds.slice(1),
    keeperPlayerId: expectedIds[0],
    nativeOrder,
  };
}

function requireCandidate(candidate, expected, index) {
  requirePlainObject(candidate, `selection candidate ${index}`);
  requireExactKeys(
    candidate,
    [
      "actionId",
      "controlUser",
      "distance",
      "facingX",
      "facingY",
      "falling",
      "on",
      "playerId",
      "selectionCircle",
    ],
    `selection candidate ${index}`,
  );
  if (candidate.playerId !== expected.playerId) {
    throw new Error(`selection candidate ${index} changed ascending native player order.`);
  }
  requireInt16(candidate.on, `${candidate.playerId} on`);
  requireInt16(candidate.controlUser, `${candidate.playerId} control user`);
  if (![0, USER_NUMBER].includes(candidate.controlUser)) {
    throw new RangeError(`${candidate.playerId} control user must be 0 or ${USER_NUMBER}.`);
  }
  requireInt16(candidate.actionId, `${candidate.playerId} action id`);
  requireF32(candidate.distance, `${candidate.playerId} distance`);
  if (candidate.distance < 0) throw new RangeError(`${candidate.playerId} distance must be non-negative.`);
  requireF32(candidate.facingX, `${candidate.playerId} facing x`);
  requireF32(candidate.facingY, `${candidate.playerId} facing y`);
  if (typeof candidate.falling !== "boolean" || typeof candidate.selectionCircle !== "boolean") {
    throw new TypeError(`${candidate.playerId} falling and selectionCircle must be boolean.`);
  }
  return { ...candidate };
}

function requireControlField(field, expected, tick, label) {
  requirePlainObject(field, label);
  requireExactKeys(
    field,
    [
      "fieldId",
      "numericBits",
      "phase",
      "recordType",
      "schema",
      "tick",
      "value",
      "valueType",
    ],
    label,
  );
  const expectedField = typedControlField(tick, expected.playerId, field.value);
  if (
    field.valueType !== expectedField.valueType
    || field.value !== expectedField.value
    || field.numericBits !== expectedField.numericBits
  ) {
    throw new Error(`${label} changed its exact u8 type, value, or bits.`);
  }
  if (!sameValue(field, expectedField)) {
    throw new Error(
      `${label} changed native order or stable identity: expected ${expectedField.fieldId} at native ${expected.nativePlayerNumber}, got ${String(field.fieldId)} at tick ${tick}.`,
    );
  }
  return field;
}

function typedControlField(tick, playerId, value) {
  requireUint32(tick, "typed control tick");
  if (![0, USER_NUMBER].includes(value)) {
    throw new TypeError(`Control for ${playerId} must be exact u8 zero or ${USER_NUMBER}.`);
  }
  return deepFreeze({
    schema: "cssoccer-parity-stream@1",
    recordType: "sample",
    tick,
    phase: "post_tick",
    fieldId: `players.${playerId}.control`,
    valueType: "u8",
    value,
    numericBits: value.toString(16).padStart(2, "0"),
  });
}

function controlWrites(previous, next) {
  if (previous.activePlayerId === next.activePlayerId) return [];
  const writes = [];
  if (previous.activePlayerId !== null) {
    writes.push({
      operation: "clear",
      field: typedControlField(next.tick, previous.activePlayerId, 0),
    });
  }
  if (next.activePlayerId !== null) {
    writes.push({
      operation: "assign",
      field: typedControlField(next.tick, next.activePlayerId, USER_NUMBER),
    });
  }
  return writes;
}

function fixtureNativeOrder(selection) {
  const opponentCountry = selection.selectedCountry === "spain" ? "argentina" : "spain";
  const bySlot = selection.currentNativeTeamSlot === "A"
    ? { A: selection.selectedCountry, B: opponentCountry }
    : { A: opponentCountry, B: selection.selectedCountry };
  return Array.from({ length: 22 }, (_, index) => {
    const nativePlayerNumber = index + 1;
    const nativeSlot = nativePlayerNumber <= 11 ? "A" : "B";
    const fixturePlayerNumber = ((nativePlayerNumber - 1) % 11) + 1;
    return {
      nativePlayerNumber,
      playerId: `${bySlot[nativeSlot]}-player-${String(fixturePlayerNumber).padStart(2, "0")}`,
    };
  });
}

function nativeOrderForSlot(playerIdsInFixtureOrder, nativeTeamSlot) {
  const firstNativePlayer = nativeTeamSlot === "A" ? 1 : 12;
  return playerIdsInFixtureOrder.map((playerId, index) => ({
    playerId,
    nativePlayerNumber: firstNativePlayer + index,
  }));
}

function oppositeTeamSlot(nativeTeamSlot) {
  return nativeTeamSlot === "A" ? "B" : "A";
}

function userTypeForSlot(nativeTeamSlot) {
  return nativeTeamSlot === "A" ? -1 : -2;
}

function typedInt16(fieldId, value) {
  requireInt16(value, fieldId);
  return {
    fieldId,
    valueType: "i16",
    value,
    numericBits: (value & 0xffff).toString(16).padStart(4, "0"),
  };
}

function requireEligiblePointer(value, selection, label) {
  if (value !== null && !selection.eligiblePlayerIds.includes(value)) {
    throw new Error(`${label} must be null or one of the selected country's 11 players.`);
  }
  return value;
}

function requireFixturePlayerIdOrNull(value, label) {
  if (value !== null && !/^(spain|argentina)-player-(0[1-9]|1[01])$/u.test(value ?? "")) {
    throw new Error(`${label} must be null or one of the fixed fixture's 22 players.`);
  }
  return value;
}

function playerIds(country) {
  if (!["spain", "argentina"].includes(country)) return [];
  return Array.from({ length: 11 }, (_, index) => (
    `${country}-player-${String(index + 1).padStart(2, "0")}`
  ));
}

function firstPresent(values) {
  return values.find((value) => value !== null) ?? null;
}

function requireNativePlayerNumber(value, label) {
  if (!Number.isInteger(value) || value < 1 || value > 22) {
    throw new TypeError(`${label} must be an exact native player number.`);
  }
}

function requireInt16(value, label) {
  if (!Number.isInteger(value) || value < -32768 || value > 32767) {
    throw new TypeError(`${label} must be an exact int16.`);
  }
}

function requireUint8(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new TypeError(`${label} must be an exact uint8.`);
  }
}

function requireUint32(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new TypeError(`${label} must be an exact uint32.`);
  }
}

function requireF32(value, label) {
  if (!Number.isFinite(value) || !Object.is(Math.fround(value), value)) {
    throw new TypeError(`${label} must be an exact finite float32.`);
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

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
