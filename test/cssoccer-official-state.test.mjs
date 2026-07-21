import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  CSSOCCER_OFFICIAL_CONSTANTS,
  CSSOCCER_OFFICIAL_SOURCE,
  CSSOCCER_OFFICIAL_STATE_SCHEMA,
  CSSOCCER_OFFICIAL_STRUCT,
  CssoccerUnsupportedOfficialStateError,
  assertCssoccerOfficialState,
  createCssoccerOpeningOfficialState,
  projectCssoccerOpeningRefereeAction,
  stepCssoccerOpeningOfficialState,
} from "../src/cssoccer/officialState.mjs";
import {
  CSSOCCER_NATIVE_FIELD_CONTRACT,
  CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256,
} from "../src/cssoccer/nativeFieldContract.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
} from "../src/cssoccer/nativeGameplayProfile.mjs";

const sourceRoot = new URL("../.local/actua-soccer/source/", import.meta.url);
const sourceFiles = Object.fromEntries(
  CSSOCCER_OFFICIAL_SOURCE.files.map(({ file }) => [file, new URL(file, sourceRoot)]),
);
const testExe = new URL("TEST.EXE", sourceRoot);
const sourceOptions = skipUnless(
  [...Object.values(sourceFiles), testExe],
  "ignored pinned Actua source/compiled evidence",
);

test("init_officials plus init_centre preserves exact compiled stores", () => {
  const state = opening("A");

  assert.equal(state.schema, CSSOCCER_OFFICIAL_STATE_SCHEMA);
  assert.equal(assertCssoccerOfficialState(state), state);
  assert.equal(state.tick, 0);
  assert.equal(state.phase, "opening-centre");
  assert.equal(state.status, "positioning");
  assert.equal(state.officials.length, 3);
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.officials[0].position), true);
  assert.deepEqual(state.bindings, {
    evidenceClass: "source-derived-native-refs-uncaptured",
    nativeExactParity: false,
    nativeRefsCaptured: false,
    nativeFieldContractSha256: CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256,
    nativeGameplayProfileHash: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.profileHash,
    sourceRevision: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.bindings.sourceRevision,
    nativeBuildSha256: CSSOCCER_NATIVE_GAMEPLAY_PROFILE.bindings.nativeBuildSha256,
    compiledTestExeSha256:
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE.bindings.compiledEvidence.testExeSha256,
    compiledTestMapSha256:
      CSSOCCER_NATIVE_GAMEPLAY_PROFILE.bindings.compiledEvidence.testMapSha256,
    sourceFiles: Object.fromEntries(
      CSSOCCER_OFFICIAL_SOURCE.files.map(({ file, sha256 }) => [file, sha256]),
    ),
  });

  assert.deepEqual(state.officials[0], {
    id: "referee-00",
    index: 0,
    role: "referee",
    position: { x: f32(640), y: f32(400), z: f32(0) },
    facing: { x: f32(0), y: f32(1) },
    animation: {
      id: f32FromBits("429c0000"),
      frame: f32FromBits("3f19999a"),
      frameStep: f32FromBits("3c800000"),
      newAnimation: 1,
    },
    goto: { x: f32FromBits("442d5555"), y: f32(400) },
    action: 1,
    go: 0,
    target: 0,
  });
  assert.deepEqual(state.officials[1], {
    id: "assistant-referee-01",
    index: 1,
    role: "linesman-top",
    position: { x: f32(640), y: f32FromBits("c1aaaaab"), z: f32(0) },
    facing: { x: f32(0), y: f32(1) },
    animation: {
      id: f32FromBits("429c0000"),
      frame: f32(0),
      frameStep: f32FromBits("3d520d21"),
      newAnimation: 1,
    },
    goto: { x: f32(640), y: f32FromBits("c1aaaaab") },
    action: 0,
    go: 0,
    target: 0,
  });
  assert.deepEqual(state.officials[2], {
    id: "assistant-referee-02",
    index: 2,
    role: "linesman-bottom",
    position: { x: f32(640), y: f32FromBits("444d5555"), z: f32(0) },
    facing: { x: f32(0), y: f32(-1) },
    animation: {
      id: f32FromBits("429c0000"),
      frame: f32(0),
      frameStep: f32FromBits("3d520d21"),
      newAnimation: 1,
    },
    goto: { x: f32(640), y: f32FromBits("444d5555") },
    action: 0,
    go: 0,
    target: 0,
  });
});

test("CENTRE_A and CENTRE_B travel symmetrically through actions 1, 3, and 4", () => {
  const a = runOpening("A");
  const b = runOpening("B");

  assert.deepEqual(a.actions, b.actions);
  assert.deepEqual([...new Set(a.actions)], [1, 3, 4]);
  assert.equal(a.state.status, "ready");
  assert.equal(b.state.status, "ready");
  assert.equal(a.state.tick, 34);
  assert.equal(b.state.tick, 34);
  assert.equal(projectCssoccerOpeningRefereeAction(a.state), 4);
  assert.equal(projectCssoccerOpeningRefereeAction(b.state), 4);

  const aRef = a.state.officials[0];
  const bRef = b.state.officials[0];
  assert.equal(f32Bits(aRef.position.x), "442cfff8");
  assert.equal(f32Bits(bRef.position.x), "44130008");
  assert.equal(aRef.position.y, f32(400));
  assert.equal(bRef.position.y, f32(400));
  assert.equal(f32(aRef.position.x + bRef.position.x), f32(1280));
  assert.deepEqual(aRef.facing, { x: f32(-1), y: f32(0) });
  assert.deepEqual(bRef.facing, { x: f32(1), y: f32(0) });
  assert.deepEqual(a.state.officials.slice(1), opening("A").officials.slice(1));
  assert.deepEqual(b.state.officials.slice(1), opening("B").officials.slice(1));
});

test("goto_target uses the compiled f32 step and changes to stand before turning", () => {
  const initial = opening("A");
  const first = stepCssoccerOpeningOfficialState(initial);
  assert.equal(first.tick, 1);
  assert.equal(first.status, "positioning");
  assert.equal(f32Bits(first.officials[0].position.x), "4420a666");
  assert.deepEqual(first.officials[0].facing, { x: f32(1), y: f32(0) });
  assert.deepEqual(first.officials[0].animation, {
    id: f32FromBits("42920000"),
    frame: f32(0),
    frameStep: f32FromBits("3d8d3dcb"),
    newAnimation: 1,
  });

  let state = first;
  while (state.status === "positioning") {
    state = stepCssoccerOpeningOfficialState(state);
  }
  assert.equal(state.tick, 21);
  assert.equal(state.status, "turning");
  assert.equal(state.officials[0].action, 3);
  assert.equal(f32Bits(state.officials[0].position.x), "442cfff8");
  assert.deepEqual(state.officials[0].animation, {
    id: f32FromBits("429c0000"),
    frame: f32(0),
    frameStep: f32FromBits("3d520d21"),
    newAnimation: 1,
  });
});

test("unsupported official phases and action families fail closed", () => {
  assert.throws(
    () => createCssoccerOpeningOfficialState({
      centreOwner: "spain",
      nativeGameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
    }),
    /native team slot A or B/u,
  );
  assert.throws(
    () => createCssoccerOpeningOfficialState({
      centreOwner: "A",
      nativeGameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
      phase: "normal-play",
    }),
    /exactly/u,
  );

  const wait = clone(opening("A"));
  wait.officials[0].action = 2;
  wait.status = "waiting";
  assert.throws(
    () => stepCssoccerOpeningOfficialState(wait),
    (error) => error instanceof CssoccerUnsupportedOfficialStateError
      && error.boundary === "referee-action",
  );
  const normal = clone(opening("A"));
  normal.officials[0].action = 0;
  normal.status = "normal-play";
  assert.throws(
    () => assertCssoccerOfficialState(normal),
    (error) => error instanceof CssoccerUnsupportedOfficialStateError
      && error.boundary === "referee-action",
  );
  const foulPhase = clone(opening("A"));
  foulPhase.phase = "foul";
  assert.throws(() => assertCssoccerOfficialState(foulPhase), /must use/u);

  const ready = runOpening("A").state;
  assert.throws(
    () => stepCssoccerOpeningOfficialState(ready),
    (error) => error instanceof CssoccerUnsupportedOfficialStateError
      && error.boundary === "ready",
  );
});

test("state validation rejects float, linesman, and evidence-binding drift", () => {
  const imprecise = clone(opening("A"));
  imprecise.officials[0].position.x = 640.1;
  assert.throws(() => assertCssoccerOfficialState(imprecise), /exactly rounded f32/u);

  const movedLinesman = clone(opening("A"));
  movedLinesman.officials[1].position.x = f32(641);
  assert.throws(() => assertCssoccerOfficialState(movedLinesman), /linesmen changed/u);

  const rebound = clone(opening("A"));
  rebound.bindings.nativeExactParity = true;
  assert.throws(() => assertCssoccerOfficialState(rebound), /bindings changed/u);

  const extra = clone(opening("A"));
  extra.officials[0].restart = "corner";
  assert.throws(() => assertCssoccerOfficialState(extra), /exactly/u);
});

test("compiled struct recovery and numeric/store contract remain pinned", () => {
  assert.equal(CSSOCCER_OFFICIAL_STRUCT.byteSize, 52);
  assert.equal(CSSOCCER_OFFICIAL_STRUCT.packing, 4);
  assert.deepEqual(
    CSSOCCER_OFFICIAL_STRUCT.fields.map(({ name, offset, valueType }) => (
      [name, offset, valueType]
    )),
    [
      ["x", 0, "f32"], ["y", 4, "f32"], ["z", 8, "f32"],
      ["dir_x", 12, "f32"], ["dir_y", 16, "f32"],
      ["anim", 20, "f32"], ["frm", 24, "f32"], ["fstep", 28, "f32"],
      ["goto_x", 32, "f32"], ["goto_y", 36, "f32"],
      ["act", 40, "i32"], ["go", 44, "i32"],
      ["target", 48, "i16"], ["newanim", 50, "u8"],
    ],
  );
  assert.equal(CSSOCCER_OFFICIAL_STRUCT.trailingPaddingBytes, 1);
  assert.equal(CSSOCCER_OFFICIAL_CONSTANTS.movement.storedStep.numericBits, "40266666");
  assert.equal(CSSOCCER_OFFICIAL_CONSTANTS.turn.storedRadians.numericBits, "3e860a92");
  assert.equal(CSSOCCER_OFFICIAL_CONSTANTS.frameSteps.plead.numericBits, "3c800000");
  assert.equal(CSSOCCER_OFFICIAL_CONSTANTS.frameSteps.jog.numericBits, "3d8d3dcb");
  assert.equal(CSSOCCER_OFFICIAL_CONSTANTS.frameSteps.stand.numericBits, "3d520d21");
  assert.equal(CSSOCCER_OFFICIAL_SOURCE.nativeQualification.capturedRefs, false);
  assert.equal(CSSOCCER_OFFICIAL_SOURCE.nativeQualification.exactParityClaim, false);
  assert.equal(
    CSSOCCER_NATIVE_FIELD_CONTRACT.fields.some(({ id }) => id.startsWith("officials.")),
    false,
  );
});

test("pinned source/map/executable prove producers without entering runtime", sourceOptions, () => {
  for (const { file, sha256 } of CSSOCCER_OFFICIAL_SOURCE.files) {
    assert.equal(hash(readFileSync(sourceFiles[file])), sha256, `${file} hash`);
  }
  const executable = readFileSync(testExe);
  assert.equal(
    hash(executable),
    CSSOCCER_OFFICIAL_SOURCE.compiledEvidence.testExeSha256,
  );

  const actions = readFileSync(sourceFiles["ACTIONS.CPP"], "utf8");
  assert.match(actions, /void init_officials\(\)[\s\S]*refs\[0\]\.frm=0\.6;[\s\S]*refs\[2\]\.newanim=TRUE;/u);
  assert.match(actions, /refs\[0\]\.target=0;/u);
  const rules = readFileSync(sourceFiles["RULES.CPP"], "utf8");
  assert.match(rules, /refs\[0\]\.goto_x=cntspot_x\+5\*prat;/u);
  assert.match(rules, /refs\[0\]\.goto_x=cntspot_x-5\*prat;/u);
  assert.match(rules, /if \(d>2\.6\)[\s\S]*offc->act=3;/u);
  assert.match(rules, /float max=\(PI\/12\);[\s\S]*referee->act=4;/u);

  const externs = readFileSync(sourceFiles["EXTERNS.H"], "utf8");
  const declaration = externs.match(/struct officials \{([\s\S]*?)\};/u)?.[1] ?? "";
  assert.doesNotMatch(declaration, /\btarget\b/u);
  const map = readFileSync(sourceFiles["TEST.MAP"], "utf8");
  for (const marker of [
    "0003:00040dc8  officials near refs[]",
    "0001:0001fddb  void near init_officials()",
    "0001:0004cd93+ void near init_centre()",
    "0001:000510e4+ void near goto_target( officials near * )",
    "0001:000511e1+ void near at_target( officials near * )",
  ]) assert.match(map, new RegExp(escapeRegex(marker), "u"));

  assert.equal(executable.subarray(0x6dd23, 0x6dd27).toString("hex"), "0000803c");
  assert.equal(executable.subarray(0x6dd2d, 0x6dd31).toString("hex"), "210d523d");
  assert.equal(
    executable.subarray(0x6dd77, 0x6dd80).toString("hex"),
    "66c705f80d04000000",
  );
  assert.equal(executable.subarray(0x9eff5, 0x9eff9).toString("hex"), "920a863e");

  const runtime = readFileSync(
    new URL("../src/cssoccer/officialState.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(runtime, /node:fs|readFile|\.local\//u);
});

function opening(centreOwner) {
  return createCssoccerOpeningOfficialState({
    centreOwner,
    nativeGameplayProfile: CSSOCCER_NATIVE_GAMEPLAY_PROFILE,
  });
}

function runOpening(centreOwner) {
  let state = opening(centreOwner);
  const actions = [state.officials[0].action];
  while (state.status !== "ready") {
    assert.ok(state.tick < 80, "opening referee must not deadlock");
    state = stepCssoccerOpeningOfficialState(state);
    actions.push(state.officials[0].action);
  }
  return { actions, state };
}

function f32FromBits(bits) {
  const view = new DataView(new ArrayBuffer(4));
  view.setUint32(0, Number.parseInt(bits, 16), false);
  return view.getFloat32(0, false);
}

function f32Bits(value) {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value, false);
  return view.getUint32(0, false).toString(16).padStart(8, "0");
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function skipUnless(urls, label) {
  return urls.every((url) => existsSync(url))
    ? {}
    : { skip: `${label} unavailable` };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const f32 = Math.fround;
