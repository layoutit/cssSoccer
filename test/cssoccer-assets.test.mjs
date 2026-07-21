import assert from "node:assert/strict";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  CSSOCCER_PREPARED_FIXTURE_ID,
  validateCssoccerPreparedManifest,
} from "../src/prepare/cssoccer/manifestContract.mjs";
import {
  CSSOCCER_PREPARED_ASSEMBLY_REQUEST,
  prepareCssoccer,
} from "../src/prepare/cssoccer/prepare.mjs";
import {
  CSSOCCER_ASSEMBLED_FIXTURE_SCHEMA,
  canonicalJsonBytes,
  sha256Hex,
} from "../src/prepare/cssoccer/provenance.mjs";
import {
  CssoccerPrepareDeterminismError,
  checkCssoccerPrepareDeterminism,
  compareCssoccerPreparedPublications,
} from "../tools/check-prepare-determinism.mjs";

const HASH = "ab".repeat(32);
const SOURCE_BYTES = Buffer.from("synthetic private Actua input", "utf8");
const TEXTURE_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4////fwAJ+wP99djxmgAAAABJRU5ErkJggg==",
  "base64",
);
const SOURCE_ARTIFACT = Object.freeze({
  id: "synthetic-fixture-source",
  bytes: SOURCE_BYTES.byteLength,
  sha256: sha256Hex(SOURCE_BYTES),
});

test("canonical publication produces stable bytes, hashes, and lineage", async (t) => {
  const temporary = await temporaryDirectory(t);
  const leftRoot = join(temporary, "left");
  const rightRoot = join(temporary, "right");

  const leftReport = await prepareCssoccer({
    assembledFixture: fixture({ reverseOrder: false }),
    outputRoot: leftRoot,
  });
  const rightReport = await prepareCssoccer({
    assembleFixture(request) {
      assert.equal(request, CSSOCCER_PREPARED_ASSEMBLY_REQUEST);
      assert.ok(Object.isFrozen(request));
      return fixture({ reverseOrder: true });
    },
    outputRoot: rightRoot,
  });
  const compared = await compareCssoccerPreparedPublications(leftRoot, rightRoot);

  assert.equal(compared.status, "pass");
  assert.equal(compared.treeSha256, leftReport.treeSha256);
  assert.equal(rightReport.treeSha256, leftReport.treeSha256);
  assert.equal(leftReport.fileCount, 17);

  const manifestBytes = await readFile(join(leftRoot, "manifest.json"));
  const provenanceBytes = await readFile(join(leftRoot, "provenance.json"));
  const manifest = JSON.parse(manifestBytes);
  const provenance = JSON.parse(provenanceBytes);
  validateCssoccerPreparedManifest(manifest);
  assert.equal(manifest.bindings.prepareInputsSha256, provenance.prepareInputsSha256);
  assert.equal(manifest.provenance.sha256, sha256Hex(provenanceBytes));
  assert.equal(manifest.defaultScene.sha256, manifest.scenes[0].sha256);
  assert.deepEqual(
    manifest.preparedFiles.map(({ path }) => path),
    [
      "assets/animation/exact-official/index.json",
      "assets/animation/exact-player/index.json",
      "assets/spain-argentina-exact-official-materials.json",
      "assets/spain-argentina-exact-player-materials.json",
      "assets/synthetic-atlas.bin",
      "assets/textures/spain-argentina-exact-official-materials.png",
      "assets/textures/spain-argentina-exact-player-materials.png",
      "assets/textures/spain-argentina-hud-glyphs.png",
      "assets/textures/spain-argentina-marking-pixel.png",
      "assets/textures/spain-argentina-match.png",
      "assets/textures/spain-argentina-pitch.png",
      "assets/textures/spain-argentina-sky.png",
      "assets/textures/spain-argentina-stadium.png",
      "facts/synthetic-team.json",
      "scenes/spain-argentina-full-match.json",
    ],
  );
  for (const descriptor of manifest.preparedFiles) {
    const bytes = await readFile(join(leftRoot, ...descriptor.path.split("/")));
    assert.equal(bytes.byteLength, descriptor.bytes);
    assert.equal(sha256Hex(bytes), descriptor.sha256);
  }
  assert.doesNotMatch(manifestBytes.toString("utf8"), /\/Users\//u);
  assert.doesNotMatch(provenanceBytes.toString("utf8"), /\.local\//u);
});

test("publication rejects missing references and mismatched hashes or lineage", async (t) => {
  const temporary = await temporaryDirectory(t);

  const ownHashMismatch = fixture();
  ownHashMismatch.files[0].expectedSha256 = "00".repeat(32);
  await assert.rejects(
    prepareCssoccer({ assembledFixture: ownHashMismatch, outputRoot: join(temporary, "own-hash") }),
    /SHA-256 mismatch/u,
  );

  const missingReference = fixture();
  missingReference.files.find(({ path }) => path.startsWith("scenes/")).references[0].path =
    "facts/missing.json";
  await assert.rejects(
    prepareCssoccer({ assembledFixture: missingReference, outputRoot: join(temporary, "missing") }),
    /references missing output/u,
  );

  const referenceHashMismatch = fixture();
  referenceHashMismatch.files.find(({ path }) => path.startsWith("scenes/")).references[0].sha256 =
    "00".repeat(32);
  await assert.rejects(
    prepareCssoccer({ assembledFixture: referenceHashMismatch, outputRoot: join(temporary, "ref-hash") }),
    /reference hash mismatch/u,
  );

  const unknownLineage = fixture();
  unknownLineage.files[0].lineage.sourceIds = ["not-declared"];
  await assert.rejects(
    prepareCssoccer({ assembledFixture: unknownLineage, outputRoot: join(temporary, "lineage") }),
    /unknown source artifact id/u,
  );

  const wrongBinding = fixture();
  wrongBinding.manifest.bindings.prepareInputsSha256 = "00".repeat(32);
  await assert.rejects(
    prepareCssoccer({ assembledFixture: wrongBinding, outputRoot: join(temporary, "binding") }),
    /does not match canonical source lineage/u,
  );

  assert.deepEqual(await readdir(temporary), []);
});

test("publication rejects traversal, local paths, and original source/data copies", async (t) => {
  const temporary = await temporaryDirectory(t);

  const traversal = fixture();
  traversal.files[0].path = "../escape.bin";
  await assert.rejects(
    prepareCssoccer({ assembledFixture: traversal, outputRoot: join(temporary, "traversal") }),
    /canonical browser-relative path|traversal segment/u,
  );

  const localPath = fixture();
  localPath.files.find(({ path }) => path.startsWith("facts/")).json.localPath =
    "/Users/test/.local/actua/EURO.DAT";
  await assert.rejects(
    prepareCssoccer({ assembledFixture: localPath, outputRoot: join(temporary, "local") }),
    /leaks a macOS home path/u,
  );

  const originalPath = fixture();
  originalPath.files.push({
    path: "assets/ORIGINAL.DAT",
    mediaType: "application/octet-stream",
    bytes: Uint8Array.from([1, 2, 3]),
    lineage: lineage(),
  });
  await assert.rejects(
    prepareCssoccer({ assembledFixture: originalPath, outputRoot: join(temporary, "original-path") }),
    /may not publish an original source\/data file/u,
  );

  const wholesaleCopy = fixture();
  wholesaleCopy.files.push({
    path: "assets/copied-source.bin",
    mediaType: "application/octet-stream",
    bytes: SOURCE_BYTES,
    lineage: lineage(),
  });
  await assert.rejects(
    prepareCssoccer({ assembledFixture: wholesaleCopy, outputRoot: join(temporary, "copy") }),
    /copies an original source\/data artifact wholesale/u,
  );

  const localLineage = fixture();
  localLineage.files[0].lineage.input = ".local/actua/EURO.DAT";
  await assert.rejects(
    prepareCssoccer({ assembledFixture: localLineage, outputRoot: join(temporary, "local-lineage") }),
    /leaks an ignored local path/u,
  );

  assert.deepEqual(await readdir(temporary), []);
});

test("transactional replacement preserves the old tree on failure and cleans staging", async (t) => {
  const temporary = await temporaryDirectory(t);
  const outputRoot = join(temporary, "published");

  await prepareCssoccer({
    assembledFixture: fixture({ version: "old" }),
    outputRoot,
  });
  const oldManifest = await readFile(join(outputRoot, "manifest.json"));
  await writeFile(join(outputRoot, "old-only.txt"), "old\n", "utf8");

  await assert.rejects(
    prepareCssoccer({
      assembledFixture: fixture({ version: "new" }),
      outputRoot,
      async beforeCommit({ stagingRoot, manifestPath }) {
        assert.equal(manifestPath, join(stagingRoot, "manifest.json"));
        await access(manifestPath);
        throw new Error("synthetic precommit failure");
      },
    }),
    /synthetic precommit failure/u,
  );
  assert.deepEqual(await readFile(join(outputRoot, "manifest.json")), oldManifest);
  assert.equal(await readFile(join(outputRoot, "old-only.txt"), "utf8"), "old\n");
  assert.deepEqual(publicationResidue(await readdir(temporary)), []);

  await prepareCssoccer({
    assembledFixture: fixture({ version: "new" }),
    outputRoot,
  });
  assert.notDeepEqual(await readFile(join(outputRoot, "manifest.json")), oldManifest);
  await assert.rejects(access(join(outputRoot, "old-only.txt")), { code: "ENOENT" });
  assert.deepEqual(publicationResidue(await readdir(temporary)), []);
});

test("the determinism gate uses two isolated temporary publications and fails on byte drift", async (t) => {
  const temporary = await temporaryDirectory(t);
  const stableParent = join(temporary, "stable");
  const driftingParent = join(temporary, "drifting");
  await Promise.all([
    mkdir(stableParent),
    mkdir(driftingParent),
  ]);

  const stable = await checkCssoccerPrepareDeterminism({
    assembledFixture: fixture(),
    temporaryParent: stableParent,
  });
  assert.equal(stable.status, "pass");
  assert.equal(stable.fileCount, 17);
  assert.deepEqual(await readdir(stableParent), []);

  let run = 0;
  await assert.rejects(
    checkCssoccerPrepareDeterminism({
      assembleFixture() {
        run += 1;
        return fixture({ version: `run-${run}` });
      },
      temporaryParent: driftingParent,
    }),
    CssoccerPrepareDeterminismError,
  );
  assert.equal(run, 2);
  assert.deepEqual(await readdir(driftingParent), []);
});

function fixture({ version = "stable", reverseOrder = false } = {}) {
  const atlasBytes = Uint8Array.from([0x43, 0x53, 0x53, version.length, 0, 1, 2, 3]);
  const atlasSha256 = sha256Hex(atlasBytes);
  const textureSha256 = sha256Hex(TEXTURE_BYTES);
  const facts = reverseOrder
    ? { teams: [2, 20], version, schema: "synthetic-prepared-facts@1" }
    : { schema: "synthetic-prepared-facts@1", version, teams: [2, 20] };
  const factsSha256 = sha256Hex(canonicalJsonBytes(facts));
  const exactIndex = { schema: "synthetic-exact-player-index@1", version };
  const exactMaterials = { schema: "synthetic-exact-player-materials@1", version };
  const exactOfficialIndex = { schema: "synthetic-exact-official-index@1", version };
  const exactOfficialMaterials = { schema: "synthetic-exact-official-materials@1", version };
  const exactIndexSha256 = sha256Hex(canonicalJsonBytes(exactIndex));
  const exactMaterialsSha256 = sha256Hex(canonicalJsonBytes(exactMaterials));
  const exactOfficialIndexSha256 = sha256Hex(canonicalJsonBytes(exactOfficialIndex));
  const exactOfficialMaterialsSha256 = sha256Hex(canonicalJsonBytes(exactOfficialMaterials));
  const scene = syntheticScene({
    atlasSha256,
    exactIndexSha256,
    exactMaterialsSha256,
    exactOfficialIndexSha256,
    exactOfficialMaterialsSha256,
    factsSha256,
    skySha256: textureSha256,
    reverseOrder,
  });
  const sceneSha256 = sha256Hex(canonicalJsonBytes(scene));

  const files = [
    {
      path: "assets/animation/exact-player/index.json",
      mediaType: "application/json",
      json: exactIndex,
      expectedSha256: exactIndexSha256,
      lineage: lineage(reverseOrder),
    },
    {
      path: "assets/spain-argentina-exact-player-materials.json",
      mediaType: "application/json",
      json: exactMaterials,
      expectedSha256: exactMaterialsSha256,
      lineage: lineage(reverseOrder),
    },
    {
      path: "assets/animation/exact-official/index.json",
      mediaType: "application/json",
      json: exactOfficialIndex,
      expectedSha256: exactOfficialIndexSha256,
      lineage: lineage(reverseOrder),
    },
    {
      path: "assets/spain-argentina-exact-official-materials.json",
      mediaType: "application/json",
      json: exactOfficialMaterials,
      expectedSha256: exactOfficialMaterialsSha256,
      lineage: lineage(reverseOrder),
    },
    {
      path: "assets/synthetic-atlas.bin",
      mediaType: "application/octet-stream",
      bytes: atlasBytes,
      expectedSha256: atlasSha256,
      lineage: lineage(reverseOrder),
    },
    {
      path: "assets/textures/spain-argentina-exact-player-materials.png",
      mediaType: "image/png",
      bytes: TEXTURE_BYTES,
      expectedSha256: textureSha256,
      lineage: lineage(reverseOrder),
    },
    {
      path: "assets/textures/spain-argentina-exact-official-materials.png",
      mediaType: "image/png",
      bytes: TEXTURE_BYTES,
      expectedSha256: textureSha256,
      lineage: lineage(reverseOrder),
    },
    {
      path: "assets/textures/spain-argentina-hud-glyphs.png",
      mediaType: "image/png",
      bytes: TEXTURE_BYTES,
      expectedSha256: textureSha256,
      lineage: lineage(reverseOrder),
    },
    {
      path: "assets/textures/spain-argentina-match.png",
      mediaType: "image/png",
      bytes: TEXTURE_BYTES,
      expectedSha256: textureSha256,
      lineage: lineage(reverseOrder),
    },
    {
      path: "assets/textures/spain-argentina-marking-pixel.png",
      mediaType: "image/png",
      bytes: TEXTURE_BYTES,
      expectedSha256: textureSha256,
      lineage: lineage(reverseOrder),
    },
    {
      path: "assets/textures/spain-argentina-pitch.png",
      mediaType: "image/png",
      bytes: TEXTURE_BYTES,
      expectedSha256: textureSha256,
      lineage: lineage(reverseOrder),
    },
    {
      path: "assets/textures/spain-argentina-sky.png",
      mediaType: "image/png",
      bytes: TEXTURE_BYTES,
      expectedSha256: textureSha256,
      lineage: lineage(reverseOrder),
    },
    {
      path: "assets/textures/spain-argentina-stadium.png",
      mediaType: "image/png",
      bytes: TEXTURE_BYTES,
      expectedSha256: textureSha256,
      lineage: lineage(reverseOrder),
    },
    {
      path: "facts/synthetic-team.json",
      mediaType: "application/json",
      json: facts,
      expectedSha256: factsSha256,
      lineage: lineage(reverseOrder),
    },
    {
      path: "scenes/spain-argentina-full-match.json",
      mediaType: "application/json",
      json: scene,
      expectedSha256: sceneSha256,
      references: reverseOrder
        ? [
          {
            path: "assets/spain-argentina-exact-player-materials.json",
            sha256: exactMaterialsSha256,
          },
          {
            path: "assets/animation/exact-player/index.json",
            sha256: exactIndexSha256,
          },
          {
            path: "assets/spain-argentina-exact-official-materials.json",
            sha256: exactOfficialMaterialsSha256,
          },
          {
            path: "assets/animation/exact-official/index.json",
            sha256: exactOfficialIndexSha256,
          },
          { path: "facts/synthetic-team.json", sha256: factsSha256 },
          { path: "assets/synthetic-atlas.bin", sha256: atlasSha256 },
          {
            path: "assets/textures/spain-argentina-sky.png",
            sha256: textureSha256,
          },
        ]
        : [
          { path: "assets/synthetic-atlas.bin", sha256: atlasSha256 },
          { path: "facts/synthetic-team.json", sha256: factsSha256 },
          {
            path: "assets/animation/exact-player/index.json",
            sha256: exactIndexSha256,
          },
          {
            path: "assets/spain-argentina-exact-player-materials.json",
            sha256: exactMaterialsSha256,
          },
          {
            path: "assets/animation/exact-official/index.json",
            sha256: exactOfficialIndexSha256,
          },
          {
            path: "assets/spain-argentina-exact-official-materials.json",
            sha256: exactOfficialMaterialsSha256,
          },
          {
            path: "assets/textures/spain-argentina-sky.png",
            sha256: textureSha256,
          },
        ],
      lineage: lineage(reverseOrder),
    },
  ];
  if (reverseOrder) files.reverse();

  return {
    schema: CSSOCCER_ASSEMBLED_FIXTURE_SCHEMA,
    sourceArtifacts: [{ ...SOURCE_ARTIFACT }],
    files,
    manifest: manifest(reverseOrder),
  };
}

function manifest(reverseOrder) {
  const bindings = {
    sourceDataSha256: HASH,
    fixtureContractSha256: HASH,
    nativeScenarioSha256: HASH,
    nativeFieldContractSha256: HASH,
    nativeCaptureSha256: HASH,
  };
  const base = {
    schema: "cssoccer-prepared-manifest@1",
    status: "ready",
    defaultScene: {
      id: CSSOCCER_PREPARED_FIXTURE_ID,
      sceneUrl: "/cssoccer/scenes/spain-argentina-full-match.json",
    },
    scenes: [{
      id: CSSOCCER_PREPARED_FIXTURE_ID,
      sceneUrl: "/cssoccer/scenes/spain-argentina-full-match.json",
    }],
    fixture: {
      home: { country: "spain", label: "Spain", sourceTeamId: 2 },
      away: { country: "argentina", label: "Argentina", sourceTeamId: 20 },
      controlCountries: ["spain", "argentina"],
      durationMinutes: 2,
      halfDurationMinutes: 1,
      publiclyConfigurableDuration: false,
    },
    bindings,
  };
  return reverseOrder
    ? {
      bindings: base.bindings,
      fixture: base.fixture,
      scenes: base.scenes,
      defaultScene: base.defaultScene,
      status: base.status,
      schema: base.schema,
    }
    : base;
}

function syntheticScene({
  atlasSha256,
  exactIndexSha256,
  exactMaterialsSha256,
  exactOfficialIndexSha256,
  exactOfficialMaterialsSha256,
  factsSha256,
  skySha256,
  reverseOrder,
}) {
  const roots = {
    static: Array.from({ length: 9 }, (_, index) => ({
      id: `static-${String(index + 1).padStart(2, "0")}`,
      kind: "prepared-static",
      stableDom: true,
    })),
    highlights: [{
      id: "player-highlight-local-user-1",
      kind: "highlight",
      stableDom: true,
    }],
    players: ["spain", "argentina"].flatMap((country) => (
      Array.from({ length: 11 }, (_, index) => ({
        id: `${country}-player-${String(index + 1).padStart(2, "0")}`,
        kind: "player",
        country,
        stableDom: true,
      }))
    )),
    officials: Array.from({ length: 3 }, (_, index) => ({
      id: `official-${String(index + 1).padStart(2, "0")}`,
      kind: "official",
      stableDom: true,
    })),
    ball: [{ id: "ball-00", kind: "ball", stableDom: true }],
  };
  const transform = (position) => ({ position, rotation: [0, 0, 0], scale: 1 });
  const meshes = [
    ...roots.static.map((root, index) => ({
      id: root.id,
      kind: "static",
      stableDom: true,
      bundleId: "bundle-static",
      frameSetId: null,
      transform: transform([index, 0, 0]),
      initialFrameIndex: null,
    })),
    {
      id: "player-highlight-local-user-1",
      kind: "highlight",
      stableDom: true,
      bundleId: "player-highlight-marker",
      frameSetId: "player-highlight-marker",
      transform: transform([0, 0, 0]),
      initialFrameIndex: 0,
    },
    ...roots.players.map((root, index) => ({
      id: root.id,
      kind: "player",
      stableDom: true,
      bundleId: "exact-actua-player-one-basis",
      frameSetId: null,
      transform: transform([100 + index, 0, -100 - index]),
      initialFrameIndex: null,
    })),
    ...roots.officials.map((root, index) => ({
      id: root.id,
      kind: "official",
      stableDom: true,
      bundleId: "exact-actua-official-one-basis",
      frameSetId: null,
      transform: transform([600 + index, 0, -400]),
      initialFrameIndex: null,
    })),
    {
      id: "ball-00",
      kind: "ball",
      stableDom: true,
      bundleId: "bundle-ball",
      frameSetId: null,
      transform: transform([640, 2, -400]),
      initialFrameIndex: null,
    },
  ];
  const base = {
    schema: "cssoccer-prepared-match-scene@1",
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
    axes: { coordinateSpace: "Actua renderer world", verticalAxis: "y" },
    dimensions: { stadiumContext: { st_w: 190, st_l: 190, st_h: 290 } },
    cameraAnchor: { target: [640, 0, -400], playingFieldCenter: [640, 0, -400] },
    backdrop: {
      schema: "cssoccer-prepared-sky-backdrop@1",
      id: "sky-backdrop",
      kind: "sky",
      sourceId: "BM_C1X/COL_C1X",
      stableDom: true,
      asset: {
        path: "assets/textures/spain-argentina-sky.png",
        url: "/cssoccer/assets/textures/spain-argentina-sky.png",
        width: 640,
        height: 480,
        sha256: skySha256,
      },
      projection: {
        schema: "cssoccer-native-sky-projection@1",
        sourceFile: "3DENG.C",
        sourceRoutine: "ground",
        horizontalRepeat: true,
      },
      stadiumDimensions: { st_w: 190, st_l: 190, st_h: 290 },
      runtimeConstruction: false,
    },
    roots,
    meshes,
    preparedFiles: {
      facts: { path: "facts/synthetic-team.json", sha256: factsSha256 },
      renderBundles: { path: "assets/synthetic-atlas.bin", sha256: atlasSha256 },
      exactPlayerIndex: {
        path: "assets/animation/exact-player/index.json",
        sha256: exactIndexSha256,
      },
      exactPlayerMaterials: {
        path: "assets/spain-argentina-exact-player-materials.json",
        sha256: exactMaterialsSha256,
      },
      exactOfficialIndex: {
        path: "assets/animation/exact-official/index.json",
        sha256: exactOfficialIndexSha256,
      },
      exactOfficialMaterials: {
        path: "assets/spain-argentina-exact-official-materials.json",
        sha256: exactOfficialMaterialsSha256,
      },
      skyBackdrop: {
        path: "assets/textures/spain-argentina-sky.png",
        sha256: skySha256,
      },
    },
    native: {
      scenarioSha256: HASH,
      fieldContractSha256: HASH,
      captureSha256: HASH,
      initialState: {
        status: "ready",
        tick: 0,
        phase: "post_tick",
        rawSha256: HASH,
        stateSha256: HASH,
        playerBindings: 22,
        ballBindings: 1,
      },
    },
    metrics: {
      staticRootCount: 9,
      highlightRootCount: 1,
      playerRootCount: 22,
      officialRootCount: 3,
      exactOfficialRootCount: 3,
      ballRootCount: 1,
      skyBackdropRootCount: 1,
      stableRootCount: 37,
      mergeLossless: true,
    },
    runtimeConstruction: {
      sourceParseCount: 0,
      geometryBuildCount: 0,
      topologyBuildCount: 0,
      materialBuildCount: 0,
      atlasBuildCount: 0,
      assetBuildCount: 0,
    },
  };
  return reverseOrder ? Object.fromEntries(Object.entries(base).reverse()) : base;
}

function lineage(reverseOrder = false) {
  return reverseOrder
    ? { spans: [{ bytes: 4, offset: 0 }], producer: "synthetic-test", sourceIds: [SOURCE_ARTIFACT.id] }
    : { sourceIds: [SOURCE_ARTIFACT.id], producer: "synthetic-test", spans: [{ offset: 0, bytes: 4 }] };
}

function publicationResidue(names) {
  return names.filter((name) => (
    name.includes(".stage-")
    || name.includes(".backup-")
    || name.endsWith(".publish-lock")
  ));
}

async function temporaryDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), "cssoccer-assets-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
