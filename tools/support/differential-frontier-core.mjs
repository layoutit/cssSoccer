import { createHash } from "node:crypto";

export const DIFFERENTIAL_FRONTIER_EVIDENCE_SCHEMA =
  "cssoccer-differential-frontier-evidence@1";
export const DIFFERENTIAL_FRONTIER_AGENT_SCHEMA =
  "cssoccer-differential-frontier-agent@1";

const SHA256 = /^[a-f0-9]{64}$/u;
// Do not mistake the second byte of ==, !=, <=, or >= for an assignment.
const WRITE_PATTERN = /(?:\+\+|--|(?<![=!<>])(?:<<|>>|[+\-*/%&|^])?=(?!=))/u;
const FUNCTION_PATTERN = /^\s*(?:(?:static|inline|extern|const|unsigned|signed|long|short|void|int|char|float|double|bool|struct|class|auto)\s+|[A-Za-z_]\w*(?:::\w+)?[\s*&]+)+([A-Za-z_~]\w*)\s*\([^;]*\)\s*(?:const\s*)?\{?\s*$/u;
const CONTROL_WORDS = new Set(["if", "for", "while", "switch", "catch"]);
const EVIDENCE_FILES = new Set([
  "browserEngineIndependence.mjs",
  "client.mjs",
  "debugApi.mjs",
  "nativeFieldContract.mjs",
  "nativeFieldProjection.mjs",
  "oracleState.mjs",
]);

export class DifferentialFrontierError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "DifferentialFrontierError";
    this.code = code;
    this.details = details;
  }
}

export function samplesEqual(reference, candidate) {
  return reference?.valueType === candidate?.valueType
    && reference?.numericBits === candidate?.numericBits
    && (reference?.numericBits !== null || Object.is(reference?.value, candidate?.value));
}

export function sampleReport(sample) {
  return Object.freeze({
    valueType: sample.valueType,
    value: sample.value,
    numericBits: sample.numericBits,
  });
}

export function createExactSelector(mismatch, fieldOrder) {
  requireObject(mismatch, "mismatch");
  const ordinal = fieldOrder.get(mismatch.fieldId);
  if (!Number.isSafeInteger(ordinal)) {
    throw new DifferentialFrontierError(
      "frontier-field-missing",
      `Exact field ${mismatch.fieldId} is absent from the retained contract.`,
    );
  }
  const player = mismatch.fieldId.match(/^players\.([a-z0-9-]+)\.(.+)$/u);
  const parts = mismatch.fieldId.split(".");
  return Object.freeze({
    schema: "cssoccer-differential-frontier-selector@1",
    tick: mismatch.tick,
    phase: mismatch.phase,
    phaseOrder: mismatch.phaseOrder,
    fieldId: mismatch.fieldId,
    fieldOrdinal: ordinal,
    valueType: mismatch.reference.valueType,
    referenceBits: mismatch.reference.numericBits,
    candidateBits: mismatch.candidate.numericBits,
    domain: parts[0],
    entityId: player?.[1] ?? null,
    leaf: player?.[2] ?? parts.slice(1).join("."),
  });
}

export function compareExactCoordinates(left, right, fieldOrder) {
  if (left === null && right === null) return "same";
  if (left === null) return "regressed";
  if (right === null) return "complete";
  const leftCoordinate = coordinate(left, fieldOrder);
  const rightCoordinate = coordinate(right, fieldOrder);
  if (rightCoordinate.tick !== leftCoordinate.tick) {
    return rightCoordinate.tick > leftCoordinate.tick ? "advanced" : "regressed";
  }
  if (rightCoordinate.phaseOrder !== leftCoordinate.phaseOrder) {
    return rightCoordinate.phaseOrder > leftCoordinate.phaseOrder ? "advanced" : "regressed";
  }
  if (rightCoordinate.fieldOrdinal !== leftCoordinate.fieldOrdinal) {
    return rightCoordinate.fieldOrdinal > leftCoordinate.fieldOrdinal ? "advanced" : "regressed";
  }
  return right.reference?.numericBits === left.reference?.numericBits
    && right.candidate?.numericBits === left.candidate?.numericBits
    ? "same"
    : "changed-at-coordinate";
}

export function classifyMismatch(mismatch, transitionClues = []) {
  const selector = mismatch.selector ?? mismatch;
  const leaf = selector.leaf ?? selector.fieldId?.split(".").at(-1) ?? "";
  const domain = selector.domain ?? selector.fieldId?.split(".")[0] ?? "";
  const referenceChanged = transitionClues.find(({ fieldId }) => fieldId === selector.fieldId)
    ?.referenceChanged ?? null;
  const candidateChanged = transitionClues.find(({ fieldId }) => fieldId === selector.fieldId)
    ?.candidateChanged ?? null;
  let id = "producer-transition";
  let question = "Which source-owned transition first writes the selected field differently?";
  if (domain === "rng") {
    id = "rng-call-order";
    question = "Which source call consumes or skips the first differing RNG value?";
  } else if (/^(?:action|animation|ball_state|control|possession)$/u.test(leaf)) {
    id = "branch-transition";
    question = "Which native branch condition changes this discrete state at the checked tick?";
  } else if (referenceChanged === true && candidateChanged === false) {
    id = "missing-transition";
    question = "Which native transition fires here but is absent from the browser schedule?";
  } else if (referenceChanged === false && candidateChanged === true) {
    id = "extra-transition";
    question = "Which browser transition fires here but the native schedule skips?";
  } else if (
    mismatch.reason === "numeric-bits"
    && new Set(["f32", "f64"]).has(mismatch.reference?.valueType)
  ) {
    const ulpDistance = numericUlpDistance(
      mismatch.reference.numericBits,
      mismatch.candidate.numericBits,
    );
    id = ulpDistance !== null && ulpDistance <= 4
      ? "float-store-order"
      : "numeric-producer";
    question = id === "float-store-order"
      ? "Which native store boundary or operand order produces the first differing float bits?"
      : "Which native arithmetic producer first diverges for this numeric field?";
  } else if (domain === "ball") {
    id = "ball-transition";
    question = "Which BALL or BALLINT transition first changes this state differently?";
  }
  return Object.freeze({
    schema: "cssoccer-differential-frontier-route@1",
    id,
    question,
    diagnosticOnly: true,
  });
}

export function buildTransitionClues({
  previousReference,
  previousCandidate,
  reference,
  candidate,
  selectedFieldIds,
  exactFieldId,
  limit = 24,
}) {
  const clues = [];
  for (const fieldId of selectedFieldIds) {
    const beforeReference = previousReference?.get(fieldId) ?? null;
    const beforeCandidate = previousCandidate?.get(fieldId) ?? null;
    const afterReference = reference.get(fieldId);
    const afterCandidate = candidate.get(fieldId);
    if (!afterReference || !afterCandidate) continue;
    const referenceChanged = beforeReference === null
      ? null
      : !samplesEqual(beforeReference, afterReference);
    const candidateChanged = beforeCandidate === null
      ? null
      : !samplesEqual(beforeCandidate, afterCandidate);
    const differs = !samplesEqual(afterReference, afterCandidate);
    if (!differs && referenceChanged === candidateChanged) continue;
    clues.push(Object.freeze({
      fieldId,
      exact: fieldId === exactFieldId,
      referenceChanged,
      candidateChanged,
      before: beforeReference === null ? null : sampleReport(beforeReference),
      reference: sampleReport(afterReference),
      candidate: sampleReport(afterCandidate),
    }));
  }
  clues.sort((left, right) => (
    Number(right.exact) - Number(left.exact)
    || Number(right.referenceChanged !== right.candidateChanged)
      - Number(left.referenceChanged !== left.candidateChanged)
    || left.fieldId.localeCompare(right.fieldId)
  ));
  return Object.freeze(clues.slice(0, limit));
}

export function parseSourceOwner(sourceOwner) {
  if (typeof sourceOwner !== "string" || sourceOwner.trim().length === 0) {
    throw new TypeError("sourceOwner must be non-empty text.");
  }
  const files = [...sourceOwner.matchAll(/\b([A-Za-z0-9_]+\.(?:CPP|C|H))\b/gu)]
    .map((match) => match[1].toUpperCase());
  const dottedMembers = [...sourceOwner.matchAll(/\.([A-Za-z_]\w*)\b/gu)]
    .map((match) => match[1]);
  const tokens = [...sourceOwner.matchAll(/\b([A-Za-z_]\w*)\b/gu)]
    .map((match) => match[1])
    .filter((token) => !new Set(["CPP", "C", "H"]).has(token.toUpperCase()));
  return Object.freeze({
    sourceOwner,
    files: Object.freeze([...new Set(files)]),
    symbols: Object.freeze([...new Set([...dottedMembers, ...tokens])]),
    primarySymbol: dottedMembers.at(-1) ?? tokens.at(-1) ?? null,
  });
}

export function findNativeWriteSites(files, {
  sourceOwner,
  additionalSymbols = [],
  preferredValueSymbols = [],
  limit = 12,
} = {}) {
  const owner = parseSourceOwner(sourceOwner);
  const symbols = [...new Set([
    owner.primarySymbol,
    ...owner.symbols,
    ...additionalSymbols,
  ].filter((symbol) => typeof symbol === "string" && symbol.length > 2))];
  const sites = [];
  for (const file of files) {
    const lines = file.text.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const matched = symbols.filter((symbol) => wordPattern(symbol).test(line));
      if (matched.length === 0) continue;
      const write = WRITE_PATTERN.test(line);
      const sourceFile = owner.files.includes(file.name.toUpperCase());
      const context = enclosingFunction(lines, index);
      const functionMatches = context.name !== null && owner.symbols.includes(context.name);
      const matchesPreferredValue = preferredValueSymbols.some((symbol) => (
        wordPattern(symbol).test(line)
      ));
      const matchesPrimary = matched.includes(owner.primarySymbol);
      const additionalMatches = matched.filter((symbol) => (
        symbol !== owner.primarySymbol && additionalSymbols.includes(symbol)
      )).length;
      let score = matched.length * 3 + Math.min(additionalMatches, 3) * 2;
      if (write) score += 30;
      if (sourceFile) score += 18;
      if (functionMatches) score += 25;
      if (matchesPrimary) score += 25;
      if (write && matchesPrimary) score += 60;
      if (write && matchesPreferredValue) score += 80;
      if (/\b(?:struct|extern|typedef)\b/u.test(line) && !write) score -= 25;
      sites.push({
        file: file.path,
        line: index + 1,
        function: context.name,
        score,
        write,
        matchedPreferredValue: matchesPreferredValue,
        matchedSymbols: matched,
        source: line.trim().slice(0, 260),
      });
    }
  }
  return Object.freeze(sites
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score
      || left.file.localeCompare(right.file)
      || left.line - right.line)
    .slice(0, limit)
    .map(Object.freeze));
}

export function buildNativeSymbolTable(nativeFiles, runtimeFiles = []) {
  const entries = [];
  const seen = new Set();
  const add = ({ symbol, sourceSymbol = symbol, value, file, line, kind }) => {
    if (!symbol || !Number.isFinite(value)) return;
    const key = `${symbol}\u0000${value}\u0000${file}\u0000${line}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push(Object.freeze({ symbol, sourceSymbol, value, file, line, kind }));
  };

  for (const file of nativeFiles) {
    const lines = file.text.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      const define = lines[index].match(
        /^\s*#\s*define\s+([A-Z][A-Z0-9_]*)\s+(-?(?:0[xX][0-9a-fA-F]+|\d+))\b/u,
      );
      if (!define) continue;
      add({
        symbol: define[1],
        value: Number(define[2]),
        file: file.path,
        line: index + 1,
        kind: "native-define",
      });
    }
    for (const enumeration of nativeEnumConstants(file.text)) {
      add({ ...enumeration, file: file.path, kind: "native-enum" });
    }
  }

  const integerConstantPattern = /integerConstant\(\s*"([A-Z][A-Z0-9_]*)"\s*,\s*"[iu](?:8|16|32)"\s*,\s*(-?\d+)\s*\)/gu;
  const runtimeConstantPattern = /\bconst\s+([A-Z][A-Z0-9_]*)\s*=\s*(-?(?:0[xX][0-9a-fA-F]+|\d+))\s*;/gu;
  const annotatedSymbolPattern = /["'`]([A-Z][A-Z0-9_]*)\s+(-?\d+)\b/gu;
  for (const file of runtimeFiles) {
    for (const match of file.text.matchAll(integerConstantPattern)) {
      add({
        symbol: match[1],
        value: Number(match[2]),
        file: file.path,
        line: lineNumberAt(file.text, match.index),
        kind: "runtime-native-constant",
      });
    }
    for (const match of file.text.matchAll(runtimeConstantPattern)) {
      add({
        symbol: normalizeRuntimeSymbol(match[1]),
        sourceSymbol: match[1],
        value: Number(match[2]),
        file: file.path,
        line: lineNumberAt(file.text, match.index),
        kind: "runtime-constant",
      });
    }
    for (const match of file.text.matchAll(annotatedSymbolPattern)) {
      add({
        symbol: match[1],
        value: Number(match[2]),
        file: file.path,
        line: lineNumberAt(file.text, match.index),
        kind: "runtime-source-annotation",
      });
    }
  }

  return Object.freeze(entries.sort((left, right) => (
    left.symbol.localeCompare(right.symbol)
    || left.value - right.value
    || left.file.localeCompare(right.file)
    || left.line - right.line
  )));
}

export function resolveNativeTransitionSymbols(changes, symbolTable, { limit = 12 } = {}) {
  const resolved = [];
  for (const change of changes) {
    if (!Number.isSafeInteger(change.after)) continue;
    const matches = symbolTable
      .filter(({ value }) => value === change.after)
      .map((entry) => ({ ...entry, score: nativeSymbolScore(change.sourceMember, entry) }))
      .filter(({ score }) => score >= 40)
      .sort((left, right) => right.score - left.score
        || nativeSymbolKindOrder(left.kind) - nativeSymbolKindOrder(right.kind)
        || left.symbol.localeCompare(right.symbol));
    const unique = [];
    const symbols = new Set();
    for (const match of matches) {
      if (symbols.has(match.symbol)) continue;
      symbols.add(match.symbol);
      unique.push(Object.freeze(match));
      if (unique.length === 4) break;
    }
    if (unique.length === 0) continue;
    resolved.push(Object.freeze({
      sourceMember: change.sourceMember,
      browserPath: change.browserPath,
      before: change.before,
      after: change.after,
      symbol: unique[0].symbol,
      alternatives: Object.freeze(unique),
    }));
  }
  return Object.freeze(resolved
    .sort((left, right) => nativeMemberOrder(left.sourceMember) - nativeMemberOrder(right.sourceMember)
      || left.sourceMember.localeCompare(right.sourceMember))
    .slice(0, limit));
}

export function findNativeCallerBranches(files, {
  callee,
  transitionSymbols = [],
  runtimeFiles = [],
  limit = 10,
} = {}) {
  if (typeof callee !== "string" || callee.length === 0) return Object.freeze([]);
  const runtimeText = runtimeFiles.map(({ text }) => text).join("\n");
  const callPattern = wordPattern(callee);
  const sites = [];
  for (const file of files) {
    const lines = file.text.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!callPattern.test(line) || !line.includes("(")) continue;
      const context = enclosingFunction(lines, index);
      if (context.name === callee && context.line === index + 1) continue;
      const argumentsList = callArguments(line, callee);
      if (argumentsList === null) continue;
      const branch = nearestNativeBranch(lines, index, context.line);
      const identifiers = [...new Set(argumentsList.flatMap((argument) => (
        [...argument.matchAll(/\b[A-Z][A-Z0-9_]*\b/gu)].map((match) => match[0])
      )))];
      const matchedTransitionSymbols = transitionSymbols.filter((symbol) => identifiers.includes(symbol));
      const runtimeMentioned = context.name !== null && wordPattern(context.name).test(runtimeText);
      let score = 20 + matchedTransitionSymbols.length * 120;
      if (branch.caseValue !== null) score += 24;
      if (runtimeMentioned) score += 90;
      if (/\b(?:make|init|start|set)_/u.test(context.name ?? "")) score += 8;
      sites.push({
        file: file.path,
        line: index + 1,
        function: context.name,
        functionLine: context.line,
        callee,
        arguments: Object.freeze(argumentsList),
        argumentSymbols: Object.freeze(identifiers),
        matchedTransitionSymbols: Object.freeze(matchedTransitionSymbols),
        switchExpression: branch.switchExpression,
        caseExpression: branch.caseExpression,
        caseValue: branch.caseValue,
        runtimeMentioned,
        score,
        source: line.trim().slice(0, 260),
      });
    }
  }

  const groups = new Map();
  for (const site of sites) {
    const key = `${site.file}\u0000${site.function}\u0000${site.switchExpression}`;
    const group = groups.get(key) ?? [];
    group.push(site);
    groups.set(key, group);
  }
  return Object.freeze(sites
    .filter(({ matchedTransitionSymbols }) => matchedTransitionSymbols.length > 0)
    .sort((left, right) => right.score - left.score
      || left.file.localeCompare(right.file)
      || left.line - right.line)
    .slice(0, limit)
    .map((site) => Object.freeze({
      ...site,
      dispatchTable: Object.freeze((groups.get(
        `${site.file}\u0000${site.function}\u0000${site.switchExpression}`,
      ) ?? [])
        .filter(({ caseExpression }) => caseExpression !== null)
        .map((entry) => Object.freeze({
          caseExpression: entry.caseExpression,
          caseValue: entry.caseValue,
          arguments: entry.arguments,
          argumentSymbols: entry.argumentSymbols,
          line: entry.line,
        }))),
    })));
}

export function findNativeBranchDiscriminators(files, {
  branches = [],
  limit = 6,
} = {}) {
  const branchFunctions = [];
  const seenFunctions = new Set();
  for (const branch of branches) {
    if (!branch?.file || !branch.function) continue;
    const key = `${branch.file}\u0000${branch.function}`;
    if (seenFunctions.has(key)) continue;
    seenFunctions.add(key);
    branchFunctions.push(branch);
  }
  if (branchFunctions.length < 2) return Object.freeze([]);
  const fileByPath = new Map(files.map((file) => [file.path, file]));
  const assignmentsBySymbol = new Map();
  for (const branch of branchFunctions) {
    const file = fileByPath.get(branch.file);
    if (!file) continue;
    const lines = file.text.split(/\r?\n/u);
    const start = Math.max(0, (branch.functionLine ?? 1) - 1);
    let end = lines.length;
    for (let index = start + 1; index < lines.length; index += 1) {
      const match = lines[index].match(FUNCTION_PATTERN);
      if (!match || CONTROL_WORDS.has(match[1])) continue;
      end = index;
      break;
    }
    const code = uncommentedLines(lines.slice(start, end), start + 1);
    const bySymbol = new Map();
    for (const entry of code) {
      const match = entry.source.match(
        /^\s*([A-Za-z_]\w*)\s*=\s*([A-Z][A-Z0-9_]*|-?(?:0[xX][0-9a-fA-F]+|\d+))\s*;\s*$/u,
      );
      if (!match) continue;
      const values = bySymbol.get(match[1]) ?? [];
      values.push(Object.freeze({
        file: branch.file,
        function: branch.function,
        line: entry.line,
        expression: match[2],
        beforeTransitionCall: entry.line < branch.line,
      }));
      bySymbol.set(match[1], values);
    }
    for (const [symbol, assignments] of bySymbol) {
      const functionKey = `${branch.file}\u0000${branch.function}`;
      const group = assignmentsBySymbol.get(symbol) ?? new Map();
      group.set(functionKey, assignments);
      assignmentsBySymbol.set(symbol, group);
    }
  }
  const candidates = [];
  for (const [symbol, byFunction] of assignmentsBySymbol) {
    if (byFunction.size !== branchFunctions.length) continue;
    const assignments = [];
    let valid = true;
    const expressions = new Set();
    for (const branch of branchFunctions) {
      const key = `${branch.file}\u0000${branch.function}`;
      const values = byFunction.get(key) ?? [];
      const uniqueExpressions = new Set(values.map(({ expression }) => expression));
      if (uniqueExpressions.size !== 1) {
        valid = false;
        break;
      }
      const [expression] = uniqueExpressions;
      expressions.add(expression);
      assignments.push(values[0]);
    }
    if (!valid || expressions.size !== branchFunctions.length) continue;
    let score = 180 + expressions.size * 40;
    if (/type|mode|kind|action|state/iu.test(symbol)) score += 45;
    score += assignments.filter(({ beforeTransitionCall }) => beforeTransitionCall).length * 15;
    candidates.push(Object.freeze({
      symbol,
      score,
      assignments: Object.freeze(assignments),
    }));
  }
  return Object.freeze(candidates
    .sort((left, right) => right.score - left.score || left.symbol.localeCompare(right.symbol))
    .slice(0, limit));
}

export function findNativeGuardedCallSites(files, {
  callee,
  playerControl = null,
  limit = 8,
} = {}) {
  if (typeof callee !== "string" || callee.length === 0) return Object.freeze([]);
  const pattern = wordPattern(callee);
  const sites = [];
  for (const file of files) {
    const lines = file.text.split(/\r?\n/u);
    const code = uncommentedLines(lines, 1);
    for (let index = 0; index < code.length; index += 1) {
      const entry = code[index];
      if (!pattern.test(entry.source) || !entry.source.includes("(")) continue;
      const context = enclosingFunction(lines, index);
      if (context.name === callee && context.line === entry.line) continue;
      let guard = null;
      for (let cursor = index - 1; cursor >= Math.max(0, index - 8); cursor -= 1) {
        const match = code[cursor].source.match(/\bif\s*\((.+)\)\s*$/u);
        if (!match) continue;
        guard = {
          line: code[cursor].line,
          condition: match[1].trim(),
          source: code[cursor].source.trim(),
        };
        break;
      }
      const conditionCalls = guard === null
        ? []
        : [...guard.condition.matchAll(/\b([A-Za-z_]\w*)\s*\(/gu)].map((match) => match[1]);
      const downstreamCalls = [];
      for (let cursor = index + 1; cursor < Math.min(code.length, index + 48); cursor += 1) {
        const nextFunction = lines[cursor].match(FUNCTION_PATTERN);
        if (nextFunction && !CONTROL_WORDS.has(nextFunction[1])) break;
        for (const match of code[cursor].source.matchAll(/\b([A-Za-z_]\w*)\s*\(/gu)) {
          if (/^(?:pass_decide|make_pass|punt_decide|make_punt)$/u.test(match[1])) {
            downstreamCalls.push(match[1]);
          }
        }
      }
      let score = guard === null ? 20 : 100;
      if (conditionCalls.length > 0) score += 50;
      if (downstreamCalls.includes("pass_decide")) score += 55;
      if (playerControl === 0 && /^user_/u.test(context.name ?? "")) score -= 90;
      if (playerControl === 0 && context.name === "got_ball") score += 90;
      if (playerControl !== 0 && /^user_/u.test(context.name ?? "")) score += 90;
      sites.push(Object.freeze({
        file: file.path,
        function: context.name,
        functionLine: context.line,
        line: entry.line,
        callee,
        guard: guard === null ? null : Object.freeze(guard),
        conditionCalls: Object.freeze([...new Set(conditionCalls)]),
        downstreamCalls: Object.freeze([...new Set(downstreamCalls)]),
        score,
        source: entry.source.trim(),
      }));
    }
  }
  return Object.freeze(sites
    .sort((left, right) => right.score - left.score
      || left.file.localeCompare(right.file)
      || left.line - right.line)
    .slice(0, limit));
}

export function findBrowserMappingCandidates(files, {
  nativeBranch,
  transitionSymbols = [],
  callTrace = null,
  limit = 8,
} = {}) {
  if (!nativeBranch) return Object.freeze([]);
  const switchTerms = [...new Set([
    nativeBranch.switchExpression,
    snakeToCamel(nativeBranch.switchExpression ?? ""),
  ].filter((term) => term.length > 2))];
  const nativeTerms = [...new Set([
    nativeBranch.function,
    nativeBranch.callee,
    ...transitionSymbols,
  ].filter((term) => typeof term === "string" && term.length > 2))];
  const activeFunctions = new Set(
    callTrace?.status === "captured"
      ? callTrace.records.map(({ file, function: name }) => `${file ?? ""}\u0000${name}`)
      : [],
  );
  const candidates = [];
  for (const file of files) {
    if (runtimeFileClassification(file.name) !== "runtime") continue;
    const lines = file.text.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const matchedSwitchTerms = switchTerms.filter((term) => line.includes(term));
      const matchedNativeTerms = nativeTerms.filter((term) => wordPattern(term).test(line));
      if (matchedSwitchTerms.length === 0 && matchedNativeTerms.length === 0) continue;
      const context = enclosingFunction(lines, index);
      const activeAtFrontier = activeFunctions.has(`${file.path}\u0000${context.name}`)
        || activeFunctions.has(`\u0000${context.name}`);
      const structural = /\b(?:case|switch)\b|\.has\s*\(|===|!==|\?\s*[^:]+\s*:/u.test(line);
      const exactCaseMentioned = nativeBranch.caseValue !== null
        && runtimeCaseMentioned(line, switchTerms, nativeBranch.caseValue);
      let score = matchedSwitchTerms.length * 55 + matchedNativeTerms.length * 38;
      if (structural) score += 42;
      if (exactCaseMentioned && structural) score += 35;
      if (/qualif|allow|support|valid/iu.test(context.name ?? "")) score += 38;
      if (/initial|launch|kick|pass/iu.test(context.name ?? "")) score += 22;
      if (activeAtFrontier) score += 28;
      candidates.push(Object.freeze({
        file: file.path,
        line: index + 1,
        function: context.name,
        score,
        activeAtFrontier,
        exactCaseMentioned,
        matchedSwitchTerms: Object.freeze(matchedSwitchTerms),
        matchedNativeTerms: Object.freeze(matchedNativeTerms),
        source: line.trim().slice(0, 260),
      }));
    }
  }
  return Object.freeze(candidates
    .sort((left, right) => right.score - left.score
      || left.file.localeCompare(right.file)
      || left.line - right.line)
    .slice(0, limit));
}

export function findRuntimeProducerCandidates(files, {
  selector,
  sourceOwner,
  nativeFunctions = [],
  internalSymbols = [],
  limit = 10,
} = {}) {
  const owner = parseSourceOwner(sourceOwner);
  const aliases = fieldAliases(selector);
  const sourceFunctions = nativeFunctions.filter(Boolean);
  const terms = [...new Set([
    ...owner.files,
    ...owner.symbols,
    ...sourceFunctions,
    ...internalSymbols,
    ...aliases,
  ].filter((term) => typeof term === "string" && term.length > 2))];
  const sites = [];
  for (const file of files) {
    const lines = file.text.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lower = line.toLowerCase();
      const matched = terms.filter((term) => lower.includes(term.toLowerCase()));
      if (matched.length === 0) continue;
      const context = enclosingFunction(lines, index);
      const write = WRITE_PATTERN.test(line) || /:\s*[^,}]+[,}]?\s*$/u.test(line);
      let score = matched.length * 4;
      if (write) score += 12;
      if (owner.files.some((name) => lower.includes(name.toLowerCase()))) score += 20;
      if (sourceFunctions.some((name) => lower.includes(name.toLowerCase()))) score += 24;
      if (aliases.some((name) => lower.includes(name.toLowerCase()))) score += 12;
      if (owner.primarySymbol && lower.includes(owner.primarySymbol.toLowerCase())) score += 14;
      const classification = runtimeFileClassification(file.name);
      if (classification === "evidence") score -= 24;
      else if (classification === "runtime") score += 8;
      sites.push({
        file: file.path,
        line: index + 1,
        function: context.name,
        classification,
        score,
        write,
        matchedTerms: matched.slice(0, 8),
        source: line.trim().slice(0, 260),
      });
    }
  }
  const rankedSites = sites
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score
      || left.file.localeCompare(right.file)
      || left.line - right.line);
  const byFile = new Map();
  for (const site of rankedSites) {
    const current = byFile.get(site.file) ?? {
      file: site.file,
      classification: site.classification,
      score: 0,
      sites: [],
    };
    if (current.sites.length < 4) {
      current.sites.push(site);
      current.score += site.score;
    }
    byFile.set(site.file, current);
  }
  return Object.freeze([...byFile.values()]
    .sort((left, right) => right.score - left.score || left.file.localeCompare(right.file))
    .slice(0, limit)
    .map((candidate) => Object.freeze({
      ...candidate,
      sites: Object.freeze(candidate.sites.map(Object.freeze)),
    })));
}

export function flattenScalars(value, {
  prefix = "",
  maxDepth = 8,
  maxEntries = 800,
} = {}) {
  const output = new Map();
  const visit = (current, path, depth) => {
    if (output.size >= maxEntries) return;
    if (
      current === null
      || ["string", "number", "boolean"].includes(typeof current)
    ) {
      output.set(path, current);
      return;
    }
    if (depth >= maxDepth || typeof current !== "object") return;
    if (Array.isArray(current)) {
      current.forEach((child, index) => visit(child, `${path}[${index}]`, depth + 1));
      return;
    }
    for (const key of Object.keys(current).sort()) {
      visit(current[key], path ? `${path}.${key}` : key, depth + 1);
    }
  };
  visit(value, prefix, 0);
  return output;
}

export function diffScalarMaps(before, after, { limit = 80 } = {}) {
  const keys = [...new Set([...before.keys(), ...after.keys()])].sort();
  return Object.freeze(keys
    .filter((key) => !Object.is(before.get(key), after.get(key)))
    .slice(0, limit)
    .map((path) => Object.freeze({
      path,
      before: before.has(path) ? before.get(path) : null,
      after: after.has(path) ? after.get(path) : null,
    })));
}

export const MATCH_PLAYER_LAYOUTS = Object.freeze({
  "13d13dca2910a7685be7603e25bc9fa936253f5aa72f73eef3f54e851fbbce34": Object.freeze({
    bytes: 203,
    fields: Object.freeze([
      field("tm_player", 0, "i16", "nativePlayerNumber"),
      field("tm_x", 2, "f32", "position.x"),
      field("tm_xdis", 6, "f32", "displacement.x"),
      field("tm_y", 10, "f32", "position.y"),
      field("tm_ydis", 14, "f32", "displacement.y"),
      field("tm_z", 18, "f32", "position.z"),
      field("tm_zdis", 22, "f32", "displacement.z"),
      field("mface_x", 26, "f32", "mustFace.x"),
      field("mface_y", 30, "f32", "mustFace.y"),
      field("mface_time", 34, "i16", "mustFace.ticks"),
      field("mface", 36, "u8", "mustFace.active"),
      field("tm_dist", 37, "f32", "distance"),
      field("tm_pos", 41, "u8", "distanceRank"),
      field("tm_limbo", 42, "i16", "limbo"),
      field("guy_on", 44, "i16", "on"),
      field("control", 46, "u8", "control"),
      field("tm_srng", 47, "u8", "shirtRange"),
      field("tm_off", 48, "i8", "offside"),
      field("tm_stopped", 49, "u8", "stopped"),
      field("tm_trap", 50, "i8", "trap"),
      field("special", 51, "i16", "special"),
      field("tm_strike", 53, "i16", "strike"),
      field("tm_stime", 55, "f32", "strikeTime"),
      field("tm_ftime", 59, "i16", "freeTime"),
      field("ball_state", 61, "i16", "ballState"),
      field("tm_fpass_type", 63, "i16", "firstPassType"),
      field("tm_fpass_to", 65, "i16", "firstPassTo"),
      field("tm_rate", 70, "u8", "rate"),
      field("turn_dir", 105, "i16", "turnDirection"),
      field("face_dir", 107, "i16", "faceDirection"),
      field("dir_mode", 109, "i16", "directionMode"),
      field("tm_frm", 111, "f32", "animationFrame"),
      field("tm_fstep", 115, "f32", "animationFrameStep"),
      field("tm_anim", 119, "u16", "animation"),
      field("tm_mcspd", 123, "f32", "motionCaptureSpeed"),
      field("contact", 135, "f32", "contact"),
      field("tm_newanim", 139, "u8", "newAnimation"),
      field("tm_barge", 140, "u8", "barge"),
      field("tm_limp", 141, "u8", "limp"),
      field("tm_act", 142, "i16", "action"),
      field("tm_poss", 144, "i16", "possessionTicks"),
      field("tm_wall", 146, "i16", "wall"),
      field("tm_leave", 148, "i16", "leave"),
      field("tm_mark", 150, "i16", "mark"),
      field("go_dist", 152, "i32", "goDistance"),
      field("go_cnt", 156, "i32", "goCount"),
      field("go_txdis", 160, "f32", "goDisplacement.x"),
      field("go_tydis", 164, "f32", "goDisplacement.y"),
      field("go_tx", 168, "f32", "goTarget.x"),
      field("go_ty", 172, "f32", "goTarget.y"),
      field("go_xoff", 176, "f32", "goOffset.x"),
      field("go_yoff", 180, "f32", "goOffset.y"),
      field("tm_jump", 184, "f32", "jump"),
      field("go_stop", 188, "u8", "goStop"),
      field("go_step", 189, "u8", "goStep"),
      field("tm_notme", 190, "u8", "notMe"),
      field("int_move", 191, "i16", "intelligenceMove"),
      field("int_cnt", 193, "i16", "intelligenceCount"),
      field("mess_num", 195, "i16", "messageNumber"),
      field("mess_cnt", 197, "i16", "messageCount"),
      field("tm_comm", 199, "i16", "communication"),
      field("tm_ccnt", 201, "i16", "communicationCount"),
    ]),
  }),
});

export function parseCssoraw2(buffer, {
  ranges: expectedRanges,
  version = 2,
  metadataBytes = 28,
  activeFlag = 1,
} = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) {
    throw new DifferentialFrontierError("native-raw-short", "Native raw evidence is truncated.");
  }
  if (buffer.subarray(0, 8).toString("ascii") !== "CSSORAW2") {
    throw new DifferentialFrontierError("native-raw-magic", "Native raw evidence is not CSSORAW2.");
  }
  const actualVersion = buffer.readUInt32LE(8);
  const rangeCount = buffer.readUInt32LE(12);
  if (actualVersion !== version || !Array.isArray(expectedRanges) || rangeCount !== expectedRanges.length) {
    throw new DifferentialFrontierError("native-raw-contract", "Native raw header does not match its retained profile.");
  }
  let cursor = 16;
  let payloadBytes = 0;
  const ranges = [];
  for (let index = 0; index < rangeCount; index += 1) {
    if (cursor + 8 > buffer.length) {
      throw new DifferentialFrontierError("native-raw-ranges", "Native raw range table is truncated.");
    }
    const offset = buffer.readUInt32LE(cursor);
    const bytes = buffer.readUInt32LE(cursor + 4);
    const expected = expectedRanges[index];
    if (offset !== expected.offset || bytes !== expected.bytes) {
      throw new DifferentialFrontierError(
        "native-raw-range-mismatch",
        `Native raw range ${index} does not match its retained profile.`,
      );
    }
    ranges.push({ offset, bytes, payloadBase: payloadBytes });
    payloadBytes += bytes;
    cursor += 8;
  }
  const recordBytes = metadataBytes + payloadBytes;
  const remaining = buffer.length - cursor;
  if (remaining <= 0 || remaining % recordBytes !== 0) {
    throw new DifferentialFrontierError("native-raw-records", "Native raw record domain is truncated.");
  }
  const byTick = new Map();
  const count = remaining / recordBytes;
  for (let index = 0; index < count; index += 1) {
    const recordOffset = cursor + index * recordBytes;
    if (buffer.readUInt32LE(recordOffset) !== 0x314b4954) {
      throw new DifferentialFrontierError("native-raw-marker", `Native raw record ${index} is not TIK1.`);
    }
    if (buffer.readUInt32LE(recordOffset + 4) !== index) {
      throw new DifferentialFrontierError("native-raw-sequence", `Native raw sequence breaks at ${index}.`);
    }
    const tick = buffer.readUInt32LE(recordOffset + 20);
    const flags = buffer.readUInt32LE(recordOffset + 24);
    if ((flags & activeFlag) !== 0) {
      if (byTick.has(tick)) {
        throw new DifferentialFrontierError("native-raw-active-duplicate", `Native raw tick ${tick} is duplicated.`);
      }
      byTick.set(tick, Object.freeze({
        buffer,
        ranges,
        tick,
        flags,
        payloadOffset: recordOffset + metadataBytes,
      }));
    }
  }
  return Object.freeze({ ranges: Object.freeze(ranges), byTick, recordBytes, recordCount: count });
}

export function decodeMatchPlayer(record, {
  teamsOffset,
  nativePlayerNumber,
  structSha256,
} = {}) {
  const layout = MATCH_PLAYER_LAYOUTS[structSha256];
  if (!layout) {
    throw new DifferentialFrontierError(
      "native-player-layout-missing",
      `No retained match_player decoder exists for ${String(structSha256)}.`,
    );
  }
  if (!Number.isSafeInteger(nativePlayerNumber) || nativePlayerNumber < 1 || nativePlayerNumber > 22) {
    throw new TypeError("nativePlayerNumber must be between 1 and 22.");
  }
  const base = teamsOffset + (nativePlayerNumber - 1) * layout.bytes;
  return Object.freeze(Object.fromEntries(layout.fields.map((definition) => [
    definition.browserPath,
    readRawValue(record, base + definition.offset, definition.valueType),
  ])));
}

export function changedNativeMembers(before, after, structSha256) {
  const layout = MATCH_PLAYER_LAYOUTS[structSha256];
  if (!layout) return Object.freeze([]);
  return Object.freeze(layout.fields
    .filter(({ browserPath }) => !Object.is(before?.[browserPath], after?.[browserPath]))
    .map(({ sourceMember, browserPath, offset, valueType }) => Object.freeze({
      sourceMember,
      browserPath,
      offset,
      valueType,
      before: before?.[browserPath] ?? null,
      after: after?.[browserPath] ?? null,
    })));
}

export function candidatePlayerContext(state, entityId) {
  if (!state || typeof state !== "object" || typeof entityId !== "string") return null;
  const base = state.players?.find?.(({ id }) => id === entityId) ?? null;
  const live = state.openingLivePlayers?.players?.find?.(({ id }) => id === entityId) ?? null;
  const control = state.liveControl?.players?.find?.(({ id }) => id === entityId) ?? null;
  const possession = state.possession?.players?.find?.(({ stableId }) => stableId === entityId) ?? null;
  if (!base && !live) return null;
  return Object.freeze({
    ...(base ?? {}),
    ...(live ?? {}),
    control: control?.control?.value ?? base?.control ?? null,
    possession: possession?.possession ?? base?.possession ?? null,
    global: {
      ballTravel: state.ballTravel ?? null,
      possessionOwner: state.possession?.owner ?? null,
      selectedPlayerId: state.liveControl?.ownership?.activePlayerId ?? null,
      rng: state.rng ?? null,
    },
  });
}

export function runtimeFileClassification(name) {
  if (EVIDENCE_FILES.has(name)) return "evidence";
  if (/Profile\.mjs$/u.test(name)) return "prepared-input";
  return "runtime";
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256Canonical(value) {
  return sha256(canonicalJson(value));
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function requireSha256(value, label) {
  if (!SHA256.test(value ?? "")) throw new TypeError(`${label} must be SHA-256.`);
  return value;
}

function coordinate(value, fieldOrder) {
  const fieldId = value.fieldId ?? value.selector?.fieldId;
  const ordinal = fieldOrder.get(fieldId);
  if (!Number.isSafeInteger(ordinal)) {
    throw new DifferentialFrontierError("frontier-coordinate-field", `Unknown frontier field ${fieldId}.`);
  }
  return {
    tick: value.tick ?? value.selector?.tick,
    phaseOrder: value.phaseOrder ?? value.selector?.phaseOrder,
    fieldOrdinal: ordinal,
  };
}

function numericUlpDistance(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return null;
  try {
    const a = BigInt(`0x${left}`);
    const b = BigInt(`0x${right}`);
    return Number(a > b ? a - b : b - a);
  } catch {
    return null;
  }
}

function fieldAliases(selector) {
  const leaf = selector.leaf ?? "";
  const parts = leaf.split("_");
  const camel = parts[0] + parts.slice(1).map((part) => (
    part.slice(0, 1).toUpperCase() + part.slice(1)
  )).join("");
  const aliases = [leaf, camel];
  const axis = leaf.match(/^([xyz])_(.+)$/u);
  if (axis) {
    aliases.push(`${axis[2]}.${axis[1]}`, `${axis[1]}${axis[2].slice(0, 1).toUpperCase()}${axis[2].slice(1)}`);
  }
  if (leaf.endsWith("_displacement")) aliases.push("displacement", "goDisplacement", "facing");
  if (leaf === "control") aliases.push("liveControl", "ownership", "selectedPlayer");
  if (leaf === "action") aliases.push("actionId", "livePass", "intelligenceCount");
  if (leaf === "possession") aliases.push("possessionOwner", "lastTouch");
  return [...new Set(aliases.filter(Boolean))];
}

function nativeEnumConstants(text) {
  const entries = [];
  for (const enumeration of text.matchAll(/\benum(?:\s+[A-Za-z_]\w*)?\s*\{([\s\S]*?)\}/gu)) {
    const body = enumeration[1];
    const bodyOffset = enumeration.index + enumeration[0].indexOf(body);
    let cursor = 0;
    let nextValue = 0;
    for (const rawEntry of body.split(",")) {
      const entryOffset = body.indexOf(rawEntry, cursor);
      cursor = entryOffset + rawEntry.length + 1;
      const entry = rawEntry
        .replace(/\/\*[\s\S]*?\*\//gu, " ")
        .replace(/\/\/.*$/gmu, " ")
        .trim();
      const match = entry.match(/^([A-Z][A-Z0-9_]*)(?:\s*=\s*(-?(?:0[xX][0-9a-fA-F]+|\d+)))?\s*$/u);
      if (!match) {
        nextValue = null;
        continue;
      }
      const value = match[2] === undefined ? nextValue : Number(match[2]);
      if (!Number.isSafeInteger(value)) continue;
      entries.push({
        symbol: match[1],
        value,
        line: lineNumberAt(text, bodyOffset + entryOffset),
      });
      nextValue = value + 1;
    }
  }
  return entries;
}

function normalizeRuntimeSymbol(symbol) {
  return symbol
    .replace(/^LIVE_/u, "")
    .replace(/_ACTION$/u, "_ACT");
}

function nativeSymbolScore(sourceMember, entry) {
  let score = entry.kind === "native-define" || entry.kind === "native-enum" ? 15 : 8;
  if (sourceMember === "tm_anim" && /^MC_/u.test(entry.symbol)) score += 120;
  if (sourceMember === "tm_act" && /_ACT$/u.test(entry.symbol)) score += 120;
  if (sourceMember === "int_move" && /^I_/u.test(entry.symbol)) score += 120;
  if (sourceMember === "ball_state" && /(?:BALL|STATE)/u.test(entry.symbol)) score += 75;
  if (sourceMember === "dir_mode" && /(?:DIR|MODE)/u.test(entry.symbol)) score += 60;
  if (sourceMember === "turn_dir" && /(?:TURN|DIR)/u.test(entry.symbol)) score += 60;
  return score;
}

function nativeSymbolKindOrder(kind) {
  return ["native-define", "native-enum", "runtime-native-constant", "runtime-source-annotation", "runtime-constant"]
    .indexOf(kind);
}

function nativeMemberOrder(member) {
  return ["tm_act", "tm_anim", "int_move", "ball_state", "dir_mode", "turn_dir"]
    .indexOf(member) === -1
    ? 100
    : ["tm_act", "tm_anim", "int_move", "ball_state", "dir_mode", "turn_dir"].indexOf(member);
}

function callArguments(line, callee) {
  const start = line.search(new RegExp(`\\b${escapeRegExp(callee)}\\s*\\(`, "u"));
  if (start === -1) return null;
  const open = line.indexOf("(", start);
  let depth = 0;
  let argumentStart = open + 1;
  const output = [];
  for (let index = open + 1; index < line.length; index += 1) {
    const character = line[index];
    if (character === "(" || character === "[" || character === "{") depth += 1;
    else if (character === ")") {
      if (depth === 0) {
        output.push(line.slice(argumentStart, index).trim());
        return output.length === 1 && output[0] === "" ? [] : output;
      }
      depth -= 1;
    } else if (character === "]" || character === "}") depth -= 1;
    else if (character === "," && depth === 0) {
      output.push(line.slice(argumentStart, index).trim());
      argumentStart = index + 1;
    }
  }
  return null;
}

function nearestNativeBranch(lines, index, functionLine) {
  const lowerBound = Math.max(0, (functionLine ?? index + 1) - 1);
  let caseExpression = null;
  let caseValue = null;
  let caseLine = null;
  for (let cursor = index; cursor >= lowerBound; cursor -= 1) {
    const match = lines[cursor].match(/\bcase\s*\(?\s*([^:)]+?)\s*\)?\s*:/u);
    if (!match) continue;
    caseExpression = match[1].trim();
    caseValue = /^-?(?:0[xX][0-9a-fA-F]+|\d+)$/u.test(caseExpression)
      ? Number(caseExpression)
      : null;
    caseLine = cursor;
    break;
  }
  let switchExpression = null;
  if (caseLine !== null) {
    for (let cursor = caseLine; cursor >= lowerBound; cursor -= 1) {
      const match = lines[cursor].match(/\bswitch\s*\(([^)]+)\)/u);
      if (!match) continue;
      switchExpression = match[1].trim();
      break;
    }
  }
  return { switchExpression, caseExpression, caseValue };
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

function snakeToCamel(value) {
  return value.replace(/_([a-z])/gu, (_match, character) => character.toUpperCase());
}

function runtimeCaseMentioned(line, switchTerms, value) {
  const number = escapeRegExp(String(value));
  if (new RegExp(`\\bcase\\s*\\(?\\s*${number}(?:\\s|\\)|:)`, "u").test(line)) return true;
  return switchTerms.some((term) => {
    const name = escapeRegExp(term);
    return new RegExp(
      `(?:\\b${name}\\b\\s*(?:===?|!==?)\\s*${number}(?:\\D|$)|(?:^|\\D)${number}\\s*(?:===?|!==?)\\s*\\b${name}\\b|new\\s+Set\\s*\\([^)]*(?:^|\\D)${number}(?:\\D|$)[^)]*\\)\\.has\\s*\\([^)]*\\b${name}\\b)`,
      "u",
    ).test(line);
  });
}

function enclosingFunction(lines, index) {
  for (let cursor = index; cursor >= Math.max(0, index - 120); cursor -= 1) {
    if (/^\s*(?:return|throw|new)\b/u.test(lines[cursor])) continue;
    const match = lines[cursor].match(FUNCTION_PATTERN);
    if (!match || CONTROL_WORDS.has(match[1])) continue;
    return { name: match[1], line: cursor + 1 };
  }
  return { name: null, line: null };
}

function uncommentedLines(lines, firstLine) {
  const output = [];
  let block = false;
  for (const [offset, original] of lines.entries()) {
    let source = original;
    let cleaned = "";
    let cursor = 0;
    while (cursor < source.length) {
      if (block) {
        const end = source.indexOf("*/", cursor);
        if (end < 0) {
          cursor = source.length;
          continue;
        }
        block = false;
        cursor = end + 2;
        continue;
      }
      const lineComment = source.indexOf("//", cursor);
      const blockComment = source.indexOf("/*", cursor);
      if (lineComment >= 0 && (blockComment < 0 || lineComment < blockComment)) {
        cleaned += source.slice(cursor, lineComment);
        cursor = source.length;
        continue;
      }
      if (blockComment >= 0) {
        cleaned += source.slice(cursor, blockComment);
        block = true;
        cursor = blockComment + 2;
        continue;
      }
      cleaned += source.slice(cursor);
      cursor = source.length;
    }
    output.push({ source: cleaned, line: firstLine + offset });
  }
  return output;
}

function wordPattern(value) {
  return new RegExp(`\\b${escapeRegExp(value)}\\b`, "u");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function field(sourceMember, offset, valueType, browserPath) {
  return Object.freeze({ sourceMember, offset, valueType, browserPath });
}

function readRawValue(record, offset, valueType) {
  const bytes = valueType.endsWith("8") ? 1 : valueType.endsWith("16") ? 2 : 4;
  const range = record.ranges.find(({ offset: start, bytes: length }) => (
    offset >= start && offset + bytes <= start + length
  ));
  if (!range) {
    throw new DifferentialFrontierError(
      "native-raw-field-missing",
      `Native raw field 0x${offset.toString(16)} is outside retained ranges.`,
    );
  }
  const cursor = record.payloadOffset + range.payloadBase + offset - range.offset;
  switch (valueType) {
    case "i8": return record.buffer.readInt8(cursor);
    case "u8": return record.buffer.readUInt8(cursor);
    case "i16": return record.buffer.readInt16LE(cursor);
    case "u16": return record.buffer.readUInt16LE(cursor);
    case "i32": return record.buffer.readInt32LE(cursor);
    case "u32": return record.buffer.readUInt32LE(cursor);
    case "f32": return record.buffer.readFloatLE(cursor);
    default: throw new TypeError(`Unsupported native raw value type ${valueType}.`);
  }
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
}
