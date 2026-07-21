import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const CSSOCCER_SOURCE_FACTS_SCHEMA = "cssoccer-source-facts@1";

export const CSSOCCER_SOURCE_FACT_FILE_NAMES = Object.freeze([
  "FILES.C",
  "DATA.H",
  "3DENG.C",
  "3DENG.H",
  "DISPLAY.CPP",
]);

const EXPECTED_SOURCE_SHA256 = Object.freeze({
  "FILES.C": "80c5c13ee829465c8daef3aa816deadda872c32cafffd37f9fcd565f9820a92b",
  "DATA.H": "7dba31d4e9af11b4c7686faa1bf75802142579db99bd41b23d5bfcd065f0bb99",
  "3DENG.C": "9a9f29dcc2fa984bac746c885810e5b32ccee421448272534bc81469a0c4991b",
  "3DENG.H": "d3190ed25b638927071b028f25aeabf6e6af9f3d6498cd1abd20478ed61a17a3",
  "DISPLAY.CPP": "215bc1200c0af42eecb4c0bc73a3fdfb73e21f2eaab4681f2170d9c808f7fbca",
});

const EXPECTED_STADIUM = Object.freeze({
  pitchfile: "BM_PA",
  pitchpfile: "COL_P2",
  skytypes: Object.freeze([0, 4]),
  tmdfile: "TMD_STAD0",
  sb1file: "BM_CLOCKX1",
  sb2file: "BM_CLOCKX1",
  stands: Object.freeze([
    Object.freeze({ slot: 1, offset: Object.freeze([1571.371, 0, -399.495]), pointsFile: "PTS_STAD04", facesFile: "FCE_STAD04" }),
    Object.freeze({ slot: 2, offset: Object.freeze([609.399, 0, 289.635]), pointsFile: "PTS_STAD01", facesFile: "FCE_STAD01" }),
    Object.freeze({ slot: 3, offset: Object.freeze([-282.629, 0, -406.495]), pointsFile: "PTS_STAD02", facesFile: "FCE_STAD02" }),
    Object.freeze({ slot: 4, offset: Object.freeze([681.399, 0, -1094.365]), pointsFile: "PTS_STAD03", facesFile: "FCE_STAD03" }),
  ]),
  dimensions: Object.freeze({ st_w: 180, st_l: 200, st_h: 180 }),
  textureLoop: Object.freeze({ count: 1, entries: Object.freeze([0]) }),
  videoAnchors: Object.freeze([
    Object.freeze([-292, 202, -1066]),
    Object.freeze([1569, 187, 246]),
  ]),
  tunnelAnchor: Object.freeze([638, 28, -980]),
  vmap: 0,
});

const EXPECTED_MARKINGS = Object.freeze([
  Object.freeze({ symbol: "l1", points: "l1_p1", faces: "l_f1a", position: Object.freeze([210, 0, -200]) }),
  Object.freeze({ symbol: "l2", points: "l2_p1", faces: "l_f1a", position: Object.freeze([1070, 0, -200]) }),
  Object.freeze({ symbol: "l3", points: "l3_p1", faces: "l_f1a", position: Object.freeze([1070, 0, -600]) }),
  Object.freeze({ symbol: "l4", points: "l4_p1", faces: "l_f1a", position: Object.freeze([210, 0, -600]) }),
  Object.freeze({ symbol: "l5", points: "l5_p1", faces: "l_f3a", position: Object.freeze([640, 0, -200]) }),
  Object.freeze({ symbol: "l6", points: "l6_p1", faces: "l_f3a", position: Object.freeze([640, 0, -600]) }),
  Object.freeze({ symbol: "circle", points: "circle_pa", faces: "circle_fa", position: Object.freeze([640, 0, -400]) }),
  Object.freeze({ symbol: "semi1", points: "s_circle_p1a", faces: "s_circle_f1a", position: Object.freeze([123, 0, -400]) }),
  Object.freeze({ symbol: "semi2", points: "s_circle_p2a", faces: "s_circle_f2a", position: Object.freeze([1157, 0, -400]) }),
  Object.freeze({ symbol: "spot1", points: "spot_p", faces: "spot_f", position: Object.freeze([640, 0, -400]) }),
  Object.freeze({ symbol: "spot2", points: "spot_p", faces: "spot_f", position: Object.freeze([128, 0, -400]) }),
  Object.freeze({ symbol: "spot3", points: "spot_p", faces: "spot_f", position: Object.freeze([1152, 0, -400]) }),
]);

const EXPECTED_GOALS = Object.freeze([
  Object.freeze({ symbol: "goal1_1", points: "goal1a_p", faces: "goal_f1a", position: Object.freeze([0, 0, -443.5]), detail: "goal1_a" }),
  Object.freeze({ symbol: "goal2_1", points: "goal1a_p", faces: "goal_f1a", position: Object.freeze([0, 0, -356.5]), detail: "goal2_a" }),
  Object.freeze({ symbol: "goal3_1", points: "goal1a_p", faces: "goal_f1a", position: Object.freeze([0, 37, -400]), detail: "goal3_a" }),
  Object.freeze({ symbol: "goal4_1", points: "goal1a_p", faces: "goal_f1a", position: Object.freeze([-28, 0, -400]), detail: "goal4_a" }),
  Object.freeze({ symbol: "goal1_2", points: "goal1a_p", faces: "goal_f1a", position: Object.freeze([1280, 0, -443.5]), detail: "goal1_b" }),
  Object.freeze({ symbol: "goal2_2", points: "goal1a_p", faces: "goal_f1a", position: Object.freeze([1280, 0, -356.5]), detail: "goal2_b" }),
  Object.freeze({ symbol: "goal3_2", points: "goal1a_p", faces: "goal_f1a", position: Object.freeze([1280, 37, -400]), detail: "goal3_b" }),
  Object.freeze({ symbol: "goal4_2", points: "goal1a_p", faces: "goal_f1a", position: Object.freeze([1308, 0, -400]), detail: "goal4_b" }),
]);

const EXPECTED_FLAGS = Object.freeze([
  Object.freeze({ symbol: "flag_1", points: "flag_p", faces: "flag_f", position: Object.freeze([0, 0, 0]) }),
  Object.freeze({ symbol: "flag_2", points: "flag_p", faces: "flag_f", position: Object.freeze([1280, 0, 0]) }),
  Object.freeze({ symbol: "flag_3", points: "flag_p", faces: "flag_f", position: Object.freeze([0, 0, -800]) }),
  Object.freeze({ symbol: "flag_4", points: "flag_p", faces: "flag_f", position: Object.freeze([1280, 0, -800]) }),
]);

const EXPECTED_STAND_BINDINGS = Object.freeze([
  Object.freeze({ symbol: "stad1", positionFields: Object.freeze(["s1x", "s1y", "s1z"]) }),
  Object.freeze({ symbol: "stad2", positionFields: Object.freeze(["s2x", "s2y", "s2z"]) }),
  Object.freeze({ symbol: "stad3", positionFields: Object.freeze(["s3x", "s3y", "s3z"]) }),
  Object.freeze({ symbol: "stad4", positionFields: Object.freeze(["s4x", "s4y", "s4z"]) }),
]);

export function readCssoccerSourceFacts({ sourceRoot } = {}) {
  if (!(typeof sourceRoot === "string" && sourceRoot.length > 0) && !(sourceRoot instanceof URL)) {
    throw new TypeError("sourceRoot must be a non-empty path string or file URL");
  }
  const sourceTexts = Object.fromEntries(CSSOCCER_SOURCE_FACT_FILE_NAMES.map((file) => [
    file,
    readFileSync(sourceFile(sourceRoot, file), "utf8"),
  ]));
  return extractCssoccerSourceFacts(sourceTexts);
}

/**
 * Extract the immutable B6 source-fact contract from the exact pinned texts.
 * Callers supply text so this module never owns or publishes a local source path.
 */
export function extractCssoccerSourceFacts(sourceTexts) {
  validateSourceTexts(sourceTexts);

  const stadium = parseSpainStadium(sourceTexts["FILES.C"]);
  assertExact(stadium, EXPECTED_STADIUM, "Spain stadium entry 2");
  validateStadiumLayout(sourceTexts["3DENG.H"]);
  validateSourceDeclarations(sourceTexts["DATA.H"]);

  const engineText = sourceTexts["3DENG.C"];
  const initObjects = parseInitObjects(lineText(engineText, 9107, 9150));
  const markingObjects = selectInitObjects(initObjects, EXPECTED_MARKINGS.map(({ symbol }) => symbol));
  const goalObjects = selectInitObjects(initObjects, EXPECTED_GOALS.map(({ symbol }) => symbol));
  const flagObjects = selectInitObjects(initObjects, EXPECTED_FLAGS.map(({ symbol }) => symbol));
  const standBindings = parseStandBindings(initObjects);

  assertExact(markingObjects, EXPECTED_MARKINGS.map(withoutDetail), "pitch marking initializers");
  assertExact(flagObjects, EXPECTED_FLAGS.map(withoutDetail), "corner flag initializers");
  assertExact(standBindings, EXPECTED_STAND_BINDINGS, "stadium stand bindings");

  const renderedMarkings = parseAddedObjects(lineText(engineText, 7286, 7312), "addobjfc");
  assertExact(renderedMarkings, EXPECTED_MARKINGS.map(({ symbol }) => symbol), "rendered pitch markings");

  const renderedGoalText = lineText(engineText, 7662, 7688);
  const renderedGoals = parseAddedObjects(renderedGoalText, "addobjnc");
  const goalDetails = parseDetailBindings(renderedGoalText);
  const goalsWithDetails = goalObjects.map((goal) => ({ ...goal, detail: goalDetails.get(goal.symbol) }));
  assertExact(goalsWithDetails, EXPECTED_GOALS, "rendered goal objects");

  const renderedFlags = parseAddedObjects(lineText(engineText, 7691, 7704), "addobjnc");
  assertExact(renderedFlags, EXPECTED_FLAGS.map(({ symbol }) => symbol), "rendered corner flags");

  const pitch = parsePitchFacts({
    engineText,
    engineHeaderText: sourceTexts["3DENG.H"],
    displayText: sourceTexts["DISPLAY.CPP"],
    stadium,
    flagObjects,
  });
  const officials = parseOfficialFacts(sourceTexts["DATA.H"], engineText);
  const lineage = createLineage(sourceTexts);

  return deepFreeze({
    schema: CSSOCCER_SOURCE_FACTS_SCHEMA,
    sourceFiles: CSSOCCER_SOURCE_FACT_FILE_NAMES.map((file) => ({
      file,
      sha256: EXPECTED_SOURCE_SHA256[file],
    })),
    lineage,
    stadium: {
      entryIndex: 2,
      sourceLabel: "Spain",
      ...stadium,
      standBindings,
      lineage: ["stadium-layout", "spain-stadium-entry", "object-initializers"],
    },
    pitch: {
      ...pitch,
      lineage: [
        "renderer-object-layout",
        "simple-pitch-extents",
        "coordinate-axis-mapping",
        "pitch-native-scale-width",
        "pitch-native-scale-length",
      ],
    },
    markings: {
      objectCount: markingObjects.length,
      objects: markingObjects,
      lineage: ["marking-declarations", "marking-render-set", "object-initializers"],
    },
    goals: {
      goalCount: new Set(goalObjects.map(({ symbol }) => symbol.split("_").at(-1))).size,
      rendererObjectCount: goalObjects.length,
      objects: goalsWithDetails,
      lineage: ["goal-flag-declarations", "goal-flag-render-set", "object-initializers"],
    },
    flags: {
      rendererObjectCount: flagObjects.length,
      objects: flagObjects,
      lineage: ["goal-flag-declarations", "goal-flag-render-set", "object-initializers"],
    },
    officials: {
      rendererObjectCount: officials.length,
      rendererIdentities: officials,
      lineage: ["renderer-people-declarations", "official-initializers"],
    },
  });
}

function validateSourceTexts(sourceTexts) {
  if (
    sourceTexts === null
    || typeof sourceTexts !== "object"
    || Array.isArray(sourceTexts)
    || Object.getPrototypeOf(sourceTexts) !== Object.prototype
  ) {
    throw new TypeError("cssoccer source texts must be a plain object keyed by source filename");
  }

  const suppliedNames = Object.keys(sourceTexts).sort();
  const requiredNames = [...CSSOCCER_SOURCE_FACT_FILE_NAMES].sort();
  if (JSON.stringify(suppliedNames) !== JSON.stringify(requiredNames)) {
    throw new Error(`cssoccer source texts must contain exactly: ${requiredNames.join(", ")}`);
  }

  for (const file of CSSOCCER_SOURCE_FACT_FILE_NAMES) {
    const text = sourceTexts[file];
    if (typeof text !== "string") {
      throw new TypeError(`${file} source text must be a string`);
    }
    const actualSha256 = sha256(text);
    if (actualSha256 !== EXPECTED_SOURCE_SHA256[file]) {
      throw new Error(`Pinned source drift for ${file}: expected ${EXPECTED_SOURCE_SHA256[file]}, received ${actualSha256}`);
    }
  }
}

function parseSpainStadium(text) {
  const stadlistStart = text.indexOf("stad_info stadlist[]");
  if (stadlistStart < 0) throw new Error("Pinned FILES.C is missing stadlist");
  const stadlistText = text.slice(stadlistStart);
  const relativeLabelMatch = /\},\s*\/\/\s*2\s*:\s*Spain\b/u.exec(stadlistText);
  const labelMatch = relativeLabelMatch && {
    ...relativeLabelMatch,
    index: stadlistStart + relativeLabelMatch.index,
  };
  if (!labelMatch) throw new Error("Pinned FILES.C is missing Spain stadium entry 2");

  const closeBrace = labelMatch.index;
  let depth = 0;
  let openBrace = -1;
  for (let index = closeBrace; index >= 0; index -= 1) {
    if (text[index] === "}") depth += 1;
    if (text[index] === "{") {
      depth -= 1;
      if (depth === 0) {
        openBrace = index;
        break;
      }
    }
  }
  if (openBrace < 0) throw new Error("Could not delimit Spain stadium entry 2");

  const values = parseCInitializer(text.slice(openBrace, closeBrace + 1));
  if (!Array.isArray(values) || values.length !== 41) {
    throw new Error(`Spain stadium entry 2 has ${values?.length ?? "invalid"} fields; expected 41`);
  }

  return {
    pitchfile: values[0],
    pitchpfile: values[1],
    skytypes: values[2],
    tmdfile: values[3],
    sb1file: values[4],
    sb2file: values[5],
    stands: [0, 1, 2, 3].map((standIndex) => {
      const offset = 6 + standIndex * 5;
      return {
        slot: standIndex + 1,
        offset: values.slice(offset, offset + 3),
        pointsFile: values[offset + 3],
        facesFile: values[offset + 4],
      };
    }),
    dimensions: { st_w: values[26], st_l: values[27], st_h: values[28] },
    textureLoop: { count: values[29], entries: values[30] },
    videoAnchors: [values.slice(31, 34), values.slice(34, 37)],
    tunnelAnchor: values.slice(37, 40),
    vmap: values[40],
  };
}

function parseCInitializer(text) {
  const tokens = [];
  const tokenPattern = /\s+|\/\*[\s\S]*?\*\/|\/\/[^\n]*|0x[0-9a-f]+|[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:e[+-]?\d+)?|[a-z_]\w*|[{},]/giy;
  let index = 0;
  while (index < text.length) {
    tokenPattern.lastIndex = index;
    const match = tokenPattern.exec(text);
    if (!match || match.index !== index) {
      throw new Error(`Unsupported token in C initializer at byte ${Buffer.byteLength(text.slice(0, index))}`);
    }
    index = tokenPattern.lastIndex;
    if (/^\s+$/u.test(match[0]) || match[0].startsWith("//") || match[0].startsWith("/*")) continue;
    tokens.push(match[0]);
  }

  let cursor = 0;
  const parseValue = () => {
    const token = tokens[cursor];
    if (token === "{") {
      cursor += 1;
      const values = [];
      while (tokens[cursor] !== "}") {
        values.push(parseValue());
        if (tokens[cursor] === ",") cursor += 1;
        else if (tokens[cursor] !== "}") throw new Error("Malformed C initializer list");
      }
      cursor += 1;
      return values;
    }
    if (token === undefined || token === "}" || token === ",") {
      throw new Error("Malformed C initializer value");
    }
    cursor += 1;
    if (/^0x/iu.test(token)) return Number.parseInt(token, 16);
    if (/^[+-]?(?:\d|\.)/u.test(token)) return Number(token);
    return token;
  };

  const result = parseValue();
  if (cursor !== tokens.length) throw new Error("Trailing tokens in C initializer");
  return result;
}

function validateStadiumLayout(text) {
  requirePattern(
    lineText(text, 262, 283),
    /int\s+pitchfile,pitchpfile;[\s\S]*char\s+skytypes\[2\];[\s\S]*datapt\s+s1x,s1y,s1z;[\s\S]*datapt\s+s2x,s2y,s2z;[\s\S]*datapt\s+s3x,s3y,s3z;[\s\S]*datapt\s+s4x,s4y,s4z;[\s\S]*int\s+st_w,st_l,st_h;[\s\S]*short\s+noloop;[\s\S]*int\s+loop\[20\];[\s\S]*int\s+vid1x,vid1y,vid1z;[\s\S]*int\s+vid2x,vid2y,vid2z;[\s\S]*int\s+tunlx,tunly,tunlz;[\s\S]*int\s+vmap;[\s\S]*stad_info;/u,
    "stad_info field layout",
  );
}

function validateSourceDeclarations(text) {
  requirePattern(lineText(text, 259, 286), /#define\s+NPLAYERS\s+25[\s\S]*extern\s+obj\s+player\[NPLAYERS\];[\s\S]*extern\s+facelist\s+player_fr;[\s\S]*extern\s+facelist\s+player_fl;[\s\S]*extern\s+obj\s+pitch;/u, "renderer people declarations");
  requirePattern(lineText(text, 289, 361), /extern\s+obj\s+lines,l1,l2,l3,l4,l5,l6;[\s\S]*extern\s+obj\s+semi1,semi2;[\s\S]*extern\s+obj\s+circle;[\s\S]*extern\s+obj\s+spot1,spot2,spot3;/u, "pitch marking declarations");
  requirePattern(lineText(text, 423, 466), /extern\s+obj\s+goal1_1,goal1_2,goal2_1,goal2_2,goal3_1,goal3_2,goal4_1,goal4_2;[\s\S]*extern\s+obj\s+flag_1,flag_2,flag_3,flag_4;/u, "goal and flag declarations");
}

function parseInitObjects(text) {
  const calls = [];
  const pattern = /initobj\(\s*&([a-z_]\w*)\s*,\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^\)]+)\);/giu;
  for (const match of text.matchAll(pattern)) {
    calls.push({
      symbol: match[1],
      points: match[2].trim(),
      faces: match[3].trim(),
      position: [parseNumber(match[4]), parseNumber(match[5]), parseNumber(match[6])],
      orientation: [parseNumber(match[7]), parseNumber(match[8])],
    });
  }
  return calls;
}

function selectInitObjects(initObjects, symbols) {
  const bySymbol = new Map(initObjects.map((value) => [value.symbol, value]));
  return symbols.map((symbol) => {
    const value = bySymbol.get(symbol);
    if (!value) throw new Error(`Missing renderer initializer for ${symbol}`);
    assertExact(value.orientation, [1, 0], `${symbol} renderer orientation`);
    return withoutOrientation(value);
  });
}

function parseStandBindings(initObjects) {
  return [1, 2, 3, 4].map((slot) => {
    const symbol = `stad${slot}`;
    const value = initObjects.find((entry) => entry.symbol === symbol);
    if (!value) throw new Error(`Missing renderer initializer for ${symbol}`);
    const expectedPrefix = "stadlist[setup.stadium].";
    const positionFields = value.position.map((field) => {
      if (typeof field !== "string" || !field.startsWith(expectedPrefix)) {
        throw new Error(`${symbol} position is not bound to the selected stadlist entry`);
      }
      return field.slice(expectedPrefix.length);
    });
    assertExact(value.orientation, [1, 0], `${symbol} renderer orientation`);
    return { symbol, positionFields };
  });
}

function parseAddedObjects(text, functionName) {
  const values = [];
  const pattern = new RegExp(`${functionName}\\(\\s*&([a-z_]\\w*)\\s*\\)`, "giu");
  for (const match of text.matchAll(pattern)) values.push(match[1]);
  return values;
}

function parseDetailBindings(text) {
  const values = new Map();
  for (const match of text.matchAll(/objdepd\(\s*&([a-z_]\w*)\s*,\s*([a-z_]\w*)\s*\)/giu)) {
    values.set(match[1], match[2]);
  }
  return values;
}

function parsePitchFacts({ engineText, engineHeaderText, displayText, stadium, flagObjects }) {
  const pitchConstruction = lineText(engineText, 8864, 8876);
  const widthMatch = /pitch_p\[1\+\(i\+19\)\*3\+2\]=-([0-9]+)-st_w;/u.exec(pitchConstruction);
  const lengthMatch = /pitch_p\[1\+18\*3\]=([0-9]+)\+st_l;/u.exec(pitchConstruction);
  if (!widthMatch || !lengthMatch) throw new Error("Pinned simple-pitch extent construction changed");

  const nativeWidth = Number(widthMatch[1]);
  const nativeLength = Number(lengthMatch[1]);
  requirePattern(pitchConstruction, new RegExp(`pitch_p\\[1\\]=-st_l;[\\s\\S]*pitch_p\\[1\\+19\\*3\\]=-st_l;[\\s\\S]*pitch_p\\[1\\+37\\*3\\]=${nativeLength}\\+st_l;`, "u"), "simple-pitch length construction");

  const axesMatch = /datapt\s+([a-z]+),([a-z]+),([a-z]+);/u.exec(lineText(engineHeaderText, 130, 138));
  if (!axesMatch) throw new Error("Pinned renderer object axes changed");

  const mappingText = lineText(displayText, 38, 45);
  const mapping = [1, 2, 3].map((slot) => {
    const match = new RegExp(`spr_coord_tab\\[3\\*pitch_sprs\\+${slot}\\]=([^;]+);`, "u").exec(mappingText);
    if (!match) throw new Error(`Pinned coordinate mapping is missing renderer component ${slot}`);
    return match[1].trim();
  });
  assertExact(mapping, ["x", "z", "-y"], "gameplay-to-renderer axis mapping");

  const widthScaleMatch = /pitch_wid-y\)\/\(\s*([0-9.]+)\s*\*\s*([0-9.]+)\s*\)\)+\s*\*x\/\(\s*([0-9.]+)\s*\*\s*([0-9.]+)\s*\)/u.exec(lineText(displayText, 156, 165));
  const lengthScaleMatch = /conv_xypitch\(\s*([0-9.]+)\s*\*\s*([0-9.]+)\s*,\s*208/u.exec(lineText(displayText, 238, 266));
  if (!widthScaleMatch || !lengthScaleMatch) throw new Error("Pinned pitch native scale changed");

  const widthYards = Number(widthScaleMatch[1]);
  const halfLengthYards = Number(widthScaleMatch[3]);
  const lengthYards = Number(lengthScaleMatch[1]);
  const scaleValues = [widthScaleMatch[2], widthScaleMatch[4], lengthScaleMatch[2]].map(Number);
  if (widthYards !== 50 || halfLengthYards !== 40 || lengthYards !== 80 || scaleValues.some((value) => value !== 16)) {
    throw new Error("Pinned pitch yard dimensions or native-units scale changed");
  }
  if (nativeLength !== lengthYards * scaleValues[0] || nativeWidth !== widthYards * scaleValues[0]) {
    throw new Error("Pitch extent construction disagrees with the pinned native-units scale");
  }

  const flagXs = flagObjects.map(({ position }) => position[0]);
  const flagZs = flagObjects.map(({ position }) => position[2]);
  const rendererBounds = {
    x: [Math.min(...flagXs), Math.max(...flagXs)],
    y: [0, null],
    z: [Math.min(...flagZs), Math.max(...flagZs)],
  };
  assertExact(rendererBounds, { x: [0, nativeLength], y: [0, null], z: [-nativeWidth, 0] }, "renderer pitch bounds");

  return {
    nativeUnitsPerYard: scaleValues[0],
    yardDimensions: { length: lengthYards, width: widthYards },
    sourceAxes: ["x", "y", "z"],
    rendererAxes: axesMatch.slice(1),
    mappingFromSource: mapping,
    sourceBounds: { x: [0, nativeLength], y: [0, nativeWidth], z: [null, null] },
    rendererBounds,
    simplePitchOuterBounds: {
      x: [-stadium.dimensions.st_l, nativeLength + stadium.dimensions.st_l],
      z: [-nativeWidth - stadium.dimensions.st_w, stadium.dimensions.st_w],
    },
  };
}

function parseOfficialFacts(dataHeaderText, engineText) {
  const playerCountMatch = /#define\s+NPLAYERS\s+([0-9]+)/u.exec(lineText(dataHeaderText, 259, 286));
  if (!playerCountMatch || Number(playerCountMatch[1]) !== 25) throw new Error("Pinned renderer player count changed");

  const initializerText = lineText(engineText, 9040, 9060);
  requirePattern(initializerText, /for\s*\(i=0;i<11;i\+\+\)[\s\S]*&player\[i\][\s\S]*player_f1/u, "first team renderer range");
  requirePattern(initializerText, /for\s*\(i=11;i<22;i\+\+\)[\s\S]*&player\[i\][\s\S]*player_f2/u, "second team renderer range");

  const officials = [];
  for (const match of initializerText.matchAll(/initobj\(\s*&player\[([0-9]+)\]\s*,\s*player_p\[0\]\s*,\s*(player_f[rl])\s*,/gu)) {
    officials.push({ nativeRendererIndex: Number(match[1]), faceSymbol: match[2] });
  }
  assertExact(officials, [
    { nativeRendererIndex: 22, faceSymbol: "player_fr" },
    { nativeRendererIndex: 23, faceSymbol: "player_fl" },
    { nativeRendererIndex: 24, faceSymbol: "player_fl" },
  ], "official renderer identities");
  if (officials.length !== Number(playerCountMatch[1]) - 22) {
    throw new Error("Official renderer identities do not complete NPLAYERS");
  }
  return officials;
}

function createLineage(sourceTexts) {
  const specs = [
    ["renderer-object-layout", "3DENG.H", 130, 138],
    ["stadium-layout", "3DENG.H", 262, 283],
    ["spain-stadium-entry", "FILES.C", 121, 141],
    ["renderer-people-declarations", "DATA.H", 259, 286],
    ["marking-declarations", "DATA.H", 289, 361],
    ["goal-flag-declarations", "DATA.H", 423, 466],
    ["marking-render-set", "3DENG.C", 7286, 7312],
    ["goal-flag-render-set", "3DENG.C", 7662, 7704],
    ["simple-pitch-extents", "3DENG.C", 8864, 8876],
    ["official-initializers", "3DENG.C", 9040, 9060],
    ["object-initializers", "3DENG.C", 9107, 9150],
    ["coordinate-axis-mapping", "DISPLAY.CPP", 38, 45],
    ["pitch-native-scale-width", "DISPLAY.CPP", 156, 165],
    ["pitch-native-scale-length", "DISPLAY.CPP", 238, 266],
  ];
  return specs.map(([id, file, startLine, endLine]) => ({
    id,
    ...sourceSpan(file, sourceTexts[file], startLine, endLine),
  }));
}

function sourceSpan(file, text, startLine, endLine) {
  const starts = lineStarts(text);
  if (startLine < 1 || endLine < startLine || endLine >= starts.length) {
    throw new RangeError(`Invalid ${file} source span ${startLine}-${endLine}`);
  }
  const start = starts[startLine - 1];
  const end = starts[endLine];
  const spanText = text.slice(start, end);
  return {
    file,
    lines: [startLine, endLine],
    bytes: [Buffer.byteLength(text.slice(0, start)), Buffer.byteLength(text.slice(0, end))],
    sha256: sha256(spanText),
  };
}

function lineText(text, startLine, endLine) {
  const starts = lineStarts(text);
  if (startLine < 1 || endLine < startLine || endLine >= starts.length) {
    throw new RangeError(`Invalid source lines ${startLine}-${endLine}`);
  }
  return text.slice(starts[startLine - 1], starts[endLine]);
}

function lineStarts(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") starts.push(index + 1);
  }
  if (starts.at(-1) !== text.length) starts.push(text.length);
  return starts;
}

function parseNumber(value) {
  const normalized = value.trim();
  if (/^[+-]?(?:\d+\.\d*|\.\d+|\d+)(?:e[+-]?\d+)?$/iu.test(normalized)) return Number(normalized);
  return normalized;
}

function withoutOrientation({ symbol, points, faces, position }) {
  return { symbol, points, faces, position };
}

function withoutDetail({ symbol, points, faces, position }) {
  return { symbol, points, faces, position };
}

function requirePattern(text, pattern, label) {
  if (!pattern.test(text)) throw new Error(`Pinned source is missing ${label}`);
}

function assertExact(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} changed: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sourceFile(sourceRoot, file) {
  if (sourceRoot instanceof URL) {
    const root = sourceRoot.href.endsWith("/") ? sourceRoot : new URL(`${sourceRoot.href}/`);
    return new URL(file, root);
  }
  return join(sourceRoot, file);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
