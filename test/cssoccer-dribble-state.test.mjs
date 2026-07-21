import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  CSSOCCER_DRIBBLE_SOURCE,
  selectCssoccerDribbleRun,
} from "../src/cssoccer/dribbleState.mjs";

const F32 = Math.fround;
const sourceUrl = new URL("../.local/actua-soccer/source/INTELL.CPP", import.meta.url);
const sourceOptions = {
  skip: existsSync(sourceUrl) ? false : "ignored native source evidence is unavailable",
};
const PITCH = Object.freeze({
  length: 1280,
  ratio: F32(10.666666984558105),
  width: 800,
});

test("pinned intelligence source owns generic dribble direction and target selection", sourceOptions, () => {
  const bytes = readFileSync(sourceUrl);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    CSSOCCER_DRIBBLE_SOURCE.sha256,
  );
  const source = bytes.toString("utf8");
  assert.match(source, /void get_opp_dir_tab\(int pnum\)[\s\S]*DRIB_DANGER_AREA[\s\S]*opp_dir_tab/u);
  assert.match(source, /void dribble_dir\(match_player \*player,float &xd,float &yd\)[\s\S]*sin\(0\.174\)[\s\S]*cnt\+\+==36/u);
  assert.match(source, /void go_dribble\(match_player \*player,float x,float y\)[\s\S]*x\*500[\s\S]*init_run_act/u);
  assert.match(source, /void make_run\(match_player \*player\)[\s\S]*player->tm_player<12[\s\S]*dribble_dir[\s\S]*go_dribble/u);
});

test("make_run advances either native team toward its attacking goal", () => {
  const teamA = run({ nativePlayer: 10, x: 640, facingX: 1 });
  const teamB = run({ nativePlayer: 18, x: 640, facingX: -1 });

  assert.deepEqual(teamA.direction, { x: F32(1), y: F32(0) });
  assert.deepEqual(teamA.target, { x: F32(1140), y: F32(400) });
  assert.deepEqual(teamB.direction, { x: F32(-1), y: F32(0) });
  assert.deepEqual(teamB.target, { x: F32(140), y: F32(400) });
  assert.equal(teamA.intelligenceMove, "dribble");
  assert.equal(teamA.intelligenceCount, 10);
  assert.equal(teamA.goCount, 11);
});

test("make_run bends toward goal and away from the touchline near either end", () => {
  const teamA = run({ nativePlayer: 10, x: 1220, y: 300, facingX: 1 });
  const teamB = run({ nativePlayer: 18, x: 60, y: 300, facingX: -1 });

  assert.ok(teamA.direction.x > 0 && teamA.direction.x < 1);
  assert.ok(teamA.direction.y > 0);
  assert.equal(teamB.direction.x, F32(-teamA.direction.x));
  assert.equal(teamB.direction.y, teamA.direction.y);
});

test("dribble_dir searches both sides of a blocking opponent according to the live seed", () => {
  const leftFirst = run({ nativePlayer: 10, x: 640, facingX: 1, obstacle: true, seed: 0 });
  const rightFirst = run({ nativePlayer: 10, x: 640, facingX: 1, obstacle: true, seed: 127 });

  assert.equal(leftFirst.opponentCount, 1);
  assert.equal(rightFirst.opponentCount, 1);
  assert.ok(leftFirst.directionAttempts > 0);
  assert.ok(rightFirst.directionAttempts > 0);
  assert.ok(leftFirst.target.y > 400);
  assert.ok(rightFirst.target.y < 400);
  assert.equal(leftFirst.mustPass, false);
  assert.equal(rightFirst.mustPass, false);
});

function run({
  nativePlayer,
  x,
  y = 400,
  facingX,
  obstacle = false,
  seed = 84,
}) {
  const opponentNativePlayer = nativePlayer < 12 ? 12 : 1;
  const player = {
    nativePlayer,
    position: { x: F32(x), y: F32(y) },
    facing: { x: F32(facingX), y: F32(0) },
    flair: 64,
    distance: F32(1),
  };
  const ball = { x: F32(x), y: F32(y) };
  const dangerQuarter = PITCH.ratio * 13 / 4;
  const opponent = {
    nativePlayer: opponentNativePlayer,
    action: 1,
    distance: F32(dangerQuarter),
    on: obstacle,
    position: {
      x: F32(x + facingX * dangerQuarter),
      y: F32(y),
    },
  };
  return selectCssoccerDribbleRun({
    ball,
    pitch: PITCH,
    player,
    players: [
      {
        nativePlayer,
        action: 1,
        distance: F32(1),
        on: true,
        position: player.position,
      },
      opponent,
    ],
    seed,
  });
}
