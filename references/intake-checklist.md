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
- Pinned archives: `EURO.DAT/OFF`, `EUROREND.DAT/OFF`, `FAP.DAT/OFF`, and `FAPF.DAT/OFF`, bound by byte size and SHA-256 in `spain-argentina-source-data.json`
- Archive format: an `.OFF` file is a sequence of eight-byte little-endian `{ uint32 offset, uint32 size }` records; source selectors address records in multiples of eight
- Missing route: `DATA.DAT/OFF` and `ACTREND.EQU` are absent from the pinned tree, so Spain/Argentina asset byte ranges and renderer asset semantics are not guessed
- Redistribution posture: original source, original data, local oracle patches, captures, traces, and generated browser assets stay under ignored local paths; this intake does not make a deployment-rights claim

## First slice

- Mode: `map-scene`
- Canonical fixture and scene: `spain-argentina-full-match`
- Fixed match: Spain (source team `2`) at home against Argentina (source team `20`) in `FRIENDLY` (`0`), with no alternate teams or competition path
- Choice exposed to users: control Spain or Argentina; the home/away fixture itself never reverses
- Duration: fixed and hidden at two play minutes total, one minute per 45-game-minute half, using a local-oracle `time_factor=2` patch at `REAL_SPEED=20`
- Retained scene: full pitch, markings, two goals, four flags, Spain stadium entry `2`, 22 stable player ids, three official ids, and `ball-00`
- Axes and scale: gameplay `(x,y,z)` prepares as renderer `(x,z,-y)` at 16 native units per yard over an 80-by-50-yard pitch
- Generated root: `build/generated/public/cssoccer/`
- Debug API: `window.__cssoccerDebug`

## Native binding gate

- Completed: the static B4a facts are bound to the checked B2 fixture contract and B3 deterministic capture in `spain-argentina-source-data.json`.
- The binding freezes the local patch sets, executables, data set, scenario, command stream, seed, timing, typed-field contract, transport, both control profiles, 2,400 play ticks, and exact retained capture hashes.
- `GAMEDATA.CPP` contains two demo templates and is not treated as authoritative Spain/Argentina roster data.
- Preparation and browser runtime fail closed when the selected country profile or any parent-required native binding differs.

## Differential-testing blueprint

Follow the installed exact-first Differential Testing contract. CSSQuake is the
sole launched PolyCSS production reference; unlaunched ports are not design
authorities for css.soccer.

1. Pin the native/source checkout and keep local patches reproducible.
2. Make the patched native oracle emit a scenario descriptor, profile, and contiguous JSONL state stream at a fixed tick rate and seed.
3. Make the browser replay the same command stream through a stable debug API without reading native evidence at runtime.
4. Compare exact typed fields first and report only the earliest failing tick and field.
5. Add domain-separated frame capture after state parity is trustworthy; visual evidence must remain subordinate to exact state evidence.
6. Publish retained artifacts atomically and fail closed when either side, scenario binding, revision, or frame count is missing.

The first oracle patch should target source-owned ball/player transforms and animation state, not rendering.
