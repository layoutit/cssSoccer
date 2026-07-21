import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";

import {
  CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT,
  CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT_SHA256,
} from "../../cssoccer/playerHighlightContract.mjs";
import {
  decodeActuaFaceList,
  decodeActuaPointList,
  decodeWatcomOmf32Object,
} from "./formatAdapters.mjs";

import {
  CSSOCCER_PREPARED_FIXTURE_ID,
  CSSOCCER_PREPARED_MANIFEST_SCHEMA,
  CSSOCCER_PREPARED_SCENE_SCHEMA,
  CSSOCCER_PREPARED_SCENE_URL,
} from "./manifestContract.mjs";
import { CSSOCCER_ASSEMBLED_FIXTURE_SCHEMA, canonicalJsonBytes, sha256Hex } from "./provenance.mjs";
import { packageCssoccerRenderFrameStyles } from "./renderBundlePackaging.mjs";
import { buildCssoccerPitchPreparedScene } from "./sceneBuilder.mjs";
import { createCssoccerSlicePlan } from "./slicePlan.mjs";
import { readCssoccerSourceFacts } from "./sourceFacts.mjs";
import {
  bindCssoccerCornerFlagTexture,
  bindCssoccerGoalNetTexture,
  bindCssoccerPreparedTextureRecord,
  bindCssoccerStadiumTexture,
} from "./sourceTextureAtlas.mjs";
import { prepareCssoccerExactActuaPlayerGeometry } from
  "./exactActuaPlayerGeometry.mjs";
import { prepareCssoccerExactActuaPlayerMaterials } from
  "./exactActuaPlayerMaterials.mjs";
import { prepareExactActuaPlayerModel } from
  "./exactActuaPlayerModel.mjs";
import { prepareCssoccerExactActuaPlayerPackaging } from
  "./exactActuaPlayerPackaging.mjs";
import { prepareCssoccerExactActuaOfficialSource } from
  "./exactActuaOfficialSource.mjs";
import { prepareCssoccerExactActuaOfficialMaterials } from
  "./exactActuaOfficialMaterials.mjs";
import { prepareCssoccerExactActuaOfficialPackaging } from
  "./exactActuaOfficialPackaging.mjs";
import {
  assertCssoccerPreparedTactics,
  parseCssoccerTactics,
} from "./tacticsParser.mjs";

const REPO_ROOT = new URL("../../../", import.meta.url);
const SOURCE_ROOT = new URL(".local/actua-soccer/source/", REPO_ROOT);
const SOURCE_TEXTURE_ROOT = new URL(
  ".local/cssoccer/source-assets/actua-demo/extracted/",
  REPO_ROOT,
);
const RETAIL_SOURCE_TEXTURE_ROOT = new URL(
  ".local/cssoccer/source-assets/actua-retail-1996/extracted/",
  REPO_ROOT,
);
const SOURCE_DATA_URL = new URL("references/spain-argentina-source-data.json", REPO_ROOT);
const FIXTURE_CONTRACT_URL = new URL("references/spain-argentina-match.json", REPO_ROOT);
const ORACLE_CONTRACT_URL = new URL("references/actua-soccer-oracle.json", REPO_ROOT);
const FIXTURE_PROOF_URL = new URL(".local/cssoccer/oracle/fixture/current.json", REPO_ROOT);
const NATIVE_PROOF_URL = new URL(".local/cssoccer/oracle/native/current.json", REPO_ROOT);

const SCENE_PATH = "scenes/spain-argentina-full-match.json";
const FACTS_PATH = "facts/spain-argentina-full-match.json";
const BUNDLES_PATH = "assets/spain-argentina-render-bundles.json";
const EXACT_PLAYER_INDEX_PATH = "assets/animation/exact-player/index.json";
const EXACT_PLAYER_MATERIALS_PATH = "assets/spain-argentina-exact-player-materials.json";
const EXACT_PLAYER_RENDER_BINDING_ID = "exact-actua-player-one-basis";
const EXACT_OFFICIAL_INDEX_PATH = "assets/animation/exact-official/index.json";
const EXACT_OFFICIAL_MATERIALS_PATH = "assets/spain-argentina-exact-official-materials.json";
const EXACT_OFFICIAL_RENDER_BINDING_ID = "exact-actua-official-one-basis";
const HIGHLIGHT_ROOT_ID = "player-highlight-local-user-1";
const HIGHLIGHT_FRAME_SET_ID = "player-highlight-marker";

const SHA256 = /^[0-9a-f]{64}$/u;
const REQUEST_KEYS = Object.freeze(["fixtureId", "scenePath", "sceneUrl", "schema"]);
const MARKING_UVS = Object.freeze([[0, 1], [1, 1], [1, 0], [0, 0]]);
const MARKING_Y = 0.35;
const MARKING_WIDTH = 2;

const EXTRA_SOURCE_INPUTS = Object.freeze([
  Object.freeze({
    file: "DATA.OBJ",
    bytes: 28_660,
    sha256: "af643e660c93c51d0abe3ee7ef3ac276918fabfd9766af15e309df18776d873b",
  }),
  Object.freeze({
    file: "3DENG.OBJ",
    bytes: 197_182,
    sha256: "49de827ef363e9367855bcf5ddfe7b6f20eca55d0907a4fc07da233010cbe733",
  }),
  Object.freeze({
    file: "FGFX.C",
    bytes: 3_519,
    sha256: "aa059d7e461db12b12f1127bdba00052150fe3da0211948fd0938c40423fabfa",
  }),
  Object.freeze({
    file: "3D_UPD2.CPP",
    bytes: 46_438,
    sha256: "af2009e0787951cb3d7471cef1fb307598069e80f3fa558d4c5dd72026c36714",
  }),
  Object.freeze({
    file: "ACTIONS.CPP",
    bytes: 133_129,
    sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
  }),
  Object.freeze({
    file: "FOOT.EXE",
    bytes: 1_733_395,
    sha256: "64dfed661f808f33aa4228e60295a2c3342002011d8726362107b13d7c6a787f",
  }),
  Object.freeze({
    file: "FOOTY.PAL",
    bytes: 768,
    sha256: "73918cecf278e00172e0607053cd8c62e9c4172f70b7cb8e8884d2261a9ae436",
  }),
  Object.freeze({
    file: "TAC_433.TAC",
    bytes: 5_600,
    sha256: "79b999a42b9b32062445f10aeb35be3110f6e6c5c4e0a68454df271b538903d9",
  }),
]);

/**
 * Assemble the one real css.soccer prepared fixture. All filesystem paths are
 * prepare-only inputs; the returned object contains logical ids and hashes only.
 */
export async function assembleCssoccerPreparedFixture(request) {
  validateAssemblyRequest(request);
  const contracts = await readCheckedContracts();
  const staticDomain = await prepareStaticDomain();
  const actorDomain = await prepareActorDomain(contracts);
  const renderDomain = await prepareRenderDomain({ staticDomain, actorDomain });
  const nativeVerification = await verifyNativeArtifacts(contracts);
  const sourceArtifacts = await collectSourceArtifacts({
    contracts,
    actorInputNames: actorDomain.inputFiles,
    additionalSourceArtifacts: actorDomain.additionalSourceArtifacts,
    nativeArtifacts: nativeVerification.artifacts,
  });

  const textureFile = preparedBinaryFile({
    ...actorDomain.texturePreparation.assetFile,
    sourceIds: [
      "source:ACTREND.DAT",
      "source:ACTREND.OFF",
      "source:RETAIL_ACTREND.DAT",
      "source:RETAIL_ACTREND.OFF",
      "source:EUROREND.DAT",
      "source:EUROREND.OFF",
      "source:3DENG.C",
      "source:FILES.C",
    ],
    lineage: {
      kind: "source-decoded-match-texture-atlas",
      sourceRevision: contracts.plan.source.revision,
      selectorAuthorityRevision:
        actorDomain.texturePreparation.metadata.source.selectorAuthority.revision,
      preparedCornerFlag: "native slot 579 no-wind edge-basis cutout",
      runtimeConstruction: false,
    },
  });
  const pitchTextureFile = preparedBinaryFile({
    ...actorDomain.texturePreparation.pitchSurfaceAssetFile,
    sourceIds: ["source:ACTREND.DAT", "source:ACTREND.OFF", "source:3DENG.C"],
    lineage: {
      kind: "source-sampled-prebaked-pitch-surface",
      sourceRevision: contracts.plan.source.revision,
      nativeProducer: "3DENG.C ground",
      nativePitchDetail: 1,
      nativePanMask: "0x1f1f",
      runtimeConstruction: false,
    },
  });
  const markingPixelFile = preparedBinaryFile({
    ...actorDomain.texturePreparation.markingPixelAssetFile,
    sourceIds: ["source:DATA.OBJ", "source:3DENG.C"],
    lineage: {
      kind: "prepare-generated-white-marking-pixel",
      sourceRevision: contracts.plan.source.revision,
      nativeProducer: "3DENG.C pitch markings",
      runtimeConstruction: false,
    },
  });
  const hudGlyphTextureFile = preparedBinaryFile({
    ...actorDomain.texturePreparation.hudGlyphAssetFile,
    sourceIds: [
      "source:EUROREND.DAT",
      "source:EUROREND.OFF",
      "source:3DENG.C",
      "source:FGFX.C",
    ],
    lineage: {
      kind: "source-decoded-native-hud-glyph-atlas",
      sourceRevision: contracts.plan.source.revision,
      nativeProducer: "3DENG.C draw_string",
      nativeFontTable: "FGFX.C font_data[1]",
      runtimeConstruction: false,
    },
  });
  const stadiumTextureFile = preparedBinaryFile({
    ...actorDomain.texturePreparation.stadiumAssetFile,
    sourceIds: [
      "source:EUROREND.DAT",
      "source:EUROREND.OFF",
      "source:3DENG.OBJ",
      "source:3DENG.C",
      "source:FILES.C",
    ],
    lineage: {
      kind: "source-decoded-native-stadium-texture-atlas",
      sourceRevision: contracts.plan.source.revision,
      nativeProducer: "3DENG.C stadium object rendering",
      runtimeConstruction: false,
    },
  });
  const skyBackdropFile = preparedBinaryFile({
    ...actorDomain.texturePreparation.skyBackdropAssetFile,
    sourceIds: [
      "source:EUROREND.DAT",
      "source:EUROREND.OFF",
      "source:FOOTY.PAL",
      "source:3DENG.C",
      "source:FILES.C",
    ],
    lineage: {
      kind: "source-decoded-native-sky-backdrop",
      sourceRevision: contracts.plan.source.revision,
      nativeProducer: "3DENG.C ground",
      nativeSkyType: 1,
      nativeBitmap: "BM_C1X",
      nativePalette: "COL_C1X",
      runtimeConstruction: false,
    },
  });
  const exactPlayerMaterialTextureFile = preparedBinaryFile({
    ...actorDomain.exactPlayerPreparation.materials.assetFile,
    sourceIds: [
      "source:DATA.OBJ",
      "source:EUROREND.DAT",
      "source:EUROREND.OFF",
      "source:ACTREND.DAT",
      "source:ACTREND.OFF",
      "source:RETAIL_ACTREND.DAT",
      "source:RETAIL_ACTREND.OFF",
    ],
    lineage: {
      kind: "one-basis-exact-actua-player-normalized-material-atlas",
      sourceRevision: contracts.plan.source.revision,
      geometryId: actorDomain.exactPlayerPreparation.geometry.geometry.geometryId,
      prepareTimeCrop: true,
      prepareTimeOrientationNormalization: true,
      runtimeConstruction: false,
    },
  });
  const exactOfficialMaterialTextureFile = preparedBinaryFile({
    ...actorDomain.exactOfficialPreparation.materials.assetFile,
    sourceIds: [
      "source:DATA.OBJ",
      "source:EUROREND.DAT",
      "source:EUROREND.OFF",
      "source:ACTREND.DAT",
      "source:ACTREND.OFF",
      "source:RETAIL_ACTREND.DAT",
      "source:RETAIL_ACTREND.OFF",
    ],
    lineage: {
      kind: "one-basis-exact-actua-official-normalized-material-atlas",
      sourceRevision: contracts.plan.source.revision,
      geometryId: actorDomain.exactOfficialPreparation.source.geometry.geometryId,
      prepareTimeCrop: true,
      prepareTimeOrientationNormalization: true,
      runtimeConstruction: false,
    },
  });
  const textureReferences = [
    referenceFor(textureFile),
    referenceFor(pitchTextureFile),
    referenceFor(markingPixelFile),
    referenceFor(hudGlyphTextureFile),
    referenceFor(stadiumTextureFile),
    referenceFor(skyBackdropFile),
    referenceFor(exactPlayerMaterialTextureFile),
    referenceFor(exactOfficialMaterialTextureFile),
  ];
  const exactPlayerChunkFiles = actorDomain.exactPlayerPreparation.chunks.map((chunk) => (
    preparedBinaryFile({
      path: chunk.metadata.path,
      mediaType: "application/json",
      bytes: chunk.bytes,
      expectedSha256: chunk.metadata.sha256,
      sourceIds: ["source:DATA.OBJ", "source:EUROREND.DAT", "source:EUROREND.OFF"],
      lineage: {
        kind: "one-basis-exact-actua-player-preformatted-view-chunk",
        sourceRevision: contracts.plan.source.revision,
        geometryId: actorDomain.exactPlayerPreparation.geometry.geometry.geometryId,
        slotId: chunk.metadata.slotId,
        frameStart: chunk.metadata.frameStart,
        frameEnd: chunk.metadata.frameEnd,
        yawCount: 24,
        stableLeavesPerPlayer: 13,
        runtimeConstruction: false,
      },
    })
  ));
  const exactPlayerIndexFile = preparedJsonFile({
    path: EXACT_PLAYER_INDEX_PATH,
    json: actorDomain.exactPlayerPreparation.packaging.index,
    sourceIds: ["source:DATA.OBJ", "source:EUROREND.DAT", "source:EUROREND.OFF"],
    lineage: {
      kind: "one-basis-exact-actua-player-direct-animation-index",
      sourceRevision: contracts.plan.source.revision,
      geometryId: actorDomain.exactPlayerPreparation.geometry.geometry.geometryId,
      stableLeavesPerPlayer: 13,
      runtimeConstruction: false,
    },
    references: exactPlayerChunkFiles.map(referenceFor),
  });
  const exactPlayerMaterialsFile = preparedJsonFile({
    path: EXACT_PLAYER_MATERIALS_PATH,
    json: actorDomain.exactPlayerPreparation.materials.publication,
    sourceIds: [
      "source:DATA.OBJ",
      "source:EUROREND.DAT",
      "source:EUROREND.OFF",
      "source:ACTREND.DAT",
      "source:ACTREND.OFF",
      "source:RETAIL_ACTREND.DAT",
      "source:RETAIL_ACTREND.OFF",
    ],
    lineage: {
      kind: "one-basis-exact-actua-player-team-and-number-materials",
      sourceRevision: contracts.plan.source.revision,
      geometryId: actorDomain.exactPlayerPreparation.geometry.geometry.geometryId,
      stableLeavesPerPlayer: 13,
      runtimeConstruction: false,
    },
    references: [referenceFor(exactPlayerMaterialTextureFile)],
  });
  const exactOfficialChunkFiles = actorDomain.exactOfficialPreparation.chunks.map((chunk) => (
    preparedBinaryFile({
      path: chunk.metadata.path,
      mediaType: "application/json",
      bytes: chunk.bytes,
      expectedSha256: chunk.metadata.sha256,
      sourceIds: [
        "source:DATA.OBJ",
        "source:EUROREND.DAT",
        "source:EUROREND.OFF",
        "source:ACTREND.DAT",
        "source:ACTREND.OFF",
        "source:RETAIL_ACTREND.DAT",
        "source:RETAIL_ACTREND.OFF",
      ],
      lineage: {
        kind: "one-basis-exact-actua-official-preformatted-view-chunk",
        sourceRevision: contracts.plan.source.revision,
        geometryId: actorDomain.exactOfficialPreparation.source.geometry.geometryId,
        slotId: chunk.metadata.slotId,
        frameStart: chunk.metadata.frameStart,
        frameEnd: chunk.metadata.frameEnd,
        yawCount: 24,
        stableLeavesPerOfficial: 12,
        runtimeConstruction: false,
      },
    })
  ));
  const exactOfficialIndexFile = preparedJsonFile({
    path: EXACT_OFFICIAL_INDEX_PATH,
    json: actorDomain.exactOfficialPreparation.packaging.index,
    sourceIds: ["source:DATA.OBJ", "source:EUROREND.DAT", "source:EUROREND.OFF"],
    lineage: {
      kind: "one-basis-exact-actua-official-direct-animation-index",
      sourceRevision: contracts.plan.source.revision,
      geometryId: actorDomain.exactOfficialPreparation.source.geometry.geometryId,
      stableLeavesPerOfficial: 12,
      runtimeConstruction: false,
    },
    references: exactOfficialChunkFiles.map(referenceFor),
  });
  const exactOfficialMaterialsFile = preparedJsonFile({
    path: EXACT_OFFICIAL_MATERIALS_PATH,
    json: actorDomain.exactOfficialPreparation.materials.publication,
    sourceIds: [
      "source:DATA.OBJ",
      "source:EUROREND.DAT",
      "source:EUROREND.OFF",
      "source:ACTREND.DAT",
      "source:ACTREND.OFF",
      "source:RETAIL_ACTREND.DAT",
      "source:RETAIL_ACTREND.OFF",
    ],
    lineage: {
      kind: "one-basis-exact-actua-referee-and-assistant-materials",
      sourceRevision: contracts.plan.source.revision,
      geometryId: actorDomain.exactOfficialPreparation.source.geometry.geometryId,
      stableLeavesPerOfficial: 12,
      runtimeConstruction: false,
    },
    references: [referenceFor(exactOfficialMaterialTextureFile)],
  });
  const packagedRender = packageCssoccerRenderFrameStyles(renderDomain.publication);
  const frameStyleFiles = packagedRender.styleFiles.map((styleFile) => preparedJsonFile({
    path: styleFile.path,
    json: styleFile.json,
    sourceIds: renderDomain.sourceIds,
    lineage: {
      kind: "cssquake-v3-packed-animation-frame-styles",
      sourceRevision: contracts.plan.source.revision,
      frameSetId: styleFile.frameSetId,
      topologyStable: true,
    },
    references: textureReferences,
  }));

  const facts = createPreparedFacts({
    contracts,
    staticDomain,
    actorDomain,
    renderDomain,
  });
  const factsFile = preparedJsonFile({
    path: FACTS_PATH,
    json: facts,
    sourceIds: sourceArtifacts.map(({ id }) => id),
    lineage: {
      kind: "source-backed-prepared-fixture-facts",
      sourceRevision: contracts.plan.source.revision,
      nativeScenarioSha256: contracts.bindings.nativeScenarioSha256,
    },
    references: textureReferences,
  });
  const bundleFile = preparedJsonFile({
    path: BUNDLES_PATH,
    json: packagedRender.publication,
    sourceIds: renderDomain.sourceIds,
    lineage: {
      kind: "prepare-time-polycss-render-bundles",
      sourceRevision: contracts.plan.source.revision,
      topologyStable: true,
    },
    references: [...textureReferences, ...frameStyleFiles.map(referenceFor)],
  });
  const scene = createPreparedScene({
    contracts,
    staticDomain,
    actorDomain,
    renderDomain,
    nativeInitialState: nativeVerification.initialState,
    factsFile,
    bundleFile,
    exactPlayerIndexFile,
    exactPlayerMaterialsFile,
    exactOfficialIndexFile,
    exactOfficialMaterialsFile,
    skyBackdropFile,
  });
  const sceneFile = preparedJsonFile({
    path: request.scenePath,
    json: scene,
    sourceIds: [
      "contract:source-data",
      "contract:fixture",
      "native:canonical-raw",
      "native:canonical-state",
      "source:3D_UPD2.CPP",
      "source:ACTIONS.CPP",
      "source:DATA.H",
    ],
    references: [
      referenceFor(factsFile),
      referenceFor(bundleFile),
      referenceFor(exactPlayerIndexFile),
      referenceFor(exactPlayerMaterialsFile),
      referenceFor(exactOfficialIndexFile),
      referenceFor(exactOfficialMaterialsFile),
      referenceFor(skyBackdropFile),
    ],
    lineage: {
      kind: "canonical-prepared-match-scene",
      sourceRevision: contracts.plan.source.revision,
      nativeScenarioSha256: contracts.bindings.nativeScenarioSha256,
    },
  });

  return deepFreeze({
    schema: CSSOCCER_ASSEMBLED_FIXTURE_SCHEMA,
    sourceArtifacts,
    files: [
      textureFile,
      pitchTextureFile,
      markingPixelFile,
      hudGlyphTextureFile,
      stadiumTextureFile,
      skyBackdropFile,
      exactPlayerMaterialTextureFile,
      exactOfficialMaterialTextureFile,
      ...exactPlayerChunkFiles,
      ...exactOfficialChunkFiles,
      ...frameStyleFiles,
      bundleFile,
      exactPlayerIndexFile,
      exactPlayerMaterialsFile,
      exactOfficialIndexFile,
      exactOfficialMaterialsFile,
      factsFile,
      sceneFile,
    ],
    manifest: createPreparedManifest({ contracts, request }),
  });
}

async function readCheckedContracts() {
  const [sourceDataBytes, fixtureContractBytes, oracleContractBytes, fixtureProofBytes, nativeProofBytes] =
    await Promise.all([
      readFile(SOURCE_DATA_URL),
      readFile(FIXTURE_CONTRACT_URL),
      readFile(ORACLE_CONTRACT_URL),
      readFile(FIXTURE_PROOF_URL),
      readFile(NATIVE_PROOF_URL),
    ]);
  const sourceData = parseJson(sourceDataBytes, "source-data contract");
  const fixtureContract = parseJson(fixtureContractBytes, "native fixture contract");
  const oracleContract = parseJson(oracleContractBytes, "oracle contract");
  const fixtureProof = parseJson(fixtureProofBytes, "fixture proof");
  const nativeProof = parseJson(nativeProofBytes, "native capture proof");
  const plan = createCssoccerSlicePlan();
  const sourceDataSha256 = sha256Hex(sourceDataBytes);
  const fixtureContractSha256 = sha256Hex(fixtureContractBytes);

  if (
    sourceData.schema !== "cssoccer-static-source-data@1"
    || sourceData.status !== "ready"
    || sourceData.id !== CSSOCCER_PREPARED_FIXTURE_ID
    || sourceData.source?.revision !== plan.source.revision
  ) {
    throw new Error("The checked source-data contract is not the canonical ready fixture.");
  }
  if (
    fixtureContract.schema !== "cssoccer-native-fixture-contract@1"
    || fixtureContract.id !== CSSOCCER_PREPARED_FIXTURE_ID
  ) {
    throw new Error("The product fixture reference is not the accepted fixed match.");
  }
  if (
    oracleContract.schema !== "cssoccer-actua-soccer-oracle-source@1"
    || oracleContract.revision !== plan.source.revision
  ) {
    throw new Error("The oracle contract changed source revision.");
  }

  const bindings = Object.freeze({
    sourceDataSha256,
    fixtureContractSha256,
    nativeScenarioSha256: plan.nativeProfileGate.scenarioSha256,
    nativeFieldContractSha256: plan.nativeProfileGate.fieldContractSha256,
    nativeCaptureSha256: plan.nativeProfileGate.capture.rawSha256,
  });
  validateProofBindings({
    fixtureProof,
    nativeProof,
    plan,
    bindings,
  });

  return Object.freeze({
    bindings,
    fixtureContract,
    fixtureContractBytes,
    fixtureProof,
    nativeProof,
    oracleContractBytes,
    plan,
    sourceData,
    sourceDataBytes,
  });
}

function validateProofBindings({ fixtureProof, nativeProof, plan, bindings }) {
  const capture = plan.nativeProfileGate.capture;
  if (
    fixtureProof.schema !== "cssoccer-native-fixture-verification@1"
    || fixtureProof.status !== "pass"
    || fixtureProof.bindings?.fixtureContractSha256 !== plan.nativeProfileGate.fixtureContractSha256
    || fixtureProof.bindings?.scenarioSha256 !== bindings.nativeScenarioSha256
  ) {
    throw new Error("The retained native fixture proof does not match the accepted fixture bindings.");
  }
  if (
    nativeProof.schema !== "cssoccer-native-full-match-capture@1"
    || nativeProof.status !== "pass"
    || nativeProof.fixtureId !== CSSOCCER_PREPARED_FIXTURE_ID
    || nativeProof.bindings?.scenarioSha256 !== bindings.nativeScenarioSha256
    || nativeProof.bindings?.contractSha256 !== bindings.nativeFieldContractSha256
    || nativeProof.bindings?.profileSha256 !== capture.profileSha256
    || nativeProof.bindings?.sourceSha256 !== capture.sourceSha256
    || nativeProof.bindings?.buildSha256 !== capture.buildSha256
  ) {
    throw new Error("The retained native capture proof changed its checked hash contract.");
  }
  const exact = nativeProof.canonical?.exactIdentity;
  const canonical = nativeProof.canonical?.runs?.["canonical-a"];
  if (
    exact?.status !== "pass"
    || exact.byteIdentical !== true
    || exact.artifacts?.["native.raw"] !== capture.rawSha256
    || exact.artifacts?.["state.jsonl"] !== capture.stateSha256
    || exact.artifacts?.["phase-markers.json"] !== capture.phaseMarkersSha256
    || exact.artifacts?.["frames.json"] !== capture.framesSha256
    || canonical?.ticks !== capture.ticks
    || canonical?.terminalTick !== capture.terminalTick
    || canonical?.phaseSummary?.terminalMatchHalf !== capture.terminalMatchHalf
  ) {
    throw new Error("The retained canonical native runs are not the accepted exact capture.");
  }
}

async function prepareStaticDomain() {
  const facts = readCssoccerSourceFacts({ sourceRoot: SOURCE_ROOT });
  const scene = await buildCssoccerPitchPreparedScene({ sourceRoot: SOURCE_ROOT, facts });
  if (
    scene.status !== "ready"
    || scene.metrics?.meshCount !== 9
    || scene.roots?.static?.length !== 9
    || scene.roots?.officials?.length !== 3
    || scene.metrics?.sourceFaceCount !== scene.metrics?.sourceFaceCoverageCount
    || scene.metrics?.mergeLossless !== true
  ) {
    throw new Error("B6 static preparation no longer satisfies its accepted exact coverage contract.");
  }
  return Object.freeze({ facts, scene });
}

/* B7 adaptation is deliberately isolated here while its lane finalizes exports. */
async function prepareActorDomain(contracts) {
  const actors = await import("./actorParser.mjs");
  const animations = await import("./animationTable.mjs");
  const teams = await import("./teamParser.mjs");
  const textures = await import("./textureAtlas.mjs");
  const sourceTextures = await import("./sourceTextureAtlas.mjs");
  const [
    sourceBytes,
    actRendDatBytes,
    actRendOffBytes,
    retailActRendDatBytes,
    retailActRendOffBytes,
  ] = await Promise.all([
    readSourceInputs([
    "FILES.C",
    "DEFINES.H",
    "FOOT.EXE",
    "FOOTY.PAL",
    "TAC_433.TAC",
    "DATA.H",
    "3DENG.H",
    "3DENG.C",
    "FGFX.C",
    "3D_UPD2.CPP",
    "ACTIONS.CPP",
    "DATA.OBJ",
    "3DENG.OBJ",
    "EUROREND.DAT",
    "EUROREND.OFF",
    "FAP.EQU",
    "FAP.DAT",
    "FAP.OFF",
    "FAPF.DAT",
    "FAPF.OFF",
    ]),
    readFile(new URL("ACTREND.DAT", SOURCE_TEXTURE_ROOT)),
    readFile(new URL("ACTREND.OFF", SOURCE_TEXTURE_ROOT)),
    readFile(new URL("ACTREND.DAT", RETAIL_SOURCE_TEXTURE_ROOT)),
    readFile(new URL("ACTREND.OFF", RETAIL_SOURCE_TEXTURE_ROOT)),
  ]);
  const teamPreparation = teams.parseCssoccerFixtureTeams({
    filesBytes: sourceBytes.get("FILES.C"),
    definesHBytes: sourceBytes.get("DEFINES.H"),
    footExeBytes: sourceBytes.get("FOOT.EXE"),
  });
  const tacticsPreparation = parseCssoccerTactics({
    tacticsBytes: sourceBytes.get("TAC_433.TAC"),
  });
  const animationTable = animations.parseCssoccerAnimationTable({
    dataHBytes: sourceBytes.get("DATA.H"),
    actionsCppBytes: sourceBytes.get("ACTIONS.CPP"),
    dataObjectBytes: sourceBytes.get("DATA.OBJ"),
    threeDEngCBytes: sourceBytes.get("3DENG.C"),
    euroRendDatBytes: sourceBytes.get("EUROREND.DAT"),
    euroRendOffBytes: sourceBytes.get("EUROREND.OFF"),
  });
  const frontendTextureAtlas = textures.parseCssoccerTextureAtlasMetadata({
    teamPreparation,
    threeDEngCBytes: sourceBytes.get("3DENG.C"),
    fapEquBytes: sourceBytes.get("FAP.EQU"),
    fapDatBytes: sourceBytes.get("FAP.DAT"),
    fapOffBytes: sourceBytes.get("FAP.OFF"),
    fapfDatBytes: sourceBytes.get("FAPF.DAT"),
    fapfOffBytes: sourceBytes.get("FAPF.OFF"),
  });
  const sourcePlayerModelsPreparation = actors.prepareCssoccerSourcePlayerModels({
    dataObjectBytes: sourceBytes.get("DATA.OBJ"),
  });
  const texturePreparation = sourceTextures.prepareCssoccerSourceTextureAtlas({
    actRendDatBytes,
    actRendOffBytes,
    retailActRendDatBytes,
    retailActRendOffBytes,
    threeDEngObjectBytes: sourceBytes.get("3DENG.OBJ"),
    euroRendDatBytes: sourceBytes.get("EUROREND.DAT"),
    euroRendOffBytes: sourceBytes.get("EUROREND.OFF"),
    footyPalBytes: sourceBytes.get("FOOTY.PAL"),
  });
  const actorPreparation = actors.parseCssoccerActors({
    teamPreparation,
    animationTable,
    dataObjectBytes: sourceBytes.get("DATA.OBJ"),
    texturePreparation,
    sourcePlayerModelsPreparation,
    dataHBytes: sourceBytes.get("DATA.H"),
    threeDEngHBytes: sourceBytes.get("3DENG.H"),
    threeDUpd2Bytes: sourceBytes.get("3D_UPD2.CPP"),
    threeDEngCBytes: sourceBytes.get("3DENG.C"),
    footyPalBytes: sourceBytes.get("FOOTY.PAL"),
    renderSelection: {
      modelIds: [],
      slotIds: animationTable.slots
        .filter(({ resolvedFrameCount }) => Number.isSafeInteger(resolvedFrameCount)
          && resolvedFrameCount > 0)
        .map(({ id }) => id),
      includeBall: true,
    },
  });
  const exactModelInputs = {
    dataObjectBytes: sourceBytes.get("DATA.OBJ"),
    euroRendDatBytes: sourceBytes.get("EUROREND.DAT"),
    euroRendOffBytes: sourceBytes.get("EUROREND.OFF"),
  };
  const exactModels = Object.fromEntries(["player_f1", "player_f2"].map((modelId) => [
    modelId,
    prepareExactActuaPlayerModel({ ...exactModelInputs, modelId }),
  ]));
  const exactPlayerGeometry = prepareCssoccerExactActuaPlayerGeometry({
    models: exactModels,
  });
  const exactPlayerMaterials = prepareCssoccerExactActuaPlayerMaterials({
    animationTable,
    sequences: actorPreparation.exactPlayerSequences,
    geometry: exactPlayerGeometry,
    actRendDatBytes,
    actRendOffBytes,
    retailActRendDatBytes,
    retailActRendOffBytes,
    sourceAtlasPngBytes: texturePreparation.assetFile.bytes,
  });
  const exactPlayerChunks = [];
  const exactPlayerPackaging = prepareCssoccerExactActuaPlayerPackaging({
    animationTable,
    sequences: actorPreparation.exactPlayerSequences,
    geometry: exactPlayerGeometry,
    onChunk(chunk) {
      exactPlayerChunks.push(chunk);
    },
  });
  const exactPlayerPreparation = Object.freeze({
    geometry: exactPlayerGeometry,
    materials: exactPlayerMaterials,
    packaging: exactPlayerPackaging.contract,
    chunks: Object.freeze(exactPlayerChunks),
  });
  const exactOfficialSource = prepareCssoccerExactActuaOfficialSource({
    animationTable,
    playerGeometry: exactPlayerGeometry,
    sourcePlayerModelsPreparation,
    actRendDatBytes,
    actRendOffBytes,
    retailActRendDatBytes,
    retailActRendOffBytes,
    sourceAtlasPngBytes: texturePreparation.assetFile.bytes,
    officialSourceAtlas: texturePreparation.officialSourceAtlas,
    threeDEngCBytes: sourceBytes.get("3DENG.C"),
    threeDUpd2Bytes: sourceBytes.get("3D_UPD2.CPP"),
  });
  const exactOfficialMaterials = prepareCssoccerExactActuaOfficialMaterials({
    officialSource: exactOfficialSource,
    actRendDatBytes,
    actRendOffBytes,
    retailActRendDatBytes,
    retailActRendOffBytes,
    sourceAtlasPngBytes: texturePreparation.assetFile.bytes,
    officialSourceAtlas: texturePreparation.officialSourceAtlas,
  });
  const exactOfficialChunks = [];
  const exactOfficialPackaging = prepareCssoccerExactActuaOfficialPackaging({
    animationTable,
    officialSource: exactOfficialSource,
    onChunk(chunk) {
      exactOfficialChunks.push(chunk);
    },
  });
  const exactOfficialPreparation = Object.freeze({
    source: exactOfficialSource,
    materials: exactOfficialMaterials,
    packaging: exactOfficialPackaging.contract,
    chunks: Object.freeze(exactOfficialChunks),
  });
  const textureAtlas = deepFreeze({
    ...frontendTextureAtlas,
    status: "ready-source-match-atlas-plus-decoded-frontend-frames",
    counts: {
      ...frontendTextureAtlas.counts,
      browserAtlasPlacements: texturePreparation.metadata.counts.browserAtlasPlacements,
      generatedMatchTextureFiles: 1,
      generatedPlayerPanelFiles: 0,
      generatedPitchSurfaceFiles: 1,
      generatedMarkingPixelFiles: 1,
      generatedHudGlyphFiles: 1,
      generatedStadiumTextureFiles: 1,
      generatedSkyBackdropFiles: 1,
      generatedTextureFiles: texturePreparation.metadata.counts.generatedFiles,
      sourceMatchTextureRecords: texturePreparation.metadata.counts.textureRecords,
    },
    matchAtlas: texturePreparation.metadata,
    materials: frontendTextureAtlas.materials.map((material) => ({
      ...material,
      browserAtlasEntryIds: texturePreparation.metadata.browserAtlas.placements
        .map(({ id }) => id),
      status: "source-decoded-match-material-ready",
    })),
    browserAtlas: texturePreparation.metadata.browserAtlas,
    pitchSurface: texturePreparation.metadata.pitchSurface,
    markingPixel: texturePreparation.metadata.markingPixel,
    hudGlyphAtlas: texturePreparation.metadata.hudGlyphAtlas,
    stadiumAtlas: texturePreparation.metadata.stadiumAtlas,
    unsupportedClasses: frontendTextureAtlas.unsupportedClasses.filter(
      ({ id }) => id === "fapf-symbol-bindings",
    ),
  });
  validateActorDomain({
    actorPreparation,
    animationTable,
    exactOfficialPreparation,
    exactPlayerPreparation,
    tacticsPreparation,
    teamPreparation,
    textureAtlas,
    contracts,
  });
  return Object.freeze({
    actorPreparation,
    animationTable,
    dataObjectBytes: sourceBytes.get("DATA.OBJ"),
    additionalSourceArtifacts: Object.freeze([
      sourceArtifact("source:ACTREND.DAT", actRendDatBytes),
      sourceArtifact("source:ACTREND.OFF", actRendOffBytes),
      sourceArtifact("source:RETAIL_ACTREND.DAT", retailActRendDatBytes),
      sourceArtifact("source:RETAIL_ACTREND.OFF", retailActRendOffBytes),
    ]),
    inputFiles: Object.freeze([...sourceBytes.keys()]),
    tacticsPreparation,
    teamPreparation,
    textureAtlas,
    texturePreparation,
    exactOfficialPreparation,
    exactPlayerPreparation,
  });
}

function validateActorDomain({
  actorPreparation,
  animationTable,
  exactOfficialPreparation,
  exactPlayerPreparation,
  tacticsPreparation,
  teamPreparation,
  textureAtlas,
  contracts,
}) {
  assertCssoccerPreparedTactics(tacticsPreparation);
  const counts = actorPreparation?.counts;
  if (
    actorPreparation?.fixtureId !== contracts.plan.id
    || teamPreparation?.fixtureId !== contracts.plan.id
    || animationTable?.fixtureId !== contracts.plan.id
    || textureAtlas?.fixtureId !== contracts.plan.id
    || textureAtlas?.matchAtlas?.status !== "ready-source-decoded-browser-atlas"
    || textureAtlas?.counts?.browserAtlasPlacements !== 9
    || exactPlayerPreparation?.geometry?.status !== "ready-one-geometry-two-material-profiles"
    || exactPlayerPreparation.geometry.geometry?.faceCount !== 13
    || exactPlayerPreparation.materials?.publication?.status
      !== "ready-complete-two-profile-normalized-atlas"
    || exactPlayerPreparation.materials.publication.counts?.fixturePlayers !== 22
    || exactPlayerPreparation.packaging?.index?.counts?.samples !== 140_568
    || exactPlayerPreparation.packaging.index.counts.faceStates !== 1_827_384
    || exactPlayerPreparation.chunks?.length !== 426
    || exactOfficialPreparation?.source?.status !== "ready-exact-referee-and-two-assistants"
    || exactOfficialPreparation.source.geometry?.faceCount !== 12
    || exactOfficialPreparation.materials?.publication?.status
      !== "ready-complete-two-official-profile-normalized-atlas"
    || exactOfficialPreparation.materials.publication.counts?.fixtureOfficials !== 3
    || exactOfficialPreparation.packaging?.index?.counts?.samples !== 1_632
    || exactOfficialPreparation.packaging.index.counts.faceStates !== 19_584
    || exactOfficialPreparation.chunks?.length !== 5
    || teamPreparation?.counts?.retainedStarters !== 22
    || counts?.actors !== 26
    || counts?.players !== 22
    || counts?.officials !== 3
    || counts?.balls !== 1
    || counts?.stableRoots !== 26
    || animationTable?.counts?.resolvedRetainedNativeAnimationSlots
      !== animationTable?.counts?.retainedNativeAnimationSlots
  ) {
    throw new Error("B7 actor preparation is not the complete fixed-fixture contract.");
  }
}

/* The render-bundle lane plugs into this one helper without changing assembly. */
async function prepareRenderDomain({ staticDomain, actorDomain }) {
  const renderBundles = await import("./renderBundle.mjs");
  if (
    typeof renderBundles.buildCssoccerPreparedRenderBundle !== "function"
    || typeof renderBundles.buildCssoccerPreparedRenderFrameSet !== "function"
  ) {
    throw new Error(
      "renderBundle.mjs must export the generic prepared bundle and frame-set builders.",
    );
  }
  const staticBundles = [];
  const rootBindings = [];
  for (const mesh of staticDomain.scene.meshes) {
    const bundle = await renderBundles.buildCssoccerPreparedRenderBundle({
      id: `static-${mesh.id}`,
      polygons: mesh.id === "pitch"
        ? prepareTexturedPitchPolygons(mesh.polygons, actorDomain.texturePreparation)
        : mesh.id === "pitch-markings"
          ? prepareTexturedMarkingPolygons(mesh.polygons, actorDomain.texturePreparation)
          : mesh.id === "goal-left" || mesh.id === "goal-right"
            ? prepareTexturedGoalPolygons(mesh.polygons, actorDomain.texturePreparation, mesh.id)
          : mesh.id === "corner-flags"
            ? prepareTexturedCornerFlagPolygons(mesh.polygons, actorDomain.texturePreparation)
          : mesh.id.startsWith("stadium-stand-")
            ? prepareTexturedStadiumPolygons(mesh.polygons, actorDomain.texturePreparation)
            : mesh.polygons,
    });
    assertZeroRuntimeConstruction(bundle.runtimeConstruction, bundle.id);
    staticBundles.push(bundle);
    rootBindings.push({ rootId: mesh.id, bundleId: bundle.id, frameSetId: null });
  }
  const actorAssets = await prepareActorRenderAssets({
    actorDomain,
    buildBundle: renderBundles.buildCssoccerPreparedRenderBundle,
    buildFrameSet: renderBundles.buildCssoccerPreparedRenderFrameSet,
  });
  const highlightAsset = await preparePlayerHighlightRenderAsset({
    actorDomain,
    buildFrameSet: renderBundles.buildCssoccerPreparedRenderFrameSet,
  });
  const bundles = [...staticBundles, highlightAsset.frameSet.bundle, ...actorAssets.bundles];
  const frameSets = [highlightAsset.frameSet, ...actorAssets.frameSets];
  rootBindings.push({
    rootId: HIGHLIGHT_ROOT_ID,
    bundleId: highlightAsset.frameSet.bundle.id,
    frameSetId: highlightAsset.frameSet.id,
  });
  rootBindings.push(...actorAssets.rootBindings);
  if (
    staticBundles.length !== 9
    || actorAssets.rootBindings.length !== 26
    || rootBindings.length !== 36
    || new Set(rootBindings.map(({ rootId }) => rootId)).size !== rootBindings.length
  ) {
    throw new Error(
      "Prepared render bundles must bind nine static, one highlight, and 26 actor roots exactly once.",
    );
  }
  const prepared = deepFreeze({
    schema: "cssoccer-prepared-fixture-render-bundles@1",
    id: CSSOCCER_PREPARED_FIXTURE_ID,
    status: "ready",
    bundles,
    frameSets,
    rootBindings,
    counts: {
      bundles: bundles.length,
      frameSets: frameSets.length,
      staticRootBindings: staticBundles.length,
      highlightRootBindings: 1,
      actorRootBindings: actorAssets.rootBindings.length,
      rootBindings: rootBindings.length,
      sourcePolygons: bundles.reduce((sum, bundle) => sum + bundle.polygonCount, 0),
      leaves: bundles.reduce((sum, bundle) => sum + bundle.leafCount, 0),
      droppedSourcePolygons: bundles.reduce(
        (sum, bundle) => sum + bundle.droppedSourcePolygonCount,
        0,
      ),
      preparedFrames: frameSets.reduce((sum, frameSet) => sum + frameSet.frameCount, 0),
    },
    runtimeConstruction: zeroRuntimeConstruction(),
    lineage: {
      productionReference: "cssQuake",
      pattern: "prepare-time stable DOM serialization with same-topology frame-style swaps",
    },
  });
  if (
    prepared?.status !== "ready"
    || prepared.counts?.droppedSourcePolygons !== 0
    || prepared.counts?.leaves !== prepared.counts?.sourcePolygons
    || prepared.runtimeConstruction?.topologyBuildCount !== 0
    || prepared.runtimeConstruction?.assetBuildCount !== 0
  ) {
    throw new Error(
      "Prepared render bundles must retain every source polygon with zero runtime construction.",
    );
  }
  return Object.freeze({
    publication: prepared,
    highlight: highlightAsset.metadata,
    rootBindings: prepared.rootBindings,
    sourceIds: Object.freeze([
      "source:DATA.OBJ",
      "source:3DENG.OBJ",
      "source:EUROREND.DAT",
      "source:EUROREND.OFF",
      "source:ACTREND.DAT",
      "source:ACTREND.OFF",
    ]),
  });
}

async function preparePlayerHighlightRenderAsset({ actorDomain, buildFrameSet }) {
  const contract = CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT;
  const dataObject = decodeWatcomOmf32Object(actorDomain.dataObjectBytes, {
    label: "DATA.OBJ",
  });
  const points = decodeActuaPointList(dataObject.symbolBytes(contract.geometry.sourceName), {
    id: contract.geometry.sourceName,
  });
  if (
    points.sha256 !== contract.geometry.sourcePointListSha256
    || points.pointCount !== contract.geometry.sourcePointCount
  ) {
    throw new Error("Prepared player highlight lost its pinned source flat quad.");
  }
  const colour = contract.colourSlots[0];
  const frames = contract.markerFamilies.map((family) => {
    const symbol = `${family.sourceName}_${colour.sourceFaceSuffix}`;
    const faceList = decodeActuaFaceList(dataObject.symbolBytes(symbol), {
      id: symbol,
      pointCount: points.pointCount,
    });
    if (faceList.faceCount !== 1) {
      throw new Error(`Prepared player highlight ${symbol} must remain one source face.`);
    }
    const face = faceList.faces[0];
    const expectedColorCode = colour.sourceColorCodes[family.sourceTextureColumn];
    if (face.sourceColorCode !== expectedColorCode || face.pointIndexes.length !== 4) {
      throw new Error(`Prepared player highlight ${symbol} changed its source material or quad.`);
    }
    const texture = bindCssoccerPreparedTextureRecord(
      actorDomain.texturePreparation,
      face.sourceColorCode,
    );
    return {
      id: family.id,
      polygons: [{
        vertices: face.pointIndexes.map((index) => points.points[index]),
        color: "#ffffff",
        material: texture.material,
        textureAlphaMode: texture.transparent ? "mask" : "opaque",
        uvs: texture.uvs,
      }],
    };
  });
  const frameSet = await buildFrameSet({ id: HIGHLIGHT_FRAME_SET_ID, frames });
  if (
    frameSet.frameCount !== contract.markerFamilies.length
    || frameSet.leafCount !== 1
    || frameSet.bundle.leafCount !== 1
    || frameSet.bundle.droppedSourcePolygonCount !== 0
  ) {
    throw new Error("Prepared player highlight frame set is not one stable source quad.");
  }
  return deepFreeze({
    frameSet,
    metadata: {
      schema: "cssoccer-prepared-player-highlight@1",
      contractSha256: CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT_SHA256,
      rootId: HIGHLIGHT_ROOT_ID,
      frameSetId: frameSet.id,
      bundleId: frameSet.bundle.id,
      frameIds: frameSet.frames.map(({ id }) => id),
      sourcePointListSha256: points.sha256,
      stableLeafCount: frameSet.leafCount,
      runtimeConstruction: zeroRuntimeConstruction(),
    },
  });
}

function prepareTexturedPitchPolygons(polygons, texturePreparation) {
  if (
    !texturePreparation?.pitchMaterial
    || !Array.isArray(texturePreparation.pitchUvs)
    || texturePreparation.pitchUvs.length !== 4
  ) {
    throw new Error("Prepared pitch texture material is unavailable.");
  }
  if (!Array.isArray(polygons) || polygons.length !== 18) {
    throw new Error("Prepared pitch must retain the exact 18 source strips before prebaking.");
  }
  const sources = [];
  let expectedLeft = -200;
  for (const [index, polygon] of polygons.entries()) {
    if (!Array.isArray(polygon.vertices) || polygon.vertices.length !== 4) {
      throw new Error(`Prepared pitch polygon ${index} is not a source quad.`);
    }
    const [nearLeft, nearRight, farRight, farLeft] = polygon.vertices;
    const right = nearRight[0];
    if (
      JSON.stringify(nearLeft) !== JSON.stringify([expectedLeft, 0, 180])
      || JSON.stringify(nearRight) !== JSON.stringify([right, 0, 180])
      || JSON.stringify(farRight) !== JSON.stringify([right, 0, -980])
      || JSON.stringify(farLeft) !== JSON.stringify([expectedLeft, 0, -980])
      || !(right > expectedLeft)
    ) {
      throw new Error(`Prepared pitch source strip ${index} changed bounds or winding.`);
    }
    if (!Array.isArray(polygon.sources) || polygon.sources.length === 0) {
      throw new Error(`Prepared pitch source strip ${index} lost source coverage.`);
    }
    sources.push(...polygon.sources);
    expectedLeft = right;
  }
  if (expectedLeft !== 1480 || sources.length !== 18
      || new Set(sources.map(({ id }) => id)).size !== 18) {
    throw new Error("Prepared pitch prebake did not preserve all 18 source faces.");
  }
  return [{
    ...polygons[0],
    vertices: [[-200, 0, 180], [1480, 0, 180], [1480, 0, -980], [-200, 0, -980]],
    sources,
    material: texturePreparation.pitchMaterial,
    textureAlphaMode: "opaque",
    uvs: texturePreparation.pitchUvs,
    doubleSided: true,
  }];
}

function prepareTexturedMarkingPolygons(polygons, texturePreparation) {
  const material = texturePreparation?.markingMaterial;
  if (!material || material.imageSource?.width !== 1 || material.imageSource?.height !== 1) {
    throw new Error("Prepared one-pixel marking material is unavailable.");
  }
  const sources = polygons.flatMap(({ sources: refs }) => refs ?? []);
  if (sources.length !== 215 || new Set(sources.map(({ id }) => id)).size !== 215) {
    throw new Error("Prepared pitch markings must retain all 215 source faces before prebaking.");
  }
  const sourceByFace = new Map(sources.map((source) => [
    `${source.object}:${source.sourceFaceIndex}`,
    source,
  ]));
  if (sourceByFace.size !== sources.length) {
    throw new Error("Prepared pitch marking source faces are not uniquely addressable.");
  }
  const face = (object, sourceFaceIndex) => {
    const source = sourceByFace.get(`${object}:${sourceFaceIndex}`);
    if (!source) throw new Error(`Prepared pitch marking lost ${object}:${sourceFaceIndex}.`);
    return source;
  };
  const faces = (object, indexes) => indexes.map((index) => face(object, index));

  const definitions = [
    markingLine("outer-top", [0, 0], [1280, 0], [face("l1", 0), face("l2", 0), face("l5", 0)]),
    markingLine("outer-bottom", [0, -800], [1280, -800], [face("l4", 0), face("l3", 0), face("l6", 0)]),
    markingLine("outer-left", [0, 0], [0, -800], [face("l1", 1), face("l4", 1)]),
    markingLine("outer-right", [1280, 0], [1280, -800], [face("l2", 1), face("l3", 1)]),
    markingLine("halfway", [640, 0], [640, -800], [face("l5", 1), face("l6", 1)]),
    markingLine("left-penalty-top", [0, -165], [192, -165], [face("l1", 2)]),
    markingLine("left-penalty-side", [192, -165], [192, -635], [face("l1", 3), face("l4", 3)]),
    markingLine("left-penalty-bottom", [0, -635], [192, -635], [face("l4", 2)]),
    markingLine("left-goal-top", [0, -293], [64, -293], [face("l1", 4)]),
    markingLine("left-goal-side", [64, -293], [64, -507], [face("l1", 5), face("l4", 5)]),
    markingLine("left-goal-bottom", [0, -507], [64, -507], [face("l4", 4)]),
    markingLine("right-penalty-top", [1280, -165], [1088, -165], [face("l2", 2)]),
    markingLine("right-penalty-side", [1088, -165], [1088, -635], [face("l2", 3), face("l3", 3)]),
    markingLine("right-penalty-bottom", [1280, -635], [1088, -635], [face("l3", 2)]),
    markingLine("right-goal-top", [1280, -293], [1216, -293], [face("l2", 4)]),
    markingLine("right-goal-side", [1216, -293], [1216, -507], [face("l2", 5), face("l3", 5)]),
    markingLine("right-goal-bottom", [1280, -507], [1216, -507], [face("l3", 4)]),
    ...markingRing("center-circle", [640, -400], 0, 360, 36, (index) => (
      faces("circle", [index, index + 36, index + 72, index + 108])
    )),
    ...markingRing("left-arc", [123, -400], -50, 50, 10, (index) => (
      faces("semi1", [index, index + 10])
    )),
    ...markingRing("right-arc", [1157, -400], 130, 230, 10, (index) => (
      faces("semi2", [index, index + 10])
    )),
    markingSpot("center-spot", [637.5, 642.5], [-402, -398], [face("spot1", 0)]),
    markingSpot("left-spot", [125.5, 130.5], [-402, -398], [face("spot2", 0)]),
    markingSpot("right-spot", [1149.5, 1154.5], [-402, -398], [face("spot3", 0)]),
  ];
  const groupedSources = definitions.flatMap(({ sources: refs }) => refs);
  if (definitions.length !== 76
      || groupedSources.length !== sources.length
      || new Set(groupedSources.map(({ id }) => id)).size !== sources.length) {
    throw new Error("Logical pitch marking prebake lost or duplicated source lineage.");
  }
  return definitions.map((definition, index) => ({
    vertices: definition.vertices,
    color: "#ffffff",
    materialId: "actua-marking-22",
    visibilityGroup: "marking",
    paintOrder: index,
    source: definition.sources[0],
    sources: definition.sources,
    material,
    textureAlphaMode: "opaque",
    uvs: MARKING_UVS,
    doubleSided: true,
    marking: { id: definition.id, kind: definition.kind },
  }));
}

function markingLine(id, start, end, sources) {
  return {
    id,
    kind: "solid",
    sources,
    vertices: lineQuad(start, end, MARKING_WIDTH),
  };
}

function markingRing(id, center, startDegrees, endDegrees, segmentCount, sourceForSegment) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const step = (endDegrees - startDegrees) / segmentCount;
  return Array.from({ length: segmentCount }, (_, index) => ({
    id: `${id}-${index}`,
    kind: "solid",
    sources: sourceForSegment(index),
    vertices: ringSegmentQuad(
      center,
      radians(startDegrees + step * index),
      radians(startDegrees + step * (index + 1)),
      105.66666412353516,
      107.66666412353516,
    ),
  }));
}

function markingSpot(id, x, z, sources) {
  return {
    id,
    kind: "solid-circle",
    sources,
    vertices: markingQuad(x, z),
  };
}

function lineQuad([startX, startZ], [endX, endZ], width) {
  const deltaX = endX - startX;
  const deltaZ = endZ - startZ;
  const length = Math.hypot(deltaX, deltaZ);
  if (!(length > 0)) throw new Error("Logical pitch marking line has zero length.");
  const normalX = -deltaZ / length * width / 2;
  const normalZ = deltaX / length * width / 2;
  return [
    [startX + normalX, MARKING_Y, startZ + normalZ],
    [endX + normalX, MARKING_Y, endZ + normalZ],
    [endX - normalX, MARKING_Y, endZ - normalZ],
    [startX - normalX, MARKING_Y, startZ - normalZ],
  ];
}

function ringSegmentQuad([centerX, centerZ], startAngle, endAngle, innerRadius, outerRadius) {
  const point = (radius, angle) => [
    centerX + radius * Math.cos(angle),
    MARKING_Y,
    centerZ + radius * Math.sin(angle),
  ];
  return [
    point(outerRadius, startAngle),
    point(outerRadius, endAngle),
    point(innerRadius, endAngle),
    point(innerRadius, startAngle),
  ];
}

function markingQuad([left, right], [far, near]) {
  return [
    [left, MARKING_Y, near],
    [right, MARKING_Y, near],
    [right, MARKING_Y, far],
    [left, MARKING_Y, far],
  ];
}

function prepareTexturedGoalPolygons(polygons, texturePreparation, meshId) {
  if (!Array.isArray(polygons) || polygons.length !== 32) {
    throw new Error(`${meshId} must retain its exact 32 highest-detail source faces.`);
  }
  const exactSolidColors = new Map([
    [22, "#aeaeae"],
    [24, "#bebebe"],
    [26, "#d3d3d3"],
    [28, "#e3e3e3"],
    [30, "#f3f3f3"],
  ]);
  let texturedFaces = 0;
  let solidFaces = 0;
  const prepared = polygons.flatMap((polygon, index) => {
    if (!Array.isArray(polygon.sources) || polygon.sources.length !== 1) {
      throw new Error(`${meshId} polygon ${index} lost its one source face.`);
    }
    const [{ sourceColorCode }] = polygon.sources;
    if (sourceColorCode >= 0) {
      const expectedColor = exactSolidColors.get(sourceColorCode);
      if (!expectedColor || polygon.color !== expectedColor) {
        throw new Error(`${meshId} solid face ${index} has no exact FOOTY.PAL material.`);
      }
      solidFaces += 1;
      return [polygon];
    }
    const binding = bindCssoccerGoalNetTexture(texturePreparation, sourceColorCode);
    if (
      !binding
      || polygon.vertices.length !== 4
      || binding.sourceUvs.length !== polygon.vertices.length
      || binding.triangleCutouts.length !== 2
      || binding.triangleMaterials.length !== 2
      || binding.cutoutUvs.length !== 4
    ) {
      throw new Error(`${meshId} face ${index} cannot bind exact native net ${sourceColorCode}.`);
    }
    const triangleVertexIndexes = [[0, 1, 2], [0, 2, 3]];
    texturedFaces += 1;
    return triangleVertexIndexes.map((vertexIndexes, triangleIndex) => {
      const cutout = binding.triangleCutouts[triangleIndex];
      if (
        !Array.isArray(cutout.basisVertexIndexes)
        || cutout.basisVertexIndexes.length !== 3
        || [...cutout.basisVertexIndexes].sort().join(",")
          !== [...vertexIndexes].sort().join(",")
      ) {
        throw new Error(`${meshId} face ${index} lost its native net triangle basis.`);
      }
      const triangleVertices = cutout.basisVertexIndexes.map((vertexIndex) => (
        polygon.vertices[vertexIndex]
      ));
      const expanded = expandTexturedTriangleToEdgeBasisQuad(
        triangleVertices,
        binding.cutoutUvs,
      );
      return {
        ...polygon,
        vertices: expanded.vertices,
        color: "#ffffff",
        material: binding.triangleMaterials[triangleIndex],
        textureAlphaMode: "mask",
        uvs: expanded.uvs,
      };
    });
  });
  const sourceIds = new Set(prepared.flatMap(({ sources }) => sources.map(({ id }) => id)));
  if (
    texturedFaces !== 8
    || solidFaces !== 24
    || sourceIds.size !== 32
    || prepared.length !== 40
  ) {
    throw new Error(`${meshId} lost exact post, crossbar, or BM_NETS source coverage.`);
  }
  return prepared;
}

function prepareTexturedCornerFlagPolygons(polygons, texturePreparation) {
  if (!Array.isArray(polygons) || polygons.length !== 28) {
    throw new Error("Prepared corner flags must retain all 28 source faces.");
  }
  const binding = bindCssoccerCornerFlagTexture(texturePreparation, -2579);
  const expectedSolidColors = new Map([
    [27, "#dbdbdb"],
    [29, "#ebebeb"],
    [31, "#ffffff"],
  ]);
  let texturedFaces = 0;
  let solidFaces = 0;
  const prepared = polygons.map((polygon, index) => {
    if (!Array.isArray(polygon.sources) || polygon.sources.length !== 1) {
      throw new Error(`Prepared corner-flag polygon ${index} lost its one source face.`);
    }
    const [{ sourceColorCode, sourceFaceIndex }] = polygon.sources;
    if (sourceColorCode !== -2579) {
      const expectedColor = expectedSolidColors.get(sourceColorCode);
      if (!expectedColor || polygon.color !== expectedColor || polygon.vertices.length !== 4) {
        throw new Error(`Prepared corner-flag solid face ${index} has no exact FOOTY.PAL material.`);
      }
      solidFaces += 1;
      return polygon;
    }
    if (
      (sourceFaceIndex !== 5 && sourceFaceIndex !== 6)
      || polygon.vertices.length !== 3
      || polygon.materialId !== "actua-flag-n2579"
    ) {
      throw new Error(`Prepared corner-flag texture face ${index} changed source topology.`);
    }
    const triangleVertices = binding.basisVertexIndexes.map((vertexIndex) => (
      polygon.vertices[vertexIndex]
    ));
    const expanded = expandTexturedTriangleToEdgeBasisQuad(triangleVertices, binding.uvs);
    texturedFaces += 1;
    return {
      ...polygon,
      vertices: expanded.vertices,
      material: binding.material,
      textureAlphaMode: "mask",
      uvs: expanded.uvs,
    };
  });
  const sourceIds = new Set(prepared.flatMap(({ sources }) => sources.map(({ id }) => id)));
  if (texturedFaces !== 8 || solidFaces !== 20 || sourceIds.size !== 28) {
    throw new Error("Prepared corner-flag texture binding lost exact source-face coverage.");
  }
  return prepared;
}

function prepareTexturedStadiumPolygons(polygons, texturePreparation) {
  if (!Array.isArray(polygons) || polygons.length === 0) {
    throw new Error("Prepared stadium mesh has no source polygons.");
  }
  const exactSolidColors = new Map([
    [159, "#8a048e"],
    [248, "#ef5151"],
    [249, "#791820"],
    [250, "#ff6161"],
    [255, "#ffffff"],
  ]);
  return polygons.flatMap((polygon, index) => {
    if (!Array.isArray(polygon.sources) || polygon.sources.length === 0) {
      throw new Error(`Prepared stadium polygon ${index} lost source coverage.`);
    }
    const [{ sourceColorCode }] = polygon.sources;
    if (!Number.isSafeInteger(sourceColorCode) || sourceColorCode >= 0) {
      const expectedColor = exactSolidColors.get(sourceColorCode);
      if (!expectedColor || polygon.color !== expectedColor) {
        throw new Error(`Prepared stadium solid ${index} has no exact PAL_FOOTY material.`);
      }
      const sourcePointIndexes = polygon.sources[0].sourcePointIndexes;
      if (!Array.isArray(sourcePointIndexes)
          || sourcePointIndexes.length !== polygon.vertices.length) {
        throw new Error(`Prepared stadium solid ${index} lost its source point order.`);
      }
      const uniqueSourceVertexIndexes = sourcePointIndexes
        .map((_sourcePointIndex, vertexIndex) => vertexIndex)
        .filter((vertexIndex) => (
          sourcePointIndexes.indexOf(sourcePointIndexes[vertexIndex]) === vertexIndex
        ));
      if (uniqueSourceVertexIndexes.length < 3 || uniqueSourceVertexIndexes.length > 4) {
        throw new Error(`Prepared stadium solid ${index} has invalid native polygon cardinality.`);
      }
      return [{
        ...polygon,
        // Actua's stadium solids are front-facing under the renderer's
        // screen-space winding test. PolyCSS uses the opposite CSS face for
        // these untextured leaves, so reverse only this native-solid subset.
        // Textured crowd faces retain their source UV winding below.
        vertices: uniqueSourceVertexIndexes.map((vertexIndex) => (
          polygon.vertices[vertexIndex]
        )).reverse(),
        doubleSided: true,
      }];
    }
    if (polygon.sources.length !== 1) {
      throw new Error(
        `Prepared stadium polygon ${index} lost its one-face UV topology before texture binding.`,
      );
    }
    const binding = bindCssoccerStadiumTexture(texturePreparation, sourceColorCode);
    if (!binding || binding.sourceUvs.length !== polygon.vertices.length) {
      throw new Error(
        `Prepared stadium polygon ${index} cannot bind native texture ${sourceColorCode}.`,
      );
    }
    // PolyCSS maps a direct image to one parallelogram. Keep that plane local
    // to the source triangle: [A, B, B + C - A, C]. The atlas is prebaked in
    // the same edge basis, so the transparent half replaces runtime clipping
    // without extending a UV bounding rectangle across the camera plane.
    const triangleVertexIndexes = polygon.vertices.length === 3
      ? [[0, 1, 2]]
      : polygon.vertices.length === 4
        ? [[0, 1, 2], [0, 2, 3]]
        : null;
    if (
      !triangleVertexIndexes
      || binding.triangleCutouts.length !== triangleVertexIndexes.length
      || binding.triangleMaterials.length !== triangleVertexIndexes.length
      || binding.cutoutUvs.length !== 4
    ) {
      throw new Error(
        `Prepared stadium polygon ${index} has no complete prepare-time triangle binding.`,
      );
    }
    return triangleVertexIndexes.map((vertexIndexes, triangleIndex) => {
      const cutout = binding.triangleCutouts[triangleIndex];
      if (
        !Array.isArray(cutout.basisVertexIndexes)
        || cutout.basisVertexIndexes.length !== 3
        || [...cutout.basisVertexIndexes].sort().join(",") !== [...vertexIndexes].sort().join(",")
      ) {
        throw new Error(`Prepared stadium polygon ${index} lost its tight triangle basis.`);
      }
      const triangleVertices = cutout.basisVertexIndexes.map((vertexIndex) => (
        polygon.vertices[vertexIndex]
      ));
      const expanded = expandTexturedTriangleToEdgeBasisQuad(
        triangleVertices,
        binding.cutoutUvs,
      );
      return {
        ...polygon,
        vertices: expanded.vertices,
        material: binding.triangleMaterials[triangleIndex],
        textureAlphaMode: "mask",
        uvs: expanded.uvs,
        doubleSided: true,
      };
    });
  });
}

function expandTexturedTriangleToEdgeBasisQuad(vertices, cutoutUvs) {
  if (vertices.length !== 3) {
    throw new Error("Native texture triangle cutout requires three source vertices.");
  }
  if (!Array.isArray(cutoutUvs) || cutoutUvs.length !== 4) {
    throw new Error("Native stadium triangle cutout requires four prepared image UVs.");
  }
  const [origin, pointU, pointV] = vertices;
  const opposite = origin.map((_value, axis) => (
    pointU[axis] + pointV[axis] - origin[axis]
  ));
  return {
    vertices: [origin, pointU, opposite, pointV],
    uvs: cutoutUvs,
  };
}

async function prepareActorRenderAssets({ actorDomain, buildBundle, buildFrameSet }) {
  const renderAssets = actorDomain.actorPreparation.renderAssets;
  if (!Array.isArray(renderAssets) || renderAssets.length === 0) {
    throw new Error(
      "B7 actor preparation must export at least one source-bound render asset.",
    );
  }
  const bundles = [];
  const frameSets = [];
  const assetById = new Map();
  for (const asset of renderAssets) {
    if (/^actor-player-f[12]$/u.test(asset?.id ?? "")) {
      throw new Error(`Obsolete player render asset ${asset.id} reached fixture assembly.`);
    }
    if (asset?.kind === "static-solid-model") {
      const bundle = await buildBundle({ id: asset.id, polygons: asset.polygons });
      assertZeroRuntimeConstruction(bundle.runtimeConstruction, bundle.id);
      bundles.push(bundle);
      assetById.set(asset.id, { bundleId: bundle.id, frameSetId: null });
      continue;
    }
    if (asset?.kind === "animated-solid-model" || asset?.kind === "animated-textured-model") {
      const frameSet = await buildFrameSet({
        id: asset.id,
        frames: asset.frames,
      });
      assertZeroRuntimeConstruction(frameSet.runtimeConstruction, frameSet.id);
      frameSets.push(frameSet);
      bundles.push(frameSet.bundle);
      assetById.set(asset.id, { bundleId: frameSet.bundle.id, frameSetId: frameSet.id });
      continue;
    }
    throw new Error(`Unsupported B7 actor render asset ${asset?.id ?? "<missing>"}.`);
  }
  const rootBindings = actorDomain.actorPreparation.actors.map((actor) => {
    if (actor.kind === "player") {
      return deepFreeze({
        rootId: actor.id,
        bundleId: EXACT_PLAYER_RENDER_BINDING_ID,
        frameSetId: null,
      });
    }
    if (actor.kind === "official") {
      if (
        actor.rendering?.status !== "prepared-source-bound"
        || actor.rendering.replacementAllowed !== false
        || actor.model?.renderAssetId !== EXACT_OFFICIAL_RENDER_BINDING_ID
        || !actor.material?.materialProfileId
      ) {
        throw new Error(`Official ${actor.id} has no exact prepared render binding.`);
      }
      return deepFreeze({
        rootId: actor.id,
        bundleId: EXACT_OFFICIAL_RENDER_BINDING_ID,
        frameSetId: null,
      });
    }
    const assetId = actor.renderAssetId ?? actor.model?.renderAssetId;
    const asset = assetById.get(assetId);
    if (!asset) throw new Error(`Actor ${actor.id} does not resolve a prepared render asset.`);
    return deepFreeze({ rootId: actor.id, ...asset });
  });
  if (
    rootBindings.length !== 26
    || new Set(rootBindings.map(({ rootId }) => rootId)).size !== 26
    || renderAssets.length !== 1
    || bundles.length !== 1
    || frameSets.length !== 0
    || new Set(rootBindings.map(({ bundleId }) => bundleId).filter(Boolean)).size !== 3
  ) {
    throw new Error(
      "Actor rendering must publish exact players, all three exact officials, and the ball.",
    );
  }
  return deepFreeze({ bundles, frameSets, rootBindings });
}

function assertZeroRuntimeConstruction(value, id) {
  const zero = zeroRuntimeConstruction();
  if (JSON.stringify(value) !== JSON.stringify(zero)) {
    throw new Error(`Prepared render asset ${id} performs runtime construction.`);
  }
}

function zeroRuntimeConstruction() {
  return {
    sourceParseCount: 0,
    geometryBuildCount: 0,
    topologyBuildCount: 0,
    materialBuildCount: 0,
    assetBuildCount: 0,
  };
}

async function verifyNativeArtifacts(contracts) {
  const canonical = contracts.nativeProof.canonical.runs["canonical-a"].artifacts;
  const expected = contracts.plan.nativeProfileGate.capture;
  const specs = [
    ["native:canonical-raw", "native.raw", canonical.raw.bytes, expected.rawSha256],
    ["native:canonical-state", "state.jsonl", canonical.state.bytes, expected.stateSha256],
    ["native:phase-markers", "phase-markers.json", canonical.phaseMarkers.bytes, expected.phaseMarkersSha256],
    ["native:frames-manifest", "frames.json", canonical.frames.bytes, expected.framesSha256],
  ];
  const stateUrl = new URL(
    ".local/cssoccer/oracle/native/retained/runs/canonical-a/state.jsonl",
    REPO_ROOT,
  );
  const [artifacts, initialState] = await Promise.all([
    Promise.all(specs.map(async ([id, file, bytes, sha256]) => {
      const url = new URL(
        `.local/cssoccer/oracle/native/retained/runs/canonical-a/${file}`,
        REPO_ROOT,
      );
      const checked = await hashFile(url);
      if (checked.bytes !== bytes || checked.sha256 !== sha256) {
        throw new Error(`Retained native artifact ${file} changed from its exact capture binding.`);
      }
      return Object.freeze({ id, bytes, sha256 });
    })),
    readNativeInitialState(stateUrl, contracts),
  ]);
  return Object.freeze({ artifacts: Object.freeze(artifacts), initialState });
}

async function readNativeInitialState(url, contracts) {
  const stream = createReadStream(url, { encoding: "utf8", highWaterMark: 64 * 1024 });
  let buffered = "";
  let header = null;
  const samples = [];
  readChunks:
  for await (const chunk of stream) {
    buffered += chunk;
    let newline;
    while ((newline = buffered.indexOf("\n")) >= 0) {
      const line = buffered.slice(0, newline);
      buffered = buffered.slice(newline + 1);
      if (line.length === 0) continue;
      const record = parseJson(Buffer.from(line), "native state record");
      if (header === null) {
        header = record;
        continue;
      }
      if (record.recordType !== "sample") {
        throw new Error("Native state stream contains a non-sample record after its header.");
      }
      if (record.tick > 0) break readChunks;
      if (record.tick !== 0) throw new Error("Native state stream does not begin at tick zero.");
      samples.push(record);
    }
  }

  const capture = contracts.plan.nativeProfileGate.capture;
  const expectedBindings = {
    scenarioSha256: contracts.bindings.nativeScenarioSha256,
    profileSha256: capture.profileSha256,
    sourceSha256: capture.sourceSha256,
    buildSha256: capture.buildSha256,
    contractSha256: contracts.bindings.nativeFieldContractSha256,
  };
  if (
    header?.schema !== "cssoccer-parity-stream@1"
    || header.recordType !== "header"
    || header.role !== "reference"
    || header.tickRange?.start !== 0
    || header.phases?.length !== 1
    || header.phases[0]?.id !== "post_tick"
    || header.phases[0]?.order !== 0
    || Object.entries(expectedBindings).some(([key, value]) => header.bindings?.[key] !== value)
    || !Array.isArray(header.fields)
    || samples.length !== header.fields.length
    || JSON.stringify(samples.map(({ fieldId }) => fieldId))
      !== JSON.stringify(header.fields.map(({ id }) => id))
  ) {
    throw new Error("Native state tick zero changed from its exact typed field contract.");
  }
  const fieldTypes = new Map(header.fields.map(({ id, valueType }) => [id, valueType]));
  const ids = new Set();
  for (const sample of samples) {
    if (
      sample.schema !== "cssoccer-parity-stream@1"
      || sample.recordType !== "sample"
      || sample.tick !== 0
      || sample.phase !== "post_tick"
      || sample.valueType !== fieldTypes.get(sample.fieldId)
      || ids.has(sample.fieldId)
    ) {
      throw new Error(`Native tick-zero sample ${sample.fieldId ?? "<missing>"} is invalid.`);
    }
    assertTypedNumericBits(sample);
    ids.add(sample.fieldId);
  }
  return deepFreeze({
    schema: "cssoccer-native-initial-state@1",
    tick: 0,
    phase: "post_tick",
    bindings: expectedBindings,
    samples,
  });
}

async function collectSourceArtifacts({
  contracts,
  actorInputNames,
  additionalSourceArtifacts,
  nativeArtifacts,
}) {
  const logical = [
    sourceArtifact("contract:source-data", contracts.sourceDataBytes),
    sourceArtifact("contract:fixture", contracts.fixtureContractBytes),
    sourceArtifact("contract:oracle-source", contracts.oracleContractBytes),
  ];
  const descriptorByFile = new Map([
    ...contracts.sourceData.source.files.map((entry) => [entry.name, entry]),
    ...contracts.sourceData.archives.flatMap((archive) => [archive.data, archive.index])
      .map((entry) => [entry.name, entry]),
    ...EXTRA_SOURCE_INPUTS.map((entry) => [entry.file, entry]),
  ]);
  const required = new Set([
    ...contracts.sourceData.source.files.map(({ name }) => name),
    "DATA.OBJ",
    "3DENG.OBJ",
    "EUROREND.DAT",
    "EUROREND.OFF",
    ...actorInputNames,
  ]);
  for (const file of [...required].sort(compareStrings)) {
    const expected = descriptorByFile.get(file);
    if (!expected) throw new Error(`No exact source-artifact descriptor exists for ${file}.`);
    const bytes = await readFile(new URL(file, SOURCE_ROOT));
    const actual = sourceArtifact(`source:${file}`, bytes);
    if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) {
      throw new Error(`Source artifact ${file} changed from the pinned descriptor.`);
    }
    logical.push(actual);
  }
  logical.push(...additionalSourceArtifacts, ...nativeArtifacts);
  logical.sort((left, right) => compareStrings(left.id, right.id));
  if (new Set(logical.map(({ id }) => id)).size !== logical.length) {
    throw new Error("Prepared fixture source artifact ids are not unique.");
  }
  return Object.freeze(logical);
}

function createPreparedFacts({ contracts, staticDomain, actorDomain, renderDomain }) {
  const fixture = contracts.fixtureContract.fixture;
  return deepFreeze({
    schema: "cssoccer-prepared-fixture-facts@1",
    id: CSSOCCER_PREPARED_FIXTURE_ID,
    status: "ready",
    countries: actorDomain.teamPreparation.teams.map((team) => ({
      country: team.country,
      label: team.label,
      sourceTeamId: team.sourceTeamId,
      nativeTeamSlot: team.nativeTeamSlot,
      sourceRecord: team.sourceRecord,
      identity: team.identity,
      formation: team.formation,
      roster: team.roster,
      kit: team.kit,
    })),
    control: {
      countries: fixture.controlCountries,
      canonicalProfile: fixture.canonicalProfile,
      ownershipSymmetryProfile: fixture.ownershipSymmetryProfile,
      users: fixture.users,
      autoPlayer: fixture.autoPlayer,
    },
    rules: fixture.rules,
    rulesSha256: fixture.rulesSha256,
    timing: fixture.timing,
    timingSha256: fixture.timingSha256,
    seed: fixture.seed,
    seedSha256: fixture.seedSha256,
    sourceFacts: staticDomain.facts,
    teams: actorDomain.teamPreparation,
    actors: projectActorPreparation(actorDomain.actorPreparation),
    animations: projectAnimationTable(actorDomain.animationTable),
    playerHighlight: renderDomain.highlight,
    tactics: actorDomain.tacticsPreparation,
    materials: projectTextureAtlas(actorDomain.textureAtlas),
    mergeMetrics: staticDomain.scene.metrics,
    unsupportedClasses: collectUnsupported(actorDomain),
    bindings: {
      ...contracts.bindings,
      nativeProfileSha256: contracts.plan.nativeProfileGate.capture.profileSha256,
      nativeSourceSha256: contracts.plan.nativeProfileGate.capture.sourceSha256,
      nativeBuildSha256: contracts.plan.nativeProfileGate.capture.buildSha256,
      nativeStateSha256: contracts.plan.nativeProfileGate.capture.stateSha256,
      nativePhaseMarkersSha256: contracts.plan.nativeProfileGate.capture.phaseMarkersSha256,
      nativeFramesSha256: contracts.plan.nativeProfileGate.capture.framesSha256,
    },
  });
}

function projectActorPreparation(preparation) {
  const poseFrameSets = preparation.poseFrameSets;
  return {
    schema: preparation.schema,
    fixtureId: preparation.fixtureId,
    sourceRevision: preparation.sourceRevision,
    counts: preparation.counts,
    actors: preparation.actors,
    models: preparation.models,
    poseFrameSets: {
      blueprint: poseFrameSets.blueprint,
      stateArtifactSha256: poseFrameSets.stateArtifactSha256,
      topologyStableAcrossFrames: poseFrameSets.topologyStableAcrossFrames,
      rootStableAcrossFrames: poseFrameSets.rootStableAcrossFrames,
      runtimeMaySelectPreparedFrame: poseFrameSets.runtimeMaySelectPreparedFrame,
      runtimeMayCreateNodesOrGeometry: poseFrameSets.runtimeMayCreateNodesOrGeometry,
      slots: poseFrameSets.slots.map((slot) => ({
        ...slot,
        frames: slot.frames.map(({ points: _points, models: _models, ...frame }) => frame),
      })),
      preparedFrameLookup: poseFrameSets.preparedFrameLookup,
      preparedFrameIndexBySlotFrame: poseFrameSets.preparedFrameIndexBySlotFrame,
      storageMetrics: poseFrameSets.storageMetrics,
    },
    renderAssets: preparation.renderAssets.map(projectActorRenderAsset),
    rendererAdapter: preparation.rendererAdapter,
    sourceContract: preparation.sourceContract,
    unsupportedClasses: preparation.unsupportedClasses,
  };
}

function projectActorRenderAsset(asset) {
  const {
    frames,
    polygons,
    frameLookup: _frameLookup,
    frameIndexBySlotFrame: _frameIndexBySlotFrame,
    ...metadata
  } = asset;
  if (Array.isArray(frames)) {
    return {
      ...metadata,
      preparedPayloadPath: BUNDLES_PATH,
      frameCount: frames.length,
      polygonCount: frames[0]?.polygons?.length ?? 0,
      firstFrameId: frames[0]?.id ?? null,
      finalFrameId: frames.at(-1)?.id ?? null,
      frameLookup: "actors.poseFrameSets.preparedFrameLookup",
      frameIndexBySlotFrame: "actors.poseFrameSets.preparedFrameIndexBySlotFrame",
    };
  }
  return {
    ...metadata,
    preparedPayloadPath: BUNDLES_PATH,
    polygonCount: polygons.length,
  };
}

function projectAnimationTable(table) {
  return {
    ...table,
    slots: table.slots.map((slot) => ({
      ...slot,
      posePayload: projectAnimationPosePayload(slot.posePayload),
    })),
  };
}

function projectAnimationPosePayload(payload) {
  if (!Array.isArray(payload?.frames)) return payload;
  return {
    ...payload,
    frames: payload.frames.map(({ coordinates: _coordinates, ...frame }) => frame),
  };
}

function projectTextureAtlas(atlas) {
  return {
    ...atlas,
    archives: atlas.archives.map((archive) => ({
      ...archive,
      entries: archive.entries.map((entry) => ({
        ...entry,
        decode: projectTextureDecode(entry.decode),
      })),
    })),
  };
}

function projectTextureDecode(decode) {
  if (Array.isArray(decode?.frames)) {
    return {
      ...decode,
      frames: decode.frames.map(({ indexedPixelsBase64: _indexedPixelsBase64, ...frame }) => frame),
    };
  }
  if (decode && typeof decode === "object") {
    const { sourceBytesBase64: _sourceBytesBase64, ...metadata } = decode;
    return metadata;
  }
  return decode;
}

function createInitialSceneBindings({
  contracts,
  staticDomain,
  actorDomain,
  renderDomain,
  nativeInitialState,
}) {
  const bindings = new Map();
  for (const mesh of staticDomain.scene.meshes) {
    bindings.set(mesh.id, deepFreeze({
      transform: preparedTransform(mesh.transform?.position),
      initialFrameIndex: null,
    }));
  }
  bindings.set(HIGHLIGHT_ROOT_ID, deepFreeze({
    transform: preparedTransform([0, 0, 0]),
    initialFrameIndex: 0,
  }));

  const samplesByField = new Map(
    nativeInitialState.samples.map((sample) => [sample.fieldId, sample]),
  );
  const actors = actorDomain.actorPreparation.actors;
  for (const actor of actors.filter(({ kind }) => kind === "player")) {
    const field = (name, type) => initialNativeValue(
      samplesByField,
      `players.${actor.id}.${name}`,
      type,
    );
    const sourceValues = deepFreeze({
      action: field("action", "i16"),
      animation: field("animation", "u16"),
      animationFrame: field("animation_frame", "f32"),
      nativePlayer: field("native_player", "i16"),
      on: field("on", "i16"),
      stableId: field("stable_id", "string"),
      x: field("x", "f32"),
      xDisplacement: field("x_displacement", "f32"),
      y: field("y", "f32"),
      yDisplacement: field("y_displacement", "f32"),
      z: field("z", "f32"),
    });
    if (
      sourceValues.stableId.value !== actor.id
      || sourceValues.nativePlayer.value !== actor.nativeRuntimeIndex + 1
      || sourceValues.on.value === 0
    ) {
      throw new Error(`Native tick-zero identity or active state changed for ${actor.id}.`);
    }
    const rendererFacing = rendererFacingBinding(
      sourceValues.xDisplacement.value,
      sourceValues.yDisplacement.value,
    );
    const animation = initialAnimationBinding({
      actorId: actor.id,
      slotId: sourceValues.animation.value,
      nativeFrame: sourceValues.animationFrame.value,
      actorDomain,
      renderDomain,
    });
    const transform = preparedTransform(
      [sourceValues.x.value, sourceValues.z.value, -sourceValues.y.value],
      [0, rendererFacing.yawDegrees, 0],
    );
    bindings.set(actor.id, deepFreeze({
      transform,
      initialFrameIndex: animation.preparedFrameIndex,
      rootInitialBinding: {
        status: "exact-native-tick-zero",
        tick: nativeInitialState.tick,
        phase: nativeInitialState.phase,
        sourceValues,
        rendererMapping: {
          position: ["x", "z", "-y"],
          facingSource: ["x_displacement", "y_displacement"],
          facingChain:
            "3D_UPD2 ptr crot then 3DENG crot negation then PolyCSS yaw sign",
          finalObjectFacing: ["x_displacement", "y_displacement"],
        },
        rendererFacing,
        animation,
        lineage: nativeInitialLineage(contracts),
      },
    }));
  }

  for (const [index, actor] of actors.filter(({ kind }) => kind === "official").entries()) {
    const official = officialInitialSource(index, staticDomain);
    if (official.id !== actor.id) {
      throw new Error(`Official source initialization changed identity at slot ${index}.`);
    }
    const sourceValues = deepFreeze({
      animation: sourceFloatValue(`refs[${index}].anim`, 78),
      animationFrame: sourceFloatValue(`refs[${index}].frm`, official.frame),
      directionX: sourceFloatValue(`refs[${index}].dir_x`, 0),
      directionY: sourceFloatValue(`refs[${index}].dir_y`, official.directionY),
      x: sourceFloatValue(`refs[${index}].x`, official.x),
      y: sourceFloatValue(`refs[${index}].y`, official.y),
      z: sourceFloatValue(`refs[${index}].z`, 0),
    });
    const rendererFacing = rendererFacingBinding(
      -sourceValues.directionX.value,
      sourceValues.directionY.value,
    );
    const animation = initialAnimationBinding({
      actorId: actor.id,
      slotId: 78,
      nativeFrame: sourceValues.animationFrame.value,
      actorDomain,
      renderDomain,
    });
    const transform = preparedTransform(
      [sourceValues.x.value, sourceValues.z.value, -sourceValues.y.value],
      [0, rendererFacing.yawDegrees, 0],
    );
    bindings.set(actor.id, deepFreeze({
      transform,
      initialFrameIndex: animation.preparedFrameIndex,
      rootInitialBinding: {
        status: "exact-source-initialization-native-official-fields-unavailable",
        tick: null,
        phase: null,
        sourceValues,
        rendererMapping: {
          position: ["refs.x", "refs.z", "-refs.y"],
          finalObjectFacing: ["-refs.dir_x", "refs.dir_y"],
        },
        rendererFacing,
        animation,
        nativeState: {
          status: "not-published-by-retained-field-contract",
          retainedTick: nativeInitialState.tick,
          retainedPhase: nativeInitialState.phase,
          stateSha256: contracts.plan.nativeProfileGate.capture.stateSha256,
        },
        lineage: officialInitialLineage(contracts),
      },
    }));
  }

  const [ball] = actors.filter(({ kind }) => kind === "ball");
  if (!ball || actors.filter(({ kind }) => kind === "ball").length !== 1) {
    throw new Error("Prepared fixture requires one exact ball actor.");
  }
  const ballValues = deepFreeze({
    x: initialNativeValue(samplesByField, "ball.x", "f32"),
    y: initialNativeValue(samplesByField, "ball.y", "f32"),
    z: initialNativeValue(samplesByField, "ball.z", "f32"),
  });
  bindings.set(ball.id, deepFreeze({
    transform: preparedTransform([ballValues.x.value, ballValues.z.value, -ballValues.y.value]),
    initialFrameIndex: null,
    rootInitialBinding: {
      status: "exact-native-tick-zero-position",
      tick: nativeInitialState.tick,
      phase: nativeInitialState.phase,
      sourceValues: ballValues,
      rendererMapping: { position: ["ball.x", "ball.z", "-ball.y"] },
      orientation: {
        status: "exact-source-model-author-orientation",
        dynamicRotationBound: false,
        nativeRuntimeOrientationBound: false,
        replacementAllowed: false,
      },
      lineage: nativeInitialLineage(contracts),
    },
  }));

  const actorBindings = [...bindings.entries()].filter(([id]) => (
    actors.some((actor) => actor.id === id)
  ));
  if (
    bindings.size !== 36
    || actorBindings.length !== 26
    || new Set(actorBindings.map(([, value]) => value.transform.position.join(","))).size !== 26
  ) {
    throw new Error("Prepared initial scene bindings must place all 36 stable roots without overlap.");
  }
  return bindings;
}

function initialNativeValue(samplesByField, fieldId, valueType) {
  const sample = samplesByField.get(fieldId);
  if (!sample || sample.valueType !== valueType) {
    throw new Error(`Native tick zero is missing typed field ${fieldId}.`);
  }
  return deepFreeze({
    fieldId,
    valueType,
    value: sample.value,
    numericBits: sample.numericBits,
  });
}

function initialAnimationBinding({
  actorId,
  slotId,
  nativeFrame,
  actorDomain,
  renderDomain,
}) {
  const poses = actorDomain.actorPreparation.poseFrameSets;
  const lookup = poses.preparedFrameLookup.find((entry) => entry.slotId === slotId);
  if (!lookup || !Number.isSafeInteger(slotId) || !Number.isFinite(nativeFrame)) {
    throw new Error(`Initial animation ${slotId} for ${actorId} has no retained prepared slot.`);
  }
  const fractionalFrame = nativeFrame - Math.floor(nativeFrame);
  const localFrameIndex = Math.floor(fractionalFrame * lookup.frameCount);
  const preparedFrameIndex = poses.preparedFrameIndexBySlotFrame[`${slotId}:${localFrameIndex}`];
  const renderBinding = renderDomain.rootBindings.find(({ rootId }) => rootId === actorId);
  const frameSet = renderDomain.publication.frameSets.find(
    ({ id }) => id === renderBinding?.frameSetId,
  );
  const exactPlayerSequence = actorDomain.exactPlayerPreparation.packaging.index.sequences.find(
    (sequence) => sequence.slotId === slotId,
  );
  const exactOfficialSequence = actorDomain.exactOfficialPreparation.packaging.index.sequences.find(
    (sequence) => sequence.slotId === slotId,
  );
  const exactPlayerBinding = renderBinding?.bundleId === EXACT_PLAYER_RENDER_BINDING_ID
    && renderBinding.frameSetId === null;
  const exactOfficialBinding = renderBinding?.bundleId === EXACT_OFFICIAL_RENDER_BINDING_ID
    && renderBinding.frameSetId === null;
  if (
    !Number.isSafeInteger(preparedFrameIndex)
    || preparedFrameIndex !== lookup.preparedFrameStart + localFrameIndex
    || preparedFrameIndex < lookup.preparedFrameStart
    || preparedFrameIndex >= lookup.preparedFrameEnd
    || (exactPlayerBinding
      ? exactPlayerSequence?.frameCount !== lookup.frameCount
      : exactOfficialBinding
        ? exactOfficialSequence?.frameCount !== lookup.frameCount
        : !frameSet
          || preparedFrameIndex >= frameSet.frameCount
          || typeof frameSet.frames[preparedFrameIndex]?.id !== "string")
  ) {
    throw new Error(`Initial prepared frame for ${actorId} falls outside its bound frame set.`);
  }
  return deepFreeze({
    slotId,
    nativeFrame,
    fractionalFrame,
    localFrameIndex,
    preparedFrameIndex,
    sourcePosePreparedFrameIndex: preparedFrameIndex,
    preparedFrameId: exactPlayerBinding || exactOfficialBinding
      ? `mc-${String(slotId).padStart(3, "0")}-f-${String(localFrameIndex).padStart(3, "0")}`
      : frameSet.frames[preparedFrameIndex].id,
    frameSetId: exactPlayerBinding || exactOfficialBinding ? null : frameSet.id,
    renderStatus: "prepared-source-bound",
    lookup: {
      sourceSlotId: lookup.sourceSlotId,
      status: lookup.status,
      preparedFrameStart: lookup.preparedFrameStart,
      frameCount: lookup.frameCount,
      preparedFrameEnd: lookup.preparedFrameEnd,
    },
    selectionFormula: "floor(frac(nativeFrame) * resolvedFrameCount)",
  });
}

function rendererFacingBinding(cosine, sine) {
  const yaw = Math.atan2(sine, cosine) * 180 / Math.PI;
  return deepFreeze({
    cosine,
    sine,
    yawDegrees: Object.is(yaw, -0) ? 0 : yaw,
  });
}

function preparedTransform(position, rotation = [0, 0, 0]) {
  if (
    !Array.isArray(position)
    || position.length !== 3
    || position.some((value) => !Number.isFinite(value))
    || !Array.isArray(rotation)
    || rotation.length !== 3
    || rotation.some((value) => !Number.isFinite(value))
  ) {
    throw new Error("Prepared initial transform must contain finite position and rotation vectors.");
  }
  return deepFreeze({ position: [...position], rotation: [...rotation], scale: 1 });
}

function sourceFloatValue(fieldId, value) {
  const sample = {
    fieldId,
    valueType: "f32",
    value: Math.fround(value),
    numericBits: null,
  };
  const bits = Buffer.alloc(4);
  bits.writeFloatBE(sample.value, 0);
  sample.numericBits = bits.toString("hex");
  assertTypedNumericBits(sample);
  return deepFreeze(sample);
}

function officialInitialSource(index, staticDomain) {
  const pitch = staticDomain.facts.pitch;
  const [minimumX, maximumX] = pitch.sourceBounds.x;
  const [minimumY, maximumY] = pitch.sourceBounds.y;
  const unit = pitch.nativeUnitsPerYard;
  if (
    minimumX !== 0
    || maximumX !== 1_280
    || minimumY !== 0
    || maximumY !== 800
    || unit !== 16
  ) {
    throw new Error("Official source initialization requires the exact 1280 by 800 pitch contract.");
  }
  const centerX = (minimumX + maximumX) / 2;
  const centerY = (minimumY + maximumY) / 2;
  return [
    { id: "referee-00", x: centerX, y: centerY, directionY: 1, frame: 0.6 },
    { id: "assistant-referee-01", x: centerX, y: -(unit * 2), directionY: 1, frame: 0 },
    {
      id: "assistant-referee-02",
      x: centerX,
      y: maximumY + unit * 2,
      directionY: -1,
      frame: 0,
    },
  ][index];
}

function nativeInitialLineage(contracts) {
  return deepFreeze({
    authority: "canonical native typed post_tick sample",
    scenarioSha256: contracts.bindings.nativeScenarioSha256,
    fieldContractSha256: contracts.bindings.nativeFieldContractSha256,
    rawSha256: contracts.plan.nativeProfileGate.capture.rawSha256,
    stateSha256: contracts.plan.nativeProfileGate.capture.stateSha256,
  });
}

function officialInitialLineage(contracts) {
  const sourceDescriptor = (file) => {
    const descriptor = contracts.sourceData.source.files.find(({ name }) => name === file)
      ?? EXTRA_SOURCE_INPUTS.find((entry) => entry.file === file);
    if (!descriptor) throw new Error(`Official source lineage is missing ${file}.`);
    return descriptor.sha256;
  };
  return deepFreeze({
    authority: "ACTIONS.CPP init_officials and DATA.H animation ids",
    sourceFiles: [
      {
        id: "source:ACTIONS.CPP",
        sha256: sourceDescriptor("ACTIONS.CPP"),
        lines: [88, 135],
      },
      {
        id: "source:DATA.H",
        sha256: sourceDescriptor("DATA.H"),
        lines: [111, 140],
      },
      {
        id: "source:3D_UPD2.CPP",
        sha256: sourceDescriptor("3D_UPD2.CPP"),
        lines: [1805, 1932],
      },
    ],
  });
}

function createPreparedScene({
  contracts,
  staticDomain,
  actorDomain,
  renderDomain,
  nativeInitialState,
  factsFile,
  bundleFile,
  exactPlayerIndexFile,
  exactPlayerMaterialsFile,
  exactOfficialIndexFile,
  exactOfficialMaterialsFile,
  skyBackdropFile,
}) {
  const actors = actorDomain.actorPreparation.actors;
  const initialBindings = createInitialSceneBindings({
    contracts,
    staticDomain,
    actorDomain,
    renderDomain,
    nativeInitialState,
  });
  const roots = {
    static: staticDomain.scene.roots.static,
    highlights: [deepFreeze({
      id: HIGHLIGHT_ROOT_ID,
      kind: "highlight",
      country: "argentina",
      stableDom: true,
      sourceId: CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT.geometry.sourceName,
      contractSha256: CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT_SHA256,
    })],
    players: actors.filter(({ kind }) => kind === "player")
      .map((actor) => sceneActorRoot(actor, initialBindings.get(actor.id))),
    officials: actors.filter(({ kind }) => kind === "official")
      .map((actor) => sceneActorRoot(actor, initialBindings.get(actor.id))),
    ball: actors.filter(({ kind }) => kind === "ball")
      .map((actor) => sceneActorRoot(actor, initialBindings.get(actor.id))),
  };
  const meshes = [
    ...roots.static.map((root) => sceneMesh(
      root,
      "static",
      renderDomain.rootBindings,
      initialBindings.get(root.id),
    )),
    ...roots.highlights.map((root) => sceneMesh(
      root,
      "highlight",
      renderDomain.rootBindings,
      initialBindings.get(root.id),
    )),
    ...roots.players.map((root) => sceneMesh(
      root,
      "player",
      renderDomain.rootBindings,
      initialBindings.get(root.id),
    )),
    ...roots.officials.map((root) => sceneMesh(
      root,
      "official",
      renderDomain.rootBindings,
      initialBindings.get(root.id),
    )),
    ...roots.ball.map((root) => sceneMesh(
      root,
      "ball",
      renderDomain.rootBindings,
      initialBindings.get(root.id),
    )),
  ];
  validateSceneRootCounts(roots, meshes);
  return deepFreeze({
    schema: CSSOCCER_PREPARED_SCENE_SCHEMA,
    id: CSSOCCER_PREPARED_FIXTURE_ID,
    status: "ready",
    fixture: {
      home: { country: "spain", sourceTeamId: 2 },
      away: { country: "argentina", sourceTeamId: 20 },
      controlCountries: ["spain", "argentina"],
      durationMinutes: 2,
      halfDurationMinutes: 1,
      publiclyConfigurableDuration: false,
    },
    axes: staticDomain.scene.axes,
    dimensions: staticDomain.scene.dimensions,
    cameraAnchor: staticDomain.scene.cameraAnchor,
    backdrop: {
      schema: "cssoccer-prepared-sky-backdrop@1",
      id: "sky-backdrop",
      kind: "sky",
      sourceId: "BM_C1X/COL_C1X",
      stableDom: true,
      asset: {
        path: skyBackdropFile.path,
        sha256: skyBackdropFile.expectedSha256,
        url: `/cssoccer/${skyBackdropFile.path}`,
        width: actorDomain.texturePreparation.metadata.skyBackdrop.width,
        height: actorDomain.texturePreparation.metadata.skyBackdrop.height,
      },
      projection: actorDomain.texturePreparation.metadata.skyBackdrop.projection,
      stadiumDimensions: staticDomain.scene.dimensions.stadiumContext,
      runtimeConstruction: false,
    },
    roots,
    meshes,
    preparedFiles: {
      facts: { path: factsFile.path, sha256: factsFile.expectedSha256 },
      renderBundles: { path: bundleFile.path, sha256: bundleFile.expectedSha256 },
      exactPlayerIndex: {
        path: exactPlayerIndexFile.path,
        sha256: exactPlayerIndexFile.expectedSha256,
      },
      exactPlayerMaterials: {
        path: exactPlayerMaterialsFile.path,
        sha256: exactPlayerMaterialsFile.expectedSha256,
      },
      exactOfficialIndex: {
        path: exactOfficialIndexFile.path,
        sha256: exactOfficialIndexFile.expectedSha256,
      },
      exactOfficialMaterials: {
        path: exactOfficialMaterialsFile.path,
        sha256: exactOfficialMaterialsFile.expectedSha256,
      },
      skyBackdrop: {
        path: skyBackdropFile.path,
        sha256: skyBackdropFile.expectedSha256,
      },
    },
    native: {
      scenarioSha256: contracts.bindings.nativeScenarioSha256,
      fieldContractSha256: contracts.bindings.nativeFieldContractSha256,
      captureSha256: contracts.bindings.nativeCaptureSha256,
      canonicalProfile: contracts.plan.nativeProfileGate.capture.canonicalProfile,
      ticks: contracts.plan.nativeProfileGate.capture.ticks,
      terminalTick: contracts.plan.nativeProfileGate.capture.terminalTick,
      terminalMatchHalf: contracts.plan.nativeProfileGate.capture.terminalMatchHalf,
      initialState: {
        status: "ready",
        tick: nativeInitialState.tick,
        phase: nativeInitialState.phase,
        rawSha256: contracts.plan.nativeProfileGate.capture.rawSha256,
        stateSha256: contracts.plan.nativeProfileGate.capture.stateSha256,
        playerBindings: roots.players.length,
        ballBindings: roots.ball.length,
        officialBindings: {
          status: "exact-source-initialization-native-fields-unavailable",
          count: roots.officials.length,
          renderStatus: "prepared-source-bound",
        },
      },
    },
    metrics: {
      ...staticDomain.scene.metrics,
      staticRootCount: roots.static.length,
      highlightRootCount: roots.highlights.length,
      playerRootCount: roots.players.length,
      officialRootCount: roots.officials.length,
      exactOfficialRootCount: roots.officials.length,
      ballRootCount: roots.ball.length,
      skyBackdropRootCount: 1,
      stableRootCount: meshes.filter(({ stableDom }) => stableDom).length + 1,
      renderBundleCount: renderDomain.publication.counts?.bundles,
      renderLeafCount: renderDomain.publication.counts?.leaves,
    },
    runtimeConstruction: {
      sourceParseCount: 0,
      geometryBuildCount: 0,
      topologyBuildCount: 0,
      materialBuildCount: 0,
      atlasBuildCount: 0,
      assetBuildCount: 0,
    },
  });
}

function createPreparedManifest({ contracts, request }) {
  return deepFreeze({
    schema: CSSOCCER_PREPARED_MANIFEST_SCHEMA,
    status: "ready",
    defaultScene: { id: CSSOCCER_PREPARED_FIXTURE_ID, sceneUrl: request.sceneUrl },
    scenes: [{ id: CSSOCCER_PREPARED_FIXTURE_ID, sceneUrl: request.sceneUrl }],
    fixture: {
      home: { country: "spain", label: "Spain", sourceTeamId: 2 },
      away: { country: "argentina", label: "Argentina", sourceTeamId: 20 },
      controlCountries: ["spain", "argentina"],
      durationMinutes: 2,
      halfDurationMinutes: 1,
      publiclyConfigurableDuration: false,
    },
    bindings: { ...contracts.bindings },
  });
}

function preparedJsonFile({ path, json, sourceIds, lineage, references = [] }) {
  const expectedSha256 = sha256Hex(canonicalJsonBytes(json));
  return deepFreeze({
    path,
    mediaType: "application/json",
    json,
    expectedSha256,
    lineage: { ...lineage, sourceIds: [...sourceIds].sort(compareStrings) },
    references,
  });
}

function preparedBinaryFile({
  path,
  mediaType,
  bytes,
  expectedSha256,
  sourceIds,
  lineage,
  references = [],
}) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError(`Prepared binary file ${path} must contain bytes.`);
  }
  if (sha256Hex(bytes) !== expectedSha256) {
    throw new Error(`Prepared binary file ${path} changed after atlas construction.`);
  }
  return Object.freeze({
    path,
    mediaType,
    bytes,
    expectedSha256,
    lineage: { ...lineage, sourceIds: [...sourceIds].sort(compareStrings) },
    references,
  });
}

function referenceFor(file) {
  return Object.freeze({ path: file.path, sha256: file.expectedSha256 });
}

function sceneActorRoot(actor, initial) {
  if (!initial?.rootInitialBinding) {
    throw new Error(`Prepared actor ${actor.id} has no exact initial binding.`);
  }
  return deepFreeze({
    id: actor.id,
    kind: actor.kind,
    country: actor.country,
    nativeRuntimeIndex: actor.nativeRuntimeIndex,
    nativeRendererIndex: actor.nativeRendererIndex,
    stableDom: actor.root?.stable === true,
    modelId: actor.model?.modelId,
    materialId: actor.material?.id
      ?? actor.material?.materialProfileId
      ?? actor.material?.sourceTeamSlot
      ?? null,
    sourceId: actor.lineage?.teamStarterId
      ?? actor.lineage?.faceListSymbol
      ?? actor.lineage?.pointListSymbol,
    initialBinding: initial.rootInitialBinding,
  });
}

function sceneMesh(root, kind, rootBindings, initial) {
  const binding = rootBindings?.find?.(({ rootId }) => rootId === root.id);
  if (!binding) throw new Error(`Prepared render bundles do not bind scene root ${root.id}.`);
  if (!initial?.transform || initial.initialFrameIndex === undefined) {
    throw new Error(`Prepared scene root ${root.id} has no initial transform contract.`);
  }
  const exactOfficial = kind === "official"
    && binding.bundleId === EXACT_OFFICIAL_RENDER_BINDING_ID
    && binding.frameSetId === null;
  if (kind === "official" && !exactOfficial) {
    throw new Error(`Prepared official ${root.id} has no exact one-basis binding.`);
  }
  return deepFreeze({
    id: root.id,
    kind,
    stableDom: true,
    bundleId: binding.bundleId,
    frameSetId: binding.frameSetId ?? null,
    renderStatus: "prepared-source-bound",
    reasonCode: null,
    transform: initial.transform,
    initialFrameIndex: kind === "player" || exactOfficial
      ? null
      : initial.initialFrameIndex,
  });
}

function validateSceneRootCounts(roots, meshes) {
  const players = meshes.filter(({ kind }) => kind === "player");
  const people = meshes.filter(({ kind }) => kind === "player" || kind === "official");
  const highlights = meshes.filter(({ kind }) => kind === "highlight");
  const ball = meshes.find(({ kind }) => kind === "ball");
  if (
    roots.static.length !== 9
    || roots.highlights.length !== 1
    || roots.players.length !== 22
    || roots.officials.length !== 3
    || roots.ball.length !== 1
    || meshes.length !== 36
    || roots.highlights.some(({ stableDom }) => stableDom !== true)
    || roots.players.some(({ stableDom }) => stableDom !== true)
    || roots.officials.some(({ stableDom }) => stableDom !== true)
    || roots.ball.some(({ stableDom }) => stableDom !== true)
    || meshes.some(({ transform }) => (
      !Array.isArray(transform?.position)
      || transform.position.length !== 3
      || transform.position.some((value) => !Number.isFinite(value))
      || !Array.isArray(transform.rotation)
      || transform.rotation.length !== 3
      || transform.rotation.some((value) => !Number.isFinite(value))
      || transform.scale !== 1
    ))
    || players.some(({ initialFrameIndex }) => initialFrameIndex !== null)
    || people.filter(({ kind }) => kind === "official")
      .some(({ stableDom, bundleId, frameSetId, initialFrameIndex, renderStatus, reasonCode }) => (
        stableDom !== true
        || bundleId !== EXACT_OFFICIAL_RENDER_BINDING_ID
        || frameSetId !== null
        || initialFrameIndex !== null
        || renderStatus !== "prepared-source-bound"
        || reasonCode !== null
      ))
    || highlights.some(({ initialFrameIndex }) => initialFrameIndex !== 0)
    || meshes.filter(({ kind }) => kind === "static" || kind === "ball")
      .some(({ initialFrameIndex }) => initialFrameIndex !== null)
    || new Set(players.map(({ transform }) => transform.position.join(","))).size !== 22
    || JSON.stringify(ball?.transform?.position) !== "[640,2,-400]"
  ) {
    throw new Error("Prepared scene must render every source-bound player, official, and ball root.");
  }
}

function collectUnsupported(actorDomain) {
  return [
    ...(actorDomain.teamPreparation.unsupportedClasses ?? []),
    ...(actorDomain.actorPreparation.unsupportedClasses ?? []),
    ...(actorDomain.animationTable.unsupportedClasses ?? []),
    ...(actorDomain.textureAtlas.unsupportedClasses ?? []),
  ];
}

async function readSourceInputs(files) {
  const entries = await Promise.all(files.map(async (file) => [file, await readFile(new URL(file, SOURCE_ROOT))]));
  return new Map(entries);
}

function sourceArtifact(id, bytes) {
  return Object.freeze({ id, bytes: bytes.byteLength, sha256: sha256Hex(bytes) });
}

async function hashFile(url) {
  const status = await stat(url);
  if (!status.isFile()) throw new Error("Native retained artifact is not a regular file.");
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(url)) hash.update(chunk);
  return Object.freeze({ bytes: status.size, sha256: hash.digest("hex") });
}

function assertTypedNumericBits({ fieldId, valueType, value, numericBits }) {
  if (valueType === "string") {
    if (typeof value !== "string" || numericBits !== null) {
      throw new Error(`Native string sample ${fieldId} changed its typed representation.`);
    }
    return;
  }
  const specs = {
    f32: [4, "writeFloatBE"],
    i8: [1, "writeInt8"],
    i16: [2, "writeInt16BE"],
    i32: [4, "writeInt32BE"],
    u8: [1, "writeUInt8"],
    u16: [2, "writeUInt16BE"],
    u32: [4, "writeUInt32BE"],
  };
  const spec = specs[valueType];
  if (!spec || !Number.isFinite(value)) {
    throw new Error(`Native sample ${fieldId} has unsupported typed value ${valueType}.`);
  }
  const bytes = Buffer.alloc(spec[0]);
  bytes[spec[1]](value, 0);
  if (numericBits !== bytes.toString("hex")) {
    throw new Error(`Native sample ${fieldId} changed its exact numeric bits.`);
  }
}

function validateAssemblyRequest(request) {
  if (
    request === null
    || typeof request !== "object"
    || Array.isArray(request)
    || Object.getPrototypeOf(request) !== Object.prototype
  ) {
    throw new TypeError("cssoccer fixture assembly request must be a plain object.");
  }
  const keys = Object.keys(request).sort(compareStrings);
  if (JSON.stringify(keys) !== JSON.stringify([...REQUEST_KEYS].sort(compareStrings))) {
    throw new Error(`cssoccer fixture assembly request requires exactly: ${REQUEST_KEYS.join(", ")}.`);
  }
  if (
    request.schema !== "cssoccer-prepared-assembly-request@1"
    || request.fixtureId !== CSSOCCER_PREPARED_FIXTURE_ID
    || request.scenePath !== SCENE_PATH
    || request.sceneUrl !== CSSOCCER_PREPARED_SCENE_URL
  ) {
    throw new Error("cssoccer fixture assembly request changed the canonical prepared route.");
  }
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`Could not parse ${label}.`, { cause: error });
  }
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
