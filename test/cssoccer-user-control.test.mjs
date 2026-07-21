import assert from "node:assert/strict";
import {
  createReadStream,
  existsSync,
  readFileSync,
} from "node:fs";
import { createInterface } from "node:readline";
import test from "node:test";

import {
  CSSOCCER_NATIVE_ACTIONS,
  CssoccerUnsupportedActionError,
  applyCssoccerResolvedActionTransition,
  createCssoccerActionResolution,
  createCssoccerActionState,
  resolveCssoccerUserAction,
} from "../src/cssoccer/actionState.mjs";
import {
  CSSOCCER_INPUT_BUTTONS,
  applyCssoccerInputLatch,
  assertCssoccerInputState,
  createCssoccerInputLatch,
  createCssoccerInputState,
} from "../src/cssoccer/inputState.mjs";
import {
  CSSOCCER_PLAYER_SELECTION_SOURCE,
  CssoccerUnsupportedSelectionError,
  applyCssoccerControlClearEvent,
  applyCssoccerHalfTimeSlotEvent,
  advanceCssoccerPlayerSelection,
  applyCssoccerSetPieceControlEvent,
  createCssoccerPlayerSelection,
  createCssoccerControlClearEvent,
  createCssoccerHalfTimeSlotEvent,
  createCssoccerReselectionEvent,
  createCssoccerSelectionFrame,
  createCssoccerSetPieceControlEvent,
  projectCssoccerPlayerSelectionNativeFields,
  rebaseCssoccerPlayerSelection,
  selectCssoccerPlayer,
} from "../src/cssoccer/playerSelection.mjs";
import {
  assertCssoccerUserControl,
  createCssoccerUserControl,
  stepCssoccerUserControl,
} from "../src/cssoccer/userControl.mjs";

const f32 = Math.fround;
const RETAINED_ROOT = new URL(
  "../.local/cssoccer/oracle/native/retained/runs/canonical-a/",
  import.meta.url,
);
const RETAINED_STATE_URL = new URL("state.jsonl", RETAINED_ROOT);
const RETAINED_RAW_URL = new URL("native.raw", RETAINED_ROOT);
const SOURCE_ROOT = new URL("../.local/actua-soccer/source/", import.meta.url);
const SOURCE_URLS = {
  ball: new URL("BALLINT.CPP", SOURCE_ROOT),
  intelligence: new URL("INTELL.CPP", SOURCE_ROOT),
  rules: new URL("RULES.CPP", SOURCE_ROOT),
  user: new URL("USER.CPP", SOURCE_ROOT),
};
const SELECTION_RUNTIME_URL = new URL(
  "../src/cssoccer/playerSelection.mjs",
  import.meta.url,
);
const GENERAL_SELECTION = Object.freeze({
  rebaseTick: 249,
  firstTick: 250,
  lastTick: 632,
  frontierTick: 633,
});
const RAW = Object.freeze({
  teams: 0x3cf6c,
  playerBytes: 203,
  player: Object.freeze({
    facingX: 26,
    facingY: 30,
    distance: 37,
    on: 44,
    control: 46,
    action: 142,
  }),
  selectionCircle: 0x3e314,
  interceptorA: 0x3e40c,
  interceptorB: 0x3e410,
  ballPossession: 0x3e430,
  receiverA: 0x3e488,
  receiverB: 0x3e48a,
  userTaker2: 0x3e50a,
  setPieceTaker: 0x3e55c,
  goalKickTaker: 0x3e56c,
  matchMode: 0x3e8e0,
  nearPathA: 0x3e8be,
  nearPathB: 0x3e8c0,
  setPiece: 0x3e58e,
  userTaker: 0x3e508,
  ballTravel: 0x3eda4,
  selectCount: 0x3eda6,
  deadBallCount: 0x3e8e4,
  matchHalf: 0x3e74d,
  alreadyThere: 0x3eda8,
  reselection: 0x3eda9,
});
const retainedSelectionOptions = skipUnless(
  [RETAINED_STATE_URL, RETAINED_RAW_URL, ...Object.values(SOURCE_URLS)],
  "retained general-selection evidence and pinned source",
);

test("typed command ingestion is contiguous, edge-preserving, and rejects widened state", () => {
  const first = createCssoccerInputState({
    tick: 0,
    moveX: -128,
    moveY: 127,
    buttons: CSSOCCER_INPUT_BUTTONS.FIRE_1,
  });
  assert.deepEqual(first.values.moveX, {
    fieldId: "input.move_x",
    valueType: "i8",
    value: -128,
    numericBits: "80",
  });
  assert.deepEqual(first.values.buttons, {
    fieldId: "input.buttons",
    valueType: "u32",
    value: 1,
    numericBits: "00000001",
  });
  assert.equal(first.edges.fire1Pressed, true);
  assert.equal(first.edges.fire1Released, false);

  const second = createCssoccerInputState({
    tick: 1,
    moveX: 0,
    moveY: 0,
    buttons: CSSOCCER_INPUT_BUTTONS.FIRE_2,
  }, { previous: first });
  assert.equal(second.edges.fire1Released, true);
  assert.equal(second.edges.fire2Pressed, true);

  const heldSelection = applyCssoccerInputLatch(createCssoccerInputLatch(), first, {
    selected: true,
  });
  assert.equal(heldSelection.effective.fire1, false);
  assert.equal(heldSelection.effective.fireSuppressed, true);
  assert.equal(heldSelection.latch.awaitFireRelease, true);
  const releasedSelection = applyCssoccerInputLatch(
    heldSelection.latch,
    createCssoccerInputState({ tick: 1, moveX: 0, moveY: 0, buttons: 0 }, { previous: first }),
  );
  assert.equal(releasedSelection.latch.awaitFireRelease, false);

  assert.throws(
    () => createCssoccerInputState({ tick: 2, moveX: 0, moveY: 0, buttons: 0 }, { previous: first }),
    /contiguous/u,
  );
  assert.throws(
    () => createCssoccerInputState({ tick: 0, moveX: 128, moveY: 0, buttons: 0 }),
    /int8/u,
  );
  assert.throws(
    () => createCssoccerInputState({ tick: 0, moveX: 0, moveY: 0, buttons: 64 }),
    /outside/u,
  );
  const widened = clone(first);
  widened.values.moveX.unit = "invented";
  assert.throws(() => assertCssoccerInputState(widened), /exactly/u);
  const corruptBits = clone(first);
  corruptBits.values.moveX.numericBits = "00";
  assert.throws(() => assertCssoccerInputState(corruptBits), /numeric bits/u);
});

test("Spain and Argentina bind only their exact 11 and auto-select outfield in native order", () => {
  for (const country of ["spain", "argentina"]) {
    const selection = createCssoccerPlayerSelection({ teamState: fixedTeamState(country) });
    assert.deepEqual(selection.eligiblePlayerIds, playerIds(country));
    assert.deepEqual(selection.outfieldPlayerIds, playerIds(country).slice(1));
    assert.equal(selection.keeperPlayerId, `${country}-player-01`);
    assert.equal(selection.activePlayerId, null);

    const tie = selectionFrame(selection, {
      tick: 0,
      candidateEdits: {
        [`${country}-player-02`]: { distance: f32(5) },
        [`${country}-player-03`]: { distance: f32(5) },
      },
    });
    const tied = selectCssoccerPlayer(selection, tie);
    assert.equal(tied.state.activePlayerId, `${country}-player-02`);
    assert.equal(tied.result.reason, "closest-distance");

    const held = selectCssoccerPlayer(tied.state, selectionFrame(tied.state, {
      tick: 1,
      candidateEdits: {
        [`${country}-player-02`]: { distance: f32(5), selectionCircle: true, controlUser: 1 },
        [`${country}-player-03`]: { distance: f32(1) },
      },
    }));
    assert.equal(held.state.activePlayerId, `${country}-player-02`);
    assert.equal(held.result.reason, "held-selection-circle");

    const receiver = selectCssoccerPlayer(held.state, selectionFrame(held.state, {
      tick: 2,
      receiverPlayerId: `${country}-player-03`,
      candidateEdits: {
        [`${country}-player-02`]: { distance: f32(5), selectionCircle: true, controlUser: 1 },
        [`${country}-player-03`]: { distance: f32(40) },
      },
    }));
    assert.equal(receiver.state.activePlayerId, `${country}-player-03`);
    assert.equal(receiver.result.reason, "main-priority");

    const possessor = selectCssoccerPlayer(receiver.state, selectionFrame(receiver.state, {
      tick: 3,
      possessionPlayerId: `${country}-player-06`,
      candidateEdits: {
        [`${country}-player-03`]: { selectionCircle: true, controlUser: 1 },
        [`${country}-player-06`]: { controlUser: 0 },
      },
    }));
    assert.equal(possessor.state.activePlayerId, `${country}-player-06`);
    assert.equal(possessor.result.reason, "uncontrolled-team-possessor");

    const ownsBall = selectCssoccerPlayer(possessor.state, selectionFrame(possessor.state, {
      tick: 4,
      possessionPlayerId: `${country}-player-06`,
      candidateEdits: {
        [`${country}-player-02`]: { distance: f32(0.5) },
        [`${country}-player-06`]: { controlUser: 1 },
      },
    }));
    assert.equal(ownsBall.state.activePlayerId, `${country}-player-06`);
    assert.equal(ownsBall.result.reason, "held-current-possessor");
  }
});

test("selection filters source on/control/fall facts and keeps keeper control explicit", () => {
  const selection = createCssoccerPlayerSelection({ teamState: fixedTeamState("argentina") });
  const filtered = selectCssoccerPlayer(selection, selectionFrame(selection, {
    tick: 0,
    candidateEdits: {
      "argentina-player-02": { distance: f32(1), on: 0 },
      "argentina-player-03": { distance: f32(2), falling: true },
      "argentina-player-04": { distance: f32(3) },
      "argentina-player-05": { distance: f32(4) },
    },
  }));
  assert.equal(filtered.state.activePlayerId, "argentina-player-04");

  const keeperTaker = selectionFrame(selection, {
    tick: 0,
    userTakerPlayerId: "argentina-player-01",
  });
  assert.throws(
    () => selectCssoccerPlayer(selection, keeperTaker),
    (error) => error instanceof CssoccerUnsupportedSelectionError
      && error.boundary === "temporary-user-goal-kick-keeper",
  );
  assert.throws(
    () => selectionFrame(selection, {
      tick: 0,
      candidateEdits: { "argentina-player-02": { distance: 1 / 3 } },
    }),
    /float32/u,
  );
});

test("corrected retained general selection stays exact from opening handoff to the next centre reset", retainedSelectionOptions, async () => {
  const raw = retainedRawSelectionRecords(
    GENERAL_SELECTION.rebaseTick,
    GENERAL_SELECTION.frontierTick,
  );
  const typed = await retainedTypedControls(
    GENERAL_SELECTION.rebaseTick,
    GENERAL_SELECTION.frontierTick,
  );
  let selection = createCssoccerPlayerSelection({
    teamState: fixedTeamState("argentina"),
  });
  selection = rebaseCssoccerPlayerSelection(selection, {
    tick: GENERAL_SELECTION.rebaseTick,
    fields: nativeOrderedFields(typed.get(GENERAL_SELECTION.rebaseTick), raw.get(GENERAL_SELECTION.rebaseTick)),
  });
  assert.equal(selection.activePlayerId, "argentina-player-10");
  assertControlFields(selection, typed.get(selection.tick), raw.get(selection.tick));

  const changes = [];
  const reselections = [];
  for (
    let tick = GENERAL_SELECTION.firstTick;
    tick <= GENERAL_SELECTION.lastTick;
    tick += 1
  ) {
    const previousRaw = raw.get(tick - 1);
    const currentRaw = raw.get(tick);
    const previousPlayerId = selection.activePlayerId;
    const frame = retainedSelectionFrame(selection, currentRaw);
    const reselectionEvent = retainedReselectionEvent(selection, previousRaw, currentRaw, {
      includePassBall: true,
    });
    const stepped = advanceCssoccerPlayerSelection(selection, {
      frame,
      reselectionEvent,
    });
    selection = stepped.state;
    assertControlFields(selection, typed.get(tick), currentRaw);
    if (reselectionEvent !== null) reselections.push([tick, reselectionEvent.kind]);
    if (selection.activePlayerId !== previousPlayerId) {
      changes.push([tick, selection.activePlayerId]);
      const expectedOperations = previousPlayerId === null
        ? ["assign"]
        : selection.activePlayerId === null
          ? ["clear"]
          : ["clear", "assign"];
      assert.deepEqual(
        stepped.result.controlWrites.map(({ operation }) => operation),
        expectedOperations,
      );
      if (previousPlayerId !== null) {
        assert.equal(
          stepped.result.controlWrites[0].field.fieldId,
          `players.${previousPlayerId}.control`,
        );
        assert.equal(stepped.result.controlWrites[0].field.value, 0);
      }
      if (selection.activePlayerId !== null) {
        const assigned = stepped.result.controlWrites.at(-1).field;
        assert.equal(assigned.fieldId, `players.${selection.activePlayerId}.control`);
        assert.equal(assigned.value, 1);
      }
    } else {
      assert.deepEqual(stepped.result.controlWrites, []);
    }
  }
  assert.deepEqual(changes, [
    [250, "argentina-player-03"],
    [318, "argentina-player-05"],
    [342, "argentina-player-03"],
    [354, "argentina-player-02"],
  ]);
  assert.ok(reselections.some(([tick, kind]) => tick === 250 && kind === "pass-ball"));

  const frontierRaw = raw.get(GENERAL_SELECTION.frontierTick);
  assert.equal(frontierRaw.matchHalf, 0);
  assert.equal(frontierRaw.matchMode, 6);
  assert.equal(frontierRaw.setPiece, 3);
  assert.equal(selection.currentNativeTeamSlot, "B");
  assert.equal(selection.activePlayerId, "argentina-player-02");
  assert.deepEqual(frontierRaw.players.filter(({ control }) => control === 1), []);
  assert.equal(
    retainedReselectionEvent(
      selection,
      raw.get(GENERAL_SELECTION.lastTick),
      frontierRaw,
      { includePassBall: true },
    ),
    null,
  );
  const cleared = applyCssoccerControlClearEvent(selection, {
    frame: retainedSelectionFrame(selection, frontierRaw),
    event: createCssoccerControlClearEvent(selection, {
      tick: GENERAL_SELECTION.frontierTick,
      matchMode: frontierRaw.matchMode,
    }),
  });
  const expectedFrontier = typed.get(GENERAL_SELECTION.frontierTick);
  assertControlFields(cleared.state, expectedFrontier, frontierRaw);
  assert.deepEqual(
    cleared.result.controlWrites.map(({ operation, field }) => [operation, field.fieldId]),
    [["clear", "players.argentina-player-02.control"]],
  );
  assert.equal(
    CSSOCCER_PLAYER_SELECTION_SOURCE.controlClearEvent.source,
    "init_match_mode -> USER.CPP clear_all_autos/clear_auto",
  );
});

test("rules-owned match-mode clear removes the selected player symmetrically", () => {
  for (const country of ["argentina", "spain"]) {
    const teamState = fixedTeamState(country);
    const activeId = `${country}-player-04`;
    let selection = createCssoccerPlayerSelection({ teamState });
    selection = rebaseCssoccerPlayerSelection(selection, {
      tick: 50,
      fields: syntheticControlFields(teamState, 50, activeId),
    });
    const event = createCssoccerControlClearEvent(selection, {
      tick: 51,
      matchMode: 6,
    });
    assert.deepEqual(event.matchMode, {
      fieldId: "rules.match_mode",
      valueType: "u8",
      value: 6,
      numericBits: "06",
    });
    const cleared = applyCssoccerControlClearEvent(selection, {
      frame: selectionFrame(selection, {
        tick: 51,
        candidateEdits: { [activeId]: { controlUser: 1 } },
      }),
      event,
    });
    assert.equal(cleared.state.activePlayerId, null);
    assert.equal(cleared.state.controlPhase, "general-play");
    assert.deepEqual(
      cleared.result.controlWrites.map(({ operation, field }) => [operation, field.fieldId]),
      [["clear", `players.${activeId}.control`]],
    );
    assert.ok(
      projectCssoccerPlayerSelectionNativeFields(cleared.state)
        .every(({ value, numericBits }) => value === 0 && numericBits === "00"),
    );

    const corrupt = clone(event);
    corrupt.matchMode.numericBits = "00";
    assert.throws(
      () => applyCssoccerControlClearEvent(selection, {
        frame: selectionFrame(selection, {
          tick: 51,
          candidateEdits: { [activeId]: { controlUser: 1 } },
        }),
        event: corrupt,
      }),
      /corrupt/u,
    );
  }
});

test("goal-kick clear and taker binding preserve typed source identity for both countries", () => {
  for (const country of ["argentina", "spain"]) {
    const teamState = fixedTeamState(country);
    let selection = createCssoccerPlayerSelection({ teamState });
    const previousId = `${country}-player-10`;
    const takerId = `${country}-player-01`;
    selection = rebaseCssoccerPlayerSelection(selection, {
      tick: 50,
      fields: syntheticControlFields(teamState, 50, previousId),
    });

    const cleared = applyCssoccerSetPieceControlEvent(selection, {
      frame: selectionFrame(selection, {
        tick: 51,
        candidateEdits: { [previousId]: { controlUser: 1 } },
      }),
      event: createCssoccerSetPieceControlEvent(selection, {
        kind: "goal-kick-auto-user-cleared",
        takerPlayerId: takerId,
        tick: 51,
      }),
    });
    assert.equal(cleared.state.activePlayerId, null);
    assert.equal(cleared.state.controlPhase, "goal-kick-cleared");
    assert.equal(cleared.state.setPieceTakerPlayerId, takerId);
    assert.deepEqual(
      cleared.result.controlWrites.map(({ operation, field }) => [operation, field.fieldId]),
      [["clear", `players.${previousId}.control`]],
    );

    const held = advanceCssoccerPlayerSelection(cleared.state, {
      frame: selectionFrame(cleared.state, { tick: 52 }),
      reselectionEvent: null,
    });
    const bindEvent = createCssoccerSetPieceControlEvent(held.state, {
      kind: "goal-kick-taker-bound",
      takerPlayerId: takerId,
      tick: 53,
    });
    assert.deepEqual(bindEvent.takerNativePlayer, {
      fieldId: "selection.goal_kick_taker.native_player",
      valueType: "i32",
      value: country === "spain" ? 1 : 12,
      numericBits: country === "spain" ? "00000001" : "0000000c",
    });
    const bound = applyCssoccerSetPieceControlEvent(held.state, {
      frame: selectionFrame(held.state, { tick: 53 }),
      event: bindEvent,
    });
    assert.equal(bound.state.activePlayerId, takerId);
    assert.equal(bound.state.controlPhase, "goal-kick-taker");
    assert.deepEqual(
      bound.result.controlWrites.map(({ operation, field }) => [operation, field.fieldId]),
      [["assign", `players.${takerId}.control`]],
    );
  }
});

test("half-time slot events remap stable players and signed auto-user types symmetrically", () => {
  for (const country of ["argentina", "spain"]) {
    let selection = createCssoccerPlayerSelection({ teamState: fixedTeamState(country) });
    selection = advanceCssoccerPlayerSelection(selection, {
      frame: selectionFrame(selection, { tick: 0 }),
      reselectionEvent: null,
    }).state;
    const event = createCssoccerHalfTimeSlotEvent(selection, { tick: 1 });
    const expected = country === "argentina"
      ? {
          beforeSlot: "B",
          afterSlot: "A",
          beforeType: { value: -2, numericBits: "fffe" },
          afterType: { value: -1, numericBits: "ffff" },
          firstBefore: 12,
          firstAfter: 1,
        }
      : {
          beforeSlot: "A",
          afterSlot: "B",
          beforeType: { value: -1, numericBits: "ffff" },
          afterType: { value: -2, numericBits: "fffe" },
          firstBefore: 1,
          firstAfter: 12,
        };
    assert.equal(event.fromNativeTeamSlot, expected.beforeSlot);
    assert.equal(event.toNativeTeamSlot, expected.afterSlot);
    assert.deepEqual(scalar(event.autoUserTypeBefore), {
      valueType: "i16",
      ...expected.beforeType,
    });
    assert.deepEqual(scalar(event.autoUserTypeAfter), {
      valueType: "i16",
      ...expected.afterType,
    });
    assert.deepEqual(event.matchHalfAfter, {
      fieldId: "clock.match_half",
      valueType: "u8",
      value: 1,
      numericBits: "01",
    });
    assert.equal(event.playerRemap[0].playerId, `${country}-player-01`);
    assert.equal(event.playerRemap[0].nativePlayerBefore.value, expected.firstBefore);
    assert.equal(event.playerRemap[0].nativePlayerAfter.value, expected.firstAfter);
    assert.equal(event.playerRemap.at(-1).playerId, `${country}-player-11`);

    const swapped = applyCssoccerHalfTimeSlotEvent(selection, { event });
    assert.equal(swapped.state.currentNativeTeamSlot, expected.afterSlot);
    assert.equal(swapped.state.nativeOrder[0].nativePlayerNumber, expected.firstAfter);
    assert.equal(swapped.state.nativeOrder.at(-1).nativePlayerNumber, expected.firstAfter + 10);
    assert.equal(swapped.state.activePlayerId, null);
    assert.equal(swapped.state.controlPhase, "general-play");
    assert.deepEqual(swapped.result.controlWrites, []);
    assert.throws(
      () => createCssoccerHalfTimeSlotEvent(swapped.state, { tick: 2 }),
      /already applied/u,
    );
  }
});

test("generic clear-then-assign handoff is symmetric for Spain without native-fed values", () => {
  for (const country of ["argentina", "spain"]) {
    const teamState = fixedTeamState(country);
    let selection = createCssoccerPlayerSelection({ teamState });
    const previousId = `${country}-player-10`;
    const nextId = `${country}-player-07`;
    selection = rebaseCssoccerPlayerSelection(selection, {
      tick: 50,
      fields: syntheticControlFields(teamState, 50, previousId),
    });
    const frame = selectionFrame(selection, {
      tick: 51,
      interceptorPlayerId: nextId,
      nearPathPlayerId: nextId,
      candidateEdits: {
        [previousId]: { controlUser: 1, distance: f32(80), selectionCircle: false },
        [nextId]: { distance: f32(30) },
      },
    });
    const changed = advanceCssoccerPlayerSelection(selection, {
      frame,
      reselectionEvent: createCssoccerReselectionEvent(selection, {
        kind: "free-ball-path",
        pathPlayerId: nextId,
        tick: 51,
      }),
    });
    assert.equal(changed.state.activePlayerId, nextId);
    assert.deepEqual(
      changed.result.controlWrites.map(({ operation, field }) => [operation, field.fieldId, field.numericBits]),
      [
        ["clear", `players.${previousId}.control`, "00"],
        ["assign", `players.${nextId}.control`, "01"],
      ],
    );
    const projected = projectCssoccerPlayerSelectionNativeFields(changed.state);
    assert.equal(projected.length, 22);
    assert.deepEqual(
      projected.filter(({ value }) => value === 1).map(({ fieldId }) => fieldId),
      [`players.${nextId}.control`],
    );
  }
});

test("general selection rejects corrupt rebase identity, bits, order, and widened source events", () => {
  const teamState = fixedTeamState("argentina");
  const unstarted = createCssoccerPlayerSelection({ teamState });
  const fields = syntheticControlFields(teamState, 50, "argentina-player-10");

  const wrongBits = clone(fields);
  wrongBits[0].numericBits = "01";
  assert.throws(
    () => rebaseCssoccerPlayerSelection(unstarted, { tick: 50, fields: wrongBits }),
    /u8 type|bits/u,
  );
  const wrongOrder = clone(fields);
  [wrongOrder[0], wrongOrder[1]] = [wrongOrder[1], wrongOrder[0]];
  assert.throws(
    () => rebaseCssoccerPlayerSelection(unstarted, { tick: 50, fields: wrongOrder }),
    /native order|stable identity/u,
  );
  const twoUsers = clone(fields);
  twoUsers[1].value = 1;
  twoUsers[1].numericBits = "01";
  assert.throws(
    () => rebaseCssoccerPlayerSelection(unstarted, { tick: 50, fields: twoUsers }),
    /exactly one/u,
  );
  const noUsers = fields.map((field) => ({
    ...clone(field),
    value: 0,
    numericBits: "00",
  }));
  const cleared = rebaseCssoccerPlayerSelection(unstarted, {
    tick: 50,
    fields: noUsers,
  });
  assert.equal(cleared.activePlayerId, null);
  assert.equal(cleared.lastReason, "rebased-cleared-control-handoff");

  const selection = rebaseCssoccerPlayerSelection(unstarted, { tick: 50, fields });
  const frame = selectionFrame(selection, {
    tick: 51,
    candidateEdits: {
      "argentina-player-10": { controlUser: 1 },
    },
  });
  const event = createCssoccerReselectionEvent(selection, {
    kind: "free-ball-path",
    pathPlayerId: "argentina-player-10",
    tick: 51,
  });
  const corruptEvent = clone(event);
  corruptEvent.pathNativePlayer.numericBits = "00";
  assert.throws(
    () => advanceCssoccerPlayerSelection(selection, { frame, reselectionEvent: corruptEvent }),
    /corrupt/u,
  );
  assert.throws(
    () => createCssoccerReselectionEvent(selection, {
      kind: "ball-collected",
      pathPlayerId: "argentina-player-10",
      tick: 51,
    }),
    /cannot invent/u,
  );
  assert.throws(
    () => advanceCssoccerPlayerSelection(selection, {
      frame,
      reselectionEvent: null,
      widened: true,
    }),
    /must contain exactly/u,
  );
  const setPieceEvent = createCssoccerSetPieceControlEvent(selection, {
    kind: "goal-kick-auto-user-cleared",
    takerPlayerId: "argentina-player-01",
    tick: 51,
  });
  const corruptSetPieceEvent = clone(setPieceEvent);
  corruptSetPieceEvent.takerNativePlayer.numericBits = "00000000";
  assert.throws(
    () => applyCssoccerSetPieceControlEvent(selection, {
      frame,
      event: corruptSetPieceEvent,
    }),
    /corrupt/u,
  );
  assert.throws(
    () => createCssoccerSetPieceControlEvent(selection, {
      kind: "goal-kick-taker-bound",
      takerPlayerId: "argentina-player-01",
      tick: 51,
      widened: true,
    }),
    /must contain exactly/u,
  );
  assert.throws(
    () => applyCssoccerSetPieceControlEvent(selection, {
      frame,
      event: createCssoccerSetPieceControlEvent(selection, {
        kind: "goal-kick-taker-bound",
        takerPlayerId: "argentina-player-01",
        tick: 51,
      }),
    }),
    /matching cleared/u,
  );
  let idle = createCssoccerPlayerSelection({ teamState });
  idle = advanceCssoccerPlayerSelection(idle, {
    frame: selectionFrame(idle, { tick: 0 }),
    reselectionEvent: null,
  }).state;
  const halfTimeEvent = createCssoccerHalfTimeSlotEvent(idle, { tick: 1 });
  const corruptHalfTimeEvent = clone(halfTimeEvent);
  corruptHalfTimeEvent.playerRemap[0].nativePlayerAfter.numericBits = "0000";
  assert.throws(
    () => applyCssoccerHalfTimeSlotEvent(idle, { event: corruptHalfTimeEvent }),
    /corrupt/u,
  );
  assert.throws(
    () => createCssoccerHalfTimeSlotEvent(idle, { tick: 1, widened: true }),
    /must contain exactly/u,
  );
  assert.throws(
    () => projectCssoccerPlayerSelectionNativeFields(unstarted),
    /uint32/u,
  );
});

test("pinned source fixes selection, control-clear, goal-kick, and half-time producers", retainedSelectionOptions, () => {
  const user = readFileSync(SOURCE_URLS.user, "latin1");
  const ball = readFileSync(SOURCE_URLS.ball, "latin1");
  const intelligence = readFileSync(SOURCE_URLS.intelligence, "latin1");
  const rules = readFileSync(SOURCE_URLS.rules, "latin1");
  assert.match(
    user,
    /void auto_select_b\(short u\)[\s\S]*receiver_b[\s\S]*interceptor_b[\s\S]*near_path_b[\s\S]*d<lowest[\s\S]*clear_auto\(u\)[\s\S]*teams\[guy-1\]\.control=u/u,
  );
  assert.match(
    user,
    /if \(ball_travel\+\+>select_cnt\)[\s\S]*ball_travel=0[\s\S]*reselect_b\(\)/u,
  );
  assert.match(
    ball,
    /void collect_ball\(match_player \*player\)[\s\S]*ball_poss=player->tm_player[\s\S]*reselect\(\)/u,
  );
  assert.match(
    intelligence,
    /void free_ball\(match_player \*player\)[\s\S]*!interceptor_b[\s\S]*near_path_b==player->tm_player[\s\S]*go_to_path\(near_path_b\)[\s\S]*reselect_b\(\)[\s\S]*user_conts\(player\)/u,
  );
  assert.match(
    intelligence,
    /if \(player->int_cnt\)[\s\S]*--\(player->int_cnt\)[\s\S]*reset_ideas\(player\)[\s\S]*if \(!ball_poss\)[\s\S]*free_ball\(player\)/u,
  );
  assert.match(
    intelligence,
    /void pass_ball\(int ps,char cross\)[\s\S]*receiver_a=FALSE[\s\S]*receiver_b=FALSE[\s\S]*holder_lose_ball\(\)[\s\S]*new_interceptor\(ps\)/u,
  );
  assert.match(
    intelligence,
    /void new_interceptor\(int p\)[\s\S]*receiver_a=p[\s\S]*near_path_a=p[\s\S]*receiver_b=p[\s\S]*near_path_b=p[\s\S]*reselect\(\)/u,
  );
  assert.match(
    rules,
    /void init_gkick\(\)[\s\S]*dead_ball_cnt=100[\s\S]*gkick_taker=get_taker\(12\)[\s\S]*main_man=gkick_taker[\s\S]*user_taker=user_taker_b\(gkick_taker\)/u,
  );
  assert.match(
    rules,
    /void init_match_mode\(\)[\s\S]*clear_all_autos\(\)[\s\S]*switch\(match_mode\)[\s\S]*case\(CENTRE_A\)[\s\S]*case\(CENTRE_B\)/u,
  );
  assert.match(
    user,
    /short user_taker_b\(short p\)[\s\S]*auto_users_b[\s\S]*clear_auto\(u\)/u,
  );
  assert.match(
    rules,
    /void await_set_kick\(\)[\s\S]*if \(reselection\)[\s\S]*teams\[setp_taker-1\]\.control=user_taker[\s\S]*users\[user_taker-1\]\.plr=setp_taker/u,
  );
  assert.match(
    rules,
    /void swap_users\(\)[\s\S]*users\[u\]\.type=-2[\s\S]*auto_users_a=auto_users_b[\s\S]*void swap_teams\(\)/u,
  );

  const runtime = readFileSync(SELECTION_RUNTIME_URL, "utf8");
  assert.doesNotMatch(
    runtime,
    /node:|\.local\/|state\.jsonl|native\.raw|readFile|createReadStream/u,
  );
  assert.doesNotMatch(
    runtime,
    /\b(?:172|178|185|249|250|318|342|354|632|633|1780|1787|1795|1842|1843)\b/u,
  );
});

test("action commands preserve native ids/types and exact button priority", () => {
  assert.deepEqual(CSSOCCER_NATIVE_ACTIONS, {
    STAND: 0,
    RUN: 1,
    TACKLE: 3,
    JUMP: 4,
    THROW: 11,
    KICK: 15,
    STEAL: 15,
    CELEBRATE: 16,
    CONTROL: 17,
    PICKUP: 19,
    STOP: 20,
  });
  const running = createCssoccerActionState({
    tick: 10,
    playerId: "spain-player-02",
    actionId: 1,
    facingX: f32(1),
    facingY: f32(0),
  });
  const pass = resolveCssoccerUserAction(running, {
    tick: 10,
    input: effectiveInput({ moveX: 127, fire1: true, fire2: true }),
    possession: "self",
  });
  assert.equal(pass.command.kind, "pass");
  assert.deepEqual(pass.command.actionAfter, {
    fieldId: "players.spain-player-02.action.after",
    valueType: "i16",
    value: 15,
    numericBits: "000f",
  });
  assert.equal(pass.command.facingIntent.x.valueType, "i8");
  assert.equal(pass.command.facingIntent.x.numericBits, "7f");

  for (const frontFire of ["shoot", "punt", "chip", "forward-pass"]) {
    const resolved = resolveCssoccerUserAction(running, {
      tick: 10,
      input: effectiveInput({ moveY: -128, fire1: true }),
      possession: "self",
      resolution: createCssoccerActionResolution({ frontFire }),
    });
    assert.equal(resolved.command.kind, frontFire);
    assert.equal(resolved.command.actionAfter.value, 15);
  }

  const tackle = resolveCssoccerUserAction(running, {
    tick: 10,
    input: effectiveInput({ fire1: true, fire2: true }),
    possession: "opponent",
    resolution: createCssoccerActionResolution({ tackleAccepted: true }),
  });
  assert.equal(tackle.command.kind, "tackle");
  assert.equal(tackle.command.actionAfter.value, 3);
  assert.equal(tackle.command.burstDirective, "preserve");

  const sourceTransitions = {
    control: 17,
    stop: 20,
    "recover-stand": 0,
    "recover-run": 1,
  };
  for (const [transition, actionId] of Object.entries(sourceTransitions)) {
    const result = applyCssoccerResolvedActionTransition(running, { tick: 10, transition });
    assert.equal(result.command.actionAfter.value, actionId);
    assert.equal(result.command.actionAfter.valueType, "i16");
  }
});

test("neutral input stops any interactive runner without fixture identity", () => {
  for (const playerId of ["spain-player-04", "argentina-player-09"]) {
    const running = createCssoccerActionState({
      tick: 21,
      playerId,
      actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
      facingX: f32(playerId.startsWith("spain") ? 1 : -1),
      facingY: f32(0),
    });
    const stopped = resolveCssoccerUserAction(running, {
      tick: 21,
      input: effectiveInput(),
      possession: "opponent",
    });
    assert.equal(stopped.command.kind, "hold");
    assert.equal(stopped.command.actionBefore.value, CSSOCCER_NATIVE_ACTIONS.RUN);
    assert.equal(stopped.command.actionAfter.value, CSSOCCER_NATIVE_ACTIONS.STAND);
    assert.equal(stopped.command.actionAfter.numericBits, "0000");
  }
});

test("unsupported action boundaries fail before inventing gameplay", () => {
  const stand = createCssoccerActionState({
    tick: 0,
    playerId: "argentina-player-02",
    actionId: 0,
    facingX: f32(-1),
    facingY: f32(0),
  });
  assert.throws(
    () => resolveCssoccerUserAction(stand, {
      tick: 0,
      input: effectiveInput({ fire1: true }),
      possession: "self",
    }),
    (error) => error instanceof CssoccerUnsupportedActionError
      && error.boundary === "standing-special-kick",
  );
  const run = createCssoccerActionState({
    tick: 0,
    playerId: "argentina-player-02",
    actionId: 1,
    facingX: f32(-1),
    facingY: f32(0),
  });
  assert.throws(
    () => resolveCssoccerUserAction(run, {
      tick: 0,
      input: effectiveInput({ moveX: 1, fire1: true }),
      possession: "self",
    }),
    (error) => error.boundary === "front-fire-decision-required",
  );
  const steal = resolveCssoccerUserAction(run, {
    tick: 0,
    input: effectiveInput({ fire2: true }),
    possession: "opponent",
    resolution: createCssoccerActionResolution({ opponentWithinStealRange: true }),
  });
  assert.equal(steal.command.kind, "steal");
  assert.equal(steal.command.actionAfter.value, CSSOCCER_NATIVE_ACTIONS.STEAL);
  assert.equal(steal.command.burstDirective, "reset");
});

test("integrated selected-country control suppresses fire on selection and reproduces burst timer", () => {
  let control = createCssoccerUserControl({ teamState: fixedTeamState("argentina") });
  let frame = selectionFrame(control.selection, {
    tick: 0,
    candidateEdits: {
      "argentina-player-02": { distance: f32(1), actionId: 1 },
    },
  });
  let stepped = stepCssoccerUserControl(control, {
    command: { tick: 0, moveX: 127, moveY: 0, buttons: 3 },
    selectionFrame: frame,
  });
  assert.equal(stepped.result.selection.activePlayerId, "argentina-player-02");
  assert.equal(stepped.result.effectiveInput.fireSuppressed, true);
  assert.equal(stepped.result.actionCommand.kind, "run");
  assert.equal(stepped.state.burstTimer.numericBits, "0000");
  control = stepped.state;

  frame = selectionFrame(control.selection, {
    tick: 1,
    candidateEdits: {
      "argentina-player-02": { distance: f32(1), actionId: 1, controlUser: 1 },
    },
  });
  stepped = stepCssoccerUserControl(control, {
    command: { tick: 1, moveX: 0, moveY: 0, buttons: 0 },
    selectionFrame: frame,
  });
  assert.equal(stepped.state.latch.awaitFireRelease, false);
  control = stepped.state;

  frame = selectionFrame(control.selection, {
    tick: 2,
    possessionPlayerId: "spain-player-02",
    candidateEdits: {
      "argentina-player-02": { distance: f32(1), actionId: 1, controlUser: 1 },
    },
  });
  stepped = stepCssoccerUserControl(control, {
    command: { tick: 2, moveX: 127, moveY: 0, buttons: 2 },
    selectionFrame: frame,
    actionResolution: createCssoccerActionResolution({ opponentWithinStealRange: false }),
  });
  assert.equal(stepped.result.actionCommand.kind, "burst-run");
  assert.equal(stepped.result.sprint.timer.value, 20);
  assert.equal(stepped.result.sprint.active, true);
  control = stepped.state;

  frame = selectionFrame(control.selection, {
    tick: 3,
    possessionPlayerId: "spain-player-02",
    candidateEdits: {
      "argentina-player-02": { distance: f32(1), actionId: 1, controlUser: 1 },
    },
  });
  stepped = stepCssoccerUserControl(control, {
    command: { tick: 3, moveX: 127, moveY: 0, buttons: 2 },
    selectionFrame: frame,
    actionResolution: createCssoccerActionResolution({ opponentWithinStealRange: false }),
  });
  assert.equal(stepped.result.sprint.timer.value, 19);
  control = stepped.state;

  for (let tick = 4; tick <= 22; tick += 1) {
    frame = selectionFrame(control.selection, {
      tick,
      possessionPlayerId: "spain-player-02",
      candidateEdits: {
        "argentina-player-02": { distance: f32(1), actionId: 1, controlUser: 1 },
      },
    });
    stepped = stepCssoccerUserControl(control, {
      command: { tick, moveX: 127, moveY: 0, buttons: 2 },
      selectionFrame: frame,
      actionResolution: createCssoccerActionResolution({ opponentWithinStealRange: false }),
    });
    control = stepped.state;
  }
  assert.equal(stepped.result.sprint.timer.value, -1);
  assert.equal(stepped.result.sprint.timer.numericBits, "ffff");
  assert.equal(stepped.result.sprint.active, false);

  frame = selectionFrame(control.selection, {
    tick: 23,
    possessionPlayerId: "spain-player-02",
    candidateEdits: {
      "argentina-player-02": { distance: f32(1), actionId: 1, controlUser: 1 },
    },
  });
  stepped = stepCssoccerUserControl(control, {
    command: { tick: 23, moveX: 0, moveY: 0, buttons: 0 },
    selectionFrame: frame,
  });
  assert.equal(stepped.result.sprint.timer.value, 0);
  assert.equal(stepped.result.sprint.active, false);
  assert.doesNotThrow(() => assertCssoccerUserControl(stepped.state));
  assert.ok(Object.isFrozen(stepped.state));
});

test("integrated auto-selection changes only on a typed source reselection request", () => {
  for (const country of ["spain", "argentina"]) {
    const firstId = `${country}-player-02`;
    const nextId = `${country}-player-03`;
    let control = createCssoccerUserControl({ teamState: fixedTeamState(country) });
    control = stepCssoccerUserControl(control, {
      command: { tick: 0, moveX: 0, moveY: 0, buttons: 0 },
      selectionFrame: selectionFrame(control.selection, {
        tick: 0,
        candidateEdits: { [firstId]: { distance: f32(1), actionId: 1 } },
      }),
    }).state;
    assert.equal(control.selection.activePlayerId, firstId);

    const held = stepCssoccerUserControl(control, {
      command: { tick: 1, moveX: 0, moveY: 0, buttons: 0 },
      selectionFrame: selectionFrame(control.selection, {
        tick: 1,
        candidateEdits: {
          [firstId]: { controlUser: 1, distance: f32(50), actionId: 1 },
          [nextId]: { distance: f32(1), actionId: 1 },
        },
      }),
    });
    assert.equal(held.state.selection.activePlayerId, firstId);
    assert.equal(held.result.selection.reselectionRequested, false);
    assert.equal(held.result.selection.reason, "held-no-reselection");
    control = held.state;

    const requested = createCssoccerReselectionEvent(control.selection, {
      kind: "ball-collected",
      pathPlayerId: null,
      tick: 2,
    });
    const changed = stepCssoccerUserControl(control, {
      command: { tick: 2, moveX: 0, moveY: 0, buttons: 0 },
      selectionFrame: selectionFrame(control.selection, {
        tick: 2,
        possessionPlayerId: nextId,
        candidateEdits: {
          [firstId]: { controlUser: 1, distance: f32(50), actionId: 1 },
          [nextId]: { distance: f32(1), actionId: 1 },
        },
      }),
      reselectionEvent: requested,
    });
    assert.equal(changed.state.selection.activePlayerId, nextId);
    assert.equal(changed.result.selection.reselectionRequested, true);
    assert.equal(changed.result.selection.reselectionEventKind, "ball-collected");
    assert.deepEqual(
      changed.result.selection.controlWrites.map(({ operation, field }) => [operation, field.fieldId]),
      [
        ["clear", `players.${firstId}.control`],
        ["assign", `players.${nextId}.control`],
      ],
    );
  }
});

test("both country choices emit the same typed movement/pass contract", () => {
  for (const country of ["spain", "argentina"]) {
    let control = createCssoccerUserControl({ teamState: fixedTeamState(country) });
    const activeId = `${country}-player-02`;
    let frame = selectionFrame(control.selection, {
      tick: 0,
      candidateEdits: { [activeId]: { distance: f32(1), actionId: 1 } },
    });
    control = stepCssoccerUserControl(control, {
      command: { tick: 0, moveX: 0, moveY: 0, buttons: 0 },
      selectionFrame: frame,
    }).state;
    frame = selectionFrame(control.selection, {
      tick: 1,
      possessionPlayerId: activeId,
      candidateEdits: { [activeId]: { distance: f32(1), actionId: 1, controlUser: 1 } },
    });
    const pass = stepCssoccerUserControl(control, {
      command: { tick: 1, moveX: 64, moveY: -64, buttons: 2 },
      selectionFrame: frame,
    });
    assert.equal(pass.result.selectedCountry, country);
    assert.equal(pass.result.actionCommand.playerId, activeId);
    assert.equal(pass.result.actionCommand.kind, "pass");
    assert.equal(pass.result.actionCommand.actionAfter.value, 15);
    assert.equal(pass.result.actionCommand.actionAfter.valueType, "i16");
  }
});

test("both country choices traverse the complete source-backed command action contract", () => {
  for (const country of ["spain", "argentina"]) {
    const playerId = `${country}-player-02`;
    const facingX = f32(country === "spain" ? 1 : -1);
    const state = (tick, actionId) => createCssoccerActionState({
      tick,
      playerId,
      actionId,
      facingX,
      facingY: f32(0),
    });
    const observed = [];

    observed.push(resolveCssoccerUserAction(state(10, 0), {
      tick: 10,
      input: effectiveInput(),
      possession: "free",
    }).command);
    observed.push(resolveCssoccerUserAction(state(11, 0), {
      tick: 11,
      input: effectiveInput({ moveX: country === "spain" ? 127 : -128 }),
      possession: "free",
    }).command);
    observed.push(applyCssoccerResolvedActionTransition(state(12, 1), {
      tick: 12,
      transition: "stop",
    }).command);
    observed.push(applyCssoccerResolvedActionTransition(state(13, 20), {
      tick: 13,
      transition: "control",
    }).command);
    observed.push(applyCssoccerResolvedActionTransition(state(14, 17), {
      tick: 14,
      transition: "recover-run",
    }).command);
    observed.push(resolveCssoccerUserAction(state(15, 1), {
      tick: 15,
      input: effectiveInput({ moveX: 64, fire2: true }),
      possession: "self",
    }).command);
    for (const [tick, frontFire] of [[16, "shoot"], [17, "chip"]]) {
      observed.push(resolveCssoccerUserAction(state(tick, 1), {
        tick,
        input: effectiveInput({ moveY: -64, fire1: true }),
        possession: "self",
        resolution: createCssoccerActionResolution({ frontFire }),
      }).command);
    }
    observed.push(resolveCssoccerUserAction(state(18, 1), {
      tick: 18,
      input: effectiveInput({ fire1: true }),
      possession: "opponent",
      resolution: createCssoccerActionResolution({ tackleAccepted: true }),
    }).command);
    observed.push(applyCssoccerResolvedActionTransition(state(19, 3), {
      tick: 19,
      transition: "recover-stand",
    }).command);

    assert.deepEqual(
      observed.map(({ kind, actionAfter }) => [kind, actionAfter.value, actionAfter.numericBits]),
      [
        ["hold", 0, "0000"],
        ["run", 1, "0001"],
        ["stop", 20, "0014"],
        ["control", 17, "0011"],
        ["recover-run", 1, "0001"],
        ["pass", 15, "000f"],
        ["shoot", 15, "000f"],
        ["chip", 15, "000f"],
        ["tackle", 3, "0003"],
        ["recover-stand", 0, "0000"],
      ],
    );
    assert.ok(observed.every((command) => command.playerId === playerId));
  }
});

function fixedTeamState(selectedCountry, { swapped = false } = {}) {
  const countries = ["spain", "argentina"];
  const slot = (country) => {
    const kickoff = country === "spain" ? "A" : "B";
    if (!swapped) return kickoff;
    return kickoff === "A" ? "B" : "A";
  };
  const players = countries.flatMap((country) => playerIds(country).map((id, sourceRosterIndex) => ({
    id,
    country,
    identity: { sourceRosterIndex },
    current: {
      nativeTeamSlot: slot(country),
      nativePlayerNumber: (slot(country) === "A" ? 1 : 12) + sourceRosterIndex,
    },
  })));
  return {
    schema: "cssoccer-team-state@1",
    fixtureId: "spain-argentina-full-match",
    players,
    control: {
      mode: "auto-player",
      users: 1,
      autoPlayer: -1,
      selectedCountry,
      selectedTeamId: `team-${selectedCountry}`,
      activePlayerId: null,
      eligiblePlayerIds: playerIds(selectedCountry),
      currentNativeTeamSlot: slot(selectedCountry),
    },
  };
}

function playerIds(country) {
  return Array.from({ length: 11 }, (_, index) => (
    `${country}-player-${String(index + 1).padStart(2, "0")}`
  ));
}

function selectionFrame(selection, {
  tick,
  possessionPlayerId = null,
  receiverPlayerId = null,
  interceptorPlayerId = null,
  nearPathPlayerId = null,
  userTakerPlayerId = null,
  candidateEdits = {},
} = {}) {
  const candidates = selection.nativeOrder.map(({ playerId }, index) => ({
    playerId,
    on: 1,
    controlUser: 0,
    actionId: 0,
    falling: false,
    distance: f32(100 + index),
    selectionCircle: false,
    facingX: f32(selection.selectedCountry === "spain" ? 1 : -1),
    facingY: f32(0),
    ...(candidateEdits[playerId] ?? {}),
  }));
  return createCssoccerSelectionFrame(selection, {
    tick,
    candidates,
    possessionPlayerId,
    receiverPlayerId,
    interceptorPlayerId,
    nearPathPlayerId,
    userTakerPlayerId,
  });
}

function retainedSelectionFrame(selection, record) {
  const candidates = selection.nativeOrder.map(({ nativePlayerNumber, playerId }) => {
    const player = record.players[nativePlayerNumber - 1];
    assert.ok(player, `raw selection player ${playerId}`);
    return {
      playerId,
      on: player.on,
      controlUser: playerId === selection.activePlayerId ? 1 : 0,
      actionId: player.actionId,
      falling: player.actionId === 5,
      distance: player.distance,
      selectionCircle: player.selectionCircle,
      facingX: player.facingX,
      facingY: player.facingY,
    };
  });
  return createCssoccerSelectionFrame(selection, {
    tick: record.tick,
    candidates,
    possessionPlayerId: stablePlayerIdForNative(selection, record.ballPossession),
    receiverPlayerId: selectedPointer(selection, selectedSlotValue(selection, record, "receiver")),
    interceptorPlayerId: selectedPointer(selection, selectedSlotValue(selection, record, "interceptor")),
    nearPathPlayerId: selectedPointer(selection, selectedSlotValue(selection, record, "nearPath")),
    userTakerPlayerId: record.userTaker2 === 1 ? selection.keeperPlayerId : null,
  });
}

function retainedReselectionEvent(selection, previous, current, {
  includePassBall = false,
} = {}) {
  const scheduled = current.ballPossession !== 0
    && current.matchMode === 0
    && previous.ballTravel > previous.selectCount
    && current.ballTravel === 0;
  const collected = current.ballPossession !== 0
    && current.ballPossession !== previous.ballPossession;
  if (scheduled || collected) {
    return createCssoccerReselectionEvent(selection, {
      kind: scheduled ? "scheduled-possession" : "ball-collected",
      pathPlayerId: null,
      tick: current.tick,
    });
  }

  const passBall = previous.ballPossession !== 0
    && current.ballPossession === 0
    && (
      (current.receiverA !== 0 && current.receiverA !== previous.receiverA)
      || (current.receiverB !== 0 && current.receiverB !== previous.receiverB)
    );
  if (includePassBall && passBall) {
    return createCssoccerReselectionEvent(selection, {
      kind: "pass-ball",
      pathPlayerId: null,
      tick: current.tick,
    });
  }

  const nativePlayerNumber = selectedSlotValue(selection, current, "interceptor");
  const receiverNativePlayer = selectedSlotValue(selection, current, "receiver");
  const nearPathNativePlayer = selectedSlotValue(selection, current, "nearPath");
  if (
    current.ballPossession === 0
    && current.matchMode === 0
    && receiverNativePlayer === 0
    && selectedPointer(selection, nativePlayerNumber) !== null
    && nearPathNativePlayer === nativePlayerNumber
  ) {
    const before = previous.players[nativePlayerNumber - 1];
    const after = current.players[nativePlayerNumber - 1];
    const previousInterceptor = selectedSlotValue(selection, previous, "interceptor");
    const claimed = previousInterceptor === 0;
    const reclaimed = previousInterceptor === nativePlayerNumber
      && before.intelligenceMove === 1
      && before.intelligenceCount === 1
      && after.intelligenceMove === 1
      && after.intelligenceCount > 1;
    if (claimed || reclaimed) {
      return createCssoccerReselectionEvent(selection, {
        kind: "free-ball-path",
        pathPlayerId: selectedPointer(selection, nativePlayerNumber),
        tick: current.tick,
      });
    }
  }
  return null;
}

function retainedHalfTimeSlotEvent(selection, previous, current) {
  if (previous.matchHalf === 0 && current.matchHalf === 1) {
    return createCssoccerHalfTimeSlotEvent(selection, { tick: current.tick });
  }
  return null;
}

function retainedSetPieceControlEvent(selection, previous, current) {
  const selectedTakerId = selectedPointer(selection, current.goalKickTaker);
  if (
    current.setPiece === 7
    && previous.setPiece !== 7
    && current.userTaker === 1
    && selectedTakerId !== null
    && current.setPieceTaker === current.goalKickTaker
  ) {
    return createCssoccerSetPieceControlEvent(selection, {
      kind: "goal-kick-auto-user-cleared",
      takerPlayerId: selectedTakerId,
      tick: current.tick,
    });
  }
  if (
    current.setPiece === 7
    && current.userTaker === 1
    && previous.reselection === 1
    && current.reselection === 0
    && selectedTakerId !== null
    && current.setPieceTaker === current.goalKickTaker
    && current.players[current.goalKickTaker - 1].control === 1
  ) {
    return createCssoccerSetPieceControlEvent(selection, {
      kind: "goal-kick-taker-bound",
      takerPlayerId: selectedTakerId,
      tick: current.tick,
    });
  }
  return null;
}

async function retainedTypedControls(startTick, endTick) {
  const ticks = new Map(
    Array.from({ length: endTick - startTick + 1 }, (_, index) => [
      startTick + index,
      new Map(),
    ]),
  );
  const input = createReadStream(RETAINED_STATE_URL);
  const lines = createInterface({ input });
  for await (const line of lines) {
    const record = JSON.parse(line);
    if (record.tick > endTick) {
      lines.close();
      input.destroy();
      break;
    }
    if (
      record.recordType !== "sample"
      || record.tick < startTick
      || !record.fieldId.endsWith(".control")
    ) {
      continue;
    }
    ticks.get(record.tick).set(record.fieldId, record);
  }
  assert.ok([...ticks.values()].every((fields) => fields.size === 22));
  return ticks;
}

function retainedRawSelectionRecords(startTick, endTick) {
  const bytes = readFileSync(RETAINED_RAW_URL);
  assert.equal(bytes.subarray(0, 8).toString("ascii"), "CSSORAW2");
  assert.equal(bytes.readUInt32LE(8), 2);
  const rangeCount = bytes.readUInt32LE(12);
  const ranges = [];
  let cursor = 16;
  let payloadBytes = 0;
  for (let index = 0; index < rangeCount; index += 1) {
    const offset = bytes.readUInt32LE(cursor);
    const size = bytes.readUInt32LE(cursor + 4);
    ranges.push({ offset, size, payloadBase: payloadBytes });
    payloadBytes += size;
    cursor += 8;
  }
  const metadataBytes = 28;
  const recordBytes = metadataBytes + payloadBytes;
  assert.equal((bytes.length - cursor) % recordBytes, 0);
  const result = new Map();
  for (let recordOffset = cursor; recordOffset < bytes.length; recordOffset += recordBytes) {
    assert.equal(bytes.subarray(recordOffset, recordOffset + 4).toString("ascii"), "TIK1");
    const tick = bytes.readUInt32LE(recordOffset + 20);
    const flags = bytes.readUInt32LE(recordOffset + 24);
    if ((flags & 1) === 0 || tick < startTick || tick > endTick) continue;
    const raw = { bytes, ranges, payloadOffset: recordOffset + metadataBytes };
    const players = Array.from({ length: 22 }, (_, index) => {
      const nativePlayerNumber = index + 1;
      const playerId = fixturePlayerId(nativePlayerNumber);
      const base = RAW.teams + index * RAW.playerBytes;
      const control = readRawU8(raw, base + RAW.player.control);
      return {
        nativePlayerNumber,
        playerId,
        on: readRawI16(raw, base + RAW.player.on),
        control,
        actionId: readRawI16(raw, base + RAW.player.action),
        distance: readRawF32(raw, base + RAW.player.distance),
        selectionCircle: readRawU8(raw, RAW.selectionCircle + index) !== 0,
        facingX: readRawF32(raw, base + RAW.player.facingX),
        facingY: readRawF32(raw, base + RAW.player.facingY),
        intelligenceMove: readRawI16(raw, base + 191),
        intelligenceCount: readRawI16(raw, base + 193),
      };
    });
    result.set(tick, {
      tick,
      players,
      ballPossession: readRawI32(raw, RAW.ballPossession),
      receiverA: readRawI16(raw, RAW.receiverA),
      receiverB: readRawI16(raw, RAW.receiverB),
      interceptorA: readRawI32(raw, RAW.interceptorA),
      interceptorB: readRawI32(raw, RAW.interceptorB),
      nearPathA: readRawI16(raw, RAW.nearPathA),
      nearPathB: readRawI16(raw, RAW.nearPathB),
      userTaker2: readRawI16(raw, RAW.userTaker2),
      setPieceTaker: readRawI32(raw, RAW.setPieceTaker),
      goalKickTaker: readRawI32(raw, RAW.goalKickTaker),
      matchMode: readRawU8(raw, RAW.matchMode),
      setPiece: readRawU8(raw, RAW.setPiece),
      userTaker: readRawI16(raw, RAW.userTaker),
      ballTravel: readRawI16(raw, RAW.ballTravel),
      selectCount: readRawI16(raw, RAW.selectCount),
      deadBallCount: readRawI32(raw, RAW.deadBallCount),
      matchHalf: readRawU8(raw, RAW.matchHalf),
      alreadyThere: readRawU8(raw, RAW.alreadyThere),
      reselection: readRawU8(raw, RAW.reselection),
    });
  }
  assert.deepEqual(
    [...result.keys()],
    Array.from({ length: endTick - startTick + 1 }, (_, index) => startTick + index),
  );
  return result;
}

function readRawOffset(raw, offset, size) {
  const range = raw.ranges.find((entry) => (
    offset >= entry.offset && offset + size <= entry.offset + entry.size
  ));
  assert.ok(range, `raw offset 0x${offset.toString(16)} is captured`);
  return raw.payloadOffset + range.payloadBase + offset - range.offset;
}

function readRawU8(raw, offset) {
  return raw.bytes.readUInt8(readRawOffset(raw, offset, 1));
}

function readRawI16(raw, offset) {
  return raw.bytes.readInt16LE(readRawOffset(raw, offset, 2));
}

function readRawI32(raw, offset) {
  return raw.bytes.readInt32LE(readRawOffset(raw, offset, 4));
}

function readRawF32(raw, offset) {
  const value = raw.bytes.readFloatLE(readRawOffset(raw, offset, 4));
  assert.ok(Number.isFinite(value));
  assert.ok(Object.is(f32(value), value));
  return value;
}

function assertControlFields(selection, typed, raw) {
  const actual = projectCssoccerPlayerSelectionNativeFields(selection);
  assert.equal(actual.length, 22);
  const nativeOrder = fixtureNativeOrder(selection);
  for (let index = 0; index < nativeOrder.length; index += 1) {
    const entry = nativeOrder[index];
    const field = actual[index];
    const rawPlayer = raw.players[entry.nativePlayerNumber - 1];
    const retainedFieldId = `players.${rawPlayer.playerId}.control`;
    const expectedTyped = typed.get(retainedFieldId);
    assert.ok(expectedTyped, `typed ${retainedFieldId} at tick ${selection.tick}`);
    assert.equal(field.fieldId, `players.${entry.playerId}.control`);
    assert.deepEqual(
      scalar(field),
      scalar(expectedTyped),
      `${selection.tick} ${field.fieldId} <- ${retainedFieldId}`,
    );
    assert.deepEqual(scalar(field), {
      valueType: "u8",
      value: rawPlayer.control,
      numericBits: rawPlayer.control.toString(16).padStart(2, "0"),
    }, `raw ${selection.tick} ${field.fieldId} <- ${retainedFieldId}`);
  }
}

function nativeOrderedFields(typed, raw) {
  return raw.players.map(({ playerId }) => {
    const field = typed.get(`players.${playerId}.control`);
    assert.ok(field, `typed control ${playerId}`);
    return field;
  });
}

function syntheticControlFields(teamState, tick, activePlayerId) {
  return [...teamState.players]
    .sort((left, right) => left.current.nativePlayerNumber - right.current.nativePlayerNumber)
    .map(({ id }) => typedControlField(tick, id, id === activePlayerId ? 1 : 0));
}

function typedControlField(tick, playerId, value) {
  return {
    schema: "cssoccer-parity-stream@1",
    recordType: "sample",
    tick,
    phase: "post_tick",
    fieldId: `players.${playerId}.control`,
    valueType: "u8",
    value,
    numericBits: value.toString(16).padStart(2, "0"),
  };
}

function selectedPointer(selection, nativePlayerNumber) {
  if (nativePlayerNumber === 0) return null;
  const playerId = stablePlayerIdForNative(selection, nativePlayerNumber);
  return selection.eligiblePlayerIds.includes(playerId) ? playerId : null;
}

function selectedSlotValue(selection, record, stem) {
  return record[`${stem}${selection.currentNativeTeamSlot}`];
}

function stablePlayerIdForNative(selection, nativePlayerNumber) {
  if (nativePlayerNumber === 0) return null;
  const entry = fixtureNativeOrder(selection)[nativePlayerNumber - 1];
  assert.ok(entry, `native player ${nativePlayerNumber}`);
  return entry.playerId;
}

function fixturePlayerId(nativePlayerNumber) {
  if (nativePlayerNumber === 0) return null;
  assert.ok(Number.isInteger(nativePlayerNumber) && nativePlayerNumber >= 1 && nativePlayerNumber <= 22);
  const country = nativePlayerNumber <= 11 ? "spain" : "argentina";
  const fixturePlayerNumber = ((nativePlayerNumber - 1) % 11) + 1;
  return `${country}-player-${String(fixturePlayerNumber).padStart(2, "0")}`;
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

function fieldMap(fields) {
  return new Map(fields.map((field) => [field.fieldId, field]));
}

function scalar(field) {
  return {
    valueType: field.valueType,
    value: field.value,
    numericBits: field.numericBits,
  };
}

function effectiveInput({ moveX = 0, moveY = 0, fire1 = false, fire2 = false } = {}) {
  return {
    movement: { active: moveX !== 0 || moveY !== 0, x: moveX, y: moveY },
    fire1,
    fire2,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function skipUnless(urls, label) {
  const missing = urls.filter((url) => !existsSync(url));
  return {
    skip: missing.length === 0
      ? false
      : `${label} unavailable: ${missing.map(({ pathname }) => pathname).join(", ")}`,
  };
}
