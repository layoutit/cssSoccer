import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  rename,
  rm,
} from "node:fs/promises";
import { dirname } from "node:path";

import {
  CSSOCCER_MANIFEST_FILE,
  CSSOCCER_PROVENANCE_FILE,
  cssoccerPublicationSiblingPaths,
  resolveCssoccerPreparedPath,
} from "./paths.mjs";
import { canonicalJsonBytes, sha256Hex } from "./provenance.mjs";

export const CSSOCCER_PUBLICATION_REPORT_SCHEMA = "cssoccer-prepared-publication-report@1";

export async function writeCssoccerPreparedPublication({
  outputRoot,
  files,
  provenanceBytes,
  manifestBytes,
  prepareInputsSha256,
  provenanceSha256,
  beforeCommit,
}) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("Transactional cssoccer publication requires prepared payload files");
  }
  if (!(provenanceBytes instanceof Uint8Array) || !(manifestBytes instanceof Uint8Array)) {
    throw new TypeError("Transactional cssoccer publication requires manifest and provenance bytes");
  }
  if (beforeCommit !== undefined && typeof beforeCommit !== "function") {
    throw new TypeError("beforeCommit must be a function when provided");
  }

  const transaction = cssoccerPublicationSiblingPaths(outputRoot, randomUUID());
  await mkdir(transaction.parent, { recursive: true, mode: 0o755 });
  let ownsLock = false;
  let movedExisting = false;
  let published = false;
  try {
    await mkdir(transaction.lock, { mode: 0o755 });
    ownsLock = true;
    await assertReplaceableOutputRoot(transaction.root);
    await mkdir(transaction.staging, { mode: 0o755 });

    const payload = [...files].sort((left, right) => compareStrings(left.path, right.path));
    for (const file of payload) {
      const target = resolveCssoccerPreparedPath(transaction.staging, file.path);
      await writeFileDurably(target, file.bytes);
    }

    const provenancePath = resolveCssoccerPreparedPath(
      transaction.staging,
      CSSOCCER_PROVENANCE_FILE,
      { allowReserved: true },
    );
    await writeFileDurably(provenancePath, provenanceBytes);

    // The ready manifest is deliberately staged after every file it names.
    const manifestPath = resolveCssoccerPreparedPath(
      transaction.staging,
      CSSOCCER_MANIFEST_FILE,
      { allowReserved: true },
    );
    await writeFileDurably(manifestPath, manifestBytes);

    if (beforeCommit) {
      await beforeCommit(Object.freeze({
        stagingRoot: transaction.staging,
        manifestPath,
      }));
    }

    if (await pathExists(transaction.root)) {
      await rename(transaction.root, transaction.backup);
      movedExisting = true;
    }
    try {
      await rename(transaction.staging, transaction.root);
      published = true;
    } catch (error) {
      if (movedExisting) {
        await rename(transaction.backup, transaction.root);
        movedExisting = false;
      }
      throw error;
    }

    if (movedExisting) {
      await rm(transaction.backup, { recursive: true, force: true });
      movedExisting = false;
    }

    const treeEntries = [
      ...payload.map(({ path, byteLength, sha256 }) => ({
        path,
        bytes: byteLength,
        sha256,
      })),
      {
        path: CSSOCCER_PROVENANCE_FILE,
        bytes: provenanceBytes.byteLength,
        sha256: provenanceSha256,
      },
      {
        path: CSSOCCER_MANIFEST_FILE,
        bytes: manifestBytes.byteLength,
        sha256: sha256Hex(manifestBytes),
      },
    ].sort((left, right) => compareStrings(left.path, right.path));

    return Object.freeze({
      schema: CSSOCCER_PUBLICATION_REPORT_SCHEMA,
      status: "ready",
      outputRoot: transaction.root,
      manifestPath: resolveCssoccerPreparedPath(
        transaction.root,
        CSSOCCER_MANIFEST_FILE,
        { allowReserved: true },
      ),
      prepareInputsSha256,
      provenanceSha256,
      manifestSha256: sha256Hex(manifestBytes),
      fileCount: treeEntries.length,
      bytes: treeEntries.reduce((total, entry) => total + entry.bytes, 0),
      treeSha256: sha256Hex(canonicalJsonBytes(treeEntries)),
    });
  } catch (error) {
    const cleanupErrors = [];
    if (movedExisting && !published) {
      try {
        if (!(await pathExists(transaction.root))) {
          await rename(transaction.backup, transaction.root);
          movedExisting = false;
        }
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    for (const path of [transaction.staging, transaction.backup]) {
      try {
        if (path === transaction.backup && movedExisting) continue;
        await rm(path, { recursive: true, force: true });
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError([error, ...cleanupErrors], "cssoccer publication and cleanup failed");
    }
    throw error;
  } finally {
    if (ownsLock) await rm(transaction.lock, { recursive: true, force: true });
  }
}

async function writeFileDurably(path, bytes) {
  await mkdir(dirname(path), { recursive: true, mode: 0o755 });
  const handle = await open(path, "wx", 0o644);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function assertReplaceableOutputRoot(path) {
  const status = await statIfExists(path);
  if (!status) return;
  if (status.isSymbolicLink() || !status.isDirectory()) {
    throw new Error("cssoccer outputRoot must be absent or a real directory");
  }
}

async function statIfExists(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function pathExists(path) {
  return (await statIfExists(path)) !== null;
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
