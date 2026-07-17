# cssoccer

This repo is a source-backed Actua Soccer PolyCSS port.

- Keep original source, game data, oracle patches, native builds, captures, traces, and generated browser assets under ignored local paths.
- Pin every native/source reference and bind every parity result to its revision, scenario, input stream, seed, timestep, and field contract.
- Treat exact typed state as authoritative. Diagnose only the earliest failing tick and field before using later visual differences.
- When that diagnosis reaches a Watcom function, float-store, or runtime-global question, use `node tools/run-compiled-path-check.mjs --function <name> --object <module> --symbol <name[:type]>`. This public action owns the current Exact tick, bindings, static inspection, and short read-only probe. Do not hand-edit oracle capture ranges or hard-code a probe tick/address.
- Keep the product on one manifest-driven route and do source parsing, geometry preparation, atlas work, and topology merging before browser runtime.
- Do not copy original source into the published port. Local modifications are for the unpublished oracle only.
- Run native/source and browser capture headlessly unless the user explicitly opts into a visible window.
