import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeCssorawValues,
} from "../tools/run-compiled-path-check.mjs";
import { CompiledPathInspectorError } from "../tools/compiled-path-inspector-core.mjs";

test("reads typed values only from the retained active frontier record", () => {
  const raw = createCssoraw({
    ranges: [
      { offset: 0x1000, bytes: 4 },
      { offset: 0x2000, bytes: 2 },
    ],
    records: [
      { tick: 36, active: true, values: [{ range: 0, f32: 1 }, { range: 1, i16: 4 }] },
      { tick: 37, active: true, values: [{ range: 0, f32: 266 }, { range: 1, i16: -12 }] },
    ],
  });

  const decoded = decodeCssorawValues(raw, 37, [
    { name: "zone_hgt", valueType: "f32", bytes: 4, offset: 0x1000 },
    { name: "intention", valueType: "i16", bytes: 2, offset: 0x2000 },
  ]);

  assert.equal(decoded.activeTick, 37);
  assert.equal(decoded.recordCount, 2);
  assert.deepEqual(decoded.values.map(({ name, valueType, value, numericBits }) => ({
    name,
    valueType,
    value,
    numericBits,
  })), [
    { name: "zone_hgt", valueType: "f32", value: 266, numericBits: "43850000" },
    { name: "intention", valueType: "i16", value: -12, numericBits: "fff4" },
  ]);
});

test("fails closed when the exact active tick is absent", () => {
  const raw = createCssoraw({
    ranges: [{ offset: 0x1000, bytes: 4 }],
    records: [{ tick: 36, active: true, values: [{ range: 0, f32: 266 }] }],
  });

  assert.throws(
    () => decodeCssorawValues(raw, 37, [
      { name: "zone_hgt", valueType: "f32", bytes: 4, offset: 0x1000 },
    ]),
    (error) => error instanceof CompiledPathInspectorError
      && error.code === "probe-raw-frontier-missing",
  );
});

test("fails closed when a requested value was not captured", () => {
  const raw = createCssoraw({
    ranges: [{ offset: 0x1000, bytes: 4 }],
    records: [{ tick: 37, active: true, values: [{ range: 0, f32: 266 }] }],
  });

  assert.throws(
    () => decodeCssorawValues(raw, 37, [
      { name: "zone_hgt", valueType: "f32", bytes: 4, offset: 0x2000 },
    ]),
    (error) => error instanceof CompiledPathInspectorError
      && error.code === "probe-raw-symbol-missing",
  );
});

function createCssoraw({ ranges, records }) {
  const payloadBytes = ranges.reduce((sum, { bytes }) => sum + bytes, 0);
  const headerBytes = 16 + ranges.length * 8;
  const recordBytes = 28 + payloadBytes;
  const buffer = Buffer.alloc(headerBytes + records.length * recordBytes);
  buffer.write("CSSORAW2", 0, "latin1");
  buffer.writeUInt32LE(2, 8);
  buffer.writeUInt32LE(ranges.length, 12);
  let cursor = 16;
  for (const range of ranges) {
    buffer.writeUInt32LE(range.offset, cursor);
    buffer.writeUInt32LE(range.bytes, cursor + 4);
    cursor += 8;
  }
  for (const [recordIndex, record] of records.entries()) {
    const recordOffset = headerBytes + recordIndex * recordBytes;
    buffer.writeUInt32LE(0x314b4954, recordOffset);
    buffer.writeUInt32LE(recordIndex, recordOffset + 4);
    buffer.writeUInt32LE(record.tick, recordOffset + 20);
    buffer.writeUInt32LE(record.active ? 1 : 0, recordOffset + 24);
    let payloadBase = recordOffset + 28;
    for (const [rangeIndex, range] of ranges.entries()) {
      const value = record.values.find(({ range: target }) => target === rangeIndex);
      if (value?.f32 !== undefined) buffer.writeFloatLE(value.f32, payloadBase);
      if (value?.i16 !== undefined) buffer.writeInt16LE(value.i16, payloadBase);
      payloadBase += range.bytes;
    }
  }
  return buffer;
}
