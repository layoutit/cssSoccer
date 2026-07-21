# Compiled-path inspector

Start exact-parity work with
`node tools/run-differential-frontier.mjs --continue`. Use this inspector only
as the nested action for a compiled function, float-store, or runtime-global
question that remains after the frontier packet has named the active browser
producer.

The compiled-path inspector answers one checked native-code question without
changing browser runtime code, canonical captures, or original game source.
It treats the original Watcom object as the static code authority and an
executable-specific map as the runtime address authority.

## Public differential-testing action

For normal parity work, use the retained-current action rather than assembling
an inspector query or changing oracle capture ranges:

```sh
node tools/run-compiled-path-check.mjs \
  --function get_target \
  --object INTELL \
  --symbol zone_hgt:f32
```

Typed array elements use the same bound action and an explicit zero-based
index, for example `--symbol 'save_offs[102]:f32'`. When WDIS exposes immutable
initialized bytes for a linked local-only array, the inspector decodes that
element directly from the object listing. Otherwise it resolves the linked
address and subjects it to the retained-range or bounded-probe checks.

That one command:

- reads the selected scenario and current checked Exact coordinate;
- requires the current engine-independence qualification and native bindings;
- resolves the Watcom object, linked map, executable, and DGROUP from the
  retained compiled-path profile;
- performs the static WDIS inspection;
- reads an already-retained value directly, or emits and runs a bounded
  `CSSQRY1` query when the symbol is outside retained ranges;
- prints one small packet containing both compiled evidence and the runtime
  value at the checked tick.

The query transport is diagnostic-only until promoted through the normal
transport binding refresh and engine-independence requalification. Its value
may resolve a source question, but it cannot itself clear parity or authorize a
runtime candidate.

Profile initialization is a toolkit-maintainer action, performed once per
native/transport binding. It copies an exact retained stage and the validated
query transport into ignored local storage:

```sh
node tools/run-compiled-path-check.mjs --initialize-profile \
  --stage-root <exact-retained-native-stage> \
  --query-transport <query-enabled-dosbox-x> \
  --transport-evidence <query-transport-build-evidence.json>
```

## Public actions

The lower-level inspector remains available for toolkit development and static
inspection:

```sh
node tools/inspect-compiled-path.mjs \
  --workspace-root /path/to/cssoccer \
  --function get_target \
  --object .local/actua-soccer/source/INTELL.OBJ \
  --map .local/path/to/the-exact-linked/TEST.MAP \
  --symbol zone_hgt:f32 \
  --capture-contract references/spain-argentina-match.json
```

For a short oracle probe, the public differential-testing runner must emit a
`cssoccer-compiled-path-query@1` JSON file and call:

```sh
node tools/inspect-compiled-path.mjs --query .local/path/from/the/public-runner/query.json
```

The runner-owned query supplies:

- the retained function and unresolved symbols;
- the exact object, map, and executable paths plus their expected hashes;
- the retained binding hash for that exact object/map/executable trio;
- the canonical capture contract and dotted ranges path;
- the current retained frontier, including its active stop tick;
- the executable's retained Watcom DGROUP segment;
- scenario, input, seed, timestep, and field-contract bindings.

The tool does not invent a tick, address, type, or artifact hash. A static
inspection may report observed-but-unbound evidence, but probe emission fails
closed unless every executable artifact is bound by an expected retained
profile hash.

## Evidence

The command prints one small `cssoccer-compiled-path-hot-packet@1` and retains
the full `cssoccer-compiled-path-evidence@1` under ignored `.local` storage.
The packet includes:

- object and linked function offsets;
- instruction and x87 operation counts;
- every observable `fstp dword ptr` f32 store in the routine;
- requested-symbol reference counts and their distinct next f32 stores;
- executable-specific data addresses;
- retained-range coverage or the exact nearest-range gap;
- the single next action.

Open Watcom WDIS output is generated once through the pinned headless DOSBox-X
tool and cached by object, listing, WDIS, DOSBox-X, and DOS/4GW hashes. A
supplied listing must identify the same object hash; it also needs its own
retained expected hash before it can authorize a probe.

## Read-only probe transport

A fully bound query emits both a JSON description and a compact `CSSQRY1`
binary manifest. The binary contains only:

- a versioned read-only header;
- the retained frontier stop tick;
- sorted, non-overlapping DGROUP offsets, byte lengths, and value types.

Only requested symbols outside the retained capture ranges become probe reads.

The query-enabled private DOSBox-X transport reads the manifest from
`CSSOCCER_ORACLE_QUERY`. It rejects malformed, overlapping, oversized,
write-capable, or conflicting manifests before opening the raw output. When no
query is supplied, the existing canonical ranges and behavior remain exactly
unchanged.

The transport patch and compiled binary remain ignored local oracle tooling.
Promoting a new transport binary changes native-capture bytes and therefore
requires the normal source-patch/binary binding update and engine-independence
requalification before it can support parity evidence.
