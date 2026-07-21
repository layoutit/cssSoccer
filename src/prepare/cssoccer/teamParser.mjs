import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const fixtureContractUrl = new URL(
  "../../../references/spain-argentina-match.json",
  import.meta.url,
);
const sourceDataUrl = new URL(
  "../../../references/spain-argentina-source-data.json",
  import.meta.url,
);

const fixtureContract = JSON.parse(readFileSync(fixtureContractUrl, "utf8"));
const sourceData = JSON.parse(readFileSync(sourceDataUrl, "utf8"));

export const CSSOCCER_TEAM_PREPARATION_SCHEMA = "cssoccer-team-preparation@1";
export const CSSOCCER_FIXED_FIXTURE_CONTRACT = deepFreeze(fixtureContract);

const PINNED_FOOT_EXE = Object.freeze({
  bytes: 1_733_395,
  sha256: "64dfed661f808f33aa4228e60295a2c3342002011d8726362107b13d7c6a787f",
});
const PINNED_TEAM_PREPARATION_AUTHORITY_SHA256 =
  "6161360cb7ab3b23b2685f9646b02e5e1664389792017679112a28dbc8035128";

const UNSUPPORTED_CLASSES = Object.freeze([
  Object.freeze({
    id: "formation-position-records",
    reason:
      "The accepted fixture contract retains formation ids and a tactics hash, but not decoded formation coordinates.",
  }),
  Object.freeze({
    id: "team-kit-asset-payloads",
    reason:
      "Retail DATA.DAT and DATA.OFF now pin the team record ranges, but their payload semantics remain deliberately undecoded.",
  }),
]);

export function parseCssoccerFixtureTeams({
  filesBytes,
  definesHBytes,
  footExeBytes,
} = {}) {
  const contract = CSSOCCER_FIXED_FIXTURE_CONTRACT;
  const descriptor = sourceData;
  validateContracts(contract, descriptor);
  const filesSource = readPinnedSource(filesBytes, "FILES.C", descriptor);
  const definesSource = readPinnedSource(definesHBytes, "DEFINES.H", descriptor);
  const footSource = readRevisionSource(footExeBytes, "FOOT.EXE", PINNED_FOOT_EXE);
  const playerLayoutLineRange = validatePlayerRecordLayout(definesSource.text);
  const renderRecords = parseTeamRenderRecords(filesSource.text);
  const actorsByCountry = groupBy(
    descriptor.retainedScene.actors.filter(({ kind }) => kind === "player"),
    ({ country }) => country,
  );

  const teams = [contract.fixture.home, contract.fixture.away].map((fixtureTeam) => {
    const descriptorTeam = fixtureTeam.country === descriptor.fixture.home.country
      ? descriptor.fixture.home
      : descriptor.fixture.away;
    const renderRecord = renderRecords.get(fixtureTeam.sourceTeamId);
    if (!renderRecord) {
      throw new Error(`FILES.C has no teamlist entry for source team ${fixtureTeam.sourceTeamId}.`);
    }

    const expectedSymbols = [
      fixtureTeam.kitBinding.body,
      fixtureTeam.kitBinding.kit,
      fixtureTeam.kitBinding.limbs,
      fixtureTeam.kitBinding.numbers,
      fixtureTeam.kitBinding.kitPalette,
      fixtureTeam.kitBinding.bodyPalette,
      fixtureTeam.kitBinding.homeHighlight,
      fixtureTeam.kitBinding.awayHighlight,
    ];
    if (!sameValue(renderRecord.symbols, expectedSymbols)) {
      throw new Error(`FILES.C render symbols changed for ${fixtureTeam.country}.`);
    }
    if (!sameValue(descriptorTeam.sourceSymbols, kitSymbols(fixtureTeam.kitBinding))) {
      throw new Error(`Static source-data kit symbols disagree for ${fixtureTeam.country}.`);
    }
    validateKitBinding(fixtureTeam);

    const sourceRecord = footSource.buffer.subarray(
      fixtureTeam.sourceOffset,
      fixtureTeam.sourceOffset + contract.teamRecordLayout.bytes,
    );
    if (sourceRecord.length !== contract.teamRecordLayout.bytes) {
      throw new Error(`${fixtureTeam.country} FOOT.EXE team record is truncated.`);
    }
    const recordHashes = teamRecordHashes(sourceRecord, contract.teamRecordLayout);
    for (const [key, actual] of Object.entries(recordHashes)) {
      if (actual !== fixtureTeam.expected[key]) {
        throw new Error(`${fixtureTeam.country} ${key} does not match the accepted fixture contract.`);
      }
    }
    const identity = decodeTeamIdentity(sourceRecord);
    validateTeamIdentity(identity, fixtureTeam);
    const sourcePlayers = Array.from(
      { length: contract.teamRecordLayout.players },
      (_, sourceRosterIndex) => decodePlayerRecord({
        record: sourceRecord,
        sourceRosterIndex,
        teamOffset: fixtureTeam.sourceOffset,
        layout: contract.teamRecordLayout,
      }),
    );

    const actors = [...(actorsByCountry.get(fixtureTeam.country) ?? [])]
      .sort((left, right) => left.nativeRuntimeIndex - right.nativeRuntimeIndex);
    if (actors.length !== contract.teamRecordLayout.startersPerTeam) {
      throw new Error(`${fixtureTeam.country} must resolve exactly 11 retained starter actors.`);
    }
    const decodedStarterNames = sourcePlayers
      .slice(0, contract.teamRecordLayout.startersPerTeam)
      .map(({ name }) => name);
    if (!sameValue(decodedStarterNames, fixtureTeam.expected.starterNames)) {
      throw new Error(`${fixtureTeam.country} starter names changed in FOOT.EXE.`);
    }

    const starters = actors.map((actor, sourceRosterIndex) => ({
      ...sourcePlayers[sourceRosterIndex],
      id: actor.id,
      nativeRuntimeIndex: actor.nativeRuntimeIndex,
      nativeRendererIndex: actor.nativeRendererIndex,
    }));

    const assetSelectors = fixtureTeam.kitBinding.assetSelectors.map((binding) => {
      const descriptorBinding = descriptorTeam.teamAssetSelectors.find(
        ({ symbol }) => symbol === binding.symbol,
      );
      if (
        !descriptorBinding
        || descriptorBinding.selector !== binding.selector
        || descriptorBinding.recordIndex !== binding.selector / descriptor.archiveFormat.indexRecordBytes
      ) {
        throw new Error(`Team asset selector changed for ${binding.symbol}.`);
      }
      return {
        symbol: binding.symbol,
        selector: binding.selector,
        recordIndex: descriptorBinding.recordIndex,
        byteRange: descriptorBinding.byteRange,
        bytes: descriptorBinding.bytes,
        sha256: descriptorBinding.sha256,
        payloadStatus: "pinned-local-record-unparsed",
      };
    });

    return {
      id: `team-${fixtureTeam.country}`,
      country: fixtureTeam.country,
      label: fixtureTeam.label,
      sourceTeamId: fixtureTeam.sourceTeamId,
      nativeTeamSlot: fixtureTeam.nativeTeamSlot,
      nativeUserToken: descriptorTeam.nativeUserToken,
      sourceRecord: {
        file: contract.source.teamRecordSource,
        byteRange: [fixtureTeam.sourceOffset, fixtureTeam.sourceOffset + contract.teamRecordLayout.bytes],
        nativeRuntimeOffset: fixtureTeam.runtimeOffset,
        bytes: contract.teamRecordLayout.bytes,
        sha256: recordHashes.teamSha256,
      },
      identity,
      formation: {
        selected: identity.formation,
        automatic: identity.autoFormation,
        computer: identity.computerFormation,
        tacticsSha256: recordHashes.tacticsSha256,
        positionsStatus: "unsupported-not-retained-by-fixture-contract",
      },
      roster: {
        sourcePlayers: sourcePlayers.length,
        retainedStarters: starters.length,
        playerRecordBytes: contract.teamRecordLayout.playerBytes,
        rosterSha256: recordHashes.rosterSha256,
        startersSha256: recordHashes.startersSha256,
        starters,
      },
      kit: {
        bindingKind: fixtureTeam.kitBinding.kind,
        bigFlag: fixtureTeam.kitBinding.bigFlag,
        symbols: kitSymbols(fixtureTeam.kitBinding),
        assetSelectors,
        bindingSha256: fixtureTeam.kitBinding.sha256,
        payloadStatus: "pinned-local-records-unparsed",
      },
      lineage: {
        fixtureContract: "references/spain-argentina-match.json",
        fixtureContractSchema: contract.schema,
        filesSource: {
          file: "FILES.C",
          line: renderRecord.line,
          sha256: filesSource.sha256,
        },
        playerLayoutSource: {
          file: "DEFINES.H",
          lines: playerLayoutLineRange,
          sha256: definesSource.sha256,
        },
        teamRecordSource: {
          file: "FOOT.EXE",
          sha256: footSource.sha256,
        },
        sourceRevision: contract.source.revision,
      },
    };
  });

  const starters = teams.flatMap((team) => team.roster.starters);
  if (starters.length !== 22 || new Set(starters.map(({ id }) => id)).size !== 22) {
    throw new Error("Fixed fixture team preparation must retain 22 unique starters.");
  }

  const preparation = deepFreeze({
    schema: CSSOCCER_TEAM_PREPARATION_SCHEMA,
    fixtureId: contract.id,
    sourceRevision: contract.source.revision,
    counts: {
      teams: teams.length,
      sourceRosterPlayers: teams.reduce((sum, team) => sum + team.roster.sourcePlayers, 0),
      retainedStarters: starters.length,
      decodedStarterAttributeRecords: starters.length,
      supportedKitSymbolBindings: teams.length * 8,
      unresolvedKitAssetSelectors: teams.reduce(
        (sum, team) => sum + team.kit.assetSelectors.length,
        0,
      ),
    },
    teams,
    starters,
    authoritySha256: teamAuthoritySha256({ teams, starters }),
    sourceFiles: [
      { file: "FILES.C", sha256: filesSource.sha256 },
      { file: "DEFINES.H", sha256: definesSource.sha256 },
      { file: "FOOT.EXE", sha256: footSource.sha256 },
    ],
    unsupportedClasses: UNSUPPORTED_CLASSES,
  });
  assertCssoccerTeamPreparation(preparation);
  return preparation;
}

export function assertCssoccerTeamPreparation(value) {
  const contract = CSSOCCER_FIXED_FIXTURE_CONTRACT;
  if (
    value?.schema !== CSSOCCER_TEAM_PREPARATION_SCHEMA
    || value.fixtureId !== contract.id
    || value.sourceRevision !== contract.source.revision
    || value.teams?.length !== 2
    || value.starters?.length !== 22
    || value.authoritySha256 !== teamAuthoritySha256(value)
    || value.authoritySha256 !== PINNED_TEAM_PREPARATION_AUTHORITY_SHA256
  ) {
    throw new Error(
      `Team preparation is not the pinned fixed-fixture contract: expected authority ${PINNED_TEAM_PREPARATION_AUTHORITY_SHA256}, received ${String(value?.authoritySha256)}.`,
    );
  }

  const expectedFixtureTeams = [contract.fixture.home, contract.fixture.away];
  for (let teamIndex = 0; teamIndex < expectedFixtureTeams.length; teamIndex += 1) {
    const expected = expectedFixtureTeams[teamIndex];
    const team = value.teams[teamIndex];
    const expectedActors = sourceData.retainedScene.actors
      .filter(({ kind, country }) => kind === "player" && country === expected.country)
      .sort((left, right) => left.nativeRuntimeIndex - right.nativeRuntimeIndex);
    if (
      team?.id !== `team-${expected.country}`
      || team.country !== expected.country
      || team.sourceTeamId !== expected.sourceTeamId
      || team.nativeTeamSlot !== expected.nativeTeamSlot
      || team.sourceRecord?.sha256 !== expected.expected.teamSha256
      || team.roster?.rosterSha256 !== expected.expected.rosterSha256
      || team.roster?.startersSha256 !== expected.expected.startersSha256
      || team.kit?.bindingSha256 !== expected.kitBinding.sha256
      || !sameValue(team.kit?.symbols, kitSymbols(expected.kitBinding))
      || !sameValue(
        team.kit?.assetSelectors?.map(({ symbol, selector }) => ({ symbol, selector })),
        expected.kitBinding.assetSelectors,
      )
      || !sameValue(
        team.roster?.starters?.map((starter, index) => ({
          id: starter.id,
          name: starter.name,
          sourceRosterIndex: starter.sourceRosterIndex,
          nativeRuntimeIndex: starter.nativeRuntimeIndex,
          nativeRendererIndex: starter.nativeRendererIndex,
          sourceRecordByteRange: starter.sourceRecordByteRange,
        })),
        expectedActors.map((actor, index) => ({
          id: actor.id,
          name: expected.expected.starterNames[index],
          sourceRosterIndex: index,
          nativeRuntimeIndex: actor.nativeRuntimeIndex,
          nativeRendererIndex: actor.nativeRendererIndex,
          sourceRecordByteRange: [
            expected.sourceOffset + contract.teamRecordLayout.playerOffset + index * contract.teamRecordLayout.playerBytes,
            expected.sourceOffset + contract.teamRecordLayout.playerOffset + (index + 1) * contract.teamRecordLayout.playerBytes,
          ],
        })),
      )
    ) {
      throw new Error(`${expected.country} team preparation does not match its canonical roster or kit binding.`);
    }
  }
  const nestedStarters = value.teams.flatMap((team) => team.roster.starters);
  if (!sameValue(value.starters, nestedStarters)) {
    throw new Error("Team preparation top-level starters diverge from the canonical nested rosters.");
  }
  return value;
}

function teamAuthoritySha256({ teams, starters }) {
  return sha256(Buffer.from(canonicalJson({ teams, starters })));
}

function validateContracts(contract, descriptor) {
  if (
    contract?.schema !== "cssoccer-native-fixture-contract@1"
    || contract.id !== "spain-argentina-full-match"
    || descriptor?.schema !== "cssoccer-static-source-data@1"
    || descriptor.id !== contract.id
    || descriptor.source?.revision !== contract.source?.revision
  ) {
    throw new Error("Team preparation requires the pinned Spain-Argentina fixture contracts.");
  }
  if (
    contract.fixture?.home?.sourceTeamId !== 2
    || contract.fixture?.away?.sourceTeamId !== 20
    || contract.teamRecordLayout?.bytes !== 872
    || contract.teamRecordLayout?.playerOffset !== 144
    || contract.teamRecordLayout?.startersPerTeam !== 11
    || contract.teamRecordLayout?.players !== 22
    || contract.teamRecordLayout?.playerBytes !== 33
  ) {
    throw new Error("Team preparation fixture or team-record layout changed.");
  }
}

function validatePlayerRecordLayout(source) {
  const lines = source.split(/\r?\n/u);
  const start = lines.findIndex((line) => /^typedef\s+struct\s*$/u.test(line.trim()));
  const playerStart = lines.findIndex((line, index) => index >= start && /name\[PLAYER_NAME_LEN\+1\]/u.test(line));
  if (playerStart < 0) throw new Error("DEFINES.H is missing player_info.");
  const section = lines.slice(playerStart, playerStart + 20).join("\n");
  const expectedFields = [
    "goal_index", "pace", "power", "control", "flair", "vision", "accuracy", "stamina",
    "discipline", "flags", "squad_number", "position", "skin_tone",
  ];
  if (!/#define\s+PLAYER_NAME_LEN\s+19\b/u.test(source)) {
    throw new Error("DEFINES.H player name length changed.");
  }
  let cursor = -1;
  for (const field of expectedFields) {
    const next = section.indexOf(field);
    if (next <= cursor) throw new Error(`DEFINES.H player_info field order changed at ${field}.`);
    cursor = next;
  }
  if (!/\}\s*player_info\s*;/u.test(section)) {
    throw new Error("DEFINES.H player_info terminator changed.");
  }
  return [playerStart + 1, playerStart + section.split("\n").findIndex((line) => /player_info/u.test(line)) + 1];
}

function parseTeamRenderRecords(source) {
  const lines = source.split(/\r?\n/u);
  const start = lines.findIndex((line) => /teamk_info\s+teamlist\[\]\s*=\s*\{/u.test(line));
  if (start < 0) throw new Error("FILES.C is missing teamlist[].");

  const records = new Map();
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*\};\s*$/u.test(lines[index])) break;
    const match = lines[index].match(/^\s*\{([^{}]+)\},\s*\/\/\s*(\d+)\s*:\s*(.*?)\s*$/u);
    if (!match) continue;
    const symbols = match[1].split(",").map((symbol) => symbol.trim());
    if (symbols.length !== 8 || symbols.some((symbol) => !/^[A-Z][A-Z0-9_]*$/u.test(symbol))) {
      throw new Error(`FILES.C teamlist entry ${match[2]} has an unsupported shape.`);
    }
    records.set(Number(match[2]), {
      sourceTeamId: Number(match[2]),
      sourceLabel: match[3],
      symbols,
      line: index + 1,
    });
  }
  return records;
}

function decodeTeamIdentity(record) {
  return {
    name: readCString(record, 0, 23),
    coach: readCString(record, 23, 24),
    nickname: readCString(record, 92, 13),
    countryCode: readCString(record, 136, 3),
    ranking: record.readInt32LE(108),
    teamNumber: record.readInt32LE(112),
    playerControl: record.readInt8(116),
    fixtureNumber: record.readInt8(117),
    bigFlag: record.readInt32LE(120),
    formation: record.readInt32LE(124),
    autoFormation: record.readInt32LE(128),
    cupKey: record.readInt32LE(132),
    computerFormation: record.readInt32LE(140),
  };
}

function validateTeamIdentity(identity, fixtureTeam) {
  const expected = fixtureTeam.expected;
  for (const [actualKey, expectedKey] of [
    ["name", "name"], ["coach", "coach"], ["nickname", "nickname"],
    ["countryCode", "countryCode"], ["ranking", "ranking"], ["teamNumber", "teamNumber"],
    ["bigFlag", "bigFlag"], ["formation", "formation"], ["autoFormation", "autoFormation"],
    ["computerFormation", "computerFormation"],
  ]) {
    if (!sameValue(identity[actualKey], expected[expectedKey])) {
      throw new Error(`${fixtureTeam.country} ${actualKey} changed in FOOT.EXE.`);
    }
  }
}

function decodePlayerRecord({ record, sourceRosterIndex, teamOffset, layout }) {
  const offset = layout.playerOffset + sourceRosterIndex * layout.playerBytes;
  const bytes = record.subarray(offset, offset + layout.playerBytes);
  const absoluteStart = teamOffset + offset;
  return {
    name: readCString(bytes, 0, 20),
    sourceRosterIndex,
    goalIndex: bytes.readInt8(20),
    attributes: {
      pace: bytes.readInt8(21),
      power: bytes.readInt8(22),
      control: bytes.readInt8(23),
      flair: bytes.readInt8(24),
      vision: bytes.readInt8(25),
      accuracy: bytes.readInt8(26),
      stamina: bytes.readInt8(27),
      discipline: bytes.readInt8(28),
    },
    flags: bytes.readInt8(29),
    squadNumber: bytes.readInt8(30),
    position: bytes.readInt8(31),
    skinTone: bytes.readInt8(32),
    sourceRecordByteRange: [absoluteStart, absoluteStart + layout.playerBytes],
    sourceRecordSha256: sha256(bytes),
  };
}

function teamRecordHashes(record, layout) {
  return {
    teamSha256: sha256(record),
    rosterSha256: sha256(record.subarray(layout.playerOffset)),
    startersSha256: sha256(
      record.subarray(layout.playerOffset, layout.playerOffset + layout.startersPerTeam * layout.playerBytes),
    ),
    tacticsSha256: sha256(Buffer.concat([record.subarray(124, 136), record.subarray(140, 144)])),
  };
}

function validateKitBinding(fixtureTeam) {
  const { kind, sha256: expectedHash, ...binding } = fixtureTeam.kitBinding;
  if (kind !== "source-symbol-and-selector-binding-no-payload-claim") {
    throw new Error(`${fixtureTeam.country} kit binding overclaims missing payload bytes.`);
  }
  if (sha256(Buffer.from(canonicalJson(binding))) !== expectedHash) {
    throw new Error(`${fixtureTeam.country} kit binding hash changed.`);
  }
}

function kitSymbols(binding) {
  return {
    body: binding.body,
    kit: binding.kit,
    limbs: binding.limbs,
    numbers: binding.numbers,
    kitPalette: binding.kitPalette,
    bodyPalette: binding.bodyPalette,
    homeHighlight: binding.homeHighlight,
    awayHighlight: binding.awayHighlight,
  };
}

function readCString(bytes, offset, length) {
  const end = bytes.indexOf(0, offset);
  const boundedEnd = end >= offset && end < offset + length ? end : offset + length;
  return bytes.subarray(offset, boundedEnd).toString("latin1");
}

function readPinnedSource(value, file, descriptor) {
  const expected = descriptor.source.files.find(({ name }) => name === file);
  if (!expected) throw new Error(`Static source-data does not pin ${file}.`);
  return readRevisionSource(value, file, expected);
}

function readRevisionSource(value, file, expected) {
  const buffer = toBuffer(value, file);
  const digest = sha256(buffer);
  if (buffer.length !== expected.bytes || digest !== expected.sha256) {
    throw new Error(`${file} does not match pinned source revision ${sourceData.source.revision}.`);
  }
  return { buffer, text: buffer.toString("latin1"), sha256: digest };
}

function toBuffer(value, label) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  throw new TypeError(`${label} must be supplied as source bytes.`);
}

function groupBy(values, selector) {
  const groups = new Map();
  for (const value of values) {
    const key = selector(value);
    const group = groups.get(key);
    if (group) group.push(value);
    else groups.set(key, [value]);
  }
  return groups;
}

function sameValue(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
