import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  decodeActuaOffsetArchive,
  decodeWatcomOmf32Object,
} from "./formatAdapters.mjs";

const sourceDataUrl = new URL(
  "../../../references/spain-argentina-source-data.json",
  import.meta.url,
);
const sourceData = JSON.parse(readFileSync(sourceDataUrl, "utf8"));

export const CSSOCCER_ANIMATION_TABLE_SCHEMA = "cssoccer-animation-table@1";

const PINNED_ACTIONS_CPP = Object.freeze({
  bytes: 133_129,
  sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
});
const PINNED_DATA_OBJECT = Object.freeze({
  bytes: 28_660,
  sha256: "af643e660c93c51d0abe3ee7ef3ac276918fabfd9766af15e309df18776d873b",
});
const PINNED_MCAPS8_SHA256 = "e0c843e3de733391d5ec1b87c6b2cfd3a505d50cbdaa4ce54387958f969f181a";
const COMPILED_SLOT_COUNT = 132;
const POSE_POINT_COUNT = 28;
const POSE_COORDINATE_COUNT = POSE_POINT_COUNT * 3;
const POSE_FRAME_BYTES = (POSE_COORDINATE_COUNT + 1) * 4;
const FIRST_POSE_ARCHIVE_RECORD = 134;
const NON_MATCH_JUGGLE_RECORD = 206;

// Record order is established by the compiled mcaps8 frame counts, the source
// high-detail read order, and exact EUROREND record byte lengths. Record 206 is
// the separate 300-frame model-viewer/juggle payload and is deliberately null.
const POSE_SLOT_BY_ARCHIVE_RECORD = Object.freeze([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30,
  32, 34, 36, 38, 40, 42, 46, 48, 50, 52, 56, 58, 54, 60, 62, 64, 66, 68,
  70, 71, 72, 73, 74, 75, 76, 78, 79, 80, 81, 83, 84, 85, 86, 87, 88, 89,
  90, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 106, 107,
  null,
  111, 109, 110, 108, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122,
  123, 124, 125, 126, 128, 130, 127,
]);

const RETAINED_NATIVE_ANIMATION_IDS = Object.freeze([
  4, 16, 21, 25, 26, 31, 32, 33, 34, 35, 38, 39, 46, 47, 48, 51, 54, 56,
  59, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 74, 78, 84, 85, 90, 92,
  95, 96, 98, 102, 109, 110, 111, 120, 121, 122,
]);

const RETAINED_NATIVE_EVIDENCE = Object.freeze({
  stateArtifactSha256: "c04ec365e835712807f0a6b5fe069e3e3a61e613f035e7624f5dfa2db2f18495",
  streamId: "native-990b15c0109edf8d-argentina-control",
  scenarioId: "990b15c0109edf8d",
  scenarioSha256: "990b15c0109edf8d700cc135fbec29f89c171ce263f04a7aeb257000b7a9dbca",
  profileSha256: "8c1235c635de6d5601aaa3f8436815a765d198cf2195be879efccaee9dcf188f",
  sourceSha256: "136874496399a7acb712b28b6effb53f689c84ca373fb42af67ebf20f3b8cc45",
  buildSha256: "cd06f847e2376951791a68a57fed3c38a13496e801c3dc66e98aa1d9abf9c544",
  contractSha256: "5f9b01bee40e319b611c4f948fadbfd5f7f9a08868bd658c1392dc54abeeab98",
  tickRange: Object.freeze({ start: 0, count: 2725 }),
});

export function parseCssoccerAnimationTable({
  dataHBytes,
  actionsCppBytes,
  dataObjectBytes,
  threeDEngCBytes,
  euroRendDatBytes,
  euroRendOffBytes,
} = {}) {
  const descriptor = sourceData;
  validateDescriptor(descriptor);
  const dataH = readPinnedSource(dataHBytes, "DATA.H", descriptor);
  const threeDEngC = readPinnedSource(threeDEngCBytes, "3DENG.C", descriptor);
  const actionsCpp = readRevisionSource(actionsCppBytes, "ACTIONS.CPP", PINNED_ACTIONS_CPP);
  const dataObjectSource = readRevisionSource(dataObjectBytes, "DATA.OBJ", PINNED_DATA_OBJECT);
  const dataObject = decodeWatcomOmf32Object(dataObjectSource.buffer, { label: "DATA.OBJ" });
  const archive = decodeAndValidateEuroRend({ euroRendDatBytes, euroRendOffBytes, descriptor });
  validateRendererPoseSource(threeDEngC.text);

  const sourceHeaderSlotCount = parseCaptureCount(dataH.text, "NEW");
  if (sourceHeaderSlotCount !== 117) {
    throw new Error("The checked DATA.H NEW macro must retain its stale 117-slot value.");
  }
  const declarations = parseCaptureDeclarations(dataH.text);
  const declarationBySymbol = new Map(declarations.map((declaration) => [declaration.symbol, declaration]));
  if (declarationBySymbol.size !== declarations.length) {
    throw new Error("DATA.H contains duplicate motion-capture symbols.");
  }
  const declarationsById = groupBy(declarations, ({ id }) => id);
  const contacts = parseContactDefinitions(dataH.text);
  const contactBySymbol = new Map(contacts.map((contact) => [contact.symbol, contact]));
  const { actions, contactUses } = parseActionBindings(
    actionsCpp.text,
    declarationBySymbol,
    contactBySymbol,
  );
  const unresolvedActionConstants = parseUnresolvedActionConstants(
    actionsCpp.text,
    declarationBySymbol,
  );

  const compiledTableBytes = dataObject.symbolBytes("mcaps8");
  if (
    compiledTableBytes.length !== COMPILED_SLOT_COUNT * 4
    || sha256(compiledTableBytes) !== PINNED_MCAPS8_SHA256
  ) {
    throw new Error("DATA.OBJ mcaps8 no longer matches the pinned 132-slot compiled table.");
  }
  const compiledSlots = decodeCompiledSlots(compiledTableBytes);
  const poseRecordBySlot = bindPoseRecords({ compiledSlots, archive });
  const actionSymbols = new Set(actions.flatMap(({ animationSymbols }) => animationSymbols));
  const nativeObserved = new Set(RETAINED_NATIVE_ANIMATION_IDS);

  const slots = compiledSlots.map((compiled, id) => {
    const slotDeclarations = declarationsById.get(id) ?? [];
    const declaredFrameCounts = [...new Set(
      slotDeclarations.map(({ declaredCommentFrameCount }) => declaredCommentFrameCount),
    )];
    const actionUseSites = actions
      .flatMap((action) => action.animationUses)
      .filter((use) => use.animationId === id);
    const record = poseRecordBySlot.get(id);
    const mirrorSourceSlotId = mirroredSourceSlotId(id, compiledSlots);
    let posePayload;
    let status;
    let resolvedFrameCount;
    if (record) {
      posePayload = decodePoseRecord({ archive, record, slotId: id, frameCount: compiled.frameCount });
      status = "decoded-source-payload";
      resolvedFrameCount = compiled.frameCount;
    } else if (mirrorSourceSlotId !== null) {
      posePayload = {
        status: "resolved-source-mirror",
        sourceSlotId: mirrorSourceSlotId,
        localCoordinateTransform: { scale: [1, 1, -1], mirroredAxis: "z" },
        faceTopologyVariant: "mirrored",
      };
      status = "resolved-source-mirror";
      resolvedFrameCount = compiledSlots[mirrorSourceSlotId].frameCount;
    } else {
      posePayload = {
        status: "unsupported-zero-frame-compiled-slot",
        selector: null,
        byteRange: null,
      };
      status = "unsupported-zero-frame-compiled-slot";
      resolvedFrameCount = null;
    }
    return {
      id,
      status,
      sourceDeclarationStatus: slotDeclarations.length === 0
        ? "no-checked-source-symbol"
        : slotDeclarations.length === 1
          ? "declared"
          : "aliased-declarations",
      declarations: slotDeclarations,
      declaredFrameCounts,
      compiled,
      resolvedFrameCount,
      referencedByActions: actionUseSites.length > 0,
      observedInRetainedNativeStream: nativeObserved.has(id),
      actionUseSites,
      posePayload,
    };
  });

  const retainedSlots = RETAINED_NATIVE_ANIMATION_IDS.map((id) => slots[id]);
  const unresolvedRetainedSlots = retainedSlots.filter(({ resolvedFrameCount }) => resolvedFrameCount === null);
  if (unresolvedRetainedSlots.length > 0) {
    throw new Error(`Retained native animations did not resolve: ${unresolvedRetainedSlots.map(({ id }) => id).join(", ")}.`);
  }
  const directSlots = slots.filter(({ status }) => status === "decoded-source-payload");
  const mirroredSlots = slots.filter(({ status }) => status === "resolved-source-mirror");
  const unsupportedSlots = slots.filter(({ status }) => status === "unsupported-zero-frame-compiled-slot");
  const aliasSlotIds = slots
    .filter(({ sourceDeclarationStatus }) => sourceDeclarationStatus === "aliased-declarations")
    .map(({ id }) => id);
  const actionReferencedDeclarations = declarations.filter(({ symbol }) => actionSymbols.has(symbol));
  const actionReferencedSlotIds = [...new Set(actionReferencedDeclarations.map(({ id }) => id))]
    .sort((left, right) => left - right);
  const decodedPoseFrames = directSlots.reduce((sum, slot) => sum + slot.resolvedFrameCount, 0);
  const decodedPoseBytes = directSlots.reduce((sum, slot) => sum + slot.posePayload.bytes, 0);
  const decodedPoseCoordinateValues = decodedPoseFrames * POSE_COORDINATE_COUNT;
  const posePayloadSha256 = sha256(Buffer.concat(
    directSlots
      .slice()
      .sort((left, right) => left.posePayload.recordIndex - right.posePayload.recordIndex)
      .map((slot) => archive.recordBytes(slot.posePayload.selector)),
  ));

  return deepFreeze({
    schema: CSSOCCER_ANIMATION_TABLE_SCHEMA,
    fixtureId: descriptor.id,
    sourceRevision: descriptor.source.revision,
    buildAuthority: "DATA.OBJ mcaps8 compiled table plus retained native animation stream",
    counts: {
      slots: slots.length,
      sourceHeaderSlots: sourceHeaderSlotCount,
      declarations: declarations.length,
      declaredSourceSlots: declarationsById.size,
      aliasedSourceSlots: aliasSlotIds.length,
      compiledDirectPoseSlots: directSlots.length,
      mirroredPoseSlots: mirroredSlots.length,
      resolvedPoseSlots: directSlots.length + mirroredSlots.length,
      unsupportedZeroFrameSlots: unsupportedSlots.length,
      decodedPoseFrames,
      decodedPoseCoordinateValues,
      decodedPoseBytes,
      actionBindings: actions.length,
      actionReferencedDeclarations: actionReferencedDeclarations.length,
      actionReferencedSlots: actionReferencedSlotIds.length,
      contactDefinitions: contacts.length,
      rationalContactDefinitions: contacts.filter(({ kind }) => kind === "ratio").length,
      literalContactDefinitions: contacts.filter(({ kind }) => kind === "literal").length,
      actionContactUses: contactUses.length,
      unresolvedActionConstants: unresolvedActionConstants.length,
      retainedNativeAnimationSlots: retainedSlots.length,
      resolvedRetainedNativeAnimationSlots: retainedSlots.length - unresolvedRetainedSlots.length,
    },
    slots,
    actions,
    contacts,
    contactUses,
    unresolvedActionConstants,
    actionReferencedSlotIds,
    retainedNativeAnimations: {
      ids: RETAINED_NATIVE_ANIMATION_IDS,
      evidence: RETAINED_NATIVE_EVIDENCE,
    },
    frameSwapContract: {
      blueprint: "cssQuake prepared animated render bundle frame-style swap",
      pointCount: POSE_POINT_COUNT,
      coordinateStride: 3,
      coordinateType: "float32le",
      topologyStableAcrossFrames: true,
      rootStableAcrossFrames: true,
      runtimeMaySelectPreparedFrame: true,
      runtimeMayCreateNodesOrGeometry: false,
    },
    poseArchive: {
      id: "eurorend",
      firstPoseRecord: FIRST_POSE_ARCHIVE_RECORD,
      finalPoseRecord: FIRST_POSE_ARCHIVE_RECORD + POSE_SLOT_BY_ARCHIVE_RECORD.length - 1,
      mappedMatchRecords: directSlots.length,
      extraRecords: [{
        recordIndex: NON_MATCH_JUGGLE_RECORD,
        selector: NON_MATCH_JUGGLE_RECORD * 8,
        frameCount: archive.recordInfo(NON_MATCH_JUGGLE_RECORD * 8).size / POSE_FRAME_BYTES,
        status: "source-identified-non-match-model-viewer-juggle-payload",
      }],
      decodedMatchPayloadSha256: posePayloadSha256,
      bindingAuthority:
        "compiled mcaps8 frame counts, 3DENG.C high-detail load/mirror order, exact EUROREND record lengths, and retained native animation ids",
    },
    lineage: {
      dataH: { file: "DATA.H", sha256: dataH.sha256 },
      actionsCpp: { file: "ACTIONS.CPP", sha256: actionsCpp.sha256 },
      dataObject: { file: "DATA.OBJ", sha256: dataObjectSource.sha256, mcaps8Sha256: PINNED_MCAPS8_SHA256 },
      threeDEngC: { file: "3DENG.C", sha256: threeDEngC.sha256 },
      euroRend: { file: "EUROREND.DAT", sha256: archive.dataSha256 },
      euroRendIndex: { file: "EUROREND.OFF", sha256: archive.indexSha256 },
    },
    unsupportedClasses: [
      {
        id: "animation-step-and-speed-constants",
        reason:
          "ACTIONS.CPP references frame-step, speed, and distance symbols whose definitions are not retained by DATA.H or the accepted fixture contract.",
        symbols: unresolvedActionConstants.map(({ symbol }) => symbol),
      },
      {
        id: "zero-frame-compiled-motion-capture-slots",
        reason:
          "These compiled ids have neither a high-detail frame payload nor a valid mirrored predecessor.",
        slotIds: unsupportedSlots.map(({ id }) => id),
      },
      {
        id: "compiled-motion-capture-symbol-names",
        reason:
          "DATA.OBJ retains numeric compiled slots 117 through 131, but the checked DATA.H stops naming captures at id 116.",
        slotIds: Array.from({ length: 15 }, (_, index) => index + 117),
      },
    ],
  });
}

function decodeCompiledSlots(bytes) {
  let runtimeFrameOffset = 0;
  return Array.from({ length: COMPILED_SLOT_COUNT }, (_, id) => {
    const capptsInitializer = bytes.readUInt16LE(id * 4);
    const frameCount = bytes.readUInt16LE(id * 4 + 2);
    if (capptsInitializer !== 0) {
      throw new Error(`Compiled mcaps8 slot ${id} has a nonzero pre-runtime cappts initializer.`);
    }
    const result = {
      id,
      capptsInitializer,
      frameCount,
      runtimeFrameOffset,
    };
    runtimeFrameOffset += frameCount;
    return result;
  });
}

function bindPoseRecords({ compiledSlots, archive }) {
  const mapping = new Map();
  const boundRecords = new Set();
  for (let index = 0; index < POSE_SLOT_BY_ARCHIVE_RECORD.length; index += 1) {
    const recordIndex = FIRST_POSE_ARCHIVE_RECORD + index;
    const slotId = POSE_SLOT_BY_ARCHIVE_RECORD[index];
    const record = archive.recordInfo(recordIndex * 8);
    if (slotId === null) {
      if (recordIndex !== NON_MATCH_JUGGLE_RECORD || record.size !== 300 * POSE_FRAME_BYTES) {
        throw new Error("The non-match 300-frame EUROREND payload changed.");
      }
      continue;
    }
    const frameCount = compiledSlots[slotId]?.frameCount;
    if (!frameCount || record.size !== frameCount * POSE_FRAME_BYTES) {
      throw new Error(`EUROREND record ${recordIndex} no longer matches compiled slot ${slotId}.`);
    }
    if (mapping.has(slotId) || boundRecords.has(recordIndex)) {
      throw new Error("Motion-capture slot-to-record mapping is not one-to-one.");
    }
    mapping.set(slotId, record);
    boundRecords.add(recordIndex);
  }
  const nonzeroSlotIds = compiledSlots.filter(({ frameCount }) => frameCount > 0).map(({ id }) => id);
  if (
    mapping.size !== 94
    || nonzeroSlotIds.length !== 94
    || nonzeroSlotIds.some((id) => !mapping.has(id))
  ) {
    throw new Error("Compiled high-detail motion-capture coverage is incomplete.");
  }
  return mapping;
}

function decodePoseRecord({ archive, record, slotId, frameCount }) {
  const payload = archive.recordBytes(record.selector);
  const frames = Array.from({ length: frameCount }, (_, frameIndex) => {
    const relativeStart = frameIndex * POSE_FRAME_BYTES;
    const bytes = payload.subarray(relativeStart, relativeStart + POSE_FRAME_BYTES);
    const pointCount = bytes.readFloatLE(0);
    if (pointCount !== POSE_POINT_COUNT) {
      throw new Error(`Motion-capture slot ${slotId} frame ${frameIndex} changed its point count.`);
    }
    const coordinates = Array.from({ length: POSE_COORDINATE_COUNT }, (_, coordinateIndex) => {
      const value = bytes.readFloatLE(4 + coordinateIndex * 4);
      if (!Number.isFinite(value)) {
        throw new Error(`Motion-capture slot ${slotId} frame ${frameIndex} contains a non-finite coordinate.`);
      }
      return value;
    });
    return {
      index: frameIndex,
      sourceByteRange: [
        record.offset + relativeStart,
        record.offset + relativeStart + POSE_FRAME_BYTES,
      ],
      sha256: sha256(bytes),
      coordinates,
    };
  });
  return {
    status: "decoded-float32-pose-frames",
    archiveId: "eurorend",
    recordIndex: record.recordIndex,
    selector: record.selector,
    byteRange: [record.offset, record.offset + record.size],
    bytes: record.size,
    sha256: sha256(payload),
    pointCount: POSE_POINT_COUNT,
    frameCount,
    frameBytes: POSE_FRAME_BYTES,
    coordinateType: "float32le",
    coordinateOrder: ["x", "y", "z"],
    frames,
  };
}

function mirroredSourceSlotId(id, compiledSlots) {
  if (
    id >= 8
    && id <= 69
    && (id & 1) === 1
    && compiledSlots[id].frameCount === 0
    && compiledSlots[id - 1].frameCount > 0
  ) {
    return id - 1;
  }
  return null;
}

function parseCaptureCount(source, buildSymbol) {
  const lines = source.split(/\r?\n/u);
  let inVariant = false;
  for (const line of lines) {
    if (new RegExp(`^\\s*#ifdef\\s+${buildSymbol}\\s*$`, "u").test(line)) {
      inVariant = true;
      continue;
    }
    if (inVariant) {
      const match = line.match(/^\s*#define\s+MC_NO\s+(\d+)\b/u);
      if (match) return Number(match[1]);
      if (/^\s*#(?:else|endif)\b/u.test(line)) break;
    }
  }
  throw new Error(`DATA.H does not define MC_NO for ${buildSymbol}.`);
}

function parseCaptureDeclarations(source) {
  const declarations = [];
  const lines = source.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(
      /^\s*#define\s+(MC_[A-Z0-9_]+)\s+(\d+)\b.*?\/\/\s*(\d+)\s+Frames\b/u,
    );
    if (!match) continue;
    declarations.push({
      symbol: match[1],
      id: Number(match[2]),
      declaredCommentFrameCount: Number(match[3]),
      source: { file: "DATA.H", line: index + 1 },
    });
  }
  if (declarations.length !== 117) {
    throw new Error(`DATA.H motion-capture declaration count changed: ${declarations.length}.`);
  }
  return declarations;
}

function parseContactDefinitions(source) {
  const contacts = [];
  const lines = source.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(
      /^\s*#define\s+(MCC_[A-Z0-9_]+)\s+(?:\((-?\d+)\.\/(\d+)\)|(-?\d+))\s*$/u,
    );
    if (!match) continue;
    if (match[4] !== undefined) {
      const integer = Number(match[4]);
      contacts.push({
        symbol: match[1],
        kind: "literal",
        integer,
        value: integer,
        source: { file: "DATA.H", line: index + 1 },
      });
    } else {
      const numerator = Number(match[2]);
      const denominator = Number(match[3]);
      contacts.push({
        symbol: match[1],
        kind: "ratio",
        numerator,
        denominator,
        value: numerator / denominator,
        source: { file: "DATA.H", line: index + 1 },
      });
    }
  }
  if (
    contacts.length !== 89
    || contacts.filter(({ kind }) => kind === "ratio").length !== 46
    || contacts.filter(({ kind }) => kind === "literal").length !== 43
  ) {
    throw new Error("DATA.H motion-capture contact table changed.");
  }
  return contacts;
}

function parseActionBindings(source, declarationBySymbol, contactBySymbol) {
  const lines = source.split(/\r?\n/u);
  const functions = [];
  let current = null;
  let braceDepth = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!current) {
      const functionMatch = line.match(
        /^\s*(?:void|int|float|char|short)\s+([A-Za-z_]\w*)\s*\([^;]*\)\s*$/u,
      );
      if (functionMatch) {
        current = {
          id: functionMatch[1],
          sourceStartLine: index + 1,
          animationUses: [],
          contactUses: [],
        };
        braceDepth = 0;
      }
    }
    if (!current) continue;

    for (const symbol of line.match(/\bMC_[A-Z0-9_]+\b/gu) ?? []) {
      const declaration = declarationBySymbol.get(symbol);
      if (!declaration) continue;
      current.animationUses.push({ symbol, animationId: declaration.id, sourceLine: index + 1 });
    }
    for (const symbol of line.match(/\bMCC_[A-Z0-9_]+\b/gu) ?? []) {
      if (!contactBySymbol.has(symbol)) continue;
      current.contactUses.push({ symbol, sourceLine: index + 1 });
    }

    braceDepth += count(line, "{") - count(line, "}");
    if (braceDepth === 0 && line.includes("}")) {
      if (current.animationUses.length > 0 || current.contactUses.length > 0) {
        functions.push({
          id: current.id,
          source: { file: "ACTIONS.CPP", lines: [current.sourceStartLine, index + 1] },
          animationSymbols: [...new Set(current.animationUses.map(({ symbol }) => symbol))],
          animationIds: [...new Set(current.animationUses.map(({ animationId }) => animationId))],
          animationUses: current.animationUses,
          contactSymbols: [...new Set(current.contactUses.map(({ symbol }) => symbol))],
          contactUses: current.contactUses,
        });
      }
      current = null;
    }
  }

  const actions = functions.filter(({ animationUses }) => animationUses.length > 0);
  const contactUses = functions.flatMap((action) => action.contactUses.map((use) => ({
    ...use,
    actionId: action.id,
  })));
  if (actions.length !== 75 || contactUses.length !== 11) {
    throw new Error(
      `ACTIONS.CPP binding counts changed: ${actions.length} animation functions, ${contactUses.length} contact uses.`,
    );
  }
  return { actions, contactUses };
}

function parseUnresolvedActionConstants(source, declarationBySymbol) {
  const lines = source.split(/\r?\n/u);
  const uses = new Map();
  for (let index = 0; index < lines.length; index += 1) {
    for (const symbol of lines[index].match(/\bMC_[A-Z0-9_]+\b/gu) ?? []) {
      if (declarationBySymbol.has(symbol) || !/_(?:FS|SPD|DIST)$/u.test(symbol)) continue;
      const sourceLines = uses.get(symbol);
      if (sourceLines) sourceLines.add(index + 1);
      else uses.set(symbol, new Set([index + 1]));
    }
  }
  const constants = [...uses]
    .map(([symbol, sourceLines]) => ({
      symbol,
      source: { file: "ACTIONS.CPP", lines: [...sourceLines] },
      value: null,
      status: "unsupported-definition-not-retained",
    }))
    .sort((left, right) => left.symbol.localeCompare(right.symbol));
  if (constants.length !== 60) {
    throw new Error(`ACTIONS.CPP unresolved animation constant count changed: ${constants.length}.`);
  }
  return constants;
}

function decodeAndValidateEuroRend({ euroRendDatBytes, euroRendOffBytes, descriptor }) {
  const archiveDescriptor = descriptor.archives.find(({ id }) => id === "eurorend");
  if (!archiveDescriptor) throw new Error("Static source-data is missing EUROREND.");
  const archive = decodeActuaOffsetArchive({
    dataBytes: euroRendDatBytes,
    indexBytes: euroRendOffBytes,
    label: "EUROREND",
  });
  if (
    archive.dataSha256 !== archiveDescriptor.data.sha256
    || archive.indexSha256 !== archiveDescriptor.index.sha256
    || archive.recordCount !== archiveDescriptor.index.records
  ) {
    throw new Error("EUROREND does not match the pinned archive descriptor.");
  }
  return archive;
}

function validateRendererPoseSource(source) {
  for (const [pattern, label] of [
    [/mcaps\s*=\s*mcaps8/u, "compiled high-detail table selection"],
    [/mcaps\[i\]\.cappts=mc_tot/u, "runtime frame offset construction"],
    [/mc_tot\+=mcaps\[i\]\.capfrms/u, "compiled frame-count accumulation"],
    [/an&1\s*&&\s*an>=MC_BFOOTBL\s*&&\s*an<=MC_TROTF/u, "mirrored animation range"],
    [/mc1=&mcaps\[an-1\]/u, "mirrored animation predecessor"],
    [/z=-inpt\[2\]/u, "mirrored local z coordinate"],
  ]) {
    if (!pattern.test(source)) throw new Error(`3DENG.C changed ${label}.`);
  }
}

function validateDescriptor(descriptor) {
  if (
    descriptor?.schema !== "cssoccer-static-source-data@1"
    || descriptor.id !== "spain-argentina-full-match"
    || descriptor.archives?.find(({ id }) => id === "eurorend")?.index?.records !== 229
  ) {
    throw new Error("Animation preparation requires the fixed source and EUROREND descriptors.");
  }
}

function groupBy(values, selector) {
  const groups = new Map();
  for (const value of values) {
    const key = selector(value);
    const group = groups.get(key);
    if (group) group.push(value);
    else groups.set(key, [value]);
  }
  return groups;
}

function count(value, character) {
  return value.split(character).length - 1;
}

function readPinnedSource(value, file, descriptor) {
  const expected = descriptor.source.files.find(({ name }) => name === file);
  if (!expected) throw new Error(`Static source-data does not pin ${file}.`);
  return readRevisionSource(value, file, expected);
}

function readRevisionSource(value, file, expected) {
  const buffer = toBuffer(value, file);
  const digest = sha256(buffer);
  if (buffer.length !== expected.bytes || digest !== expected.sha256) {
    throw new Error(`${file} does not match pinned source revision ${sourceData.source.revision}.`);
  }
  return { buffer, text: buffer.toString("latin1"), sha256: digest };
}

function toBuffer(value, label) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  throw new TypeError(`${label} must be supplied as source bytes.`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
