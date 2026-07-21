import { createHash } from "node:crypto";

export const CSSOCCER_PREPARED_TACTICS_SCHEMA = "cssoccer-prepared-tactics@1";

const FIXTURE_ID = "spain-argentina-full-match";
const SOURCE_REVISION = "b40bd6d1e50e052030c5f0884fbe3deda7e9fa4b";
const TABLE_SHA256 = "79b999a42b9b32062445f10aeb35be3110f6e6c5c4e0a68454df271b538903d9";
const ROWS = 70;
const PLAYERS = 10;
const COORDINATES = 2;
const BYTES_PER_VALUE = 4;
const EXPECTED_BYTES = ROWS * PLAYERS * COORDINATES * BYTES_PER_VALUE;

/** Decode FOOTBALL.CPP::load_new_tactics' exact int32 table at prepare time. */
export function parseCssoccerTactics({ tacticsBytes } = {}) {
  const bytes = requireBytes(tacticsBytes);
  if (bytes.byteLength !== EXPECTED_BYTES) {
    throw new Error(`TAC_433.TAC must contain exactly ${EXPECTED_BYTES} bytes.`);
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== TABLE_SHA256) {
    throw new Error("TAC_433.TAC changed from the pinned source revision.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const values = Array.from({ length: ROWS }, () => Array.from({ length: PLAYERS }, () => {
    const point = [
      view.getInt32(offset, true),
      view.getInt32(offset + BYTES_PER_VALUE, true),
    ];
    offset += COORDINATES * BYTES_PER_VALUE;
    return point;
  }));
  if (offset !== EXPECTED_BYTES) throw new Error("Tactics decoder did not consume the whole table.");

  return deepFreeze({
    schema: CSSOCCER_PREPARED_TACTICS_SCHEMA,
    fixtureId: FIXTURE_ID,
    sourceRevision: SOURCE_REVISION,
    formationId: 0,
    formationSymbol: "F_4_3_3",
    tableSha256: sha256,
    layout: {
      sourceDeclaration: "int match_tactics[32*2+6][10][2]",
      rows: ROWS,
      outfieldPlayers: PLAYERS,
      coordinates: COORDINATES,
      valueType: "i32le",
      bytes: EXPECTED_BYTES,
    },
    values,
    lineage: {
      table: "TAC_433.TAC",
      load: "FOOTBALL.CPP:1049-1161 load_new_tactics",
      target: "INTELL.CPP:3400-3900 get_target/find_zonal_target",
    },
  });
}

export function assertCssoccerPreparedTactics(value) {
  if (
    value?.schema !== CSSOCCER_PREPARED_TACTICS_SCHEMA
    || value.fixtureId !== FIXTURE_ID
    || value.sourceRevision !== SOURCE_REVISION
    || value.formationId !== 0
    || value.formationSymbol !== "F_4_3_3"
    || value.tableSha256 !== TABLE_SHA256
    || value.layout?.rows !== ROWS
    || value.layout?.outfieldPlayers !== PLAYERS
    || value.layout?.coordinates !== COORDINATES
    || value.layout?.valueType !== "i32le"
    || value.layout?.bytes !== EXPECTED_BYTES
    || !Array.isArray(value.values)
    || value.values.length !== ROWS
  ) {
    throw new Error("Prepared tactics are not the pinned F_4_3_3 table.");
  }
  for (const [rowIndex, row] of value.values.entries()) {
    if (!Array.isArray(row) || row.length !== PLAYERS) {
      throw new Error(`Prepared tactics row ${rowIndex} must contain ${PLAYERS} players.`);
    }
    for (const [playerIndex, point] of row.entries()) {
      if (
        !Array.isArray(point)
        || point.length !== COORDINATES
        || point.some((entry) => !Number.isSafeInteger(entry))
      ) {
        throw new Error(`Prepared tactics row ${rowIndex} player ${playerIndex} is invalid.`);
      }
    }
  }
  return value;
}

function requireBytes(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  throw new TypeError("tacticsBytes must be a Buffer or Uint8Array.");
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
