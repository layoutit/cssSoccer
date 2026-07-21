export const CSSOCCER_PARITY_STREAM_SCHEMA = "cssoccer-parity-stream@1";
export const CSSOCCER_ORACLE_PHASE = "post_tick";
export const CSSOCCER_BROWSER_ORACLE_SCHEMA = "cssoccer-browser-oracle@1";
export const CSSOCCER_BROWSER_CAPTURE_BLOCKER = Object.freeze({
  MATCH_NOT_READY: "match-not-ready",
  MATCH_BINDINGS_UNAVAILABLE: "match-bindings-unavailable",
  MISSING_DETERMINISTIC_MATCH_STEP: "missing-deterministic-match-step",
  MISSING_ENGINE_INDEPENDENCE: "missing-engine-independence-qualification",
});

const FIELD_KEYS = Object.freeze([
  "id",
  "label",
  "sourceOwner",
  "meaning",
  "unit",
  "valueType",
]);
const SAMPLE_KEYS = Object.freeze([
  "schema",
  "recordType",
  "tick",
  "phase",
  "fieldId",
  "valueType",
  "value",
  "numericBits",
]);
const VALUE_TYPES = new Set([
  "i8",
  "u8",
  "i16",
  "u16",
  "i32",
  "u32",
  "i64",
  "u64",
  "f32",
  "f64",
  "bool",
  "string",
  "null",
]);

export function createCssoccerOracleRecorder({
  fields,
  startTick = 0,
  phase = CSSOCCER_ORACLE_PHASE,
} = {}) {
  const contract = requireFieldContract(fields);
  requireTick(startTick, "oracle recorder startTick");
  requirePhase(phase);
  let expectedTick = startTick;

  return Object.freeze({
    schema: CSSOCCER_PARITY_STREAM_SCHEMA,
    phase,
    fields: contract,
    get nextTick() {
      return expectedTick;
    },
    capture(tick, values) {
      if (tick !== expectedTick) {
        throw new Error(`css.soccer oracle expected contiguous tick ${expectedTick}; received ${String(tick)}.`);
      }
      const samples = createCssoccerOracleTick({ tick, phase, fields: contract, values });
      expectedTick += 1;
      return samples;
    },
  });
}

export function createCssoccerOracleTick({
  tick,
  phase = CSSOCCER_ORACLE_PHASE,
  fields,
  values,
} = {}) {
  requireTick(tick, "oracle tick");
  requirePhase(phase);
  const contract = requireFieldContract(fields);
  requireExactValueSet(values, contract);

  return deepFreeze(contract.map((field) => {
    const value = values[field.id];
    return {
      schema: CSSOCCER_PARITY_STREAM_SCHEMA,
      recordType: "sample",
      tick,
      phase,
      fieldId: field.id,
      valueType: field.valueType,
      value,
      numericBits: numericBitsFor(field.valueType, value, field.id),
    };
  }));
}

export function serializeCssoccerOracleSamples(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new TypeError("css.soccer oracle samples must be a non-empty array.");
  }
  let previous = null;
  for (const [index, sample] of samples.entries()) {
    requireExactKeys(sample, SAMPLE_KEYS, `oracle sample ${index}`);
    if (sample.schema !== CSSOCCER_PARITY_STREAM_SCHEMA || sample.recordType !== "sample") {
      throw new Error(`oracle sample ${index} must use ${CSSOCCER_PARITY_STREAM_SCHEMA}.`);
    }
    requireTick(sample.tick, `oracle sample ${index} tick`);
    requirePhase(sample.phase);
    requireText(sample.fieldId, `oracle sample ${index} fieldId`);
    if (!VALUE_TYPES.has(sample.valueType)) {
      throw new Error(`oracle sample ${index} has unsupported value type ${String(sample.valueType)}.`);
    }
    const bits = numericBitsFor(sample.valueType, sample.value, sample.fieldId);
    if (sample.numericBits !== bits && !isTransportedNegativeZero(sample)) {
      throw new Error(
        `oracle sample ${index} at tick ${sample.tick} numeric bits do not encode `
          + `${sample.fieldId}: received ${sample.numericBits} for ${String(sample.value)}, expected ${bits}.`,
      );
    }
    if (previous) {
      if (sample.tick !== previous.tick || sample.phase !== previous.phase) {
        throw new Error("css.soccer oracle serialization accepts exactly one tick and phase at a time.");
      }
      if (sample.fieldId.localeCompare(previous.fieldId) <= 0) {
        throw new Error("css.soccer oracle samples must retain lexical field order.");
      }
    }
    previous = sample;
  }
  return `${samples.map(serializeOracleSample).join("\n")}\n`;
}

function isTransportedNegativeZero(sample) {
  return sample.value === 0 && (
    (sample.valueType === "f32" && sample.numericBits === "80000000")
    || (
      sample.valueType === "f64"
      && sample.numericBits === "8000000000000000"
    )
  );
}

function serializeOracleSample(sample) {
  if (!isTransportedNegativeZero(sample)) return JSON.stringify(sample);
  // CDP's by-value JSON transport canonicalizes -0 to 0. numericBits remains
  // authoritative, so restore the valid JSON `-0` number token before the
  // strict JSONL reader recomputes and verifies its IEEE-754 encoding.
  const marker = "__cssoccer_negative_zero__";
  return JSON.stringify({ ...sample, value: marker }).replace(`"${marker}"`, "-0");
}

/**
 * Map the browser-owned match state onto the exact parity binding contract.
 * Native replay values never enter this path; only immutable scenario/build
 * identity from the prepared fixture is carried forward.
 */
export function createCssoccerOracleBindings(matchState, {
  sourceSha256,
  buildSha256,
} = {}) {
  if (!isPlainObject(matchState)) {
    throw new TypeError("css.soccer oracle bindings require a match state.");
  }
  if (!isPlainObject(matchState.bindings)) {
    throw new TypeError("css.soccer oracle bindings require prepared match bindings.");
  }
  const source = matchState.bindings;
  const bindings = {
    scenarioId: source.nativeScenarioSha256?.slice(0, 16),
    scenarioSha256: source.nativeScenarioSha256,
    profileSha256: source.canonicalProfileSha256,
    inputSha256: source.nativeInputSha256,
    sourceSha256: sourceSha256 ?? source.nativeSourceSha256,
    buildSha256: buildSha256 ?? source.nativeBuildSha256,
    contractSha256: source.nativeFieldContractSha256,
  };
  if (!/^[a-f0-9]{16}$/u.test(bindings.scenarioId ?? "")) {
    throw new Error("css.soccer oracle scenario id must prefix a SHA-256 binding.");
  }
  for (const [key, value] of Object.entries(bindings).slice(1)) {
    if (!/^[a-f0-9]{64}$/u.test(value ?? "")) {
      throw new Error(`css.soccer oracle ${key} must be a SHA-256 binding.`);
    }
  }
  return deepFreeze(bindings);
}

/**
 * Create the browser-side capture controller used by the debug API. The
 * browser runtime must supply its own deterministic post-tick projection and
 * checked engine-independence qualification. Missing seams remain explicit
 * blockers and never fall back to native replay data.
 */
export function createCssoccerBrowserOracleController({
  getMatchState,
  getBindings,
  capturePostTick,
  engineIndependence,
  fields,
} = {}) {
  if (typeof getMatchState !== "function") {
    throw new TypeError("css.soccer browser oracle requires getMatchState.");
  }
  const contract = requireFieldContract(fields);
  let recorder = null;
  let boundBindings = null;

  function qualification() {
    return typeof engineIndependence === "function"
      ? engineIndependence()
      : engineIndependence;
  }

  function status() {
    const matchState = getMatchState();
    if (!matchState) {
      return captureStatus({
        status: "unavailable",
        blocker: CSSOCCER_BROWSER_CAPTURE_BLOCKER.MATCH_NOT_READY,
        bindings: null,
        fieldCount: contract.length,
        nextTick: 0,
        engineIndependence: null,
      });
    }
    let bindings;
    try {
      const provided = typeof getBindings === "function" ? getBindings() : null;
      bindings = provided === null || provided === undefined
        ? createCssoccerOracleBindings(matchState)
        : requireOracleBindings(provided);
    } catch {
      return captureStatus({
        status: "unavailable",
        blocker: CSSOCCER_BROWSER_CAPTURE_BLOCKER.MATCH_BINDINGS_UNAVAILABLE,
        bindings: null,
        fieldCount: contract.length,
        nextTick: recorder?.nextTick ?? 0,
        engineIndependence: null,
      });
    }
    if (boundBindings && JSON.stringify(bindings) !== JSON.stringify(boundBindings)) {
      throw new Error("css.soccer oracle match bindings changed during capture.");
    }
    if (typeof capturePostTick !== "function") {
      return captureStatus({
        status: "blocked",
        blocker: CSSOCCER_BROWSER_CAPTURE_BLOCKER.MISSING_DETERMINISTIC_MATCH_STEP,
        bindings,
        fieldCount: contract.length,
        nextTick: recorder?.nextTick ?? 0,
        engineIndependence: null,
      });
    }
    const checked = qualification();
    if (!isPassingEngineIndependence(checked, bindings)) {
      return captureStatus({
        status: "blocked",
        blocker: CSSOCCER_BROWSER_CAPTURE_BLOCKER.MISSING_ENGINE_INDEPENDENCE,
        bindings,
        fieldCount: contract.length,
        nextTick: recorder?.nextTick ?? 0,
        engineIndependence: checked ?? null,
      });
    }
    return captureStatus({
      status: "ready",
      blocker: null,
      bindings,
      fieldCount: contract.length,
      nextTick: recorder?.nextTick ?? 0,
      engineIndependence: checked,
    });
  }

  async function captureNext() {
    const current = status();
    if (current.status !== "ready") {
      const error = new Error(`css.soccer browser capture blocked: ${current.firstBlocker}.`);
      error.code = current.firstBlocker;
      throw error;
    }
    if (!recorder) {
      boundBindings = current.bindings;
      recorder = createCssoccerOracleRecorder({ fields: contract });
    }
    const expectedTick = recorder.nextTick;
    const snapshot = await capturePostTick({
      tick: expectedTick,
      phase: CSSOCCER_ORACLE_PHASE,
      bindings: boundBindings,
      fields: contract,
    });
    if (!isPlainObject(snapshot)) {
      throw new TypeError("css.soccer browser post-tick capture must return an object.");
    }
    requireExactKeys(snapshot, ["tick", "phase", "values"], "browser post-tick capture");
    if (snapshot.tick !== expectedTick || snapshot.phase !== CSSOCCER_ORACLE_PHASE) {
      throw new Error(
        `css.soccer browser post-tick capture expected (${expectedTick}, ${CSSOCCER_ORACLE_PHASE}).`,
      );
    }
    const samples = recorder.capture(snapshot.tick, snapshot.values);
    return deepFreeze({
      schema: CSSOCCER_BROWSER_ORACLE_SCHEMA,
      tick: snapshot.tick,
      phase: snapshot.phase,
      bindings: boundBindings,
      samples,
    });
  }

  return Object.freeze({
    schema: CSSOCCER_BROWSER_ORACLE_SCHEMA,
    contract,
    status,
    captureNext,
  });
}

export function createCssoccerOracleCandidateHeader({
  streamId,
  generatedAt,
  bindings,
  tickCount,
  fields,
  engineIndependence,
} = {}) {
  requireText(streamId, "css.soccer oracle streamId");
  if (typeof generatedAt !== "string" || !Number.isFinite(Date.parse(generatedAt))) {
    throw new TypeError("css.soccer oracle generatedAt must be a timestamp.");
  }
  requireTick(tickCount, "css.soccer oracle tickCount");
  if (tickCount === 0) throw new RangeError("css.soccer oracle tickCount must be positive.");
  const contract = requireFieldContract(fields);
  const checkedBindings = createCssoccerOracleBindings({
    bindings: {
      nativeScenarioSha256: bindings?.scenarioSha256,
      canonicalProfileSha256: bindings?.profileSha256,
      nativeInputSha256: bindings?.inputSha256,
      nativeSourceSha256: bindings?.sourceSha256,
      nativeBuildSha256: bindings?.buildSha256,
      nativeFieldContractSha256: bindings?.contractSha256,
    },
  });
  if (!isPassingEngineIndependence(engineIndependence, checkedBindings)) {
    throw new Error("css.soccer oracle candidate header needs checked engine independence.");
  }
  return deepFreeze({
    schema: CSSOCCER_PARITY_STREAM_SCHEMA,
    recordType: "header",
    role: "candidate",
    streamId,
    generatedAt,
    bindings: checkedBindings,
    tickRange: { start: 0, count: tickCount },
    phases: [{ id: CSSOCCER_ORACLE_PHASE, order: 0 }],
    fields: contract,
    engineIndependence,
  });
}

function captureStatus({
  status,
  blocker,
  bindings,
  fieldCount,
  nextTick,
  engineIndependence,
}) {
  return deepFreeze({
    schema: CSSOCCER_BROWSER_ORACLE_SCHEMA,
    status,
    firstBlocker: blocker,
    bindings,
    phase: CSSOCCER_ORACLE_PHASE,
    fieldCount,
    nextTick,
    engineIndependence,
  });
}

function isPassingEngineIndependence(value, bindings) {
  return isPlainObject(value)
    && value.schema === "cssoccer-engine-independence@1"
    && value.status === "pass"
    && value.check?.status === "pass"
    && Array.isArray(value.blockers)
    && value.blockers.length === 0
    && value.runtimeSnapshotSha256 === bindings.buildSha256
    && value.preparedInputSha256 === bindings.inputSha256
    && sameOracleBindings(value.bindings, bindings);
}

function requireOracleBindings(value) {
  if (!isPlainObject(value)) {
    throw new TypeError("css.soccer oracle candidate bindings must be an object.");
  }
  return createCssoccerOracleBindings({
    bindings: {
      nativeScenarioSha256: value.scenarioSha256,
      canonicalProfileSha256: value.profileSha256,
      nativeInputSha256: value.inputSha256,
      nativeSourceSha256: value.sourceSha256,
      nativeBuildSha256: value.buildSha256,
      nativeFieldContractSha256: value.contractSha256,
    },
  });
}

function sameOracleBindings(left, right) {
  return isPlainObject(left)
    && Object.keys(right).every((key) => left[key] === right[key])
    && Object.keys(left).length === Object.keys(right).length;
}

function requireFieldContract(fields) {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new TypeError("css.soccer oracle field contract must be a non-empty array.");
  }
  let previousId = "";
  const contract = fields.map((field, index) => {
    requireExactKeys(field, FIELD_KEYS, `oracle field ${index}`);
    requireText(field.id, `oracle field ${index} id`);
    if (previousId && field.id.localeCompare(previousId) <= 0) {
      throw new Error("css.soccer oracle field ids must be unique and lexically ordered.");
    }
    previousId = field.id;
    requireText(field.label, `oracle field ${field.id} label`);
    requireText(field.sourceOwner, `oracle field ${field.id} sourceOwner`);
    requireText(field.meaning, `oracle field ${field.id} meaning`);
    if (field.unit !== null) requireText(field.unit, `oracle field ${field.id} unit`);
    if (!VALUE_TYPES.has(field.valueType)) {
      throw new Error(`oracle field ${field.id} has unsupported value type ${String(field.valueType)}.`);
    }
    return {
      id: field.id,
      label: field.label,
      sourceOwner: field.sourceOwner,
      meaning: field.meaning,
      unit: field.unit,
      valueType: field.valueType,
    };
  });
  return deepFreeze(contract);
}

function requireExactValueSet(values, fields) {
  if (!isPlainObject(values)) {
    throw new TypeError("css.soccer oracle values must be a plain object.");
  }
  const expected = new Set(fields.map((field) => field.id));
  for (const key of Object.keys(values)) {
    if (!expected.has(key)) throw new Error(`css.soccer oracle value ${key} is outside the field contract.`);
  }
  for (const key of expected) {
    if (!Object.hasOwn(values, key)) throw new Error(`css.soccer oracle value ${key} is missing.`);
  }
}

function numericBitsFor(valueType, value, fieldId) {
  if (valueType === "bool") {
    if (typeof value !== "boolean") typedFailure(fieldId, valueType);
    return null;
  }
  if (valueType === "string") {
    if (typeof value !== "string") typedFailure(fieldId, valueType);
    return null;
  }
  if (valueType === "null") {
    if (value !== null) typedFailure(fieldId, valueType);
    return null;
  }

  const width = Number(valueType.slice(1));
  const bytes = new Uint8Array(width / 8);
  const view = new DataView(bytes.buffer);
  if (valueType === "f32" || valueType === "f64") {
    if (typeof value !== "number" || !Number.isFinite(value)) typedFailure(fieldId, valueType);
    if (valueType === "f32" && !Object.is(Math.fround(value), value)) {
      throw new RangeError(`css.soccer oracle value ${fieldId} must already be exactly rounded to f32.`);
    }
    if (valueType === "f32") view.setFloat32(0, value, false);
    else view.setFloat64(0, value, false);
    return bytesToHex(bytes);
  }

  const signed = valueType.startsWith("i");
  if (width === 64) {
    if (typeof value !== "string" || !/^-?(0|[1-9][0-9]*)$/u.test(value) || value === "-0") {
      typedFailure(fieldId, valueType);
    }
    const integer = BigInt(value);
    const minimum = signed ? -(1n << 63n) : 0n;
    const maximum = signed ? (1n << 63n) - 1n : (1n << 64n) - 1n;
    if (integer < minimum || integer > maximum) typedFailure(fieldId, valueType);
    if (signed) view.setBigInt64(0, integer, false);
    else view.setBigUint64(0, integer, false);
    return bytesToHex(bytes);
  }

  if (!Number.isSafeInteger(value)) typedFailure(fieldId, valueType);
  const minimum = signed ? -(2 ** (width - 1)) : 0;
  const maximum = signed ? (2 ** (width - 1)) - 1 : (2 ** width) - 1;
  if (value < minimum || value > maximum) typedFailure(fieldId, valueType);
  const method = `${signed ? "setInt" : "setUint"}${width}`;
  view[method](0, value, false);
  return bytesToHex(bytes);
}

function bytesToHex(bytes) {
  let result = "";
  for (const byte of bytes) result += byte.toString(16).padStart(2, "0");
  return result;
}

function typedFailure(fieldId, valueType) {
  throw new TypeError(`css.soccer oracle value ${fieldId} is not an exact ${valueType}.`);
}

function requireTick(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer.`);
  }
}

function requirePhase(value) {
  if (value !== CSSOCCER_ORACLE_PHASE) {
    throw new Error(`css.soccer oracle phase must be ${CSSOCCER_ORACLE_PHASE}.`);
  }
}

function requireText(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${label} must be non-empty text.`);
  }
}

function requireExactKeys(value, keys, label) {
  if (!isPlainObject(value)) throw new TypeError(`${label} must be a plain object.`);
  const expected = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) throw new Error(`${label}.${key} is not supported.`);
  }
  for (const key of expected) {
    if (!Object.hasOwn(value, key)) throw new Error(`${label}.${key} is required.`);
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
