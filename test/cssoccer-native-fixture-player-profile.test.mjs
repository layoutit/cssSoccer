import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH,
  assertCssoccerNativeFixturePlayerProfile,
  projectCssoccerNativePlayerAttributes,
  projectCssoccerNativeTeamRates,
} from "../src/cssoccer/nativeFixturePlayerProfile.mjs";

const ROOT = new URL("../", import.meta.url);
const RAW_URL = new URL(
  ".local/cssoccer/oracle/native/retained/runs/canonical-a/native.raw",
  ROOT,
);
const FOOTBALL_URL = new URL(".local/actua-soccer/source/FOOTBALL.CPP", ROOT);
const ACTIONS_URL = new URL(".local/actua-soccer/source/ACTIONS.CPP", ROOT);
const FACTS_URL = new URL(
  "build/generated/public/cssoccer/facts/spain-argentina-full-match.json",
  ROOT,
);
const evidenceOptions = {
  skip: !existsSync(RAW_URL) || !existsSync(FOOTBALL_URL) || !existsSync(ACTIONS_URL)
    ? "ignored native/source initialization evidence unavailable"
    : false,
};

test("one immutable profile binds all 22 native initialization attribute blocks", () => {
  const profile = CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE;
  assert.equal(assertCssoccerNativeFixturePlayerProfile(profile), profile);
  assert.equal(profile.players.length, 22);
  assert.deepEqual(Object.keys(profile.players[0].attributes), [
    "pace",
    "power",
    "control",
    "flair",
    "vision",
    "accuracy",
    "stamina",
    "discipline",
  ]);
  assert.equal(profile.players[0].id, "spain-player-01");
  assert.equal(profile.players[0].attributes.pace, 62);
  assert.equal(profile.players[21].id, "argentina-player-11");
  assert.equal(profile.players[21].attributes.discipline, 23);
  assertDeepFrozen(profile);
});

test("profile hash and every upstream fixture binding fail closed", () => {
  const payload = structuredClone(CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE);
  delete payload.profileHash;
  assert.equal(sha256(canonicalJson(payload)), CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH);

  const driftedPlayer = structuredClone(CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE);
  driftedPlayer.players[0].attributes.pace += 1;
  assert.throws(
    () => assertCssoccerNativeFixturePlayerProfile(driftedPlayer),
    /profile|u8/u,
  );

  const driftedBinding = structuredClone(CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE);
  driftedBinding.bindings.nativeBuildSha256 = "0".repeat(64);
  assert.throws(
    () => assertCssoccerNativeFixturePlayerProfile(driftedBinding),
    /profile|binding|build/u,
  );

  const reordered = structuredClone(CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE);
  [reordered.players[0], reordered.players[1]] = [reordered.players[1], reordered.players[0]];
  assert.throws(
    () => assertCssoccerNativeFixturePlayerProfile(reordered),
    /identity or order/u,
  );
});

test("typed team rates follow stable identities through the one end swap", () => {
  const opening = projectCssoccerNativeTeamRates(
    CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
    { matchHalf: 0 },
  );
  const second = projectCssoccerNativeTeamRates(
    CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
    { matchHalf: 1 },
  );

  assert.deepEqual(opening[0], {
    id: "spain-player-01",
    nativePlayerNumber: 1,
    valueType: "u8",
    value: 62,
    numericBits: "3e",
  });
  assert.equal(opening[11].id, "argentina-player-01");
  assert.equal(opening[11].nativePlayerNumber, 12);
  assert.equal(second[0].id, "argentina-player-01");
  assert.equal(second[0].nativePlayerNumber, 1);
  assert.equal(second[11].id, "spain-player-01");
  assert.equal(second[11].nativePlayerNumber, 12);
  assert.deepEqual(
    second.map(({ id, value }) => [id, value]).sort(),
    opening.map(({ id, value }) => [id, value]).sort(),
  );
  assertDeepFrozen(opening);
  assert.throws(
    () => projectCssoccerNativeTeamRates(CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE, {
      matchHalf: 2,
    }),
    /must be 0 or 1/u,
  );
});

test("native raw initialization independently qualifies all 176 u8 values", evidenceOptions, () => {
  const bytes = readFileSync(RAW_URL);
  assert.equal(
    sha256(bytes),
    CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE.bindings.nativeRawSha256,
  );
  const raw = firstNativeRecord(bytes);
  const expected = projectCssoccerNativePlayerAttributes(
    CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
    { matchHalf: 0 },
  );
  const keys = Object.keys(expected[0].attributes);
  const teamsOffset = 0x3cf6c;
  const matchPlayerBytes = 203;
  const attributesOffset = 70;
  for (const [index, player] of expected.entries()) {
    assert.equal(player.nativePlayerNumber, index + 1);
    for (const [attributeIndex, key] of keys.entries()) {
      assert.equal(
        readRawU8(
          raw,
          teamsOffset + (index * matchPlayerBytes) + attributesOffset + attributeIndex,
        ),
        player.attributes[key],
        `${player.id} ${key}`,
      );
    }
  }

  const football = readFileSync(FOOTBALL_URL, "utf8");
  const actions = readFileSync(ACTIONS_URL, "utf8");
  assert.match(
    football,
    /init_player_stats[\s\S]*tm_rate=game_data\[setup\.team_a\]\.players\[ps\]\.pace\+28/u,
  );
  assert.match(actions, /full_spd[\s\S]*p->tm_rate/u);
});

test("prepared identity pace is never an implicit runtime-rate fallback", {
  skip: !existsSync(FACTS_URL) ? "prepared facts unavailable" : false,
}, () => {
  const facts = JSON.parse(readFileSync(FACTS_URL, "utf8"));
  const prepared = facts.teams.starters.map(({ id, attributes }) => [id, attributes.pace]);
  const native = CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE.players.map(
    ({ id, attributes }) => [id, attributes.pace],
  );
  assert.notDeepEqual(native, prepared);
  assert.equal(native.filter((entry, index) => entry[1] !== prepared[index][1]).length, 22);
});

test("runtime profile has no filesystem, source, prepared, or evidence imports", () => {
  const source = readFileSync(
    new URL("../src/cssoccer/nativeFixturePlayerProfile.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /(?:node:|\.local\/|build\/generated|references\/|readFile|createHash|state\.jsonl|native\.raw)/u,
  );
  assert.doesNotMatch(source, /^\s*import\s/mu);
});

function firstNativeRecord(bytes) {
  assert.equal(bytes.subarray(0, 8).toString("ascii"), "CSSORAW2");
  assert.equal(bytes.readUInt32LE(8), 2);
  const rangeCount = bytes.readUInt32LE(12);
  const ranges = [];
  let cursor = 16;
  let payloadBase = 0;
  for (let index = 0; index < rangeCount; index += 1) {
    const offset = bytes.readUInt32LE(cursor);
    const size = bytes.readUInt32LE(cursor + 4);
    ranges.push({ offset, size, payloadBase });
    payloadBase += size;
    cursor += 8;
  }
  assert.equal(bytes.readUInt32LE(cursor), 0x314b4954);
  assert.equal(bytes.readUInt32LE(cursor + 4), 0);
  return { bytes, ranges, payloadOffset: cursor + 28 };
}

function readRawU8(raw, offset) {
  const range = raw.ranges.find((entry) => (
    offset >= entry.offset && offset < entry.offset + entry.size
  ));
  assert.ok(range, `raw offset 0x${offset.toString(16)} is captured`);
  return raw.bytes.readUInt8(
    raw.payloadOffset + range.payloadBase + offset - range.offset,
  );
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`
  )).join(",")}}`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}
