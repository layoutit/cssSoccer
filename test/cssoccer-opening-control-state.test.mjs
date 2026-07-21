import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  readFileSync,
} from "node:fs";
import { createInterface } from "node:readline";
import test from "node:test";

import {
  CSSOCCER_NATIVE_ACTIONS,
  createCssoccerActionState,
} from "../src/cssoccer/actionState.mjs";
import { createBallMatchState } from "../src/cssoccer/ballMatchState.mjs";
import { launchCssoccerCentrePass } from "../src/cssoccer/centrePassLaunch.mjs";
import {
  CSSOCCER_KICKOFF_SOURCE_PROFILE_SCHEMA,
  createCssoccerKickoffState,
  stepCssoccerKickoffState,
} from "../src/cssoccer/kickoffState.mjs";
import { stepCssoccerMatchLifecycle } from "../src/cssoccer/matchLifecycle.mjs";
import { createCssoccerMatchState } from "../src/cssoccer/matchState.mjs";
import {
  CSSOCCER_OPENING_CONTROL_SOURCE,
  CSSOCCER_OPENING_CONTROL_HANDOFF_EVENT_SCHEMA,
  CSSOCCER_OPENING_CONTROL_STATE_SCHEMA,
  CssoccerUnsupportedOpeningControlError,
  assertCssoccerOpeningControlHandoffEvent,
  assertCssoccerOpeningControlState,
  createCssoccerOpeningControlAction,
  createCssoccerOpeningControlHandoffEvent,
  createCssoccerOpeningControlOwnership,
  createCssoccerOpeningControlState,
  projectCssoccerOpeningControlNativeFields,
  stepCssoccerOpeningControlState,
} from "../src/cssoccer/openingControlState.mjs";
import { createPossessionState } from "../src/cssoccer/possessionState.mjs";

const F32 = Math.fround;
const GENERATED_ROOT = new URL(
  "../build/generated/public/cssoccer/",
  import.meta.url,
);
const FIXTURE_FILES = {
  facts: new URL("facts/spain-argentina-full-match.json", GENERATED_ROOT),
  scene: new URL("scenes/spain-argentina-full-match.json", GENERATED_ROOT),
};
const SOURCE_ROOT = new URL("../.local/actua-soccer/source/", import.meta.url);
const SOURCE_FILES = Object.fromEntries(
  CSSOCCER_OPENING_CONTROL_SOURCE.files.map(({ file }) => [
    file,
    new URL(file, SOURCE_ROOT),
  ]),
);
const RETAINED_ROOT = new URL(
  "../.local/cssoccer/oracle/native/retained/runs/canonical-a/",
  import.meta.url,
);
const RETAINED_STATE_URL = new URL("state.jsonl", RETAINED_ROOT);
const RETAINED_RAW_URL = new URL("native.raw", RETAINED_ROOT);
const RUNTIME_URL = new URL(
  "../src/cssoccer/openingControlState.mjs",
  import.meta.url,
);

const fixtureOptions = skipUnless(
  Object.values(FIXTURE_FILES),
  "prepared fixed fixture",
);
const retainedOptions = skipUnless(
  [...Object.values(FIXTURE_FILES), RETAINED_STATE_URL, RETAINED_RAW_URL],
  "prepared fixture and retained typed/raw native streams",
);
const sourceOptions = skipUnless(
  Object.values(SOURCE_FILES),
  "pinned Actua source",
);

const OPENING = Object.freeze({
  name: "opening Argentina control",
  selectedCountry: "argentina",
  matchHalf: 0,
  startTick: 172,
  endTick: 249,
  frontierTick: 250,
  expectedReleaseTick: 178,
  expectedCompleteTick: 185,
  expectedFrontierPlayerNumber: 3,
});
const POST_SWAP = Object.freeze({
  name: "post-swap Argentina control",
  selectedCountry: "argentina",
  matchHalf: 1,
  startTick: 1780,
  endTick: 1842,
  frontierTick: 1843,
  expectedReleaseTick: 1787,
  expectedCompleteTick: 1795,
  expectedFrontierPlayerNumber: 6,
});

const matchCache = new Map();
const secondHalfLifecycleCache = new Map();
const retainedCache = new Map();
let rawCache;
let retainedArtifactBindings;

test("all 22 opening u8 control fields match typed JSONL and raw bytes through the first later producer", retainedOptions, async () => {
  const retained = await retainedControls(OPENING.startTick, OPENING.frontierTick);
  const raw = retainedRawControls(new Set(range(OPENING.startTick, OPENING.frontierTick)));
  const run = runScenario(OPENING, OPENING.frontierTick);

  assert.equal(run.states.size, OPENING.endTick - OPENING.startTick + 1);
  assert.equal(firstReleaseTick(run.actions), OPENING.expectedReleaseTick);
  assert.equal(firstCompleteTick(run.actions), OPENING.expectedCompleteTick);
  assert.equal(run.states.get(OPENING.startTick).phase, "taker-controlled");
  assert.equal(run.states.get(OPENING.expectedReleaseTick).phase, "receiver-controlled");
  assert.equal(run.states.get(OPENING.startTick).handoffEvent, null);
  assertHandoffEvent(run, OPENING, {
    nativeTeamSlot: "B",
    previousNativePlayerNumber: 18,
    activeNativePlayerNumber: 21,
  });

  for (const [tick, state] of run.states) {
    assert.equal(assertCssoccerOpeningControlState(state), state);
    assertControlProjection(state, retained.get(tick), raw.get(tick));
  }

  const before = retained.get(OPENING.endTick);
  const frontier = retained.get(OPENING.frontierTick);
  assert.deepEqual(changedControlFields(before, frontier), [
    "players.argentina-player-03.control",
    "players.argentina-player-10.control",
  ]);
  assert.deepEqual(activeRetainedPlayers(frontier), ["argentina-player-03"]);

  const frontierOwnership = ownershipInput(
    run.teamState,
    OPENING.frontierTick,
    OPENING.expectedFrontierPlayerNumber,
  );
  assert.throws(
    () => stepCssoccerOpeningControlState(run.finalState, {
      action: run.actions.get(OPENING.frontierTick),
      ownership: frontierOwnership,
    }),
    (error) => error instanceof CssoccerUnsupportedOpeningControlError
      && error.boundary === "post-centre-pass-auto-select"
      && error.detail.producer === "USER.CPP auto_select_a/auto_select_b",
  );
});

test("post-swap stable Argentina identities consume native team-A slots and match the second centre window", retainedOptions, async () => {
  const retained = await retainedControls(POST_SWAP.startTick, POST_SWAP.frontierTick);
  const raw = retainedRawControls(new Set(range(POST_SWAP.startTick, POST_SWAP.frontierTick)));
  const first = runScenario(POST_SWAP, POST_SWAP.frontierTick);
  const duplicate = runScenario(POST_SWAP, POST_SWAP.frontierTick);

  assert.equal(first.teamState.current.nativeTeamBySlot.A, "argentina");
  assert.equal(first.teamState.control.currentNativeTeamSlot, "A");
  assert.equal(firstReleaseTick(first.actions), POST_SWAP.expectedReleaseTick);
  assert.equal(firstCompleteTick(first.actions), POST_SWAP.expectedCompleteTick);
  assert.equal(JSON.stringify([...first.states]), JSON.stringify([...duplicate.states]));

  const initial = first.states.get(POST_SWAP.startTick);
  const released = first.states.get(POST_SWAP.expectedReleaseTick);
  assert.equal(activePlayer(initial).id, "argentina-player-07");
  assert.equal(activePlayer(initial).nativePlayerNumber, 7);
  assert.equal(activePlayer(released).id, "argentina-player-10");
  assert.equal(activePlayer(released).nativePlayerNumber, 10);
  assertHandoffEvent(first, POST_SWAP, {
    nativeTeamSlot: "A",
    previousNativePlayerNumber: 7,
    activeNativePlayerNumber: 10,
  });

  for (const [tick, state] of first.states) {
    assertControlProjection(state, retained.get(tick), raw.get(tick));
  }
  assert.deepEqual(
    changedControlFields(retained.get(POST_SWAP.endTick), retained.get(POST_SWAP.frontierTick)),
    [
      "players.spain-player-06.control",
      "players.spain-player-10.control",
    ],
  );
  assert.deepEqual(activeRetainedPlayers(retained.get(POST_SWAP.frontierTick)), [
    "spain-player-06",
  ]);
  assert.throws(
    () => stepCssoccerOpeningControlState(first.finalState, {
      action: first.actions.get(POST_SWAP.frontierTick),
      ownership: ownershipInput(
        first.teamState,
        POST_SWAP.frontierTick,
        POST_SWAP.expectedFrontierPlayerNumber,
      ),
    }),
    (error) => error instanceof CssoccerUnsupportedOpeningControlError
      && error.boundary === CSSOCCER_OPENING_CONTROL_SOURCE.unsupportedNext.boundary
      && error.detail.previousActivePlayerId === "argentina-player-10"
      && error.detail.activePlayerId === "argentina-player-06"
      && `players.${error.detail.activePlayerId}.control`
        === "players.argentina-player-06.control",
  );
});

test("Spain ownership uses the same 7-to-10 reducer without changing fixture or native-slot arithmetic", fixtureOptions, () => {
  const scenario = {
    ...OPENING,
    name: "opening Spain control",
    selectedCountry: "spain",
  };
  const first = runScenario(scenario, OPENING.endTick);
  const duplicate = runScenario(scenario, OPENING.endTick);
  const initial = first.states.get(OPENING.startTick);
  const released = first.states.get(OPENING.expectedReleaseTick);

  assert.equal(initial.ownership.selectedNativeTeamSlot, "A");
  assert.equal(activePlayer(initial).id, "spain-player-07");
  assert.equal(activePlayer(initial).nativePlayerNumber, 7);
  assert.equal(activePlayer(released).id, "spain-player-10");
  assert.equal(activePlayer(released).nativePlayerNumber, 10);
  assertHandoffEvent(first, scenario, {
    nativeTeamSlot: "A",
    previousNativePlayerNumber: 7,
    activeNativePlayerNumber: 10,
  });
  assert.ok(initial.players
    .filter(({ country }) => country === "argentina")
    .every(({ control }) => control.value === 0));
  assert.equal(JSON.stringify([...first.states]), JSON.stringify([...duplicate.states]));
});

test("action, ownership, identity, type, and frontier drift fail closed", fixtureOptions, () => {
  const run = runScenario(OPENING, OPENING.endTick);
  const launchState = run.states.get(OPENING.startTick);
  assert.equal(launchState.schema, CSSOCCER_OPENING_CONTROL_STATE_SCHEMA);
  assertDeepFrozen(launchState);

  const wrongBits = structuredClone(launchState);
  const controlled = wrongBits.players.find(({ control }) => control.value === 1);
  controlled.control.numericBits = "00";
  assert.throws(
    () => assertCssoccerOpeningControlState(wrongBits),
    /u8 type|bits/u,
  );

  const nextAction = run.actions.get(OPENING.startTick + 1);
  const nextOwnership = ownershipInput(
    run.teamState,
    OPENING.startTick + 2,
    7,
  );
  assert.throws(
    () => stepCssoccerOpeningControlState(launchState, {
      action: nextAction,
      ownership: nextOwnership,
    }),
    /contiguous/u,
  );

  assert.throws(
    () => createCssoccerOpeningControlAction({
      tick: OPENING.startTick,
      launch: run.launch,
      releaseApplied: false,
      complete: true,
    }),
    /already have applied its release/u,
  );
  assert.throws(
    () => createCssoccerOpeningControlOwnership({
      tick: OPENING.startTick,
      teamState: run.teamState,
      activePlayerId: "spain-player-07",
    }),
    /selected country/u,
  );

  const released = run.states.get(OPENING.expectedReleaseTick);
  const wrongHandoffBits = structuredClone(released);
  wrongHandoffBits.handoffEvent.activeNativePlayer.numericBits = "0007";
  assert.throws(
    () => assertCssoccerOpeningControlState(wrongHandoffBits),
    /handoff event changed/u,
  );

  const wrongWriteOrder = structuredClone(released);
  wrongWriteOrder.handoffEvent.controlWrites.reverse();
  assert.throws(
    () => assertCssoccerOpeningControlState(wrongWriteOrder),
    /handoff event changed/u,
  );
});

test("pinned source fixes clear-then-assign order, receiver priority, and control consumption", sourceOptions, () => {
  for (const source of CSSOCCER_OPENING_CONTROL_SOURCE.files) {
    assert.equal(sha256(readFileSync(SOURCE_FILES[source.file])), source.sha256, source.file);
  }
  const user = readFileSync(SOURCE_FILES["USER.CPP"], "latin1");
  const actions = readFileSync(SOURCE_FILES["ACTIONS.CPP"], "latin1");
  const intelligence = readFileSync(SOURCE_FILES["INTELL.CPP"], "latin1");
  assert.match(
    user,
    /void clear_auto\(short u\)[\s\S]*teams\[i-1\]\.control=FALSE/u,
  );
  assert.match(
    user,
    /void auto_select_a\(short u\)[\s\S]*receiver_a[\s\S]*d<lowest[\s\S]*!sel_circle\[last_plr_a-1\][\s\S]*clear_auto\(u\)[\s\S]*teams\[guy-1\]\.control=u/u,
  );
  assert.match(
    user,
    /void auto_select_b\(short u\)[\s\S]*receiver_b[\s\S]*d<lowest[\s\S]*!sel_circle\[last_plr_b-1\][\s\S]*clear_auto\(u\)[\s\S]*teams\[guy-1\]\.control=u/u,
  );
  assert.match(
    intelligence,
    /void pass_ball\(int ps,char cross\)[\s\S]*receiver_a=FALSE[\s\S]*receiver_b=FALSE[\s\S]*holder_lose_ball\(\)[\s\S]*new_interceptor\(ps\)/u,
  );
  assert.match(
    intelligence,
    /void new_interceptor\(int p\)[\s\S]*receiver_a=p[\s\S]*receiver_b=p[\s\S]*reselect\(\)/u,
  );
  assert.match(
    actions,
    /void go_team\(int p\)[\s\S]*user_controlled=teams\[player_num-1\]\.control[\s\S]*user_play\(player_num\)/u,
  );
});

test("runtime is browser-safe and contains no evidence, Node, or captured-tick dependency", () => {
  const source = readFileSync(RUNTIME_URL, "utf8");
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/gu)]
    .map((match) => match[1]);
  assert.ok(imports.length > 0);
  assert.ok(imports.every((specifier) => specifier.startsWith("./")));
  assert.doesNotMatch(
    source,
    /node:|\.local\/|state\.jsonl|native\.raw|readFile|createReadStream/u,
  );
  assert.doesNotMatch(
    source,
    /\b(?:172|178|185|249|250|1780|1787|1795|1842|1843)\b/u,
  );
  assert.equal(
    CSSOCCER_OPENING_CONTROL_SOURCE.unsupportedNext.producer,
    "USER.CPP auto_select_a/auto_select_b",
  );
});

function runScenario(scenario, actionEndTick) {
  const lifecycle = scenario.matchHalf === 0
    ? preparedMatch(scenario.selectedCountry).lifecycle
    : secondHalfLifecycle(scenario.selectedCountry);
  const teamState = lifecycle.teamState;
  const launch = acceptedLaunch(scenario, lifecycle);
  const actions = new Map();
  for (let tick = scenario.startTick; tick <= actionEndTick; tick += 1) {
    actions.set(tick, createCssoccerOpeningControlAction({
      tick,
      launch,
      releaseApplied: tick >= scenario.expectedReleaseTick,
      complete: tick >= scenario.expectedCompleteTick,
    }));
  }
  const firstAction = actions.get(scenario.startTick);
  const firstOwnership = ownershipInput(
    teamState,
    scenario.startTick,
    firstAction.releaseApplied ? 10 : 7,
  );
  let state = createCssoccerOpeningControlState({
    launch,
    action: firstAction,
    ownership: firstOwnership,
  });
  const states = new Map([[state.tick, state]]);
  for (let tick = scenario.startTick + 1; tick <= scenario.endTick; tick += 1) {
    const action = actions.get(tick);
    state = stepCssoccerOpeningControlState(state, {
      action,
      ownership: ownershipInput(teamState, tick, action.releaseApplied ? 10 : 7),
    });
    states.set(tick, state);
  }
  return { launch, actions, teamState, states, finalState: state };
}

function ownershipInput(teamState, tick, fixtureNumber) {
  const id = `${teamState.control.selectedCountry}-player-${String(fixtureNumber).padStart(2, "0")}`;
  return createCssoccerOpeningControlOwnership({
    tick,
    teamState,
    activePlayerId: id,
  });
}

function acceptedLaunch(scenario, lifecycle) {
  const match = preparedMatch(scenario.selectedCountry);
  const pending = readyPending(createCssoccerKickoffState({
    lifecycle,
    tacticsState: match.tactics,
    sourceProfile: testSourceProfile(),
  }));
  return launchCssoccerCentrePass({
    tick: scenario.startTick,
    kickoff: pending,
    ball: createBallMatchState({
      ball: {
        tick: scenario.startTick,
        position: pending.ball.position,
        previousPosition: pending.ball.position,
      },
    }),
    possession: freePossession(pending.teamBySlot),
    takerAction: createCssoccerActionState({
      tick: scenario.startTick,
      playerId: pending.owner.takerId,
      actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
      facingX: F32(0),
      facingY: F32(1),
    }),
    gameplayProfile: {
      schema: "test-exact-gameplay-profile@1",
      profileHash: pending.bindings.sourceProfileHash,
    },
  });
}

function preparedMatch(selectedCountry) {
  if (!matchCache.has(selectedCountry)) {
    matchCache.set(selectedCountry, createCssoccerMatchState({
      preparedFacts: JSON.parse(readFileSync(FIXTURE_FILES.facts, "utf8")),
      preparedScene: JSON.parse(readFileSync(FIXTURE_FILES.scene, "utf8")),
      selectedCountry,
    }));
  }
  return matchCache.get(selectedCountry);
}

function secondHalfLifecycle(selectedCountry) {
  if (!secondHalfLifecycleCache.has(selectedCountry)) {
    let lifecycle = preparedMatch(selectedCountry).lifecycle;
    while (lifecycle.clock.phase !== "halftime-end-swap-second-half-kickoff") {
      lifecycle = stepCssoccerMatchLifecycle(lifecycle).state;
    }
    secondHalfLifecycleCache.set(selectedCountry, lifecycle);
  }
  return secondHalfLifecycleCache.get(selectedCountry);
}

function readyPending(state) {
  return stepCssoccerKickoffState(state, {
    players: state.players.map((player) => ({
      id: player.id,
      nativePlayerNumber: player.nativePlayerNumber,
      active: player.active,
      action: state.sourceProfile.actionIds.stand,
      directionMode: 0,
      offState: 0,
      position: { ...player.target },
      facing: player.role === "taker"
        ? { x: F32(0), y: F32(1) }
        : { x: F32(1), y: F32(0) },
    })),
    refereeAction: state.sourceProfile.officialActionIds.ready,
  });
}

function testSourceProfile() {
  return {
    schema: CSSOCCER_KICKOFF_SOURCE_PROFILE_SCHEMA,
    profileHash: "a".repeat(64),
    keeperOffline: F32(8),
    facingAngle: F32(0.99),
    besideBall: F32(4),
    setPieceWaitTicks: 5000,
    actionIds: { stand: 0, run: 1, pickup: 19 },
    officialActionIds: { normal: 0, positioning: 1, ready: 4, waitForKick: 2 },
  };
}

function freePossession(teamBySlot) {
  return createPossessionState({
    players: Array.from({ length: 22 }, (_, index) => {
      const nativePlayer = index + 1;
      const country = nativePlayer <= 11 ? teamBySlot.A : teamBySlot.B;
      const fixtureNumber = nativePlayer <= 11 ? nativePlayer : nativePlayer - 11;
      return {
        nativePlayer,
        stableId: `${country}-player-${String(fixtureNumber).padStart(2, "0")}`,
        possession: 0,
      };
    }),
  });
}

function assertControlProjection(state, retained, raw) {
  assert.equal(retained.size, 22, `retained control count tick ${state.tick}`);
  assert.equal(raw.size, 22, `raw control count tick ${state.tick}`);
  const fields = projectCssoccerOpeningControlNativeFields(state);
  assert.equal(fields.length, 22);
  assert.equal(fields.filter(({ value }) => value === 1).length, 1);
  for (const field of fields) {
    assert.equal(field.schema, "cssoccer-parity-stream@1");
    assert.equal(field.recordType, "sample");
    assert.equal(field.tick, state.tick);
    assert.equal(field.phase, "post_tick");
    assert.equal(field.valueType, "u8");
    const player = state.players.find(({ control }) => control.fieldId === field.fieldId);
    assert.ok(player, field.fieldId);
    const retainedId = rawFieldId(player.nativePlayerNumber);
    const expectedTyped = retained.get(retainedId);
    const expectedRaw = raw.get(retainedId);
    assert.deepEqual(
      scalar(expectedTyped),
      scalar(expectedRaw),
      `typed/raw authority tick ${state.tick} ${retainedId}`,
    );
    assert.deepEqual(
      scalar(field),
      scalar(expectedTyped),
      `opening control tick ${state.tick} ${field.fieldId} <- ${retainedId}`,
    );
  }
}

async function retainedControls(startTick, endTick) {
  const key = `${startTick}:${endTick}`;
  if (retainedCache.has(key)) return retainedCache.get(key);
  const ticks = new Map(range(startTick, endTick).map((tick) => [tick, new Map()]));
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
  retainedCache.set(key, ticks);
  return ticks;
}

function retainedRawControls(wantedTicks) {
  rawCache ??= readFileSync(RETAINED_RAW_URL);
  const bytes = rawCache;
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
    const activeTick = bytes.readUInt32LE(recordOffset + 20);
    const flags = bytes.readUInt32LE(recordOffset + 24);
    if ((flags & 1) === 0 || !wantedTicks.has(activeTick)) continue;
    const raw = {
      bytes,
      ranges,
      payloadOffset: recordOffset + metadataBytes,
    };
    const controls = new Map();
    for (let nativePlayerNumber = 1; nativePlayerNumber <= 22; nativePlayerNumber += 1) {
      const value = readRawU8(
        raw,
        0x3cf6c + ((nativePlayerNumber - 1) * 203) + 46,
      );
      controls.set(rawFieldId(nativePlayerNumber), {
        fieldId: rawFieldId(nativePlayerNumber),
        valueType: "u8",
        value,
        numericBits: value.toString(16).padStart(2, "0"),
      });
    }
    result.set(activeTick, controls);
  }
  assert.deepEqual([...result.keys()], [...wantedTicks]);
  return result;
}

function readRawU8(raw, offset) {
  const rangeEntry = raw.ranges.find((rangeEntry) => (
    offset >= rangeEntry.offset && offset < rangeEntry.offset + rangeEntry.size
  ));
  assert.ok(rangeEntry, `raw offset 0x${offset.toString(16)} is captured`);
  return raw.bytes.readUInt8(
    raw.payloadOffset + rangeEntry.payloadBase + offset - rangeEntry.offset,
  );
}

function rawFieldId(nativePlayerNumber) {
  const country = nativePlayerNumber <= 11 ? "spain" : "argentina";
  const fixtureNumber = ((nativePlayerNumber - 1) % 11) + 1;
  return `players.${country}-player-${String(fixtureNumber).padStart(2, "0")}.control`;
}

function changedControlFields(before, after) {
  return [...after]
    .filter(([fieldId, field]) => before.get(fieldId).numericBits !== field.numericBits)
    .map(([fieldId]) => fieldId)
    .sort();
}

function activeRetainedPlayers(fields) {
  return [...fields.values()]
    .filter(({ value }) => value === 1)
    .map(({ fieldId }) => fieldId.slice("players.".length, -".control".length))
    .sort();
}

function activePlayer(state) {
  const active = state.players.filter(({ control }) => control.value === 1);
  assert.equal(active.length, 1);
  return active[0];
}

function assertHandoffEvent(run, scenario, {
  nativeTeamSlot,
  previousNativePlayerNumber,
  activeNativePlayerNumber,
}) {
  const before = run.states.get(scenario.expectedReleaseTick - 1);
  const released = run.states.get(scenario.expectedReleaseTick);
  const end = run.states.get(scenario.endTick);
  const country = scenario.selectedCountry;
  const previousPlayerId = `${country}-player-07`;
  const activePlayerId = `${country}-player-10`;
  const expectedSelector = nativeTeamSlot === "A"
    ? "USER.CPP reselect_a/auto_select_a"
    : "USER.CPP reselect_b/auto_select_b";

  assert.equal(before.handoffEvent, null);
  assert.equal(released.handoffEvent.schema, CSSOCCER_OPENING_CONTROL_HANDOFF_EVENT_SCHEMA);
  assert.equal(released.handoffEvent.tick, scenario.expectedReleaseTick);
  assert.equal(released.handoffEvent.startTick, scenario.startTick);
  assert.equal(released.handoffEvent.matchHalf, scenario.matchHalf);
  assert.equal(released.handoffEvent.selectedCountry, country);
  assert.equal(released.handoffEvent.selectedNativeTeamSlot, nativeTeamSlot);
  assert.equal(released.handoffEvent.previousPlayerId, previousPlayerId);
  assert.equal(released.handoffEvent.activePlayerId, activePlayerId);
  assert.equal(
    released.handoffEvent.producer,
    `${CSSOCCER_OPENING_CONTROL_SOURCE.handoffEvent.producer} -> ${expectedSelector}`,
  );
  retainedArtifactBindings ??= {
    nativeRawSha256: sha256(readFileSync(RETAINED_RAW_URL)),
    nativeStateSha256: sha256(readFileSync(RETAINED_STATE_URL)),
  };
  assert.equal(
    released.handoffEvent.bindings.nativeRawSha256,
    retainedArtifactBindings.nativeRawSha256,
  );
  assert.equal(
    released.handoffEvent.bindings.nativeStateSha256,
    retainedArtifactBindings.nativeStateSha256,
  );
  assert.deepEqual(released.handoffEvent.previousNativePlayer, {
    fieldId: `players.${previousPlayerId}.native_player.before_centre_pass_handoff`,
    valueType: "i16",
    value: previousNativePlayerNumber,
    numericBits: previousNativePlayerNumber.toString(16).padStart(4, "0"),
  });
  assert.deepEqual(released.handoffEvent.activeNativePlayer, {
    fieldId: `players.${activePlayerId}.native_player.after_centre_pass_handoff`,
    valueType: "i16",
    value: activeNativePlayerNumber,
    numericBits: activeNativePlayerNumber.toString(16).padStart(4, "0"),
  });
  assert.deepEqual(released.handoffEvent.controlWrites, [
    {
      operation: "clear",
      field: {
        fieldId: `players.${previousPlayerId}.control`,
        valueType: "u8",
        value: 0,
        numericBits: "00",
      },
    },
    {
      operation: "assign",
      field: {
        fieldId: `players.${activePlayerId}.control`,
        valueType: "u8",
        value: 1,
        numericBits: "01",
      },
    },
  ]);
  assert.equal(
    assertCssoccerOpeningControlHandoffEvent(released.handoffEvent, {
      action: released.action,
      ownership: released.ownership,
    }),
    released.handoffEvent,
  );
  assert.deepEqual(end.handoffEvent, released.handoffEvent);
  assertDeepFrozen(released.handoffEvent);

  const directlyCreated = createCssoccerOpeningControlHandoffEvent(before, {
    action: released.action,
    ownership: released.ownership,
  });
  assert.deepEqual(directlyCreated, released.handoffEvent);
  assert.throws(
    () => createCssoccerOpeningControlHandoffEvent(released, {
      action: run.actions.get(scenario.expectedReleaseTick + 1),
      ownership: run.states.get(scenario.expectedReleaseTick + 1).ownership,
    }),
    /first centre-pass release edge/u,
  );
}

function firstReleaseTick(actions) {
  return [...actions.values()].find(({ releaseApplied }) => releaseApplied)?.tick ?? null;
}

function firstCompleteTick(actions) {
  return [...actions.values()].find(({ complete }) => complete)?.tick ?? null;
}

function scalar(field) {
  return {
    valueType: field.valueType,
    value: field.value,
    numericBits: field.numericBits,
  };
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

function skipUnless(urls, label) {
  const missing = urls.filter((url) => !existsSync(url));
  return {
    skip: missing.length === 0
      ? false
      : `${label} unavailable: ${missing.map(({ pathname }) => pathname).join(", ")}`,
  };
}
