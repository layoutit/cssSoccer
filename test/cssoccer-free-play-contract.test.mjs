import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  CSSOCCER_FREE_PLAY_COMMAND_SCHEMA,
  CSSOCCER_FREE_PLAY_ENGINE_SCHEMA,
  CSSOCCER_FREE_PLAY_TEST_SCENARIO_SCHEMA,
  assertCssoccerFreePlayCommand,
  assertCssoccerFreePlayEngineApi,
  assertCssoccerFreePlayTestScenario,
  assertCssoccerFreePlayTestStepPort,
} from "../src/cssoccer/freePlayContract.mjs";
import {
  assessCssoccerFreePlayBoundary,
  scanCssoccerFreePlayBoundary,
} from "../tools/check-free-play-boundary.mjs";

const HASH = "1".repeat(64);

test("free-play production commands and engine API are exact and live-only", () => {
  const command = assertCssoccerFreePlayCommand({
    tick: 7,
    moveX: -90,
    moveY: 90,
    buttons: 3,
  }, { expectedTick: 7 });
  assert.deepEqual(command, { tick: 7, moveX: -90, moveY: 90, buttons: 3 });
  assert.equal(Object.isFrozen(command), true);

  const engine = {
    schema: CSSOCCER_FREE_PLAY_ENGINE_SCHEMA,
    step() {},
    snapshot() {},
  };
  assert.equal(assertCssoccerFreePlayEngineApi(engine), engine);
  assert.throws(
    () => assertCssoccerFreePlayEngineApi({ ...engine, capture() {} }),
    /must contain exactly/u,
  );
  assert.throws(
    () => assertCssoccerFreePlayCommand({ ...command, state: {} }),
    /must contain exactly/u,
  );
  assert.throws(
    () => assertCssoccerFreePlayCommand({ ...command, buttons: 64 }),
    /unsupported bits/u,
  );
  assert.equal(CSSOCCER_FREE_PLAY_COMMAND_SCHEMA, "cssoccer-free-play-command@1");
});

test("test scenarios contain bound commands only and expose only step(command)", () => {
  const stepPort = { step() {} };
  assert.equal(assertCssoccerFreePlayTestStepPort(stepPort), stepPort);
  assert.throws(
    () => assertCssoccerFreePlayTestStepPort({ ...stepPort, injectState() {} }),
    /must contain exactly step/u,
  );

  const scenario = {
    schema: CSSOCCER_FREE_PLAY_TEST_SCENARIO_SCHEMA,
    bindings: {
      sourceSha256: HASH,
      buildSha256: HASH,
      scenarioSha256: HASH,
      commandSha256: HASH,
      fieldContractSha256: HASH,
      profileSha256: HASH,
      seed: 3523,
      timestepMilliseconds: 50,
    },
    commands: [
      { tick: 0, moveX: 0, moveY: 0, buttons: 0 },
      { tick: 1, moveX: 127, moveY: 0, buttons: 2 },
    ],
  };
  const accepted = assertCssoccerFreePlayTestScenario(scenario);
  assert.equal(accepted.commands.length, 2);
  assert.equal(Object.isFrozen(accepted.bindings), true);
  assert.throws(
    () => assertCssoccerFreePlayTestScenario({ ...scenario, state: {} }),
    /must contain exactly/u,
  );
  assert.throws(
    () => assertCssoccerFreePlayTestScenario({
      ...scenario,
      commands: [{ ...scenario.commands[0], expectedState: {} }],
    }),
    /must contain exactly/u,
  );
  assert.throws(
    () => assertCssoccerFreePlayTestScenario({
      ...scenario,
      commands: [{ ...scenario.commands[0], tick: 1 }],
    }),
    /tick must be 0/u,
  );
});

test("boundary scanner follows production graphs and accepts a clean generated bundle", async (t) => {
  const root = await createScannerFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFixtureFile(root, "src/cssoccer/unreachableReplay.mjs", `
    export const schema = "cssoccer-neutral-command-stream@1";
  `);

  const scan = await scanCssoccerFreePlayBoundary({ root });
  assert.equal(scan.findings.length, 0);
  assert.equal(assessCssoccerFreePlayBoundary(scan.findings, { mode: "check" }).status, "pass");
});

test("boundary scanner inventories dependency edges, source semantics, publication, and bundle", async (t) => {
  const root = await createScannerFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFixtureFile(root, "src/cssoccer/main.mjs", `
    import "./browserMatchEngine.mjs";
  `);
  await writeFixtureFile(root, "src/cssoccer/browserMatchEngine.mjs", `
    export const commandSchema = "cssoccer-neutral-command-stream@1";
    let driveMode = null;
    export function sourceInputAtTick() { return driveMode; }
  `);
  await writeFixtureFile(root, "src/prepare/cssoccer/fixtureAssembler.mjs", `
    export const prepared = { nativeInputSha256: "${HASH}" };
  `);
  await writeFixtureJson(root, "references/spain-argentina-match.json", {
    fixture: { input: { commands: [] }, inputBindingSha256: HASH },
  });
  await writeFixtureJson(
    root,
    "build/generated/public/cssoccer/facts/spain-argentina-full-match.json",
    { input: { commands: [] }, bindings: { nativeInputSha256: HASH } },
  );
  await writeFixtureFile(root, "dist/assets/index-fixture.js", `
    const schema = "cssoccer-neutral-command-stream@1";
    const nativeInputSha256 = "${HASH}";
    globalThis.captureOraclePostTick = () => schema + nativeInputSha256;
  `);

  const scan = await scanCssoccerFreePlayBoundary({ root });
  const ruleIds = new Set(scan.findings.map(({ ruleId }) => ruleId));
  for (const expected of [
    "dependency-browser-match-engine",
    "source-neutral-command-schema",
    "source-command-fallback",
    "source-dual-drive-mode",
    "prepare-native-input-binding",
    "reference-prepared-command-stream",
    "reference-native-input-binding",
    "generated-prepared-command-stream",
    "generated-native-input-binding",
    "bundle-neutral-command-schema",
    "bundle-native-input-binding",
    "bundle-debug-capture-control",
  ]) assert.equal(ruleIds.has(expected), true, expected);
  assert.equal(assessCssoccerFreePlayBoundary(scan.findings, { mode: "check" }).status, "fail");
  assert.throws(
    () => assessCssoccerFreePlayBoundary(scan.findings, { mode: "expect-migration" }),
    /Unknown boundary assessment mode/u,
  );
});

async function createScannerFixture() {
  const root = await mkdtemp(join(tmpdir(), "cssoccer-free-play-boundary-"));
  await writeFixtureFile(root, "src/cssoccer/main.mjs", `import "./clean.mjs";`);
  await writeFixtureFile(root, "src/cssoccer/clean.mjs", `export const clean = true;`);
  await writeFixtureFile(
    root,
    "src/prepare/cssoccer/fixtureAssembler.mjs",
    `export const cleanPrepare = true;`,
  );
  await writeFixtureJson(root, "references/spain-argentina-match.json", { fixture: {} });
  await writeFixtureJson(
    root,
    "build/generated/public/cssoccer/facts/spain-argentina-full-match.json",
    { fixture: {} },
  );
  await writeFixtureFile(
    root,
    "dist/index.html",
    `<script type="module" src="/assets/index-fixture.js"></script>`,
  );
  await writeFixtureFile(root, "dist/assets/index-fixture.js", `export const clean = true;`);
  return root;
}

async function writeFixtureJson(root, path, value) {
  await writeFixtureFile(root, path, `${JSON.stringify(value)}\n`);
}

async function writeFixtureFile(root, path, source) {
  const absolutePath = join(root, path);
  await mkdir(join(absolutePath, ".."), { recursive: true });
  await writeFile(absolutePath, source);
}
