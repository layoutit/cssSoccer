import { readFileSync } from "node:fs";

const descriptorUrl = new URL(
  "../../../references/spain-argentina-source-data.json",
  import.meta.url,
);

const descriptor = JSON.parse(readFileSync(descriptorUrl, "utf8"));
validateDescriptor(descriptor);

export const CSSOCCER_SOURCE_DATA = deepFreeze(descriptor);
export const CSSOCCER_SLICE_ID = CSSOCCER_SOURCE_DATA.id;
export const CSSOCCER_CONTROL_COUNTRIES = Object.freeze([
  ...CSSOCCER_SOURCE_DATA.fixture.controlCountries,
]);

const requestKeys = new Set([
  "fixtureId",
  "sceneId",
  "controlCountry",
  "homeTeamId",
  "awayTeamId",
  "competitionId",
  "simulationModeId",
  "durationMinutes",
  "halfDurationMinutes",
  "timeFactor",
  "tickRateHz",
  "nativeFixtureContractSha256",
  "nativeScenarioSha256",
  "nativeFieldContractSha256",
  "nativeCaptureSha256",
  "nativeFixtureProfileSha256",
  "nativeFullMatchExecutableSha256",
  "nativeTerminalMatchHalf",
]);

export function createCssoccerSlicePlan(request = {}) {
  requirePlainRequest(request);

  const unknownKeys = Object.keys(request).filter((key) => !requestKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(
      `Unsupported cssoccer slice option${unknownKeys.length === 1 ? "" : "s"}: ${unknownKeys.sort().join(", ")}`,
    );
  }

  const { fixture } = CSSOCCER_SOURCE_DATA;
  const duration = fixture.duration;

  requireFixed(request, "fixtureId", fixture.id);
  requireFixed(request, "sceneId", fixture.sceneId);
  requireFixed(request, "homeTeamId", fixture.home.sourceTeamId);
  requireFixed(request, "awayTeamId", fixture.away.sourceTeamId);
  requireFixed(request, "competitionId", fixture.competition.id);
  requireFixed(request, "simulationModeId", fixture.simulationMode.id);
  requireFixed(request, "durationMinutes", duration.fullMatchPlayMinutes);
  requireFixed(request, "halfDurationMinutes", duration.playMinutesPerHalf);
  requireFixed(request, "timeFactor", duration.timeFactor);
  requireFixed(request, "tickRateHz", duration.tickRateHz);

  const controlCountry = own(request, "controlCountry")
    ? request.controlCountry
    : fixture.defaultControlCountry;
  if (!CSSOCCER_CONTROL_COUNTRIES.includes(controlCountry)) {
    throw new Error("controlCountry must be exactly spain or argentina");
  }

  const controlTeam = controlCountry === fixture.home.country
    ? fixture.home
    : fixture.away;
  const requiredProfileKey = `${controlCountry}-control`;
  const nativeBindings = CSSOCCER_SOURCE_DATA.nativeProfileBindings;
  const selectedProfile = nativeBindings.profiles[requiredProfileKey];
  requireFixed(request, "nativeFixtureContractSha256", nativeBindings.fixtureContractSha256);
  requireFixed(request, "nativeScenarioSha256", nativeBindings.scenarioSha256);
  requireFixed(request, "nativeFieldContractSha256", nativeBindings.fieldContractSha256);
  requireFixed(request, "nativeCaptureSha256", nativeBindings.capture.rawSha256);
  requireFixed(request, "nativeFixtureProfileSha256", selectedProfile.fixtureProfileSha256);
  requireFixed(request, "nativeFullMatchExecutableSha256", selectedProfile.fullMatchExecutableSha256);
  requireFixed(request, "nativeTerminalMatchHalf", nativeBindings.capture.terminalMatchHalf);

  return deepFreeze({
    schema: "cssoccer-slice-plan@1",
    id: CSSOCCER_SLICE_ID,
    status: "ready",
    fixture: {
      id: fixture.id,
      sceneId: fixture.sceneId,
      homeTeamId: fixture.home.sourceTeamId,
      awayTeamId: fixture.away.sourceTeamId,
      competitionId: fixture.competition.id,
      simulationModeId: fixture.simulationMode.id,
      venueSourceStadiumEntryIndex: fixture.venue.sourceStadiumEntryIndex,
    },
    control: {
      country: controlCountry,
      nativeTeamSlot: controlTeam.nativeTeamSlot,
      nativeUserToken: controlTeam.nativeUserToken,
      requiredProfileKey,
    },
    timing: {
      halfDurationMinutes: duration.playMinutesPerHalf,
      durationMinutes: duration.fullMatchPlayMinutes,
      gameMinutesPerHalf: duration.gameMinutesPerHalf,
      timeFactor: duration.timeFactor,
      tickRateHz: duration.tickRateHz,
      gameClockSecondsPerTick: duration.gameClockSecondsPerTick,
      ticksPerHalf: duration.ticksPerHalf,
      fullMatchPlayTicks: duration.fullMatchPlayTicks,
      publiclyConfigurable: duration.publiclyConfigurable,
    },
    prepare: {
      mode: CSSOCCER_SOURCE_DATA.retainedScene.mode,
      coordinates: CSSOCCER_SOURCE_DATA.coordinates,
      staticObjectIds: CSSOCCER_SOURCE_DATA.retainedScene.staticObjectIds,
      actors: CSSOCCER_SOURCE_DATA.retainedScene.actors,
      archives: CSSOCCER_SOURCE_DATA.archives,
    },
    source: {
      revision: CSSOCCER_SOURCE_DATA.source.revision,
      sourceImportRevision: CSSOCCER_SOURCE_DATA.source.sourceImportRevision,
      files: CSSOCCER_SOURCE_DATA.source.files,
    },
    nativeProfileGate: {
      ready: true,
      requiredProfileKey,
      fixtureContractSha256: nativeBindings.fixtureContractSha256,
      scenarioSha256: nativeBindings.scenarioSha256,
      fieldContractSha256: nativeBindings.fieldContractSha256,
      capture: nativeBindings.capture,
      profile: selectedProfile,
    },
    excluded: CSSOCCER_SOURCE_DATA.excluded,
  });
}

function requirePlainRequest(request) {
  if (
    request === null
    || typeof request !== "object"
    || Array.isArray(request)
    || Object.getPrototypeOf(request) !== Object.prototype
  ) {
    throw new TypeError("cssoccer slice request must be a plain object");
  }
}

function requireFixed(request, key, expected) {
  if (own(request, key) && !Object.is(request[key], expected)) {
    throw new Error(`${key} is fixed at ${JSON.stringify(expected)} for ${CSSOCCER_SLICE_ID}`);
  }
}

function own(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function validateDescriptor(value) {
  if (value?.schema !== "cssoccer-static-source-data@1") {
    throw new Error("Unsupported cssoccer static source-data schema");
  }
  if (value.id !== "spain-argentina-full-match") {
    throw new Error("Static source-data must describe spain-argentina-full-match");
  }
  if (value.status !== "ready" || value.nativeProfileBindings?.status !== "ready") {
    throw new Error("Static source-data is not bound to the checked native profiles");
  }
  if (!/^[0-9a-f]{40}$/u.test(value.source?.revision ?? "")) {
    throw new Error("Static source-data is missing a pinned source revision");
  }
  if (
    value.fixture?.home?.country !== "spain"
    || value.fixture.home.sourceTeamId !== 2
    || value.fixture?.away?.country !== "argentina"
    || value.fixture.away.sourceTeamId !== 20
    || value.fixture?.competition?.id !== 0
    || value.fixture?.duration?.fullMatchPlayMinutes !== 2
    || value.fixture.duration.playMinutesPerHalf !== 1
    || value.fixture.duration.timeFactor !== 2
  ) {
    throw new Error("Static source-data widened or changed the fixed fixture");
  }

  const actorIds = value.retainedScene?.actors?.map(({ id }) => id) ?? [];
  if (actorIds.length !== 26 || new Set(actorIds).size !== actorIds.length) {
    throw new Error("Static source-data must retain 26 unique actor ids");
  }

  const staticObjectIds = value.retainedScene?.staticObjectIds ?? [];
  if (new Set(staticObjectIds).size !== staticObjectIds.length) {
    throw new Error("Static source-data contains duplicate static object ids");
  }

  validateNativeBindings(value.nativeProfileBindings, value.fixture);

  for (const archive of value.archives ?? []) {
    if (
      archive.data.byteRange[0] !== 0
      || archive.data.byteRange[1] !== archive.data.bytes
      || archive.index.byteRange[0] !== 0
      || archive.index.byteRange[1] !== archive.index.bytes
      || archive.index.records * value.archiveFormat.indexRecordBytes !== archive.index.bytes
      || archive.index.last.offset + archive.index.last.size !== archive.data.bytes
    ) {
      throw new Error(`Archive contract is internally inconsistent: ${archive.id}`);
    }
  }
}

function validateNativeBindings(bindings, fixture) {
  if (
    bindings?.schema !== "cssoccer-native-profile-bindings@1"
    || bindings.status !== "ready"
  ) {
    throw new Error("Native profile bindings are missing their checked parent integration contract");
  }
  const commonHashes = [
    "fixtureContractSha256",
    "oraclePatchSha256",
    "nativeDataSetSha256",
    "scenarioSha256",
    "fieldContractSha256",
    "seedSha256",
    "timingSha256",
  ];
  for (const key of commonHashes) requireSha256(bindings[key], `native binding ${key}`);
  const clockAdvanceCounts = bindings.capture?.clockAdvanceCounts;
  const liveBallOverrunTicks = bindings.capture?.liveBallOverrunTicks;
  const maximumOverrun = fixture.duration.liveBallOverrun?.maxTicksPerHalf;
  if (
    bindings.capture?.canonicalProfile !== "argentina-control"
    || bindings.capture?.terminalMatchHalf !== 11
    || bindings.capture?.ticks <= 0
    || bindings.capture?.terminalTick !== bindings.capture.ticks - 1
    || bindings.capture?.frameCount <= 0
    || bindings.capture?.regulationTicks !== fixture.duration.fullMatchPlayTicks
    || !Array.isArray(clockAdvanceCounts)
    || clockAdvanceCounts.length !== 2
    || !Array.isArray(liveBallOverrunTicks)
    || liveBallOverrunTicks.length !== 2
    || fixture.duration.liveBallOverrun?.allowed !== true
    || !Number.isInteger(maximumOverrun)
    || maximumOverrun < 0
    || clockAdvanceCounts.some((ticks, half) => (
      !Number.isInteger(ticks)
      || ticks < fixture.duration.ticksPerHalf
      || ticks - fixture.duration.ticksPerHalf !== liveBallOverrunTicks[half]
      || liveBallOverrunTicks[half] > maximumOverrun
    ))
    || bindings.capture?.playTicks !== clockAdvanceCounts[0] + clockAdvanceCounts[1]
    || bindings.capture?.fullMatchPlaySeconds
      !== bindings.capture.playTicks / fixture.duration.tickRateHz
  ) {
    throw new Error("Native capture binding does not cover the checked full-match lifecycle");
  }
  for (const key of ["rawSha256", "stateSha256", "phaseMarkersSha256", "framesSha256", "profileSha256", "buildSha256", "sourceSha256"]) {
    requireSha256(bindings.capture[key], `native capture ${key}`);
  }
  const expectedProfiles = {
    "spain-control": { country: fixture.home.country, teamSlot: fixture.home.nativeTeamSlot },
    "argentina-control": { country: fixture.away.country, teamSlot: fixture.away.nativeTeamSlot },
  };
  for (const [profileKey, expected] of Object.entries(expectedProfiles)) {
    const profile = bindings.profiles?.[profileKey];
    if (profile?.country !== expected.country || profile?.teamSlot !== expected.teamSlot) {
      throw new Error(`Native profile ${profileKey} changed country or team slot`);
    }
    for (const key of [
      "fixtureProfileSha256",
      "quickExecutableSha256",
      "fullMatchExecutableSha256",
      "rosterSha256",
      "tacticsSha256",
      "kitSha256",
    ]) {
      requireSha256(profile[key], `native profile ${profileKey} ${key}`);
    }
  }
  for (const key of [
    "quickRunnerPatchSetSha256",
    "fullRunnerPatchSetSha256",
    "executablePatchSetSha256",
    "inputAdapterSha256",
  ]) {
    requireSha256(bindings.patches?.[key], `native patches ${key}`);
  }
  if (!/^[0-9a-f]{40}$/u.test(bindings.transport?.revision ?? "")) {
    throw new Error("Native transport revision must be a pinned Git revision");
  }
  for (const key of ["binarySha256", "sourcePatchSha256"]) {
    requireSha256(bindings.transport?.[key], `native transport ${key}`);
  }
}

function requireSha256(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 value`);
  }
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
