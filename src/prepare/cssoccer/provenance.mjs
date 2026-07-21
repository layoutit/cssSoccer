import { createHash } from "node:crypto";

import {
  cssoccerPublicUrl,
  validateCssoccerPreparedPath,
} from "./paths.mjs";

export const CSSOCCER_ASSEMBLED_FIXTURE_SCHEMA = "cssoccer-assembled-prepared-fixture@1";
export const CSSOCCER_PREPARED_PROVENANCE_SCHEMA = "cssoccer-prepared-provenance@1";

const SHA256 = /^[0-9a-f]{64}$/u;
const SOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/#@+-]*$/u;
const MEDIA_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/u;
const FILE_KEYS = new Set([
  "bytes",
  "expectedSha256",
  "json",
  "lineage",
  "mediaType",
  "path",
  "references",
  "text",
]);

const PATH_LEAK_PATTERNS = Object.freeze([
  ["file URL", /(?:^|[^A-Za-z])file:(?:\/\/)?/iu],
  ["macOS home path", /\/Users\/[A-Za-z0-9._-]+\//u],
  ["Unix home path", /\/home\/[A-Za-z0-9._-]+\//u],
  ["macOS volume path", /\/Volumes\/[A-Za-z0-9._-]+\//u],
  ["private temporary path", /\/private\/(?:tmp|var)\//u],
  ["temporary path", /\/tmp\//u],
  ["macOS per-user temporary path", /\/var\/folders\//u],
  ["ignored local path", /(?:^|[^A-Za-z0-9._-])\.local[\\/]/u],
  ["Windows drive path", /(?:^|[^A-Za-z0-9])[A-Za-z]:[\\/]/u],
  ["Windows UNC path", /\\\\[A-Za-z0-9._-]+\\/u],
]);

export function canonicalJson(value) {
  return encodeCanonicalJson(value, new Set(), "$prepared");
}

export function canonicalJsonBytes(value) {
  return Buffer.from(`${canonicalJson(value)}\n`, "utf8");
}

export function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function assertBrowserSafePreparedValue(value, label = "prepared value") {
  const serialized = canonicalJson(value);
  assertNoLocalPathLeak(Buffer.from(serialized, "utf8"), label);
  return value;
}

export function createCssoccerPreparedProvenance({
  fixtureId,
  sourceArtifacts,
  files,
}) {
  if (typeof fixtureId !== "string" || !SOURCE_ID.test(fixtureId)) {
    throw new Error("Prepared provenance requires a stable logical fixtureId");
  }
  const normalizedSources = normalizeSourceArtifacts(sourceArtifacts);
  const materializedFiles = materializePreparedFiles(files, normalizedSources);
  const prepareInputs = {
    schema: "cssoccer-prepare-inputs@1",
    fixtureId,
    sourceArtifacts: normalizedSources,
    files: materializedFiles.map(({ path, lineage, lineageSha256, references }) => ({
      path,
      lineage,
      lineageSha256,
      references,
    })),
  };
  const prepareInputsSha256 = sha256Hex(canonicalJsonBytes(prepareInputs));
  const provenance = {
    schema: CSSOCCER_PREPARED_PROVENANCE_SCHEMA,
    fixtureId,
    prepareInputsSha256,
    sourceArtifacts: normalizedSources,
    files: materializedFiles.map(publicProvenanceRecord),
  };
  assertBrowserSafePreparedValue(provenance, "prepared provenance");
  const provenanceBytes = canonicalJsonBytes(provenance);

  return Object.freeze({
    files: materializedFiles,
    prepareInputsSha256,
    provenance,
    provenanceBytes,
    provenanceSha256: sha256Hex(provenanceBytes),
    sourceArtifacts: normalizedSources,
  });
}

export function cssoccerPreparedFileDescriptor(file) {
  return Object.freeze({
    path: file.path,
    url: cssoccerPublicUrl(file.path),
    mediaType: file.mediaType,
    bytes: file.byteLength,
    sha256: file.sha256,
    lineageSha256: file.lineageSha256,
    references: file.references,
  });
}

function materializePreparedFiles(files, sourceArtifacts) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("Assembled cssoccer fixture must contain prepared payload files");
  }
  const sourceIds = new Set(sourceArtifacts.map(({ id }) => id));
  const sourceHashes = new Set(sourceArtifacts.map(({ sha256 }) => sha256));
  const seenPaths = new Map();
  const records = files.map((file, index) => {
    requirePlainObject(file, `prepared file ${index}`);
    rejectUnknownKeys(file, FILE_KEYS, `prepared file ${index}`);
    const path = validateCssoccerPreparedPath(file.path, {
      label: `prepared file ${index} path`,
    });
    const pathKey = path.toLowerCase();
    if (seenPaths.has(pathKey)) {
      throw new Error(`Prepared output path collision: ${seenPaths.get(pathKey)} and ${path}`);
    }
    seenPaths.set(pathKey, path);

    if (typeof file.mediaType !== "string" || !MEDIA_TYPE.test(file.mediaType)) {
      throw new Error(`Prepared file ${path} requires a lowercase mediaType`);
    }

    const contentKeys = ["json", "text", "bytes"].filter((key) => own(file, key));
    if (contentKeys.length !== 1) {
      throw new Error(`Prepared file ${path} must provide exactly one of json, text, or bytes`);
    }
    const kind = contentKeys[0];
    const { bytes, jsonValue } = materializeContents(file, kind, path);
    assertNoLocalPathLeakInPreparedFile(bytes, file.mediaType, `prepared file ${path}`);
    const sha256 = sha256Hex(bytes);
    if (own(file, "expectedSha256")) {
      requireSha256(file.expectedSha256, `prepared file ${path} expectedSha256`);
      if (file.expectedSha256 !== sha256) {
        throw new Error(
          `Prepared file ${path} SHA-256 mismatch: expected ${file.expectedSha256}, received ${sha256}`,
        );
      }
    }
    if (sourceHashes.has(sha256)) {
      throw new Error(`Prepared file ${path} copies an original source/data artifact wholesale`);
    }

    const lineage = normalizeLineage(file.lineage, path, sourceIds);
    const references = normalizeReferences(file.references, path);
    return Object.freeze({
      path,
      mediaType: file.mediaType,
      bytes,
      byteLength: bytes.byteLength,
      sha256,
      kind,
      jsonValue,
      lineage,
      lineageSha256: sha256Hex(canonicalJsonBytes(lineage)),
      references,
    });
  }).sort((left, right) => compareStrings(left.path, right.path));

  rejectFileAncestorCollisions(records);
  validateReferences(records);
  return Object.freeze(records);
}

function normalizeSourceArtifacts(sourceArtifacts) {
  if (!Array.isArray(sourceArtifacts) || sourceArtifacts.length === 0) {
    throw new Error("Assembled cssoccer fixture must declare sourceArtifacts for leakage checks");
  }
  const ids = new Set();
  const records = sourceArtifacts.map((artifact, index) => {
    requirePlainObject(artifact, `source artifact ${index}`);
    rejectUnknownKeys(artifact, new Set(["bytes", "id", "sha256"]), `source artifact ${index}`);
    if (typeof artifact.id !== "string" || !SOURCE_ID.test(artifact.id)) {
      throw new Error(`Source artifact ${index} requires a stable logical id`);
    }
    assertNoLocalPathLeak(Buffer.from(artifact.id, "utf8"), `source artifact ${artifact.id}`);
    const idKey = artifact.id.toLowerCase();
    if (ids.has(idKey)) throw new Error(`Duplicate source artifact id: ${artifact.id}`);
    ids.add(idKey);
    requireSha256(artifact.sha256, `source artifact ${artifact.id} sha256`);
    if (!Number.isSafeInteger(artifact.bytes) || artifact.bytes < 0) {
      throw new Error(`Source artifact ${artifact.id} bytes must be a non-negative safe integer`);
    }
    return Object.freeze({
      id: artifact.id,
      bytes: artifact.bytes,
      sha256: artifact.sha256,
    });
  }).sort((left, right) => compareStrings(left.id, right.id));
  return Object.freeze(records);
}

function materializeContents(file, kind, path) {
  if (kind === "json") {
    if (file.mediaType !== "application/json" && !file.mediaType.endsWith("+json")) {
      throw new Error(`Prepared JSON file ${path} must use a JSON mediaType`);
    }
    assertBrowserSafePreparedValue(file.json, `prepared JSON file ${path}`);
    const bytes = canonicalJsonBytes(file.json);
    return { bytes, jsonValue: JSON.parse(bytes.toString("utf8")) };
  }
  if (kind === "text") {
    if (typeof file.text !== "string") {
      throw new TypeError(`Prepared text file ${path} must contain a string`);
    }
    return { bytes: Buffer.from(file.text, "utf8"), jsonValue: undefined };
  }
  if (!(file.bytes instanceof Uint8Array)) {
    throw new TypeError(`Prepared binary file ${path} must contain a Uint8Array`);
  }
  return {
    bytes: Buffer.from(file.bytes),
    jsonValue: undefined,
  };
}

function normalizeLineage(lineage, path, sourceIds) {
  requirePlainObject(lineage, `prepared file ${path} lineage`);
  if (!Array.isArray(lineage.sourceIds) || lineage.sourceIds.length === 0) {
    throw new Error(`Prepared file ${path} lineage must name at least one source artifact id`);
  }
  const normalizedIds = [...lineage.sourceIds];
  if (normalizedIds.some((id) => typeof id !== "string" || !sourceIds.has(id))) {
    throw new Error(`Prepared file ${path} lineage references an unknown source artifact id`);
  }
  if (new Set(normalizedIds).size !== normalizedIds.length) {
    throw new Error(`Prepared file ${path} lineage contains duplicate source artifact ids`);
  }
  normalizedIds.sort(compareStrings);
  const normalized = JSON.parse(canonicalJson({ ...lineage, sourceIds: normalizedIds }));
  assertBrowserSafePreparedValue(normalized, `prepared file ${path} lineage`);
  return normalized;
}

function normalizeReferences(references = [], ownerPath) {
  if (!Array.isArray(references)) {
    throw new TypeError(`Prepared file ${ownerPath} references must be an array`);
  }
  const seen = new Set();
  return Object.freeze(references.map((reference, index) => {
    requirePlainObject(reference, `prepared file ${ownerPath} reference ${index}`);
    rejectUnknownKeys(reference, new Set(["path", "sha256"]), `prepared file ${ownerPath} reference ${index}`);
    const path = validateCssoccerPreparedPath(reference.path, {
      label: `prepared file ${ownerPath} reference ${index} path`,
    });
    if (path === ownerPath) {
      throw new Error(`Prepared file ${ownerPath} may not reference itself`);
    }
    const pathKey = path.toLowerCase();
    if (seen.has(pathKey)) {
      throw new Error(`Prepared file ${ownerPath} repeats reference ${path}`);
    }
    seen.add(pathKey);
    requireSha256(reference.sha256, `prepared file ${ownerPath} reference ${path} sha256`);
    return Object.freeze({ path, sha256: reference.sha256 });
  }).sort((left, right) => compareStrings(left.path, right.path)));
}

function validateReferences(files) {
  const byPath = new Map(files.map((file) => [file.path.toLowerCase(), file]));
  for (const file of files) {
    for (const reference of file.references) {
      const target = byPath.get(reference.path.toLowerCase());
      if (!target) {
        throw new Error(`Prepared file ${file.path} references missing output ${reference.path}`);
      }
      if (target.sha256 !== reference.sha256) {
        throw new Error(
          `Prepared file ${file.path} reference hash mismatch for ${reference.path}`,
        );
      }
    }
  }
}

function rejectFileAncestorCollisions(files) {
  const paths = new Set(files.map(({ path }) => path.toLowerCase()));
  for (const { path } of files) {
    const segments = path.toLowerCase().split("/");
    while (segments.length > 1) {
      segments.pop();
      if (paths.has(segments.join("/"))) {
        throw new Error(`Prepared output file/directory collision at ${path}`);
      }
    }
  }
}

function publicProvenanceRecord(file) {
  return Object.freeze({
    path: file.path,
    mediaType: file.mediaType,
    bytes: file.byteLength,
    sha256: file.sha256,
    lineageSha256: file.lineageSha256,
    references: file.references,
    lineage: file.lineage,
  });
}

function assertNoLocalPathLeak(bytes, label) {
  const text = Buffer.from(bytes).toString("latin1");
  for (const [kind, pattern] of PATH_LEAK_PATTERNS) {
    if (pattern.test(text)) {
      const article = /^[aeiou]/iu.test(kind) ? "an" : "a";
      throw new Error(`${label} leaks ${article} ${kind}`);
    }
  }
}

function assertNoLocalPathLeakInPreparedFile(bytes, mediaType, label) {
  if (mediaType === "image/png") {
    assertMetadataFreePng(bytes, label);
    return;
  }
  assertNoLocalPathLeak(bytes, label);
}

function assertMetadataFreePng(bytes, label) {
  const png = Buffer.from(bytes);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (png.length < 57 || !png.subarray(0, 8).equals(signature)) {
    throw new Error(`${label} is not a complete PNG image`);
  }
  const chunkTypes = [];
  let offset = 8;
  while (offset < png.length) {
    if (offset + 12 > png.length) throw new Error(`${label} ends inside a PNG chunk`);
    const length = png.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > png.length) throw new Error(`${label} has an out-of-bounds PNG chunk`);
    const type = png.toString("ascii", offset + 4, offset + 8);
    if (!new Set(["IHDR", "IDAT", "IEND"]).has(type)) {
      throw new Error(`${label} contains PNG metadata chunk ${type}`);
    }
    chunkTypes.push(type);
    offset = end;
    if (type === "IEND") break;
  }
  if (offset !== png.length
      || chunkTypes[0] !== "IHDR"
      || chunkTypes.at(-1) !== "IEND"
      || chunkTypes.filter((type) => type === "IHDR").length !== 1
      || chunkTypes.filter((type) => type === "IEND").length !== 1
      || !chunkTypes.includes("IDAT")) {
    throw new Error(`${label} has a noncanonical PNG chunk sequence`);
  }
}

function encodeCanonicalJson(value, stack, label) {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${label} contains a non-finite number`);
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new TypeError(`${label} contains a non-JSON value`);
  }
  if (stack.has(value)) throw new TypeError(`${label} contains a circular value`);
  stack.add(value);
  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!own(value, index)) throw new TypeError(`${label} contains a sparse array`);
      }
      const extraKeys = Object.keys(value).filter((key) => !/^(?:0|[1-9][0-9]*)$/u.test(key));
      if (extraKeys.length > 0) throw new TypeError(`${label} array contains named properties`);
      return `[${value.map((child, index) => encodeCanonicalJson(child, stack, `${label}[${index}]`)).join(",")}]`;
    }
    requirePlainObject(value, label);
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => (
      `${JSON.stringify(key)}:${encodeCanonicalJson(value[key], stack, `${label}.${key}`)}`
    )).join(",")}}`;
  } finally {
    stack.delete(value);
  }
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

function requireSha256(value, label) {
  if (typeof value !== "string" || !SHA256.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 value`);
  }
}

function own(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
