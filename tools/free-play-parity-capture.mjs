import {
  qualifyCssoccerFreePlayEngineIndependence,
} from "../src/cssoccer/freePlayEngineIndependence.mjs";
import { createCssoccerFreePlayEngine } from "../src/cssoccer/freePlayEngine.mjs";
import { projectCssoccerFreePlaySnapshot } from "../src/cssoccer/freePlayProjection.mjs";
import { createCssoccerFreePlayState } from "../src/cssoccer/freePlayState.mjs";
import { CSSOCCER_NATIVE_FIELDS } from "../src/cssoccer/nativeFieldContract.mjs";
import { createCssoccerOracleTick } from "../src/cssoccer/oracleState.mjs";
import {
  createCssoccerFreePlayScenarioAdapter,
} from "./support/free-play-scenario-adapter.mjs";

const FIXTURE_ID = "spain-argentina-full-match";
const MANIFEST_URL = "/cssoccer/manifest.json";

/**
 * Install a test-only bound command scenario around the public free-play
 * engine. The adapter receives commands and immutable identity only; native
 * values and expected outcomes never enter the browser runtime.
 */
export async function installCssoccerFreePlayParityCapture({
  candidateIdentity,
  commandScenario,
  country,
  inputAdapter,
  nativeIdentity,
  cryptoImpl = globalThis.crypto,
  fetchImpl = globalThis.fetch,
  target = globalThis,
} = {}) {
  if (country !== "argentina" && country !== "spain") {
    throw new Error("Browser free-play scenario country must be argentina or spain.");
  }
  if (typeof fetchImpl !== "function") {
    throw new TypeError("Browser free-play scenario requires fetch.");
  }

  const requests = [];
  const manifest = await fetchJson(MANIFEST_URL, { fetchImpl, requests });
  if (manifest?.schema !== "cssoccer-prepared-manifest@1" || manifest.status !== "ready") {
    throw new Error("Browser free-play scenario requires the ready prepared manifest.");
  }
  const sceneDescriptor = manifest.scenes?.find(({ id }) => id === FIXTURE_ID);
  if (sceneDescriptor === undefined) {
    throw new Error(`Prepared manifest has no ${FIXTURE_ID} scene.`);
  }
  const preparedScene = await fetchBoundJson(sceneDescriptor.sceneUrl, sceneDescriptor.sha256, {
    cryptoImpl,
    fetchImpl,
    requests,
  });
  const factsPath = preparedScene?.preparedFiles?.facts?.path;
  const factsDescriptor = manifest.preparedFiles?.find(({ path }) => path === factsPath);
  if (
    factsDescriptor === undefined
    || factsDescriptor.sha256 !== preparedScene.preparedFiles.facts.sha256
  ) {
    throw new Error("Prepared scene/facts binding diverged from the manifest.");
  }
  const preparedFacts = await fetchBoundJson(factsDescriptor.url, factsDescriptor.sha256, {
    cryptoImpl,
    fetchImpl,
    requests,
  });
  const initialState = createCssoccerFreePlayState({
    preparedFacts,
    preparedScene,
    selectedCountry: country,
  });
  const engineIndependence = await qualifyCssoccerFreePlayEngineIndependence({
    freePlayState: initialState,
    scenario: commandScenario,
    candidateIdentity,
    nativeIdentity,
    cryptoImpl,
  });
  const engine = createCssoccerFreePlayEngine({ initialState });
  const adapter = await createCssoccerFreePlayScenarioAdapter({
    cryptoImpl,
    engine,
    inputAdapter,
    projectSnapshot: (snapshot) => projectCssoccerFreePlaySnapshot({
      snapshot,
      preparedScene,
      fields: CSSOCCER_NATIVE_FIELDS,
    }),
    scenario: commandScenario,
  });
  const requestSnapshot = Object.freeze({
    preparedRequestCount: requests.length,
    nativeRequestCount: 0,
    sourceRequestCount: 0,
    rejectedRequestCount: 0,
    urls: Object.freeze([...requests]),
  });

  function scenarioStatus() {
    return Object.freeze({
      schema: "cssoccer-browser-free-play-scenario@1",
      status: adapter.complete ? "complete" : "ready",
      bindings: engineIndependence.bindings,
      commandBindings: adapter.bindings,
      nextTick: adapter.nextCommandTick,
      commandCount: adapter.commandCount,
      phase: "post_tick",
      fieldCount: CSSOCCER_NATIVE_FIELDS.length,
      engineIndependence,
    });
  }

  async function stepScenario() {
    const projection = await adapter.stepNext();
    return Object.freeze({
      schema: "cssoccer-browser-free-play-scenario@1",
      tick: projection.tick,
      snapshotTick: projection.snapshotTick,
      phase: projection.phase,
      bindings: engineIndependence.bindings,
      samples: createCssoccerOracleTick({
        tick: projection.tick,
        phase: projection.phase,
        fields: CSSOCCER_NATIVE_FIELDS,
        values: projection.values,
      }),
    });
  }

  const api = Object.freeze({
    ready: true,
    status: "ready",
    controlCountry: country,
    errors: () => Object.freeze([]),
    freePlayScenarioStatus: scenarioStatus,
    freePlayFieldContract: () => CSSOCCER_NATIVE_FIELDS,
    stepFreePlayScenario: stepScenario,
    inspect() {
      const snapshot = engine.snapshot();
      return Object.freeze({
        ready: true,
        status: "ready",
        scenarioKind: "test-only-bound-command-scenario",
        fixtureId: FIXTURE_ID,
        controlCountry: country,
        pageErrorCount: 0,
        requests: requestSnapshot,
        mount: null,
        match: Object.freeze({
          tick: snapshot.tick,
          phase: snapshot.phase,
          selectedCountry: snapshot.match.config.controlCountry,
        }),
        freePlayEngine: Object.freeze({
          schema: engine.schema,
          tick: snapshot.tick,
          nextCommandTick: adapter.nextCommandTick,
          complete: adapter.complete,
        }),
        scenario: scenarioStatus(),
      });
    },
  });
  Object.defineProperty(target, "__cssoccerDebug", {
    configurable: true,
    enumerable: false,
    value: api,
  });
  return api.inspect();
}

async function fetchJson(url, { fetchImpl, requests }) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Prepared request ${url} returned ${response.status}.`);
  requests.push(new URL(response.url || url, globalThis.location?.href).pathname);
  return response.json();
}

async function fetchBoundJson(url, expectedSha256, {
  cryptoImpl,
  fetchImpl,
  requests,
}) {
  if (!/^[a-f0-9]{64}$/u.test(expectedSha256 ?? "")) {
    throw new Error(`Prepared request ${url} has no SHA-256 binding.`);
  }
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Prepared request ${url} returned ${response.status}.`);
  const bytes = await response.arrayBuffer();
  const actualSha256 = await sha256(bytes, cryptoImpl);
  if (actualSha256 !== expectedSha256) {
    throw new Error(`Prepared request ${url} failed its SHA-256 binding.`);
  }
  requests.push(new URL(response.url || url, globalThis.location?.href).pathname);
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function sha256(bytes, cryptoImpl) {
  if (!cryptoImpl?.subtle || typeof cryptoImpl.subtle.digest !== "function") {
    throw new Error("Browser free-play scenario requires Web Crypto SHA-256.");
  }
  const digest = await cryptoImpl.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
