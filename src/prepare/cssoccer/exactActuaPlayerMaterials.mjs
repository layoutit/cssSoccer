import { createHash } from "node:crypto";

import {
  decodeExactActuaTextureRecord,
  decodeFilterZeroRgbaPng,
  encodeRgbaPng,
  prepareExactActuaPlayerTextureTable,
} from "./exactActuaPlayerTextureCodec.mjs";
import { CSSOCCER_EXACT_ACTUA_PLAYER_GEOMETRY_SCHEMA } from
  "./exactActuaPlayerGeometry.mjs";
import {
  CSSOCCER_EXACT_ACTUA_PLAYER_LEAF_RASTER,
  prepareCssoccerExactActuaPlayerViews,
} from
  "./exactActuaPlayerViews.mjs";

export const CSSOCCER_EXACT_ACTUA_PLAYER_MATERIALS_SCHEMA =
  "cssoccer-exact-actua-player-materials@1";

const TEXTURE_RECORD_BYTES = 32;
const SOURCE_PAGE_SIZE = 256;
const NORMALIZED_WIDTH = 32;
const NORMALIZED_HEIGHT = 64;
const GUTTER = 1;
const CELL_WIDTH = NORMALIZED_WIDTH + GUTTER * 2;
const CELL_HEIGHT = NORMALIZED_HEIGHT + GUTTER * 2;
const ATLAS_COLUMNS = 32;
const ASSET_PATH = "assets/textures/spain-argentina-exact-player-materials.png";
const ASSET_URL = `/cssoccer/${ASSET_PATH}`;
const BOOT_FACE_INDEXES = new Set([2, 3]);

/** Prepare every view-selected team texture and fixture number once. */
export function prepareCssoccerExactActuaPlayerMaterials({
  animationTable,
  sequences,
  geometry,
  actRendDatBytes,
  actRendOffBytes,
  retailActRendDatBytes,
  retailActRendOffBytes,
  sourceAtlasPngBytes,
} = {}) {
  if (
    geometry?.schema !== CSSOCCER_EXACT_ACTUA_PLAYER_GEOMETRY_SCHEMA
    || geometry.geometry?.faceCount !== 13
  ) throw new Error("Exact Actua materials require the one-basis geometry contract.");
  const selectorOffsetsByFace = Array.from({ length: 13 }, () => new Set());
  const views = prepareCssoccerExactActuaPlayerViews({
    animationTable,
    sequences,
    geometry,
    onSample(sample) {
      sample.faces.forEach((face) => {
        if (face.visibility === "visible") {
          selectorOffsetsByFace[face.faceIndex].add(face.materialSelectorOffset);
        }
      });
    },
  });
  const textureTable = prepareExactActuaPlayerTextureTable({
    actRendDatBytes,
    actRendOffBytes,
    retailActRendDatBytes,
    retailActRendOffBytes,
  });
  const sourceAtlasBytes = requireBytes(sourceAtlasPngBytes, "exact player source atlas");
  const sourceAtlas = decodeFilterZeroRgbaPng(sourceAtlasBytes);
  if (sourceAtlas.width !== 2048 || sourceAtlas.height !== 256) {
    throw new Error("Exact player source atlas dimensions changed.");
  }

  const profilePlans = Object.values(geometry.materialProfiles).map((profile) => {
    const faces = profile.bindings.map((binding) => {
      if (binding.faceIndex === 12) {
        return {
          faceIndex: 12,
          semanticRole: binding.semanticRole,
          baseSourceColorCode: binding.sourceColorCode,
          selectorOffsets: [0],
          slotsBySelectorOffset: { 0: null },
        };
      }
      const selectorOffsets = [...selectorOffsetsByFace[binding.faceIndex]]
        .sort((left, right) => left - right);
      if (selectorOffsets.length === 0) {
        throw new Error(`${profile.id} face ${binding.faceIndex} has no visible material selector.`);
      }
      return {
        faceIndex: binding.faceIndex,
        semanticRole: binding.semanticRole,
        baseSourceColorCode: binding.sourceColorCode,
        selectorOffsets,
        slotsBySelectorOffset: Object.fromEntries(selectorOffsets.map((offset) => [
          offset,
          nativeTextureSlot(binding.sourceColorCode + offset),
        ])),
      };
    });
    const numberBaseSlot = profile.country === "spain" ? 549 : 564;
    const shirtNumbers = Object.fromEntries(Array.from({ length: 15 }, (_, index) => [
      index + 1,
      numberBaseSlot + index,
    ]));
    return { profile, faces, shirtNumbers };
  });
  const requiredSlots = new Set();
  const bootSlots = new Set();
  const nonBootSlots = new Set();
  for (const plan of profilePlans) {
    for (const face of plan.faces) {
      for (const slot of Object.values(face.slotsBySelectorOffset)) {
        if (slot === null) continue;
        requiredSlots.add(slot);
        (BOOT_FACE_INDEXES.has(face.faceIndex) ? bootSlots : nonBootSlots).add(slot);
      }
    }
    for (const slot of Object.values(plan.shirtNumbers)) requiredSlots.add(slot);
  }
  if (
    bootSlots.size !== 60
    || Math.min(...bootSlots) !== 297
    || Math.max(...bootSlots) !== 356
    || [...bootSlots].some((slot) => nonBootSlots.has(slot))
  ) throw new Error("Exact player boot material slot domain changed.");
  const orderedSlots = [...requiredSlots].sort((left, right) => left - right);
  if (
    orderedSlots.length !== 386
    || orderedSlots[0] !== 1
    || orderedSlots[355] !== 356
    || orderedSlots[356] !== 549
    || orderedSlots.at(-1) !== 578
  ) throw new Error("Exact player complete material slot domain changed.");

  const atlasRows = Math.ceil(orderedSlots.length / ATLAS_COLUMNS);
  const atlasWidth = ATLAS_COLUMNS * CELL_WIDTH;
  const atlasHeight = atlasRows * CELL_HEIGHT;
  const atlasRgba = Buffer.alloc(atlasWidth * atlasHeight * 4);
  const entries = orderedSlots.map((nativeTextureSlotValue, entryIndex) => {
    const recordBytes = textureTable.subarray(
      (nativeTextureSlotValue - 1) * TEXTURE_RECORD_BYTES,
      nativeTextureSlotValue * TEXTURE_RECORD_BYTES,
    );
    const record = decodeExactActuaTextureRecord(nativeTextureSlotValue, recordBytes);
    const sourceX = record.page * SOURCE_PAGE_SIZE + record.sourceRect.x;
    const sourceY = record.sourceRect.y;
    if (
      sourceX < 0
      || sourceY < 0
      || sourceX + record.sourceRect.width > sourceAtlas.width
      || sourceY + record.sourceRect.height > sourceAtlas.height
    ) throw new Error(`Exact player material slot ${nativeTextureSlotValue} exceeds its source atlas.`);
    const column = entryIndex % ATLAS_COLUMNS;
    const row = Math.floor(entryIndex / ATLAS_COLUMNS);
    const targetX = column * CELL_WIDTH + GUTTER;
    const targetY = row * CELL_HEIGHT + GUTTER;
    const oriented = orientedSourceCrop({
      source: sourceAtlas.rgba,
      sourceWidth: sourceAtlas.width,
      sourceX,
      sourceY,
      width: record.sourceRect.width,
      height: record.sourceRect.height,
      projectedCornerBySourceCorner: record.projectedCornerBySourceCorner,
    });
    const normalizedSource = oriented;
    blitNearestNormalized({
      source: normalizedSource.rgba,
      sourceWidth: normalizedSource.width,
      sourceHeight: normalizedSource.height,
      target: atlasRgba,
      targetWidth: atlasWidth,
      targetX,
      targetY,
    });
    const presentation = {
      backgroundPositionX: `${formatNumber(-targetX)}px`,
      backgroundPositionY: `${formatNumber(-targetY)}px`,
    };
    return {
      entryIndex,
      id: `native-player-texture-${String(nativeTextureSlotValue).padStart(3, "0")}`,
      nativeTextureSlot: nativeTextureSlotValue,
      sourceColorCode: -2000 - nativeTextureSlotValue,
      sourcePage: record.page,
      sourceRect: record.sourceRect,
      projectedCornerBySourceCorner: record.projectedCornerBySourceCorner,
      normalizedCornerOrder: [0, 1, 2, 3],
      orientation: oriented.orientation,
      presentation: { kind: "source-rgba-nearest" },
      textureRecordSha256: sha256(recordBytes),
      normalizedRgbaSha256: normalizedCellSha256(
        atlasRgba,
        atlasWidth,
        targetX,
        targetY,
      ),
      atlasCell: {
        column,
        row,
        x: column * CELL_WIDTH,
        y: row * CELL_HEIGHT,
        width: CELL_WIDTH,
        height: CELL_HEIGHT,
        cropX: targetX,
        cropY: targetY,
        cropWidth: NORMALIZED_WIDTH,
        cropHeight: NORMALIZED_HEIGHT,
        ...presentation,
      },
    };
  });
  const entryBySlot = new Map(entries.map((entry) => [entry.nativeTextureSlot, entry]));
  const backgroundSize = `${formatNumber(atlasWidth)}px ${formatNumber(atlasHeight)}px`;
  const materialProfiles = Object.fromEntries(profilePlans.map(({ profile, faces, shirtNumbers }) => [
    profile.id,
    {
      id: profile.id,
      country: profile.country,
      geometryId: geometry.geometry.geometryId,
      topologySha256: geometry.geometry.topologySha256,
      atlasUrl: ASSET_URL,
      invariantLeafStyle: {
        width: `${CSSOCCER_EXACT_ACTUA_PLAYER_LEAF_RASTER.width}px`,
        height: `${CSSOCCER_EXACT_ACTUA_PLAYER_LEAF_RASTER.height}px`,
        backgroundImage: `url("${ASSET_URL}")`,
        backgroundSize,
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
        transformOrigin: "0 0",
      },
      faces: faces.map((face) => ({
        ...face,
        slotsBySelectorOffset: Object.fromEntries(Object.entries(face.slotsBySelectorOffset)
          .map(([offset, slot]) => [offset, slot === null ? null : materialBinding(entryBySlot, slot)])),
      })),
      shirtNumbers: {
        faceIndex: 12,
        supported: Object.keys(shirtNumbers).map(Number),
        byPlayerNumber: Object.fromEntries(Object.entries(shirtNumbers).map(([number, slot]) => [
          number,
          materialBinding(entryBySlot, slot),
        ])),
      },
    },
  ]));
  const fixturePlayers = Object.freeze(["spain", "argentina"].flatMap((country, teamIndex) => {
    const profileId = `${country}-player-material`;
    return Array.from({ length: 11 }, (_, index) => ({
      nativeRuntimeIndex: teamIndex * 11 + index,
      country,
      playerNumber: index + 1,
      materialProfileId: profileId,
      numberBinding: materialProfiles[profileId].shirtNumbers.byPlayerNumber[index + 1],
      geometryId: geometry.geometry.geometryId,
      topologySha256: geometry.geometry.topologySha256,
    }));
  }));
  const pngBytes = encodeRgbaPng(atlasWidth, atlasHeight, atlasRgba);
  const atlas = {
    path: ASSET_PATH,
    url: ASSET_URL,
    mediaType: "image/png",
    width: atlasWidth,
    height: atlasHeight,
    bytes: pngBytes.length,
    sha256: sha256(pngBytes),
    rgbaSha256: sha256(atlasRgba),
    sourceTextureEntries: entries.length,
    normalizedWidth: NORMALIZED_WIDTH,
    normalizedHeight: NORMALIZED_HEIGHT,
    transparentGutter: GUTTER,
    backgroundSize,
    requestCount: 1,
    runtimeImageConstruction: false,
  };
  const core = {
    schema: CSSOCCER_EXACT_ACTUA_PLAYER_MATERIALS_SCHEMA,
    status: "ready-complete-two-profile-normalized-atlas",
    fixtureId: "spain-argentina-full-match",
    geometryId: geometry.geometry.geometryId,
    topologySha256: geometry.geometry.topologySha256,
    viewContractSha256: views.contractSha256,
    counts: {
      profiles: 2,
      fixturePlayers: fixturePlayers.length,
      faceBindingsPerProfile: 13,
      supportedNumbersPerProfile: 15,
      textureEntries: entries.length,
      selectorOffsetsByFace: selectorOffsetsByFace.map((offsets) => offsets.size),
    },
    atlas,
    entries,
    materialProfiles,
    fixturePlayers,
    source: {
      sourceAtlasSha256: sha256(sourceAtlasBytes),
      textureTableSha256: sha256(textureTable),
      numberTextureSlots: [549, 578],
      normalizedAtPrepareTime: true,
      bootTextures: {
        faceIndexes: [...BOOT_FACE_INDEXES],
        nativeTextureSlots: [Math.min(...bootSlots), Math.max(...bootSlots)],
        sourceRgbaPreserved: true,
        presentationOverride: false,
      },
    },
    runtime: {
      geometryMutation: false,
      matrixMutationByMaterial: false,
      atlasConstruction: false,
      missingMaterialPolicy: "reject",
      missingNumberPolicy: "reject",
    },
  };
  return Object.freeze({
    publication: deepFreeze({
      ...core,
      contractSha256: sha256(Buffer.from(canonicalJson(core))),
    }),
    assetFile: Object.freeze({
      path: ASSET_PATH,
      mediaType: "image/png",
      bytes: pngBytes,
      expectedSha256: atlas.sha256,
    }),
  });
}

function materialBinding(entryBySlot, slot) {
  const entry = entryBySlot.get(slot);
  if (!entry) throw new Error(`Exact player texture slot ${slot} has no normalized atlas entry.`);
  return {
    nativeTextureSlot: slot,
    atlasEntryId: entry.id,
    backgroundPositionX: entry.atlasCell.backgroundPositionX,
    backgroundPositionY: entry.atlasCell.backgroundPositionY,
  };
}

function orientedSourceCrop({
  source,
  sourceWidth,
  sourceX,
  sourceY,
  width,
  height,
  projectedCornerBySourceCorner,
}) {
  if (
    !Array.isArray(projectedCornerBySourceCorner)
    || projectedCornerBySourceCorner.length !== 4
    || new Set(projectedCornerBySourceCorner).size !== 4
  ) throw new Error("Exact player material has an invalid source-corner mapping.");
  const sourceCorners = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const sourceCornerForOutput = [0, 1, 2, 3].map((outputCorner) => (
    sourceCorners[projectedCornerBySourceCorner.indexOf(outputCorner)]
  ));
  const [topLeft, topRight, , bottomLeft] = sourceCornerForOutput;
  const outputWidth = topLeft[0] !== topRight[0] ? width : height;
  const outputHeight = topLeft[1] !== bottomLeft[1] ? height : width;
  const rgba = Buffer.alloc(outputWidth * outputHeight * 4);
  for (let y = 0; y < outputHeight; y += 1) {
    for (let x = 0; x < outputWidth; x += 1) {
      const nx = outputWidth === 1 ? 0 : x / (outputWidth - 1);
      const ny = outputHeight === 1 ? 0 : y / (outputHeight - 1);
      const sourceU = topLeft[0]
        + nx * (topRight[0] - topLeft[0])
        + ny * (bottomLeft[0] - topLeft[0]);
      const sourceV = topLeft[1]
        + nx * (topRight[1] - topLeft[1])
        + ny * (bottomLeft[1] - topLeft[1]);
      const sx = sourceX + Math.round(sourceU * (width - 1));
      const sy = sourceY + Math.round(sourceV * (height - 1));
      const sourceOffset = (sy * sourceWidth + sx) * 4;
      const targetOffset = (y * outputWidth + x) * 4;
      source.copy(rgba, targetOffset, sourceOffset, sourceOffset + 4);
    }
  }
  return {
    width: outputWidth,
    height: outputHeight,
    rgba,
    orientation: {
      sourceCornerForNormalizedCorner: projectedCornerBySourceCorner
        .map((_value, sourceCorner) => sourceCorner)
        .sort((left, right) => (
          projectedCornerBySourceCorner[left] - projectedCornerBySourceCorner[right]
        )),
      sourceDimensions: [width, height],
      orientedDimensions: [outputWidth, outputHeight],
    },
  };
}

function blitNearestNormalized({
  source,
  sourceWidth,
  sourceHeight,
  target,
  targetWidth,
  targetX,
  targetY,
}) {
  for (let y = 0; y < NORMALIZED_HEIGHT; y += 1) {
    const sourceY = Math.min(
      sourceHeight - 1,
      Math.floor((y + 0.5) * sourceHeight / NORMALIZED_HEIGHT),
    );
    for (let x = 0; x < NORMALIZED_WIDTH; x += 1) {
      const sourceX = Math.min(
        sourceWidth - 1,
        Math.floor((x + 0.5) * sourceWidth / NORMALIZED_WIDTH),
      );
      const sourceOffset = (sourceY * sourceWidth + sourceX) * 4;
      const targetOffset = ((targetY + y) * targetWidth + targetX + x) * 4;
      source.copy(target, targetOffset, sourceOffset, sourceOffset + 4);
    }
  }
}

function normalizedCellSha256(rgba, width, x, y) {
  const bytes = Buffer.alloc(NORMALIZED_WIDTH * NORMALIZED_HEIGHT * 4);
  for (let row = 0; row < NORMALIZED_HEIGHT; row += 1) {
    const start = ((y + row) * width + x) * 4;
    rgba.copy(
      bytes,
      row * NORMALIZED_WIDTH * 4,
      start,
      start + NORMALIZED_WIDTH * 4,
    );
  }
  return sha256(bytes);
}

function nativeTextureSlot(colorCode) {
  return colorCode < -2000 ? -colorCode - 2000 : -colorCode;
}

function requireBytes(value, label) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
    throw new TypeError(`${label} bytes are required.`);
  }
  return Buffer.from(value);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) throw new Error("Exact player material contains a non-finite value.");
  if (Math.abs(value) < 1e-14) return "0";
  return Number(value.toPrecision(15)).toString();
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
