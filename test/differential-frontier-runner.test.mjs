import assert from "node:assert/strict";
import test from "node:test";

import {
  DifferentialFrontierError,
  buildNativeSymbolTable,
  buildTransitionClues,
  classifyMismatch,
  compareExactCoordinates,
  createExactSelector,
  decodeMatchPlayer,
  findBrowserMappingCandidates,
  findNativeBranchDiscriminators,
  findNativeCallerBranches,
  findNativeWriteSites,
  parseCssoraw2,
  resolveNativeTransitionSymbols,
} from "../tools/support/differential-frontier-core.mjs";
import { createDifferentialFrontierTraceController } from
  "../tools/support/differential-frontier-trace-runtime.mjs";
import {
  createDiagnosticModuleSource,
  createDiagnosticEngineSource,
  deriveNativeBranchMismatchFocus,
  deriveNegativePathFocus,
  nextAction,
  rankNegativePathTrace,
  rankDynamicProducerTrace,
  resolveNativeBranchIdentity,
  topLevelFunctionDeclarations,
} from "../tools/run-differential-frontier.mjs";

const STRUCT_SHA256 = "13d13dca2910a7685be7603e25bc9fa936253f5aa72f73eef3f54e851fbbce34";

test("retains the complete exact coordinate and compares progress within a tick", () => {
  const fields = new Map([
    ["players.demo-player-01.action", 7],
    ["players.demo-player-01.animation", 8],
  ]);
  const mismatch = exactMismatch();
  const selector = createExactSelector(mismatch, fields);

  assert.deepEqual(selector, {
    schema: "cssoccer-differential-frontier-selector@1",
    tick: 41,
    phase: "post_tick",
    phaseOrder: 0,
    fieldId: "players.demo-player-01.action",
    fieldOrdinal: 7,
    valueType: "i16",
    referenceBits: "0001",
    candidateBits: "0000",
    domain: "players",
    entityId: "demo-player-01",
    leaf: "action",
  });
  assert.equal(compareExactCoordinates(
    mismatch,
    { ...mismatch, fieldId: "players.demo-player-01.animation" },
    fields,
  ), "advanced");
  assert.equal(compareExactCoordinates(mismatch, mismatch, fields), "same");
});

test("routes a missing discrete transition without losing adjacent evidence", () => {
  const fieldId = "players.demo-player-01.action";
  const beforeReference = new Map([[fieldId, sample("i16", 0, "0000")]]);
  const beforeCandidate = new Map([[fieldId, sample("i16", 0, "0000")]]);
  const reference = new Map([[fieldId, sample("i16", 1, "0001")]]);
  const candidate = new Map([[fieldId, sample("i16", 0, "0000")]]);
  const clues = buildTransitionClues({
    previousReference: beforeReference,
    previousCandidate: beforeCandidate,
    reference,
    candidate,
    selectedFieldIds: [fieldId],
    exactFieldId: fieldId,
  });
  const mismatch = { ...exactMismatch(), selector: createExactSelector(exactMismatch(), new Map([[fieldId, 0]])) };

  assert.equal(clues[0].referenceChanged, true);
  assert.equal(clues[0].candidateChanged, false);
  assert.equal(classifyMismatch(mismatch, clues).id, "branch-transition");
});

test("native writer search rejects comparisons and prefers the written target value", () => {
  const sites = findNativeWriteSites([{
    name: "ACTIONS.CPP",
    path: "oracle/ACTIONS.CPP",
    text: [
      "void init_team(void)",
      "{",
      "  teams[i].tm_act=0;",
      "}",
      "void init_run_act(match_player *player)",
      "{",
      "  if (player->tm_act==STAND_ACT)",
      "    player->tm_act=RUN_ACT;",
      "}",
    ].join("\n"),
  }], {
    sourceOwner: "ANDYDEFS.H match_player.tm_act; teams[0]",
    preferredValueSymbols: ["RUN_ACT"],
  });

  assert.equal(sites[0].function, "init_run_act");
  assert.equal(sites[0].matchedPreferredValue, true);
  assert.equal(sites.find(({ line }) => line === 7).write, false);
});

test("symbolic routing resolves a native transition through its caller branch and browser mapping", () => {
  const nativeFiles = [
    sourceFile("DATA.H", [
      "#define MC_PASSL 39",
      "#define MC_DIAGPASSL 47",
    ]),
    sourceFile("ACTIONS.CPP", [
      "void init_kick_act(match_player *player,int mc,float pc)",
      "{",
      "  init_anim(player,mc);",
      "  player->tm_act=KICK_ACT;",
      "}",
    ]),
    sourceFile("INTELL.CPP", [
      "void make_pass(match_player *player,int p)",
      "{",
      "  switch(pass_type)",
      "  {",
      "    case(5):",
      "      init_kick_act(player,MC_PASSL,MCC_PASS);",
      "      break;",
      "    case(4):",
      "      init_kick_act(player,MC_DIAGPASSL,MCC_DIAGPASS);",
      "      break;",
      "  }",
      "}",
      "void make_shoot(match_player *player)",
      "{",
      "  switch(pass_type)",
      "  {",
      "    case(4):",
      "      init_kick_act(player,MC_DIAGPASSL,MCC_DIAGPASS);",
      "      break;",
      "  }",
      "}",
    ]),
  ];
  const runtimeFiles = [sourceFile("browserMatchEngine.mjs", [
    "const LIVE_KICK_ACTION = 15;",
    "/** Apply make_pass -> init_kick_act for an ordinary AI pass decision. */",
    "function openingLivePassIsQualified(player, decision) {",
    "  return new Set([-1, 1]).has(decision.passType)",
    "    && decision.targetNativePlayer > 0;",
    "}",
    "function initializeOpeningLivePass(player, decision) {",
    "  const launch = decision.passType === -1 ? chip(player) : backheel(player);",
    "  return { ...player, action: LIVE_KICK_ACTION, launch };",
    "}",
  ])];
  const symbols = buildNativeSymbolTable(nativeFiles, runtimeFiles);
  const transitions = resolveNativeTransitionSymbols([
    { sourceMember: "tm_act", browserPath: "action", before: 1, after: 15 },
    { sourceMember: "tm_anim", browserPath: "animation", before: 72, after: 47 },
  ], symbols);
  const branches = findNativeCallerBranches(nativeFiles, {
    callee: "init_kick_act",
    transitionSymbols: transitions.map(({ symbol }) => symbol),
    runtimeFiles,
  });
  const mappings = findBrowserMappingCandidates(runtimeFiles, {
    nativeBranch: branches[0],
    transitionSymbols: transitions.map(({ symbol }) => symbol),
  });

  assert.deepEqual(transitions.map(({ sourceMember, symbol }) => ({ sourceMember, symbol })), [
    { sourceMember: "tm_act", symbol: "KICK_ACT" },
    { sourceMember: "tm_anim", symbol: "MC_DIAGPASSL" },
  ]);
  assert.equal(branches[0].function, "make_pass");
  assert.equal(branches[0].caseValue, 4);
  assert.deepEqual(branches[0].matchedTransitionSymbols, ["MC_DIAGPASSL"]);
  assert.deepEqual(branches[0].dispatchTable.map(({ caseValue }) => caseValue), [5, 4]);
  assert.equal(mappings[0].function, "openingLivePassIsQualified");
  assert.match(mappings[0].source, /new Set/u);
});

test("finds a global discriminator when native branches reuse one transition animation", () => {
  const nativeFiles = [sourceFile("INTELL.CPP", [
    "void make_pass(match_player *player)",
    "{",
    "  kick_type=KT_PASS;",
    "  switch(pass_type)",
    "  {",
    "    case(4): init_kick_act(player,MC_DIAGPASSL,MCC_DIAGPASS); break;",
    "  }",
    "}",
    "void make_shoot(match_player *player)",
    "{",
    "  kick_type=KT_SHOOT;",
    "  switch(pass_type)",
    "  {",
    "    case(4): init_kick_act(player,MC_DIAGPASSL,MCC_DIAGPASS); break;",
    "  }",
    "}",
  ])];
  const branches = findNativeCallerBranches(nativeFiles, {
    callee: "init_kick_act",
    transitionSymbols: ["MC_DIAGPASSL"],
  });
  const discriminators = findNativeBranchDiscriminators(nativeFiles, { branches });

  assert.equal(branches.length, 2);
  assert.equal(discriminators[0].symbol, "kick_type");
  assert.deepEqual(
    discriminators[0].assignments.map(({ function: name, expression }) => ({ name, expression })),
    [
      { name: "make_pass", expression: "KT_PASS" },
      { name: "make_shoot", expression: "KT_SHOOT" },
    ],
  );
});

test("binds the executed native branch and routes a browser pass trace to the missing shot decision", async () => {
  const nativeFiles = [sourceFile("INTELL.CPP", [
    "void make_pass(match_player *player)",
    "{",
    "  kick_type=KT_PASS;",
    "  switch(pass_type)",
    "  {",
    "    case(4): init_kick_act(player,MC_DIAGPASSL,MCC_DIAGPASS); break;",
    "  }",
    "}",
    "void make_shoot(match_player *player)",
    "{",
    "  kick_type=KT_SHOOT;",
    "  switch(pass_type)",
    "  {",
    "    case(4): init_kick_act(player,MC_DIAGPASSL,MCC_DIAGPASS); break;",
    "  }",
    "}",
    "void got_ball(match_player *player)",
    "{",
    "  if (shoot_decide(player))",
    "    make_shoot(player);",
    "  else",
    "  {",
    "    int p=pass_decide(player);",
    "    if (p) make_pass(player);",
    "  }",
    "}",
  ])];
  const branches = findNativeCallerBranches(nativeFiles, {
    callee: "init_kick_act",
    transitionSymbols: ["MC_DIAGPASSL"],
  });
  const exact = exactMismatch();
  const identity = await resolveNativeBranchIdentity({
    branches,
    nativeFiles,
    exact,
    evidenceRoot: "/fixture",
    outputRoot: "/fixture/output",
    runCompiledPathCheck: async ({ functionName }) => ({
      status: "complete",
      exact: {
        activeTick: exact.tick,
        phase: exact.phase,
        phaseOrder: exact.phaseOrder,
        field: exact.fieldId,
        reference: exact.reference,
        candidate: exact.candidate,
      },
      symbols: [{
        name: "kick_type",
        valueType: "i32",
        constantWrites: [{ value: functionName === "make_shoot" ? 3 : 1 }],
        runtime: { value: 3, numericBits: "00000003" },
      }],
      runtime: {
        authority: "retained-native-capture",
        parityAuthority: true,
      },
      evidencePath: `/fixture/${functionName}.json`,
    }),
  });
  const negativePath = {
    file: "src/cssoccer/passDecisionState.mjs",
    function: "resolveCssoccerAiPassDecision",
    line: 64,
    supportingCalls: [{ function: "sourcePassType" }],
    ancestorCalls: [{
      file: "src/cssoccer/browserMatchEngine.mjs",
      function: "resolveOpeningLiveAiNormalPass",
      line: 3267,
    }],
  };
  const valueFocus = deriveNegativePathFocus({
    negativePath,
    nativeBranch: identity.branch,
    nativeBranchIdentity: identity,
  });
  const branchFocus = deriveNativeBranchMismatchFocus({
    negativePath,
    nativeBranch: identity.branch,
    nativeBranchIdentity: identity,
    nativeFiles,
    playerControl: 0,
  });
  const action = nextAction({
    exact,
    producer: { status: "ambiguous" },
    symbolicRouting: {
      status: "executed-negative-path",
      negativePath: {
        ...negativePath,
        score: 400,
        rejectionKind: "explicit-outcome",
        rejectionReason: "candidate-selection-rejected",
        result: { outcome: "no-pass", candidates: [] },
        sourceBranches: [],
      },
      negativePathFocus: null,
      nativeBranchMismatchFocus: branchFocus,
      nativeBranchIdentity: identity,
      staticBrowserMapping: null,
    },
    retainedMovement: "same",
    duplicate: false,
    evidenceRoot: "/fixture",
    outputRoot: "/fixture/output",
  });

  assert.equal(identity.status, "bound");
  assert.equal(identity.branch.function, "make_shoot");
  assert.deepEqual(identity.candidates.map(({ function: name, expectedValue, matched }) => ({
    name, expectedValue, matched,
  })), [
    { name: "make_pass", expectedValue: 1, matched: false },
    { name: "make_shoot", expectedValue: 3, matched: true },
  ]);
  assert.equal(valueFocus, null);
  assert.equal(branchFocus.missingDecisionFunction, "shoot_decide");
  assert.equal(branchFocus.browserOwner.function, "resolveOpeningLiveAiNormalPass");
  assert.equal(branchFocus.nativeGuard.function, "got_ball");
  assert.equal(action.kind, "implement-missing-native-decision-branch");
  assert.equal(action.file, "src/cssoccer/browserMatchEngine.mjs");
  assert.match(action.question, /resolveCssoccerAiPassDecision; implement shoot_decide before/u);
});

test("temporary call tracing identifies the direct active producer", () => {
  const controller = createDifferentialFrontierTraceController();
  controller.configure({ entityId: "demo-player-01", nativePlayerNumber: 1 });
  const settle = controller.wrap({ name: "settlePlayer", line: 10 }, (player) => ({
    ...player,
    action: 0,
  }));
  const step = controller.wrap({ name: "stepPlayers", line: 20 }, (player) => ({
    players: [settle(player)],
  }));
  step({ id: "demo-player-01", nativePlayerNumber: 1, action: 0 });
  const trace = controller.read();
  const declarations = [
    { name: "settlePlayer", line: 10, source: "function settlePlayer(player) { return { ...player, action: 0 }; }" },
    { name: "stepPlayers", line: 20, source: "function stepPlayers(player) { return { players: [settlePlayer(player)] }; }" },
  ];
  const ranked = rankDynamicProducerTrace({
    trace,
    declarations,
    exact: {
      ...exactMismatch(),
      selector: createExactSelector(exactMismatch(), new Map([["players.demo-player-01.action", 0]])),
    },
  });

  assert.equal(trace.status, "captured");
  assert.equal(trace.records.length, 2);
  assert.equal(ranked[0].function, "settlePlayer");
  assert.equal(ranked[0].outputDepth, 0);
  assert.equal(ranked[0].writesSelectedField, true);
});

test("negative-path tracing retains non-entity decisions and their executed helper calls", () => {
  const controller = createDifferentialFrontierTraceController();
  controller.configure({ entityId: "demo-player-01", nativePlayerNumber: 1 });
  const preference = controller.wrap({
    file: "src/cssoccer/passDecisionState.mjs",
    name: "sourcePreference",
    line: 90,
  }, ({ candidate }) => ({
    preference: candidate.nativePlayer * 10,
    pathThreat: 0,
  }));
  const passType = controller.wrap({
    file: "src/cssoccer/passDecisionState.mjs",
    name: "sourcePassType",
    line: 80,
  }, () => 3);
  const decide = controller.wrap({
    file: "src/cssoccer/passDecisionState.mjs",
    name: "resolveCssoccerAiPassDecision",
    line: 40,
  }, (input) => {
    const type = passType({
      holder: input.holder,
      candidate: { nativePlayer: 2 },
    });
    const scored = preference({
      holder: input.holder,
      candidate: { nativePlayer: 2 },
    });
    return {
      outcome: "no-pass",
      targetNativePlayer: null,
      passType: null,
      candidates: [{ nativePlayer: 2, passType: type, ...scored }],
      rng: { seed: 3, calls: 2 },
    };
  });
  decide({
    holder: { id: "demo-player-01", nativePlayer: 1 },
  });
  const trace = controller.read();
  const declarations = [{
    file: "src/cssoccer/passDecisionState.mjs",
    name: "resolveCssoccerAiPassDecision",
    line: 40,
    source: [
      "function resolveCssoccerAiPassDecision(input) {",
      "  let selected = null;",
      "  if (rng.seed > chance) selected = candidate;",
      "  if (selected === null && mustPass) [selected] = candidates;",
      "  return { outcome: selected === null ? \"no-pass\" : \"pass\", candidates };",
      "}",
    ].join("\n"),
  }];
  const ranked = rankNegativePathTrace({ trace, declarations });
  const focus = deriveNegativePathFocus({
    negativePath: ranked[0],
    nativeBranch: {
      switchExpression: "pass_type",
      caseValue: 4,
      matchedTransitionSymbols: ["MC_DIAGPASSL"],
    },
    nativeBranchIdentity: { status: "static-unique" },
  });

  assert.equal(trace.records.length, 3);
  assert.equal(trace.records[0].function, "sourcePassType");
  assert.equal(trace.records[0].result, 3);
  assert.deepEqual(trace.records[1].result, { preference: 20, pathThreat: 0 });
  assert.equal(trace.records[0].parentCallId, trace.records[2].callId);
  assert.equal(ranked[0].function, "resolveCssoccerAiPassDecision");
  assert.equal(ranked[0].rejectionReason, "candidate-selection-rejected");
  assert.equal(ranked[0].supportingCalls[0].function, "sourcePassType");
  assert.match(ranked[0].sourceBranches[0].source, /selected|rng\.seed/u);
  assert.equal(focus.producer.function, "sourcePassType");
  assert.equal(focus.producer.result, 3);
  assert.equal(focus.expectedValue, 4);
});

test("diagnostic transform wraps only top-level functions and exposes a frozen inspect seam", () => {
  const source = [
    "export function createEngine() {",
    "  return {",
    "    inspect() {",
    "      return engineInspection(current, nextTick);",
    "    },",
    "  };",
    "}",
    "function producer(player) {",
    "  return { ...player, action: 1 };",
    "}",
    "function clone(value) { return value; }",
  ].join("\n");
  const declarations = topLevelFunctionDeclarations(source);
  const transformed = createDiagnosticEngineSource(source, declarations);

  assert.deepEqual(declarations.map(({ name, line }) => ({ name, line })), [
    { name: "createEngine", line: 1 },
    { name: "producer", line: 8 },
    { name: "clone", line: 11 },
  ]);
  assert.match(transformed, /diagnosticState: current/u);
  assert.match(transformed, /producer = __differentialFrontierTraceController\.wrap/u);
  assert.doesNotMatch(transformed, /clone = __differentialFrontierTraceController\.wrap/u);
});

test("diagnostic module transform shares the trace controller without adding a public seam", () => {
  const source = [
    "export function resolveDecision(input) { return helper(input); }",
    "function helper(input) { return false; }",
  ].join("\n");
  const declarations = topLevelFunctionDeclarations(source);
  const transformed = createDiagnosticModuleSource(source, declarations, {
    file: "src/cssoccer/decision.mjs",
  });

  assert.match(transformed, /differentialFrontierTraceController as __differentialFrontierTraceController/u);
  assert.match(transformed, /file: "src\/cssoccer\/decision\.mjs"/u);
  assert.match(transformed, /resolveDecision = __differentialFrontierTraceController\.wrap/u);
  assert.doesNotMatch(transformed, /configureCssoccerDifferentialFrontierTrace/u);
});

test("decodes only the retained CSSORAW2 range and known match_player layout", () => {
  const rangeOffset = 0x200;
  const raw = cssorawFixture({ rangeOffset, bytes: 203, tick: 9 });
  raw.writeFloatLE(123.5, 16 + 8 + 28 + 2);
  raw.writeInt16LE(1, 16 + 8 + 28 + 142);
  const parsed = parseCssoraw2(raw, {
    ranges: [{ offset: rangeOffset, bytes: 203 }],
  });
  const player = decodeMatchPlayer(parsed.byTick.get(9), {
    teamsOffset: rangeOffset,
    nativePlayerNumber: 1,
    structSha256: STRUCT_SHA256,
  });

  assert.equal(player["position.x"], 123.5);
  assert.equal(player.action, 1);
  assert.throws(
    () => decodeMatchPlayer(parsed.byTick.get(9), {
      teamsOffset: rangeOffset,
      nativePlayerNumber: 1,
      structSha256: "0".repeat(64),
    }),
    (error) => error instanceof DifferentialFrontierError
      && error.code === "native-player-layout-missing",
  );
});

function exactMismatch() {
  return {
    tick: 41,
    phase: "post_tick",
    phaseOrder: 0,
    fieldId: "players.demo-player-01.action",
    sourceOwner: "ANDYDEFS.H match_player.tm_act; teams[0]",
    reason: "numeric-bits",
    reference: sample("i16", 1, "0001"),
    candidate: sample("i16", 0, "0000"),
  };
}

function sample(valueType, value, numericBits) {
  return { valueType, value, numericBits };
}

function sourceFile(name, lines) {
  return { name, path: `fixture/${name}`, text: lines.join("\n") };
}

function cssorawFixture({ rangeOffset, bytes, tick }) {
  const tableBytes = 8;
  const metadataBytes = 28;
  const buffer = Buffer.alloc(16 + tableBytes + metadataBytes + bytes);
  buffer.write("CSSORAW2", 0, "ascii");
  buffer.writeUInt32LE(2, 8);
  buffer.writeUInt32LE(1, 12);
  buffer.writeUInt32LE(rangeOffset, 16);
  buffer.writeUInt32LE(bytes, 20);
  const record = 24;
  buffer.writeUInt32LE(0x314b4954, record);
  buffer.writeUInt32LE(0, record + 4);
  buffer.writeUInt32LE(tick, record + 20);
  buffer.writeUInt32LE(1, record + 24);
  return buffer;
}
