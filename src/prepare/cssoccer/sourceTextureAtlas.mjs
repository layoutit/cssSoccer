import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

import {
  decodeActuaFaceList,
  decodeActuaOffsetArchive,
  decodeWatcomOmf32Object,
  extractNativeVisualStadiumSelectors,
} from "./formatAdapters.mjs";
import { cssoccerPublicUrl } from "./paths.mjs";

export const CSSOCCER_SOURCE_TEXTURE_ATLAS_SCHEMA = "cssoccer-source-match-texture-atlas@1";

const FIXTURE_ID = "spain-argentina-full-match";
const PAGE_SIZE = 256;
const PLAYER_PAGE_COUNT = 7;
const PLAYER_HIGHLIGHT_PAGE_INDEX = 6;
const PLAYER_HIGHLIGHT_TRANSPARENT_PALETTE_INDEX = 1;
const PLAYER_HIGHLIGHT_SOURCE_HEIGHT = 62;
const PLAYER_HIGHLIGHT_SOURCE_RECORD_SHA256 =
  "1138cf54ea07e96f6c71d8378bc0d0bd405e9ee99d36860707bd37b6c231fc68";
const PLAYER_HIGHLIGHT_MARKER_FAMILIES = deepFreeze([
  {
    id: "player-highlight-family-normal",
    sourceName: "plhi1",
    nativeTextureSlot: 533,
    sourceColorCode: -2533,
    sourceRect: { x: 64, y: 0, width: 32, height: 31 },
  },
  {
    id: "player-highlight-family-cross",
    sourceName: "plhi2",
    nativeTextureSlot: 534,
    sourceColorCode: -2534,
    sourceRect: { x: 96, y: 0, width: 32, height: 31 },
  },
  {
    id: "player-highlight-family-ball-shoot",
    sourceName: "plhi3",
    nativeTextureSlot: 535,
    sourceColorCode: -2535,
    sourceRect: { x: 128, y: 0, width: 32, height: 31 },
  },
  {
    id: "player-highlight-family-star-special",
    sourceName: "plhi4",
    nativeTextureSlot: 536,
    sourceColorCode: -2536,
    sourceRect: { x: 0, y: 0, width: 32, height: 31 },
  },
]);
const PLAYER_HIGHLIGHT_FIRST_NATIVE_TEXTURE_SLOT = 533;
const PLAYER_HIGHLIGHT_FINAL_NATIVE_TEXTURE_SLOT = 548;
const PLAYER_NUMBER_PAGE_INDEX = 6;
const PLAYER_NUMBER_TRANSPARENT_PALETTE_INDEX = 1;
const PLAYER_NUMBER_FIRST_NATIVE_TEXTURE_SLOT = 549;
const PLAYER_NUMBER_FINAL_NATIVE_TEXTURE_SLOT = 578;
const PLAYER_NUMBER_SOURCE_BANDS = deepFreeze([
  {
    team: "spain",
    selector: 1936,
    y: 62,
    height: 27,
  },
  {
    team: "argentina",
    selector: 1944,
    y: 89,
    height: 54,
  },
]);
const PITCH_PAGE_INDEX = 7;
const ATLAS_WIDTH = PAGE_SIZE * (PLAYER_PAGE_COUNT + 1);
const ATLAS_HEIGHT = PAGE_SIZE;
const PITCH_HEIGHT = 64;
const PITCH_TILE_SIZE = 64;
const CORNER_FLAG_TEXTURE = deepFreeze({
  sourceColorCode: -2579,
  nativeTextureSlot: 579,
  archiveRecordIndex: 578,
  textureTableSelector: 8,
  nativePage: 6,
  sourcePitchRow: 116,
  sourcePitchSelector: 920,
  atlasPage: 7,
  atlasX: 0,
  atlasY: PITCH_HEIGHT,
  transparentSourceIndex: 1,
  paletteRemap: -1,
  paletteSource: {
    archive: "playable-demo",
    symbol: "COL_XSPAIN",
    selector: 1456,
    firstEntry: 32,
    entries: 24,
    role: "native match corner-flag red ramp",
  },
});
const ASSET_PATH = "assets/textures/spain-argentina-match.png";
const ASSET_URL = cssoccerPublicUrl(ASSET_PATH);
const FULL_IMAGE_UVS = deepFreeze([[0, 1], [1, 1], [1, 0], [0, 0]]);
const PITCH_SURFACE_PATH = "assets/textures/spain-argentina-pitch.png";
const PITCH_SURFACE_URL = cssoccerPublicUrl(PITCH_SURFACE_PATH);
const HUD_GLYPH_ATLAS_PATH = "assets/textures/spain-argentina-hud-glyphs.png";
const HUD_GLYPH_ATLAS_URL = cssoccerPublicUrl(HUD_GLYPH_ATLAS_PATH);
const STADIUM_ATLAS_PATH = "assets/textures/spain-argentina-stadium.png";
const STADIUM_ATLAS_URL = cssoccerPublicUrl(STADIUM_ATLAS_PATH);
const SKY_BACKDROP_PATH = "assets/textures/spain-argentina-sky.png";
const SKY_BACKDROP_URL = cssoccerPublicUrl(SKY_BACKDROP_PATH);
const MARKING_PIXEL_PATH = "assets/textures/spain-argentina-marking-pixel.png";
const MARKING_PIXEL_URL = cssoccerPublicUrl(MARKING_PIXEL_PATH);
const STADIUM_PAGE_COUNT = 2;
const STADIUM_ATLAS_WIDTH = PAGE_SIZE * 4;
const STADIUM_ATLAS_HEIGHT = PAGE_SIZE * 3;
const GOAL_NET_TEXTURE = deepFreeze({
  textureTableSelector: 8,
  bitmapSelector: 320,
  bitmapSymbol: "BM_NETS",
  selectorAuthority: {
    object: "3DENG.OBJ",
    function: "init3d",
    objectOffset: "0x00013ef4",
    instruction: "mov eax,0x00000140",
    sourceCall: "readfile(BM_NETS,maps[S_BM+7])",
  },
  nativePage: 15,
  firstNativeTextureSlot: 997,
  finalNativeTextureSlot: 1000,
  softwarePaletteRemap: 1,
  transparentPaletteIndex: 1,
  sourceBitmapSha256: "8041471f193f40d64af669dafd32029d9206322d919172ab1716222c5773a4dc",
  atlasRegion: {
    x: PAGE_SIZE * 2,
    y: 0,
    width: PAGE_SIZE * 2,
    height: PAGE_SIZE,
  },
});
const PITCH_SURFACE_BOUNDS = deepFreeze({
  x: [-200, 1480],
  z: [-980, 180],
});
const PITCH_SURFACE_WIDTH = PITCH_SURFACE_BOUNDS.x[1] - PITCH_SURFACE_BOUNDS.x[0];
const PITCH_SURFACE_HEIGHT = PITCH_SURFACE_BOUNDS.z[1] - PITCH_SURFACE_BOUNDS.z[0];
const MEDIUM_PITCH_TILE = deepFreeze({
  size: 32,
  worldUnitsPerTexel: 2,
  sourceRow: 32,
  sourceColumn: 64,
  panMask: "0x1f1f",
});
const VISUAL_PITCH_SOURCE = deepFreeze({
  sourceArchive: "EUROREND.DAT",
  pitchBitmap: "BM_PC",
  pitchSelector: 920,
  pitchPalette: "COL_P5",
  pitchPaletteSelector: 544,
  selection: "retained-native-frame-50-visual-binding",
});
const VISUAL_SKY_SOURCE = deepFreeze({
  selection: "retained-native-frame-50-visual-binding",
  sourceArchive: "EUROREND.DAT",
  bitmap: "BM_C1X",
  bitmapSelector: 736,
  bitmapBytes: 640 * 480,
  palette: "COL_C1X",
  paletteSelector: 688,
  paletteFirstEntry: 208,
  paletteEntries: 16,
  width: 640,
  height: 480,
  skyType: 1,
});
const PINNED_FOOTY_PALETTE = Object.freeze({
  bytes: 768,
  sha256: "73918cecf278e00172e0607053cd8c62e9c4172f70b7cb8e8884d2261a9ae436",
});
const HUD_FONT = deepFreeze({
  sourceFile: "FGFX.C",
  fontNo: 1,
  page: 0,
  sourceX: 96,
  sourceY: 143,
  sourcePitchRow: 27,
  columns: 9,
  cellWidth: 8,
  cellHeight: 7,
  rows: 5,
  offset: 0,
  asciiBase: 48,
  widths: [
    7, 6, 7, 7, 7, 7, 7, 7, 7, 7, 3, 4, 6, 7, 6, 4,
    3, 7, 7, 7, 7, 7, 7, 7, 7, 6, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 6, 7, 7, 7, 7, 7, 7,
  ],
});
const HUD_GLYPH_ATLAS_WIDTH = HUD_FONT.columns * HUD_FONT.cellWidth;
const HUD_GLYPH_BAND_HEIGHT = HUD_FONT.rows * HUD_FONT.cellHeight;
const HUD_COLOR_BANDS = deepFreeze([
  {
    id: "neutral",
    outputColorIndex: 31,
    paletteSelector: 0,
    paletteTargetIndex: 0,
  },
  {
    id: "team-a",
    outputColorIndex: 32,
    paletteSelector: 344,
    paletteTargetIndex: 32,
  },
  {
    id: "team-b",
    outputColorIndex: 56,
    paletteSelector: 360,
    paletteTargetIndex: 56,
  },
]);
const HUD_GLYPH_ATLAS_HEIGHT = HUD_GLYPH_BAND_HEIGHT * HUD_COLOR_BANDS.length;
const HUD_NATIVE_LAYOUT = deepFreeze({
  viewport: [320, 200],
  clock: { x: 160, y: 1, justification: "center" },
  teamA: { x: 140, y: 192, justification: "right" },
  score: { x: 160, y: 192, justification: "center", separator: "=" },
  teamB: { x: 180, y: 192, justification: "left" },
});

const PINNED_ARCHIVE = Object.freeze({
  data: Object.freeze({
    bytes: 12_652_256,
    sha256: "740dd963858397b465544e0c2a99ee14c0a68c7df07ce5cc3e925de25ad35ca2",
  }),
  index: Object.freeze({
    bytes: 3_440,
    records: 430,
    sha256: "b3df2b2767cbaebb7e21364e71b897c6336d46b9814c4baba442e50ef2ab696d",
  }),
  distribution: Object.freeze({
    archiveSha256: "14f9470d497d18195fe847f07987dbfa6a5e5c334b0c96af7b38d3bec26c4480",
    archiveFile: "acts-dem.zip",
    source: "official playable Actua Soccer demo",
  }),
  selectorAuthority: Object.freeze({
    repository: "https://github.com/TalonBraveInfo/gremlin-soccer",
    revision: "2232754037ba7e2dfbf3f0d7dbe4dd6574380225",
    file: "game.equ",
    blobSha: "6317e9556555b04ce06badbf8749c2093f7b4137",
  }),
});

const PINNED_RETAIL_ARCHIVE = Object.freeze({
  data: Object.freeze({
    bytes: 12_906_808,
    sha256: "843c6da5abe934b547248ce45e0179ddb9518cff07729ff919cfc8a7c8464d7e",
  }),
  index: Object.freeze({
    bytes: 3_512,
    records: 439,
    sha256: "af154fe774eb2386628457c79e53738dd990d09083a122761848f6dcbc4b3f9f",
  }),
  distribution: Object.freeze({
    archiveSha256: "1c6edf9e3dcefdc92bee79daca87ef64f795e7f423123b13637150c077a530c7",
    archiveFile: "Actua_Soccer_Win_ISO_EN.zip",
    source: "user-supplied Actua Soccer retail data",
    dataRoute: "ignored-local-retail-intake",
    publication: "generated browser assets remain ignored local output",
  }),
});

const PINNED_NATIVE_ARCHIVE = Object.freeze({
  data: Object.freeze({
    bytes: 6_613_404,
    sha256: "0c38ab865fcd1d62d7c0f3f88b861f4c43643caf402dea6fbe9b0f042fd340cb",
  }),
  index: Object.freeze({
    bytes: 1_832,
    records: 229,
    sha256: "96e6cea4bb91667cd204faa928696006048cf35a4e0baabefe83eca5d06dcb87",
  }),
  glyphPage: Object.freeze({
    selector: 920,
    symbol: "BM_PC",
    bytes: 16_384,
  }),
});

const PINNED_STADIUM_ENGINE_OBJECT = Object.freeze({
  bytes: 197_182,
  sha256: "49de827ef363e9367855bcf5ddfe7b6f20eca55d0907a4fc07da233010cbe733",
});

const STADIUM_PALETTE_OVERRIDES = deepFreeze([
  {
    id: "spain-pitch",
    symbol: "COL_P5",
    selector: 544,
    firstEntry: 128,
    entries: 16,
  },
  {
    id: "spain-home-highlight",
    symbol: "COL_HR",
    selector: 608,
    firstEntry: 224,
    entries: 8,
  },
  {
    id: "argentina-away-highlight",
    symbol: "COL_AB",
    selector: 632,
    firstEntry: 232,
    entries: 8,
  },
]);

const SELECTORS = deepFreeze({
  player: {
    argentinaHead: 64,
    argentinaLimbs: 512,
  },
  pitch: 1920,
  paletteOverrides: {
    argentinaSkin: 1536,
  },
});
const NATIVE_PLAYER_SELECTORS = deepFreeze({
  palette: 0,
  matchTextureTable: 8,
  playerTextureTable: 16,
  spainHead: 48,
  spainTorso: 160,
  spainLimbs: 232,
  sharedFeet: 272,
  keeperTorso: 280,
  spainKitPalette: 440,
  spainSkinPalette: 480,
  spainPitchPalette: 544,
  keeperLimbs: 864,
});
const RETAIL_PLAYER_SELECTORS = deepFreeze({
  textureTable: 8,
  argentinaTorso: 96,
  refereeTorso: 576,
  assistantLimbs: 608,
  refereeLimbs: 1928,
  playerHighlightPage: 584,
  spainNumbers: 1936,
  argentinaNumbers: 1944,
  argentinaKitPalette: 1144,
});
const EXPECTED_RECORD_BYTES = new Map([
  [SELECTORS.player.argentinaHead, 32_768],
  [SELECTORS.player.argentinaLimbs, 19_968],
  [SELECTORS.pitch, 16_384],
  [SELECTORS.paletteOverrides.argentinaSkin, 24],
  [CORNER_FLAG_TEXTURE.paletteSource.selector, 72],
]);

const EXPECTED_NATIVE_PLAYER_RECORD_BYTES = new Map([
  [NATIVE_PLAYER_SELECTORS.palette, 768],
  [NATIVE_PLAYER_SELECTORS.matchTextureTable, 32_192],
  [NATIVE_PLAYER_SELECTORS.playerTextureTable, 18_336],
  [NATIVE_PLAYER_SELECTORS.spainHead, 32_768],
  [NATIVE_PLAYER_SELECTORS.spainTorso, 65_536],
  [NATIVE_PLAYER_SELECTORS.spainLimbs, 19_968],
  [NATIVE_PLAYER_SELECTORS.sharedFeet, 17_152],
  [NATIVE_PLAYER_SELECTORS.keeperTorso, 65_536],
  [NATIVE_PLAYER_SELECTORS.spainKitPalette, 72],
  [NATIVE_PLAYER_SELECTORS.spainSkinPalette, 24],
  [NATIVE_PLAYER_SELECTORS.spainPitchPalette, 48],
  [NATIVE_PLAYER_SELECTORS.keeperLimbs, 65_536],
]);
const EXACT_PLAYER_PAGE_THREE_SHA256 =
  "be65b4dc2f665dbf1f572ddab0cc03730612725bdebabc42e08c925b585a2ece";
const EXACT_PLAYER_SOURCE_AUDIT = deepFreeze([
  {
    role: "spain-lower-leg",
    nativeTextureSlot: 244,
    sourceRect: { x: 0, y: 0, width: 15, height: 61 },
    textureRecordSha256:
      "1a1178ba120873b9e875af69bc352102f338de6cebcafaf26bd1271f006c17f5",
    indexedTexelSha256:
      "086fffef5c3f07e9ce3f96d47ee3206fa358736e06b8b423a6466aaa6d0814e3",
  },
  {
    role: "spain-shorts",
    nativeTextureSlot: 258,
    sourceRect: { x: 126, y: 0, width: 19, height: 62 },
    textureRecordSha256:
      "2b7b66e826ec5b5d88ebb26fefcd5ae2849500fec6bacbc9b09e50c9fafa9846",
    indexedTexelSha256:
      "7f1d375e1d2684cb358281b8c109627011291c1b2b8f95baca0af20949d573ba",
  },
  {
    role: "shared-boots",
    nativeTextureSlot: 331,
    sourceRect: { x: 36, y: 190, width: 19, height: 22 },
    textureRecordSha256:
      "15f05840fe935f3f5d73a5d7608f7a0107116eb196c94e821a372ee9ac51d653",
    indexedTexelSha256:
      "ddbe0116eacc7a615ee928d1ca75a97206971c942503f36e387c17b17ba4be8f",
  },
]);

const EXPECTED_RETAIL_PLAYER_RECORD_BYTES = new Map([
  [RETAIL_PLAYER_SELECTORS.textureTable, 32_192],
  [RETAIL_PLAYER_SELECTORS.argentinaTorso, 65_536],
  [RETAIL_PLAYER_SELECTORS.refereeTorso, 65_536],
  [RETAIL_PLAYER_SELECTORS.assistantLimbs, 65_536],
  [RETAIL_PLAYER_SELECTORS.refereeLimbs, 65_536],
  [RETAIL_PLAYER_SELECTORS.playerHighlightPage, 15_872],
  [RETAIL_PLAYER_SELECTORS.spainNumbers, 13_824],
  [RETAIL_PLAYER_SELECTORS.argentinaNumbers, 13_824],
  [RETAIL_PLAYER_SELECTORS.argentinaKitPalette, 72],
]);

/**
 * Prepare only the canonical fixture pitch surface. This is the same
 * source-bound producer used by the complete match atlas preparation; it is
 * exported so the pitch can be verified without weakening fixture gates.
 */
export function prepareCssoccerPitchSurfaceAsset({
  euroRendDatBytes,
  euroRendOffBytes,
} = {}) {
  const data = requirePinnedBytes(
    euroRendDatBytes,
    "EUROREND.DAT",
    PINNED_NATIVE_ARCHIVE.data,
  );
  const index = requirePinnedBytes(
    euroRendOffBytes,
    "EUROREND.OFF",
    PINNED_NATIVE_ARCHIVE.index,
  );
  const archive = decodeActuaOffsetArchive({
    dataBytes: data,
    indexBytes: index,
    label: "Actua Soccer retained native renderer archive",
  });
  if (archive.recordCount !== PINNED_NATIVE_ARCHIVE.index.records) {
    throw new Error(`EUROREND.OFF record count changed: ${archive.recordCount}.`);
  }
  for (const [selector, expectedBytes] of [
    [VISUAL_PITCH_SOURCE.pitchSelector, PITCH_HEIGHT * PAGE_SIZE],
    [VISUAL_PITCH_SOURCE.pitchPaletteSelector, 48],
  ]) {
    const actual = archive.recordInfo(selector);
    if (actual.size !== expectedBytes) {
      throw new Error(
        `EUROREND selector ${selector} has ${actual.size} bytes, expected ${expectedBytes}.`,
      );
    }
  }
  return preparePitchSurfaceFromArchive(archive);
}

/**
 * Reproduce the native M8 match map-page and palette preparation using only
 * ignored local demo bytes plus the pinned retail Argentina supplement. The
 * returned PNG is a generated browser asset;
 * original indexed records never enter the publication.
 */
export function prepareCssoccerSourceTextureAtlas({
  actRendDatBytes,
  actRendOffBytes,
  retailActRendDatBytes,
  retailActRendOffBytes,
  threeDEngObjectBytes,
  euroRendDatBytes,
  euroRendOffBytes,
  footyPalBytes,
} = {}) {
  const data = requirePinnedBytes(actRendDatBytes, "ACTREND.DAT", PINNED_ARCHIVE.data);
  const index = requirePinnedBytes(actRendOffBytes, "ACTREND.OFF", PINNED_ARCHIVE.index);
  const archive = decodeActuaOffsetArchive({
    dataBytes: data,
    indexBytes: index,
    label: "Actua Soccer playable-demo renderer archive",
  });
  if (archive.recordCount !== PINNED_ARCHIVE.index.records) {
    throw new Error(`ACTREND.OFF record count changed: ${archive.recordCount}.`);
  }
  const retailData = requirePinnedBytes(
    retailActRendDatBytes,
    "retail ACTREND.DAT",
    PINNED_RETAIL_ARCHIVE.data,
  );
  const retailIndex = requirePinnedBytes(
    retailActRendOffBytes,
    "retail ACTREND.OFF",
    PINNED_RETAIL_ARCHIVE.index,
  );
  const retailArchive = decodeActuaOffsetArchive({
    dataBytes: retailData,
    indexBytes: retailIndex,
    label: "Actua Soccer retail player renderer archive",
  });
  if (retailArchive.recordCount !== PINNED_RETAIL_ARCHIVE.index.records) {
    throw new Error(`Retail ACTREND.OFF record count changed: ${retailArchive.recordCount}.`);
  }
  const nativeData = requirePinnedBytes(
    euroRendDatBytes,
    "EUROREND.DAT",
    PINNED_NATIVE_ARCHIVE.data,
  );
  const nativeIndex = requirePinnedBytes(
    euroRendOffBytes,
    "EUROREND.OFF",
    PINNED_NATIVE_ARCHIVE.index,
  );
  const nativeArchive = decodeActuaOffsetArchive({
    dataBytes: nativeData,
    indexBytes: nativeIndex,
    label: "Actua Soccer retained native renderer archive",
  });
  if (nativeArchive.recordCount !== PINNED_NATIVE_ARCHIVE.index.records) {
    throw new Error(`EUROREND.OFF record count changed: ${nativeArchive.recordCount}.`);
  }
  const engineObject = decodeWatcomOmf32Object(
    requirePinnedBytes(
      threeDEngObjectBytes,
      "3DENG.OBJ",
      PINNED_STADIUM_ENGINE_OBJECT,
    ),
    { label: "3DENG.OBJ" },
  );
  const stadiumSelectors = extractNativeVisualStadiumSelectors({
    engineObject,
    archive: nativeArchive,
  });
  if (
    nativeArchive.recordInfo(PINNED_NATIVE_ARCHIVE.glyphPage.selector).size
      !== PINNED_NATIVE_ARCHIVE.glyphPage.bytes
  ) {
    throw new Error("EUROREND BM_PC no longer contains the native 256 by 64 pitch/font page.");
  }
  for (const [selector, expectedBytes] of EXPECTED_RECORD_BYTES) {
    const actual = archive.recordInfo(selector);
    if (actual.size !== expectedBytes) {
      throw new Error(`ACTREND selector ${selector} has ${actual.size} bytes, expected ${expectedBytes}.`);
    }
  }
  for (const [selector, expectedBytes] of EXPECTED_RETAIL_PLAYER_RECORD_BYTES) {
    const actual = retailArchive.recordInfo(selector);
    if (actual.size !== expectedBytes) {
      throw new Error(
        `Retail ACTREND selector ${selector} has ${actual.size} bytes, expected ${expectedBytes}.`,
      );
    }
  }
  for (const [selector, expectedBytes] of EXPECTED_NATIVE_PLAYER_RECORD_BYTES) {
    const actual = nativeArchive.recordInfo(selector);
    if (actual.size !== expectedBytes) {
      throw new Error(
        `EUROREND selector ${selector} has ${actual.size} bytes, expected ${expectedBytes}.`,
      );
    }
  }

  const palette = preparePalette(archive, retailArchive, nativeArchive);
  const pitchSurface = preparePitchSurfaceFromArchive(nativeArchive);
  const skyBackdrop = prepareSkyBackdrop(
    nativeArchive,
    requirePinnedBytes(footyPalBytes, "FOOTY.PAL", PINNED_FOOTY_PALETTE),
  );
  const paletteIndexZero = browserPaletteEntry(palette, 0);
  const textureTableBytes = preparePlayerTextureTableBytes(
    nativeArchive,
    retailArchive,
  );
  if (textureTableBytes.length % 32 !== 0) {
    throw new Error("TMD_TEXDATA is not a complete array of 32-byte four-point texture records.");
  }
  const textureRecords = decodeTextureRecords(textureTableBytes);
  const playerPages = preparePlayerPages(
    archive,
    retailArchive,
    nativeArchive,
    textureRecords,
  );
  const playerSourceAudit = preparePlayerSourceAudit(playerPages, textureRecords);
  const officialSourceAtlas = prepareOfficialSourceAtlas(retailArchive, palette);
  const playerHighlightSourceRecord = retailArchive.recordBytes(
    RETAIL_PLAYER_SELECTORS.playerHighlightPage,
  );
  if (sha256(playerHighlightSourceRecord) !== PLAYER_HIGHLIGHT_SOURCE_RECORD_SHA256) {
    throw new Error("Retail ACTREND player-highlight bitmap changed.");
  }
  const pitchPixels = archive.recordBytes(SELECTORS.pitch);
  const indexedPages = [...playerPages, paddedPitchPage(pitchPixels)];
  const rgba = renderAtlasRgba(indexedPages, palette);
  const cornerFlagPalette = prepareCornerFlagPalette(archive, palette);
  const cornerFlagCutout = prepareCornerFlagCutout({
    nativeArchive,
    palette: cornerFlagPalette,
    rgba,
  });
  const pngBytes = encodeRgbaPng(ATLAS_WIDTH, ATLAS_HEIGHT, rgba);
  const assetSha256 = sha256(pngBytes);
  const pitchSurfaceRgba = pitchSurface.rgbaBytes;
  const pitchSurfacePngBytes = pitchSurface.assetFile.bytes;
  const pitchSurfaceSha256 = pitchSurface.assetFile.expectedSha256;
  const markingPixelRgba = Buffer.from([255, 255, 255, 255]);
  const markingPixelPngBytes = encodeRgbaPng(1, 1, markingPixelRgba);
  const markingPixelSha256 = sha256(markingPixelPngBytes);
  const hudGlyphAtlas = prepareHudGlyphAtlas(nativeArchive);
  const stadiumAtlas = prepareStadiumAtlas(nativeArchive, stadiumSelectors, palette);
  const pageMaterials = Array.from({ length: PLAYER_PAGE_COUNT }, (_, page) => (
    createAtlasMaterial({ page, assetSha256, height: PAGE_SIZE })
  ));
  const cornerFlagMaterial = createAtlasMaterial({
    page: CORNER_FLAG_TEXTURE.atlasPage,
    x: cornerFlagCutout.x,
    y: cornerFlagCutout.y,
    width: cornerFlagCutout.width,
    height: cornerFlagCutout.height,
    assetSha256,
    key: `cssoccer-source-corner-flag-slot-${CORNER_FLAG_TEXTURE.nativeTextureSlot}`,
  });
  const pitchMaterial = createAtlasMaterial({
    page: 0,
    assetSha256: pitchSurfaceSha256,
    width: PITCH_SURFACE_WIDTH,
    height: PITCH_SURFACE_HEIGHT,
    key: "cssoccer-source-pitch-material",
    assetUrl: PITCH_SURFACE_URL,
    imageWidth: PITCH_SURFACE_WIDTH,
    imageHeight: PITCH_SURFACE_HEIGHT,
  });
  const markingMaterial = createAtlasMaterial({
    page: 0,
    assetSha256: markingPixelSha256,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    key: "cssoccer-marking-pixel",
    assetUrl: MARKING_PIXEL_URL,
    imageWidth: 1,
    imageHeight: 1,
    imageRendering: "pixelated",
  });
  const archivePayloadBytes = archive.records.reduce((sum, record) => sum + record.size, 0);
  const retailArchivePayloadBytes = retailArchive.records.reduce(
    (sum, record) => sum + record.size,
    0,
  );
  const placements = deepFreeze([
    { id: "native-player-page-0", page: 0, x: 0, y: 0, width: 256, height: 256 },
    { id: "native-player-page-1", page: 1, x: 256, y: 0, width: 256, height: 256 },
    { id: "native-player-page-2", page: 2, x: 512, y: 0, width: 256, height: 256 },
    { id: "native-player-page-3", page: 3, x: 768, y: 0, width: 256, height: 256 },
    { id: "native-referee-torso-page-4", page: 4, x: 1024, y: 0, width: 256, height: 256 },
    { id: "native-referee-limbs-page-5", page: 5, x: 1280, y: 0, width: 256, height: 256 },
    { id: "native-player-extra-page-6", page: 6, x: 1536, y: 0, width: 256, height: 256 },
    { id: "spain-pitch-bitmap", page: 7, x: 1792, y: 0, width: 256, height: 64 },
    {
      id: "native-corner-flag-slot-579-cutout",
      page: CORNER_FLAG_TEXTURE.atlasPage,
      x: CORNER_FLAG_TEXTURE.atlasPage * PAGE_SIZE + cornerFlagCutout.x,
      y: cornerFlagCutout.y,
      width: cornerFlagCutout.width,
      height: cornerFlagCutout.height,
    },
  ]);
  const metadata = deepFreeze({
    schema: CSSOCCER_SOURCE_TEXTURE_ATLAS_SCHEMA,
    fixtureId: FIXTURE_ID,
    status: "ready-source-decoded-browser-atlas",
    source: {
      data: { file: "ACTREND.DAT", ...PINNED_ARCHIVE.data },
      index: { file: "ACTREND.OFF", ...PINNED_ARCHIVE.index },
      distribution: PINNED_ARCHIVE.distribution,
      retailPlayerSupplement: {
        data: { file: "ACTREND.DAT", ...PINNED_RETAIL_ARCHIVE.data },
        index: { file: "ACTREND.OFF", ...PINNED_RETAIL_ARCHIVE.index },
        distribution: PINNED_RETAIL_ARCHIVE.distribution,
        selectors: RETAIL_PLAYER_SELECTORS,
      },
      nativePlayerFoundation: {
        data: { file: "EUROREND.DAT", ...PINNED_NATIVE_ARCHIVE.data },
        index: { file: "EUROREND.OFF", ...PINNED_NATIVE_ARCHIVE.index },
        selectors: NATIVE_PLAYER_SELECTORS,
        usage:
          "Spain pages and palette, shared boot texels, goalkeeper pages, and player slots 1 through 532",
        publication: "prepare-derived browser assets only; source records remain ignored local input",
      },
      nativeCornerFlagSupplement: {
        data: { file: "EUROREND.DAT", ...PINNED_NATIVE_ARCHIVE.data },
        index: { file: "EUROREND.OFF", ...PINNED_NATIVE_ARCHIVE.index },
        selectors: {
          textureTable: CORNER_FLAG_TEXTURE.textureTableSelector,
          pitchBitmap: CORNER_FLAG_TEXTURE.sourcePitchSelector,
        },
        publication: "prepare-derived cutout only; source records remain ignored local input",
      },
      selectorAuthority: PINNED_ARCHIVE.selectorAuthority,
    },
    selectors: {
      demo: SELECTORS,
      nativePlayerFoundation: NATIVE_PLAYER_SELECTORS,
      retailPlayerSupplement: RETAIL_PLAYER_SELECTORS,
    },
    counts: {
      archiveRecords: archive.recordCount,
      retailArchiveRecords: retailArchive.recordCount,
      textureRecords: textureRecords.length,
      nativePlayerPages: PLAYER_PAGE_COUNT,
      browserAtlasPlacements: placements.length,
      generatedFiles: 6,
      unaccountedArchiveBytes: data.length - archivePayloadBytes - archive.gapByteCount,
    },
    archiveAccounting: {
      dataBytes: data.length,
      indexBytes: index.length,
      recordPayloadBytes: archivePayloadBytes,
      gapBytes: archive.gapByteCount,
      accountedDataBytes: archivePayloadBytes + archive.gapByteCount,
      retailPlayerSupplement: {
        dataBytes: retailData.length,
        indexBytes: retailIndex.length,
        recordPayloadBytes: retailArchivePayloadBytes,
        gapBytes: retailArchive.gapByteCount,
        accountedDataBytes: retailArchivePayloadBytes + retailArchive.gapByteCount,
      },
    },
    palette: {
      entries: 256,
      componentConversion: "(sourceRgb6 << 2) | (sourceRgb6 >> 4)",
      sha256: sha256(palette),
      indexZero: paletteIndexZero,
      skinPalette: {
        status: "exact-fixture-source-palette-selection",
        spainSymbol: "COL_XCAUCASA",
        spainSelector: NATIVE_PLAYER_SELECTORS.spainSkinPalette,
        argentinaSymbol: "COL_XLATINO",
        argentinaSelector: SELECTORS.paletteOverrides.argentinaSkin,
      },
      overrides: [
        {
          id: "spain-kit",
          selector: NATIVE_PLAYER_SELECTORS.spainKitPalette,
          firstEntry: 32,
          entries: 24,
          sourceArchive: "retained-native-renderer",
        },
        {
          id: "argentina-kit",
          selector: RETAIL_PLAYER_SELECTORS.argentinaKitPalette,
          firstEntry: 56,
          entries: 24,
          sourceArchive: "retail-player-supplement",
        },
        {
          id: "spain-skin",
          selector: NATIVE_PLAYER_SELECTORS.spainSkinPalette,
          firstEntry: 80,
          entries: 8,
          sourceArchive: "retained-native-renderer",
        },
        {
          id: "argentina-skin",
          selector: SELECTORS.paletteOverrides.argentinaSkin,
          firstEntry: 88,
          entries: 8,
          sourceArchive: "playable-demo",
        },
        {
          id: "spain-pitch",
          selector: NATIVE_PLAYER_SELECTORS.spainPitchPalette,
          firstEntry: 128,
          entries: 16,
          sourceArchive: "retained-native-renderer",
        },
        {
          id: "spain-home-highlight",
          selector: 608,
          firstEntry: 224,
          entries: 8,
          sourceArchive: "retained-native-renderer",
        },
        {
          id: "argentina-away-highlight",
          selector: 632,
          firstEntry: 232,
          entries: 8,
          sourceArchive: "retained-native-renderer",
        },
      ],
    },
    textureTable: {
      selectors: {
        nativeMatch: NATIVE_PLAYER_SELECTORS.matchTextureTable,
        nativePlayers: NATIVE_PLAYER_SELECTORS.playerTextureTable,
        retailExtension: RETAIL_PLAYER_SELECTORS.textureTable,
      },
      bytes: textureTableBytes.length,
      records: textureRecords.length,
      recordBytes: 32,
      coordinateEncoding: "page byte plus unsigned 16.16 texel coordinate",
      sha256: sha256(textureTableBytes),
      composition: {
        base: "retained native match table",
        nativePlayerFoundation: "EUROREND TMD_MANDATA slots 1 through 532",
        nativePlayerHighlights: "EUROREND TMD_TEXDATA slots 533 through 548",
        retailPlayerSupplement: "retail TMD_TEXDATA slots 549 through 1006",
      },
    },
    playerSourceAudit,
    officialSourcePages: officialSourceAtlas.metadata,
    playerHighlightPrebake: {
      schema: "cssoccer-prepared-player-highlight-textures@1",
      status: "ready-source-backed-prebaked-highlight-alpha",
      sourceArchive: "retail-player-supplement",
      sourcePage: PLAYER_HIGHLIGHT_PAGE_INDEX,
      sourceSelector: RETAIL_PLAYER_SELECTORS.playerHighlightPage,
      sourceRecordSha256: PLAYER_HIGHLIGHT_SOURCE_RECORD_SHA256,
      sourceBand: { y: 0, height: PLAYER_HIGHLIGHT_SOURCE_HEIGHT },
      transparentPaletteIndex: PLAYER_HIGHLIGHT_TRANSPARENT_PALETTE_INDEX,
      markerFamilies: PLAYER_HIGHLIGHT_MARKER_FAMILIES,
      nativeFaceDispatch: "source color < -2000 selects 3DENG.C polyt",
      projectionStage: "prepare-time",
      runtimeImageConstruction: false,
      runtimeAlphaMutation: false,
    },
    playerNumberPrebake: {
      schema: "cssoccer-prepared-player-number-chroma-key@1",
      status: "ready-source-backed-prebaked-number-alpha",
      sourcePage: PLAYER_NUMBER_PAGE_INDEX,
      sourceBands: PLAYER_NUMBER_SOURCE_BANDS,
      transparentPaletteIndex: PLAYER_NUMBER_TRANSPARENT_PALETTE_INDEX,
      nativeFaceDispatch: "source color < -2000 selects 3DENG.C polyt",
      projectionStage: "prepare-time",
      runtimeImageConstruction: false,
      runtimeAlphaMutation: false,
      shirtBackUvPresentation: "native-quad-uvs",
      shirtBackTexelPresentation:
        "vertical-and-horizontal-reflection-prebaked-in-generated-atlas",
    },
    cornerFlagPrebake: {
      schema: "cssoccer-prepared-corner-flag-texture@1",
      status: "ready-source-backed-no-wind-flag",
      sourceColorCode: CORNER_FLAG_TEXTURE.sourceColorCode,
      nativeTextureSlot: CORNER_FLAG_TEXTURE.nativeTextureSlot,
      archiveRecordIndex: CORNER_FLAG_TEXTURE.archiveRecordIndex,
      nativePage: CORNER_FLAG_TEXTURE.nativePage,
      sourceTextureTableSelector: CORNER_FLAG_TEXTURE.textureTableSelector,
      sourceTextureRecordSha256: cornerFlagCutout.textureRecordSha256,
      sourceBitmap: {
        archive: "EUROREND.DAT",
        symbol: VISUAL_PITCH_SOURCE.pitchBitmap,
        selector: CORNER_FLAG_TEXTURE.sourcePitchSelector,
        pageRow: CORNER_FLAG_TEXTURE.sourcePitchRow,
      },
      sourceUvs: cornerFlagCutout.sourceUvs,
      basisVertexIndexes: cornerFlagCutout.basisVertexIndexes,
      sourceRect: cornerFlagCutout.sourceRect,
      outputRect: {
        page: CORNER_FLAG_TEXTURE.atlasPage,
        x: cornerFlagCutout.x,
        y: cornerFlagCutout.y,
        width: cornerFlagCutout.width,
        height: cornerFlagCutout.height,
      },
      sourceTransparencyIndex: CORNER_FLAG_TEXTURE.transparentSourceIndex,
      nativePaletteRemap: CORNER_FLAG_TEXTURE.paletteRemap,
      paletteRemapAuthority: "3DENG.C remapxgfx(-1) rows 143..170 columns 177..255",
      paletteSource: CORNER_FLAG_TEXTURE.paletteSource,
      nativeFaceDispatch: "source color < -2000 selects 3DENG.C polyt",
      geometryPose: "3DENG.C wind_on == 0 point 8 = [1.751, 6.629, 1.751]",
      projectionStage: "prepare-time tight edge-basis cutout",
      runtimeImageConstruction: false,
      runtimeAlphaMutation: false,
    },
    browserAtlas: {
      path: ASSET_PATH,
      url: ASSET_URL,
      mediaType: "image/png",
      width: ATLAS_WIDTH,
      height: ATLAS_HEIGHT,
      bytes: pngBytes.length,
      sha256: assetSha256,
      indexedPixelsSha256: sha256(Buffer.concat(indexedPages)),
      rgbaSha256: sha256(rgba),
      placements,
      imageRendering: "pixelated",
      runtimeConstruction: false,
    },
    pitchSurface: {
      path: PITCH_SURFACE_PATH,
      url: PITCH_SURFACE_URL,
      mediaType: "image/png",
      width: PITCH_SURFACE_WIDTH,
      height: PITCH_SURFACE_HEIGHT,
      bytes: pitchSurfacePngBytes.length,
      sha256: pitchSurfaceSha256,
      rgbaSha256: sha256(pitchSurfaceRgba),
      worldBounds: PITCH_SURFACE_BOUNDS,
      visualPitchSource: VISUAL_PITCH_SOURCE,
      pixelAxes: { column: "renderer x", row: "renderer z" },
      componentBake: {
        mode: "native-ground-source-sampler-to-coplanar-component",
        texelsPerWorldUnit: 0.5,
        outputRenderLeaves: 1,
        sourceSamplingStage: "prepare",
        runtimeRepeat: false,
        runtimeTransform: false,
        screenProjectionParity: "separate-visual-oracle-contract",
      },
      nativeSampler: {
        file: "3DENG.C",
        producer: "ground",
        detail: 1,
        panMask: MEDIUM_PITCH_TILE.panMask,
        fixedPointShift: 15,
        periodWorldUnits: MEDIUM_PITCH_TILE.size * MEDIUM_PITCH_TILE.worldUnitsPerTexel,
        periodTexels: MEDIUM_PITCH_TILE.size,
        sourceRowStride: PAGE_SIZE,
        sourceOrigin: {
          row: MEDIUM_PITCH_TILE.sourceRow,
          column: MEDIUM_PITCH_TILE.sourceColumn,
        },
        sourceRow: "32 + (floor(renderer x / 2) & 31)",
        sourceColumn: "64 + (floor(renderer z / 2) & 31)",
        sampling: "integer-world-texel-point-sample",
      },
      imageRendering: "pixelated",
      runtimeConstruction: false,
    },
    markingPixel: {
      path: MARKING_PIXEL_PATH,
      url: MARKING_PIXEL_URL,
      mediaType: "image/png",
      width: 1,
      height: 1,
      bytes: markingPixelPngBytes.length,
      sha256: markingPixelSha256,
      rgbaSha256: sha256(markingPixelRgba),
      rgba: [255, 255, 255, 255],
      alphaMode: "opaque",
      imageRendering: "pixelated",
      runtimeConstruction: false,
    },
    hudGlyphAtlas: {
      schema: "cssoccer-prepared-native-hud-glyph-atlas@1",
      path: HUD_GLYPH_ATLAS_PATH,
      url: HUD_GLYPH_ATLAS_URL,
      mediaType: "image/png",
      width: HUD_GLYPH_ATLAS_WIDTH,
      height: HUD_GLYPH_ATLAS_HEIGHT,
      bytes: hudGlyphAtlas.pngBytes.length,
      sha256: hudGlyphAtlas.sha256,
      rgbaSha256: sha256(hudGlyphAtlas.rgba),
      source: {
        data: { file: "EUROREND.DAT", ...PINNED_NATIVE_ARCHIVE.data },
        index: { file: "EUROREND.OFF", ...PINNED_NATIVE_ARCHIVE.index },
        page: PINNED_NATIVE_ARCHIVE.glyphPage,
        sourceRect: {
          x: HUD_FONT.sourceX,
          y: HUD_FONT.sourcePitchRow,
          width: HUD_GLYPH_ATLAS_WIDTH,
          height: HUD_GLYPH_BAND_HEIGHT,
        },
      },
      font: HUD_FONT,
      colorBands: hudGlyphAtlas.colorBands,
      layout: HUD_NATIVE_LAYOUT,
      sourceDrawContract: {
        file: "3DENG.C",
        functions: ["string_len", "draw_string", "draw_sprite"],
        zero: "transparent",
        one: "replace with draw_string colour index",
        greaterThanOne: "decrement source palette index by one",
        advance: "proportional glyph width plus one source pixel",
      },
      stringMapping: {
        lowercase: "uppercase",
        space: ";",
        period: "@",
        comma: "?",
        letterO: "0",
        ampersand: "O",
      },
      imageRendering: "pixelated",
      runtimeConstruction: false,
    },
    stadiumAtlas: {
      schema: "cssoccer-prepared-native-stadium-atlas@1",
      path: STADIUM_ATLAS_PATH,
      url: STADIUM_ATLAS_URL,
      mediaType: "image/png",
      width: STADIUM_ATLAS_WIDTH,
      height: STADIUM_ATLAS_HEIGHT,
      bytes: stadiumAtlas.pngBytes.length,
      sha256: stadiumAtlas.sha256,
      indexedPixelsSha256: stadiumAtlas.indexedPixelsSha256,
      rgbaSha256: sha256(stadiumAtlas.rgba),
      source: {
        data: { file: "EUROREND.DAT", ...PINNED_NATIVE_ARCHIVE.data },
        index: { file: "EUROREND.OFF", ...PINNED_NATIVE_ARCHIVE.index },
        engineObject: { file: "3DENG.OBJ", ...PINNED_STADIUM_ENGINE_OBJECT },
        selectorAuthority: stadiumSelectors.bindingAuthority,
      },
      textureTable: {
        symbol: stadiumSelectors.textures.tableSymbol,
        selector: stadiumSelectors.textures.tableSelector,
        bytes: stadiumSelectors.textures.tableRecord.size,
        records: stadiumAtlas.textureRecords.length,
        recordBytes: 32,
        coordinateEncoding: "native map-page byte plus unsigned 16.16 texel coordinate",
        coordinateOrder: "texture[0..np) = T/Y; texture[np..2np) = S/X",
        nativeCarryMask: "3DENG.C clears the low byte of every coordinate word",
        sha256: stadiumAtlas.textureTableSha256,
      },
      mapPages: stadiumSelectors.textures.bitmapSelectors.map((selector, index) => ({
        symbol: stadiumSelectors.textures.bitmapSymbols[index],
        selector,
        nativePage: stadiumSelectors.textures.nativeMapPages[index],
        atlasX: index * PAGE_SIZE,
        width: PAGE_SIZE,
        height: PAGE_SIZE,
        sha256: stadiumAtlas.pageSha256[index],
      })),
      palette: {
        selector: 0,
        symbol: "PAL_FOOTY",
        entries: 256,
        sha256: stadiumAtlas.paletteSha256,
        overrides: STADIUM_PALETTE_OVERRIDES,
      },
      sourceFaceBinding: {
        opaque: "source -N binds texture record N-1",
        masked: "source -(2000+N) binds texture record N-1",
        nativeRebase: "3DENG.C subtracts S_TM-1 before polygon rendering",
      },
      triangleCutouts: {
        count: stadiumAtlas.triangleCutouts.length,
        textureIndexes: [...new Set(
          stadiumAtlas.triangleCutouts.map(({ textureIndex }) => textureIndex),
        )],
        opaque: stadiumAtlas.triangleCutouts.filter(({ alphaMode }) => alphaMode === "opaque").length,
        masked: stadiumAtlas.triangleCutouts.filter(({ alphaMode }) => alphaMode === "mask").length,
        directImageBasis: {
          edgeParallelogram: stadiumAtlas.triangleCutouts.filter(({
            directImageTransform,
          }) => directImageTransform === "edge-basis").length,
          authority: "cyclic source-triangle basis with minimum UV edge area",
          cameraSafety: "prepared quad stays adjacent to its three source vertices",
        },
        mode: "prepare-time tight edge-basis cutout for native triangles and split quads",
      },
      goalNets: {
        schema: "cssoccer-prepared-native-goal-nets@1",
        status: "ready-source-backed-bm-nets",
        bitmap: {
          symbol: GOAL_NET_TEXTURE.bitmapSymbol,
          selector: GOAL_NET_TEXTURE.bitmapSelector,
          selectorAuthority: GOAL_NET_TEXTURE.selectorAuthority,
          nativePage: GOAL_NET_TEXTURE.nativePage,
          width: PAGE_SIZE,
          height: PAGE_SIZE,
          sourceSha256: stadiumAtlas.goalNetSourceBitmapSha256,
          remappedSha256: stadiumAtlas.goalNetRemappedBitmapSha256,
        },
        textureTableSelector: GOAL_NET_TEXTURE.textureTableSelector,
        nativeTextureSlots: stadiumAtlas.goalNetTextureRecords.map((record) => ({
          nativeTextureSlot: record.nativeTextureSlot,
          archiveRecordIndex: record.archiveRecordIndex,
          sourceColorCode: record.sourceColorCode,
          nativePage: record.page,
          textureRecordSha256: record.sha256,
        })),
        paletteSha256: stadiumAtlas.goalNetPaletteSha256,
        softwarePaletteRemap: GOAL_NET_TEXTURE.softwarePaletteRemap,
        transparentPaletteIndex: GOAL_NET_TEXTURE.transparentPaletteIndex,
        remapAuthority: "3DENG.C setscreen remapgfx(1) over maps[S_BM+2..S_BM+7]",
        triangleCutoutCount: stadiumAtlas.goalNetTriangleCutouts.length,
        atlasRegion: GOAL_NET_TEXTURE.atlasRegion,
        projectionStage: "prepare-time tight edge-basis cutout",
        runtimeImageConstruction: false,
        runtimeAlphaMutation: false,
      },
      placements: stadiumAtlas.placements,
      imageRendering: "pixelated",
      runtimeConstruction: false,
    },
    skyBackdrop: skyBackdrop.metadata,


    nativeRemaps: [
      "team B head skin indices 80..87 shift to 88..95",
      "team B torso and limbs kit indices 32..55 shift to 56..79",
      "team B torso and limbs skin indices 80..87 shift to 88..95",
      "team B number rows 89..115 kit indices 33..56 shift by 24 and skin indices 81..88 shift by 8",
    ],
    editionVariantBindings: [
      "BM_PA selector 1920 after three demo-omitted late KGRID records",
      "BM_PA occupies the 64-row native extra-map pitch region",
      "full-detail pitch sampling repeats the leading 64 by 64 texels via pan mask 0x3f3f",
      "retained native EUROREND selector 920 supplies the frame-50 BM_PC pitch bitmap",
      "retained native EUROREND selector 544 supplies the frame-50 COL_P5 pitch palette",
      "medium-detail pitch sampling repeats the 32 by 32 tile at row 32 column 64 via pan mask 0x1f1f",
      "BM_XARGENTI selector 96 supplies the complete 256 by 256 Argentina kit page",
      "retail TMD_TEXDATA slots 549 through 578 supply all fifteen Spain and Argentina shirt-number records",
      "COL_XCAUCASA selector 1536 supplies the user-validated eight-entry skin palette",
    ],
  });

  return Object.freeze({
    metadata,
    asset: metadata.browserAtlas,
    assetFile: Object.freeze({
      path: ASSET_PATH,
      mediaType: "image/png",
      bytes: pngBytes,
      expectedSha256: assetSha256,
    }),
    pitchSurfaceAssetFile: Object.freeze({
      path: PITCH_SURFACE_PATH,
      mediaType: "image/png",
      bytes: pitchSurfacePngBytes,
      expectedSha256: pitchSurfaceSha256,
    }),
    markingPixelAssetFile: Object.freeze({
      path: MARKING_PIXEL_PATH,
      mediaType: "image/png",
      bytes: markingPixelPngBytes,
      expectedSha256: markingPixelSha256,
    }),
    hudGlyphAssetFile: Object.freeze({
      path: HUD_GLYPH_ATLAS_PATH,
      mediaType: "image/png",
      bytes: hudGlyphAtlas.pngBytes,
      expectedSha256: hudGlyphAtlas.sha256,
    }),
    stadiumAssetFile: Object.freeze({
      path: STADIUM_ATLAS_PATH,
      mediaType: "image/png",
      bytes: stadiumAtlas.pngBytes,
      expectedSha256: stadiumAtlas.sha256,
    }),
    skyBackdropAssetFile: Object.freeze({
      path: SKY_BACKDROP_PATH,
      mediaType: "image/png",
      bytes: skyBackdrop.pngBytes,
      expectedSha256: skyBackdrop.sha256,
    }),
    textureRecords,
    pageMaterials: Object.freeze(pageMaterials),
    officialSourceAtlas,
    markingMaterial,
    stadiumTextureRecords: stadiumAtlas.textureRecords,
    stadiumPageMaterials: stadiumAtlas.pageMaterials,
    stadiumTriangleCutouts: stadiumAtlas.triangleCutouts,
    stadiumTriangleMaterials: stadiumAtlas.triangleMaterials,
    goalNetTextureRecords: stadiumAtlas.goalNetTextureRecords,
    goalNetTriangleCutouts: stadiumAtlas.goalNetTriangleCutouts,
    goalNetTriangleMaterials: stadiumAtlas.goalNetTriangleMaterials,
    cornerFlagTexture: deepFreeze({
      sourceColorCode: CORNER_FLAG_TEXTURE.sourceColorCode,
      nativeTextureSlot: CORNER_FLAG_TEXTURE.nativeTextureSlot,
      archiveRecordIndex: CORNER_FLAG_TEXTURE.archiveRecordIndex,
      nativePage: CORNER_FLAG_TEXTURE.nativePage,
      material: cornerFlagMaterial,
      uvs: FULL_IMAGE_UVS,
      sourceUvs: cornerFlagCutout.sourceUvs,
      sourceRect: cornerFlagCutout.sourceRect,
      basisVertexIndexes: cornerFlagCutout.basisVertexIndexes,
      textureRecordSha256: cornerFlagCutout.textureRecordSha256,
      transparent: true,
    }),
    pitchMaterial,
    pitchUvs: deepFreeze([[0, 1], [1, 1], [1, 0], [0, 0]]),
  });
}

/** Bind an exact native textured quad that does not belong to a player body panel. */
export function bindCssoccerPreparedTextureRecord(preparation, sourceColorCode) {
  if (
    !preparation
    || !Array.isArray(preparation.textureRecords)
    || !Array.isArray(preparation.pageMaterials)
  ) {
    throw new TypeError("Prepared source texture binding requires ACTREND records and pages.");
  }
  if (!Number.isSafeInteger(sourceColorCode) || sourceColorCode >= 0) {
    throw new RangeError("Prepared source texture binding requires a negative native color code.");
  }
  const nativeTextureSlot = sourceColorCode < -2000
    ? -sourceColorCode - 2000
    : -sourceColorCode;
  const archiveRecordIndex = nativeTextureSlot - 1;
  const record = preparation.textureRecords[archiveRecordIndex];
  const pageMaterial = record === undefined ? undefined : preparation.pageMaterials[record.page];
  if (
    !record
    || record.quadLayout !== true
    || record.page < 0
    || record.page >= PLAYER_PAGE_COUNT
    || !pageMaterial
    || !record.sourceRect
    || !Array.isArray(record.normalizedUvs)
    || record.normalizedUvs.length !== 4
  ) {
    throw new Error(`Native texture slot ${nativeTextureSlot} is not a prepared player-page quad.`);
  }
  const material = createAtlasMaterial({
    page: record.page,
    ...record.sourceRect,
    assetSha256: pageMaterial.assetSha256,
    key: `cssoccer-source-quad-slot-${nativeTextureSlot}`,
  });
  return deepFreeze({
    sourceColorCode,
    nativeTextureSlot,
    archiveRecordIndex,
    page: record.page,
    transparent: sourceColorCode < -2000,
    material,
    uvs: record.normalizedUvs,
    sourceUvs: record.uvs,
    sourceRect: record.sourceRect,
    textureRecordSha256: record.sha256,
  });
}

/** Bind the exact no-wind page-six corner pennant prepared into the match atlas. */
export function bindCssoccerCornerFlagTexture(preparation, sourceColorCode) {
  if (sourceColorCode !== CORNER_FLAG_TEXTURE.sourceColorCode) {
    throw new RangeError(
      `Corner-flag preparation only accepts source texture ${CORNER_FLAG_TEXTURE.sourceColorCode}.`,
    );
  }
  const binding = preparation?.cornerFlagTexture;
  if (
    !binding
    || binding.sourceColorCode !== CORNER_FLAG_TEXTURE.sourceColorCode
    || binding.nativeTextureSlot !== CORNER_FLAG_TEXTURE.nativeTextureSlot
    || binding.archiveRecordIndex !== CORNER_FLAG_TEXTURE.archiveRecordIndex
    || binding.nativePage !== CORNER_FLAG_TEXTURE.nativePage
    || binding.transparent !== true
    || !binding.material?.imageSource
    || !Array.isArray(binding.uvs)
    || binding.uvs.length !== 4
    || !Array.isArray(binding.sourceUvs)
    || binding.sourceUvs.length !== 3
    || !Array.isArray(binding.basisVertexIndexes)
    || binding.basisVertexIndexes.length !== 3
  ) {
    throw new Error("Prepared native corner-flag texture binding is incomplete.");
  }
  return binding;
}

 function prepareSkyBackdrop(nativeArchive, footyPalette) {
  const bitmap = nativeArchive.recordBytes(VISUAL_SKY_SOURCE.bitmapSelector);
  const paletteOverride = nativeArchive.recordBytes(VISUAL_SKY_SOURCE.paletteSelector);
  if (bitmap.length !== VISUAL_SKY_SOURCE.bitmapBytes) {
    throw new Error(
      `${VISUAL_SKY_SOURCE.bitmap} is not a ${VISUAL_SKY_SOURCE.width} by ${VISUAL_SKY_SOURCE.height} indexed sky.`,
    );
  }
  if (paletteOverride.length !== VISUAL_SKY_SOURCE.paletteEntries * 3) {
    throw new Error(`${VISUAL_SKY_SOURCE.palette} is not a 16-entry VGA palette.`);
  }
  const palette = Buffer.from(footyPalette);
  paletteOverride.copy(palette, VISUAL_SKY_SOURCE.paletteFirstEntry * 3);
  const rgba = Buffer.alloc(bitmap.length * 4);
  for (let index = 0; index < bitmap.length; index += 1) {
    const paletteOffset = bitmap[index] * 3;
    const target = index * 4;
    rgba[target] = expandVgaComponent(palette[paletteOffset]);
    rgba[target + 1] = expandVgaComponent(palette[paletteOffset + 1]);
    rgba[target + 2] = expandVgaComponent(palette[paletteOffset + 2]);
    rgba[target + 3] = 255;
  }
  const pngBytes = encodeRgbaPng(
    VISUAL_SKY_SOURCE.width,
    VISUAL_SKY_SOURCE.height,
    rgba,
  );
  const assetSha256 = sha256(pngBytes);
  return Object.freeze({
    metadata: deepFreeze({
      schema: "cssoccer-prepared-native-sky-backdrop@1",
      status: "ready-source-decoded-native-sky",
      path: SKY_BACKDROP_PATH,
      url: SKY_BACKDROP_URL,
      mediaType: "image/png",
      width: VISUAL_SKY_SOURCE.width,
      height: VISUAL_SKY_SOURCE.height,
      bytes: pngBytes.length,
      sha256: assetSha256,
      rgbaSha256: sha256(rgba),
      indexedPixelsSha256: sha256(bitmap),
      source: {
        ...VISUAL_SKY_SOURCE,
        data: { file: "EUROREND.DAT", ...PINNED_NATIVE_ARCHIVE.data },
        index: { file: "EUROREND.OFF", ...PINNED_NATIVE_ARCHIVE.index },
        basePalette: { file: "FOOTY.PAL", ...PINNED_FOOTY_PALETTE },
        bitmapSha256: sha256(bitmap),
        paletteSha256: sha256(paletteOverride),
      },
      projection: {
        schema: "cssoccer-native-sky-projection@1",
        sourceFile: "3DENG.C",
        sourceRoutine: "ground",
        panoramaArcRadians: 2 * 3.1415 / 3,
        horizontalRepeat: true,
        referenceViewport: [320, 200],
        referencePerspective: 220,
        referenceSourceOrigin: [0, 390],
      },
      imageRendering: "pixelated",
      runtimeConstruction: false,
    }),
    pngBytes,
    sha256: assetSha256,
  });
}

function prepareStadiumAtlas(nativeArchive, stadiumSelectors, matchPalette) {
  const selectors = stadiumSelectors?.textures;
  if (
    selectors?.tableRecord?.size !== 49 * 32
    || !Array.isArray(selectors.bitmapSelectors)
    || selectors.bitmapSelectors.length !== STADIUM_PAGE_COUNT
    || JSON.stringify(selectors.nativeMapPages) !== "[8,9]"
  ) {
    throw new Error("Prepared stadium atlas requires the compiled simple-stadium texture binding.");
  }
  const textureAlphaModes = stadiumTextureAlphaModes(nativeArchive, stadiumSelectors);
  const textureTableBytes = nativeArchive.recordBytes(selectors.tableSelector);
  const textureRecords = decodeStadiumTextureRecords(textureTableBytes);
  if (
    textureRecords.length !== 49
    || textureRecords.some(({ page, rawWords, vertexCount }) => (
      !selectors.nativeMapPages.includes(page)
      || ![3, 4].includes(vertexCount)
      || rawWords.slice(0, vertexCount).some((word) => word >>> 24 !== page)
    ))
  ) {
    throw new Error("TMD_STAD0 changed from 49 triangle-or-quad records on native map pages 8 and 9.");
  }
  const indexedPages = selectors.bitmapSelectors.map((selector) => {
    const page = nativeArchive.recordBytes(selector);
    if (page.length !== PAGE_SIZE * PAGE_SIZE) {
      throw new Error(`Stadium map selector ${selector} is not a 256 by 256 indexed page.`);
    }
    return page;
  });
  const palette = Buffer.from(nativeArchive.recordBytes(0));
  if (palette.length !== 256 * 3) {
    throw new Error("Native PAL_FOOTY is not a 256-entry VGA palette.");
  }
  for (const override of STADIUM_PALETTE_OVERRIDES) {
    const payload = nativeArchive.recordBytes(override.selector);
    if (payload.length !== override.entries * 3) {
      throw new Error(`Stadium palette ${override.symbol} changed byte length.`);
    }
    payload.copy(palette, override.firstEntry * 3);
  }
  const rgba = renderStadiumAtlasRgba(indexedPages, palette);
  const triangleCutouts = prebakeStadiumTriangleCutouts({
    indexedPages,
    palette,
    rgba,
    textureAlphaModes,
    textureRecords,
  });
  const goalNet = prepareGoalNetCutouts({
    nativeArchive,
    palette: matchPalette,
    rgba,
  });
  const pngBytes = encodeRgbaPng(STADIUM_ATLAS_WIDTH, STADIUM_ATLAS_HEIGHT, rgba);
  const assetSha256 = sha256(pngBytes);
  const pageMaterials = selectors.nativeMapPages.map((nativePage, atlasPage) => (
    createAtlasMaterial({
      page: atlasPage,
      assetSha256,
      height: PAGE_SIZE,
      key: `cssoccer-source-stadium-page-${nativePage}`,
      assetUrl: STADIUM_ATLAS_URL,
      imageWidth: STADIUM_ATLAS_WIDTH,
      imageHeight: STADIUM_ATLAS_HEIGHT,
    })
  ));
  const triangleMaterials = Array.from({ length: textureRecords.length }, () => []);
  for (const cutout of triangleCutouts) {
    triangleMaterials[cutout.textureIndex][cutout.triangleIndex] = createAtlasMaterial({
      page: 0,
      x: cutout.x,
      y: cutout.y,
      width: cutout.width,
      height: cutout.height,
      assetSha256,
      key: `cssoccer-stadium-triangle-${cutout.textureIndex}-${cutout.triangleIndex}`,
      assetUrl: STADIUM_ATLAS_URL,
      imageWidth: STADIUM_ATLAS_WIDTH,
      imageHeight: STADIUM_ATLAS_HEIGHT,
    });
  }
  const goalNetTriangleMaterials = Array.from(
    { length: goalNet.textureRecords.length },
    () => [],
  );
  for (const cutout of goalNet.triangleCutouts) {
    goalNetTriangleMaterials[cutout.textureIndex][cutout.triangleIndex] = createAtlasMaterial({
      page: 0,
      x: cutout.x,
      y: cutout.y,
      width: cutout.width,
      height: cutout.height,
      assetSha256,
      key: `cssoccer-goal-net-triangle-${cutout.nativeTextureSlot}-${cutout.triangleIndex}`,
      assetUrl: STADIUM_ATLAS_URL,
      imageWidth: STADIUM_ATLAS_WIDTH,
      imageHeight: STADIUM_ATLAS_HEIGHT,
    });
  }
  const nativePagePlacements = selectors.nativeMapPages.map((nativePage, atlasPage) => ({
    id: `native-stadium-page-${nativePage}`,
    nativePage,
    atlasPage,
    x: atlasPage * PAGE_SIZE,
    y: 0,
    width: PAGE_SIZE,
    height: PAGE_SIZE,
  }));
  return Object.freeze({
    indexedPixelsSha256: sha256(Buffer.concat(indexedPages)),
    pageMaterials: Object.freeze(pageMaterials),
    triangleMaterials: deepFreeze(triangleMaterials),
    triangleCutouts,
    goalNetTextureRecords: goalNet.textureRecords,
    goalNetTriangleMaterials: deepFreeze(goalNetTriangleMaterials),
    goalNetTriangleCutouts: goalNet.triangleCutouts,
    goalNetSourceBitmapSha256: goalNet.sourceBitmapSha256,
    goalNetRemappedBitmapSha256: goalNet.remappedBitmapSha256,
    goalNetPaletteSha256: goalNet.paletteSha256,
    textureAlphaModes,
    pageSha256: Object.freeze(indexedPages.map((page) => sha256(page))),
    paletteSha256: sha256(palette),
    placements: deepFreeze([
      ...nativePagePlacements,
      ...goalNet.triangleCutouts,
      ...triangleCutouts,
    ]),
    pngBytes,
    rgba,
    sha256: assetSha256,
    textureRecords,
    textureTableSha256: sha256(textureTableBytes),
  });
}

function prepareGoalNetCutouts({ nativeArchive, palette, rgba }) {
  if (!Buffer.isBuffer(palette) || palette.length !== 256 * 3) {
    throw new TypeError("Goal-net preparation requires the complete match palette.");
  }
  if (!Buffer.isBuffer(rgba) || rgba.length !== STADIUM_ATLAS_WIDTH * STADIUM_ATLAS_HEIGHT * 4) {
    throw new TypeError("Goal-net preparation requires the complete stadium atlas target.");
  }
  const textureTableBytes = nativeArchive.recordBytes(GOAL_NET_TEXTURE.textureTableSelector);
  const textureRecords = decodeGoalNetTextureRecords(textureTableBytes);
  const sourceBitmap = nativeArchive.recordBytes(GOAL_NET_TEXTURE.bitmapSelector);
  if (
    sourceBitmap.length !== PAGE_SIZE * PAGE_SIZE
    || sha256(sourceBitmap) !== GOAL_NET_TEXTURE.sourceBitmapSha256
  ) {
    throw new Error("Native BM_NETS changed from the pinned 256 by 256 goal-net page.");
  }
  // The software renderer calls remapgfx(1) before drawing. BM_NETS index 0
  // therefore becomes its transparent index 1, and every visible texel uses
  // the same exact byte increment before the global match palette lookup.
  const remappedBitmap = Buffer.from(sourceBitmap);
  for (let index = 0; index < remappedBitmap.length; index += 1) {
    remappedBitmap[index] = (
      remappedBitmap[index] + GOAL_NET_TEXTURE.softwarePaletteRemap
    ) & 0xff;
  }
  if (!remappedBitmap.includes(GOAL_NET_TEXTURE.transparentPaletteIndex)) {
    throw new Error("Native BM_NETS lost its remapgfx transparency texels.");
  }
  const specs = textureRecords
    .flatMap((record) => stadiumTextureTriangleVertexSets(record).map((sourceVertexIndexes, triangleIndex) => {
      const spec = triangleCutoutSpec(
        record,
        triangleIndex,
        sourceVertexIndexes,
        "mask",
      );
      spec.id = `native-goal-net-triangle-${record.nativeTextureSlot}-${triangleIndex}`;
      spec.kind = "prebaked-native-goal-net-triangle";
      spec.nativeTextureSlot = record.nativeTextureSlot;
      spec.sourceColorCode = record.sourceColorCode;
      return spec;
    }))
    .sort((left, right) => (
      right.height - left.height
      || right.width - left.width
      || left.nativeTextureSlot - right.nativeTextureSlot
      || left.triangleIndex - right.triangleIndex
    ));
  packGoalNetCutouts(specs);
  for (const spec of specs) {
    rasterGoalNetTriangleCutout({
      indexedPage: remappedBitmap,
      palette,
      rgba,
      spec,
    });
  }
  return deepFreeze({
    textureRecords,
    triangleCutouts: specs.sort((left, right) => (
      left.textureIndex - right.textureIndex
      || left.triangleIndex - right.triangleIndex
    )),
    sourceBitmapSha256: sha256(sourceBitmap),
    remappedBitmapSha256: sha256(remappedBitmap),
    paletteSha256: sha256(palette),
  });
}

function decodeGoalNetTextureRecords(textureTableBytes) {
  const records = [];
  for (
    let nativeTextureSlot = GOAL_NET_TEXTURE.firstNativeTextureSlot;
    nativeTextureSlot <= GOAL_NET_TEXTURE.finalNativeTextureSlot;
    nativeTextureSlot += 1
  ) {
    const archiveRecordIndex = nativeTextureSlot - 1;
    const recordBytes = textureTableBytes.subarray(
      archiveRecordIndex * 32,
      archiveRecordIndex * 32 + 32,
    );
    if (recordBytes.length !== 32) {
      throw new Error(`Native goal-net texture slot ${nativeTextureSlot} is unavailable.`);
    }
    const decoded = decodeStadiumTextureRecords(recordBytes)[0];
    const textureIndex = nativeTextureSlot - GOAL_NET_TEXTURE.firstNativeTextureSlot;
    if (decoded.page !== GOAL_NET_TEXTURE.nativePage || decoded.vertexCount !== 4) {
      throw new Error(
        `Native goal-net slot ${nativeTextureSlot} changed from its page-15 quad.`,
      );
    }
    records.push(deepFreeze({
      ...decoded,
      textureIndex,
      nativeTextureSlot,
      archiveRecordIndex,
      sourceColorCode: -2000 - nativeTextureSlot,
    }));
  }
  return Object.freeze(records);
}

function packGoalNetCutouts(specs) {
  const region = GOAL_NET_TEXTURE.atlasRegion;
  const tall = specs.filter(({ height }) => height > PAGE_SIZE / 2);
  const compact = specs.filter(({ height }) => height <= PAGE_SIZE / 2);
  let x = region.x;
  for (const spec of tall) {
    spec.x = x;
    spec.y = region.y;
    x += spec.width;
  }
  if (x >= region.x + region.width) {
    throw new Error("Prepared native goal-net tall cutouts exceed their fixed atlas region.");
  }
  let rowX = x;
  let rowY = region.y;
  let rowHeight = 0;
  for (const spec of compact) {
    if (rowX + spec.width > region.x + region.width) {
      rowY += rowHeight;
      rowX = x;
      rowHeight = 0;
    }
    spec.x = rowX;
    spec.y = rowY;
    rowX += spec.width;
    rowHeight = Math.max(rowHeight, spec.height);
  }
  const usedBottom = Math.max(
    ...specs.map(({ y, height }) => y + height),
    region.y,
  );
  if (usedBottom > region.y + region.height) {
    throw new Error("Prepared native goal-net cutouts exceed their fixed atlas region.");
  }
}

function rasterGoalNetTriangleCutout({ indexedPage, palette, rgba, spec }) {
  for (let y = 0; y < spec.height; y += 1) {
    for (let x = 0; x < spec.width; x += 1) {
      const s = (x + 0.5) / spec.width;
      const t = (y + 0.5) / spec.height;
      if (s + t > 1) continue;
      const sourceU = spec.basis.origin[0] + spec.basis.uEdge[0] * s + spec.basis.vEdge[0] * t;
      const sourceV = spec.basis.origin[1] + spec.basis.uEdge[1] * s + spec.basis.vEdge[1] * t;
      const sourceX = clamp(Math.floor(sourceU * PAGE_SIZE), 0, PAGE_SIZE - 1);
      const sourceY = clamp(Math.floor((1 - sourceV) * PAGE_SIZE), 0, PAGE_SIZE - 1);
      const paletteIndex = indexedPage[sourceY * PAGE_SIZE + sourceX];
      const targetY = spec.y + spec.height - 1 - y;
      const target = (targetY * STADIUM_ATLAS_WIDTH + spec.x + x) * 4;
      rgba[target] = expandVgaComponent(palette[paletteIndex * 3]);
      rgba[target + 1] = expandVgaComponent(palette[paletteIndex * 3 + 1]);
      rgba[target + 2] = expandVgaComponent(palette[paletteIndex * 3 + 2]);
      rgba[target + 3] = paletteIndex === GOAL_NET_TEXTURE.transparentPaletteIndex ? 0 : 255;
    }
  }
}

function stadiumTextureAlphaModes(nativeArchive, stadiumSelectors) {
  const modes = Array.from({ length: 49 }, () => null);
  for (const binding of stadiumSelectors.bindings ?? []) {
    const faces = decodeActuaFaceList(nativeArchive.recordBytes(binding.facesSelector), {
      id: binding.facesFile,
      pointCount: binding.pointCount,
    });
    for (const face of faces.faces) {
      const sourceColorCode = face.sourceColorCode;
      if (sourceColorCode >= 0) continue;
      const textureIndex = sourceColorCode < -2000
        ? -sourceColorCode - 2001
        : -sourceColorCode - 1;
      const alphaMode = sourceColorCode < -2000 ? "mask" : "opaque";
      if (textureIndex < 0 || textureIndex >= modes.length) {
        throw new Error(`${binding.facesFile} references unavailable stadium texture ${sourceColorCode}.`);
      }
      if (modes[textureIndex] && modes[textureIndex] !== alphaMode) {
        throw new Error(`Stadium texture ${textureIndex} mixes opaque and masked source faces.`);
      }
      modes[textureIndex] = alphaMode;
    }
  }
  if (modes.some((mode) => mode === null)) {
    throw new Error("The simple stadium no longer accounts for every TMD_STAD0 texture record.");
  }
  return Object.freeze(modes);
}

function renderStadiumAtlasRgba(indexedPages, palette) {
  const rgba = Buffer.alloc(STADIUM_ATLAS_WIDTH * STADIUM_ATLAS_HEIGHT * 4);
  for (let pageIndex = 0; pageIndex < indexedPages.length; pageIndex += 1) {
    const indexed = indexedPages[pageIndex];
    for (let y = 0; y < PAGE_SIZE; y += 1) {
      for (let x = 0; x < PAGE_SIZE; x += 1) {
        const paletteIndex = indexed[y * PAGE_SIZE + x];
        const target = (y * STADIUM_ATLAS_WIDTH + pageIndex * PAGE_SIZE + x) * 4;
        rgba[target] = expandVgaComponent(palette[paletteIndex * 3]);
        rgba[target + 1] = expandVgaComponent(palette[paletteIndex * 3 + 1]);
        rgba[target + 2] = expandVgaComponent(palette[paletteIndex * 3 + 2]);
        rgba[target + 3] = 255;
      }
    }
  }
  return rgba;
}

function prebakeStadiumTriangleCutouts({
  indexedPages,
  palette,
  rgba,
  textureAlphaModes,
  textureRecords,
}) {
  const specs = textureRecords
    .flatMap((record) => stadiumTextureTriangleVertexSets(record).map((sourceVertexIndexes, triangleIndex) => (
      triangleCutoutSpec(
        record,
        triangleIndex,
        sourceVertexIndexes,
        textureAlphaModes[record.textureIndex],
      )
    )))
    .sort((left, right) => (
      right.height - left.height
      || right.width - left.width
      || left.textureIndex - right.textureIndex
      || left.triangleIndex - right.triangleIndex
    ));
  const rows = [];
  for (const spec of specs) {
    let row = rows.find((candidate) => candidate.x + spec.width <= STADIUM_ATLAS_WIDTH);
    if (!row) {
      row = {
        x: 0,
        y: PAGE_SIZE + rows.reduce((sum, candidate) => sum + candidate.height, 0),
        height: spec.height,
      };
      rows.push(row);
    }
    spec.x = row.x;
    spec.y = row.y;
    row.x += spec.width;
    if (spec.y + spec.height > STADIUM_ATLAS_HEIGHT) {
      throw new Error(
        `Prepared stadium triangle cutouts no longer fit the fixed ${STADIUM_ATLAS_WIDTH} `
        + `by ${STADIUM_ATLAS_HEIGHT} atlas.`,
      );
    }
    rasterStadiumTriangleCutout({ indexedPages, palette, rgba, spec });
  }
  return deepFreeze(specs.sort((left, right) => (
    left.textureIndex - right.textureIndex
    || left.triangleIndex - right.triangleIndex
  )));
}

function stadiumTextureTriangleVertexSets(record) {
  return record.vertexCount === 3
    ? [[0, 1, 2]]
    : [[0, 1, 2], [0, 2, 3]];
}

function triangleCutoutSpec(
  record,
  triangleIndex,
  sourceVertexIndexes,
  alphaMode,
) {
  const basisVertexIndexes = minimumAreaTriangleBasis(sourceVertexIndexes, record.uvs);
  const sourceTriangle = basisVertexIndexes.map((index) => record.uvs[index]);
  const sourceXs = sourceTriangle.map(([u]) => u * PAGE_SIZE);
  const sourceYs = sourceTriangle.map(([, v]) => (1 - v) * PAGE_SIZE);
  const sourceLeft = Math.floor(Math.min(...sourceXs));
  const sourceRight = Math.ceil(Math.max(...sourceXs));
  const sourceTop = Math.floor(Math.min(...sourceYs));
  const sourceBottom = Math.ceil(Math.max(...sourceYs));
  const sourceWidth = Math.max(1, sourceRight - sourceLeft);
  const sourceHeight = Math.max(1, sourceBottom - sourceTop);
  const [uvOrigin, uvU, uvV] = sourceTriangle;
  const uEdge = [uvU[0] - uvOrigin[0], uvU[1] - uvOrigin[1]];
  const vEdge = [uvV[0] - uvOrigin[0], uvV[1] - uvOrigin[1]];
  const width = Math.max(1, Math.ceil(Math.hypot(...uEdge) * PAGE_SIZE));
  const height = Math.max(1, Math.ceil(Math.hypot(...vEdge) * PAGE_SIZE));
  const minU = Math.min(...sourceTriangle.map(([u]) => u));
  const maxU = Math.max(...sourceTriangle.map(([u]) => u));
  const minV = Math.min(...sourceTriangle.map(([, v]) => v));
  const maxV = Math.max(...sourceTriangle.map(([, v]) => v));
  if (!(maxU > minU) || !(maxV > minV)) {
    throw new Error(
      `Native stadium texture ${record.textureIndex} triangle ${triangleIndex} has degenerate UV bounds.`,
    );
  }
  return {
    id: `native-stadium-triangle-${record.textureIndex}-${triangleIndex}`,
    kind: "prebaked-native-texture-triangle",
    textureIndex: record.textureIndex,
    triangleIndex,
    sourceVertexIndexes,
    basisVertexIndexes,
    alphaMode,
    directImageTransform: "edge-basis",
    nativePage: record.page,
    sourceRect: {
      x: sourceLeft,
      y: sourceTop,
      width: sourceWidth,
      height: sourceHeight,
    },
    uvBounds: { minU, maxU, minV, maxV },
    basis: {
      origin: uvOrigin,
      uEdge,
      vEdge,
    },
    sourceTriangle,
    width,
    height,
    x: 0,
    y: 0,
  };
}

function minimumAreaTriangleBasis(sourceVertexIndexes, uvs) {
  const candidates = sourceVertexIndexes.map((_unused, offset) => {
    const indexes = [0, 1, 2].map((index) => (
      sourceVertexIndexes[(index + offset) % sourceVertexIndexes.length]
    ));
    const [origin, pointU, pointV] = indexes.map((index) => uvs[index]);
    const width = Math.max(1, Math.ceil(Math.hypot(
      pointU[0] - origin[0],
      pointU[1] - origin[1],
    ) * PAGE_SIZE));
    const height = Math.max(1, Math.ceil(Math.hypot(
      pointV[0] - origin[0],
      pointV[1] - origin[1],
    ) * PAGE_SIZE));
    return { indexes, width, height, area: width * height, offset };
  });
  candidates.sort((left, right) => (
    left.area - right.area
    || Math.max(left.width, left.height) - Math.max(right.width, right.height)
    || left.offset - right.offset
  ));
  return candidates[0].indexes;
}

function rasterStadiumTriangleCutout({ indexedPages, palette, rgba, spec }) {
  const pageIndex = spec.nativePage - 8;
  const indexed = indexedPages[pageIndex];
  if (!indexed) throw new Error(`Native stadium page ${spec.nativePage} is unavailable.`);
  for (let y = 0; y < spec.height; y += 1) {
    for (let x = 0; x < spec.width; x += 1) {
      const s = (x + 0.5) / spec.width;
      const t = (y + 0.5) / spec.height;
      if (s + t > 1) continue;
      const sourceU = spec.basis.origin[0] + spec.basis.uEdge[0] * s + spec.basis.vEdge[0] * t;
      const sourceV = spec.basis.origin[1] + spec.basis.uEdge[1] * s + spec.basis.vEdge[1] * t;
      const sourceX = clamp(Math.floor(sourceU * PAGE_SIZE), 0, PAGE_SIZE - 1);
      const sourceY = clamp(Math.floor((1 - sourceV) * PAGE_SIZE), 0, PAGE_SIZE - 1);
      const paletteIndex = indexed[sourceY * PAGE_SIZE + sourceX];
      const targetY = spec.y + spec.height - 1 - y;
      const target = (targetY * STADIUM_ATLAS_WIDTH + spec.x + x) * 4;
      rgba[target] = expandVgaComponent(palette[paletteIndex * 3]);
      rgba[target + 1] = expandVgaComponent(palette[paletteIndex * 3 + 1]);
      rgba[target + 2] = expandVgaComponent(palette[paletteIndex * 3 + 2]);
      rgba[target + 3] = spec.alphaMode === "mask" && paletteIndex === 0 ? 0 : 255;
    }
  }
}

function prepareHudGlyphAtlas(nativeArchive) {
  const palette = Buffer.from(nativeArchive.recordBytes(0));
  for (const band of HUD_COLOR_BANDS) {
    if (band.paletteSelector === 0) continue;
    const payload = nativeArchive.recordBytes(band.paletteSelector);
    if (payload.length !== 72) {
      throw new Error(`HUD palette selector ${band.paletteSelector} is not a 24-colour kit palette.`);
    }
    payload.copy(palette, band.paletteTargetIndex * 3);
  }
  const sourcePage = nativeArchive.recordBytes(PINNED_NATIVE_ARCHIVE.glyphPage.selector);
  const rgba = Buffer.alloc(HUD_GLYPH_ATLAS_WIDTH * HUD_GLYPH_ATLAS_HEIGHT * 4);
  for (const [bandIndex, band] of HUD_COLOR_BANDS.entries()) {
    for (let y = 0; y < HUD_GLYPH_BAND_HEIGHT; y += 1) {
      for (let x = 0; x < HUD_GLYPH_ATLAS_WIDTH; x += 1) {
        const sourceIndex = sourcePage[
          (HUD_FONT.sourcePitchRow + y) * PAGE_SIZE + HUD_FONT.sourceX + x
        ];
        const target = (
          (bandIndex * HUD_GLYPH_BAND_HEIGHT + y) * HUD_GLYPH_ATLAS_WIDTH + x
        ) * 4;
        if (sourceIndex === 0) continue;
        const paletteIndex = sourceIndex === 1
          ? band.outputColorIndex
          : sourceIndex - 1;
        rgba[target] = expandVgaComponent(palette[paletteIndex * 3]);
        rgba[target + 1] = expandVgaComponent(palette[paletteIndex * 3 + 1]);
        rgba[target + 2] = expandVgaComponent(palette[paletteIndex * 3 + 2]);
        rgba[target + 3] = 255;
      }
    }
  }
  const pngBytes = encodeRgbaPng(HUD_GLYPH_ATLAS_WIDTH, HUD_GLYPH_ATLAS_HEIGHT, rgba);
  const colorBands = HUD_COLOR_BANDS.map((band, index) => ({
    ...band,
    y: index * HUD_GLYPH_BAND_HEIGHT,
    height: HUD_GLYPH_BAND_HEIGHT,
    rgb: [
      expandVgaComponent(palette[band.outputColorIndex * 3]),
      expandVgaComponent(palette[band.outputColorIndex * 3 + 1]),
      expandVgaComponent(palette[band.outputColorIndex * 3 + 2]),
    ],
  }));
  return {
    rgba,
    pngBytes,
    sha256: sha256(pngBytes),
    colorBands,
  };
}

export function bindCssoccerStadiumTexture(preparation, sourceColorCode) {
  if (
    !preparation
    || !Array.isArray(preparation.stadiumTextureRecords)
    || !Array.isArray(preparation.stadiumPageMaterials)
    || !Array.isArray(preparation.stadiumTriangleCutouts)
    || !Array.isArray(preparation.stadiumTriangleMaterials)
  ) {
    throw new TypeError("Stadium texture binding requires the prepared native stadium atlas.");
  }
  if (!Number.isSafeInteger(sourceColorCode) || sourceColorCode >= 0) return null;
  const textureIndex = sourceColorCode < -2000
    ? -sourceColorCode - 2001
    : -sourceColorCode - 1;
  const record = preparation.stadiumTextureRecords[textureIndex];
  const atlasPage = record ? record.page - 8 : -1;
  if (
    !record
    || atlasPage < 0
    || atlasPage >= STADIUM_PAGE_COUNT
  ) {
    return null;
  }
  const triangleCutouts = preparation.stadiumTriangleCutouts
    .filter((entry) => entry.textureIndex === textureIndex);
  const triangleMaterials = preparation.stadiumTriangleMaterials[textureIndex];
  const expectedTriangleCount = record.vertexCount === 3 ? 1 : 2;
  const transparent = sourceColorCode < -2000;
  const material = preparation.stadiumPageMaterials[atlasPage];
  if (
    !material
    || triangleCutouts.length !== expectedTriangleCount
    || !Array.isArray(triangleMaterials)
    || triangleMaterials.length !== expectedTriangleCount
    || triangleMaterials.some((entry) => !entry)
    || triangleCutouts.some(({ alphaMode }) => alphaMode !== (transparent ? "mask" : "opaque"))
  ) {
    return null;
  }
  return deepFreeze({
    sourceColorCode,
    textureIndex,
    nativePage: record.page,
    atlasPage,
    vertexCount: record.vertexCount,
    transparent,
    material,
    sourceUvs: record.uvs,
    triangleCutouts,
    triangleMaterials,
    cutoutUvs: FULL_IMAGE_UVS,
    textureRecordSha256: record.sha256,
  });
}

/** Bind one exact masked BM_NETS goal surface prepared from native page 15. */
export function bindCssoccerGoalNetTexture(preparation, sourceColorCode) {
  if (
    !preparation
    || !Array.isArray(preparation.goalNetTextureRecords)
    || !Array.isArray(preparation.goalNetTriangleCutouts)
    || !Array.isArray(preparation.goalNetTriangleMaterials)
  ) {
    throw new TypeError("Goal-net texture binding requires the prepared native BM_NETS atlas.");
  }
  if (!Number.isSafeInteger(sourceColorCode) || sourceColorCode >= 0) return null;
  const nativeTextureSlot = -sourceColorCode - 2000;
  const textureIndex = nativeTextureSlot - GOAL_NET_TEXTURE.firstNativeTextureSlot;
  const record = preparation.goalNetTextureRecords[textureIndex];
  if (
    !record
    || record.sourceColorCode !== sourceColorCode
    || record.nativeTextureSlot !== nativeTextureSlot
    || record.page !== GOAL_NET_TEXTURE.nativePage
    || record.vertexCount !== 4
  ) {
    return null;
  }
  const triangleCutouts = preparation.goalNetTriangleCutouts
    .filter((entry) => entry.textureIndex === textureIndex);
  const triangleMaterials = preparation.goalNetTriangleMaterials[textureIndex];
  if (
    triangleCutouts.length !== 2
    || !Array.isArray(triangleMaterials)
    || triangleMaterials.length !== 2
    || triangleMaterials.some((entry) => !entry?.imageSource)
    || triangleCutouts.some(({ alphaMode }) => alphaMode !== "mask")
  ) {
    return null;
  }
  return deepFreeze({
    sourceColorCode,
    textureIndex,
    nativeTextureSlot,
    archiveRecordIndex: record.archiveRecordIndex,
    nativePage: record.page,
    vertexCount: record.vertexCount,
    transparent: true,
    sourceUvs: record.uvs,
    triangleCutouts,
    triangleMaterials,
    cutoutUvs: FULL_IMAGE_UVS,
    textureRecordSha256: record.sha256,
  });
}


function preparePalette(archive, retailArchive, nativeArchive) {
  const palette = Buffer.from(
    nativeArchive.recordBytes(NATIVE_PLAYER_SELECTORS.palette),
  );
  copyPalette(
    nativeArchive,
    palette,
    NATIVE_PLAYER_SELECTORS.spainKitPalette,
    32,
  );
  copyPalette(
    retailArchive,
    palette,
    RETAIL_PLAYER_SELECTORS.argentinaKitPalette,
    56,
  );
  copyPalette(
    nativeArchive,
    palette,
    NATIVE_PLAYER_SELECTORS.spainSkinPalette,
    80,
  );
  copyPalette(
    archive,
    palette,
    SELECTORS.paletteOverrides.argentinaSkin,
    88,
  );
  copyPalette(
    nativeArchive,
    palette,
    NATIVE_PLAYER_SELECTORS.spainPitchPalette,
    128,
  );
  for (const override of STADIUM_PALETTE_OVERRIDES.filter(({ firstEntry }) => (
    firstEntry === 224 || firstEntry === 232
  ))) {
    copyPalette(nativeArchive, palette, override.selector, override.firstEntry);
  }
  return palette;
}

function browserPaletteEntry(palette, paletteIndex) {
  const offset = paletteIndex * 3;
  if (!Buffer.isBuffer(palette) || offset < 0 || offset + 3 > palette.length) {
    throw new Error(`Palette index ${paletteIndex} is unavailable.`);
  }
  const sourceRgb6 = [...palette.subarray(offset, offset + 3)];
  const browserRgb = sourceRgb6.map(expandVgaComponent);
  return deepFreeze({
    paletteIndex,
    sourceRgb6,
    browserRgb,
    browserCssColor: `#${browserRgb
      .map((component) => component.toString(16).padStart(2, "0"))
      .join("")}`,
    authority: "EUROREND palette selector 0",
  });
}

function copyPalette(archive, palette, selector, firstEntry) {
  const payload = archive.recordBytes(selector);
  const offset = firstEntry * 3;
  if (offset + payload.length > palette.length) {
    throw new Error(`Palette selector ${selector} exceeds the 256-entry native palette.`);
  }
  payload.copy(palette, offset);
}

function preparePlayerTextureTableBytes(nativeArchive, retailArchive) {
  const matchBytes = nativeArchive.recordBytes(
    NATIVE_PLAYER_SELECTORS.matchTextureTable,
  );
  const playerBytes = nativeArchive.recordBytes(
    NATIVE_PLAYER_SELECTORS.playerTextureTable,
  );
  const retailBytes = retailArchive.recordBytes(RETAIL_PLAYER_SELECTORS.textureTable);
  const firstHighlightByte = (
    PLAYER_HIGHLIGHT_FIRST_NATIVE_TEXTURE_SLOT - 1
  ) * 32;
  const firstNumberByte = (PLAYER_NUMBER_FIRST_NATIVE_TEXTURE_SLOT - 1) * 32;
  if (
    matchBytes.length !== retailBytes.length
    || playerBytes.length < firstHighlightByte
    || firstNumberByte !== PLAYER_HIGHLIGHT_FINAL_NATIVE_TEXTURE_SLOT * 32
  ) throw new Error("Exact fixture player texture-table composition changed.");
  const output = Buffer.from(matchBytes);
  playerBytes.copy(output, 0, 0, firstHighlightByte);
  retailBytes.copy(output, firstNumberByte, firstNumberByte, output.length);
  return output;
}

function preparePlayerPages(
  archive,
  retailArchive,
  nativeArchive,
  textureRecords,
) {
  const pages = Array.from({ length: PLAYER_PAGE_COUNT }, () => Buffer.alloc(PAGE_SIZE * PAGE_SIZE));
  copyIntoPage(nativeArchive, NATIVE_PLAYER_SELECTORS.spainHead, pages[0], 0);
  copyIntoPage(archive, SELECTORS.player.argentinaHead, pages[0], 128 * PAGE_SIZE);
  copyIntoPage(nativeArchive, NATIVE_PLAYER_SELECTORS.spainTorso, pages[1], 0);
  copyIntoPage(retailArchive, RETAIL_PLAYER_SELECTORS.argentinaTorso, pages[2], 0);
  copyIntoPage(nativeArchive, NATIVE_PLAYER_SELECTORS.spainLimbs, pages[3], 0);
  copyIntoPage(archive, SELECTORS.player.argentinaLimbs, pages[3], 80 * PAGE_SIZE);
  copyIntoPage(nativeArchive, NATIVE_PLAYER_SELECTORS.sharedFeet, pages[3], 158 * PAGE_SIZE);
  copyIntoPage(nativeArchive, NATIVE_PLAYER_SELECTORS.keeperTorso, pages[4], 0);
  copyIntoPage(nativeArchive, NATIVE_PLAYER_SELECTORS.keeperLimbs, pages[5], 0);
  copyIntoPage(
    retailArchive,
    RETAIL_PLAYER_SELECTORS.playerHighlightPage,
    pages[PLAYER_HIGHLIGHT_PAGE_INDEX],
    0,
  );
  copyIntoPage(retailArchive, RETAIL_PLAYER_SELECTORS.spainNumbers, pages[6], 62 * PAGE_SIZE);
  copyIntoPage(
    retailArchive,
    RETAIL_PLAYER_SELECTORS.argentinaNumbers,
    pages[6],
    89 * PAGE_SIZE,
  );

  remapRange(pages[0], 128 * PAGE_SIZE, 128 * PAGE_SIZE, { skin: true });
  remapRange(pages[2], 0, pages[2].length, { kit: true, skin: true });
  remapRange(pages[3], 80 * PAGE_SIZE, 80 * PAGE_SIZE, { kit: true, skin: true });
  remapRuntimeNumberRange(pages[6], 89 * PAGE_SIZE, 27 * PAGE_SIZE);
  rotatePlayerNumberTexels180(pages[6], textureRecords);
  return pages;
}

function prepareCornerFlagPalette(archive, playerPalette) {
  const palette = Buffer.from(playerPalette);
  copyPalette(
    archive,
    palette,
    CORNER_FLAG_TEXTURE.paletteSource.selector,
    CORNER_FLAG_TEXTURE.paletteSource.firstEntry,
  );
  return palette;
}

function preparePlayerSourceAudit(pages, textureRecords) {
  if (sha256(pages[3]) !== EXACT_PLAYER_PAGE_THREE_SHA256) {
    throw new Error("Exact fixture player page three changed from its verified source composition.");
  }
  const slots = EXACT_PLAYER_SOURCE_AUDIT.map((expected) => {
    const record = textureRecords[expected.nativeTextureSlot - 1];
    const rect = record?.sourceRect;
    if (
      !record?.quadLayout
      || record.page !== 3
      || !rect
      || rect.x !== expected.sourceRect.x
      || rect.y !== expected.sourceRect.y
      || rect.width !== expected.sourceRect.width
      || rect.height !== expected.sourceRect.height
      || record.sha256 !== expected.textureRecordSha256
    ) {
      throw new Error(
        `Exact fixture player slot ${expected.nativeTextureSlot} changed source record.`,
      );
    }
    const indexedTexels = cropIndexedPlayerTexels(pages[3], rect);
    const indexedTexelSha256 = sha256(indexedTexels);
    if (indexedTexelSha256 !== expected.indexedTexelSha256) {
      throw new Error(
        `Exact fixture player slot ${expected.nativeTextureSlot} changed indexed texels.`,
      );
    }
    return {
      ...expected,
      page: record.page,
      indexedTexelSha256,
    };
  });
  return deepFreeze({
    authority: "retained exact player_f1 fixture capture",
    page: 3,
    pageSha256: EXACT_PLAYER_PAGE_THREE_SHA256,
    sourceRecords: [
      {
        id: "exact-spain-limbs",
        archive: "EUROREND.DAT",
        selector: NATIVE_PLAYER_SELECTORS.spainLimbs,
        y: 0,
        bytes: 19_968,
      },
      {
        id: "argentina-limbs",
        archive: "demo ACTREND.DAT",
        selector: SELECTORS.player.argentinaLimbs,
        y: 80,
        bytes: 19_968,
      },
      {
        id: "exact-source-feet",
        archive: "EUROREND.DAT",
        selector: NATIVE_PLAYER_SELECTORS.sharedFeet,
        y: 158,
        bytes: 17_152,
      },
    ],
    slots,
  });
}

function cropIndexedPlayerTexels(page, rect) {
  const output = Buffer.alloc(rect.width * rect.height);
  for (let row = 0; row < rect.height; row += 1) {
    page.copy(
      output,
      row * rect.width,
      (rect.y + row) * PAGE_SIZE + rect.x,
      (rect.y + row) * PAGE_SIZE + rect.x + rect.width,
    );
  }
  return output;
}

function prepareOfficialSourceAtlas(archive, palette) {
  const bindings = [
    {
      nativePage: 13,
      symbol: "BM_XRFKPLIM",
      selector: RETAIL_PLAYER_SELECTORS.assistantLimbs,
    },
    {
      nativePage: 14,
      symbol: "BM_REFKPTOR",
      selector: RETAIL_PLAYER_SELECTORS.refereeTorso,
    },
  ];
  const pages = bindings.map(({ selector, symbol }) => {
    const source = Buffer.from(archive.recordBytes(selector));
    if (source.length <= 0 || source.length > PAGE_SIZE * PAGE_SIZE
        || source.length % PAGE_SIZE !== 0) {
      throw new Error(`${symbol} cannot be placed on one native texture page.`);
    }
    const page = Buffer.alloc(PAGE_SIZE * PAGE_SIZE);
    source.copy(page);
    return page;
  });
  const width = pages.length * PAGE_SIZE;
  const rgba = Buffer.alloc(width * PAGE_SIZE * 4);
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const indexed = pages[pageIndex];
    for (let y = 0; y < PAGE_SIZE; y += 1) {
      for (let x = 0; x < PAGE_SIZE; x += 1) {
        const paletteIndex = indexed[y * PAGE_SIZE + x];
        const target = (y * width + pageIndex * PAGE_SIZE + x) * 4;
        rgba[target] = expandVgaComponent(palette[paletteIndex * 3]);
        rgba[target + 1] = expandVgaComponent(palette[paletteIndex * 3 + 1]);
        rgba[target + 2] = expandVgaComponent(palette[paletteIndex * 3 + 2]);
        rgba[target + 3] = paletteIndex === 0 ? 0 : 255;
      }
    }
  }
  const pngBytes = encodeRgbaPng(width, PAGE_SIZE, rgba);
  const metadata = deepFreeze({
    schema: "cssoccer-exact-official-source-atlas@1",
    status: "ready-source-pages-13-14",
    width,
    height: PAGE_SIZE,
    pageSize: PAGE_SIZE,
    sha256: sha256(pngBytes),
    rgbaSha256: sha256(rgba),
    nativePages: bindings.map((binding, atlasPage) => ({
      ...binding,
      atlasPage,
      sourceRecordSha256: sha256(pages[atlasPage]),
    })),
    runtimeConstruction: false,
    publication: "prepare input only; exact normalized official material atlas is the browser asset",
  });
  return Object.freeze({ metadata, pngBytes });
}

function rotatePlayerNumberTexels180(page, textureRecords) {
  if (!Buffer.isBuffer(page) || page.length !== PAGE_SIZE * PAGE_SIZE) {
    throw new Error("Player-number reflection requires one complete indexed texture page.");
  }
  if (!Array.isArray(textureRecords)
      || textureRecords.length < PLAYER_NUMBER_FINAL_NATIVE_TEXTURE_SLOT) {
    throw new Error("Player-number reflection requires the complete retail texture table.");
  }
  for (
    let nativeTextureSlot = PLAYER_NUMBER_FIRST_NATIVE_TEXTURE_SLOT;
    nativeTextureSlot <= PLAYER_NUMBER_FINAL_NATIVE_TEXTURE_SLOT;
    nativeTextureSlot += 1
  ) {
    const record = textureRecords[nativeTextureSlot - 1];
    if (!record?.quadLayout || record.page !== PLAYER_NUMBER_PAGE_INDEX) {
      throw new Error(`Player-number slot ${nativeTextureSlot} is not a page-six quad.`);
    }
    const { x, y, width, height } = record.sourceRect;
    const source = Buffer.alloc(width * height);
    for (let row = 0; row < height; row += 1) {
      page.copy(source, row * width, (y + row) * PAGE_SIZE + x, (y + row) * PAGE_SIZE + x + width);
    }
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        page[(y + row) * PAGE_SIZE + x + column] = source[
          (height - row - 1) * width + width - column - 1
        ];
      }
    }
  }
}

function remapRuntimeNumberRange(page, offset, length) {
  const end = offset + length;
  if (offset < 0 || end > page.length) throw new Error("Native number remap exceeds its map page.");
  for (let index = offset; index < end; index += 1) {
    const value = page[index];
    if (value > 32 && value <= 56) page[index] = value + 24;
    if (value > 80 && value <= 88) page[index] = value + 8;
  }
}

function copyIntoPage(archive, selector, page, offset) {
  const payload = archive.recordBytes(selector);
  if (offset < 0 || offset + payload.length > page.length) {
    throw new Error(`Texture selector ${selector} does not fit its native map-page placement.`);
  }
  payload.copy(page, offset);
}

function remapRange(page, offset, length, { kit = false, skin = false }) {
  const end = offset + length;
  if (offset < 0 || end > page.length) throw new Error("Native texture remap exceeds its map page.");
  for (let index = offset; index < end; index += 1) {
    const value = page[index];
    if (kit && value >= 32 && value < 56) page[index] = value + 24;
    if (skin && value >= 80 && value < 88) page[index] = value + 8;
  }
}

function paddedPitchPage(pixels) {
  if (pixels.length !== PAGE_SIZE * PITCH_HEIGHT) {
    throw new Error(`BM_PA has ${pixels.length} bytes, expected ${PAGE_SIZE * PITCH_HEIGHT}.`);
  }
  const page = Buffer.alloc(PAGE_SIZE * PAGE_SIZE);
  pixels.copy(page);
  return page;
}

function renderAtlasRgba(indexedPages, palette) {
  const rgba = Buffer.alloc(ATLAS_WIDTH * ATLAS_HEIGHT * 4);
  for (let pageIndex = 0; pageIndex < indexedPages.length; pageIndex += 1) {
    const indexed = indexedPages[pageIndex];
    for (let y = 0; y < PAGE_SIZE; y += 1) {
      for (let x = 0; x < PAGE_SIZE; x += 1) {
        const paletteIndex = indexed[y * PAGE_SIZE + x];
        const target = (y * ATLAS_WIDTH + pageIndex * PAGE_SIZE + x) * 4;
        rgba[target] = expandVgaComponent(palette[paletteIndex * 3]);
        rgba[target + 1] = expandVgaComponent(palette[paletteIndex * 3 + 1]);
        rgba[target + 2] = expandVgaComponent(palette[paletteIndex * 3 + 2]);
        rgba[target + 3] = pageIndex < PLAYER_PAGE_COUNT
          && (paletteIndex === 0
            || playerTextureTexelUsesNativeChromaKey(pageIndex, y, paletteIndex))
          ? 0
          : 255;
      }
    }
  }
  return rgba;
}

function prepareCornerFlagCutout({ nativeArchive, palette, rgba }) {
  if (!Buffer.isBuffer(palette) || palette.length !== 256 * 3) {
    throw new TypeError("Corner-flag preparation requires the complete native palette.");
  }
  if (!Buffer.isBuffer(rgba) || rgba.length !== ATLAS_WIDTH * ATLAS_HEIGHT * 4) {
    throw new TypeError("Corner-flag preparation requires the complete prepared match atlas.");
  }
  const table = nativeArchive.recordBytes(CORNER_FLAG_TEXTURE.textureTableSelector);
  const recordOffset = CORNER_FLAG_TEXTURE.archiveRecordIndex * 32;
  const recordBytes = table.subarray(recordOffset, recordOffset + 32);
  if (recordBytes.length !== 32) {
    throw new Error(`Native corner-flag slot ${CORNER_FLAG_TEXTURE.nativeTextureSlot} is unavailable.`);
  }
  const rawWords = Array.from({ length: 8 }, (_unused, index) => (
    recordBytes.readUInt32LE(index * 4)
  ));
  const preparedWords = rawWords.map((word) => (word & 0xffff_ff00) >>> 0);
  const page = preparedWords[0] >>> 24;
  const vertexCount = rawWords.slice(0, 4).every((word) => word >>> 24 === page) ? 4 : 3;
  if (vertexCount !== 3 || page !== CORNER_FLAG_TEXTURE.nativePage) {
    throw new Error(
      `Native corner-flag slot ${CORNER_FLAG_TEXTURE.nativeTextureSlot} is not the page-six triangle.`,
    );
  }
  const vWords = preparedWords.slice(0, vertexCount);
  const uWords = preparedWords.slice(vertexCount, vertexCount * 2);
  const sourceUvs = uWords.map((word, index) => Object.freeze([
    (word & 0x00ff_ffff) / 0x0100_0000,
    1 - (vWords[index] & 0x00ff_ffff) / 0x0100_0000,
  ]));
  const record = {
    textureIndex: CORNER_FLAG_TEXTURE.archiveRecordIndex,
    page,
    vertexCount,
    uvs: sourceUvs,
  };
  const cutout = triangleCutoutSpec(record, 0, [0, 1, 2], "mask");
  cutout.x = CORNER_FLAG_TEXTURE.atlasX;
  cutout.y = CORNER_FLAG_TEXTURE.atlasY;
  if (
    cutout.x < 0
    || cutout.y < PITCH_HEIGHT
    || cutout.x + cutout.width > PAGE_SIZE
    || cutout.y + cutout.height > PAGE_SIZE
  ) {
    throw new Error("Prepared corner-flag cutout overlaps the pitch bitmap or atlas bounds.");
  }
  const pitch = nativeArchive.recordBytes(CORNER_FLAG_TEXTURE.sourcePitchSelector);
  if (pitch.length !== PAGE_SIZE * PITCH_HEIGHT) {
    throw new Error("Native corner-flag source bitmap is not the exact 256 by 64 pitch page.");
  }

  const targetPageX = CORNER_FLAG_TEXTURE.atlasPage * PAGE_SIZE;
  for (let y = 0; y < cutout.height; y += 1) {
    const targetStart = (
      (cutout.y + y) * ATLAS_WIDTH + targetPageX + cutout.x
    ) * 4;
    rgba.fill(0, targetStart, targetStart + cutout.width * 4);
  }

  let transparentTexels = 0;
  let opaqueTexels = 0;
  for (let y = 0; y < cutout.height; y += 1) {
    for (let x = 0; x < cutout.width; x += 1) {
      const s = (x + 0.5) / cutout.width;
      const t = (y + 0.5) / cutout.height;
      if (s + t > 1) continue;
      const sourceU = cutout.basis.origin[0]
        + cutout.basis.uEdge[0] * s
        + cutout.basis.vEdge[0] * t;
      const sourceV = cutout.basis.origin[1]
        + cutout.basis.uEdge[1] * s
        + cutout.basis.vEdge[1] * t;
      const sourceX = clamp(Math.floor(sourceU * PAGE_SIZE), 0, PAGE_SIZE - 1);
      const sourceY = clamp(Math.floor((1 - sourceV) * PAGE_SIZE), 0, PAGE_SIZE - 1);
      const pitchY = sourceY - CORNER_FLAG_TEXTURE.sourcePitchRow;
      if (pitchY < 0 || pitchY >= PITCH_HEIGHT) {
        throw new Error("Native corner-flag UVs escaped the pitch-backed page-six band.");
      }
      const sourcePaletteIndex = pitch[pitchY * PAGE_SIZE + sourceX];
      const paletteIndex = sourcePaletteIndex + CORNER_FLAG_TEXTURE.paletteRemap;
      if (paletteIndex < 0 || paletteIndex >= 256) {
        throw new Error("Native corner-flag palette remap escaped the native palette.");
      }
      const targetY = cutout.y + cutout.height - 1 - y;
      const target = (
        targetY * ATLAS_WIDTH + targetPageX + cutout.x + x
      ) * 4;
      rgba[target] = expandVgaComponent(palette[paletteIndex * 3]);
      rgba[target + 1] = expandVgaComponent(palette[paletteIndex * 3 + 1]);
      rgba[target + 2] = expandVgaComponent(palette[paletteIndex * 3 + 2]);
      rgba[target + 3] = sourcePaletteIndex === CORNER_FLAG_TEXTURE.transparentSourceIndex
        ? 0
        : 255;
      if (rgba[target + 3] === 0) transparentTexels += 1;
      else opaqueTexels += 1;
    }
  }
  if (transparentTexels === 0 || opaqueTexels === 0) {
    throw new Error("Prepared corner-flag cutout lost either its native mask or pennant texels.");
  }
  return deepFreeze({
    x: cutout.x,
    y: cutout.y,
    width: cutout.width,
    height: cutout.height,
    sourceUvs,
    sourceRect: cutout.sourceRect,
    basisVertexIndexes: cutout.basisVertexIndexes,
    textureRecordSha256: sha256(recordBytes),
    transparentTexels,
    opaqueTexels,
  });
}

function playerTextureTexelUsesNativeChromaKey(pageIndex, y, paletteIndex) {
  if (pageIndex !== PLAYER_HIGHLIGHT_PAGE_INDEX) return false;
  const isHighlightChroma = paletteIndex === PLAYER_HIGHLIGHT_TRANSPARENT_PALETTE_INDEX
    && y < PLAYER_HIGHLIGHT_SOURCE_HEIGHT;
  const isNumberChroma = paletteIndex === PLAYER_NUMBER_TRANSPARENT_PALETTE_INDEX
    && PLAYER_NUMBER_SOURCE_BANDS.some((band) => (
      y >= band.y && y < band.y + band.height
    ));
  return isHighlightChroma || isNumberChroma;
}

function renderPitchSurfaceRgba(pitchPixels, palette) {
  if (pitchPixels.length !== PAGE_SIZE * PITCH_HEIGHT) {
    throw new Error(`Pitch bitmap has ${pitchPixels.length} bytes, expected ${PAGE_SIZE * PITCH_HEIGHT}.`);
  }
  const rgba = Buffer.alloc(PITCH_SURFACE_WIDTH * PITCH_SURFACE_HEIGHT * 4);
  for (let row = 0; row < PITCH_SURFACE_HEIGHT; row += 1) {
    const rendererZ = PITCH_SURFACE_BOUNDS.z[0] + row;
    for (let column = 0; column < PITCH_SURFACE_WIDTH; column += 1) {
      const rendererX = PITCH_SURFACE_BOUNDS.x[0] + column;
      const sourceRow = MEDIUM_PITCH_TILE.sourceRow + (
        Math.floor(rendererX / MEDIUM_PITCH_TILE.worldUnitsPerTexel)
        & (MEDIUM_PITCH_TILE.size - 1)
      );
      const sourceColumn = MEDIUM_PITCH_TILE.sourceColumn + (
        Math.floor(rendererZ / MEDIUM_PITCH_TILE.worldUnitsPerTexel)
        & (MEDIUM_PITCH_TILE.size - 1)
      );
      const paletteIndex = pitchPixels[sourceRow * PAGE_SIZE + sourceColumn];
      const target = (row * PITCH_SURFACE_WIDTH + column) * 4;
      rgba[target] = expandVgaComponent(palette[paletteIndex * 3]);
      rgba[target + 1] = expandVgaComponent(palette[paletteIndex * 3 + 1]);
      rgba[target + 2] = expandVgaComponent(palette[paletteIndex * 3 + 2]);
      rgba[target + 3] = 255;
    }
  }
  return rgba;
}

function preparePitchSurfaceFromArchive(archive) {
  const palette = Buffer.alloc(256 * 3);
  copyPalette(
    archive,
    palette,
    VISUAL_PITCH_SOURCE.pitchPaletteSelector,
    128,
  );
  const pitchPixels = archive.recordBytes(VISUAL_PITCH_SOURCE.pitchSelector);
  const sampledPaletteIndices = new Set();
  for (let row = MEDIUM_PITCH_TILE.sourceRow; row < MEDIUM_PITCH_TILE.sourceRow + MEDIUM_PITCH_TILE.size; row += 1) {
    for (let column = MEDIUM_PITCH_TILE.sourceColumn; column < MEDIUM_PITCH_TILE.sourceColumn + MEDIUM_PITCH_TILE.size; column += 1) {
      sampledPaletteIndices.add(pitchPixels[row * PAGE_SIZE + column]);
    }
  }
  if ([...sampledPaletteIndices].some((index) => index < 128 || index >= 144)) {
    throw new Error("The canonical medium-detail pitch tile escaped its native palette override.");
  }
  const rgbaBytes = renderPitchSurfaceRgba(pitchPixels, palette);
  const pngBytes = encodeRgbaPng(
    PITCH_SURFACE_WIDTH,
    PITCH_SURFACE_HEIGHT,
    rgbaBytes,
  );
  return Object.freeze({
    schema: "cssoccer-prepared-pitch-surface@1",
    source: VISUAL_PITCH_SOURCE,
    width: PITCH_SURFACE_WIDTH,
    height: PITCH_SURFACE_HEIGHT,
    rgbaBytes,
    rgbaSha256: sha256(rgbaBytes),
    assetFile: Object.freeze({
      path: PITCH_SURFACE_PATH,
      mediaType: "image/png",
      bytes: pngBytes,
      expectedSha256: sha256(pngBytes),
    }),
  });
}


function decodeStadiumTextureRecords(bytes) {
  return Object.freeze(Array.from({ length: bytes.length / 32 }, (_, textureIndex) => {
    const record = bytes.subarray(textureIndex * 32, textureIndex * 32 + 32);
    const rawWords = Array.from({ length: 8 }, (_unused, index) => record.readUInt32LE(index * 4));
    const page = rawWords[0] >>> 24;
    const vertexCount = rawWords.slice(0, 4).every((word) => word >>> 24 === page) ? 4 : 3;
    // 3DENG.C clears the unchecked-carry byte, then feeds texture[0..np) to
    // T/Y and texture[np..2np) to S/X.
    const preparedWords = rawWords.map((word) => (word & 0xffff_ff00) >>> 0);
    const vWords = preparedWords.slice(0, vertexCount);
    const uWords = preparedWords.slice(vertexCount, vertexCount * 2);
    const quadLayout = vertexCount === 4;
    const uvs = uWords.map((word, index) => Object.freeze([
      (word & 0x00ff_ffff) / 0x0100_0000,
      1 - (vWords[index] & 0x00ff_ffff) / 0x0100_0000,
    ]));
    return deepFreeze({
      textureIndex,
      page,
      vertexCount,
      quadLayout,
      uvs,
      rawWords,
      preparedWords,
      sha256: sha256(record),
    });
  }));
}


function decodeTextureRecords(bytes) {
  return Object.freeze(Array.from({ length: bytes.length / 32 }, (_, textureIndex) => {
    const record = bytes.subarray(textureIndex * 32, textureIndex * 32 + 32);
    // 3DENG.C passes polytex + np as startsx and polytex as startsy. The
    // on-disk record therefore stores all four T/Y words first and all four
    // S/X words second. Keeping these axes in their native order is critical
    // for the 256x128 head pages: swapping them folds consecutive source rows
    // beside each other and makes every directional head look like two sprites.
    const vWords = Array.from({ length: 4 }, (_unused, index) => record.readUInt32LE(index * 4));
    const uWords = Array.from({ length: 4 }, (_unused, index) => record.readUInt32LE(16 + index * 4));
    const pages = new Set(vWords.map((word) => word >>> 24));
    const page = vWords[0] >>> 24;
    const uTexels = uWords.map((word) => (word & 0x00ff_ffff) / 0x0001_0000);
    const vTexels = vWords.map((word) => (word & 0x00ff_ffff) / 0x0001_0000);
    const sourceRect = textureRecordSourceRect(uTexels, vTexels);
    const quadLayout = pages.size === 1 && sourceRect !== null;
    const uvs = uWords.map((word, index) => Object.freeze([
      (word & 0x00ff_ffff) / 0x0100_0000,
      1 - (vWords[index] & 0x00ff_ffff) / 0x0100_0000,
    ]));
    const normalizedUvs = quadLayout
      ? uTexels.map((u, index) => Object.freeze([
          normalizeTextureUnit((u - sourceRect.x) / sourceRect.width),
          normalizeTextureUnit(1 - (vTexels[index] - sourceRect.y) / sourceRect.height),
        ]))
      : [];
    return deepFreeze({
      textureIndex,
      page,
      quadLayout,
      uvs,
      normalizedUvs,
      coordinateOrder: "texture[0..4)=T/Y; texture[4..8)=S/X",
      sourceRect,
      rawWords: [...vWords, ...uWords],
      sha256: sha256(record),
    });
  }));
}

function textureRecordSourceRect(uTexels, vTexels) {
  const minU = Math.min(...uTexels);
  const maxU = Math.max(...uTexels);
  const minV = Math.min(...vTexels);
  const maxV = Math.max(...vTexels);
  const x = Math.round(minU);
  const y = Math.round(minV);
  const width = Math.round(maxU - minU);
  const height = Math.round(maxV - minV);
  const uniqueU = new Set(uTexels.map((value) => Math.round(value * 0x0001_0000))).size;
  const uniqueV = new Set(vTexels.map((value) => Math.round(value * 0x0001_0000))).size;
  if (
    uniqueU !== 2
    || uniqueV !== 2
    || width <= 0
    || height <= 0
    || Math.abs(minU - x) > 1 / 0x0001_0000
    || Math.abs(minV - y) > 1 / 0x0001_0000
    || Math.abs(maxU - minU - width) > 1 / 0x0001_0000
    || Math.abs(maxV - minV - height) > 1 / 0x0001_0000
    || x < 0
    || y < 0
    || x + width > PAGE_SIZE
    || y + height > PAGE_SIZE
  ) {
    return null;
  }
  return deepFreeze({ x, y, width, height });
}

function normalizeTextureUnit(value) {
  if (Math.abs(value) <= 1 / 0x0001_0000) return 0;
  if (Math.abs(value - 1) <= 1 / 0x0001_0000) return 1;
  return value;
}

function createAtlasMaterial({
  page,
  assetSha256,
  x = 0,
  y = 0,
  width = PAGE_SIZE,
  height,
  key = `cssoccer-source-player-page-${page}`,
  assetUrl = ASSET_URL,
  imageWidth = ATLAS_WIDTH,
  imageHeight = ATLAS_HEIGHT,
  imageRendering = "pixelated",
}) {
  return deepFreeze({
    texture: assetUrl,
    key,
    imageSource: {
      url: assetUrl,
      width: imageWidth,
      height: imageHeight,
      sourceRect: { x: page * PAGE_SIZE + x, y, width, height },
      imageRendering,
    },
    presentation: {
      backend: "image",
      lighting: "source",
      projection: "affine",
      imageRendering,
    },
    assetSha256,
  });
}

function encodeRgbaPng(width, height, rgba) {
  if (rgba.length !== width * height * 4) throw new Error("PNG RGBA byte count is invalid.");
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const target = y * (1 + width * 4);
    scanlines[target] = 0;
    rgba.copy(scanlines, target + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type, payload) {
  const name = Buffer.from(type, "ascii");
  const output = Buffer.alloc(12 + payload.length);
  output.writeUInt32BE(payload.length, 0);
  name.copy(output, 4);
  payload.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([name, payload])), 8 + payload.length);
  return output;
}

function crc32(bytes) {
  let crc = 0xffff_ffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0);
    }
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}

function expandVgaComponent(value) {
  return (value << 2) | (value >> 4);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function requirePinnedBytes(value, label, expected) {
  const bytes = Buffer.isBuffer(value)
    ? value
    : value instanceof Uint8Array
      ? Buffer.from(value)
      : null;
  if (!bytes) throw new TypeError(`${label} must be supplied as source bytes.`);
  const digest = sha256(bytes);
  if (bytes.length !== expected.bytes || digest !== expected.sha256) {
    throw new Error(`${label} does not match the pinned source payload.`);
  }
  return bytes;
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
