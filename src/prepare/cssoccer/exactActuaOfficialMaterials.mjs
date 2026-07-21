import { createHash } from "node:crypto";

import {
  CSSOCCER_EXACT_ACTUA_OFFICIAL_SOURCE_SCHEMA,
} from "./exactActuaOfficialSource.mjs";
import {
  decodeExactActuaTextureRecord,
  decodeFilterZeroRgbaPng,
  encodeRgbaPng,
  prepareExactActuaOfficialTextureTable,
} from "./exactActuaPlayerTextureCodec.mjs";
import { CSSOCCER_EXACT_ACTUA_PLAYER_LEAF_RASTER } from
  "./exactActuaPlayerViews.mjs";

export const CSSOCCER_EXACT_ACTUA_OFFICIAL_MATERIALS_SCHEMA =
  "cssoccer-exact-actua-official-materials@1";

const TEXTURE_RECORD_BYTES = 32;
const PAGE_SIZE = 256;
const NORMALIZED_WIDTH = 32;
const NORMALIZED_HEIGHT = 64;
const GUTTER = 1;
const CELL_WIDTH = NORMALIZED_WIDTH + GUTTER * 2;
const CELL_HEIGHT = NORMALIZED_HEIGHT + GUTTER * 2;
const ATLAS_COLUMNS = 32;
const ASSET_PATH = "assets/textures/spain-argentina-exact-official-materials.png";
const ASSET_URL = `/cssoccer/${ASSET_PATH}`;

export function prepareCssoccerExactActuaOfficialMaterials({
  officialSource,
  actRendDatBytes,
  actRendOffBytes,
  retailActRendDatBytes,
  retailActRendOffBytes,
  sourceAtlasPngBytes,
  officialSourceAtlas,
} = {}) {
  if (
    officialSource?.schema !== CSSOCCER_EXACT_ACTUA_OFFICIAL_SOURCE_SCHEMA
    || officialSource.status !== "ready-exact-referee-and-two-assistants"
    || officialSource.geometry?.faceCount !== 12
  ) throw new Error("Exact official materials require the complete source contract.");
  const textureTable = prepareExactActuaOfficialTextureTable({
    actRendDatBytes,
    actRendOffBytes,
    retailActRendDatBytes,
    retailActRendOffBytes,
  });
  const matchAtlasBytes = requireBytes(sourceAtlasPngBytes, "match source atlas");
  const matchAtlas = decodeFilterZeroRgbaPng(matchAtlasBytes);
  const extendedAtlasBytes = requireBytes(officialSourceAtlas?.pngBytes, "official source atlas");
  const extendedAtlas = decodeFilterZeroRgbaPng(extendedAtlasBytes);
  const extendedPageByNativePage = new Map(
    officialSourceAtlas.metadata.nativePages.map(({ nativePage, atlasPage }) => (
      [nativePage, atlasPage]
    )),
  );
  if (matchAtlas.width !== 2_048 || matchAtlas.height !== PAGE_SIZE
      || extendedAtlas.width !== 512 || extendedAtlas.height !== PAGE_SIZE) {
    throw new Error("Exact official material source dimensions changed.");
  }
  const orderedSlots = officialSource.texture.requiredSlots;
  const rows = Math.ceil(orderedSlots.length / ATLAS_COLUMNS);
  const atlasWidth = ATLAS_COLUMNS * CELL_WIDTH;
  const atlasHeight = rows * CELL_HEIGHT;
  const atlasRgba = Buffer.alloc(atlasWidth * atlasHeight * 4);
  const entries = orderedSlots.map((nativeTextureSlot, entryIndex) => {
    const recordBytes = textureTable.subarray(
      (nativeTextureSlot - 1) * TEXTURE_RECORD_BYTES,
      nativeTextureSlot * TEXTURE_RECORD_BYTES,
    );
    const record = decodeExactActuaTextureRecord(nativeTextureSlot, recordBytes);
    const source = sourcePage(record.page, {
      matchAtlas,
      extendedAtlas,
      extendedPageByNativePage,
    });
    const oriented = orientedSourceCrop({
      source: source.rgba,
      sourceWidth: source.width,
      sourceX: source.x + record.sourceRect.x,
      sourceY: record.sourceRect.y,
      width: record.sourceRect.width,
      height: record.sourceRect.height,
      projectedCornerBySourceCorner: record.projectedCornerBySourceCorner,
    });
    const column = entryIndex % ATLAS_COLUMNS;
    const row = Math.floor(entryIndex / ATLAS_COLUMNS);
    const targetX = column * CELL_WIDTH + GUTTER;
    const targetY = row * CELL_HEIGHT + GUTTER;
    blitNearestNormalized({
      source: oriented.rgba,
      sourceWidth: oriented.width,
      sourceHeight: oriented.height,
      target: atlasRgba,
      targetWidth: atlasWidth,
      targetX,
      targetY,
    });
    const normalizedRgbaSha256 = normalizedCellSha256(
      atlasRgba,
      atlasWidth,
      targetX,
      targetY,
    );
    return {
      entryIndex,
      id: `native-official-texture-${String(nativeTextureSlot).padStart(3, "0")}`,
      nativeTextureSlot,
      nativePage: record.page,
      sourceRect: record.sourceRect,
      projectedCornerBySourceCorner: record.projectedCornerBySourceCorner,
      orientation: oriented.orientation,
      textureRecordSha256: sha256(recordBytes),
      normalizedRgbaSha256,
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
        backgroundPositionX: `${-targetX}px`,
        backgroundPositionY: `${-targetY}px`,
      },
    };
  });
  const entryBySlot = new Map(entries.map((entry) => [entry.nativeTextureSlot, entry]));
  const backgroundSize = `${atlasWidth}px ${atlasHeight}px`;
  const materialProfiles = Object.fromEntries(
    Object.values(officialSource.materialProfiles).map((profile) => [profile.id, {
      id: profile.id,
      role: profile.role,
      sourceModelSymbol: profile.sourceModelSymbol,
      nativeRenderType: profile.nativeRenderType,
      nativeRendererIndexes: [...profile.nativeRendererIndexes],
      geometryId: profile.geometryId,
      topologySha256: profile.topologySha256,
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
      faces: profile.faces.map((face) => ({
        faceIndex: face.faceIndex,
        semanticRole: face.semanticRole,
        baseSourceColorCode: face.sourceColorCode,
        selectorOffsets: [...face.selectorOffsets],
        slotsBySelectorOffset: Object.fromEntries(
          Object.entries(face.slotsBySelectorOffset).map(([offset, slot]) => [
            offset,
            materialBinding(entryBySlot, slot),
          ]),
        ),
      })),
      shirtNumbers: null,
    }]),
  );
  const fixtureOfficials = [
    { rootId: "referee-00", role: "referee", materialProfileId: "actua-referee-material" },
    {
      rootId: "assistant-referee-01",
      role: "assistant-referee",
      materialProfileId: "actua-assistant-referee-material",
    },
    {
      rootId: "assistant-referee-02",
      role: "assistant-referee",
      materialProfileId: "actua-assistant-referee-material",
    },
  ];
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
    schema: CSSOCCER_EXACT_ACTUA_OFFICIAL_MATERIALS_SCHEMA,
    status: "ready-complete-two-official-profile-normalized-atlas",
    fixtureId: "spain-argentina-full-match",
    geometryId: officialSource.geometry.geometryId,
    topologySha256: officialSource.geometry.topologySha256,
    sourceContractSha256: officialSource.contractSha256,
    counts: {
      profiles: 2,
      fixtureOfficials: 3,
      faceBindingsPerProfile: 12,
      textureEntries: entries.length,
    },
    atlas,
    entries,
    materialProfiles,
    fixtureOfficials,
    source: {
      textureTableSha256: sha256(textureTable),
      matchSourceAtlasSha256: sha256(matchAtlasBytes),
      officialSourceAtlasSha256: sha256(extendedAtlasBytes),
      normalizedAtPrepareTime: true,
    },
    runtime: {
      geometryMutation: false,
      matrixMutationByMaterial: false,
      atlasConstruction: false,
      missingMaterialPolicy: "reject",
      missingNumberPolicy: "not-applicable",
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

function sourcePage(nativePage, { matchAtlas, extendedAtlas, extendedPageByNativePage }) {
  if (nativePage >= 0 && nativePage < 7) {
    return { rgba: matchAtlas.rgba, width: matchAtlas.width, x: nativePage * PAGE_SIZE };
  }
  const atlasPage = extendedPageByNativePage.get(nativePage);
  if (!Number.isSafeInteger(atlasPage)) {
    throw new Error(`Exact official native page ${nativePage} is unavailable.`);
  }
  return { rgba: extendedAtlas.rgba, width: extendedAtlas.width, x: atlasPage * PAGE_SIZE };
}

function materialBinding(entryBySlot, slot) {
  const entry = entryBySlot.get(slot);
  if (!entry) throw new Error(`Exact official texture slot ${slot} is not normalized.`);
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
  if (!Array.isArray(projectedCornerBySourceCorner)
      || projectedCornerBySourceCorner.length !== 4
      || new Set(projectedCornerBySourceCorner).size !== 4) {
    throw new Error("Exact official material has an invalid source-corner mapping.");
  }
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
      source.copy(
        rgba,
        (y * outputWidth + x) * 4,
        (sy * sourceWidth + sx) * 4,
        (sy * sourceWidth + sx + 1) * 4,
      );
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
    const sourceY = Math.min(sourceHeight - 1, Math.floor((y + 0.5) * sourceHeight / 64));
    for (let x = 0; x < NORMALIZED_WIDTH; x += 1) {
      const sourceX = Math.min(sourceWidth - 1, Math.floor((x + 0.5) * sourceWidth / 32));
      source.copy(
        target,
        ((targetY + y) * targetWidth + targetX + x) * 4,
        (sourceY * sourceWidth + sourceX) * 4,
        (sourceY * sourceWidth + sourceX + 1) * 4,
      );
    }
  }
}

function normalizedCellSha256(rgba, width, x, y) {
  const bytes = Buffer.alloc(NORMALIZED_WIDTH * NORMALIZED_HEIGHT * 4);
  for (let row = 0; row < NORMALIZED_HEIGHT; row += 1) {
    rgba.copy(
      bytes,
      row * NORMALIZED_WIDTH * 4,
      ((y + row) * width + x) * 4,
      ((y + row) * width + x + NORMALIZED_WIDTH) * 4,
    );
  }
  return sha256(bytes);
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
