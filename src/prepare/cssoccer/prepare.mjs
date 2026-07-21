import {
  CSSOCCER_PREPARED_FIXTURE_ID,
  CSSOCCER_PREPARED_SCENE_URL,
  validateCssoccerPreparedManifest,
  validateCssoccerPreparedScene,
} from "./manifestContract.mjs";
import {
  CSSOCCER_PROVENANCE_FILE,
  cssoccerPublicUrl,
} from "./paths.mjs";
import {
  CSSOCCER_ASSEMBLED_FIXTURE_SCHEMA,
  CSSOCCER_PREPARED_PROVENANCE_SCHEMA,
  assertBrowserSafePreparedValue,
  canonicalJson,
  canonicalJsonBytes,
  createCssoccerPreparedProvenance,
  cssoccerPreparedFileDescriptor,
} from "./provenance.mjs";
import { writeCssoccerPreparedPublication } from "./writeManifest.mjs";

export const CSSOCCER_PREPARED_ASSEMBLY_REQUEST = deepFreeze({
  schema: "cssoccer-prepared-assembly-request@1",
  fixtureId: CSSOCCER_PREPARED_FIXTURE_ID,
  scenePath: CSSOCCER_PREPARED_SCENE_URL.slice("/cssoccer/".length),
  sceneUrl: CSSOCCER_PREPARED_SCENE_URL,
});

const FIXTURE_KEYS = new Set(["files", "manifest", "schema", "sourceArtifacts"]);

export async function prepareCssoccer({
  outputRoot,
  assembledFixture,
  assembleFixture,
  beforeCommit,
} = {}) {
  const hasFixture = assembledFixture !== undefined;
  const hasAssembler = assembleFixture !== undefined;
  if (hasFixture === hasAssembler) {
    throw new Error("Provide exactly one of assembledFixture or assembleFixture");
  }
  if (hasAssembler && typeof assembleFixture !== "function") {
    throw new TypeError("assembleFixture must be a function");
  }

  const fixture = hasFixture
    ? assembledFixture
    : await assembleFixture(CSSOCCER_PREPARED_ASSEMBLY_REQUEST);
  requirePlainObject(fixture, "assembled prepared fixture");
  rejectUnknownKeys(fixture, FIXTURE_KEYS, "assembled prepared fixture");
  if (fixture.schema !== CSSOCCER_ASSEMBLED_FIXTURE_SCHEMA) {
    throw new Error(`Assembled fixture must use ${CSSOCCER_ASSEMBLED_FIXTURE_SCHEMA}`);
  }
  requirePlainObject(fixture.manifest, "assembled prepared manifest");
  if (own(fixture.manifest, "preparedFiles") || own(fixture.manifest, "provenance")) {
    throw new Error("Assembled manifest may not precompute publisher-owned preparedFiles or provenance");
  }

  const prepared = createCssoccerPreparedProvenance({
    fixtureId: CSSOCCER_PREPARED_FIXTURE_ID,
    sourceArtifacts: fixture.sourceArtifacts,
    files: fixture.files,
  });
  const sceneFile = prepared.files.find(({ path }) => (
    path === CSSOCCER_PREPARED_ASSEMBLY_REQUEST.scenePath
  ));
  if (!sceneFile || sceneFile.kind !== "json") {
    throw new Error(
      `Assembled fixture must provide JSON scene ${CSSOCCER_PREPARED_ASSEMBLY_REQUEST.scenePath}`,
    );
  }
  validateCssoccerPreparedScene(sceneFile.jsonValue);

  const manifest = JSON.parse(canonicalJson(fixture.manifest));
  requirePlainObject(manifest.bindings, "assembled prepared manifest bindings");
  if (
    own(manifest.bindings, "prepareInputsSha256")
    && manifest.bindings.prepareInputsSha256 !== prepared.prepareInputsSha256
  ) {
    throw new Error("Prepared manifest prepareInputsSha256 does not match canonical source lineage");
  }
  manifest.bindings.prepareInputsSha256 = prepared.prepareInputsSha256;
  manifest.defaultScene = bindSceneHash(manifest.defaultScene, sceneFile, "default scene");
  if (Array.isArray(manifest.scenes)) {
    manifest.scenes = manifest.scenes.map((entry) => (
      entry?.id === CSSOCCER_PREPARED_FIXTURE_ID
        ? bindSceneHash(entry, sceneFile, "scene entry")
        : entry
    ));
  }
  manifest.preparedFiles = prepared.files.map(cssoccerPreparedFileDescriptor);
  manifest.provenance = {
    schema: CSSOCCER_PREPARED_PROVENANCE_SCHEMA,
    path: CSSOCCER_PROVENANCE_FILE,
    url: cssoccerPublicUrl(CSSOCCER_PROVENANCE_FILE),
    bytes: prepared.provenanceBytes.byteLength,
    sha256: prepared.provenanceSha256,
  };
  validateCssoccerPreparedManifest(manifest);
  assertBrowserSafePreparedValue(manifest, "prepared manifest");
  const manifestBytes = canonicalJsonBytes(manifest);

  return writeCssoccerPreparedPublication({
    outputRoot,
    files: prepared.files,
    provenanceBytes: prepared.provenanceBytes,
    manifestBytes,
    prepareInputsSha256: prepared.prepareInputsSha256,
    provenanceSha256: prepared.provenanceSha256,
    beforeCommit,
  });
}

export function publishCssoccerPreparedFixture(assembledFixture, options = {}) {
  return prepareCssoccer({ ...options, assembledFixture });
}

function bindSceneHash(entry, sceneFile, label) {
  requirePlainObject(entry, `prepared manifest ${label}`);
  if (own(entry, "sha256") && entry.sha256 !== sceneFile.sha256) {
    throw new Error(`Prepared manifest ${label} SHA-256 does not match the assembled scene`);
  }
  if (own(entry, "bytes") && entry.bytes !== sceneFile.byteLength) {
    throw new Error(`Prepared manifest ${label} byte count does not match the assembled scene`);
  }
  return {
    ...entry,
    bytes: sceneFile.byteLength,
    sha256: sceneFile.sha256,
  };
}

function rejectUnknownKeys(value, allowed, label) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key)).sort();
  if (unknown.length > 0) {
    throw new Error(`${label} has unsupported key${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}`);
  }
}

function requirePlainObject(value, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    throw new TypeError(`${label} must be a plain object`);
  }
}

function own(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
