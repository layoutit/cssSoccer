import {
  decodeActuaFaceList,
  decodeActuaPointList,
  readActuaB6GeometryInputs,
} from "./formatAdapters.mjs";
import { readCssoccerSourceFacts } from "./sourceFacts.mjs";
export const CSSOCCER_PITCH_SLICE_SCHEMA = "cssoccer-prepared-pitch-slice@1";

const MARKING_LIFT = 0.35;
const LINE_WIDTH = 2;
const NO_WIND_FLAG_POINT_INDEX = 8;
const NO_WIND_FLAG_POINT = Object.freeze([1.751, 6.629, 1.751]);

const ROLE_COLORS = Object.freeze({
  pitch: Object.freeze({ 134: "#1c450c", 138: "#305d1c" }),
  marking: Object.freeze({ 22: "#aeaeae" }),
  // Exact FOOTY.PAL post/crossbar ramps. Goal-net faces are native texture
  // references and must be bound from BM_NETS by the prepare pipeline.
  goal: Object.freeze({
    22: "#aeaeae",
    24: "#bebebe",
    26: "#d3d3d3",
    28: "#e3e3e3",
    30: "#f3f3f3",
  }),
  // FOOTY.PAL source solids. The pennant face at -2579 is deliberately a
  // prepare-required native texture reference, never a generated solid colour.
  flag: Object.freeze({ 27: "#dbdbdb", 29: "#ebebeb", 31: "#ffffff" }),
  stadium: Object.freeze({
    159: "#8a048e",
    248: "#ef5151",
    249: "#791820",
    250: "#ff6161",
    255: "#ffffff",
  }),
});

const GOAL_NET_TEXTURE_CODES = Object.freeze(new Set([-3000, -2999, -2998, -2997]));

// initobj gives every goal member the same initial mesh. Before drawing,
// objdepd replaces it from the member's compiled detlist. Bake its zero-scale,
// highest-fidelity entry so the prepared route keeps the source nets, posts,
// and crossbar without constructing or swapping topology in the browser.
const GOAL_HIGHEST_DETAIL_BINDINGS = Object.freeze({
  goal1_a: Object.freeze({ points: "goal1c_p", faces: "goal_f1d" }),
  goal2_a: Object.freeze({ points: "goal2c_p", faces: "goal_f1dm" }),
  goal3_a: Object.freeze({ points: "goal3c_p", faces: "goal_f2dm" }),
  goal4_a: Object.freeze({ points: "goal3a_p", faces: "goal_f3d" }),
  goal1_b: Object.freeze({ points: "goal1cx_p", faces: "goal_f1dm" }),
  goal2_b: Object.freeze({ points: "goal2cx_p", faces: "goal_f1d" }),
  goal3_b: Object.freeze({ points: "goal3cx_p", faces: "goal_f2d" }),
  goal4_b: Object.freeze({ points: "goal3ax_p", faces: "goal_f3d" }),
});

export async function decodeCssoccerPitchSlice({ sourceRoot, facts } = {}) {
  const sourceFacts = facts ?? readCssoccerSourceFacts({ sourceRoot });
  validateFacts(sourceFacts);
  const inputs = await readActuaB6GeometryInputs({ sourceRoot });
  const materials = new Map();
  const objects = [];
  const symbolCache = new Map();

  const decodeObjectSymbols = (pointsSymbol, facesSymbol) => {
    const cacheKey = `${pointsSymbol}|${facesSymbol}`;
    if (!symbolCache.has(cacheKey)) {
      const pointList = decodeActuaPointList(inputs.dataObject.symbolBytes(pointsSymbol), { id: pointsSymbol });
      const faceList = decodeActuaFaceList(inputs.dataObject.symbolBytes(facesSymbol), {
        id: facesSymbol,
        pointCount: pointList.pointCount,
      });
      symbolCache.set(cacheKey, Object.freeze({ pointList, faceList }));
    }
    return symbolCache.get(cacheKey);
  };

  const pitchLists = decodeObjectSymbols("pitch_p", "pitch_f");
  const pitchPoints = applySimplePitchBounds(pitchLists.pointList.points, sourceFacts);
  objects.push(buildPreparedObject({
    id: "pitch",
    kind: "pitch",
    role: "pitch",
    sourceObject: "pitch",
    sourcePoints: "pitch_p",
    sourceFaces: "pitch_f",
    points: pitchPoints,
    faceList: pitchLists.faceList,
    position: [0, 0, 0],
    sourceContainer: "DATA.OBJ",
    materials,
  }));

  for (const marking of sourceFacts.markings.objects) {
    const lists = decodeObjectSymbols(marking.points, marking.faces);
    objects.push(buildPreparedObject({
      id: `marking-${marking.symbol}`,
      kind: marking.symbol.startsWith("spot") ? "pitch-spot" : "pitch-marking",
      role: "marking",
      sourceObject: marking.symbol,
      sourcePoints: marking.points,
      sourceFaces: marking.faces,
      points: lists.pointList.points,
      faceList: lists.faceList,
      position: marking.position,
      presentationOffset: [0, MARKING_LIFT, 0],
      sourceContainer: "DATA.OBJ",
      materials,
    }));
  }

  for (const goal of sourceFacts.goals.objects) {
    const binding = GOAL_HIGHEST_DETAIL_BINDINGS[goal.detail];
    if (!binding || goal.points !== "goal1a_p" || goal.faces !== "goal_f1a") {
      throw new Error(`Native goal detail binding changed for ${goal.symbol}.`);
    }
    const lists = decodeObjectSymbols(binding.points, binding.faces);
    objects.push(buildPreparedObject({
      id: `goal-${goal.symbol}`,
      kind: "goal-member",
      role: "goal",
      sourceObject: goal.symbol,
      sourcePoints: binding.points,
      sourceFaces: binding.faces,
      sourceDetail: goal.detail,
      points: lists.pointList.points,
      faceList: lists.faceList,
      position: goal.position,
      sourceContainer: "DATA.OBJ",
      materials,
    }));
  }

  for (const flag of sourceFacts.flags.objects) {
    const lists = decodeObjectSymbols(flag.points, flag.faces);
    objects.push(buildPreparedObject({
      id: `flag-${flag.symbol}`,
      kind: "corner-flag",
      role: "flag",
      sourceObject: flag.symbol,
      sourcePoints: flag.points,
      sourceFaces: flag.faces,
      points: applyNoWindFlagPose(lists.pointList.points),
      faceList: lists.faceList,
      position: flag.position,
      sourceContainer: "DATA.OBJ",
      materials,
    }));
  }

  for (const stand of sourceFacts.stadium.stands) {
    const selector = inputs.stadiumSelectors.bindings.find(({ slot }) => slot === stand.slot);
    if (!selector || selector.pointsFile !== stand.pointsFile || selector.facesFile !== stand.facesFile) {
      throw new Error(`Native visual stadium stand ${stand.slot} selector binding changed.`);
    }
    const pointList = decodeActuaPointList(inputs.archive.recordBytes(selector.pointsSelector), {
      id: stand.pointsFile,
    });
    const faceList = decodeActuaFaceList(inputs.archive.recordBytes(selector.facesSelector), {
      id: stand.facesFile,
      pointCount: pointList.pointCount,
    });
    objects.push(buildPreparedObject({
      id: `stadium-stand-${stand.slot}`,
      kind: "stadium-stand",
      role: "stadium",
      sourceObject: `stad${stand.slot}`,
      sourcePoints: stand.pointsFile,
      sourceFaces: stand.facesFile,
      points: pointList.points,
      faceList,
      position: selector.offset,
      sourceContainer: "EUROREND.DAT",
      archiveSelectors: Object.freeze({ points: selector.pointsSelector, faces: selector.facesSelector }),
      materials,
    }));
  }

  const officialRoots = sourceFacts.officials.rendererIdentities.map((official) => Object.freeze({
    id: `official-${official.nativeRendererIndex}`,
    kind: official.nativeRendererIndex === 22 ? "referee-root" : "assistant-referee-root",
    nativeRendererIndex: official.nativeRendererIndex,
    faceSymbol: official.faceSymbol,
    stableDom: true,
    preparedGeometryOwner: "B7 actor preparation",
    visibleGeometry: false,
    lineage: Object.freeze({
      file: "3DENG.C",
      producer: `player[${official.nativeRendererIndex}] initializer`,
    }),
  }));

  const metrics = aggregateObjectMetrics(objects, symbolCache);
  const bounds = boundsForObjects(objects);
  return deepFreeze({
    schema: CSSOCCER_PITCH_SLICE_SCHEMA,
    id: "spain-stadium-pitch",
    axes: {
      coordinateSpace: "Actua renderer world",
      components: sourceFacts.pitch.rendererAxes,
      gameplayToRenderer: sourceFacts.pitch.mappingFromSource,
      verticalAxis: "y",
      playingField: sourceFacts.pitch.rendererBounds,
      preparedBounds: bounds,
    },
    dimensions: {
      nativeUnitsPerYard: sourceFacts.pitch.nativeUnitsPerYard,
      yards: sourceFacts.pitch.yardDimensions,
      playingFieldNative: { length: 1280, width: 800 },
      simplePitchOuterBounds: sourceFacts.pitch.simplePitchOuterBounds,
      stadiumContext: inputs.stadiumSelectors.layout.dimensions,
    },
    materials: [...materials.values()].sort((left, right) => left.id.localeCompare(right.id)),
    objects,
    officialRoots,
    metrics,
    lineage: {
      sourceFactsSchema: sourceFacts.schema,
      sourceFiles: sourceFacts.sourceFiles,
      geometryInputs: inputs.inputHashes,
      stadiumSelectorAuthority: inputs.stadiumSelectors.bindingAuthority,
      goalDetailTier: {
        selector: "objdepd",
        zScaleMinimum: 0,
        bindings: GOAL_HIGHEST_DETAIL_BINDINGS,
      },
      presentationAdapters: [
        { id: "native-line-ribbon", widthNative: LINE_WIDTH },
        { id: "marking-z-fight-lift", verticalNative: MARKING_LIFT },
      ],
    },
  });
}

function buildPreparedObject({
  id,
  kind,
  role,
  sourceObject,
  sourcePoints,
  sourceFaces,
  sourceDetail,
  points,
  faceList,
  position,
  presentationOffset = [0, 0, 0],
  sourceContainer,
  archiveSelectors,
  materials,
}) {
  requireVector(position, `${id} position`);
  requireVector(presentationOffset, `${id} presentation offset`);
  const placedPoints = points.map((point) => Object.freeze(point.map((value, axis) => (
    value + position[axis] + presentationOffset[axis]
  ))));
  const polygons = faceList.faces.map((face) => {
    if (face.primitive === "cylinder-map" || face.primitive === "elliptical-cylinder-map") {
      throw new Error(`${id} uses unsupported source procedural primitive ${face.primitive}.`);
    }
    const material = materialFor(role, face.sourceColorCode);
    materials.set(material.id, material);
    const vertices = face.primitive === "line"
      ? lineRibbon(placedPoints[face.pointIndexes[0]], placedPoints[face.pointIndexes[1]], LINE_WIDTH)
      : face.pointIndexes.map((pointIndex) => placedPoints[pointIndex]);
    const source = Object.freeze({
      id: `${sourceObject}:face:${face.faceIndex}`,
      object: sourceObject,
      pointsSymbol: sourcePoints,
      facesSymbol: sourceFaces,
      detailSymbol: sourceDetail,
      container: sourceContainer,
      sourceFaceIndex: face.faceIndex,
      sourcePointIndexes: face.pointIndexes,
      sourcePrimitive: face.primitive,
      sourceColorCode: face.sourceColorCode,
      archiveSelectors,
      presentationAdapter: face.primitive === "line" ? "native-line-ribbon" : undefined,
    });
    return Object.freeze({
      vertices: Object.freeze(vertices.map((vertex) => Object.freeze([...vertex]))),
      color: material.color,
      materialId: material.id,
      ...(material.preparedTextureRequired ? { preparedTextureRequired: true } : {}),
      visibilityGroup: role,
      paintOrder: face.faceIndex,
      source,
      sources: Object.freeze([source]),
    });
  });
  return Object.freeze({
    id,
    kind,
    role,
    sourceObject,
    sourcePoints,
    sourceFaces,
    sourceDetail,
    position: Object.freeze([...position]),
    presentationOffset: Object.freeze([...presentationOffset]),
    pointCount: points.length,
    faceCount: faceList.faceCount,
    sourceTriangleCount: faceList.faces.reduce((sum, face) => sum + sourceTriangleCount(face), 0),
    polygonCount: polygons.length,
    polygons: Object.freeze(polygons),
  });
}

function applySimplePitchBounds(sourcePoints, facts) {
  if (sourcePoints.length !== 38) throw new Error("pitch_p must contain 38 source points.");
  const points = sourcePoints.map((point) => [...point]);
  const { st_w: stadiumWidth, st_l: stadiumLength } = facts.stadium.dimensions;
  const nativeLength = facts.pitch.rendererBounds.x[1];
  const nativeWidth = -facts.pitch.rendererBounds.z[0];
  for (let index = 0; index < 19; index += 1) {
    points[index][2] = stadiumWidth;
    points[index + 19][2] = -nativeWidth - stadiumWidth;
  }
  points[0][0] = -stadiumLength;
  points[19][0] = -stadiumLength;
  points[18][0] = nativeLength + stadiumLength;
  points[37][0] = nativeLength + stadiumLength;
  return Object.freeze(points.map((point) => Object.freeze(point)));
}

function applyNoWindFlagPose(sourcePoints) {
  if (sourcePoints.length !== 11) {
    throw new Error("flag_p must contain the exact 11 source points.");
  }
  const points = sourcePoints.map((point) => [...point]);
  points[NO_WIND_FLAG_POINT_INDEX] = [...NO_WIND_FLAG_POINT];
  return Object.freeze(points.map((point) => Object.freeze(point)));
}

function lineRibbon(start, end, width) {
  const direction = subtract(end, start);
  const length = magnitude(direction);
  if (!(length > 0)) throw new Error("Actua line primitive has coincident endpoints.");
  const unit = direction.map((value) => value / length);
  const reference = Math.abs(unit[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1];
  const perpendicular = cross(unit, reference);
  const perpendicularLength = magnitude(perpendicular);
  if (!(perpendicularLength > 0)) throw new Error("Actua line primitive has no ribbon plane.");
  const half = perpendicular.map((value) => value * width / (2 * perpendicularLength));
  return [add(start, half), add(end, half), subtract(end, half), subtract(start, half)];
}

function materialFor(role, sourceColorCode) {
  const id = `actua-${role}-${sourceColorCode < 0 ? `n${Math.abs(sourceColorCode)}` : sourceColorCode}`;
  const roleColor = ROLE_COLORS[role]?.[sourceColorCode];
  const preparedTextureRequired = (
    (role === "goal" && GOAL_NET_TEXTURE_CODES.has(sourceColorCode))
    || (role === "flag" && sourceColorCode === -2579)
    || (role === "stadium" && sourceColorCode < 0)
  );
  if (roleColor === undefined && !preparedTextureRequired) {
    throw new Error(
      `${role} source material ${sourceColorCode} has no exact palette or prepared texture binding.`,
    );
  }
  // Textured leaves still carry the renderer's neutral white modulation
  // colour, but they are fail-closed until their exact prepared image binds.
  const color = roleColor ?? "#ffffff";
  return Object.freeze({
    id,
    role,
    color,
    browserSafe: /^#[0-9a-f]{6}$/u.test(color),
    sourceColorCode,
    sourceKind: sourceColorCode < 0 || sourceColorCode > 255 ? "native-texture-reference" : "native-solid-index",
    ...(preparedTextureRequired ? { preparedTextureRequired: true } : {}),
  });
}

function aggregateObjectMetrics(objects, symbolCache) {
  const sourceIds = objects.flatMap(({ polygons }) => (
    polygons.flatMap(({ sources }) => sources.map(({ id }) => id))
  ));
  return Object.freeze({
    sourceObjectInstanceCount: objects.length,
    uniqueStaticSymbolPairCount: symbolCache.size,
    instancedPointCount: objects.reduce((sum, object) => sum + object.pointCount, 0),
    sourceFaceInstanceCount: objects.reduce((sum, object) => sum + object.faceCount, 0),
    sourceTriangleInstanceCount: objects.reduce((sum, object) => sum + object.sourceTriangleCount, 0),
    polygonCount: objects.reduce((sum, object) => sum + object.polygonCount, 0),
    renderLeafCount: objects.reduce((sum, object) => sum + object.polygons.length, 0),
    uniqueSourceFaceIdCount: new Set(sourceIds).size,
  });
}

function sourceTriangleCount(face) {
  if (face.primitive === "line") return 2;
  if (face.primitive === "polygon") return Math.max(0, face.pointIndexes.length - 2);
  return 2;
}

function boundsForObjects(objects) {
  const vertices = objects.flatMap(({ polygons }) => polygons.flatMap(({ vertices }) => vertices));
  if (vertices.length === 0) throw new Error("Prepared pitch slice has no visible vertices.");
  return Object.freeze({
    min: Object.freeze([0, 1, 2].map((axis) => Math.min(...vertices.map((vertex) => vertex[axis])))),
    max: Object.freeze([0, 1, 2].map((axis) => Math.max(...vertices.map((vertex) => vertex[axis])))),
  });
}

function validateFacts(facts) {
  if (facts?.schema !== "cssoccer-source-facts@1" || facts.stadium?.entryIndex !== 2) {
    throw new Error("B6 requires the pinned Spain source-fact contract.");
  }
  if (facts.pitch?.nativeUnitsPerYard !== 16 || facts.pitch?.rendererBounds?.x?.[1] !== 1280
      || facts.pitch?.rendererBounds?.z?.[0] !== -800) {
    throw new Error("B6 pitch source facts changed from the pinned 80x50-yard renderer bounds.");
  }
}

function requireVector(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
    throw new TypeError(`${label} must be a finite vec3.`);
  }
}

function add(left, right) {
  return left.map((value, axis) => value + right[axis]);
}

function subtract(left, right) {
  return left.map((value, axis) => value - right[axis]);
}

function cross(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function magnitude(value) {
  return Math.hypot(...value);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
