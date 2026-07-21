import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  CSSOCCER_ANIMATION_TABLE_SCHEMA,
  parseCssoccerAnimationTable,
} from "../src/prepare/cssoccer/animationTable.mjs";
import {
  CSSOCCER_ACTOR_PREPARATION_SCHEMA,
  parseCssoccerActors,
  prepareCssoccerSourcePlayerModels,
} from "../src/prepare/cssoccer/actorParser.mjs";
import {
  CSSOCCER_TEAM_PREPARATION_SCHEMA,
  parseCssoccerFixtureTeams,
} from "../src/prepare/cssoccer/teamParser.mjs";
import {
  CSSOCCER_TEXTURE_ATLAS_SCHEMA,
  parseCssoccerTextureAtlasMetadata,
} from "../src/prepare/cssoccer/textureAtlas.mjs";
import { prepareCssoccerSourceTextureAtlas } from "../src/prepare/cssoccer/sourceTextureAtlas.mjs";

const sourceRoot = new URL("../.local/actua-soccer/source/", import.meta.url);
const rendererArchiveRoot = new URL(
  "../.local/cssoccer/source-assets/actua-demo/extracted/",
  import.meta.url,
);
const retailRendererArchiveRoot = new URL(
  "../.local/cssoccer/source-assets/actua-retail-1996/extracted/",
  import.meta.url,
);
const requiredSourceFiles = [
  "FILES.C",
  "DEFINES.H",
  "FOOT.EXE",
  "DATA.H",
  "3DENG.H",
  "3DENG.C",
  "3DENG.OBJ",
  "3D_UPD2.CPP",
  "ACTIONS.CPP",
  "DATA.OBJ",
  "EUROREND.DAT",
  "EUROREND.OFF",
  "FOOTY.PAL",
  "FAP.EQU",
  "FAP.DAT",
  "FAP.OFF",
  "FAPF.DAT",
  "FAPF.OFF",
];
const missingSourceFiles = requiredSourceFiles.filter(
  (file) => !existsSync(new URL(file, sourceRoot)),
);
const missingRendererFiles = ["ACTREND.DAT", "ACTREND.OFF"].filter(
  (file) => !existsSync(new URL(file, rendererArchiveRoot))
    || !existsSync(new URL(file, retailRendererArchiveRoot)),
);
const sourceTestOptions = {
  skip: missingSourceFiles.length > 0 || missingRendererFiles.length > 0
    ? "ignored pinned source is unavailable: "
      + [...missingSourceFiles, ...missingRendererFiles].join(", ")
    : false,
};

let cachedTeams;
let cachedAnimations;
let cachedActors;
let cachedSourceTextures;
let cachedSourcePlayerModels;

test("fixed fixture teams decode 22 exact FOOT.EXE starter records", sourceTestOptions, () => {
  const teams = prepareTeams();
  assert.equal(teams.schema, CSSOCCER_TEAM_PREPARATION_SCHEMA);
  assert.deepEqual(teams.counts, {
    teams: 2,
    sourceRosterPlayers: 44,
    retainedStarters: 22,
    decodedStarterAttributeRecords: 22,
    supportedKitSymbolBindings: 16,
    unresolvedKitAssetSelectors: 4,
  });
  assert.equal(
    teams.authoritySha256,
    "6161360cb7ab3b23b2685f9646b02e5e1664389792017679112a28dbc8035128",
  );
  assert.deepEqual(teams.teams.map(({ sourceTeamId }) => sourceTeamId), [2, 20]);
  assert.deepEqual(
    teams.teams[0].roster.starters.map(({ name }) => name),
    [
      "A. Zubizaretta",
      "M.A. Nadal",
      "A. Ferrer",
      "F. Abelardo",
      "S.G. Voro",
      "J.A. Goicoechea",
      "J. Guardiola",
      "J. Guerrero",
      "J. Salinas",
      "M. Felipe",
      "F. Hierro",
    ],
  );
  assert.deepEqual(
    teams.teams[1].roster.starters.map(({ name }) => name),
    [
      "S. Goycoechea",
      "S. Vazquez",
      "J.A. Chamot",
      "R. Sensini",
      "O. Ruggeri",
      "F. Redondo",
      "J. Basualdo",
      "D. Simeone",
      "C. Caniggia",
      "G. Batistuta",
      "A. Ortega",
    ],
  );
  assert.deepEqual(
    Object.values(teams.starters[0].attributes),
    [49, 61, 24, 34, 70, 51, 70, 35],
  );
  assert.deepEqual(
    Object.values(teams.starters[11].attributes),
    [30, 24, 47, 20, 53, 63, 73, 72],
  );
  assert.deepEqual(teams.starters[0].sourceRecordByteRange, [1043168, 1043201]);
  assert.deepEqual(teams.starters[11].sourceRecordByteRange, [1058864, 1058897]);
  assert.deepEqual(
    teams.unsupportedClasses.map(({ id }) => id),
    ["formation-position-records", "team-kit-asset-payloads"],
  );
  assert.equal(new Set(teams.starters.map(({ id }) => id)).size, 22);
  assert.ok(Object.isFrozen(teams));
  assert.ok(Object.isFrozen(teams.teams[0].roster.starters[0].attributes));
  assert.equal(teams.authoritySha256, freshTeams().authoritySha256);

  const tamperedFoot = Buffer.from(sourceBytes("FOOT.EXE"));
  tamperedFoot[1_043_168] ^= 1;
  assert.throws(
    () => parseCssoccerFixtureTeams({
      filesBytes: sourceBytes("FILES.C"),
      definesHBytes: sourceBytes("DEFINES.H"),
      footExeBytes: tamperedFoot,
    }),
    /does not match pinned source revision/u,
  );
});

test("actor preparation publishes exact player and official bindings with only current supporting render assets", sourceTestOptions, () => {
  const actors = prepareActors();
  assert.equal(actors.schema, CSSOCCER_ACTOR_PREPARATION_SCHEMA);
  assert.deepEqual(actors.counts, {
    actors: 26, players: 22, officials: 3, balls: 1, stableRoots: 26,
    preparedModels: 5, playerSourceModels: 4, playerSourcePrimitives: 50,
    ballPoints: 60,
    ballSourcePolygons: 32, ballSolidTriangles: 116, renderablePoseSlots: 124,
    renderablePoseFrames: 5857, renderablePosePolygonInstances: 0,
    renderAssets: 1, animatedRenderAssets: 0, animatedTexturedRenderAssets: 0,
    staticRenderAssets: 1, preparedRenderFrames: 0,
    preparedRenderPolygons: 116, texturedPlayerAtlasPlacements: 9,
  });
  assert.deepEqual(actors.renderAssets.map(({ id, kind }) => ({ id, kind })), [
    { id: "actor-ball", kind: "static-solid-model" },
  ]);
  assert.ok(actors.actors.filter(({ kind }) => kind === "player").every(({ model }) => (
    model.renderAssetId === "exact-actua-player-one-basis"
  )));
  assert.doesNotMatch(JSON.stringify(actors.renderAssets), /actor-player-f[12rl]/u);
  assert.equal(actors.renderAssets[0].polygons.length, 116);
  assert.ok(actors.actors.filter(({ kind }) => kind === "official").every((actor) => (
    actor.model.renderAssetId === "exact-actua-official-one-basis"
      && actor.material.payloadStatus === "prepared-exact-official-material"
      && actor.rendering.status === "prepared-source-bound"
      && actor.rendering.replacementAllowed === false
  )));
  assert.deepEqual(actors.unsupportedClasses, []);
  assert.equal(actors.exactPlayerSequences.counts.sequences, 124);
  assert.equal(actors.exactPlayerSequences.counts.poseOccurrences, 5857);
  assert.deepEqual(actors.exactPlayerSequences.preparedFrameLookup, actors.poseFrameSets.preparedFrameLookup);
  assert.deepEqual(actors.exactPlayerSequences.preparedFrameIndexBySlotFrame, actors.poseFrameSets.preparedFrameIndexBySlotFrame);
  assert.ok(actors.actors.every(({ root }) => root.runtimeMayCreateNodesOrAssets === false));
  const forgedTeams = structuredClone(prepareTeams());
  forgedTeams.teams[0].roster.starters[0].attributes.pace += 1;
  forgedTeams.starters[0].attributes.pace += 1;
  assert.throws(() => parseCssoccerActors(actorArguments({ teamPreparation: forgedTeams })), /not the pinned fixed-fixture contract/u);
});

test("compiled animation table decodes all retained poses and exact contact lineage", sourceTestOptions, () => {
  const animations = prepareAnimations();
  assert.equal(animations.schema, CSSOCCER_ANIMATION_TABLE_SCHEMA);
  assert.deepEqual(animations.counts, {
    slots: 132,
    sourceHeaderSlots: 117,
    declarations: 117,
    declaredSourceSlots: 111,
    aliasedSourceSlots: 5,
    compiledDirectPoseSlots: 94,
    mirroredPoseSlots: 30,
    resolvedPoseSlots: 124,
    unsupportedZeroFrameSlots: 8,
    decodedPoseFrames: 4683,
    decodedPoseCoordinateValues: 393372,
    decodedPoseBytes: 1592220,
    actionBindings: 75,
    actionReferencedDeclarations: 83,
    actionReferencedSlots: 81,
    contactDefinitions: 89,
    rationalContactDefinitions: 46,
    literalContactDefinitions: 43,
    actionContactUses: 11,
    unresolvedActionConstants: 60,
    retainedNativeAnimationSlots: 46,
    resolvedRetainedNativeAnimationSlots: 46,
  });
  assert.equal(
    animations.poseArchive.decodedMatchPayloadSha256,
    "cc1109a1ea2f9371f050522e92403144bd4c69b0b8bb09e25821f72f1dfc541e",
  );
  assert.deepEqual(
    animations.slots
      .filter(({ status }) => status === "unsupported-zero-frame-compiled-slot")
      .map(({ id }) => id),
    [44, 45, 77, 82, 91, 105, 129, 131],
  );
  assert.deepEqual(
    animations.slots
      .filter(({ sourceDeclarationStatus }) => sourceDeclarationStatus === "aliased-declarations")
      .map(({ id }) => id),
    [38, 39, 78, 79, 90],
  );
  assert.deepEqual(
    [120, 121, 122].map((id) => {
      const slot = animations.slots[id];
      return [id, slot.posePayload.recordIndex, slot.posePayload.selector, slot.resolvedFrameCount];
    }),
    [
      [120, 219, 1752, 155],
      [121, 220, 1760, 225],
      [122, 221, 1768, 201],
    ],
  );
  assert.equal(
    animations.slots[120].posePayload.frames[0].sha256,
    "c8ad433e8437431352ce69a3a7acda66ae12be533d7e973f9b1f6f9eb6bb9de2",
  );
  assert.deepEqual(
    animations.slots[120].posePayload.frames[0].coordinates.slice(0, 6),
    [
      2.1436944007873535,
      25.35107421875,
      0.44481325149536133,
      1.1587746143341064,
      25.437292098999023,
      0.5948118567466736,
    ],
  );
  assert.deepEqual(animations.slots[21].posePayload, {
    status: "resolved-source-mirror",
    sourceSlotId: 20,
    localCoordinateTransform: { scale: [1, 1, -1], mirroredAxis: "z" },
    faceTopologyVariant: "mirrored",
  });
  assert.equal(
    animations.retainedNativeAnimations.evidence.stateArtifactSha256,
    "eb858bed9ad9d36670e97a98ea49235d8009246ded16e00dcb54c5dc1aef2fdd",
  );
  assert.equal(animations.retainedNativeAnimations.ids.length, 46);
  assert.equal(animations.contacts.filter(({ value }) => value < 0).length, 6);
  assert.equal(animations.contactUses.length, 11);
  assert.equal(animations.frameSwapContract.runtimeMayCreateNodesOrGeometry, false);
  assert.deepEqual(
    animations.unsupportedClasses.map(({ id }) => id),
    [
      "animation-step-and-speed-constants",
      "zero-frame-compiled-motion-capture-slots",
      "compiled-motion-capture-symbol-names",
    ],
  );
  assert.ok(Object.isFrozen(animations.slots[120].posePayload.frames[0].coordinates));

  const repeated = freshAnimations();
  assert.equal(repeated.poseArchive.decodedMatchPayloadSha256, animations.poseArchive.decodedMatchPayloadSha256);
  assert.deepEqual(repeated.counts, animations.counts);
  const tamperedEuro = Buffer.from(sourceBytes("EUROREND.DAT"));
  tamperedEuro[6_310_124] ^= 1;
  assert.throws(
    () => parseCssoccerAnimationTable(animationArguments({ euroRendDatBytes: tamperedEuro })),
    /does not match the pinned archive descriptor/u,
  );
});

test("FAP and FAPF decode 508 indexed frames with lossless source accounting", sourceTestOptions, () => {
  const atlas = parseCssoccerTextureAtlasMetadata(atlasArguments());
  assert.equal(atlas.schema, CSSOCCER_TEXTURE_ATLAS_SCHEMA);
  assert.deepEqual(atlas.counts, {
    archives: 2,
    entries: 31,
    animationEntries: 17,
    paletteEntries: 14,
    unclassifiedEntries: 0,
    decodedFrames: 508,
    decodedIndexedBytes: 5201920,
    archiveDataBytes: 1732180,
    archiveIndexBytes: 248,
    symbolDefinitionBytes: 957,
    sourceInputBytes: 1733385,
    recordPayloadBytes: 1732148,
    paddingBytes: 32,
    accountedBytes: 1733385,
    unaccountedBytes: 0,
    teamMaterialBindings: 2,
    browserAtlasPlacements: 0,
  });
  assert.equal(
    atlas.decodedIndexedSha256,
    "ede2768ecb0f6b00603d2c3f88e54a7267219de29eef951104afe0177c10cc11",
  );
  assert.deepEqual(
    atlas.archives.map(({ id, counts, decodedFramesSha256, payloadBytes, paddingBytes }) => ({
      id,
      counts,
      decodedFramesSha256,
      payloadBytes,
      paddingBytes,
    })),
    [
      {
        id: "fap",
        counts: {
          entries: 27,
          animationEntries: 15,
          paletteEntries: 12,
          decodedFrames: 452,
          decodedIndexedBytes: 4628480,
        },
        decodedFramesSha256: "174f02abdf04e279ce409a114124e6c38e95ff22937f26b724338a19934cc535",
        payloadBytes: 1452899,
        paddingBytes: 29,
      },
      {
        id: "fapf",
        counts: {
          entries: 4,
          animationEntries: 2,
          paletteEntries: 2,
          decodedFrames: 56,
          decodedIndexedBytes: 573440,
        },
        decodedFramesSha256: "11cdbc607713edf4a1d4b28a883fe92d55006f493b30a47573848acfdca37310",
        payloadBytes: 279249,
        paddingBytes: 3,
      },
    ],
  );
  const firstAnimation = atlas.archives[0].entries[0];
  assert.equal(firstAnimation.kind, "animation-payload");
  assert.equal(firstAnimation.decode.status, "decoded-indexed8-frame-sequence");
  assert.equal(firstAnimation.decode.frameCount, 1);
  assert.equal(
    firstAnimation.decode.frames[0].sha256,
    "3a1e9278b0e652f8fd143dba0f84c5df1d332df0a779bf3f3032d8f2793aae1f",
  );
  assert.equal(
    Buffer.from(firstAnimation.decode.frames[0].indexedPixelsBase64, "base64").length,
    10240,
  );
  assert.deepEqual(atlas.archives[0].entries[1].decode.colors[0], [4, 22, 4]);
  assert.equal(atlas.archives[1].entries[0].decode.frameCount, 1);
  assert.equal(atlas.archives[1].entries[2].decode.frameCount, 55);
  assert.equal(atlas.archives[1].entries.at(-1).kind, "palette-payload");
  assert.deepEqual(atlas.archives[1].entries.at(-1).byteRange, [279204, 279252]);
  assert.deepEqual(atlas.browserAtlas.placements, []);
  assert.deepEqual(
    atlas.unsupportedClasses.map(({ id }) => id),
    ["team-kit-asset-payloads", "fapf-symbol-bindings", "browser-atlas-placement"],
  );
  assert.ok(Object.isFrozen(firstAnimation.decode.frames[0]));
  assert.doesNotMatch(JSON.stringify(atlas.lineage), /\.local\//u);
  const repeated = parseCssoccerTextureAtlasMetadata(atlasArguments());
  assert.equal(repeated.decodedIndexedSha256, atlas.decodedIndexedSha256);
  assert.deepEqual(repeated.counts, atlas.counts);
});

function freshTeams() {
  return parseCssoccerFixtureTeams({
    filesBytes: sourceBytes("FILES.C"),
    definesHBytes: sourceBytes("DEFINES.H"),
    footExeBytes: sourceBytes("FOOT.EXE"),
  });
}

function prepareTeams() {
  cachedTeams ??= freshTeams();
  return cachedTeams;
}

function animationArguments(overrides = {}) {
  return {
    dataHBytes: sourceBytes("DATA.H"),
    actionsCppBytes: sourceBytes("ACTIONS.CPP"),
    dataObjectBytes: sourceBytes("DATA.OBJ"),
    threeDEngCBytes: sourceBytes("3DENG.C"),
    euroRendDatBytes: sourceBytes("EUROREND.DAT"),
    euroRendOffBytes: sourceBytes("EUROREND.OFF"),
    ...overrides,
  };
}

function freshAnimations() {
  return parseCssoccerAnimationTable(animationArguments());
}

function prepareAnimations() {
  cachedAnimations ??= freshAnimations();
  return cachedAnimations;
}

function actorArguments(overrides = {}) {
  return {
    teamPreparation: prepareTeams(),
    animationTable: prepareAnimations(),
    dataHBytes: sourceBytes("DATA.H"),
    threeDEngHBytes: sourceBytes("3DENG.H"),
    threeDUpd2Bytes: sourceBytes("3D_UPD2.CPP"),
    threeDEngCBytes: sourceBytes("3DENG.C"),
    dataObjectBytes: sourceBytes("DATA.OBJ"),
    footyPalBytes: sourceBytes("FOOTY.PAL"),
    texturePreparation: prepareSourceTextures(),
    sourcePlayerModelsPreparation: prepareSourcePlayerModels(),
    ...overrides,
  };
}

function prepareSourceTextures() {
  cachedSourceTextures ??= prepareCssoccerSourceTextureAtlas({
    actRendDatBytes: readFileSync(new URL("ACTREND.DAT", rendererArchiveRoot)),
    actRendOffBytes: readFileSync(new URL("ACTREND.OFF", rendererArchiveRoot)),
    retailActRendDatBytes: readFileSync(
      new URL("ACTREND.DAT", retailRendererArchiveRoot),
    ),
    retailActRendOffBytes: readFileSync(
      new URL("ACTREND.OFF", retailRendererArchiveRoot),
    ),
    threeDEngObjectBytes: sourceBytes("3DENG.OBJ"),
    euroRendDatBytes: sourceBytes("EUROREND.DAT"),
    euroRendOffBytes: sourceBytes("EUROREND.OFF"),
    footyPalBytes: sourceBytes("FOOTY.PAL"),
  });
  return cachedSourceTextures;
}

function prepareSourcePlayerModels() {
  cachedSourcePlayerModels ??= prepareCssoccerSourcePlayerModels({
    dataObjectBytes: sourceBytes("DATA.OBJ"),
  });
  return cachedSourcePlayerModels;
}

function prepareActors() {
  cachedActors ??= parseCssoccerActors(actorArguments());
  return cachedActors;
}

function atlasArguments(overrides = {}) {
  return {
    teamPreparation: prepareTeams(),
    fapEquBytes: sourceBytes("FAP.EQU"),
    fapDatBytes: sourceBytes("FAP.DAT"),
    fapOffBytes: sourceBytes("FAP.OFF"),
    fapfDatBytes: sourceBytes("FAPF.DAT"),
    fapfOffBytes: sourceBytes("FAPF.OFF"),
    threeDEngCBytes: sourceBytes("3DENG.C"),
    ...overrides,
  };
}

function sourceBytes(file) {
  return readFileSync(new URL(file, sourceRoot));
}
