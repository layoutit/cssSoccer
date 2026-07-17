# Compiled-path inspector

The compiled-path inspector answers one checked native-code question without
changing browser runtime code, canonical captures, or original game source.
It treats the original Watcom object as the static code authority and an
executable-specific map as the runtime address authority.

## Public actions

For a read-only static inspection:

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
