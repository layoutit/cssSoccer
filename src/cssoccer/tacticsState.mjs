export const CSSOCCER_TACTICS_STATE_SCHEMA = "cssoccer-tactics-state@1";

export const CSSOCCER_TACTICS_SOURCE = deepFreeze({
  formationId: 0,
  formationSymbol: "F_4_3_3",
  tableRows: 70,
  outfieldPlayers: 10,
  coordinates: 2,
  files: [
    {
      file: "TAC_433.TAC",
      sha256: "79b999a42b9b32062445f10aeb35be3110f6e6c5c4e0a68454df271b538903d9",
    },
    {
      file: "FOOTBALL.CPP",
      sha256: "4054e55bbd5471ad0fa76c192562ee269f4ea0978e38f61d2eb0782439128b10",
    },
    {
      file: "INTELL.CPP",
      sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
    },
  ],
  sourceOwners: {
    fixtureFormation: "EURO_MAT.CPP tac_1/tac_2 initialization",
    tableLoad: "FOOTBALL.CPP load_new_tactics",
    liveTarget: "INTELL.CPP get_target/find_zonal_target",
  },
});

export const CSSOCCER_TACTICS_GAPS = deepFreeze([
  {
    id: "prepared-tactic-table",
    status: "implemented",
    reason: "The fixture assembler publishes the pinned TAC_433 table and the root match state binds its SHA-256.",
  },
  {
    id: "analogue-zone-interpolation",
    status: "implemented",
    reason: "BALL.CPP zone centers and INTELL.CPP bilinear interpolation are bound from the live ball position.",
  },
  {
    id: "restart-target-overrides",
    status: "owned-by-rules-restarts",
    reason: "Rows and overrides for dead-ball play belong to the restart/rules lanes.",
  },
]);

const LIVE_ZONE_COUNT = 32;
const POSSESSION_ZONE_OFFSET = 32;
const TABLE_ROWS = 70;
const OUTFIELD_PLAYERS = 10;

// setup_alarm stores these fixture-scaled values before the match. They are
// not pitchLength/8 and pitchWidth/4; get_target divides analogue offsets by
// these exact f32 globals.
export const CSSOCCER_TACTICS_ZONE_GRID = deepFreeze({
  width: 182,
  height: 266,
  sourceOwner: "FOOTBALL.CPP setup_alarm; TEST.MAP zone_wid/zone_hgt",
  valueType: "f32",
});

/**
 * Bind already-prepared source tactic values. This module intentionally does
 * not read the original TAC file in the browser.
 */
export function createCssoccerTacticsState({ A, B } = {}) {
  return deepFreeze({
    schema: CSSOCCER_TACTICS_STATE_SCHEMA,
    status: "ready",
    slots: {
      A: requireSlot(A, "A"),
      B: requireSlot(B, "B"),
    },
    unsupported: CSSOCCER_TACTICS_GAPS.filter(({ status }) => status === "unsupported"),
  });
}

export function createUnsupportedCssoccerTacticsState() {
  return deepFreeze({
    schema: CSSOCCER_TACTICS_STATE_SCHEMA,
    status: "unsupported",
    gaps: CSSOCCER_TACTICS_GAPS,
  });
}

/**
 * Resolve the source table cell for normal play. Team B is mirrored by the
 * same pitch transform used by INTELL.CPP.
 */
export function resolveCssoccerZonalTarget(state, {
  nativeTeamSlot,
  nativePlayerNumber,
  ballZone,
  zoneCenter,
  teamInPossession,
  pitchLength = 1280,
  pitchWidth = 800,
  analogue = false,
  ballPosition,
} = {}) {
  requireReadyState(state);
  requireTeamSlot(nativeTeamSlot, "nativeTeamSlot");
  const restartRow = ballZone >= 64;
  if (!restartRow && (ballZone < 0 || ballZone >= LIVE_ZONE_COUNT)) {
    throw new RangeError("ballZone must be a live zone or source restart row 64..69.");
  }
  requireIntegerRange(ballZone, 0, TABLE_ROWS - 1, "ballZone");
  if (typeof teamInPossession !== "boolean") {
    throw new TypeError("teamInPossession must be boolean.");
  }
  if (typeof analogue !== "boolean") {
    throw new TypeError("analogue must be boolean.");
  }
  requirePositiveFinite(pitchLength, "pitchLength");
  requirePositiveFinite(pitchWidth, "pitchWidth");

  const outfieldIndex = outfieldIndexFor(nativeTeamSlot, nativePlayerNumber);
  const row = restartRow
    ? ballZone
    : ballZone + (teamInPossession ? POSSESSION_ZONE_OFFSET : 0);
  const values = state.slots[nativeTeamSlot].values;
  let [sourceX, sourceY] = values[row][outfieldIndex];
  if (analogue) {
    const ball = requirePoint(ballPosition, "ballPosition");
    [sourceX, sourceY] = interpolateAnalogueTarget({
      values,
      row,
      outfieldIndex,
      ballZone,
      zoneCenter,
      nativeTeamSlot,
      ball,
      pitchLength,
      pitchWidth,
    });
  }
  const x = nativeTeamSlot === "A" ? sourceX : Math.fround(pitchLength - sourceX);
  const y = nativeTeamSlot === "A" ? sourceY : Math.fround(pitchWidth - sourceY);
  return deepFreeze({
    schema: "cssoccer-zonal-target@1",
    status: analogue ? "exact-analogue-interpolation" : "exact-table-cell",
    nativeTeamSlot,
    nativePlayerNumber,
    ballZone,
    possessionTable: teamInPossession,
    tableRow: row,
    outfieldIndex,
    source: { x: sourceX, y: sourceY },
    target: { x, y },
    formationId: state.slots[nativeTeamSlot].formationId,
    tableSha256: state.slots[nativeTeamSlot].tableSha256,
  });
}

function interpolateAnalogueTarget({
  values,
  row,
  outfieldIndex,
  ballZone,
  zoneCenter,
  nativeTeamSlot,
  ball,
  pitchLength,
  pitchWidth,
}) {
  const f32 = Math.fround;
  const zoneWidth = f32(CSSOCCER_TACTICS_ZONE_GRID.width);
  const zoneHeight = f32(CSSOCCER_TACTICS_ZONE_GRID.height);
  const centre = zoneCenter === undefined
    ? {
        x: f32((ballZone % 8) * zoneWidth),
        y: f32(Math.trunc(ballZone / 8) * zoneHeight),
      }
    : requirePoint(zoneCenter, "zoneCenter");
  const zoneX = centre.x;
  const zoneY = centre.y;
  const boundedX = f32(Math.min(Math.max(ball.x, 0), pitchLength));
  const boundedY = f32(Math.min(Math.max(ball.y, 0), pitchWidth));
  // Team B's mirror and zone subtraction form one source expression. There is
  // no float local between `(pitch_* - b*)` and `- z*`; Watcom stores only the
  // final ox/oy result.
  const ox = nativeTeamSlot === "A"
    ? f32(boundedX - zoneX)
    : f32((pitchLength - boundedX) - zoneX);
  const oy = nativeTeamSlot === "A"
    ? f32(boundedY - zoneY)
    : f32((pitchWidth - boundedY) - zoneY);
  const [x, y] = values[row][outfieldIndex];
  let xa;
  let ya;
  let xb;
  let yb;
  let xc;
  let yc;
  let neighbor;

  if (ox <= 0) {
    neighbor = Math.max(row - 1, 0);
    [xa, ya] = values[neighbor][outfieldIndex];
    if (oy <= 0) {
      neighbor = Math.max(row - 9, 0);
      [xb, yb] = values[neighbor][outfieldIndex];
      [xc, yc] = values[neighbor + 1][outfieldIndex];
    } else {
      neighbor = Math.min(row + 8, 31);
      [xb, yb] = values[neighbor - 1][outfieldIndex];
      [xc, yc] = values[neighbor][outfieldIndex];
    }
  } else {
    neighbor = Math.min(row + 1, 31);
    [xa, ya] = values[neighbor][outfieldIndex];
    if (oy <= 0) {
      neighbor = Math.max(row - 8, 0);
      [xb, yb] = values[neighbor + 1][outfieldIndex];
      [xc, yc] = values[neighbor][outfieldIndex];
    } else {
      neighbor = Math.min(row + 9, 31);
      [xb, yb] = values[neighbor][outfieldIndex];
      [xc, yc] = values[neighbor - 1][outfieldIndex];
    }
  }

  const absX = f32(Math.abs(ox));
  const absY = f32(Math.abs(oy));
  // Each named C local is an f32 store, while the source expression on its
  // right-hand side is evaluated before that store.
  const xintAb = f32(xa + (((xb - xa) * absY) / zoneHeight));
  const xintHc = f32(x + (((xc - x) * absY) / zoneHeight));
  const yintCb = f32(yc + (((yb - yc) * absX) / zoneWidth));
  const yintHa = f32(y + (((ya - y) * absX) / zoneWidth));
  return [
    f32(xintHc + (((xintAb - xintHc) * absX) / zoneWidth)),
    f32(yintHa + (((yintCb - yintHa) * absY) / zoneHeight)),
  ];
}

export function assertCssoccerTacticsState(state) {
  requirePlainObject(state, "cssoccer tactics state");
  if (state.schema !== CSSOCCER_TACTICS_STATE_SCHEMA) {
    throw new Error(`Tactics state must use ${CSSOCCER_TACTICS_STATE_SCHEMA}.`);
  }
  if (state.status === "unsupported") {
    if (!Array.isArray(state.gaps) || state.gaps.length === 0) {
      throw new Error("Unsupported tactics state must enumerate its gaps.");
    }
    return state;
  }
  requireReadyState(state);
  return state;
}

function requireReadyState(state) {
  requirePlainObject(state, "cssoccer tactics state");
  if (
    state.schema !== CSSOCCER_TACTICS_STATE_SCHEMA
    || state.status !== "ready"
    || state.slots === null
    || typeof state.slots !== "object"
  ) {
    throw new Error(
      "Zonal targeting requires a ready prepared tactic table; the current unsupported state cannot be used.",
    );
  }
  requireSlot(state.slots.A, "A");
  requireSlot(state.slots.B, "B");
}

function requireSlot(value, slot) {
  requirePlainObject(value, `tactics slot ${slot}`);
  if (value.formationId !== CSSOCCER_TACTICS_SOURCE.formationId) {
    throw new Error(`Tactics slot ${slot} must bind fixed-fixture formation F_4_3_3 (0).`);
  }
  if (!/^[a-f0-9]{64}$/u.test(value.tableSha256 ?? "")) {
    throw new Error(`Tactics slot ${slot} requires its prepared table SHA-256.`);
  }
  if (!Array.isArray(value.values) || value.values.length !== TABLE_ROWS) {
    throw new Error(`Tactics slot ${slot} must contain exactly ${TABLE_ROWS} rows.`);
  }
  const values = value.values.map((row, rowIndex) => {
    if (!Array.isArray(row) || row.length !== OUTFIELD_PLAYERS) {
      throw new Error(
        `Tactics slot ${slot} row ${rowIndex} must contain ${OUTFIELD_PLAYERS} outfield targets.`,
      );
    }
    return row.map((point, playerIndex) => {
      if (
        !Array.isArray(point)
        || point.length !== 2
        || point.some((entry) => !Number.isSafeInteger(entry))
      ) {
        throw new TypeError(
          `Tactics slot ${slot} row ${rowIndex} player ${playerIndex} must be two source integers.`,
        );
      }
      return [...point];
    });
  });
  return deepFreeze({
    formationId: value.formationId,
    tableSha256: value.tableSha256,
    values,
  });
}

function outfieldIndexFor(slot, nativePlayerNumber) {
  requireIntegerRange(nativePlayerNumber, 1, 22, "nativePlayerNumber");
  if (slot === "A") {
    if (nativePlayerNumber < 2 || nativePlayerNumber > 11) {
      throw new Error("Team A zonal targets are defined only for native outfield players 2..11.");
    }
    return nativePlayerNumber - 2;
  }
  if (nativePlayerNumber < 13 || nativePlayerNumber > 22) {
    throw new Error("Team B zonal targets are defined only for native outfield players 13..22.");
  }
  return nativePlayerNumber - 13;
}

function requireTeamSlot(value, label) {
  if (value !== "A" && value !== "B") throw new Error(`${label} must be A or B.`);
}

function requireIntegerRange(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer in ${minimum}..${maximum}.`);
  }
}

function requirePositiveFinite(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive finite number.`);
  }
}

function requirePoint(value, label) {
  requirePlainObject(value, label);
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new TypeError(`${label} must contain finite x and y.`);
  }
  return { x: Math.fround(value.x), y: Math.fround(value.y) };
}

function requirePlainObject(value, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype
      && Object.getPrototypeOf(value) !== null)
  ) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
