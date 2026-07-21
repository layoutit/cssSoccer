import { createHash } from "node:crypto";

import { CSSOCCER_ANIMATION_TABLE_SCHEMA } from "./animationTable.mjs";
import { projectExactActuaPlayerCoordinates } from "./actuaNativeProjection.mjs";
import {
  CSSOCCER_SOURCE_PLAYER_MODELS_PREPARATION_SCHEMA,
} from "./actorParser.mjs";
import { CSSOCCER_EXACT_ACTUA_PLAYER_GEOMETRY_SCHEMA } from
  "./exactActuaPlayerGeometry.mjs";
import {
  decodeExactActuaTextureRecord,
  decodeFilterZeroRgbaPng,
  prepareExactActuaOfficialTextureTable,
} from "./exactActuaPlayerTextureCodec.mjs";

export const CSSOCCER_EXACT_ACTUA_OFFICIAL_SOURCE_SCHEMA =
  "cssoccer-exact-actua-official-source@1";
export const CSSOCCER_EXACT_ACTUA_OFFICIAL_GEOMETRY_ID =
  "actua-official-28p-12f-one-basis";

const FACE_COUNT = 12;
const POINT_COUNT = 28;
const TEXTURE_RECORD_BYTES = 32;
const PAGE_SIZE = 256;
const MODEL_IDS = Object.freeze(["player_fr", "player_fl"]);
const SLOT_IDS = Object.freeze([73, 78]);
const FACE_ROLES = Object.freeze([
  "head",
  "shirt-body",
  "left-boot",
  "right-boot",
  "left-shirt-sleeve",
  "left-lower-arm",
  "right-shirt-sleeve",
  "right-lower-arm",
  "left-shorts-thigh",
  "left-lower-leg",
  "right-shorts-thigh",
  "right-lower-leg",
]);
const PROFILE_BY_MODEL = deepFreeze({
  player_fr: {
    id: "actua-referee-material",
    role: "referee",
    nativeRenderType: 3,
    nativeRendererIndexes: [22],
  },
  player_fl: {
    id: "actua-assistant-referee-material",
    role: "assistant-referee",
    nativeRenderType: 4,
    nativeRendererIndexes: [23, 24],
  },
});
const EXPECTED_MODEL_SHA256 = Object.freeze({
  player_fr: "3ea6412271f4a47fc517bc8df2bcfdb928537ebc52d320f371742e12abdc952b",
  player_fl: "4bf2687745c26788d05c61fc6394504c42bbf9d423c325fec2fab95a600d8fcc",
});
const PINNED_3DENG_SHA256 =
  "9a9f29dcc2fa984bac746c885810e5b32ccee421448272534bc81469a0c4991b";
const PINNED_3D_UPD2_SHA256 =
  "af2009e0787951cb3d7471cef1fb307598069e80f3fa558d4c5dd72026c36714";

/** Prove the complete source, geometry, material, and pose domain for all officials. */
export function prepareCssoccerExactActuaOfficialSource({
  animationTable,
  playerGeometry,
  sourcePlayerModelsPreparation,
  actRendDatBytes,
  actRendOffBytes,
  retailActRendDatBytes,
  retailActRendOffBytes,
  sourceAtlasPngBytes,
  officialSourceAtlas,
  threeDEngCBytes,
  threeDUpd2Bytes,
} = {}) {
  assertInputs({
    animationTable,
    playerGeometry,
    sourcePlayerModelsPreparation,
    officialSourceAtlas,
  });
  assertNativeBindings(threeDEngCBytes, threeDUpd2Bytes);
  const models = Object.fromEntries(MODEL_IDS.map((modelId) => {
    const model = sourcePlayerModelsPreparation.models[modelId];
    if (
      model?.pointCount !== POINT_COUNT
      || model.sourceFaceList?.faceCount !== FACE_COUNT
      || model.sourcePrimitives?.length !== FACE_COUNT
      || model.sourceFaceList.sha256 !== EXPECTED_MODEL_SHA256[modelId]
    ) throw new Error(`${modelId} is not the pinned exact official model.`);
    return [modelId, model];
  }));
  const geometryFaces = models.player_fr.sourcePrimitives.map(normalizeGeometryFace);
  const assistantGeometryFaces = models.player_fl.sourcePrimitives.map(normalizeGeometryFace);
  if (canonicalJson(assistantGeometryFaces) !== canonicalJson(geometryFaces)) {
    throw new Error("player_fr and player_fl do not share one exact official geometry basis.");
  }
  if (canonicalJson(geometryFaces) === canonicalJson(playerGeometry.geometry.faces.slice(0, 12))) {
    throw new Error("Exact official geometry unexpectedly collapsed into the outfield-player basis.");
  }
  const topologyCore = {
    geometryId: CSSOCCER_EXACT_ACTUA_OFFICIAL_GEOMETRY_ID,
    pointCount: POINT_COUNT,
    faceCount: FACE_COUNT,
    faceOrder: Array.from({ length: FACE_COUNT }, (_, index) => index),
    faces: geometryFaces,
    leafBasis: {
      tagName: "s",
      stableLeafCount: FACE_COUNT,
      stableLeafOrder: "source face index 0..11",
      runtimeNodeCreation: false,
      runtimeGeometryConstruction: false,
    },
  };
  const topologySha256 = sha256(Buffer.from(canonicalJson(topologyCore)));
  const selectorOffsetsByFace = collectSelectorOffsets({
    animationTable,
    topology: {
      pointCount: POINT_COUNT,
      faceCount: FACE_COUNT,
      faces: geometryFaces.map((face) => ({
        faceIndex: face.faceIndex,
        primitiveCode: face.primitiveCode,
        dispatch: face.dispatch,
        pointIndexes: face.pointIndexes,
        payload: [...face.pointIndexes, ...face.primitiveParameters],
      })),
    },
  });
  const textureTable = prepareExactActuaOfficialTextureTable({
    actRendDatBytes,
    actRendOffBytes,
    retailActRendDatBytes,
    retailActRendOffBytes,
  });
  const sourceAtlasBytes = requireBytes(sourceAtlasPngBytes, "match source atlas");
  const sourceAtlas = decodeFilterZeroRgbaPng(sourceAtlasBytes);
  const extendedAtlasBytes = requireBytes(officialSourceAtlas.pngBytes, "official source atlas");
  const extendedAtlas = decodeFilterZeroRgbaPng(extendedAtlasBytes);
  const extendedPageByNativePage = new Map(
    officialSourceAtlas.metadata.nativePages.map(({ nativePage, atlasPage }) => (
      [nativePage, atlasPage]
    )),
  );
  if (
    sourceAtlas.width !== 2_048
    || sourceAtlas.height !== PAGE_SIZE
    || extendedAtlas.width !== 512
    || extendedAtlas.height !== PAGE_SIZE
    || extendedPageByNativePage.size !== 2
  ) throw new Error("Exact official source-atlas dimensions changed.");

  const materialProfiles = Object.fromEntries(MODEL_IDS.map((modelId) => {
    const profile = PROFILE_BY_MODEL[modelId];
    const faces = models[modelId].sourcePrimitives.map((face, faceIndex) => {
      const selectorOffsets = selectorOffsetsByFace[faceIndex];
      if (selectorOffsets.length === 0) throw new Error(`${modelId} face ${faceIndex} is never visible.`);
      const authoredNativeTextureSlot = face.sourceBinding.authoredNativeTextureSlot;
      return {
        faceIndex,
        semanticRole: FACE_ROLES[faceIndex],
        sourceColorCode: face.sourceColorCode,
        authoredNativeTextureSlot,
        selectorOffsets,
        slotsBySelectorOffset: Object.fromEntries(selectorOffsets.map((offset) => [
          offset,
          nativeTextureSlot(face.sourceColorCode + offset),
        ])),
      };
    });
    return [profile.id, {
      ...profile,
      sourceModelSymbol: modelId,
      geometryId: CSSOCCER_EXACT_ACTUA_OFFICIAL_GEOMETRY_ID,
      topologySha256,
      faces,
    }];
  }));
  const requiredSlots = [...new Set(Object.values(materialProfiles).flatMap(({ faces }) => (
    faces.flatMap(({ slotsBySelectorOffset }) => Object.values(slotsBySelectorOffset))
  )))].sort((left, right) => left - right);
  const textureProof = requiredSlots.map((nativeTextureSlot) => {
    const recordBytes = textureTable.subarray(
      (nativeTextureSlot - 1) * TEXTURE_RECORD_BYTES,
      nativeTextureSlot * TEXTURE_RECORD_BYTES,
    );
    const record = decodeExactActuaTextureRecord(nativeTextureSlot, recordBytes);
    const source = sourcePage(record.page, {
      sourceAtlas,
      extendedAtlas,
      extendedPageByNativePage,
    });
    const crop = cropRgba(source.rgba, source.width, {
      x: source.x + record.sourceRect.x,
      y: record.sourceRect.y,
      width: record.sourceRect.width,
      height: record.sourceRect.height,
    });
    let opaquePixels = 0;
    for (let offset = 3; offset < crop.length; offset += 4) {
      if (crop[offset] !== 0) opaquePixels += 1;
    }
    if (opaquePixels === 0) {
      throw new Error(`Exact official texture slot ${nativeTextureSlot} has no source pixels.`);
    }
    return {
      nativeTextureSlot,
      nativePage: record.page,
      sourceRect: record.sourceRect,
      textureRecordSha256: sha256(recordBytes),
      sourceCropRgbaSha256: sha256(crop),
      opaquePixels,
    };
  });
  const animations = SLOT_IDS.map((slotId) => {
    const slot = animationTable.slots[slotId];
    if (
      slot?.id !== slotId
      || !Number.isSafeInteger(slot.resolvedFrameCount)
      || slot.resolvedFrameCount <= 0
      || slot.posePayload?.frames?.length !== slot.resolvedFrameCount
    ) throw new Error(`Exact official animation slot ${slotId} is unavailable.`);
    return {
      slotId,
      symbol: slot.symbol,
      sourceSlotId: slot.posePayload.sourceSlotId,
      frameCount: slot.resolvedFrameCount,
      frameSha256: slot.posePayload.frames.map(({ sha256: frameSha256 }) => frameSha256),
    };
  });
  if (animations[0].frameCount !== 29 || animations[1].frameCount !== 39) {
    throw new Error("Exact official MC_JOG/MC_STAND frame counts changed.");
  }
  const core = {
    schema: CSSOCCER_EXACT_ACTUA_OFFICIAL_SOURCE_SCHEMA,
    status: "ready-exact-referee-and-two-assistants",
    fixtureId: "spain-argentina-full-match",
    geometry: { ...topologyCore, topologySha256 },
    materialProfiles,
    materialProfileBySourceModel: {
      player_fr: PROFILE_BY_MODEL.player_fr.id,
      player_fl: PROFILE_BY_MODEL.player_fl.id,
    },
    animations,
    counts: {
      officials: 3,
      sourceModels: 2,
      facesPerOfficial: FACE_COUNT,
      animationSequences: animations.length,
      poseOccurrences: animations.reduce((sum, animation) => sum + animation.frameCount, 0),
      yawBins: 24,
      requiredTextureSlots: requiredSlots.length,
      provenTextureCrops: textureProof.length,
    },
    texture: {
      requiredSlots,
      proofSha256: sha256(Buffer.from(canonicalJson(textureProof))),
      textureTableSha256: sha256(textureTable),
      textureTableRecords: textureTable.length / TEXTURE_RECORD_BYTES,
      matchSourceAtlasSha256: sha256(sourceAtlasBytes),
      officialSourceAtlasSha256: sha256(extendedAtlasBytes),
      nativePages: [...new Set(textureProof.map(({ nativePage }) => nativePage))].sort((a, b) => a - b),
      missingTexturePolicy: "reject",
    },
    lineage: {
      sourceRevision: "b40bd6d1e50e052030c5f0884fbe3deda7e9fa4b",
      sourceTopologySha256ByModel: Object.fromEntries(MODEL_IDS.map((modelId) => [
        modelId,
        models[modelId].sourceFaceList.sha256,
      ])),
      nativeRoleBindings: [
        { nativeRendererIndex: 22, modelId: "player_fr", nativeRenderType: 3 },
        { nativeRendererIndex: 23, modelId: "player_fl", nativeRenderType: 4 },
        { nativeRendererIndex: 24, modelId: "player_fl", nativeRenderType: 4 },
      ],
      threeDEngSha256: PINNED_3DENG_SHA256,
      threeDUpd2Sha256: PINNED_3D_UPD2_SHA256,
    },
    runtime: {
      sourceParsing: false,
      geometryConstruction: false,
      materialConstruction: false,
      missingStatePolicy: "reject",
    },
  };
  return deepFreeze({
    ...core,
    contractSha256: sha256(Buffer.from(canonicalJson(core))),
  });
}

function collectSelectorOffsets({ animationTable, topology }) {
  const sets = Array.from({ length: FACE_COUNT }, () => new Set());
  let preparedPoseIndex = 0;
  for (const slotId of SLOT_IDS) {
    const slot = animationTable.slots[slotId];
    for (const frame of slot.posePayload.frames) {
      for (let yawIndex = 0; yawIndex < 24; yawIndex += 1) {
        const sample = projectExactActuaPlayerCoordinates({
          topology,
          coordinates: frame.coordinates,
          preparedPoseIndex,
          yawDegrees: yawIndex * 15,
          sourcePoseBitsSha256: frame.sha256,
        });
        for (const face of sample.faces) {
          if (face.visible) sets[face.faceIndex].add(face.materialSelectorOffset);
        }
      }
      preparedPoseIndex += 1;
    }
  }
  if (preparedPoseIndex !== 68) throw new Error("Exact official pose occurrence count changed.");
  return sets.map((set) => [...set].sort((left, right) => left - right));
}

function nativeTextureSlot(colorCode) {
  return colorCode < -2000 ? -colorCode - 2000 : -colorCode;
}

function assertInputs({
  animationTable,
  playerGeometry,
  sourcePlayerModelsPreparation,
  officialSourceAtlas,
}) {
  if (animationTable?.schema !== CSSOCCER_ANIMATION_TABLE_SCHEMA) {
    throw new Error("Exact officials require the pinned animation table.");
  }
  if (
    playerGeometry?.schema !== CSSOCCER_EXACT_ACTUA_PLAYER_GEOMETRY_SCHEMA
    || playerGeometry.geometry?.pointCount !== POINT_COUNT
  ) throw new Error("Exact officials require the checked player geometry comparison basis.");
  if (
    sourcePlayerModelsPreparation?.schema
      !== CSSOCCER_SOURCE_PLAYER_MODELS_PREPARATION_SCHEMA
    || sourcePlayerModelsPreparation.status !== "ready-exact-source-primitive-contract"
  ) throw new Error("Exact officials require the decoded source model contract.");
  if (
    officialSourceAtlas?.metadata?.schema !== "cssoccer-exact-official-source-atlas@1"
    || officialSourceAtlas.metadata.status !== "ready-source-pages-13-14"
  ) throw new Error("Exact officials require prepared native pages 13 and 14.");
}

function assertNativeBindings(threeDEngCBytes, threeDUpd2Bytes) {
  const engine = requireBytes(threeDEngCBytes, "3DENG.C");
  const update = requireBytes(threeDUpd2Bytes, "3D_UPD2.CPP");
  if (sha256(engine) !== PINNED_3DENG_SHA256) throw new Error("3DENG.C changed.");
  if (sha256(update) !== PINNED_3D_UPD2_SHA256) throw new Error("3D_UPD2.CPP changed.");
  const engineText = engine.toString("latin1");
  const updateText = update.toString("latin1");
  if (!/initobj\(&player\[22\],player_p\[0\],player_fr[\s\S]*initobj\(&player\[23\],player_p\[0\],player_fl[\s\S]*initobj\(&player\[24\],player_p\[0\],player_fl/u.test(engineText)) {
    throw new Error("Native official model bindings changed.");
  }
  if (!/if \(i==players\)[\s\S]*ptr->type=3; \/\/referee colour[\s\S]*ptr->type=4; \/\/linesman colour/u.test(updateText)) {
    throw new Error("Native official render-type bindings changed.");
  }
}

function normalizeGeometryFace(face, faceIndex) {
  if (
    face?.faceIndex !== faceIndex
    || FACE_ROLES[faceIndex] === undefined
    || !Array.isArray(face.pointIndexes)
    || !Array.isArray(face.payload)
  ) throw new Error(`Exact official geometry face ${faceIndex} is invalid.`);
  return {
    faceIndex,
    leafId: `actua-official-face-${String(faceIndex).padStart(2, "0")}`,
    semanticRole: FACE_ROLES[faceIndex],
    primitiveCode: face.primitiveCode,
    dispatch: face.sourceBinding.nativeDispatch,
    pointIndexes: [...face.pointIndexes],
    primitiveParameters: face.payload.slice(face.pointIndexes.length),
  };
}

function sourcePage(nativePage, {
  sourceAtlas,
  extendedAtlas,
  extendedPageByNativePage,
}) {
  if (nativePage >= 0 && nativePage < 7) {
    return { rgba: sourceAtlas.rgba, width: sourceAtlas.width, x: nativePage * PAGE_SIZE };
  }
  const atlasPage = extendedPageByNativePage.get(nativePage);
  if (!Number.isSafeInteger(atlasPage)) {
    throw new Error(`Exact official native page ${nativePage} is unavailable.`);
  }
  return { rgba: extendedAtlas.rgba, width: extendedAtlas.width, x: atlasPage * PAGE_SIZE };
}

function cropRgba(source, sourceWidth, { x, y, width, height }) {
  if (x < 0 || y < 0 || width <= 0 || height <= 0
      || x + width > sourceWidth || (y + height) * sourceWidth * 4 > source.length) {
    throw new Error("Exact official source crop exceeds its prepared atlas.");
  }
  const output = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    source.copy(
      output,
      row * width * 4,
      ((y + row) * sourceWidth + x) * 4,
      ((y + row) * sourceWidth + x + width) * 4,
    );
  }
  return output;
}

function requireBytes(value, label) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
    throw new TypeError(`${label} bytes are required.`);
  }
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
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
