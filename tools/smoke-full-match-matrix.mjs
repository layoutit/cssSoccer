#!/usr/bin/env node
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SMOKE = join(REPO_ROOT, "tools", "smoke-browser.mjs");
const cases = Object.freeze([
  { id: "spain-desktop", country: "spain", port: 5201, viewport: "1440x900", coarsePointer: false },
  { id: "argentina-touch", country: "argentina", port: 5203, viewport: "390x844", coarsePointer: true },
]);

const running = new Set();
try {
  const results = await Promise.all(cases.map(runCase));
  console.log(JSON.stringify({
    status: "pass",
    schema: "cssoccer-full-match-alpha-input-layout-matrix@1",
    cases: results,
  }, null, 2));
} finally {
  for (const child of running) child.kill("SIGKILL");
}

function runCase(testCase) {
  return new Promise((resolve, reject) => {
    const args = [
      SMOKE,
      "--port", String(testCase.port),
      "--country", testCase.country,
      "--viewport", testCase.viewport,
      "--timeout-ms", "120000",
      ...(testCase.coarsePointer ? ["--coarse-pointer"] : []),
    ];
    const child = spawn(process.execPath, args, {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    running.add(child);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      running.delete(child);
      if (code !== 0) {
        reject(new Error(`${testCase.id} failed (${code ?? signal}):\n${stderr}\n${stdout}`));
        return;
      }
      try {
        const report = JSON.parse(stdout);
        if (report.status !== "pass" || report.country !== testCase.country) {
          throw new Error(`unexpected report ${stdout}`);
        }
        resolve({
          id: testCase.id,
          country: report.country,
          viewport: report.viewport,
          coarsePointer: report.input.coarsePointer,
          keyboardKeyCount: report.interactions.keyboardMatrix.keyCount,
          keyboardChordCount: report.interactions.keyboardMatrix.chordCount,
          liveTick: report.interactions.livePerformanceRecording.agency.tick,
          rootCount: report.rootCounts.total,
          pageErrors: report.pageErrors,
        });
      } catch (error) {
        reject(new Error(`${testCase.id} emitted an invalid report: ${String(error)}`));
      }
    });
  });
}
