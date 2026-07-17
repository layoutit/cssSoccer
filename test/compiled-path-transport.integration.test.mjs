import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  createProbeManifest,
  encodeProbeManifest,
} from "../tools/compiled-path-inspector-core.mjs";

const execute = promisify(execFile);
const transportPath = process.env.CSSOCCER_QUERY_TRANSPORT;
const transportTestOptions = {
  skip: transportPath ? false : "set CSSOCCER_QUERY_TRANSPORT to the isolated query-enabled DOSBox-X binary",
};

test("isolated DOSBox-X transport accepts CSSQRY1 and advertises its exact ranges", transportTestOptions, async (t) => {
  const scratch = await mkdtemp(join(tmpdir(), "cssoccer-query-transport-"));
  t.after(async () => rm(scratch, { recursive: true, force: true }));
  const queryPath = join(scratch, "probe.cssqry");
  const rawPath = join(scratch, "probe.raw");
  const frontierActiveTick = 0;
  const manifest = createProbeManifest({
    stopActiveTick: frontierActiveTick,
    dgroupSegment: "0003",
    symbols: [{ name: "probe_value", segment: "0003", offset: 0x1000, bytes: 4, valueType: "f32" }],
    bindings: { scenarioSha256: "transport-integration" },
    artifactBindings: { executableSha256: "transport-integration" },
    frontier: { activeTick: frontierActiveTick, source: "synthetic-transport-test" },
  });
  await writeFile(queryPath, encodeProbeManifest(manifest));

  const result = await runTransport(scratch, { queryPath, rawPath });

  assert.match(result.stderr, /CSSOCCER_QUERY ready ranges=1 bytes=4 stop=0 mode=read-only/u);
  const raw = await readFile(rawPath);
  assert.equal(raw.subarray(0, 8).toString("latin1"), "CSSORAW2");
  assert.equal(raw.readUInt32LE(8), 2);
  assert.equal(raw.readUInt32LE(12), 1);
  assert.equal(raw.readUInt32LE(16), 0x1000);
  assert.equal(raw.readUInt32LE(20), 4);
});

test("isolated transport keeps canonical ranges when no CSSQRY1 manifest is supplied", transportTestOptions, async (t) => {
  const scratch = await mkdtemp(join(tmpdir(), "cssoccer-default-transport-"));
  t.after(async () => rm(scratch, { recursive: true, force: true }));
  const rawPath = join(scratch, "default.raw");

  const result = await runTransport(scratch, { rawPath });
  const raw = await readFile(rawPath);

  assert.doesNotMatch(result.stderr, /CSSOCCER_QUERY ready/u);
  assert.equal(raw.subarray(0, 8).toString("latin1"), "CSSORAW2");
  assert.equal(raw.readUInt32LE(12), 7);
  assert.equal(raw.readUInt32LE(16), 0xd900);
  assert.equal(raw.readUInt32LE(20), 0x300);
});

test("isolated transport rejects a corrupt manifest before creating raw evidence", transportTestOptions, async (t) => {
  const scratch = await mkdtemp(join(tmpdir(), "cssoccer-invalid-transport-"));
  t.after(async () => rm(scratch, { recursive: true, force: true }));
  const queryPath = join(scratch, "invalid.cssqry");
  const rawPath = join(scratch, "invalid.raw");
  const corrupt = Buffer.alloc(32);
  corrupt.write("NOTQRY1", 0, "latin1");
  await writeFile(queryPath, corrupt);

  const result = await runTransport(scratch, { queryPath, rawPath });

  assert.match(result.stderr, /CSSOCCER_QUERY rejected invalid or unsafe manifest/u);
  assert.equal(existsSync(rawPath), false);
});

async function runTransport(cwd, { queryPath, rawPath }) {
  return execute(transportPath, [
    "-defaultconf",
    "-defaultmapper",
    "-silent",
    "-nogui",
    "-nomenu",
    "-fastlaunch",
    "-set",
    "cpu core=normal",
    "-c",
    "exit",
  ], {
    cwd,
    timeout: 30_000,
    maxBuffer: 16 * 1024 * 1024,
    env: {
      ...process.env,
      ...(queryPath ? { CSSOCCER_ORACLE_QUERY: queryPath } : {}),
      CSSOCCER_ORACLE_RAW: rawPath,
      SDL_VIDEODRIVER: "dummy",
      SDL_AUDIODRIVER: "dummy",
    },
  });
}
