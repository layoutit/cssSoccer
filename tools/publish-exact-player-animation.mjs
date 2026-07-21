#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";

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
import { canonicalJsonBytes } from
  "../src/prepare/cssoccer/provenance.mjs";
import { atomicWriteJson } from "./support/headless-cssoccer-browser.mjs";

const CHECK = process.argv.includes("--check");
const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const sourceRoot = resolve(repoRoot, ".local/actua-soccer/source");
const outputRoot = resolve(repoRoot, "build/generated/public/cssoccer");
const publicationPrefix = "assets/animation/exact-player/";
const target = resolve(outputRoot, publicationPrefix);
const parent = dirname(target);
const temporary = resolve(parent, `exact-player.tmp-${process.pid}`);
const backup = resolve(parent, `exact-player.backup-${process.pid}`);
const reportPath = resolve(
  repoRoot,
  ".local/cssoccer/exact-player-publication/publication.json",
);
const requiredFiles = [
  "DATA.H", "ACTIONS.CPP", "DATA.OBJ", "3DENG.C", "EUROREND.DAT", "EUROREND.OFF",
];
for (const file of requiredFiles) {
  if (!existsSync(resolve(sourceRoot, file))) {
    throw new Error(`Missing ignored pinned source ${file}.`);
  }
}

await rm(temporary, { recursive: true, force: true });
await rm(backup, { recursive: true, force: true });
await mkdir(temporary, { recursive: true });

try {
  const inputs = prepareInputs();
  const firstEntries = [];
  const writePromises = [];
  const first = prepareCssoccerExactActuaPlayerPackaging({
    ...inputs,
    onChunk({ metadata, bytes }) {
      const path = checkedPublicationPath(metadata.path);
      const destination = resolve(temporary, path.slice(publicationPrefix.length));
      assertInside(destination, temporary);
      writePromises.push(
        mkdir(dirname(destination), { recursive: true })
          .then(() => writeFile(destination, bytes)),
      );
      firstEntries.push({ ...metadata, path });
    },
  });
  // onChunk is synchronous; await every write deterministically before the
  // second clean preparation and atomic directory swap.
  await Promise.all(writePromises);
  await Promise.all(firstEntries.map(async ({ path, bytes, sha256: expectedSha256 }) => {
    const destination = resolve(temporary, path.slice(publicationPrefix.length));
    const info = await stat(destination);
    const fileBytes = await readFile(destination);
    if (info.size !== bytes || sha256(fileBytes) !== expectedSha256) {
      throw new Error(`Exact player chunk ${path} changed while writing.`);
    }
  }));
  const indexBytes = canonicalJsonBytes(first.contract.index);
  const indexPath = resolve(temporary, "index.json");
  await writeFile(indexPath, indexBytes);

  const expectedByPath = new Map(firstEntries.map((entry) => [entry.path, entry]));
  let secondChunkCount = 0;
  const second = prepareCssoccerExactActuaPlayerPackaging({
    ...inputs,
    onChunk({ metadata, bytes }) {
      const path = checkedPublicationPath(metadata.path);
      const expected = expectedByPath.get(path);
      if (
        !expected
        || expected.bytes !== bytes.length
        || expected.sha256 !== sha256(bytes)
        || metadata.sha256 !== expected.sha256
      ) throw new Error(`Exact player chunk ${path} is not deterministic.`);
      secondChunkCount += 1;
    },
  });
  const secondIndexBytes = canonicalJsonBytes(second.contract.index);
  if (
    secondChunkCount !== firstEntries.length
    || sha256(secondIndexBytes) !== sha256(indexBytes)
    || second.contract.index.contractSha256 !== first.contract.index.contractSha256
  ) throw new Error("Exact player index/sidecar set is not deterministic.");

  await atomicSwapDirectory({ target, temporary, backup });
  const publicationFiles = [
    {
      path: `${publicationPrefix}index.json`,
      bytes: indexBytes.length,
      sha256: sha256(indexBytes),
    },
    ...firstEntries.map(({ path, bytes, sha256: fileSha256 }) => ({
      path,
      bytes,
      sha256: fileSha256,
    })),
  ];
  const report = {
    schema: "cssoccer-exact-actua-player-publication-report@1",
    status: "pass",
    command: "node tools/publish-exact-player-animation.mjs --check",
    outputBoundary: "ignored local build/generated/public/cssoccer only",
    index: publicationFiles[0],
    indexContractSha256: first.contract.index.contractSha256,
    viewContractSha256: first.contract.viewContractSha256,
    counts: first.contract.index.counts,
    deterministicCleanPreparations: 2,
    files: publicationFiles.length,
    chunkFiles: firstEntries.length,
    totalBytes: publicationFiles.reduce((sum, file) => sum + file.bytes, 0),
    fileSetSha256: sha256(Buffer.from(publicationFiles
      .map(({ path, bytes, sha256: fileSha256 }) => `${path}\0${bytes}\0${fileSha256}\n`)
      .join(""))),
    gates: {
      byteIdenticalIndex: sha256(secondIndexBytes) === sha256(indexBytes),
      byteIdenticalChunks: secondChunkCount === firstEntries.length,
      exhaustiveSamples: first.contract.roundTrip.samples === 140_568,
      exhaustiveFaceStates: first.contract.roundTrip.faceStates === 1_827_384,
      oneGeometryId: !JSON.stringify(first.contract.index).includes("player_f2"),
      rawCoordinatesAbsent: !publicationFiles.some(({ path }) => /source|oracle/u.test(path)),
    },
  };
  if (CHECK && Object.values(report.gates).some((value) => value !== true)) {
    report.status = "fail";
  }
  const artifact = await atomicWriteJson(reportPath, report);
  console.log(JSON.stringify({
    status: report.status,
    report: artifact,
    files: report.files,
    chunks: report.chunkFiles,
    totalBytes: report.totalBytes,
    fileSetSha256: report.fileSetSha256,
  }, null, 2));
  if (report.status !== "pass") process.exitCode = 1;
} catch (error) {
  await rm(temporary, { recursive: true, force: true });
  throw error;
}

function prepareInputs() {
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
  return {
    animationTable,
    sequences: prepareCssoccerExactActuaPlayerSequences({ animationTable }),
    geometry: prepareCssoccerExactActuaPlayerGeometry({ models }),
  };
}

function checkedPublicationPath(path) {
  if (
    typeof path !== "string"
    || !path.startsWith(publicationPrefix)
    || path.includes("..")
    || path.includes("\\")
    || !/^assets\/animation\/exact-player\/slot-[0-9]{3}\/frames-[0-9]{3}-[0-9]{3}\.json$/u.test(path)
  ) throw new Error(`Unsafe exact player publication path ${String(path)}.`);
  return path;
}

function assertInside(destination, expectedRoot) {
  const rel = relative(expectedRoot, destination);
  if (rel.startsWith("..") || rel === "" || rel.split(sep).includes("..")) {
    throw new Error(`Exact player publication escaped its temporary root: ${destination}`);
  }
}

async function atomicSwapDirectory({ target: destination, temporary: source, backup: old }) {
  const hadTarget = existsSync(destination);
  if (hadTarget) await rename(destination, old);
  try {
    await rename(source, destination);
  } catch (error) {
    if (hadTarget && !existsSync(destination) && existsSync(old)) await rename(old, destination);
    throw error;
  }
  if (hadTarget) await rm(old, { recursive: true, force: true });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
