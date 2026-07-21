import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { parseCssoccerAnimationTable } from
  "../src/prepare/cssoccer/animationTable.mjs";
import { prepareCssoccerExactActuaPlayerGeometry } from
  "../src/prepare/cssoccer/exactActuaPlayerGeometry.mjs";
import { prepareExactActuaPlayerModel } from
  "../src/prepare/cssoccer/exactActuaPlayerModel.mjs";
import { prepareCssoccerExactActuaPlayerSequences } from
  "../src/prepare/cssoccer/exactActuaPlayerSequences.mjs";
import {
  CSSOCCER_EXACT_ACTUA_PLAYER_HIDDEN_MATRIX,
  CSSOCCER_EXACT_ACTUA_PLAYER_VIEWS_SCHEMA,
  prepareCssoccerExactActuaPlayerViews,
  prepareCssoccerExactActuaPlayerViewSample,
} from "../src/prepare/cssoccer/exactActuaPlayerViews.mjs";

const sourceRoot = new URL("../.local/actua-soccer/source/", import.meta.url);
const requiredFiles = [
  "DATA.H",
  "ACTIONS.CPP",
  "DATA.OBJ",
  "3DENG.C",
  "EUROREND.DAT",
  "EUROREND.OFF",
];
const missingFiles = requiredFiles.filter((file) => !existsSync(new URL(file, sourceRoot)));
const sourceTestOptions = {
  skip: missingFiles.length > 0
    ? `ignored pinned source is unavailable: ${missingFiles.join(", ")}`
    : false,
  timeout: 180_000,
};

let prepared;

test("prepares every one-basis pose/yaw state and rejects projective slivers", sourceTestOptions, () => {
  const inputs = prepareInputs();
  const contract = prepareCssoccerExactActuaPlayerViews(inputs);

  assert.equal(contract.schema, CSSOCCER_EXACT_ACTUA_PLAYER_VIEWS_SCHEMA);
  assert.equal(contract.status, "ready-complete-one-basis-pose-view-domain");
  assert.deepEqual({
    sequences: contract.counts.sequences,
    poseOccurrences: contract.counts.poseOccurrences,
    yawBins: contract.counts.yawBins,
    samples: contract.counts.samples,
    facesPerSample: contract.counts.facesPerSample,
    faceStates: contract.counts.faceStates,
  }, {
    sequences: 124,
    poseOccurrences: 5_857,
    yawBins: 24,
    samples: 140_568,
    facesPerSample: 13,
    faceStates: 1_827_384,
  });
  assert.equal(
    contract.counts.visible
      + contract.counts.nativeHidden
      + contract.counts.preparedDegenerate,
    1_827_384,
  );
  assert.deepEqual({
    visible: contract.counts.visible,
    nativeHidden: contract.counts.nativeHidden,
    preparedDegenerate: contract.counts.preparedDegenerate,
  }, {
    visible: 1_761_118,
    nativeHidden: 65_610,
    preparedDegenerate: 656,
  });
  assert.deepEqual(contract.classification.reasons, {
    "projective-pole-in-leaf": 560,
    "singular-native-quad": 96,
  });
  assert.equal(
    contract.exhaustiveStateSha256,
    "d4b8caf4801f733bea034cd3878aef35eca56c38b616f032c94fc81cd5e0db69",
  );
  assert.match(contract.exhaustiveStateSha256, /^[a-f0-9]{64}$/u);
  assert.match(contract.contractSha256, /^[a-f0-9]{64}$/u);
  assert.equal(contract.leafState.runtimeProjection, false);
  assert.equal(contract.leafState.runtimeHomography, false);
  assert.equal(contract.leafState.runtimeMatrixFormatting, false);
  assert.deepEqual(contract.leafState.canonicalCoordinates,
    [[0, 0], [32, 0], [32, 64], [0, 64]]);
  assert.equal(contract.leafState.nativeRasterCoverage.method,
    "native-inclusive-right-edge");

  const stand = inputs.sequences.sequences.find(({ slotId }) => slotId === 78);
  const sliverState = prepareCssoccerExactActuaPlayerViewSample({
    ...inputs,
    preparedPoseIndex: stand.preparedFrameStart + 4,
    yawIndex: 6,
  });
  assert.deepEqual({
    slotId: sliverState.slotId,
    localFrameIndex: sliverState.localFrameIndex,
    yawDegrees: sliverState.yawDegrees,
    faceIndex: sliverState.faces[12].faceIndex,
    visibility: sliverState.faces[12].visibility,
    reason: sliverState.faces[12].degenerateReason,
    transform: sliverState.faces[12].transform,
  }, {
    slotId: 78,
    localFrameIndex: 4,
    yawDegrees: 90,
    faceIndex: 12,
    visibility: "prepared-degenerate",
    reason: "projective-pole-in-leaf",
    transform: CSSOCCER_EXACT_ACTUA_PLAYER_HIDDEN_MATRIX,
  });
  assert.ok(sliverState.faces[12].projectiveW.some((value) => value < 0));
  assert.ok(sliverState.faces[12].projectiveW.some((value) => value > 0));
});

test("one prepared view state contains geometry selectors but no team or atlas data", sourceTestOptions, () => {
  const inputs = prepareInputs();
  const sample = prepareCssoccerExactActuaPlayerViewSample({
    ...inputs,
    preparedPoseIndex: 0,
    yawIndex: 0,
  });
  assert.equal(sample.sampleIndex, 0);
  assert.equal(sample.faces.length, 13);
  assert.deepEqual(sample.faces.map(({ faceIndex }) => faceIndex),
    Array.from({ length: 13 }, (_, index) => index));
  assert.doesNotMatch(
    JSON.stringify(sample),
    /player_f[12]|spain|argentina|shirtNumber|atlas|backgroundPosition/u,
  );
  for (const face of sample.faces) {
    assert.ok(new Set(["visible", "native-hidden", "prepared-degenerate"])
      .has(face.visibility));
    assert.match(face.transform, /^matrix3d\(/u);
  }
  assert.ok(Object.isFrozen(sample));
  assert.ok(Object.isFrozen(sample.faces[0]));
});

function prepareInputs() {
  if (prepared) return prepared;
  const animationTable = parseCssoccerAnimationTable({
    dataHBytes: sourceBytes("DATA.H"),
    actionsCppBytes: sourceBytes("ACTIONS.CPP"),
    dataObjectBytes: sourceBytes("DATA.OBJ"),
    threeDEngCBytes: sourceBytes("3DENG.C"),
    euroRendDatBytes: sourceBytes("EUROREND.DAT"),
    euroRendOffBytes: sourceBytes("EUROREND.OFF"),
  });
  const modelInputs = {
    dataObjectBytes: sourceBytes("DATA.OBJ"),
    euroRendDatBytes: sourceBytes("EUROREND.DAT"),
    euroRendOffBytes: sourceBytes("EUROREND.OFF"),
  };
  const models = Object.fromEntries(["player_f1", "player_f2"].map((modelId) => [
    modelId,
    prepareExactActuaPlayerModel({ ...modelInputs, modelId }),
  ]));
  prepared = {
    animationTable,
    sequences: prepareCssoccerExactActuaPlayerSequences({ animationTable }),
    geometry: prepareCssoccerExactActuaPlayerGeometry({ models }),
  };
  return prepared;
}

function sourceBytes(file) {
  return readFileSync(new URL(file, sourceRoot));
}
