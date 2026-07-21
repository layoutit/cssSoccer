import { createHash } from "node:crypto";

import { CSSOCCER_ANIMATION_TABLE_SCHEMA } from "./animationTable.mjs";

export const CSSOCCER_EXACT_ACTUA_PLAYER_SEQUENCES_SCHEMA =
  "cssoccer-exact-actua-player-sequences@1";

const EXPECTED_SEQUENCE_COUNT = 124;
const EXPECTED_POSE_COUNT = 5_857;
const POINT_COUNT = 28;
const COORDINATE_COUNT = POINT_COUNT * 3;
const POSE_BYTES = (1 + COORDINATE_COUNT) * 4;
const CAPTURE_RATE_HZ = 40;

/**
 * Freeze the complete source animation address space before any player-view
 * projection or browser publication is selected.
 */
export function prepareCssoccerExactActuaPlayerSequences({ animationTable } = {}) {
  assertAnimationTable(animationTable);
  const renderableSlots = animationTable.slots.filter(({ resolvedFrameCount }) => (
    Number.isSafeInteger(resolvedFrameCount) && resolvedFrameCount > 0
  ));
  if (renderableSlots.length !== EXPECTED_SEQUENCE_COUNT) {
    throw new Error(`Exact Actua sequence count changed from ${EXPECTED_SEQUENCE_COUNT}.`);
  }

  let preparedFrameStart = 0;
  const sequences = renderableSlots.map((slot, sequenceIndex) => {
    const mirrored = slot.status === "resolved-source-mirror";
    const sourceSlot = mirrored
      ? animationTable.slots[slot.posePayload.sourceSlotId]
      : slot;
    const sourcePayload = sourceSlot?.posePayload;
    if (
      sourcePayload?.status !== "decoded-float32-pose-frames"
      || sourcePayload.frameCount !== slot.resolvedFrameCount
      || sourcePayload.frames?.length !== slot.resolvedFrameCount
    ) {
      throw new Error(`Exact Actua sequence ${slot.id} has no complete source payload.`);
    }
    const sequenceStart = preparedFrameStart;
    const materializedPoseBytes = [];
    const frames = sourcePayload.frames.map((sourceFrame, localFrameIndex) => {
      if (
        sourceFrame.index !== localFrameIndex
        || sourceFrame.coordinates?.length !== COORDINATE_COUNT
        || sourceFrame.coordinates.some((value) => !Number.isFinite(value))
      ) {
        throw new Error(`Exact Actua sequence ${slot.id} frame ${localFrameIndex} is invalid.`);
      }
      const bytes = encodePoseBytes(sourceFrame.coordinates, { mirrored });
      materializedPoseBytes.push(bytes);
      const preparedFrameIndex = sequenceStart + localFrameIndex;
      return {
        key: `${slot.id}:${localFrameIndex}`,
        sequenceIndex,
        slotId: slot.id,
        sourceSlotId: sourceSlot.id,
        localFrameIndex,
        preparedFrameIndex,
        sourceFrameSha256: sourceFrame.sha256,
        exactFloat32PoseSha256: sha256(bytes),
        sourceByteRange: [...sourceFrame.sourceByteRange],
      };
    });
    preparedFrameStart += frames.length;
    const declarations = slot.declarations.map((declaration) => ({
      symbol: declaration.symbol,
      slotId: declaration.id,
      declaredCommentFrameCount: declaration.declaredCommentFrameCount,
      source: { ...declaration.source },
    }));
    return {
      sequenceIndex,
      slotId: slot.id,
      canonicalSourceSymbol: declarations[0]?.symbol ?? null,
      sourceSymbols: declarations,
      sourceDeclarationStatus: slot.sourceDeclarationStatus,
      localFrameCount: frames.length,
      preparedFrameStart: sequenceStart,
      preparedFrameEnd: preparedFrameStart,
      captureRateHz: CAPTURE_RATE_HZ,
      compiled: {
        frameCount: slot.compiled.frameCount,
        runtimeFrameOffset: slot.compiled.runtimeFrameOffset,
      },
      sourceRecord: {
        archiveId: sourcePayload.archiveId,
        recordIndex: sourcePayload.recordIndex,
        selector: sourcePayload.selector,
        byteRange: [...sourcePayload.byteRange],
        bytes: sourcePayload.bytes,
        sha256: sourcePayload.sha256,
      },
      exactFloat32PoseSha256: sha256(Buffer.concat(materializedPoseBytes)),
      lineage: {
        mode: mirrored ? "source-mirror-z" : "direct-source-payload",
        sourceSlotId: sourceSlot.id,
        localCoordinateTransform: mirrored
          ? clone(slot.posePayload.localCoordinateTransform)
          : { scale: [1, 1, 1], mirroredAxis: null },
        aliasSymbols: declarations.map(({ symbol }) => symbol),
      },
      frames,
    };
  });
  if (preparedFrameStart !== EXPECTED_POSE_COUNT) {
    throw new Error(`Exact Actua pose count changed from ${EXPECTED_POSE_COUNT}.`);
  }

  const preparedFrameLookup = sequences.map((sequence) => ({
    slotId: sequence.slotId,
    sourceSlotId: sequence.lineage.sourceSlotId,
    status: sequence.lineage.mode === "source-mirror-z"
      ? "resolved-source-mirror"
      : "decoded-source-payload",
    preparedFrameStart: sequence.preparedFrameStart,
    frameCount: sequence.localFrameCount,
    preparedFrameEnd: sequence.preparedFrameEnd,
  }));
  const frames = sequences.flatMap((sequence) => sequence.frames);
  const preparedFrameIndexBySlotFrame = Object.fromEntries(
    frames.map(({ key, preparedFrameIndex }) => [key, preparedFrameIndex]),
  );
  const frameByPreparedIndex = frames.map((frame, preparedFrameIndex) => {
    if (frame.preparedFrameIndex !== preparedFrameIndex) {
      throw new Error(`Exact Actua prepared frame ${preparedFrameIndex} is not contiguous.`);
    }
    if (preparedFrameIndexBySlotFrame[frame.key] !== preparedFrameIndex) {
      throw new Error(`Exact Actua lookup ${frame.key} does not round-trip.`);
    }
    return {
      preparedFrameIndex,
      slotId: frame.slotId,
      localFrameIndex: frame.localFrameIndex,
      sourceSlotId: frame.sourceSlotId,
      sourceFrameSha256: frame.sourceFrameSha256,
      exactFloat32PoseSha256: frame.exactFloat32PoseSha256,
    };
  });
  const contract = {
    schema: CSSOCCER_EXACT_ACTUA_PLAYER_SEQUENCES_SCHEMA,
    status: "ready-complete-source-sequence-domain",
    fixtureId: animationTable.fixtureId,
    sourceRevision: animationTable.sourceRevision,
    counts: {
      sequences: sequences.length,
      poseOccurrences: frames.length,
      directSequences: sequences.filter(({ lineage }) => (
        lineage.mode === "direct-source-payload"
      )).length,
      mirroredSequences: sequences.filter(({ lineage }) => (
        lineage.mode === "source-mirror-z"
      )).length,
      sourceNamedSequences: sequences.filter(({ sourceSymbols }) => sourceSymbols.length > 0).length,
      sourceAliasSequences: sequences.filter(({ sourceSymbols }) => sourceSymbols.length > 1).length,
    },
    capture: {
      rateHz: CAPTURE_RATE_HZ,
      pointCount: POINT_COUNT,
      coordinateCount: COORDINATE_COUNT,
      coordinateType: "float32le",
      poseBytes: POSE_BYTES,
    },
    sequences,
    preparedFrameLookup,
    preparedFrameIndexBySlotFrame,
    frameByPreparedIndex,
    lineage: {
      animationTableSchema: animationTable.schema,
      decodedMatchPayloadSha256: animationTable.poseArchive.decodedMatchPayloadSha256,
      stateArtifactSha256:
        animationTable.retainedNativeAnimations.evidence.stateArtifactSha256,
      sourceOrder: "compiled DATA.OBJ mcaps8 slot id order with zero-frame slots removed",
      mirrorRule: "odd zero-frame slots 9..69 mirror the preceding decoded slot on local z",
    },
  };
  const contractSha256 = sha256(Buffer.from(JSON.stringify(contract)));
  return deepFreeze({ ...contract, contractSha256 });
}

function encodePoseBytes(coordinates, { mirrored }) {
  const bytes = Buffer.alloc(POSE_BYTES);
  bytes.writeFloatLE(POINT_COUNT, 0);
  for (let index = 0; index < coordinates.length; index += 1) {
    const axis = index % 3;
    const value = mirrored && axis === 2 ? -coordinates[index] : coordinates[index];
    bytes.writeFloatLE(value, 4 + index * 4);
  }
  return bytes;
}

function assertAnimationTable(value) {
  if (
    value?.schema !== CSSOCCER_ANIMATION_TABLE_SCHEMA
    || value.counts?.slots !== 132
    || value.counts?.compiledDirectPoseSlots !== 94
    || value.counts?.mirroredPoseSlots !== 30
    || value.counts?.decodedPoseFrames !== 4_683
    || !Array.isArray(value.slots)
    || value.slots.length !== 132
  ) {
    throw new Error("Exact Actua sequences require the complete pinned animation table.");
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
