import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CSSOCCER_SOURCE_FACT_FILE_NAMES,
  CSSOCCER_SOURCE_FACTS_SCHEMA,
  extractCssoccerSourceFacts,
  readCssoccerSourceFacts,
} from "../src/prepare/cssoccer/sourceFacts.mjs";

const sourceRoot = new URL("../.local/actua-soccer/source/", import.meta.url);

function pinnedSourceTexts() {
  return Object.fromEntries(CSSOCCER_SOURCE_FACT_FILE_NAMES.map((file) => [
    file,
    readFileSync(new URL(file, sourceRoot), "utf8"),
  ]));
}

test("extracts the exact retained Spain stadium and pitch facts", () => {
  const facts = readCssoccerSourceFacts({ sourceRoot });

  assert.equal(facts.schema, CSSOCCER_SOURCE_FACTS_SCHEMA);
  assert.equal(facts.stadium.entryIndex, 2);
  assert.equal(facts.stadium.sourceLabel, "Spain");
  assert.deepEqual(
    facts.stadium.stands.map(({ slot, offset, pointsFile, facesFile }) => ({ slot, offset, pointsFile, facesFile })),
    [
      { slot: 1, offset: [1571.371, 0, -399.495], pointsFile: "PTS_STAD04", facesFile: "FCE_STAD04" },
      { slot: 2, offset: [609.399, 0, 289.635], pointsFile: "PTS_STAD01", facesFile: "FCE_STAD01" },
      { slot: 3, offset: [-282.629, 0, -406.495], pointsFile: "PTS_STAD02", facesFile: "FCE_STAD02" },
      { slot: 4, offset: [681.399, 0, -1094.365], pointsFile: "PTS_STAD03", facesFile: "FCE_STAD03" },
    ],
  );
  assert.deepEqual(facts.stadium.dimensions, { st_w: 180, st_l: 200, st_h: 180 });
  assert.deepEqual(facts.stadium.standBindings, [
    { symbol: "stad1", positionFields: ["s1x", "s1y", "s1z"] },
    { symbol: "stad2", positionFields: ["s2x", "s2y", "s2z"] },
    { symbol: "stad3", positionFields: ["s3x", "s3y", "s3z"] },
    { symbol: "stad4", positionFields: ["s4x", "s4y", "s4z"] },
  ]);

  assert.equal(facts.pitch.nativeUnitsPerYard, 16);
  assert.deepEqual(facts.pitch.yardDimensions, { length: 80, width: 50 });
  assert.deepEqual(facts.pitch.mappingFromSource, ["x", "z", "-y"]);
  assert.deepEqual(facts.pitch.sourceBounds, {
    x: [0, 1280],
    y: [0, 800],
    z: [null, null],
  });
  assert.deepEqual(facts.pitch.rendererBounds, {
    x: [0, 1280],
    y: [0, null],
    z: [-800, 0],
  });
  assert.deepEqual(facts.pitch.simplePitchOuterBounds, {
    x: [-200, 1480],
    z: [-980, 180],
  });
});

test("pins renderer counts, placements, and official identities", () => {
  const facts = extractCssoccerSourceFacts(pinnedSourceTexts());

  assert.equal(facts.markings.objectCount, 12);
  assert.deepEqual(
    facts.markings.objects.map(({ symbol }) => symbol),
    ["l1", "l2", "l3", "l4", "l5", "l6", "circle", "semi1", "semi2", "spot1", "spot2", "spot3"],
  );
  assert.equal(facts.goals.goalCount, 2);
  assert.equal(facts.goals.rendererObjectCount, 8);
  assert.deepEqual(
    facts.goals.objects.map(({ symbol, detail }) => [symbol, detail]),
    [
      ["goal1_1", "goal1_a"],
      ["goal2_1", "goal2_a"],
      ["goal3_1", "goal3_a"],
      ["goal4_1", "goal4_a"],
      ["goal1_2", "goal1_b"],
      ["goal2_2", "goal2_b"],
      ["goal3_2", "goal3_b"],
      ["goal4_2", "goal4_b"],
    ],
  );
  assert.equal(facts.flags.rendererObjectCount, 4);
  assert.deepEqual(
    facts.flags.objects.map(({ symbol, position }) => [symbol, position]),
    [
      ["flag_1", [0, 0, 0]],
      ["flag_2", [1280, 0, 0]],
      ["flag_3", [0, 0, -800]],
      ["flag_4", [1280, 0, -800]],
    ],
  );
  assert.deepEqual(facts.officials.rendererIdentities, [
    { nativeRendererIndex: 22, faceSymbol: "player_fr" },
    { nativeRendererIndex: 23, faceSymbol: "player_fl" },
    { nativeRendererIndex: 24, faceSymbol: "player_fl" },
  ]);
});

test("retains basename-only source spans and freezes the complete contract", () => {
  const facts = extractCssoccerSourceFacts(pinnedSourceTexts());
  const stadiumSpan = facts.lineage.find(({ id }) => id === "spain-stadium-entry");
  const scaleSpan = facts.lineage.find(({ id }) => id === "pitch-native-scale-length");

  assert.deepEqual(stadiumSpan, {
    id: "spain-stadium-entry",
    file: "FILES.C",
    lines: [121, 141],
    bytes: [6668, 7075],
    sha256: "d282d71e519a20094ee58fec0d56ecb0208004347580c50e281db761673de677",
  });
  assert.deepEqual(scaleSpan, {
    id: "pitch-native-scale-length",
    file: "DISPLAY.CPP",
    lines: [238, 266],
    bytes: [5699, 6410],
    sha256: "0cbc7cf6799a68ccb1fad80652d3c78e8540c1095db2d1bebee20483f0fa7039",
  });
  assert.ok(Object.isFrozen(facts));
  assert.ok(Object.isFrozen(facts.stadium.stands[0].offset));
  assert.ok(Object.isFrozen(facts.lineage[0].bytes));
  assert.throws(() => {
    facts.pitch.nativeUnitsPerYard = 1;
  }, TypeError);

  const serialized = JSON.stringify(facts);
  assert.doesNotMatch(serialized, /\/Users\//u);
  assert.doesNotMatch(serialized, /\.local\//u);
  assert.doesNotMatch(serialized, /"(?:mesh|triangles|polygons|runtime)"/u);
});

test("fails closed on source drift and widened source inputs", () => {
  const drifted = pinnedSourceTexts();
  drifted["FILES.C"] = drifted["FILES.C"].replace("180,200,180,", "181,200,180,");
  assert.throws(() => extractCssoccerSourceFacts(drifted), /Pinned source drift for FILES\.C/u);

  const missing = pinnedSourceTexts();
  delete missing["DISPLAY.CPP"];
  assert.throws(() => extractCssoccerSourceFacts(missing), /must contain exactly/u);

  const widened = { ...pinnedSourceTexts(), "OTHER.C": "" };
  assert.throws(() => extractCssoccerSourceFacts(widened), /must contain exactly/u);
});
