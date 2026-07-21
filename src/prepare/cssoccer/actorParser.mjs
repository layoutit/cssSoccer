import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  decodeActuaFaceList,
  decodeActuaPointList,
  decodeWatcomOmf32Object,
} from "./formatAdapters.mjs";
import { CSSOCCER_ANIMATION_TABLE_SCHEMA } from "./animationTable.mjs";
import {
  CSSOCCER_EXACT_ACTUA_PLAYER_SEQUENCES_SCHEMA,
  prepareCssoccerExactActuaPlayerSequences,
} from "./exactActuaPlayerSequences.mjs";
import { assertCssoccerTeamPreparation } from "./teamParser.mjs";

const sourceDataUrl = new URL(
  "../../../references/spain-argentina-source-data.json",
  import.meta.url,
);
const sourceData = JSON.parse(readFileSync(sourceDataUrl, "utf8"));

export const CSSOCCER_ACTOR_PREPARATION_SCHEMA = "cssoccer-actor-preparation@1";
export const CSSOCCER_SOURCE_PLAYER_MODELS_PREPARATION_SCHEMA =
  "cssoccer-source-player-models@1";

const PINNED_3D_UPD2 = Object.freeze({
  bytes: 46_438,
  sha256: "af2009e0787951cb3d7471cef1fb307598069e80f3fa558d4c5dd72026c36714",
});
const PINNED_DATA_OBJECT = Object.freeze({
  bytes: 28_660,
  sha256: "af643e660c93c51d0abe3ee7ef3ac276918fabfd9766af15e309df18776d873b",
});
const PINNED_FOOTY_PALETTE = Object.freeze({
  bytes: 768,
  sha256: "73918cecf278e00172e0607053cd8c62e9c4172f70b7cb8e8884d2261a9ae436",
});
const PLAYER_POINT_COUNT = 28;
const RETAINED_STATE_ARTIFACT_SHA256 =
  "eb858bed9ad9d36670e97a98ea49235d8009246ded16e00dcb54c5dc1aef2fdd";
const PLAYER_MODEL_SYMBOLS = Object.freeze([
  "player_f1",
  "player_f2",
  "player_fr",
  "player_fl",
]);
// Exact actor packages own every person model; the older per-frame render-asset
// selection intentionally contains no person geometry.
const PRODUCT_RENDER_MODEL_SYMBOLS = Object.freeze([]);
const EXACT_PLAYER_RENDER_ASSET_ID = "exact-actua-player-one-basis";
const EXACT_OFFICIAL_RENDER_ASSET_ID = "exact-actua-official-one-basis";
// Exact texture blocks documented by 3DENG.C's TEXTURE MAP INFO table.  The
// block bounds are the source comment's start/end values; the authored slot is
// the centered texture selected by DATA.OBJ before add3dcmap/add3demap applies
// its view-dependent offset.
const PLAYER_TEXTURE_BLOCKS = deepFreeze([
  { sourceLabel: "Head A", firstSlot: 1, endSlotExclusive: 61, authoredSlot: 13 },
  { sourceLabel: "Head B", firstSlot: 61, endSlotExclusive: 121, authoredSlot: 73 },
  { sourceLabel: "Torso A", firstSlot: 121, endSlotExclusive: 181, authoredSlot: 133 },
  { sourceLabel: "Torso B", firstSlot: 181, endSlotExclusive: 241, authoredSlot: 193 },
  { sourceLabel: "Lower Leg A", firstSlot: 241, endSlotExclusive: 248, authoredSlot: 244 },
  { sourceLabel: "Upper Arm A", firstSlot: 248, endSlotExclusive: 255, authoredSlot: 251 },
  { sourceLabel: "Upper Leg A", firstSlot: 255, endSlotExclusive: 262, authoredSlot: 258 },
  { sourceLabel: "Lower Arm A", firstSlot: 262, endSlotExclusive: 269, authoredSlot: 265 },
  { sourceLabel: "Lower Leg B", firstSlot: 269, endSlotExclusive: 276, authoredSlot: 272 },
  { sourceLabel: "Upper Arm B", firstSlot: 276, endSlotExclusive: 283, authoredSlot: 279 },
  { sourceLabel: "Upper Leg B", firstSlot: 283, endSlotExclusive: 290, authoredSlot: 286 },
  { sourceLabel: "Lower Arm B", firstSlot: 290, endSlotExclusive: 297, authoredSlot: 293 },
  { sourceLabel: "Foot", firstSlot: 297, endSlotExclusive: 357, authoredSlot: 309 },
  { sourceLabel: "Torso Referee", firstSlot: 357, endSlotExclusive: 417, authoredSlot: 369 },
  { sourceLabel: "Torso Keeper", firstSlot: 417, endSlotExclusive: 477, authoredSlot: 429 },
  { sourceLabel: "Lower Leg Referee", firstSlot: 477, endSlotExclusive: 484, authoredSlot: 480 },
  { sourceLabel: "Upper Arm Referee", firstSlot: 484, endSlotExclusive: 491, authoredSlot: 487 },
  { sourceLabel: "Upper Leg Referee", firstSlot: 491, endSlotExclusive: 498, authoredSlot: 494 },
  { sourceLabel: "Lower Arm Referee", firstSlot: 498, endSlotExclusive: 505, authoredSlot: 501 },
  { sourceLabel: "Lower Leg Keeper", firstSlot: 505, endSlotExclusive: 512, authoredSlot: 508 },
  { sourceLabel: "Upper Arm Keeper", firstSlot: 512, endSlotExclusive: 519, authoredSlot: 515 },
  { sourceLabel: "Upper Leg Keeper", firstSlot: 519, endSlotExclusive: 526, authoredSlot: 522 },
  { sourceLabel: "Lower Arm Keeper", firstSlot: 526, endSlotExclusive: 533, authoredSlot: 529 },
]);
const PLAYER_NUMBER_FACE_INDEX = 12;
const EXTRA_TEXTURE_SLOT_OFFSET = 533;

export function parseCssoccerActors({
  teamPreparation,
  animationTable,
  texturePreparation,
  sourcePlayerModelsPreparation,
  dataHBytes,
  threeDEngHBytes,
  threeDUpd2Bytes,
  threeDEngCBytes,
  dataObjectBytes,
  footyPalBytes,
  renderSelection,
} = {}) {
  const descriptor = sourceData;
  assertCssoccerTeamPreparation(teamPreparation);
  validateDescriptor(descriptor);
  validateAnimationTable(animationTable, descriptor);
  if (
    texturePreparation?.metadata?.schema !== "cssoccer-source-match-texture-atlas@1"
    || texturePreparation.metadata.status !== "ready-source-decoded-browser-atlas"
  ) {
    throw new Error("Actor preparation requires the source-decoded match texture atlas.");
  }

  const dataH = readPinnedSource(dataHBytes, "DATA.H", descriptor);
  const threeDEngH = readPinnedSource(threeDEngHBytes, "3DENG.H", descriptor);
  const threeDEngC = readPinnedSource(threeDEngCBytes, "3DENG.C", descriptor);
  const threeDUpd2 = readRevisionSource(threeDUpd2Bytes, "3D_UPD2.CPP", PINNED_3D_UPD2);
  const dataObjectSource = readRevisionSource(dataObjectBytes, "DATA.OBJ", PINNED_DATA_OBJECT);
  const footyPaletteSource = readRevisionSource(
    footyPalBytes,
    "FOOTY.PAL",
    PINNED_FOOTY_PALETTE,
  );
  const footyPalette = decodeFootyPalette(footyPaletteSource.buffer);
  const dataObject = decodeWatcomOmf32Object(dataObjectSource.buffer, { label: "DATA.OBJ" });
  const sourceLines = validateActorSource({
    dataH: dataH.text,
    threeDEngH: threeDEngH.text,
    threeDEngC: threeDEngC.text,
    threeDUpd2: threeDUpd2.text,
  });

  const checkedSourcePlayerModels = sourcePlayerModelsPreparation
    ?? prepareCssoccerSourcePlayerModels({ dataObjectBytes });
  if (checkedSourcePlayerModels?.schema !== CSSOCCER_SOURCE_PLAYER_MODELS_PREPARATION_SCHEMA
      || checkedSourcePlayerModels.status !== "ready-exact-source-primitive-contract"
      || checkedSourcePlayerModels.source.sha256 !== dataObjectSource.sha256
      || JSON.stringify(Object.keys(checkedSourcePlayerModels.models))
        !== JSON.stringify(PLAYER_MODEL_SYMBOLS)) {
    throw new Error("Actor preparation requires the exact source player-model contract.");
  }
  const playerModels = checkedSourcePlayerModels.models;
  const ballPoints = decodeActuaPointList(dataObject.symbolBytes("footy_p"), { id: "footy_p" });
  const ballFaces = decodeActuaFaceList(dataObject.symbolBytes("footy_f"), {
    id: "footy_f",
    pointCount: ballPoints.pointCount,
  });
  const ballModel = prepareBallModel(ballPoints, ballFaces);
  const models = { ...playerModels, ball: ballModel };

  const checkedRenderSelection = prepareRenderSelection(renderSelection, animationTable);
  const exactPlayerSequences = prepareCssoccerExactActuaPlayerSequences({ animationTable });
  const poseFrameSets = prepareRenderablePoseFrameSets({
    animationTable,
    playerModels,
    slotIds: checkedRenderSelection?.slotIds,
    modelIds: checkedRenderSelection?.modelIds,
  });
  validateExactPlayerSequenceContract(exactPlayerSequences, poseFrameSets, checkedRenderSelection);
  validateStablePoseTopology(poseFrameSets, playerModels);
  const renderAssets = prepareActorRenderAssets({
    models,
    poseFrameSets,
    footyPalette,
    modelIds: checkedRenderSelection?.modelIds,
    includeBall: checkedRenderSelection?.includeBall,
  });

  const rendererActorEvidence = requireEvidence(
    descriptor,
    "renderer player indices map to two teams and three officials",
  );
  const rendererBallEvidence = requireEvidence(
    descriptor,
    "ball, pitch, markings, goals, and flags have fixed renderer coordinates",
  );
  const starterById = new Map(teamPreparation.starters.map((starter) => [starter.id, starter]));
  const teamByCountry = new Map(teamPreparation.teams.map((team) => [team.country, team]));
  const actors = descriptor.retainedScene.actors.map((sourceActor, publicationIndex) => {
    if (sourceActor.kind === "player") {
      const starter = starterById.get(sourceActor.id);
      const team = teamByCountry.get(sourceActor.country);
      if (!starter || !team) {
        throw new Error("Player actor " + sourceActor.id + " has no prepared team identity.");
      }
      if (
        starter.nativeRuntimeIndex !== sourceActor.nativeRuntimeIndex
        || starter.nativeRendererIndex !== sourceActor.nativeRendererIndex
      ) {
        throw new Error("Player actor " + sourceActor.id + " changed its native indices.");
      }
      const modelId = team.nativeTeamSlot === "A" ? "player_f1" : "player_f2";
      return {
        id: sourceActor.id,
        kind: "player",
        country: sourceActor.country,
        name: starter.name,
        sourceTeamId: team.sourceTeamId,
        sourceRosterIndex: starter.sourceRosterIndex,
        nativeRuntimeIndex: sourceActor.nativeRuntimeIndex,
        nativeRendererIndex: sourceActor.nativeRendererIndex,
        sourcePublicationIndex: publicationIndex,
        model: modelBinding(models[modelId], modelId, EXACT_PLAYER_RENDER_ASSET_ID),
        material: {
          sourceTeamSlot: team.nativeTeamSlot,
          nativeRenderTypeByMatchHalfParity: team.nativeTeamSlot === "A"
            ? { even: 1, odd: 2 }
            : { even: 2, odd: 1 },
          kitBindingSha256: team.kit.bindingSha256,
          shirtNumber: starter.squadNumber,
        },
        publication: personPublicationContract(),
        root: stableRootContract(),
        lineage: {
          teamStarterId: starter.id,
          faceListSymbol: modelId,
          acceptedRendererEvidence: rendererActorEvidence.fact,
        },
      };
    }

    if (sourceActor.kind === "official") {
      const referee = sourceActor.id === "referee-00";
      const modelId = referee ? "player_fr" : "player_fl";
      return {
        id: sourceActor.id,
        kind: "official",
        country: null,
        nativeRuntimeIndex: null,
        nativeRendererIndex: sourceActor.nativeRendererIndex,
        sourcePublicationIndex: publicationIndex,
        officialRole: referee ? "referee" : "assistant-referee",
        model: modelBinding(models[modelId], modelId, EXACT_OFFICIAL_RENDER_ASSET_ID),
        material: {
          nativeRenderType: referee ? 3 : 4,
          materialProfileId: referee
            ? "actua-referee-material"
            : "actua-assistant-referee-material",
          payloadStatus: "prepared-exact-official-material",
        },
        rendering: {
          status: "prepared-source-bound",
          replacementAllowed: false,
        },
        publication: personPublicationContract(),
        root: stableRootContract(),
        lineage: {
          faceListSymbol: modelId,
          acceptedRendererEvidence: rendererActorEvidence.fact,
        },
      };
    }

    if (sourceActor.kind === "ball" && sourceActor.id === "ball-00") {
      return {
        id: sourceActor.id,
        kind: "ball",
        country: null,
        nativeRuntimeIndex: null,
        nativeRendererIndex: null,
        sourcePublicationIndex: publicationIndex,
        model: modelBinding(models.ball, "ball"),
        material: {
          nativeRenderType: 0,
          payloadStatus: "unsupported-unbound-ball-material",
        },
        publication: ballPublicationContract(),
        root: stableRootContract(),
        lineage: {
          pointListSymbol: "footy_p",
          faceListSymbol: "footy_f",
          acceptedRendererEvidence: rendererBallEvidence.fact,
        },
      };
    }

    throw new Error("Unsupported retained actor " + sourceActor.id + ".");
  });

  validateActorCounts(actors);
  const poseFrameCount = poseFrameSets.slots.reduce((sum, slot) => sum + slot.frames.length, 0);
  const posePolygonInstanceCount = poseFrameSets.slots.reduce(
    (sum, slot) => sum + slot.frames.reduce(
      (frameSum, frame) => frameSum + Object.values(frame.models)
        .reduce((modelSum, model) => modelSum + model.polygons.length, 0),
      0,
    ),
    0,
  );

  return deepFreeze({
    schema: CSSOCCER_ACTOR_PREPARATION_SCHEMA,
    fixtureId: descriptor.id,
    sourceRevision: descriptor.source.revision,
    counts: {
      actors: actors.length,
      players: actors.filter(({ kind }) => kind === "player").length,
      officials: actors.filter(({ kind }) => kind === "official").length,
      balls: actors.filter(({ kind }) => kind === "ball").length,
      stableRoots: actors.filter(({ root }) => root.stable).length,
      preparedModels: Object.keys(models).length,
      playerSourceModels: PLAYER_MODEL_SYMBOLS.length,
      playerSourcePrimitives: PLAYER_MODEL_SYMBOLS
        .reduce((sum, symbol) => sum + models[symbol].sourcePrimitives.length, 0),
      ballPoints: ballModel.pointCount,
      ballSourcePolygons: ballModel.sourcePolygons.length,
      ballSolidTriangles: ballModel.solidPolygons.length,
      renderablePoseSlots: poseFrameSets.slots.length,
      renderablePoseFrames: poseFrameCount,
      renderablePosePolygonInstances: posePolygonInstanceCount,
      renderAssets: renderAssets.length,
      animatedRenderAssets: renderAssets.filter(({ frames }) => Array.isArray(frames)).length,
      animatedTexturedRenderAssets: renderAssets
        .filter(({ kind }) => kind === "animated-textured-model").length,
      staticRenderAssets: renderAssets.filter(({ kind }) => kind === "static-solid-model").length,
      preparedRenderFrames: renderAssets.reduce((sum, asset) => sum + (asset.frames?.length ?? 0), 0),
      preparedRenderPolygons: renderAssets.reduce(
        (sum, asset) => sum + (asset.frames
          ? asset.frames.reduce((frameSum, frame) => frameSum + frame.polygons.length, 0)
          : asset.polygons.length),
        0,
      ),
      texturedPlayerAtlasPlacements:
        texturePreparation.metadata.counts.browserAtlasPlacements,
    },
    actors,
    models,
    exactPlayerSequences,
    poseFrameSets,
    renderAssets,
    rendererAdapter: {
      people: {
        sourcePosition: ["x", "y", "z"],
        rendererPosition: ["x", "y", "-z"],
        sourceFacing: ["crot", "srot"],
        rendererFacing: ["-crot", "srot"],
      },
      ball: {
        publishedPosition: ["ballx", "ballz", "bally"],
        rendererPosition: ["ballx", "ballz", "-bally"],
        sourceFacing: ["crot", "srot"],
        rendererFacing: ["crot", "srot"],
      },
    },
    sourceContract: {
      rendererPeople: 25,
      publishedRecords: 26,
      playerPointCount: PLAYER_POINT_COUNT,
      sourceLines,
      sourceFiles: [
        { file: "DATA.H", sha256: dataH.sha256 },
        { file: "3DENG.H", sha256: threeDEngH.sha256 },
        { file: "3DENG.C", sha256: threeDEngC.sha256 },
        { file: "3D_UPD2.CPP", sha256: threeDUpd2.sha256 },
        { file: "DATA.OBJ", sha256: dataObjectSource.sha256 },
        { file: "FOOTY.PAL", sha256: footyPaletteSource.sha256 },
      ],
      acceptedEvidence: [rendererActorEvidence, rendererBallEvidence],
    },
    unsupportedClasses: [],
  });
}

/** Decode only the native DATA.OBJ player primitives used by source contracts. */
export function prepareCssoccerSourcePlayerModels({ dataObjectBytes } = {}) {
  const source = readRevisionSource(dataObjectBytes, "DATA.OBJ", PINNED_DATA_OBJECT);
  const dataObject = decodeWatcomOmf32Object(source.buffer, { label: "DATA.OBJ" });
  const models = Object.fromEntries(PLAYER_MODEL_SYMBOLS.map((symbol) => {
    const faceBytes = dataObject.symbolBytes(symbol);
    const faces = decodePlayerFaceList(faceBytes, { id: symbol, pointCount: PLAYER_POINT_COUNT });
    return [symbol, prepareSourcePlayerModel(symbol, faces)];
  }));
  return deepFreeze({
    schema: CSSOCCER_SOURCE_PLAYER_MODELS_PREPARATION_SCHEMA,
    status: "ready-exact-source-primitive-contract",
    source: {
      file: "DATA.OBJ",
      bytes: source.buffer.length,
      sha256: source.sha256,
    },
    modelIds: [...PLAYER_MODEL_SYMBOLS],
    primitiveCount: PLAYER_MODEL_SYMBOLS.reduce(
      (sum, symbol) => sum + models[symbol].sourcePrimitives.length,
      0,
    ),
    models,
  });
}

function decodePlayerFaceList(value, { id, pointCount }) {
  const bytes = toBuffer(value, id);
  if (bytes.length < 2) throw new Error(id + " is shorter than its face count.");
  const faceCount = bytes.readUInt16LE(0);
  let offset = 2;
  const faces = [];
  for (let faceIndex = 0; faceIndex < faceCount; faceIndex += 1) {
    if (offset + 4 > bytes.length) throw new Error(id + " ends inside face " + faceIndex + ".");
    const primitiveCode = bytes.readInt16LE(offset);
    const sourceColorCode = bytes.readInt16LE(offset + 2);
    offset += 4;
    const payloadWords = primitiveCode >= 2 ? primitiveCode : primitiveCode === 0 ? 4 : 6;
    if (offset + payloadWords * 2 > bytes.length) {
      throw new Error(id + " ends inside face " + faceIndex + " payload.");
    }
    const payload = Array.from({ length: payloadWords }, (_, index) => bytes.readInt16LE(offset + index * 2));
    offset += payloadWords * 2;
    const pointIndexCount = primitiveCode >= 2 ? primitiveCode : primitiveCode === 0 ? 2 : 3;
    const pointIndexes = payload.slice(0, pointIndexCount);
    if (pointIndexes.some((pointIndex) => pointIndex < 0 || pointIndex >= pointCount)) {
      throw new Error(id + " face " + faceIndex + " references a point outside the pose.");
    }
    const primitive = primitiveCode >= 3
      ? "polygon"
      : primitiveCode === 2
        ? "line"
        : primitiveCode === 0
          ? "camera-facing-cylinder-map"
          : "camera-facing-elliptical-cylinder-map";
    faces.push({
      id: id + ":face-" + String(faceIndex).padStart(2, "0"),
      faceIndex,
      primitiveCode,
      primitive,
      sourceColorCode,
      sourceBinding: playerFaceSourceBinding(id, faceIndex, primitive, sourceColorCode),
      pointIndexes,
      payload,
      parameters: primitiveCode === 0
        ? { radius: payload[2], depthShadeScale: payload[3] }
        : primitiveCode < 2
          ? {
              thirdAxisPointIndex: payload[2],
              radii: [payload[3], payload[4]],
              depthShadeScale: payload[5],
            }
          : null,
    });
  }
  if ([...bytes.subarray(offset)].some((byte) => byte !== 0)) {
    throw new Error(id + " has nonzero bytes after its decoded faces.");
  }
  return {
    id,
    faceCount,
    faces,
    consumedBytes: offset,
    sourceBytes: bytes.length,
    sha256: sha256(bytes),
  };
}

function prepareSourcePlayerModel(symbol, faceList) {
  const sourcePrimitives = faceList.faces.map((face) => ({ ...face }));
  const topologySignatureSha256 = sha256(Buffer.from(canonicalJson(
    sourcePrimitives.map((primitive) => ({
      id: primitive.id,
      faceIndex: primitive.faceIndex,
      primitiveCode: primitive.primitiveCode,
      primitive: primitive.primitive,
      sourceColorCode: primitive.sourceColorCode,
      pointIndexes: primitive.pointIndexes,
      payload: primitive.payload,
      parameters: primitive.parameters,
      sourceBinding: primitive.sourceBinding,
    })),
  )));
  return {
    id: symbol,
    kind: "native-source-player-primitive-model",
    pointCount: PLAYER_POINT_COUNT,
    sourceFaceList: {
      symbol,
      faceCount: faceList.faceCount,
      bytes: faceList.sourceBytes,
      consumedBytes: faceList.consumedBytes,
      sha256: faceList.sha256,
    },
    sourcePrimitives,
    topologySignatureSha256,
    framePolygonCount: sourcePrimitives.length,
    productRendering: {
      status: symbol === "player_f1" || symbol === "player_f2"
        ? "rendered-by-exact-actua-one-basis"
        : "rendered-by-exact-actua-official-one-basis",
      runtimeGeometryConstructionAllowed: false,
    },
  };
}

function prepareBallModel(pointList, faceList) {
  const sourcePolygons = faceList.faces.map((face) => ({
    id: "ball:face-" + String(face.faceIndex).padStart(2, "0"),
    faceIndex: face.faceIndex,
    primitiveCode: face.primitiveCode,
    sourceColorCode: face.sourceColorCode,
    pointIndexes: face.pointIndexes,
    vertices: face.pointIndexes.map((pointIndex) => pointList.points[pointIndex]),
  }));
  if (sourcePolygons.some(({ primitiveCode }) => primitiveCode < 3)) {
    throw new Error("The checked ball face list must contain only solid polygons.");
  }
  const solidPolygons = sourcePolygons.flatMap((polygon) => (
    Array.from({ length: polygon.pointIndexes.length - 2 }, (_, triangleIndex) => {
      const pointIndexes = [
        polygon.pointIndexes[0],
        polygon.pointIndexes[triangleIndex + 1],
        polygon.pointIndexes[triangleIndex + 2],
      ];
      return {
        id: polygon.id + ":leaf-" + triangleIndex,
        sourceFaceId: polygon.id,
        sourceFaceIndex: polygon.faceIndex,
        primitiveStrategy: "source-polygon-fan-triangle",
        sourceColorCode: polygon.sourceColorCode,
        pointIndexes,
        vertices: pointIndexes.map((pointIndex) => pointList.points[pointIndex]),
      };
    })
  ));
  const topologySignatureSha256 = sha256(Buffer.from(canonicalJson(
    solidPolygons.map(({ id, sourceFaceId, pointIndexes, primitiveStrategy }) => ({
      id,
      sourceFaceId,
      pointIndexes,
      primitiveStrategy,
    })),
  )));
  return {
    id: "ball",
    kind: "static-solid-triangle-model",
    pointListSymbol: "footy_p",
    faceListSymbol: "footy_f",
    pointCount: pointList.pointCount,
    points: pointList.points,
    sourcePolygons,
    solidPolygons,
    topologySignatureSha256,
    source: {
      pointListSha256: pointList.sha256,
      pointListBytes: pointList.consumedBytes,
      faceListSha256: faceList.sha256,
      faceListBytes: faceList.consumedBytes,
    },
  };
}

function prepareRenderSelection(value, animationTable) {
  const selection = value ?? {
    modelIds: PRODUCT_RENDER_MODEL_SYMBOLS,
    slotIds: animationTable.slots
      .filter(({ resolvedFrameCount }) => (
        Number.isSafeInteger(resolvedFrameCount) && resolvedFrameCount > 0
      ))
      .map(({ id }) => id),
    includeBall: true,
  };
  if (!selection || typeof selection !== "object" || Array.isArray(selection)
      || Object.keys(selection).sort().join(",") !== "includeBall,modelIds,slotIds"
      || !Array.isArray(selection.modelIds)
      || JSON.stringify(selection.modelIds) !== JSON.stringify(PRODUCT_RENDER_MODEL_SYMBOLS)
      || !Array.isArray(selection.slotIds)
      || selection.slotIds.length === 0
      || selection.slotIds.some((slotId) => !Number.isSafeInteger(slotId) || slotId < 0)
      || new Set(selection.slotIds).size !== selection.slotIds.length
      || selection.includeBall !== true) {
    throw new Error(
      "Actor render selection must exclude unbound official models and contain the ball.",
    );
  }
  return deepFreeze({
    modelIds: [...selection.modelIds],
    slotIds: [...selection.slotIds],
    includeBall: true,
  });
}

function prepareRenderablePoseFrameSets({
  animationTable,
  playerModels,
  slotIds = null,
  modelIds = null,
}) {
  const preparedModelIds = modelIds ?? PLAYER_MODEL_SYMBOLS;
  const renderableSlotIds = animationTable.slots
    .filter(({ resolvedFrameCount }) => (
      Number.isSafeInteger(resolvedFrameCount) && resolvedFrameCount > 0
    ))
    .map(({ id }) => id)
    .filter((slotId) => slotIds === null || slotIds.includes(slotId));
  if (slotIds !== null
      && (renderableSlotIds.length !== slotIds.length
        || slotIds.some((slotId) => !renderableSlotIds.includes(slotId)))) {
    throw new Error("Actor render selection includes an unavailable animation slot.");
  }
  const slots = renderableSlotIds.map((slotId) => {
    const sourceSlot = animationTable.slots[slotId];
    const mirrored = sourceSlot.status === "resolved-source-mirror";
    const payloadSlot = mirrored
      ? animationTable.slots[sourceSlot.posePayload.sourceSlotId]
      : sourceSlot;
    const frames = payloadSlot.posePayload.frames.map((frame) => {
      validatePoseFrame(frame, payloadSlot.id);
      const points = posePoints(frame.coordinates, mirrored);
      const modelFrames = Object.fromEntries(preparedModelIds.map((modelId) => {
        const model = playerModels[modelId];
        const polygons = model.sourcePrimitives.map((primitive) => ({
          id: primitive.id,
          primitive: primitive.primitive,
          sourceColorCode: primitive.sourceColorCode,
          pointIndexes: primitive.pointIndexes,
          vertices: primitive.pointIndexes.map((pointIndex) => points[pointIndex]),
          parameters: primitive.parameters,
        }));
        return [modelId, {
          topologySignatureSha256: model.topologySignatureSha256,
          polygonCount: polygons.length,
          polygons,
        }];
      }));
      return {
        index: frame.index,
        sourceFrameSha256: frame.sha256,
        pointPayloadRef: frame.sha256 + (mirrored ? ":mirror-z" : ":direct"),
        sourceByteRange: frame.sourceByteRange,
        mirroredLocalZ: mirrored,
        points,
        models: modelFrames,
      };
    });
    return {
      id: slotId,
      status: sourceSlot.status,
      sourceSlotId: payloadSlot.id,
      frameCount: frames.length,
      frames,
    };
  });
  let preparedFrameIndex = 0;
  const preparedFrameLookup = slots.map((slot) => {
    const entry = {
      slotId: slot.id,
      sourceSlotId: slot.sourceSlotId,
      status: slot.status,
      preparedFrameStart: preparedFrameIndex,
      frameCount: slot.frameCount,
      preparedFrameEnd: preparedFrameIndex + slot.frameCount,
    };
    preparedFrameIndex += slot.frameCount;
    return entry;
  });
  const preparedFrameIndexBySlotFrame = Object.fromEntries(slots.flatMap((slot, slotIndex) => {
    const start = preparedFrameLookup[slotIndex].preparedFrameStart;
    return slot.frames.map((frame) => [slot.id + ":" + frame.index, start + frame.index]);
  }));
  return {
    blueprint: "cssQuake prepared animated render bundle frame-style swap",
    stateArtifactSha256: animationTable.retainedNativeAnimations.evidence.stateArtifactSha256,
    topologyStableAcrossFrames: true,
    rootStableAcrossFrames: true,
    runtimeMaySelectPreparedFrame: true,
    runtimeMayCreateNodesOrGeometry: false,
    slots,
    preparedFrameLookup,
    preparedFrameIndexBySlotFrame,
    storageMetrics: poseStorageMetrics(slots),
  };
}

function poseStorageMetrics(slots) {
  const frames = slots.flatMap((slot) => slot.frames);
  const uniqueSourceFrameHashes = new Set(frames.map(({ sourceFrameSha256 }) => sourceFrameSha256));
  const materializedPointPayloadRefs = new Set(frames.map(({ pointPayloadRef }) => pointPayloadRef));
  const pointValuesPerFrame = PLAYER_POINT_COUNT * 3;
  return {
    frames: frames.length,
    pointValuesPerFrame,
    materializedPointValues: frames.length * pointValuesPerFrame,
    materializedFloat32PointBytes: frames.length * pointValuesPerFrame * 4,
    uniqueSourceFrames: uniqueSourceFrameHashes.size,
    uniqueSourceFrameBytes: uniqueSourceFrameHashes.size * (4 + pointValuesPerFrame * 4),
    uniqueMaterializedPointPayloads: materializedPointPayloadRefs.size,
    uniqueMaterializedFloat32PointBytes: materializedPointPayloadRefs.size * pointValuesPerFrame * 4,
    deduplicationKey: "pointPayloadRef",
    modelFramePolygonsReuse: "frame.points plus exact DATA.OBJ source primitives",
  };
}

function prepareActorRenderAssets({
  models,
  poseFrameSets,
  footyPalette,
  modelIds,
  includeBall = true,
}) {
  if (JSON.stringify(modelIds) !== JSON.stringify(PRODUCT_RENDER_MODEL_SYMBOLS)
      || includeBall !== true) {
    throw new Error("Only source-bound actor assets may enter the product renderer.");
  }

  const ballColorBindings = ballSourceColorBindings(models.ball.sourcePolygons, footyPalette);
  const ballColorBySourceCode = new Map(
    ballColorBindings.map(({ sourceColorCode, solidColor }) => [sourceColorCode, solidColor]),
  );
  const ballAsset = {
    id: renderAssetIdForModel("ball"),
    kind: "static-solid-model",
    modelId: "ball",
    adapter: {
      id: "source-polygon-browser-solid-adapter@1",
      status: "exact-source-solid-triangles-with-source-palette-colors",
      nativePaletteColorsClaimed: true,
    },
    topologySignatureSha256: models.ball.topologySignatureSha256,
    solidColorBindings: ballColorBindings,
    presentationBinding: {
      status: "exact-footy-palette-rgb6-to-rgb8",
      paletteFile: "FOOTY.PAL",
      paletteSha256: footyPalette.sha256,
      paletteBytes: footyPalette.bytes,
      componentConversion: "round(sourceRgb6*255/63)",
    },
    polygons: models.ball.solidPolygons.map((polygon) => ({
      id: polygon.id,
      sourceFaceId: polygon.sourceFaceId,
      sourceFaceIndex: polygon.sourceFaceIndex,
      sourceColorCode: polygon.sourceColorCode,
      adapterKind: "exact-source-polygon-fan-triangle",
      vertices: polygon.vertices,
      color: ballColorBySourceCode.get(polygon.sourceColorCode),
    })),
  };
  return [ballAsset];
}

function playerFaceSourceBinding(modelId, faceIndex, primitive, sourceColorCode) {
  const authoredNativeTextureSlot = sourceColorCode < -2000
    ? -sourceColorCode - 2000
    : -sourceColorCode;
  const textureBlock = PLAYER_TEXTURE_BLOCKS.find(({ firstSlot, endSlotExclusive }) => (
    authoredNativeTextureSlot >= firstSlot && authoredNativeTextureSlot < endSlotExclusive
  ));
  if (!textureBlock && (modelId === "player_f1" || modelId === "player_f2")) {
    throw new Error(
      `${modelId} face ${faceIndex} texture slot ${authoredNativeTextureSlot} is outside the source player texture blocks.`,
    );
  }
  const nativeDispatch = primitive === "camera-facing-cylinder-map"
    ? "add3dcmap"
    : primitive === "camera-facing-elliptical-cylinder-map"
      ? "add3demap"
      : primitive === "polygon"
        ? "addpoly"
        : null;
  if (nativeDispatch === null) {
    throw new Error(`${modelId} face ${faceIndex} has no source renderer dispatch.`);
  }
  const teamNumberOffset = modelId === "player_f1"
    ? 0
    : modelId === "player_f2"
      ? 15
      : null;
  const runtimeOverride = faceIndex === PLAYER_NUMBER_FACE_INDEX && teamNumberOffset !== null
    ? {
        setupField: "setup.detail.players",
        faceCountEnabled: 13,
        faceCountDisabled: 12,
        faceWordOffset: 82,
        xTm: EXTRA_TEXTURE_SLOT_OFFSET,
        teamNumberOffset,
        firstNativeTextureSlot: EXTRA_TEXTURE_SLOT_OFFSET + 16 + teamNumberOffset,
        sourceExpression: teamNumberOffset === 0
          ? "-X_TM-2016-(number-1)"
          : "-X_TM-2016-15-(number-1)",
        authority: "3DENG.C player number branch",
      }
    : null;
  return {
    authoredNativeTextureSlot,
    textureBlock: textureBlock ?? null,
    nativeDispatch,
    runtimeOverride,
    authority: {
      topology: `DATA.OBJ ${modelId}`,
      textureBlocks: "3DENG.C TEXTURE MAP INFO",
      dispatch: "3DENG.C addpols",
    },
  };
}

function ballSourceColorBindings(sourcePolygons, footyPalette) {
  return [...new Set(sourcePolygons.map(({ sourceColorCode }) => sourceColorCode))]
    .sort((left, right) => left - right)
    .map((sourceColorCode) => {
      const sourceRgb6 = footyPalette.colors[sourceColorCode];
      if (!sourceRgb6 || new Set(sourceRgb6).size !== 1) {
        throw new Error("Ball source color " + sourceColorCode + " is not FOOTY.PAL grayscale.");
      }
      return {
        sourceColorCode,
        sourceRgb6,
        solidColor: rgb6ToHex(sourceRgb6),
        presentationRole: "footy-palette-grayscale",
        status: "exact-footy-palette-rgb6-to-rgb8",
      };
    });
}

function decodeFootyPalette(bytes) {
  if (
    bytes.length !== PINNED_FOOTY_PALETTE.bytes
    || sha256(bytes) !== PINNED_FOOTY_PALETTE.sha256
    || [...bytes].some((component) => component > 63)
  ) {
    throw new Error("FOOTY.PAL changed from its pinned 256-color RGB6 payload.");
  }
  return {
    bytes: bytes.length,
    sha256: PINNED_FOOTY_PALETTE.sha256,
    componentEncoding: "source-rgb6-byte-values",
    colors: Array.from({ length: 256 }, (_, colorIndex) => (
      Array.from(bytes.subarray(colorIndex * 3, colorIndex * 3 + 3))
    )),
  };
}

function rgb6ToHex(rgb6) {
  return "#" + rgb6
    .map((component) => Math.round(component * 255 / 63).toString(16).padStart(2, "0"))
    .join("");
}

function posePoints(coordinates, mirrored) {
  return Array.from({ length: PLAYER_POINT_COUNT }, (_, pointIndex) => {
    const offset = pointIndex * 3;
    return [
      coordinates[offset],
      coordinates[offset + 1],
      mirrored ? -coordinates[offset + 2] : coordinates[offset + 2],
    ];
  });
}

function validatePoseFrame(frame, slotId) {
  if (
    frame?.coordinates?.length !== PLAYER_POINT_COUNT * 3
    || frame.coordinates.some((coordinate) => !Number.isFinite(coordinate))
  ) {
    throw new Error("Animation slot " + slotId + " has an invalid pose frame.");
  }
  const bytes = Buffer.alloc(340);
  bytes.writeFloatLE(PLAYER_POINT_COUNT, 0);
  frame.coordinates.forEach((coordinate, index) => bytes.writeFloatLE(coordinate, 4 + index * 4));
  if (sha256(bytes) !== frame.sha256) {
    throw new Error("Animation slot " + slotId + " pose coordinates diverge from its source-frame hash.");
  }
}

function validateStablePoseTopology(poseFrameSets, playerModels) {
  for (const slot of poseFrameSets.slots) {
    if (slot.frames.length !== slot.frameCount) {
      throw new Error("Pose slot " + slot.id + " frame count changed.");
    }
    for (const frame of slot.frames) {
      const modelIds = Object.keys(frame.models);
      if (JSON.stringify(modelIds) !== JSON.stringify(PRODUCT_RENDER_MODEL_SYMBOLS)) {
        throw new Error(`Pose slot ${slot.id} includes an unbound product render model.`);
      }
      for (const modelId of modelIds) {
        const model = frame.models[modelId];
        if (
          model.topologySignatureSha256 !== playerModels[modelId].topologySignatureSha256
          || model.polygonCount !== playerModels[modelId].framePolygonCount
          || model.polygons.some((polygon, index) => (
            polygon.id !== playerModels[modelId].sourcePrimitives[index].id
          ))
        ) {
          throw new Error("Pose slot " + slot.id + " changed " + modelId + " topology.");
        }
      }
    }
  }
}

function validateExactPlayerSequenceContract(contract, poseFrameSets, renderSelection) {
  if (
    contract?.schema !== CSSOCCER_EXACT_ACTUA_PLAYER_SEQUENCES_SCHEMA
    || contract.status !== "ready-complete-source-sequence-domain"
    || contract.counts?.sequences !== 124
    || contract.counts?.poseOccurrences !== 5_857
  ) {
    throw new Error("Actor preparation requires the complete exact-player sequence contract.");
  }
  const sequenceBySlotId = new Map(contract.sequences.map((sequence) => [
    sequence.slotId,
    sequence,
  ]));
  for (const slot of poseFrameSets.slots) {
    const sequence = sequenceBySlotId.get(slot.id);
    if (!sequence || sequence.localFrameCount !== slot.frameCount) {
      throw new Error(`Pose slot ${slot.id} changed from its exact sequence contract.`);
    }
    for (const frame of slot.frames) {
      const contracted = sequence.frames[frame.index];
      if (
        contracted?.sourceFrameSha256 !== frame.sourceFrameSha256
        || contracted.exactFloat32PoseSha256 !== exactPosePointHash(frame.points)
      ) {
        throw new Error(`Pose slot ${slot.id} frame ${frame.index} changed source bits.`);
      }
    }
  }
  if (renderSelection === null) {
    if (
      JSON.stringify(contract.preparedFrameLookup)
        !== JSON.stringify(poseFrameSets.preparedFrameLookup)
      || JSON.stringify(contract.preparedFrameIndexBySlotFrame)
        !== JSON.stringify(poseFrameSets.preparedFrameIndexBySlotFrame)
    ) {
      throw new Error("Exact-player sequence lookup diverged from prepared pose frames.");
    }
  }
}

function exactPosePointHash(points) {
  if (
    !Array.isArray(points)
    || points.length !== PLAYER_POINT_COUNT
    || points.some((point) => (
      !Array.isArray(point)
      || point.length !== 3
      || point.some((value) => !Number.isFinite(value))
    ))
  ) {
    throw new Error("Exact-player pose points are invalid.");
  }
  const bytes = Buffer.alloc((1 + PLAYER_POINT_COUNT * 3) * 4);
  bytes.writeFloatLE(PLAYER_POINT_COUNT, 0);
  points.flat().forEach((value, index) => bytes.writeFloatLE(value, 4 + index * 4));
  return sha256(bytes);
}

function validateAnimationTable(value, descriptor) {
  if (
    value?.schema !== CSSOCCER_ANIMATION_TABLE_SCHEMA
    || value.fixtureId !== descriptor.id
    || value.sourceRevision !== descriptor.source.revision
    || value.counts?.slots !== 132
    || value.counts?.compiledDirectPoseSlots !== 94
    || value.counts?.mirroredPoseSlots !== 30
    || value.counts?.decodedPoseFrames !== 4683
    || value.counts?.retainedNativeAnimationSlots !== 46
    || value.counts?.resolvedRetainedNativeAnimationSlots !== 46
    || value.retainedNativeAnimations?.evidence?.stateArtifactSha256
      !== RETAINED_STATE_ARTIFACT_SHA256
  ) {
    throw new Error("Actor preparation requires the exact retained animation table.");
  }
}

function validateDescriptor(descriptor) {
  const actorIds = descriptor?.retainedScene?.actors?.map(({ id }) => id) ?? [];
  if (
    descriptor?.schema !== "cssoccer-static-source-data@1"
    || descriptor.id !== "spain-argentina-full-match"
    || actorIds.length !== 26
    || new Set(actorIds).size !== 26
  ) {
    throw new Error("Actor preparation requires the fixed 26-actor source descriptor.");
  }
}

function validateActorSource({ dataH, threeDEngH, threeDEngC, threeDUpd2 }) {
  const required = [
    [dataH, /#define\s+NPLAYERS\s+25\b/u, "DATA.H NPLAYERS"],
    [threeDEngH, /#define\s+PLYRPTS\s+28\b/u, "3DENG.H PLYRPTS"],
    [threeDEngH, /short\s+type,number,anim,sprite\s*;/u, "3DENG.H plyrdat fields"],
    [threeDUpd2, /i<players\+3/u, "3D_UPD2.CPP official count"],
    [threeDUpd2, /ptr->type=3;\s*\/\/referee colour/u, "3D_UPD2.CPP referee type"],
    [threeDUpd2, /ptr->type=4;\s*\/\/linesman colour/u, "3D_UPD2.CPP linesman type"],
    [threeDUpd2, /ptr->type=0;\s*\/\/ball type/u, "3D_UPD2.CPP ball type"],
    [threeDEngC, /thisobj->z=-plyrpt->z/u, "3DENG.C people z adapter"],
    [threeDEngC, /thisobj->crot=-plyrpt->crot/u, "3DENG.C people facing adapter"],
    [threeDEngC, /ball\.z=-plyrpt->z/u, "3DENG.C ball z adapter"],
    [threeDEngC, /ball\.crot=plyrpt->crot/u, "3DENG.C ball facing adapter"],
    [threeDEngC, /if \(np==0\)[\s\S]{0,100}add3dcmap/u, "3DENG.C cylinder primitive"],
    [threeDEngC, /else[\s\S]{0,100}add3demap/u, "3DENG.C ellipse primitive"],
  ];
  for (const [source, pattern, label] of required) {
    if (!pattern.test(source)) throw new Error(label + " no longer matches the pinned source shape.");
  }
  return {
    nplayers: findLine(dataH, /^\s*#define\s+NPLAYERS\s+25\b/u, "NPLAYERS"),
    playerPoints: findLine(threeDEngH, /^\s*#define\s+PLYRPTS\s+28\b/u, "PLYRPTS"),
    addpols: findLine(threeDEngC, /^void addpols\(obj \*ob\)$/u, "addpols"),
    add3dcmap: findLine(threeDEngC, /^add3dcmap\(face obf,word col\)$/u, "add3dcmap"),
    add3demap: findLine(threeDEngC, /^add3demap\(face obf,word col\)$/u, "add3demap"),
    peopleAdapter: findLine(threeDEngC, /^\s*thisobj->x=plyrpt->x;/u, "people adapter"),
    ballAdapter: findLine(threeDEngC, /^\s*ball\.x=plyrpt->x;/u, "ball adapter"),
    publication: findLine(
      threeDUpd2,
      /^\s*for\s*\(int i=0;\s*i<players\+3;\s*i\+\+\)/u,
      "players+3 publication loop",
    ),
  };
}

function modelBinding(model, modelId, renderAssetId = renderAssetIdForModel(modelId)) {
  return {
    modelId,
    renderAssetId,
    topologySignatureSha256: model.topologySignatureSha256,
    payloadStatus: "decoded-source-geometry",
  };
}

function renderAssetIdForModel(modelId) {
  if (modelId === "player_f1" || modelId === "player_f2") {
    throw new Error(`Obsolete player render asset ${modelId} is forbidden.`);
  }
  return modelId === "ball" ? "actor-ball" : "actor-" + modelId.replaceAll("_", "-");
}

function personPublicationContract() {
  return {
    position: { x: "x", y: "y", z: "-z" },
    facing: { cosine: "-crot", sine: "srot" },
    animation: { id: "anim", frame: "frame", frameStep: "fstep" },
    visibilityAndMaterial: "type",
    shirtNumber: "number",
    head: { type: "htype", colour: "hcol" },
    sprite: "sprite",
  };
}

function ballPublicationContract() {
  return {
    position: { x: "ballx", y: "ballz", z: "-bally" },
    facing: { cosine: "crot", sine: "srot" },
    rotation: { horizontalFrame: "frame", verticalFrameStep: "fstep" },
    animationId: 0,
  };
}

function stableRootContract() {
  return {
    stable: true,
    blueprint: "cssQuake prepared animated render bundle frame-style swap",
    prepareOwns: ["root", "triangle-leaves", "material-bindings", "pose-frame-set"],
    runtimeMayUpdate: ["transform", "visibility", "material-class", "prepared-frame-index", "text"],
    runtimeMayCreateNodesOrAssets: false,
  };
}

function validateActorCounts(actors) {
  const kinds = Map.groupBy(actors, ({ kind }) => kind);
  if (
    actors.length !== 26
    || (kinds.get("player")?.length ?? 0) !== 22
    || (kinds.get("official")?.length ?? 0) !== 3
    || (kinds.get("ball")?.length ?? 0) !== 1
    || actors.at(-1)?.id !== "ball-00"
  ) {
    throw new Error("Actor preparation must publish 22 players, three officials, then the ball.");
  }
  for (let index = 0; index < 25; index += 1) {
    if (actors[index].nativeRendererIndex !== index || actors[index].sourcePublicationIndex !== index) {
      throw new Error("Actor " + actors[index].id + " changed renderer publication order.");
    }
  }
  if (new Set(actors.map(({ id }) => id)).size !== actors.length) {
    throw new Error("Prepared actor ids must be unique.");
  }
}

function requireEvidence(descriptor, fact) {
  const evidence = descriptor.source.evidenceSpans.find((entry) => entry.fact === fact);
  if (
    !evidence
    || typeof evidence.file !== "string"
    || !Array.isArray(evidence.lines)
    || !/^[0-9a-f]{64}$/u.test(evidence.sha256 ?? "")
  ) {
    throw new Error("Static source-data is missing accepted evidence: " + fact + ".");
  }
  return {
    fact: evidence.fact,
    file: evidence.file,
    lines: evidence.lines,
    sha256: evidence.sha256,
  };
}

function findLine(source, pattern, label) {
  const lines = source.split(/\r?\n/u);
  const index = lines.findIndex((line) => pattern.test(line));
  if (index < 0) throw new Error("Could not locate " + label + " in pinned source.");
  return index + 1;
}

function readPinnedSource(value, file, descriptor) {
  const expected = descriptor.source.files.find(({ name }) => name === file);
  if (!expected) throw new Error("Static source-data does not pin " + file + ".");
  return readRevisionSource(value, file, expected);
}

function readRevisionSource(value, file, expected) {
  const buffer = toBuffer(value, file);
  const digest = sha256(buffer);
  if (buffer.length !== expected.bytes || digest !== expected.sha256) {
    throw new Error(file + " does not match pinned source revision " + sourceData.source.revision + ".");
  }
  return { buffer, text: buffer.toString("latin1"), sha256: digest };
}

function toBuffer(value, label) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  throw new TypeError(label + " must be supplied as source bytes.");
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  return "{" + Object.keys(value).sort()
    .map((key) => JSON.stringify(key) + ":" + canonicalJson(value[key])).join(",") + "}";
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
