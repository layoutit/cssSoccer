import { decodeCssoccerPitchSlice } from "./pitchParser.mjs";
import { mergeCssoccerPreparedPolygons } from "./sceneMerge.mjs";

export const CSSOCCER_STATIC_SCENE_SCHEMA = "cssoccer-prepared-static-scene@1";

export async function buildCssoccerPitchPreparedScene({ sourceRoot, facts } = {}) {
  const slice = await decodeCssoccerPitchSlice({ sourceRoot, facts });
  const meshGroups = groupObjects(slice.objects);
  const meshes = [];
  const mergeMetrics = [];

  for (const group of meshGroups) {
    const merged = mergeCssoccerPreparedPolygons(
      group.objects.flatMap(({ polygons }) => polygons),
      { scopeId: group.id },
    );
    assertVisibleLeaves(merged.polygons, group.id);
    mergeMetrics.push(merged.metrics);
    meshes.push(Object.freeze({
      id: group.id,
      kind: group.kind,
      sourceId: group.sourceId,
      sourceObjectIds: Object.freeze(group.objects.map(({ sourceObject }) => sourceObject)),
      stableDom: true,
      transform: Object.freeze({ position: Object.freeze([0, 0, 0]) }),
      polygons: merged.polygons,
      metrics: merged.metrics,
    }));
  }

  const metrics = aggregateSceneMetrics({ slice, meshes, mergeMetrics });
  if (metrics.sourceFaceCount !== metrics.sourceFaceCoverageCount || !metrics.mergeLossless) {
    throw new Error("Prepared css.soccer scene failed exact source-face coverage.");
  }
  return deepFreeze({
    schema: CSSOCCER_STATIC_SCENE_SCHEMA,
    id: "spain-argentina-stadium-static",
    fixtureId: "spain-argentina-full-match",
    status: "ready",
    axes: slice.axes,
    dimensions: slice.dimensions,
    cameraAnchor: {
      status: "prepared-static-framing; parent B9 owns native camera binding",
      target: [640, 0, -400],
      playingFieldCenter: [640, 0, -400],
    },
    materials: slice.materials,
    meshes,
    roots: {
      static: meshes.map(({ id, kind, sourceId }) => ({ id, kind, sourceId, stableDom: true })),
      officials: slice.officialRoots,
    },
    metrics,
    lineage: slice.lineage,
    runtimeConstruction: {
      sourceParseCount: 0,
      geometryBuildCount: 0,
      topologyBuildCount: 0,
      materialBuildCount: 0,
      atlasBuildCount: 0,
    },
  });
}

function groupObjects(objects) {
  const definitions = [
    { id: "pitch", kind: "prepared-pitch", sourceId: "pitch", select: (object) => object.role === "pitch" },
    { id: "pitch-markings", kind: "prepared-pitch-markings", sourceId: "lines-circle-semis-spots", select: (object) => object.role === "marking" },
    { id: "goal-left", kind: "prepared-goal", sourceId: "goal-1", select: (object) => object.role === "goal" && object.sourceObject.endsWith("_1") },
    { id: "goal-right", kind: "prepared-goal", sourceId: "goal-2", select: (object) => object.role === "goal" && object.sourceObject.endsWith("_2") },
    { id: "corner-flags", kind: "prepared-corner-flags", sourceId: "flag-1-4", select: (object) => object.role === "flag" },
    ...[1, 2, 3, 4].map((slot) => ({
      id: `stadium-stand-${slot}`,
      kind: "prepared-stadium-stand",
      sourceId: `stad${slot}`,
      select: (object) => object.id === `stadium-stand-${slot}`,
    })),
  ];
  const claimed = new Set();
  const groups = definitions.map((definition) => {
    const selected = objects.filter(definition.select);
    if (selected.length === 0) throw new Error(`Prepared css.soccer group ${definition.id} is empty.`);
    for (const object of selected) {
      if (claimed.has(object.id)) throw new Error(`Prepared css.soccer object ${object.id} belongs to two groups.`);
      claimed.add(object.id);
    }
    return Object.freeze({ ...definition, objects: Object.freeze(selected) });
  });
  if (claimed.size !== objects.length) {
    const missing = objects.filter(({ id }) => !claimed.has(id)).map(({ id }) => id);
    throw new Error(`Prepared css.soccer objects are not grouped: ${missing.join(", ")}.`);
  }
  return Object.freeze(groups);
}

function aggregateSceneMetrics({ slice, meshes, mergeMetrics }) {
  return Object.freeze({
    sourceObjectCount: slice.metrics.sourceObjectInstanceCount,
    uniqueStaticSymbolPairCount: slice.metrics.uniqueStaticSymbolPairCount,
    sourcePointCount: slice.metrics.instancedPointCount,
    sourceFaceCount: slice.metrics.sourceFaceInstanceCount,
    sourceTriangleCount: slice.metrics.sourceTriangleInstanceCount,
    preparedPolygonCount: slice.metrics.polygonCount,
    meshCount: meshes.length,
    officialRootCount: slice.officialRoots.length,
    mergeTopologyComponentCount: sum(mergeMetrics, "topologyComponentCount"),
    mergeCandidateCount: sum(mergeMetrics, "mergeCandidateCount"),
    acceptedMergeCandidateCount: sum(mergeMetrics, "acceptedMergeCandidateCount"),
    mergeOutputCount: sum(mergeMetrics, "mergeOutputCount"),
    renderLeafCount: sum(mergeMetrics, "outputPolygonCount"),
    renderTriangleCount: sum(mergeMetrics, "outputTriangleCount"),
    sourceFaceCoverageCount: sum(mergeMetrics, "sourceFaceCoverageCount"),
    mergeLossless: mergeMetrics.every(({ lossless }) => lossless),
  });
}

function assertVisibleLeaves(polygons, scopeId) {
  for (const [index, polygon] of polygons.entries()) {
    if (!Array.isArray(polygon.vertices) || polygon.vertices.length < 3
        || !polygon.vertices.every((vertex) => Array.isArray(vertex) && vertex.length === 3 && vertex.every(Number.isFinite))) {
      throw new Error(`${scopeId} visible leaf ${index} has invalid prepared vertices.`);
    }
    if (!/^#[0-9a-f]{6}$/u.test(polygon.color) || typeof polygon.materialId !== "string") {
      throw new Error(`${scopeId} visible leaf ${index} has an unsafe prepared material.`);
    }
    if (!Array.isArray(polygon.sources) || polygon.sources.length === 0
        || polygon.sources.some(({ id, container }) => typeof id !== "string" || typeof container !== "string")) {
      throw new Error(`${scopeId} visible leaf ${index} lost source lineage.`);
    }
  }
}

function sum(entries, key) {
  return entries.reduce((total, entry) => total + entry[key], 0);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
