# cssoccer

A source-backed PolyCSS port of Actua Soccer.

The first boundary is the unpublished native oracle. Its original source checkout is pinned, local, ignored, and safe to patch for deterministic state capture:

```sh
pnpm source:setup
pnpm source:verify
```

The browser port will consume prepared assets and replay the same fixed input scenarios through `window.__cssoccerDebug`. Differential testing follows the retained exact-first workflow documented in `references/differential-testing-blueprint.md`.

