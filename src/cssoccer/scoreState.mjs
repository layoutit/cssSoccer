export const CSSOCCER_SCORE_STATE_SCHEMA = "cssoccer-score-state@1";

export const CSSOCCER_SCORE_NATIVE_BINDINGS = deepFreeze({
  scenarioSha256:
    "990b15c0109edf8d700cc135fbec29f89c171ce263f04a7aeb257000b7a9dbca",
  profileSha256:
    "8c1235c635de6d5601aaa3f8436815a765d198cf2195be879efccaee9dcf188f",
  sourceSha256:
    "136874496399a7acb712b28b6effb53f689c84ca373fb42af67ebf20f3b8cc45",
  buildSha256:
    "cd06f847e2376951791a68a57fed3c38a13496e801c3dc66e98aa1d9abf9c544",
  contractSha256:
    "5f9b01bee40e319b611c4f948fadbfd5f7f9a08868bd658c1392dc54abeeab98",
  rawSha256:
    "db0cf40c5f3c455d184a29a1bc25c3d90c5fe3eac69d28e82327ab5bf73029f0",
  stateSha256:
    "c04ec365e835712807f0a6b5fe069e3e3a61e613f035e7624f5dfa2db2f18495",
});

export const CSSOCCER_SCORE_SOURCE = deepFreeze({
  source: {
    initialization: "FOOTBALL.CPP init_match team_a_goals/team_b_goals = 0",
    award: "BALL.CPP go_right_goal/go_left_goal increments the stable fixture score slot",
    terminalDecision: "FOOTBALL.CPP watch_match_time",
  },
  stableKickoffSlots: {
    A: "spain",
    B: "argentina",
  },
  retainedQualification: {
    classification: "output-only-never-runtime-input",
    bindings: CSSOCCER_SCORE_NATIVE_BINDINGS,
  },
  resolutionBoundary: "A later ball/rules owner awards a goal to a stable country.",
});

export function createCssoccerScoreState(options) {
  if (options !== undefined) {
    assertPlainObject(options, "cssoccer score options");
    assertOnlyKeys(options, [], "cssoccer score options");
  }
  return scoreState(0, 0);
}

export function awardCssoccerGoal(state, input) {
  assertCssoccerScoreState(state);
  assertPlainObject(input, "cssoccer awarded goal");
  assertOnlyKeys(input, ["country"], "cssoccer awarded goal");
  const country = requireCountry(input.country);
  const next = { ...state.goals, [country]: state.goals[country] + 1 };
  if (next[country] > 0x7fffffff) {
    throw new RangeError("cssoccer score exceeds the native signed 32-bit field.");
  }
  return scoreState(next.spain, next.argentina);
}

export function resetCssoccerScoreState(state) {
  assertCssoccerScoreState(state);
  return scoreState(0, 0);
}

export function getCssoccerNormalTimeResult(state) {
  assertCssoccerScoreState(state);
  if (state.goals.spain === state.goals.argentina) {
    return deepFreeze({
      outcome: "draw",
      winnerCountry: null,
      score: { ...state.goals },
    });
  }
  const winnerCountry = state.goals.spain > state.goals.argentina
    ? "spain"
    : "argentina";
  return deepFreeze({
    outcome: "win",
    winnerCountry,
    score: { ...state.goals },
  });
}

export function assertCssoccerScoreState(state) {
  assertPlainObject(state, "cssoccer score state");
  if (
    state.schema !== CSSOCCER_SCORE_STATE_SCHEMA
    || !isInt32Goal(state.goals?.spain)
    || !isInt32Goal(state.goals?.argentina)
    || state.totalGoals !== state.goals.spain + state.goals.argentina
  ) {
    throw new Error("cssoccer score state must contain only the fixed Spain/Argentina normal-time score.");
  }
  if (!sameValue(state, scoreState(state.goals.spain, state.goals.argentina))) {
    throw new Error("cssoccer score state contains unsupported fields.");
  }
  return state;
}

function scoreState(spain, argentina) {
  return deepFreeze({
    schema: CSSOCCER_SCORE_STATE_SCHEMA,
    goals: { spain, argentina },
    totalGoals: spain + argentina,
  });
}

function requireCountry(value) {
  if (value !== "spain" && value !== "argentina") {
    throw new Error("A cssoccer goal must be awarded to exactly spain or argentina.");
  }
  return value;
}

function isInt32Goal(value) {
  return Number.isInteger(value) && value >= 0 && value <= 0x7fffffff;
}

function assertOnlyKeys(value, allowed, label) {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) {
    throw new Error(`${label} does not accept ${unexpected.join(", ")}.`);
  }
}

function assertPlainObject(value, label) {
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

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}
