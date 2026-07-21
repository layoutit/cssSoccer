import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  CSSOCCER_EXACT_ACTUA_PLAYER_INDEX_SCHEMA,
  decodeCssoccerExactActuaPlayerChunk,
} from "../src/prepare/cssoccer/exactActuaPlayerPackaging.mjs";

const publicRoot = new URL("../build/generated/public/cssoccer/", import.meta.url);
const indexUrl = new URL("assets/animation/exact-player/index.json", publicRoot);
const publicationTestOptions = {
  skip: !existsSync(indexUrl)
    ? "ignored local exact-player publication is unavailable"
    : false,
  timeout: 120_000,
};

test("published exact-player index and bounded sidecars exhaustively round-trip", publicationTestOptions, () => {
  const indexBytes = readFileSync(indexUrl);
  const index = JSON.parse(indexBytes);
  assert.equal(index.schema, CSSOCCER_EXACT_ACTUA_PLAYER_INDEX_SCHEMA);
  assert.equal(index.status, "ready-bounded-direct-index");
  assert.deepEqual(index.counts, {
    sequences: 124,
    poseOccurrences: 5_857,
    yawBins: 24,
    samples: 140_568,
    facesPerSample: 13,
    faceStates: 1_827_384,
    chunks: 426,
  });
  assert.equal(index.lookup.scanning, false);
  assert.equal(index.cache.eagerWholeDomain, false);
  assert.equal(index.sequences.length, 124);
  const chunkPaths = new Set();
  let samples = 0;
  let faceStates = 0;
  let chunks = 0;
  for (const sequence of index.sequences) {
    assert.equal(sequence.chunks.length, Math.ceil(sequence.frameCount / 16));
    sequence.chunks.forEach((descriptor, chunkIndex) => {
      assert.equal(descriptor.chunkIndex, chunkIndex);
      assert.equal(descriptor.slotId, sequence.slotId);
      assert.equal(descriptor.path.includes(".."), false);
      assert.match(
        descriptor.path,
        /^assets\/animation\/exact-player\/slot-[0-9]{3}\/frames-[0-9]{3}-[0-9]{3}\.json$/u,
      );
      assert.equal(chunkPaths.has(descriptor.path), false);
      chunkPaths.add(descriptor.path);
      const path = resolve(new URL("..", publicRoot).pathname, "cssoccer", descriptor.path);
      const bytes = readFileSync(path);
      assert.equal(bytes.length, descriptor.bytes);
      assert.equal(sha256(bytes), descriptor.sha256);
      const source = bytes.toString("utf8");
      assert.doesNotMatch(
        source,
        /player_f[12]|spain|argentina|coordinates|projectedCorners|projectiveW|depthBits/u,
      );
      const chunk = JSON.parse(source);
      const decoded = decodeCssoccerExactActuaPlayerChunk(chunk);
      assert.equal(chunk.frameStart, descriptor.frameStart);
      assert.equal(chunk.frameEnd, descriptor.frameEnd);
      assert.equal(chunk.sampleCount, descriptor.sampleCount);
      assert.equal(chunk.faceStateCount, descriptor.faceStateCount);
      for (let localFrame = chunk.frameStart; localFrame < chunk.frameEnd; localFrame += 1) {
        for (let yawIndex = 0; yawIndex < 24; yawIndex += 1) {
          const faces = decoded.sample(localFrame, yawIndex);
          assert.equal(faces.length, 13);
          assert.deepEqual(faces.map(({ faceIndex }) => faceIndex),
            Array.from({ length: 13 }, (_, indexValue) => indexValue));
          samples += 1;
          faceStates += faces.length;
        }
      }
      chunks += 1;
    });
  }
  assert.deepEqual({ chunks, samples, faceStates }, {
    chunks: 426,
    samples: 140_568,
    faceStates: 1_827_384,
  });
  assert.equal(chunkPaths.size, 426);
  const { contractSha256, ...indexCore } = index;
  assert.equal(sha256(Buffer.from(canonicalJson(indexCore))), contractSha256);
});

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
