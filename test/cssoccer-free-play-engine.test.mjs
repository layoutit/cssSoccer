import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CSSOCCER_FREE_PLAY_ENGINE_SCHEMA,
} from "../src/cssoccer/freePlayContract.mjs";
import {
  CSSOCCER_FREE_PLAY_SOURCE_LOOP,
  createCssoccerFreePlayEngine,
} from "../src/cssoccer/freePlayEngine.mjs";
import {
  createCssoccerFreePlayRematchState,
  createCssoccerFreePlayState,
  setCssoccerFreePlayPaused,
} from "../src/cssoccer/freePlayState.mjs";
import { isCssoccerShootingRange } from "../src/cssoccer/liveShotState.mjs";
import { createCssoccerExactActuaPlayerAssetRuntime } from
  "../src/cssoccer/exactActuaPlayerAssets.mjs";
import {
  createCssoccerFreePlayRenderFrame,
  createCssoccerPlayerRenderContract,
} from "../src/cssoccer/playerRenderState.mjs";
const generatedRoot = new URL("../build/generated/public/cssoccer/", import.meta.url);
const fixture = loadPreparedFixture();
const exactPlayerAssets = createCssoccerExactActuaPlayerAssetRuntime({
  index: readJson(new URL("assets/animation/exact-player/index.json", generatedRoot)),
  materials: readJson(new URL(
    "assets/spain-argentina-exact-player-materials.json",
    generatedRoot,
  )),
  loadChunk: (descriptor) => readJson(new URL(descriptor.path, generatedRoot)),
});
const exactOfficialAssets = createCssoccerExactActuaPlayerAssetRuntime({
  index: readJson(new URL("assets/animation/exact-official/index.json", generatedRoot)),
  materials: readJson(new URL(
    "assets/spain-argentina-exact-official-materials.json",
    generatedRoot,
  )),
  loadChunk: (descriptor) => readJson(new URL(descriptor.path, generatedRoot)),
});
const renderContract = createCssoccerPlayerRenderContract({
  preparedFacts: fixture.preparedFacts,
  renderAssets: readJson(new URL("assets/spain-argentina-render-bundles.json", generatedRoot)),
  exactPlayerAssets,
  exactOfficialAssets,
});

test("free-play engine exposes only step(command) and a read-only snapshot", () => {
  const engine = createEngine();
  assert.deepEqual(Object.keys(engine), ["schema", "step", "snapshot"]);
  assert.equal(engine.schema, CSSOCCER_FREE_PLAY_ENGINE_SCHEMA);
  assert.equal("capture" in engine, false);
  assert.equal("seek" in engine, false);
  assert.equal("range" in engine, false);
  assert.equal("replay" in engine, false);
  assert.equal("nativeState" in engine, false);

  const first = engine.snapshot();
  const second = engine.snapshot();
  assert.strictEqual(first, second);
  assert.equal(first.tick, 0);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.match.players[0]), true);
  assert.throws(() => {
    first.match.tick = 99;
  }, /read only|Cannot assign/u);
  assert.equal(engine.snapshot().tick, 0);
});

test("each valid command advances one tick in pinned source order", () => {
  const engine = createEngine();
  const first = engine.step({ tick: 0, moveX: 0, moveY: 0, buttons: 0 });
  assert.equal(first.tick, 1);
  assert.equal(first.match.tick, 1);
  assert.equal(first.match.ball.ball.tick, 1);
  assert.deepEqual(first.lastStep.command, {
    tick: 0,
    moveX: 0,
    moveY: 0,
    buttons: 0,
  });
  assert.deepEqual(first.lastStep.sourceOrder, CSSOCCER_FREE_PLAY_SOURCE_LOOP);

  const second = engine.step({ tick: 1, moveX: -128, moveY: 127, buttons: 63 });
  assert.equal(second.tick, 2);
  assert.equal(second.match.ball.ball.tick, 2);
  assert.equal(
    second.lastStep.events.filter(({ type }) => type === "pending-current-state-action").length,
    0,
  );
  assert.deepEqual(second.lastStep.sourceOrder, CSSOCCER_FREE_PLAY_SOURCE_LOOP);
});

test("Spain control advances through the same opening and live engine path", () => {
  const engine = createEngine("spain");
  const initial = engine.snapshot();
  assert.equal(initial.match.control.country, "spain");
  assert.equal(initial.match.control.nativeTeamSlot, "A");

  const open = advanceToOpenPlay(engine);
  assert.equal(open.match.control.country, "spain");
  assert.ok(open.match.control.activePlayerId.startsWith("spain-player-"));
  const controlledId = open.match.control.activePlayerId;
  const stepped = engine.step({
    tick: open.tick,
    moveX: 127,
    moveY: 0,
    buttons: 0,
  });
  assert.equal(stepped.match.control.country, "spain");
  assert.ok(stepped.match.control.activePlayerId.startsWith("spain-player-"));
  assert.equal(
    stepped.match.players.find(({ id }) => id === controlledId).country,
    "spain",
  );
});

test("command ownership fails closed for missing, extra, skipped, or repeated ticks", () => {
  const engine = createEngine();
  assert.throws(
    () => engine.step({ moveX: 0, moveY: 0, buttons: 0 }),
    /must contain exactly/u,
  );
  assert.throws(
    () => engine.step({ tick: 1, moveX: 0, moveY: 0, buttons: 0 }),
    /tick must be 0/u,
  );
  assert.throws(
    () => engine.step({ tick: 0, moveX: 0, moveY: 0, buttons: 0, state: {} }),
    /must contain exactly/u,
  );
  engine.step({ tick: 0, moveX: 0, moveY: 0, buttons: 0 });
  assert.throws(
    () => engine.step({ tick: 0, moveX: 0, moveY: 0, buttons: 0 }),
    /tick must be 1/u,
  );
});

test("paused engine accepts the current command without advancing or accumulating input", () => {
  const initialState = setCssoccerFreePlayPaused(
    createCssoccerFreePlayState(fixture),
    true,
    { reason: "user" },
  );
  const engine = createCssoccerFreePlayEngine({ initialState });
  const before = engine.snapshot();
  const after = engine.step({ tick: 0, moveX: 127, moveY: -127, buttons: 63 });
  assert.strictEqual(after, before);
  assert.equal(after.tick, 0);
  assert.equal(after.match.session.pendingCommand, null);
  assert.deepEqual(after.match.players, before.match.players);
  assert.deepEqual(after.match.ball, before.match.ball);
});

test("same commands reproduce byte-identically and source interception owns free-ball movement", () => {
  const commands = [
    { tick: 0, moveX: 127, moveY: 0, buttons: 0 },
    { tick: 1, moveX: 90, moveY: -90, buttons: 2 },
    { tick: 2, moveX: 0, moveY: 0, buttons: 0 },
  ];
  const first = runCommands(createEngine(), commands);
  const second = runCommands(createEngine(), commands);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(first, second);

  const rightEngine = createEngine();
  const leftEngine = createEngine();
  advanceToOpenPlay(rightEngine);
  advanceToOpenPlay(leftEngine);
  const rightTick = rightEngine.snapshot().tick;
  const leftTick = leftEngine.snapshot().tick;
  assert.equal(rightTick, leftTick);
  const right = rightEngine.step({ tick: rightTick, moveX: 127, moveY: 0, buttons: 0 });
  const left = leftEngine.step({ tick: leftTick, moveX: -127, moveY: 0, buttons: 0 });
  assert.equal(right.match.control.activePlayerId, left.match.control.activePlayerId);
  const playerId = right.match.control.activePlayerId;
  const rightPlayer = right.match.players.find(({ id }) => id === playerId);
  const leftPlayer = left.match.players.find(({ id }) => id === playerId);
  assert.deepEqual(rightPlayer, leftPlayer);
  assert.deepEqual(rightPlayer.position, {
    x: 747.2229614257812,
    y: 430.1544189453125,
    z: 0,
  });
  assert.deepEqual(rightPlayer.facing, {
    x: -0.9146021008491516,
    y: -0.4043550491333008,
  });
  assert.deepEqual(rightPlayer.target, {
    x: 705.6631469726562,
    y: 411.7803955078125,
    z: 0,
  });
  assert.deepEqual(rightPlayer.intelligence, { special: 0, move: 1, count: 10 });
  assert.equal(rightPlayer.ballState, 7);
  assert.deepEqual(right.match.control.lastCommand, {
    tick: rightTick,
    moveX: 127,
    moveY: 0,
    buttons: 0,
  });
  assert.deepEqual(left.match.control.lastCommand, {
    tick: leftTick,
    moveX: -127,
    moveY: 0,
    buttons: 0,
  });
});

test("free-ball intelligence has no user-movement fallback before contact", () => {
  const engine = createEngine();
  const open = advanceToOpenPlay(engine);
  const playerId = open.match.control.activePlayerId;
  const before = open.match.players.find(({ id }) => id === playerId);
  const moved = engine.step({ tick: open.tick, moveX: 127, moveY: 0, buttons: 63 });
  const after = moved.match.players.find(({ id }) => id === playerId);
  assert.notDeepEqual(after.position, before.position);
  assert.deepEqual(after.position, {
    x: 747.2229614257812,
    y: 430.1544189453125,
    z: 0,
  });
  assert.deepEqual(after.target, {
    x: 705.6631469726562,
    y: 411.7803955078125,
    z: 0,
  });
  assert.deepEqual(after.intelligence, { special: 0, move: 1, count: 10 });
  assert.equal(after.action.action.value, 1);
  assert.deepEqual(moved.match.control.lastCommand, {
    tick: open.tick,
    moveX: 127,
    moveY: 0,
    buttons: 63,
  });
  assert.equal(
    moved.lastStep.events.filter(({ type }) => type === "pending-current-state-action").length,
    0,
  );

  const held = engine.step({ tick: moved.tick, moveX: 0, moveY: 0, buttons: 0 });
  const continued = held.match.players.find(({ id }) => id === playerId);
  assert.notDeepEqual(continued.position, after.position);
  assert.deepEqual(continued.target, after.target);
  assert.deepEqual(continued.intelligence, { special: 0, move: 1, count: 9 });
  assert.equal(continued.action.action.value, 1);
  assert.equal(held.match.control.activePlayerId, playerId);
});

test("source-order collection, user stop, and held-ball prepass stay exact", () => {
  const engine = createEngine();
  advanceToOpenPlay(engine);
  for (const tick of [179, 180]) {
    engine.step({ tick, moveX: 0, moveY: 0, buttons: 0 });
  }
  const collected = engine.step({ tick: 181, moveX: 0, moveY: 0, buttons: 0 });
  assert.equal(collected.match.possession.owner, 10);
  assert.equal(collected.match.possession.lastTouch, 10);
  assert.equal(collected.match.rng.state.randSeed, 31716);
  assert.deepEqual(collected.match.ball.ball.position, {
    x: 659.4585571289062,
    y: 402.7303466796875,
    z: 2,
  });
  const holder = collected.match.players.find(({ id }) => id === "spain-player-10");
  assert.deepEqual(holder.position, {
    x: 664.3187866210938,
    y: 409.1665954589844,
    z: 0,
  });
  assert.deepEqual(holder.facing, {
    x: -0.3265182077884674,
    y: -0.9451909065246582,
  });
  const stopped = collected.match.players.find(({ id }) => id === "argentina-player-10");
  assert.deepEqual(stopped.position, {
    x: 740.4689331054688,
    y: 427.1684265136719,
    z: 0,
  });
  assert.deepEqual(stopped.facing, {
    x: -0.9573861956596375,
    y: -0.2888109087944031,
  });
  assert.equal(stopped.action.action.value, 0);

  const held = engine.step({ tick: 182, moveX: 0, moveY: 0, buttons: 0 });
  assert.equal(held.match.ball.ball.position.x, 661.3427124023438);
  assert.equal(held.match.ball.ball.position.y, 400.55157470703125);
  const earlyKeeper = held.match.players.find(({ id }) => id === "argentina-player-01");
  assert.deepEqual(earlyKeeper.facing, {
    x: -0.9999809265136719,
    y: 0.006170421373099089,
  });
});

test("current-state AI pass release, receiver interception, and collection stay exact", () => {
  const engine = createEngine();
  while (engine.snapshot().tick < 207) {
    const tick = engine.snapshot().tick;
    engine.step({ tick, moveX: 0, moveY: 0, buttons: 0 });
  }
  const released = engine.snapshot();
  assert.equal(released.match.possession.owner, 0);
  assert.deepEqual(released.match.ball.ball.displacement, {
    x: -6.716245651245117,
    y: -0.9033358097076416,
    z: 0,
  });
  assert.deepEqual(
    released.lastStep.events.filter(({ type }) => type.endsWith("pass-released")),
    [{
      type: "ground-pass-released",
      tick: 207,
      playerId: "spain-player-10",
      receiverId: "spain-player-07",
    }],
  );
  assert.deepEqual(
    released.lastStep.events.filter(({ type }) => type === "offside-kick-snapshotted"),
    [{
      type: "offside-kick-snapshotted",
      tick: 207,
      playerId: "spain-player-10",
      nativePlayerNumber: 10,
      defenderLine: 953.4586791992188,
      candidateIds: [],
    }],
  );
  assert.equal(released.match.rules.liveOffside, null);

  const intercepting = engine.step({
    tick: released.tick,
    moveX: 0,
    moveY: 0,
    buttons: 0,
  });
  const receiver = intercepting.match.players.find(({ id }) => id === "spain-player-07");
  assert.deepEqual(receiver.position, {
    x: 654.3441162109375,
    y: 410.9638671875,
    z: 0,
  });
  assert.equal(receiver.action.action.value, 1);
  assert.equal(receiver.animation.id, 72);
  assert.deepEqual(receiver.intelligence, { special: 0, move: 1, count: 15 });
  assert.equal(receiver.ballState, 10);
  assert.equal(intercepting.match.rng.state.randSeed, 12038);
  assert.equal(intercepting.match.rng.state.seed, 6);

  let collected = intercepting;
  while (collected.tick < 212) {
    collected = engine.step({
      tick: collected.tick,
      moveX: 0,
      moveY: 0,
      buttons: 0,
    });
  }
  assert.equal(collected.match.possession.owner, 7);
  assert.deepEqual(
    collected.match.possession.players
      .filter(({ possession }) => possession > 0)
      .map(({ nativePlayer }) => nativePlayer),
    [7],
  );
  assert.ok(collected.lastStep.events.some(({ type, playerId }) => (
    type === "ball-collected" && playerId === "spain-player-07"
  )));
});

test("Argentina Fire 2 starts a live current-geometry pass and keeps its kick busy", () => {
  const engine = createEngine();
  for (let attempts = 0; attempts < 600; attempts += 1) {
    const snapshot = engine.snapshot();
    const active = snapshot.match.players.find(
      ({ id }) => id === snapshot.match.control.activePlayerId,
    );
    if (
      snapshot.tick >= 200
      && active !== undefined
      && snapshot.match.possession.owner === active.nativePlayerNumber
      && active.action.action.value <= 1
      && active.livePass === undefined
      && active.liveShot === undefined
      && active.liveContact === undefined
    ) break;
    const ball = snapshot.match.ball.ball.position;
    const moveX = active === undefined
      ? 0
      : Math.max(-127, Math.min(127, Math.round(ball.x - active.position.x)));
    const moveY = active === undefined
      ? 0
      : Math.max(-127, Math.min(127, Math.round(ball.y - active.position.y)));
    engine.step({ tick: snapshot.tick, moveX, moveY, buttons: 0 });
  }
  const possession = engine.snapshot();
  const active = possession.match.players.find(({ id }) => (
    id === possession.match.control.activePlayerId
  ));
  assert.equal(possession.match.possession.owner, active.nativePlayerNumber);
  assert.equal(active.country, "argentina");
  const ball = possession.match.ball.ball.position;
  const launched = engine.step({
    tick: possession.tick,
    moveX: Math.round(ball.x - active.position.x),
    moveY: Math.round(ball.y - active.position.y),
    buttons: 2,
  });
  const passer = launched.match.players.find(({ id }) => id === active.id);
  assert.equal(passer.action.action.value, 15);
  assert.equal(passer.livePass.phase, "kick-held");
  assert.ok(passer.livePass.targetNativePlayer > 11);
  assert.notEqual(passer.livePass.targetNativePlayer, active.nativePlayerNumber);
  assert.ok(Number.isSafeInteger(passer.livePass.passType));
  assert.equal(passer.livePass.cross, false);
  assert.equal(passer.livePass.directed, false);
  assert.ok(launched.lastStep.events.some(({ type }) => type === "local-pass-started"));
  assert.equal(
    launched.lastStep.events.some(({ type, action }) => (
      type === "pending-current-state-action" && action === "fire-2"
    )),
    false,
  );

  const busy = engine.step({
    tick: launched.tick,
    moveX: 127,
    moveY: 0,
    buttons: 2,
  });
  const stillKicking = busy.match.players.find(({ id }) => id === active.id);
  assert.equal(stillKicking.action.action.value, 15);
  assert.equal(stillKicking.livePass.phase, "kick-held");
  assert.ok(busy.lastStep.events.some(({ type }) => type === "local-pass-active"));
});

test("live tackle and steal pressure resolve once, turn possession over, and recover", () => {
  const engine = createEngine();
  stepNeutralTo(engine, 190);
  const before = engine.snapshot();
  const challenger = before.match.players.find(({ id }) => (
    id === before.match.control.activePlayerId
  ));
  const owner = before.match.players.find(({ nativePlayerNumber }) => (
    nativePlayerNumber === before.match.possession.owner
  ));
  assert.equal(challenger.country, "argentina");
  assert.equal(owner.country, "spain");
  const started = engine.step({
    tick: before.tick,
    moveX: Math.round(owner.position.x - challenger.position.x),
    moveY: Math.round(owner.position.y - challenger.position.y),
    buttons: 1,
  });
  const launched = started.match.players.find(({ id }) => id === challenger.id);
  assert.equal(launched.action.action.value, 3);
  assert.equal(launched.animation.id, 85);
  assert.equal(launched.liveContact.phase, "tackle");
  assert.ok(started.lastStep.events.some(({ type }) => type === "local-tackle-started"));

  const contactEvents = [];
  let afterContact = started;
  for (let attempts = 0; attempts < 30; attempts += 1) {
    afterContact = engine.step({
      tick: afterContact.tick,
      moveX: 0,
      moveY: 0,
      buttons: 0,
    });
    contactEvents.push(...afterContact.lastStep.events);
    if (contactEvents.some(({ reason }) => reason === "fall-interruption")) break;
  }
  assert.equal(
    contactEvents.filter(({ reason, nativePlayer }) => (
      reason === "fall-interruption" && nativePlayer === owner.nativePlayerNumber
    )).length,
    1,
  );
  assert.equal(afterContact.match.possession.owner, 0);
  assert.equal(
    afterContact.match.possession.players.filter(({ possession }) => possession > 0).length,
    0,
  );
  const fallen = afterContact.match.players.find(({ id }) => id === owner.id);
  assert.equal(fallen.action.action.value, 5);
  assert.equal(fallen.animation.id, 90);
  assert.equal(fallen.liveContact.phase, "fall");
  assert.equal(fallen.injury.tick, afterContact.tick);
  assert.ok(contactEvents.some(({ type, fouler, fallenPlayer }) => (
    type === "foul-candidate"
      && fouler === challenger.nativePlayerNumber
      && fallenPlayer === owner.nativePlayerNumber
  )));
  const foulDecision = contactEvents.find(({ type }) => type === "foul-decision");
  assert.equal(foulDecision.status, "restart-required");
  assert.equal(afterContact.match.rules.foulRestart.descriptor.kind, "direct");
  assert.equal(afterContact.match.rules.foulRestart.releaseCount, 0);
  assert.equal(
    afterContact.match.rules.state.discipline.players.find(
      ({ id }) => id === challenger.id,
    ).tmFouls,
    3,
  );
  assert.equal(afterContact.match.score.totalGoals, 0);

  for (let attempts = 0; attempts < 90; attempts += 1) {
    const snapshot = engine.snapshot();
    if (snapshot.match.players.every(({ liveContact }) => liveContact === undefined)) break;
    engine.step({ tick: snapshot.tick, moveX: 0, moveY: 0, buttons: 0 });
  }
  assert.equal(
    engine.snapshot().match.players.find(({ id }) => id === challenger.id).liveContact,
    undefined,
  );
  assert.equal(
    engine.snapshot().match.players.find(({ id }) => id === owner.id).liveContact,
    undefined,
  );
  const foulReleaseEvents = [];
  for (let attempts = 0; attempts < 240; attempts += 1) {
    const snapshot = engine.snapshot();
    if (snapshot.match.rules.lastFoulRestart !== undefined) break;
    const stepped = engine.step({
      tick: snapshot.tick,
      moveX: 0,
      moveY: 0,
      buttons: 0,
    });
    foulReleaseEvents.push(...stepped.lastStep.events.filter(({ type }) => (
      type.endsWith("-restart-released")
    )));
  }
  const foulRestart = engine.snapshot().match.rules.lastFoulRestart;
  assert.equal(foulRestart.kind, "direct");
  assert.equal(foulRestart.mode, "DF_KICK_A");
  assert.equal(foulRestart.nativeTeamSlot, "A");
  assert.equal(foulRestart.releaseCount, 1);
  assert.equal(foulReleaseEvents.length, 1);
  assert.equal(engine.snapshot().match.rules.foulRestart, null);
  assert.equal(engine.snapshot().match.kickoff.phase, "open-play");
  assert.equal(engine.snapshot().match.score.totalGoals, 0);

  const rejectedEngine = createEngine();
  stepNeutralTo(rejectedEngine, 190);
  const rejection = rejectedEngine.snapshot();
  const rejectedPlayer = rejection.match.players.find(({ id }) => (
    id === rejection.match.control.activePlayerId
  ));
  const rejected = rejectedEngine.step({
    tick: rejection.tick,
    moveX: Math.round(-rejectedPlayer.facing.x * 127),
    moveY: Math.round(-rejectedPlayer.facing.y * 127),
    buttons: 1,
  });
  assert.ok(rejected.lastStep.events.some(({ type }) => type === "local-tackle-rejected"));
  assert.equal(
    rejected.match.players.find(({ id }) => id === rejectedPlayer.id).liveContact,
    undefined,
  );

  const stealEngine = createEngine();
  stepNeutralTo(stealEngine, 180);
  let stealReady = null;
  for (let attempts = 0; attempts < 80; attempts += 1) {
    const snapshot = stealEngine.snapshot();
    const active = snapshot.match.players.find(({ id }) => (
      id === snapshot.match.control.activePlayerId
    ));
    const currentOwner = snapshot.match.players.find(({ nativePlayerNumber }) => (
      nativePlayerNumber === snapshot.match.possession.owner
    ));
    const ball = snapshot.match.ball.ball.position;
    const distance = Math.hypot(ball.x - active.position.x, ball.y - active.position.y);
    if (
      currentOwner?.country === "spain"
      && active.action.action.value <= 1
      && distance < 12
    ) {
      stealReady = snapshot;
      break;
    }
    stealEngine.step({
      tick: snapshot.tick,
      moveX: Math.max(-127, Math.min(127, Math.round(ball.x - active.position.x))),
      moveY: Math.max(-127, Math.min(127, Math.round(ball.y - active.position.y))),
      buttons: 0,
    });
  }
  assert.ok(stealReady, "current approach must reach the close-steal range");
  const stealStarted = stealEngine.step({
    tick: stealReady.tick,
    moveX: 0,
    moveY: 0,
    buttons: 2,
  });
  const stealing = stealStarted.match.players.find(({ id }) => (
    id === stealReady.match.control.activePlayerId
  ));
  assert.equal(stealing.action.action.value, 15);
  assert.equal(stealing.animation.id, 86);
  assert.equal(stealing.liveContact.phase, "steal");
  assert.ok(stealStarted.lastStep.events.some(({ type }) => type === "local-steal-started"));
  for (let attempts = 0; attempts < 12; attempts += 1) {
    const snapshot = stealEngine.snapshot();
    stealEngine.step({ tick: snapshot.tick, moveX: 0, moveY: 0, buttons: 0 });
  }
  assert.equal(
    stealEngine.snapshot().match.players.find(({ id }) => id === stealing.id).liveContact,
    undefined,
  );

  const pressured = createEngine();
  let argentinaReleased = null;
  for (let attempts = 0; attempts < 420 && argentinaReleased === null; attempts += 1) {
    const snapshot = pressured.snapshot();
    const active = snapshot.match.players.find(({ id }) => (
      id === snapshot.match.control.activePlayerId
    ));
    const ball = snapshot.match.ball.ball.position;
    const stepped = pressured.step({
      tick: snapshot.tick,
      moveX: active === undefined
        ? 0
        : Math.max(-127, Math.min(127, Math.round(ball.x - active.position.x))),
      moveY: active === undefined
        ? 0
        : Math.max(-127, Math.min(127, Math.round(ball.y - active.position.y))),
      buttons: 0,
    });
    assert.ok(
      stepped.match.possession.players.filter(({ possession }) => possession > 0).length <= 1,
    );
    if (stepped.lastStep.events.some(({ reason, nativePlayer }) => (
      reason === "fall-interruption" && nativePlayer > 11
    ))) argentinaReleased = stepped;
  }
  assert.ok(argentinaReleased, "current AI pressure must be able to dispossess Argentina");
  assert.equal(argentinaReleased.match.possession.owner, 0);
});

test("Argentina live shot reaches a current keeper catch and hands punt", () => {
  const engine = createEngine();
  while (engine.snapshot().tick < 200) {
    const snapshot = engine.snapshot();
    const active = snapshot.match.players.find(
      ({ id }) => id === snapshot.match.control.activePlayerId,
    );
    const ball = snapshot.match.ball.ball.position;
    engine.step({
      tick: snapshot.tick,
      moveX: active === undefined
        ? 0
        : Math.max(-127, Math.min(127, Math.round(ball.x - active.position.x))),
      moveY: active === undefined
        ? 0
        : Math.max(-127, Math.min(127, Math.round(ball.y - active.position.y))),
      buttons: 0,
    });
  }
  let shotReady = null;
  for (let attempts = 0; attempts < 800; attempts += 1) {
    const snapshot = engine.snapshot();
    const active = snapshot.match.players.find(({ id }) => (
      id === snapshot.match.control.activePlayerId
    ));
    const ball = snapshot.match.ball.ball.position;
    if (
      active !== undefined
      && snapshot.match.possession.owner === active.nativePlayerNumber
      && active.action.action.value <= 1
      && active.livePass === undefined
      && active.liveShot === undefined
      && active.liveContact === undefined
      && Math.abs(ball.y - 400) < 20
      && isCssoccerShootingRange({
        accuracy: active.gameplay.accuracy,
        control: active.gameplay.control,
        facing: active.facing,
        flair: active.gameplay.flair,
        nativePlayerNumber: active.nativePlayerNumber,
        position: active.position,
        power: active.gameplay.power,
      }, ball)
    ) {
      shotReady = snapshot;
      break;
    }
    const ownsBall = active !== undefined
      && snapshot.match.possession.owner === active.nativePlayerNumber;
    engine.step({
      tick: snapshot.tick,
      moveX: active === undefined
        ? 0
        : ownsBall
          ? -127
          : Math.max(-127, Math.min(127, Math.round(ball.x - active.position.x))),
      moveY: active === undefined
        ? 0
        : ownsBall
          ? Math.max(-127, Math.min(127, Math.round(400 - active.position.y)))
          : Math.max(-127, Math.min(127, Math.round(ball.y - active.position.y))),
      buttons: 0,
    });
  }
  assert.ok(shotReady, "Argentina must reach a current live shooting state");
  const possession = shotReady;
  assert.ok(possession.match.possession.owner > 11);
  const started = engine.step({
    tick: possession.tick,
    moveX: -127,
    moveY: Math.max(-127, Math.min(
      127,
      Math.round(400 - possession.match.ball.ball.position.y),
    )),
    buttons: 1,
  });
  assert.ok(started.lastStep.events.some(({ type }) => type === "local-shot-started"));
  assert.equal(started.lastStep.events.some(({ type, action }) => (
    type === "pending-current-state-action" && action === "fire-1"
  )), false);

  let caught = null;
  let punted = null;
  for (let attempts = 0; attempts < 70 && punted === null; attempts += 1) {
    const before = engine.snapshot();
    const after = engine.step({
      tick: before.tick,
      moveX: -127,
      moveY: 0,
      buttons: 0,
    });
    if (after.lastStep.events.some(({ type }) => type === "keeper-save-catch")) {
      caught = after;
    }
    if (after.lastStep.events.some(({ type }) => type === "keeper-punt-released")) {
      punted = after;
    }
  }
  assert.ok(caught, "current trajectory must reach a keeper catch");
  assert.equal(caught.match.possession.owner, 1);
  assert.equal(caught.match.possession.inHands, 1);
  assert.ok(punted, "keeper hold must redistribute from current hands state");
  assert.equal(punted.match.possession.owner, 0);
  assert.equal(punted.match.possession.inHands, 0);
  assert.equal(punted.match.ball.ball.displacement.z, 12);
});

test("a changed live shot scores once, celebrates, respots, and launches the conceding centre", () => {
  const scoringEngine = createEngine();
  const shotReady = advanceArgentinaToShootingState(scoringEngine);
  let current = scoringEngine.step({
    tick: shotReady.tick,
    moveX: -127,
    moveY: 0,
    buttons: 1,
  });
  let scored = null;
  const goalEvents = [];
  for (let attempts = 0; attempts < 100 && scored === null; attempts += 1) {
    current = scoringEngine.step({
      tick: current.tick,
      moveX: -127,
      moveY: 0,
      buttons: 0,
    });
    goalEvents.push(...current.lastStep.events.filter(({ type }) => type === "goal-awarded"));
    if (current.match.score.totalGoals === 1) scored = current;
  }
  assert.ok(scored, "the centre-directed current shot must cross the live left goal plane");
  assert.deepEqual(scored.match.score.goals, { spain: 0, argentina: 1 });
  assert.equal(scored.match.goal.phase, "celebration");
  assert.equal(scored.match.goal.justScored, 220);
  assert.equal(scored.match.goal.activeGoal.goalLine, "left");
  assert.equal(scored.match.goal.activeGoal.scorer.playerId, "argentina-player-10");
  assert.equal(scored.match.possession.owner, 0);
  assert.equal(scored.match.clock.running, false);
  const clockAtGoal = {
    gameMinute: scored.match.clock.gameMinute,
    gameSecond: scored.match.clock.gameSecond,
  };
  const scorer = scored.match.players.find(({ id }) => (
    id === scored.match.goal.activeGoal.scorer.playerId
  ));
  assert.equal(scorer.action.action.value, 16);
  assert.equal(scorer.liveCelebration.goalSequence, 1);
  const scoredFrame = createCssoccerFreePlayRenderFrame(renderContract, {
    snapshot: scored,
  });
  assert.deepEqual(scoredFrame.camera.goalScorer, {
    nativePlayerNumber: scorer.nativePlayerNumber,
    position: scorer.position,
    displacement: {
      x: scorer.velocity.x,
      y: scorer.velocity.y,
    },
  });

  let centre = null;
  for (let attempts = 0; attempts < 300 && centre === null; attempts += 1) {
    current = scoringEngine.step({
      tick: current.tick,
      moveX: 0,
      moveY: 0,
      buttons: 0,
    });
    goalEvents.push(...current.lastStep.events.filter(({ type }) => type === "goal-awarded"));
    if (current.lastStep.events.some(({ type }) => type === "centre-restart-initialized")) {
      centre = current;
    }
  }
  assert.ok(centre, "the completed score wait must create a current centre restart");
  assert.equal(goalEvents.length, 1, "one goal-plane crossing may award exactly one score");
  assert.deepEqual(centre.match.score.goals, { spain: 0, argentina: 1 });
  assert.equal(centre.match.goal.phase, "normal-play");
  assert.equal(centre.match.kickoff.phase, "centre-positioning");
  assert.equal(centre.match.kickoff.restartKind, "post-goal");
  assert.deepEqual(
    {
      country: centre.match.kickoff.owner.country,
      nativeTeamSlot: centre.match.kickoff.owner.nativeTeamSlot,
      takerId: centre.match.kickoff.owner.takerId,
      receiverId: centre.match.kickoff.owner.receiverId,
    },
    {
      country: "spain",
      nativeTeamSlot: "A",
      takerId: "spain-player-07",
      receiverId: "spain-player-10",
    },
  );
  assert.deepEqual(centre.match.ball.ball.position, { x: 640, y: 400, z: 2 });
  assert.equal(centre.match.ball.outcome, null);
  assert.equal(centre.match.possession.owner, 0);
  assert.deepEqual(
    {
      gameMinute: centre.match.clock.gameMinute,
      gameSecond: centre.match.clock.gameSecond,
    },
    clockAtGoal,
  );
  assert.deepEqual(
    {
      matchMode: centre.match.rules.matchMode,
      gameAction: centre.match.rules.gameAction,
      setPiece: centre.match.rules.setPiece,
      deadBallCount: centre.match.rules.deadBallCount,
    },
    { matchMode: 5, gameAction: 1, setPiece: 3, deadBallCount: 40 },
  );

  let relaunched = null;
  for (let attempts = 0; attempts < 300 && relaunched === null; attempts += 1) {
    current = scoringEngine.step({
      tick: current.tick,
      moveX: 0,
      moveY: 0,
      buttons: 0,
    });
    if (current.lastStep.events.some(({ type }) => type === "centre-pass-released")) {
      relaunched = current;
    }
  }
  assert.ok(relaunched, "current player positioning must release the awarded centre pass");
  assert.equal(relaunched.match.kickoff.phase, "open-play");
  assert.equal(relaunched.match.clock.running, true);
  assert.deepEqual(relaunched.match.score.goals, { spain: 0, argentina: 1 });

  const rematch = createCssoccerFreePlayRematchState(relaunched.match, fixture);
  assert.deepEqual(rematch.score.goals, { spain: 0, argentina: 0 });
  assert.equal(rematch.goal.goalSequence, 0);
  assert.equal(rematch.session.rematchIndex, 1);

  const wideEngine = createEngine();
  const wideReady = advanceArgentinaToShootingState(wideEngine);
  let wide = wideEngine.step({
    tick: wideReady.tick,
    moveX: -127,
    moveY: -50,
    buttons: 1,
  });
  for (let attempts = 0; attempts < 70 && wide.match.ball.outcome === null; attempts += 1) {
    wide = wideEngine.step({
      tick: wide.tick,
      moveX: -127,
      moveY: -50,
      buttons: 0,
    });
  }
  assert.equal(wide.match.ball.outcome?.kind, "boundary");
  assert.deepEqual(wide.match.score.goals, { spain: 0, argentina: 0 });
  assert.equal(
    wide.lastStep.events.some(({ type }) => type === "goal-awarded"),
    false,
  );

  let restartInitialized = null;
  let restartReleased = null;
  const restartEvents = [];
  for (let attempts = 0; attempts < 1_200 && restartReleased === null; attempts += 1) {
    const boundary = wide.match.rules.boundary;
    const descriptor = boundary?.descriptor;
    const userDecision = boundary?.phase === "decision"
      && descriptor?.awardedNativeTeam === wide.match.control.nativeTeamSlot;
    const topThrow = descriptor?.boundary?.boundary === "top-touchline";
    wide = wideEngine.step({
      tick: wide.tick,
      moveX: userDecision
        ? descriptor.awardedNativeTeam === "A" ? 127 : -127
        : 0,
      moveY: userDecision && descriptor.kind === "throw-in"
        ? topThrow ? 127 : -127
        : 0,
      buttons: userDecision ? 1 : 0,
    });
    restartEvents.push(...wide.lastStep.events);
    if (wide.lastStep.events.some(({ type }) => type === "boundary-restart-initialized")) {
      restartInitialized = wide;
    }
    if (wide.lastStep.events.some(({ type }) => (
      type === "corner-released"
      || type === "goal-kick-released"
      || type === "throw-in-released"
    ))) {
      restartReleased = wide;
    }
  }
  assert.ok(restartInitialized, "the live boundary countdown must initialize one current restart");
  assert.ok(restartReleased, "the current taker must legally relaunch the boundary restart");
  assert.equal(
    restartEvents.filter(({ type }) => type === "boundary-restart-initialized").length,
    1,
  );
  assert.equal(
    restartEvents.filter(({ type }) => (
      type === "corner-released"
      || type === "goal-kick-released"
      || type === "throw-in-released"
    )).length,
    1,
  );
  assert.equal(restartReleased.match.kickoff.phase, "open-play");
  assert.equal(restartReleased.match.ball.outcome, null);
  assert.equal(restartReleased.match.rules.boundary, null);
  assert.equal(restartReleased.match.rules.lastBoundaryRestart.releaseCount, 1);
});

test("engine module has no replay, retained-artifact, or oracle dependency", () => {
  const source = readFileSync(
    new URL("../src/cssoccer/freePlayEngine.mjs", import.meta.url),
    "utf8",
  );
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/gu)]
    .map((match) => match[1]);
  assert.ok(imports.every((specifier) => specifier.startsWith("./")));
  assert.ok(imports.every((specifier) => (
    !/browserMatchEngine|oracle|capture|prepare|\.local/u.test(specifier)
  )));
  assert.doesNotMatch(source, /sourceInputAtTick|preparedFacts\.input|driveMode/u);
});

function createEngine(controlCountry = "argentina") {
  return createCssoccerFreePlayEngine({
    initialState: createCssoccerFreePlayState({ ...fixture, controlCountry }),
  });
}

function runCommands(engine, commands) {
  let snapshot = engine.snapshot();
  for (const command of commands) snapshot = engine.step(command);
  return snapshot;
}

function stepNeutralTo(engine, tick) {
  while (engine.snapshot().tick < tick) {
    const snapshot = engine.snapshot();
    engine.step({ tick: snapshot.tick, moveX: 0, moveY: 0, buttons: 0 });
  }
  return engine.snapshot();
}

function advanceToOpenPlay(engine) {
  for (let attempts = 0; attempts < 400; attempts += 1) {
    if (engine.snapshot().match.kickoff.phase === "open-play") return engine.snapshot();
    const tick = engine.snapshot().tick;
    engine.step({ tick, moveX: 0, moveY: 0, buttons: 0 });
  }
  throw new Error("Free-play engine did not reach open play.");
}

function advanceArgentinaToShootingState(engine) {
  while (engine.snapshot().tick < 200) {
    const snapshot = engine.snapshot();
    const active = snapshot.match.players.find(
      ({ id }) => id === snapshot.match.control.activePlayerId,
    );
    const ball = snapshot.match.ball.ball.position;
    engine.step({
      tick: snapshot.tick,
      moveX: active === undefined
        ? 0
        : Math.max(-127, Math.min(127, Math.round(ball.x - active.position.x))),
      moveY: active === undefined
        ? 0
        : Math.max(-127, Math.min(127, Math.round(ball.y - active.position.y))),
      buttons: 0,
    });
  }
  for (let attempts = 0; attempts < 800; attempts += 1) {
    const snapshot = engine.snapshot();
    const active = snapshot.match.players.find(({ id }) => (
      id === snapshot.match.control.activePlayerId
    ));
    const ball = snapshot.match.ball.ball.position;
    if (
      active !== undefined
      && snapshot.match.possession.owner === active.nativePlayerNumber
      && active.action.action.value <= 1
      && active.livePass === undefined
      && active.liveShot === undefined
      && active.liveContact === undefined
      && Math.abs(ball.y - 400) < 20
      && isCssoccerShootingRange({
        accuracy: active.gameplay.accuracy,
        control: active.gameplay.control,
        facing: active.facing,
        flair: active.gameplay.flair,
        nativePlayerNumber: active.nativePlayerNumber,
        position: active.position,
        power: active.gameplay.power,
      }, ball)
    ) return snapshot;
    const ownsBall = active !== undefined
      && snapshot.match.possession.owner === active.nativePlayerNumber;
    engine.step({
      tick: snapshot.tick,
      moveX: active === undefined
        ? 0
        : ownsBall
          ? -127
          : Math.max(-127, Math.min(127, Math.round(ball.x - active.position.x))),
      moveY: active === undefined
        ? 0
        : ownsBall
          ? Math.max(-127, Math.min(127, Math.round(400 - active.position.y)))
          : Math.max(-127, Math.min(127, Math.round(ball.y - active.position.y))),
      buttons: 0,
    });
  }
  throw new Error("Argentina did not reach a current live shooting state.");
}

function loadPreparedFixture() {
  return {
    preparedFacts: readJson(new URL("facts/spain-argentina-full-match.json", generatedRoot)),
    preparedScene: readJson(new URL("scenes/spain-argentina-full-match.json", generatedRoot)),
  };
}

function readJson(url) {
  return JSON.parse(readFileSync(url, "utf8"));
}
