const F32 = Math.fround;

export const CSSOCCER_NATIVE_GAMEPLAY_PROFILE_SCHEMA =
  "cssoccer-native-gameplay-profile@1";

const PRAT = f32FromBits("412aaaab");

const PROFILE_BODY = deepFreeze({
  schema: CSSOCCER_NATIVE_GAMEPLAY_PROFILE_SCHEMA,
  bindings: {
    sourceRevision: "b40bd6d1e50e052030c5f0884fbe3deda7e9fa4b",
    nativeBuildSha256:
      "5db9d52f4dec6e71d2a1df1009c803967455a3683b1c87e271669165ef43a3e3",
    compiledEvidence: {
      testExeSha256:
        "760d752bd5cf967d30295578a8c4e1b9118f93d83ceaacedc70a79f8166bd63e",
      testMapSha256:
        "dee5c35320e3b538f880c698ecfc2ad88bd565cb298da216a5b8c654b644d88c",
    },
  },
  constants: {
    prat: f32Constant("prat", "412aaaab"),
    actionIds: {
      stand: integerConstant("STAND_ACT", "i16", 0),
      run: integerConstant("RUN_ACT", "i16", 1),
      pickup: integerConstant("PICKUP_ACT", "i16", 19),
    },
    officialActionIds: {
      normal: integerConstant("referee normal", "i32", 0),
      positioning: integerConstant("referee positioning", "i32", 1),
      waitForKick: integerConstant("referee wait for kick", "i32", 2),
      ready: integerConstant("referee ready", "i32", 4),
    },
    kickoff: {
      keeperOffline: f32Constant("KP_OFFLINE", "41800000"),
      facingAngle: {
        ...f32Constant("FACING_ANGLE", "3f733333"),
        compiledOperand: f64Constant(
          "FACING_ANGLE compiled comparison operand",
          0.95,
          "3fee666666666666",
        ),
      },
      besideBall: f32Constant("BESIDE_BALL", "40a00000"),
      setPieceWaitTicks: integerConstant("MAX_SETP_WAIT", "i16", 240),
    },
    motion: {
      celebrationSpeed: f32Constant("MC_CELEB_SPD", "3fd851ec"),
      maxTurn: maxTurnFormula("MAX_TURN"),
      maxTurn2: maxTurnFormula("MAX_TURN2"),
      imThereDistance: f32Constant("IM_THERE_DIST", "40000000"),
      stepRange: {
        sourceSymbol: "STEP_RANGE",
        formula: "prat * multiplier",
        evaluation: "x87-extended",
        leftOperand: "prat",
        multiplier: f64Constant(
          "STEP_RANGE multiplier",
          3.8,
          "400e666666666666",
        ),
        resultValueType: "x87",
      },
    },
    keeper: {
      closeAngleDistance: {
        ...f32Constant("CLOSE_ANG_DIST", "432aaaab"),
        formula: "prat * multiplier",
        evaluation: "x87-extended-store-f32",
        leftOperand: "prat",
        multiplier: f32Constant(
          "CLOSE_ANG_DIST multiplier",
          "41800000",
        ),
      },
      saveJumpHeight: {
        sourceSymbol: "SAVE_JUMP_HGT",
        formula: "prat * multiplier",
        evaluation: "x87-extended",
        leftOperand: "prat",
        multiplier: f64Constant(
          "SAVE_JUMP_HGT multiplier",
          3.4,
          "400b333333333333",
        ),
        resultValueType: "x87",
      },
    },
    contact: {
      playerSize: {
        ...f32Constant("PLAYER_SIZE", "412aaaab"),
        aliasOf: "prat",
      },
      playerHeight: f32Constant("PLAYER_HEIGHT", "41c80000"),
      fallRate: f32Constant("FALL_RATE", "40800000"),
      saveContact: {
        ...integerConstant("SAVE_CONTACT", "i32", 11),
        compiledOperand: f64Constant(
          "SAVE_CONTACT compiled subtraction operand",
          11,
          "4026000000000000",
        ),
      },
    },
  },
});

export const CSSOCCER_NATIVE_GAMEPLAY_PROFILE_HASH =
  "9961b831e5dc4d8efc602cb00b8c2fd506010d9072f4903eeb5c55e498dd8a82";

export const CSSOCCER_NATIVE_GAMEPLAY_PROFILE = deepFreeze({
  ...PROFILE_BODY,
  profileHash: CSSOCCER_NATIVE_GAMEPLAY_PROFILE_HASH,
});

const EXACT_PROFILE_JSON = JSON.stringify(CSSOCCER_NATIVE_GAMEPLAY_PROFILE);

export function assertCssoccerNativeGameplayProfile(value) {
  requirePlainRecord(value, "native gameplay profile");
  requireExactKeys(
    value,
    ["bindings", "constants", "profileHash", "schema"],
    "native gameplay profile",
  );
  if (value.schema !== CSSOCCER_NATIVE_GAMEPLAY_PROFILE_SCHEMA) {
    throw new Error(
      `Native gameplay profile must use ${CSSOCCER_NATIVE_GAMEPLAY_PROFILE_SCHEMA}.`,
    );
  }
  if (value.profileHash !== CSSOCCER_NATIVE_GAMEPLAY_PROFILE_HASH) {
    throw new Error("Native gameplay profile hash changed.");
  }
  if (
    value.bindings?.sourceRevision !== PROFILE_BODY.bindings.sourceRevision
    || value.bindings?.nativeBuildSha256 !== PROFILE_BODY.bindings.nativeBuildSha256
  ) {
    throw new Error("Native gameplay source/build binding changed.");
  }
  if (JSON.stringify(value) !== EXACT_PROFILE_JSON) {
    throw new Error("Native gameplay profile contents changed without a supported binding.");
  }
  return value;
}

export function projectCssoccerKickoffSourceProfile(profile) {
  const exact = assertCssoccerNativeGameplayProfile(profile);
  const { kickoff } = exact.constants;
  return deepFreeze({
    schema: "cssoccer-kickoff-source-profile@1",
    profileHash: exact.profileHash,
    keeperOffline: kickoff.keeperOffline.value,
    facingAngle: kickoff.facingAngle.value,
    besideBall: kickoff.besideBall.value,
    setPieceWaitTicks: kickoff.setPieceWaitTicks.value,
    actionIds: projectValues(exact.constants.actionIds),
    officialActionIds: projectValues(exact.constants.officialActionIds),
  });
}

export function projectCssoccerMotionSourceProfile(profile, input) {
  const exact = assertCssoccerNativeGameplayProfile(profile);
  const teamRate = requireTeamRateInput(input);
  return deepFreeze({
    celebrationSpeed: exact.constants.motion.celebrationSpeed.value,
    maxTurnRadians: evaluateStoredTurn(exact.constants.motion.maxTurn, teamRate),
  });
}

export function projectCssoccerTravelSourceProfile(profile, input) {
  const exact = assertCssoccerNativeGameplayProfile(profile);
  const teamRate = requireTeamRateInput(input);
  const { motion } = exact.constants;
  return deepFreeze({
    maxTurn2Radians: evaluateStoredTurn(motion.maxTurn2, teamRate),
    imThereDistance: motion.imThereDistance.value,
    stepRange: evaluateX87Product(
      exact.constants.prat.value,
      motion.stepRange.multiplier.value,
    ),
  });
}

export function projectCssoccerKeeperSourceConstants(profile) {
  const exact = assertCssoccerNativeGameplayProfile(profile);
  const { kickoff, keeper, prat } = exact.constants;
  return deepFreeze({
    keeperOffline: kickoff.keeperOffline.value,
    closeAngleDistance: keeper.closeAngleDistance.value,
    saveJumpHeight: evaluateX87Product(
      prat.value,
      keeper.saveJumpHeight.multiplier.value,
    ),
  });
}

export function projectCssoccerContactSourceProfile(profile, input) {
  const exact = assertCssoccerNativeGameplayProfile(profile);
  requirePlainRecord(input, "contact projection input");
  requireExactKeys(input, [
    "atFeetDistance",
    "ballRadius",
    "effectiveTackle",
    "pitchRatio",
    "refereeStrictness",
    "touchBallBox",
    "verticalBallDamp",
  ], "contact projection input");
  for (const key of [
    "atFeetDistance",
    "ballRadius",
    "pitchRatio",
    "touchBallBox",
    "verticalBallDamp",
  ]) requirePositiveFinite(input[key], `contact projection ${key}`);
  requireIntegerRange(input.effectiveTackle, 0, 0x7fff, "effective tackle threshold");
  requireIntegerRange(input.refereeStrictness, 0, 128, "referee strictness");

  const { contact } = exact.constants;
  return deepFreeze({
    touchBallBox: input.touchBallBox,
    atFeetDistance: input.atFeetDistance,
    ballRadius: input.ballRadius,
    playerHeight: contact.playerHeight.value,
    playerSize: contact.playerSize.value,
    pitchRatio: input.pitchRatio,
    verticalBallDamp: input.verticalBallDamp,
    saveContact: contact.saveContact.value,
    effectiveTackle: input.effectiveTackle,
    fallRate: contact.fallRate.value,
    refereeStrictness: input.refereeStrictness,
  });
}

function maxTurnFormula(sourceSymbol) {
  return {
    sourceSymbol,
    formula: "((teamRate * multiplier) + baseDegrees) * pi / degreesPerCircle",
    evaluation: "x87-extended-store-f32",
    teamRateValueType: "u8",
    multiplier: f32Constant(`${sourceSymbol} team-rate multiplier`, "3e000000"),
    baseDegrees: f32Constant(`${sourceSymbol} base degrees`, "41600000"),
    pi: f64Constant(`${sourceSymbol} pi`, 3.1415926536, "400921fb544486e0"),
    degreesPerCircle: f64Constant(
      `${sourceSymbol} degrees per circle`,
      180,
      "4066800000000000",
    ),
    resultValueType: "f32",
  };
}

function evaluateStoredTurn(formula, teamRate) {
  const scaled = teamRate * formula.multiplier.value;
  const degrees = scaled + formula.baseDegrees.value;
  return F32((degrees * formula.pi.value) / formula.degreesPerCircle.value);
}

function evaluateX87Product(left, right) {
  return left * right;
}

function requireTeamRateInput(input) {
  requirePlainRecord(input, "motion projection input");
  requireExactKeys(input, ["teamRate"], "motion projection input");
  requireIntegerRange(input.teamRate, 0, 0xff, "motion projection teamRate");
  return input.teamRate;
}

function projectValues(constants) {
  return Object.fromEntries(
    Object.entries(constants).map(([key, constant]) => [key, constant.value]),
  );
}

function f32Constant(sourceSymbol, numericBits) {
  return {
    sourceSymbol,
    valueType: "f32",
    value: f32FromBits(numericBits),
    numericBits,
  };
}

function f64Constant(sourceSymbol, value, numericBits) {
  return { sourceSymbol, valueType: "f64", value, numericBits };
}

function integerConstant(sourceSymbol, valueType, value) {
  return { sourceSymbol, valueType, value };
}

function f32FromBits(bits) {
  if (!/^[a-f0-9]{8}$/u.test(bits)) throw new Error("Invalid f32 bits.");
  const view = new DataView(new ArrayBuffer(4));
  view.setUint32(0, Number.parseInt(bits, 16), false);
  return view.getFloat32(0, false);
}

function requirePlainRecord(value, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype
      && Object.getPrototypeOf(value) !== null)
  ) throw new TypeError(`${label} must be a plain object.`);
  return value;
}

function requireExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
  ) throw new Error(`${label} has unsupported or missing keys.`);
}

function requirePositiveFinite(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} must be positive and finite.`);
  }
  return value;
}

function requireIntegerRange(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be an integer in ${minimum}..${maximum}.`);
  }
  return value;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}
