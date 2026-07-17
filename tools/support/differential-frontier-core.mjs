import { createHash } from "node:crypto";

export const DIFFERENTIAL_FRONTIER_EVIDENCE_SCHEMA =
  "cssoccer-differential-frontier-evidence@1";
export const DIFFERENTIAL_FRONTIER_AGENT_SCHEMA =
  "cssoccer-differential-frontier-agent@1";

const SHA256 = /^[a-f0-9]{64}$/u;
// Do not mistake the second byte of ==, !=, <=, or >= for an assignment.
const WRITE_PATTERN = /(?:\+\+|--|(?<![=!<>])(?:<<|>>|[+\-*/%&|^])?=(?!=))/u;
const FUNCTION_PATTERN = /^\s*(?:(?:static|inline|extern|const|unsigned|signed|long|short|void|int|char|float|double|bool|struct|class|auto)\s+|[A-Za-z_]\w*(?:::\w+)?[\s*&]+)+([A-Za-z_~]\w*)\s*\([^;]*\)\s*(?:const\s*)?\{?\s*$/u;
const CONTROL_WORDS = new Set(["if", "for", "while", "switch", "catch"]);
const EVIDENCE_FILES = new Set([
  "browserEngineIndependence.mjs",
  "client.mjs",
  "debugApi.mjs",
  "nativeFieldContract.mjs",
  "nativeFieldProjection.mjs",
  "oracleState.mjs",
]);

export class DifferentialFrontierError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "DifferentialFrontierError";
    this.code = code;
    this.details = details;
  }
}

export function samplesEqual(reference, candidate) {
  return reference?.valueType === candidate?.valueType
    && reference?.numericBits === candidate?.numericBits
    && (reference?.numericBits !== null || Object.is(reference?.value, candidate?.value));
}

export function sampleReport(sample) {
  return Object.freeze({
    valueType: sample.valueType,
    value: sample.value,
    numericBits: sample.numericBits,
  });
}

export function createExactSelector(mismatch, fieldOrder) {
  requireObject(mismatch, "mismatch");
  const ordinal = fieldOrder.get(mismatch.fieldId);
  if (!Number.isSafeInteger(ordinal)) {
    throw new DifferentialFrontierError(
      "frontier-field-missing",
      `Exact field ${mismatch.fieldId} is absent from the retained contract.`,
    );
  }
  const player = mismatch.fieldId.match(/^players\.([a-z0-9-]+)\.(.+)$/u);
  const parts = mismatch.fieldId.split(".");
  return Object.freeze({
    schema: "cssoccer-differential-frontier-selector@1",
    tick: mismatch.tick,
    phase: mismatch.phase,
    phaseOrder: mismatch.phaseOrder,
    fieldId: mismatch.fieldId,
    fieldOrdinal: ordinal,
    valueType: mismatch.reference.valueType,
    referenceBits: mismatch.reference.numericBits,
    candidateBits: mismatch.candidate.numericBits,
    domain: parts[0],
    entityId: player?.[1] ?? null,
    leaf: player?.[2] ?? parts.slice(1).join("."),
  });
}

export function compareExactCoordinates(left, right, fieldOrder) {
  if (left === null && right === null) return "same";
  if (left === null) return "regressed";
  if (right === null) return "complete";
  const leftCoordinate = coordinate(left, fieldOrder);
  const rightCoordinate = coordinate(right, fieldOrder);
  if (rightCoordinate.tick !== leftCoordinate.tick) {
    return rightCoordinate.tick > leftCoordinate.tick ? "advanced" : "regressed";
  }
  if (rightCoordinate.phaseOrder !== leftCoordinate.phaseOrder) {
    return rightCoordinate.phaseOrder > leftCoordinate.phaseOrder ? "advanced" : "regressed";
  }
  if (rightCoordinate.fieldOrdinal !== leftCoordinate.fieldOrdinal) {
    return rightCoordinate.fieldOrdinal > leftCoordinate.fieldOrdinal ? "advanced" : "regressed";
  }
  return right.reference?.numericBits === left.reference?.numericBits
    && right.candidate?.numericBits === left.candidate?.numericBits
    ? "same"
    : "changed-at-coordinate";
}

export function classifyMismatch(mismatch, transitionClues = []) {
  const selector = mismatch.selector ?? mismatch;
  const leaf = selector.leaf ?? selector.fieldId?.split(".").at(-1) ?? "";
  const domain = selector.domain ?? selector.fieldId?.split(".")[0] ?? "";
  const referenceChanged = transitionClues.find(({ fieldId }) => fieldId === selector.fieldId)
    ?.referenceChanged ?? null;
  const candidateChanged = transitionClues.find(({ fieldId }) => fieldId === selector.fieldId)
    ?.candidateChanged ?? null;
  let id = "producer-transition";
  let question = "Which source-owned transition first writes the selected field differently?";
  if (domain === "rng") {
    id = "rng-call-order";
    question = "Which source call consumes or skips the first differing RNG value?";
  } else if (/^(?:action|animation|ball_state|control|possession)$/u.test(leaf)) {
    id = "branch-transition";
    question = "Which native branch condition changes this discrete state at the checked tick?";
  } else if (referenceChanged === true && candidateChanged === false) {
    id = "missing-transition";
    question = "Which native transition fires here but is absent from the browser schedule?";
  } else if (referenceChanged === false && candidateChanged === true) {
    id = "extra-transition";
    question = "Which browser transition fires here but the native schedule skips?";
  } else if (
    mismatch.reason === "numeric-bits"
    && new Set(["f32", "f64"]).has(mismatch.reference?.valueType)
  ) {
    const ulpDistance = numericUlpDistance(
      mismatch.reference.numericBits,
      mismatch.candidate.numericBits,
    );
    id = ulpDistance !== null && ulpDistance <= 4
      ? "float-store-order"
      : "numeric-producer";
    question = id === "float-store-order"
      ? "Which native store boundary or operand order produces the first differing float bits?"
      : "Which native arithmetic producer first diverges for this numeric field?";
  } else if (domain === "ball") {
    id = "ball-transition";
    question = "Which BALL or BALLINT transition first changes this state differently?";
  }
  return Object.freeze({
    schema: "cssoccer-differential-frontier-route@1",
    id,
    question,
    diagnosticOnly: true,
  });
}

export function buildTransitionClues({
  previousReference,
  previousCandidate,
  reference,
  candidate,
  selectedFieldIds,
  exactFieldId,
  limit = 24,
}) {
  const clues = [];
  for (const fieldId of selectedFieldIds) {
    const beforeReference = previousReference?.get(fieldId) ?? null;
    const beforeCandidate = previousCandidate?.get(fieldId) ?? null;
    const afterReference = reference.get(fieldId);
    const afterCandidate = candidate.get(fieldId);
    if (!afterReference || !afterCandidate) continue;
    const referenceChanged = beforeReference === null
      ? null
      : !samplesEqual(beforeReference, afterReference);
    const candidateChanged = beforeCandidate === null
      ? null
      : !samplesEqual(beforeCandidate, afterCandidate);
    const differs = !samplesEqual(afterReference, afterCandidate);
    if (!differs && referenceChanged === candidateChanged) continue;
    clues.push(Object.freeze({
      fieldId,
      exact: fieldId === exactFieldId,
      referenceChanged,
      candidateChanged,
      before: beforeReference === null ? null : sampleReport(beforeReference),
      reference: sampleReport(afterReference),
      candidate: sampleReport(afterCandidate),
    }));
  }
  clues.sort((left, right) => (
    Number(right.exact) - Number(left.exact)
    || Number(right.referenceChanged !== right.candidateChanged)
      - Number(left.referenceChanged !== left.candidateChanged)
    || left.fieldId.localeCompare(right.fieldId)
  ));
  return Object.freeze(clues.slice(0, limit));
}

export function parseSourceOwner(sourceOwner) {
  if (typeof sourceOwner !== "string" || sourceOwner.trim().length === 0) {
    throw new TypeError("sourceOwner must be non-empty text.");
  }
  const files = [...sourceOwner.matchAll(/\b([A-Za-z0-9_]+\.(?:CPP|C|H))\b/gu)]
    .map((match) => match[1].toUpperCase());
  const dottedMembers = [...sourceOwner.matchAll(/\.([A-Za-z_]\w*)\b/gu)]
    .map((match) => match[1]);
  const tokens = [...sourceOwner.matchAll(/\b([A-Za-z_]\w*)\b/gu)]
    .map((match) => match[1])
    .filter((token) => !new Set(["CPP", "C", "H"]).has(token.toUpperCase()));
  return Object.freeze({
    sourceOwner,
    files: Object.freeze([...new Set(files)]),
    symbols: Object.freeze([...new Set([...dottedMembers, ...tokens])]),
    primarySymbol: dottedMembers.at(-1) ?? tokens.at(-1) ?? null,
  });
}

export function findNativeWriteSites(files, {
  sourceOwner,
  additionalSymbols = [],
  preferredValueSymbols = [],
  limit = 12,
} = {}) {
  const owner = parseSourceOwner(sourceOwner);
  const symbols = [...new Set([
    owner.primarySymbol,
    ...owner.symbols,
    ...additionalSymbols,
  ].filter((symbol) => typeof symbol === "string" && symbol.length > 2))];
  const sites = [];
  for (const file of files) {
    const lines = file.text.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const matched = symbols.filter((symbol) => wordPattern(symbol).test(line));
      if (matched.length === 0) continue;
      const write = WRITE_PATTERN.test(line);
      const sourceFile = owner.files.includes(file.name.toUpperCase());
      const context = enclosingFunction(lines, index);
      const functionMatches = context.name !== null && owner.symbols.includes(context.name);
      const matchesPreferredValue = preferredValueSymbols.some((symbol) => (
        wordPattern(symbol).test(line)
      ));
      const matchesPrimary = matched.includes(owner.primarySymbol);
      const additionalMatches = matched.filter((symbol) => (
        symbol !== owner.primarySymbol && additionalSymbols.includes(symbol)
      )).length;
      let score = matched.length * 3 + Math.min(additionalMatches, 3) * 2;
      if (write) score += 30;
      if (sourceFile) score += 18;
      if (functionMatches) score += 25;
      if (matchesPrimary) score += 25;
      if (write && matchesPrimary) score += 60;
      if (write && matchesPreferredValue) score += 80;
      if (/\b(?:struct|extern|typedef)\b/u.test(line) && !write) score -= 25;
      sites.push({
        file: file.path,
        line: index + 1,
        function: context.name,
        score,
        write,
        matchedPreferredValue: matchesPreferredValue,
        matchedSymbols: matched,
        source: line.trim().slice(0, 260),
      });
    }
  }
  return Object.freeze(sites
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score
      || left.file.localeCompare(right.file)
      || left.line - right.line)
    .slice(0, limit)
    .map(Object.freeze));
}

export function findRuntimeProducerCandidates(files, {
  selector,
  sourceOwner,
  nativeFunctions = [],
  internalSymbols = [],
  limit = 10,
} = {}) {
  const owner = parseSourceOwner(sourceOwner);
  const aliases = fieldAliases(selector);
  const sourceFunctions = nativeFunctions.filter(Boolean);
  const terms = [...new Set([
    ...owner.files,
    ...owner.symbols,
    ...sourceFunctions,
    ...internalSymbols,
    ...aliases,
  ].filter((term) => typeof term === "string" && term.length > 2))];
  const sites = [];
  for (const file of files) {
    const lines = file.text.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lower = line.toLowerCase();
      const matched = terms.filter((term) => lower.includes(term.toLowerCase()));
      if (matched.length === 0) continue;
      const context = enclosingFunction(lines, index);
      const write = WRITE_PATTERN.test(line) || /:\s*[^,}]+[,}]?\s*$/u.test(line);
      let score = matched.length * 4;
      if (write) score += 12;
      if (owner.files.some((name) => lower.includes(name.toLowerCase()))) score += 20;
      if (sourceFunctions.some((name) => lower.includes(name.toLowerCase()))) score += 24;
      if (aliases.some((name) => lower.includes(name.toLowerCase()))) score += 12;
      if (owner.primarySymbol && lower.includes(owner.primarySymbol.toLowerCase())) score += 14;
      const classification = runtimeFileClassification(file.name);
      if (classification === "evidence") score -= 24;
      else if (classification === "runtime") score += 8;
      sites.push({
        file: file.path,
        line: index + 1,
        function: context.name,
        classification,
        score,
        write,
        matchedTerms: matched.slice(0, 8),
        source: line.trim().slice(0, 260),
      });
    }
  }
  const rankedSites = sites
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score
      || left.file.localeCompare(right.file)
      || left.line - right.line);
  const byFile = new Map();
  for (const site of rankedSites) {
    const current = byFile.get(site.file) ?? {
      file: site.file,
      classification: site.classification,
      score: 0,
      sites: [],
    };
    if (current.sites.length < 4) {
      current.sites.push(site);
      current.score += site.score;
    }
    byFile.set(site.file, current);
  }
  return Object.freeze([...byFile.values()]
    .sort((left, right) => right.score - left.score || left.file.localeCompare(right.file))
    .slice(0, limit)
    .map((candidate) => Object.freeze({
      ...candidate,
      sites: Object.freeze(candidate.sites.map(Object.freeze)),
    })));
}

export function flattenScalars(value, {
  prefix = "",
  maxDepth = 8,
  maxEntries = 800,
} = {}) {
  const output = new Map();
  const visit = (current, path, depth) => {
    if (output.size >= maxEntries) return;
    if (
      current === null
      || ["string", "number", "boolean"].includes(typeof current)
    ) {
      output.set(path, current);
      return;
    }
    if (depth >= maxDepth || typeof current !== "object") return;
    if (Array.isArray(current)) {
      current.forEach((child, index) => visit(child, `${path}[${index}]`, depth + 1));
      return;
    }
    for (const key of Object.keys(current).sort()) {
      visit(current[key], path ? `${path}.${key}` : key, depth + 1);
    }
  };
  visit(value, prefix, 0);
  return output;
}

export function diffScalarMaps(before, after, { limit = 80 } = {}) {
  const keys = [...new Set([...before.keys(), ...after.keys()])].sort();
  return Object.freeze(keys
    .filter((key) => !Object.is(before.get(key), after.get(key)))
    .slice(0, limit)
    .map((path) => Object.freeze({
      path,
      before: before.has(path) ? before.get(path) : null,
      after: after.has(path) ? after.get(path) : null,
    })));
}

export const MATCH_PLAYER_LAYOUTS = Object.freeze({
  "13d13dca2910a7685be7603e25bc9fa936253f5aa72f73eef3f54e851fbbce34": Object.freeze({
    bytes: 203,
    fields: Object.freeze([
      field("tm_player", 0, "i16", "nativePlayerNumber"),
      field("tm_x", 2, "f32", "position.x"),
      field("tm_xdis", 6, "f32", "displacement.x"),
      field("tm_y", 10, "f32", "position.y"),
      field("tm_ydis", 14, "f32", "displacement.y"),
      field("tm_z", 18, "f32", "position.z"),
      field("tm_zdis", 22, "f32", "displacement.z"),
      field("mface_x", 26, "f32", "mustFace.x"),
      field("mface_y", 30, "f32", "mustFace.y"),
      field("mface_time", 34, "i16", "mustFace.ticks"),
      field("mface", 36, "u8", "mustFace.active"),
      field("tm_dist", 37, "f32", "distance"),
      field("tm_pos", 41, "u8", "distanceRank"),
      field("tm_limbo", 42, "i16", "limbo"),
      field("guy_on", 44, "i16", "on"),
      field("control", 46, "u8", "control"),
      field("tm_srng", 47, "u8", "shirtRange"),
      field("tm_off", 48, "i8", "offside"),
      field("tm_stopped", 49, "u8", "stopped"),
      field("tm_trap", 50, "i8", "trap"),
      field("special", 51, "i16", "special"),
      field("tm_strike", 53, "i16", "strike"),
      field("tm_stime", 55, "f32", "strikeTime"),
      field("tm_ftime", 59, "i16", "freeTime"),
      field("ball_state", 61, "i16", "ballState"),
      field("tm_fpass_type", 63, "i16", "firstPassType"),
      field("tm_fpass_to", 65, "i16", "firstPassTo"),
      field("tm_rate", 70, "u8", "rate"),
      field("turn_dir", 105, "i16", "turnDirection"),
      field("face_dir", 107, "i16", "faceDirection"),
      field("dir_mode", 109, "i16", "directionMode"),
      field("tm_frm", 111, "f32", "animationFrame"),
      field("tm_fstep", 115, "f32", "animationFrameStep"),
      field("tm_anim", 119, "u16", "animation"),
      field("tm_mcspd", 123, "f32", "motionCaptureSpeed"),
      field("contact", 135, "f32", "contact"),
      field("tm_newanim", 139, "u8", "newAnimation"),
      field("tm_barge", 140, "u8", "barge"),
      field("tm_limp", 141, "u8", "limp"),
      field("tm_act", 142, "i16", "action"),
      field("tm_poss", 144, "i16", "possessionTicks"),
      field("tm_wall", 146, "i16", "wall"),
      field("tm_leave", 148, "i16", "leave"),
      field("tm_mark", 150, "i16", "mark"),
      field("go_dist", 152, "i32", "goDistance"),
      field("go_cnt", 156, "i32", "goCount"),
      field("go_txdis", 160, "f32", "goDisplacement.x"),
      field("go_tydis", 164, "f32", "goDisplacement.y"),
      field("go_tx", 168, "f32", "goTarget.x"),
      field("go_ty", 172, "f32", "goTarget.y"),
      field("go_xoff", 176, "f32", "goOffset.x"),
      field("go_yoff", 180, "f32", "goOffset.y"),
      field("tm_jump", 184, "f32", "jump"),
      field("go_stop", 188, "u8", "goStop"),
      field("go_step", 189, "u8", "goStep"),
      field("tm_notme", 190, "u8", "notMe"),
      field("int_move", 191, "i16", "intelligenceMove"),
      field("int_cnt", 193, "i16", "intelligenceCount"),
      field("mess_num", 195, "i16", "messageNumber"),
      field("mess_cnt", 197, "i16", "messageCount"),
      field("tm_comm", 199, "i16", "communication"),
      field("tm_ccnt", 201, "i16", "communicationCount"),
    ]),
  }),
});

export function parseCssoraw2(buffer, {
  ranges: expectedRanges,
  version = 2,
  metadataBytes = 28,
  activeFlag = 1,
} = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) {
    throw new DifferentialFrontierError("native-raw-short", "Native raw evidence is truncated.");
  }
  if (buffer.subarray(0, 8).toString("ascii") !== "CSSORAW2") {
    throw new DifferentialFrontierError("native-raw-magic", "Native raw evidence is not CSSORAW2.");
  }
  const actualVersion = buffer.readUInt32LE(8);
  const rangeCount = buffer.readUInt32LE(12);
  if (actualVersion !== version || !Array.isArray(expectedRanges) || rangeCount !== expectedRanges.length) {
    throw new DifferentialFrontierError("native-raw-contract", "Native raw header does not match its retained profile.");
  }
  let cursor = 16;
  let payloadBytes = 0;
  const ranges = [];
  for (let index = 0; index < rangeCount; index += 1) {
    if (cursor + 8 > buffer.length) {
      throw new DifferentialFrontierError("native-raw-ranges", "Native raw range table is truncated.");
    }
    const offset = buffer.readUInt32LE(cursor);
    const bytes = buffer.readUInt32LE(cursor + 4);
    const expected = expectedRanges[index];
    if (offset !== expected.offset || bytes !== expected.bytes) {
      throw new DifferentialFrontierError(
        "native-raw-range-mismatch",
        `Native raw range ${index} does not match its retained profile.`,
      );
    }
    ranges.push({ offset, bytes, payloadBase: payloadBytes });
    payloadBytes += bytes;
    cursor += 8;
  }
  const recordBytes = metadataBytes + payloadBytes;
  const remaining = buffer.length - cursor;
  if (remaining <= 0 || remaining % recordBytes !== 0) {
    throw new DifferentialFrontierError("native-raw-records", "Native raw record domain is truncated.");
  }
  const byTick = new Map();
  const count = remaining / recordBytes;
  for (let index = 0; index < count; index += 1) {
    const recordOffset = cursor + index * recordBytes;
    if (buffer.readUInt32LE(recordOffset) !== 0x314b4954) {
      throw new DifferentialFrontierError("native-raw-marker", `Native raw record ${index} is not TIK1.`);
    }
    if (buffer.readUInt32LE(recordOffset + 4) !== index) {
      throw new DifferentialFrontierError("native-raw-sequence", `Native raw sequence breaks at ${index}.`);
    }
    const tick = buffer.readUInt32LE(recordOffset + 20);
    const flags = buffer.readUInt32LE(recordOffset + 24);
    if ((flags & activeFlag) !== 0) {
      if (byTick.has(tick)) {
        throw new DifferentialFrontierError("native-raw-active-duplicate", `Native raw tick ${tick} is duplicated.`);
      }
      byTick.set(tick, Object.freeze({
        buffer,
        ranges,
        tick,
        flags,
        payloadOffset: recordOffset + metadataBytes,
      }));
    }
  }
  return Object.freeze({ ranges: Object.freeze(ranges), byTick, recordBytes, recordCount: count });
}

export function decodeMatchPlayer(record, {
  teamsOffset,
  nativePlayerNumber,
  structSha256,
} = {}) {
  const layout = MATCH_PLAYER_LAYOUTS[structSha256];
  if (!layout) {
    throw new DifferentialFrontierError(
      "native-player-layout-missing",
      `No retained match_player decoder exists for ${String(structSha256)}.`,
    );
  }
  if (!Number.isSafeInteger(nativePlayerNumber) || nativePlayerNumber < 1 || nativePlayerNumber > 22) {
    throw new TypeError("nativePlayerNumber must be between 1 and 22.");
  }
  const base = teamsOffset + (nativePlayerNumber - 1) * layout.bytes;
  return Object.freeze(Object.fromEntries(layout.fields.map((definition) => [
    definition.browserPath,
    readRawValue(record, base + definition.offset, definition.valueType),
  ])));
}

export function changedNativeMembers(before, after, structSha256) {
  const layout = MATCH_PLAYER_LAYOUTS[structSha256];
  if (!layout) return Object.freeze([]);
  return Object.freeze(layout.fields
    .filter(({ browserPath }) => !Object.is(before?.[browserPath], after?.[browserPath]))
    .map(({ sourceMember, browserPath, offset, valueType }) => Object.freeze({
      sourceMember,
      browserPath,
      offset,
      valueType,
      before: before?.[browserPath] ?? null,
      after: after?.[browserPath] ?? null,
    })));
}

export function candidatePlayerContext(state, entityId) {
  if (!state || typeof state !== "object" || typeof entityId !== "string") return null;
  const base = state.players?.find?.(({ id }) => id === entityId) ?? null;
  const live = state.openingLivePlayers?.players?.find?.(({ id }) => id === entityId) ?? null;
  const control = state.liveControl?.players?.find?.(({ id }) => id === entityId) ?? null;
  const possession = state.possession?.players?.find?.(({ stableId }) => stableId === entityId) ?? null;
  if (!base && !live) return null;
  return Object.freeze({
    ...(base ?? {}),
    ...(live ?? {}),
    control: control?.control?.value ?? base?.control ?? null,
    possession: possession?.possession ?? base?.possession ?? null,
    global: {
      ballTravel: state.ballTravel ?? null,
      possessionOwner: state.possession?.owner ?? null,
      selectedPlayerId: state.liveControl?.ownership?.activePlayerId ?? null,
      rng: state.rng ?? null,
    },
  });
}

export function runtimeFileClassification(name) {
  if (EVIDENCE_FILES.has(name)) return "evidence";
  if (/Profile\.mjs$/u.test(name)) return "prepared-input";
  return "runtime";
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256Canonical(value) {
  return sha256(canonicalJson(value));
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function requireSha256(value, label) {
  if (!SHA256.test(value ?? "")) throw new TypeError(`${label} must be SHA-256.`);
  return value;
}

function coordinate(value, fieldOrder) {
  const fieldId = value.fieldId ?? value.selector?.fieldId;
  const ordinal = fieldOrder.get(fieldId);
  if (!Number.isSafeInteger(ordinal)) {
    throw new DifferentialFrontierError("frontier-coordinate-field", `Unknown frontier field ${fieldId}.`);
  }
  return {
    tick: value.tick ?? value.selector?.tick,
    phaseOrder: value.phaseOrder ?? value.selector?.phaseOrder,
    fieldOrdinal: ordinal,
  };
}

function numericUlpDistance(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return null;
  try {
    const a = BigInt(`0x${left}`);
    const b = BigInt(`0x${right}`);
    return Number(a > b ? a - b : b - a);
  } catch {
    return null;
  }
}

function fieldAliases(selector) {
  const leaf = selector.leaf ?? "";
  const parts = leaf.split("_");
  const camel = parts[0] + parts.slice(1).map((part) => (
    part.slice(0, 1).toUpperCase() + part.slice(1)
  )).join("");
  const aliases = [leaf, camel];
  const axis = leaf.match(/^([xyz])_(.+)$/u);
  if (axis) {
    aliases.push(`${axis[2]}.${axis[1]}`, `${axis[1]}${axis[2].slice(0, 1).toUpperCase()}${axis[2].slice(1)}`);
  }
  if (leaf.endsWith("_displacement")) aliases.push("displacement", "goDisplacement", "facing");
  if (leaf === "control") aliases.push("liveControl", "ownership", "selectedPlayer");
  if (leaf === "action") aliases.push("actionId", "livePass", "intelligenceCount");
  if (leaf === "possession") aliases.push("possessionOwner", "lastTouch");
  return [...new Set(aliases.filter(Boolean))];
}

function enclosingFunction(lines, index) {
  for (let cursor = index; cursor >= Math.max(0, index - 120); cursor -= 1) {
    const match = lines[cursor].match(FUNCTION_PATTERN);
    if (!match || CONTROL_WORDS.has(match[1])) continue;
    return { name: match[1], line: cursor + 1 };
  }
  return { name: null, line: null };
}

function wordPattern(value) {
  return new RegExp(`\\b${escapeRegExp(value)}\\b`, "u");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function field(sourceMember, offset, valueType, browserPath) {
  return Object.freeze({ sourceMember, offset, valueType, browserPath });
}

function readRawValue(record, offset, valueType) {
  const bytes = valueType.endsWith("8") ? 1 : valueType.endsWith("16") ? 2 : 4;
  const range = record.ranges.find(({ offset: start, bytes: length }) => (
    offset >= start && offset + bytes <= start + length
  ));
  if (!range) {
    throw new DifferentialFrontierError(
      "native-raw-field-missing",
      `Native raw field 0x${offset.toString(16)} is outside retained ranges.`,
    );
  }
  const cursor = record.payloadOffset + range.payloadBase + offset - range.offset;
  switch (valueType) {
    case "i8": return record.buffer.readInt8(cursor);
    case "u8": return record.buffer.readUInt8(cursor);
    case "i16": return record.buffer.readInt16LE(cursor);
    case "u16": return record.buffer.readUInt16LE(cursor);
    case "i32": return record.buffer.readInt32LE(cursor);
    case "u32": return record.buffer.readUInt32LE(cursor);
    case "f32": return record.buffer.readFloatLE(cursor);
    default: throw new TypeError(`Unsupported native raw value type ${valueType}.`);
  }
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
}
