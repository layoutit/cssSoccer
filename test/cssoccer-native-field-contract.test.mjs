import assert from "node:assert/strict";
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
} from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CSSOCCER_NATIVE_FIELD_CONTRACT,
  CSSOCCER_NATIVE_FIELD_CONTRACT_SCHEMA,
  CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256,
  CSSOCCER_NATIVE_FIELD_COUNT,
  CSSOCCER_NATIVE_FIELD_FIXTURE_ID,
  CSSOCCER_NATIVE_FIELD_PHASES,
  CSSOCCER_NATIVE_FIELDS,
} from "../src/cssoccer/nativeFieldContract.mjs";
import { parityContractSha256 } from "../src/parity/io.mjs";

const CONTRACT_SOURCE_URL = new URL(
  "../src/cssoccer/nativeFieldContract.mjs",
  import.meta.url,
);
const SOURCE_DESCRIPTOR_URL = new URL(
  "../references/spain-argentina-source-data.json",
  import.meta.url,
);
const RETAINED_HEADER_URLS = [
  new URL(
    "../.local/cssoccer/oracle/native/retained/runs/canonical-a/state.jsonl",
    import.meta.url,
  ),
  new URL(
    "../.local/cssoccer/oracle/native/retained/runs/canonical-b/state.jsonl",
    import.meta.url,
  ),
];
const FIELD_KEYS = ["id", "label", "sourceOwner", "meaning", "unit", "valueType"];
const SUPPORTED_TYPES = new Set([
  "i8", "u8", "i16", "u16", "i32", "u32", "i64", "u64",
  "f32", "f64", "bool", "string", "null",
]);
const EXPECTED_DOMAIN_COUNTS = {
  ball: 17,
  camera: 10,
  clock: 10,
  lifecycle: 9,
  players: 352,
  rng: 2,
  rules: 8,
  score: 4,
};
const EXPECTED_PLAYER_IDS = ["argentina", "spain"].flatMap((country) => (
  Array.from(
    { length: 11 },
    (_, index) => `${country}-player-${String(index + 1).padStart(2, "0")}`,
  )
));

test("the canonical contract is fixture-bound, hash-bound, and post_tick-only", () => {
  assert.equal(CSSOCCER_NATIVE_FIELD_CONTRACT.schema, CSSOCCER_NATIVE_FIELD_CONTRACT_SCHEMA);
  assert.equal(CSSOCCER_NATIVE_FIELD_CONTRACT_SCHEMA, "cssoccer-native-field-contract@1");
  assert.equal(CSSOCCER_NATIVE_FIELD_CONTRACT.fixtureId, CSSOCCER_NATIVE_FIELD_FIXTURE_ID);
  assert.equal(CSSOCCER_NATIVE_FIELD_FIXTURE_ID, "spain-argentina-full-match");
  assert.equal(
    CSSOCCER_NATIVE_FIELD_CONTRACT.contractSha256,
    CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256,
  );
  assert.equal(
    CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256,
    "6d21511c288f9553628079ffeaa4a6538d4eb1a8e4b36acb4f1d0c44de42a76e",
  );
  assert.deepEqual(CSSOCCER_NATIVE_FIELD_CONTRACT.coordinateOrder, ["tick", "phase", "field"]);
  assert.deepEqual(CSSOCCER_NATIVE_FIELD_PHASES, [{ id: "post_tick", order: 0 }]);
  assert.strictEqual(CSSOCCER_NATIVE_FIELD_CONTRACT.phases, CSSOCCER_NATIVE_FIELD_PHASES);
  assert.strictEqual(CSSOCCER_NATIVE_FIELD_CONTRACT.fields, CSSOCCER_NATIVE_FIELDS);
  assert.equal(CSSOCCER_NATIVE_FIELD_CONTRACT.phaseCount, 1);
  assert.equal(CSSOCCER_NATIVE_FIELD_CONTRACT.fieldCount, CSSOCCER_NATIVE_FIELD_COUNT);
  assert.equal(CSSOCCER_NATIVE_FIELD_COUNT, 412);
});

test("all exported contract metadata is deeply frozen", () => {
  assertDeepFrozen(CSSOCCER_NATIVE_FIELD_CONTRACT);
  assertDeepFrozen(CSSOCCER_NATIVE_FIELD_PHASES);
  assertDeepFrozen(CSSOCCER_NATIVE_FIELDS);
  assert.throws(() => {
    CSSOCCER_NATIVE_FIELD_CONTRACT.fields[0].label = "changed";
  }, TypeError);
});

test("field order, domains, stable players, and scalar types are exact", () => {
  assert.equal(CSSOCCER_NATIVE_FIELDS.length, 412);
  const ids = CSSOCCER_NATIVE_FIELDS.map(({ id }) => id);
  assert.equal(new Set(ids).size, 412);
  assert.deepEqual([...ids].sort(), ids);

  const domainCounts = {};
  const playerSuffixes = new Map();
  for (const field of CSSOCCER_NATIVE_FIELDS) {
    assert.deepEqual(Object.keys(field), FIELD_KEYS);
    assert.ok(SUPPORTED_TYPES.has(field.valueType), field.id);
    assert.equal(typeof field.id, "string");
    assert.equal(typeof field.label, "string");
    assert.equal(typeof field.sourceOwner, "string");
    assert.equal(typeof field.meaning, "string");
    assert.ok(field.unit === null || typeof field.unit === "string");

    const [domain, playerId, suffix] = field.id.split(".");
    domainCounts[domain] = (domainCounts[domain] ?? 0) + 1;
    if (domain === "players") {
      if (!playerSuffixes.has(playerId)) playerSuffixes.set(playerId, new Set());
      playerSuffixes.get(playerId).add(suffix);
    }
  }

  assert.deepEqual(domainCounts, EXPECTED_DOMAIN_COUNTS);
  assert.deepEqual(CSSOCCER_NATIVE_FIELD_CONTRACT.domainCounts, EXPECTED_DOMAIN_COUNTS);
  assert.deepEqual([...playerSuffixes.keys()], EXPECTED_PLAYER_IDS);
  assert.deepEqual(CSSOCCER_NATIVE_FIELD_CONTRACT.playerIds, EXPECTED_PLAYER_IDS);
  assert.equal(CSSOCCER_NATIVE_FIELD_CONTRACT.playerFieldCount, 16);
  for (const [playerId, suffixes] of playerSuffixes) {
    assert.equal(suffixes.size, 16, playerId);
    assert.ok(suffixes.has("stable_id"), playerId);
    const stableIdField = CSSOCCER_NATIVE_FIELDS.find(
      ({ id }) => id === `players.${playerId}.stable_id`,
    );
    assert.equal(stableIdField.valueType, "string");
  }
});

test("the published fields are byte-identical to every available retained header", (t) => {
  const available = RETAINED_HEADER_URLS.filter((url) => existsSync(url));
  if (available.length === 0) {
    t.skip("ignored retained canonical headers are not installed");
    return;
  }

  const contractBytes = Buffer.from(JSON.stringify({
    phases: CSSOCCER_NATIVE_FIELD_PHASES,
    fields: CSSOCCER_NATIVE_FIELDS,
  }));
  for (const url of available) {
    const header = readJsonlHeader(url);
    assert.equal(header.recordType, "header");
    assert.equal(header.bindings.contractSha256, CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256);
    assert.deepEqual(
      Buffer.from(JSON.stringify({ phases: header.phases, fields: header.fields })),
      contractBytes,
      fileURLToPath(url),
    );
  }
  assert.equal(
    parityContractSha256({
      phases: CSSOCCER_NATIVE_FIELD_PHASES,
      fields: CSSOCCER_NATIVE_FIELDS,
    }),
    CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256,
  );
});

test("the contract agrees with the checked fixture descriptor when installed", (t) => {
  if (!existsSync(SOURCE_DESCRIPTOR_URL)) {
    t.skip("fixture descriptor is not installed");
    return;
  }
  const descriptor = JSON.parse(readFileSync(SOURCE_DESCRIPTOR_URL, "utf8"));
  assert.equal(descriptor.id, CSSOCCER_NATIVE_FIELD_FIXTURE_ID);
  assert.equal(
    descriptor.nativeProfileBindings.fieldContractSha256,
    CSSOCCER_NATIVE_FIELD_CONTRACT_SHA256,
  );
});

test("the runtime contract carries metadata only and no gameplay samples", () => {
  const forbiddenContractKeys = new Set([
    "bindings",
    "buildSha256",
    "engineIndependence",
    "generatedAt",
    "inputSha256",
    "numericBits",
    "profileSha256",
    "recordType",
    "scenarioSha256",
    "sourceSha256",
    "streamId",
    "tick",
    "tickRange",
    "value",
  ]);
  visit(CSSOCCER_NATIVE_FIELD_CONTRACT, (key) => {
    assert.ok(!forbiddenContractKeys.has(key), `forbidden runtime contract key ${key}`);
  });

  for (const field of CSSOCCER_NATIVE_FIELDS) {
    assert.deepEqual(Object.keys(field), FIELD_KEYS);
    assert.ok(!Object.hasOwn(field, "value"));
    assert.ok(!Object.hasOwn(field, "numericBits"));
  }
});

test("runtime code has no filesystem, source descriptor, oracle, or retained dependency", () => {
  const source = readFileSync(CONTRACT_SOURCE_URL, "utf8");
  assert.doesNotMatch(source, /^\s*import\b/mu);
  assert.doesNotMatch(
    source,
    /node:fs|readFile|existsSync|\.local\/|references\/|state\.jsonl|oracle\/|retained\//u,
  );
  assert.doesNotMatch(
    source,
    /\b(?:scenario|profile|input|source|build)Sha256\b|numericBits|tickRange|generatedAt/u,
  );
});

test("independent module evaluations are byte-identical", async () => {
  const first = await import(new URL(
    "../src/cssoccer/nativeFieldContract.mjs?determinism=first",
    import.meta.url,
  ));
  const second = await import(new URL(
    "../src/cssoccer/nativeFieldContract.mjs?determinism=second",
    import.meta.url,
  ));
  assert.equal(
    JSON.stringify(first.CSSOCCER_NATIVE_FIELD_CONTRACT),
    JSON.stringify(second.CSSOCCER_NATIVE_FIELD_CONTRACT),
  );
  assertDeepFrozen(first.CSSOCCER_NATIVE_FIELD_CONTRACT);
  assertDeepFrozen(second.CSSOCCER_NATIVE_FIELD_CONTRACT);
});

function readJsonlHeader(url) {
  const path = fileURLToPath(url);
  const handle = openSync(path, "r");
  const chunks = [];
  let total = 0;
  try {
    while (total <= 2 * 1024 * 1024) {
      const buffer = Buffer.allocUnsafe(64 * 1024);
      const bytesRead = readSync(handle, buffer, 0, buffer.length, null);
      if (bytesRead === 0) throw new Error(`${path} has no LF-terminated header`);
      const chunk = buffer.subarray(0, bytesRead);
      const newline = chunk.indexOf(10);
      if (newline !== -1) {
        chunks.push(Buffer.from(chunk.subarray(0, newline)));
        return JSON.parse(Buffer.concat(chunks).toString("utf8"));
      }
      chunks.push(Buffer.from(chunk));
      total += bytesRead;
    }
    throw new Error(`${path} header exceeds qualification limit`);
  } finally {
    closeSync(handle);
  }
}

function assertDeepFrozen(value, path = "contract") {
  if (value === null || typeof value !== "object") return;
  assert.ok(Object.isFrozen(value), `${path} must be frozen`);
  for (const [key, child] of Object.entries(value)) {
    assertDeepFrozen(child, `${path}.${key}`);
  }
}

function visit(value, visitor) {
  if (value === null || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    visitor(key, child);
    visit(child, visitor);
  }
}
