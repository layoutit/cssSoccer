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
    rendererTeamSlot: 0,
    symbol: "BM_NUMBERS1",
    selector: 1936,
    y: 62,
    height: 27,
  },
  {
    team: "argentina",
    rendererTeamSlot: 1,
    symbol: "BM_NUMBERS2",
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
const HALFTIME_MENU_SPRITE_ATLAS_PATH =
  "assets/textures/spain-argentina-halftime-menu-sprites.png";
const HALFTIME_MENU_SPRITE_ATLAS_URL = cssoccerPublicUrl(
  HALFTIME_MENU_SPRITE_ATLAS_PATH,
);
const STADIUM_ATLAS_PATH = "assets/textures/spain-argentina-stadium.png";
const STADIUM_ATLAS_URL = cssoccerPublicUrl(STADIUM_ATLAS_PATH);
const SKY_BACKDROP_PATH = "assets/textures/spain-argentina-sky.png";
const SKY_BACKDROP_URL = cssoccerPublicUrl(SKY_BACKDROP_PATH);
const MARKING_PIXEL_PATH = "assets/textures/spain-argentina-marking-pixel.png";
const MARKING_PIXEL_URL = cssoccerPublicUrl(MARKING_PIXEL_PATH);
const SOURCE_MARKING_RGBA = deepFreeze([174, 174, 174, 255]);
const STADIUM_PAGE_COUNT = 2;
const STADIUM_NATIVE_RASTER_SOURCE_SCHEMA =
  "cssoccer-prepared-native-stadium-raster-source@2";
const STADIUM_TRANSPARENT_PALETTE_INDEX = 1;
const STADIUM_CUTOUT_RASTER_SCALE = 2;
const STADIUM_SHARED_SOURCE_ATLAS_RASTER_SCALE = 1;
const STADIUM_ATLAS_WIDTH = 828;
const STADIUM_ATLAS_HEIGHT = 612;
const STADIUM_SCANLINE_SOURCE_MIN_WIDTH = 150;
const STADIUM_SCANLINE_SOURCE_MIN_HEIGHT = 80;
const STADIUM_SCANLINE_SOURCE_PADDING = 1;
const STADIUM_SCANLINE_BILLBOARD_TEXTURE_INDEXES = deepFreeze([
  13,
  14,
  26,
  33,
  34,
  37,
  38,
  39,
  48,
]);
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
    x: 0,
    y: 0,
    width: PAGE_SIZE * 2,
    height: PAGE_SIZE,
  },
});
const STADIUM_RASTER_TRANSFORMS = deepFreeze(
  Array.from({ length: 4 }, (_unused, quarterTurns) => (
    [false, true].map((reflectX) => ({
      id: `quarter-turn-${quarterTurns}${reflectX ? "-reflect-x" : ""}`,
      quarterTurns,
      reflectX,
    }))
  )).flat(),
);
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
  pitchBitmap: "BM_PB",
  pitchSelector: 912,
  pitchPalette: "COL_P5",
  pitchPaletteSelector: 544,
  selection: "compiled-native-stadlist-0-runtime-binding",
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
const HUD_NORMAL_FONT = deepFreeze({
  id: "normal",
  sourceFile: "FGFX.C",
  fontNo: 1,
  page: 0,
  sourceX: 96,
  sourceY: 143,
  sourcePitchRow: 27,
  sourcePageSymbol: "BM_PB",
  sourcePageSelector: VISUAL_PITCH_SOURCE.pitchSelector,
  columns: 9,
  cellWidth: 8,
  cellHeight: 7,
  rows: 5,
  offset: 0,
  asciiBase: 48,
  presentationScale: 2,
  atlasBandY: 0,
  widths: [
    7, 6, 7, 7, 7, 7, 7, 7, 7, 7, 3, 4, 6, 7, 6, 4,
    3, 7, 7, 7, 7, 7, 7, 7, 7, 6, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 6, 7, 7, 7, 7, 7, 7,
  ],
});
const HUD_MENU_FONT = deepFreeze({
  id: "menu",
  sourceFile: "FGFX.C",
  fontNo: 2,
  page: 0,
  sourceX: 96,
  sourceY: 191,
  sourcePitchRow: 11,
  columns: 10,
  cellWidth: 16,
  cellHeight: 13,
  rows: 5,
  offset: 7,
  asciiBase: 48,
  presentationScale: 1,
  atlasBandY: HUD_NORMAL_FONT.rows
    * HUD_NORMAL_FONT.cellHeight
    * HUD_NORMAL_FONT.presentationScale,
  widths: [
    11, 8, 11, 11, 11, 10, 11, 11, 11, 11, 5, 9, 11, 11, 11, 7,
    5, 14, 11, 12, 12, 9, 9, 14, 12, 5, 8, 13, 9, 16, 13, 14,
    11, 14, 12, 10, 11, 12, 13, 16, 14, 11, 13,
  ],
});
const HUD_FONTS = deepFreeze([HUD_NORMAL_FONT, HUD_MENU_FONT]);
const HUD_GLYPH_ATLAS_WIDTH = Math.max(...HUD_FONTS.map(
  (font) => font.columns * font.cellWidth * font.presentationScale,
));
const HUD_GLYPH_BAND_HEIGHT = HUD_FONTS.reduce(
  (height, font) => height + font.rows * font.cellHeight * font.presentationScale,
  0,
);
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
    paletteSelector: 416,
    paletteTargetIndex: 56,
  },
  {
    id: "heading",
    outputColorIndex: 207,
    paletteSelector: 0,
    paletteTargetIndex: 0,
  },
  {
    id: "scorer",
    outputColorIndex: 157,
    paletteSelector: 0,
    paletteTargetIndex: 0,
  },
]);
const HUD_GLYPH_ATLAS_HEIGHT = HUD_GLYPH_BAND_HEIGHT * HUD_COLOR_BANDS.length;
const HUD_NATIVE_LAYOUT = deepFreeze({
  viewport: [640, 400],
  sourceViewport: [640, 400],
  presentationScale: 1,
  fontProfile: HUD_MENU_FONT.id,
  clock: { x: 320, y: 1, justification: "center" },
  teamA: { x: 280, y: 386, justification: "right" },
  score: { x: 320, y: 386, justification: "center", separator: "=" },
  teamB: { x: 360, y: 386, justification: "left" },
});
const HALFTIME_MENU_SOURCE = deepFreeze({
  basePage: {
    symbol: "BM_EXTRA3",
    selector: 296,
    bytes: PAGE_SIZE * PAGE_SIZE,
  },
  teamA: {
    rendererTeamSlot: 0,
    symbol: "BM_KGRID1",
    selector: 800,
    sourceRect: { x: 1, y: 2, width: 69, height: 79 },
    target: { x: 0, y: 0 },
  },
  teamB: {
    rendererTeamSlot: 1,
    symbol: "BM_KGRID1",
    selector: 800,
    sourceRect: { x: 71, y: 2, width: 69, height: 79 },
    target: { x: 69, y: 0 },
  },
  sprites: {
    teamA: { sourceSprite: 19, x: 0, y: 0, width: 69, height: 79 },
    teamB: { sourceSprite: 20, x: 69, y: 0, width: 69, height: 79 },
    corner: { sourceSprite: 21, x: 138, y: 0, width: 21, height: 22 },
    horizontalEdge: { sourceSprite: 22, x: 191, y: 0, width: 32, height: 9 },
    verticalEdge: { sourceSprite: 23, x: 171, y: 0, width: 9, height: 32 },
  },
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
    selector: 968,
    symbol: "BM_EXTRA2",
    bytes: 19_456,
  }),
});

const PINNED_STADIUM_ENGINE_OBJECT = Object.freeze({
  bytes: 197_182,
  sha256: "49de827ef363e9367855bcf5ddfe7b6f20eca55d0907a4fc07da233010cbe733",
});

const STADIUM_PALETTE_OVERRIDES = deepFreeze([
  {
    id: "renderer-slot-0-pitch",
    symbol: "COL_P5",
    selector: 544,
    firstEntry: 128,
    entries: 16,
  },
  {
    id: "renderer-slot-0-home-highlight",
    symbol: "COL_HB",
    selector: 584,
    firstEntry: 224,
    entries: 8,
  },
  {
    id: "renderer-slot-1-away-highlight",
    symbol: "COL_AW",
    selector: 664,
    firstEntry: 232,
    entries: 8,
  },
]);

const SELECTORS = deepFreeze({
  player: {
    argentinaHead: 64,
    argentinaLimbs: 512,
    spainTorso: 408,
    spainLimbs: 520,
  },
  pitch: 1920,
  paletteOverrides: {
    argentinaSkin: 1536,
    spainKit: 1456,
  },
});
const NATIVE_PLAYER_SELECTORS = deepFreeze({
  palette: 0,
  matchTextureTable: 8,
  playerTextureTable: 16,
  teamAHead: 32,
  teamBHead: 32,
  teamATorso: 64,
  teamBTorso: 136,
  teamALimbs: 232,
  teamBLimbs: 240,
  sharedFeet: 272,
  keeperTorso: 280,
  extraPage: 288,
  assistantLimbs: 312,
  teamAKitPalette: 344,
  teamBKitPalette: 416,
  teamASkinPalette: 480,
  teamBSkinPalette: 480,
  pitchPalette: 544,
  teamAHomeHighlightPalette: 584,
  teamBAwayHighlightPalette: 664,
  keeperLimbs: 864,
  teamANumbers: 872,
  teamBNumbers: 896,
});
const RETAIL_PLAYER_SELECTORS = deepFreeze({
  textureTable: 8,
  argentinaTorso: 96,
  refereeTorso: 576,
  playerHighlightPage: 584,
  assistantLimbs: 608,
  refereeLimbs: 1928,
  spainNumbers: 1936,
  argentinaNumbers: 1944,
  argentinaKitPalette: 1144,
});
const EXPECTED_RECORD_BYTES = new Map([
  [SELECTORS.player.argentinaHead, 32_768],
  [SELECTORS.player.argentinaLimbs, 19_968],
  [SELECTORS.player.spainTorso, 65_536],
  [SELECTORS.player.spainLimbs, 19_968],
  [SELECTORS.pitch, 16_384],
  [SELECTORS.paletteOverrides.argentinaSkin, 24],
  [CORNER_FLAG_TEXTURE.paletteSource.selector, 72],
]);

const EXPECTED_NATIVE_PLAYER_RECORD_BYTES = new Map([
  [NATIVE_PLAYER_SELECTORS.palette, 768],
  [NATIVE_PLAYER_SELECTORS.matchTextureTable, 32_192],
  [NATIVE_PLAYER_SELECTORS.playerTextureTable, 18_336],
  [NATIVE_PLAYER_SELECTORS.teamAHead, 32_768],
  [NATIVE_PLAYER_SELECTORS.teamATorso, 65_536],
  [NATIVE_PLAYER_SELECTORS.teamBTorso, 65_536],
  [NATIVE_PLAYER_SELECTORS.teamALimbs, 19_968],
  [NATIVE_PLAYER_SELECTORS.teamBLimbs, 19_968],
  [NATIVE_PLAYER_SELECTORS.sharedFeet, 17_152],
  [NATIVE_PLAYER_SELECTORS.keeperTorso, 65_536],
  [NATIVE_PLAYER_SELECTORS.extraPage, 15_872],
  [NATIVE_PLAYER_SELECTORS.assistantLimbs, 65_536],
  [NATIVE_PLAYER_SELECTORS.teamAKitPalette, 72],
  [NATIVE_PLAYER_SELECTORS.teamBKitPalette, 72],
  [NATIVE_PLAYER_SELECTORS.teamASkinPalette, 24],
  [NATIVE_PLAYER_SELECTORS.pitchPalette, 48],
  [NATIVE_PLAYER_SELECTORS.keeperLimbs, 65_536],
  [NATIVE_PLAYER_SELECTORS.teamANumbers, 13_824],
  [NATIVE_PLAYER_SELECTORS.teamBNumbers, 13_824],
]);
const EXACT_PLAYER_PAGE_THREE_SHA256 =
  "c1947af89be9ac5441011ff404568d310585c64ae5e0070c8081f28739bda18d";
const EXACT_PLAYER_SOURCE_AUDIT = deepFreeze([
  {
    role: "renderer-slot-0-lower-leg",
    nativeTextureSlot: 244,
    sourceRect: { x: 0, y: 0, width: 15, height: 62 },
    textureRecordSha256:
      "cd46dbc60d6e79078a93d31b36530d83ecafbe6bd349b612dc20a841acd33967",
    indexedTexelSha256:
      "b6817501c94b1645f082e211444d611403aebe59400cf3f471931d873566ae1d",
  },
  {
    role: "renderer-slot-0-shorts",
    nativeTextureSlot: 258,
    sourceRect: { x: 126, y: 0, width: 19, height: 62 },
    textureRecordSha256:
      "2b7b66e826ec5b5d88ebb26fefcd5ae2849500fec6bacbc9b09e50c9fafa9846",
    indexedTexelSha256:
      "ec78ab6bd66fc28646db138252c6870212c03e66e960f582511544d73ce69958",
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
const EXPECTED_RETAIL_FIXTURE_PLAYER_SHA256 = new Map([
  [
    RETAIL_PLAYER_SELECTORS.argentinaTorso,
    "0a34eb62484405d7e85343da33dcd49b3269640a887bc7c819e8c22fbbfaddac",
  ],
  [
    RETAIL_PLAYER_SELECTORS.spainNumbers,
    "73ad7e3909571db26911a37cb5edea9156d81b8fd68277dc3e3f2903c24ba962",
  ],
  [
    RETAIL_PLAYER_SELECTORS.argentinaNumbers,
    "60f83beccbc6fd8f01bdd0a479a79432e213e0c55c4e6b747073ddbcd3a6e276",
  ],
  [
    RETAIL_PLAYER_SELECTORS.argentinaKitPalette,
    "7de6d99471e4d19b09cb9c5af6e814df8806d2051d16356e92c260888fc8c0af",
  ],
]);
const EXPECTED_DEMO_FIXTURE_PLAYER_SHA256 = new Map([
  [
    SELECTORS.player.argentinaHead,
    "e1cbae8df8a8a2440e2b243d201fd5bb89d6498361b3a2d0e88799e34d1bd458",
  ],
  [
    SELECTORS.player.spainTorso,
    "09f18816ebe0399d559a8855e20604c7de48f696afeccba7ed04cf3c21e8a5d8",
  ],
  [
    SELECTORS.player.spainLimbs,
    "83aac54a14f7e882d69343ae71f0b602f8a1ddcf948072a7791e47b53971b56b",
  ],
  [
    SELECTORS.player.argentinaLimbs,
    "d12ac31ed752814888c04896720ef6c73039a7c85a70b338dc6989d005542dfd",
  ],
  [
    SELECTORS.paletteOverrides.spainKit,
    "af3e3f40a16c7d7998996eb34f98c229404e5304f7e277e3f94fe927cfae44ba",
  ],
]);
const EXACT_LATINO_SKIN_PALETTE_SHA256 =
  "6a4a600e6e299290844cb713d82589b8b6dd45e11370f88b26e5f52e73644bfd";

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
 * Reproduce the native M8 match map-page and palette preparation using
 * ignored local renderer bytes plus the pinned retail Argentina and number
 * records. The returned PNG is a generated browser asset;
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
    stadiumSelectors.pitch.bitmapSymbol !== VISUAL_PITCH_SOURCE.pitchBitmap
    || stadiumSelectors.pitch.bitmapSelector !== VISUAL_PITCH_SOURCE.pitchSelector
    || stadiumSelectors.pitch.paletteSymbol !== VISUAL_PITCH_SOURCE.pitchPalette
    || stadiumSelectors.pitch.paletteSelector
      !== VISUAL_PITCH_SOURCE.pitchPaletteSelector
  ) {
    throw new Error("Prepared pitch source diverged from compiled native stadlist[0].");
  }
  if (
    nativeArchive.recordInfo(PINNED_NATIVE_ARCHIVE.glyphPage.selector).size
      !== PINNED_NATIVE_ARCHIVE.glyphPage.bytes
  ) {
    throw new Error("EUROREND BM_EXTRA2 no longer contains the native high-resolution font page.");
  }
  for (const source of [
    HALFTIME_MENU_SOURCE.basePage,
    HALFTIME_MENU_SOURCE.teamA,
    HALFTIME_MENU_SOURCE.teamB,
  ]) {
    const expectedBytes = source.bytes ?? PAGE_SIZE * PAGE_SIZE;
    if (nativeArchive.recordInfo(source.selector).size !== expectedBytes) {
      throw new Error(
        `EUROREND ${source.symbol} no longer contains its native halftime-menu page.`,
      );
    }
  }
  for (const [selector, expectedBytes] of EXPECTED_RECORD_BYTES) {
    const actual = archive.recordInfo(selector);
    if (actual.size !== expectedBytes) {
      throw new Error(`ACTREND selector ${selector} has ${actual.size} bytes, expected ${expectedBytes}.`);
    }
  }
  if (
    sha256(archive.recordBytes(SELECTORS.paletteOverrides.argentinaSkin))
    !== EXACT_LATINO_SKIN_PALETTE_SHA256
  ) {
    throw new Error("Playable-demo COL_XLATINO changed source record.");
  }
  for (const [selector, expectedSha256] of EXPECTED_DEMO_FIXTURE_PLAYER_SHA256) {
    if (sha256(archive.recordBytes(selector)) !== expectedSha256) {
      throw new Error(
        `Playable-demo fixture player selector ${selector} changed source record.`,
      );
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
  for (const [selector, expectedSha256] of EXPECTED_RETAIL_FIXTURE_PLAYER_SHA256) {
    if (sha256(retailArchive.recordBytes(selector)) !== expectedSha256) {
      throw new Error(
        `Retail fixture player selector ${selector} changed source record.`,
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

  const palette = preparePalette({
    nativeArchive,
    retailArchive,
    demoArchive: archive,
  });
  const pitchSurface = preparePitchSurfaceFromArchive(nativeArchive);
  const skyBackdrop = prepareSkyBackdrop(
    nativeArchive,
    requirePinnedBytes(footyPalBytes, "FOOTY.PAL", PINNED_FOOTY_PALETTE),
  );
  const paletteIndexZero = browserPaletteEntry(palette, 0);
  const textureTableBytes = preparePlayerTextureTableBytes(nativeArchive);
  if (textureTableBytes.length % 32 !== 0) {
    throw new Error("TMD_TEXDATA is not a complete array of 32-byte four-point texture records.");
  }
  const textureRecords = decodeTextureRecords(textureTableBytes);
  const playerPages = preparePlayerPages(
    nativeArchive,
    retailArchive,
    archive,
    textureRecords,
  );
  const playerSourceAudit = preparePlayerSourceAudit(playerPages, textureRecords);
  const officialSourceAtlas = prepareOfficialSourceAtlas(nativeArchive, palette);
  const playerHighlightSourceRecord = nativeArchive.recordBytes(
    NATIVE_PLAYER_SELECTORS.extraPage,
  );
  if (sha256(playerHighlightSourceRecord) !== PLAYER_HIGHLIGHT_SOURCE_RECORD_SHA256) {
    throw new Error("EUROREND player-highlight bitmap changed.");
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
  const markingPixelRgba = Buffer.from(SOURCE_MARKING_RGBA);
  const markingPixelPngBytes = encodeRgbaPng(1, 1, markingPixelRgba);
  const markingPixelSha256 = sha256(markingPixelPngBytes);
  const hudGlyphAtlas = prepareHudGlyphAtlas(nativeArchive, palette);
  const halftimeMenuSpriteAtlas = prepareHalftimeMenuSpriteAtlas(nativeArchive, palette);
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
        usage:
          "Argentina torso, both number pages, and the Argentina kit palette",
      },
      nativePlayerFoundation: {
        data: { file: "EUROREND.DAT", ...PINNED_NATIVE_ARCHIVE.data },
        index: { file: "EUROREND.OFF", ...PINNED_NATIVE_ARCHIVE.index },
        selectors: NATIVE_PLAYER_SELECTORS,
        usage:
          "match/player texture tables, goalkeeper and official pages, "
          + "pitch/highlight palettes, and player-highlight texels",
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
      generatedFiles: 7,
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
        status: "exact-native-fixture-palette-selection",
        teamASymbol: "COL_XLATINO",
        teamASelector: SELECTORS.paletteOverrides.argentinaSkin,
        teamBSymbol: "COL_XLATINO",
        teamBSelector: SELECTORS.paletteOverrides.argentinaSkin,
        sourceArchive: "official-playable-demo",
        sourceSha256: EXACT_LATINO_SKIN_PALETTE_SHA256,
      },
      overrides: [
        {
          id: "renderer-slot-0-kit",
          symbol: "COL_XSPAIN",
          selector: SELECTORS.paletteOverrides.spainKit,
          firstEntry: 32,
          entries: 24,
          sourceArchive: "official-playable-demo",
        },
        {
          id: "renderer-slot-1-kit",
          symbol: "COL_XARGENTI",
          selector: RETAIL_PLAYER_SELECTORS.argentinaKitPalette,
          firstEntry: 56,
          entries: 24,
          sourceArchive: "retail-actua-renderer",
        },
        {
          id: "renderer-slot-0-skin",
          symbol: "COL_XLATINO",
          selector: SELECTORS.paletteOverrides.argentinaSkin,
          firstEntry: 80,
          entries: 8,
          sourceArchive: "official-playable-demo",
        },
        {
          id: "renderer-slot-1-skin",
          symbol: "COL_XLATINO",
          selector: SELECTORS.paletteOverrides.argentinaSkin,
          firstEntry: 88,
          entries: 8,
          sourceArchive: "official-playable-demo",
        },
        {
          id: "renderer-slot-0-pitch",
          selector: NATIVE_PLAYER_SELECTORS.pitchPalette,
          firstEntry: 128,
          entries: 16,
          sourceArchive: "retained-native-renderer",
        },
        {
          id: "renderer-slot-0-home-highlight",
          selector: NATIVE_PLAYER_SELECTORS.teamAHomeHighlightPalette,
          firstEntry: 224,
          entries: 8,
          sourceArchive: "retained-native-renderer",
        },
        {
          id: "renderer-slot-1-away-highlight",
          selector: NATIVE_PLAYER_SELECTORS.teamBAwayHighlightPalette,
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
        nativePlayerFoundation: "EUROREND TMD_TEXDATA slots 1 through 532",
        nativePlayerHighlights: "EUROREND TMD_TEXDATA slots 533 through 548",
        nativePlayerNumbersAndWorld: "EUROREND TMD_TEXDATA slots 549 through 1006",
      },
    },
    playerSourceAudit,
    officialSourcePages: officialSourceAtlas.metadata,
    playerHighlightPrebake: {
      schema: "cssoccer-prepared-player-highlight-textures@1",
      status: "ready-source-backed-prebaked-highlight-alpha",
      sourceArchive: "retained-native-renderer",
      sourcePage: PLAYER_HIGHLIGHT_PAGE_INDEX,
      sourceSelector: NATIVE_PLAYER_SELECTORS.extraPage,
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
      rgba: [...SOURCE_MARKING_RGBA],
      alphaMode: "opaque",
      imageRendering: "pixelated",
      runtimeConstruction: false,
    },
    hudGlyphAtlas: {
      schema: "cssoccer-prepared-native-hud-glyph-atlas@2",
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
        pages: [
          {
            role: "normal-match-low-resolution-font",
            page: {
              symbol: HUD_NORMAL_FONT.sourcePageSymbol,
              selector: HUD_NORMAL_FONT.sourcePageSelector,
              bytes: nativeArchive.recordInfo(HUD_NORMAL_FONT.sourcePageSelector).size,
            },
            runtimePageY: HUD_NORMAL_FONT.sourceY,
            recordSourceRect: {
              x: HUD_NORMAL_FONT.sourceX,
              y: HUD_NORMAL_FONT.sourcePitchRow,
              width: HUD_NORMAL_FONT.columns * HUD_NORMAL_FONT.cellWidth,
              height: HUD_NORMAL_FONT.rows * HUD_NORMAL_FONT.cellHeight,
            },
          },
          {
            role: "halftime-menu-high-resolution-font",
            page: PINNED_NATIVE_ARCHIVE.glyphPage,
            runtimePageY: HUD_MENU_FONT.sourceY,
            recordSourceRect: {
              x: HUD_MENU_FONT.sourceX,
              y: HUD_MENU_FONT.sourcePitchRow,
              width: HUD_MENU_FONT.columns * HUD_MENU_FONT.cellWidth,
              height: HUD_MENU_FONT.rows * HUD_MENU_FONT.cellHeight,
            },
          },
        ],
      },
      fonts: HUD_FONTS,
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
    halftimeMenuSpriteAtlas: {
      schema: "cssoccer-prepared-native-halftime-menu-sprites@1",
      path: HALFTIME_MENU_SPRITE_ATLAS_PATH,
      url: HALFTIME_MENU_SPRITE_ATLAS_URL,
      mediaType: "image/png",
      width: PAGE_SIZE,
      height: PAGE_SIZE,
      bytes: halftimeMenuSpriteAtlas.pngBytes.length,
      sha256: halftimeMenuSpriteAtlas.sha256,
      rgbaSha256: sha256(halftimeMenuSpriteAtlas.rgba),
      source: {
        data: { file: "EUROREND.DAT", ...PINNED_NATIVE_ARCHIVE.data },
        index: { file: "EUROREND.OFF", ...PINNED_NATIVE_ARCHIVE.index },
        ...HALFTIME_MENU_SOURCE,
      },
      sourceDrawContract: {
        file: "3DENG.C",
        functions: [
          "draw_menu_box",
          "halftime_menu",
          "draw_sprite",
          "draw_sprite_hf",
          "draw_sprite_vf",
          "draw_sprite_vhf",
        ],
        zero: "transparent",
        one: "replace with draw_sprite colour index zero",
        greaterThanOne: "decrement source palette index by one",
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
        width: PAGE_SIZE,
        height: PAGE_SIZE,
        sha256: stadiumAtlas.pageSha256[index],
        packedInRuntimeAtlas: false,
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
        rasterScale: STADIUM_CUTOUT_RASTER_SCALE,
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
        mode: "prepare-time tight edge-basis cutout for native triangles",
      },
      quadCutouts: {
        count: stadiumAtlas.quadCutouts.length,
        rasterScale: STADIUM_CUTOUT_RASTER_SCALE,
        textureIndexes: stadiumAtlas.quadCutouts.map(({ textureIndex }) => textureIndex),
        opaque: stadiumAtlas.quadCutouts.filter(({ alphaMode }) => alphaMode === "opaque").length,
        masked: stadiumAtlas.quadCutouts.filter(({ alphaMode }) => alphaMode === "mask").length,
        canonicalAxisAligned: stadiumAtlas.quadCutouts.filter(({
          sourceRasterOrientation,
        }) => sourceRasterOrientation === "canonical-axis-aligned-source-rect").length,
        nativeProjectiveFallback: stadiumAtlas.quadCutouts.filter(({
          sourceRasterOrientation,
        }) => sourceRasterOrientation === "native-projective-quad").length,
        mode: "prepare-time canonical source raster with per-face corner order",
      },
      sharedCutoutRasters: {
        schema: "cssoccer-prepared-stadium-shared-cutouts@1",
        logicalCutoutCount: (
          stadiumAtlas.triangleCutouts.length + stadiumAtlas.quadCutouts.length
        ),
        canonicalRasterCount: stadiumAtlas.canonicalCutouts.length,
        reusedLogicalCutoutCount: (
          stadiumAtlas.triangleCutouts.length
          + stadiumAtlas.quadCutouts.length
          - stadiumAtlas.canonicalCutouts.length
        ),
        contentIdentity:
          "exact prepared RGBA transforms plus native indexed identity and subrect containment",
        supportedTransforms: STADIUM_RASTER_TRANSFORMS.map(({ id }) => id),
        packing: stadiumAtlas.cutoutPacking,
        runtimeImageConstruction: false,
      },
      scanlineSourceRasters: {
        schema: "cssoccer-prepared-stadium-scanline-source-rasters@1",
        count: stadiumAtlas.scanlineSourceCutouts.length,
        textureIndexes: stadiumAtlas.scanlineSourceCutouts.flatMap(({
          textureIndexes,
        }) => textureIndexes),
        mode:
          "indexed-content and containment-deduplicated native scanline sources with shared atlas views",
        runtimeImageConstruction: false,
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
        quadCutoutCount: stadiumAtlas.goalNetQuadCutouts.length,
        atlasRegion: GOAL_NET_TEXTURE.atlasRegion,
        projectionStage: "prepare-time homography-preserving native quad cutout",
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
      "compiled stadlist[0] selects retained EUROREND BM_PB selector 912",
      "compiled stadlist[0] selects retained EUROREND COL_P5 selector 544",
      "medium-detail pitch sampling repeats the 32 by 32 tile at row 32 column 64 via pan mask 0x1f1f",
      "BM_XARGENTI selector 96 supplies the complete 256 by 256 Argentina kit page",
      "retail TMD_TEXDATA slots 549 through 578 supply all fifteen Spain and Argentina shirt-number records",
      "COL_XCAUCASA selector 480 supplies Spain's retained native eight-entry skin palette",
      "COL_XLATINO selector 1536 supplies Argentina's playable-demo eight-entry skin palette",
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
    halftimeMenuSpriteAssetFile: Object.freeze({
      path: HALFTIME_MENU_SPRITE_ATLAS_PATH,
      mediaType: "image/png",
      bytes: halftimeMenuSpriteAtlas.pngBytes,
      expectedSha256: halftimeMenuSpriteAtlas.sha256,
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
    stadiumTriangleCutouts: stadiumAtlas.triangleCutouts,
    stadiumTriangleMaterials: stadiumAtlas.triangleMaterials,
    stadiumQuadCutouts: stadiumAtlas.quadCutouts,
    stadiumQuadMaterials: stadiumAtlas.quadMaterials,
    stadiumScanlineSourceCutouts: stadiumAtlas.scanlineSourceCutouts,
    stadiumScanlineSourceMaterials: stadiumAtlas.scanlineSourceMaterials,
    stadiumNativeRasterSource: stadiumAtlas.nativeRasterSource,
    goalNetTextureRecords: stadiumAtlas.goalNetTextureRecords,
    goalNetQuadCutouts: stadiumAtlas.goalNetQuadCutouts,
    goalNetQuadMaterials: stadiumAtlas.goalNetQuadMaterials,
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
        referenceViewport: [640, 400],
        referencePerspective: 440,
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
  const rgba = Buffer.alloc(STADIUM_ATLAS_WIDTH * STADIUM_ATLAS_HEIGHT * 4);
  const goalNet = prepareGoalNetQuadCutouts({
    nativeArchive,
    palette: matchPalette,
    rgba,
  });
  const {
    canonicalCutouts,
    packing: cutoutPacking,
    triangleCutouts,
    quadCutouts,
    scanlineSourceCutouts,
    nativeRasterSource,
  } = prebakeStadiumTextureCutouts({
    indexedPages,
    occupiedRects: goalNet.quadCutouts,
    palette,
    rgba,
    textureAlphaModes,
    textureRecords,
  });
  const pngBytes = encodeRgbaPng(STADIUM_ATLAS_WIDTH, STADIUM_ATLAS_HEIGHT, rgba);
  const assetSha256 = sha256(pngBytes);
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
  const quadMaterials = Array.from({ length: textureRecords.length }, () => null);
  for (const cutout of quadCutouts) {
    quadMaterials[cutout.textureIndex] = createAtlasMaterial({
      page: 0,
      x: cutout.x,
      y: cutout.y,
      width: cutout.width,
      height: cutout.height,
      assetSha256,
      key: `cssoccer-stadium-quad-${cutout.textureIndex}`,
      assetUrl: STADIUM_ATLAS_URL,
      imageWidth: STADIUM_ATLAS_WIDTH,
      imageHeight: STADIUM_ATLAS_HEIGHT,
      projection: "projective",
    });
  }
  const scanlineSourceMaterials = scanlineSourceCutouts.map((cutout) => (
    createAtlasMaterial({
      page: 0,
      x: cutout.x,
      y: cutout.y,
      width: cutout.width,
      height: cutout.height,
      assetSha256,
      key: cutout.id,
      assetUrl: STADIUM_ATLAS_URL,
      imageWidth: STADIUM_ATLAS_WIDTH,
      imageHeight: STADIUM_ATLAS_HEIGHT,
      projection: "projective",
    })
  ));
  const goalNetQuadMaterials = Array.from(
    { length: goalNet.textureRecords.length },
    () => null,
  );
  for (const cutout of goalNet.quadCutouts) {
    goalNetQuadMaterials[cutout.textureIndex] = createAtlasMaterial({
      page: 0,
      x: cutout.x,
      y: cutout.y,
      width: cutout.width,
      height: cutout.height,
      assetSha256,
      key: `cssoccer-goal-net-quad-${cutout.nativeTextureSlot}`,
      assetUrl: STADIUM_ATLAS_URL,
      imageWidth: STADIUM_ATLAS_WIDTH,
      imageHeight: STADIUM_ATLAS_HEIGHT,
      projection: "projective",
    });
  }
  return Object.freeze({
    indexedPixelsSha256: sha256(Buffer.concat(indexedPages)),
    triangleMaterials: deepFreeze(triangleMaterials),
    triangleCutouts,
    quadMaterials: deepFreeze(quadMaterials),
    quadCutouts,
    canonicalCutouts,
    cutoutPacking,
    scanlineSourceCutouts,
    scanlineSourceMaterials: deepFreeze(scanlineSourceMaterials),
    nativeRasterSource,
    goalNetTextureRecords: goalNet.textureRecords,
    goalNetQuadMaterials: deepFreeze(goalNetQuadMaterials),
    goalNetQuadCutouts: goalNet.quadCutouts,
    goalNetSourceBitmapSha256: goalNet.sourceBitmapSha256,
    goalNetRemappedBitmapSha256: goalNet.remappedBitmapSha256,
    goalNetPaletteSha256: goalNet.paletteSha256,
    textureAlphaModes,
    pageSha256: Object.freeze(indexedPages.map((page) => sha256(page))),
    paletteSha256: sha256(palette),
    placements: deepFreeze([
      ...goalNet.quadCutouts,
      ...canonicalCutouts,
      ...scanlineSourceCutouts,
    ]),
    pngBytes,
    rgba,
    sha256: assetSha256,
    textureRecords,
    textureTableSha256: sha256(textureTableBytes),
  });
}

function prepareGoalNetQuadCutouts({ nativeArchive, palette, rgba }) {
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
    .map((record) => goalNetQuadCutoutSpec(record))
    .sort((left, right) => (
      right.height - left.height
      || right.width - left.width
      || left.nativeTextureSlot - right.nativeTextureSlot
    ));
  packGoalNetCutouts(specs);
  for (const spec of specs) {
    rasterGoalNetQuadCutout({
      indexedPage: remappedBitmap,
      palette,
      rgba,
      spec,
    });
  }
  return deepFreeze({
    textureRecords,
    quadCutouts: specs.sort((left, right) => left.textureIndex - right.textureIndex),
    sourceBitmapSha256: sha256(sourceBitmap),
    remappedBitmapSha256: sha256(remappedBitmap),
    paletteSha256: sha256(palette),
  });
}

function goalNetQuadCutoutSpec(record) {
  const sourceXs = record.uvs.map(([u]) => u * PAGE_SIZE);
  const sourceYs = record.uvs.map(([, v]) => (1 - v) * PAGE_SIZE);
  const sourceLeft = Math.floor(Math.min(...sourceXs));
  const sourceRight = Math.ceil(Math.max(...sourceXs));
  const sourceTop = Math.floor(Math.min(...sourceYs));
  const sourceBottom = Math.ceil(Math.max(...sourceYs));
  const width = Math.max(1, sourceRight - sourceLeft);
  const height = Math.max(1, sourceBottom - sourceTop);
  return {
    id: `native-goal-net-quad-${record.nativeTextureSlot}`,
    kind: "prebaked-native-goal-net-projective-quad",
    textureIndex: record.textureIndex,
    nativeTextureSlot: record.nativeTextureSlot,
    sourceColorCode: record.sourceColorCode,
    nativePage: record.page,
    alphaMode: "mask",
    directImageTransform: "projective-quad",
    sourceRect: {
      x: sourceLeft,
      y: sourceTop,
      width,
      height,
    },
    sourceUvs: record.uvs,
    destinationUvs: FULL_IMAGE_UVS,
    destinationToSourceHomography: solveUvHomography(FULL_IMAGE_UVS, record.uvs),
    width,
    height,
    x: 0,
    y: 0,
  };
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

function rasterGoalNetQuadCutout({ indexedPage, palette, rgba, spec }) {
  let transparentTexels = 0;
  let opaqueTexels = 0;
  for (let y = 0; y < spec.height; y += 1) {
    for (let x = 0; x < spec.width; x += 1) {
      const destinationU = (x + 0.5) / spec.width;
      const destinationV = 1 - (y + 0.5) / spec.height;
      const [sourceU, sourceV] = applyUvHomography(
        spec.destinationToSourceHomography,
        destinationU,
        destinationV,
      );
      const sourceX = clamp(Math.floor(sourceU * PAGE_SIZE), 0, PAGE_SIZE - 1);
      const sourceY = clamp(Math.floor((1 - sourceV) * PAGE_SIZE), 0, PAGE_SIZE - 1);
      const paletteIndex = indexedPage[sourceY * PAGE_SIZE + sourceX];
      const target = ((spec.y + y) * STADIUM_ATLAS_WIDTH + spec.x + x) * 4;
      if (paletteIndex === GOAL_NET_TEXTURE.transparentPaletteIndex) {
        transparentTexels += 1;
        continue;
      }
      rgba[target] = expandVgaComponent(palette[paletteIndex * 3]);
      rgba[target + 1] = expandVgaComponent(palette[paletteIndex * 3 + 1]);
      rgba[target + 2] = expandVgaComponent(palette[paletteIndex * 3 + 2]);
      rgba[target + 3] = 255;
      opaqueTexels += 1;
    }
  }
  if (transparentTexels === 0 || opaqueTexels === 0) {
    throw new Error(
      `Prepared native goal-net quad ${spec.nativeTextureSlot} lost its mask or visible strands.`,
    );
  }
  spec.transparentTexels = transparentTexels;
  spec.opaqueTexels = opaqueTexels;
}

function solveUvHomography(destinationUvs, sourceUvs) {
  if (
    !Array.isArray(destinationUvs)
    || !Array.isArray(sourceUvs)
    || destinationUvs.length !== 4
    || sourceUvs.length !== 4
  ) {
    throw new Error("Native goal-net homography requires four destination and source UVs.");
  }
  const matrix = [];
  const values = [];
  for (let index = 0; index < 4; index += 1) {
    const [x, y] = destinationUvs[index];
    const [u, v] = sourceUvs[index];
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    values.push(u);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    values.push(v);
  }
  return solveLinearSystem(matrix, values);
}

function applyUvHomography(coefficients, x, y) {
  const denominator = coefficients[6] * x + coefficients[7] * y + 1;
  if (!Number.isFinite(denominator) || Math.abs(denominator) <= 1e-12) {
    throw new Error("Native goal-net UV homography crossed its projective horizon.");
  }
  return [
    (coefficients[0] * x + coefficients[1] * y + coefficients[2]) / denominator,
    (coefficients[3] * x + coefficients[4] * y + coefficients[5]) / denominator,
  ];
}

function solveLinearSystem(matrix, values) {
  const rows = matrix.map((row, index) => [...row, values[index]]);
  for (let column = 0; column < rows.length; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < rows.length; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) <= 1e-12) {
      throw new Error("Native goal-net UV quad has no stable projective transform.");
    }
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    for (let entry = column; entry <= rows.length; entry += 1) {
      rows[column][entry] /= divisor;
    }
    for (let row = 0; row < rows.length; row += 1) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let entry = column; entry <= rows.length; entry += 1) {
        rows[row][entry] -= factor * rows[column][entry];
      }
    }
  }
  const solution = rows.map((row) => row[rows.length]);
  if (solution.some((value) => !Number.isFinite(value))) {
    throw new Error("Native goal-net UV homography produced a non-finite coefficient.");
  }
  return solution;
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

function prebakeStadiumTextureCutouts({
  indexedPages,
  occupiedRects,
  palette,
  rgba,
  textureAlphaModes,
  textureRecords,
}) {
  const triangleSpecs = textureRecords
    .filter(({ vertexCount }) => vertexCount === 3)
    .map((record) => (
      triangleCutoutSpec(
        record,
        0,
        [0, 1, 2],
        textureAlphaModes[record.textureIndex],
      )
    ));
  const quadSpecs = textureRecords
    .filter(({ vertexCount }) => vertexCount === 4)
    .map((record) => stadiumQuadCutoutSpec(
      record,
      textureAlphaModes[record.textureIndex],
    ));
  const scanlineSourceRasters = prepareStadiumScanlineSourceRasters({
    indexedPages,
    palette,
    specs: [...triangleSpecs, ...quadSpecs],
  });
  const sharedSourceSpecs = quadSpecs.filter((spec) => (
    spec.alphaMode === "opaque"
    && spec.sourceRasterOrientation === "canonical-axis-aligned-source-rect"
  ));
  const sharedSourceSpecIds = new Set(sharedSourceSpecs.map(({ id }) => id));
  const sharedSourceRasters = prepareStadiumSharedSourceRasters({
    scanlineSourceRasters,
    specs: sharedSourceSpecs,
  });
  const specs = [...triangleSpecs, ...quadSpecs]
    .filter(({ id }) => !sharedSourceSpecIds.has(id))
    .sort((left, right) => (
      right.height - left.height
      || right.width - left.width
      || left.textureIndex - right.textureIndex
      || (left.triangleIndex ?? 0) - (right.triangleIndex ?? 0)
    ));
  const canonicalByRaster = new Map();
  for (const spec of specs) {
    const raster = spec.directImageTransform === "projective-quad"
      ? renderStadiumQuadCutout({ indexedPages, palette, spec })
      : renderStadiumTriangleCutout({ indexedPages, palette, spec });
    let canonical = null;
    let rasterTransform = null;
    for (const transform of STADIUM_RASTER_TRANSFORMS) {
      const transformed = transformStadiumRgbaRaster({
        height: spec.height,
        raster,
        transform,
        width: spec.width,
      });
      const rasterSha256 = sha256(transformed.raster);
      const key = `${transformed.width}x${transformed.height}:${rasterSha256}`;
      canonical = canonicalByRaster.get(key);
      if (canonical) {
        rasterTransform = transform;
        break;
      }
    }
    if (!canonical) {
      const rasterSha256 = sha256(raster);
      const key = `${spec.width}x${spec.height}:${rasterSha256}`;
      canonical = {
        raster,
        rasterSha256,
        width: spec.width,
        height: spec.height,
        members: [],
      };
      canonicalByRaster.set(key, canonical);
      rasterTransform = STADIUM_RASTER_TRANSFORMS[0];
    }
    spec.atlasRasterTransform = rasterTransform.id;
    spec.atlasUvs = transformStadiumRasterUvs(FULL_IMAGE_UVS, rasterTransform);
    canonical.members.push(spec);
  }
  const canonicalRasters = [...canonicalByRaster.values()]
    .map((canonical) => {
      const memberIds = canonical.members.map(({ id }) => id).sort();
      const sourceRects = [...new Map(canonical.members.map((member) => {
        const descriptor = {
          nativePage: member.nativePage,
          ...member.sourceRect,
        };
        return [JSON.stringify(descriptor), descriptor];
      })).values()];
      return {
        ...canonical,
        placement: {
          id: `native-stadium-shared-raster-${canonical.rasterSha256.slice(0, 16)}`,
          kind: "prebaked-native-stadium-shared-raster",
          rgbaSha256: canonical.rasterSha256,
          width: canonical.width,
          height: canonical.height,
          x: 0,
          y: 0,
          sourceCutoutIds: memberIds,
          sourceCutoutTransforms: Object.fromEntries(
            canonical.members
              .map(({ atlasRasterTransform, id }) => [id, atlasRasterTransform])
              .sort(([left], [right]) => left.localeCompare(right)),
          ),
          textureIndexes: [...new Set(
            canonical.members.map(({ textureIndex }) => textureIndex),
          )].sort((left, right) => left - right),
          sourceRects,
        },
      };
    })
    .sort((left, right) => (
      right.width * right.height - left.width * left.height
      || right.height - left.height
      || right.width - left.width
      || left.placement.id.localeCompare(right.placement.id)
    ));
  const packedRasters = [...canonicalRasters, ...sharedSourceRasters]
    .sort((left, right) => (
      right.width * right.height - left.width * left.height
      || right.height - left.height
      || right.width - left.width
      || left.placement.id.localeCompare(right.placement.id)
    ));
  const packing = packStadiumSharedRasters(packedRasters, occupiedRects);
  for (const canonical of canonicalRasters) {
    const { placement } = canonical;
    blitStadiumCutout({
      rgba,
      raster: canonical.raster,
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
    });
    for (const spec of canonical.members) {
      spec.x = placement.x;
      spec.y = placement.y;
      spec.width = placement.width;
      spec.height = placement.height;
      spec.canonicalTextureId = placement.id;
      spec.canonicalTextureSha256 = placement.rgbaSha256;
      spec.canonicalTextureMemberCount = canonical.members.length;
    }
  }
  for (const sharedSourceRaster of sharedSourceRasters) {
    const { placement } = sharedSourceRaster;
    blitStadiumCutout({
      rgba,
      raster: sharedSourceRaster.raster,
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
    });
    bindStadiumSpecsToSharedSourceRaster(sharedSourceRaster);
  }
  bindUnpackedStadiumScanlineSourcesToCanonicalCutouts({
    specs: [...triangleSpecs, ...quadSpecs],
    scanlineSourceRasters,
  });
  return deepFreeze({
    canonicalCutouts: [
      ...canonicalRasters.map(({ placement }) => placement),
      ...sharedSourceRasters.map(({ placement }) => placement),
    ],
    packing,
    triangleCutouts: triangleSpecs.sort((left, right) => (
      left.textureIndex - right.textureIndex
      || left.triangleIndex - right.triangleIndex
    )),
    quadCutouts: quadSpecs.sort((left, right) => (
      left.textureIndex - right.textureIndex
    )),
    scanlineSourceCutouts: scanlineSourceRasters.map(({ placement }) => placement),
    nativeRasterSource: prepareNativeStadiumRasterSource({
      palette,
      scanlineSourceRasters,
    }),
  });
}

function prepareStadiumScanlineSourceRasters({ indexedPages, palette, specs }) {
  const sourcesByRaster = new Map();
  for (const spec of specs) {
    const exactTriangle = spec.kind === "prebaked-native-texture-triangle";
    const reusableSourceQuad = (
      spec.kind === "prebaked-native-stadium-projective-quad"
      && spec.sourceRasterOrientation === "canonical-axis-aligned-source-rect"
    );
    if (
      spec.alphaMode !== "opaque"
      || (
        !exactTriangle
        && !reusableSourceQuad
        && !isStadiumScanlineSourceSpec(spec)
      )
    ) continue;
    const raster = renderStadiumSourceRect({
      alphaMode: spec.alphaMode,
      indexedPages,
      nativePage: spec.nativePage,
      padding: STADIUM_SCANLINE_SOURCE_PADDING,
      palette,
      sourceRect: spec.sourceRect,
    });
    const indexedRaster = renderStadiumIndexedSourceRect({
      indexedPages,
      nativePage: spec.nativePage,
      padding: STADIUM_SCANLINE_SOURCE_PADDING,
      sourceRect: spec.sourceRect,
    });
    const rasterSha256 = sha256(raster);
    const indexedSha256 = sha256(indexedRaster);
    const rasterWidth = spec.sourceRect.width + STADIUM_SCANLINE_SOURCE_PADDING * 2;
    const rasterHeight = spec.sourceRect.height + STADIUM_SCANLINE_SOURCE_PADDING * 2;
    const key = `${rasterWidth}x${rasterHeight}:${indexedSha256}`;
    let source = sourcesByRaster.get(key);
    if (!source) {
      source = {
        indexedRaster,
        raster,
        width: rasterWidth,
        height: rasterHeight,
        sourceRects: [],
        textureIndexes: [],
        placement: {
          id: `native-stadium-scanline-source-${indexedSha256.slice(0, 16)}`,
          kind: "prebaked-native-stadium-scanline-source-raster",
          rgbaSha256: rasterSha256,
          sourceRects: [],
          rasterScale: 1,
          sourcePadding: STADIUM_SCANLINE_SOURCE_PADDING,
          textureIndexes: [],
          width: rasterWidth,
          height: rasterHeight,
          x: 0,
          y: 0,
        },
      };
      sourcesByRaster.set(key, source);
    }
    const sourceRect = {
      nativePage: spec.nativePage,
      ...spec.sourceRect,
    };
    if (!source.sourceRects.some((entry) => (
      entry.nativePage === sourceRect.nativePage
      && sameStadiumSourceRect(entry, sourceRect)
    ))) {
      source.sourceRects.push(sourceRect);
    }
    source.textureIndexes.push(spec.textureIndex);
  }
  const sources = deduplicateContainedStadiumScanlineSources(
    [...sourcesByRaster.values()],
  );
  return sources.map((source) => {
    source.sourceRects.sort((left, right) => (
      left.nativePage - right.nativePage
      || left.y - right.y
      || left.x - right.x
    ));
    source.textureIndexes = [...new Set(source.textureIndexes)]
      .sort((left, right) => left - right);
    source.nativeRasterMappings.sort((left, right) => (
      left.nativePage - right.nativePage
      || left.y - right.y
      || left.x - right.x
      || left.rasterOffsetY - right.rasterOffsetY
      || left.rasterOffsetX - right.rasterOffsetX
    ));
    source.placement.sourceRects = source.sourceRects.map((entry) => ({ ...entry }));
    source.placement.nativeRasterMappings = source.nativeRasterMappings
      .map((entry) => ({ ...entry }));
    source.placement.textureIndexes = [...source.textureIndexes];
    return source;
  });
}

function deduplicateContainedStadiumScanlineSources(sources) {
  const sorted = [...sources].sort((left, right) => (
    right.width * right.height - left.width * left.height
    || right.height - left.height
    || right.width - left.width
    || left.placement.id.localeCompare(right.placement.id)
  ));
  const retained = [];
  for (const source of sorted) {
    const contained = retained
      .map((candidate) => ({
        candidate,
        offset: findStadiumIndexedRasterOffset(candidate, source),
      }))
      .find(({ offset }) => offset !== null);
    if (!contained) {
      source.nativeRasterMappings = source.sourceRects.map((sourceRect) => ({
        ...sourceRect,
        rasterOffsetX: 0,
        rasterOffsetY: 0,
      }));
      retained.push(source);
      continue;
    }
    const { candidate, offset } = contained;
    for (const sourceRect of source.sourceRects) {
      if (!candidate.sourceRects.some((entry) => (
        entry.nativePage === sourceRect.nativePage
        && sameStadiumSourceRect(entry, sourceRect)
      ))) {
        candidate.sourceRects.push(sourceRect);
      }
      candidate.nativeRasterMappings.push({
        ...sourceRect,
        rasterOffsetX: offset.x,
        rasterOffsetY: offset.y,
      });
    }
    candidate.textureIndexes.push(...source.textureIndexes);
  }
  return retained;
}

function findStadiumIndexedRasterOffset(outer, inner) {
  if (
    inner.width > outer.width
    || inner.height > outer.height
  ) {
    return null;
  }
  for (let y = 0; y <= outer.height - inner.height; y += 1) {
    for (let x = 0; x <= outer.width - inner.width; x += 1) {
      let matches = true;
      for (let row = 0; row < inner.height; row += 1) {
        const outerStart = (y + row) * outer.width + x;
        const innerStart = row * inner.width;
        if (!outer.indexedRaster.subarray(
          outerStart,
          outerStart + inner.width,
        ).equals(inner.indexedRaster.subarray(
          innerStart,
          innerStart + inner.width,
        ))) {
          matches = false;
          break;
        }
      }
      if (matches) return { x, y };
    }
  }
  return null;
}

function isStadiumScanlineSourceSpec(spec) {
  return (
    (
      spec.sourceRect.width >= STADIUM_SCANLINE_SOURCE_MIN_WIDTH
      && spec.sourceRect.height >= STADIUM_SCANLINE_SOURCE_MIN_HEIGHT
    )
    || STADIUM_SCANLINE_BILLBOARD_TEXTURE_INDEXES.includes(spec.textureIndex)
  );
}

function prepareStadiumSharedSourceRasters({
  scanlineSourceRasters,
  specs,
}) {
  const matchedSpecIds = new Set();
  const shared = scanlineSourceRasters.map((source) => {
    const members = specs.filter((spec) => (
      source.textureIndexes.includes(spec.textureIndex)
    ));
    for (const member of members) matchedSpecIds.add(member.id);
    const placement = source.placement;
    placement.nativeRasterSourceId = placement.id;
    placement.nativeRasterWidth = source.width;
    placement.nativeRasterHeight = source.height;
    if (members.length === 0) return null;
    // These opaque quads are painted by the retained indexed scanline source,
    // so the PNG only needs one exact source texel per atlas texel. Keeping a
    // redundant 2x nearest-neighbour copy made the physical sheet 20% larger
    // without changing the native raster path.
    const atlasRasterScale = STADIUM_SHARED_SOURCE_ATLAS_RASTER_SCALE;
    const scaled = scaleStadiumRgbaRasterNearest({
      height: source.height,
      raster: source.raster,
      scale: atlasRasterScale,
      width: source.width,
    });
    placement.kind = "prebaked-native-stadium-shared-source-raster";
    placement.rgbaSha256 = sha256(scaled.raster);
    placement.atlasRasterScale = atlasRasterScale;
    placement.sourceCutoutIds = members.map(({ id }) => id).sort();
    placement.width = scaled.width;
    placement.height = scaled.height;
    return {
      height: scaled.height,
      members,
      placement,
      raster: scaled.raster,
      width: scaled.width,
    };
  }).filter(Boolean);
  if (
    matchedSpecIds.size !== specs.length
    || specs.some(({ id }) => !matchedSpecIds.has(id))
  ) {
    throw new Error(
      "Prepared stadium shared source rasters lost a logical cutout: "
      + JSON.stringify({
        unmatchedSources: scanlineSourceRasters
          .filter((source) => !shared.some(({ placement }) => (
            placement.id === source.placement.id
          )))
          .map(({ placement }) => placement.id),
        unmatchedSpecs: specs
          .filter(({ id }) => !matchedSpecIds.has(id))
          .map(({ id }) => id),
      }),
    );
  }
  return shared;
}

function bindStadiumSpecsToSharedSourceRaster(shared) {
  const { placement } = shared;
  const atlasRasterScale = placement.atlasRasterScale;
  for (const spec of shared.members) {
    spec.x = placement.x + placement.sourcePadding * atlasRasterScale;
    spec.y = placement.y + placement.sourcePadding * atlasRasterScale;
    spec.width = spec.sourceRect.width * atlasRasterScale;
    spec.height = spec.sourceRect.height * atlasRasterScale;
    spec.atlasRasterTransform = STADIUM_RASTER_TRANSFORMS[0].id;
    spec.atlasUvs = FULL_IMAGE_UVS;
    spec.canonicalTextureId = placement.id;
    spec.canonicalTextureSha256 = placement.rgbaSha256;
    spec.canonicalTextureMemberCount = shared.members.length;
  }
}

function bindUnpackedStadiumScanlineSourcesToCanonicalCutouts({
  specs,
  scanlineSourceRasters,
}) {
  for (const source of scanlineSourceRasters) {
    const { placement } = source;
    if (Number.isSafeInteger(placement.atlasRasterScale)) continue;
    const alias = specs
      .filter(({ textureIndex }) => source.textureIndexes.includes(textureIndex))
      .sort((left, right) => left.textureIndex - right.textureIndex)[0];
    if (
      !alias
      || ![alias.x, alias.y].every((value) => (
        Number.isSafeInteger(value) && value >= 0
      ))
      || ![alias.width, alias.height].every((value) => (
        Number.isSafeInteger(value) && value > 0
      ))
    ) {
      throw new Error(
        `Prepared stadium scanline source ${placement.id} has no material alias.`,
      );
    }
    placement.kind = "prepared-native-stadium-scanline-material-alias";
    placement.atlasRasterScale = STADIUM_CUTOUT_RASTER_SCALE;
    placement.sourceCutoutIds = [alias.id];
    placement.x = alias.x;
    placement.y = alias.y;
    placement.width = alias.width;
    placement.height = alias.height;
  }
}

function prepareNativeStadiumRasterSource({ palette, scanlineSourceRasters }) {
  if (!Buffer.isBuffer(palette) || palette.length !== 256 * 3) {
    throw new Error("Prepared native stadium raster requires the exact 256-entry palette.");
  }
  const colors = Array.from({ length: 256 }, (_unused, paletteIndex) => {
    const offset = paletteIndex * 3;
    return `#${
      [palette[offset], palette[offset + 1], palette[offset + 2]]
        .map((component) => expandVgaComponent(component).toString(16).padStart(2, "0"))
        .join("")
    }`;
  });
  const sources = scanlineSourceRasters.map(({
    height,
    indexedRaster,
    placement,
    width,
  }) => {
    if (
      !Buffer.isBuffer(indexedRaster)
      || indexedRaster.length !== width * height
    ) {
      throw new Error(`Prepared stadium raster ${placement.id} lost its indexed pixels.`);
    }
    return {
      id: placement.id,
      encoding: "palette-index-u8-row-major-base64",
      height,
      pixelsBase64: indexedRaster.toString("base64"),
      pixelsSha256: sha256(indexedRaster),
      width,
    };
  });
  return deepFreeze({
    schema: STADIUM_NATIVE_RASTER_SOURCE_SCHEMA,
    interpolation: "polym-screen-space-fixed16",
    colors,
    sources,
    sourceCount: sources.length,
    runtimeImageConstruction: false,
  });
}

function packStadiumSharedRasters(canonicalRasters, occupiedRects) {
  if (!Array.isArray(occupiedRects) || occupiedRects.length === 0) {
    throw new Error("Prepared stadium packing requires its fixed source-page placements.");
  }
  let freeRects = [{
    x: 0,
    y: 0,
    width: STADIUM_ATLAS_WIDTH,
    height: STADIUM_ATLAS_HEIGHT,
  }];
  for (const occupied of occupiedRects) {
    assertStadiumAtlasRect(occupied, "fixed atlas placement");
    freeRects = splitStadiumFreeRects(freeRects, occupied);
  }
  for (const canonical of canonicalRasters) {
    const { placement } = canonical;
    let best = null;
    for (const free of freeRects) {
      if (placement.width > free.width || placement.height > free.height) continue;
      const remainingWidth = free.width - placement.width;
      const remainingHeight = free.height - placement.height;
      const score = [
        Math.min(remainingWidth, remainingHeight),
        Math.max(remainingWidth, remainingHeight),
        free.y,
        free.x,
      ];
      if (!best || compareStadiumPackScores(score, best.score) < 0) {
        best = { free, score };
      }
    }
    if (!best) {
      throw new Error(
        `Prepared stadium shared raster ${placement.id} no longer fits the fixed `
        + `${STADIUM_ATLAS_WIDTH} by ${STADIUM_ATLAS_HEIGHT} atlas.`,
      );
    }
    placement.x = best.free.x;
    placement.y = best.free.y;
    freeRects = splitStadiumFreeRects(freeRects, placement);
  }
  const placements = canonicalRasters.map(({ placement }) => placement);
  const packedRects = [...occupiedRects, ...placements];
  for (let leftIndex = 0; leftIndex < packedRects.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < packedRects.length;
      rightIndex += 1
    ) {
      if (stadiumRectsOverlap(packedRects[leftIndex], packedRects[rightIndex])) {
        throw new Error(
          `Prepared stadium atlas placements ${packedRects[leftIndex].id} and `
          + `${packedRects[rightIndex].id} overlap.`,
        );
      }
    }
  }
  return {
    algorithm: "deterministic-maxrects-best-short-side-fit",
    atlasWidth: STADIUM_ATLAS_WIDTH,
    atlasHeight: STADIUM_ATLAS_HEIGHT,
    fixedPlacementCount: occupiedRects.length,
    packedRasterCount: placements.length,
    usedBounds: {
      width: Math.max(...packedRects.map(({ x, width }) => x + width)),
      height: Math.max(...packedRects.map(({ y, height }) => y + height)),
    },
  };
}

function splitStadiumFreeRects(freeRects, occupied) {
  const split = [];
  for (const free of freeRects) {
    if (!stadiumRectsOverlap(free, occupied)) {
      split.push(free);
      continue;
    }
    if (occupied.x > free.x) {
      split.push({
        x: free.x,
        y: free.y,
        width: occupied.x - free.x,
        height: free.height,
      });
    }
    if (occupied.x + occupied.width < free.x + free.width) {
      split.push({
        x: occupied.x + occupied.width,
        y: free.y,
        width: free.x + free.width - occupied.x - occupied.width,
        height: free.height,
      });
    }
    if (occupied.y > free.y) {
      split.push({
        x: free.x,
        y: free.y,
        width: free.width,
        height: occupied.y - free.y,
      });
    }
    if (occupied.y + occupied.height < free.y + free.height) {
      split.push({
        x: free.x,
        y: occupied.y + occupied.height,
        width: free.width,
        height: free.y + free.height - occupied.y - occupied.height,
      });
    }
  }
  return pruneContainedStadiumFreeRects(split);
}

function pruneContainedStadiumFreeRects(freeRects) {
  const pruned = [...freeRects];
  for (let index = 0; index < pruned.length; index += 1) {
    for (let otherIndex = 0; otherIndex < pruned.length; otherIndex += 1) {
      if (
        index !== otherIndex
        && stadiumRectContains(pruned[otherIndex], pruned[index])
      ) {
        pruned.splice(index, 1);
        index -= 1;
        break;
      }
    }
  }
  return pruned;
}

function stadiumRectContains(outer, inner) {
  return (
    inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height
  );
}

function stadiumRectsOverlap(left, right) {
  return (
    left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y
  );
}

function compareStadiumPackScores(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function assertStadiumAtlasRect(rect, label) {
  if (
    !rect
    || ![rect.x, rect.y, rect.width, rect.height].every(Number.isSafeInteger)
    || rect.x < 0
    || rect.y < 0
    || rect.width <= 0
    || rect.height <= 0
    || rect.x + rect.width > STADIUM_ATLAS_WIDTH
    || rect.y + rect.height > STADIUM_ATLAS_HEIGHT
  ) {
    throw new Error(`Prepared stadium ${label} is outside the atlas.`);
  }
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
  const width = Math.max(
    1,
    Math.ceil(Math.hypot(...uEdge) * PAGE_SIZE) * STADIUM_CUTOUT_RASTER_SCALE,
  );
  const height = Math.max(
    1,
    Math.ceil(Math.hypot(...vEdge) * PAGE_SIZE) * STADIUM_CUTOUT_RASTER_SCALE,
  );
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
    rasterScale: STADIUM_CUTOUT_RASTER_SCALE,
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

function stadiumQuadCutoutSpec(record, alphaMode) {
  const sourceXs = record.uvs.map(([u]) => u * PAGE_SIZE);
  const sourceYs = record.uvs.map(([, v]) => (1 - v) * PAGE_SIZE);
  const sourceLeft = Math.floor(Math.min(...sourceXs));
  const sourceRight = Math.ceil(Math.max(...sourceXs));
  const sourceTop = Math.floor(Math.min(...sourceYs));
  const sourceBottom = Math.ceil(Math.max(...sourceYs));
  const sourceWidth = Math.max(1, sourceRight - sourceLeft);
  const sourceHeight = Math.max(1, sourceBottom - sourceTop);
  const canonical = axisAlignedStadiumQuad(record.uvs);
  const rasterSourceUvs = canonical?.sourceUvs ?? record.uvs;
  const [origin, horizontal, , vertical] = rasterSourceUvs;
  const width = Math.max(
    1,
    Math.ceil(Math.hypot(
      horizontal[0] - origin[0],
      horizontal[1] - origin[1],
    ) * PAGE_SIZE) * STADIUM_CUTOUT_RASTER_SCALE,
  );
  const height = Math.max(
    1,
    Math.ceil(Math.hypot(
      vertical[0] - origin[0],
      vertical[1] - origin[1],
    ) * PAGE_SIZE) * STADIUM_CUTOUT_RASTER_SCALE,
  );
  return {
    id: `native-stadium-quad-${record.textureIndex}`,
    kind: "prebaked-native-stadium-projective-quad",
    textureIndex: record.textureIndex,
    alphaMode,
    directImageTransform: "projective-quad",
    rasterScale: STADIUM_CUTOUT_RASTER_SCALE,
    nativePage: record.page,
    sourceRect: {
      x: sourceLeft,
      y: sourceTop,
      width: sourceWidth,
      height: sourceHeight,
    },
    sourceUvs: record.uvs,
    rasterSourceUvs,
    vertexOrder: canonical?.vertexOrder ?? [0, 1, 2, 3],
    sourceRasterOrientation: canonical
      ? "canonical-axis-aligned-source-rect"
      : "native-projective-quad",
    destinationUvs: FULL_IMAGE_UVS,
    destinationToSourceHomography: solveUvHomography(
      FULL_IMAGE_UVS,
      rasterSourceUvs,
    ),
    width,
    height,
    x: 0,
    y: 0,
  };
}

function axisAlignedStadiumQuad(uvs) {
  const uniqueUs = uniqueSortedCoordinates(uvs.map(([u]) => u));
  const uniqueVs = uniqueSortedCoordinates(uvs.map(([, v]) => v));
  if (uniqueUs.length !== 2 || uniqueVs.length !== 2) return null;
  const [minU, maxU] = uniqueUs;
  const [minV, maxV] = uniqueVs;
  const sourceUvs = [
    [minU, maxV],
    [maxU, maxV],
    [maxU, minV],
    [minU, minV],
  ];
  const vertexOrder = sourceUvs.map(([sourceU, sourceV]) => (
    uvs.findIndex(([u, v]) => (
      Math.abs(u - sourceU) <= Number.EPSILON
      && Math.abs(v - sourceV) <= Number.EPSILON
    ))
  ));
  if (
    vertexOrder.some((index) => index < 0)
    || new Set(vertexOrder).size !== 4
  ) {
    return null;
  }
  return { sourceUvs, vertexOrder };
}

function uniqueSortedCoordinates(coordinates) {
  return [...coordinates]
    .sort((left, right) => left - right)
    .filter((coordinate, index, sorted) => (
      index === 0 || Math.abs(coordinate - sorted[index - 1]) > Number.EPSILON
    ));
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

function renderStadiumTriangleCutout({ indexedPages, palette, spec }) {
  const pageIndex = spec.nativePage - 8;
  const indexed = indexedPages[pageIndex];
  if (!indexed) throw new Error(`Native stadium page ${spec.nativePage} is unavailable.`);
  const raster = Buffer.alloc(spec.width * spec.height * 4);
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
      const targetY = spec.height - 1 - y;
      const target = (targetY * spec.width + x) * 4;
      if (
        spec.alphaMode === "mask"
        && paletteIndex === STADIUM_TRANSPARENT_PALETTE_INDEX
      ) {
        continue;
      }
      raster[target] = expandVgaComponent(palette[paletteIndex * 3]);
      raster[target + 1] = expandVgaComponent(palette[paletteIndex * 3 + 1]);
      raster[target + 2] = expandVgaComponent(palette[paletteIndex * 3 + 2]);
      raster[target + 3] = 255;
    }
  }
  return raster;
}

function renderStadiumQuadCutout({ indexedPages, palette, spec }) {
  const pageIndex = spec.nativePage - 8;
  const indexed = indexedPages[pageIndex];
  if (!indexed) throw new Error(`Native stadium page ${spec.nativePage} is unavailable.`);
  const raster = Buffer.alloc(spec.width * spec.height * 4);
  for (let y = 0; y < spec.height; y += 1) {
    for (let x = 0; x < spec.width; x += 1) {
      const destinationU = (x + 0.5) / spec.width;
      const destinationV = 1 - (y + 0.5) / spec.height;
      const [sourceU, sourceV] = applyUvHomography(
        spec.destinationToSourceHomography,
        destinationU,
        destinationV,
      );
      const sourceX = clamp(Math.floor(sourceU * PAGE_SIZE), 0, PAGE_SIZE - 1);
      const sourceY = clamp(Math.floor((1 - sourceV) * PAGE_SIZE), 0, PAGE_SIZE - 1);
      const paletteIndex = indexed[sourceY * PAGE_SIZE + sourceX];
      const target = (y * spec.width + x) * 4;
      if (
        spec.alphaMode === "mask"
        && paletteIndex === STADIUM_TRANSPARENT_PALETTE_INDEX
      ) {
        continue;
      }
      raster[target] = expandVgaComponent(palette[paletteIndex * 3]);
      raster[target + 1] = expandVgaComponent(palette[paletteIndex * 3 + 1]);
      raster[target + 2] = expandVgaComponent(palette[paletteIndex * 3 + 2]);
      raster[target + 3] = 255;
    }
  }
  return raster;
}

function transformStadiumRgbaRaster({ height, raster, transform, width }) {
  let transformed = { height, raster, width };
  for (let turn = 0; turn < transform.quarterTurns; turn += 1) {
    transformed = rotateStadiumRgbaRasterClockwise(transformed);
  }
  if (transform.reflectX) {
    transformed = reflectStadiumRgbaRasterX(transformed);
  }
  return transformed;
}

function rotateStadiumRgbaRasterClockwise({ height, raster, width }) {
  const rotated = Buffer.alloc(raster.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const source = (y * width + x) * 4;
      const targetX = height - 1 - y;
      const targetY = x;
      const target = (targetY * height + targetX) * 4;
      raster.copy(rotated, target, source, source + 4);
    }
  }
  return {
    height: width,
    raster: rotated,
    width: height,
  };
}

function reflectStadiumRgbaRasterX({ height, raster, width }) {
  const reflected = Buffer.alloc(raster.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const source = (y * width + x) * 4;
      const target = (y * width + width - 1 - x) * 4;
      raster.copy(reflected, target, source, source + 4);
    }
  }
  return { height, raster: reflected, width };
}

function transformStadiumRasterUvs(uvs, transform) {
  return uvs.map(([sourceU, sourceV]) => {
    let u = sourceU;
    let v = sourceV;
    for (let turn = 0; turn < transform.quarterTurns; turn += 1) {
      [u, v] = [v, 1 - u];
    }
    if (transform.reflectX) u = 1 - u;
    return [u, v];
  });
}

function renderStadiumSourceRect({
  alphaMode,
  indexedPages,
  nativePage,
  padding = 0,
  palette,
  sourceRect,
}) {
  const indexed = indexedPages[nativePage - 8];
  if (!indexed) throw new Error(`Native stadium page ${nativePage} is unavailable.`);
  const width = sourceRect.width + padding * 2;
  const height = sourceRect.height + padding * 2;
  const raster = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = sourceRect.x + x - padding;
      const sourceY = sourceRect.y + y - padding;
      if (
        sourceX < 0
        || sourceX >= PAGE_SIZE
        || sourceY < 0
        || sourceY >= PAGE_SIZE
      ) {
        continue;
      }
      const paletteIndex = indexed[sourceY * PAGE_SIZE + sourceX];
      const target = (y * width + x) * 4;
      if (
        alphaMode === "mask"
        && paletteIndex === STADIUM_TRANSPARENT_PALETTE_INDEX
      ) {
        continue;
      }
      raster[target] = expandVgaComponent(palette[paletteIndex * 3]);
      raster[target + 1] = expandVgaComponent(palette[paletteIndex * 3 + 1]);
      raster[target + 2] = expandVgaComponent(palette[paletteIndex * 3 + 2]);
      raster[target + 3] = 255;
    }
  }
  return raster;
}

function renderStadiumIndexedSourceRect({
  indexedPages,
  nativePage,
  padding = 0,
  sourceRect,
}) {
  const indexed = indexedPages[nativePage - 8];
  if (!indexed) throw new Error(`Native stadium page ${nativePage} is unavailable.`);
  const width = sourceRect.width + padding * 2;
  const height = sourceRect.height + padding * 2;
  const raster = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = sourceRect.x + x - padding;
      const sourceY = sourceRect.y + y - padding;
      if (
        sourceX < 0
        || sourceX >= PAGE_SIZE
        || sourceY < 0
        || sourceY >= PAGE_SIZE
      ) {
        continue;
      }
      raster[y * width + x] = indexed[sourceY * PAGE_SIZE + sourceX];
    }
  }
  return raster;
}

function blitStadiumCutout({ rgba, raster, x, y, width, height }) {
  if (raster.length !== width * height * 4) {
    throw new Error("Prepared stadium shared raster has an invalid RGBA byte count.");
  }
  for (let row = 0; row < height; row += 1) {
    raster.copy(
      rgba,
      ((y + row) * STADIUM_ATLAS_WIDTH + x) * 4,
      row * width * 4,
      (row + 1) * width * 4,
    );
  }
}

function scaleStadiumRgbaRasterNearest({ height, raster, scale, width }) {
  if (
    !Buffer.isBuffer(raster)
    || raster.length !== width * height * 4
    || !Number.isSafeInteger(scale)
    || scale <= 0
  ) {
    throw new Error("Prepared stadium RGBA source cannot be scaled.");
  }
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;
  const scaled = Buffer.alloc(scaledWidth * scaledHeight * 4);
  for (let sourceY = 0; sourceY < height; sourceY += 1) {
    for (let sourceX = 0; sourceX < width; sourceX += 1) {
      const sourceOffset = (sourceY * width + sourceX) * 4;
      for (let offsetY = 0; offsetY < scale; offsetY += 1) {
        for (let offsetX = 0; offsetX < scale; offsetX += 1) {
          const targetX = sourceX * scale + offsetX;
          const targetY = sourceY * scale + offsetY;
          const targetOffset = (targetY * scaledWidth + targetX) * 4;
          raster.copy(scaled, targetOffset, sourceOffset, sourceOffset + 4);
        }
      }
    }
  }
  return {
    height: scaledHeight,
    raster: scaled,
    width: scaledWidth,
  };
}

function prepareHudGlyphAtlas(nativeArchive, matchPalette) {
  if (!Buffer.isBuffer(matchPalette) || matchPalette.length !== 256 * 3) {
    throw new Error("Prepared HUD glyphs require the exact 256-entry match palette.");
  }
  const palette = Buffer.from(matchPalette);
  const sourcePages = new Map([
    [
      HUD_NORMAL_FONT.id,
      nativeArchive.recordBytes(HUD_NORMAL_FONT.sourcePageSelector),
    ],
    [
      HUD_MENU_FONT.id,
      nativeArchive.recordBytes(PINNED_NATIVE_ARCHIVE.glyphPage.selector),
    ],
  ]);
  const rgba = Buffer.alloc(HUD_GLYPH_ATLAS_WIDTH * HUD_GLYPH_ATLAS_HEIGHT * 4);
  for (const [bandIndex, band] of HUD_COLOR_BANDS.entries()) {
    for (const font of HUD_FONTS) {
      const sourcePage = sourcePages.get(font.id);
      const sourceWidth = font.columns * font.cellWidth;
      const sourceHeight = font.rows * font.cellHeight;
      for (let y = 0; y < sourceHeight; y += 1) {
        for (let x = 0; x < sourceWidth; x += 1) {
          const sourceIndex = sourcePage[
            (font.sourcePitchRow + y) * PAGE_SIZE + font.sourceX + x
          ];
          if (sourceIndex === 0) continue;
          const paletteIndex = sourceIndex === 1
            ? band.outputColorIndex
            : sourceIndex - 1;
          for (let scaleY = 0; scaleY < font.presentationScale; scaleY += 1) {
            for (let scaleX = 0; scaleX < font.presentationScale; scaleX += 1) {
              const targetX = x * font.presentationScale + scaleX;
              const targetY = bandIndex * HUD_GLYPH_BAND_HEIGHT
                + font.atlasBandY
                + y * font.presentationScale
                + scaleY;
              const target = (
                targetY * HUD_GLYPH_ATLAS_WIDTH + targetX
              ) * 4;
              rgba[target] = expandVgaComponent(palette[paletteIndex * 3]);
              rgba[target + 1] = expandVgaComponent(palette[paletteIndex * 3 + 1]);
              rgba[target + 2] = expandVgaComponent(palette[paletteIndex * 3 + 2]);
              rgba[target + 3] = 255;
            }
          }
        }
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

function prepareHalftimeMenuSpriteAtlas(nativeArchive, palette) {
  const indexed = Buffer.from(
    nativeArchive.recordBytes(HALFTIME_MENU_SOURCE.basePage.selector),
  );
  for (const team of [HALFTIME_MENU_SOURCE.teamA, HALFTIME_MENU_SOURCE.teamB]) {
    const source = nativeArchive.recordBytes(team.selector);
    const { x, y, width, height } = team.sourceRect;
    for (let row = 0; row < height; row += 1) {
      source.copy(
        indexed,
        (team.target.y + row) * PAGE_SIZE + team.target.x,
        (y + row) * PAGE_SIZE + x,
        (y + row) * PAGE_SIZE + x + width,
      );
    }
  }
  const rgba = Buffer.alloc(PAGE_SIZE * PAGE_SIZE * 4);
  for (let index = 0; index < indexed.length; index += 1) {
    const sourceIndex = indexed[index];
    if (sourceIndex === 0) continue;
    const paletteIndex = sourceIndex === 1 ? 0 : sourceIndex - 1;
    const target = index * 4;
    rgba[target] = expandVgaComponent(palette[paletteIndex * 3]);
    rgba[target + 1] = expandVgaComponent(palette[paletteIndex * 3 + 1]);
    rgba[target + 2] = expandVgaComponent(palette[paletteIndex * 3 + 2]);
    rgba[target + 3] = 255;
  }
  const pngBytes = encodeRgbaPng(PAGE_SIZE, PAGE_SIZE, rgba);
  return {
    rgba,
    pngBytes,
    sha256: sha256(pngBytes),
  };
}

export function bindCssoccerStadiumTexture(preparation, sourceColorCode) {
  if (
    !preparation
    || !Array.isArray(preparation.stadiumTextureRecords)
    || !Array.isArray(preparation.stadiumTriangleCutouts)
    || !Array.isArray(preparation.stadiumTriangleMaterials)
    || !Array.isArray(preparation.stadiumQuadCutouts)
    || !Array.isArray(preparation.stadiumQuadMaterials)
    || !Array.isArray(preparation.stadiumScanlineSourceCutouts)
    || !Array.isArray(preparation.stadiumScanlineSourceMaterials)
  ) {
    throw new TypeError("Stadium texture binding requires the prepared native stadium atlas.");
  }
  if (!Number.isSafeInteger(sourceColorCode) || sourceColorCode >= 0) return null;
  const textureIndex = sourceColorCode < -2000
    ? -sourceColorCode - 2001
    : -sourceColorCode - 1;
  const record = preparation.stadiumTextureRecords[textureIndex];
  const sourcePageIndex = record ? record.page - 8 : -1;
  if (
    !record
    || sourcePageIndex < 0
    || sourcePageIndex >= STADIUM_PAGE_COUNT
  ) {
    return null;
  }
  const transparent = sourceColorCode < -2000;
  const alphaMode = transparent ? "mask" : "opaque";
  const sourceTextureFixed = Object.freeze(Array.from(
    { length: record.vertexCount },
    (_unused, index) => Object.freeze([
      record.preparedWords[record.vertexCount + index] & 0x00ff_ffff,
      record.preparedWords[index] & 0x00ff_ffff,
    ]),
  ));
  if (record.vertexCount === 3) {
    const triangleCutouts = preparation.stadiumTriangleCutouts
      .filter((entry) => entry.textureIndex === textureIndex);
    const triangleMaterials = preparation.stadiumTriangleMaterials[textureIndex];
    const triangleCutout = triangleCutouts[0];
    if (
      triangleCutouts.length !== 1
      || !Array.isArray(triangleMaterials)
      || triangleMaterials.length !== 1
      || !triangleMaterials[0]?.imageSource
      || triangleMaterials[0].presentation?.projection !== "affine"
      || triangleCutout.alphaMode !== alphaMode
      || !Array.isArray(triangleCutout.atlasUvs)
      || triangleCutout.atlasUvs.length !== 4
      || !Array.isArray(triangleCutout.basisVertexIndexes)
      || triangleCutout.basisVertexIndexes.length !== 3
      || [...triangleCutout.basisVertexIndexes].sort().join(",") !== "0,1,2"
    ) {
      return null;
    }
    const vertexOrder = triangleCutout.basisVertexIndexes;
    const {
      scanlineSourceCutout,
      scanlineSourceMaterial,
    } = bindStadiumScanlineSource(preparation, triangleCutout);
    return deepFreeze({
      sourceColorCode,
      textureIndex,
      nativePage: record.page,
      sourcePageIndex,
      vertexCount: record.vertexCount,
      transparent,
      sourceUvs: vertexOrder.map((vertexIndex) => record.uvs[vertexIndex]),
      sourceTextureFixed: vertexOrder.map((vertexIndex) => (
        sourceTextureFixed[vertexIndex]
      )),
      vertexOrder,
      triangleCutouts,
      triangleMaterials,
      cutoutUvs: triangleCutout.atlasUvs,
      scanlineSourceCutout,
      scanlineSourceMaterial,
      textureRecordSha256: record.sha256,
    });
  }

  const quadCutout = preparation.stadiumQuadCutouts
    .find((entry) => entry.textureIndex === textureIndex);
  const material = preparation.stadiumQuadMaterials[textureIndex];
  if (
    !quadCutout
    || quadCutout.alphaMode !== alphaMode
    || !Array.isArray(quadCutout.atlasUvs)
    || quadCutout.atlasUvs.length !== 4
    || !material?.imageSource
    || material.presentation?.projection !== "projective"
  ) {
    return null;
  }
  const vertexOrder = quadCutout.vertexOrder;
  if (
    !Array.isArray(vertexOrder)
    || vertexOrder.length !== 4
    || [...vertexOrder].sort().join(",") !== "0,1,2,3"
  ) {
    return null;
  }
  let {
    scanlineSourceCutout,
    scanlineSourceMaterial,
  } = bindStadiumScanlineSource(preparation, quadCutout);
  if (!scanlineSourceCutout) {
    scanlineSourceCutout = preparation.stadiumQuadCutouts
      .filter((entry) => (
        entry.nativePage === quadCutout.nativePage
        && entry.sourceRasterOrientation === "canonical-axis-aligned-source-rect"
        && sameStadiumSourceRect(entry.sourceRect, quadCutout.sourceRect)
      ))
      .sort((left, right) => left.textureIndex - right.textureIndex)[0] ?? null;
    scanlineSourceMaterial = scanlineSourceCutout
      ? preparation.stadiumQuadMaterials[scanlineSourceCutout.textureIndex]
      : null;
  }
  return deepFreeze({
    sourceColorCode,
    textureIndex,
    nativePage: record.page,
    sourcePageIndex,
    vertexCount: record.vertexCount,
    transparent,
    sourceUvs: vertexOrder.map((vertexIndex) => record.uvs[vertexIndex]),
    sourceTextureFixed: vertexOrder.map((vertexIndex) => (
      sourceTextureFixed[vertexIndex]
    )),
    vertexOrder,
    quadCutout,
    material,
    scanlineSourceCutout,
    scanlineSourceMaterial,
    uvs: quadCutout.atlasUvs,
    textureRecordSha256: record.sha256,
  });
}

function bindStadiumScanlineSource(preparation, cutout) {
  const scanlineSourceIndex = preparation.stadiumScanlineSourceCutouts
    .findIndex((entry) => entry.sourceRects.some((sourceRect) => (
      sourceRect.nativePage === cutout.nativePage
      && sameStadiumSourceRect(sourceRect, cutout.sourceRect)
    )));
  if (scanlineSourceIndex < 0) {
    return {
      scanlineSourceCutout: null,
      scanlineSourceMaterial: null,
    };
  }
  const preparedCutout =
    preparation.stadiumScanlineSourceCutouts[scanlineSourceIndex];
  const nativeRasterMapping = preparedCutout.nativeRasterMappings
    ?.find((entry) => (
      entry.nativePage === cutout.nativePage
      && sameStadiumSourceRect(entry, cutout.sourceRect)
    ));
  if (!nativeRasterMapping) {
    throw new Error(
      `Prepared stadium scanline source lost texture ${cutout.textureIndex}.`,
    );
  }
  return {
    scanlineSourceCutout: {
      ...preparedCutout,
      nativePage: cutout.nativePage,
      nativeRasterOffsetX: nativeRasterMapping.rasterOffsetX,
      nativeRasterOffsetY: nativeRasterMapping.rasterOffsetY,
      sourceRect: { ...cutout.sourceRect },
    },
    scanlineSourceMaterial:
      preparation.stadiumScanlineSourceMaterials[scanlineSourceIndex],
  };
}

function sameStadiumSourceRect(left, right) {
  return (
    left?.x === right?.x
    && left?.y === right?.y
    && left?.width === right?.width
    && left?.height === right?.height
  );
}

/** Bind one exact masked BM_NETS goal surface prepared from native page 15. */
export function bindCssoccerGoalNetTexture(preparation, sourceColorCode) {
  if (
    !preparation
    || !Array.isArray(preparation.goalNetTextureRecords)
    || !Array.isArray(preparation.goalNetQuadCutouts)
    || !Array.isArray(preparation.goalNetQuadMaterials)
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
  const quadCutout = preparation.goalNetQuadCutouts
    .find((entry) => entry.textureIndex === textureIndex);
  const material = preparation.goalNetQuadMaterials[textureIndex];
  if (
    !quadCutout
    || !material?.imageSource
    || material.presentation?.projection !== "projective"
    || quadCutout.alphaMode !== "mask"
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
    quadCutout,
    material,
    uvs: FULL_IMAGE_UVS,
    textureRecordSha256: record.sha256,
  });
}


function preparePalette({
  nativeArchive,
  retailArchive,
  demoArchive,
}) {
  const palette = Buffer.from(
    nativeArchive.recordBytes(NATIVE_PLAYER_SELECTORS.palette),
  );
  copyPalette(
    demoArchive,
    palette,
    SELECTORS.paletteOverrides.spainKit,
    32,
  );
  copyPalette(
    retailArchive,
    palette,
    RETAIL_PLAYER_SELECTORS.argentinaKitPalette,
    56,
  );
  copyPalette(
    demoArchive,
    palette,
    SELECTORS.paletteOverrides.argentinaSkin,
    80,
  );
  copyPalette(
    demoArchive,
    palette,
    SELECTORS.paletteOverrides.argentinaSkin,
    88,
  );
  copyPalette(
    nativeArchive,
    palette,
    NATIVE_PLAYER_SELECTORS.pitchPalette,
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

function preparePlayerTextureTableBytes(nativeArchive) {
  return Buffer.from(
    nativeArchive.recordBytes(NATIVE_PLAYER_SELECTORS.matchTextureTable),
  );
}

function preparePlayerPages(
  nativeArchive,
  retailArchive,
  demoArchive,
  textureRecords,
) {
  const pages = Array.from({ length: PLAYER_PAGE_COUNT }, () => Buffer.alloc(PAGE_SIZE * PAGE_SIZE));
  copyIntoPage(demoArchive, SELECTORS.player.argentinaHead, pages[0], 0);
  copyIntoPage(
    demoArchive,
    SELECTORS.player.argentinaHead,
    pages[0],
    128 * PAGE_SIZE,
  );
  copyIntoPage(demoArchive, SELECTORS.player.spainTorso, pages[1], 0);
  copyIntoPage(retailArchive, RETAIL_PLAYER_SELECTORS.argentinaTorso, pages[2], 0);
  copyIntoPage(demoArchive, SELECTORS.player.spainLimbs, pages[3], 0);
  copyIntoPage(
    demoArchive,
    SELECTORS.player.argentinaLimbs,
    pages[3],
    80 * PAGE_SIZE,
  );
  copyIntoPage(
    nativeArchive,
    NATIVE_PLAYER_SELECTORS.sharedFeet,
    pages[3],
    158 * PAGE_SIZE,
  );
  copyIntoPage(nativeArchive, NATIVE_PLAYER_SELECTORS.keeperTorso, pages[4], 0);
  copyIntoPage(nativeArchive, NATIVE_PLAYER_SELECTORS.keeperLimbs, pages[5], 0);
  copyIntoPage(
    nativeArchive,
    NATIVE_PLAYER_SELECTORS.extraPage,
    pages[PLAYER_HIGHLIGHT_PAGE_INDEX],
    0,
  );
  copyIntoPage(
    retailArchive,
    RETAIL_PLAYER_SELECTORS.spainNumbers,
    pages[6],
    62 * PAGE_SIZE,
  );
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
    authority: "qualified native fixture page composition and exact player texture table",
    page: 3,
    pageSha256: EXACT_PLAYER_PAGE_THREE_SHA256,
    sourceRecords: [
      {
        id: "renderer-slot-0-limbs",
        archive: "official playable-demo ACTREND.DAT",
        symbol: "BM_LIMBS2",
        selector: SELECTORS.player.spainLimbs,
        y: 0,
        bytes: 19_968,
      },
      {
        id: "renderer-slot-1-limbs",
        archive: "official playable-demo ACTREND.DAT",
        symbol: "BM_LIMBS1",
        selector: SELECTORS.player.argentinaLimbs,
        y: 80,
        bytes: 19_968,
      },
      {
        id: "exact-source-feet",
        archive: "retained native EUROREND.DAT",
        symbol: "renderer shared feet",
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
      selector: NATIVE_PLAYER_SELECTORS.assistantLimbs,
    },
    {
      nativePage: 14,
      symbol: "BM_REFKPTOR",
      selector: NATIVE_PLAYER_SELECTORS.keeperTorso,
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
  projection = "affine",
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
      projection,
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
