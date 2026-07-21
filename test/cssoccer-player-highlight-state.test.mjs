import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  CSSOCCER_PLAYER_HIGHLIGHT_BLINK_MODES,
  CSSOCCER_PLAYER_HIGHLIGHT_FACING_MODES,
  CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES,
  CSSOCCER_PLAYER_HIGHLIGHT_TYPES,
} from "../src/cssoccer/playerHighlightContract.mjs";
import {
  createCssoccerPlayerHighlightInputFrame,
} from "../src/cssoccer/playerHighlightInputs.mjs";
import {
  CSSOCCER_PLAYER_HIGHLIGHT_STATE_SCHEMA,
  CSSOCCER_PLAYER_HIGHLIGHT_STATE_SOURCE,
  assertCssoccerPlayerHighlightState,
  createCssoccerPlayerHighlightState,
  stepCssoccerPlayerHighlightState,
} from "../src/cssoccer/playerHighlightState.mjs";

const ACTIONS_URL = new URL(
  "../.local/actua-soccer/source/ACTIONS.CPP",
  import.meta.url,
);
const sourceOptions = {
  skip: existsSync(ACTIONS_URL) ? false : "pinned Actua highlight source is unavailable",
};
const CONTROLLED_ID = "argentina-player-02";
const CONTROLLED_NATIVE = 13;

test("table-driven reducer covers OFF, NORM, CROSS, BALL, SHOOT, STAR, and SPECIAL", () => {
  const cases = [
    {
      name: "OFF",
      expected: CSSOCCER_PLAYER_HIGHLIGHT_TYPES.OFF,
      input: { controlledId: null },
    },
    {
      name: "NORM",
      expected: CSSOCCER_PLAYER_HIGHLIGHT_TYPES.NORM,
      input: {},
    },
    {
      name: "CROSS",
      expected: CSSOCCER_PLAYER_HIGHLIGHT_TYPES.CROSS,
      input: {
        ballPossession: CONTROLLED_NATIVE,
        inCrossArea: 1,
        controlledEdit: { shootingRange: 1, special: 1, intelligenceMove: 1 },
      },
    },
    {
      name: "BALL",
      expected: CSSOCCER_PLAYER_HIGHLIGHT_TYPES.BALL,
      input: { ballPossession: CONTROLLED_NATIVE },
    },
    {
      name: "SHOOT",
      expected: CSSOCCER_PLAYER_HIGHLIGHT_TYPES.SHOOT,
      input: {
        ballPossession: CONTROLLED_NATIVE,
        controlledEdit: { shootingRange: 1, special: -1, intelligenceMove: 1 },
      },
    },
    {
      name: "STAR",
      expected: CSSOCCER_PLAYER_HIGHLIGHT_TYPES.STAR,
      input: { controlledEdit: { special: -1, intelligenceMove: 1 } },
    },
    {
      name: "SPECIAL",
      expected: CSSOCCER_PLAYER_HIGHLIGHT_TYPES.SPECIAL,
      input: { controlledEdit: { special: 1, intelligenceMove: 1 } },
    },
  ];

  for (const entry of cases) {
    const frame = inputFrame({
      tick: 0,
      selectedCountry: "argentina",
      matchHalf: 0,
      ...entry.input,
    });
    const state = createCssoccerPlayerHighlightState(frame);
    assert.equal(state.schema, CSSOCCER_PLAYER_HIGHLIGHT_STATE_SCHEMA, entry.name);
    assert.equal(assertCssoccerPlayerHighlightState(state), state, entry.name);
    const active = state.players.filter(({ htype }) => htype !== 0);
    if (entry.expected === CSSOCCER_PLAYER_HIGHLIGHT_TYPES.OFF) {
      assert.deepEqual(active, [], entry.name);
      assert.equal(state.marker, null, entry.name);
    } else {
      assert.equal(active.length, 1, entry.name);
      assert.equal(active[0].id, CONTROLLED_ID, entry.name);
      assert.equal(active[0].hcol, 0, entry.name);
      assert.equal(active[0].htype, entry.expected, entry.name);
      assert.equal(state.marker.playerId, CONTROLLED_ID, entry.name);
      assert.equal(state.marker.nativePlayerNumber, CONTROLLED_NATIVE, entry.name);
      assert.equal(state.marker.typeValue, entry.expected, entry.name);
      assert.equal(state.marker.ordinaryShadow, "suppressed", entry.name);
    }
    assert.ok(Object.isFrozen(state), entry.name);
    assert.ok(Object.isFrozen(state.players), entry.name);
    if (state.marker !== null) assert.ok(Object.isFrozen(state.marker), entry.name);
  }
});

test("source branch priority and intercept gating do not leak special state", () => {
  const crossWins = createCssoccerPlayerHighlightState(inputFrame({
    tick: 0,
    selectedCountry: "argentina",
    matchHalf: 0,
    ballPossession: CONTROLLED_NATIVE,
    inCrossArea: 1,
    controlledEdit: { shootingRange: 1, special: -1, intelligenceMove: 1 },
  }));
  assert.equal(crossWins.marker.typeValue, CSSOCCER_PLAYER_HIGHLIGHT_TYPES.CROSS);

  const shootWins = createCssoccerPlayerHighlightState(inputFrame({
    tick: 0,
    selectedCountry: "argentina",
    matchHalf: 0,
    ballPossession: CONTROLLED_NATIVE,
    controlledEdit: { shootingRange: 1, special: 1, intelligenceMove: 1 },
  }));
  assert.equal(shootWins.marker.typeValue, CSSOCCER_PLAYER_HIGHLIGHT_TYPES.SHOOT);

  for (const special of [-1, 1]) {
    const noIntercept = createCssoccerPlayerHighlightState(inputFrame({
      tick: 0,
      selectedCountry: "argentina",
      matchHalf: 0,
      controlledEdit: { special, intelligenceMove: 0 },
    }));
    assert.equal(noIntercept.marker.typeValue, CSSOCCER_PLAYER_HIGHLIGHT_TYPES.NORM);
  }
});

test("families, facing, blink, and shadow policy are emitted from the pinned contract", () => {
  const markerByType = new Map();
  for (const [type, input] of [
    [1, {}],
    [2, { ballPossession: CONTROLLED_NATIVE, inCrossArea: 1 }],
    [3, { ballPossession: CONTROLLED_NATIVE }],
    [4, { ballPossession: CONTROLLED_NATIVE, controlledEdit: { shootingRange: 1 } }],
    [5, { controlledEdit: { special: -1, intelligenceMove: 1 } }],
    [6, { controlledEdit: { special: 1, intelligenceMove: 1 } }],
  ]) {
    markerByType.set(type, createCssoccerPlayerHighlightState(inputFrame({
      tick: 0,
      selectedCountry: "argentina",
      matchHalf: 0,
      ...input,
    })).marker);
  }

  assert.equal(markerByType.get(1).familyId, CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES.NORMAL);
  assert.equal(markerByType.get(2).familyId, CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES.CROSS);
  assert.equal(markerByType.get(3).familyId, CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES.BALL_SHOOT);
  assert.equal(markerByType.get(4).familyId, CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES.BALL_SHOOT);
  assert.equal(markerByType.get(5).familyId, CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES.STAR_SPECIAL);
  assert.equal(markerByType.get(6).familyId, CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES.STAR_SPECIAL);
  assert.notEqual(markerByType.get(1).familyId, markerByType.get(2).familyId);
  assert.notEqual(markerByType.get(2).familyId, markerByType.get(3).familyId);
  assert.notEqual(markerByType.get(3).familyId, markerByType.get(5).familyId);

  assert.deepEqual(
    [...markerByType].filter(([, marker]) => (
      marker.facingMode === CSSOCCER_PLAYER_HIGHLIGHT_FACING_MODES.PLAYER
    )).map(([type]) => type),
    [3, 4],
  );
  assert.deepEqual(
    [...markerByType].filter(([, marker]) => (
      marker.blinkMode === CSSOCCER_PLAYER_HIGHLIGHT_BLINK_MODES.HALF_CYCLE
    )).map(([type]) => type),
    [4, 6],
  );
  assert.ok([...markerByType.values()].every(({ ordinaryShadow }) => (
    ordinaryShadow === "suppressed"
  )));
});

test("handoff, clear, goal-kick gap, halftime, terminal, and rematch reset one marker", () => {
  let input = inputFrame({
    tick: 0,
    selectedCountry: "spain",
    matchHalf: 0,
    controlledId: "spain-player-02",
  });
  let state = createCssoccerPlayerHighlightState(input);
  assert.equal(state.marker.playerId, "spain-player-02");

  input = inputFrame({
    tick: 1,
    selectedCountry: "spain",
    matchHalf: 0,
    controlledId: "spain-player-03",
    previous: input,
  });
  state = stepCssoccerPlayerHighlightState(state, input);
  assert.equal(state.marker.playerId, "spain-player-03");
  assert.equal(state.players.find(({ id }) => id === "spain-player-02").htype, 0);
  assert.equal(state.players.filter(({ htype }) => htype !== 0).length, 1);

  input = inputFrame({
    tick: 2,
    selectedCountry: "spain",
    matchHalf: 0,
    controlledId: null,
    previous: input,
  });
  state = stepCssoccerPlayerHighlightState(state, input);
  assert.equal(state.marker, null);
  assert.ok(state.players.every(({ htype }) => htype === 0));

  // Goal-kick ownership can leave the auto user clear between source events.
  input = inputFrame({
    tick: 3,
    selectedCountry: "spain",
    matchHalf: 0,
    controlledId: null,
    ballPossession: 1,
    previous: input,
  });
  state = stepCssoccerPlayerHighlightState(state, input);
  assert.equal(state.marker, null);

  input = inputFrame({
    tick: 4,
    selectedCountry: "spain",
    matchHalf: 1,
    controlledId: "spain-player-02",
    previous: input,
  });
  state = stepCssoccerPlayerHighlightState(state, input);
  assert.equal(state.marker.playerId, "spain-player-02");
  assert.equal(state.marker.nativePlayerNumber, 13);

  input = inputFrame({
    tick: 5,
    selectedCountry: "spain",
    matchHalf: 11,
    terminal: true,
    controlledId: "spain-player-02",
    previous: input,
  });
  state = stepCssoccerPlayerHighlightState(state, input);
  assert.equal(state.terminal, true);
  assert.equal(state.marker, null);
  assert.ok(state.players.every(({ htype }) => htype === 0));
  assert.throws(
    () => stepCssoccerPlayerHighlightState(state, input),
    /Terminal/u,
  );

  const rematch = createCssoccerPlayerHighlightState(inputFrame({
    tick: 0,
    selectedCountry: "spain",
    matchHalf: 0,
    controlledId: null,
  }));
  assert.equal(rematch.tick, 0);
  assert.equal(rematch.marker, null);
});

test("reducer source order is pinned and production stays state-only", sourceOptions, () => {
  assert.deepEqual(CSSOCCER_PLAYER_HIGHLIGHT_STATE_SOURCE.branchOrder, [
    "controlled-ball-owner-cross",
    "controlled-ball-owner-shooting-range",
    "controlled-ball-owner-ball",
    "controlled-positive-special-intercept",
    "controlled-negative-special-intercept",
    "controlled-normal",
    "off",
  ]);
  assert.deepEqual(CSSOCCER_PLAYER_HIGHLIGHT_STATE_SOURCE.localUsers, [{
    userNumber: 1,
    hcol: 0,
    eligibility: "selected-country-auto-user",
  }]);
  const actions = readFileSync(ACTIONS_URL, "latin1");
  assertOrdered(actions, [
    "player->tm_hcol=u-1",
    "if (ball_poss==player->tm_player)",
    "if (in_cross_area)",
    "if (player->tm_srng)",
    "player->special>0 && player->int_move==I_INTERCEPT",
    "player->special<0 && player->int_move==I_INTERCEPT",
  ]);
  const runtime = readFileSync(
    new URL("../src/cssoccer/playerHighlightState.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(runtime, /playerSelection|selectionCircle|sel_circle/u);
  assert.doesNotMatch(
    runtime,
    /canvas|webgl|svg|document\.|createElement|pseudo-element|overlay/u,
  );
});

function inputFrame({
  tick,
  selectedCountry,
  matchHalf,
  terminal = false,
  controlledId = CONTROLLED_ID,
  ballPossession = 0,
  inCrossArea = 0,
  controlledEdit = {},
  previous = null,
}) {
  const players = framePlayers({ matchHalf, controlledId });
  if (controlledId !== null) {
    const controlled = players.find(({ id }) => id === controlledId);
    Object.assign(controlled, controlledEdit);
  }
  return createCssoccerPlayerHighlightInputFrame({
    tick,
    selectedCountry,
    matchHalf,
    terminal,
    ballPossession,
    inCrossArea,
    players,
  }, previous === null ? {} : { previous });
}

function framePlayers({ matchHalf, controlledId }) {
  const countries = matchHalf === 0
    ? ["spain", "argentina"]
    : ["argentina", "spain"];
  return countries.flatMap((country, countryIndex) => (
    Array.from({ length: 11 }, (_, index) => {
      const id = `${country}-player-${String(index + 1).padStart(2, "0")}`;
      return {
        id,
        nativePlayerNumber: countryIndex * 11 + index + 1,
        controlUser: id === controlledId ? 1 : 0,
        shootingRange: 0,
        special: 0,
        intelligenceMove: 0,
      };
    })
  ));
}

function assertOrdered(source, needles) {
  let cursor = -1;
  for (const needle of needles) {
    const index = source.indexOf(needle, cursor + 1);
    assert.notEqual(index, -1, needle);
    assert.ok(index > cursor, needle);
    cursor = index;
  }
}
