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
  CSSOCCER_MOTION_SOURCE,
  UnsupportedMotionSemanticsError,
  actualPlayerSpeed,
  normalizeSourceVector,
  sourceAngleCosine,
  sourceDistance2d,
  sourceFacingDirection,
  sourceForwardDisplacement,
  sourceFullPlayerSpeed,
  sourceGetThereTime,
  sourceWatcomFistpI32,
  turnSourceFacing,
  updateSourcePosition2d,
} from "../src/cssoccer/motionState.mjs";

const F32 = Math.fround;
const sourceRoot = new URL("../.local/actua-soccer/source/", import.meta.url);
const retainedStateUrl = new URL(
  "../.local/cssoccer/oracle/native/retained/runs/canonical-a/state.jsonl",
  import.meta.url,
);
const moduleUrl = new URL("../src/cssoccer/motionState.mjs", import.meta.url);
const sourceEvidenceOptions = {
  skip: ["ACTIONS.CPP", "INTELL.CPP", "MATHS.CPP"]
    .some((file) => !existsSync(new URL(file, sourceRoot)))
    ? "ignored native source evidence is unavailable"
    : false,
};
const retainedEvidenceOptions = {
  skip: !existsSync(retainedStateUrl)
    ? "ignored retained native state is unavailable"
    : false,
};

const SPEED_INPUT = Object.freeze({
  pitchLength: 1280,
  teamRate: 64,
  speedIntent: "normal",
  intentionCount: 0,
  sideStep: false,
  nativePlayer: 6,
  ballPossession: 0,
  ballInHands: false,
  keeperNativePlayers: Object.freeze([1, 12]),
  userControlIndex: 0,
  burstTimer: 0,
});

test("Watcom checked FISTP preserves nearest-even signed conversion", () => {
  assert.equal(sourceWatcomFistpI32(-29.746875), -30);
  assert.equal(sourceWatcomFistpI32(29.746875), 30);
  assert.equal(sourceWatcomFistpI32(28.5), 28);
  assert.equal(sourceWatcomFistpI32(29.5), 30);
  assert.equal(sourceWatcomFistpI32(-28.5), -28);
  assert.equal(sourceWatcomFistpI32(-29.5), -30);
});

test("pinned source owns the exact speed, direction, turn, and forward producers", sourceEvidenceOptions, () => {
  const pins = new Map(CSSOCCER_MOTION_SOURCE.files.map(({ file, sha256 }) => [file, sha256]));
  for (const file of ["ACTIONS.CPP", "INTELL.CPP", "MATHS.CPP"]) {
    const bytes = readFileSync(new URL(file, sourceRoot));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), pins.get(file));
  }

  const actions = readFileSync(new URL("ACTIONS.CPP", sourceRoot), "utf8");
  const intelligence = readFileSync(new URL("INTELL.CPP", sourceRoot), "utf8");
  const maths = readFileSync(new URL("MATHS.CPP", sourceRoot), "utf8");
  assert.match(
    actions,
    /float actual_spd\(match_player \*p\)[\s\S]*p->int_move==I_CELEB[\s\S]*p->int_move==I_INTERCEPT && p->int_cnt[\s\S]*p->go_step[\s\S]*ball_poss==p->tm_player[\s\S]*ball_in_hands[\s\S]*burst_timer\[user_controlled-1\]>0/u,
  );
  assert.match(
    actions,
    /float angle_to_xy\(float a,float b,float x,float y\)[\s\S]*float nx=a\/d;[\s\S]*float ox=x\/d;[\s\S]*float dif=\(\(nx\*ox\)\+\(ny\*oy\)\)/u,
  );
  assert.match(
    actions,
    /void go_forward\(match_player \*player\)[\s\S]*float turn_spd=\(1\.0\+a\)\/2;[\s\S]*player->go_txdis=player->tm_xdis\*turn_spd\*rate;[\s\S]*player->tm_x\+=\(player->go_txdis\)/u,
  );
  assert.match(
    actions,
    /void new_dir\(match_player \*player,float x,float y\)[\s\S]*max=MAX_TURN;[\s\S]*if \(\(nx\*oy\)>\(ny\*ox\)\)[\s\S]*player->face_dir=get_dir/u,
  );
  assert.match(
    intelligence,
    /int get_dir\(float x,float y\)[\s\S]*if \(y>=0\)[\s\S]*if \(-y>\(-x\*2\)\)[\s\S]*return\(d\)/u,
  );
  assert.match(
    maths,
    /float calc_dist\(float x,float y\)[\s\S]*r=sqrt\(\(x\*x\)\+\(y\*y\)\);[\s\S]*if \(r>0\.1\)[\s\S]*return\(0\.1\)/u,
  );
});

test("actual_spd covers normal, intercept, side-step, possession, keeper-hands, and burst branches", () => {
  const cases = [
    ["normal", SPEED_INPUT, "40924925"],
    ["intercept", {
      ...SPEED_INPUT,
      speedIntent: "intercept",
      intentionCount: 3,
      sideStep: true,
      ballPossession: 6,
      ballInHands: true,
      userControlIndex: 1,
      burstTimer: 10,
    }, "40924925"],
    ["side-step", {
      ...SPEED_INPUT,
      sideStep: true,
      ballPossession: 6,
      userControlIndex: 1,
      burstTimer: 10,
    }, "404ccccd"],
    ["possession", {
      ...SPEED_INPUT,
      ballPossession: 6,
      userControlIndex: 1,
      burstTimer: 10,
    }, "40800000"],
    ["keeper-hands", {
      ...SPEED_INPUT,
      nativePlayer: 12,
      ballPossession: 12,
      ballInHands: true,
    }, "402aaaab"],
    ["user-burst", {
      ...SPEED_INPUT,
      userControlIndex: 1,
      burstTimer: 10,
    }, "40aaaaab"],
  ];

  for (const [label, input, expectedBits] of cases) {
    const speed = actualPlayerSpeed(input);
    assert.equal(f32Bits(speed), expectedBits, label);
    assert.equal(speed, F32(speed), label);
  }

  assert.equal(actualPlayerSpeed({
    ...SPEED_INPUT,
    speedIntent: "celebration",
    celebrationSpeed: F32(3.75),
  }), F32(3.75));
  assert.equal(
    sourceFullPlayerSpeed({ pitchLength: 1280, teamRate: 64, celebrating: false }),
    actualPlayerSpeed({ ...SPEED_INPUT, speedIntent: "intercept", intentionCount: 1 }),
  );
});

test("get_there_time derives travel from player geometry rather than a fixture tick", () => {
  const common = {
    facing: { x: F32(1), y: F32(0) },
    speed: sourceFullPlayerSpeed({
      pitchLength: 1280,
      teamRate: 64,
      celebrating: false,
    }),
    maxTurn2Radians: F32(0.25),
    imThereDistance: F32(2),
    canRotateAndRun: true,
    mustFace: null,
  };
  const near = sourceGetThereTime({
    ...common,
    position: { x: F32(100), y: F32(100) },
    target: { x: F32(120), y: F32(100) },
  });
  const far = sourceGetThereTime({
    ...common,
    position: { x: F32(100), y: F32(100) },
    target: { x: F32(220), y: F32(100) },
  });
  assert.ok(near.ticks < far.ticks);
  assert.equal(Object.isFrozen(near), true);
});

test("speed branch precedence and unsupported native intention mappings are explicit", () => {
  assert.equal(
    f32Bits(actualPlayerSpeed({
      ...SPEED_INPUT,
      sideStep: true,
      ballPossession: 6,
      ballInHands: true,
      userControlIndex: 1,
      burstTimer: 10,
    })),
    "404ccccd",
  );
  assert.equal(
    f32Bits(actualPlayerSpeed({
      ...SPEED_INPUT,
      ballPossession: 6,
      ballInHands: true,
      userControlIndex: 1,
      burstTimer: 10,
    })),
    "40800000",
    "non-keeper hand state stays on the possession branch",
  );
  assert.equal(
    f32Bits(actualPlayerSpeed({
      ...SPEED_INPUT,
      userControlIndex: 1,
      burstTimer: 0,
    })),
    "40924925",
  );
  assert.throws(
    () => actualPlayerSpeed({ ...SPEED_INPUT, speedIntent: "unmapped-native-intention" }),
    (error) => (
      error instanceof UnsupportedMotionSemanticsError
      && error.boundary === "actual_spd.int_move"
    ),
  );
  assert.throws(
    () => actualPlayerSpeed({ ...SPEED_INPUT, speedIntent: "celebration" }),
    /celebrationSpeed must be a finite, exactly rounded f32/u,
  );
  assert.throws(
    () => actualPlayerSpeed({ ...SPEED_INPUT, actionId: 1 }),
    /unsupported keys: actionId/u,
  );
});

test("calc_dist normalization and get_dir preserve source float32 boundaries", () => {
  assert.equal(f32Bits(sourceDistance2d({ x: F32(3), y: F32(4) })), "40a00000");
  assert.equal(f32Bits(sourceDistance2d({ x: F32(0), y: F32(0) })), "3dcccccd");
  const normalized = normalizeSourceVector({ x: F32(3), y: F32(4) });
  assert.deepEqual(f32VectorBits(normalized), { x: "3f19999a", y: "3f4ccccd" });
  assert.equal(f32Bits(sourceAngleCosine({
    target: { x: F32(3), y: F32(4) },
    facing: { x: F32(1), y: F32(0) },
  })), "3f19999a");

  const directionFixtures = [
    [{ x: -1, y: 0 }, 0],
    [{ x: -1, y: 1 }, 1],
    [{ x: 0, y: 1 }, 2],
    [{ x: 1, y: 1 }, 3],
    [{ x: 1, y: 0 }, 4],
    [{ x: 1, y: -1 }, 5],
    [{ x: 0, y: -1 }, 6],
    [{ x: -1, y: -1 }, 7],
  ];
  for (const [vector, expected] of directionFixtures) {
    assert.equal(sourceFacingDirection(vector), expected, JSON.stringify(vector));
  }
  assert.equal(sourceFacingDirection({ x: F32(2), y: F32(1) }), 3);
  assert.equal(sourceFacingDirection({ x: F32(2.000000238418579), y: F32(1) }), 4);
  assert.equal(sourceFacingDirection({ x: F32(0), y: F32(0) }), 3);
});

test("new_dir turns at the explicit maximum or snaps to a nearby target", () => {
  const left = turnSourceFacing({
    facing: { x: F32(1), y: F32(0) },
    target: { x: F32(0), y: F32(1) },
    maxTurnRadians: F32(0.2),
  });
  assert.deepEqual(f32VectorBits(left.facing), { x: "3f7ae5a5", y: "3e4b6ff9" });
  assert.equal(left.faceDirection, 4);
  assert.equal(f32Bits(left.appliedTurn), "3e4ccccd");

  const right = turnSourceFacing({
    facing: { x: F32(1), y: F32(0) },
    target: { x: F32(0), y: F32(-1) },
    maxTurnRadians: F32(0.2),
  });
  assert.deepEqual(f32VectorBits(right.facing), { x: "3f7ae5a5", y: "be4b6ff9" });
  assert.equal(f32Bits(right.appliedTurn), "be4ccccd");

  const snap = turnSourceFacing({
    facing: { x: F32(1), y: F32(0) },
    target: { x: F32(10), y: F32(1) },
    maxTurnRadians: F32(0.2),
  });
  assert.deepEqual(f32VectorBits(snap.facing), { x: "3f7ebac2", y: "3dcbc89c" });
  assert.equal(f32Bits(snap.appliedTurn), "00000000");
  assert.equal(Object.isFrozen(snap), true);
  assert.equal(Object.isFrozen(snap.facing), true);
});

test("normalized forward displacement and position addition retain exact f32 bits", () => {
  const facing = turnSourceFacing({
    facing: { x: F32(1), y: F32(0) },
    target: { x: F32(0), y: F32(1) },
    maxTurnRadians: F32(0.2),
  }).facing;
  const forward = sourceForwardDisplacement({
    facing,
    targetOffset: { x: F32(3), y: F32(4) },
    speed: actualPlayerSpeed(SPEED_INPUT),
  });
  assert.deepEqual(f32VectorBits(forward.displacement), { x: "407a76a3", y: "3f4b15f7" });
  assert.equal(f32Bits(forward.alignment), "3f3f39c8");
  assert.equal(f32Bits(forward.turnSpeed), "3f5f9ce4");

  const position = updateSourcePosition2d({
    position: { x: F32(618.6666870117188), y: F32(640) },
    displacement: forward.displacement,
  });
  assert.deepEqual(f32VectorBits(position), { x: "441ba522", y: "442032c5" });
  assert.equal(Object.isFrozen(position), true);
});

test("motion primitives reject implicit rounding and absent profile bindings", () => {
  assert.throws(
    () => sourceDistance2d({ x: 1.1, y: F32(0) }),
    /exactly rounded f32/u,
  );
  assert.throws(
    () => normalizeSourceVector({ x: F32(1), y: F32(0), z: F32(0) }),
    /unsupported keys: z/u,
  );
  assert.throws(
    () => turnSourceFacing({
      facing: { x: F32(1), y: F32(0) },
      target: { x: F32(0), y: F32(1) },
    }),
    /maxTurnRadians must be a finite, exactly rounded f32/u,
  );
  assert.throws(
    () => actualPlayerSpeed({ ...SPEED_INPUT, keeperNativePlayers: undefined }),
    /exactly two native slots/u,
  );
});

test("retained tick-one facing fields keep native types, bits, and get_dir mapping", retainedEvidenceOptions, async () => {
  const retained = await readRetainedMotionTick(1);
  assert.equal(retained.header.bindings.scenarioId, "5fc29151faf3ff34");
  assert.equal(retained.header.bindings.profileSha256, "ea2df6e20494efbaa95e3d292db2a25969d8dc0c255d0d7c2c6393f8a5713acc");
  assert.equal(retained.players.size, 22);

  for (const [stableId, player] of retained.players) {
    assert.equal(player.face_direction.valueType, "i16", stableId);
    assert.equal(player.x_displacement.valueType, "f32", stableId);
    assert.equal(player.y_displacement.valueType, "f32", stableId);
    assert.equal(f32Bits(player.x_displacement.value), player.x_displacement.numericBits, stableId);
    assert.equal(f32Bits(player.y_displacement.value), player.y_displacement.numericBits, stableId);
    assert.equal(sourceFacingDirection({
      x: player.x_displacement.value,
      y: player.y_displacement.value,
    }), player.face_direction.value, stableId);
  }

  const spainKeeper = retained.players.get("spain-player-01");
  assert.deepEqual({
    face: spainKeeper.face_direction.numericBits,
    x: spainKeeper.x_displacement.numericBits,
    y: spainKeeper.y_displacement.numericBits,
  }, { face: "0004", x: "3f6dc677", y: "bebdb9b4" });
  const argentinaKeeper = retained.players.get("argentina-player-01");
  assert.deepEqual({
    face: argentinaKeeper.face_direction.numericBits,
    x: argentinaKeeper.x_displacement.numericBits,
    y: argentinaKeeper.y_displacement.numericBits,
  }, { face: "0000", x: "bf726a03", y: "bea493b6" });
});

test("runtime motion is evidence-independent and repeated fixture bytes are identical", () => {
  const source = readFileSync(moduleUrl, "utf8");
  assert.doesNotMatch(source, /node:fs|state\.jsonl|\.local\/|canonical-a/u);

  const first = Buffer.from(deterministicMotionFixture());
  const second = Buffer.from(deterministicMotionFixture());
  assert.equal(first.equals(second), true);
  assert.equal(createHash("sha256").update(first).digest("hex"),
    createHash("sha256").update(second).digest("hex"));
});

function deterministicMotionFixture() {
  let position = { x: F32(300), y: F32(500) };
  let facing = { x: F32(1), y: F32(0) };
  const records = [];
  for (let tick = 0; tick < 12; tick += 1) {
    const target = { x: F32(40 - tick), y: F32(75 + tick) };
    const turn = turnSourceFacing({ facing, target, maxTurnRadians: F32(0.2) });
    facing = turn.facing;
    const forward = sourceForwardDisplacement({
      facing,
      targetOffset: target,
      speed: actualPlayerSpeed({
        ...SPEED_INPUT,
        userControlIndex: tick >= 6 ? 1 : 0,
        burstTimer: tick >= 6 ? 10 : 0,
      }),
    });
    position = updateSourcePosition2d({ position, displacement: forward.displacement });
    records.push({
      tick,
      faceDirection: turn.faceDirection,
      facing: f32VectorBits(facing),
      displacement: f32VectorBits(forward.displacement),
      position: f32VectorBits(position),
    });
  }
  return `${JSON.stringify(records)}\n`;
}

async function readRetainedMotionTick(tick) {
  const input = createReadStream(retainedStateUrl);
  const lines = createInterface({ input, crlfDelay: Infinity });
  let header;
  const players = new Map();
  try {
    for await (const line of lines) {
      const record = JSON.parse(line);
      if (record.recordType === "header") {
        header = record;
        continue;
      }
      if (record.recordType !== "sample") continue;
      if (record.tick > tick) break;
      if (record.tick !== tick) continue;
      const match = /^players\.([^.]+)\.(face_direction|x_displacement|y_displacement)$/u
        .exec(record.fieldId);
      if (!match) continue;
      const [, stableId, field] = match;
      const player = players.get(stableId) ?? {};
      player[field] = record;
      players.set(stableId, player);
    }
  } finally {
    lines.close();
    input.destroy();
  }
  assert.ok(header, "retained stream header");
  for (const [stableId, player] of players) {
    assert.deepEqual(Object.keys(player).sort(), [
      "face_direction",
      "x_displacement",
      "y_displacement",
    ], stableId);
  }
  return { header, players };
}

function f32VectorBits(vector) {
  return { x: f32Bits(vector.x), y: f32Bits(vector.y) };
}

function f32Bits(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setFloat32(0, value, false);
  return [...bytes].map((entry) => entry.toString(16).padStart(2, "0")).join("");
}
