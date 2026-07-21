import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import test from "node:test";

import { parseCssoccerAnimationTable } from "../src/prepare/cssoccer/animationTable.mjs";
import { parseCssoccerFixtureTeams } from "../src/prepare/cssoccer/teamParser.mjs";
import {
  createCssoccerTeamState,
  resetCssoccerTeamState,
  swapCssoccerTeamEnds,
} from "../src/cssoccer/teamState.mjs";

const sourceRoot = new URL("../.local/actua-soccer/source/", import.meta.url);
const retainedRoot = new URL(
  "../.local/cssoccer/oracle/native/retained/runs/canonical-a/",
  import.meta.url,
);
const stateUrl = new URL("state.jsonl", retainedRoot);
const phaseMarkersUrl = new URL("phase-markers.json", retainedRoot);
const requiredFiles = [
  ...[
    "FILES.C",
    "DEFINES.H",
    "FOOT.EXE",
    "DATA.H",
    "ACTIONS.CPP",
    "DATA.OBJ",
    "3DENG.C",
    "EUROREND.DAT",
    "EUROREND.OFF",
    "FOOTBALL.CPP",
    "GAMEDATA.CPP",
    "RULES.CPP",
  ].map((file) => new URL(file, sourceRoot)),
  stateUrl,
  phaseMarkersUrl,
];
const missingFiles = requiredFiles.filter((file) => !existsSync(file));
const evidenceTestOptions = {
  skip: missingFiles.length > 0
    ? `ignored fixed-fixture evidence is unavailable: ${missingFiles.map(({ pathname }) => pathname).join(", ")}`
    : false,
};

const NATIVE_RAW_SHA256 = "1b46cb63a708d6af237d3af91d6c5846bc456e93ef6b5d731a1d36cbcaffabdb";
const NATIVE_STATE_SHA256 = "eb858bed9ad9d36670e97a98ea49235d8009246ded16e00dcb54c5dc1aef2fdd";
const FIELD_CONTRACT_SHA256 = "6d21511c288f9553628079ffeaa4a6538d4eb1a8e4b36acb4f1d0c44de42a76e";

let fixturePromise;

test("prepared team state retains 22 exact independent starters for either country choice", evidenceTestOptions, async () => {
  const fixture = await preparedFixture();
  const spain = createCssoccerTeamState({
    ...fixture,
    selectedCountry: "spain",
  });
  const argentina = createCssoccerTeamState({
    ...fixture,
    selectedCountry: "argentina",
  });

  assert.equal(spain.fixtureId, "spain-argentina-full-match");
  assert.equal(spain.players.length, 22);
  assert.equal(new Set(spain.players.map(({ id }) => id)).size, 22);
  assert.deepEqual(spain.teams, argentina.teams);
  assert.deepEqual(spain.players, argentina.players);
  assert.deepEqual(spain.bindings, argentina.bindings);
  assert.deepEqual(
    spain.players.map(({ identity }) => identity),
    fixture.preparedFacts.teams.starters.map((starter) => ({
      id: starter.id,
      country: starter.id.startsWith("spain-") ? "spain" : "argentina",
      name: starter.name,
      sourceRosterIndex: starter.sourceRosterIndex,
      kickoffNativeRuntimeIndex: starter.nativeRuntimeIndex,
      nativeRendererIndex: starter.nativeRendererIndex,
      goalIndex: starter.goalIndex,
      attributes: starter.attributes,
      flags: starter.flags,
      squadNumber: starter.squadNumber,
      position: starter.position,
      skinTone: starter.skinTone,
      sourceRecordByteRange: starter.sourceRecordByteRange,
      sourceRecordSha256: starter.sourceRecordSha256,
    })),
  );
  const preparedRoots = new Map(
    fixture.preparedScene.roots.players.map((root) => [root.id, root]),
  );
  const preparedMeshes = new Map(
    fixture.preparedScene.meshes.map((mesh) => [mesh.id, mesh]),
  );
  for (const player of spain.players) {
    const root = preparedRoots.get(player.id);
    const mesh = preparedMeshes.get(player.id);
    assert.deepEqual(player.formation.kickoff.sourceValues, root.initialBinding.sourceValues);
    assert.deepEqual(player.formation.kickoff.renderer.transform, mesh.transform);
    assert.equal(mesh.initialFrameIndex, null);
    assert.equal(
      player.formation.kickoff.renderer.initialFrameIndex,
      root.initialBinding.animation.preparedFrameIndex,
    );
  }
  assert.deepEqual(spain.control.eligiblePlayerIds, [
    "spain-player-01", "spain-player-02", "spain-player-03", "spain-player-04",
    "spain-player-05", "spain-player-06", "spain-player-07", "spain-player-08",
    "spain-player-09", "spain-player-10", "spain-player-11",
  ]);
  assert.deepEqual(argentina.control.eligiblePlayerIds, [
    "argentina-player-01", "argentina-player-02", "argentina-player-03",
    "argentina-player-04", "argentina-player-05", "argentina-player-06",
    "argentina-player-07", "argentina-player-08", "argentina-player-09",
    "argentina-player-10", "argentina-player-11",
  ]);
  assert.equal(spain.control.profile, "spain-control");
  assert.equal(argentina.control.profile, "argentina-control");
  assert.equal(spain.control.kickoffNativeUserToken, -1);
  assert.equal(argentina.control.kickoffNativeUserToken, -2);
  assert.equal(spain.control.activePlayerId, null);

  assert.equal(spain.players[0].identity.name, "A. Zubizaretta");
  assert.deepEqual(spain.players[0].identity.attributes, {
    pace: 49,
    power: 61,
    control: 24,
    flair: 34,
    vision: 70,
    accuracy: 51,
    stamina: 70,
    discipline: 35,
  });
  assert.equal(spain.players[11].identity.name, "S. Goycoechea");
  assert.deepEqual(spain.players[11].identity.attributes, {
    pace: 30,
    power: 24,
    control: 47,
    flair: 20,
    vision: 53,
    accuracy: 63,
    stamina: 73,
    discipline: 72,
  });
  assert.notStrictEqual(
    spain.players[0].identity.attributes,
    spain.players[1].identity.attributes,
  );
  assert.ok(spain.players.every((player) => Object.isFrozen(player.identity.attributes)));
  assert.ok(Object.isFrozen(spain));

  const spainFirst = spain.players[0];
  assert.deepEqual(spainFirst.formation.kickoff.sourceValues.x, {
    fieldId: "players.spain-player-01.x",
    valueType: "f32",
    value: 618.6666870117188,
    numericBits: "441aaaab",
  });
  assert.deepEqual(spainFirst.formation.kickoff.renderer.transform.position, [
    618.6666870117188,
    0,
    -640,
  ]);
  assert.equal(spainFirst.formation.kickoff.renderer.transform.rotation[1], 0);
  assert.equal(spainFirst.kickoff.active.valueType, "i16");
  assert.equal(spainFirst.kickoff.active.value, 1);
  assert.equal(spainFirst.kickoff.action.valueType, "i16");
  assert.equal(spainFirst.kickoff.action.value, 0);
  assert.equal(
    spainFirst.formation.kickoff.renderer.initialFrameIndex,
    spainFirst.formation.kickoff.animation.preparedFrameIndex,
  );
  assert.equal(spainFirst.formation.kickoff.animation.slotId, 122);

  const argentinaFirst = spain.players[11];
  assert.deepEqual(argentinaFirst.formation.kickoff.renderer.transform.position, [
    661.3333129882812,
    0,
    -640,
  ]);
  assert.equal(
    argentinaFirst.formation.kickoff.renderer.transform.rotation[1],
    180,
  );
  assert.ok(spain.players.every(({ kickoff, formation }) => (
    kickoff.active.value === 1
    && kickoff.action.value === 0
    && formation.kickoff.tick === 0
    && formation.kickoff.phase === "post_tick"
    && formation.kickoff.animation.preparedFrameIndex
      === formation.kickoff.renderer.initialFrameIndex
  )));
});

test("one end swap follows the checked native lifecycle and exact reset restores baseline", evidenceTestOptions, async () => {
  const fixture = await preparedFixture();
  const baseline = createCssoccerTeamState({
    ...fixture,
    selectedCountry: "argentina",
  });
  const swapped = swapCssoccerTeamEnds(baseline);
  const markers = JSON.parse(readFileSync(phaseMarkersUrl, "utf8"));
  const retained = fixture.retained;

  assertSourceEndSwapContract();
  assert.equal(markers.status, "pass");
  assert.equal(markers.endSwap.status, "pass");
  assert.equal(markers.summary.halftimeTick, 1524);
  assert.deepEqual(markers.markers.find(({ tick }) => tick === 1524), {
    tick: 1524,
    phase: "halftime-end-swap-second-half-kickoff",
    matchHalf: 1,
    lineUp: 0,
    matchMode: 5,
    gameMinute: 45,
  });
  assert.deepEqual(lifecycleValues(retained, 0), {
    matchHalf: 0,
    teamA: 0,
    teamB: 1,
  });
  assert.deepEqual(lifecycleValues(retained, 1524), {
    matchHalf: 1,
    teamA: 1,
    teamB: 0,
  });

  assert.deepEqual(swapped.current, {
    matchHalf: 1,
    endSwapCount: 1,
    phase: "halftime-end-swap-second-half-kickoff",
    nativeTeamBySlot: { A: "argentina", B: "spain" },
  });
  assert.equal(swapped.control.selectedCountry, "argentina");
  assert.equal(swapped.control.currentNativeTeamSlot, "A");
  assert.equal(swapped.control.currentNativeUserToken, -1);
  assert.deepEqual(swapped.control.eligiblePlayerIds, baseline.control.eligiblePlayerIds);
  for (let index = 0; index < baseline.players.length; index += 1) {
    const before = baseline.players[index];
    const after = swapped.players[index];
    assert.equal(after.id, before.id);
    assert.equal(
      after.current.nativeRuntimeIndex,
      before.current.nativeRuntimeIndex < 11
        ? before.current.nativeRuntimeIndex + 11
        : before.current.nativeRuntimeIndex - 11,
    );
    assert.equal(after.current.nativePlayerNumber, after.current.nativeRuntimeIndex + 1);
    assert.deepEqual(after.formation.current.renderer, before.formation.current.renderer);
    assert.equal(
      after.formation.current.transformStatus,
      "preserved-by-native-struct-slot-swap",
    );
  }

  assert.throws(
    () => swapCssoccerTeamEnds(swapped),
    /exactly once/u,
  );
  const reset = resetCssoccerTeamState(swapped);
  assert.deepEqual(reset, baseline);
  assert.equal(JSON.stringify(reset), JSON.stringify(baseline));
});

test("team-state runtime rejects widened or corrupted prepared input and has no evidence imports", evidenceTestOptions, async () => {
  const fixture = await preparedFixture();
  assert.throws(
    () => createCssoccerTeamState({ ...fixture, selectedCountry: "france" }),
    /spain or argentina/u,
  );

  const missingPlayer = structuredClone(fixture);
  missingPlayer.preparedScene.roots.players.pop();
  assert.throws(
    () => createCssoccerTeamState({ ...missingPlayer, selectedCountry: "spain" }),
    /ready fixed prepared fixture|22 player roots/u,
  );

  const wrongBits = structuredClone(fixture);
  wrongBits.preparedScene.roots.players[0].initialBinding.sourceValues.action.numericBits = "0001";
  assert.throws(
    () => createCssoccerTeamState({ ...wrongBits, selectedCountry: "spain" }),
    /numeric bits/u,
  );

  const wrongTransform = structuredClone(fixture);
  const firstPlayerId = wrongTransform.preparedScene.roots.players[0].id;
  wrongTransform.preparedScene.meshes.find(({ id }) => id === firstPlayerId).transform.position[0] += 1;
  assert.throws(
    () => createCssoccerTeamState({ ...wrongTransform, selectedCountry: "spain" }),
    /kickoff transform/u,
  );

  for (const file of ["playerState.mjs", "teamState.mjs", "formationState.mjs"]) {
    const text = readFileSync(new URL(`../src/cssoccer/${file}`, import.meta.url), "utf8");
    const imports = [...text.matchAll(/from\s+["']([^"']+)["']/gu)].map((match) => match[1]);
    assert.ok(imports.every((specifier) => specifier.startsWith("./")));
    assert.ok(imports.every((specifier) => !/prepare|oracle|native|source|\.local/u.test(specifier)));
  }
});

async function preparedFixture() {
  fixturePromise ??= buildPreparedFixture();
  return fixturePromise;
}

async function buildPreparedFixture() {
  const teams = parseCssoccerFixtureTeams({
    filesBytes: sourceBytes("FILES.C"),
    definesHBytes: sourceBytes("DEFINES.H"),
    footExeBytes: sourceBytes("FOOT.EXE"),
  });
  const animationTable = parseCssoccerAnimationTable({
    dataHBytes: sourceBytes("DATA.H"),
    actionsCppBytes: sourceBytes("ACTIONS.CPP"),
    dataObjectBytes: sourceBytes("DATA.OBJ"),
    threeDEngCBytes: sourceBytes("3DENG.C"),
    euroRendDatBytes: sourceBytes("EUROREND.DAT"),
    euroRendOffBytes: sourceBytes("EUROREND.OFF"),
  });
  const retained = await readRetainedSamples();
  const lookupBySlot = animationLookup(animationTable);
  const playerRoots = teams.starters.map((starter) => {
    const sourceValues = playerSourceValues(retained, starter.id);
    const lookup = lookupBySlot.get(sourceValues.animation.value);
    assert.ok(lookup, `prepared lookup for animation ${sourceValues.animation.value}`);
    const nativeFrame = sourceValues.animationFrame.value;
    const localFrameIndex = Math.floor(
      (nativeFrame - Math.floor(nativeFrame)) * lookup.frameCount,
    );
    const preparedFrameIndex = lookup.preparedFrameStart + localFrameIndex;
    return {
      id: starter.id,
      kind: "player",
      country: starter.id.startsWith("spain-") ? "spain" : "argentina",
      nativeRuntimeIndex: starter.nativeRuntimeIndex,
      nativeRendererIndex: starter.nativeRendererIndex,
      stableDom: true,
      initialBinding: {
        status: "exact-native-tick-zero",
        tick: 0,
        phase: "post_tick",
        sourceValues,
        rendererMapping: {
          position: ["x", "z", "-y"],
          facingSource: ["x_displacement", "y_displacement"],
          facingChain: "3D_UPD2 ptr crot then 3DENG crot negation then PolyCSS yaw sign",
          finalObjectFacing: ["x_displacement", "y_displacement"],
        },
        rendererFacing: {
          cosine: sourceValues.xDisplacement.value,
          sine: sourceValues.yDisplacement.value,
          yawDegrees: Math.atan2(
            sourceValues.yDisplacement.value,
            sourceValues.xDisplacement.value,
          ) * 180 / Math.PI,
        },
        animation: {
          slotId: sourceValues.animation.value,
          nativeFrame,
          fractionalFrame: nativeFrame - Math.floor(nativeFrame),
          localFrameIndex,
          preparedFrameIndex,
          preparedFrameId: `mc-${String(sourceValues.animation.value).padStart(3, "0")}-f-${String(localFrameIndex).padStart(3, "0")}`,
          frameSetId: null,
          lookup,
          selectionFormula: "floor(frac(nativeFrame) * resolvedFrameCount)",
        },
        lineage: {
          rawSha256: NATIVE_RAW_SHA256,
          stateSha256: NATIVE_STATE_SHA256,
          fieldContractSha256: FIELD_CONTRACT_SHA256,
        },
      },
    };
  });
  const playerMeshes = playerRoots.map((root) => {
    const { sourceValues, animation } = root.initialBinding;
    return {
      id: root.id,
      kind: "player",
      stableDom: true,
      bundleId: "exact-actua-player-one-basis",
      frameSetId: null,
      transform: {
        position: [sourceValues.x.value, sourceValues.z.value, -sourceValues.y.value],
        rotation: [
          0,
          Math.atan2(
            sourceValues.yDisplacement.value,
            sourceValues.xDisplacement.value,
          ) * 180 / Math.PI,
          0,
        ],
        scale: 1,
      },
      initialFrameIndex: null,
    };
  });
  return {
    preparedFacts: {
      schema: "cssoccer-prepared-fixture-facts@1",
      id: "spain-argentina-full-match",
      status: "ready",
      control: {
        countries: ["spain", "argentina"],
        canonicalProfile: "argentina-control",
        ownershipSymmetryProfile: "spain-control",
        users: 1,
        autoPlayer: -1,
      },
      teams,
      bindings: {
        nativeCaptureSha256: NATIVE_RAW_SHA256,
        nativeStateSha256: NATIVE_STATE_SHA256,
        nativeFieldContractSha256: FIELD_CONTRACT_SHA256,
      },
    },
    preparedScene: {
      schema: "cssoccer-prepared-scene@1",
      id: "spain-argentina-full-match",
      status: "ready",
      roots: { players: playerRoots },
      meshes: playerMeshes,
    },
    retained,
  };
}

function animationLookup(table) {
  let preparedFrameStart = 0;
  return new Map(table.retainedNativeAnimations.ids.map((slotId) => {
    const slot = table.slots[slotId];
    const sourceSlotId = slot.status === "resolved-source-mirror"
      ? slot.posePayload.sourceSlotId
      : slot.id;
    const lookup = {
      sourceSlotId,
      status: slot.status,
      preparedFrameStart,
      frameCount: slot.resolvedFrameCount,
      preparedFrameEnd: preparedFrameStart + slot.resolvedFrameCount,
    };
    preparedFrameStart = lookup.preparedFrameEnd;
    return [slotId, lookup];
  }));
}

async function readRetainedSamples() {
  const byTick = new Map([[0, new Map()], [1524, new Map()]]);
  let header;
  const lines = createInterface({ input: createReadStream(stateUrl) });
  for await (const line of lines) {
    const record = JSON.parse(line);
    if (record.recordType === "header") {
      header = record;
      continue;
    }
    if (record.tick > 1524) break;
    if (byTick.has(record.tick)) byTick.get(record.tick).set(record.fieldId, record);
  }
  assert.equal(header.bindings.contractSha256, FIELD_CONTRACT_SHA256);
  assert.equal(header.tickRange.start, 0);
  assert.equal(header.tickRange.count, 2725);
  return { header, byTick };
}

function playerSourceValues(retained, playerId) {
  const samples = retained.byTick.get(0);
  const sample = (suffix) => typedSample(samples.get(`players.${playerId}.${suffix}`));
  return {
    x: sample("x"),
    y: sample("y"),
    z: sample("z"),
    xDisplacement: sample("x_displacement"),
    yDisplacement: sample("y_displacement"),
    action: sample("action"),
    animation: sample("animation"),
    animationFrame: sample("animation_frame"),
    on: sample("on"),
    nativePlayer: sample("native_player"),
    stableId: sample("stable_id"),
  };
}

function typedSample(record) {
  assert.ok(record, "required retained typed sample");
  return {
    fieldId: record.fieldId,
    valueType: record.valueType,
    value: record.value,
    numericBits: record.numericBits,
  };
}

function lifecycleValues(retained, tick) {
  const samples = retained.byTick.get(tick);
  return {
    matchHalf: samples.get("clock.match_half").value,
    teamA: samples.get("lifecycle.team_a").value,
    teamB: samples.get("lifecycle.team_b").value,
  };
}

function assertSourceEndSwapContract() {
  const expectedHashes = {
    "FOOTBALL.CPP": "4054e55bbd5471ad0fa76c192562ee269f4ea0978e38f61d2eb0782439128b10",
    "GAMEDATA.CPP": "47d25e02a7a9b47c03ce21aa8305be93b4534c4b2e1bcbec987b66f77a775e12",
    "DEFINES.H": "c4859a60656d038093422a8f9084eb7b32f520125f21ce6ed65f1219a1524ee1",
    "ACTIONS.CPP": "2c9df171fdc222bc1459113e58e1792cc2b693e3836da8ff1b5c8c915f6b3508",
    "RULES.CPP": "e0e3ebab5f36ec4d60f2ec6f1b4c797661855017c770a6820dc3152ce75a0ef8",
  };
  for (const [file, expected] of Object.entries(expectedHashes)) {
    assert.equal(sha256(sourceBytes(file)), expected);
  }
  const football = sourceBytes("FOOTBALL.CPP").toString("latin1");
  const actions = sourceBytes("ACTIONS.CPP").toString("latin1");
  const rules = sourceBytes("RULES.CPP").toString("latin1");
  assert.match(football, /team_a=0;\s*team_b=1;\s*match_half=0;/u);
  assert.match(actions, /teams\[i\]\.tm_xdis=1;[\s\S]+teams\[i\]\.tm_anim=MC_STAND;/u);
  assert.match(actions, /teams\[i\]\.tm_xdis=-1;[\s\S]+teams\[i\]\.tm_anim=MC_STAND;/u);
  assert.match(rules, /match_half\+=1;/u);
  assert.match(rules, /memcpy\(&teams\[p\],&teams\[p\+11\],sizeof\(a\)\);/u);
  assert.match(rules, /teams\[p\]\.tm_player=p\+1;\s*teams\[p\+11\]\.tm_player=p\+12;/u);
  assert.match(rules, /team_a=team_b;\s*team_b=t;/u);
  assert.match(rules, /users\[u\]\.type=-2;\s*else\s*users\[u\]\.type=-1;/u);
}

function sourceBytes(file) {
  return readFileSync(new URL(file, sourceRoot));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
