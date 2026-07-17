# Actua Soccer intake

## Target

- Title: Actua Soccer / Actua Soccer 96, 1995-1996
- Source reference: `Xrampino/Actua-Soccer`
- Source type: original DOS C/C++ source archive mirrored to GitHub
- Pinned revision: `b40bd6d1e50e052030c5f0884fbe3deda7e9fa4b`
- Source import revision: `6375c0a35c20cffe699fd160543229b1b1581e57`
- License: CC BY-NC-ND 4.0; keep the source checkout and oracle patches local and ignored
- Verification: the GitHub tree matches the authorized Gremlin Archive download after text line-ending normalization and includes `NET.GRE`, which the archived `videogamepreservation/actuasoccer96` mirror omits

## Data

- Source archive: authorized Gremlin Archive download
- Source archive SHA-256: `74f6baba9cfdba69da9e5068295bda6634611bbdf506e5768a36d38149155177`
- Game-data route: pending verification before the first prepared match slice
- Redistribution posture: original source, original data, local oracle patches, captures, and generated browser output stay ignored

## First slice

- Mode: `model-viewer`, promoted into a small match scene once formats are qualified
- Proposed slice: one source player pose, ball, pitch segment, fixed camera, and a deterministic idle-to-kick input sequence
- Generated root: `build/generated/public/cssoccer/`
- Debug API: `window.__cssoccerDebug`

## Differential-testing blueprint

Follow cssgta's separation of concerns:

1. Pin the native/source checkout and keep local patches reproducible.
2. Make the patched native oracle emit a scenario descriptor, profile, and contiguous JSONL state stream at a fixed tick rate and seed.
3. Make the browser replay the same command stream through a stable debug API without reading native evidence at runtime.
4. Compare exact typed fields first and report only the earliest failing tick and field.
5. Add domain-separated frame capture after state parity is trustworthy; visual evidence must remain subordinate to exact state evidence.
6. Publish retained artifacts atomically and fail closed when either side, scenario binding, revision, or frame count is missing.

The first oracle patch should target source-owned ball/player transforms and animation state, not rendering.

