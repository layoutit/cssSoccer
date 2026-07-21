export const CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT_SCHEMA =
  "cssoccer-player-highlight-contract@1";
export const CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT_SHA256 =
  "bc19d78302534b4c886366620b9efe4bd3bec8426517512db8a2a76dbd9ee15e";

export const CSSOCCER_PLAYER_HIGHLIGHT_TYPES = deepFreeze({
  OFF: 0,
  NORM: 1,
  CROSS: 2,
  BALL: 3,
  SHOOT: 4,
  STAR: 5,
  SPECIAL: 6,
});

export const CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES = deepFreeze({
  NORMAL: "player-highlight-family-normal",
  CROSS: "player-highlight-family-cross",
  BALL_SHOOT: "player-highlight-family-ball-shoot",
  STAR_SPECIAL: "player-highlight-family-star-special",
});

export const CSSOCCER_PLAYER_HIGHLIGHT_FACING_MODES = deepFreeze({
  NONE: "none",
  FIELD: "field-aligned",
  PLAYER: "player-facing",
});

export const CSSOCCER_PLAYER_HIGHLIGHT_BLINK_MODES = deepFreeze({
  HIDDEN: "hidden",
  STEADY: "steady",
  HALF_CYCLE: "source-half-cycle",
});

const SOURCE_FILES = [
  ["ACTIONS.CPP", "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508", "highlight selection and local-user colour order"],
  ["FOOTBALL.CPP", "4054e55bbd5471ad0fa76c192562ee269f4ea0978e38f61d2eb0782439128b10", "source tick order"],
  ["ANDYDEFS.H", "13d13dca2910a7685be7603e25bc9fa936253f5aa72f73eef3f54e851fbbce34", "match_player field order and widths"],
  ["3D_UPD2.CPP", "af2009e0787951cb3d7471cef1fb307598069e80f3fa558d4c5dd72026c36714", "render-state publication"],
  ["3DENG.C", "9a9f29dcc2fa984bac746c885810e5b32ccee421448272534bc81469a0c4991b", "family table, draw order, facing, blink, and shadow exclusion"],
  ["3DENG.H", "d3190ed25b638927071b028f25aeabf6e6af9f3d6498cd1abd20478ed61a17a3", "renderer data structures"],
  ["DATA.H", "7dba31d4e9af11b4c7686faa1bf75802142579db99bd41b23d5bfcd065f0bb99", "highlight point and face-list symbols"],
  ["ACTIONS.OBJ", "b02ab5c3177e8744c9c954c1d66148d6b3d9270fef647637192189ac4da87f31", "compiled highlight type immediates"],
  ["DATA.OBJ", "af643e660c93c51d0abe3ee7ef3ac276918fabfd9766af15e309df18776d873b", "compiled flat-quad and material records"],
].map(([file, sha256, role]) => ({ file, sha256, role }));

const SOURCE_ANCHORS = [
  {
    id: "highlight-type-selection",
    file: "ACTIONS.CPP",
    owner: "select_hlite",
    location: "4685-4707",
  },
  {
    id: "compiled-highlight-type-values",
    file: "ACTIONS.OBJ",
    owner: "W?select_hlite$n(pn$match_player$$s)v",
    location: "segment 1 offsets 39197-39382",
  },
  {
    id: "highlight-local-user-order",
    file: "ACTIONS.CPP",
    owner: "select_all_hlites",
    location: "6093-6137",
  },
  {
    id: "highlight-source-tick-order",
    file: "FOOTBALL.CPP",
    owner: "do_logic",
    location: "2334-2335",
  },
  {
    id: "highlight-player-layout",
    file: "ANDYDEFS.H",
    owner: "match_player",
    location: "tm_anim, tm_hcol, tm_htype, tm_mcspd",
  },
  {
    id: "highlight-render-publication",
    file: "3D_UPD2.CPP",
    owner: "player render publication",
    location: "1910-1911",
  },
  {
    id: "highlight-render-rules",
    file: "3DENG.C",
    owner: "player shadows/highlights/player draw",
    location: "7315-7379",
  },
  {
    id: "highlight-family-table",
    file: "3DENG.C",
    owner: "plhilight initialization",
    location: "9063-9105",
  },
  {
    id: "highlight-flat-quad",
    file: "DATA.OBJ",
    owner: "plhi_p",
    location: "point-list symbol",
  },
  {
    id: "highlight-material-records",
    file: "DATA.OBJ",
    owner: "plhi1_f1 through plhi4_ff",
    location: "face-list symbols declared by DATA.H",
  },
];

const FAMILY_CONTRACTS = [
  {
    id: CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES.NORMAL,
    sourceName: "plhi1",
    sourceTextureColumn: 0,
    typeValues: [CSSOCCER_PLAYER_HIGHLIGHT_TYPES.NORM],
    sourceAnchorId: "highlight-family-table",
  },
  {
    id: CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES.CROSS,
    sourceName: "plhi2",
    sourceTextureColumn: 1,
    typeValues: [CSSOCCER_PLAYER_HIGHLIGHT_TYPES.CROSS],
    sourceAnchorId: "highlight-family-table",
  },
  {
    id: CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES.BALL_SHOOT,
    sourceName: "plhi3",
    sourceTextureColumn: 2,
    typeValues: [
      CSSOCCER_PLAYER_HIGHLIGHT_TYPES.BALL,
      CSSOCCER_PLAYER_HIGHLIGHT_TYPES.SHOOT,
    ],
    sourceAnchorId: "highlight-family-table",
  },
  {
    id: CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES.STAR_SPECIAL,
    sourceName: "plhi4",
    sourceTextureColumn: 3,
    typeValues: [
      CSSOCCER_PLAYER_HIGHLIGHT_TYPES.STAR,
      CSSOCCER_PLAYER_HIGHLIGHT_TYPES.SPECIAL,
    ],
    sourceAnchorId: "highlight-family-table",
  },
];

const TYPE_CONTRACTS = [
  ["HLITE_OFF", "player-highlight-off", "off", null, "none", "hidden", "eligible"],
  ["HLITE_NORM", "player-highlight-normal", "normal", CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES.NORMAL, "field-aligned", "steady", "suppressed"],
  ["HLITE_CROSS", "player-highlight-cross", "cross", CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES.CROSS, "field-aligned", "steady", "suppressed"],
  ["HLITE_BALL", "player-highlight-ball", "ball", CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES.BALL_SHOOT, "player-facing", "steady", "suppressed"],
  ["HLITE_SHOOT", "player-highlight-shoot", "shoot", CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES.BALL_SHOOT, "player-facing", "source-half-cycle", "suppressed"],
  ["HLITE_STAR", "player-highlight-star", "star", CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES.STAR_SPECIAL, "field-aligned", "steady", "suppressed"],
  ["HLITE_SPECIAL", "player-highlight-special", "special", CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES.STAR_SPECIAL, "field-aligned", "source-half-cycle", "suppressed"],
].map(([symbol, id, semantic, familyId, facingMode, blinkMode, ordinaryShadow]) => ({
  symbol,
  nativeValue: CSSOCCER_PLAYER_HIGHLIGHT_TYPES[symbol.slice("HLITE_".length)],
  id,
  semantic,
  familyId,
  facingMode,
  blinkMode,
  ordinaryShadow,
  sourceAnchorIds: [
    "highlight-type-selection",
    "compiled-highlight-type-values",
    "highlight-render-rules",
  ],
}));

const COLOUR_SLOTS = [
  [0, "f1", "player-highlight-colour-bank-0", [-2533, -2534, -2535, -2536]],
  [1, "f2", "player-highlight-colour-bank-1", [-2537, -2538, -2539, -2540]],
  [2, "f3", "player-highlight-colour-bank-2", [-2541, -2542, -2543, -2544]],
  [3, "f4", "player-highlight-colour-bank-3", [-2545, -2546, -2547, -2548]],
  [4, "f5", "player-highlight-colour-bank-3", [-2545, -2546, -2547, -2548]],
  [5, "ff", "player-highlight-colour-bank-3", [-2545, -2546, -2547, -2548]],
].map(([hcol, sourceFaceSuffix, textureBankId, sourceColorCodes]) => ({
  hcol,
  id: `player-highlight-colour-${hcol}`,
  sourceFaceSuffix,
  textureBankId,
  sourceColorCodes,
  sourceAnchorId: "highlight-material-records",
}));

export const CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT = deepFreeze({
  schema: CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT_SCHEMA,
  subsystemId: "player-highlight",
  source: {
    repositoryRevision: "b40bd6d1e50e052030c5f0884fbe3deda7e9fa4b",
    sourceImportRevision: "6375c0a35c20cffe699fd160543229b1b1581e57",
    files: SOURCE_FILES,
    anchors: SOURCE_ANCHORS,
  },
  counts: {
    types: 7,
    markerFamilies: 4,
    colourSlots: 6,
  },
  types: TYPE_CONTRACTS,
  markerFamilies: FAMILY_CONTRACTS,
  colourSlots: COLOUR_SLOTS,
  geometry: {
    id: "player-highlight-flat-quad",
    sourceName: "plhi_p",
    sourcePointCount: 4,
    sourcePointListSha256: "035a0e659bffd09bedf7cf7473645ab1af828d02748b40a3dbc2e27eee9392ec",
    primitive: "flat-quad",
    planeAxes: ["x", "z"],
    planeHeight: 0,
    halfExtent: 10.800000190734863,
    width: 21.600000381469727,
    depth: 21.600000381469727,
    unit: "native-position",
    sourceAnchorId: "highlight-flat-quad",
  },
  phase: {
    id: "player-highlight-source-render-phase",
    modulus: 4,
    visibleStartInclusive: 2,
    visibleEndExclusive: 4,
    sourceIncrement: "log_factor",
    advanceStage: "render",
    sourceAnchorId: "highlight-render-rules",
  },
  sourceOrder: {
    state: ["new_users", "select_all_hlites", "publish_player_render_data"],
    render: ["pitch_markings", "ordinary_shadows", "player_highlights", "players"],
    stateAnchorIds: ["highlight-source-tick-order", "highlight-render-publication"],
    renderAnchorId: "highlight-render-rules",
  },
  shadowPolicy: {
    id: "player-highlight-replaces-ordinary-shadow",
    ordinaryShadowEligibleTypeValues: [CSSOCCER_PLAYER_HIGHLIGHT_TYPES.OFF],
    ordinaryShadowSuppressedTypeValues: [
      CSSOCCER_PLAYER_HIGHLIGHT_TYPES.NORM,
      CSSOCCER_PLAYER_HIGHLIGHT_TYPES.CROSS,
      CSSOCCER_PLAYER_HIGHLIGHT_TYPES.BALL,
      CSSOCCER_PLAYER_HIGHLIGHT_TYPES.SHOOT,
      CSSOCCER_PLAYER_HIGHLIGHT_TYPES.STAR,
      CSSOCCER_PLAYER_HIGHLIGHT_TYPES.SPECIAL,
    ],
    sourceAnchorId: "highlight-render-rules",
  },
  retainedLayout: {
    schema: "CSSORAW2",
    version: 2,
    playerCount: 22,
    teamsOffset: 0x3cf6c,
    playerBytes: 203,
    structSha256: "13d13dca2910a7685be7603e25bc9fa936253f5aa72f73eef3f54e851fbbce34",
    fields: [
      { sourceName: "tm_hcol", relativeOffset: 121, valueType: "u8" },
      { sourceName: "tm_htype", relativeOffset: 122, valueType: "u8" },
    ],
    sourceAnchorId: "highlight-player-layout",
  },
});

export function cssoccerPlayerHighlightType(nativeValue) {
  if (!Number.isInteger(nativeValue)) {
    throw new TypeError("Player highlight type must be an integer.");
  }
  const contract = CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT.types[nativeValue];
  if (!contract || contract.nativeValue !== nativeValue) {
    throw new RangeError("Player highlight type must be in 0..6.");
  }
  return contract;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
