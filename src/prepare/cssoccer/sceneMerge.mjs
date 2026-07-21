import { mergePolygons } from "@layoutit/polycss";

const EPSILON = 1e-6;

export function mergeCssoccerPreparedPolygons(polygons, { scopeId = "cssoccer-scene" } = {}) {
  if (!Array.isArray(polygons)) throw new TypeError("css.soccer scene merge requires a polygon array.");
  const entries = polygons.map((polygon, index) => validateEntry(polygon, index));
  const groups = groupBy(entries, mergeGroupKey);
  const outputs = [];
  let candidatePolygonCount = 0;
  let acceptedCandidatePolygonCount = 0;
  let mergedOutputCount = 0;
  let topologyComponentCount = 0;

  for (const group of groups) {
    for (const component of connectedComponents(group)) {
      topologyComponentCount += 1;
      if (component.length < 2) {
        outputs.push(outputEntry(component[0].polygon, component[0].index));
        continue;
      }
      candidatePolygonCount += component.length;
      const merged = mergePolygons(component.map(({ polygon }) => rendererPolygon(polygon)));
      const inputArea = component.reduce((sum, { polygon }) => sum + polygonArea(polygon.vertices), 0);
      const outputArea = merged.reduce((sum, polygon) => sum + polygonArea(polygon.vertices), 0);
      if (merged.length !== 1 || !validBoundary(merged[0].vertices) || !nearlyEqual(inputArea, outputArea)) {
        component.forEach(({ polygon, index }) => outputs.push(outputEntry(polygon, index)));
        continue;
      }
      const sources = component.flatMap(({ polygon }) => sourceRefs(polygon)).sort(compareSourceRefs);
      outputs.push(outputEntry(Object.freeze({
        ...merged[0],
        color: component[0].polygon.color,
        materialId: component[0].polygon.materialId,
        ...(component[0].polygon.preparedTextureRequired
          ? { preparedTextureRequired: true }
          : {}),
        visibilityGroup: component[0].polygon.visibilityGroup,
        paintOrder: Math.min(...component.map(({ polygon }) => polygon.paintOrder)),
        source: sources[0],
        sources: Object.freeze(sources),
      }), Math.min(...component.map(({ index }) => index))));
      acceptedCandidatePolygonCount += component.length;
      mergedOutputCount += 1;
    }
  }

  outputs.sort((left, right) => left.index - right.index);
  const mergedPolygons = Object.freeze(outputs.map(({ polygon }) => polygon));
  const inputSourceIds = entries.flatMap(({ polygon }) => sourceRefs(polygon).map(({ id }) => id)).sort();
  const outputSourceIds = mergedPolygons.flatMap((polygon) => sourceRefs(polygon).map(({ id }) => id)).sort();
  if (JSON.stringify(inputSourceIds) !== JSON.stringify(outputSourceIds)) {
    throw new Error(`css.soccer merge lost or duplicated source coverage in ${scopeId}.`);
  }
  const areaBefore = entries.reduce((sum, { polygon }) => sum + polygonArea(polygon.vertices), 0);
  const areaAfter = mergedPolygons.reduce((sum, polygon) => sum + polygonArea(polygon.vertices), 0);
  if (!nearlyEqual(areaBefore, areaAfter)) {
    throw new Error(`css.soccer merge changed visible area in ${scopeId}.`);
  }

  return Object.freeze({
    polygons: mergedPolygons,
    metrics: Object.freeze({
      scopeId,
      inputPolygonCount: polygons.length,
      inputTriangleCount: polygons.reduce((sum, polygon) => sum + Math.max(1, polygon.vertices.length - 2), 0),
      topologyComponentCount,
      mergeCandidateCount: candidatePolygonCount,
      acceptedMergeCandidateCount: acceptedCandidatePolygonCount,
      mergeOutputCount: mergedOutputCount,
      outputPolygonCount: mergedPolygons.length,
      outputTriangleCount: mergedPolygons.reduce((sum, polygon) => sum + Math.max(1, polygon.vertices.length - 2), 0),
      sourceFaceCoverageCount: outputSourceIds.length,
      areaBefore: quantize(areaBefore),
      areaAfter: quantize(areaAfter),
      lossless: true,
    }),
  });
}

function validateEntry(polygon, index) {
  if (!polygon || typeof polygon !== "object" || !Array.isArray(polygon.vertices)
      || polygon.vertices.length < 3 || !polygon.vertices.every(validVector)) {
    throw new Error(`css.soccer polygon ${index} has invalid vertices.`);
  }
  if (typeof polygon.color !== "string" || !/^#[0-9a-f]{6}$/u.test(polygon.color)) {
    throw new Error(`css.soccer polygon ${index} has a non-browser-safe color.`);
  }
  if (typeof polygon.materialId !== "string" || typeof polygon.visibilityGroup !== "string") {
    throw new Error(`css.soccer polygon ${index} is missing material or visibility identity.`);
  }
  const refs = sourceRefs(polygon);
  if (refs.length === 0 || refs.some(({ id }) => typeof id !== "string" || id.length === 0)) {
    throw new Error(`css.soccer polygon ${index} is missing source lineage.`);
  }
  return Object.freeze({ polygon, index });
}

function rendererPolygon(polygon) {
  return {
    vertices: polygon.vertices,
    color: polygon.color,
  };
}

function outputEntry(polygon, index) {
  return Object.freeze({ polygon, index });
}

function mergeGroupKey({ polygon }) {
  const sources = sourceRefs(polygon);
  const textureTopologyKey = sources.some(({ sourceColorCode }) => (
    Number.isSafeInteger(sourceColorCode)
      && (sourceColorCode < 0 || sourceColorCode > 255)
  ))
    ? sources.map(({ id }) => id).join(",")
    : "mergeable-solid";
  return [
    polygon.materialId,
    polygon.visibilityGroup,
    planeKey(polygon.vertices) ?? sourceRefs(polygon).map(({ id }) => id).join(","),
    textureTopologyKey,
  ].join("|");
}

function connectedComponents(entries) {
  if (entries.length < 2) return [entries];
  const edgeOwners = new Map();
  entries.forEach((entry, index) => {
    polygonEdges(entry.polygon.vertices).forEach((edge) => {
      const owners = edgeOwners.get(edge) ?? [];
      owners.push(index);
      edgeOwners.set(edge, owners);
    });
  });
  const adjacency = Array.from({ length: entries.length }, () => new Set());
  for (const owners of edgeOwners.values()) {
    if (owners.length !== 2) continue;
    adjacency[owners[0]].add(owners[1]);
    adjacency[owners[1]].add(owners[0]);
  }
  const seen = new Set();
  const components = [];
  for (let start = 0; start < entries.length; start += 1) {
    if (seen.has(start)) continue;
    const stack = [start];
    const component = [];
    seen.add(start);
    while (stack.length > 0) {
      const current = stack.pop();
      component.push(entries[current]);
      for (const neighbor of adjacency[current]) {
        if (seen.has(neighbor)) continue;
        seen.add(neighbor);
        stack.push(neighbor);
      }
    }
    component.sort((left, right) => left.index - right.index);
    components.push(component);
  }
  return components;
}

function groupBy(entries, keyFor) {
  const groups = new Map();
  for (const entry of entries) {
    const key = keyFor(entry);
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function polygonEdges(vertices) {
  return vertices.map((vertex, index) => {
    const next = vertices[(index + 1) % vertices.length];
    const left = vectorKey(vertex);
    const right = vectorKey(next);
    return left < right ? `${left}~${right}` : `${right}~${left}`;
  });
}

function planeKey(vertices) {
  const origin = vertices[0];
  let normal = null;
  for (let index = 1; index < vertices.length - 1 && !normal; index += 1) {
    const candidate = cross(subtract(vertices[index], origin), subtract(vertices[index + 1], origin));
    const length = Math.hypot(...candidate);
    if (length > EPSILON) normal = candidate.map((value) => value / length);
  }
  if (!normal) return null;
  const firstNonzero = normal.find((value) => Math.abs(value) > EPSILON) ?? 0;
  if (firstNonzero < 0) normal = normal.map((value) => -value);
  const distance = -dot(normal, origin);
  return [...normal, distance].map(quantize).join(",");
}

function polygonArea(vertices) {
  let accumulator = [0, 0, 0];
  for (let index = 0; index < vertices.length; index += 1) {
    accumulator = add(accumulator, cross(vertices[index], vertices[(index + 1) % vertices.length]));
  }
  return Math.hypot(...accumulator) / 2;
}

function validBoundary(vertices) {
  return Array.isArray(vertices) && vertices.length >= 3 && vertices.every(validVector)
    && new Set(vertices.map(vectorKey)).size === vertices.length && polygonArea(vertices) > EPSILON;
}

function sourceRefs(polygon) {
  return Array.isArray(polygon.sources) ? polygon.sources : polygon.source ? [polygon.source] : [];
}

function compareSourceRefs(left, right) {
  return (left.sourceFaceIndex ?? 0) - (right.sourceFaceIndex ?? 0) || left.id.localeCompare(right.id);
}

function validVector(value) {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}

function vectorKey(vector) {
  return vector.map(quantize).join(",");
}

function quantize(value) {
  return Math.round(value / EPSILON) * EPSILON;
}

function nearlyEqual(left, right) {
  return Math.abs(left - right) <= EPSILON * Math.max(1, Math.abs(left), Math.abs(right));
}

function subtract(left, right) {
  return left.map((value, axis) => value - right[axis]);
}

function add(left, right) {
  return left.map((value, axis) => value + right[axis]);
}

function cross(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function dot(left, right) {
  return left.reduce((sum, value, axis) => sum + value * right[axis], 0);
}
