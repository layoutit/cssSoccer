import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  COMPILED_PATH_QUERY_SCHEMA,
  CompiledPathInspectorError,
  analyzeWatcomRoutine,
  createProbeManifest,
  decodeProbeManifest,
  encodeProbeManifest,
  inferMapValueType,
  locateCaptureCoverage,
  parseWatcomMap,
  parseWatcomRoutine,
  selectWatcomMapSymbol,
  sha256,
  sha256Canonical,
} from "../tools/compiled-path-inspector-core.mjs";
import { inspectCompiledPath } from "../tools/inspect-compiled-path.mjs";

const LISTING = `
00000010            void __near get_target( char, float __near & ):
00000010  D9 45 F0            fld        dword ptr -0x10[ebp]
00000013  D8 4D E8            fmul       dword ptr -0x18[ebp]
00000016  D9 5D E4            fstp       dword ptr -0x1c[ebp]
00000019  D9 45 E4            fld        dword ptr -0x1c[ebp]
0000001C  D8 35 00 00 00 00   fdiv      dword ptr float __near zone_hgt
00000022  D9 18               fstp       dword ptr [eax]
00000024  C3                  ret

Routine Size: 21 bytes,    Routine Base: _TEXT + 0010
`;

const MAP = `
0001:0003ab97+ void __near get_target( char, int, int, int, int, float __near &, float __near &, int (__near *)[10][2])
0003:0003cf0c  float __near zone_hgt
`;

test("indexes a Watcom function and identifies observable f32 stores", () => {
  const routine = parseWatcomRoutine(LISTING, "get_target");
  const analysis = analyzeWatcomRoutine(routine, [{ name: "zone_hgt", valueType: "f32" }]);

  assert.equal(routine.objectOffset, 0x10);
  assert.equal(routine.declaredBytes, 21);
  assert.equal(analysis.instructionCount, 7);
  assert.equal(analysis.x87InstructionCount, 6);
  assert.deepEqual(
    analysis.f32Stores.map(({ offset, target }) => ({ offset, target })),
    [
      { offset: 0x16, target: "-0x1c[ebp]" },
      { offset: 0x22, target: "[eax]" },
    ],
  );
  assert.equal(analysis.symbols[0].referenced, true);
  assert.equal(analysis.symbols[0].references[0].mnemonic, "fdiv");
  assert.equal(analysis.symbols[0].nextF32Stores.length, 1);
  assert.equal(analysis.symbols[0].nextF32Stores[0].target, "[eax]");
});

test("resolves the executable-specific symbol and reports a range immediately after it", () => {
  const entries = parseWatcomMap(MAP);
  const mappedFunction = selectWatcomMapSymbol(entries, "get_target");
  const mappedGlobal = selectWatcomMapSymbol(entries, "zone_hgt");
  const coverage = locateCaptureCoverage({
    offset: mappedGlobal.offset,
    bytes: 4,
    ranges: [{ offset: 0x3cf18, bytes: 0x2ce8 }],
  });

  assert.equal(mappedFunction.segment, "0001");
  assert.equal(mappedGlobal.segment, "0003");
  assert.equal(mappedGlobal.offset, 0x3cf0c);
  assert.equal(inferMapValueType(mappedGlobal.declaration), "f32");
  assert.equal(coverage.status, "probe-required");
  assert.equal(coverage.nearest.direction, "before");
  assert.equal(coverage.nearest.startDeltaBytes, 12);
  assert.equal(coverage.nearest.uncoveredGapBytes, 8);
});

test("encodes a bounded read-only probe with its stop sourced from the retained frontier", () => {
  const frontierActiveTick = 37;
  const manifest = createProbeManifest({
    stopActiveTick: frontierActiveTick,
    dgroupSegment: "0003",
    symbols: [
      { name: "zone_hgt", segment: "0003", offset: 0x3cf0c, bytes: 4, valueType: "f32" },
      { name: "zone_wid", segment: "0003", offset: 0x3cf10, bytes: 4, valueType: "f32" },
    ],
    bindings: { scenarioSha256: "scenario", inputSha256: "input" },
    artifactBindings: { objectSha256: "object", mapSha256: "map", executableSha256: "executable" },
    frontier: { activeTick: frontierActiveTick, field: "player.target.y" },
  });
  const decoded = decodeProbeManifest(encodeProbeManifest(manifest));

  assert.equal(manifest.mode, "read-only");
  assert.equal(manifest.stop.source, "retained-frontier");
  assert.equal(decoded.stopActiveTick, frontierActiveTick);
  assert.equal(decoded.rangeCount, 2);
  assert.equal(decoded.totalBytes, 8);
  assert.deepEqual(
    decoded.reads.map(({ offset, bytes, valueType }) => ({ offset, bytes, valueType })),
    [
      { offset: 0x3cf0c, bytes: 4, valueType: "f32" },
      { offset: 0x3cf10, bytes: 4, valueType: "f32" },
    ],
  );
});

test("rejects overlapping probe reads instead of silently widening them", () => {
  assert.throws(
    () => createProbeManifest({
      stopActiveTick: 1,
      dgroupSegment: "0003",
      symbols: [
        { name: "first", segment: "0003", offset: 0x1000, bytes: 4, valueType: "f32" },
        { name: "second", segment: "0003", offset: 0x1002, bytes: 4, valueType: "f32" },
      ],
      bindings: { scenarioSha256: "scenario" },
      artifactBindings: { executableSha256: "executable" },
      frontier: { activeTick: 1 },
    }),
    (error) => error instanceof CompiledPathInspectorError && error.code === "probe-range-order",
  );
});

test("rejects widened values and stops outside the signed transport boundary", () => {
  assert.throws(
    () => createProbeManifest({
      stopActiveTick: 1,
      dgroupSegment: "0003",
      symbols: [{ name: "zone_hgt", segment: "0003", offset: 0x1000, bytes: 8, valueType: "f32" }],
      bindings: { scenarioSha256: "scenario" },
      artifactBindings: { executableSha256: "executable" },
      frontier: { activeTick: 1 },
    }),
    (error) => error instanceof CompiledPathInspectorError && error.code === "probe-value-width-mismatch",
  );
  assert.throws(
    () => createProbeManifest({
      stopActiveTick: 0x8000_0000,
      dgroupSegment: "0003",
      symbols: [{ name: "zone_hgt", segment: "0003", offset: 0x1000, bytes: 4, valueType: "f32" }],
      bindings: { scenarioSha256: "scenario" },
      artifactBindings: { executableSha256: "executable" },
      frontier: { activeTick: 0x8000_0000 },
    }),
    (error) => error instanceof CompiledPathInspectorError && error.code === "probe-stop-range",
  );
});

test("retains one hot packet and one bound read-only probe for a complete query", async (t) => {
  const scratch = await mkdtemp(join(tmpdir(), "cssoccer-compiled-path-"));
  t.after(async () => rm(scratch, { recursive: true, force: true }));
  const objectBytes = Buffer.from("watcom-object-fixture");
  const executableBytes = Buffer.from("linked-executable-fixture");
  const objectPath = join(scratch, "INTELL.OBJ");
  const listingPath = join(scratch, "INTELL.DIS");
  const mapPath = join(scratch, "TEST.MAP");
  const executablePath = join(scratch, "TEST.EXE");
  const capturePath = join(scratch, "capture.json");
  await Promise.all([
    writeFile(objectPath, objectBytes),
    writeFile(listingPath, LISTING),
    writeFile(mapPath, MAP),
    writeFile(executablePath, executableBytes),
    writeFile(capturePath, JSON.stringify({ raw: { ranges: [{ offset: 0x3cf18, bytes: 64 }] } })),
  ]);
  const frontierActiveTick = 23;
  const objectSha256 = sha256(objectBytes);
  const mapSha256 = sha256(Buffer.from(MAP));
  const executableSha256 = sha256(executableBytes);
  const listingSha256 = sha256(Buffer.from(LISTING));
  const compiledArtifactBindingSha256 = sha256Canonical({
    schema: "cssoccer-compiled-artifact-binding@1",
    objectSha256,
    mapSha256,
    executableSha256,
  });
  const query = {
    schema: COMPILED_PATH_QUERY_SCHEMA,
    workspaceRoot: scratch,
    workRoot: join(scratch, "work"),
    function: "get_target",
    object: { path: objectPath, expectedSha256: objectSha256 },
    listing: { path: listingPath, objectSha256, expectedSha256: listingSha256 },
    map: { path: mapPath, expectedSha256: mapSha256 },
    executable: { path: executablePath, expectedSha256: executableSha256 },
    capture: { contractPath: capturePath, rangesPath: "raw.ranges" },
    symbols: [{ name: "zone_hgt", valueType: "f32" }],
    probe: {
      enabled: true,
      compiledArtifactBindingSha256,
      dgroupSegment: "0003",
      frontier: { activeTick: frontierActiveTick, field: "player.target.y" },
      bindings: {
        scenarioSha256: "scenario",
        inputSha256: "input",
        seedSha256: "seed",
        timestepSha256: "timestep",
        fieldContractSha256: "field-contract",
      },
    },
  };

  const evidence = await inspectCompiledPath(query);
  const probe = decodeProbeManifest(await readFile(evidence.probe.binaryPath));
  const retained = JSON.parse(await readFile(evidence.evidencePath, "utf8"));

  assert.equal(evidence.status, "probe-ready");
  assert.equal(evidence.artifactBindingStatus, "bound");
  assert.equal(evidence.hotPacket.compiled.f32StoreCount, 2);
  assert.equal(evidence.hotPacket.symbols[0].capture.status, "probe-required");
  assert.equal(evidence.hotPacket.symbols[0].nextF32Stores, 1);
  assert.equal(probe.stopActiveTick, frontierActiveTick);
  assert.equal(probe.reads[0].offset, 0x3cf0c);
  assert.equal(retained.queryId, evidence.queryId);
  assert.equal(retained.probe.mode, "read-only");

  const missingCompiledBinding = structuredClone(query);
  delete missingCompiledBinding.probe.compiledArtifactBindingSha256;
  await assert.rejects(
    () => inspectCompiledPath(missingCompiledBinding),
    (error) => error instanceof CompiledPathInspectorError && error.code === "probe-compiled-binding-missing",
  );

  const unboundListing = structuredClone(query);
  delete unboundListing.listing.expectedSha256;
  await assert.rejects(
    () => inspectCompiledPath(unboundListing),
    (error) => error instanceof CompiledPathInspectorError && error.code === "probe-listing-unbound",
  );
});
