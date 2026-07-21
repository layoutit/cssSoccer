import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import test from "node:test";

import {
  CSSOCCER_NATIVE_ACTIONS,
  createCssoccerActionState,
} from "../src/cssoccer/actionState.mjs";
import { createBallMatchState } from "../src/cssoccer/ballMatchState.mjs";
import {
  CSSOCCER_CENTRE_PASS_ACTION_PROFILE,
  CSSOCCER_CENTRE_PASS_ACTION_SCHEMA,
  CSSOCCER_CENTRE_PASS_ACTION_SOURCE,
  CssoccerUnsupportedCentrePassActionError,
  assertCssoccerCentrePassActionState,
  createCssoccerCentrePassAction,
  projectCssoccerCentrePassActionNativeFields,
  stepCssoccerCentrePassAction,
} from "../src/cssoccer/centrePassAction.mjs";
import {
  launchCssoccerCentrePass,
} from "../src/cssoccer/centrePassLaunch.mjs";
import {
  CSSOCCER_KICKOFF_SOURCE_PROFILE_SCHEMA,
  createCssoccerKickoffState,
  stepCssoccerKickoffState,
} from "../src/cssoccer/kickoffState.mjs";
import { stepCssoccerMatchLifecycle } from "../src/cssoccer/matchLifecycle.mjs";
import { createCssoccerMatchState } from "../src/cssoccer/matchState.mjs";
import { createPossessionState } from "../src/cssoccer/possessionState.mjs";
import {
  advanceCssoccerNativeRngMany,
  createCssoccerNativeRngState,
} from "../src/cssoccer/randomState.mjs";

const f32 = Math.fround;
const generatedRoot = new URL("../build/generated/public/cssoccer/", import.meta.url);
const fixtureFiles = {
  facts: new URL("facts/spain-argentina-full-match.json", generatedRoot),
  scene: new URL("scenes/spain-argentina-full-match.json", generatedRoot),
};
const sourceRoot = new URL("../.local/actua-soccer/source/", import.meta.url);
const sourceFiles = Object.fromEntries(
  CSSOCCER_CENTRE_PASS_ACTION_SOURCE.files.map(({ file }) => [
    file,
    new URL(file, sourceRoot),
  ]),
);
const retainedUrl = new URL(
  "../.local/cssoccer/oracle/native/retained/runs/canonical-a/state.jsonl",
  import.meta.url,
);
const fixtureOptions = skipUnless(Object.values(fixtureFiles), "prepared centre-pass fixture");
const sourceOptions = skipUnless(Object.values(sourceFiles), "pinned source and native build");
const retainedOptions = skipUnless(
  [...Object.values(fixtureFiles), retainedUrl],
  "prepared fixture and retained centre-pass windows",
);

const SCENARIOS = Object.freeze([
  Object.freeze({
    name: "opening Spain",
    startTick: 172,
    releaseTick: 178,
    receiptTick: 181,
    recoveryTick: 185,
    matchHalf: 0,
    country: "spain",
    motionCaptureSpeed: f32(1.171875),
    takerAccuracy: 88,
    wantedReceiver: false,
    prePassRngCalls: 178,
    releaseSeed: 84,
    receiverGo: Object.freeze({
      x: f32(2.8846144676208496),
      y: f32(0),
    }),
    receiptAnimationFrame: f32(0.19291053712368011),
    receiptGo: Object.freeze({
      x: f32(-0.33791249990463257),
      y: f32(-0.2361031323671341),
    }),
    releaseBits: Object.freeze({ x: "40ab3db9", y: "3f30aad4" }),
    recoveryFacing: Object.freeze({
      x: f32(0.3967474102973938),
      y: f32(0.9179278016090393),
    }),
  }),
  Object.freeze({
    name: "second-half Argentina",
    startTick: 1780,
    releaseTick: 1787,
    receiptTick: 1788,
    recoveryTick: 1795,
    matchHalf: 1,
    country: "argentina",
    motionCaptureSpeed: f32(1.0234375),
    takerAccuracy: 83,
    wantedReceiver: true,
    prePassRngCalls: 2031,
    releaseSeed: 92,
    receiverGo: Object.freeze({
      x: f32(1.0258337259292603),
      y: f32(-3.0471980571746826),
    }),
    receiptAnimationFrame: f32(0),
    receiptGo: Object.freeze({
      x: f32(1.5300663709640503),
      y: f32(-1.7535948753356934),
    }),
    releaseBits: Object.freeze({ x: "408d0ee4", y: "c04d1505" }),
    recoveryFacing: Object.freeze({
      x: f32(0.3379167318344116),
      y: f32(0.9411759972572327),
    }),
  }),
]);

let matchCache;
let secondHalfLifecycleCache;
let retainedCache;

test("MC_PASSL, contact release, native-10 receipt, and recovery match every retained owned field", retainedOptions, async () => {
  const retained = await retainedWindow();

  for (const scenario of SCENARIOS) {
    const result = runScenario(scenario, retained);
    assert.equal(result.state.schema, CSSOCCER_CENTRE_PASS_ACTION_SCHEMA);
    assert.equal(result.state.phase, "complete");
    assert.equal(result.state.receiptTick, scenario.receiptTick);
    assert.equal(result.state.owner.country, scenario.country);
    assert.equal(result.state.owner.takerId, `${scenario.country}-player-07`);
    assert.equal(result.state.owner.receiverId, `${scenario.country}-player-10`);
    assert.equal(result.state.release.rng.seed, scenario.releaseSeed);
    assert.equal(result.state.release.stableReceiverId, `${scenario.country}-player-10`);

    const releaseFields = projectionMap(result.states.get(scenario.releaseTick));
    assert.equal(releaseFields.get("ball.x_displacement").numericBits, scenario.releaseBits.x);
    assert.equal(releaseFields.get("ball.y_displacement").numericBits, scenario.releaseBits.y);

    for (const [tick, state] of result.states) {
      assert.equal(assertCssoccerCentrePassActionState(state), state, `${scenario.name} ${tick}`);
      const projected = projectCssoccerCentrePassActionNativeFields(state);
      assert.ok(projected.length > 20, `${scenario.name} ${tick} owned field coverage`);
      for (const field of projected) {
        assert.equal(field.schema, "cssoccer-parity-stream@1");
        assert.equal(field.recordType, "sample");
        assert.equal(field.tick, tick);
        assert.equal(field.phase, "post_tick");
        const expected = retainedSample(
          retained,
          tick,
          retainedAlias(field.fieldId, scenario.country),
        );
        assert.deepEqual(
          scalar(field),
          scalar(expected),
          `${scenario.name} tick ${tick} ${field.fieldId}`,
        );
      }
    }
  }
});

test("country choice changes stable identity, not native-slot action arithmetic", retainedOptions, async () => {
  const retained = await retainedWindow();
  const [opening, second] = SCENARIOS.map((scenario) => runScenario(scenario, retained));

  assert.equal(opening.state.matchHalf, 0);
  assert.equal(second.state.matchHalf, 1);
  assert.equal(opening.state.taker.nativePlayerNumber, 7);
  assert.equal(second.state.taker.nativePlayerNumber, 7);
  assert.equal(opening.state.release.nativeReceiverNumber, 10);
  assert.equal(second.state.release.nativeReceiverNumber, 10);
  assert.equal(opening.state.taker.stableId, "spain-player-07");
  assert.equal(second.state.taker.stableId, "argentina-player-07");
  assert.ok(
    projectCssoccerCentrePassActionNativeFields(second.state)
      .some(({ fieldId }) => fieldId === "players.argentina-player-10.possession"),
  );
});

test("reset-equivalent action runs are byte deterministic in both halves", retainedOptions, async () => {
  const retained = await retainedWindow();
  for (const scenario of SCENARIOS) {
    const first = runScenario(scenario, retained);
    const repeated = runScenario(structuredClone(scenario), retained);
    assert.equal(JSON.stringify(first), JSON.stringify(repeated), scenario.name);
  }
});

test("release, receiver contact/control, and recovery remain explicit source-owned seams", retainedOptions, async () => {
  const retained = await retainedWindow();
  const scenario = SCENARIOS[0];

  let state = createAction(scenario);
  while (state.tick < scenario.releaseTick - 1) {
    state = stepCssoccerCentrePassAction(state);
  }
  assert.throws(
    () => stepCssoccerCentrePassAction(state),
    boundary("ground-pass-release"),
  );
  const malformedRelease = releaseContext(scenario, retained);
  malformedRelease.rng = { ...malformedRelease.rng, seed: 0 };
  assert.throws(
    () => stepCssoccerCentrePassAction(state, { release: malformedRelease }),
    boundary("ground-pass-release"),
  );

  state = advanceScenarioTo(scenario, retained, scenario.receiptTick - 1);
  const receiver = receiverContext(scenario, retained, scenario.receiptTick);
  assert.throws(
    () => stepCssoccerCentrePassAction(state, {
      receiver: { ...receiver, collect: false, controlAccepted: null },
    }),
    boundary("receiver-contact"),
  );
  assert.throws(
    () => stepCssoccerCentrePassAction(state, {
      receiver: { ...receiver, controlAccepted: false },
    }),
    boundary("receiver-control"),
  );

  state = advanceScenarioTo(scenario, retained, scenario.recoveryTick - 1);
  assert.throws(
    () => stepCssoccerCentrePassAction(state, {
      receiver: receiverContext(scenario, retained, scenario.recoveryTick),
    }),
    boundary("recovery-direction"),
  );
});

test("compiled action profile is bit strict and malformed state cannot drift", fixtureOptions, () => {
  const launch = acceptedLaunch(SCENARIOS[0]);
  assert.throws(
    () => createCssoccerCentrePassAction({
      launch,
      profile: {
        ...CSSOCCER_CENTRE_PASS_ACTION_PROFILE,
        contact: f32(CSSOCCER_CENTRE_PASS_ACTION_PROFILE.contact + 0.01),
      },
      taker: initialTaker(SCENARIOS[0]),
    }),
    boundary("action-profile"),
  );

  const state = createAction(SCENARIOS[0]);
  const changed = structuredClone(state);
  changed.taker.animationFrame = f32(changed.taker.animationFrame + 0.01);
  assert.throws(
    () => assertCssoccerCentrePassActionState(changed),
    boundary("action-state"),
  );
});

test("pinned source/build fixes action order, hold/contact, target lead, and pass RNG operands", sourceOptions, () => {
  for (const source of CSSOCCER_CENTRE_PASS_ACTION_SOURCE.files) {
    assert.equal(sha256(sourceFiles[source.file]), source.sha256, `${source.file} hash`);
  }
  const actions = readFileSync(sourceFiles["ACTIONS.CPP"], "utf8");
  const interaction = readFileSync(sourceFiles["BALLINT.CPP"], "utf8");
  const intelligence = readFileSync(sourceFiles["INTELL.CPP"], "utf8");
  assert.match(actions, /void kick_action[\s\S]*tm_frm\+player->tm_fstep>=1[\s\S]*tm_frm>=player->contact[\s\S]*fire_ball_off[\s\S]*go_toward_target/u);
  assert.match(actions, /void init_kick_act[\s\S]*tm_fstep=player->tm_fstep\*player->tm_mcspd[\s\S]*MC_PASS_DIST\*player->tm_fstep/u);
  assert.match(interaction, /void hold_ball[\s\S]*ballxdis=player->go_txdis[\s\S]*AT_FEET_DIST/u);
  assert.match(interaction, /void collect_ball[\s\S]*hold_ball\(player\)[\s\S]*ball_poss=player->tm_player[\s\S]*player->tm_poss=1/u);
  assert.match(intelligence, /int pass_ahead[\s\S]*for \(i=1; i<40; i\+\+\)[\s\S]*GRND_FRICTION/u);
  assert.match(intelligence, /void pass_ball[\s\S]*end_speed=5[\s\S]*af_randomize\(\)[\s\S]*PASS_ACC_ARC/u);
  assert.match(intelligence, /want_pass!=ps[\s\S]*ac1=0;[\s\S]*ac2=0;/u);

  assert.equal(f32Bits(CSSOCCER_CENTRE_PASS_ACTION_PROFILE.baseFrameStep), "3d783e10");
  assert.equal(f32Bits(CSSOCCER_CENTRE_PASS_ACTION_PROFILE.contact), "3ef83e10");
  assert.equal(f32Bits(CSSOCCER_CENTRE_PASS_ACTION_PROFILE.pass.pitchScale), "412aaaab");
  assert.equal(CSSOCCER_CENTRE_PASS_ACTION_PROFILE.animationFrames, 99);
  assert.equal(CSSOCCER_CENTRE_PASS_ACTION_PROFILE.movementDistance, 10.14);
  assert.equal(CSSOCCER_CENTRE_PASS_ACTION_PROFILE.pass.groundFriction, 0.965);
});

test("runtime action module is browser-safe and does not import retained evidence", () => {
  const source = readFileSync(
    new URL("../src/cssoccer/centrePassAction.mjs", import.meta.url),
    "utf8",
  );
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/gu)]
    .map((match) => match[1]);
  assert.ok(imports.length > 0);
  assert.ok(imports.every((specifier) => specifier.startsWith("./")));
  assert.doesNotMatch(
    source,
    /node:fs|node:crypto|readFile|createReadStream|state\.jsonl|\.local\//u,
  );
  assert.match(source, /explicit target, accuracy, and RNG inputs/u);
  assert.match(source, /post-action process_dir facing/u);
});

function runScenario(scenario, retained) {
  let state = createAction(scenario);
  const states = new Map([[state.tick, state]]);
  while (state.tick < scenario.recoveryTick) {
    const tick = state.tick + 1;
    state = stepCssoccerCentrePassAction(
      state,
      actionContext(scenario, retained, tick),
    );
    states.set(tick, state);
  }
  return { state, states };
}

function advanceScenarioTo(scenario, retained, tick) {
  let state = createAction(scenario);
  while (state.tick < tick) {
    state = stepCssoccerCentrePassAction(
      state,
      actionContext(scenario, retained, state.tick + 1),
    );
  }
  return state;
}

function actionContext(scenario, retained, tick) {
  const context = {};
  if (tick === scenario.releaseTick) {
    context.release = releaseContext(scenario, retained);
  }
  if (tick > scenario.releaseTick) {
    context.receiver = receiverContext(scenario, retained, tick);
  }
  if (tick === scenario.recoveryTick) {
    context.recovery = {
      stableId: `${scenario.country}-player-07`,
      postDirectionFacing: { ...scenario.recoveryFacing },
    };
  }
  return context;
}

function releaseContext(scenario, retained) {
  const previous = retainedTick(retained, scenario.releaseTick - 1);
  return {
    simulation: true,
    ballLimbo: { active: false },
    takerAccuracy: scenario.takerAccuracy,
    wantedReceiver: scenario.wantedReceiver,
    rng: advanceCssoccerNativeRngMany(
      createCssoccerNativeRngState(),
      scenario.prePassRngCalls,
    ),
    receiver: {
      stableId: `${scenario.country}-player-10`,
      nativePlayerNumber: 10,
      actionId: CSSOCCER_NATIVE_ACTIONS.RUN,
      position: playerPosition(previous, 10),
      goDisplacement: { ...scenario.receiverGo },
    },
  };
}

function receiverContext(scenario, retained, tick) {
  const previous = retainedTick(retained, tick - 1);
  const current = retainedTick(retained, tick);
  const collected = tick === scenario.receiptTick;
  const owned = tick >= scenario.receiptTick;
  return {
    tick,
    stableId: `${scenario.country}-player-10`,
    nativePlayerNumber: 10,
    actionId: sample(previous, "players.spain-player-10.action").value,
    animationFrame: collected
      ? scenario.receiptAnimationFrame
      : sample(current, "players.spain-player-10.animation_frame").value,
    position: playerPosition(previous, 10),
    facing: playerFacing(previous, 10),
    goDisplacement: collected
      ? { ...scenario.receiptGo }
      : owned
        ? {
            x: sample(current, "ball.x_displacement").value,
            y: sample(current, "ball.y_displacement").value,
          }
        : { x: f32(0), y: f32(0) },
    collect: collected,
    controlAccepted: collected ? true : null,
  };
}

function createAction(scenario) {
  return createCssoccerCentrePassAction({
    launch: acceptedLaunch(scenario),
    profile: CSSOCCER_CENTRE_PASS_ACTION_PROFILE,
    taker: initialTaker(scenario),
  });
}

function initialTaker(scenario) {
  return {
    position: { x: f32(640), y: f32(390), z: f32(0) },
    motionCaptureSpeed: scenario.motionCaptureSpeed,
  };
}

function acceptedLaunch(scenario) {
  const pending = scenario.matchHalf === 0 ? openingPending() : secondHalfPending();
  return launchCssoccerCentrePass(launchInput(pending, scenario.startTick));
}

function preparedMatch() {
  matchCache ??= createCssoccerMatchState({
    preparedFacts: JSON.parse(readFileSync(fixtureFiles.facts, "utf8")),
    preparedScene: JSON.parse(readFileSync(fixtureFiles.scene, "utf8")),
    selectedCountry: "argentina",
  });
  return matchCache;
}

function secondHalfLifecycle() {
  if (secondHalfLifecycleCache) return secondHalfLifecycleCache;
  let lifecycle = preparedMatch().lifecycle;
  while (lifecycle.clock.phase !== "halftime-end-swap-second-half-kickoff") {
    lifecycle = stepCssoccerMatchLifecycle(lifecycle).state;
  }
  secondHalfLifecycleCache = lifecycle;
  return lifecycle;
}

function openingPending() {
  return readyPending(createCssoccerKickoffState({
    lifecycle: preparedMatch().lifecycle,
    tacticsState: preparedMatch().tactics,
    sourceProfile: testSourceProfile(),
  }));
}

function secondHalfPending() {
  return readyPending(createCssoccerKickoffState({
    lifecycle: secondHalfLifecycle(),
    tacticsState: preparedMatch().tactics,
    sourceProfile: testSourceProfile(),
  }));
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
        ? { x: f32(0), y: f32(1) }
        : { x: f32(1), y: f32(0) },
    })),
    refereeAction: state.sourceProfile.officialActionIds.ready,
  });
}

function testSourceProfile() {
  return {
    schema: CSSOCCER_KICKOFF_SOURCE_PROFILE_SCHEMA,
    profileHash: "a".repeat(64),
    keeperOffline: f32(8),
    facingAngle: f32(0.99),
    besideBall: f32(4),
    setPieceWaitTicks: 5000,
    actionIds: { stand: 0, run: 1, pickup: 19 },
    officialActionIds: { normal: 0, positioning: 1, ready: 4, waitForKick: 2 },
  };
}

function launchInput(pending, tick) {
  return {
    tick,
    kickoff: pending,
    ball: createBallMatchState({
      ball: {
        tick,
        position: pending.ball.position,
        previousPosition: pending.ball.position,
      },
    }),
    possession: freePossession(pending.teamBySlot),
    takerAction: createCssoccerActionState({
      tick,
      playerId: pending.owner.takerId,
      actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
      facingX: f32(0),
      facingY: f32(1),
    }),
    gameplayProfile: {
      schema: "test-exact-gameplay-profile@1",
      profileHash: pending.bindings.sourceProfileHash,
    },
  };
}

function freePossession(teamBySlot) {
  return createPossessionState({
    players: Array.from({ length: 22 }, (_, index) => {
      const nativePlayer = index + 1;
      const country = nativePlayer <= 11 ? teamBySlot.A : teamBySlot.B;
      const rosterNumber = nativePlayer <= 11 ? nativePlayer : nativePlayer - 11;
      return {
        nativePlayer,
        stableId: `${country}-player-${String(rosterNumber).padStart(2, "0")}`,
        possession: 0,
      };
    }),
  });
}

function playerPosition(fields, nativePlayer) {
  const prefix = `players.spain-player-${String(nativePlayer).padStart(2, "0")}`;
  return {
    x: sample(fields, `${prefix}.x`).value,
    y: sample(fields, `${prefix}.y`).value,
    z: sample(fields, `${prefix}.z`).value,
  };
}

function playerFacing(fields, nativePlayer) {
  const prefix = `players.spain-player-${String(nativePlayer).padStart(2, "0")}`;
  return {
    x: sample(fields, `${prefix}.x_displacement`).value,
    y: sample(fields, `${prefix}.y_displacement`).value,
  };
}

function projectionMap(state) {
  return new Map(
    projectCssoccerCentrePassActionNativeFields(state)
      .map((field) => [field.fieldId, field]),
  );
}

function retainedAlias(fieldId, country) {
  return country === "argentina"
    ? fieldId.replace(/^players\.argentina-player-/u, "players.spain-player-")
    : fieldId;
}

function scalar(field) {
  return {
    valueType: field.valueType,
    value: field.value,
    numericBits: field.numericBits,
  };
}

async function retainedWindow() {
  retainedCache ??= loadRetainedWindow();
  return retainedCache;
}

async function loadRetainedWindow() {
  const ticks = new Map();
  const lines = createInterface({ input: createReadStream(retainedUrl) });
  for await (const line of lines) {
    const record = JSON.parse(line);
    const wanted = (record.tick >= 171 && record.tick <= 185)
      || (record.tick >= 1779 && record.tick <= 1795);
    if (!wanted || record.phase !== "post_tick") continue;
    if (!ticks.has(record.tick)) ticks.set(record.tick, new Map());
    ticks.get(record.tick).set(record.fieldId, record);
  }
  return ticks;
}

function retainedTick(retained, tick) {
  const fields = retained.get(tick);
  assert.ok(fields, `retained tick ${tick}`);
  return fields;
}

function retainedSample(retained, tick, fieldId) {
  return sample(retainedTick(retained, tick), fieldId);
}

function sample(fields, fieldId) {
  const value = fields.get(fieldId);
  assert.ok(value, `retained field ${fieldId}`);
  return value;
}

function boundary(expected) {
  return (error) => error instanceof CssoccerUnsupportedCentrePassActionError
    && error.boundary === expected;
}

function f32Bits(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setFloat32(0, value, false);
  return [...bytes].map((entry) => entry.toString(16).padStart(2, "0")).join("");
}

function sha256(url) {
  return createHash("sha256").update(readFileSync(url)).digest("hex");
}

function skipUnless(urls, label) {
  return urls.every((url) => existsSync(url))
    ? {}
    : { skip: `${label} unavailable` };
}
