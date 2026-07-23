import {
  CSSOCCER_PLAYER_HIGHLIGHT_BLINK_MODES,
  CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT,
  CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT_SHA256,
  CSSOCCER_PLAYER_HIGHLIGHT_FACING_MODES,
  CSSOCCER_PLAYER_HIGHLIGHT_TYPES,
  cssoccerPlayerHighlightType,
} from "./playerHighlightContract.mjs";
import { assertCssoccerPlayerHighlightState } from "./playerHighlightState.mjs";

export const CSSOCCER_PLAYER_RENDER_CONTRACT_SCHEMA = "cssoccer-player-render-contract@1";
export const CSSOCCER_PLAYER_RENDER_BATCH_SCHEMA = "cssoccer-player-render-batch@1";
export const CSSOCCER_LIVE_RENDER_FRAME_SCHEMA = "cssoccer-live-render-frame@1";

const FIXTURE_ID = "spain-argentina-full-match";
const PLAYER_COUNT = 22;
const PREPARED_FRAME_COUNT = 5_857;
const PLAYER_FRAME_SET_COUNT = 1;
const EXACT_PLAYER_FRAME_SET_ID = "exact-actua-player-one-basis";
const EXACT_OFFICIAL_FRAME_SET_ID = "exact-actua-official-one-basis";
const OFFICIAL_COUNT = 3;
const PLAYER_HIGHLIGHT_FRAME_COUNT = 4;
const PLAYER_HIGHLIGHT_ROOT_ID = "player-highlight-local-user-1";
const PLAYER_HIGHLIGHT_FRAME_SET_ID = "player-highlight-marker";
const OFFICIAL_ROOT_IDS = Object.freeze([
  "referee-00",
  "assistant-referee-01",
  "assistant-referee-02",
]);
const PREPARED_FRAME_ENCODING = "cssquake-packed-frame-styles@3";
const SHA256 = /^[a-f0-9]{64}$/u;
const SOURCE_REVISION = /^[a-f0-9]{40}$/u;
const PLAYER_ID = /^(spain|argentina)-player-(0[1-9]|1[01])$/u;
const FRAME_LOOKUP_KEY = /^(\d+):(\d+)$/u;
const validatedContracts = new WeakSet();
const preparedFrameCountsByContract = new WeakMap();

const CONTRACT_KEYS = Object.freeze([
  "bindings",
  "counts",
  "fixtureId",
  "frameIdsByFrameSet",
  "officials",
  "playerHighlight",
  "players",
  "preparedFrameIndexBySlotFrame",
  "schema",
]);
const PLAYER_BINDING_KEYS = Object.freeze([
  "country",
  "frameSetId",
  "kickoffNativePlayerNumber",
  "kitBindingSha256",
  "modelId",
  "nativeRenderTypeByMatchHalfParity",
  "rootId",
]);
const OFFICIAL_BINDING_KEYS = Object.freeze([
  "frameSetId",
  "materialProfileId",
  "modelId",
  "nativeRenderType",
  "role",
  "rootId",
]);
const INPUT_PLAYER_KEYS = Object.freeze([
  "animation",
  "facing",
  "nativePlayerNumber",
  "position",
  "rootId",
  "visible",
]);
const COMMAND_KEYS = Object.freeze([
  "animation",
  "facing",
  "material",
  "nativePlayerNumber",
  "rootId",
  "transform",
  "visible",
]);

/**
 * Validate and compact the generated player facts plus prepared render
 * publication into the sole browser lookup contract. No source or geometry is
 * retained and no animation cadence is introduced here.
 */
export function createCssoccerPlayerRenderContract({
  preparedFacts,
  renderAssets,
  exactPlayerAssets,
  exactOfficialAssets,
} = {}) {
  const facts = requirePreparedPlayerFacts(preparedFacts);
  const publication = requirePreparedPlayerPublication(
    renderAssets,
    facts,
    exactPlayerAssets,
    exactOfficialAssets,
  );
  const players = facts.players.map((actor) => {
    const rootBinding = publication.rootBindingsById.get(actor.id);
    return {
      rootId: actor.id,
      country: actor.country,
      kickoffNativePlayerNumber: actor.nativeRuntimeIndex + 1,
      modelId: actor.model.modelId,
      frameSetId: EXACT_PLAYER_FRAME_SET_ID,
      kitBindingSha256: actor.material.kitBindingSha256,
      nativeRenderTypeByMatchHalfParity: {
        even: actor.material.nativeRenderTypeByMatchHalfParity.even,
        odd: actor.material.nativeRenderTypeByMatchHalfParity.odd,
      },
    };
  });
  const playerFrameSetIds = [...new Set(players.map(({ frameSetId }) => frameSetId))].sort();
  const officials = facts.officials.map((actor) => ({
    rootId: actor.id,
    role: actor.officialRole,
    modelId: actor.model.modelId,
    frameSetId: EXACT_OFFICIAL_FRAME_SET_ID,
    materialProfileId: actor.material.materialProfileId,
    nativeRenderType: actor.material.nativeRenderType,
  }));
  const playerHighlight = createPlayerHighlightRenderBinding(facts, publication);
  const contract = freezeStaticContract({
    schema: CSSOCCER_PLAYER_RENDER_CONTRACT_SCHEMA,
    fixtureId: FIXTURE_ID,
    counts: {
      players: PLAYER_COUNT,
      preparedFrames: facts.preparedFrameCount,
      playerFrameSets: playerFrameSetIds.length,
      playerHighlightFrames: PLAYER_HIGHLIGHT_FRAME_COUNT,
      playerHighlightFrameSets: 1,
      officials: OFFICIAL_COUNT,
      officialFrameSets: 1,
    },
    bindings: {
      sourceRevision: facts.sourceRevision,
      stateArtifactSha256: facts.stateArtifactSha256,
      productionReference: renderAssets.lineage.productionReference,
      frameSetHashes: {
        [EXACT_PLAYER_FRAME_SET_ID]: publication.exactPlayerContractSha256,
      },
      exactOfficialContractSha256: publication.exactOfficialContractSha256,
    },
    players,
    officials,
    playerHighlight,
    preparedFrameIndexBySlotFrame: { ...facts.preparedFrameIndexBySlotFrame },
    frameIdsByFrameSet: {
      [EXACT_PLAYER_FRAME_SET_ID]: [...facts.expectedFrameIds],
    },
  });
  assertCssoccerPlayerRenderContract(contract);
  validatedContracts.add(contract);
  return contract;
}

/**
 * Project the current browser-owned free-play snapshot directly onto the
 * stable prepared roots. The renderer receives no replay projection and has
 * no advancing capability of its own.
 */
export function createCssoccerFreePlayRenderFrame(contract, {
  snapshot,
} = {}) {
  assertCssoccerPlayerRenderContract(contract);
  requirePlainObject(snapshot, "cssoccer free-play snapshot");
  if (
    snapshot.schema !== "cssoccer-free-play-snapshot@1"
    || snapshot.tick !== snapshot.match?.tick
    || snapshot.phase !== snapshot.match?.phase
  ) {
    throw new Error("cssoccer rendering requires one current free-play snapshot.");
  }
  const match = snapshot.match;
  if (!Array.isArray(match.players) || match.players.length !== PLAYER_COUNT) {
    throw new Error("cssoccer free-play rendering requires exactly 22 current players.");
  }
  const sourceMatchHalf = match.clock?.matchHalf;
  if (![0, 1, 11].includes(sourceMatchHalf)) {
    throw new RangeError("cssoccer free-play rendering received an unsupported match half.");
  }
  const matchHalf = sourceMatchHalf === 0 ? 0 : 1;
  const players = match.players.map((player) => {
    const binding = contract.players.find(({ rootId }) => rootId === player.renderRootId);
    if (binding === undefined || binding.rootId !== player.id) {
      throw new Error(`cssoccer free-play rendering lost prepared root ${player.id}.`);
    }
    const slotId = player.animation?.id;
    const nativeFrame = player.animation?.frame;
    const frameCount = preparedAnimationFrameCount(contract, slotId);
    if (!Number.isFinite(nativeFrame)) {
      throw new TypeError(`cssoccer free-play animation frame is invalid for ${player.id}.`);
    }
    const fractionalFrame = nativeFrame - Math.floor(nativeFrame);
    return {
      rootId: player.renderRootId,
      nativePlayerNumber: player.nativePlayerNumber,
      position: [player.position.x, player.position.z, -player.position.y],
      facing: {
        cosine: player.facing.x,
        sine: player.facing.y,
      },
      visible: player.active,
      animation: {
        slotId,
        frame: Math.min(frameCount - 1, Math.floor(fractionalFrame * frameCount)),
      },
    };
  });
  const playerBatch = createCssoccerPlayerRenderCommands(contract, {
    tick: snapshot.tick,
    matchHalf,
    players,
  });
  const officials = createCssoccerOfficialRenderCommands(contract, match.officials);
  const playerHighlight = createCssoccerFreePlayPlayerHighlightRenderCommand(
    contract,
    match,
  );
  const phase = freePlayPresentationPhase(match);
  const goalScorer = match.goal.lastGoalScorerNative === 0
    ? null
    : match.players.find((player) => (
      player.nativePlayerNumber === match.goal.lastGoalScorerNative
    ));
  if (match.goal.lastGoalScorerNative !== 0 && goalScorer === undefined) {
    throw new Error(`cssoccer free-play rendering lost goal scorer ${match.goal.lastGoalScorerNative}.`);
  }
  return {
    schema: CSSOCCER_LIVE_RENDER_FRAME_SCHEMA,
    tick: snapshot.tick,
    phase,
    terminal: match.clock.terminal,
    matchHalf: sourceMatchHalf,
    renderHalf: matchHalf,
    score: { ...match.score.goals },
    clock: {
      minutes: match.clock.gameMinute,
      seconds: match.clock.gameSecond,
      running: match.clock.running,
    },
    camera: {
      effectiveBall: { ...match.ball.ball.position },
      justScored: match.goal.justScored,
      matchMode: match.rules.matchMode,
      lastTouch: match.possession.lastTouch,
      restartTaker: currentCameraRestartTaker(match),
      goalScorer: goalScorer === null
        ? null
        : {
            nativePlayerNumber: goalScorer.nativePlayerNumber,
            position: { ...goalScorer.position },
            displacement: {
              // 3D_UPD2.CPP camera 15 consumes tm_xdis/tm_ydis, the
              // persistent player facing displacement, even while celebration
              // movement velocity is zero.
              x: goalScorer.facing.x,
              y: goalScorer.facing.y,
            },
          },
    },
    selectedPlayerId: match.control.activePlayerId,
    playerHighlight,
    players: playerBatch,
    officials,
    ball: {
      rootId: match.actors.ballRootId,
      visible: true,
      transform: {
        position: [
          match.ball.ball.position.x,
          match.ball.ball.position.z,
          -match.ball.ball.position.y,
        ],
        rotation: [0, 0, 0],
        scale: 1,
      },
    },
  };
}

function createCssoccerOfficialRenderCommands(contract, officialState) {
  requirePlainObject(officialState, "cssoccer current official state");
  if (!Array.isArray(officialState.officials)
      || officialState.officials.length !== OFFICIAL_COUNT) {
    throw new Error("cssoccer rendering requires the referee and both assistants.");
  }
  const bindingsById = new Map(contract.officials.map((binding) => [binding.rootId, binding]));
  const seen = new Set();
  const commands = officialState.officials.map((official, index) => {
    const binding = bindingsById.get(official?.id);
    if (!binding || binding.rootId !== OFFICIAL_ROOT_IDS[index] || seen.has(binding.rootId)) {
      throw new Error(`cssoccer official render identity changed at index ${index}.`);
    }
    seen.add(binding.rootId);
    if (official.index !== index
        || !isFiniteVec2(official.facing)
        || !isFinitePosition(official.position)
        || !Number.isSafeInteger(official.animation?.id)
        || !Number.isFinite(official.animation?.frame)) {
      throw new Error(`cssoccer current official state is invalid at index ${index}.`);
    }
    const frameCount = preparedAnimationFrameCount(contract, official.animation.id);
    const fractionalFrame = official.animation.frame - Math.floor(official.animation.frame);
    const cosine = -official.facing.x;
    const sine = official.facing.y;
    const yawDegrees = rendererYawDegrees(cosine, sine);
    return {
      rootId: binding.rootId,
      role: binding.role,
      visible: true,
      transform: {
        position: [official.position.x, official.position.z, -official.position.y],
        rotation: [0, yawDegrees, 0],
        scale: 1,
      },
      facing: { cosine, sine, yawDegrees },
      animation: {
        slotId: official.animation.id,
        frame: Math.min(frameCount - 1, Math.floor(fractionalFrame * frameCount)),
      },
      material: {
        materialProfileId: binding.materialProfileId,
        nativeRenderType: binding.nativeRenderType,
      },
    };
  });
  if (seen.size !== OFFICIAL_COUNT) {
    throw new Error("cssoccer official rendering lost a prepared root.");
  }
  return { commands };
}

export function createCssoccerFreePlayPlayerHighlightRenderCommand(contract, match) {
  assertCssoccerPlayerRenderContract(contract);
  requirePlainObject(match, "cssoccer free-play highlight match");
  const state = assertCssoccerPlayerHighlightState(match.playerHighlight);
  if (state.tick !== match.tick) {
    throw new Error("cssoccer player highlight rendering requires the current match tick.");
  }
  const marker = state.marker;
  const type = cssoccerPlayerHighlightType(
    marker === null ? CSSOCCER_PLAYER_HIGHLIGHT_TYPES.OFF : marker.typeValue,
  );
  const player = marker === null
    ? null
    : match.players.find(({ id }) => id === marker.playerId);
  if (marker !== null && player === undefined) {
    throw new Error(`cssoccer player highlight lost current player ${marker.playerId}.`);
  }
  const frameIndex = marker === null
    ? 0
    : contract.playerHighlight.frameIndexByFamilyId[marker.familyId];
  if (!Number.isSafeInteger(frameIndex)) {
    throw new Error("cssoccer player highlight family has no prepared frame.");
  }
  const yawDegrees = marker !== null
    && marker.facingMode === CSSOCCER_PLAYER_HIGHLIGHT_FACING_MODES.PLAYER
    ? rendererYawDegrees(player.facing.x, player.facing.y)
    : 0;
  const visible = marker !== null
    && player.active
    && sourcePlayerHighlightVisible(match.tick, marker.blinkMode);
  const hcol = marker === null ? 0 : marker.hcol;
  const colour = CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT.colourSlots[hcol];
  if (!colour || colour.hcol !== hcol) {
    throw new Error("cssoccer player highlight changed its prepared colour slot.");
  }
  return {
    rootId: contract.playerHighlight.rootId,
    playerId: marker === null ? null : marker.playerId,
    nativePlayerNumber: marker === null ? null : marker.nativePlayerNumber,
    visible,
    type: {
      value: type.nativeValue,
      id: type.id,
      semantic: type.semantic,
    },
    family: {
      id: type.familyId,
      frameIndex,
      frameId: contract.playerHighlight.frameIds[frameIndex],
    },
    material: {
      hcol: colour.hcol,
      id: colour.id,
    },
    facingMode: type.facingMode,
    blinkMode: type.blinkMode,
    ordinaryShadow: type.ordinaryShadow,
    transform: {
      position: player === null
        ? [0, 0, 0]
        : [player.position.x, player.position.z, -player.position.y],
      rotation: [0, yawDegrees, 0],
      scale: 1,
    },
  };
}

function sourcePlayerHighlightVisible(tick, blinkMode) {
  if (blinkMode === CSSOCCER_PLAYER_HIGHLIGHT_BLINK_MODES.HIDDEN) return false;
  if (blinkMode === CSSOCCER_PLAYER_HIGHLIGHT_BLINK_MODES.STEADY) return true;
  if (blinkMode !== CSSOCCER_PLAYER_HIGHLIGHT_BLINK_MODES.HALF_CYCLE) {
    throw new Error(`Unknown cssoccer player highlight blink mode ${blinkMode}.`);
  }
  const phase = tick % CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT.phase.modulus;
  return phase >= CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT.phase.visibleStartInclusive
    && phase < CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT.phase.visibleEndExclusive;
}

function freePlayPresentationPhase(match) {
  if (match.clock.terminal) return "full-time-terminal";
  if (
    match.clock.phase === "halftime-whistle"
    || match.clock.phase === "halftime-transition"
  ) return match.clock.phase;
  if (
    match.clock.matchHalf === 1
    && match.kickoff.restartKind === "halftime"
    && match.kickoff.phase !== "open-play"
  ) return "halftime-end-swap-second-half-kickoff";
  if (
    match.phase === "opening-kickoff"
    || match.phase === "opening-kick-action"
  ) return "opening-kickoff";
  return match.clock.matchHalf === 0
    ? "first-half-live-clock"
    : "second-half-live-clock";
}

function currentCameraRestartTaker(match) {
  const active = match.rules.boundary?.descriptor?.taker?.nativePlayerNumber;
  if (active !== undefined) return active;
  return match.rules.lastBoundaryRestart?.takerNativePlayer ?? null;
}

/**
 * Convert the browser engine's authoritative post-tick projection into the
 * stable-root player/ball publication consumed by the mounted PolyCSS scene.
 */
export function createCssoccerLiveRenderFrame(contract, {
  inspection,
  projection,
} = {}) {
  assertCssoccerPlayerRenderContract(contract);
  requirePlainObject(projection, "cssoccer live engine projection");
  requireExactKeys(projection, ["phase", "tick", "values"], "cssoccer live engine projection");
  requireNonNegativeSafeInteger(projection.tick, "cssoccer live engine projection tick");
  if (projection.phase !== "post_tick") {
    throw new Error("cssoccer live rendering requires the post_tick engine phase.");
  }
  requirePlainObject(projection.values, "cssoccer live engine values");
  requirePlainObject(inspection, "cssoccer live engine inspection");
  if (inspection.tick !== projection.tick || typeof inspection.phase !== "string") {
    throw new Error("cssoccer live rendering requires matching engine inspection state.");
  }

  const values = projection.values;
  const sourceMatchHalf = requireIntegerValue(values["clock.match_half"], "clock.match_half");
  if (![0, 1, 11].includes(sourceMatchHalf)) {
    throw new RangeError("cssoccer live rendering received an unsupported source match half.");
  }
  const matchHalf = sourceMatchHalf === 0 ? 0 : 1;
  const bindingsByKickoffNative = new Map(contract.players.map((binding) => [
    binding.kickoffNativePlayerNumber,
    binding,
  ]));
  const players = contract.players.map((binding) => {
    const nativePlayerNumber = nativePlayerForHalf(
      binding.kickoffNativePlayerNumber,
      matchHalf,
    );
    const sourceSlot = bindingsByKickoffNative.get(nativePlayerNumber);
    if (sourceSlot === undefined) {
      throw new Error(`cssoccer live rendering lost native slot ${nativePlayerNumber}.`);
    }
    const prefix = `players.${sourceSlot.rootId}.`;
    const slotId = requireIntegerValue(values[`${prefix}animation`], `${prefix}animation`);
    const nativeFrame = requireFiniteValue(
      values[`${prefix}animation_frame`],
      `${prefix}animation_frame`,
    );
    const frameCount = preparedAnimationFrameCount(contract, slotId);
    const fractionalFrame = nativeFrame - Math.floor(nativeFrame);
    const frame = Math.min(
      frameCount - 1,
      Math.floor(fractionalFrame * frameCount),
    );
    return {
      rootId: binding.rootId,
      nativePlayerNumber,
      position: [
        requireFiniteValue(values[`${prefix}x`], `${prefix}x`),
        requireFiniteValue(values[`${prefix}z`], `${prefix}z`),
        -requireFiniteValue(values[`${prefix}y`], `${prefix}y`),
      ],
      facing: {
        cosine: requireFiniteValue(
          values[`${prefix}x_displacement`],
          `${prefix}x_displacement`,
        ),
        sine: requireFiniteValue(
          values[`${prefix}y_displacement`],
          `${prefix}y_displacement`,
        ),
      },
      visible: requireIntegerValue(values[`${prefix}on`], `${prefix}on`) !== 0,
      animation: { slotId, frame },
    };
  });
  const playerBatch = createCssoccerPlayerRenderCommands(contract, {
    tick: projection.tick,
    matchHalf,
    players,
  });
  const selected = players.find((player) => {
    const sourceSlot = bindingsByKickoffNative.get(player.nativePlayerNumber);
    return values[`players.${sourceSlot.rootId}.control`] !== 0;
  });
  const goalScorerNative = requireIntegerValue(
    values["score.goal_scorer"],
    "score.goal_scorer",
  );
  const goalScorerPlayer = goalScorerNative === 0
    ? null
    : players.find(({ nativePlayerNumber }) => nativePlayerNumber === goalScorerNative);
  if (goalScorerNative !== 0 && goalScorerPlayer === undefined) {
    throw new Error(`cssoccer live rendering lost goal scorer ${goalScorerNative}.`);
  }
  const sourceEndGame = requireIntegerValue(
    values["lifecycle.end_game"],
    "lifecycle.end_game",
  ) !== 0;
  const terminal = Boolean(inspection.terminal);
  if (sourceEndGame && !terminal) {
    throw new Error("cssoccer live render received end_game before the scheduler terminal boundary.");
  }
  return {
    schema: CSSOCCER_LIVE_RENDER_FRAME_SCHEMA,
    tick: projection.tick,
    phase: inspection.phase,
    terminal,
    matchHalf: sourceMatchHalf,
    renderHalf: matchHalf,
    score: {
      spain: requireIntegerValue(values["score.team_a"], "score.team_a"),
      argentina: requireIntegerValue(values["score.team_b"], "score.team_b"),
    },
    clock: {
      minutes: requireIntegerValue(values["clock.minutes"], "clock.minutes"),
      seconds: requireFiniteValue(values["clock.seconds"], "clock.seconds"),
      running: requireIntegerValue(values["clock.clock_running"], "clock.clock_running") !== 0,
    },
    camera: {
      effectiveBall: {
        x: requireFiniteValue(values["ball.x"], "ball.x"),
        y: requireFiniteValue(values["ball.y"], "ball.y"),
        z: requireFiniteValue(values["ball.z"], "ball.z"),
      },
      justScored: requireIntegerValue(values["score.just_scored"], "score.just_scored"),
      matchMode: requireIntegerValue(values["rules.match_mode"], "rules.match_mode"),
      lastTouch: requireIntegerValue(values["ball.last_touch"], "ball.last_touch"),
      restartTaker: null,
      goalScorer: goalScorerPlayer
        ? {
            nativePlayerNumber: goalScorerPlayer.nativePlayerNumber,
            position: {
              x: goalScorerPlayer.position[0],
              y: -goalScorerPlayer.position[2],
              z: goalScorerPlayer.position[1],
            },
            displacement: {
              x: goalScorerPlayer.facing.cosine,
              y: goalScorerPlayer.facing.sine,
            },
          }
        : null,
    },
    selectedPlayerId: selected?.rootId ?? null,
    players: playerBatch,
    ball: {
      rootId: "ball-00",
      visible: true,
      transform: {
        position: [
          requireFiniteValue(values["ball.x"], "ball.x"),
          requireFiniteValue(values["ball.z"], "ball.z"),
          -requireFiniteValue(values["ball.y"], "ball.y"),
        ],
        rotation: [0, 0, 0],
        scale: 1,
      },
    },
  };
}

/**
 * Convert one authoritative render frame into stable-root commands. The
 * caller supplies the exact animation slot/local frame and renderer-space
 * pose; this function performs lookup and ordering only.
 */
export function createCssoccerPlayerRenderCommands(contract, frame) {
  assertCssoccerPlayerRenderContract(contract);
  requirePlainObject(frame, "cssoccer player render frame");
  requireExactKeys(frame, ["matchHalf", "players", "tick"], "cssoccer player render frame");
  requireNonNegativeSafeInteger(frame.tick, "cssoccer player render tick");
  requireMatchHalf(frame.matchHalf);
  if (!Array.isArray(frame.players) || frame.players.length !== PLAYER_COUNT) {
    throw new Error("cssoccer player render frame requires exactly 22 players.");
  }

  const bindingsById = new Map(contract.players.map((binding) => [binding.rootId, binding]));
  const seenRoots = new Set();
  const seenNativePlayers = new Set();
  const commands = frame.players.map((player, index) => {
    requirePlainObject(player, `cssoccer render player ${index}`);
    requireExactKeys(player, INPUT_PLAYER_KEYS, `cssoccer render player ${index}`);
    if (typeof player.rootId !== "string" || !bindingsById.has(player.rootId)) {
      throw new Error(`Unknown prepared cssoccer player root ${String(player.rootId)}.`);
    }
    if (seenRoots.has(player.rootId)) {
      throw new Error(`Duplicate prepared cssoccer player root ${player.rootId}.`);
    }
    seenRoots.add(player.rootId);
    requireIntegerRange(player.nativePlayerNumber, 1, PLAYER_COUNT, `${player.rootId} native player`);
    if (seenNativePlayers.has(player.nativePlayerNumber)) {
      throw new Error(`Duplicate cssoccer native player ${player.nativePlayerNumber}.`);
    }
    seenNativePlayers.add(player.nativePlayerNumber);

    const binding = bindingsById.get(player.rootId);
    const expectedNativePlayer = nativePlayerForHalf(
      binding.kickoffNativePlayerNumber,
      frame.matchHalf,
    );
    if (player.nativePlayerNumber !== expectedNativePlayer) {
      throw new Error(`${player.rootId} is not in its source-bound native slot for half ${frame.matchHalf}.`);
    }
    const position = requireFiniteVector3(player.position, `${player.rootId} renderer position`);
    const facing = requireFacing(player.facing, player.rootId);
    if (typeof player.visible !== "boolean") {
      throw new TypeError(`${player.rootId} visibility must be boolean.`);
    }
    const animation = resolvePreparedAnimation(contract, binding, player.animation, player.rootId);
    const yawDegrees = rendererYawDegrees(facing.cosine, facing.sine);
    const parity = frame.matchHalf === 0 ? "even" : "odd";
    const nativeRenderType = binding.nativeRenderTypeByMatchHalfParity[parity];
    const expectedRenderType = player.nativePlayerNumber <= 11 ? 1 : 2;
    if (nativeRenderType !== expectedRenderType) {
      throw new Error(`${player.rootId} material orientation diverged from its native half slot.`);
    }
    return {
      rootId: player.rootId,
      nativePlayerNumber: player.nativePlayerNumber,
      transform: {
        position,
        rotation: [0, yawDegrees, 0],
        scale: 1,
      },
      facing: {
        cosine: facing.cosine,
        sine: facing.sine,
        yawDegrees,
      },
      visible: player.visible,
      animation,
      material: {
        country: binding.country,
        kitBindingSha256: binding.kitBindingSha256,
        nativeRenderType,
      },
    };
  });
  if (seenRoots.size !== contract.players.length) {
    throw new Error("cssoccer player render frame does not contain the canonical 22 roots.");
  }
  commands.sort((left, right) => left.nativePlayerNumber - right.nativePlayerNumber);
  if (commands.some((command, index) => command.nativePlayerNumber !== index + 1)) {
    throw new Error("cssoccer player render commands must cover contiguous native order 1..22.");
  }
  const batch = {
    schema: CSSOCCER_PLAYER_RENDER_BATCH_SCHEMA,
    fixtureId: FIXTURE_ID,
    tick: frame.tick,
    matchHalf: frame.matchHalf,
    commands,
  };
  return assertCssoccerPlayerRenderCommands(contract, batch);
}

export function assertCssoccerPlayerRenderContract(contract) {
  requirePlainObject(contract, "cssoccer player render contract");
  if (validatedContracts.has(contract)) return contract;
  requireExactKeys(contract, CONTRACT_KEYS, "cssoccer player render contract");
  if (
    contract.schema !== CSSOCCER_PLAYER_RENDER_CONTRACT_SCHEMA
    || contract.fixtureId !== FIXTURE_ID
  ) {
    throw new Error(`cssoccer player render contract must use ${CSSOCCER_PLAYER_RENDER_CONTRACT_SCHEMA}.`);
  }
  requirePlainObject(contract.counts, "cssoccer player render counts");
  requireExactKeys(
    contract.counts,
    [
      "playerFrameSets",
      "playerHighlightFrameSets",
      "playerHighlightFrames",
      "players",
      "preparedFrames",
      "officialFrameSets",
      "officials",
    ],
    "cssoccer player render counts",
  );
  if (
    contract.counts.players !== PLAYER_COUNT
    || contract.counts.preparedFrames !== PREPARED_FRAME_COUNT
    || contract.counts.playerFrameSets !== PLAYER_FRAME_SET_COUNT
    || contract.counts.playerHighlightFrameSets !== 1
    || contract.counts.playerHighlightFrames !== PLAYER_HIGHLIGHT_FRAME_COUNT
    || contract.counts.officials !== OFFICIAL_COUNT
    || contract.counts.officialFrameSets !== 1
  ) {
    throw new Error("cssoccer player render contract counts changed.");
  }
  requirePlainObject(contract.bindings, "cssoccer player render bindings");
  requireExactKeys(
    contract.bindings,
    [
      "exactOfficialContractSha256",
      "frameSetHashes",
      "productionReference",
      "sourceRevision",
      "stateArtifactSha256",
    ],
    "cssoccer player render bindings",
  );
  if (
    !SOURCE_REVISION.test(contract.bindings.sourceRevision ?? "")
    || !SHA256.test(contract.bindings.stateArtifactSha256 ?? "")
    || !SHA256.test(contract.bindings.exactOfficialContractSha256 ?? "")
    || contract.bindings.productionReference !== "cssQuake"
  ) {
    throw new Error("cssoccer player render lineage is invalid.");
  }
  requirePlainObject(contract.frameIdsByFrameSet, "cssoccer player frame-set ids");
  requirePlainObject(contract.bindings.frameSetHashes, "cssoccer player frame-set hashes");
  const frameSetIds = Object.keys(contract.frameIdsByFrameSet).sort();
  if (
    frameSetIds.length !== PLAYER_FRAME_SET_COUNT
    || !sameValue(frameSetIds, Object.keys(contract.bindings.frameSetHashes).sort())
  ) {
    throw new Error("cssoccer player frame-set bindings changed.");
  }
  for (const id of frameSetIds) {
    if (
      !Array.isArray(contract.frameIdsByFrameSet[id])
      || contract.frameIdsByFrameSet[id].length !== PREPARED_FRAME_COUNT
      || !SHA256.test(contract.bindings.frameSetHashes[id] ?? "")
    ) {
      throw new Error(`cssoccer player frame set ${id} is incomplete.`);
    }
  }
  validateCompactFrameLookup(contract, frameSetIds);
  validateCompactPlayerBindings(contract, frameSetIds);
  validateCompactOfficialBindings(contract);
  validatePlayerHighlightRenderBinding(contract.playerHighlight);
  validatedContracts.add(contract);
  return contract;
}

function validatePlayerHighlightRenderBinding(binding) {
  requirePlainObject(binding, "cssoccer player highlight render binding");
  requireExactKeys(binding, [
    "bundleId",
    "contractSha256",
    "frameIds",
    "frameIndexByFamilyId",
    "frameSetHash",
    "frameSetId",
    "rootId",
    "sourcePointListSha256",
    "stableLeafCount",
  ], "cssoccer player highlight render binding");
  const frameIds = CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT.markerFamilies.map(({ id }) => id);
  if (
    binding.rootId !== PLAYER_HIGHLIGHT_ROOT_ID
    || binding.frameSetId !== PLAYER_HIGHLIGHT_FRAME_SET_ID
    || binding.bundleId !== PLAYER_HIGHLIGHT_FRAME_SET_ID
    || binding.contractSha256 !== CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT_SHA256
    || binding.sourcePointListSha256
      !== CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT.geometry.sourcePointListSha256
    || binding.stableLeafCount !== 1
    || !SHA256.test(binding.frameSetHash ?? "")
    || !sameValue(binding.frameIds, frameIds)
    || !sameValue(
      binding.frameIndexByFamilyId,
      Object.fromEntries(frameIds.map((id, index) => [id, index])),
    )
  ) {
    throw new Error("cssoccer player highlight render binding changed.");
  }
}

export function assertCssoccerPlayerRenderCommands(contract, batch) {
  assertCssoccerPlayerRenderContract(contract);
  requirePlainObject(batch, "cssoccer player render batch");
  requireExactKeys(
    batch,
    ["commands", "fixtureId", "matchHalf", "schema", "tick"],
    "cssoccer player render batch",
  );
  if (
    batch.schema !== CSSOCCER_PLAYER_RENDER_BATCH_SCHEMA
    || batch.fixtureId !== FIXTURE_ID
    || !Array.isArray(batch.commands)
    || batch.commands.length !== PLAYER_COUNT
  ) {
    throw new Error(`cssoccer player render batch must use ${CSSOCCER_PLAYER_RENDER_BATCH_SCHEMA}.`);
  }
  requireNonNegativeSafeInteger(batch.tick, "cssoccer player render batch tick");
  requireMatchHalf(batch.matchHalf);
  const bindingsByNativePlayer = new Map(contract.players.map((binding) => [
    nativePlayerForHalf(binding.kickoffNativePlayerNumber, batch.matchHalf),
    binding,
  ]));
  for (let index = 0; index < batch.commands.length; index += 1) {
    const command = batch.commands[index];
    const nativePlayerNumber = index + 1;
    const binding = bindingsByNativePlayer.get(nativePlayerNumber);
    requirePlainObject(command, `cssoccer player render command ${index}`);
    requireExactKeys(command, COMMAND_KEYS, `cssoccer player render command ${index}`);
    if (
      command.rootId !== binding?.rootId
      || command.nativePlayerNumber !== nativePlayerNumber
      || typeof command.visible !== "boolean"
    ) {
      throw new Error(`cssoccer player render command ${index} changed stable native identity.`);
    }
    assertCommandTransform(command, index);
    assertCommandAnimation(contract, command, binding, index);
    assertCommandMaterial(command, binding, batch.matchHalf, index);
  }
  return batch;
}

function requirePreparedPlayerFacts(facts) {
  requirePlainObject(facts, "prepared cssoccer facts");
  const actors = facts.actors;
  if (
    facts.schema !== "cssoccer-prepared-fixture-facts@1"
    || facts.id !== FIXTURE_ID
    || facts.status !== "ready"
    || actors?.schema !== "cssoccer-actor-preparation@1"
    || actors.fixtureId !== FIXTURE_ID
    || !SOURCE_REVISION.test(actors.sourceRevision ?? "")
    || !Array.isArray(actors.actors)
    || actors.actors.length !== 26
    || actors.counts?.players !== PLAYER_COUNT
    || actors.counts?.preparedRenderFrames !== 0
  ) {
    throw new Error("Prepared cssoccer player facts are not the canonical fixture contract.");
  }
  const pose = actors.poseFrameSets;
  if (
    !isPlainObject(pose)
    || pose.blueprint !== "cssQuake prepared animated render bundle frame-style swap"
    || pose.rootStableAcrossFrames !== true
    || pose.topologyStableAcrossFrames !== true
    || pose.runtimeMaySelectPreparedFrame !== true
    || pose.runtimeMayCreateNodesOrGeometry !== false
    || !SHA256.test(pose.stateArtifactSha256 ?? "")
    || facts.bindings?.nativeStateSha256 !== pose.stateArtifactSha256
  ) {
    throw new Error("Prepared cssoccer pose-frame contract changed.");
  }
  const poseContract = requirePoseLookup(pose);
  const kitBindings = requireKitBindings(facts.materials);
  const players = actors.actors.slice(0, PLAYER_COUNT);
  if (actors.actors.slice(PLAYER_COUNT).some(({ kind }) => kind === "player")) {
    throw new Error("Prepared cssoccer actors widened the fixed 22-player set.");
  }
  players.forEach((actor, index) => requirePreparedPlayerActor(actor, index, kitBindings));
  const officials = actors.actors.slice(PLAYER_COUNT, PLAYER_COUNT + OFFICIAL_COUNT);
  officials.forEach((actor, index) => requirePreparedOfficialActor(actor, index));
  const playerHighlight = facts.playerHighlight;
  if (
    !isPlainObject(playerHighlight)
    || playerHighlight.schema !== "cssoccer-prepared-player-highlight@1"
    || playerHighlight.contractSha256 !== CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT_SHA256
    || playerHighlight.rootId !== PLAYER_HIGHLIGHT_ROOT_ID
    || playerHighlight.frameSetId !== PLAYER_HIGHLIGHT_FRAME_SET_ID
    || playerHighlight.bundleId !== PLAYER_HIGHLIGHT_FRAME_SET_ID
    || !sameValue(
      playerHighlight.frameIds,
      CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT.markerFamilies.map(({ id }) => id),
    )
    || playerHighlight.sourcePointListSha256
      !== CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT.geometry.sourcePointListSha256
    || playerHighlight.stableLeafCount !== 1
    || !isPlainObject(playerHighlight.runtimeConstruction)
    || !sameValue(playerHighlight.runtimeConstruction, {
      assetBuildCount: 0,
      geometryBuildCount: 0,
      materialBuildCount: 0,
      sourceParseCount: 0,
      topologyBuildCount: 0,
    })
  ) {
    throw new Error("Prepared cssoccer player highlight facts changed.");
  }
  return {
    players,
    officials,
    actorIds: actors.actors.map(({ id }) => id),
    sourceRevision: actors.sourceRevision,
    stateArtifactSha256: pose.stateArtifactSha256,
    playerHighlight,
    ...poseContract,
  };
}

function requirePoseLookup(pose) {
  if (!Array.isArray(pose.preparedFrameLookup) || !Array.isArray(pose.slots)) {
    throw new Error("Prepared cssoccer pose lookup is missing.");
  }
  const lookup = pose.preparedFrameLookup;
  if (lookup.length === 0 || pose.slots.length !== lookup.length) {
    throw new Error("Prepared cssoccer pose slots and lookup changed.");
  }
  const expectedMap = {};
  const expectedFrameIds = [];
  const slotIds = new Set();
  let cursor = 0;
  for (let slotIndex = 0; slotIndex < lookup.length; slotIndex += 1) {
    const entry = lookup[slotIndex];
    const slot = pose.slots[slotIndex];
    requirePlainObject(entry, `prepared pose lookup ${slotIndex}`);
    requireExactKeys(
      entry,
      ["frameCount", "preparedFrameEnd", "preparedFrameStart", "slotId", "sourceSlotId", "status"],
      `prepared pose lookup ${slotIndex}`,
    );
    if (
      !Number.isSafeInteger(entry.slotId)
      || entry.slotId < 0
      || slotIds.has(entry.slotId)
      || !Number.isSafeInteger(entry.sourceSlotId)
      || entry.sourceSlotId < 0
      || typeof entry.status !== "string"
      || entry.status.length === 0
      || !Number.isSafeInteger(entry.frameCount)
      || entry.frameCount < 1
      || entry.preparedFrameStart !== cursor
      || entry.preparedFrameEnd !== cursor + entry.frameCount
      || slot?.id !== entry.slotId
      || slot.sourceSlotId !== entry.sourceSlotId
      || slot.status !== entry.status
      || slot.frameCount !== entry.frameCount
      || !Array.isArray(slot.frames)
      || slot.frames.length !== entry.frameCount
    ) {
      throw new Error(`Prepared pose lookup ${slotIndex} is not contiguous.`);
    }
    slotIds.add(entry.slotId);
    for (let frame = 0; frame < entry.frameCount; frame += 1) {
      if (slot.frames[frame]?.index !== frame) {
        throw new Error(`Prepared pose slot ${entry.slotId} changed frame order.`);
      }
      const key = `${entry.slotId}:${frame}`;
      const index = cursor + frame;
      expectedMap[key] = index;
      expectedFrameIds[index] = preparedFrameId(entry.slotId, frame);
    }
    cursor = entry.preparedFrameEnd;
  }
  requirePlainObject(
    pose.preparedFrameIndexBySlotFrame,
    "prepared frame index by slot/frame",
  );
  if (
    cursor !== PREPARED_FRAME_COUNT
    || Object.keys(pose.preparedFrameIndexBySlotFrame).length !== cursor
  ) {
    throw new Error("Prepared cssoccer pose lookup does not cover 2,450 frames.");
  }
  for (const [key, index] of Object.entries(expectedMap)) {
    if (pose.preparedFrameIndexBySlotFrame[key] !== index) {
      throw new Error(`Prepared cssoccer frame lookup changed at ${key}.`);
    }
  }
  return {
    preparedFrameCount: cursor,
    preparedFrameIndexBySlotFrame: pose.preparedFrameIndexBySlotFrame,
    expectedFrameIds,
  };
}

function requirePreparedPlayerActor(actor, index, kitBindings) {
  requirePlainObject(actor, `prepared player actor ${index}`);
  const country = index < 11 ? "spain" : "argentina";
  const rosterNumber = (index % 11) + 1;
  const expectedId = `${country}-player-${String(rosterNumber).padStart(2, "0")}`;
  const sourceTeamSlot = country === "spain" ? "A" : "B";
  const expectedModelId = country === "spain" ? "player_f1" : "player_f2";
  const expectedRenderTypes = country === "spain"
    ? { even: 1, odd: 2 }
    : { even: 2, odd: 1 };
  if (
    actor.id !== expectedId
    || actor.kind !== "player"
    || actor.country !== country
    || actor.nativeRuntimeIndex !== index
    || actor.nativeRendererIndex !== index
    || actor.sourcePublicationIndex !== index
    || actor.sourceRosterIndex !== rosterNumber - 1
    || actor.model?.modelId !== expectedModelId
    || actor.model.renderAssetId !== EXACT_PLAYER_FRAME_SET_ID
    || actor.model.payloadStatus !== "decoded-source-geometry"
    || !SHA256.test(actor.model.topologySignatureSha256 ?? "")
    || actor.material?.sourceTeamSlot !== sourceTeamSlot
    || !sameValue(actor.material.nativeRenderTypeByMatchHalfParity, expectedRenderTypes)
    || actor.material.kitBindingSha256 !== kitBindings.get(country)
    || actor.root?.stable !== true
    || actor.root.runtimeMayCreateNodesOrAssets !== false
    || actor.root.blueprint !== "cssQuake prepared animated render bundle frame-style swap"
    || !sameValue(actor.root.runtimeMayUpdate, [
      "transform",
      "visibility",
      "material-class",
      "prepared-frame-index",
      "text",
    ])
  ) {
    throw new Error(`Prepared player actor contract changed at ${expectedId}.`);
  }
}

function requirePreparedOfficialActor(actor, index) {
  requirePlainObject(actor, `prepared official actor ${index}`);
  const referee = index === 0;
  const expectedId = OFFICIAL_ROOT_IDS[index];
  const expectedModelId = referee ? "player_fr" : "player_fl";
  const expectedRole = referee ? "referee" : "assistant-referee";
  const expectedProfile = referee
    ? "actua-referee-material"
    : "actua-assistant-referee-material";
  if (
    actor.id !== expectedId
    || actor.kind !== "official"
    || actor.country !== null
    || actor.nativeRuntimeIndex !== null
    || actor.nativeRendererIndex !== PLAYER_COUNT + index
    || actor.sourcePublicationIndex !== PLAYER_COUNT + index
    || actor.officialRole !== expectedRole
    || actor.model?.modelId !== expectedModelId
    || actor.model.renderAssetId !== EXACT_OFFICIAL_FRAME_SET_ID
    || actor.model.payloadStatus !== "decoded-source-geometry"
    || !SHA256.test(actor.model.topologySignatureSha256 ?? "")
    || actor.material?.nativeRenderType !== (referee ? 3 : 4)
    || actor.material.materialProfileId !== expectedProfile
    || actor.material.payloadStatus !== "prepared-exact-official-material"
    || actor.rendering?.status !== "prepared-source-bound"
    || actor.rendering.replacementAllowed !== false
    || actor.root?.stable !== true
    || actor.root.runtimeMayCreateNodesOrAssets !== false
  ) throw new Error(`Prepared official actor contract changed at ${expectedId}.`);
}

function requireKitBindings(materials) {
  const placementIds = [
    "native-player-page-0",
    "native-player-page-1",
    "native-player-page-2",
    "native-player-page-3",
    "native-referee-torso-page-4",
    "native-referee-limbs-page-5",
    "native-player-extra-page-6",
    "spain-pitch-bitmap",
    "native-corner-flag-slot-579-cutout",
  ];
  const browserAtlas = materials?.browserAtlas;
  const matchAtlas = materials?.matchAtlas;
  if (
    materials?.schema !== "cssoccer-texture-atlas-metadata@1"
    || materials.fixtureId !== FIXTURE_ID
    || materials.status !== "ready-source-match-atlas-plus-decoded-frontend-frames"
    || matchAtlas?.schema !== "cssoccer-source-match-texture-atlas@1"
    || matchAtlas.fixtureId !== FIXTURE_ID
    || matchAtlas.status !== "ready-source-decoded-browser-atlas"
    || !sameValue(browserAtlas, matchAtlas.browserAtlas)
    || browserAtlas?.path !== "assets/textures/spain-argentina-match.png"
    || browserAtlas.url !== "/cssoccer/assets/textures/spain-argentina-match.png"
    || browserAtlas.mediaType !== "image/png"
    || browserAtlas.runtimeConstruction !== false
    || !SHA256.test(browserAtlas.sha256 ?? "")
    || !Array.isArray(browserAtlas.placements)
    || !sameValue(browserAtlas.placements.map(({ id }) => id), placementIds)
    || !Array.isArray(materials.materials)
    || materials.materials.length !== 2
  ) {
    throw new Error("Prepared cssoccer material bindings changed.");
  }
  const bindings = new Map();
  for (const material of materials.materials) {
    if (
      (material.country !== "spain" && material.country !== "argentina")
      || bindings.has(material.country)
      || !SHA256.test(material.bindingSha256 ?? "")
      || material.status !== "source-decoded-match-material-ready"
      || !sameValue(material.browserAtlasEntryIds, placementIds)
    ) {
      throw new Error("Prepared cssoccer kit binding is invalid.");
    }
    bindings.set(material.country, material.bindingSha256);
  }
  return bindings;
}

function requirePreparedPlayerPublication(
  renderAssets,
  facts,
  exactPlayerAssets,
  exactOfficialAssets,
) {
  requirePlainObject(renderAssets, "prepared cssoccer render publication");
  if (
    renderAssets.schema !== "cssoccer-prepared-fixture-render-bundles@1"
    || renderAssets.id !== FIXTURE_ID
    || renderAssets.status !== "ready"
    || renderAssets.lineage?.productionReference !== "cssQuake"
    || renderAssets.lineage.pattern !== "prepare-time stable DOM serialization with same-topology frame-style swaps"
    || renderAssets.counts?.rootBindings !== 36
    || renderAssets.counts.highlightRootBindings !== 1
    || renderAssets.counts.actorRootBindings !== 26
    || renderAssets.counts.frameSets !== 1
    || renderAssets.counts.preparedFrames !== PLAYER_HIGHLIGHT_FRAME_COUNT
    || renderAssets.counts.droppedSourcePolygons !== 0
    || renderAssets.counts.leaves !== renderAssets.counts.sourcePolygons
  ) {
    throw new Error("Prepared cssoccer render publication changed.");
  }
  if (
    exactPlayerAssets?.schema !== "cssoccer-exact-actua-player-asset-runtime@1"
    || exactPlayerAssets.index?.counts?.sequences !== 124
    || exactPlayerAssets.index?.counts?.poseOccurrences !== PREPARED_FRAME_COUNT
    || exactPlayerAssets.index?.counts?.yawBins !== 24
    || exactPlayerAssets.index?.counts?.faceStates !== 1_827_384
    || !SHA256.test(exactPlayerAssets.index?.contractSha256 ?? "")
    || exactPlayerAssets.materials?.geometryId !== exactPlayerAssets.index?.geometryId
    || exactPlayerAssets.materials?.topologySha256 !== exactPlayerAssets.index?.topologySha256
  ) {
    throw new Error("Prepared exact-player publication changed.");
  }
  if (
    exactOfficialAssets?.schema !== "cssoccer-exact-actua-official-asset-runtime@1"
    || exactOfficialAssets.index?.counts?.sequences !== 11
    || exactOfficialAssets.index?.counts?.poseOccurrences !== 312
    || exactOfficialAssets.index?.counts?.yawBins !== 24
    || exactOfficialAssets.index?.counts?.faceStates !== 89_856
    || !SHA256.test(exactOfficialAssets.index?.contractSha256 ?? "")
    || exactOfficialAssets.materials?.counts?.fixtureOfficials !== OFFICIAL_COUNT
    || exactOfficialAssets.materials?.geometryId !== exactOfficialAssets.index?.geometryId
    || exactOfficialAssets.materials?.topologySha256 !== exactOfficialAssets.index?.topologySha256
  ) throw new Error("Prepared exact-official publication changed.");
  for (const sequence of exactOfficialAssets.index.sequences ?? []) {
    if (preparedAnimationFrameCountFromFacts(facts, sequence.slotId) !== sequence.frameCount) {
      throw new Error(`Prepared exact-official slot ${sequence.slotId} changed frame count.`);
    }
  }
  const rootBindingsById = uniqueByKey(
    renderAssets.rootBindings,
    "rootId",
    "prepared render root binding",
  );
  const frameSetsById = uniqueById(renderAssets.frameSets, "prepared render frame set");
  if (
    rootBindingsById.size !== 36
    || facts.actorIds.some((id) => !rootBindingsById.has(id))
    || !rootBindingsById.has(PLAYER_HIGHLIGHT_ROOT_ID)
    || frameSetsById.size !== 1
  ) {
    throw new Error("Prepared cssoccer stable root publication is incomplete.");
  }
  for (const actor of facts.players) {
    const binding = rootBindingsById.get(actor.id);
    if (
      binding?.bundleId !== EXACT_PLAYER_FRAME_SET_ID
      || binding.frameSetId !== null
    ) {
      throw new Error(`Prepared player root binding changed for ${actor.id}.`);
    }
  }
  for (const rootId of OFFICIAL_ROOT_IDS) {
    const binding = rootBindingsById.get(rootId);
    if (
      binding?.bundleId !== EXACT_OFFICIAL_FRAME_SET_ID
      || binding.frameSetId !== null
    ) {
      throw new Error(`Prepared official ${rootId} lost its exact asset binding.`);
    }
  }
  requireBoundHighlightFrameSet({
    binding: rootBindingsById.get(PLAYER_HIGHLIGHT_ROOT_ID),
    facts: facts.playerHighlight,
    frameSet: frameSetsById.get(PLAYER_HIGHLIGHT_FRAME_SET_ID),
  });
  return {
    rootBindingsById,
    frameSetsById,
    exactPlayerContractSha256: exactPlayerAssets.index.contractSha256,
    exactOfficialContractSha256: exactOfficialAssets.index.contractSha256,
  };
}

function requireBoundHighlightFrameSet({ binding, facts, frameSet }) {
  if (
    binding?.rootId !== PLAYER_HIGHLIGHT_ROOT_ID
    || binding.bundleId !== PLAYER_HIGHLIGHT_FRAME_SET_ID
    || binding.frameSetId !== PLAYER_HIGHLIGHT_FRAME_SET_ID
    || frameSet?.schema !== "cssoccer-prepared-render-frame-set@1"
    || frameSet.id !== PLAYER_HIGHLIGHT_FRAME_SET_ID
    || frameSet.kind !== "polycss-textured-frame-set"
    || frameSet.frameLeafStyleEncoding !== PREPARED_FRAME_ENCODING
    || frameSet.frameCount !== PLAYER_HIGHLIGHT_FRAME_COUNT
    || frameSet.leafCount !== 1
    || !Array.isArray(frameSet.frames)
    || frameSet.frames.length !== PLAYER_HIGHLIGHT_FRAME_COUNT
    || !sameValue(frameSet.frames.map(({ id }) => id), facts.frameIds)
    || frameSet.bundle?.id !== PLAYER_HIGHLIGHT_FRAME_SET_ID
    || frameSet.bundle.leafCount !== 1
    || !SHA256.test(frameSet.bundle.bundleHash ?? "")
    || !SHA256.test(frameSet.frameSetHash ?? "")
    || !SHA256.test(frameSet.topologyHash ?? "")
  ) {
    throw new Error("Prepared cssoccer player highlight frame set changed.");
  }
}

function createPlayerHighlightRenderBinding(facts, publication) {
  const metadata = facts.playerHighlight;
  const frameSet = publication.frameSetsById.get(metadata.frameSetId);
  return {
    rootId: metadata.rootId,
    frameSetId: metadata.frameSetId,
    bundleId: metadata.bundleId,
    contractSha256: metadata.contractSha256,
    sourcePointListSha256: metadata.sourcePointListSha256,
    stableLeafCount: metadata.stableLeafCount,
    frameSetHash: frameSet.frameSetHash,
    frameIds: [...metadata.frameIds],
    frameIndexByFamilyId: Object.fromEntries(
      metadata.frameIds.map((id, index) => [id, index]),
    ),
  };
}

function resolvePreparedAnimation(contract, binding, animation, rootId) {
  requirePlainObject(animation, `${rootId} animation`);
  requireExactKeys(animation, ["frame", "slotId"], `${rootId} animation`);
  requireNonNegativeSafeInteger(animation.slotId, `${rootId} animation slotId`);
  requireNonNegativeSafeInteger(animation.frame, `${rootId} animation frame`);
  const key = `${animation.slotId}:${animation.frame}`;
  if (!Object.hasOwn(contract.preparedFrameIndexBySlotFrame, key)) {
    throw new Error(`${rootId} animation ${key} has no prepared frame.`);
  }
  const preparedFrameIndex = contract.preparedFrameIndexBySlotFrame[key];
  const preparedFrameId = contract.frameIdsByFrameSet[binding.frameSetId]?.[preparedFrameIndex];
  if (!Number.isSafeInteger(preparedFrameIndex) || typeof preparedFrameId !== "string") {
    throw new Error(`${rootId} animation ${key} is outside its bound frame set.`);
  }
  return {
    slotId: animation.slotId,
    frame: animation.frame,
    frameSetId: binding.frameSetId,
    preparedFrameIndex,
    preparedFrameId,
  };
}

function preparedAnimationFrameCount(contract, slotId) {
  requireNonNegativeSafeInteger(slotId, "cssoccer live animation slotId");
  let counts = preparedFrameCountsByContract.get(contract);
  if (counts === undefined) {
    const framesBySlot = new Map();
    for (const key of Object.keys(contract.preparedFrameIndexBySlotFrame)) {
      const match = FRAME_LOOKUP_KEY.exec(key);
      const current = framesBySlot.get(Number(match[1])) ?? [];
      current.push(Number(match[2]));
      framesBySlot.set(Number(match[1]), current);
    }
    counts = new Map();
    for (const [preparedSlotId, frames] of framesBySlot) {
      frames.sort((left, right) => left - right);
      if (frames.some((frame, index) => frame !== index)) {
        throw new Error(`cssoccer live animation slot ${preparedSlotId} is not contiguous.`);
      }
      counts.set(preparedSlotId, frames.length);
    }
    preparedFrameCountsByContract.set(contract, counts);
  }
  const count = counts.get(slotId) ?? 0;
  if (count === 0) {
    throw new Error(`cssoccer live animation slot ${slotId} has no prepared frames.`);
  }
  return count;
}

function preparedAnimationFrameCountFromFacts(facts, slotId) {
  let count = 0;
  while (Number.isSafeInteger(facts.preparedFrameIndexBySlotFrame?.[`${slotId}:${count}`])) {
    count += 1;
  }
  return count;
}

function requireFiniteValue(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
}

function requireIntegerValue(value, label) {
  if (!Number.isSafeInteger(value)) throw new TypeError(`${label} must be an integer.`);
  return value;
}

function validateCompactFrameLookup(contract, frameSetIds) {
  requirePlainObject(
    contract.preparedFrameIndexBySlotFrame,
    "cssoccer prepared frame index lookup",
  );
  const entries = Object.entries(contract.preparedFrameIndexBySlotFrame);
  if (entries.length !== PREPARED_FRAME_COUNT) {
    throw new Error("cssoccer prepared frame lookup does not contain 2,450 entries.");
  }
  const indexes = new Set();
  for (const [key, index] of entries) {
    const match = FRAME_LOOKUP_KEY.exec(key);
    if (!match || !Number.isSafeInteger(index) || index < 0 || index >= PREPARED_FRAME_COUNT) {
      throw new Error(`cssoccer prepared frame lookup entry ${key} is invalid.`);
    }
    if (indexes.has(index)) throw new Error(`Duplicate cssoccer prepared frame index ${index}.`);
    indexes.add(index);
    const expectedId = preparedFrameId(Number(match[1]), Number(match[2]));
    for (const frameSetId of frameSetIds) {
      if (contract.frameIdsByFrameSet[frameSetId][index] !== expectedId) {
        throw new Error(`cssoccer prepared frame ${key} changed in ${frameSetId}.`);
      }
    }
  }
  if (indexes.size !== PREPARED_FRAME_COUNT) {
    throw new Error("cssoccer prepared frame indexes are not contiguous.");
  }
}

function validateCompactPlayerBindings(contract, frameSetIds) {
  if (!Array.isArray(contract.players) || contract.players.length !== PLAYER_COUNT) {
    throw new Error("cssoccer player render contract requires exactly 22 bindings.");
  }
  const roots = new Set();
  contract.players.forEach((binding, index) => {
    requirePlainObject(binding, `cssoccer player render binding ${index}`);
    requireExactKeys(binding, PLAYER_BINDING_KEYS, `cssoccer player render binding ${index}`);
    const country = index < 11 ? "spain" : "argentina";
    const expectedRoot = `${country}-player-${String((index % 11) + 1).padStart(2, "0")}`;
    const expectedModel = country === "spain" ? "player_f1" : "player_f2";
    const expectedTypes = country === "spain" ? { even: 1, odd: 2 } : { even: 2, odd: 1 };
    if (
      binding.rootId !== expectedRoot
      || !PLAYER_ID.test(binding.rootId)
      || roots.has(binding.rootId)
      || binding.country !== country
      || binding.kickoffNativePlayerNumber !== index + 1
      || binding.modelId !== expectedModel
      || !frameSetIds.includes(binding.frameSetId)
      || !SHA256.test(binding.kitBindingSha256 ?? "")
      || !sameValue(binding.nativeRenderTypeByMatchHalfParity, expectedTypes)
    ) {
      throw new Error(`cssoccer player render binding changed at ${expectedRoot}.`);
    }
    roots.add(binding.rootId);
  });
}

function validateCompactOfficialBindings(contract) {
  if (!Array.isArray(contract.officials) || contract.officials.length !== OFFICIAL_COUNT) {
    throw new Error("cssoccer render contract requires exactly three official bindings.");
  }
  const roles = ["referee", "assistant-referee", "assistant-referee"];
  const models = ["player_fr", "player_fl", "player_fl"];
  const profiles = [
    "actua-referee-material",
    "actua-assistant-referee-material",
    "actua-assistant-referee-material",
  ];
  contract.officials.forEach((binding, index) => {
    requirePlainObject(binding, `cssoccer official render binding ${index}`);
    requireExactKeys(binding, OFFICIAL_BINDING_KEYS, `cssoccer official render binding ${index}`);
    if (
      binding.rootId !== OFFICIAL_ROOT_IDS[index]
      || binding.role !== roles[index]
      || binding.modelId !== models[index]
      || binding.frameSetId !== EXACT_OFFICIAL_FRAME_SET_ID
      || binding.materialProfileId !== profiles[index]
      || binding.nativeRenderType !== (index === 0 ? 3 : 4)
    ) throw new Error(`cssoccer official render binding changed at index ${index}.`);
  });
}

function assertCommandTransform(command, index) {
  requirePlainObject(command.transform, `cssoccer player render transform ${index}`);
  requireExactKeys(
    command.transform,
    ["position", "rotation", "scale"],
    `cssoccer player render transform ${index}`,
  );
  requireFiniteVector3(command.transform.position, `cssoccer player render position ${index}`);
  requirePlainObject(command.facing, `cssoccer player render facing ${index}`);
  requireExactKeys(
    command.facing,
    ["cosine", "sine", "yawDegrees"],
    `cssoccer player render facing ${index}`,
  );
  const facing = requireFacing(command.facing, command.rootId, { allowYaw: true });
  const expectedYaw = rendererYawDegrees(facing.cosine, facing.sine);
  if (
    !Object.is(command.facing.yawDegrees, expectedYaw)
    || command.transform.scale !== 1
    || !sameNumbers(command.transform.rotation, [0, expectedYaw, 0])
  ) {
    throw new Error(`cssoccer player render transform ${index} changed facing or scale.`);
  }
}

function assertCommandAnimation(contract, command, binding, index) {
  requirePlainObject(command.animation, `cssoccer player render animation ${index}`);
  requireExactKeys(
    command.animation,
    ["frame", "frameSetId", "preparedFrameId", "preparedFrameIndex", "slotId"],
    `cssoccer player render animation ${index}`,
  );
  requireNonNegativeSafeInteger(
    command.animation.slotId,
    `cssoccer player render animation ${index} slotId`,
  );
  requireNonNegativeSafeInteger(
    command.animation.frame,
    `cssoccer player render animation ${index} frame`,
  );
  requireNonNegativeSafeInteger(
    command.animation.preparedFrameIndex,
    `cssoccer player render animation ${index} preparedFrameIndex`,
  );
  const key = `${command.animation.slotId}:${command.animation.frame}`;
  const preparedFrameIndex = contract.preparedFrameIndexBySlotFrame[key];
  if (
    command.animation.frameSetId !== binding.frameSetId
    || command.animation.preparedFrameIndex !== preparedFrameIndex
    || command.animation.preparedFrameId
      !== contract.frameIdsByFrameSet[binding.frameSetId]?.[preparedFrameIndex]
  ) {
    throw new Error(`cssoccer player render animation ${index} changed its prepared binding.`);
  }
}

function assertCommandMaterial(command, binding, matchHalf, index) {
  requirePlainObject(command.material, `cssoccer player render material ${index}`);
  requireExactKeys(
    command.material,
    ["country", "kitBindingSha256", "nativeRenderType"],
    `cssoccer player render material ${index}`,
  );
  const parity = matchHalf === 0 ? "even" : "odd";
  if (
    command.material.country !== binding.country
    || command.material.kitBindingSha256 !== binding.kitBindingSha256
    || command.material.nativeRenderType
      !== binding.nativeRenderTypeByMatchHalfParity[parity]
  ) {
    throw new Error(`cssoccer player render material ${index} changed half orientation.`);
  }
}

function requireFacing(value, rootId, { allowYaw = false } = {}) {
  requirePlainObject(value, `${rootId} renderer facing`);
  requireExactKeys(
    value,
    allowYaw ? ["cosine", "sine", "yawDegrees"] : ["cosine", "sine"],
    `${rootId} renderer facing`,
  );
  if (!Number.isFinite(value.cosine) || !Number.isFinite(value.sine)) {
    throw new TypeError(`${rootId} renderer facing must be finite.`);
  }
  if (allowYaw && !Number.isFinite(value.yawDegrees)) {
    throw new TypeError(`${rootId} renderer yaw must be finite.`);
  }
  return value;
}

function requireFiniteVector3(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((entry) => !Number.isFinite(entry))) {
    throw new TypeError(`${label} must contain three finite numbers.`);
  }
  return [...value];
}

function isFiniteVec2(value) {
  return value !== null
    && typeof value === "object"
    && Number.isFinite(value.x)
    && Number.isFinite(value.y);
}

function isFinitePosition(value) {
  return isFiniteVec2(value) && Number.isFinite(value.z);
}

function nativePlayerForHalf(kickoffNativePlayerNumber, matchHalf) {
  if (matchHalf === 0) return kickoffNativePlayerNumber;
  return kickoffNativePlayerNumber <= 11
    ? kickoffNativePlayerNumber + 11
    : kickoffNativePlayerNumber - 11;
}

function rendererYawDegrees(cosine, sine) {
  const yaw = Math.atan2(sine, cosine) * 180 / Math.PI;
  return Object.is(yaw, -0) ? 0 : yaw;
}

function preparedFrameId(slotId, frame) {
  return `mc-${String(slotId).padStart(3, "0")}-f-${String(frame).padStart(3, "0")}`;
}

function uniqueById(values, label) {
  return uniqueByKey(values, "id", label);
}

function uniqueByKey(values, key, label) {
  if (!Array.isArray(values)) throw new TypeError(`${label} must be an array.`);
  const map = new Map();
  for (const value of values) {
    requirePlainObject(value, label);
    if (typeof value[key] !== "string" || map.has(value[key])) {
      throw new Error(`${label} must have unique ${key} values.`);
    }
    map.set(value[key], value);
  }
  return map;
}

function requireMatchHalf(value) {
  if (value !== 0 && value !== 1) {
    throw new RangeError("cssoccer player render matchHalf must be 0 or 1.");
  }
}

function requireIntegerRange(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${label} must be an integer in ${min}..${max}.`);
  }
}

function requireNonNegativeSafeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer.`);
  }
}

function requireExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (!sameValue(actual, expected)) {
    throw new Error(`${label} must contain exactly ${expected.join(", ")}.`);
  }
}

function requirePlainObject(value, label) {
  if (!isPlainObject(value)) throw new TypeError(`${label} must be a plain object.`);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function sameNumbers(left, right) {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((entry, index) => Object.is(entry, right[index]));
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function freezeStaticContract(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) freezeStaticContract(nested);
  return Object.freeze(value);
}
