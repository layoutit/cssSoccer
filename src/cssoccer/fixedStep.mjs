export const CSSOCCER_TICK_RATE_HZ = 20;
export const CSSOCCER_FIXED_STEP_SECONDS = 1 / CSSOCCER_TICK_RATE_HZ;
export const CSSOCCER_FIXED_STEP_MILLISECONDS = 1000 / CSSOCCER_TICK_RATE_HZ;

export const CSSOCCER_FIXED_STEP_SOURCE = Object.freeze({
  producer: "DEFINES.H:47 REAL_SPEED; native fixture timestepSeconds",
  definesSha256: "c4859a60656d038093422a8f9084eb7b32f520125f21ce6ed65f1219a1524ee1",
  tickRateHz: CSSOCCER_TICK_RATE_HZ,
});

export function createFixedStepState({ tick = 0, remainderMilliseconds = 0 } = {}) {
  assertSafeNonNegativeInteger(tick, "tick");
  assertFiniteNonNegative(remainderMilliseconds, "remainderMilliseconds");
  if (remainderMilliseconds >= CSSOCCER_FIXED_STEP_MILLISECONDS) {
    throw new RangeError("remainderMilliseconds must be less than one cssoccer fixed step.");
  }
  return Object.freeze({ tick, remainderMilliseconds });
}

/**
 * Consume host-frame time without imposing a browser catch-up cap. Match/runtime
 * ownership decides how to apply the returned number of exact 20 Hz ticks.
 */
export function advanceFixedStep(state, elapsedMilliseconds) {
  assertFixedStepState(state);
  assertFiniteNonNegative(elapsedMilliseconds, "elapsedMilliseconds");

  const totalMilliseconds = state.remainderMilliseconds + elapsedMilliseconds;
  const steps = Math.floor(totalMilliseconds / CSSOCCER_FIXED_STEP_MILLISECONDS);
  const tick = state.tick + steps;
  assertSafeNonNegativeInteger(tick, "resulting tick");

  const remainderMilliseconds = totalMilliseconds
    - (steps * CSSOCCER_FIXED_STEP_MILLISECONDS);
  return Object.freeze({
    state: createFixedStepState({ tick, remainderMilliseconds }),
    steps,
  });
}

function assertFixedStepState(state) {
  if (state === null || typeof state !== "object" || Array.isArray(state)) {
    throw new TypeError("fixed-step state must be an object.");
  }
  assertSafeNonNegativeInteger(state.tick, "state.tick");
  assertFiniteNonNegative(state.remainderMilliseconds, "state.remainderMilliseconds");
  if (state.remainderMilliseconds >= CSSOCCER_FIXED_STEP_MILLISECONDS) {
    throw new RangeError("state.remainderMilliseconds must be less than one cssoccer fixed step.");
  }
}

function assertSafeNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer.`);
  }
}

function assertFiniteNonNegative(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${label} must be a finite non-negative number.`);
  }
}
