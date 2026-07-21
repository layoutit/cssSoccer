import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
} from "../src/cssoccer/nativeFixturePlayerProfile.mjs";
import {
  CSSOCCER_PLAYER_STAMINA_SOURCE,
  CssoccerUnsupportedPlayerStaminaError,
  assertCssoccerPlayerStaminaState,
  createCssoccerPlayerStaminaState,
  projectCssoccerPlayerStaminaNativeFields,
  projectCssoccerPlayerStaminaTeamRates,
  stepCssoccerPlayerStaminaState,
} from "../src/cssoccer/playerStaminaState.mjs";

const ROOT = new URL("../", import.meta.url);
const SOURCE_ROOT = new URL(".local/actua-soccer/source/", ROOT);
const SOURCE_FILES = Object.fromEntries(
  CSSOCCER_PLAYER_STAMINA_SOURCE.files.map(({ file }) => [
    file,
    new URL(file, SOURCE_ROOT),
  ]),
);
const RAW_URL = new URL(
  ".local/cssoccer/oracle/native/retained/runs/canonical-a/native.raw",
  ROOT,
);
const CONTRACT_URL = new URL("references/spain-argentina-match.json", ROOT);
const PHASE_MARKERS_URL = new URL(
  ".local/cssoccer/oracle/native/retained/runs/canonical-a/phase-markers.json",
  ROOT,
);
const RUNTIME_URL = new URL("src/cssoccer/playerStaminaState.mjs", ROOT);
const sourceOptions = skipUnless(Object.values(SOURCE_FILES), "pinned Actua source");
const rawOptions = skipUnless(
  [RAW_URL, CONTRACT_URL, PHASE_MARKERS_URL],
  "retained native raw stream",
);
const HALFTIME_WHISTLE_TICK = 1_223;
const SECOND_HALF_TICK = 1_524;
const FULL_TIME_TICK = 2_724;

test("opening baseline binds all 22 exact u8 rate/stamina/time values", () => {
  const state = createState();
  assert.equal(assertCssoccerPlayerStaminaState(state), state);
  assert.equal(state.tick, 0);
  assert.equal(state.gameMinute, 0);
  assert.equal(state.matchHalf, 0);
  assert.equal(state.players.length, 22);
  assert.deepEqual(
    state.players.map(({ id, nativePlayerNumber, initialRate, stamina, playerMinutes }) => ({
      id,
      nativePlayerNumber,
      initialRate,
      stamina,
      playerMinutes,
    })),
    CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE.players.map((player) => ({
      id: player.id,
      nativePlayerNumber: player.kickoffNativePlayerNumber,
      initialRate: player.attributes.pace,
      stamina: player.attributes.stamina,
      playerMinutes: 0,
    })),
  );
  assert.deepEqual(projectCssoccerPlayerStaminaTeamRates(state)[0], {
    id: "spain-player-01",
    nativePlayerNumber: 1,
    valueType: "u8",
    value: 62,
    numericBits: "3e",
  });
  assert.equal(projectCssoccerPlayerStaminaNativeFields(state).length, 66);
  assertDeepFrozen(state);
});

test("minute transitions apply the source float stores then u8 truncation", () => {
  let state = createState();
  for (let tick = 1; tick <= 27; tick += 1) {
    state = stepCssoccerPlayerStaminaState(state, {
      tick,
      gameMinute: openingGameMinute(tick),
    });
  }
  assert.equal(state.gameMinute, 1);
  assert.equal(state.players[0].playerMinutes, 1);
  assert.equal(state.players[0].rate.value, 61);
  assert.equal(state.players[0].rate.numericBits, "3d");
  assert.ok(state.players.every(({ rate, initialRate }) => rate.value === initialRate - 1));

  const repeat = runThroughTick(155);
  assert.equal(JSON.stringify(runThroughTick(155)), JSON.stringify(repeat));
  assert.equal(repeat.gameMinute, 5);
  assert.ok(repeat.players.every(({ playerMinutes }) => playerMinutes === 5));
});

test("all 22 raw stamina triples stay exact through the first injury refresh", rawOptions, () => {
  const ticks = Array.from({ length: 215 }, (_, tick) => tick);
  const raw = readRawPlayerTriples(ticks);
  let state = createState();
  for (let tick = 0; tick <= 214; tick += 1) {
    if (tick > 0) {
      state = stepCssoccerPlayerStaminaState(state, {
        tick,
        gameMinute: openingGameMinute(tick),
      });
    }
    if (!raw.has(tick)) continue;
    assert.deepEqual(
      state.players.map(({ id, nativePlayerNumber, rate, stamina, playerMinutes }) => ({
        id,
        nativePlayerNumber,
        rate: rate.value,
        stamina,
        playerMinutes,
      })),
      raw.get(tick),
      `native stamina/rate bytes at tick ${tick}`,
    );
  }
  assert.equal(state.tick, 214);
  assert.equal(state.gameMinute, 8);
  assert.equal(state.matchHalf, 0);
});

test("tick 215 injury refresh routes to linked inc_inj/init_player_stats with substitutions zero", rawOptions, () => {
  const raw = readRawPlayerTriples([214, 215], { includeFixedProfile: true });
  assert.equal(firstFixedProfileMismatch(raw.get(214)), null);
  assert.deepEqual(firstFixedProfileMismatch(raw.get(215)), {
    id: "spain-player-10",
    nativePlayerNumber: 10,
    sourceProducer: "tussle/contact -> inc_inj -> init_player_stats",
    expected: {
      power: 92,
      control: 76,
      flair: 83,
      vision: 47,
      accuracy: 104,
      stamina: 71,
      discipline: 48,
    },
    actual: {
      power: 80,
      control: 75,
      flair: 81,
      vision: 47,
      accuracy: 102,
      stamina: 65,
      discipline: 48,
    },
  });

  const markers = JSON.parse(readFileSync(PHASE_MARKERS_URL, "utf8"));
  assert.equal(
    markers.fixtureIntegrity.injuryProfileProducer,
    "linked TEST.MAP RULES.CPP inc_inj -> FOOTBALL.CPP init_player_stats",
  );
  assert.equal(
    markers.fixtureIntegrity.substitutions,
    "disabled-and-zero-through-full-time",
  );
  assert.deepEqual(markers.fixtureIntegrity.injuryRefreshes[0], {
    tick: 215,
    stableStarterId: "spain-player-10",
    injuryBefore: 0,
    injuryAfter: 173,
    changedAttributes: ["control", "flair", "accuracy", "stamina"],
  });

  const drifted = structuredClone(runThroughTick(214));
  drifted.players[9].stamina = raw.get(215)[9].fixedProfile.stamina;
  assert.throws(
    () => assertCssoccerPlayerStaminaState(drifted),
    (error) => error instanceof CssoccerUnsupportedPlayerStaminaError
      && error.boundary === "fixed-profile-drift"
      && /spain-player-10 at native slot 10/u.test(error.message),
  );
});

test("halftime freezes player time, remaps stable identities once, and terminates without a second swap", () => {
  const beforeWhistle = runThroughLifecycleTick(HALFTIME_WHISTLE_TICK - 1);
  const whistle = stepAtLifecycleTick(beforeWhistle, HALFTIME_WHISTLE_TICK);
  assert.equal(whistle.gameMinute, 45);
  assert.equal(whistle.matchHalf, 0);
  assert.ok(whistle.players.every(({ playerMinutes }) => playerMinutes === 45));

  const beforeSwap = runThroughLifecycleTick(SECOND_HALF_TICK - 1);
  assert.equal(beforeSwap.gameMinute, 45);
  assert.equal(beforeSwap.matchHalf, 0);
  assert.deepEqual(
    beforeSwap.players.map(({ id, nativePlayerNumber, rate, playerMinutes }) => ({
      id,
      nativePlayerNumber,
      rate,
      playerMinutes,
    })),
    whistle.players.map(({ id, nativePlayerNumber, rate, playerMinutes }) => ({
      id,
      nativePlayerNumber,
      rate,
      playerMinutes,
    })),
  );

  const swapped = stepAtLifecycleTick(beforeSwap, SECOND_HALF_TICK);
  assert.equal(swapped.gameMinute, 45);
  assert.equal(swapped.matchHalf, 1);
  assert.deepEqual(
    swapped.players.map(({ id, nativePlayerNumber }) => ({ id, nativePlayerNumber })),
    CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE.players.map((player, index) => ({
      id: player.id,
      nativePlayerNumber: index < 11 ? index + 12 : index - 10,
    })),
  );
  assert.equal(projectCssoccerPlayerStaminaTeamRates(swapped)[0].nativePlayerNumber, 12);
  assert.equal(projectCssoccerPlayerStaminaTeamRates(swapped)[11].nativePlayerNumber, 1);

  const terminal = runThroughLifecycleTick(FULL_TIME_TICK);
  assert.equal(terminal.matchHalf, 11);
  assert.equal(terminal.gameMinute, 90);
  assert.deepEqual(
    terminal.players.map(({ id, nativePlayerNumber }) => ({ id, nativePlayerNumber })),
    swapped.players.map(({ id, nativePlayerNumber }) => ({ id, nativePlayerNumber })),
  );
  assert.throws(
    () => stepCssoccerPlayerStaminaState(terminal, {
      tick: FULL_TIME_TICK + 1,
      gameMinute: 90,
      matchHalf: 11,
    }),
    unsupported("terminal"),
  );
});

test("pinned source fixes call order, formula, and scalar stores", sourceOptions, () => {
  for (const source of CSSOCCER_PLAYER_STAMINA_SOURCE.files) {
    assert.equal(sha256(readFileSync(SOURCE_FILES[source.file])), source.sha256, source.file);
  }
  const football = readFileSync(SOURCE_FILES["FOOTBALL.CPP"], "latin1");
  const rules = readFileSync(SOURCE_FILES["RULES.CPP"], "latin1");
  const definitions = readFileSync(SOURCE_FILES["ANDYDEFS.H"], "latin1");
  assert.match(
    rules,
    /match_time\.sec\+=90\.0\/\(time_factor\*REAL_SPEED\)[\s\S]*match_time\.min\+=1;[\s\S]*add_player_time\(\)/u,
  );
  assert.match(rules, /void add_player_time\(\)[\s\S]*teams\[p\]\.tm_time\+\+/u);
  assert.match(
    football,
    /void player_stamina\(\)[\s\S]*float f=\(sin\(\(PI\*teams\[i\]\.tm_time\/120\)-\(PI\/2\)\)\+1\)\/2;[\s\S]*float t=f\*\(129-st\)\/140\*ir;[\s\S]*teams\[i\]\.tm_rate=ir-t;/u,
  );
  assert.match(football, /void process_flags\(\)[\s\S]*player_stamina\(\)/u);
  assert.match(
    rules,
    /void swap_teams\(\)[\s\S]*match_half\+=1;[\s\S]*memcpy\(&teams\[p\],&teams\[p\+11\],sizeof\(a\)\);[\s\S]*teams\[p\]\.tm_player=p\+1;[\s\S]*teams\[p\+11\]\.tm_player=p\+12;/u,
  );
  assert.match(
    football,
    /match_time\.min>=\(90\+injury_time\)[\s\S]*match_half==1[\s\S]*match_half=11;\s*\/\/ End game!/u,
  );
  assert.match(rules, /void inc_inj\(short p,short i\)/u);
  assert.match(football, /void init_player_stats\(short p\)/u);
  assert.match(definitions, /unsigned char tm_rate;[\s\S]*unsigned char tm_stam;[\s\S]*unsigned char tm_time;/u);
});

test("tick, minute, identity, type, and profile drift fail closed", () => {
  const state = createState();
  assert.throws(
    () => stepCssoccerPlayerStaminaState(state, { tick: 2, gameMinute: 0 }),
    /contiguous/u,
  );
  assert.throws(
    () => stepCssoccerPlayerStaminaState(state, { tick: 1, gameMinute: 2 }),
    (error) => error instanceof CssoccerUnsupportedPlayerStaminaError
      && error.boundary === "minute-progression",
  );
  assert.throws(
    () => stepCssoccerPlayerStaminaState(state, { tick: 1, gameMinute: 91 }),
    /0\.\.90/u,
  );
  assert.throws(
    () => stepCssoccerPlayerStaminaState(state, {
      tick: 1,
      gameMinute: 0,
      matchHalf: 2,
    }),
    /0, 1, or 11/u,
  );
  assert.throws(
    () => stepCssoccerPlayerStaminaState(state, {
      tick: 1,
      gameMinute: 0,
      matchHalf: 1,
    }),
    unsupported("halftime-remap"),
  );
  assert.throws(
    () => stepCssoccerPlayerStaminaState(state, {
      tick: 1,
      gameMinute: 0,
      matchHalf: 11,
    }),
    unsupported("match-half-progression"),
  );

  const halftime = runThroughLifecycleTick(HALFTIME_WHISTLE_TICK);
  assert.throws(
    () => stepCssoccerPlayerStaminaState(halftime, {
      tick: HALFTIME_WHISTLE_TICK + 1,
      gameMinute: 46,
      matchHalf: 0,
    }),
    unsupported("halftime-remap"),
  );
  const beforeTerminal = runThroughLifecycleTick(FULL_TIME_TICK - 1);
  assert.equal(beforeTerminal.matchHalf, 1);
  assert.equal(beforeTerminal.gameMinute, 89);
  assert.throws(
    () => stepCssoccerPlayerStaminaState(beforeTerminal, {
      tick: FULL_TIME_TICK,
      gameMinute: 90,
    }),
    unsupported("match-half"),
  );
  assert.throws(
    () => stepCssoccerPlayerStaminaState(beforeTerminal, {
      tick: FULL_TIME_TICK,
      gameMinute: 89,
      matchHalf: 11,
    }),
    unsupported("terminal"),
  );
  const reordered = structuredClone(state);
  [reordered.players[0], reordered.players[1]] = [reordered.players[1], reordered.players[0]];
  assert.throws(() => assertCssoccerPlayerStaminaState(reordered), /native order/u);
  const changedBits = structuredClone(state);
  changedBits.players[0].rate.numericBits = "00";
  assert.throws(() => assertCssoccerPlayerStaminaState(changedBits), /exact u8/u);
  const swapped = runThroughLifecycleTick(SECOND_HALF_TICK);
  const staleNativeSlot = structuredClone(swapped);
  staleNativeSlot.players[0].nativePlayerNumber = 1;
  assert.throws(() => assertCssoccerPlayerStaminaState(staleNativeSlot), /native order/u);
  const regressedHalf = structuredClone(swapped);
  regressedHalf.matchHalf = 0;
  assert.throws(() => assertCssoccerPlayerStaminaState(regressedHalf), /native order/u);
  const changedProfile = structuredClone(CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE);
  changedProfile.players[0].attributes.stamina += 1;
  assert.throws(
    () => createCssoccerPlayerStaminaState({ nativeFixturePlayerProfile: changedProfile }),
    /profile value changed/u,
  );
});

test("runtime reducer has no source, filesystem, retained, or prepared dependency", () => {
  const source = readFileSync(RUNTIME_URL, "utf8");
  assert.doesNotMatch(
    source,
    /(?:node:|\.local\/|state\.jsonl|native\.raw|build\/generated|references\/|readFile)/u,
  );
  assert.deepEqual(
    [...source.matchAll(/^import[\s\S]*?from "([^"]+)";/gmu)].map((match) => match[1]),
    ["./nativeFixturePlayerProfile.mjs"],
  );
});

function createState() {
  return createCssoccerPlayerStaminaState({
    nativeFixturePlayerProfile: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE,
  });
}

function runThroughTick(maxTick) {
  let state = createState();
  for (let tick = 1; tick <= maxTick; tick += 1) {
    state = stepCssoccerPlayerStaminaState(state, {
      tick,
      gameMinute: openingGameMinute(tick),
    });
  }
  return state;
}

function openingGameMinute(tick) {
  return Math.floor((tick * 9) / 240);
}

function runThroughLifecycleTick(maxTick) {
  let state = createState();
  for (let tick = 1; tick <= maxTick; tick += 1) {
    state = stepAtLifecycleTick(state, tick);
  }
  return state;
}

function stepAtLifecycleTick(state, tick) {
  const clock = fullMatchClock(tick);
  return stepCssoccerPlayerStaminaState(state, {
    tick,
    gameMinute: clock.gameMinute,
    matchHalf: clock.matchHalf,
  });
}

function fullMatchClock(tick) {
  assert.ok(Number.isInteger(tick) && tick >= 0 && tick <= FULL_TIME_TICK);
  let gameMinute;
  let matchHalf;
  if (tick <= HALFTIME_WHISTLE_TICK) {
    gameMinute = Math.floor((tick * 9) / 240);
    matchHalf = 0;
  } else if (tick < SECOND_HALF_TICK) {
    gameMinute = 45;
    matchHalf = 0;
  } else if (tick < FULL_TIME_TICK) {
    gameMinute = 45 + Math.floor(((tick - SECOND_HALF_TICK) * 9) / 240);
    matchHalf = 1;
  } else {
    gameMinute = 90;
    matchHalf = 11;
  }
  return { gameMinute, matchHalf };
}

function readRawPlayerTriples(wantedTicks, { includeFixedProfile = false } = {}) {
  const bytes = readFileSync(RAW_URL);
  const contract = JSON.parse(readFileSync(CONTRACT_URL, "utf8"));
  const raw = contract.oracle.capture.raw;
  assert.equal(bytes.subarray(0, 8).toString("ascii"), raw.magic);
  assert.equal(bytes.readUInt32LE(8), raw.version);
  assert.equal(bytes.readUInt32LE(12), raw.ranges.length);

  let descriptorOffset = 16;
  let payloadBase = 0;
  const ranges = raw.ranges.map((expected) => {
    const range = {
      offset: bytes.readUInt32LE(descriptorOffset),
      bytes: bytes.readUInt32LE(descriptorOffset + 4),
      payloadBase,
    };
    assert.deepEqual(
      { offset: range.offset, bytes: range.bytes },
      expected,
    );
    descriptorOffset += 8;
    payloadBase += range.bytes;
    return range;
  });
  const recordBytes = raw.metadataBytes + payloadBase;
  const teamsAddress = 0x3cf6c;
  const teamsRange = ranges.find((range) => (
    teamsAddress >= range.offset && teamsAddress < range.offset + range.bytes
  ));
  assert.ok(teamsRange);
  const wanted = new Set(wantedTicks);
  const result = new Map();
  for (let recordOffset = descriptorOffset; recordOffset < bytes.length; recordOffset += recordBytes) {
    assert.equal(
      bytes.subarray(recordOffset, recordOffset + 4).toString("ascii"),
      raw.recordMarker,
    );
    const tick = bytes.readUInt32LE(recordOffset + 20);
    const flags = bytes.readUInt32LE(recordOffset + 24);
    if ((flags & raw.flags.active) === 0 || !wanted.has(tick) || result.has(tick)) continue;
    const teamsPayload = recordOffset
      + raw.metadataBytes
      + teamsRange.payloadBase
      + teamsAddress
      - teamsRange.offset;
    const { matchHalf } = fullMatchClock(tick);
    const stable = new Map();
    for (let nativeIndex = 0; nativeIndex < 22; nativeIndex += 1) {
      const base = teamsPayload + (nativeIndex * 203);
      const stableIndex = matchHalf === 0
        ? nativeIndex
        : nativeIndex < 11
          ? nativeIndex + 11
          : nativeIndex - 11;
      const player = CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE.players[stableIndex];
      const entry = {
        id: player.id,
        nativePlayerNumber: nativeIndex + 1,
        rate: bytes.readUInt8(base + 70),
        stamina: bytes.readUInt8(base + 76),
        playerMinutes: bytes.readUInt8(base + 104),
      };
      if (includeFixedProfile) {
        entry.fixedProfile = {
          power: bytes.readUInt8(base + 71),
          control: bytes.readUInt8(base + 72),
          flair: bytes.readUInt8(base + 73),
          vision: bytes.readUInt8(base + 74),
          accuracy: bytes.readUInt8(base + 75),
          stamina: bytes.readUInt8(base + 76),
          discipline: bytes.readUInt8(base + 77),
        };
      }
      stable.set(player.id, entry);
    }
    result.set(tick, CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE.players.map((player) => (
      stable.get(player.id)
    )));
  }
  assert.deepEqual([...result.keys()].sort((left, right) => left - right), [...wanted].sort((left, right) => left - right));
  return result;
}

function firstFixedProfileMismatch(entries) {
  for (const [index, entry] of entries.entries()) {
    const attributes = CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE.players[index].attributes;
    const expected = {
      power: attributes.power,
      control: attributes.control,
      flair: attributes.flair,
      vision: attributes.vision,
      accuracy: attributes.accuracy,
      stamina: attributes.stamina,
      discipline: attributes.discipline,
    };
    if (JSON.stringify(entry.fixedProfile) !== JSON.stringify(expected)) {
      return {
        id: entry.id,
        nativePlayerNumber: entry.nativePlayerNumber,
        sourceProducer: "tussle/contact -> inc_inj -> init_player_stats",
        expected,
        actual: entry.fixedProfile,
      };
    }
  }
  return null;
}

function unsupported(boundary) {
  return (error) => error instanceof CssoccerUnsupportedPlayerStaminaError
    && error.boundary === boundary;
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

function assertDeepFrozen(value) {
  if (!value || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}
