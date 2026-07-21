import { releasePossession } from "./possessionState.mjs";

export const CSSOCCER_TACKLE_SOURCE = deepFreeze({
  files: [
    {
      file: "INTELL.CPP",
      sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
      functions: {
        playerInts: "lines 4455-4505",
      },
    },
    {
      file: "ACTIONS.CPP",
      sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
      functions: {
        initFall: "lines 2026-2044",
        initJump: "lines 2049-2090",
        tackleAction: "lines 4244-4251",
        tussleCollision: "lines 4328-4440",
        playerTussles: "lines 4444-4465",
      },
    },
  ],
  order: [
    "player_ball_interaction",
    "player_tackle_interaction",
    "intelligence_and_action",
    "tussle_enlistment",
    "cross_team_tussles_after_both_teams",
  ],
  quirks: {
    tackleVerticalGate: "INTELL.CPP assigns z from the native y offset and compares z without abs",
    tussleFallGate: "ACTIONS.CPP tests p2 SAVE_ACT in both force branches",
  },
});

export const CSSOCCER_NATIVE_CONTACT_ACTION = deepFreeze({
  stand: 0,
  run: 1,
  turn: 2,
  tackle: 3,
  jump: 4,
  fall: 5,
  save: 10,
  keeperHold: 12,
  steal: 15,
  control: 17,
  strike: 18,
});

export class UnsupportedContactSemanticsError extends Error {
  constructor(message, detail) {
    super(message);
    this.name = "UnsupportedContactSemanticsError";
    this.code = "CSSOCCER_UNSUPPORTED_CONTACT_SEMANTICS";
    this.detail = deepFreeze(detail ?? {});
  }
}

export function nativeContactActionKind(action) {
  requireI16(action, "native contact action");
  for (const [kind, value] of Object.entries(CSSOCCER_NATIVE_CONTACT_ACTION)) {
    if (value === action) return kind;
  }
  return "busy-or-unbound";
}

export function resolveTacklePlayerContacts({
  players,
  possession,
  tacklerNativePlayer,
  seed,
  profile,
} = {}) {
  const currentPlayers = requirePlayers(players);
  requireIntegerRange(tacklerNativePlayer, 1, 22, "tackler native player");
  requireIntegerRange(seed, 0, 127, "native tick seed");
  const constants = requireTackleProfile(profile);
  const tackler = currentPlayers.find(({ nativePlayer }) => nativePlayer === tacklerNativePlayer);
  const kind = nativeContactActionKind(tackler.action);
  const effective = (
    kind === "tackle" && tackler.goCount > constants.effectiveTackle
  ) || (
    kind === "steal"
    && tackler.animationFrame > 0.4
    && tackler.animationFrame < 0.6
  );
  if (!effective) {
    return deepFreeze({ players: currentPlayers, possession, events: [] });
  }

  let nextPlayers = currentPlayers;
  let nextPossession = possession;
  const events = [];
  for (let nativePlayer = 1; nativePlayer <= 22; nativePlayer += 1) {
    const target = nextPlayers.find((player) => player.nativePlayer === nativePlayer);
    if (target.action > CSSOCCER_NATIVE_CONTACT_ACTION.turn) continue;
    const x = f32(tackler.position.x - target.position.x);
    const y = f32(tackler.position.y - target.position.y);
    // Preserve the checked source assignment, including its y-for-z quirk.
    const z = f32(tackler.position.y - target.position.y);
    if (
      sourceDistance(x, y) > constants.playerSize
      || !(z < constants.playerHeight / 3)
    ) {
      continue;
    }

    const direction = facingOpponent(tackler, target);
    const chance = Math.trunc(seed / (direction + 2));
    const threshold = 42 + ((tackler.power - target.power) / 3);
    if (chance < threshold) {
      const fallen = interruptWithFall({
        players: nextPlayers,
        possession: nextPossession,
        nativePlayer,
        fallRate: constants.fallRate,
      });
      nextPlayers = fallen.players;
      nextPossession = fallen.possession;
      events.push(...fallen.events);
      if (opposingTeams(tackler.nativePlayer, nativePlayer)) {
        events.push({
          type: "foul-candidate",
          fouler: tackler.nativePlayer,
          fallenPlayer: nativePlayer,
          source: "player_ints",
        });
      }
    } else if (kind !== "steal") {
      const riding = {
        ...target,
        action: CSSOCCER_NATIVE_CONTACT_ACTION.jump,
        actionKind: "jump",
        motionContact: {
          phase: "ride-over-tackle",
          tacklerNativePlayer: tackler.nativePlayer,
        },
      };
      nextPlayers = replacePlayer(nextPlayers, nativePlayer, riding);
      events.push({
        type: "action-interrupt",
        nativePlayer,
        fromAction: target.action,
        toAction: CSSOCCER_NATIVE_CONTACT_ACTION.jump,
        reason: "ride-over-tackle",
      });
    }
  }
  return deepFreeze({
    players: nextPlayers,
    possession: nextPossession,
    events,
  });
}

export function resolvePlayerTussles({
  players,
  possession,
  traversalOrder,
  seed,
  profile,
} = {}) {
  let nextPlayers = requirePlayers(players);
  let nextPossession = possession;
  requireTraversalOrder(traversalOrder);
  requireIntegerRange(seed, 0, 127, "native tick seed");
  const constants = requireTackleProfile(profile);
  const eligible = traversalOrder.filter((nativePlayer) => {
    const action = nextPlayers.find((player) => player.nativePlayer === nativePlayer).action;
    return action <= CSSOCCER_NATIVE_CONTACT_ACTION.turn
      || action === CSSOCCER_NATIVE_CONTACT_ACTION.save;
  });
  const events = [];

  for (let leftIndex = 0; leftIndex < eligible.length; leftIndex += 1) {
    const leftNativePlayer = eligible[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < eligible.length; rightIndex += 1) {
      const rightNativePlayer = eligible[rightIndex];
      if (!opposingTeams(leftNativePlayer, rightNativePlayer)) continue;
      const result = tussleCollision({
        players: nextPlayers,
        possession: nextPossession,
        leftNativePlayer,
        rightNativePlayer,
        seed,
        profile: constants,
      });
      nextPlayers = result.players;
      nextPossession = result.possession;
      events.push(...result.events);
    }
  }
  return deepFreeze({
    players: nextPlayers,
    possession: nextPossession,
    events,
    eligible,
  });
}

function tussleCollision({
  players,
  possession,
  leftNativePlayer,
  rightNativePlayer,
  seed,
  profile,
}) {
  let left = playerByNative(players, leftNativePlayer);
  let right = playerByNative(players, rightNativePlayer);
  const distance = sourceDistance(
    f32(right.position.x - left.position.x),
    f32(right.position.y - left.position.y),
  );
  if (!(distance < profile.pitchRatio * 0.7)) {
    return { players, possession, events: [] };
  }

  let forceX = f32(
    f32(left.power * left.goDisplacement.x)
      - f32(right.power * right.goDisplacement.x),
  );
  let forceY = f32(
    f32(left.power * left.goDisplacement.y)
      - f32(right.power * right.goDisplacement.y),
  );
  let force = Math.trunc(Math.abs(forceX) + Math.abs(forceY));
  forceX = f32(left.goDisplacement.x + right.goDisplacement.x);
  forceY = f32(left.goDisplacement.y + right.goDisplacement.y);
  const power = (
    left.power + actionPowerBonus(left.action)
  ) - (
    right.power + actionPowerBonus(right.action)
  );
  const leftShoved = power + Math.trunc(seed / 2) - 32 < 0;
  const events = [{
    type: "player-tussle",
    left: left.nativePlayer,
    right: right.nativePlayer,
    leftShoved,
  }];
  let nextPlayers = players;
  let nextPossession = possession;

  if (leftShoved) {
    if (right.animation === 72) {
      right = { ...right, animation: 74, barge: 20 };
      nextPlayers = replacePlayer(nextPlayers, right.nativePlayer, right);
      events.push({ type: "barge-animation", nativePlayer: right.nativePlayer });
    }
    if (right.nativePlayer === 12) force *= 2;
    if (right.action === CSSOCCER_NATIVE_CONTACT_ACTION.save) force += 128 * 16;
    const falls = Math.trunc(force / 16) > seed
      && ((seed & 3) === 0 || right.action === CSSOCCER_NATIVE_CONTACT_ACTION.save);
    if (falls) {
      const facing = normalizedVector(forceX, forceY, "left tussle fall direction");
      nextPlayers = replacePlayer(nextPlayers, left.nativePlayer, {
        ...left,
        facing,
      });
      const fallen = interruptWithFall({
        players: nextPlayers,
        possession: nextPossession,
        nativePlayer: left.nativePlayer,
        fallRate: profile.fallRate,
      });
      nextPlayers = fallen.players;
      nextPossession = fallen.possession;
      events.push(...fallen.events);
      if (
        right.action === CSSOCCER_NATIVE_CONTACT_ACTION.save
        && ((right.possession + 2) * 32) < ((seed * profile.refereeStrictness) / 128)
      ) {
        events.push({
          type: "foul-candidate",
          fouler: right.nativePlayer,
          fallenPlayer: left.nativePlayer,
          source: "tussle_collision",
        });
      }
    } else {
      left = shovePlayer(left, forceX, forceY);
      nextPlayers = replacePlayer(nextPlayers, left.nativePlayer, left);
    }
  } else {
    if (left.animation === 72) {
      left = { ...left, animation: 74, barge: 20 };
      nextPlayers = replacePlayer(nextPlayers, left.nativePlayer, left);
      events.push({ type: "barge-animation", nativePlayer: left.nativePlayer });
    }
    const falls = Math.trunc(force / 16) > seed
      && ((seed & 3) === 0 || right.action === CSSOCCER_NATIVE_CONTACT_ACTION.save);
    if (falls) {
      const facing = normalizedVector(forceX, forceY, "right tussle fall direction");
      nextPlayers = replacePlayer(nextPlayers, right.nativePlayer, {
        ...right,
        facing,
      });
      const fallen = interruptWithFall({
        players: nextPlayers,
        possession: nextPossession,
        nativePlayer: right.nativePlayer,
        fallRate: profile.fallRate,
      });
      nextPlayers = fallen.players;
      nextPossession = fallen.possession;
      events.push(...fallen.events);
      if (
        left.action === CSSOCCER_NATIVE_CONTACT_ACTION.save
        && ((left.possession + 2) * 32) < ((seed * profile.refereeStrictness) / 128)
      ) {
        events.push({
          type: "foul-candidate",
          fouler: left.nativePlayer,
          fallenPlayer: right.nativePlayer,
          source: "tussle_collision",
        });
      }
    } else {
      right = shovePlayer(right, forceX, forceY);
      nextPlayers = replacePlayer(nextPlayers, right.nativePlayer, right);
    }
  }
  return { players: nextPlayers, possession: nextPossession, events };
}

function interruptWithFall({ players, possession, nativePlayer, fallRate }) {
  const player = playerByNative(players, nativePlayer);
  const events = [];
  let nextPossession = possession;
  if (possession.owner === nativePlayer) {
    nextPossession = releasePossession(possession);
    events.push({
      type: "possession-release",
      nativePlayer,
      reason: "fall-interruption",
    });
  }
  const nextPlayer = {
    ...player,
    action: CSSOCCER_NATIVE_CONTACT_ACTION.fall,
    actionKind: "fall",
    position: { ...player.position, z: f32(0) },
    possession: 0,
    goDisplacement: {
      x: f32(player.facing.x * fallRate),
      y: f32(player.facing.y * fallRate),
    },
  };
  events.push({
    type: "action-interrupt",
    nativePlayer,
    fromAction: player.action,
    toAction: CSSOCCER_NATIVE_CONTACT_ACTION.fall,
    reason: "fall",
  });
  return {
    players: replacePlayer(players, nativePlayer, nextPlayer),
    possession: nextPossession,
    events,
  };
}

function shovePlayer(player, forceX, forceY) {
  let x = f32(player.position.x + forceX);
  let y = f32(player.position.y + forceY);
  if (
    player.action === CSSOCCER_NATIVE_CONTACT_ACTION.run
    || player.actionKind === "jump"
  ) {
    x = f32(x - player.goDisplacement.x);
    y = f32(y - player.goDisplacement.y);
  }
  return { ...player, position: { ...player.position, x, y } };
}

function actionPowerBonus(action) {
  if (action === CSSOCCER_NATIVE_CONTACT_ACTION.steal) return 32;
  if (action === CSSOCCER_NATIVE_CONTACT_ACTION.save) return 500;
  return 0;
}

function facingOpponent(left, right) {
  return f32(
    f32(right.facing.x * left.facing.x)
      + f32(right.facing.y * left.facing.y),
  );
}

function normalizedVector(x, y, label) {
  const distance = sourceDistance(x, y);
  if (!(distance > 0)) {
    throw new UnsupportedContactSemanticsError(
      `${label} is zero; the checked source would divide by zero.`,
      { producer: "ACTIONS.CPP tussle_collision", required: ["nonzero summed displacement"] },
    );
  }
  return { x: f32(x / distance), y: f32(y / distance) };
}

function opposingTeams(left, right) {
  return (left < 12 && right > 11) || (left > 11 && right < 12);
}

function requireTackleProfile(value) {
  requirePlainObject(value, "contact source profile");
  const keys = [
    "touchBallBox",
    "atFeetDistance",
    "ballRadius",
    "playerHeight",
    "playerSize",
    "pitchRatio",
    "verticalBallDamp",
    "saveContact",
    "effectiveTackle",
    "fallRate",
    "refereeStrictness",
  ];
  requireOnlyKeys(value, keys, "contact source profile");
  for (const key of [
    "touchBallBox",
    "atFeetDistance",
    "ballRadius",
    "playerHeight",
    "playerSize",
    "pitchRatio",
    "verticalBallDamp",
    "saveContact",
    "fallRate",
  ]) {
    requirePositiveFinite(value[key], `contact source profile ${key}`);
  }
  requireIntegerRange(value.effectiveTackle, 0, 0x7fff, "effective tackle threshold");
  requireIntegerRange(value.refereeStrictness, 0, 128, "referee strictness");
  return value;
}

function requirePlayers(value) {
  if (!Array.isArray(value) || value.length !== 22) {
    throw new Error("Contact resolution requires exactly 22 players.");
  }
  const players = value.map((player, index) => {
    requirePlainObject(player, `contact player ${index}`);
    requireIntegerRange(player.nativePlayer, 1, 22, `contact player ${index} nativePlayer`);
    requireI16(player.action, `contact player ${index} action`);
    requireIntegerRange(player.animation, 0, 0xffff, `contact player ${index} animation`);
    requireIntegerRange(player.barge, 0, 0xff, `contact player ${index} barge`);
    requireIntegerRange(player.goCount, -0x8000, 0x7fff, `contact player ${index} goCount`);
    requireFinite(player.animationFrame, `contact player ${index} animationFrame`);
    for (const [vector, label] of [
      [player.position, "position"],
      [player.facing, "facing"],
      [player.goDisplacement, "goDisplacement"],
    ]) {
      requireVector(vector, `contact player ${index} ${label}`, label === "position");
    }
    for (const key of ["power", "control", "flair"]) {
      requireIntegerRange(player[key], 0, 255, `contact player ${index} ${key}`);
    }
    requireIntegerRange(player.possession, 0, 0x7fff, `contact player ${index} possession`);
    return clonePlayer(player);
  });
  if (new Set(players.map(({ nativePlayer }) => nativePlayer)).size !== 22) {
    throw new Error("Contact players must occupy native slots 1..22 exactly once.");
  }
  return players;
}

function requireTraversalOrder(value) {
  if (!Array.isArray(value) || value.length !== 22) {
    throw new Error("Native traversal order must contain 22 players.");
  }
  value.forEach((entry, index) => requireIntegerRange(
    entry,
    1,
    22,
    `native traversal order ${index}`,
  ));
  if (new Set(value).size !== 22) throw new Error("Native traversal order must be unique.");
}

function playerByNative(players, nativePlayer) {
  const player = players.find((entry) => entry.nativePlayer === nativePlayer);
  if (!player) throw new Error(`Missing native player ${nativePlayer}.`);
  return player;
}

function replacePlayer(players, nativePlayer, replacement) {
  return players.map((player) => (
    player.nativePlayer === nativePlayer ? clonePlayer(replacement) : clonePlayer(player)
  ));
}

function clonePlayer(player) {
  return {
    ...player,
    position: { ...player.position },
    facing: { ...player.facing },
    goDisplacement: { ...player.goDisplacement },
    motionContact: player.motionContact ? structuredClone(player.motionContact) : null,
    save: player.save ? structuredClone(player.save) : null,
  };
}

function sourceDistance(x, y) {
  return Math.sqrt((x * x) + (y * y));
}

function requireVector(value, label, includeZ = false) {
  requirePlainObject(value, label);
  requireFinite(value.x, `${label}.x`);
  requireFinite(value.y, `${label}.y`);
  if (includeZ) requireFinite(value.z, `${label}.z`);
}

function requireI16(value, label) {
  requireIntegerRange(value, -0x8000, 0x7fff, label);
}

function requireIntegerRange(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer in ${minimum}..${maximum}.`);
  }
}

function requirePositiveFinite(value, label) {
  requireFinite(value, label);
  if (!(value > 0)) throw new TypeError(`${label} must be positive.`);
}

function requireFinite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
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

function requireOnlyKeys(value, keys, label) {
  const allowed = new Set(keys);
  const extras = Object.keys(value).filter((key) => !allowed.has(key));
  if (extras.length > 0) throw new Error(`${label} has unsupported fields: ${extras.join(", ")}.`);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const f32 = Math.fround;
