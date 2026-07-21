import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { parseCssoccerAnimationTable } from "../src/prepare/cssoccer/animationTable.mjs";
import {
  CSSOCCER_EXACT_ACTUA_PLAYER_SEQUENCES_SCHEMA,
  prepareCssoccerExactActuaPlayerSequences,
} from "../src/prepare/cssoccer/exactActuaPlayerSequences.mjs";

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
  timeout: 120_000,
};

test("freezes all 124 exact Actua sequences and 5,857 pose occurrences", sourceTestOptions, () => {
  const animationTable = parseCssoccerAnimationTable({
    dataHBytes: sourceBytes("DATA.H"),
    actionsCppBytes: sourceBytes("ACTIONS.CPP"),
    dataObjectBytes: sourceBytes("DATA.OBJ"),
    threeDEngCBytes: sourceBytes("3DENG.C"),
    euroRendDatBytes: sourceBytes("EUROREND.DAT"),
    euroRendOffBytes: sourceBytes("EUROREND.OFF"),
  });
  const contract = prepareCssoccerExactActuaPlayerSequences({ animationTable });

  assert.equal(contract.schema, CSSOCCER_EXACT_ACTUA_PLAYER_SEQUENCES_SCHEMA);
  assert.equal(contract.status, "ready-complete-source-sequence-domain");
  assert.equal(contract.counts.sequences, 124);
  assert.equal(contract.counts.poseOccurrences, 5_857);
  assert.equal(contract.counts.directSequences, 94);
  assert.equal(contract.counts.mirroredSequences, 30);
  assert.deepEqual(contract.capture, {
    rateHz: 40,
    pointCount: 28,
    coordinateCount: 84,
    coordinateType: "float32le",
    poseBytes: 340,
  });
  assert.deepEqual(
    contract.sequences.map(({ slotId }) => slotId),
    animationTable.slots
      .filter(({ resolvedFrameCount }) => Number.isSafeInteger(resolvedFrameCount)
        && resolvedFrameCount > 0)
      .map(({ id }) => id),
  );

  const stand = contract.sequences.find(({ slotId }) => slotId === 78);
  assert.equal(stand.localFrameCount, 39);
  assert.ok(stand.sourceSymbols.some(({ symbol }) => symbol === "MC_STAND"));
  assert.equal(stand.captureRateHz, 40);
  const slot120 = contract.sequences.find(({ slotId }) => slotId === 120);
  assert.deepEqual(
    [slot120.preparedFrameStart, slot120.preparedFrameEnd, slot120.localFrameCount],
    [4_965, 5_120, 155],
  );
  assert.equal(slot120.sourceRecord.recordIndex, 219);
  assert.equal(slot120.sourceRecord.selector, 1_752);
  assert.equal(slot120.exactFloat32PoseSha256, slot120.sourceRecord.sha256);
  assert.equal(
    slot120.frames[0].exactFloat32PoseSha256,
    slot120.frames[0].sourceFrameSha256,
  );

  const mirrored = contract.sequences.find(({ slotId }) => slotId === 21);
  assert.deepEqual(mirrored.lineage, {
    mode: "source-mirror-z",
    sourceSlotId: 20,
    localCoordinateTransform: { scale: [1, 1, -1], mirroredAxis: "z" },
    aliasSymbols: mirrored.sourceSymbols.map(({ symbol }) => symbol),
  });
  assert.notEqual(mirrored.exactFloat32PoseSha256, mirrored.sourceRecord.sha256);
  assert.equal(mirrored.sourceRecord.selector, contract.sequences
    .find(({ slotId }) => slotId === 20).sourceRecord.selector);

  assert.deepEqual(contract.preparedFrameLookup.at(-1), {
    slotId: 130,
    sourceSlotId: 130,
    status: "decoded-source-payload",
    preparedFrameStart: 5_829,
    frameCount: 28,
    preparedFrameEnd: 5_857,
  });
  assert.equal(contract.preparedFrameIndexBySlotFrame["120:0"], 4_965);
  assert.equal(contract.preparedFrameIndexBySlotFrame["23:0"], 867);
  assert.equal(contract.frameByPreparedIndex.length, 5_857);
  for (const frame of contract.frameByPreparedIndex) {
    assert.equal(
      contract.preparedFrameIndexBySlotFrame[`${frame.slotId}:${frame.localFrameIndex}`],
      frame.preparedFrameIndex,
    );
    const sequence = contract.sequences.find(({ slotId }) => slotId === frame.slotId);
    assert.equal(sequence.frames[frame.localFrameIndex].preparedFrameIndex, frame.preparedFrameIndex);
    assert.match(frame.sourceFrameSha256, /^[a-f0-9]{64}$/u);
    assert.match(frame.exactFloat32PoseSha256, /^[a-f0-9]{64}$/u);
  }
  assert.match(contract.contractSha256, /^[a-f0-9]{64}$/u);
  assert.doesNotMatch(JSON.stringify(contract), /"(?:coordinates|points)"/u);
  assert.ok(Object.isFrozen(contract));
  assert.ok(Object.isFrozen(contract.sequences[0].frames[0]));
  assert.equal(
    prepareCssoccerExactActuaPlayerSequences({ animationTable }).contractSha256,
    contract.contractSha256,
  );
});

test("rejects missing slots and pose occurrences instead of privileging MC_STAND", sourceTestOptions, () => {
  const animationTable = parseCssoccerAnimationTable({
    dataHBytes: sourceBytes("DATA.H"),
    actionsCppBytes: sourceBytes("ACTIONS.CPP"),
    dataObjectBytes: sourceBytes("DATA.OBJ"),
    threeDEngCBytes: sourceBytes("3DENG.C"),
    euroRendDatBytes: sourceBytes("EUROREND.DAT"),
    euroRendOffBytes: sourceBytes("EUROREND.OFF"),
  });
  const slots = animationTable.slots.map((slot) => ({ ...slot }));
  slots[120] = { ...slots[120], resolvedFrameCount: 154 };
  assert.throws(
    () => prepareCssoccerExactActuaPlayerSequences({
      animationTable: { ...animationTable, slots },
    }),
    /sequence 120 has no complete source payload/u,
  );
});

function sourceBytes(file) {
  return readFileSync(new URL(file, sourceRoot));
}
