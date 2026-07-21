const F32 = Math.fround;
const ATTRIBUTE_KEYS = Object.freeze([
  "pace",
  "power",
  "control",
  "flair",
  "vision",
  "accuracy",
  "stamina",
  "discipline",
]);
const FITNESS_EFFECT = Object.freeze({
  pace: 50,
  power: 50,
  control: 10,
  flair: 10,
  vision: 0,
  accuracy: 10,
  stamina: 40,
  discipline: 0,
});

export const CSSOCCER_PLAYER_INJURY_TRANSITION_SCHEMA =
  "cssoccer-player-injury-transition@1";

export const CSSOCCER_PLAYER_INJURY_SOURCE = deepFreeze({
  sourceRevision: "b40bd6d1e50e052030c5f0884fbe3deda7e9fa4b",
  linkedObjects: [
    "ACTIONS.OBJ init_fall(match_player*, short) and tussle_collision",
    "RULES.OBJ inc_inj",
    "FOOTBALL.OBJ init_player_stats, fitness_fx, conv_stat",
  ],
  collisionInjury: "trunc(collisionForce / 64)",
  accumulatedInjury:
    "u16(current + trunc((trunc(injury * 45 / time_factor) * 256) / (tm_stam + 128)))",
  effectiveFitness: "max(1, trunc(teamFitness - accumulatedInjury * 0.15))",
  fitnessEffects: FITNESS_EFFECT,
  note: "The linked objects contain newer injury behavior than the checked-in CPP files.",
});

/** Apply the linked native fall -> inc_inj -> init_player_stats transition. */
export function applyCssoccerFallInjury(input) {
  requirePlainObject(input, "player fall injury input");
  requireExactKeys(input, [
    "baseAttributes",
    "currentAttributes",
    "currentInjury",
    "force",
    "playerMinutes",
    "teamFitness",
    "timeFactor",
  ], "player fall injury input");
  const baseAttributes = requireAttributes(input.baseAttributes, "base attributes");
  const currentAttributes = requireAttributes(input.currentAttributes, "current attributes");
  const currentInjury = requireIntegerRange(input.currentInjury, 0, 0xffff, "current injury");
  const force = requireIntegerRange(input.force, 0, 0x7fffffff, "collision force");
  const playerMinutes = requireIntegerRange(input.playerMinutes, 0, 255, "player minutes");
  const teamFitness = requireIntegerRange(input.teamFitness, 1, 100, "team fitness");
  const timeFactor = requireIntegerRange(input.timeFactor, 1, 0x7fff, "time factor");

  const injuryArgument = Math.trunc(force / 64);
  const scaled = Math.trunc(injuryArgument * 45 / timeFactor) * 256;
  const injuryDelta = Math.trunc(scaled / (currentAttributes.stamina + 128));
  const injury = (currentInjury + injuryDelta) & 0xffff;
  const effectiveFitness = Math.max(1, Math.trunc(teamFitness - injury * 0.15));
  const attributes = Object.fromEntries(ATTRIBUTE_KEYS.map((key) => {
    const sourceStat = Math.ceil(baseAttributes[key] * 100 / 128);
    const adjusted = sourceStat - Math.trunc(
      sourceStat * FITNESS_EFFECT[key] * (99 - effectiveFitness) / 10_000,
    );
    return [key, Math.trunc(adjusted * 128 / 100)];
  }));
  const baseRate = attributes.pace;
  attributes.pace = projectCssoccerInjuredRate({
    baseRate,
    playerMinutes,
    stamina: currentAttributes.stamina,
  });
  return deepFreeze({
    schema: CSSOCCER_PLAYER_INJURY_TRANSITION_SCHEMA,
    injuryArgument,
    injuryDelta,
    injury,
    effectiveFitness,
    baseRate,
    attributes,
  });
}

/** Reapply FOOTBALL.OBJ player_stamina at an integer player-minute edge. */
export function projectCssoccerInjuredRate({ baseRate, playerMinutes, stamina } = {}) {
  requireIntegerRange(baseRate, 0, 255, "injured base rate");
  requireIntegerRange(playerMinutes, 0, 255, "injured player minutes");
  requireIntegerRange(stamina, 0, 255, "injured stamina");
  const progress = F32((
    Math.sin((playerMinutes * Math.PI / 120) - (Math.PI / 2)) + 1
  ) * 0.5);
  const lossScale = F32(F32((129 - stamina) * progress) / 140);
  const loss = F32(baseRate * lossScale);
  return Math.trunc(baseRate - loss);
}

function requireAttributes(value, label) {
  requirePlainObject(value, label);
  requireExactKeys(value, ATTRIBUTE_KEYS, label);
  for (const key of ATTRIBUTE_KEYS) {
    requireIntegerRange(value[key], 0, 255, `${label} ${key}`);
  }
  return value;
}

function requireIntegerRange(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer from ${minimum} through ${maximum}.`);
  }
  return value;
}

function requirePlainObject(value, label) {
  if (
    value === null
    || typeof value !== "object"
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

function requireExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} must contain exactly ${expected.join(", ")}.`);
  }
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
