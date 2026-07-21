import { assertCssoccerFreePlayTestScenario } from "./freePlayContract.mjs";
import { assertCssoccerFreePlayState } from "./freePlayState.mjs";

export const CSSOCCER_FREE_PLAY_CANDIDATE_IDENTITY_SCHEMA =
  "cssoccer-browser-candidate-identity@1";
export const CSSOCCER_FREE_PLAY_ENGINE_INDEPENDENCE_CHECK_ID =
  "cssoccer-free-play-engine-independence-v1";

const SHA256 = /^[a-f0-9]{64}$/u;
const CHECK_KEYS = Object.freeze([
  "browserOwnedState",
  "nativeReplayReads",
  "preparedInputOnly",
  "retainedStateReads",
  "sourceCheckoutReads",
]);
const IDENTITY_KEYS = Object.freeze([
  "schema",
  "qualifiedAt",
  "sourceSha256",
  "buildSha256",
  "harnessSha256",
  "captureAdapterSha256",
  "checks",
]);

export async function qualifyCssoccerFreePlayEngineIndependence({
  freePlayState,
  scenario,
  candidateIdentity,
  nativeIdentity,
  cryptoImpl = globalThis.crypto,
} = {}) {
  const identity = requireCandidateIdentity(candidateIdentity);
  const initialState = assertCssoccerFreePlayState(freePlayState);
  const boundScenario = assertCssoccerFreePlayTestScenario(scenario);
  const native = requireNativeIdentity(nativeIdentity);
  if (!cryptoImpl?.subtle || typeof cryptoImpl.subtle.digest !== "function") {
    throw new Error("Free-play engine independence requires Web Crypto SHA-256.");
  }
  if (
    identity.sourceSha256 === native.sourceSha256
    || identity.buildSha256 === native.buildSha256
  ) {
    throw new Error("Free-play candidate source/build identity must differ from the native oracle.");
  }
  if (
    boundScenario.bindings.sourceSha256 !== identity.sourceSha256
    || boundScenario.bindings.buildSha256 !== identity.buildSha256
  ) {
    throw new Error("Free-play scenario source/build bindings diverged from the candidate identity.");
  }
  if (
    boundScenario.bindings.seed !== initialState.rng.initialSeed
    || boundScenario.bindings.timestepMilliseconds
      !== initialState.config.sourceConstants.timestepMilliseconds
  ) {
    throw new Error("Free-play scenario seed/timestep bindings diverged from initial state.");
  }
  const bindings = deepFreeze({
    scenarioId: boundScenario.bindings.scenarioSha256.slice(0, 16),
    scenarioSha256: boundScenario.bindings.scenarioSha256,
    profileSha256: boundScenario.bindings.profileSha256,
    inputSha256: boundScenario.bindings.commandSha256,
    sourceSha256: boundScenario.bindings.sourceSha256,
    buildSha256: boundScenario.bindings.buildSha256,
    contractSha256: boundScenario.bindings.fieldContractSha256,
  });
  const metadata = {
    schema: "cssoccer-engine-independence@1",
    status: "pass",
    qualifiedAt: identity.qualifiedAt,
    bindings,
    runtimeSnapshotSha256: bindings.buildSha256,
    preparedInputSha256: bindings.inputSha256,
    harnessSha256: identity.harnessSha256,
    captureAdapterSha256: identity.captureAdapterSha256,
    blockers: [],
  };
  const subjectSha256 = await sha256Text(canonicalJson(metadata), cryptoImpl);
  const checkSha256 = await sha256Text(canonicalJson({
    schema: "cssoccer-free-play-engine-independence-check@1",
    id: CSSOCCER_FREE_PLAY_ENGINE_INDEPENDENCE_CHECK_ID,
    subjectSha256,
    checks: identity.checks,
  }), cryptoImpl);
  return deepFreeze({
    ...metadata,
    check: {
      status: "pass",
      id: CSSOCCER_FREE_PLAY_ENGINE_INDEPENDENCE_CHECK_ID,
      sha256: checkSha256,
      subjectSha256,
    },
  });
}

function requireCandidateIdentity(value) {
  requirePlainObject(value, "free-play candidate identity");
  requireExactKeys(value, IDENTITY_KEYS, "free-play candidate identity");
  if (value.schema !== CSSOCCER_FREE_PLAY_CANDIDATE_IDENTITY_SCHEMA) {
    throw new Error(
      `Free-play candidate identity must use ${CSSOCCER_FREE_PLAY_CANDIDATE_IDENTITY_SCHEMA}.`,
    );
  }
  if (typeof value.qualifiedAt !== "string" || !Number.isFinite(Date.parse(value.qualifiedAt))) {
    throw new TypeError("Free-play candidate identity qualifiedAt must be a timestamp.");
  }
  for (const key of [
    "sourceSha256",
    "buildSha256",
    "harnessSha256",
    "captureAdapterSha256",
  ]) {
    if (!SHA256.test(value[key] ?? "")) {
      throw new TypeError(`Free-play candidate identity ${key} must be SHA-256.`);
    }
  }
  requirePlainObject(value.checks, "free-play candidate identity checks");
  requireExactKeys(value.checks, CHECK_KEYS, "free-play candidate identity checks");
  if (
    value.checks.browserOwnedState !== true
    || value.checks.preparedInputOnly !== true
    || value.checks.nativeReplayReads !== 0
    || value.checks.retainedStateReads !== 0
    || value.checks.sourceCheckoutReads !== 0
  ) {
    throw new Error("Free-play candidate identity did not pass zero-substitution checks.");
  }
  return deepFreeze(clone(value));
}

function requireNativeIdentity(value) {
  requirePlainObject(value, "native oracle identity");
  requireExactKeys(value, ["buildSha256", "sourceSha256"], "native oracle identity");
  for (const key of ["buildSha256", "sourceSha256"]) {
    if (!SHA256.test(value[key] ?? "")) {
      throw new TypeError(`Native oracle identity ${key} must be SHA-256.`);
    }
  }
  return value;
}

async function sha256Text(value, cryptoImpl) {
  const digest = await cryptoImpl.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function requireExactKeys(value, expected, label) {
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(keys) !== JSON.stringify(wanted)) {
    throw new Error(`${label} must contain exactly ${wanted.join(", ")}.`);
  }
}

function requirePlainObject(value, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype
      && Object.getPrototypeOf(value) !== null)
  ) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
  }
  return value;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
