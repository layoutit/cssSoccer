import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const CSSOCCER_GEOMETRY_ADAPTER_SCHEMA = "cssoccer-actua-geometry-adapter@1";

export const cssoccerFormatAdapters = Object.freeze([
  Object.freeze({
    id: "watcom-omf32-static-geometry",
    format: "Intel OMF32",
    inputs: Object.freeze(["DATA.OBJ", "3DENG.OBJ"]),
    output: "named native float point lists, signed-word face lists, and compiled selector bindings",
  }),
  Object.freeze({
    id: "actua-offset-archive",
    format: "uint32le offset/size records plus DAT payload",
    inputs: Object.freeze(["EUROREND.OFF", "EUROREND.DAT"]),
    output: "validated selector-addressed stadium point and face records",
  }),
]);

const OMF32 = Object.freeze({
  PUBDEF: 0x91,
  LNAMES: 0x96,
  SEGDEF: 0x99,
  LEDATA: 0xa1,
  LIDATA: 0xa3,
});

const STADIUM_ENTRY_BYTES = 240;
const NATIVE_VISUAL_STADIUM_ENTRY_INDEX = 0;
const STAND_SYMBOLS_IN_SOURCE_ORDER = Object.freeze([
  Object.freeze({ slot: 1, pointsFile: "PTS_STAD04", facesFile: "FCE_STAD04" }),
  Object.freeze({ slot: 2, pointsFile: "PTS_STAD01", facesFile: "FCE_STAD01" }),
  Object.freeze({ slot: 3, pointsFile: "PTS_STAD02", facesFile: "FCE_STAD02" }),
  Object.freeze({ slot: 4, pointsFile: "PTS_STAD03", facesFile: "FCE_STAD03" }),
]);

export async function readActuaB6GeometryInputs({ sourceRoot } = {}) {
  requireSourceRoot(sourceRoot);
  const [dataObjectBytes, engineObjectBytes, archiveDataBytes, archiveIndexBytes] = await Promise.all([
    readFile(sourceFile(sourceRoot, "DATA.OBJ")),
    readFile(sourceFile(sourceRoot, "3DENG.OBJ")),
    readFile(sourceFile(sourceRoot, "EUROREND.DAT")),
    readFile(sourceFile(sourceRoot, "EUROREND.OFF")),
  ]);

  const dataObject = decodeWatcomOmf32Object(dataObjectBytes, { label: "DATA.OBJ" });
  const engineObject = decodeWatcomOmf32Object(engineObjectBytes, { label: "3DENG.OBJ" });
  const archive = decodeActuaOffsetArchive({
    dataBytes: archiveDataBytes,
    indexBytes: archiveIndexBytes,
    label: "EUROREND",
  });
  const stadiumSelectors = extractNativeVisualStadiumSelectors({ engineObject, archive });

  return Object.freeze({
    schema: CSSOCCER_GEOMETRY_ADAPTER_SCHEMA,
    dataObject,
    archive,
    stadiumSelectors,
    inputHashes: Object.freeze({
      dataObjectSha256: sha256(dataObjectBytes),
      engineObjectSha256: sha256(engineObjectBytes),
      archiveDataSha256: sha256(archiveDataBytes),
      archiveIndexSha256: sha256(archiveIndexBytes),
    }),
  });
}

export function decodeWatcomOmf32Object(value, { label = "OMF32 object" } = {}) {
  const bytes = requireBuffer(value, label);
  const segmentDefinitions = [null];
  const publicSymbols = [];
  const dataRecords = [];
  let offset = 0;
  let recordCount = 0;
  let uncheckedRecordCount = 0;

  while (offset < bytes.length) {
    if (offset + 3 > bytes.length) throw new Error(`${label} ends inside an OMF record header.`);
    const type = bytes[offset];
    const length = bytes.readUInt16LE(offset + 1);
    const recordEnd = offset + 3 + length;
    if (length < 1 || recordEnd > bytes.length) {
      throw new Error(`${label} has an invalid OMF record length at byte ${offset}.`);
    }
    let checksum = 0;
    for (let index = offset; index < recordEnd; index += 1) checksum = (checksum + bytes[index]) & 0xff;
    if (checksum !== 0 && bytes[recordEnd - 1] !== 0) {
      throw new Error(`${label} has an invalid OMF checksum at byte ${offset}.`);
    }
    if (checksum !== 0) uncheckedRecordCount += 1;

    const payload = bytes.subarray(offset + 3, recordEnd - 1);
    const cursor = { offset: 0 };
    if (type === OMF32.SEGDEF) {
      const attributes = readByte(payload, cursor, label);
      if ((attributes >> 5) === 0) {
        readUInt16(payload, cursor, label);
        readByte(payload, cursor, label);
      }
      const size = readUInt32(payload, cursor, label);
      readOmfIndex(payload, cursor, label);
      readOmfIndex(payload, cursor, label);
      readOmfIndex(payload, cursor, label);
      segmentDefinitions.push(Object.freeze({ size }));
    } else if (type === OMF32.PUBDEF) {
      const groupIndex = readOmfIndex(payload, cursor, label);
      const segmentIndex = readOmfIndex(payload, cursor, label);
      if (groupIndex === 0 && segmentIndex === 0) readUInt16(payload, cursor, label);
      while (cursor.offset < payload.length) {
        const encodedName = readOmfString(payload, cursor, label);
        const symbolOffset = readUInt32(payload, cursor, label);
        readOmfIndex(payload, cursor, label);
        const name = normalizeWatcomSymbolName(encodedName);
        if (name) publicSymbols.push({ encodedName, name, segmentIndex, offset: symbolOffset });
      }
    } else if (type === OMF32.LEDATA || type === OMF32.LIDATA) {
      const segmentIndex = readOmfIndex(payload, cursor, label);
      const dataOffset = readUInt32(payload, cursor, label);
      const data = type === OMF32.LEDATA
        ? Buffer.from(payload.subarray(cursor.offset))
        : decodeOmfIteratedBlocks(payload, cursor, label);
      if (cursor.offset !== payload.length && type === OMF32.LIDATA) {
        throw new Error(`${label} has trailing bytes in an iterated-data record.`);
      }
      dataRecords.push({ segmentIndex, offset: dataOffset, data });
    }
    recordCount += 1;
    offset = recordEnd;
  }
  if (offset !== bytes.length || segmentDefinitions.length === 1) {
    throw new Error(`${label} is not a complete OMF32 object.`);
  }

  const segments = segmentDefinitions.map((definition, segmentIndex) => {
    if (segmentIndex === 0) return null;
    const segment = Buffer.alloc(definition.size);
    const written = new Uint8Array(definition.size);
    for (const record of dataRecords.filter((entry) => entry.segmentIndex === segmentIndex)) {
      if (record.offset + record.data.length > segment.length) {
        throw new Error(`${label} data record exceeds segment ${segmentIndex}.`);
      }
      for (let index = 0; index < record.data.length; index += 1) {
        const target = record.offset + index;
        if (written[target] && segment[target] !== record.data[index]) {
          throw new Error(`${label} has conflicting data records in segment ${segmentIndex}.`);
        }
        segment[target] = record.data[index];
        written[target] = 1;
      }
    }
    return segment;
  });

  const sortedSymbols = [...publicSymbols].sort((left, right) => (
    left.segmentIndex - right.segmentIndex || left.offset - right.offset || left.name.localeCompare(right.name)
  ));
  const symbols = new Map();
  sortedSymbols.forEach((symbol, index) => {
    const segment = segments[symbol.segmentIndex];
    if (!segment || symbol.offset > segment.length) return;
    const next = sortedSymbols.slice(index + 1).find((candidate) => candidate.segmentIndex === symbol.segmentIndex);
    const end = next?.offset ?? segment.length;
    if (end < symbol.offset || end > segment.length) {
      throw new Error(`${label} public symbol ${symbol.name} has an invalid range.`);
    }
    symbols.set(symbol.name, Object.freeze({
      encodedName: symbol.encodedName,
      segmentIndex: symbol.segmentIndex,
      offset: symbol.offset,
      end,
    }));
  });

  return Object.freeze({
    schema: "watcom-omf32-object@1",
    label,
    byteLength: bytes.length,
    sha256: sha256(bytes),
    recordCount,
    uncheckedRecordCount,
    symbolNames: Object.freeze([...symbols.keys()].sort()),
    symbolInfo(name) {
      const symbol = symbols.get(name);
      if (!symbol) throw new Error(`${label} is missing public symbol ${name}.`);
      return symbol;
    },
    symbolBytes(name) {
      const symbol = this.symbolInfo(name);
      return Buffer.from(segments[symbol.segmentIndex].subarray(symbol.offset, symbol.end));
    },
  });
}

export function decodeActuaOffsetArchive({ dataBytes, indexBytes, label = "Actua archive" } = {}) {
  const data = requireBuffer(dataBytes, `${label} data`);
  const index = requireBuffer(indexBytes, `${label} index`);
  if (index.length === 0 || index.length % 8 !== 0) {
    throw new Error(`${label} index length must be a nonzero multiple of eight bytes.`);
  }
  const records = [];
  let expectedOffset = 0;
  let gapByteCount = 0;
  for (let recordIndex = 0; recordIndex < index.length / 8; recordIndex += 1) {
    const offset = index.readUInt32LE(recordIndex * 8);
    const size = index.readUInt32LE(recordIndex * 8 + 4);
    if ((recordIndex === 0 && offset !== 0) || offset < expectedOffset || offset + size > data.length) {
      throw new Error(`${label} index record ${recordIndex} overlaps, starts late, or is out of bounds.`);
    }
    const gapBefore = offset - expectedOffset;
    gapByteCount += gapBefore;
    records.push(Object.freeze({ recordIndex, selector: recordIndex * 8, offset, size, gapBefore }));
    expectedOffset = offset + size;
  }
  if (expectedOffset !== data.length) throw new Error(`${label} index does not cover the final data byte.`);

  return Object.freeze({
    schema: "actua-offset-archive@1",
    label,
    dataSha256: sha256(data),
    indexSha256: sha256(index),
    recordCount: records.length,
    gapByteCount,
    records: Object.freeze(records),
    recordInfo(selector) {
      const record = recordForSelector(records, selector, label);
      return record;
    },
    recordBytes(selector) {
      const record = recordForSelector(records, selector, label);
      return Buffer.from(data.subarray(record.offset, record.offset + record.size));
    },
  });
}

export function decodeActuaPointList(value, { id = "point list" } = {}) {
  const bytes = requireBuffer(value, id);
  if (bytes.length < 4) throw new Error(`${id} is shorter than its point count.`);
  const pointCount = bytes.readFloatLE(0);
  if (!Number.isSafeInteger(pointCount) || pointCount < 1 || pointCount > 10_000) {
    throw new Error(`${id} has an invalid float point count.`);
  }
  const consumedBytes = 4 + pointCount * 12;
  if (consumedBytes > bytes.length) throw new Error(`${id} ends inside its point payload.`);
  assertZeroPadding(bytes.subarray(consumedBytes), id);
  const points = [];
  for (let index = 0; index < pointCount; index += 1) {
    const offset = 4 + index * 12;
    const point = [bytes.readFloatLE(offset), bytes.readFloatLE(offset + 4), bytes.readFloatLE(offset + 8)];
    if (!point.every(Number.isFinite)) throw new Error(`${id} point ${index} is not finite.`);
    points.push(Object.freeze(point));
  }
  return Object.freeze({
    id,
    pointCount,
    points: Object.freeze(points),
    consumedBytes,
    sha256: sha256(bytes.subarray(0, consumedBytes)),
  });
}

export function decodeActuaFaceList(value, { id = "face list", pointCount } = {}) {
  const bytes = requireBuffer(value, id);
  if (!Number.isSafeInteger(pointCount) || pointCount < 1) {
    throw new TypeError(`${id} requires a positive pointCount.`);
  }
  if (bytes.length < 2) throw new Error(`${id} is shorter than its face count.`);
  const faceCount = bytes.readUInt16LE(0);
  let offset = 2;
  const faces = [];
  for (let faceIndex = 0; faceIndex < faceCount; faceIndex += 1) {
    if (offset + 4 > bytes.length) throw new Error(`${id} ends inside face ${faceIndex}.`);
    const primitiveCode = bytes.readInt16LE(offset);
    const sourceColorCode = bytes.readInt16LE(offset + 2);
    offset += 4;
    const payloadCount = facePayloadWordCount(primitiveCode, id, faceIndex);
    if (offset + payloadCount * 2 > bytes.length) throw new Error(`${id} ends inside face ${faceIndex} payload.`);
    const payload = [];
    for (let index = 0; index < payloadCount; index += 1) {
      payload.push(bytes.readInt16LE(offset));
      offset += 2;
    }
    const vertexIndexCount = primitiveCode >= 2 ? primitiveCode : primitiveCode === 0 ? 2 : 3;
    const pointIndexes = payload.slice(0, vertexIndexCount);
    if (pointIndexes.some((pointIndex) => pointIndex < 0 || pointIndex >= pointCount)) {
      throw new Error(`${id} face ${faceIndex} references a point outside 0..${pointCount - 1}.`);
    }
    faces.push(Object.freeze({
      faceIndex,
      primitiveCode,
      primitive: primitiveCode === 2 ? "line" : primitiveCode === 0
        ? "cylinder-map" : primitiveCode === 1 ? "elliptical-cylinder-map" : "polygon",
      sourceColorCode,
      pointIndexes: Object.freeze(pointIndexes),
      payload: Object.freeze(payload),
    }));
  }
  assertZeroPadding(bytes.subarray(offset), id);
  return Object.freeze({
    id,
    faceCount,
    faces: Object.freeze(faces),
    consumedBytes: offset,
    sha256: sha256(bytes.subarray(0, offset)),
  });
}

export function extractNativeVisualStadiumSelectors({ engineObject, archive } = {}) {
  if (!engineObject || typeof engineObject.symbolBytes !== "function") {
    throw new TypeError("Native visual stadium selector extraction requires a decoded engine object.");
  }
  if (!archive || typeof archive.recordBytes !== "function") {
    throw new TypeError("Native visual stadium selector extraction requires a decoded archive.");
  }
  const stadlist = engineObject.symbolBytes("stadlist");
  const entryOffset = NATIVE_VISUAL_STADIUM_ENTRY_INDEX * STADIUM_ENTRY_BYTES;
  if (entryOffset + STADIUM_ENTRY_BYTES > stadlist.length) {
    throw new Error("Compiled stadlist does not contain native visual entry index 0.");
  }
  const entry = stadlist.subarray(entryOffset, entryOffset + STADIUM_ENTRY_BYTES);
  const textureTableSelector = entry.readInt32LE(12);
  const textureBitmapSelectors = Object.freeze([
    entry.readInt32LE(16),
    entry.readInt32LE(20),
  ]);
  const textureTableRecord = archive.recordInfo(textureTableSelector);
  const textureBitmapRecords = Object.freeze(
    textureBitmapSelectors.map((selector) => archive.recordInfo(selector)),
  );
  if (
    textureTableRecord.size !== 49 * 32
    || textureBitmapRecords.some(({ size }) => size !== 256 * 256)
  ) {
    throw new Error("Native visual stadium textures changed from one 49-record table and two map pages.");
  }
  const bindings = STAND_SYMBOLS_IN_SOURCE_ORDER.map((source, index) => {
    const base = 24 + index * 20;
    const pointsSelector = entry.readInt32LE(base + 12);
    const facesSelector = entry.readInt32LE(base + 16);
    const pointList = decodeActuaPointList(archive.recordBytes(pointsSelector), { id: source.pointsFile });
    const faceList = decodeActuaFaceList(archive.recordBytes(facesSelector), {
      id: source.facesFile,
      pointCount: pointList.pointCount,
    });
    return Object.freeze({
      ...source,
      offset: Object.freeze([
        entry.readFloatLE(base),
        entry.readFloatLE(base + 4),
        entry.readFloatLE(base + 8),
      ]),
      pointsSelector,
      facesSelector,
      pointCount: pointList.pointCount,
      faceCount: faceList.faceCount,
      pointsRecord: archive.recordInfo(pointsSelector),
      facesRecord: archive.recordInfo(facesSelector),
    });
  });
  if (new Set(bindings.flatMap(({ pointsSelector, facesSelector }) => [pointsSelector, facesSelector])).size !== 8) {
    throw new Error("Native visual stadium selector bindings are not eight distinct archive records.");
  }
  return Object.freeze({
    schema: "cssoccer-native-visual-stadium-selectors@1",
    entryIndex: NATIVE_VISUAL_STADIUM_ENTRY_INDEX,
    bindingAuthority: "3DENG.OBJ compiled stadlist[0] layout and selectors plus FILES.C symbolic slot order",
    layout: Object.freeze({
      dimensions: Object.freeze({
        st_w: entry.readInt32LE(104),
        st_l: entry.readInt32LE(108),
        st_h: entry.readInt32LE(112),
      }),
      videoAnchors: Object.freeze([
        Object.freeze([entry.readInt32LE(200), entry.readInt32LE(204), entry.readInt32LE(208)]),
        Object.freeze([entry.readInt32LE(212), entry.readInt32LE(216), entry.readInt32LE(220)]),
      ]),
      tunnelAnchor: Object.freeze([
        entry.readInt32LE(224),
        entry.readInt32LE(228),
        entry.readInt32LE(232),
      ]),
      vmap: entry.readInt32LE(236),
    }),
    textures: Object.freeze({
      tableSymbol: "TMD_STAD0",
      tableSelector: textureTableSelector,
      tableRecord: textureTableRecord,
      bitmapSymbols: Object.freeze(["BM_CLOCKX1", "BM_CLOCKX1"]),
      bitmapSelectors: textureBitmapSelectors,
      bitmapRecords: textureBitmapRecords,
      nativeMapPages: Object.freeze([8, 9]),
    }),
    bindings: Object.freeze(bindings),
  });
}

function decodeOmfIteratedBlocks(payload, cursor, label) {
  const chunks = [];
  while (cursor.offset < payload.length) chunks.push(decodeOmfIteratedBlock(payload, cursor, label, 0));
  return Buffer.concat(chunks);
}

function decodeOmfIteratedBlock(payload, cursor, label, depth) {
  if (depth > 32) throw new Error(`${label} iterated-data nesting exceeds 32 levels.`);
  const repeatCount = readUInt32(payload, cursor, label);
  const blockCount = readUInt16(payload, cursor, label);
  let unit;
  if (blockCount === 0) {
    const byteCount = readByte(payload, cursor, label);
    if (cursor.offset + byteCount > payload.length) throw new Error(`${label} ends inside iterated data.`);
    unit = Buffer.from(payload.subarray(cursor.offset, cursor.offset + byteCount));
    cursor.offset += byteCount;
  } else {
    const nested = [];
    for (let index = 0; index < blockCount; index += 1) {
      nested.push(decodeOmfIteratedBlock(payload, cursor, label, depth + 1));
    }
    unit = Buffer.concat(nested);
  }
  if (repeatCount * unit.length > 64 * 1024 * 1024) {
    throw new Error(`${label} iterated-data expansion exceeds the safety limit.`);
  }
  return Buffer.concat(Array.from({ length: repeatCount }, () => unit));
}

function normalizeWatcomSymbolName(encodedName) {
  return /^W\?([^$]+)\$/u.exec(encodedName)?.[1] ?? null;
}

function facePayloadWordCount(primitiveCode, id, faceIndex) {
  if (primitiveCode >= 2) return primitiveCode;
  if (primitiveCode === 0) return 4;
  if (primitiveCode === 1) return 6;
  throw new Error(`${id} face ${faceIndex} has unsupported primitive code ${primitiveCode}.`);
}

function recordForSelector(records, selector, label) {
  if (!Number.isSafeInteger(selector) || selector < 0 || selector % 8 !== 0) {
    throw new Error(`${label} selector must be a nonnegative multiple of eight.`);
  }
  const record = records[selector / 8];
  if (!record) throw new Error(`${label} selector ${selector} is outside the archive index.`);
  return record;
}

function readOmfIndex(bytes, cursor, label) {
  const first = readByte(bytes, cursor, label);
  return first & 0x80 ? ((first & 0x7f) << 8) | readByte(bytes, cursor, label) : first;
}

function readOmfString(bytes, cursor, label) {
  const length = readByte(bytes, cursor, label);
  if (cursor.offset + length > bytes.length) throw new Error(`${label} ends inside an OMF string.`);
  const value = bytes.subarray(cursor.offset, cursor.offset + length).toString("latin1");
  cursor.offset += length;
  return value;
}

function readByte(bytes, cursor, label) {
  if (cursor.offset >= bytes.length) throw new Error(`${label} ends inside an OMF field.`);
  return bytes[cursor.offset++];
}

function readUInt16(bytes, cursor, label) {
  if (cursor.offset + 2 > bytes.length) throw new Error(`${label} ends inside a uint16 field.`);
  const value = bytes.readUInt16LE(cursor.offset);
  cursor.offset += 2;
  return value;
}

function readUInt32(bytes, cursor, label) {
  if (cursor.offset + 4 > bytes.length) throw new Error(`${label} ends inside a uint32 field.`);
  const value = bytes.readUInt32LE(cursor.offset);
  cursor.offset += 4;
  return value;
}

function assertZeroPadding(bytes, label) {
  if ([...bytes].some((value) => value !== 0)) throw new Error(`${label} has nonzero trailing payload bytes.`);
}

function requireBuffer(value, label) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
    throw new TypeError(`${label} must be a Buffer or Uint8Array.`);
  }
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}

function requireSourceRoot(sourceRoot) {
  if (!(typeof sourceRoot === "string" && sourceRoot.length > 0) && !(sourceRoot instanceof URL)) {
    throw new TypeError("sourceRoot must be a non-empty path string or file URL.");
  }
}

function sourceFile(sourceRoot, file) {
  if (sourceRoot instanceof URL) {
    const root = sourceRoot.href.endsWith("/") ? sourceRoot : new URL(`${sourceRoot.href}/`);
    return new URL(file, root);
  }
  return join(sourceRoot, file);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
