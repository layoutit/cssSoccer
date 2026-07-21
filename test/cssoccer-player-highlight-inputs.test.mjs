import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { createCssoccerFreePlayEngine } from "../src/cssoccer/freePlayEngine.mjs";
import { createCssoccerFreePlayState } from "../src/cssoccer/freePlayState.mjs";
import {
  CSSOCCER_PLAYER_HIGHLIGHT_INPUT_FRAME_SCHEMA,
  CSSOCCER_PLAYER_HIGHLIGHT_INPUT_SOURCE,
  assertCssoccerPlayerHighlightInputFrame,
  createCssoccerFreePlayPlayerHighlightInputFrame,
  createCssoccerPlayerHighlightInputFrame,
} from "../src/cssoccer/playerHighlightInputs.mjs";
import { projectCssoccerPlayerHighlightState } from "../src/cssoccer/playerHighlightState.mjs";

const ROOT = new URL("../", import.meta.url);
const GENERATED = new URL("build/generated/public/cssoccer/", ROOT);
const FACTS = new URL("facts/spain-argentina-full-match.json", GENERATED);
const SCENE = new URL("scenes/spain-argentina-full-match.json", GENERATED);
const SOURCE_ROOT = new URL(".local/actua-soccer/source/", ROOT);
const SOURCE_URLS = Object.freeze({
  actions: new URL("ACTIONS.CPP", SOURCE_ROOT),
  layout: new URL("ANDYDEFS.H", SOURCE_ROOT),
  ballIntelligence: new URL("BALLINT.CPP", SOURCE_ROOT),
  football: new URL("FOOTBALL.CPP", SOURCE_ROOT),
  intelligence: new URL("INTELL.CPP", SOURCE_ROOT),
});
const fixtureOptions = skipUnless(
  [FACTS, SCENE],
  "prepared cssoccer fixture is unavailable",
);
const sourceOptions = skipUnless(
  Object.values(SOURCE_URLS),
  "pinned Actua source is unavailable",
);

test("highlight input frames freeze the exact 22-player source-width seam", () => {
  const first = createCssoccerPlayerHighlightInputFrame({
    tick: 0,
    selectedCountry: "spain",
    matchHalf: 0,
    terminal: false,
    ballPossession: 2,
    inCrossArea: 0,
    players: framePlayers({
      matchHalf: 0,
      controlledId: "spain-player-02",
      edits: {
        "spain-player-02": {
          shootingRange: 1,
          special: -1,
          intelligenceMove: 1,
        },
      },
    }),
  });
  assert.equal(first.schema, CSSOCCER_PLAYER_HIGHLIGHT_INPUT_FRAME_SCHEMA);
  assert.equal(assertCssoccerPlayerHighlightInputFrame(first), first);
  assert.equal(first.players.length, 22);
  assert.deepEqual(
    first.players.map(({ nativePlayerNumber }) => nativePlayerNumber),
    Array.from({ length: 22 }, (_, index) => index + 1),
  );
  assert.deepEqual(first.players[1], {
    id: "spain-player-02",
    nativePlayerNumber: 2,
    controlUser: 1,
    shootingRange: 1,
    special: -1,
    intelligenceMove: 1,
  });
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.players));
  assert.ok(Object.isFrozen(first.players[1]));

  const secondHalf = createCssoccerPlayerHighlightInputFrame({
    tick: 1,
    selectedCountry: "spain",
    matchHalf: 1,
    terminal: false,
    ballPossession: 0,
    inCrossArea: 0,
    players: framePlayers({ matchHalf: 1 }),
  }, { previous: first });
  assert.equal(secondHalf.players[0].id, "argentina-player-01");
  assert.equal(secondHalf.players[11].id, "spain-player-01");
});

test("highlight input frames reject gaps, widened values, duplicate control, and bad swaps", () => {
  const firstInput = {
    tick: 0,
    selectedCountry: "argentina",
    matchHalf: 0,
    terminal: false,
    ballPossession: 0,
    inCrossArea: 0,
    players: framePlayers({ matchHalf: 0 }),
  };
  const first = createCssoccerPlayerHighlightInputFrame(firstInput);
  assert.throws(
    () => createCssoccerPlayerHighlightInputFrame({ ...firstInput, tick: 2 }, { previous: first }),
    /contiguous/u,
  );
  assert.throws(
    () => createCssoccerPlayerHighlightInputFrame({
      ...firstInput,
      players: framePlayers({
        matchHalf: 0,
        controlledId: "spain-player-02",
      }),
    }),
    /selected country/u,
  );
  const twoControls = framePlayers({
    matchHalf: 0,
    controlledId: "argentina-player-02",
  });
  twoControls[13].controlUser = 1;
  assert.throws(
    () => createCssoccerPlayerHighlightInputFrame({ ...firstInput, players: twoControls }),
    /at most one/u,
  );
  const widenedSpecial = framePlayers({ matchHalf: 0 });
  widenedSpecial[0].special = 32_768;
  assert.throws(
    () => createCssoccerPlayerHighlightInputFrame({
      ...firstInput,
      players: widenedSpecial,
    }),
    /outside i16/u,
  );
  assert.throws(
    () => createCssoccerPlayerHighlightInputFrame({ ...firstInput, invented: true }),
    /exactly/u,
  );
  assert.throws(
    () => createCssoccerPlayerHighlightInputFrame({
      ...firstInput,
      tick: 1,
      matchHalf: 1,
    }, { previous: first }),
    /swap the two exact/u,
  );
});

test("source declarations bind range, cross, signed special, intercept, and tick order", sourceOptions, () => {
  assert.deepEqual(
    CSSOCCER_PLAYER_HIGHLIGHT_INPUT_SOURCE.fields.map(({ sourceName, valueType }) => [
      sourceName,
      valueType,
    ]),
    [
      ["tm_player", "i16"],
      ["control", "u8"],
      ["tm_srng", "u8"],
      ["special", "i16"],
      ["int_move", "i16"],
    ],
  );
  assert.deepEqual(
    CSSOCCER_PLAYER_HIGHLIGHT_INPUT_SOURCE.globals.map(({ sourceName, valueType }) => [
      sourceName,
      valueType,
    ]),
    [["ball_poss", "i32"], ["in_cross_area", "i32"]],
  );

  const layout = readFileSync(SOURCE_URLS.layout, "latin1");
  assert.match(layout, /short tm_player;/u);
  assert.match(layout, /char control;\s*char tm_srng;/u);
  assert.match(layout, /short special;/u);
  assert.match(layout, /short int_move, int_cnt/u);

  const football = readFileSync(SOURCE_URLS.football, "latin1");
  assertOrdered(football, ["new_users();", "select_all_hlites();"]);
  const ballIntelligence = readFileSync(SOURCE_URLS.ballIntelligence, "latin1");
  assertOrdered(ballIntelligence, [
    "void player_distances()",
    "teams[player_num].tm_srng=TRUE",
    "teams[player_num].tm_srng=FALSE",
  ]);
  const intelligence = readFileSync(SOURCE_URLS.intelligence, "latin1");
  assertOrdered(intelligence, [
    "void cross_pos(match_player *player)",
    "in_cross_area=FALSE",
    "in_cross_area=TRUE",
  ]);
  assert.match(intelligence, /player->special=-TRUE/u);
  assert.match(intelligence, /teams\[p-1\]\.special=TRUE/u);
  assert.match(intelligence, /teams\[p-1\]\.int_move=I_INTERCEPT/u);

  const actions = readFileSync(SOURCE_URLS.actions, "latin1");
  assertOrdered(actions, [
    "if (ball_poss==player->tm_player)",
    "if (in_cross_area)",
    "if (player->tm_srng)",
    "player->special>0 && player->int_move==I_INTERCEPT",
    "player->special<0 && player->int_move==I_INTERCEPT",
  ]);
});

test("free play publishes one contiguous Argentina highlight from current state", fixtureOptions, () => {
  const engine = createEngine();
  let priorFrame = createCurrentFrame(engine.snapshot());
  let sawControlOwner = false;
  assert.equal(priorFrame.tick, 0);
  assert.deepEqual(
    projectCssoccerPlayerHighlightState(priorFrame),
    engine.snapshot().match.playerHighlight,
  );

  for (let step = 0; step < 220; step += 1) {
    const current = engine.snapshot();
    const snapshot = engine.step({
      tick: current.tick,
      moveX: step >= 190 ? 1 : 0,
      moveY: 0,
      buttons: 0,
    });
    const frame = createCurrentFrame(snapshot);
    assert.equal(frame.tick, priorFrame.tick + 1);
    assert.deepEqual(
      frame.players.map(({ nativePlayerNumber }) => nativePlayerNumber),
      Array.from({ length: 22 }, (_, index) => index + 1),
    );
    const controlled = frame.players.filter(({ controlUser }) => controlUser === 1);
    assert.ok(controlled.length <= 1);
    if (controlled.length === 1) {
      sawControlOwner = true;
      assert.match(controlled[0].id, /^argentina-player-/u);
      assert.equal(controlled[0].id, snapshot.match.control.activePlayerId);
      assert.equal(snapshot.match.playerHighlight.marker?.playerId, controlled[0].id);
    }
    assert.deepEqual(
      projectCssoccerPlayerHighlightState(frame),
      snapshot.match.playerHighlight,
    );
    priorFrame = frame;
  }
  assert.equal(sawControlOwner, true);
  assert.equal(engine.snapshot().phase, "open-play");
});

test("production highlight inputs have no evidence or rendering dependency", () => {
  const inputSource = readFileSync(
    new URL("../src/cssoccer/playerHighlightInputs.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    inputSource,
    /node:|\.local\/|native\.raw|state\.jsonl|readFile|createReadStream/u,
  );
  assert.doesNotMatch(
    inputSource,
    /canvas|webgl|svg|pseudo-element|overlay|document\.|createElement/u,
  );
  assert.doesNotMatch(inputSource, /browserMatchEngine|sourceInputAtTick|oracle/u);
});

function framePlayers({ matchHalf, controlledId = null, edits = {} }) {
  const countries = matchHalf === 0
    ? ["spain", "argentina"]
    : ["argentina", "spain"];
  return countries.flatMap((country) => (
    Array.from({ length: 11 }, (_, index) => {
      const id = `${country}-player-${String(index + 1).padStart(2, "0")}`;
      return {
        id,
        nativePlayerNumber: countries.indexOf(country) * 11 + index + 1,
        controlUser: id === controlledId ? 1 : 0,
        shootingRange: 0,
        special: 0,
        intelligenceMove: 0,
        ...(edits[id] ?? {}),
      };
    })
  ));
}

function createEngine() {
  const facts = JSON.parse(readFileSync(FACTS, "utf8"));
  const scene = JSON.parse(readFileSync(SCENE, "utf8"));
  const initialState = createCssoccerFreePlayState({
    preparedFacts: facts,
    preparedScene: scene,
  });
  return createCssoccerFreePlayEngine({ initialState });
}

function createCurrentFrame(snapshot) {
  return createCssoccerFreePlayPlayerHighlightInputFrame({
    match: snapshot.match,
    tick: snapshot.tick,
  });
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

function skipUnless(urls, reason) {
  return { skip: urls.some((url) => !existsSync(url)) ? reason : false };
}
