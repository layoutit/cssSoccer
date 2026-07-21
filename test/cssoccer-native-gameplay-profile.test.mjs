import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { createContactProfile } from "../src/cssoccer/contactState.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE_HASH,
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE_SCHEMA,
  assertCssoccerNativeGameplayProfile,
  projectCssoccerContactSourceProfile,
  projectCssoccerKeeperSourceConstants,
  projectCssoccerKickoffSourceProfile,
  projectCssoccerMotionSourceProfile,
  projectCssoccerTravelSourceProfile,
} from "../src/cssoccer/nativeGameplayProfile.mjs";

const ROOT = new URL("../", import.meta.url);
const RUNTIME_URL = new URL("../src/cssoccer/nativeGameplayProfile.mjs", import.meta.url);
const EXE_URL = new URL(
  "../.local/cssoccer/oracle/runner-build-1/TEST.EXE",
  import.meta.url,
);
const MAP_URL = new URL(
  "../.local/cssoccer/oracle/runner-build-1/TEST.MAP",
  import.meta.url,
);
const RETAINED_PROFILE_URL = new URL(
  "../.local/cssoccer/oracle/native/retained/runs/canonical-a/profile.json",
  import.meta.url,
);
const HAS_COMPILED_EVIDENCE = existsSync(EXE_URL) && existsSync(MAP_URL);

test("compiled gameplay profile is immutable, hash-bound, and bit exact", () => {
  const profile = CSSOCCER_NATIVE_GAMEPLAY_PROFILE;
  assert.equal(profile.schema, CSSOCCER_NATIVE_GAMEPLAY_PROFILE_SCHEMA);
  assert.equal(profile.profileHash, CSSOCCER_NATIVE_GAMEPLAY_PROFILE_HASH);
  assert.equal(
    profile.bindings.sourceRevision,
    "b40bd6d1e50e052030c5f0884fbe3deda7e9fa4b",
  );
  assert.equal(
    profile.bindings.nativeBuildSha256,
    "5db9d52f4dec6e71d2a1df1009c803967455a3683b1c87e271669165ef43a3e3",
  );
  assertDeepFrozen(profile);

  const { profileHash: ignored, ...hashBody } = profile;
  assert.equal(
    createHash("sha256").update(JSON.stringify(hashBody)).digest("hex"),
    profile.profileHash,
  );

  const { constants } = profile;
  for (const [constant, bits] of [
    [constants.prat, "412aaaab"],
    [constants.kickoff.keeperOffline, "41800000"],
    [constants.kickoff.facingAngle, "3f733333"],
    [constants.kickoff.besideBall, "40a00000"],
    [constants.motion.celebrationSpeed, "3fd851ec"],
    [constants.motion.imThereDistance, "40000000"],
    [constants.keeper.closeAngleDistance, "432aaaab"],
    [constants.contact.playerSize, "412aaaab"],
    [constants.contact.playerHeight, "41c80000"],
    [constants.contact.fallRate, "40800000"],
  ]) {
    assert.equal(constant.valueType, "f32");
    assert.equal(constant.numericBits, bits);
    assert.equal(f32Bits(constant.value), bits);
  }

  assert.equal(constants.contact.playerSize.aliasOf, "prat");
  assert.equal(constants.contact.playerSize.value, constants.prat.value);
  assert.equal(constants.motion.maxTurn.evaluation, "x87-extended-store-f32");
  assert.equal(constants.motion.maxTurn2.evaluation, "x87-extended-store-f32");
  assert.equal(constants.motion.stepRange.evaluation, "x87-extended");
  assert.equal(constants.keeper.saveJumpHeight.evaluation, "x87-extended");
  assert.equal(constants.motion.maxTurn.pi.numericBits, "400921fb544486e0");
  assert.equal(constants.motion.maxTurn.degreesPerCircle.numericBits, "4066800000000000");
  assert.equal(constants.motion.stepRange.multiplier.numericBits, "400e666666666666");
  assert.equal(constants.keeper.saveJumpHeight.multiplier.numericBits, "400b333333333333");
});

test("strict projections match the accepted reducer shapes without defaults", () => {
  const profile = CSSOCCER_NATIVE_GAMEPLAY_PROFILE;
  const kickoff = projectCssoccerKickoffSourceProfile(profile);
  assert.deepEqual(kickoff, {
    schema: "cssoccer-kickoff-source-profile@1",
    profileHash: profile.profileHash,
    keeperOffline: f32FromBits("41800000"),
    facingAngle: f32FromBits("3f733333"),
    besideBall: f32FromBits("40a00000"),
    setPieceWaitTicks: 240,
    actionIds: { stand: 0, run: 1, pickup: 19 },
    officialActionIds: { normal: 0, positioning: 1, waitForKick: 2, ready: 4 },
  });

  const motion = projectCssoccerMotionSourceProfile(profile, { teamRate: 64 });
  assert.deepEqual(Object.keys(motion), ["celebrationSpeed", "maxTurnRadians"]);
  assert.equal(f32Bits(motion.celebrationSpeed), "3fd851ec");
  assert.equal(f32Bits(motion.maxTurnRadians), "3ec49809");

  const travel = projectCssoccerTravelSourceProfile(profile, { teamRate: 64 });
  assert.deepEqual(Object.keys(travel), [
    "maxTurn2Radians",
    "imThereDistance",
    "stepRange",
  ]);
  assert.equal(f32Bits(travel.maxTurn2Radians), "3ec49809");
  assert.equal(f32Bits(travel.imThereDistance), "40000000");
  assert.equal(travel.stepRange, f32FromBits("412aaaab") * 3.8);

  const keeper = projectCssoccerKeeperSourceConstants(profile);
  assert.deepEqual(Object.keys(keeper), [
    "keeperOffline",
    "closeAngleDistance",
    "saveJumpHeight",
  ]);
  assert.equal(f32Bits(keeper.keeperOffline), "41800000");
  assert.equal(f32Bits(keeper.closeAngleDistance), "432aaaab");
  assert.equal(keeper.saveJumpHeight, f32FromBits("412aaaab") * 3.4);

  const contact = projectCssoccerContactSourceProfile(profile, {
    touchBallBox: 9,
    atFeetDistance: 6,
    ballRadius: 2,
    pitchRatio: f32FromBits("412aaaab"),
    verticalBallDamp: 0.6,
    effectiveTackle: 17,
    refereeStrictness: 64,
  });
  assert.deepEqual(createContactProfile(contact), contact);
  assert.equal(Object.isFrozen(contact), true);
  assert.equal(f32Bits(contact.playerHeight), "41c80000");
  assert.equal(f32Bits(contact.playerSize), "412aaaab");
  assert.equal(contact.saveContact, 11);
  assert.equal(f32Bits(contact.fallRate), "40800000");
});

test("profile and projection drift fail closed", () => {
  const profile = CSSOCCER_NATIVE_GAMEPLAY_PROFILE;
  const changedBuild = clone(profile);
  changedBuild.bindings.nativeBuildSha256 = "f".repeat(64);
  assert.throws(
    () => assertCssoccerNativeGameplayProfile(changedBuild),
    /source\/build binding changed/u,
  );

  const changedConstant = clone(profile);
  changedConstant.constants.actionIds.run.value = 7;
  assert.throws(
    () => projectCssoccerKickoffSourceProfile(changedConstant),
    /contents changed/u,
  );

  const changedHash = clone(profile);
  changedHash.profileHash = "0".repeat(64);
  assert.throws(
    () => projectCssoccerKeeperSourceConstants(changedHash),
    /profile hash changed/u,
  );

  assert.throws(
    () => projectCssoccerMotionSourceProfile(profile),
    /plain object/u,
  );
  assert.throws(
    () => projectCssoccerMotionSourceProfile(profile, { teamRate: 64, fallback: 0 }),
    /unsupported or missing keys/u,
  );
  assert.throws(
    () => projectCssoccerTravelSourceProfile(profile, { teamRate: 256 }),
    /integer in 0\.\.255/u,
  );
  assert.throws(
    () => projectCssoccerContactSourceProfile(profile, {
      touchBallBox: 9,
      atFeetDistance: 6,
      ballRadius: 2,
      pitchRatio: 10,
      verticalBallDamp: 0.6,
      effectiveTackle: 17,
    }),
    /unsupported or missing keys/u,
  );
});

test("ignored TEST.EXE and TEST.MAP prove the compiled constants", {
  skip: !HAS_COMPILED_EVIDENCE,
}, () => {
  const executable = readFileSync(EXE_URL);
  const map = readFileSync(MAP_URL, "utf8");
  const image = new LinearExecutable(executable);
  const code = image.objectBytes(1, 0, 0x80000);
  const data = image.objectBytes(3, 0, 0x10000);
  const evidence = CSSOCCER_NATIVE_GAMEPLAY_PROFILE.bindings.compiledEvidence;

  assert.equal(sha256(executable), evidence.testExeSha256);
  assert.equal(sha256(Buffer.from(map)), evidence.testMapSha256);
  assert.equal(mapOffset(map, "float near prat"), 0xde80);
  assert.equal(data.subarray(0xde80, 0xde84).toString("hex"), "abaa2a41");

  const functions = {
    fullSpeed: functionRange(map, "full_spd(", "actual_spd("),
    stand: functionRange(map, "init_stand_act(", "init_steal_act("),
    pickup: functionRange(map, "init_pickup_act(", "pickup_action("),
    run: functionRange(map, "init_run_act(", "init_fall("),
    newDirection: functionRange(map, "new_dir(", "dir_movement("),
    travelTime: functionRange(map, "get_there_time(", "get_facing_opp_dir("),
    facing: functionRange(map, "plr_facing(", "plr_facing_goal("),
    saveZoneC: functionRange(map, "save_in_zone_c(", "close_angle("),
    closeAngle: functionRange(map, "close_angle(", "target_towards_ball("),
    zonalTarget: functionRange(map, "find_zonal_target(", "get_near_path("),
    rebound: functionRange(map, "rebound_off_plr(", "has_ball("),
    ballInteract: functionRange(map, "ball_interact(", "predict_ball("),
    initCentre: functionRange(map, "init_centre(", "init_match_mode("),
    initMatchMode: functionRange(map, "init_match_mode(", "init_ref_stand("),
    readySetKick: functionRange(map, "ready_set_kick(", "await_set_kick("),
    awaitSetKick: functionRange(map, "await_set_kick(", "centre_takers("),
    atTarget: functionRange(map, "at_target(", "follow_play("),
  };

  assertHex(functionSlice(code, functions.fullSpeed), "c745f8ec51d83f");
  assertHex(functionSlice(code, functions.stand), "66c7808e0000000000");
  assertHex(functionSlice(code, functions.run), "66c7808e0000000100");
  assertHex(functionSlice(code, functions.pickup), "66c7808e0000001300");

  assert.equal(data.subarray(0x1933, 0x193b).toString("hex"), "0000003e00006041");
  assert.equal(f64Bits(data.readDoubleLE(0x193b)), "400921fb544486e0");
  assert.equal(f64Bits(data.readDoubleLE(0x1943)), "4066800000000000");
  assertHex(functionSlice(code, functions.newDirection), "d80d33190000");
  assertHex(functionSlice(code, functions.newDirection), "d80537190000");
  assertHex(functionSlice(code, functions.newDirection), "dc0d3b190000");
  assertHex(functionSlice(code, functions.newDirection), "d95de4");

  assert.equal(data.readFloatLE(0x1fdc), 0.125);
  assert.equal(data.readFloatLE(0x1fe0), 14);
  assert.equal(f64Bits(data.readDoubleLE(0x1fe4)), "400921fb544486e0");
  assert.equal(f64Bits(data.readDoubleLE(0x1fec)), "4066800000000000");
  assertHex(functionSlice(code, functions.travelTime), "d80ddc1f0000");
  assertHex(functionSlice(code, functions.travelTime), "d805e01f0000");
  assertHex(functionSlice(code, functions.travelTime), "dc0de41f0000");
  assertHex(functionSlice(code, functions.travelTime), "d95dc0");

  assertHex(functionSlice(code, functions.run), "817df000000040");
  assert.equal(f64Bits(data.readDoubleLE(0x1760)), "400e666666666666");
  assert.equal(data.readDoubleLE(0x1768), 2);
  assertHex(functionSlice(code, functions.run), "dc0d60170000");
  assertHex(functionSlice(code, functions.run), "dc0d68170000");

  assert.equal(f64Bits(data.readDoubleLE(0x2004)), "3fee666666666666");
  assertHex(functionSlice(code, functions.facing), "dc1d04200000");
  assertHex(functionSlice(code, functions.zonalTarget), "c745ec00008041");
  assertHex(functionSlice(code, functions.zonalTarget), "83e810");

  assert.equal(data.readFloatLE(0x2318), 16);
  assertHex(functionSlice(code, functions.closeAngle), "d90580de0000d80d18230000");
  assertHex(functionSlice(code, functions.closeAngle), "d95df8");
  assert.equal(f64Bits(data.readDoubleLE(0x22ec)), "400b333333333333");
  assertHex(functionSlice(code, functions.saveZoneC), "d90580de0000dc0dec220000");

  assert.equal(data.readFloatLE(0x2e7c), 5);
  assertHex(functionSlice(code, functions.initCentre), "d80d7c2e0000");
  assertHex(functionSlice(code, functions.initMatchMode), "66c705f00f0400f000");
  assert.equal(data.readFloatLE(0x1795), 4);
  assert.equal(f64Bits(data.readDoubleLE(0x1ede)), "4026000000000000");
  assertHex(functionSlice(code, functions.rebound), "dc2dde1e0000");
  assert.equal(data.readFloatLE(0x1f86), 25);
  assertHex(functionSlice(code, functions.ballInteract), "d805861f0000");

  assertHex(functionSlice(code, functions.readySetKick), "c705f00d040000000000");
  assertHex(functionSlice(code, functions.initCentre), "c705f00d040001000000");
  assertHex(functionSlice(code, functions.awaitSetKick), "c705f00d040002000000");
  assertHex(functionSlice(code, functions.awaitSetKick), "833df00d040004");
  assertHex(functionSlice(code, functions.atTarget), "c7402804000000");
});

test("retained capture build agrees with the runtime binding when present", {
  skip: !existsSync(RETAINED_PROFILE_URL),
}, () => {
  const retained = JSON.parse(readFileSync(RETAINED_PROFILE_URL, "utf8"));
  assert.equal(
    retained.buildSha256,
    CSSOCCER_NATIVE_GAMEPLAY_PROFILE.bindings.nativeBuildSha256,
  );
});

test("runtime module has no filesystem, evidence, or Node-only imports", () => {
  const source = readFileSync(RUNTIME_URL, "utf8");
  assert.doesNotMatch(
    source,
    /(?:node:fs|node:crypto|\.local\/|readFile|createHash|createReadStream|process\.)/u,
  );
  assert.doesNotMatch(source, /^\s*import\s/mu);
  assert.equal(new URL("./src/cssoccer/nativeGameplayProfile.mjs", ROOT).protocol, "file:");
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function f32FromBits(bits) {
  return Buffer.from(bits, "hex").readFloatBE(0);
}

function f32Bits(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeFloatBE(value);
  return bytes.toString("hex");
}

function f64Bits(value) {
  const bytes = Buffer.alloc(8);
  bytes.writeDoubleBE(value);
  return bytes.toString("hex");
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const nested of Object.values(value)) assertDeepFrozen(nested);
}

function mapOffset(map, marker) {
  const line = map.split(/\r?\n/u).find((candidate) => candidate.includes(marker));
  assert.ok(line, `TEST.MAP must contain ${marker}`);
  const match = /^000[1-3]:([a-f0-9]{8})/iu.exec(line);
  assert.ok(match, `TEST.MAP entry for ${marker} must expose an object offset`);
  return Number.parseInt(match[1], 16);
}

function functionRange(map, startMarker, endMarker) {
  const start = mapOffset(map, `near ${startMarker}`);
  const end = mapOffset(map, `near ${endMarker}`);
  assert.ok(end > start, `${startMarker} must precede ${endMarker}`);
  return { start, end };
}

function functionSlice(code, { start, end }) {
  return code.subarray(start, end);
}

function assertHex(bytes, pattern) {
  assert.notEqual(
    bytes.indexOf(Buffer.from(pattern, "hex")),
    -1,
    `compiled function must contain ${pattern}`,
  );
}

class LinearExecutable {
  constructor(bytes) {
    this.bytes = bytes;
    this.header = bytes.readUInt32LE(0x3c);
    assert.equal(bytes.subarray(this.header, this.header + 2).toString("ascii"), "LE");
    this.pageSize = bytes.readUInt32LE(this.header + 0x28);
    this.objectTable = this.header + bytes.readUInt32LE(this.header + 0x40);
    this.pageMap = this.header + bytes.readUInt32LE(this.header + 0x48);
    this.dataPages = bytes.readUInt32LE(this.header + 0x80);
  }

  objectBytes(objectNumber, offset, length) {
    const entry = this.objectTable + (objectNumber - 1) * 24;
    const size = this.bytes.readUInt32LE(entry);
    const pageIndex = this.bytes.readUInt32LE(entry + 12);
    const pageCount = this.bytes.readUInt32LE(entry + 16);
    assert.ok(offset >= 0 && length >= 0 && offset + length <= size);
    assert.ok(offset + length <= pageCount * this.pageSize);
    const output = Buffer.alloc(length);
    let written = 0;
    while (written < length) {
      const cursor = offset + written;
      const logicalPage = Math.floor(cursor / this.pageSize);
      const withinPage = cursor % this.pageSize;
      const pageEntry = this.pageMap + (pageIndex - 1 + logicalPage) * 4;
      const physicalPage = this.bytes.readUIntBE(pageEntry, 3);
      const flags = this.bytes[pageEntry + 3];
      assert.ok(physicalPage > 0);
      assert.equal(flags, 0);
      const take = Math.min(length - written, this.pageSize - withinPage);
      const fileOffset = this.dataPages
        + (physicalPage - 1) * this.pageSize
        + withinPage;
      this.bytes.copy(output, written, fileOffset, fileOffset + take);
      written += take;
    }
    return output;
  }
}
