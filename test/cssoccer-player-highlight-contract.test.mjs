import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  CSSOCCER_PLAYER_HIGHLIGHT_BLINK_MODES,
  CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT,
  CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT_SCHEMA,
  CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT_SHA256,
  CSSOCCER_PLAYER_HIGHLIGHT_FACING_MODES,
  CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES,
  CSSOCCER_PLAYER_HIGHLIGHT_TYPES,
  cssoccerPlayerHighlightType,
} from "../src/cssoccer/playerHighlightContract.mjs";
import {
  decodeActuaFaceList,
  decodeActuaPointList,
  decodeWatcomOmf32Object,
} from "../src/prepare/cssoccer/formatAdapters.mjs";

const ROOT = new URL("../", import.meta.url);
const SOURCE_ROOT = new URL(".local/actua-soccer/source/", ROOT);
const ORACLE_SOURCE_URL = new URL("references/actua-soccer-oracle.json", ROOT);
const CONTRACT_SOURCE_URL = new URL(
  "src/cssoccer/playerHighlightContract.mjs",
  ROOT,
);
const RETAINED_ROOT = new URL(
  ".local/cssoccer/oracle/native/retained/runs/canonical-a/",
  ROOT,
);
const RETAINED_URLS = Object.freeze({
  profile: new URL("profile.json", RETAINED_ROOT),
  raw: new URL("native.raw", RETAINED_ROOT),
  frames: new URL("frames.json", RETAINED_ROOT),
  frame500: new URL("frames/frame_0005.png", RETAINED_ROOT),
});
const RETAINED_HASHES = Object.freeze({
  profile: "2606546e05af77f400dcb77be5c4cc08b1e00f96beb927d868affc778a0da6da",
  raw: "1b46cb63a708d6af237d3af91d6c5846bc456e93ef6b5d731a1d36cbcaffabdb",
  frames: "77bbd34f6de060995fd8e2d5c5eb2aa9dd23f1ce88cb793b77d2657eef4c85f2",
  frame500: "541f792f38783838ed2b3ed25ef11dc32e6d83ebd3e0ebe0a6659eb69a87ec7d",
});
const RETAINED_INTERNAL_BINDINGS = Object.freeze({
  profileSha256: "ea2df6e20494efbaa95e3d292db2a25969d8dc0c255d0d7c2c6393f8a5713acc",
  buildSha256: "5db9d52f4dec6e71d2a1df1009c803967455a3683b1c87e271669165ef43a3e3",
  scenarioSha256: "5fc29151faf3ff344c37562b42148322ae0b976385cd8615fcccfcf8b529eb81",
});
const HIGHLIGHT_BRANCH_RAW = Object.freeze({
  control: 46,
  shootingRange: 47,
  special: 51,
  intelligenceMove: 191,
  inCrossArea: 0x3e414,
  ballPossession: 0x3e430,
});
const sourceOptions = skipUnless(
  [
    ORACLE_SOURCE_URL,
    ...CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT.source.files.map(({ file }) => (
      new URL(file, SOURCE_ROOT)
    )),
  ],
  "pinned Actua source and compiled objects",
);
const retainedOptions = skipUnless(
  Object.values(RETAINED_URLS),
  "retained canonical native highlight evidence",
);

test("player highlight contract freezes seven native states behind stable browser ids", () => {
  const contract = CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT;
  assert.equal(contract.schema, CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT_SCHEMA);
  assert.equal(contract.subsystemId, "player-highlight");
  assert.deepEqual(CSSOCCER_PLAYER_HIGHLIGHT_TYPES, {
    OFF: 0,
    NORM: 1,
    CROSS: 2,
    BALL: 3,
    SHOOT: 4,
    STAR: 5,
    SPECIAL: 6,
  });
  assert.deepEqual(contract.counts, {
    types: 7,
    markerFamilies: 4,
    colourSlots: 6,
  });
  assert.deepEqual(
    contract.types.map(({ symbol, nativeValue, id, semantic }) => ({
      symbol,
      nativeValue,
      id,
      semantic,
    })),
    [
      ["HLITE_OFF", 0, "player-highlight-off", "off"],
      ["HLITE_NORM", 1, "player-highlight-normal", "normal"],
      ["HLITE_CROSS", 2, "player-highlight-cross", "cross"],
      ["HLITE_BALL", 3, "player-highlight-ball", "ball"],
      ["HLITE_SHOOT", 4, "player-highlight-shoot", "shoot"],
      ["HLITE_STAR", 5, "player-highlight-star", "star"],
      ["HLITE_SPECIAL", 6, "player-highlight-special", "special"],
    ].map(([symbol, nativeValue, id, semantic]) => ({
      symbol,
      nativeValue,
      id,
      semantic,
    })),
  );
  assert.equal(new Set(contract.types.map(({ id }) => id)).size, 7);
  assert.equal(cssoccerPlayerHighlightType(3).semantic, "ball");
  assert.equal(cssoccerPlayerHighlightType(6).semantic, "special");
  assert.throws(() => cssoccerPlayerHighlightType(7), /0\.\.6/u);
  assert.throws(() => cssoccerPlayerHighlightType(1.5), /integer/u);
  assertDeepFrozen(contract);
  assertDeepFrozen(CSSOCCER_PLAYER_HIGHLIGHT_TYPES);
  assertDeepFrozen(CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES);
  assertDeepFrozen(CSSOCCER_PLAYER_HIGHLIGHT_FACING_MODES);
  assertDeepFrozen(CSSOCCER_PLAYER_HIGHLIGHT_BLINK_MODES);
  assert.equal(
    sha256(Buffer.from(JSON.stringify(contract))),
    CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT_SHA256,
  );
});

test("families, facing, blink, render order, and shadow exclusion are source-owned", () => {
  const contract = CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT;
  assert.deepEqual(
    contract.markerFamilies.map(({ id, sourceName, typeValues }) => ({
      id,
      sourceName,
      typeValues,
    })),
    [
      {
        id: CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES.NORMAL,
        sourceName: "plhi1",
        typeValues: [1],
      },
      {
        id: CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES.CROSS,
        sourceName: "plhi2",
        typeValues: [2],
      },
      {
        id: CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES.BALL_SHOOT,
        sourceName: "plhi3",
        typeValues: [3, 4],
      },
      {
        id: CSSOCCER_PLAYER_HIGHLIGHT_FAMILIES.STAR_SPECIAL,
        sourceName: "plhi4",
        typeValues: [5, 6],
      },
    ],
  );
  assert.deepEqual(
    contract.types.map(({ facingMode }) => facingMode),
    ["none", "field-aligned", "field-aligned", "player-facing", "player-facing", "field-aligned", "field-aligned"],
  );
  assert.deepEqual(
    contract.types.map(({ blinkMode }) => blinkMode),
    ["hidden", "steady", "steady", "steady", "source-half-cycle", "steady", "source-half-cycle"],
  );
  assert.deepEqual(contract.phase, {
    id: "player-highlight-source-render-phase",
    modulus: 4,
    visibleStartInclusive: 2,
    visibleEndExclusive: 4,
    sourceIncrement: "log_factor",
    advanceStage: "render",
    sourceAnchorId: "highlight-render-rules",
  });
  assert.deepEqual(contract.sourceOrder.state, [
    "new_users",
    "select_all_hlites",
    "publish_player_render_data",
  ]);
  assert.deepEqual(contract.sourceOrder.render, [
    "pitch_markings",
    "ordinary_shadows",
    "player_highlights",
    "players",
  ]);
  assert.deepEqual(contract.shadowPolicy.ordinaryShadowEligibleTypeValues, [0]);
  assert.deepEqual(contract.shadowPolicy.ordinaryShadowSuppressedTypeValues, [1, 2, 3, 4, 5, 6]);
  assert.ok(contract.types.slice(1).every(({ ordinaryShadow }) => ordinaryShadow === "suppressed"));
  assertSourceAnchorsResolve(contract);
});

test("pinned source, object geometry, and colour-slot reuse agree", sourceOptions, () => {
  const contract = CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT;
  const oracle = JSON.parse(readFileSync(ORACLE_SOURCE_URL, "utf8"));
  assert.equal(oracle.revision, contract.source.repositoryRevision);
  assert.equal(oracle.sourceImportRevision, contract.source.sourceImportRevision);

  for (const source of contract.source.files) {
    assert.equal(
      sha256(readFileSync(new URL(source.file, SOURCE_ROOT))),
      source.sha256,
      source.file,
    );
  }

  const actions = readFileSync(new URL("ACTIONS.CPP", SOURCE_ROOT), "latin1");
  assertOrdered(actions, [
    "player->tm_hcol=u-1",
    "if (ball_poss==player->tm_player)",
    "if (in_cross_area)",
    "player->tm_htype=HLITE_CROSS",
    "if (player->tm_srng)",
    "player->tm_htype=HLITE_SHOOT",
    "player->tm_htype=HLITE_BALL",
    "player->special>0 && player->int_move==I_INTERCEPT",
    "player->tm_htype=HLITE_SPECIAL",
    "player->special<0 && player->int_move==I_INTERCEPT",
    "player->tm_htype=HLITE_STAR",
    "player->tm_htype=HLITE_NORM",
  ]);
  assertOrdered(actions, [
    "char hcol=1",
    "select_hlite(&teams[users[p].type-1],hcol)",
    "hcol++",
  ]);

  const football = readFileSync(new URL("FOOTBALL.CPP", SOURCE_ROOT), "latin1");
  assertOrdered(football, ["new_users();", "select_all_hlites();"]);

  const playerLayout = readFileSync(new URL("ANDYDEFS.H", SOURCE_ROOT), "latin1");
  assert.match(
    playerLayout,
    /unsigned short tm_anim;\s*unsigned char tm_hcol,tm_htype;\s*float tm_mcspd;/u,
  );

  const publication = readFileSync(new URL("3D_UPD2.CPP", SOURCE_ROOT), "latin1");
  assertOrdered(publication, [
    "ptr->htype=(float)teams[i].tm_htype",
    "ptr->hcol=(float)teams[i].tm_hcol",
  ]);

  const renderer = readFileSync(new URL("3DENG.C", SOURCE_ROOT), "latin1");
  assertOrdered(renderer, [
    "//// SHADOWS/HIGHLIGHTS",
    "if (plyrpt->type&&!plyrpt->htype&&setup.detail.players)",
    "hcoo+=log_factor",
    "while (hcoo>=4) hcoo-=4",
    "plyrpt->htype!=4 && plyrpt->htype!=6",
    "plyrpt->htype==3 || plyrpt->htype==4",
    "//// PLAYERS",
  ]);
  for (const [typeValue, familyName] of [
    [1, "plhi1"],
    [2, "plhi2"],
    [3, "plhi3"],
    [4, "plhi3"],
    [5, "plhi4"],
    [6, "plhi4"],
  ]) {
    assert.match(
      renderer,
      new RegExp(`initobj\\(&plhilight\\[${typeValue}\\]\\[0\\],plhi_p,${familyName}_f1`, "u"),
    );
  }

  const compiledActions = readFileSync(new URL("ACTIONS.OBJ", SOURCE_ROOT));
  assert.equal(compiledActions.length, 139_665);
  for (const [symbol, fileOffset, immediate] of [
    ["HLITE_CROSS", 102_448, 2],
    ["HLITE_SHOOT", 102_466, 4],
    ["HLITE_BALL", 102_475, 3],
    ["HLITE_SPECIAL", 102_516, 6],
    ["HLITE_STAR", 102_557, 5],
    ["HLITE_NORM", 102_566, 1],
  ]) {
    assert.equal(
      compiledActions.subarray(fileOffset, fileOffset + 4).toString("hex"),
      `c6407a${immediate.toString(16).padStart(2, "0")}`,
      symbol,
    );
  }

  const dataObject = decodeWatcomOmf32Object(
    readFileSync(new URL("DATA.OBJ", SOURCE_ROOT)),
    { label: "DATA.OBJ" },
  );
  const points = decodeActuaPointList(dataObject.symbolBytes("plhi_p"), {
    id: "plhi_p",
  });
  assert.equal(points.sha256, contract.geometry.sourcePointListSha256);
  assert.deepEqual(points.points, [
    [-contract.geometry.halfExtent, 0, -contract.geometry.halfExtent],
    [-contract.geometry.halfExtent, 0, contract.geometry.halfExtent],
    [contract.geometry.halfExtent, 0, contract.geometry.halfExtent],
    [contract.geometry.halfExtent, 0, -contract.geometry.halfExtent],
  ]);
  assert.equal(contract.geometry.width, contract.geometry.halfExtent * 2);
  assert.equal(contract.geometry.depth, contract.geometry.halfExtent * 2);

  for (const colour of contract.colourSlots) {
    for (const family of contract.markerFamilies) {
      const symbol = `${family.sourceName}_${colour.sourceFaceSuffix}`;
      const faceList = decodeActuaFaceList(dataObject.symbolBytes(symbol), {
        id: symbol,
        pointCount: points.pointCount,
      });
      assert.equal(faceList.faceCount, 1);
      assert.equal(
        faceList.faces[0].sourceColorCode,
        colour.sourceColorCodes[family.sourceTextureColumn],
        symbol,
      );
    }
  }
  assert.deepEqual(
    contract.colourSlots.map(({ textureBankId }) => textureBankId),
    [
      "player-highlight-colour-bank-0",
      "player-highlight-colour-bank-1",
      "player-highlight-colour-bank-2",
      "player-highlight-colour-bank-3",
      "player-highlight-colour-bank-3",
      "player-highlight-colour-bank-3",
    ],
  );
});

test("retained layout decodes canonical normal, ball, and special transitions", retainedOptions, () => {
  const evidence = readRetainedEvidence();
  assert.equal(evidence.recordCount, 2_904);
  assert.equal(evidence.byTick.size, 2_725);
  assert.deepEqual([...evidence.byTick.keys()], range(0, 2_724));
  assert.deepEqual([...evidence.typeCounts.entries()].sort(([left], [right]) => left - right), [
    [0, 58_360],
    [1, 1_377],
    [3, 173],
    [6, 40],
  ]);

  assert.deepEqual(activeHighlights(evidence.byTick.get(500)), [
    { nativePlayerNumber: 13, hcol: 0, htype: 1 },
  ]);
  assert.equal(cssoccerPlayerHighlightType(1).semantic, "normal");

  assert.deepEqual(activeHighlights(evidence.byTick.get(846)), []);
  assert.deepEqual(activeHighlights(evidence.byTick.get(847)), [
    { nativePlayerNumber: 18, hcol: 0, htype: 3 },
  ]);
  assert.deepEqual(readHighlightBranch(evidence.byTick.get(847), 18), {
    control: 1,
    shootingRange: 0,
    special: 0,
    intelligenceMove: 12,
    inCrossArea: 0,
    ballPossession: 18,
  });
  assert.equal(cssoccerPlayerHighlightType(3).semantic, "ball");

  assert.deepEqual(activeHighlights(evidence.byTick.get(178)), [
    { nativePlayerNumber: 21, hcol: 0, htype: 1 },
  ]);
  assert.deepEqual(activeHighlights(evidence.byTick.get(179)), [
    { nativePlayerNumber: 21, hcol: 0, htype: 6 },
  ]);
  assert.deepEqual(readHighlightBranch(evidence.byTick.get(179), 21), {
    control: 1,
    shootingRange: 0,
    special: 1,
    intelligenceMove: 1,
    inCrossArea: 0,
    ballPossession: 0,
  });
  assert.equal(cssoccerPlayerHighlightType(6).semantic, "special");

  const frame500 = evidence.frames.frames.find(({ tick }) => tick === 500);
  assert.deepEqual(frame500, {
    index: 5,
    tick: 500,
    phaseChanged: false,
    kickoff: false,
    terminal: false,
    filename: "frame_0005.png",
    width: 640,
    height: 400,
    sha256: RETAINED_HASHES.frame500,
  });
});

test("retained raw and match_player layout drift fail closed", retainedOptions, () => {
  const profileBytes = readFileSync(RETAINED_URLS.profile);
  const rawBytes = readFileSync(RETAINED_URLS.raw);
  const profile = JSON.parse(profileBytes.toString("utf8"));

  const changedRaw = Buffer.from(rawBytes);
  changedRaw[changedRaw.length - 1] ^= 1;
  assert.throws(
    () => parseRetainedRaw(changedRaw, profile),
    /retained native raw hash changed/u,
  );

  const changedLayout = structuredClone(profile);
  changedLayout.transport.matchPlayerStructSha256 = "0".repeat(64);
  assert.throws(
    () => assertRetainedProfile(changedLayout),
    /match_player layout changed/u,
  );

  const changedRanges = structuredClone(profile);
  changedRanges.transport.rawRanges[3].bytes -= 1;
  assert.throws(
    () => parseRetainedRaw(rawBytes, changedRanges),
    /range 3 changed/u,
  );
});

test("browser contract contains metadata only and no source or evidence dependency", () => {
  const source = readFileSync(CONTRACT_SOURCE_URL, "utf8");
  assert.doesNotMatch(source, /^\s*import\b/mu);
  assert.doesNotMatch(
    source,
    /node:fs|readFile|existsSync|\.local\/|references\/|native\.raw|state\.jsonl|data:image|<svg/iu,
  );
  assert.doesNotMatch(source, /selectionCircle|sel_circle|box-shadow|radial-gradient|linear-gradient/iu);
  visit(CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT, (key) => {
    assert.ok(
      !new Set(["payload", "pixels", "imageData", "dataUrl", "sample", "tick"]).has(key),
      `forbidden contract key ${key}`,
    );
  });
});

function readRetainedEvidence() {
  const profileBytes = readFileSync(RETAINED_URLS.profile);
  const rawBytes = readFileSync(RETAINED_URLS.raw);
  const framesBytes = readFileSync(RETAINED_URLS.frames);
  assert.equal(sha256(profileBytes), RETAINED_HASHES.profile);
  assert.equal(sha256(framesBytes), RETAINED_HASHES.frames);
  assert.equal(sha256(readFileSync(RETAINED_URLS.frame500)), RETAINED_HASHES.frame500);
  const profile = JSON.parse(profileBytes.toString("utf8"));
  const frames = JSON.parse(framesBytes.toString("utf8"));
  assertRetainedProfile(profile);
  const parsed = parseRetainedRaw(rawBytes, profile);
  return { ...parsed, profile, frames };
}

function assertRetainedProfile(profile) {
  const layout = CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT.retainedLayout;
  assert.equal(profile.schema, "cssoccer-native-capture-profile@1");
  assert.equal(profile.profileSha256, RETAINED_INTERNAL_BINDINGS.profileSha256);
  assert.equal(profile.buildSha256, RETAINED_INTERNAL_BINDINGS.buildSha256);
  assert.equal(profile.binding.scenarioSha256, RETAINED_INTERNAL_BINDINGS.scenarioSha256);
  assert.equal(profile.transport.rawSchema, layout.schema);
  assert.equal(profile.transport.rawVersion, layout.version);
  assert.equal(
    profile.transport.matchPlayerStructSha256,
    layout.structSha256,
    "match_player layout changed",
  );
}

function parseRetainedRaw(bytes, profile) {
  assert.equal(sha256(bytes), RETAINED_HASHES.raw, "retained native raw hash changed");
  const layout = CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT.retainedLayout;
  assert.equal(bytes.subarray(0, 8).toString("ascii"), layout.schema);
  assert.equal(bytes.readUInt32LE(8), layout.version);
  const rangeCount = bytes.readUInt32LE(12);
  assert.equal(rangeCount, profile.transport.rawRanges.length);
  const ranges = [];
  let cursor = 16;
  let payloadBytes = 0;
  for (let index = 0; index < rangeCount; index += 1) {
    const offset = bytes.readUInt32LE(cursor);
    const size = bytes.readUInt32LE(cursor + 4);
    const expected = profile.transport.rawRanges[index];
    assert.deepEqual(
      { offset, bytes: size },
      expected,
      `retained native raw range ${index} changed`,
    );
    ranges.push({ offset, size, payloadBase: payloadBytes });
    payloadBytes += size;
    cursor += 8;
  }
  const metadataBytes = 28;
  const recordBytes = metadataBytes + payloadBytes;
  assert.equal((bytes.length - cursor) % recordBytes, 0);
  const recordCount = (bytes.length - cursor) / recordBytes;
  const byTick = new Map();
  const typeCounts = new Map();
  for (let index = 0; index < recordCount; index += 1) {
    const recordOffset = cursor + index * recordBytes;
    assert.equal(bytes.subarray(recordOffset, recordOffset + 4).toString("ascii"), "TIK1");
    assert.equal(bytes.readUInt32LE(recordOffset + 4), index);
    const tick = bytes.readUInt32LE(recordOffset + 20);
    const flags = bytes.readUInt32LE(recordOffset + 24);
    if ((flags & 1) === 0) continue;
    assert.equal(byTick.has(tick), false, `duplicate active tick ${tick}`);
    const record = Object.freeze({
      bytes,
      ranges,
      payloadOffset: recordOffset + metadataBytes,
      tick,
    });
    byTick.set(tick, record);
    for (let playerIndex = 0; playerIndex < layout.playerCount; playerIndex += 1) {
      const player = readHighlightPlayer(record, playerIndex + 1);
      typeCounts.set(player.htype, (typeCounts.get(player.htype) ?? 0) + 1);
    }
  }
  return { byTick, recordBytes, recordCount, typeCounts };
}

function activeHighlights(record) {
  return Array.from(
    { length: CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT.retainedLayout.playerCount },
    (_, index) => readHighlightPlayer(record, index + 1),
  ).filter(({ htype }) => htype !== CSSOCCER_PLAYER_HIGHLIGHT_TYPES.OFF);
}

function readHighlightPlayer(record, nativePlayerNumber) {
  const layout = CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT.retainedLayout;
  const base = layout.teamsOffset + (nativePlayerNumber - 1) * layout.playerBytes;
  const hcolField = layout.fields.find(({ sourceName }) => sourceName === "tm_hcol");
  const htypeField = layout.fields.find(({ sourceName }) => sourceName === "tm_htype");
  return {
    nativePlayerNumber,
    hcol: readRaw(record, base + hcolField.relativeOffset, "u8"),
    htype: readRaw(record, base + htypeField.relativeOffset, "u8"),
  };
}

function readHighlightBranch(record, nativePlayerNumber) {
  const layout = CSSOCCER_PLAYER_HIGHLIGHT_CONTRACT.retainedLayout;
  const base = layout.teamsOffset + (nativePlayerNumber - 1) * layout.playerBytes;
  return {
    control: readRaw(record, base + HIGHLIGHT_BRANCH_RAW.control, "u8"),
    shootingRange: readRaw(record, base + HIGHLIGHT_BRANCH_RAW.shootingRange, "u8"),
    special: readRaw(record, base + HIGHLIGHT_BRANCH_RAW.special, "i16"),
    intelligenceMove: readRaw(record, base + HIGHLIGHT_BRANCH_RAW.intelligenceMove, "i16"),
    inCrossArea: readRaw(record, HIGHLIGHT_BRANCH_RAW.inCrossArea, "i32"),
    ballPossession: readRaw(record, HIGHLIGHT_BRANCH_RAW.ballPossession, "i32"),
  };
}

function readRaw(record, offset, valueType) {
  const width = valueType === "u8" ? 1 : valueType === "i16" ? 2 : 4;
  const rangeEntry = record.ranges.find((range) => (
    offset >= range.offset && offset + width <= range.offset + range.size
  ));
  assert.ok(rangeEntry, `raw offset 0x${offset.toString(16)} is retained`);
  const position = record.payloadOffset + rangeEntry.payloadBase + offset - rangeEntry.offset;
  if (valueType === "u8") return record.bytes.readUInt8(position);
  if (valueType === "i16") return record.bytes.readInt16LE(position);
  if (valueType === "i32") return record.bytes.readInt32LE(position);
  throw new Error(`Unsupported retained raw type ${valueType}.`);
}

function assertSourceAnchorsResolve(contract) {
  const anchors = new Set(contract.source.anchors.map(({ id }) => id));
  visit(contract, (key, value) => {
    if (key === "sourceAnchorId") assert.equal(anchors.has(value), true, value);
    if (key === "sourceAnchorIds" || key === "stateAnchorIds") {
      assert.ok(value.every((id) => anchors.has(id)), value.join(", "));
    }
  });
}

function assertOrdered(source, needles) {
  let cursor = -1;
  for (const needle of needles) {
    const next = source.indexOf(needle, cursor + 1);
    assert.ok(next > cursor, `${needle} must follow the prior source anchor`);
    cursor = next;
  }
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function skipUnless(urls, reason) {
  return { skip: urls.some((url) => !existsSync(url)) ? reason : false };
}

function assertDeepFrozen(value, path = "contract") {
  if (!value || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true, `${path} must be frozen`);
  for (const [key, child] of Object.entries(value)) {
    assertDeepFrozen(child, `${path}.${key}`);
  }
}

function visit(value, visitor) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    visitor(key, child);
    visit(child, visitor);
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
