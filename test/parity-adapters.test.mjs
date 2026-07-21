import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

import {
  ENGINE_INDEPENDENCE_SCHEMA,
  PARITY_STREAM_SCHEMA,
  engineIndependenceSubjectSha256,
  parityContractSha256,
  parseParityJsonl,
  sha256Hex,
} from "../src/parity/io.mjs";
import { compareNativeParity, compareNativeParityFiles } from "../src/parity/nativeParity.mjs";
import { buildDifferentialBundle, publishDifferentialBundleAtomic } from "../src/parity/differentialBundle.mjs";
import { loadHistoricalRows, parseArguments } from "../tools/publish-differential-testing.mjs";
import { scanCssoccerFreePlayBoundary } from "../tools/check-free-play-boundary.mjs";
import { createCssoccerFreePlayEngine } from "../src/cssoccer/freePlayEngine.mjs";
import { projectCssoccerFreePlaySnapshot } from "../src/cssoccer/freePlayProjection.mjs";
import { createCssoccerFreePlayState } from "../src/cssoccer/freePlayState.mjs";
import {
  CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256,
} from "../src/cssoccer/nativeFieldContract.mjs";
import {
  CSSOCCER_FREE_PLAY_COMPARISON_BOUNDARY_SCHEMA,
  classifyCssoccerFreePlayComparisonField,
  createCssoccerFreePlayScenarioAdapter,
  serializeCommands,
} from "../tools/support/free-play-scenario-adapter.mjs";

const GENERATED_AT = "2026-07-17T00:01:00.000Z";
const QUALIFIED_AT = "2026-07-17T00:00:00.000Z";
const phases = Object.freeze([
  { id: "input", order: 0 },
  { id: "integrate", order: 1 },
]);
const fields = Object.freeze([
  { id: "alpha", label: "Alpha", sourceOwner: "synthetic/reference", meaning: "Synthetic floating-point adapter field.", unit: null, valueType: "f32" },
  { id: "beta", label: "Beta", sourceOwner: "synthetic/reference", meaning: "Synthetic signed-integer adapter field.", unit: null, valueType: "i32" },
]);
const scenarioSha256 = sha256Hex("synthetic scenario descriptor");
const GENERATED = new URL("../build/generated/public/cssoccer/", import.meta.url);
const FREE_PLAY_FACTS = new URL("facts/spain-argentina-full-match.json", GENERATED);
const FREE_PLAY_SCENE = new URL("scenes/spain-argentina-full-match.json", GENERATED);
const freePlayFixtureOptions = {
  skip: [FREE_PLAY_FACTS, FREE_PLAY_SCENE].some((file) => !existsSync(file))
    ? "prepared cssoccer fixture is unavailable"
    : false,
};

test("free-play scenario adapter advances only through public step(command) and binds a short live trace", freePlayFixtureOptions, async () => {
  const fixture = freePlayFixture();
  const commands = Array.from({ length: 179 }, (_, tick) => ({
    tick,
    moveX: 0,
    moveY: 0,
    buttons: 0,
  }));
  commands.push(
    { tick: 179, moveX: 127, moveY: 0, buttons: 0 },
    { tick: 180, moveX: 0, moveY: 127, buttons: 0 },
  );
  const first = await runFreePlayScenario(fixture, commands);
  const repeated = await runFreePlayScenario(fixture, commands);
  const changed = await runFreePlayScenario(fixture, [
    ...commands.slice(0, 179),
    { tick: 179, moveX: -127, moveY: 0, buttons: 0 },
    commands[180],
  ]);

  assert.equal(first.stepCalls, commands.length);
  assert.deepEqual(first.stepCommands, commands);
  assert.deepEqual(first.trace, repeated.trace, "same bound movement scenario is exact");
  assert.deepEqual(
    first.trace,
    changed.trace,
    "axis-only divergence before contact cannot replace source-owned free-ball intelligence",
  );
  assert.notDeepEqual(first.stepCommands, changed.stepCommands);
  assert.equal(first.complete, true);
  assert.equal(first.nextCommandTick, commands.length);
});

test("free-play scenario adapter rejects missing bindings, gaps, outcomes, and fallback advancement", freePlayFixtureOptions, async () => {
  const fixture = freePlayFixture();
  const commands = [{ tick: 0, moveX: 0, moveY: 0, buttons: 0 }];
  const scenario = freePlayScenario(fixture, commands);
  const engine = createCssoccerFreePlayEngine({ initialState: fixture.initialState });
  const options = {
    cryptoImpl: webcrypto,
    engine,
    projectSnapshot: (snapshot) => projectCssoccerFreePlaySnapshot({
      snapshot,
      preparedScene: fixture.preparedScene,
    }),
    scenario,
  };
  await assert.rejects(
    createCssoccerFreePlayScenarioAdapter({ ...options, expectedNativeValues: {} }),
    /must contain exactly/u,
  );
  await assert.rejects(
    createCssoccerFreePlayScenarioAdapter({
      ...options,
      scenario: {
        ...scenario,
        bindings: { ...scenario.bindings, commandSha256: "0".repeat(64) },
      },
    }),
    /failed its SHA-256 binding/u,
  );
  await assert.rejects(
    createCssoccerFreePlayScenarioAdapter({
      ...options,
      scenario: {
        ...scenario,
        bindings: Object.fromEntries(
          Object.entries(scenario.bindings).filter(([key]) => key !== "seed"),
        ),
      },
    }),
    /must contain exactly/u,
  );
  await assert.rejects(
    createCssoccerFreePlayScenarioAdapter({
      ...options,
      scenario: {
        ...scenario,
        commands: [{ ...commands[0], tick: 1 }],
      },
    }),
    /tick must be 0/u,
  );
  const adapter = await createCssoccerFreePlayScenarioAdapter(options);
  await adapter.stepNext();
  await assert.rejects(adapter.stepNext(), /no fallback command exists/u);
});

test("free-play scenario classifies the pre-loop presentation boundary without reference values", freePlayFixtureOptions, async () => {
  const fixture = freePlayFixture();
  const commands = [
    { tick: 0, moveX: 0, moveY: 0, buttons: 0 },
    { tick: 1, moveX: 0, moveY: 0, buttons: 0 },
  ];
  const engine = createCssoccerFreePlayEngine({ initialState: fixture.initialState });
  const adapter = await createCssoccerFreePlayScenarioAdapter({
    cryptoImpl: webcrypto,
    engine,
    projectSnapshot: (snapshot) => projectCssoccerFreePlaySnapshot({
      snapshot,
      preparedScene: fixture.preparedScene,
    }),
    scenario: freePlayScenario(fixture, commands),
  });

  const initial = await adapter.stepNext();
  assert.equal(
    initial.comparisonBoundary.schema,
    CSSOCCER_FREE_PLAY_COMPARISON_BOUNDARY_SCHEMA,
  );
  assert.equal(initial.comparisonBoundary.kind, "pre-loop-presentation-handoff");
  assert.equal(
    classifyCssoccerFreePlayComparisonField(
      initial.comparisonBoundary,
      "players.argentina-player-01.animation",
    ).kind,
    "native-pre-loop-presentation",
  );
  assert.equal(
    classifyCssoccerFreePlayComparisonField(initial.comparisonBoundary, "rng.seed"),
    null,
  );

  const gameplay = await adapter.stepNext();
  assert.equal(gameplay.comparisonBoundary.kind, "source-gameplay");
  assert.equal(
    classifyCssoccerFreePlayComparisonField(
      gameplay.comparisonBoundary,
      "players.argentina-player-01.animation",
    ),
    null,
  );
});

test("product graph excludes the test adapter and adapter source has no replay drive seam", async () => {
  const scan = await scanCssoccerFreePlayBoundary({ root: resolve(fileURLToPath(new URL("..", import.meta.url))) });
  assert.equal(
    scan.findings.some(({ location }) => location.includes("free-play-scenario-adapter")),
    false,
  );
  const source = readFileSync(
    new URL("../tools/support/free-play-scenario-adapter.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /engine\.capture|sourceInputAtTick|expectedNative|fallback command\s*=|browserMatchEngine/u);
});

test("strict typed JSONL preserves types and bits and rejects broken sequence or qualification bindings", () => {
  const referenceText = makeJsonl({ role: "reference" });
  const reference = parseParityJsonl(referenceText, { label: "synthetic reference" });
  assert.equal(reference.header.fields[0].valueType, "f32");
  assert.equal(reference.samples[0].numericBits, "3f800000");
  assert.equal(reference.artifactSha256, sha256Hex(referenceText));

  const malformed = mutateRecord(referenceText, 1, (record) => ({ ...record, numericBits: "00000000" }));
  assert.throws(() => parseParityJsonl(malformed), /does not encode f32 value/u);

  const reordered = reorderRecords(referenceText, 1, 2);
  assert.throws(() => parseParityJsonl(reordered), /breaks contiguous tick\/phase\/field order/u);

  const qualificationDrift = makeJsonl({
    role: "candidate",
    engineBindingOverrides: { profileSha256: sha256Hex("different profile") },
  });
  assert.throws(() => parseParityJsonl(qualificationDrift), /must exactly match the candidate stream bindings/u);
});

test("comparison requires checked engine independence and selects only the earliest tick/phase/field mismatch", () => {
  const reference = parseParityJsonl(makeJsonl({ role: "reference" }));
  const candidate = parseParityJsonl(makeJsonl({
    role: "candidate",
    mutations: new Map([
      ["11/input/alpha", 6],
      ["11/integrate/beta", 14],
    ]),
  }));
  const comparison = compareNativeParity(reference, candidate);
  assert.equal(comparison.status, "mismatch");
  assert.equal(comparison.mismatchCount, 2);
  assert.deepEqual(
    {
      tick: comparison.earliestMismatch.tick,
      phase: comparison.earliestMismatch.phase,
      fieldId: comparison.earliestMismatch.fieldId,
      reason: comparison.earliestMismatch.reason,
    },
    { tick: 11, phase: "input", fieldId: "alpha", reason: "numeric-bits" },
  );
  assert.equal(comparison.earliestMismatch.reference.valueType, "f32");
  assert.equal(comparison.earliestMismatch.reference.numericBits, "40a00000");
  assert.equal(Object.hasOwn(comparison, "mismatches"), false);
  assert.equal(comparison.bindings.reference.sourceSha256, reference.header.bindings.sourceSha256);
  assert.equal(comparison.bindings.candidate.buildSha256, candidate.header.bindings.buildSha256);

  const blockedCandidate = parseParityJsonl(makeJsonl({ role: "candidate", blockedEngine: true }));
  assert.throws(() => compareNativeParity(reference, blockedCandidate), /zero-substitution-qualification-gap/u);

  const wrongProfile = parseParityJsonl(makeJsonl({
    role: "candidate",
    bindingOverrides: { profileSha256: sha256Hex("different comparison profile") },
  }));
  assert.throws(() => compareNativeParity(reference, wrongProfile), /profileSha256 bindings differ/u);
});

test("scalable bundle validates with the installed public contract and publishes by atomic generation swap", async () => {
  const transport = await installedTransport();
  const comparison = compareNativeParity(
    parseParityJsonl(makeJsonl({ role: "reference" })),
    parseParityJsonl(makeJsonl({
      role: "candidate",
      mutations: new Map([
        ["11/input/alpha", 6],
        ["11/integrate/beta", 14],
      ]),
    })),
  );
  const bundle = buildDifferentialBundle(comparison, { publishedAt: GENERATED_AT, scenarioLabel: "Synthetic adapter mechanics" });
  const root = mkdtempSync(join(tmpdir(), "cssoccer-parity-"));
  try {
    const publication = await publishDifferentialBundleAtomic(bundle, root, {
      validateGeneration: (manifestPath) => transport.assertDifferentialTestingBundle(manifestPath),
    });
    assert.equal(lstatSync(join(root, "current")).isSymbolicLink(), true);
    const validated = transport.assertDifferentialTestingBundle(publication.manifestPath);
    const scenario = transport.readDifferentialTestingBundleScenario(validated, bundle.scenarioId);
    const page = transport.queryDifferentialTestingFieldPage(scenario, { pageSize: 25 });
    assert.equal(page.fields.length, 2);
    assert.equal(page.fields[0].semantics.valueType, "f32");
    assert.match(page.fields[0].samples[0][1], /^f32:[a-f0-9]{8}$/u);
    assert.equal(scenario.data.adapter.typedExact.earliestMismatch.reference.numericBits, "40a00000");

    const retainedGeneration = realpathSync(join(root, "current"));
    const laterBundle = buildDifferentialBundle(comparison, { publishedAt: "2026-07-17T00:02:00.000Z" });
    await assert.rejects(
      publishDifferentialBundleAtomic(laterBundle, root, {
        validateGeneration: () => { throw new Error("synthetic contract rejection"); },
      }),
      /synthetic contract rejection/u,
    );
    assert.equal(realpathSync(join(root, "current")), retainedGeneration);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("atomic publications retain exact-prefix history and unlock frame delta metrics", async () => {
  const transport = await installedTransport();
  const reference = parseParityJsonl(makeJsonl({ role: "reference" }));
  const mismatch = compareNativeParity(reference, parseParityJsonl(makeJsonl({
    role: "candidate",
    mutations: new Map([
      ["11/input/alpha", 6],
      ["11/integrate/beta", 14],
    ]),
  })));
  const pass = compareNativeParity(reference, parseParityJsonl(makeJsonl({ role: "candidate" })));
  const root = mkdtempSync(join(tmpdir(), "cssoccer-history-"));
  try {
    const first = buildDifferentialBundle(mismatch, {
      publishedAt: GENERATED_AT,
      scenarioLabel: "Synthetic retained history",
    });
    await publishDifferentialBundleAtomic(first, root, {
      validateGeneration: (manifestPath) => transport.assertDifferentialTestingBundle(manifestPath),
    });

    const prior = loadHistoricalRows(root, transport, pass);
    assert.equal(prior.length, 1);
    const second = buildDifferentialBundle(pass, {
      publishedAt: "2026-07-17T00:02:00.000Z",
      scenarioLabel: "Synthetic retained history",
      historyRows: prior,
    });
    const publication = await publishDifferentialBundleAtomic(second, root, {
      validateGeneration: (manifestPath) => transport.assertDifferentialTestingBundle(manifestPath),
    });
    const validated = transport.assertDifferentialTestingBundle(publication.manifestPath);
    const scenario = transport.readDifferentialTestingBundleScenario(validated, second.scenarioId);
    assert.deepEqual(scenario.data.progress.map((row) => ({
      value: row.value,
      delta: row.delta,
      frames: row.frames,
      frame: row.frame,
      frameDelta: row.frameDelta,
      result: row.result,
    })), [
      { value: 2, delta: null, frames: 2, frame: 1, frameDelta: null, result: "unchanged" },
      { value: 0, delta: -2, frames: 2, frame: 2, frameDelta: 1, result: "pass" },
    ]);
    assert.deepEqual(
      scenario.data.log.map(({ reportSha256 }) => reportSha256),
      [...scenario.data.progress].reverse().map(({ reportSha256 }) => reportSha256),
    );
    assert.deepEqual(scenario.data.summary.runs, {
      label: "Runs",
      total: 2,
      passed: 1,
      failed: 1,
      blocked: 0,
    });

    const repeated = buildDifferentialBundle(pass, {
      publishedAt: "2026-07-17T00:03:00.000Z",
      scenarioLabel: "Synthetic retained history",
      historyRows: loadHistoricalRows(root, transport, pass),
    });
    const repeatedPublication = await publishDifferentialBundleAtomic(repeated, root, {
      validateGeneration: (manifestPath) => transport.assertDifferentialTestingBundle(manifestPath),
    });
    const repeatedScenario = transport.readDifferentialTestingBundleScenario(
      transport.assertDifferentialTestingBundle(repeatedPublication.manifestPath),
      repeated.scenarioId,
    );
    assert.equal(repeatedScenario.data.progress.length, 2, "same report is not duplicated");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("streaming comparison validates full files while excluding camera from gameplay comparison and bundle", async () => {
  const transport = await installedTransport();
  const streamingFields = Object.freeze([
    ...fields,
    { id: "camera.zoom", label: "Camera zoom", sourceOwner: "synthetic/visual", meaning: "Synthetic camera-only field.", unit: null, valueType: "f32" },
  ]);
  const root = mkdtempSync(join(tmpdir(), "cssoccer-streaming-parity-"));
  const referencePath = join(root, "reference.jsonl");
  const candidatePath = join(root, "candidate.jsonl");
  const referenceText = makeJsonl({ role: "reference", fieldDefinitions: streamingFields });
  const candidateText = makeJsonl({
    role: "candidate",
    fieldDefinitions: streamingFields,
    mutations: new Map([
      ["10/input/camera.zoom", 99],
      ["11/input/alpha", 6],
    ]),
  });
  writeFileSync(referencePath, referenceText);
  writeFileSync(candidatePath, candidateText);
  let comparison;
  let bundle;
  try {
    comparison = await compareNativeParityFiles(referencePath, candidatePath, {
      fieldSelection: {
        schema: "cssoccer-parity-field-selection@1",
        id: "synthetic-gameplay@1",
        includedPrefixes: ["alpha", "beta"],
        excludedPrefixes: ["camera."],
      },
      sampleStoreRoot: join(root, "sample-work"),
      maxBufferedSampleBytes: 64 * 1024,
    });
    assert.equal(comparison.mismatchCount, 1);
    assert.equal(comparison.earliestMismatch.fieldId, "alpha");
    assert.equal(comparison.earliestMismatch.tick, 11);
    assert.equal(comparison.fieldSelection.selectedFieldCount, 2);
    assert.equal(comparison.fieldSelection.excludedFieldCount, 1);
    assert.deepEqual(comparison.fieldSelection.excludedPrefixes, ["camera."]);
    assert.equal(comparison.bindings.reference.artifactSha256, sha256Hex(referenceText));
    assert.equal(comparison.bindings.candidate.artifactSha256, sha256Hex(candidateText));
    assert.equal(comparison.referenceStream.retainedSampleCount, 0);
    assert.equal(comparison.candidateStream.retainedSampleCount, 0);
    assert.equal(comparison.processing.mode, "streaming-lockstep-disk-spool");
    assert.strictEqual(comparison.engineIndependence, comparison.candidateStream.header.engineIndependence);

    bundle = buildDifferentialBundle(comparison, {
      publishedAt: GENERATED_AT,
      workspaceRoot: join(root, "bundle-work"),
    });
    const publication = await publishDifferentialBundleAtomic(bundle, join(root, "published"), {
      validateGeneration: (manifestPath) => transport.assertDifferentialTestingBundle(manifestPath),
    });
    const validated = transport.assertDifferentialTestingBundle(publication.manifestPath);
    const scenario = transport.readDifferentialTestingBundleScenario(validated, bundle.scenarioId);
    const page = transport.queryDifferentialTestingFieldPage(scenario, { pageSize: 25 });
    assert.deepEqual(page.fields.map((field) => field.id), ["alpha", "beta"]);
    assert.equal(page.fields.some((field) => field.id.startsWith("camera.")), false);
    assert.deepEqual(scenario.data.adapter.typedExact.fieldSelection.excludedPrefixes, ["camera."]);
  } finally {
    if (comparison?.sampleStore?.root) rmSync(comparison.sampleStore.root, { recursive: true, force: true });
    if (bundle?.workspaceRoot) rmSync(bundle.workspaceRoot, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test("publisher has no implicit live output or contract module", () => {
  assert.throws(
    () => parseArguments(["--reference", "a", "--candidate", "b", "--output-root", "out"], {}),
    /transportModule is required/u,
  );
});

function makeJsonl({
  role,
  mutations = new Map(),
  bindingOverrides = {},
  engineBindingOverrides = {},
  blockedEngine = false,
  fieldDefinitions = fields,
}) {
  const selectedContractSha256 = parityContractSha256({ phases, fields: fieldDefinitions });
  const bindings = {
    scenarioId: scenarioSha256.slice(0, 16),
    scenarioSha256,
    profileSha256: sha256Hex("synthetic profile"),
    inputSha256: sha256Hex("synthetic input stream"),
    sourceSha256: sha256Hex(`${role} synthetic source`),
    buildSha256: sha256Hex(`${role} synthetic build`),
    contractSha256: selectedContractSha256,
    ...bindingOverrides,
  };
  const header = {
    schema: PARITY_STREAM_SCHEMA,
    recordType: "header",
    role,
    streamId: `${role}-synthetic-stream`,
    generatedAt: GENERATED_AT,
    bindings,
    tickRange: { start: 10, count: 2 },
    phases,
    fields: fieldDefinitions,
    engineIndependence: role === "candidate"
      ? makeEngineIndependence(bindings, { blocked: blockedEngine, bindingOverrides: engineBindingOverrides })
      : null,
  };
  const records = [header];
  for (let tick = 10; tick <= 11; tick += 1) {
    for (const phase of phases) {
      for (const field of fieldDefinitions) {
        const key = `${tick}/${phase.id}/${field.id}`;
        const defaultValue = field.id === "alpha"
          ? 1 + (tick - 10) * 4 + phase.order
          : field.id === "beta"
            ? 10 + (tick - 10) * 2 + phase.order
            : 20 + (tick - 10) * 2 + phase.order;
        const value = mutations.has(key) ? mutations.get(key) : defaultValue;
        records.push({
          schema: PARITY_STREAM_SCHEMA,
          recordType: "sample",
          tick,
          phase: phase.id,
          fieldId: field.id,
          valueType: field.valueType,
          value,
          numericBits: bitsFor(field.valueType, value),
        });
      }
    }
  }
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

function makeEngineIndependence(bindings, { blocked, bindingOverrides }) {
  const bound = { ...bindings, ...bindingOverrides };
  const metadata = {
    schema: ENGINE_INDEPENDENCE_SCHEMA,
    status: blocked ? "blocked" : "pass",
    qualifiedAt: QUALIFIED_AT,
    bindings: bound,
    runtimeSnapshotSha256: bound.buildSha256,
    preparedInputSha256: bound.inputSha256,
    harnessSha256: sha256Hex("synthetic harness"),
    captureAdapterSha256: sha256Hex("synthetic capture adapter"),
    check: {
      status: blocked ? "missing" : "pass",
      id: "synthetic-engine-independence-check@1",
      sha256: sha256Hex("synthetic engine-independence checker"),
      subjectSha256: "0".repeat(64),
    },
    blockers: blocked ? ["Synthetic qualification is deliberately unavailable."] : [],
  };
  metadata.check.subjectSha256 = engineIndependenceSubjectSha256(metadata);
  return metadata;
}

function bitsFor(valueType, value) {
  if (valueType === "f32") {
    const bytes = Buffer.allocUnsafe(4);
    bytes.writeFloatBE(value);
    return bytes.toString("hex");
  }
  if (valueType === "i32") return BigInt.asUintN(32, BigInt(value)).toString(16).padStart(8, "0");
  throw new Error(`Unsupported synthetic value type ${valueType}`);
}

function mutateRecord(text, recordIndex, mutate) {
  const records = text.trimEnd().split("\n").map((line) => JSON.parse(line));
  records[recordIndex] = mutate(records[recordIndex]);
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

function reorderRecords(text, leftIndex, rightIndex) {
  const lines = text.trimEnd().split("\n");
  [lines[leftIndex], lines[rightIndex]] = [lines[rightIndex], lines[leftIndex]];
  return `${lines.join("\n")}\n`;
}

function freePlayFixture() {
  const preparedFacts = JSON.parse(readFileSync(FREE_PLAY_FACTS, "utf8"));
  const preparedScene = JSON.parse(readFileSync(FREE_PLAY_SCENE, "utf8"));
  return Object.freeze({
    preparedFacts,
    preparedScene,
    initialState: createCssoccerFreePlayState({
      preparedFacts,
      preparedScene,
      selectedCountry: "argentina",
    }),
  });
}

function freePlayScenario(fixture, commands) {
  const commandText = serializeCommands(commands);
  return Object.freeze({
    schema: "cssoccer-free-play-command-scenario@1",
    bindings: Object.freeze({
      buildSha256: sha256Hex("free-play adapter test build"),
      commandSha256: sha256Hex(commandText),
      fieldContractSha256: CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256,
      profileSha256: fixture.preparedFacts.bindings.nativeProfileSha256,
      scenarioSha256: fixture.preparedFacts.bindings.nativeScenarioSha256,
      seed: fixture.initialState.rng.initialSeed,
      sourceSha256: sha256Hex("free-play adapter test source"),
      timestepMilliseconds: 50,
    }),
    commands: Object.freeze(commands.map((command) => Object.freeze({ ...command }))),
  });
}

async function runFreePlayScenario(fixture, commands) {
  const inner = createCssoccerFreePlayEngine({ initialState: fixture.initialState });
  const stepCommands = [];
  const engine = {
    schema: inner.schema,
    step(command) {
      stepCommands.push({ ...command });
      return inner.step(command);
    },
    snapshot() {
      return inner.snapshot();
    },
  };
  const adapter = await createCssoccerFreePlayScenarioAdapter({
    cryptoImpl: webcrypto,
    engine,
    projectSnapshot: (snapshot) => projectCssoccerFreePlaySnapshot({
      snapshot,
      preparedScene: fixture.preparedScene,
    }),
    scenario: freePlayScenario(fixture, commands),
  });
  const trace = [];
  while (!adapter.complete) {
    const projection = await adapter.stepNext();
    const snapshot = adapter.snapshot();
    const selected = snapshot.match.players.find(
      ({ id }) => id === snapshot.match.control.activePlayerId,
    );
    trace.push({
      tick: projection.tick,
      snapshotTick: projection.snapshotTick,
      playerId: selected?.id ?? null,
      x: selected?.position.x ?? null,
      y: selected?.position.y ?? null,
      ballX: projection.values["ball.x"],
      ballY: projection.values["ball.y"],
    });
  }
  return {
    trace,
    stepCalls: stepCommands.length,
    stepCommands,
    complete: adapter.complete,
    nextCommandTick: adapter.nextCommandTick,
  };
}

async function installedTransport() {
  const configured = process.env.BURNLIST_DIFFERENTIAL_TESTING_TRANSPORT;
  const specifier = configured
    ? configured.startsWith("/") || configured.startsWith(".")
      ? pathToFileURL(resolve(configured)).href
      : configured
    : pathToFileURL(fileURLToPath(new URL("../../burnlist/ovens/differential-testing/engine/differential-testing-transport.mjs", import.meta.url))).href;
  return import(specifier);
}
