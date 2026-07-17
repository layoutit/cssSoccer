const DEFAULT_MAX_DEPTH = 8;
const DEFAULT_MAX_NODES = 8_000;
const DEFAULT_MAX_RECORDS = 512;

/**
 * A disabled-by-default call tracer used only inside the runner's temporary
 * browser-engine copy. It never enters the product runtime or its capture.
 */
export function createDifferentialFrontierTraceController() {
  let config = null;
  let records = [];
  let order = 0;
  let callDepth = 0;
  let truncated = false;

  return Object.freeze({
    configure(next) {
      if (next === null) {
        config = null;
        return;
      }
      if (!next || typeof next !== "object" || typeof next.entityId !== "string") {
        throw new TypeError("Differential frontier trace requires an entityId.");
      }
      config = Object.freeze({
        entityId: next.entityId,
        nativePlayerNumber: Number.isSafeInteger(next.nativePlayerNumber)
          ? next.nativePlayerNumber
          : null,
        maxDepth: boundedInteger(next.maxDepth, DEFAULT_MAX_DEPTH, 1, 16),
        maxNodes: boundedInteger(next.maxNodes, DEFAULT_MAX_NODES, 100, 100_000),
        maxRecords: boundedInteger(next.maxRecords, DEFAULT_MAX_RECORDS, 1, 4_096),
      });
      records = [];
      order = 0;
      callDepth = 0;
      truncated = false;
    },

    read() {
      return clone({
        schema: "cssoccer-differential-frontier-call-trace@1",
        status: config === null ? "disabled" : "captured",
        entityId: config?.entityId ?? null,
        nativePlayerNumber: config?.nativePlayerNumber ?? null,
        truncated,
        records,
      });
    },

    wrap(metadata, fn) {
      if (
        !metadata
        || typeof metadata.name !== "string"
        || !Number.isSafeInteger(metadata.line)
        || typeof fn !== "function"
      ) {
        throw new TypeError("Differential frontier trace wrapper metadata is invalid.");
      }
      return function differentialFrontierTracedCall(...args) {
        if (config === null) return Reflect.apply(fn, this, args);
        const depth = callDepth;
        const input = findEntity(args, config);
        callDepth += 1;
        let result;
        try {
          result = Reflect.apply(fn, this, args);
        } finally {
          callDepth -= 1;
        }
        const output = findEntity(result, config);
        if (input !== null || output !== null) {
          if (records.length >= config.maxRecords) {
            truncated = true;
          } else {
            records.push(Object.freeze({
              order: order += 1,
              callDepth: depth,
              function: metadata.name,
              line: metadata.line,
              input,
              output,
            }));
          }
        }
        return result;
      };
    },
  });
}

function findEntity(root, config) {
  const seen = new WeakSet();
  const queue = [{ value: root, depth: 0, path: "$" }];
  let cursor = 0;
  let visited = 0;
  let best = null;
  while (cursor < queue.length && visited < config.maxNodes) {
    const { value, depth, path } = queue[cursor];
    cursor += 1;
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    visited += 1;
    if (matchesEntity(value, config)) {
      const candidate = Object.freeze({
        depth,
        path,
        snapshot: snapshot(value),
      });
      if (best === null || candidate.depth < best.depth) best = candidate;
      if (candidate.depth === 0) break;
    }
    if (depth >= config.maxDepth || (best !== null && depth >= best.depth)) continue;
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        queue.push({ value: value[index], depth: depth + 1, path: `${path}[${index}]` });
      }
      continue;
    }
    for (const [key, child] of Object.entries(value)) {
      queue.push({ value: child, depth: depth + 1, path: `${path}.${key}` });
    }
  }
  return best;
}

function matchesEntity(value, config) {
  return value.id === config.entityId
    || value.stableId === config.entityId
    || (
      config.nativePlayerNumber !== null
      && value.nativePlayerNumber === config.nativePlayerNumber
    );
}

function snapshot(player) {
  const output = {};
  for (const key of [
    "id",
    "stableId",
    "nativePlayerNumber",
    "action",
    "actionId",
    "animation",
    "animationFrame",
    "animationFrameStep",
    "ballState",
    "control",
    "directionMode",
    "distance",
    "distanceRank",
    "goCount",
    "goDistance",
    "goStep",
    "intelligenceCount",
    "limbo",
    "on",
    "possessionTicks",
  ]) {
    if (isScalar(player[key])) output[key] = player[key];
  }
  for (const key of [
    "position",
    "displacement",
    "facing",
    "goDisplacement",
    "goTarget",
    "mustFace",
  ]) {
    const vector = scalarObject(player[key]);
    if (vector !== null) output[key] = vector;
  }
  return Object.freeze(output);
}

function scalarObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value).filter(([, child]) => isScalar(child));
  return entries.length === 0 ? null : Object.freeze(Object.fromEntries(entries));
}

function isScalar(value) {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function boundedInteger(value, fallback, minimum, maximum) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`Differential frontier trace limit must be ${minimum}..${maximum}.`);
  }
  return value;
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
  }
  return value;
}
