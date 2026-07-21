import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import test from "node:test";

import {
  CSSOCCER_KICKOFF_PLAYER_MOTION_SCHEMA,
  CSSOCCER_KICKOFF_PLAYER_MOTION_SOURCE,
  CssoccerUnsupportedKickoffPlayerMotionError,
  assertCssoccerKickoffPlayerMotion,
  createCssoccerKickoffPlayerMotion,
  resetCssoccerKickoffPlayerMotion,
  stepCssoccerKickoffPlayerMotion,
} from "../src/cssoccer/kickoffPlayerMotion.mjs";
import { createCssoccerKickoffState } from "../src/cssoccer/kickoffState.mjs";
import { stepCssoccerMatchLifecycle } from "../src/cssoccer/matchLifecycle.mjs";
import { createCssoccerMatchState } from "../src/cssoccer/matchState.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  projectCssoccerKickoffSourceProfile,
} from "../src/cssoccer/nativeGameplayProfile.mjs";
import {
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  projectCssoccerNativeTeamRates,
} from "../src/cssoccer/nativeFixturePlayerProfile.mjs";
import {
  createCssoccerPlayerStaminaState,
  projectCssoccerPlayerStaminaTeamRates,
  stepCssoccerPlayerStaminaState,
} from "../src/cssoccer/playerStaminaState.mjs";

const F32 = Math.fround;
const ROOT = new URL("../", import.meta.url);
const generatedRoot = new URL("../build/generated/public/cssoccer/", import.meta.url);
const fixtureFiles = {
  facts: new URL("facts/spain-argentina-full-match.json", generatedRoot),
  scene: new URL("scenes/spain-argentina-full-match.json", generatedRoot),
};
const sourceRoot = new URL("../.local/actua-soccer/source/", import.meta.url);
const sourceFiles = Object.fromEntries(
  CSSOCCER_KICKOFF_PLAYER_MOTION_SOURCE.files.map(({ file }) => [
    file,
    new URL(file, sourceRoot),
  ]),
);
const retainedRoot = new URL(
  "../.local/cssoccer/oracle/native/retained/runs/canonical-a/",
  import.meta.url,
);
const retainedFiles = {
  raw: new URL("native.raw", retainedRoot),
  state: new URL("state.jsonl", retainedRoot),
  profile: new URL("profile.json", retainedRoot),
};
const fixtureContractUrl = new URL("../references/spain-argentina-match.json", import.meta.url);
const runtimeUrl = new URL("../src/cssoccer/kickoffPlayerMotion.mjs", import.meta.url);
const fixtureOptions = skipUnless(Object.values(fixtureFiles), "prepared kickoff fixture");
const sourceOptions = skipUnless(Object.values(sourceFiles), "pinned Actua source");
const retainedOptions = skipUnless(
  [...Object.values(fixtureFiles), ...Object.values(retainedFiles), fixtureContractUrl],
  "prepared fixture and retained native kickoff stream",
);

const matchCache = new Map();
let secondHalfCache;

test("opening setup creates 22 immutable native-slot travel states for either country choice", fixtureOptions, () => {
  const spain = openingMotion("spain");
  const argentina = openingMotion("argentina");

  assert.equal(assertCssoccerKickoffPlayerMotion(spain), spain);
  assert.equal(spain.schema, CSSOCCER_KICKOFF_PLAYER_MOTION_SCHEMA);
  assert.equal(spain.players.length, 22);
  assert.deepEqual(
    spain.players.map(({ nativePlayerNumber }) => nativePlayerNumber),
    Array.from({ length: 22 }, (_, index) => index + 1),
  );
  assert.deepEqual(
    spain.players.map(({ id }) => id),
    argentina.players.map(({ id }) => id),
  );
  assert.equal(
    JSON.stringify(spain.players),
    JSON.stringify(argentina.players),
    "selected control country cannot alter autonomous kickoff travel",
  );
  assert.equal(spain.selectedCountry, "spain");
  assert.equal(argentina.selectedCountry, "argentina");
  assert.deepEqual(spain.sourceOrder, ["do_action", "process_dir"]);
  assert.equal(Object.isFrozen(spain), true);
  assert.equal(Object.isFrozen(spain.players[0].position), true);

  const goTo = sourceGoToPositionDistance();
  assert.equal(spain.config.goToPositionDistance, goTo);
  assert.notEqual(goTo, F32(goTo), "GO_TO_POS_DIST comparison must retain its double/x87 operand");
});

test("the first tick moves on the old facing before process_dir turns toward the target", fixtureOptions, () => {
  const initial = openingMotion("argentina");
  const before = initial.players[0];
  const next = stepCssoccerKickoffPlayerMotion(initial);
  const after = next.players[0];

  assert.equal(initial.tick, 0);
  assert.equal(next.tick, 1);
  assert.equal(before.position.y, after.position.y);
  assert.notEqual(before.position.x, after.position.x);
  assert.deepEqual(before.facing, { x: F32(1), y: F32(0) });
  assert.notEqual(after.facing.y, F32(0));
  assert.equal(after.action, CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.actionIds.run.value);
  assert.equal(after.goCount, 0, "find_zonal_target clears go_cnt after its one action");
  assert.equal(after.lastPlan.choice, "turn-and-run");
  assert.equal(initial.players[0].action, 0, "the immutable input state was not modified");
});

test("all starters exercise native travel branches and converge without deadlock", fixtureOptions, () => {
  let state = openingMotion("spain");
  const initial = state;
  const choices = new Set();
  while (state.status !== "settled" && state.tick < 500) {
    state = stepCssoccerKickoffPlayerMotion(state);
    for (const player of state.players) choices.add(player.lastPlan?.choice);
  }

  assert.equal(state.status, "settled");
  assert.ok(state.tick < 500);
  assert.deepEqual(
    choices,
    new Set([
      "turn-and-run",
      "side-step",
      "arrived",
      "within-position-tolerance",
    ]),
  );
  for (const player of state.players) {
    assert.equal(player.action, state.config.actionIds.stand, player.id);
    assert.deepEqual(player.position, player.target, `${player.id} must source-snap on arrival`);
    assert.equal(player.arrived, true, player.id);
    assert.equal(player.settled, true, player.id);
  }

  const reset = resetCssoccerKickoffPlayerMotion(state);
  assert.equal(JSON.stringify(reset), JSON.stringify(initial));
  assert.equal(reset.tick, 0);
});

test("post-swap setup keeps stable identities while consuming second-half native slots", fixtureOptions, () => {
  const match = preparedMatch("argentina");
  const lifecycle = secondHalfLifecycle(match);
  const kickoff = createCssoccerKickoffState({
    lifecycle,
    tacticsState: match.tactics,
    sourceProfile: projectCssoccerKickoffSourceProfile(CSSOCCER_NATIVE_GAMEPLAY_PROFILE),
  });
  const state = createMotion(match, kickoff);

  assert.equal(state.matchHalf, 1);
  assert.deepEqual(state.teamBySlot, { A: "argentina", B: "spain" });
  assert.equal(state.players[0].id, "argentina-player-01");
  assert.equal(state.players[0].nativePlayerNumber, 1);
  assert.equal(state.players[11].id, "spain-player-01");
  assert.equal(state.players[11].nativePlayerNumber, 12);
  assert.equal(state.players.find(({ role }) => role === "taker").id, "argentina-player-07");
  assert.equal(state.players.find(({ role }) => role === "receiver").id, "argentina-player-10");
  assert.equal(JSON.stringify(state), JSON.stringify(createMotion(match, kickoff)));
  assert.equal(stepCssoccerKickoffPlayerMotion(state).tick, 1);
});

test("missing native bindings and unsupported action/direction seams fail closed", fixtureOptions, () => {
  const match = preparedMatch("spain");
  const kickoff = openingKickoff(match);
  const input = motionInput(match, kickoff);

  const missingGoTo = clone(input);
  delete missingGoTo.goToPositionDistance;
  assert.throws(
    () => createCssoccerKickoffPlayerMotion(missingGoTo),
    /must contain exactly/u,
  );

  const roundedGoTo = clone(input);
  roundedGoTo.goToPositionDistance = F32(sourceGoToPositionDistance());
  const roundedState = createCssoccerKickoffPlayerMotion(roundedGoTo);
  assert.equal(roundedState.config.goToPositionDistance, roundedGoTo.goToPositionDistance);

  const unsupportedAction = clone(input);
  unsupportedAction.players[0].action = 19;
  assert.throws(
    () => createCssoccerKickoffPlayerMotion(unsupportedAction),
    (error) => error instanceof CssoccerUnsupportedKickoffPlayerMotionError
      && error.boundary === "tm_act",
  );

  const unsupportedDirection = clone(input);
  unsupportedDirection.players[0].directionMode = 6;
  assert.throws(
    () => createCssoccerKickoffPlayerMotion(unsupportedDirection),
    (error) => error instanceof CssoccerUnsupportedKickoffPlayerMotionError
      && error.boundary === "dir_mode",
  );

  const animationLeak = clone(input);
  animationLeak.players[0].animation = 72;
  assert.throws(
    () => createCssoccerKickoffPlayerMotion(animationLeak),
    /must contain exactly/u,
  );
});

test("pinned ACTIONS, INTELL, and MATHS sources retain the implemented call order and branches", sourceOptions, () => {
  for (const source of CSSOCCER_KICKOFF_PLAYER_MOTION_SOURCE.files) {
    assert.equal(sha256(readFileSync(sourceFiles[source.file])), source.sha256, source.file);
  }
  const actions = readFileSync(sourceFiles["ACTIONS.CPP"], "latin1");
  const intelligence = readFileSync(sourceFiles["INTELL.CPP"], "latin1");
  const mathematics = readFileSync(sourceFiles["MATHS.CPP"], "latin1");
  assert.match(
    actions,
    /void init_run_act\(match_player \*player,float tx,float ty,char s\)[\s\S]*d<IM_THERE_DIST[\s\S]*player->go_step && d<STEP_RANGE\*2[\s\S]*player->go_cnt=get_there_time/u,
  );
  assert.match(
    actions,
    /void go_forward\(match_player \*player\)[\s\S]*if \(player->go_step\)[\s\S]*if \(player->go_stop\)[\s\S]*float turn_spd=\(1\.0\+a\)\/2/u,
  );
  assert.match(
    actions,
    /computer_play\(player_num\)[\s\S]*process_dir\(&teams\[player_num-1\]\)/u,
  );
  assert.match(
    intelligence,
    /short get_there_time\(int p_num,float x,float y\)[\s\S]*for \(int i=0; i<50; i\+\+\)[\s\S]*Rotate and run[\s\S]*Turn and run/u,
  );
  assert.match(
    intelligence,
    /void find_zonal_target\(match_player \*player,float px,float py\)[\s\S]*init_run_act\(player,tx\+px,ty\+py,TRUE\)[\s\S]*go_forward\(player\)[\s\S]*player->go_cnt=0/u,
  );
  assert.match(
    mathematics,
    /float calc_dist\(float x,float y\)[\s\S]*r=sqrt\(\(x\*x\)\+\(y\*y\)\)[\s\S]*if \(r>0\.1\)/u,
  );
});

test("installed retained stream agrees exactly through the opening positioning window", retainedOptions, async () => {
  const match = preparedMatch("argentina");
  const kickoff = openingKickoff(match);
  const nativeRates = retainedNativeTeamRates();
  assert.deepEqual(
    [...nativeRates],
    [...fixtureTeamRates(kickoff.matchHalf)],
    "published fixture rates must be independently qualified by native raw bytes",
  );
  let state = createMotion(match, kickoff, nativeRates);
  let stamina = createCssoccerPlayerStaminaState({
    nativeFixturePlayerProfile: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  });
  const retained = await retainedWindow(171);

  assert.equal(
    retained.header.bindings.buildSha256,
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE.bindings.nativeBuildSha256,
  );
  assert.equal(nativeRates.size, 22);
  for (let tick = 1; tick <= 171; tick += 1) {
    stamina = stepCssoccerPlayerStaminaState(stamina, {
      tick,
      gameMinute: Math.floor((tick * 9) / 240),
    });
    state = stepCssoccerKickoffPlayerMotion(state, {
      teamRates: projectCssoccerPlayerStaminaTeamRates(stamina),
    });
    const expected = retained.ticks.get(tick);
    assert.equal(expected.size, 22 * 6, `retained player field count at tick ${tick}`);
    for (const sample of projectPlayerSamples(state)) {
      assert.deepEqual(
        sample,
        sampleValue(expected.get(sample.fieldId)),
        `${sample.fieldId} at tick ${tick}`,
      );
    }
  }
});

test("runtime kickoff motion has no filesystem, oracle, retained, prepare, or Node dependency", () => {
  const source = readFileSync(runtimeUrl, "utf8");
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/gu)].map((match) => match[1]);
  assert.ok(imports.length > 0);
  assert.ok(imports.every((specifier) => specifier.startsWith("./")));
  assert.doesNotMatch(
    source,
    /node:|\.local\/|state\.jsonl|native\.raw|readFile|createReadStream|src\/prepare|oracle/u,
  );
  assert.equal(new URL("./src/cssoccer/kickoffPlayerMotion.mjs", ROOT).protocol, "file:");
});

function openingMotion(selectedCountry) {
  const match = preparedMatch(selectedCountry);
  return createMotion(match, openingKickoff(match));
}

function createMotion(match, kickoff, rateById = fixtureTeamRates(kickoff.matchHalf)) {
  return createCssoccerKickoffPlayerMotion(motionInput(match, kickoff, rateById));
}

function motionInput(match, kickoff, rateById = fixtureTeamRates(kickoff.matchHalf)) {
  const scene = preparedScene();
  const players = match.lifecycle.teamState.players
    .map((player) => playerForNativeSlot(
      player,
      kickoff.players.find(({ id }) => id === player.id),
      rateById.get(player.id),
    ))
    .sort((left, right) => left.nativePlayerNumber - right.nativePlayerNumber);
  return {
    kickoffState: kickoff,
    nativeGameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    pitchLength: F32(scene.dimensions.playingFieldNative.length),
    goToPositionDistance: sourceGoToPositionDistance(),
    players,
    selectedCountry: match.selectedCountry,
  };
}

function playerForNativeSlot(player, target, teamRate) {
  const source = player.formation.kickoff.sourceValues;
  assert.ok(target);
  assert.ok(Number.isInteger(teamRate));
  return {
    id: player.id,
    nativePlayerNumber: target.nativePlayerNumber,
    active: player.current.active,
    teamRate,
    action: source.action.value,
    directionMode: 0,
    faceDirection: 0,
    position: { x: source.x.value, y: source.y.value },
    facing: {
      x: source.xDisplacement.value,
      y: source.yDisplacement.value,
    },
  };
}

function openingKickoff(match) {
  return createCssoccerKickoffState({
    lifecycle: match.lifecycle,
    tacticsState: match.tactics,
    sourceProfile: projectCssoccerKickoffSourceProfile(CSSOCCER_NATIVE_GAMEPLAY_PROFILE),
  });
}

function preparedMatch(selectedCountry) {
  if (!matchCache.has(selectedCountry)) {
    matchCache.set(selectedCountry, createCssoccerMatchState({
      preparedFacts: preparedFacts(),
      preparedScene: preparedScene(),
      selectedCountry,
    }));
  }
  return matchCache.get(selectedCountry);
}

function secondHalfLifecycle(match) {
  if (secondHalfCache) return secondHalfCache;
  let lifecycle = match.lifecycle;
  while (lifecycle.clock.phase !== "halftime-end-swap-second-half-kickoff") {
    lifecycle = stepCssoccerMatchLifecycle(lifecycle).state;
  }
  secondHalfCache = lifecycle;
  return lifecycle;
}

function preparedFacts() {
  return JSON.parse(readFileSync(fixtureFiles.facts, "utf8"));
}

function preparedScene() {
  return JSON.parse(readFileSync(fixtureFiles.scene, "utf8"));
}

function fixtureTeamRates(matchHalf) {
  return new Map(projectCssoccerNativeTeamRates(
    CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
    { matchHalf },
  ).map(({ id, value }) => [id, value]));
}

function sourceGoToPositionDistance() {
  // Pinned selector source: (0.8 * prat). `prat` is f32, then promoted into
  // the source double/x87 comparison expression; there is no f32 store here.
  return CSSOCCER_NATIVE_GAMEPLAY_PROFILE.constants.prat.value * 0.8;
}

function retainedNativeTeamRates() {
  const bytes = readFileSync(retainedFiles.raw);
  const profile = JSON.parse(readFileSync(retainedFiles.profile, "utf8"));
  const fixture = JSON.parse(readFileSync(fixtureContractUrl, "utf8"));
  const raw = fixture.oracle.capture.raw;
  assert.equal(bytes.subarray(0, 8).toString("ascii"), raw.magic);
  assert.equal(bytes.readUInt32LE(8), raw.version);
  assert.equal(bytes.readUInt32LE(12), raw.ranges.length);
  assert.deepEqual(profile.transport.rawRanges, raw.ranges);

  let cursor = 16;
  let payloadBase = 0;
  const ranges = [];
  for (const expected of raw.ranges) {
    const range = {
      offset: bytes.readUInt32LE(cursor),
      bytes: bytes.readUInt32LE(cursor + 4),
      payloadBase,
    };
    assert.deepEqual(
      { offset: range.offset, bytes: range.bytes },
      expected,
    );
    ranges.push(range);
    payloadBase += range.bytes;
    cursor += 8;
  }
  const recordBytes = raw.metadataBytes + payloadBase;
  let recordOffset = cursor;
  while (recordOffset < bytes.length) {
    assert.equal(bytes.subarray(recordOffset, recordOffset + 4).toString("ascii"), raw.recordMarker);
    const activeTick = bytes.readUInt32LE(recordOffset + 20);
    const flags = bytes.readUInt32LE(recordOffset + 24);
    if ((flags & raw.flags.active) !== 0 && activeTick === 0) break;
    recordOffset += recordBytes;
  }
  assert.ok(recordOffset < bytes.length, "native.raw must contain active tick zero");

  const teamsAddress = 0x3cf6c;
  const teamRange = ranges.find(({ offset, bytes: width }) => (
    teamsAddress >= offset && teamsAddress < offset + width
  ));
  assert.ok(teamRange);
  const teamsPayload = recordOffset
    + raw.metadataBytes
    + teamRange.payloadBase
    + teamsAddress
    - teamRange.offset;
  const matchPlayerBytes = 203;
  const teamRateOffset = 70;
  const opening = openingKickoff(preparedMatch("argentina"));
  return new Map(opening.players.map((player, index) => [
    player.id,
    bytes.readUInt8(teamsPayload + (index * matchPlayerBytes) + teamRateOffset),
  ]));
}

async function retainedWindow(maxTick) {
  const wantedFields = new Set(openingKickoff(preparedMatch("argentina")).players.flatMap(({ id }) => [
    `players.${id}.action`,
    `players.${id}.face_direction`,
    `players.${id}.x`,
    `players.${id}.x_displacement`,
    `players.${id}.y`,
    `players.${id}.y_displacement`,
  ]));
  const ticks = new Map(Array.from({ length: maxTick }, (_, index) => [index + 1, new Map()]));
  const input = createReadStream(retainedFiles.state);
  const lines = createInterface({ input, crlfDelay: Infinity });
  let header;
  for await (const line of lines) {
    const record = JSON.parse(line);
    if (record.recordType === "header") {
      header = record;
    } else if (record.tick > maxTick) {
      lines.close();
      input.destroy();
      break;
    } else if (ticks.has(record.tick) && wantedFields.has(record.fieldId)) {
      ticks.get(record.tick).set(record.fieldId, record);
    }
  }
  assert.ok(header);
  return { header, ticks };
}

function projectPlayerSamples(state) {
  return state.players.flatMap((player) => [
    typedSample(`players.${player.id}.action`, "i16", player.action),
    typedSample(`players.${player.id}.face_direction`, "i16", player.faceDirection),
    typedSample(`players.${player.id}.x`, "f32", player.position.x),
    typedSample(`players.${player.id}.x_displacement`, "f32", player.facing.x),
    typedSample(`players.${player.id}.y`, "f32", player.position.y),
    typedSample(`players.${player.id}.y_displacement`, "f32", player.facing.y),
  ]);
}

function typedSample(fieldId, valueType, value) {
  const bytes = Buffer.alloc(valueType === "f32" ? 4 : 2);
  if (valueType === "f32") bytes.writeFloatBE(value);
  else bytes.writeInt16BE(value);
  return { fieldId, valueType, value, numericBits: bytes.toString("hex") };
}

function sampleValue(record) {
  assert.ok(record);
  return {
    fieldId: record.fieldId,
    valueType: record.valueType,
    value: record.value,
    numericBits: record.numericBits,
  };
}

function skipUnless(files, label) {
  const missing = files.filter((file) => !existsSync(file));
  return {
    skip: missing.length === 0
      ? false
      : `${label} unavailable: ${missing.map(({ pathname }) => pathname).join(", ")}`,
  };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
