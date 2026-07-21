import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import test from "node:test";

import {
  CSSOCCER_NATIVE_ACTIONS,
} from "../src/cssoccer/actionState.mjs";
import {
  stepCssoccerKeeperHeldBall,
  CSSOCCER_HELD_BALL_PROFILE,
  CSSOCCER_HELD_BALL_PROFILE_HASH,
  CSSOCCER_HELD_BALL_SOURCE,
  CssoccerUnsupportedHeldBallError,
  assertCssoccerHeldBallState,
  createCssoccerHeldBallOwnerFrame,
  createCssoccerHeldBallState,
  projectCssoccerHeldBallNativeFields,
  stepCssoccerHeldBallState,
  stepCssoccerPossessedBallState,
} from "../src/cssoccer/heldBallState.mjs";
import { createBallMatchState } from "../src/cssoccer/ballMatchState.mjs";
import {
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
} from "../src/cssoccer/nativeFixturePlayerProfile.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
} from "../src/cssoccer/nativeGameplayProfile.mjs";
import {
  createCssoccerOpeningLiveLaunchState,
  stepCssoccerOpeningLiveLaunchState,
} from "../src/cssoccer/openingLiveLaunchState.mjs";
import {
  createCssoccerOpeningMatchState,
  stepCssoccerOpeningMatchState,
} from "../src/cssoccer/openingMatchState.mjs";
import {
  advanceCssoccerNativeRng,
} from "../src/cssoccer/randomState.mjs";
import { createPossessionState } from "../src/cssoccer/possessionState.mjs";

const F32 = Math.fround;
const OPENING_TICK = 171;
const RELEASE_TICK = 178;
const RECEIPT_TICK = 181;
const BASELINE_TICK = 185;
const HELD_TICK = 186;
const ROOT = new URL("../", import.meta.url);
const GENERATED_ROOT = new URL("build/generated/public/cssoccer/", ROOT);
const FACTS_URL = new URL("facts/spain-argentina-full-match.json", GENERATED_ROOT);
const SCENE_URL = new URL("scenes/spain-argentina-full-match.json", GENERATED_ROOT);
const RETAINED_URL = new URL(
  ".local/cssoccer/oracle/native/retained/runs/canonical-a/state.jsonl",
  ROOT,
);
const RETAINED_RAW_URL = new URL(
  ".local/cssoccer/oracle/native/retained/runs/canonical-a/native.raw",
  ROOT,
);
const CONTRACT_URL = new URL("references/spain-argentina-match.json", ROOT);
const RUNTIME_URL = new URL("src/cssoccer/heldBallState.mjs", ROOT);
const SOURCE_ROOT = new URL(".local/actua-soccer/source/", ROOT);
const evidenceOptions = skipUnless([
  FACTS_URL,
  SCENE_URL,
  RETAINED_URL,
  RETAINED_RAW_URL,
  CONTRACT_URL,
], "prepared fixture and retained held-ball evidence");

test("normal native-player-10 hold_ball matches all 18 typed and raw fields at tick 186", evidenceOptions, async () => {
  const retained = await retainedWindow(OPENING_TICK, HELD_TICK);
  const { baseline, frame, state } = qualifiedHeldBall("argentina", retained);
  assert.equal(assertCssoccerHeldBallState(baseline), baseline);
  assert.equal(assertCssoccerHeldBallState(state), state);
  assert.equal(state.tick, HELD_TICK);
  assert.equal(state.phase, "normal-held-ball");
  assert.equal(state.owner.stableId, "spain-player-10");
  assert.equal(frame.tick, HELD_TICK);

  const projection = projectCssoccerHeldBallNativeFields(state);
  assert.equal(projection.length, 18);
  assert.equal(new Set(projection.map(({ fieldId }) => fieldId)).size, 18);
  const typed = retained.get(HELD_TICK);
  const raw = retainedRawRecord(HELD_TICK);
  for (const field of projection) {
    assert.deepEqual(field, requiredSample(typed, field.fieldId), field.fieldId);
    assert.deepEqual(scalar(field), rawHeldField(raw, field.fieldId), `raw ${field.fieldId}`);
  }
});

test("held position is derived from prior owner state and current animation, never replay-fed", evidenceOptions, async () => {
  const retained = await retainedWindow(OPENING_TICK, HELD_TICK);
  const { baseline, frame, state } = qualifiedHeldBall("argentina", retained);
  const physical = stepCssoccerPossessedBallState(baseline.ball);
  assert.equal(physical.ball.tick, baseline.ball.ball.tick + 1);
  assert.deepEqual(physical.ball.position, baseline.ball.ball.position);
  assert.deepEqual(physical.ball.displacement, baseline.ball.ball.displacement);
  assert.deepEqual(Object.keys(frame).sort(), [
    "action",
    "animationFrame",
    "bindings",
    "branches",
    "facing",
    "goDisplacement",
    "nativePlayerNumber",
    "position",
    "schema",
    "stableId",
    "tick",
  ]);
  assert.ok(!JSON.stringify(frame).includes("4428a170"), "tick-186 ball.x bits are not an input");
  const fraction = frame.animationFrame.value - Math.trunc(frame.animationFrame.value);
  const distance = CSSOCCER_HELD_BALL_PROFILE.constants.atFeetDistance
    + (CSSOCCER_HELD_BALL_PROFILE.constants.runFrameAmplitude * (fraction - 0.5));
  assert.equal(
    state.ball.ball.position.x,
    F32(frame.position.x.value + (frame.facing.x.value * distance)),
  );
  assert.equal(
    state.ball.ball.position.y,
    F32(frame.position.y.value + (frame.facing.y.value * distance)),
  );
  assert.equal(state.ball.ball.displacement.x, frame.goDisplacement.x.value);
  assert.equal(state.ball.ball.displacement.y, frame.goDisplacement.y.value);
  assert.equal(state.ball.ball.position.z, F32(2));
  assert.equal(state.ball.ball.displacement.z, F32(0));
});

test("selected-country symmetry preserves the same native-A held-ball arithmetic", evidenceOptions, async () => {
  const retained = await retainedWindow(OPENING_TICK, HELD_TICK);
  const argentina = qualifiedHeldBall("argentina", retained);
  const spain = qualifiedHeldBall("spain", retained);
  assert.deepEqual(argentina.baseline, spain.baseline);
  assert.deepEqual(argentina.frame, spain.frame);
  assert.deepEqual(argentina.state, spain.state);
  assert.equal(JSON.stringify(argentina.state), JSON.stringify(
    stepCssoccerHeldBallState(argentina.baseline, { ownerFrame: argentina.frame }),
  ));
});

test("typed owner bits, identity, branch, profiles, and transition window fail closed", evidenceOptions, async () => {
  const retained = await retainedWindow(OPENING_TICK, HELD_TICK);
  const { baseline, frame, state } = qualifiedHeldBall("argentina", retained);

  const wrongBits = structuredClone(frame);
  wrongBits.animationFrame.numericBits = "00000000";
  assertFailsWithoutMutation(
    baseline,
    () => stepCssoccerHeldBallState(baseline, { ownerFrame: wrongBits }),
    "typed-owner-field",
  );

  const extraOutput = structuredClone(frame);
  extraOutput.ballX = requiredSample(retained.get(HELD_TICK), "ball.x").value;
  assertFailsWithoutMutation(
    baseline,
    () => stepCssoccerHeldBallState(baseline, { ownerFrame: extraOutput }),
    undefined,
  );

  const standing = createCssoccerHeldBallOwnerFrame({
    ...ownerFrameInput(retained),
    actionId: CSSOCCER_NATIVE_ACTIONS.STAND,
  });
  assert.equal(standing.action.value, CSSOCCER_NATIVE_ACTIONS.STAND);
  assert.throws(
    () => createCssoccerHeldBallOwnerFrame({
      ...ownerFrameInput(retained),
      motionCaptureTween: true,
    }),
    (error) => error instanceof CssoccerUnsupportedHeldBallError
      && error.boundary === "owner-branch",
  );
  assert.throws(
    () => createCssoccerHeldBallOwnerFrame({
      ...ownerFrameInput(retained),
      nativePlayerNumber: 9,
    }),
    (error) => error instanceof CssoccerUnsupportedHeldBallError
      && error.boundary === "owner-identity",
  );
  const wrongProfile = structuredClone(CSSOCCER_NATIVE_GAMEPLAY_PROFILE);
  wrongProfile.profileHash = "0".repeat(64);
  assert.throws(
    () => createCssoccerHeldBallOwnerFrame({
      ...ownerFrameInput(retained),
      gameplayProfile: wrongProfile,
    }),
    /profile hash changed/u,
  );
  assertFailsWithoutMutation(
    state,
    () => stepCssoccerHeldBallState(state, { ownerFrame: frame }),
    "qualified-window",
  );
});

test("baseline rejects non-contiguous or wrong-owner handoffs", evidenceOptions, async () => {
  const retained = await retainedWindow(OPENING_TICK, HELD_TICK);
  const action = centrePassAt185("argentina", retained);
  const baseline = createCssoccerHeldBallState({
    ball: action.ball,
    possession: action.possession,
    gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    fixturePlayerProfile: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  });
  const wrongTick = createCssoccerHeldBallOwnerFrame({
    ...ownerFrameInput(retained),
    tick: HELD_TICK + 1,
  });
  assert.throws(
    () => stepCssoccerHeldBallState(baseline, { ownerFrame: wrongTick }),
    (error) => error instanceof CssoccerUnsupportedHeldBallError
      && error.boundary === "owner-lineage",
  );
  const wrongOwner = structuredClone(action.possession);
  wrongOwner.owner = 9;
  assert.throws(
    () => createCssoccerHeldBallState({
      ball: action.ball,
      possession: wrongOwner,
      gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      fixturePlayerProfile: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
    }),
    /exactly one positive player counter/u,
  );
});

test("keeper hands hold one exclusive owner through save and KPHOLD branches", () => {
  const ball = createBallMatchState({
    ball: {
      tick: 4,
      position: { x: F32(21), y: F32(399), z: F32(7) },
      displacement: { x: F32(0), y: F32(0), z: F32(0) },
    },
  });
  const possession = keeperHandsPossession(1);
  const common = {
    ball,
    possession,
    tick: 5,
  };
  const held = stepCssoccerKeeperHeldBall({
    ...common,
    owner: {
      action: 12,
      facing: { x: F32(1), y: F32(0) },
      goDisplacement: { x: F32(0), y: F32(0) },
      nativePlayerNumber: 1,
      position: { x: F32(16), y: F32(399), z: F32(0) },
      saveOffset: { x: F32(0), y: F32(0), z: F32(0) },
    },
  });
  assert.equal(held.ball.ball.tick, 5);
  assert.equal(held.possession.owner, 1);
  assert.equal(held.possession.inHands, 1);
  assert.equal(held.possession.players[0].possession, 2);
  assert.deepEqual(held.ball.ball.position, {
    x: F32(16 + CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value),
    y: F32(399),
    z: F32(12.5),
  });

  const saved = stepCssoccerKeeperHeldBall({
    ...common,
    owner: {
      action: 10,
      facing: { x: F32(1), y: F32(0) },
      goDisplacement: { x: F32(0), y: F32(0) },
      nativePlayerNumber: 1,
      position: { x: F32(16), y: F32(399), z: F32(0) },
      saveOffset: { x: F32(2), y: F32(-3), z: F32(7) },
    },
  });
  assert.equal(saved.owner.branch, "save-contact");
  assert.deepEqual(saved.ball.ball.position, {
    x: F32(18),
    y: F32(396),
    z: F32(7),
  });
});

test("profile and source pins hash exactly and the runtime remains browser-safe", () => {
  const { profileHash, ...profileBody } = CSSOCCER_HELD_BALL_PROFILE;
  assert.equal(profileHash, CSSOCCER_HELD_BALL_PROFILE_HASH);
  assert.equal(sha256(JSON.stringify(profileBody)), profileHash);
  for (const { file, sha256: expected } of CSSOCCER_HELD_BALL_SOURCE.files) {
    const url = new URL(file, SOURCE_ROOT);
    if (existsSync(url)) assert.equal(sha256(readFileSync(url)), expected, file);
  }
  const source = readFileSync(RUNTIME_URL, "utf8");
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/gu)]
    .map((match) => match[1]);
  assert.ok(imports.every((specifier) => specifier.startsWith("./")));
  assert.doesNotMatch(source, /node:|readFile|createReadStream|\.local\/|state\.jsonl|native\.raw/u);
  assert.match(source, /stepCssoccerPossessedBallState\(current\.ball\)/u);
  assert.match(source, /holdPossession\(current\.possession\)/u);
  assert.match(source, /ownerFrame\.goDisplacement/u);
});

function qualifiedHeldBall(selectedCountry, retained) {
  const action = centrePassAt185(selectedCountry, retained);
  const baseline = createCssoccerHeldBallState({
    ball: action.ball,
    possession: action.possession,
    gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    fixturePlayerProfile: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  });
  const frame = createCssoccerHeldBallOwnerFrame(ownerFrameInput(retained));
  const state = stepCssoccerHeldBallState(baseline, { ownerFrame: frame });
  return { baseline, frame, state };
}

function keeperHandsPossession(owner) {
  return createPossessionState({
    owner,
    lastTouch: owner,
    inHands: 1,
    players: Array.from({ length: 22 }, (_, index) => {
      const nativePlayer = index + 1;
      const teamPlayer = nativePlayer < 12 ? nativePlayer : nativePlayer - 11;
      const country = nativePlayer < 12 ? "spain" : "argentina";
      return {
        nativePlayer,
        stableId: `${country}-player-${String(teamPlayer).padStart(2, "0")}`,
        possession: nativePlayer === owner ? 1 : 0,
      };
    }),
  });
}

function ownerFrameInput(retained) {
  const previous = retained.get(BASELINE_TICK);
  const current = retained.get(HELD_TICK);
  const raw = retainedRawRecord(BASELINE_TICK);
  return {
    tick: HELD_TICK,
    stableId: "spain-player-10",
    nativePlayerNumber: 10,
    actionId: requiredSample(current, "players.spain-player-10.action").value,
    animationFrame: requiredSample(
      current,
      "players.spain-player-10.animation_frame",
    ).value,
    position: playerPosition(previous, 10),
    facing: playerFacing(previous, 10),
    goDisplacement: {
      x: raw.readPlayer(10, 160, "f32"),
      y: raw.readPlayer(10, 164, "f32"),
    },
    setPieceActive: requiredSample(previous, "rules.set_piece").value !== 0,
    ballInHands: requiredSample(previous, "ball.in_hands").value !== 0,
    motionCaptureTween: raw.readPlayer(10, 59, "i16") < -1,
    deadBallCount: requiredSample(previous, "rules.dead_ball_count").value,
    gameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    fixturePlayerProfile: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  };
}

function centrePassAt185(selectedCountry, retained) {
  let state = createCssoccerOpeningLiveLaunchState({
    opening: openingAt171(selectedCountry),
  });
  while (state.tick < BASELINE_TICK) {
    const tick = state.tick + 1;
    state = stepCssoccerOpeningLiveLaunchState(
      state,
      centrePassContext(state, retained, tick),
    );
  }
  return state.centrePassAction;
}

function centrePassContext(state, retained, tick) {
  const context = {};
  if (tick === RELEASE_TICK) {
    const previous = retained.get(tick - 1);
    const prior = retained.get(tick - 2);
    context.release = {
      simulation: true,
      ballLimbo: { active: false },
      takerAccuracy: fixturePlayer(state.centrePassAction.owner.takerId).attributes.accuracy,
      wantedReceiver: false,
      rng: advanceCssoccerNativeRng(state.rng),
      receiver: {
        stableId: state.centrePassAction.owner.receiverId,
        nativePlayerNumber: 10,
        actionId: requiredSample(previous, "players.spain-player-10.action").value,
        position: playerPosition(previous, 10),
        goDisplacement: {
          x: F32(
            requiredSample(previous, "players.spain-player-10.x").value
              - requiredSample(prior, "players.spain-player-10.x").value,
          ),
          y: F32(
            requiredSample(previous, "players.spain-player-10.y").value
              - requiredSample(prior, "players.spain-player-10.y").value,
          ),
        },
      },
    };
  }
  if (tick > RELEASE_TICK) {
    const previous = retained.get(tick - 1);
    const current = retained.get(tick);
    const collected = tick === RECEIPT_TICK;
    const owned = tick >= RECEIPT_TICK;
    context.receiver = {
      tick,
      stableId: state.centrePassAction.owner.receiverId,
      nativePlayerNumber: 10,
      actionId: requiredSample(previous, "players.spain-player-10.action").value,
      animationFrame: requiredSample(
        current,
        "players.spain-player-10.animation_frame",
      ).value,
      position: playerPosition(previous, 10),
      facing: playerFacing(previous, 10),
      goDisplacement: collected || owned
        ? {
            x: requiredSample(current, "ball.x_displacement").value,
            y: requiredSample(current, "ball.y_displacement").value,
          }
        : { x: F32(0), y: F32(0) },
      collect: collected,
      controlAccepted: collected ? true : null,
    };
  }
  if (tick === BASELINE_TICK) {
    context.recovery = {
      stableId: state.centrePassAction.owner.takerId,
      postDirectionFacing: playerFacing(retained.get(tick), 7),
    };
  }
  return context;
}

function playerPosition(fields, nativePlayerNumber) {
  const id = `players.spain-player-${String(nativePlayerNumber).padStart(2, "0")}`;
  return {
    x: requiredSample(fields, `${id}.x`).value,
    y: requiredSample(fields, `${id}.y`).value,
    z: requiredSample(fields, `${id}.z`).value,
  };
}

function playerFacing(fields, nativePlayerNumber) {
  const id = `players.spain-player-${String(nativePlayerNumber).padStart(2, "0")}`;
  return {
    x: requiredSample(fields, `${id}.x_displacement`).value,
    y: requiredSample(fields, `${id}.y_displacement`).value,
  };
}

function fixturePlayer(id) {
  const player = CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE.players.find(
    (candidate) => candidate.id === id,
  );
  assert.ok(player, `fixture player ${id}`);
  return player;
}

const openingCache = new Map();

function openingAt171(selectedCountry) {
  if (!openingCache.has(selectedCountry)) {
    let state = createCssoccerOpeningMatchState({
      preparedFacts: JSON.parse(readFileSync(FACTS_URL, "utf8")),
      preparedScene: JSON.parse(readFileSync(SCENE_URL, "utf8")),
      selectedCountry,
    });
    while (state.tick < OPENING_TICK) state = stepCssoccerOpeningMatchState(state);
    openingCache.set(selectedCountry, state);
  }
  return openingCache.get(selectedCountry);
}

const retainedCache = new Map();

async function retainedWindow(startTick, endTick) {
  const key = `${startTick}-${endTick}`;
  if (retainedCache.has(key)) return retainedCache.get(key);
  const ticks = new Map(range(startTick, endTick).map((tick) => [tick, new Map()]));
  const input = createReadStream(RETAINED_URL);
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    const record = JSON.parse(line);
    if (record.recordType !== "sample") continue;
    if (record.tick > endTick) {
      lines.close();
      input.destroy();
      break;
    }
    if (record.tick >= startTick) ticks.get(record.tick).set(record.fieldId, record);
  }
  assert.ok([...ticks.values()].every((fields) => fields.size === 412));
  retainedCache.set(key, ticks);
  return ticks;
}

const rawCache = new Map();

function retainedRawRecord(tick) {
  if (rawCache.has(tick)) return rawCache.get(tick);
  const bytes = readFileSync(RETAINED_RAW_URL);
  const raw = JSON.parse(readFileSync(CONTRACT_URL, "utf8")).oracle.capture.raw;
  assert.equal(bytes.subarray(0, 8).toString("ascii"), raw.magic);
  let descriptorOffset = 16;
  let payloadBase = 0;
  const ranges = raw.ranges.map((expected) => {
    const range = {
      offset: bytes.readUInt32LE(descriptorOffset),
      bytes: bytes.readUInt32LE(descriptorOffset + 4),
      payloadBase,
    };
    assert.deepEqual({ offset: range.offset, bytes: range.bytes }, expected);
    descriptorOffset += 8;
    payloadBase += range.bytes;
    return range;
  });
  const recordBytes = raw.metadataBytes + payloadBase;
  for (let offset = descriptorOffset; offset < bytes.length; offset += recordBytes) {
    const recordTick = bytes.readUInt32LE(offset + 20);
    const flags = bytes.readUInt32LE(offset + 24);
    if (recordTick !== tick || (flags & raw.flags.active) === 0) continue;
    const read = (address, type) => {
      const range = ranges.find((entry) => (
        address >= entry.offset && address < entry.offset + entry.bytes
      ));
      assert.ok(range, `raw address 0x${address.toString(16)}`);
      const cursor = offset + raw.metadataBytes + range.payloadBase
        + address - range.offset;
      return readRaw(bytes, cursor, type);
    };
    const record = {
      read,
      readPlayer(nativePlayerNumber, playerOffset, type) {
        return read(0x3cf6c + ((nativePlayerNumber - 1) * 203) + playerOffset, type);
      },
    };
    rawCache.set(tick, record);
    return record;
  }
  assert.fail(`active raw tick ${tick}`);
}

const RAW_HELD_FIELDS = Object.freeze({
  "ball.in_air": [0x3e420, "i32"],
  "ball.in_goal": [0x3e3a0, "u8"],
  "ball.in_hands": [0x3e3a1, "u8"],
  "ball.last_touch": [0x3e43c, "i32"],
  "ball.out_of_play": [0x3e484, "i32"],
  "ball.possession": [0x3e430, "i32"],
  "ball.speed": [0x3e404, "i32"],
  "ball.spin_state": [0x3e364, "i32"],
  "ball.spin_xy": [0x3e898, "f32"],
  "ball.spin_z": [0x3e894, "f32"],
  "ball.still": [0x3e438, "i32"],
  "ball.x": [0x3e838, "f32"],
  "ball.x_displacement": [0x3e82c, "f32"],
  "ball.y": [0x3e83c, "f32"],
  "ball.y_displacement": [0x3e830, "f32"],
  "ball.z": [0x3e840, "f32"],
  "ball.z_displacement": [0x3e834, "f32"],
});

function rawHeldField(raw, fieldId) {
  if (fieldId === "players.spain-player-10.possession") {
    const value = raw.readPlayer(10, 144, "i16");
    return typedScalar(fieldId, "i16", value);
  }
  const [address, valueType] = RAW_HELD_FIELDS[fieldId] ?? [];
  assert.ok(address, `raw held field ${fieldId}`);
  return typedScalar(fieldId, valueType, raw.read(address, valueType));
}

function readRaw(bytes, offset, type) {
  if (type === "u8") return bytes.readUInt8(offset);
  if (type === "i16") return bytes.readInt16LE(offset);
  if (type === "i32") return bytes.readInt32LE(offset);
  if (type === "f32") return bytes.readFloatLE(offset);
  throw new Error(`unsupported raw type ${type}`);
}

function typedScalar(fieldId, valueType, value) {
  const widths = { u8: 1, i16: 2, i32: 4, f32: 4 };
  const bytes = new Uint8Array(widths[valueType]);
  const view = new DataView(bytes.buffer);
  if (valueType === "u8") view.setUint8(0, value);
  else if (valueType === "i16") view.setInt16(0, value, false);
  else if (valueType === "i32") view.setInt32(0, value, false);
  else view.setFloat32(0, value, false);
  return {
    fieldId,
    valueType,
    value,
    numericBits: [...bytes]
      .map((entry) => entry.toString(16).padStart(2, "0"))
      .join(""),
  };
}

function requiredSample(fields, fieldId) {
  const value = fields?.get(fieldId);
  assert.ok(value, `retained field ${fieldId}`);
  return value;
}

function scalar(value) {
  return {
    fieldId: value.fieldId,
    valueType: value.valueType,
    value: value.value,
    numericBits: value.numericBits,
  };
}

function assertFailsWithoutMutation(state, callback, expectedBoundary) {
  const before = JSON.stringify(state);
  assert.throws(
    callback,
    expectedBoundary === undefined
      ? undefined
      : (error) => error?.boundary === expectedBoundary,
  );
  assert.equal(JSON.stringify(state), before);
  assertDeepFrozen(state);
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function skipUnless(urls, label) {
  const missing = urls.filter((url) => !existsSync(url));
  return {
    skip: missing.length === 0
      ? false
      : `${label} unavailable: ${missing.map(({ pathname }) => pathname).join(", ")}`,
  };
}

function assertDeepFrozen(value) {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}
