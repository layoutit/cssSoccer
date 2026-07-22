import { createCssoccerNativeRngState } from "./randomState.mjs";
import {
  CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH,
  assertCssoccerNativeFixturePlayerProfile,
} from "./nativeFixturePlayerProfile.mjs";
import {
  CSSOCCER_NATIVE_GAMEPLAY_PROFILE_HASH,
  assertCssoccerNativeGameplayProfile,
} from "./nativeGameplayProfile.mjs";
import {
  canNativeKeeperHandle,
  collectPossession,
  createPossessionState,
  holdPossession,
  projectPossessionNativeFields,
  releasePossession,
  touchWithoutPossession,
} from "./possessionState.mjs";
import {
  CSSOCCER_NATIVE_CONTACT_ACTION,
  CSSOCCER_TACKLE_SOURCE,
  UnsupportedContactSemanticsError,
  nativeContactActionKind,
  resolvePlayerTussles,
  resolveTacklePlayerContacts,
} from "./tackleState.mjs";

export const CSSOCCER_CONTACT_STATE_SCHEMA = "cssoccer-contact-state@1";
export const CSSOCCER_PLAYER_TUSSLE_FRAME_SCHEMA =
  "cssoccer-player-tussle-frame@1";
export const CSSOCCER_PLAYER_TUSSLE_TRANSITION_SCHEMA =
  "cssoccer-player-tussle-transition@1";

const TUSSLE_FIXTURE_ID = "spain-argentina-full-match";
const BARGE_ANIMATION = 74;
const FALL_RIGHT_ANIMATION = 90;
const RUN_ANIMATION = 72;
const BARGE_FRAME_STEP = 1 / (20 * 27 / 40);
const RUN_REFERENCE_SPEED = 3.19;
const FALL_RIGHT_FRAME_STEP = Math.fround(1 / (20 * 34 / 40));
const FALL_RIGHT_GO_COUNT = 16;

const TUSSLE_BINDINGS = deepFreeze({
  fixtureId: TUSSLE_FIXTURE_ID,
  sourceRevision: "b40bd6d1e50e052030c5f0884fbe3deda7e9fa4b",
  nativeBuildSha256:
    "cd06f847e2376951791a68a57fed3c38a13496e801c3dc66e98aa1d9abf9c544",
  nativeGameplayProfileHash: CSSOCCER_NATIVE_GAMEPLAY_PROFILE_HASH,
  nativeFixturePlayerProfileHash: CSSOCCER_NATIVE_FIXTURE_PLAYER_PROFILE_HASH,
});

export const CSSOCCER_PLAYER_TUSSLE_SOURCE = deepFreeze({
  fixtureId: TUSSLE_FIXTURE_ID,
  qualifiedTick: 215,
  qualifiedThroughTick: 245,
  nextUnsupported: {
    tick: 292,
    fieldId: "players.argentina-player-07.action",
    producer: "ACTIONS.CPP player_tussles -> tussle_collision -> init_fall",
  },
  files: [
    {
      file: "ACTIONS.CPP",
      sha256: "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
      functions: {
        initFall: "lines 2026-2044",
        tussleCollision: "lines 4328-4440",
        playerTussles: "lines 4444-4465",
        processTeams: "lines 6147-6172",
      },
    },
    {
      file: "INTELL.CPP",
      sha256: "f20bc161438453e4fd7bf32ba9be378036b7f41bb2c32112522a26c6ede464ad",
      functions: { playerInts: "lines 4455-4505" },
    },
    {
      file: "ANDYDEFS.H",
      sha256: "13d13dca2910a7685be7603e25bc9fa936253f5aa72f73eef3f54e851fbbce34",
      functions: { matchPlayer: "lines 3-81" },
    },
    {
      file: "DATA.H",
      sha256: "7dba31d4e9af11b4c7686faa1bf75802142579db99bd41b23d5bfcd065f0bb99",
      functions: { fallRightAnimation: "line 124" },
    },
    {
      file: "FOOTBALL.CPP",
      sha256: "4054e55bbd5471ad0fa76c192562ee269f4ea0978e38f61d2eb0782439128b10",
      functions: {
        initPlayerStats: "lines 1253-1338",
        processSubs: "lines 1344-1362",
      },
    },
    {
      file: "MATHS.CPP",
      sha256: "c7f61a26ce63ab439829f8c84a840f2c781704a44f2d06f149cf872013a96107",
      functions: { calcDist: "lines 65-73" },
    },
    {
      file: "RULES.CPP",
      sha256: "e0e3ebab5f36ec4d60f2ec6f1b4c797661855017c770a6820dc3152ce75a0ef8",
      functions: { incrementInjury: "lines 1984-1987" },
    },
  ],
  exactOrder: [
    "process both teams in frame-selected native order",
    "enlist eligible players by stable native slot",
    "compare cross-team pairs in enlistment order",
    "derive collision force from the two upstream go displacements",
    "init_fall records its target before the p1-only post-fall shove",
  ],
  fall: {
    animation: FALL_RIGHT_ANIMATION,
    animationFrames: 34,
    frameStepFormula: "1 / (20 * 34 / 40)",
    frameStep: FALL_RIGHT_FRAME_STEP,
    goCount: FALL_RIGHT_GO_COUNT,
  },
  barge: {
    animation: BARGE_ANIMATION,
    animationFrames: 27,
    frameStepFormula: "(1 / (20 * 27 / 40)) * actual_spd(player) / MC_RUN_SPD",
    runReferenceSpeed: RUN_REFERENCE_SPEED,
    countdown: 20,
  },
  abi: {
    teamsBase: "0x3cf6c",
    playerBytes: 203,
    attributeBlock: {
      offsets: "70..77",
      fields: "tm_rate, tm_pow, tm_cont, tm_flair, tm_vis, tm_ac, tm_stam, tm_disc",
      producer:
        "linked tussle/contact path -> RULES.CPP inc_inj -> FOOTBALL.CPP init_player_stats (instruction trace; substitution state zero)",
    },
    fallWrites: {
      facing: [6, 14],
      z: 18,
      directionMode: 109,
      animationFrame: 111,
      animationFrameStep: 115,
      animation: 119,
      newAnimation: 139,
      action: 142,
      possession: 144,
      goCount: 156,
      goDisplacement: [160, 164],
      goTarget: [168, 172],
    },
    conclusion:
      "The tick-215 bytes 70..76 form the separate packed attribute block; no fall/contact field overlaps them.",
  },
});

export class CssoccerUnsupportedPlayerTussleError extends Error {
  constructor(boundary, message, detail = {}) {
    super(message);
    this.name = "CssoccerUnsupportedPlayerTussleError";
    this.code = "CSSOCCER_UNSUPPORTED_PLAYER_TUSSLE";
    this.boundary = boundary;
    this.detail = deepFreeze(cloneValue(detail));
  }
}

export const CSSOCCER_CONTACT_SOURCE = deepFreeze({
  files: [
    {
      file: "BALLINT.CPP",
      sha256: "a57298a8dc783e778957a763c2675dd04fc2552fc59f221a183dd6f15b24f327",
      functions: {
        controlDifficulty: "lines 629-661",
        controlBall: "lines 741-789",
        ballInteract: "lines 831-1011",
      },
    },
    ...CSSOCCER_TACKLE_SOURCE.files,
  ],
  nativeTeamOrder: {
    frameTruthy: "native slots 1..11, then 12..22",
    frameFalsy: "native slots 12..22, then 1..11",
    producer: "ACTIONS.CPP process_teams lines 6147-6172",
  },
  updateOrder: CSSOCCER_TACKLE_SOURCE.order,
  rng: {
    consumes: "current tick seed",
    advances: false,
    reason: "MATHS.CPP randomize owns advancement outside contact reducers",
  },
  explicitUnsupported: [
    "CONTROL_ACT without prepared motion-capture contact coordinates",
    "STRIKE_ACT ball-launch output without the action/ball launch reducer",
    "keeper block without an engine-produced rebound state",
  ],
});

const PLAYER_ID_PATTERN = /^(spain|argentina)-player-(0[1-9]|1[01])$/u;
const KEEPER_SLOTS = new Set([1, 12]);

export function createContactProfile(input) {
  requirePlainObject(input, "contact source profile");
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
  requireOnlyKeys(input, keys, "contact source profile");
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
    requirePositiveFinite(input[key], `contact source profile ${key}`);
  }
  requireIntegerRange(input.effectiveTackle, 0, 0x7fff, "effective tackle threshold");
  requireIntegerRange(input.refereeStrictness, 0, 128, "referee strictness");
  return deepFreeze({ ...input });
}

export function createContactState(input = {}) {
  requirePlainObject(input, "contact state input");
  requireOnlyKeys(
    input,
    [
      "schema",
      "tick",
      "frameParity",
      "deadBall",
      "justScored",
      "penaltyGame",
      "setPiece",
      "players",
      "ball",
      "possession",
      "rng",
      "profile",
    ],
    "contact state input",
  );
  if (input.schema !== undefined && input.schema !== CSSOCCER_CONTACT_STATE_SCHEMA) {
    throw new Error(`Contact state must use ${CSSOCCER_CONTACT_STATE_SCHEMA}.`);
  }
  const tick = input.tick ?? 0;
  const frameParity = input.frameParity ?? 0;
  const deadBall = input.deadBall ?? 0;
  const justScored = input.justScored ?? 0;
  const penaltyGame = input.penaltyGame ?? 0;
  const setPiece = input.setPiece ?? 0;
  requireIntegerRange(tick, 0, 0x7fffffff, "contact tick");
  for (const [value, label] of [
    [frameParity, "frameParity"],
    [deadBall, "deadBall"],
    [justScored, "justScored"],
    [penaltyGame, "penaltyGame"],
    [setPiece, "setPiece"],
  ]) requireIntegerRange(value, 0, 1, `contact ${label}`);

  const players = requirePlayers(input.players);
  const possession = createPossessionState(input.possession);
  requireAlignedOwnership(players, possession);
  const stableByNative = new Map(players.map(({ nativePlayer, stableId }) => [nativePlayer, stableId]));
  for (const entry of possession.players) {
    if (stableByNative.get(entry.nativePlayer) !== entry.stableId) {
      throw new Error(`Possession identity diverged at native slot ${entry.nativePlayer}.`);
    }
  }
  const ball = requireBall(input.ball);
  const rng = createCssoccerNativeRngState(input.rng);
  const profile = createContactProfile(input.profile);
  return deepFreeze({
    schema: CSSOCCER_CONTACT_STATE_SCHEMA,
    tick,
    frameParity,
    deadBall,
    justScored,
    penaltyGame,
    setPiece,
    players,
    ball,
    possession,
    rng,
    profile,
  });
}

export function nativeContactTraversalOrder(frameParity) {
  requireIntegerRange(frameParity, 0, 1, "native frame parity");
  const teamA = Array.from({ length: 11 }, (_, index) => index + 1);
  const teamB = Array.from({ length: 11 }, (_, index) => index + 12);
  return Object.freeze(frameParity ? [...teamA, ...teamB] : [...teamB, ...teamA]);
}

/**
 * Resolve the ordinary stand/run/turn/tackle/steal loose-ball contact branch.
 * This exposes BALLINT.CPP's geometry and control test without constructing a
 * fixture-specific 22-player contact frame.
 */
export function resolveCssoccerLooseBallControl({
  ball,
  player,
  seed,
  touchBallBox,
  playerHeight,
} = {}) {
  const currentBall = requireBall(ball);
  requirePlainObject(player, "loose-ball control player");
  requireOnlyKeys(player, [
    "nativePlayer",
    "action",
    "position",
    "faceDirection",
    "control",
  ], "loose-ball control player");
  requireIntegerRange(player.nativePlayer, 1, 22, "loose-ball native player");
  requireIntegerRange(player.action, -0x8000, 0x7fff, "loose-ball action");
  const actionKind = nativeContactActionKind(player.action);
  if (!new Set(["stand", "run", "turn", "tackle", "steal"]).has(actionKind)) {
    throw new UnsupportedContactSemanticsError(
      `Loose-ball control does not support ${actionKind} action ${player.action}.`,
      { producer: "BALLINT.CPP ball_interact", nativePlayer: player.nativePlayer },
    );
  }
  requirePosition(player.position, "loose-ball player position");
  requireIntegerRange(player.faceDirection, 0, 7, "loose-ball player faceDirection");
  requireIntegerRange(player.control, 0, 255, "loose-ball player control");
  requireIntegerRange(seed, 0, 127, "loose-ball RNG seed");
  requirePositiveFinite(touchBallBox, "loose-ball touchBallBox");
  requirePositiveFinite(playerHeight, "loose-ball playerHeight");

  const distance = sourceDistance(
    f32(currentBall.position.x - player.position.x),
    f32(currentBall.position.y - player.position.y),
  );
  const contact = distance <= touchBallBox
    && currentBall.position.z < playerHeight;
  if (!contact) {
    return deepFreeze({ contact: false, controlAccepted: null, difficulty: null, distance });
  }

  const atFeet = (
    currentBall.position.z < player.position.z + (playerHeight / 2)
    && currentBall.position.z - currentBall.displacement.z
      < player.position.z + (playerHeight / 2)
  );
  const difficulty = controlDifficulty({
    player: { ...player, actionKind },
    ball: currentBall,
    profile: { playerHeight },
  });
  const grounded = player.position.z < 1;
  const controlAccepted = atFeet
    && grounded
    && seed + player.control > difficulty;
  return deepFreeze({
    contact: true,
    controlAccepted,
    difficulty,
    distance,
  });
}

/**
 * Apply one ordinary BALLINT.CPP outfield ball_interact visit in process_teams
 * order, including the current owner's hold_ball branch.
 *
 * The caller owns traversal and supplies the current ball/possession after any
 * earlier native player visit. Busy actions are source-skipped; ordinary
 * stand/run/turn/tackle/steal contacts either collect at the feet or rebound.
 */
export function stepCssoccerLooseBallControl(input = {}) {
  requirePlainObject(input, "loose-ball control step");
  requireExactKeys(input, [
    "ball",
    "player",
    "possession",
    "profile",
    "seed",
  ], "loose-ball control step");
  const ball = requireBall(input.ball);
  const possession = createPossessionState(input.possession);
  if (possession.inHands !== 0) {
    throw new Error("Loose-ball control step cannot touch a ball held in hands.");
  }
  requirePlainObject(input.player, "loose-ball control step player");
  requireExactKeys(input.player, [
    "action",
    "animationFrame",
    "control",
    "faceDirection",
    "facing",
    "goDisplacement",
    "kickedBusy",
    "nativePlayer",
    "position",
  ], "loose-ball control step player");
  const player = {
    nativePlayer: input.player.nativePlayer,
    action: input.player.action,
    animationFrame: input.player.animationFrame,
    control: input.player.control,
    faceDirection: input.player.faceDirection,
    position: f32Position(input.player.position),
    facing: f32Vector(input.player.facing),
    goDisplacement: f32Vector(input.player.goDisplacement),
    kickedBusy: input.player.kickedBusy,
  };
  requireIntegerRange(player.nativePlayer, 1, 22, "loose-ball step native player");
  requireIntegerRange(player.action, -0x8000, 0x7fff, "loose-ball step action");
  requireFinite(player.animationFrame, "loose-ball step animation frame");
  requireIntegerRange(player.control, 0, 255, "loose-ball step control");
  requireIntegerRange(player.faceDirection, 0, 7, "loose-ball step face direction");
  requirePosition(player.position, "loose-ball step position");
  requireVector(player.facing, "loose-ball step facing");
  requireVector(player.goDisplacement, "loose-ball step go displacement");
  if (
    possession.owner !== 0
    && possession.owner !== player.nativePlayer
    && (possession.owner < 12) === (player.nativePlayer < 12)
  ) {
    throw new Error(
      "Loose-ball control step requires a free or opponent-held outfield ball.",
    );
  }
  if (typeof player.kickedBusy !== "boolean") {
    throw new TypeError("Loose-ball step kickedBusy must be boolean.");
  }
  requireIntegerRange(input.seed, 0, 127, "loose-ball step seed");
  requirePlainObject(input.profile, "loose-ball control step profile");
  requireExactKeys(input.profile, [
    "atFeetDistance",
    "ballRadius",
    "playerHeight",
    "touchBallBox",
    "verticalBallDamp",
  ], "loose-ball control step profile");
  const profile = {
    atFeetDistance: input.profile.atFeetDistance,
    ballRadius: input.profile.ballRadius,
    playerHeight: input.profile.playerHeight,
    touchBallBox: input.profile.touchBallBox,
    verticalBallDamp: input.profile.verticalBallDamp,
  };
  for (const [key, value] of Object.entries(profile)) {
    requirePositiveFinite(value, `loose-ball control step profile ${key}`);
  }

  if (possession.owner === player.nativePlayer) {
    return deepFreeze({
      outcome: "hold",
      contact: true,
      controlAccepted: null,
      difficulty: null,
      distance: null,
      ball: heldAtFeet(ball, player, profile),
      possession: holdPossession(possession),
    });
  }

  // BALLINT.CPP checks the interrupt lineage before interpreting the shared
  // numeric action slot. KICK_ACT and STEAL_ACT both use 15 in this build, so
  // the action number alone cannot distinguish an active kick recovery.
  if (player.kickedBusy) {
    return deepFreeze({
      outcome: "skipped",
      contact: false,
      controlAccepted: null,
      difficulty: null,
      distance: null,
      ball,
      possession,
    });
  }

  const actionKind = nativeContactActionKind(player.action);
  if (!new Set(["stand", "run", "turn", "tackle", "steal"]).has(actionKind)) {
    return deepFreeze({
      outcome: "skipped",
      contact: false,
      controlAccepted: null,
      difficulty: null,
      distance: null,
      ball,
      possession,
    });
  }
  const result = resolveCssoccerLooseBallControl({
    ball,
    player: {
      nativePlayer: player.nativePlayer,
      action: player.action,
      position: player.position,
      faceDirection: player.faceDirection,
      control: player.control,
    },
    seed: input.seed,
    touchBallBox: profile.touchBallBox,
    playerHeight: profile.playerHeight,
  });
  if (!result.contact) {
    return deepFreeze({
      outcome: "none",
      ...result,
      ball,
      possession,
    });
  }
  if (result.controlAccepted) {
    return deepFreeze({
      outcome: "collect",
      ...result,
      ball: heldAtFeet(ball, player, profile),
      possession: collectPossession(possession, player.nativePlayer),
    });
  }
  const rebound = reboundFromPlayer({
    possession,
    ball,
    player: { ...player, actionKind },
    seed: input.seed,
    profile,
  });
  return deepFreeze({
    outcome: "rebound",
    ...result,
    ball: rebound.ball,
    possession: rebound.possession,
  });
}

export function stepContactState(input, { rng = input?.rng } = {}) {
  const current = createContactState(input);
  const tickRng = createCssoccerNativeRngState(rng);
  const traversalOrder = nativeContactTraversalOrder(current.frameParity);
  let players = clonePlayers(current.players);
  let possession = current.possession;
  let ball = cloneBall(current.ball);
  const events = [];

  for (const nativePlayer of traversalOrder) {
    let consumedSave = false;
    const beforeContact = playerByNative(players, nativePlayer);
    if (beforeContact.action === CSSOCCER_NATIVE_CONTACT_ACTION.save && beforeContact.save) {
      const save = applyKeeperSaveResult(createContactState({
        ...current,
        players,
        ball,
        possession,
        rng: tickRng,
      }), {
        nativePlayer,
        outcome: beforeContact.save.outcome,
        rebound: beforeContact.save.rebound,
      });
      players = save.state.players;
      possession = save.state.possession;
      ball = save.state.ball;
      players = replacePlayer(players, nativePlayer, {
        ...playerByNative(players, nativePlayer),
        save: null,
      });
      events.push(...save.events);
      consumedSave = true;
    }
    if (!consumedSave) {
      const contact = resolvePlayerBallContact({
        players,
        possession,
        ball,
        nativePlayer,
        seed: tickRng.seed,
        profile: current.profile,
        deadBall: current.deadBall,
        justScored: current.justScored,
        penaltyGame: current.penaltyGame,
        setPiece: current.setPiece,
      });
      players = contact.players;
      possession = contact.possession;
      ball = contact.ball;
      events.push(...contact.events);
    }

    if (!current.deadBall && !current.justScored) {
      const tackle = resolveTacklePlayerContacts({
        players,
        possession,
        tacklerNativePlayer: nativePlayer,
        seed: tickRng.seed,
        profile: current.profile,
      });
      players = alignPlayerPossession(tackle.players, tackle.possession);
      possession = tackle.possession;
      events.push(...tackle.events);
    }
  }

  if (!current.deadBall && !current.justScored) {
    const tussles = resolvePlayerTussles({
      players,
      possession,
      traversalOrder,
      seed: tickRng.seed,
      profile: current.profile,
    });
    players = alignPlayerPossession(tussles.players, tussles.possession);
    possession = tussles.possession;
    events.push(...tussles.events);
  }

  return deepFreeze({
    state: createContactState({
      ...current,
      tick: current.tick + 1,
      frameParity: current.frameParity ? 0 : 1,
      players,
      ball,
      possession,
      rng: tickRng,
    }),
    events,
    traversalOrder,
  });
}

export function runContactScript(input, steps) {
  if (!Array.isArray(steps)) throw new TypeError("Contact script steps must be an array.");
  let state = createContactState(input);
  const events = [];
  for (const [index, step] of steps.entries()) {
    requirePlainObject(step, `contact script step ${index}`);
    requireOnlyKeys(step, ["rng"], `contact script step ${index}`);
    const result = stepContactState(state, step);
    state = result.state;
    events.push(...result.events.map((event) => ({ tick: state.tick - 1, ...event })));
  }
  return deepFreeze({ state, events });
}

export function collectKeeperHandling(input, nativePlayer) {
  const state = createContactState(input);
  const keeper = playerByNative(state.players, nativePlayer);
  if (!canNativeKeeperHandle({
    nativePlayer,
    inPenaltyArea: keeper.inPenaltyArea,
    cannotPickUp: state.possession.cannotPickUp,
  })) {
    throw new UnsupportedContactSemanticsError(
      "The native keeper handling boundary rejected this collection.",
      {
        producer: "BALLINT.CPP head_ball",
        nativePlayer,
        inPenaltyArea: keeper.inPenaltyArea,
        cannotPickUp: state.possession.cannotPickUp,
      },
    );
  }
  const oldOwner = state.possession.owner;
  const possession = collectPossession(state.possession, nativePlayer, { inHands: true });
  const players = alignPlayerPossession(state.players, possession);
  const events = [];
  if (oldOwner) events.push({ type: "possession-release", nativePlayer: oldOwner, reason: "keeper-handle" });
  events.push({ type: "keeper-handle-catch", nativePlayer });
  return deepFreeze({
    state: createContactState({ ...state, players, possession }),
    events,
  });
}

export function applyKeeperSaveResult(input, {
  nativePlayer,
  outcome,
  rebound,
} = {}) {
  const state = createContactState(input);
  requireIntegerRange(nativePlayer, 1, 22, "saving native player");
  const keeper = playerByNative(state.players, nativePlayer);
  if (!KEEPER_SLOTS.has(nativePlayer) || keeper.action !== CSSOCCER_NATIVE_CONTACT_ACTION.save) {
    throw new Error("Keeper save results require native slot 1 or 12 in SAVE_ACT.");
  }
  if (!keeper.inPenaltyArea) {
    throw new UnsupportedContactSemanticsError(
      "A keeper outside the retained handling area cannot resolve a catch or block.",
      { producer: "ACTIONS.CPP save_action", nativePlayer },
    );
  }
  if (!new Set(["catch", "block", "miss"]).has(outcome)) {
    throw new Error("Keeper save outcome must be catch, block, or miss.");
  }

  if (outcome === "miss") {
    return deepFreeze({ state, events: [{ type: "keeper-save-miss", nativePlayer }] });
  }
  if (outcome === "block") {
    if (state.possession.owner !== 0) {
      throw new UnsupportedContactSemanticsError(
        "Keeper block expects the source shot path to release possession before SAVE_ACT contact.",
        { producer: "BALLINT.CPP ball_interact keeper block", owner: state.possession.owner },
      );
    }
    if (rebound === undefined || rebound === null) {
      throw new UnsupportedContactSemanticsError(
        "Keeper block requires an engine-produced rebound state.",
        {
          producer: "BALLINT.CPP rebound_off_plr",
          nativePlayer,
          required: ["ball position", "ball displacement", "in-air state"],
        },
      );
    }
    const nextBall = requireRebound(rebound);
    const possession = touchWithoutPossession(state.possession, nativePlayer);
    return deepFreeze({
      state: createContactState({ ...state, ball: nextBall, possession }),
      events: [{ type: "keeper-save-block", nativePlayer }],
    });
  }

  const oldOwner = state.possession.owner;
  const possession = collectPossession(state.possession, nativePlayer, { inHands: true });
  const players = alignPlayerPossession(state.players, possession);
  const events = [];
  if (oldOwner) events.push({ type: "possession-release", nativePlayer: oldOwner, reason: "keeper-catch" });
  events.push({ type: "keeper-save-catch", nativePlayer });
  return deepFreeze({
    state: createContactState({ ...state, players, possession }),
    events,
  });
}

/**
 * Bind one already-moved cross-team pair at the ACTIONS.CPP player_tussles
 * phase. All values consumed by collision arithmetic are typed here; the
 * transition never accepts a post-contact position, facing, or fall target.
 */
export function createCssoccerPlayerTussleFrame(input = {}) {
  requirePlainObject(input, "player-tussle frame input");
  requireExactKeys(input, [
    "ballPossession",
    "fixturePlayerProfile",
    "frameParity",
    "gameplayProfile",
    "players",
    "refereeStrictness",
    "seed",
    "tick",
  ], "player-tussle frame input");
  const gameplayProfile = assertCssoccerNativeGameplayProfile(input.gameplayProfile);
  const fixtureProfile = assertCssoccerNativeFixturePlayerProfile(
    input.fixturePlayerProfile,
  );
  if (
    fixtureProfile.fixtureId !== TUSSLE_FIXTURE_ID
    || fixtureProfile.bindings.sourceRevision !== TUSSLE_BINDINGS.sourceRevision
    || fixtureProfile.bindings.nativeBuildSha256 !== TUSSLE_BINDINGS.nativeBuildSha256
    || fixtureProfile.bindings.nativeGameplayProfileHash
      !== gameplayProfile.profileHash
  ) {
    failTussle(
      "profile-binding",
      "Player-tussle fixture, source, build, or gameplay binding changed.",
    );
  }
  requireUint32(input.tick, "player-tussle tick");
  requireIntegerRange(input.frameParity, 0, 1, "player-tussle frame parity");
  requireIntegerRange(input.seed, 0, 127, "player-tussle seed");
  requireIntegerRange(input.ballPossession, 0, 22, "player-tussle ball possession");
  requireIntegerRange(input.refereeStrictness, 0, 128, "player-tussle referee strictness");
  if (!Array.isArray(input.players) || input.players.length !== 2) {
    throw new Error("Player-tussle frame requires exactly one cross-team pair.");
  }
  const players = input.players.map((player, index) => createTusslePlayer(
    player,
    fixtureProfile,
    index,
  ));
  const [left, right] = players;
  if (!opposingTeams(left.nativePlayerNumber, right.nativePlayerNumber)) {
    failTussle("pair-team", "Player-tussle pair must contain opposing teams.");
  }
  const traversal = nativeContactTraversalOrder(input.frameParity);
  if (
    traversal.indexOf(left.nativePlayerNumber)
      >= traversal.indexOf(right.nativePlayerNumber)
  ) {
    failTussle(
      "pair-order",
      "Player-tussle pair must retain ACTIONS.CPP enlistment order.",
      { traversal, pair: players.map(({ nativePlayerNumber }) => nativePlayerNumber) },
    );
  }
  for (const player of players) {
    const action = player.action.value;
    if (
      player.on.value !== 1
      || !(
        action <= CSSOCCER_NATIVE_CONTACT_ACTION.turn
        || action === CSSOCCER_NATIVE_CONTACT_ACTION.save
      )
    ) {
      failTussle(
        "pair-eligibility",
        "Player-tussle inputs must be active and source-eligible at enlistment.",
        { stableId: player.stableId, action },
      );
    }
  }
  const positivePair = players.filter(({ possession }) => possession.value > 0);
  if (
    (players.some(({ nativePlayerNumber }) => (
      nativePlayerNumber === input.ballPossession
    )) && (
      positivePair.length !== 1
      || positivePair[0].nativePlayerNumber !== input.ballPossession
    ))
    || (
      !players.some(({ nativePlayerNumber }) => (
        nativePlayerNumber === input.ballPossession
      ))
      && positivePair.length !== 0
    )
  ) {
    failTussle(
      "pair-ownership",
      "Player-tussle pair possession counters diverged from ball.possession.",
    );
  }

  return requireTussleFrame(deepFreeze({
    schema: CSSOCCER_PLAYER_TUSSLE_FRAME_SCHEMA,
    fixtureId: TUSSLE_FIXTURE_ID,
    tick: input.tick,
    phase: "pre-player-tussles",
    frameParity: input.frameParity,
    bindings: cloneValue(TUSSLE_BINDINGS),
    profile: {
      prat: gameplayProfile.constants.prat,
      fallRate: gameplayProfile.constants.contact.fallRate,
      refereeStrictness: typedValue(
        "rules.referee_strictness",
        "i16",
        input.refereeStrictness,
      ),
    },
    seed: typedValue("rng.seed", "i16", input.seed),
    ballPossession: typedValue(
      "ball.possession",
      "i32",
      input.ballPossession,
    ),
    players,
  }));
}

/** Resolve the first independently qualified tussle-fall contact slice. */
export function stepCssoccerPlayerTussleFrame(input) {
  const frame = requireTussleFrame(input);
  const [left, right] = frame.players;
  const leftValues = tusslePlayerValues(left);
  const rightValues = tusslePlayerValues(right);
  const xOffset = f32(rightValues.position.x - leftValues.position.x);
  const yOffset = f32(rightValues.position.y - leftValues.position.y);
  const separation = sourceStoredDistance(xOffset, yOffset);
  const contactDistance = frame.profile.prat.value * 0.7;
  if (!(separation < contactDistance)) {
    failTussle(
      "pair-separation",
      "The supplied pair does not reach the checked tussle collision distance.",
      { separation, contactDistance },
    );
  }

  const effectiveX = f32(
    (leftValues.power * leftValues.goDisplacement.x)
      - (rightValues.power * rightValues.goDisplacement.x),
  );
  const effectiveY = f32(
    (leftValues.power * leftValues.goDisplacement.y)
      - (rightValues.power * rightValues.goDisplacement.y),
  );
  let force = Math.trunc(Math.abs(effectiveX) + Math.abs(effectiveY));
  const summed = {
    x: f32(leftValues.goDisplacement.x + rightValues.goDisplacement.x),
    y: f32(leftValues.goDisplacement.y + rightValues.goDisplacement.y),
  };
  const power = (
    leftValues.power + tussleActionPower(leftValues.action)
  ) - (
    rightValues.power + tussleActionPower(rightValues.action)
  );
  const leftShoved = power + Math.trunc(frame.seed.value / 2) - 32 < 0;
  const fallen = leftShoved ? left : right;
  const shover = leftShoved ? right : left;
  const fallenValues = leftShoved ? leftValues : rightValues;
  const shoverValues = leftShoved ? rightValues : leftValues;

  const bargeLaunched = shover.animation.value === RUN_ANIMATION;
  const nextShover = bargeLaunched
    ? initializeTussleBarge(shover, frame.ballPossession.value)
    : cloneValue(shover);
  if (leftShoved && shover.nativePlayerNumber === 12) force *= 2;
  if (leftShoved && shoverValues.action === CSSOCCER_NATIVE_CONTACT_ACTION.save) {
    force += 128 * 16;
  }
  const falls = Math.trunc(force / 16) > frame.seed.value
    && (
      (frame.seed.value & 3) === 0
      || rightValues.action === CSSOCCER_NATIVE_CONTACT_ACTION.save
    );
  if (!falls) {
    const shoved = fallen;
    const shovedValues = fallenValues;
    const runX = shovedValues.action === CSSOCCER_NATIVE_CONTACT_ACTION.run
      ? shovedValues.goDisplacement.x
      : 0;
    const runY = shovedValues.action === CSSOCCER_NATIVE_CONTACT_ACTION.run
      ? shovedValues.goDisplacement.y
      : 0;
    const postPosition = {
      // The two compound assignments in ACTIONS.CPP each store to f32.
      x: f32(f32(shovedValues.position.x + summed.x) - runX),
      y: f32(f32(shovedValues.position.y + summed.y) - runY),
      z: shovedValues.position.z,
    };
    const nextShoved = replaceTusslePlayer(shoved, {
      position: typedTusslePosition(shoved.stableId, postPosition),
    });
    const players = frame.players.map((player) => {
      if (player.nativePlayerNumber === shoved.nativePlayerNumber) {
        return nextShoved;
      }
      if (player.nativePlayerNumber === shover.nativePlayerNumber) {
        return nextShover;
      }
      return cloneValue(player);
    });
    return requireTussleTransition(deepFreeze({
      schema: CSSOCCER_PLAYER_TUSSLE_TRANSITION_SCHEMA,
      fixtureId: frame.fixtureId,
      tick: frame.tick,
      phase: "post-player-tussles",
      frameParity: frame.frameParity,
      bindings: cloneValue(frame.bindings),
      profile: cloneValue(frame.profile),
      seed: cloneValue(frame.seed),
      ballPossession: cloneValue(frame.ballPossession),
      players,
      nativeFall: null,
      events: [{
        type: "player-tussle-shove",
        left: { stableId: left.stableId, nativePlayerNumber: left.nativePlayerNumber },
        right: { stableId: right.stableId, nativePlayerNumber: right.nativePlayerNumber },
        shoved: { stableId: shoved.stableId, nativePlayerNumber: shoved.nativePlayerNumber },
        shover: { stableId: shover.stableId, nativePlayerNumber: shover.nativePlayerNumber },
        leftShoved,
        force,
        bargeLaunched,
      }],
    }));
  }
  if (
    shoverValues.action === CSSOCCER_NATIVE_CONTACT_ACTION.save
    && ((shoverValues.possession + 2) * 32)
      < ((frame.seed.value * frame.profile.refereeStrictness.value) / 128)
  ) {
    failTussle(
      "keeper-foul",
      "Keeper-foul rule initialization is outside the first tussle-fall slice.",
    );
  }

  const directionDistance = sourceStoredDistance(summed.x, summed.y);
  if (!(directionDistance > 0)) {
    failTussle(
      "fall-direction",
      "The source fall direction cannot normalize a zero summed displacement.",
    );
  }
  const fallFacing = {
    x: f32(summed.x / directionDistance),
    y: f32(summed.y / directionDistance),
  };
  const fallGo = {
    x: f32(fallFacing.x * frame.profile.fallRate.value),
    y: f32(fallFacing.y * frame.profile.fallRate.value),
  };
  const goTarget = {
    x: f32(fallenValues.position.x + (fallGo.x * 100)),
    y: f32(fallenValues.position.y + (fallGo.y * 100)),
  };
  const postPosition = {
    x: leftShoved
      ? f32(fallenValues.position.x + summed.x)
      : fallenValues.position.x,
    y: leftShoved
      ? f32(fallenValues.position.y + summed.y)
      : fallenValues.position.y,
    z: f32(0),
  };
  const nextFallen = replaceTusslePlayer(fallen, {
    action: typedValue(
      `players.${fallen.stableId}.action`,
      "i16",
      CSSOCCER_NATIVE_CONTACT_ACTION.fall,
    ),
    animation: typedValue(
      `players.${fallen.stableId}.animation`,
      "u16",
      FALL_RIGHT_ANIMATION,
    ),
    animationFrame: typedValue(
      `players.${fallen.stableId}.animation_frame`,
      "f32",
      f32(0),
    ),
    position: typedTusslePosition(fallen.stableId, postPosition),
    facing: typedTussleFacing(fallen.stableId, {
      ...fallFacing,
      z: fallenValues.facing.z,
    }),
    goDisplacement: typedTussleGo(fallen.stableId, fallGo),
    possession: typedValue(
      `players.${fallen.stableId}.possession`,
      "i16",
      0,
    ),
  });
  const players = frame.players.map((player) => {
    if (player.nativePlayerNumber === fallen.nativePlayerNumber) {
      return nextFallen;
    }
    if (player.nativePlayerNumber === shover.nativePlayerNumber) {
      return nextShover;
    }
    return cloneValue(player);
  });
  const releasedPossession = frame.ballPossession.value === fallen.nativePlayerNumber;
  const ballPossession = typedValue(
    "ball.possession",
    "i32",
    releasedPossession ? 0 : frame.ballPossession.value,
  );
  const nativeFall = deepFreeze({
    stableId: fallen.stableId,
    nativePlayerNumber: fallen.nativePlayerNumber,
    animationFrameStep: typedValue(
      `native.players.${fallen.stableId}.tm_fstep`,
      "f32",
      FALL_RIGHT_FRAME_STEP,
    ),
    directionMode: typedValue(
      `native.players.${fallen.stableId}.dir_mode`,
      "i16",
      0,
    ),
    goCount: typedValue(
      `native.players.${fallen.stableId}.go_cnt`,
      "i32",
      FALL_RIGHT_GO_COUNT,
    ),
    goTarget: {
      x: typedValue(
        `native.players.${fallen.stableId}.go_tx`,
        "f32",
        goTarget.x,
      ),
      y: typedValue(
        `native.players.${fallen.stableId}.go_ty`,
        "f32",
        goTarget.y,
      ),
    },
    newAnimation: typedValue(
      `native.players.${fallen.stableId}.tm_newanim`,
      "u8",
      1,
    ),
  });

  return requireTussleTransition(deepFreeze({
    schema: CSSOCCER_PLAYER_TUSSLE_TRANSITION_SCHEMA,
    fixtureId: frame.fixtureId,
    tick: frame.tick,
    phase: "post-player-tussles",
    frameParity: frame.frameParity,
    bindings: cloneValue(frame.bindings),
    profile: cloneValue(frame.profile),
    seed: cloneValue(frame.seed),
    ballPossession,
    players,
    nativeFall,
    events: [{
      type: "player-tussle-fall",
      left: { stableId: left.stableId, nativePlayerNumber: left.nativePlayerNumber },
      right: { stableId: right.stableId, nativePlayerNumber: right.nativePlayerNumber },
      fallen: { stableId: fallen.stableId, nativePlayerNumber: fallen.nativePlayerNumber },
      shover: { stableId: shover.stableId, nativePlayerNumber: shover.nativePlayerNumber },
      leftShoved,
      force,
      releasedPossession,
      postFallShove: leftShoved,
    }],
  }));
}

/** Project the exact canonical fields owned or preserved by the pair contact. */
export function projectCssoccerPlayerTussleNativeFields(input) {
  const transition = requireTussleTransition(input);
  const fields = [cloneValue(transition.ballPossession)];
  for (const player of transition.players) {
    fields.push(
      cloneValue(player.action),
      cloneValue(player.animation),
      cloneValue(player.animationFrame),
      typedValue(
        `players.${player.stableId}.native_player`,
        "i16",
        player.nativePlayerNumber,
      ),
      cloneValue(player.on),
      cloneValue(player.possession),
      typedValue(
        `players.${player.stableId}.stable_id`,
        "string",
        player.stableId,
      ),
      cloneValue(player.position.x),
      cloneValue(player.facing.x),
      cloneValue(player.position.y),
      cloneValue(player.facing.y),
      cloneValue(player.position.z),
      cloneValue(player.facing.z),
    );
  }
  return deepFreeze(fields.sort((left, right) => left.fieldId.localeCompare(right.fieldId)));
}

export function projectContactNativeFields(input) {
  const state = createContactState(input);
  const actions = state.players
    .slice()
    .sort((left, right) => left.stableId.localeCompare(right.stableId))
    .map((player) => typedI16(`players.${player.stableId}.action`, player.action));
  return deepFreeze([...projectPossessionNativeFields(state.possession), ...actions]);
}

function resolvePlayerBallContact({
  players,
  possession,
  ball,
  nativePlayer,
  seed,
  profile,
  deadBall,
  justScored,
  penaltyGame,
  setPiece,
}) {
  let nextPlayers = clonePlayers(players);
  let nextPossession = possession;
  let nextBall = cloneBall(ball);
  const events = [];
  let player = playerByNative(nextPlayers, nativePlayer);
  if (!player.active) return { players: nextPlayers, possession, ball: nextBall, events };

  if (nextPossession.owner === nativePlayer) {
    const canRetainAtHeight = (
      (nextBall.position.z >= player.position.z
        && nextBall.position.z < player.position.z + profile.playerHeight)
      || player.action === CSSOCCER_NATIVE_CONTACT_ACTION.save
      || player.action === CSSOCCER_NATIVE_CONTACT_ACTION.keeperHold
      || player.retainsPossessionOutsideHeight
    );
    if (!canRetainAtHeight) {
      nextPossession = releasePossession(nextPossession);
      nextPlayers = alignPlayerPossession(nextPlayers, nextPossession);
      events.push({
        type: "possession-release",
        nativePlayer,
        reason: "held-ball-height",
      });
      return { players: nextPlayers, possession: nextPossession, ball: nextBall, events };
    }
    if (!setPiece) nextPossession = holdPossession(nextPossession);
    nextPlayers = alignPlayerPossession(nextPlayers, nextPossession);
    if (!setPiece && !nextPossession.inHands && player.actionKind !== "busy-or-unbound") {
      nextBall = heldAtFeet(nextBall, player, profile);
    } else if (setPiece) {
      nextPossession = touchWithoutPossession(nextPossession, nativePlayer);
    }
    return { players: nextPlayers, possession: nextPossession, ball: nextBall, events };
  }
  if (player.possession > 0) {
    throw new Error(`Native player ${nativePlayer} duplicates possession outside ball.possession.`);
  }
  if (
    deadBall
    || justScored
    || nextPossession.inHands
    || player.kickedBusy
    || new Set(["fall", "busy-or-unbound"]).has(player.actionKind)
  ) {
    return { players: nextPlayers, possession: nextPossession, ball: nextBall, events };
  }
  if (
    nextPossession.owner !== 0
    && !opposingTeams(nextPossession.owner, nativePlayer)
  ) {
    return { players: nextPlayers, possession: nextPossession, ball: nextBall, events };
  }
  if (
    nextPossession.owner !== 0
    && playerByNative(nextPlayers, nextPossession.owner).protectsPossession
  ) {
    return { players: nextPlayers, possession: nextPossession, ball: nextBall, events };
  }
  const distance = sourceDistance(
    f32(nextBall.position.x - player.position.x),
    f32(nextBall.position.y - player.position.y),
  );
  if (distance > profile.touchBallBox || nextBall.position.z >= profile.playerHeight) {
    return { players: nextPlayers, possession: nextPossession, ball: nextBall, events };
  }
  if (penaltyGame && !KEEPER_SLOTS.has(nativePlayer)) {
    return { players: nextPlayers, possession: nextPossession, ball: nextBall, events };
  }
  if (
    player.strike !== 0
    && player.actionKind !== "control"
    && player.actionKind !== "strike"
  ) {
    return { players: nextPlayers, possession: nextPossession, ball: nextBall, events };
  }

  if (player.actionKind === "control" || player.actionKind === "strike") {
    if (!player.motionContact) {
      throw new UnsupportedContactSemanticsError(
        `${player.actionKind.toUpperCase()}_ACT requires prepared motion-capture contact coordinates.`,
        {
          producer: "BALLINT.CPP control_interact",
          nativePlayer,
          required: ["contact frame", "rotated animation contact position"],
        },
      );
    }
    if (player.actionKind === "strike") {
      throw new UnsupportedContactSemanticsError(
        "STRIKE_ACT contact must be resolved by the source ball-launch reducer.",
        { producer: "BALLINT.CPP strike_ball_off", nativePlayer },
      );
    }
    if (!motionContactReached(player, nextBall, profile)) {
      return { players: nextPlayers, possession: nextPossession, ball: nextBall, events };
    }
  } else if (!new Set(["stand", "run", "turn", "tackle", "steal"]).has(player.actionKind)) {
    return { players: nextPlayers, possession: nextPossession, ball: nextBall, events };
  }

  const atFeet = (
    nextBall.position.z < player.position.z + (profile.playerHeight / 2)
    && nextBall.position.z - nextBall.displacement.z
      < player.position.z + (profile.playerHeight / 2)
  );
  if (atFeet) {
    const controlled = controlBall({
      players: nextPlayers,
      possession: nextPossession,
      ball: nextBall,
      player,
      seed,
      profile,
    });
    nextPlayers = controlled.players;
    nextPossession = controlled.possession;
    nextBall = controlled.ball;
    events.push(...controlled.events);
  } else if (nextBall.position.z < player.position.z + profile.playerHeight - 3) {
    const rebound = reboundFromPlayer({
      possession: nextPossession,
      ball: nextBall,
      player,
      seed,
      profile,
    });
    nextPossession = rebound.possession;
    nextBall = rebound.ball;
    events.push(...rebound.events);
  }
  return { players: nextPlayers, possession: nextPossession, ball: nextBall, events };
}

function controlBall({ players, possession, ball, player, seed, profile }) {
  let nextPlayers = clonePlayers(players);
  const difficulty = controlDifficulty({ player, ball, profile });
  if (player.actionKind === "tackle") {
    nextPlayers = replacePlayer(nextPlayers, player.nativePlayer, {
      ...playerByNative(nextPlayers, player.nativePlayer),
      touchedBall: true,
    });
  }
  if (player.actionKind === "control" && player.animation === 79) {
    throw new UnsupportedContactSemanticsError(
      "The MC_U_HEAD active-control rebound belongs to the source ball-launch reducer.",
      { producer: "BALLINT.CPP active_control", nativePlayer: player.nativePlayer },
    );
  }
  const canControl = player.actionKind === "control" || (
    (
      (player.actionKind !== "save" && player.position.z < 1)
      || player.actionKind === "save"
      || player.nativePlayer === 1
      || (player.nativePlayer === 12 && ball.position.z > profile.playerHeight / 3)
    )
    && seed + player.control > difficulty
  );
  if (!canControl) {
    return {
      players: nextPlayers,
      ...reboundFromPlayer({ possession, ball, player, seed, profile }),
    };
  }

  const oldOwner = possession.owner;
  const nextPossession = collectPossession(possession, player.nativePlayer);
  nextPlayers = alignPlayerPossession(nextPlayers, nextPossession);
  const nextPlayer = playerByNative(nextPlayers, player.nativePlayer);
  const nextBall = heldAtFeet(ball, nextPlayer, profile);
  const events = [];
  if (oldOwner) {
    events.push({ type: "possession-release", nativePlayer: oldOwner, reason: "opponent-contact" });
  }
  events.push({
    type: player.actionKind === "tackle" ? "tackle-ball-collect" : "ball-collect",
    nativePlayer: player.nativePlayer,
    previousOwner: oldOwner,
    difficulty,
  });
  return { players: nextPlayers, possession: nextPossession, ball: nextBall, events };
}

function controlDifficulty({ player, ball, profile }) {
  const contactX = f32(ball.position.x - ball.displacement.x - player.position.x);
  const contactY = f32(ball.position.y - ball.displacement.y - player.position.y);
  let side = sourceDirection(contactX, contactY) - player.faceDirection;
  if (side < 0) side += 8;
  if (side > 4) side = 8 - side;
  let difficulty = side * 16;
  let speed = ball.speed * 2;
  if (player.actionKind === "run") speed += ball.wantPass === player.nativePlayer ? 2 : 4;
  if (player.actionKind === "tackle") speed += 8;
  if (
    player.actionKind === "save"
    || (KEEPER_SLOTS.has(player.nativePlayer)
      && ball.position.z > profile.playerHeight / 3)
  ) speed -= 4;
  difficulty += 6 * speed;
  return difficulty;
}

function reboundFromPlayer({ possession, ball, player, seed, profile }) {
  const displacement = {
    x: f32(
      f32(-ball.displacement.x / 2)
        + f32((((seed & 15) - 7) / 16) * ball.speed),
    ),
    y: f32(
      f32(-ball.displacement.y / 2)
        + f32((((seed & 63) - 31) / 64) * ball.speed),
    ),
    z: f32(ball.displacement.z * profile.verticalBallDamp),
  };
  const distance = sourceDistance(displacement.x, displacement.y);
  if (!(distance > 0)) {
    throw new UnsupportedContactSemanticsError(
      "The source rebound vector is zero and would divide by zero while placing the ball.",
      { producer: "BALLINT.CPP rebound_off_plr", nativePlayer: player.nativePlayer },
    );
  }
  const offset = profile.touchBallBox + 1;
  const nextBall = {
    ...cloneBall(ball),
    position: {
      x: f32(player.position.x + ((displacement.x * offset) / distance)),
      y: f32(player.position.y + ((displacement.y * offset) / distance)),
      z: ball.position.z,
    },
    displacement,
  };
  return {
    possession: touchWithoutPossession(possession, player.nativePlayer),
    ball: nextBall,
    events: [{ type: "player-ball-rebound", nativePlayer: player.nativePlayer }],
  };
}

function heldAtFeet(ball, player, profile) {
  const fraction = player.animationFrame - Math.trunc(player.animationFrame);
  const distance = nativeContactActionKind(player.action) === "run"
    ? profile.atFeetDistance + (4 * (fraction - 0.5))
    : profile.atFeetDistance;
  return {
    ...cloneBall(ball),
    position: {
      x: f32(player.position.x + (player.facing.x * distance)),
      y: f32(player.position.y + (player.facing.y * distance)),
      z: f32(profile.ballRadius),
    },
    displacement: {
      x: f32(player.goDisplacement.x),
      y: f32(player.goDisplacement.y),
      z: f32(0),
    },
    inAir: 0,
  };
}

function motionContactReached(player, ball, profile) {
  const contact = player.motionContact;
  if (player.animationFrame < contact.frame) return false;
  const distance = sourceDistance(
    f32(ball.position.x - contact.position.x),
    f32(ball.position.y - contact.position.y),
  );
  return distance <= Math.max(ball.speed + 2, 8)
    && Math.abs(ball.position.z - contact.position.z) <= profile.pitchRatio / 2;
}

function sourceDirection(x, y) {
  if (y >= 0) {
    if (x >= 0) {
      if (x > y) return x > y * 2 ? 4 : 3;
      return y > x * 2 ? 2 : 3;
    }
    if (-x > y) return -x > y * 2 ? 0 : 1;
    return y > -x * 2 ? 2 : 1;
  }
  if (x >= 0) {
    if (x > -y) return x > -y * 2 ? 4 : 5;
    return -y > x * 2 ? 6 : 5;
  }
  if (-x > -y) return -x > -y * 2 ? 0 : 7;
  return -y > -x * 2 ? 6 : 7;
}

function createTusslePlayer(value, fixtureProfile, index) {
  requirePlainObject(value, `player-tussle player ${index}`);
  requireExactKeys(value, [
    "action",
    "animation",
    "animationFrame",
    "animationFrameStep",
    "bargeCountdown",
    "facing",
    "goDisplacement",
    "nativePlayerNumber",
    "on",
    "position",
    "possession",
    "power",
    "rate",
    "stableId",
    "zDisplacement",
  ], `player-tussle player ${index}`);
  requireIntegerRange(
    value.nativePlayerNumber,
    1,
    22,
    `player-tussle player ${index} native player`,
  );
  if (!PLAYER_ID_PATTERN.test(value.stableId ?? "")) {
    throw new Error(`Player-tussle player ${index} has an invalid stable id.`);
  }
  const fixturePlayer = fixtureProfile.players.find(({ id }) => id === value.stableId);
  const kickoffNativePlayerNumber = fixturePlayer?.kickoffNativePlayerNumber;
  const postSwapNativePlayerNumber = kickoffNativePlayerNumber === undefined
    ? 0
    : kickoffNativePlayerNumber <= 11
      ? kickoffNativePlayerNumber + 11
      : kickoffNativePlayerNumber - 11;
  if (
    fixturePlayer === undefined
    || (
      value.nativePlayerNumber !== kickoffNativePlayerNumber
      && value.nativePlayerNumber !== postSwapNativePlayerNumber
    )
  ) {
    failTussle(
      "player-identity",
      "Player-tussle stable identity diverged from its pinned native slot.",
      { stableId: value.stableId, nativePlayerNumber: value.nativePlayerNumber },
    );
  }
  requireIntegerRange(value.on, 0, 1, `${value.stableId} on`);
  requireIntegerRange(value.action, -0x8000, 0x7fff, `${value.stableId} action`);
  requireIntegerRange(value.animation, 0, 0xffff, `${value.stableId} animation`);
  requireExactF32(value.animationFrame, `${value.stableId} animation frame`);
  requireExactF32(
    value.animationFrameStep,
    `${value.stableId} animation frame step`,
  );
  requireTusslePositionInput(value.position, `${value.stableId} position`);
  requireTusslePlanarInput(value.facing, `${value.stableId} facing`);
  requireExactF32(value.zDisplacement, `${value.stableId} z displacement`);
  requireTusslePlanarInput(value.goDisplacement, `${value.stableId} go displacement`);
  requireIntegerRange(value.power, 0, 0xff, `${value.stableId} power`);
  requireIntegerRange(value.rate, 0, 0xff, `${value.stableId} rate`);
  requireIntegerRange(value.possession, 0, 0x7fff, `${value.stableId} possession`);
  requireIntegerRange(
    value.bargeCountdown,
    0,
    0xff,
    `${value.stableId} barge countdown`,
  );
  return deepFreeze({
    stableId: value.stableId,
    nativePlayerNumber: value.nativePlayerNumber,
    on: typedValue(`players.${value.stableId}.on`, "i16", value.on),
    action: typedValue(`players.${value.stableId}.action`, "i16", value.action),
    animation: typedValue(
      `players.${value.stableId}.animation`,
      "u16",
      value.animation,
    ),
    animationFrame: typedValue(
      `players.${value.stableId}.animation_frame`,
      "f32",
      value.animationFrame,
    ),
    animationFrameStep: typedValue(
      `native.players.${value.stableId}.tm_fstep`,
      "f32",
      value.animationFrameStep,
    ),
    position: typedTusslePosition(value.stableId, value.position),
    facing: typedTussleFacing(value.stableId, {
      ...value.facing,
      z: value.zDisplacement,
    }),
    goDisplacement: typedTussleGo(value.stableId, value.goDisplacement),
    power: typedValue(
      `native.players.${value.stableId}.tm_pow`,
      "u8",
      value.power,
    ),
    rate: typedValue(
      `native.players.${value.stableId}.tm_rate`,
      "u8",
      value.rate,
    ),
    possession: typedValue(
      `players.${value.stableId}.possession`,
      "i16",
      value.possession,
    ),
    bargeCountdown: typedValue(
      `native.players.${value.stableId}.tm_barge`,
      "u8",
      value.bargeCountdown,
    ),
  });
}

function requireTussleFrame(value) {
  requirePlainObject(value, "player-tussle frame");
  requireExactKeys(value, [
    "ballPossession",
    "bindings",
    "fixtureId",
    "frameParity",
    "phase",
    "players",
    "profile",
    "schema",
    "seed",
    "tick",
  ], "player-tussle frame");
  if (
    value.schema !== CSSOCCER_PLAYER_TUSSLE_FRAME_SCHEMA
    || value.fixtureId !== TUSSLE_FIXTURE_ID
    || value.phase !== "pre-player-tussles"
    || !sameValue(value.bindings, TUSSLE_BINDINGS)
  ) {
    failTussle(
      "frame-binding",
      `Player-tussle frame must use ${CSSOCCER_PLAYER_TUSSLE_FRAME_SCHEMA}.`,
    );
  }
  requireUint32(value.tick, "player-tussle frame tick");
  requireIntegerRange(value.frameParity, 0, 1, "player-tussle frame parity");
  requireTussleProfile(value.profile);
  requireTypedValue(value.seed, "rng.seed", "i16");
  requireTypedValue(value.ballPossession, "ball.possession", "i32");
  requireIntegerRange(value.seed.value, 0, 127, "player-tussle frame seed");
  requireIntegerRange(
    value.ballPossession.value,
    0,
    22,
    "player-tussle frame ball possession",
  );
  if (!Array.isArray(value.players) || value.players.length !== 2) {
    throw new Error("Player-tussle frame must retain exactly two players.");
  }
  value.players.forEach(requireTusslePlayer);
  const [left, right] = value.players;
  const traversal = nativeContactTraversalOrder(value.frameParity);
  if (
    !opposingTeams(left.nativePlayerNumber, right.nativePlayerNumber)
    || traversal.indexOf(left.nativePlayerNumber)
      >= traversal.indexOf(right.nativePlayerNumber)
  ) {
    failTussle("pair-order", "Player-tussle frame pair order changed.");
  }
  for (const player of value.players) {
    if (
      player.on.value !== 1
      || !(
        player.action.value <= CSSOCCER_NATIVE_CONTACT_ACTION.turn
        || player.action.value === CSSOCCER_NATIVE_CONTACT_ACTION.save
      )
    ) {
      failTussle("pair-eligibility", "Player-tussle frame eligibility changed.");
    }
  }
  const positive = value.players.filter(({ possession }) => possession.value > 0);
  const ownerInPair = value.players.some(({ nativePlayerNumber }) => (
    nativePlayerNumber === value.ballPossession.value
  ));
  if (
    (ownerInPair && (
      positive.length !== 1
      || positive[0].nativePlayerNumber !== value.ballPossession.value
    ))
    || (!ownerInPair && positive.length !== 0)
  ) {
    failTussle("pair-ownership", "Player-tussle frame ownership changed.");
  }
  return value;
}

function requireTussleTransition(value) {
  requirePlainObject(value, "player-tussle transition");
  requireExactKeys(value, [
    "ballPossession",
    "bindings",
    "events",
    "fixtureId",
    "frameParity",
    "nativeFall",
    "phase",
    "players",
    "profile",
    "schema",
    "seed",
    "tick",
  ], "player-tussle transition");
  if (
    value.schema !== CSSOCCER_PLAYER_TUSSLE_TRANSITION_SCHEMA
    || value.fixtureId !== TUSSLE_FIXTURE_ID
    || value.phase !== "post-player-tussles"
    || !sameValue(value.bindings, TUSSLE_BINDINGS)
  ) {
    failTussle(
      "transition-binding",
      `Player-tussle transition must use ${CSSOCCER_PLAYER_TUSSLE_TRANSITION_SCHEMA}.`,
    );
  }
  requireUint32(value.tick, "player-tussle transition tick");
  requireIntegerRange(value.frameParity, 0, 1, "player-tussle transition parity");
  requireTussleProfile(value.profile);
  requireTypedValue(value.seed, "rng.seed", "i16");
  requireTypedValue(value.ballPossession, "ball.possession", "i32");
  requireIntegerRange(
    value.ballPossession.value,
    0,
    22,
    "player-tussle transition ball possession",
  );
  if (!Array.isArray(value.players) || value.players.length !== 2) {
    throw new Error("Player-tussle transition must retain exactly two players.");
  }
  value.players.forEach(requireTusslePlayer);
  if (!Array.isArray(value.events) || value.events.length !== 1) {
    throw new Error("Player-tussle transition requires one contact event.");
  }
  const event = value.events[0];
  requirePlainObject(event, "player-tussle transition event");
  if (event.type === "player-tussle-fall") {
    requireExactKeys(event, [
      "fallen",
      "force",
      "left",
      "leftShoved",
      "postFallShove",
      "releasedPossession",
      "right",
      "shover",
      "type",
    ], "player-tussle fall event");
    requireTussleNativeFall(value.nativeFall);
  } else if (event.type === "player-tussle-shove") {
    requireExactKeys(event, [
      "bargeLaunched",
      "force",
      "left",
      "leftShoved",
      "right",
      "shoved",
      "shover",
      "type",
    ], "player-tussle shove event");
    if (value.nativeFall !== null || typeof event.bargeLaunched !== "boolean") {
      failTussle(
        "shove-branch",
        "A non-fall tussle must keep nativeFall null and bind its barge decision.",
      );
    }
    const shover = value.players.find(({ nativePlayerNumber }) => (
      nativePlayerNumber === event.shover?.nativePlayerNumber
    ));
    if (
      !shover
      || event.shover.stableId !== shover.stableId
      || (event.bargeLaunched && (
        shover.animation.value !== BARGE_ANIMATION
        || shover.bargeCountdown.value !== 20
      ))
    ) {
      failTussle("barge-fields", "The non-fall shove barge state changed.");
    }
  } else {
    throw new Error("Player-tussle transition event type changed.");
  }
  return value;
}

function requireTusslePlayer(value, index) {
  requirePlainObject(value, `typed player-tussle player ${index}`);
  requireExactKeys(value, [
    "action",
    "animation",
    "animationFrame",
    "animationFrameStep",
    "bargeCountdown",
    "facing",
    "goDisplacement",
    "nativePlayerNumber",
    "on",
    "position",
    "possession",
    "power",
    "rate",
    "stableId",
  ], `typed player-tussle player ${index}`);
  requireIntegerRange(value.nativePlayerNumber, 1, 22, "typed tussle native player");
  if (!stableIdMatchesNormalTimeNative(
    value.stableId,
    value.nativePlayerNumber,
  )) {
    failTussle("player-identity", "Typed player-tussle identity changed.");
  }
  const prefix = `players.${value.stableId}`;
  requireTypedValue(value.on, `${prefix}.on`, "i16");
  requireTypedValue(value.action, `${prefix}.action`, "i16");
  requireTypedValue(value.animation, `${prefix}.animation`, "u16");
  requireTypedValue(value.animationFrame, `${prefix}.animation_frame`, "f32");
  requireTypedValue(
    value.animationFrameStep,
    `native.players.${value.stableId}.tm_fstep`,
    "f32",
  );
  requireTypedTusslePosition(value.position, value.stableId);
  requireTypedTussleFacing(value.facing, value.stableId);
  requireTypedTussleGo(value.goDisplacement, value.stableId);
  requireTypedValue(
    value.power,
    `native.players.${value.stableId}.tm_pow`,
    "u8",
  );
  requireTypedValue(
    value.rate,
    `native.players.${value.stableId}.tm_rate`,
    "u8",
  );
  requireTypedValue(value.possession, `${prefix}.possession`, "i16");
  requireTypedValue(
    value.bargeCountdown,
    `native.players.${value.stableId}.tm_barge`,
    "u8",
  );
  return value;
}

function requireTussleProfile(value) {
  requirePlainObject(value, "player-tussle profile");
  requireExactKeys(
    value,
    ["fallRate", "prat", "refereeStrictness"],
    "player-tussle profile",
  );
  if (!sameValue(value.prat, {
    sourceSymbol: "prat",
    valueType: "f32",
    value: f32FromHex("412aaaab"),
    numericBits: "412aaaab",
  }) || !sameValue(value.fallRate, {
    sourceSymbol: "FALL_RATE",
    valueType: "f32",
    value: f32FromHex("40800000"),
    numericBits: "40800000",
  })) {
    failTussle("profile-constants", "Player-tussle compiled constants changed.");
  }
  requireTypedValue(
    value.refereeStrictness,
    "rules.referee_strictness",
    "i16",
  );
  requireIntegerRange(
    value.refereeStrictness.value,
    0,
    128,
    "player-tussle referee strictness",
  );
}

function requireTussleNativeFall(value) {
  requirePlainObject(value, "player-tussle native fall");
  requireExactKeys(value, [
    "animationFrameStep",
    "directionMode",
    "goCount",
    "goTarget",
    "nativePlayerNumber",
    "newAnimation",
    "stableId",
  ], "player-tussle native fall");
  if (!stableIdMatchesNormalTimeNative(
    value.stableId,
    value.nativePlayerNumber,
  )) {
    failTussle("native-fall-identity", "Native fall identity changed.");
  }
  const prefix = `native.players.${value.stableId}`;
  requireTypedValue(value.animationFrameStep, `${prefix}.tm_fstep`, "f32");
  requireTypedValue(value.directionMode, `${prefix}.dir_mode`, "i16");
  requireTypedValue(value.goCount, `${prefix}.go_cnt`, "i32");
  requirePlainObject(value.goTarget, "player-tussle native fall target");
  requireExactKeys(value.goTarget, ["x", "y"], "player-tussle native fall target");
  requireTypedValue(value.goTarget.x, `${prefix}.go_tx`, "f32");
  requireTypedValue(value.goTarget.y, `${prefix}.go_ty`, "f32");
  requireTypedValue(value.newAnimation, `${prefix}.tm_newanim`, "u8");
  if (
    value.animationFrameStep.value !== FALL_RIGHT_FRAME_STEP
    || value.directionMode.value !== 0
    || value.goCount.value !== FALL_RIGHT_GO_COUNT
    || value.newAnimation.value !== 1
  ) {
    failTussle("native-fall-fields", "Native init_fall fields changed.");
  }
}

function tusslePlayerValues(player) {
  return {
    action: player.action.value,
    animation: player.animation.value,
    animationFrame: player.animationFrame.value,
    animationFrameStep: player.animationFrameStep.value,
    position: {
      x: player.position.x.value,
      y: player.position.y.value,
      z: player.position.z.value,
    },
    facing: {
      x: player.facing.x.value,
      y: player.facing.y.value,
      z: player.facing.z.value,
    },
    goDisplacement: {
      x: player.goDisplacement.x.value,
      y: player.goDisplacement.y.value,
    },
    power: player.power.value,
    rate: player.rate.value,
    possession: player.possession.value,
  };
}

function initializeTussleBarge(player, ballPossession) {
  const values = tusslePlayerValues(player);
  const withBall = ballPossession === player.nativePlayerNumber;
  const referenceSeconds = withBall ? 20 : 18;
  const actualSpeed = f32(
    1280 / ((referenceSeconds - ((values.rate / 64) * 4)) * 20),
  );
  const frameStep = f32(
    BARGE_FRAME_STEP * (actualSpeed / RUN_REFERENCE_SPEED),
  );
  return replaceTusslePlayer(player, {
    animation: typedValue(
      `players.${player.stableId}.animation`,
      "u16",
      BARGE_ANIMATION,
    ),
    animationFrame: typedValue(
      `players.${player.stableId}.animation_frame`,
      "f32",
      f32(values.animationFrame + 0.5),
    ),
    animationFrameStep: typedValue(
      `native.players.${player.stableId}.tm_fstep`,
      "f32",
      frameStep,
    ),
    bargeCountdown: typedValue(
      `native.players.${player.stableId}.tm_barge`,
      "u8",
      20,
    ),
  });
}

function replaceTusslePlayer(player, fields) {
  return deepFreeze({ ...cloneValue(player), ...cloneValue(fields) });
}

function typedTusslePosition(stableId, value) {
  return deepFreeze({
    x: typedValue(`players.${stableId}.x`, "f32", value.x),
    y: typedValue(`players.${stableId}.y`, "f32", value.y),
    z: typedValue(`players.${stableId}.z`, "f32", value.z),
  });
}

function typedTussleFacing(stableId, value) {
  return deepFreeze({
    x: typedValue(`players.${stableId}.x_displacement`, "f32", value.x),
    y: typedValue(`players.${stableId}.y_displacement`, "f32", value.y),
    z: typedValue(`players.${stableId}.z_displacement`, "f32", value.z),
  });
}

function typedTussleGo(stableId, value) {
  return deepFreeze({
    x: typedValue(`native.players.${stableId}.go_txdis`, "f32", value.x),
    y: typedValue(`native.players.${stableId}.go_tydis`, "f32", value.y),
  });
}

function requireTypedTusslePosition(value, stableId) {
  requirePlainObject(value, `${stableId} typed position`);
  requireExactKeys(value, ["x", "y", "z"], `${stableId} typed position`);
  requireTypedValue(value.x, `players.${stableId}.x`, "f32");
  requireTypedValue(value.y, `players.${stableId}.y`, "f32");
  requireTypedValue(value.z, `players.${stableId}.z`, "f32");
}

function requireTypedTussleFacing(value, stableId) {
  requirePlainObject(value, `${stableId} typed facing`);
  requireExactKeys(value, ["x", "y", "z"], `${stableId} typed facing`);
  requireTypedValue(value.x, `players.${stableId}.x_displacement`, "f32");
  requireTypedValue(value.y, `players.${stableId}.y_displacement`, "f32");
  requireTypedValue(value.z, `players.${stableId}.z_displacement`, "f32");
}

function requireTypedTussleGo(value, stableId) {
  requirePlainObject(value, `${stableId} typed go displacement`);
  requireExactKeys(value, ["x", "y"], `${stableId} typed go displacement`);
  requireTypedValue(value.x, `native.players.${stableId}.go_txdis`, "f32");
  requireTypedValue(value.y, `native.players.${stableId}.go_tydis`, "f32");
}

function requireTusslePositionInput(value, label) {
  requirePlainObject(value, label);
  requireExactKeys(value, ["x", "y", "z"], label);
  requireExactF32(value.x, `${label}.x`);
  requireExactF32(value.y, `${label}.y`);
  requireExactF32(value.z, `${label}.z`);
}

function requireTusslePlanarInput(value, label) {
  requirePlainObject(value, label);
  requireExactKeys(value, ["x", "y"], label);
  requireExactF32(value.x, `${label}.x`);
  requireExactF32(value.y, `${label}.y`);
}

function tussleActionPower(action) {
  if (action === CSSOCCER_NATIVE_CONTACT_ACTION.steal) return 32;
  if (action === CSSOCCER_NATIVE_CONTACT_ACTION.save) return 500;
  return 0;
}

function sourceStoredDistance(x, y) {
  const distance = f32(Math.sqrt((x * x) + (y * y)));
  return distance > 0.1 ? distance : f32(0.1);
}

function stableIdForNative(nativePlayerNumber) {
  const country = nativePlayerNumber <= 11 ? "spain" : "argentina";
  const roster = nativePlayerNumber <= 11
    ? nativePlayerNumber
    : nativePlayerNumber - 11;
  return `${country}-player-${String(roster).padStart(2, "0")}`;
}

function stableIdMatchesNormalTimeNative(stableId, nativePlayerNumber) {
  const swappedNativePlayerNumber = nativePlayerNumber <= 11
    ? nativePlayerNumber + 11
    : nativePlayerNumber - 11;
  return stableId === stableIdForNative(nativePlayerNumber)
    || stableId === stableIdForNative(swappedNativePlayerNumber);
}

function f32FromHex(hex) {
  const bytes = Uint8Array.from(hex.match(/../gu), (entry) => parseInt(entry, 16));
  return new DataView(bytes.buffer).getFloat32(0, false);
}

function failTussle(boundary, message, detail = {}) {
  throw new CssoccerUnsupportedPlayerTussleError(boundary, message, detail);
}

function requirePlayers(value) {
  if (!Array.isArray(value) || value.length !== 22) {
    throw new Error("Contact state requires exactly 22 players.");
  }
  const players = value.map((player, index) => {
    requirePlainObject(player, `contact player ${index}`);
    requireOnlyKeys(
      player,
      [
        "nativePlayer",
        "stableId",
        "active",
        "action",
        "actionKind",
        "animation",
        "barge",
        "position",
        "facing",
        "faceDirection",
        "goDisplacement",
        "power",
        "control",
        "flair",
        "goCount",
        "animationFrame",
        "strike",
        "possession",
        "touchedBall",
        "kickedBusy",
        "inPenaltyArea",
        "protectsPossession",
        "retainsPossessionOutsideHeight",
        "motionContact",
        "save",
      ],
      `contact player ${index}`,
    );
    requireIntegerRange(player.nativePlayer, 1, 22, `contact player ${index} nativePlayer`);
    if (!PLAYER_ID_PATTERN.test(player.stableId ?? "")) {
      throw new Error(`Contact player ${index} has an invalid fixed-fixture stableId.`);
    }
    requireIntegerRange(player.active, 0, 1, `contact player ${index} active`);
    requireIntegerRange(player.action, -0x8000, 0x7fff, `contact player ${index} action`);
    requireIntegerRange(player.animation, 0, 0xffff, `contact player ${index} animation`);
    requireIntegerRange(player.barge, 0, 0xff, `contact player ${index} barge`);
    const actionKind = nativeContactActionKind(player.action);
    if (player.actionKind !== undefined && player.actionKind !== actionKind) {
      throw new Error(`Contact player ${index} actionKind diverges from native action ${player.action}.`);
    }
    requirePosition(player.position, `contact player ${index} position`);
    requireVector(player.facing, `contact player ${index} facing`);
    requireVector(player.goDisplacement, `contact player ${index} goDisplacement`);
    requireIntegerRange(player.faceDirection, 0, 7, `contact player ${index} faceDirection`);
    for (const key of ["power", "control", "flair"]) {
      requireIntegerRange(player[key], 0, 255, `contact player ${index} ${key}`);
    }
    requireIntegerRange(player.goCount, -0x8000, 0x7fff, `contact player ${index} goCount`);
    requireFinite(player.animationFrame, `contact player ${index} animationFrame`);
    requireIntegerRange(player.strike, -0x8000, 0x7fff, `contact player ${index} strike`);
    requireIntegerRange(player.possession, 0, 0x7fff, `contact player ${index} possession`);
    for (const key of [
      "touchedBall",
      "kickedBusy",
      "inPenaltyArea",
      "protectsPossession",
      "retainsPossessionOutsideHeight",
    ]) {
      if (typeof player[key] !== "boolean") {
        throw new TypeError(`Contact player ${index} ${key} must be boolean.`);
      }
    }
    const motionContact = requireMotionContact(player.motionContact, index);
    const save = requireSaveState(player.save, index);
    return {
      nativePlayer: player.nativePlayer,
      stableId: player.stableId,
      active: player.active,
      action: player.action,
      actionKind,
      animation: player.animation,
      barge: player.barge,
      position: f32Position(player.position),
      facing: f32Vector(player.facing),
      faceDirection: player.faceDirection,
      goDisplacement: f32Vector(player.goDisplacement),
      power: player.power,
      control: player.control,
      flair: player.flair,
      goCount: player.goCount,
      animationFrame: f32(player.animationFrame),
      strike: player.strike,
      possession: player.possession,
      touchedBall: player.touchedBall,
      kickedBusy: player.kickedBusy,
      inPenaltyArea: player.inPenaltyArea,
      protectsPossession: player.protectsPossession,
      retainsPossessionOutsideHeight: player.retainsPossessionOutsideHeight,
      motionContact,
      save,
    };
  });
  if (new Set(players.map(({ nativePlayer }) => nativePlayer)).size !== 22) {
    throw new Error("Contact native player slots must be unique.");
  }
  if (new Set(players.map(({ stableId }) => stableId)).size !== 22) {
    throw new Error("Contact stable player ids must be unique.");
  }
  return players;
}

function requireBall(value) {
  requirePlainObject(value, "contact ball");
  requireOnlyKeys(
    value,
    ["position", "displacement", "speed", "inAir", "inGoal", "wantPass"],
    "contact ball",
  );
  requirePosition(value.position, "contact ball position");
  requirePosition(value.displacement, "contact ball displacement");
  requireIntegerRange(value.speed, 0, 0x7fffffff, "contact ball speed");
  requireIntegerRange(value.inAir, 0, 1, "contact ball inAir");
  requireIntegerRange(value.inGoal, 0, 1, "contact ball inGoal");
  requireIntegerRange(value.wantPass, 0, 22, "contact ball wantPass");
  return {
    position: f32Position(value.position),
    displacement: f32Position(value.displacement),
    speed: value.speed,
    inAir: value.inAir,
    inGoal: value.inGoal,
    wantPass: value.wantPass,
  };
}

function requireRebound(value) {
  requirePlainObject(value, "engine keeper rebound");
  requireOnlyKeys(
    value,
    ["position", "displacement", "speed", "inAir", "inGoal", "wantPass"],
    "engine keeper rebound",
  );
  return requireBall(value);
}

function requireMotionContact(value, index) {
  if (value === null || value === undefined) return null;
  requirePlainObject(value, `contact player ${index} motionContact`);
  requireOnlyKeys(value, ["frame", "position"], `contact player ${index} motionContact`);
  requireFinite(value.frame, `contact player ${index} motionContact frame`);
  requirePosition(value.position, `contact player ${index} motionContact position`);
  return { frame: f32(value.frame), position: f32Position(value.position) };
}

function requireSaveState(value, index) {
  if (value === null || value === undefined) return null;
  requirePlainObject(value, `contact player ${index} save`);
  requireOnlyKeys(value, ["outcome", "rebound"], `contact player ${index} save`);
  if (!new Set(["catch", "block", "miss"]).has(value.outcome)) {
    throw new Error(`Contact player ${index} save outcome is invalid.`);
  }
  return {
    outcome: value.outcome,
    rebound: value.rebound ? requireRebound(value.rebound) : null,
  };
}

function requireAlignedOwnership(players, possession) {
  for (const player of players) {
    const counter = possession.players.find(
      ({ nativePlayer }) => nativePlayer === player.nativePlayer,
    ).possession;
    if (player.possession !== counter) {
      throw new Error(`Player ${player.stableId} possession counter diverged.`);
    }
  }
}

function alignPlayerPossession(players, possession) {
  const byNative = new Map(
    possession.players.map(({ nativePlayer, possession: counter }) => [nativePlayer, counter]),
  );
  return players.map((player) => ({
    ...clonePlayer(player),
    possession: byNative.get(player.nativePlayer),
  }));
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

function clonePlayers(players) {
  return players.map(clonePlayer);
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

function cloneBall(ball) {
  return {
    ...ball,
    position: { ...ball.position },
    displacement: { ...ball.displacement },
  };
}

function opposingTeams(left, right) {
  return (left < 12 && right > 11) || (left > 11 && right < 12);
}

function sourceDistance(x, y) {
  return Math.sqrt((x * x) + (y * y));
}

function typedI16(fieldId, value) {
  return typedValue(fieldId, "i16", value);
}

function typedValue(fieldId, valueType, value) {
  return deepFreeze({
    fieldId,
    valueType,
    value,
    numericBits: numericBits(valueType, value),
  });
}

function requireTypedValue(value, fieldId, valueType) {
  requirePlainObject(value, `${fieldId} typed value`);
  requireExactKeys(
    value,
    ["fieldId", "numericBits", "value", "valueType"],
    `${fieldId} typed value`,
  );
  if (
    value.fieldId !== fieldId
    || value.valueType !== valueType
    || value.numericBits !== numericBits(valueType, value.value)
  ) {
    failTussle(
      "typed-field",
      `${fieldId} changed value type or numeric bits.`,
    );
  }
  return value;
}

function numericBits(valueType, value) {
  if (valueType === "string") {
    if (typeof value !== "string") throw new TypeError("Typed string value must be a string.");
    return null;
  }
  const widths = { u8: 1, i16: 2, u16: 2, i32: 4, f32: 4 };
  const width = widths[valueType];
  if (width === undefined) throw new Error(`Unsupported contact value type ${valueType}.`);
  if (valueType === "u8") requireIntegerRange(value, 0, 0xff, "typed u8 value");
  else if (valueType === "i16") {
    requireIntegerRange(value, -0x8000, 0x7fff, "typed i16 value");
  } else if (valueType === "u16") {
    requireIntegerRange(value, 0, 0xffff, "typed u16 value");
  } else if (valueType === "i32") {
    requireIntegerRange(value, -0x80000000, 0x7fffffff, "typed i32 value");
  } else {
    requireExactF32(value, "typed f32 value");
  }
  const bytes = new Uint8Array(width);
  const view = new DataView(bytes.buffer);
  if (valueType === "u8") view.setUint8(0, value);
  else if (valueType === "i16") view.setInt16(0, value, false);
  else if (valueType === "u16") view.setUint16(0, value, false);
  else if (valueType === "i32") view.setInt32(0, value, false);
  else view.setFloat32(0, value, false);
  return [...bytes]
    .map((entry) => entry.toString(16).padStart(2, "0"))
    .join("");
}

function f32Position(value) {
  return { x: f32(value.x), y: f32(value.y), z: f32(value.z) };
}

function f32Vector(value) {
  return { x: f32(value.x), y: f32(value.y) };
}

function requirePosition(value, label) {
  requirePlainObject(value, label);
  requireOnlyKeys(value, ["x", "y", "z"], label);
  for (const key of ["x", "y", "z"]) requireFinite(value[key], `${label}.${key}`);
}

function requireVector(value, label) {
  requirePlainObject(value, label);
  requireOnlyKeys(value, ["x", "y"], label);
  requireFinite(value.x, `${label}.x`);
  requireFinite(value.y, `${label}.y`);
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

function requireExactF32(value, label) {
  if (!Number.isFinite(value) || !Object.is(value, f32(value))) {
    throw new TypeError(`${label} must already be an exact finite f32.`);
  }
}

function requireUint32(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    throw new TypeError(`${label} must be a uint32.`);
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

function requireOnlyKeys(value, keys, label) {
  const allowed = new Set(keys);
  const extras = Object.keys(value).filter((key) => !allowed.has(key));
  if (extras.length > 0) throw new Error(`${label} has unsupported fields: ${extras.join(", ")}.`);
}

function requireExactKeys(value, keys, label) {
  requireOnlyKeys(value, keys, label);
  const missing = keys.filter((key) => !Object.hasOwn(value, key));
  if (missing.length > 0) throw new Error(`${label} is missing fields: ${missing.join(", ")}.`);
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, cloneValue(child)]),
    );
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

const f32 = Math.fround;
