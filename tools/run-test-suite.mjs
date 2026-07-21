import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const ASSET_TESTS = Object.freeze([
  "cssoccer-assets.test.mjs",
  "cssoccer-source-facts.test.mjs",
  "cssoccer-pitch.test.mjs",
  "cssoccer-render-bundle.test.mjs",
  "cssoccer-actors.test.mjs",
  "cssoccer-fixture-assembler.test.mjs",
]);

const HEAVY_ASSET_TESTS = Object.freeze([
  "cssoccer-actors.test.mjs",
  "cssoccer-fixture-assembler.test.mjs",
]);

const mode = process.argv[2];
if (mode !== "unit" && mode !== "assets") {
  throw new Error("run-test-suite requires exactly unit or assets.");
}

const testRoot = resolve("test");
const files = (await readdir(testRoot))
  .filter((file) => file.endsWith(".test.mjs"))
  .sort();
const assetSet = new Set(ASSET_TESTS);

if (mode === "unit") {
  await run(files.filter((file) => !assetSet.has(file)), { concurrency: 4 });
} else {
  const heavySet = new Set(HEAVY_ASSET_TESTS);
  await run(ASSET_TESTS.filter((file) => !heavySet.has(file)), { concurrency: 4 });
  for (const file of HEAVY_ASSET_TESTS) await run([file], { concurrency: 1 });
}

async function run(selected, { concurrency }) {
  if (selected.length === 0) throw new Error("test suite selected no files.");
  const args = [
    "--test",
    `--test-concurrency=${concurrency}`,
    ...selected.map((file) => resolve(testRoot, file)),
  ];
  const status = await new Promise((resolveStatus, reject) => {
    const child = spawn(process.execPath, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal !== null) reject(new Error(`test runner terminated by ${signal}.`));
      else resolveStatus(code);
    });
  });
  if (status !== 0) process.exit(status ?? 1);
}
