import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { parseCssoccerAnimationTable } from
  "../src/prepare/cssoccer/animationTable.mjs";
import { prepareCssoccerExactActuaPlayerGeometry } from
  "../src/prepare/cssoccer/exactActuaPlayerGeometry.mjs";
import { prepareExactActuaPlayerModel } from
  "../src/prepare/cssoccer/exactActuaPlayerModel.mjs";
import {
  CSSOCCER_EXACT_ACTUA_PLAYER_CHUNK_FRAME_LIMIT,
  CSSOCCER_EXACT_ACTUA_PLAYER_INDEX_SCHEMA,
  CSSOCCER_EXACT_ACTUA_PLAYER_PACKAGING_SCHEMA,
  decodeCssoccerExactActuaPlayerChunk,
  prepareCssoccerExactActuaPlayerPackaging,
} from "../src/prepare/cssoccer/exactActuaPlayerPackaging.mjs";
import { prepareCssoccerExactActuaPlayerSequences } from
  "../src/prepare/cssoccer/exactActuaPlayerSequences.mjs";

const sourceRoot = new URL("../.local/actua-soccer/source/", import.meta.url);
const requiredFiles = [
  "DATA.H", "ACTIONS.CPP", "DATA.OBJ", "3DENG.C", "EUROREND.DAT", "EUROREND.OFF",
];
const missingFiles = requiredFiles.filter((file) => !existsSync(new URL(file, sourceRoot)));
const sourceTestOptions = {
  skip: missingFiles.length > 0
    ? `ignored pinned source is unavailable: ${missingFiles.join(", ")}`
    : false,
  timeout: 240_000,
};

test("selects bounded preformatted-matrix chunks below the duplicate-geometry boundary", sourceTestOptions, () => {
  const result = preparePackage();
  const contract = result.contract;

  assert.equal(contract.schema, CSSOCCER_EXACT_ACTUA_PLAYER_PACKAGING_SCHEMA);
  assert.equal(
    contract.status,
    "selected-preformatted-matrix-dictionary-with-packed-integer-indices",
  );
  assert.equal(contract.chunkFrameLimit, CSSOCCER_EXACT_ACTUA_PLAYER_CHUNK_FRAME_LIMIT);
  assert.equal(contract.index.schema, CSSOCCER_EXACT_ACTUA_PLAYER_INDEX_SCHEMA);
  assert.deepEqual(contract.index.counts, {
    sequences: 124,
    poseOccurrences: 5_857,
    yawBins: 24,
    samples: 140_568,
    facesPerSample: 13,
    faceStates: 1_827_384,
    chunks: contract.index.counts.chunks,
  });
  assert.ok(contract.index.counts.chunks > 124);
  assert.equal(contract.index.lookup.scanning, false);
  assert.equal(contract.index.cache.policy, "bounded-lru-transactional-frame-residency");
  assert.equal(contract.index.cache.maxDecodedChunks, 24);
  assert.equal(contract.index.cache.eagerWholeDomain, false);
  assert.equal(contract.index.cache.eviction, "least-recently-used-after-request-touch");
  assert.equal(contract.index.cache.publication,
    "requested frame commits only after every referenced chunk is resident");
  assert.ok(contract.metrics.ratios.selectedToEquivalentDuplicatedGeometry < 0.55);
  assert.ok(contract.metrics.ratios.selectedToVerboseDuplicatedGeometry < 0.55);
  assert.ok(contract.metrics.selected.maxChunkBytes < 2_000_000);
  assert.ok(contract.metrics.nodeProbe.maxParseMs < 50);
  assert.ok(contract.metrics.nodeProbe.maxDecodeLookupApplyMs < 50);
  assert.deepEqual(contract.roundTrip, {
    samples: 140_568,
    faceStates: 1_827_384,
    status: "exhaustive",
  });
  assert.equal(contract.encoding.numericMatrixConstructionAtRuntime, false);
  assert.equal(contract.encoding.numericMatrixFormattingAtRuntime, false);
  assert.match(contract.contractSha256, /^[a-f0-9]{64}$/u);
  assert.doesNotMatch(
    result.probe.largestChunkJson,
    /player_f[12]|spain|argentina|projectedCorners|projectiveW|depthBits/u,
  );
});

test("decodes one bounded chunk by direct frame/yaw/face address and fails closed", sourceTestOptions, () => {
  const result = preparePackage();
  const parsed = JSON.parse(result.probe.largestChunkJson);
  const decoded = decodeCssoccerExactActuaPlayerChunk(parsed);
  const faces = decoded.sample(parsed.frameStart, 0);
  assert.equal(faces.length, 13);
  assert.deepEqual(faces.map(({ faceIndex }) => faceIndex),
    Array.from({ length: 13 }, (_, index) => index));
  assert.ok(faces.every(({ transform }) => transform.startsWith("matrix3d(")));
  assert.throws(
    () => decoded.sample(parsed.frameEnd, 0),
    /sample address is invalid/u,
  );
  assert.throws(
    () => decodeCssoccerExactActuaPlayerChunk({ ...parsed, faceCount: 12 }),
    /chunk is invalid/u,
  );
});

let inputs;
let packageResult;
function preparePackage() {
  packageResult ??= prepareCssoccerExactActuaPlayerPackaging(prepareInputs());
  return packageResult;
}

function prepareInputs() {
  if (inputs) return inputs;
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
  inputs = {
    animationTable,
    sequences: prepareCssoccerExactActuaPlayerSequences({ animationTable }),
    geometry: prepareCssoccerExactActuaPlayerGeometry({ models }),
  };
  return inputs;
}

function sourceBytes(file) {
  return readFileSync(new URL(file, sourceRoot));
}
