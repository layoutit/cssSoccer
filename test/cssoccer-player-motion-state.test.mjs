import assert from "node:assert/strict";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import test from "node:test";

import {
  CSSOCCER_NATIVE_ACTIONS,
  createCssoccerActionResolution,
} from "../src/cssoccer/actionState.mjs";
import {
  CSSOCCER_SPEED_INTENT,
} from "../src/cssoccer/motionState.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
} from "../src/cssoccer/nativeGameplayProfile.mjs";
import {
  stepCssoccerKickoffPlayerMotion,
} from "../src/cssoccer/kickoffPlayerMotion.mjs";
import { createCssoccerMatchState } from "../src/cssoccer/matchState.mjs";
import {
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  projectCssoccerNativeTeamRates,
} from "../src/cssoccer/nativeFixturePlayerProfile.mjs";
import {
  CSSOCCER_PLAYER_AI_INTENT_SCHEMA,
} from "../src/cssoccer/playerAi.mjs";
import {
  CSSOCCER_PLAYER_MOTION_SOURCE,
  CssoccerUnsupportedPlayerMotionError,
  assertCssoccerPlayerMotionState,
  createCssoccerAiMotionCommand,
  createCssoccerPlayerMotionState,
  projectCssoccerPlayerMotionNativeFields,
  rebaseCssoccerPlayerMotionFromKickoff,
  remapCssoccerPlayerMotionHalf,
  resetCssoccerPlayerMotionState,
  stepCssoccerPlayerMotionState,
} from "../src/cssoccer/playerMotionState.mjs";
import {
  createCssoccerPlayerStaminaState,
  projectCssoccerPlayerStaminaTeamRates,
  stepCssoccerPlayerStaminaState,
} from "../src/cssoccer/playerStaminaState.mjs";
import {
  createCssoccerSelectionFrame,
} from "../src/cssoccer/playerSelection.mjs";
import {
  createCssoccerTeamState,
  swapCssoccerTeamEnds,
} from "../src/cssoccer/teamState.mjs";
import {
  createCssoccerUserControl,
  stepCssoccerUserControl,
} from "../src/cssoccer/userControl.mjs";

const f32 = Math.fround;
const generatedRoot = new URL("../build/generated/public/cssoccer/", import.meta.url);
const fixtureFiles = {
  facts: new URL("facts/spain-argentina-full-match.json", generatedRoot),
  scene: new URL("scenes/spain-argentina-full-match.json", generatedRoot),
};
const retainedState = new URL(
  "../.local/cssoccer/oracle/native/retained/runs/canonical-a/state.jsonl",
  import.meta.url,
);
const missingFixture = Object.values(fixtureFiles).filter((url) => !existsSync(url));
const fixtureOptions = {
  skip: missingFixture.length > 0
    ? `prepared fixture unavailable: ${missingFixture.map(({ pathname }) => pathname).join(", ")}`
    : false,
};
const retainedOptions = {
  skip: missingFixture.length > 0 || !existsSync(retainedState)
    ? "prepared fixture or ignored canonical native stream unavailable"
    : false,
};
const pitch = Object.freeze({ length: 1280, width: 800 });
const ball = Object.freeze({ possession: 0, inHands: false });

test("baseline is an immutable exact 22-player state and tm_rate is explicit", fixtureOptions, () => {
  for (const selectedCountry of ["spain", "argentina"]) {
    const teamState = preparedTeamState(selectedCountry);
    const rates = teamRates(teamState, 64);
    const state = createCssoccerPlayerMotionState({
      teamState,
      gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      teamRates: rates,
    });

    assert.equal(assertCssoccerPlayerMotionState(state), state);
    assert.equal(state.players.length, 22);
    assert.equal(state.tick, 0);
    assert.equal(state.sourceFrame, false);
    assert.equal(state.selectedCountry, selectedCountry);
    assert.deepEqual(state.lastProcessedOrder, []);
    assert.deepEqual(state.players.map(({ nativePlayerNumber }) => nativePlayerNumber),
      Array.from({ length: 22 }, (_, index) => index + 1));
    assert.ok(state.players.every(({ native }) => (
      native.action.value === CSSOCCER_NATIVE_ACTIONS.STAND
      && native.action.valueType === "i16"
      && native.control.value === 0
      && native.control.valueType === "u8"
      && native.on.value === 1
      && native.on.valueType === "i16"
    )));
    assert.ok(state.players.every(({ teamRate }) => (
      teamRate.value === 64
      && teamRate.valueType === "u8"
      && teamRate.numericBits === "40"
    )));
    assert.notEqual(state.players[0].teamRate.value, teamState.players[0].identity.attributes.pace);
    assert.equal(Object.isFrozen(state), true);
    assert.equal(Object.isFrozen(state.players[0].position), true);
  }

  const teamState = preparedTeamState("spain");
  const rates = teamRates(teamState, 64);
  assert.throws(
    () => createCssoccerPlayerMotionState({
      teamState,
      gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    }),
    unsupported("team-rate-materialization"),
  );
  assert.throws(
    () => createCssoccerPlayerMotionState({
      teamState,
      gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      teamRates: Object.fromEntries(rates.map(({ id, value }) => [id, value])),
    }),
    unsupported("team-rate-materialization"),
  );
  assert.throws(
    () => createCssoccerPlayerMotionState({
      teamState,
      gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      teamRates: [rates[1], rates[0], ...rates.slice(2)],
    }),
    unsupported("team-rate-materialization"),
  );
  const badBits = clone(rates);
  badBits[0].numericBits = "00";
  assert.throws(
    () => createCssoccerPlayerMotionState({
      teamState,
      gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      teamRates: badBits,
    }),
    /numeric bits/u,
  );

  const boundRates = projectCssoccerNativeTeamRates(
    CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
    { matchHalf: 0 },
  );
  const bound = createCssoccerPlayerMotionState({
    teamState,
    gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    teamRates: boundRates,
  });
  assert.deepEqual(
    bound.players.map(({ id, teamRate }) => ({ id, value: teamRate.value })),
    boundRates.map(({ id, value }) => ({ id, value })),
  );
});

test("settled kickoff rebases all 22 exact players into live motion at tick 171", retainedOptions, async () => {
  const rebasedByCountry = new Map();
  for (const selectedCountry of ["spain", "argentina"]) {
    const handoff = openingHandoff(selectedCountry, 171);
    const rebased = rebaseCssoccerPlayerMotionFromKickoff(handoff.baseline, {
      kickoffMotion: handoff.kickoffMotion,
      teamRates: handoff.teamRates,
      controlledPlayerId: null,
    });
    assert.equal(rebased.tick, 171);
    assert.equal(rebased.sourceFrame, true);
    assert.deepEqual(rebased.lastProcessedOrder, []);
    assert.ok(rebased.players.every(({ native }) => native.control.value === 0));
    assert.deepEqual(
      rebased.players.map(({ id, position, facing, native, teamRate }) => ({
        id,
        position,
        facing,
        action: native.action,
        teamRate,
      })),
      handoff.kickoffMotion.players.map((player) => ({
        id: player.id,
        position: { ...player.position, z: 0 },
        facing: {
          ...player.facing,
          direction: field(
            projectCssoccerPlayerMotionNativeFields(rebased),
            `players.${player.id}.face_direction`,
          ),
        },
        action: field(
          projectCssoccerPlayerMotionNativeFields(rebased),
          `players.${player.id}.action`,
        ),
        teamRate: rebased.players.find(({ id }) => id === player.id).teamRate,
      })),
    );
    assert.equal(
      JSON.stringify(rebased),
      JSON.stringify(rebaseCssoccerPlayerMotionFromKickoff(handoff.baseline, {
        kickoffMotion: handoff.kickoffMotion,
        teamRates: handoff.teamRates,
        controlledPlayerId: null,
      })),
    );
    rebasedByCountry.set(selectedCountry, rebased);
  }

  const projected = new Map(
    projectCssoccerPlayerMotionNativeFields(rebasedByCountry.get("argentina"))
      .map((entry) => [entry.fieldId, entry]),
  );
  const retained = await retainedFieldsAtTick(171, new Set(projected.keys()));
  assert.equal(retained.size, projected.size);
  for (const [fieldId, actual] of projected) {
    const expected = retained.get(fieldId);
    assert.deepEqual(actual, {
      fieldId: expected.fieldId,
      valueType: expected.valueType,
      value: expected.value,
      numericBits: expected.numericBits,
    }, fieldId);
  }
});

test("kickoff handoff rejects unsettled, mistyped-rate, and wrong-country control seams", fixtureOptions, () => {
  const handoff = openingHandoff("argentina", 171);
  const unsettled = openingHandoff("argentina", 170);
  assert.throws(
    () => rebaseCssoccerPlayerMotionFromKickoff(handoff.baseline, {
      kickoffMotion: unsettled.kickoffMotion,
      teamRates: unsettled.teamRates,
      controlledPlayerId: null,
    }),
    unsupported("kickoff-handoff"),
  );
  const badRates = clone(handoff.teamRates);
  badRates[0].numericBits = "00";
  assert.throws(
    () => rebaseCssoccerPlayerMotionFromKickoff(handoff.baseline, {
      kickoffMotion: handoff.kickoffMotion,
      teamRates: badRates,
      controlledPlayerId: null,
    }),
    /numeric bits/u,
  );
  assert.throws(
    () => rebaseCssoccerPlayerMotionFromKickoff(handoff.baseline, {
      kickoffMotion: handoff.kickoffMotion,
      teamRates: handoff.teamRates,
      controlledPlayerId: "spain-player-07",
    }),
    unsupported("kickoff-control"),
  );
});

test("one source tick visits A/B then B/A, with action movement before turning", fixtureOptions, () => {
  const countryResults = new Map();
  for (const selectedCountry of ["spain", "argentina"]) {
    const teamState = preparedTeamState(selectedCountry);
    const rates = teamRates(teamState, 64);
    const initial = createCssoccerPlayerMotionState({
      teamState,
      gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      teamRates: rates,
    });
    const user = userAtTickOne(teamState, initial, { moveX: 0, moveY: 127 });
    const aiCommands = aiCommandsFor(initial, user.result.selection.activePlayerId, {
      tick: 1,
      moving: true,
    });
    const first = stepCssoccerPlayerMotionState(initial, {
      tick: 1,
      userResult: user.result,
      aiCommands,
      ball,
      pitch,
      gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      teamRates: teamRates(teamState, 63),
    });
    const repeated = stepCssoccerPlayerMotionState(initial, {
      tick: 1,
      userResult: user.result,
      aiCommands,
      ball,
      pitch,
      gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      teamRates: teamRates(teamState, 63),
    });
    assert.deepEqual(repeated, first);
    assert.equal(JSON.stringify(repeated), JSON.stringify(first));
    assert.equal(first.sourceFrame, true);
    assert.deepEqual(first.lastProcessedOrder, nativeOrder(initial, true));
    assert.ok(first.players.every(({ native }) => native.action.value === CSSOCCER_NATIVE_ACTIONS.RUN));
    assert.ok(first.players.every(({ teamRate }) => teamRate.value === 63));
    assert.equal(first.players.filter(({ native }) => native.control.value === 1).length, 1);

    const activeId = user.result.selection.activePlayerId;
    const before = player(initial, activeId);
    const after = player(first, activeId);
    assert.equal(after.native.control.value, 1);
    assert.equal(after.native.action.value, CSSOCCER_NATIVE_ACTIONS.RUN);
    assert.equal(after.position.y, before.position.y);
    assert.ok((after.position.x - before.position.x) * before.facing.x > 0);
    assert.notEqual(after.facing.y, before.facing.y);
    countryResults.set(selectedCountry, { before, after });

    const user2 = nextUserResult(user.state, first, 2, { moveX: 0, moveY: 127 });
    const second = stepCssoccerPlayerMotionState(first, {
      tick: 2,
      userResult: user2.result,
      aiCommands: aiCommandsFor(first, activeId, { tick: 2, moving: true }),
      ball,
      pitch,
      gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    });
    assert.equal(second.sourceFrame, false);
    assert.deepEqual(second.lastProcessedOrder, nativeOrder(first, false));
  }

  const spain = countryResults.get("spain");
  const argentina = countryResults.get("argentina");
  assert.equal(
    spain.after.position.x - spain.before.position.x,
    -(argentina.after.position.x - argentina.before.position.x),
  );
  assert.equal(spain.after.facing.x, -argentina.after.facing.x);
  assert.equal(spain.after.facing.y, argentina.after.facing.y);
});

test("explicit STAND/hold keeps all positions and transfers control only to the chosen country", fixtureOptions, () => {
  for (const selectedCountry of ["spain", "argentina"]) {
    const teamState = preparedTeamState(selectedCountry);
    const rates = teamRates(teamState, 72);
    const initial = createCssoccerPlayerMotionState({
      teamState,
      gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      teamRates: rates,
    });
    const user = userAtTickOne(teamState, initial);
    const next = stepCssoccerPlayerMotionState(initial, {
      tick: 1,
      userResult: user.result,
      aiCommands: aiCommandsFor(initial, user.result.selection.activePlayerId, {
        tick: 1,
        moving: false,
      }),
      ball,
      pitch,
      gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    });
    assert.deepEqual(
      next.players.map(({ position }) => position),
      initial.players.map(({ position }) => position),
    );
    assert.ok(next.players.every(({ native }) => native.action.value === CSSOCCER_NATIVE_ACTIONS.STAND));
    const controlled = next.players.find(({ native }) => native.control.value === 1);
    assert.equal(controlled.country, selectedCountry);
    assert.equal(controlled.id, `${selectedCountry}-player-02`);

    const reset = resetCssoccerPlayerMotionState(next, {
      teamState,
      gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      teamRates: rates,
    });
    assert.deepEqual(reset, initial);
    assert.throws(
      () => resetCssoccerPlayerMotionState(next, {
        teamState,
        gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
        teamRates: teamRates(teamState, 73),
      }),
      unsupported("team-rate-materialization"),
    );
  }
});

test("accepted user burst-run consumes the typed user timer and takes the source speed branch", fixtureOptions, () => {
  const teamState = preparedTeamState("spain");
  const rates = teamRates(teamState, 64);
  const initial = createCssoccerPlayerMotionState({
    teamState,
    gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    teamRates: rates,
  });
  const normalUser = userAtTickOne(teamState, initial, { moveX: 127 });
  const burstUser = userAtTickOne(teamState, initial, {
    moveX: 127,
    buttons: 2,
    possessionPlayerId: "argentina-player-02",
    actionResolution: createCssoccerActionResolution({
      opponentWithinStealRange: false,
    }),
  });
  assert.equal(burstUser.result.actionCommand.kind, "burst-run");
  assert.equal(burstUser.result.sprint.timer.value, 20);
  const activeId = burstUser.result.selection.activePlayerId;
  const normal = stepCssoccerPlayerMotionState(initial, {
    tick: 1,
    userResult: normalUser.result,
    aiCommands: aiCommandsFor(initial, activeId, { tick: 1, moving: false }),
    ball,
    pitch,
    gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  });
  const burst = stepCssoccerPlayerMotionState(initial, {
    tick: 1,
    userResult: burstUser.result,
    aiCommands: aiCommandsFor(initial, activeId, { tick: 1, moving: false }),
    ball: { possession: 13, inHands: false },
    pitch,
    gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  });
  const before = player(initial, activeId);
  const normalDistance = player(normal, activeId).position.x - before.position.x;
  const burstDistance = player(burst, activeId).position.x - before.position.x;
  assert.ok(burstDistance > normalDistance);
});

test("halftime remaps native slots while preserving stable live motion", fixtureOptions, () => {
  const teamState = preparedTeamState("spain");
  const initial = createCssoccerPlayerMotionState({
    teamState,
    gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    teamRates: teamRates(teamState, 64),
  });
  const swappedTeamState = swapCssoccerTeamEnds(teamState);
  const swapped = remapCssoccerPlayerMotionHalf(initial, {
    teamState: swappedTeamState,
    gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  });
  assert.equal(swapped.matchHalf, 1);
  assert.equal(player(swapped, "spain-player-01").nativePlayerNumber, 12);
  assert.equal(player(swapped, "argentina-player-01").nativePlayerNumber, 1);
  for (const before of initial.players) {
    const after = player(swapped, before.id);
    assert.deepEqual(after.position, before.position);
    assert.deepEqual(after.facing, before.facing);
    assert.deepEqual(after.native.action, before.native.action);
    assert.deepEqual(after.teamRate, before.teamRate);
  }

  const user = userAtTickOne(swappedTeamState, swapped);
  const next = stepCssoccerPlayerMotionState(swapped, {
    tick: 1,
    userResult: user.result,
    aiCommands: aiCommandsFor(swapped, user.result.selection.activePlayerId, {
      tick: 1,
      moving: false,
    }),
    ball,
    pitch,
    gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  });
  assert.equal(next.lastProcessedOrder[0], "argentina-player-01");
  assert.equal(next.lastProcessedOrder.at(-1), "spain-player-11");
  assert.equal(player(next, "spain-player-02").native.control.value, 1);

  const stale = aiCommandsFor(swapped, user.result.selection.activePlayerId, {
    tick: 1,
    moving: false,
  }).map(clone);
  stale[0].sourceIntent.nativePlayerNumber += 11;
  stale[0].sourceIntent.nativeTeamSlot = "B";
  assert.throws(
    () => stepCssoccerPlayerMotionState(swapped, {
      tick: 1,
      userResult: user.result,
      aiCommands: stale,
      ball,
      pitch,
      gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    }),
    unsupported("native-order"),
  );

  assert.throws(
    () => remapCssoccerPlayerMotionHalf(swapped, {
      teamState: swappedTeamState,
      gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    }),
    unsupported("halftime-remap"),
  );
});

test("unsupported action choice, unmaterialized AI, ordering, profile, and pitch edges fail closed", fixtureOptions, () => {
  const teamState = preparedTeamState("spain");
  const initial = createCssoccerPlayerMotionState({
    teamState,
    gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    teamRates: teamRates(teamState, 64),
  });
  const user = userAtTickOne(teamState, initial);
  const activeId = user.result.selection.activePlayerId;
  const commands = aiCommandsFor(initial, activeId, { tick: 1, moving: false });
  const step = (overrides = {}) => stepCssoccerPlayerMotionState(initial, {
    tick: 1,
    userResult: user.result,
    aiCommands: commands,
    ball,
    pitch,
    gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    ...overrides,
  });

  assert.throws(() => step({ tick: 2 }), /contiguous/u);
  assert.throws(
    () => step({ aiCommands: [commands[1], commands[0], ...commands.slice(2)] }),
    unsupported("native-order"),
  );

  const wrongBefore = createCssoccerAiMotionCommand({
    tick: 1,
    intent: commands[0].sourceIntent,
    actionBefore: CSSOCCER_NATIVE_ACTIONS.RUN,
    actionAfter: CSSOCCER_NATIVE_ACTIONS.STAND,
    motion: { kind: "hold", target: null, facing: null },
    speedIntent: CSSOCCER_SPEED_INTENT.normal,
    intentionCount: 0,
    sideStep: false,
  });
  assert.throws(
    () => step({ aiCommands: [wrongBefore, ...commands.slice(1)] }),
    unsupported("action-order"),
  );

  const firstAi = player(initial, commands[0].playerId);
  const unmaterialized = aiIntent(firstAi, "run", {
    target: { x: firstAi.position.x, y: firstAi.position.y },
    actionStatus: "requires-action-semantics",
  });
  assert.throws(
    () => createCssoccerAiMotionCommand({
      tick: 1,
      intent: unmaterialized,
      actionBefore: 0,
      actionAfter: 1,
      motion: {
        kind: "target",
        target: unmaterialized.target,
        facing: null,
      },
      speedIntent: CSSOCCER_SPEED_INTENT.normal,
      intentionCount: 0,
      sideStep: false,
    }),
    unsupported("ai-action-semantics"),
  );
  assert.throws(
    () => createCssoccerAiMotionCommand({
      tick: 1,
      intent: aiIntent(firstAi, "hold", { oracleSample: 1 }),
      actionBefore: 0,
      actionAfter: 0,
      motion: { kind: "hold", target: null, facing: null },
      speedIntent: CSSOCCER_SPEED_INTENT.normal,
      intentionCount: 0,
      sideStep: false,
    }),
    unsupported("evidence-input"),
  );
  assert.throws(
    () => createCssoccerAiMotionCommand({
      tick: 1,
      intent: aiIntent(firstAi, "hold"),
      actionBefore: 0,
      actionAfter: 0,
      motion: { kind: "hold", target: null, facing: null },
      speedIntent: CSSOCCER_SPEED_INTENT.normal,
      intentionCount: 0,
      sideStep: true,
    }),
    unsupported("side-step"),
  );

  const pass = clone(user.result);
  pass.actionCommand.kind = "pass";
  assert.throws(() => step({ userResult: pass }), unsupported("user-action-semantics"));
  const wrongProfile = clone(CSSOCCER_NATIVE_GAMEPLAY_PROFILE);
  wrongProfile.profileHash = "0".repeat(64);
  assert.throws(() => step({ gameplayProfile: wrongProfile }), /profile hash/u);
  assert.throws(() => step({ pitch: { ...pitch, fallback: 1 } }), /exactly/u);

  const outside = clone(initial);
  player(outside, activeId).position.x = f32(-100);
  const outwardUser = userAtTickOne(teamState, outside, { moveX: -127, moveY: 0 });
  assert.throws(
    () => stepCssoccerPlayerMotionState(outside, {
      tick: 1,
      userResult: outwardUser.result,
      aiCommands: aiCommandsFor(outside, activeId, { tick: 1, moving: false }),
      ball,
      pitch,
      gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    }),
    unsupported("pitch-edge"),
  );
});

test("native projection preserves exact field types, bits, and lexical order", fixtureOptions, () => {
  const teamState = preparedTeamState("argentina");
  const state = createCssoccerPlayerMotionState({
    teamState,
    gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    teamRates: teamRates(teamState, 64),
  });
  const fields = projectCssoccerPlayerMotionNativeFields(state);
  assert.equal(fields.length, 264);
  assert.deepEqual(
    fields.map(({ fieldId }) => fieldId),
    fields.map(({ fieldId }) => fieldId).slice().sort(),
  );
  assert.deepEqual(field(fields, "players.spain-player-01.action"), {
    fieldId: "players.spain-player-01.action",
    valueType: "i16",
    value: 0,
    numericBits: "0000",
  });
  assert.deepEqual(field(fields, "players.argentina-player-01.native_player"), {
    fieldId: "players.argentina-player-01.native_player",
    valueType: "i16",
    value: 12,
    numericBits: "000c",
  });
  assert.deepEqual(field(fields, "players.spain-player-01.x"), {
    fieldId: "players.spain-player-01.x",
    valueType: "f32",
    value: 618.6666870117188,
    numericBits: "441aaaab",
  });
});

test("optional test-only tick-zero qualification matches all 264 retained native fields", retainedOptions, async () => {
  const teamState = preparedTeamState("argentina");
  const state = createCssoccerPlayerMotionState({
    teamState,
    gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    teamRates: teamRates(teamState, 64),
  });
  const projected = new Map(projectCssoccerPlayerMotionNativeFields(state)
    .map((entry) => [entry.fieldId, entry]));
  const retained = new Map();
  const stream = createReadStream(retainedState);
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of lines) {
    const record = JSON.parse(line);
    if (record.recordType !== "sample") continue;
    if (record.tick > 0) break;
    if (projected.has(record.fieldId)) retained.set(record.fieldId, record);
  }
  lines.close();
  stream.destroy();
  assert.equal(retained.size, projected.size);
  for (const [fieldId, actual] of projected) {
    const expected = retained.get(fieldId);
    assert.deepEqual(actual, {
      fieldId: expected.fieldId,
      valueType: expected.valueType,
      value: expected.value,
      numericBits: expected.numericBits,
    }, fieldId);
  }
});

test("runtime is source-bound, browser-safe, and contains no retained-value fallback", () => {
  assert.deepEqual(
    CSSOCCER_PLAYER_MOTION_SOURCE.files.map(({ file, sha256 }) => [file, sha256]),
    [
      ["ACTIONS.CPP", "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508"],
      ["INTELL.CPP", "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad"],
      ["USER.CPP", "d4e9a3bc0192780eadb7a32d766a6f40a63115e5fa3e3a39cf8a6e7849c6e1bc"],
    ],
  );
  assert.deepEqual(CSSOCCER_PLAYER_MOTION_SOURCE.processOrder.slice(-2), [
    "apply explicit action and action movement",
    "turn facing in process_dir after the action",
  ]);
  const source = readFileSync(
    new URL("../src/cssoccer/playerMotionState.mjs", import.meta.url),
    "utf8",
  );
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/gu)]
    .map((match) => match[1]);
  assert.ok(imports.every((specifier) => specifier.startsWith("./")));
  assert.doesNotMatch(source, /node:|readFile|createReadStream/u);
  assert.doesNotMatch(source, /attributes\.pace/u);
});

const handoffCache = new Map();

function openingHandoff(selectedCountry, tick) {
  const key = `${selectedCountry}:${tick}`;
  if (handoffCache.has(key)) return handoffCache.get(key);
  const match = createCssoccerMatchState({
    preparedFacts: JSON.parse(readFileSync(fixtureFiles.facts, "utf8")),
    preparedScene: JSON.parse(readFileSync(fixtureFiles.scene, "utf8")),
    selectedCountry,
  });
  let kickoffMotion = match.kickoffMotion;
  let stamina = createCssoccerPlayerStaminaState({
    nativeFixturePlayerProfile: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  });
  for (let currentTick = 1; currentTick <= tick; currentTick += 1) {
    stamina = stepCssoccerPlayerStaminaState(stamina, {
      tick: currentTick,
      gameMinute: Math.floor((currentTick * 9) / 240),
    });
    kickoffMotion = stepCssoccerKickoffPlayerMotion(kickoffMotion, {
      teamRates: projectCssoccerPlayerStaminaTeamRates(stamina),
    });
  }
  const result = {
    baseline: match.playerMotion,
    kickoffMotion,
    teamRates: projectCssoccerPlayerStaminaTeamRates(stamina),
  };
  handoffCache.set(key, result);
  return result;
}

async function retainedFieldsAtTick(tick, wanted) {
  const retained = new Map();
  const stream = createReadStream(retainedState);
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of lines) {
    const record = JSON.parse(line);
    if (record.recordType !== "sample") continue;
    if (record.tick > tick) break;
    if (record.tick === tick && wanted.has(record.fieldId)) {
      retained.set(record.fieldId, record);
    }
  }
  lines.close();
  stream.destroy();
  return retained;
}

function preparedTeamState(selectedCountry) {
  return createCssoccerTeamState({
    preparedFacts: JSON.parse(readFileSync(fixtureFiles.facts, "utf8")),
    preparedScene: JSON.parse(readFileSync(fixtureFiles.scene, "utf8")),
    selectedCountry,
  });
}

function teamRates(teamState, value) {
  return teamState.players
    .slice()
    .sort((left, right) => left.current.nativePlayerNumber - right.current.nativePlayerNumber)
    .map((entry) => ({
      id: entry.id,
      nativePlayerNumber: entry.current.nativePlayerNumber,
      valueType: "u8",
      value,
      numericBits: value.toString(16).padStart(2, "0"),
    }));
}

function userAtTickOne(teamState, motionState, movement = {}) {
  let control = createCssoccerUserControl({ teamState });
  const activeId = `${teamState.control.selectedCountry}-player-02`;
  const selected = stepCssoccerUserControl(control, {
    command: { tick: 0, moveX: 0, moveY: 0, buttons: 0 },
    selectionFrame: selectionFrame(control, motionState, 0, activeId, false),
  });
  control = selected.state;
  return stepCssoccerUserControl(control, {
    command: {
      tick: 1,
      moveX: movement.moveX ?? 0,
      moveY: movement.moveY ?? 0,
      buttons: movement.buttons ?? 0,
    },
    selectionFrame: selectionFrame(control, motionState, 1, activeId, true, {
      possessionPlayerId: movement.possessionPlayerId ?? null,
    }),
    actionResolution: movement.actionResolution,
  });
}

function nextUserResult(control, motionState, tick, movement = {}) {
  const activeId = control.selection.activePlayerId;
  return stepCssoccerUserControl(control, {
    command: {
      tick,
      moveX: movement.moveX ?? 0,
      moveY: movement.moveY ?? 0,
      buttons: 0,
    },
    selectionFrame: selectionFrame(control, motionState, tick, activeId, true),
  });
}

function selectionFrame(control, motionState, tick, activeId, selected, {
  possessionPlayerId = null,
} = {}) {
  const byId = new Map(motionState.players.map((entry) => [entry.id, entry]));
  const candidates = control.selection.nativeOrder.map(({ playerId }, index) => {
    const motion = byId.get(playerId);
    return {
      playerId,
      on: motion.native.on.value,
      controlUser: selected && playerId === activeId ? 1 : 0,
      actionId: motion.native.action.value,
      falling: false,
      distance: f32(playerId === activeId ? 1 : 100 + index),
      selectionCircle: selected && playerId === activeId,
      facingX: motion.facing.x,
      facingY: motion.facing.y,
    };
  });
  return createCssoccerSelectionFrame(control.selection, {
    tick,
    candidates,
    possessionPlayerId,
    receiverPlayerId: null,
    interceptorPlayerId: null,
    nearPathPlayerId: null,
    userTakerPlayerId: null,
  });
}

function aiCommandsFor(state, activeId, { tick, moving }) {
  const order = nativeOrder(state, !state.sourceFrame).filter((id) => id !== activeId);
  return order.map((id) => {
    const current = player(state, id);
    const target = {
      x: f32(current.position.x + f32(current.facing.x * f32(100))),
      y: f32(current.position.y + f32(current.facing.y * f32(100))),
    };
    const intent = moving
      ? aiIntent(current, "zonal", { target })
      : aiIntent(current, "hold");
    return createCssoccerAiMotionCommand({
      tick,
      intent,
      actionBefore: current.native.action.value,
      actionAfter: moving ? CSSOCCER_NATIVE_ACTIONS.RUN : CSSOCCER_NATIVE_ACTIONS.STAND,
      motion: moving
        ? { kind: "target", target, facing: null }
        : { kind: "hold", target: null, facing: null },
      speedIntent: CSSOCCER_SPEED_INTENT.normal,
      intentionCount: 0,
      sideStep: false,
    });
  });
}

function aiIntent(current, kind, details = {}) {
  return {
    schema: CSSOCCER_PLAYER_AI_INTENT_SCHEMA,
    playerId: current.id,
    nativePlayerNumber: current.nativePlayerNumber,
    nativeTeamSlot: current.nativeTeamSlot,
    kind,
    ...details,
  };
}

function nativeOrder(state, sourceFrame) {
  const slots = sourceFrame ? ["A", "B"] : ["B", "A"];
  return slots.flatMap((slot) => state.players
    .filter((entry) => entry.nativeTeamSlot === slot)
    .slice()
    .sort((left, right) => left.nativePlayerNumber - right.nativePlayerNumber)
    .map(({ id }) => id));
}

function player(state, id) {
  return state.players.find((entry) => entry.id === id);
}

function field(fields, fieldId) {
  return fields.find((entry) => entry.fieldId === fieldId);
}

function unsupported(boundary) {
  return (error) => error instanceof CssoccerUnsupportedPlayerMotionError
    && error.boundary === boundary;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
