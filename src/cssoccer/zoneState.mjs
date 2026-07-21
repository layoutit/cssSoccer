const f32 = Math.fround;

export const CSSOCCER_ZONE_STATE_SCHEMA = "cssoccer-ball-zone-state@1";

export const CSSOCCER_ZONE_SOURCE = deepFreeze({
  files: [
    {
      file: "BALL.CPP",
      sha256: "7d043a49395d3f5bd039188b8100dd40142e075aebf2fbe8fd2517c5a9e9bd99",
      producer: "get_ball_zone lines 354-402",
    },
    {
      file: "FOOTBALL.CPP",
      sha256: "4054e55bbd5471ad0fa76c192562ee269f4ea0978e38f61d2eb0782439128b10",
      producer: "init_match analogue=1 lines 690-850",
    },
  ],
  pitchLength: 1280,
  pitchWidth: 800,
  columns: 8,
  rows: 4,
  zoneWidth: 182,
  zoneHeight: 266,
  analogue: true,
});

export function createCssoccerZoneState(input = {}) {
  requirePlainObject(input, "zone state input");
  const A = createSlot(input.A, "A");
  const B = createSlot(input.B, "B");
  return deepFreeze({
    schema: CSSOCCER_ZONE_STATE_SCHEMA,
    analogue: true,
    A,
    B,
  });
}

/** Reproduce BALL.CPP::get_ball_zone, including its retained edge behavior. */
export function stepCssoccerZoneState(state, {
  ballPosition,
  ballOutOfPlay,
  matchMode,
  ballInHands,
  possessionPlayer,
} = {}) {
  const current = assertCssoccerZoneState(state);
  const position = requirePoint(ballPosition, "ballPosition");
  requireInt32(ballOutOfPlay, "ballOutOfPlay");
  requireInt32(matchMode, "matchMode");
  requireFlag(ballInHands, "ballInHands");
  requireInt32(possessionPlayer, "possessionPlayer");
  if (ballOutOfPlay < 0 || matchMode < 0 || matchMode > 19 || possessionPlayer < 0 || possessionPlayer > 22) {
    throw new RangeError("Zone inputs are outside their native ranges.");
  }

  if (ballOutOfPlay !== 0 || (matchMode !== 0 && matchMode <= 10)) return current;
  const next = clone(current);
  if (ballInHands === 1) {
    if (possessionPlayer === 1) {
      next.A.ballZone = 11;
      next.B.ballZone = 20;
    } else if (possessionPlayer === 12) {
      next.A.ballZone = 19;
      next.B.ballZone = 12;
    }
    return createCssoccerZoneState({ A: next.A, B: next.B });
  }

  const zoneWidth = f32(CSSOCCER_ZONE_SOURCE.zoneWidth);
  const zoneHeight = f32(CSSOCCER_ZONE_SOURCE.zoneHeight);
  let bx1 = Math.trunc(position.x);
  let by1 = Math.trunc(position.y);
  bx1 = Math.trunc(f32(f32(bx1 + f32(zoneWidth / 2)) / zoneWidth));
  by1 = Math.trunc(f32(f32(by1 + f32(zoneHeight / 2)) / zoneHeight));
  const bx2 = 7 - bx1;
  const by2 = 3 - by1;
  next.A.zoneCenter = { x: bx1 * zoneWidth, y: by1 * zoneHeight };
  next.B.zoneCenter = { x: bx2 * zoneWidth, y: by2 * zoneHeight };
  if (by2 >= 0) {
    next.A.ballZone = (by1 * 8) + bx1;
    next.B.ballZone = (by2 * 8) + bx2;
  }
  return createCssoccerZoneState({ A: next.A, B: next.B });
}

export function assertCssoccerZoneState(state) {
  requirePlainObject(state, "zone state");
  if (state.schema !== CSSOCCER_ZONE_STATE_SCHEMA || state.analogue !== true) {
    throw new Error(`Zone state must use ${CSSOCCER_ZONE_STATE_SCHEMA} with analogue enabled.`);
  }
  createSlot(state.A, "A");
  createSlot(state.B, "B");
  return state;
}

function createSlot(value = { ballZone: 0, zoneCenter: { x: 0, y: 0 } }, label) {
  requirePlainObject(value, `zone slot ${label}`);
  if (!Number.isSafeInteger(value.ballZone)) {
    throw new TypeError(`zone slot ${label} ballZone must be an integer.`);
  }
  const zoneCenter = requirePoint(value.zoneCenter, `zone slot ${label} center`);
  return deepFreeze({ ballZone: value.ballZone, zoneCenter });
}

function requirePoint(value, label) {
  requirePlainObject(value, label);
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new TypeError(`${label} must contain finite x and y.`);
  }
  return { x: f32(value.x), y: f32(value.y) };
}

function requireFlag(value, label) {
  if (value !== 0 && value !== 1) throw new TypeError(`${label} must be 0 or 1.`);
}

function requireInt32(value, label) {
  if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
    throw new TypeError(`${label} must be int32.`);
  }
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

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clone(entry)]));
  }
  return value;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
