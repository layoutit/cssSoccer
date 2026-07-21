#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseCssoccerAnimationTable } from
  "../src/prepare/cssoccer/animationTable.mjs";
import { prepareCssoccerExactActuaPlayerGeometry } from
  "../src/prepare/cssoccer/exactActuaPlayerGeometry.mjs";
import { prepareExactActuaPlayerModel } from
  "../src/prepare/cssoccer/exactActuaPlayerModel.mjs";
import { prepareCssoccerExactActuaPlayerPackaging } from
  "../src/prepare/cssoccer/exactActuaPlayerPackaging.mjs";
import { prepareCssoccerExactActuaPlayerSequences } from
  "../src/prepare/cssoccer/exactActuaPlayerSequences.mjs";
import {
  atomicWriteJson,
  withHeadlessCssoccerBrowser,
} from "./support/headless-cssoccer-browser.mjs";

const CHECK = process.argv.includes("--check");
const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const sourceRoot = resolve(repoRoot, ".local/actua-soccer/source");
const reportPath = resolve(
  repoRoot,
  ".local/cssoccer/exact-player-publication/measurement.json",
);
const requiredFiles = [
  "DATA.H", "ACTIONS.CPP", "DATA.OBJ", "3DENG.C", "EUROREND.DAT", "EUROREND.OFF",
];
for (const file of requiredFiles) {
  if (!existsSync(resolve(sourceRoot, file))) {
    throw new Error(`Missing ignored pinned source ${file}.`);
  }
}

const sourceBytes = (file) => readFileSync(resolve(sourceRoot, file));
const animationTable = parseCssoccerAnimationTable({
  dataHBytes: sourceBytes("DATA.H"),
  actionsCppBytes: sourceBytes("ACTIONS.CPP"),
  dataObjectBytes: sourceBytes("DATA.OBJ"),
  threeDEngCBytes: sourceBytes("3DENG.C"),
  euroRendDatBytes: sourceBytes("EUROREND.DAT"),
  euroRendOffBytes: sourceBytes("EUROREND.OFF"),
});
const modelInputs = {
  dataObjectBytes: sourceBytes("DATA.OBJ"),
  euroRendDatBytes: sourceBytes("EUROREND.DAT"),
  euroRendOffBytes: sourceBytes("EUROREND.OFF"),
};
const models = Object.fromEntries(["player_f1", "player_f2"].map((modelId) => [
  modelId,
  prepareExactActuaPlayerModel({ ...modelInputs, modelId }),
]));
const sequences = prepareCssoccerExactActuaPlayerSequences({ animationTable });
const geometry = prepareCssoccerExactActuaPlayerGeometry({ models });
const packaged = prepareCssoccerExactActuaPlayerPackaging({
  animationTable,
  sequences,
  geometry,
});

const chromeProbe = await withHeadlessCssoccerBrowser({
  port: 5199,
  disableLiveScheduler: true,
  controlCountry: "argentina",
}, async ({ evaluate, browser, pageErrors }) => {
  const result = await evaluate(`(async () => {
    const source = ${JSON.stringify(packaged.probe.largestChunkJson)};
    const longTasks = [];
    const observer = typeof PerformanceObserver === "function"
      ? new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) longTasks.push(entry.duration);
        })
      : null;
    observer?.observe({ type: "longtask", buffered: true });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    longTasks.length = 0;
    const parseStart = performance.now();
    const chunk = JSON.parse(source);
    const parseMs = performance.now() - parseStart;
    const decodeStart = performance.now();
    const rawIndices = atob(chunk.transformIndex.data);
    const indexBytes = Uint8Array.from(rawIndices, (value) => value.charCodeAt(0));
    const transformIndices = chunk.transformIndex.widthBits === 16
      ? new Uint16Array(indexBytes.buffer)
      : new Uint32Array(indexBytes.buffer);
    const rawSelectors = atob(chunk.materialSelectorOffset.data);
    const selectors = Int8Array.from(rawSelectors, (value) => value.charCodeAt(0));
    const decodeMs = performance.now() - decodeStart;
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-10000px;top:-10000px;width:1px;height:1px";
    const leaves = Array.from({ length: 13 }, () => {
      const leaf = document.createElement("s");
      host.append(leaf);
      return leaf;
    });
    document.body.append(host);
    const sample = Math.floor(chunk.sampleCount / 2);
    const applyStart = performance.now();
    for (let faceIndex = 0; faceIndex < 13; faceIndex += 1) {
      const offset = sample * 13 + faceIndex;
      const transformIndex = transformIndices[offset];
      const leaf = leaves[faceIndex];
      leaf.style.transform = chunk.transformDictionary[transformIndex];
      leaf.style.visibility = transformIndex === 0 ? "hidden" : "visible";
      if (transformIndex !== 0 && selectors[offset] !== -128) {
        leaf.dataset.materialSelectorOffset = String(selectors[offset]);
      }
    }
    const applyMs = performance.now() - applyStart;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    host.remove();
    observer?.disconnect();
    return {
      parseMs,
      decodeMs,
      applyMs,
      maxLongTaskMs: longTasks.length ? Math.max(...longTasks) : 0,
      longTaskCount: longTasks.filter((duration) => duration >= 50).length,
      transformIndexCount: transformIndices.length,
      selectorCount: selectors.length,
      appliedLeaves: leaves.length,
    };
  })()`, { awaitPromise: true });
  return {
    ...result,
    browser,
    pageErrors: [...pageErrors],
  };
});

const report = {
  schema: "cssoccer-exact-actua-player-publication-measurement@1",
  status: "pass",
  command: "node tools/measure-exact-player-publication.mjs --check",
  sourceRevision: animationTable.sourceRevision,
  geometryId: geometry.geometry.geometryId,
  topologySha256: geometry.geometry.topologySha256,
  sequenceContractSha256: sequences.contractSha256,
  packagingContractSha256: packaged.contract.contractSha256,
  selectedEncoding: packaged.contract.encoding,
  chunkFrameLimit: packaged.contract.chunkFrameLimit,
  cacheLimit: packaged.contract.cacheLimit,
  counts: packaged.contract.index.counts,
  metrics: packaged.contract.metrics,
  largestChunk: packaged.probe.largestChunk,
  chromeProbe,
  gates: {
    selectedToEquivalentDuplicatedGeometryLt55Percent:
      packaged.contract.metrics.ratios.selectedToEquivalentDuplicatedGeometry < 0.55,
    chunkParseLt50Ms: chromeProbe.parseMs < 50,
    chunkDecodeLt50Ms: chromeProbe.decodeMs < 50,
    thirteenLeafApplyLt50Ms: chromeProbe.applyMs < 50,
    noLongTaskGte50Ms: chromeProbe.longTaskCount === 0,
    zeroPageErrors: chromeProbe.pageErrors.length === 0,
    noRuntimeMatrixConstruction:
      packaged.contract.encoding.numericMatrixConstructionAtRuntime === false,
    noRuntimeMatrixFormatting:
      packaged.contract.encoding.numericMatrixFormattingAtRuntime === false,
  },
};
if (CHECK && Object.values(report.gates).some((value) => value !== true)) {
  report.status = "fail";
}
const artifact = await atomicWriteJson(reportPath, report);
console.log(JSON.stringify({
  status: report.status,
  report: artifact,
  ratio: report.metrics.ratios.selectedToEquivalentDuplicatedGeometry,
  selectedBytes: report.metrics.selected.uncompressedBytes,
  maxChunkBytes: report.metrics.selected.maxChunkBytes,
  chromeProbe: report.chromeProbe,
}, null, 2));
if (report.status !== "pass") process.exitCode = 1;
