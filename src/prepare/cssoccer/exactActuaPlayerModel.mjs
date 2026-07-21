import { createHash } from "node:crypto";

import {
  decodeActuaOffsetArchive,
  decodeWatcomOmf32Object,
} from "./formatAdapters.mjs";

export const CSSOCCER_EXACT_ACTUA_PLAYER_MODEL_SCHEMA =
  "cssoccer-exact-actua-player-model@1";

const MODEL_ID = "player_f1";
const MODEL_FACE_SHA256 = Object.freeze({
  player_f1: "cb77521c8fbc97579233f0f5f8bed1bedb8bdaa7fc59a777c33e10a339cf2219",
  player_f2: "b0ed1f3f8206b0006c745994b475a4371897115ced132244285681cd0ef918ae",
});
const FACE_COUNT = 13;
const POINT_COUNT = 28;
const POSE_COUNT = 39;
const POSE_RECORD_INDEX = 179;
const POSE_FRAME_BYTES = (1 + POINT_COUNT * 3) * 4;
const PINNED_DATA_OBJECT_SHA256 =
  "af643e660c93c51d0abe3ee7ef3ac276918fabfd9766af15e309df18776d873b";
const PINNED_EUROREND_DATA_SHA256 =
  "0c38ab865fcd1d62d7c0f3f88b861f4c43643caf402dea6fbe9b0f042fd340cb";
const PINNED_EUROREND_INDEX_SHA256 =
  "96e6cea4bb91667cd204faa928696006048cf35a4e0baabefe83eca5d06dcb87";
const PINNED_POSE_BYTES_SHA256 =
  "74c929ee1b913ecfb276114766ada6ca760d9eb0b7c6db3e25d3ce7b2403298c";

/**
 * Prepare the untouched native player_f1 topology and MC_STAND payload.
 * This contract deliberately stops before any presentation adapter runs.
 */
export function prepareExactActuaPlayerModel({
  dataObjectBytes,
  euroRendDatBytes,
  euroRendOffBytes,
  modelId = MODEL_ID,
} = {}) {
  const pinnedFaceSha256 = MODEL_FACE_SHA256[modelId];
  if (!pinnedFaceSha256) throw new Error(`Unsupported exact Actua player model ${String(modelId)}.`);
  const dataBytes = requireBytes(dataObjectBytes, "DATA.OBJ");
  const archiveData = requireBytes(euroRendDatBytes, "EUROREND.DAT");
  const archiveIndex = requireBytes(euroRendOffBytes, "EUROREND.OFF");
  assertSha256(dataBytes, PINNED_DATA_OBJECT_SHA256, "DATA.OBJ");
  assertSha256(archiveData, PINNED_EUROREND_DATA_SHA256, "EUROREND.DAT");
  assertSha256(archiveIndex, PINNED_EUROREND_INDEX_SHA256, "EUROREND.OFF");

  const dataObject = decodeWatcomOmf32Object(dataBytes, { label: "DATA.OBJ" });
  const faceBytes = dataObject.symbolBytes(modelId);
  assertSha256(faceBytes, pinnedFaceSha256, `DATA.OBJ ${modelId}`);
  const faceContract = decodeExactFaces(faceBytes, modelId);

  const archive = decodeActuaOffsetArchive({
    dataBytes: archiveData,
    indexBytes: archiveIndex,
    label: "EUROREND",
  });
  const poseRecord = archive.recordInfo(POSE_RECORD_INDEX * 8);
  const poseBytes = archive.recordBytes(poseRecord.selector);
  if (poseBytes.length !== POSE_COUNT * POSE_FRAME_BYTES) {
    throw new Error(
      `EUROREND record ${POSE_RECORD_INDEX} is ${poseBytes.length} bytes; expected ${POSE_COUNT * POSE_FRAME_BYTES}.`,
    );
  }
  assertSha256(poseBytes, PINNED_POSE_BYTES_SHA256, "EUROREND MC_STAND record 179");
  const poses = decodeExactPoses(poseBytes, poseRecord.offset);

  const core = {
    schema: CSSOCCER_EXACT_ACTUA_PLAYER_MODEL_SCHEMA,
    id: modelId,
    animation: Object.freeze({
      symbol: "MC_STAND",
      slotId: 78,
      recordIndex: POSE_RECORD_INDEX,
      selector: poseRecord.selector,
      poseCount: POSE_COUNT,
      pointCount: POINT_COUNT,
      coordinateCount: POINT_COUNT * 3,
      coordinateType: "float32le",
      coordinateOrder: Object.freeze(["x", "y", "z"]),
      frameBytes: POSE_FRAME_BYTES,
      sourceByteRange: Object.freeze([poseRecord.offset, poseRecord.offset + poseRecord.size]),
      sourceBytesSha256: PINNED_POSE_BYTES_SHA256,
      poses,
    }),
    topology: Object.freeze({
      symbol: modelId,
      pointCount: POINT_COUNT,
      faceCount: FACE_COUNT,
      wordType: "int16le",
      sourceBytes: faceBytes.length,
      sourceBytesSha256: pinnedFaceSha256,
      rawWords: Object.freeze(readInt16Words(faceBytes)),
      faces: faceContract.faces,
    }),
    lineage: Object.freeze({
      sourceRevision: "b40bd6d1e50e052030c5f0884fbe3deda7e9fa4b",
      dataObject: Object.freeze({ file: "DATA.OBJ", sha256: PINNED_DATA_OBJECT_SHA256 }),
      euroRendData: Object.freeze({ file: "EUROREND.DAT", sha256: PINNED_EUROREND_DATA_SHA256 }),
      euroRendIndex: Object.freeze({ file: "EUROREND.OFF", sha256: PINNED_EUROREND_INDEX_SHA256 }),
    }),
  };
  const contract = deepFreeze({
    ...core,
    contractSha256: sha256(Buffer.from(canonicalJson(core))),
  });
  assertExactActuaPlayerModelRoundTrip(contract, {
    dataObjectBytes: dataBytes,
    euroRendDatBytes: archiveData,
    euroRendOffBytes: archiveIndex,
    modelId,
  });
  return contract;
}

export function assertExactActuaPlayerModelRoundTrip(contract, {
  dataObjectBytes,
  euroRendDatBytes,
  euroRendOffBytes,
  modelId = contract?.id,
} = {}) {
  if (!contract || contract.schema !== CSSOCCER_EXACT_ACTUA_PLAYER_MODEL_SCHEMA) {
    throw new Error("Exact Actua player model schema changed.");
  }
  if (contract.id !== modelId || !MODEL_FACE_SHA256[modelId]) {
    throw new Error("Exact Actua player model id changed.");
  }
  if (
    contract.topology?.pointCount !== POINT_COUNT
    || contract.topology?.faceCount !== FACE_COUNT
    || contract.topology?.wordType !== "int16le"
    || contract.topology?.faces?.length !== FACE_COUNT
  ) {
    throw new Error("Exact player_f1 topology type or count changed.");
  }
  if (
    contract.animation?.symbol !== "MC_STAND"
    || contract.animation?.recordIndex !== POSE_RECORD_INDEX
    || contract.animation?.poseCount !== POSE_COUNT
    || contract.animation?.pointCount !== POINT_COUNT
    || contract.animation?.coordinateType !== "float32le"
    || contract.animation?.poses?.length !== POSE_COUNT
  ) {
    throw new Error("Exact MC_STAND pose type or count changed.");
  }

  const dataObject = decodeWatcomOmf32Object(requireBytes(dataObjectBytes, "DATA.OBJ"), {
    label: "DATA.OBJ",
  });
  const expectedFaceBytes = dataObject.symbolBytes(modelId);
  const rebuiltFaceBytes = int16Bytes(contract.topology.rawWords);
  if (!rebuiltFaceBytes.equals(expectedFaceBytes)) {
    throw new Error("Exact player_f1 raw words do not round-trip to DATA.OBJ.");
  }
  const rebuiltFaces = Buffer.concat(contract.topology.faces.map((face, faceIndex) => {
    validateFace(face, faceIndex, modelId);
    return int16Bytes(face.rawWords);
  }));
  const rebuiltFaceList = Buffer.concat([int16Bytes([FACE_COUNT]), rebuiltFaces]);
  if (!rebuiltFaceList.equals(expectedFaceBytes)) {
    throw new Error("Exact player_f1 face order or payload changed.");
  }
  assertSha256(rebuiltFaceList, contract.topology.sourceBytesSha256, "prepared player_f1 faces");

  const archive = decodeActuaOffsetArchive({
    dataBytes: requireBytes(euroRendDatBytes, "EUROREND.DAT"),
    indexBytes: requireBytes(euroRendOffBytes, "EUROREND.OFF"),
    label: "EUROREND",
  });
  const expectedPoseBytes = archive.recordBytes(POSE_RECORD_INDEX * 8);
  const rebuiltPoseBytes = Buffer.concat(contract.animation.poses.map((pose, poseIndex) => {
    validatePose(pose, poseIndex);
    return uint32Bytes([pose.pointCountBits, ...pose.coordinateBits]);
  }));
  if (!rebuiltPoseBytes.equals(expectedPoseBytes)) {
    throw new Error("Exact MC_STAND float32 words do not round-trip to EUROREND record 179.");
  }
  assertSha256(rebuiltPoseBytes, contract.animation.sourceBytesSha256, "prepared MC_STAND poses");
  const { contractSha256: _ignored, ...core } = contract;
  if (sha256(Buffer.from(canonicalJson(core))) !== contract.contractSha256) {
    throw new Error("Exact Actua player model contract hash changed.");
  }
  return true;
}

function decodeExactFaces(bytes, modelId = MODEL_ID) {
  if (bytes.readUInt16LE(0) !== FACE_COUNT) {
    throw new Error(`DATA.OBJ ${modelId} has ${bytes.readUInt16LE(0)} faces; expected ${FACE_COUNT}.`);
  }
  const faces = [];
  let offset = 2;
  for (let faceIndex = 0; faceIndex < FACE_COUNT; faceIndex += 1) {
    if (offset + 4 > bytes.length) throw new Error(`player_f1 ends inside face ${faceIndex}.`);
    const primitiveCode = bytes.readInt16LE(offset);
    const sourceColorCode = bytes.readInt16LE(offset + 2);
    const payloadWordCount = primitivePayloadWordCount(primitiveCode, faceIndex);
    const faceByteCount = (2 + payloadWordCount) * 2;
    if (offset + faceByteCount > bytes.length) {
      throw new Error(`player_f1 ends inside face ${faceIndex} payload.`);
    }
    const rawBytes = Buffer.from(bytes.subarray(offset, offset + faceByteCount));
    const rawWords = readInt16Words(rawBytes);
    const payload = rawWords.slice(2);
    const pointIndexCount = primitiveCode === 4 ? 4 : primitiveCode === 0 ? 2 : 3;
    const pointIndexes = payload.slice(0, pointIndexCount);
    if (pointIndexes.some((pointIndex) => pointIndex < 0 || pointIndex >= POINT_COUNT)) {
      throw new Error(`player_f1 face ${faceIndex} references a point outside 0..${POINT_COUNT - 1}.`);
    }
    const face = Object.freeze({
      id: `${modelId}:face-${String(faceIndex).padStart(2, "0")}`,
      faceIndex,
      primitiveCode,
      dispatch: primitiveCode === 4 ? "addpoly" : primitiveCode === 0 ? "add3dcmap" : "add3demap",
      sourceColorCode,
      pointIndexes: Object.freeze(pointIndexes),
      payload: Object.freeze(payload),
      rawWords: Object.freeze(rawWords),
      rawBytesSha256: sha256(rawBytes),
    });
    validateFace(face, faceIndex, modelId);
    faces.push(face);
    offset += faceByteCount;
  }
  if (offset !== bytes.length) throw new Error("player_f1 has trailing or missing face bytes.");
  return { faces: Object.freeze(faces) };
}

function decodeExactPoses(bytes, archiveOffset) {
  return Object.freeze(Array.from({ length: POSE_COUNT }, (_, poseIndex) => {
    const start = poseIndex * POSE_FRAME_BYTES;
    const frame = bytes.subarray(start, start + POSE_FRAME_BYTES);
    const pointCountBits = hex32(frame.readUInt32LE(0));
    if (frame.readFloatLE(0) !== POINT_COUNT) {
      throw new Error(`MC_STAND pose ${poseIndex} point count changed.`);
    }
    const coordinateBits = Object.freeze(Array.from(
      { length: POINT_COUNT * 3 },
      (_, index) => hex32(frame.readUInt32LE(4 + index * 4)),
    ));
    const coordinates = Object.freeze(Array.from(
      { length: POINT_COUNT * 3 },
      (_, index) => frame.readFloatLE(4 + index * 4),
    ));
    if (coordinates.some((value) => !Number.isFinite(value))) {
      throw new Error(`MC_STAND pose ${poseIndex} contains a non-finite float32 coordinate.`);
    }
    const pose = Object.freeze({
      id: `MC_STAND:pose-${String(poseIndex).padStart(2, "0")}`,
      poseIndex,
      pointCount: POINT_COUNT,
      pointCountBits,
      coordinateType: "float32le",
      coordinateBits,
      coordinates,
      sourceByteRange: Object.freeze([archiveOffset + start, archiveOffset + start + POSE_FRAME_BYTES]),
      sourceBytesSha256: sha256(frame),
    });
    validatePose(pose, poseIndex);
    return pose;
  }));
}

function validateFace(face, expectedIndex, modelId = MODEL_ID) {
  const payloadWordCount = primitivePayloadWordCount(face?.primitiveCode, expectedIndex);
  if (
    face?.id !== `${modelId}:face-${String(expectedIndex).padStart(2, "0")}`
    || face?.faceIndex !== expectedIndex
    || face?.rawWords?.length !== payloadWordCount + 2
    || face.rawWords[0] !== face.primitiveCode
    || face.rawWords[1] !== face.sourceColorCode
    || face.payload?.length !== payloadWordCount
    || face.payload.some((word, index) => word !== face.rawWords[index + 2])
  ) {
    throw new Error(`Exact player_f1 face ${expectedIndex} identity, order, or raw payload changed.`);
  }
  const dispatch = face.primitiveCode === 4 ? "addpoly" : face.primitiveCode === 0 ? "add3dcmap" : "add3demap";
  if (face.dispatch !== dispatch) throw new Error(`Exact player_f1 face ${expectedIndex} dispatch changed.`);
  assertSha256(int16Bytes(face.rawWords), face.rawBytesSha256, `prepared player_f1 face ${expectedIndex}`);
}

function validatePose(pose, expectedIndex) {
  if (
    pose?.id !== `MC_STAND:pose-${String(expectedIndex).padStart(2, "0")}`
    || pose?.poseIndex !== expectedIndex
    || pose?.pointCount !== POINT_COUNT
    || pose?.pointCountBits !== "41e00000"
    || pose?.coordinateType !== "float32le"
    || pose?.coordinateBits?.length !== POINT_COUNT * 3
    || pose?.coordinates?.length !== POINT_COUNT * 3
    || pose.coordinateBits.some((word) => !/^[0-9a-f]{8}$/u.test(word))
  ) {
    throw new Error(`Exact MC_STAND pose ${expectedIndex} identity, type, or payload changed.`);
  }
  const bytes = uint32Bytes([pose.pointCountBits, ...pose.coordinateBits]);
  for (let index = 0; index < pose.coordinates.length; index += 1) {
    if (!Object.is(bytes.readFloatLE(4 + index * 4), pose.coordinates[index])) {
      throw new Error(`Exact MC_STAND pose ${expectedIndex} coordinate ${index} changed from its float32 bits.`);
    }
  }
  assertSha256(bytes, pose.sourceBytesSha256, `prepared MC_STAND pose ${expectedIndex}`);
}

function primitivePayloadWordCount(code, faceIndex) {
  if (code === 4) return 4;
  if (code === 0) return 4;
  if (code === -1) return 6;
  throw new Error(`player_f1 face ${faceIndex} has unrecognized primitive code ${code}.`);
}

function readInt16Words(bytes) {
  if (bytes.length % 2 !== 0) throw new Error("Signed-word payload has an odd byte count.");
  return Array.from({ length: bytes.length / 2 }, (_, index) => bytes.readInt16LE(index * 2));
}

function int16Bytes(words) {
  if (!Array.isArray(words) || words.some((word) => !Number.isInteger(word) || word < -32768 || word > 32767)) {
    throw new Error("Signed-word payload changed type or range.");
  }
  const bytes = Buffer.alloc(words.length * 2);
  words.forEach((word, index) => bytes.writeInt16LE(word, index * 2));
  return bytes;
}

function uint32Bytes(words) {
  if (!Array.isArray(words) || words.some((word) => typeof word !== "string" || !/^[0-9a-f]{8}$/u.test(word))) {
    throw new Error("Float32 word payload changed type or format.");
  }
  const bytes = Buffer.alloc(words.length * 4);
  words.forEach((word, index) => bytes.writeUInt32LE(Number.parseInt(word, 16), index * 4));
  return bytes;
}

function hex32(value) {
  return value.toString(16).padStart(8, "0");
}

function requireBytes(value, label) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
    throw new TypeError(`${label} must be a Buffer or Uint8Array.`);
  }
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}

function assertSha256(bytes, expected, label) {
  const actual = sha256(bytes);
  if (actual !== expected) throw new Error(`${label} SHA-256 mismatch: expected ${expected}, got ${actual}.`);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
