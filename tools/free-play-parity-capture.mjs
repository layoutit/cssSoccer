import {
  qualifyCssoccerFreePlayEngineIndependence,
} from "../src/cssoccer/freePlayEngineIndependence.mjs";
import {
  assertCssoccerFreePlayTestScenario,
} from "../src/cssoccer/freePlayContract.mjs";
import { projectCssoccerFreePlaySnapshot } from "../src/cssoccer/freePlayProjection.mjs";
import { createCssoccerFreePlayState } from "../src/cssoccer/freePlayState.mjs";
import { CSSOCCER_NATIVE_FIELDS } from "../src/cssoccer/nativeFieldContract.mjs";
import { createCssoccerOracleTick } from "../src/cssoccer/oracleState.mjs";
import {
  serializeCommands,
} from "./support/free-play-scenario-adapter.mjs";

const FIXTURE_ID = "spain-argentina-full-match";
const MANIFEST_URL = "/cssoccer/manifest.json";

/**
 * Install a test-only bound command scenario around the already-mounted
 * product. The retained command stream enters through the product's bound
 * visual-capture command port, while the mounted engine still owns every
 * simulation, render, HUD, and exact-asset publication.
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
  if (inputAdapter !== null) {
    throw new Error("Mounted browser parity consumes the retained command stream directly.");
  }
  const debug = target?.__cssoccerDebug;
  const initialProduct = debug?.inspect?.();
  if (
    initialProduct?.ready !== true
    || initialProduct.status !== "ready"
    || initialProduct.fixtureId !== FIXTURE_ID
    || initialProduct.controlCountry !== country
    || initialProduct.live?.tick !== 0
    || initialProduct.engine?.tick !== 0
    || initialProduct.mount?.rootCount !== 37
    || typeof debug.beginVisualCapture !== "function"
    || typeof debug.stepVisualCaptureCommand !== "function"
  ) {
    throw new Error("Mounted browser parity requires the ready canonical product at tick zero.");
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
  const scenario = assertCssoccerFreePlayTestScenario(commandScenario);
  const commandSha256 = await sha256(
    new TextEncoder().encode(serializeCommands(scenario.commands)),
    cryptoImpl,
  );
  if (commandSha256 !== scenario.bindings.commandSha256) {
    throw new Error("Mounted browser parity command stream failed its SHA-256 binding.");
  }

  debug.beginVisualCapture();
  let cursor = 0;

  function scenarioStatus() {
    return Object.freeze({
      schema: "cssoccer-mounted-browser-free-play-scenario@1",
      status: cursor === scenario.commands.length ? "complete" : "ready",
      bindings: engineIndependence.bindings,
      commandBindings: scenario.bindings,
      nextTick: cursor,
      commandCount: scenario.commands.length,
      phase: "post_tick",
      fieldCount: CSSOCCER_NATIVE_FIELDS.length,
      driver: "mounted-bound-commands-and-product-visual-capture-clock",
      engineIndependence,
    });
  }

  async function stepScenario() {
    if (cursor >= scenario.commands.length) {
      throw new Error("Mounted browser parity command scenario is complete.");
    }
    const command = scenario.commands[cursor];
    const before = debug.inspect();
    if (
      command.tick !== cursor
      || before.live?.tick !== command.tick
      || before.engine?.tick !== command.tick
      || debug.match?.tick !== command.tick
    ) {
      throw new Error(
        `Mounted browser parity diverged before command ${command.tick}: `
          + JSON.stringify({
            cursor,
            liveTick: before.live?.tick,
            engineTick: before.engine?.tick,
            matchTick: debug.match?.tick,
          }),
      );
    }
    const advanced = await debug.stepVisualCaptureCommand(command);
    const after = debug.inspect();
    const actualCommand = after.input?.lastCommand;
    if (
      advanced?.tick !== command.tick + 1
      || after.live?.tick !== command.tick + 1
      || after.engine?.tick !== command.tick + 1
      || actualCommand?.tick !== command.tick
      || actualCommand.moveX !== command.moveX
      || actualCommand.moveY !== command.moveY
      || actualCommand.buttons !== command.buttons
    ) {
      throw new Error(
        `Mounted browser parity publication diverged at command ${command.tick}: `
          + JSON.stringify({ advanced, actualCommand, live: after.live, engine: after.engine }),
      );
    }
    const match = debug.match;
    const projection = projectCssoccerFreePlaySnapshot({
      snapshot: Object.freeze({
        schema: "cssoccer-free-play-snapshot@1",
        tick: match.tick,
        match,
      }),
      preparedScene,
      fields: CSSOCCER_NATIVE_FIELDS,
    });
    cursor += 1;
    return Object.freeze({
      schema: "cssoccer-mounted-browser-free-play-scenario@1",
      tick: command.tick,
      snapshotTick: projection.snapshotTick,
      phase: projection.phase,
      values: projection.values,
      bindings: engineIndependence.bindings,
      presentation: Object.freeze({
        camera: Object.freeze({ ...after.mount.camera }),
        control: Object.freeze({
          activePlayerId: match.control.activePlayerId,
          selectedPlayerId: after.live.selectedPlayerId,
          highlightVisible: after.live.playerHighlight.visible,
          highlightPlayerId: after.live.playerHighlight.playerId,
          highlightType: after.live.playerHighlight.type,
        }),
      }),
      samples: createCssoccerOracleTick({
        tick: command.tick,
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
      const product = debug.inspect();
      return Object.freeze({
        ...product,
        scenarioKind: "mounted-product-bound-command-scenario",
        harnessPreparedRequests: Object.freeze([...requests]),
        freePlayEngine: Object.freeze({
          schema: product.engine?.schema ?? null,
          tick: product.engine?.tick ?? null,
          nextCommandTick: cursor,
          complete: cursor === scenario.commands.length,
        }),
        exactPlayerAssets: debug.exactPlayerAssetStats?.() ?? null,
        scenario: scenarioStatus(),
      });
    },
  });
  Object.defineProperty(target, "__cssoccerParityCapture", {
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
