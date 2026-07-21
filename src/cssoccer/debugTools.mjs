import {
  copyCssoccerDebugRecording,
  createCssoccerDebugRecorder,
} from "./debugRecording.mjs";

export const CSSOCCER_DEBUG_TOOLS_STATE_SCHEMA = "cssoccer-debug-tools-state@1";

export function createCssoccerDebugTools({
  state,
  sceneHost,
  document: documentImpl = globalThis.document,
  window: windowImpl = globalThis.window,
  fixedStepMilliseconds = 50,
} = {}) {
  if (!documentImpl?.body || !windowImpl || !sceneHost) {
    throw new Error("css.soccer debug tools require a browser document, window, and scene host.");
  }
  const panel = createDebugPanel(documentImpl);
  documentImpl.body.appendChild(panel.root);
  let visible = false;
  let destroyed = false;
  let copyResetTimer = null;

  const recorder = createCssoccerDebugRecorder({
    state,
    window: windowImpl,
    document: documentImpl,
    fixedStepMilliseconds,
    onStateChange: syncRecordingPresentation,
  });

  function stateSnapshot() {
    return Object.freeze({
      schema: CSSOCCER_DEBUG_TOOLS_STATE_SCHEMA,
      visible,
      recording: recorder.status(),
    });
  }

  function setVisible(enabled) {
    if (destroyed) return false;
    visible = Boolean(enabled);
    panel.element.hidden = !visible;
    documentImpl.body.dataset.cssoccerDebugPanel = visible ? "1" : "0";
    if (visible) sync();
    return visible;
  }

  function toggleVisible() {
    return setVisible(!visible);
  }

  function sync() {
    if (destroyed) return;
    const live = state.liveFrame;
    const match = state.matchState;
    const score = live?.score ?? match?.score?.goals ?? null;
    const phase = live?.phase ?? match?.phase ?? "-";
    setValue(panel.stats, "tick", live?.tick ?? match?.tick ?? "-");
    setValue(panel.stats, "phase", phase);
    setValue(
      panel.stats,
      "score",
      score === null ? "-" : `${score.spain ?? 0}-${score.argentina ?? 0}`,
    );
    setValue(
      panel.stats,
      "player",
      live?.selectedPlayerId
        ?? match?.control?.activePlayerId
        ?? "-",
    );
    setValue(
      panel.stats,
      "input",
      inputLabel(state.inputState, state.lastInputCommand),
    );
    setValue(panel.stats, "errors", Array.isArray(state.errors) ? state.errors.length : 0);
    panel.state.textContent = debugStateLabel(state);
    syncRecordingPresentation(recorder.status());
  }

  function recordProductTick(published) {
    return recorder.recordProductTick(published);
  }

  function recordAnimationFrame(frame) {
    return recorder.recordAnimationFrame(frame);
  }

  function recordEvent(kind, details = {}) {
    return recorder.recordEvent(kind, details);
  }

  function syncRecordingPresentation(status) {
    if (destroyed) return;
    panel.recordButton.textContent = status.recording ? "STOP" : "RECORD";
    panel.recordButton.setAttribute("aria-pressed", String(status.recording));
    panel.recordButton.setAttribute(
      "aria-label",
      status.recording
        ? "Stop css.soccer performance recording"
        : "Start css.soccer performance recording",
    );
    panel.recordStatus.textContent = recordingStatusLabel(status);
    panel.copyButton.hidden = status.last === null;
    const frame = status.recording ? status.currentFrame : status.last;
    setValue(
      panel.stats,
      "raf",
      frame === null || frame === undefined
        ? "-"
        : `${formatMilliseconds(
          status.recording ? frame.p95Ms : frame.p95FrameMs,
        )} / ${formatMilliseconds(
          status.recording ? frame.maxMs : frame.maxFrameMs,
        )}`,
    );
    setValue(
      panel.stats,
      "hitches",
      status.recording
        ? status.currentFrame.hitchesOver33Ms
        : status.last?.hitchesOver33Ms ?? "-",
    );
    setValue(
      panel.stats,
      "longtasks",
      status.recording ? status.longTaskCount : status.last?.longTaskCount ?? "-",
    );
  }

  function handleRecordClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (recorder.isRecording()) recorder.stop("stop");
    else if (!recorder.start()) panel.recordStatus.textContent = "match not ready";
    refocusScene();
  }

  async function handleCopyClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const recording = recorder.lastRecording();
    const copied = await copyCssoccerDebugRecording(recording, {
      document: documentImpl,
      window: windowImpl,
    }).catch(() => false);
    panel.copyButton.textContent = copied ? "COPIED" : "COPY FAILED";
    if (copyResetTimer !== null) windowImpl.clearTimeout(copyResetTimer);
    copyResetTimer = windowImpl.setTimeout(() => {
      panel.copyButton.textContent = "COPY TRACE";
      copyResetTimer = null;
    }, 900);
    refocusScene();
  }

  function refocusScene() {
    panel.recordButton.blur?.();
    panel.copyButton.blur?.();
    sceneHost.focus?.({ preventScroll: true });
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    recorder.dispose();
    if (copyResetTimer !== null) windowImpl.clearTimeout(copyResetTimer);
    panel.recordButton.removeEventListener("click", handleRecordClick);
    panel.copyButton.removeEventListener("click", handleCopyClick);
    panel.root.remove();
    delete documentImpl.body.dataset.cssoccerDebugPanel;
  }

  panel.recordButton.addEventListener("click", handleRecordClick);
  panel.copyButton.addEventListener("click", handleCopyClick);
  setVisible(false);
  sync();

  const recordingApi = Object.freeze({
    copyLast: () => copyCssoccerDebugRecording(recorder.lastRecording(), {
      document: documentImpl,
      window: windowImpl,
    }),
    last: recorder.lastRecording,
    serializeLast: recorder.serializeLastRecording,
    start: recorder.start,
    status: recorder.status,
    stop: (options = {}) => recorder.stop("stop", options),
  });

  return Object.freeze({
    destroy,
    isRecording: recorder.isRecording,
    recordAnimationFrame,
    recordEvent,
    recordProductTick,
    recordingApi,
    setVisible,
    state: stateSnapshot,
    sync,
    toggleVisible,
  });
}

function createDebugPanel(documentImpl) {
  documentImpl.getElementById("cssoccer-debug-root")?.remove();
  const root = documentImpl.createElement("div");
  root.id = "cssoccer-debug-root";
  const element = documentImpl.createElement("aside");
  element.id = "cssoccer-debug-panel";
  element.hidden = true;
  element.setAttribute("aria-label", "css.soccer debug menu");

  const header = documentImpl.createElement("header");
  header.className = "cssoccer-debug-header";
  const title = documentImpl.createElement("h2");
  title.textContent = "CSS.SOCCER DEBUG";
  const state = documentImpl.createElement("span");
  state.className = "cssoccer-debug-state";
  state.textContent = "LOAD";
  header.append(title, state);

  const statsList = documentImpl.createElement("dl");
  statsList.className = "cssoccer-debug-stats";
  const stats = new Map();
  for (const [id, label] of [
    ["tick", "tick"],
    ["phase", "phase"],
    ["score", "score"],
    ["player", "player"],
    ["input", "input"],
    ["errors", "errors"],
    ["raf", "p95/max"],
    ["hitches", ">33 ms"],
    ["longtasks", "long tasks"],
  ]) {
    const row = documentImpl.createElement("div");
    const term = documentImpl.createElement("dt");
    const value = documentImpl.createElement("dd");
    term.textContent = label;
    value.dataset.cssoccerDebugStat = id;
    value.textContent = "-";
    stats.set(id, value);
    row.append(term, value);
    statsList.appendChild(row);
  }

  const recording = documentImpl.createElement("section");
  recording.className = "cssoccer-debug-recording";
  recording.setAttribute("aria-label", "Manual performance recording");
  const recordButton = documentImpl.createElement("button");
  recordButton.id = "cssoccer-debug-recording-toggle";
  recordButton.type = "button";
  recordButton.textContent = "RECORD";
  recordButton.setAttribute("aria-pressed", "false");
  const recordStatus = documentImpl.createElement("span");
  recordStatus.dataset.cssoccerDebugRecordingStatus = "1";
  recordStatus.setAttribute("aria-live", "polite");
  recordStatus.textContent = "-";
  const copyButton = documentImpl.createElement("button");
  copyButton.id = "cssoccer-debug-recording-copy";
  copyButton.type = "button";
  copyButton.textContent = "COPY TRACE";
  copyButton.hidden = true;
  recording.append(recordButton, recordStatus, copyButton);

  const hint = documentImpl.createElement("p");
  hint.className = "cssoccer-debug-hint";
  hint.textContent = "X closes · STOP downloads perf JSON";
  element.append(header, statsList, recording, hint);
  root.appendChild(element);
  return {
    root,
    element,
    state,
    stats,
    recordButton,
    recordStatus,
    copyButton,
  };
}

function setValue(stats, name, value) {
  const target = stats.get(name);
  if (target) target.textContent = String(value ?? "-");
}

function debugStateLabel(state) {
  if (state.status === "error") return "ERROR";
  if (state.inputState?.paused) return "PAUSED";
  if (state.ready) return "READY";
  return "LOAD";
}

function recordingStatusLabel(status) {
  if (status.recording) {
    const seconds = (status.durationMs / 1_000).toFixed(1);
    return `${status.frameCount} frames · ${status.tickCount} ticks · ${seconds}s sampled`;
  }
  if (status.last !== null) {
    return `saved ${(status.last.durationMs / 1_000).toFixed(1)}s · p95 ${formatMilliseconds(
      status.last.p95FrameMs,
    )}`;
  }
  return "-";
}

function formatMilliseconds(value) {
  return `${Number(value ?? 0).toFixed(1)} ms`;
}

function inputLabel(inputState, command) {
  if (inputState?.paused) return "paused";
  if (inputState?.focused === false) return "blurred";
  const codes = Array.isArray(inputState?.keyboardCodes) ? inputState.keyboardCodes : [];
  const pointerCount = Array.isArray(inputState?.pointers) ? inputState.pointers.length : 0;
  if (codes.length > 0) return codes.join("+");
  if (pointerCount > 0) return `${pointerCount} touch`;
  if (command) return `${command.moveX ?? 0},${command.moveY ?? 0} · ${command.buttons ?? 0}`;
  return "neutral";
}
