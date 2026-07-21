# Differential-testing blueprint

The installed exact-first Differential Testing workflow is the parity authority.
CSSQuake is the sole launched PolyCSS production reference, specifically for
prepare-time render bundles and stable animated leaves; unlaunched ports are not
design authorities for css.soccer.

## Fixed css.soccer boundaries

| Boundary | css.soccer contract |
| --- | --- |
| Pinned source | `references/actua-soccer-oracle.json` |
| Ignored checkout | `.local/actua-soccer/source` |
| Local oracle patch | reproducible patch against the pinned Actua revision |
| Native state | scenario-bound profile plus contiguous fixed-seed JSONL ticks |
| Browser state | `window.__cssoccerDebug` scripted replay without native evidence reads |
| Exact comparison | typed fields, aligned ticks, numeric bits, and the earliest mismatch only |
| Visual comparison | separate pitch, players, ball, officials, and HUD frame domains |
| Publication | fail-closed atomic bundle compatible with the installed Differential Testing contract |
| PolyCSS production | CSSQuake-style prepare-time render bundles and stable animated leaves |

## First retained scenario

Use one short idle-to-kick sequence with a fixed seed and fixed update step. Start with source-owned state that is cheap to dump and independent of the renderer:

- `ballx`, `bally`, `ballz`
- `ballxdis`, `ballydis`, `ballzdis`
- `ball_xyspin`, `ball_zspin`
- selected player position and facing
- selected player action and animation frame
- possession owner
- `rand_seed` and `seed`
- match tick and phase

The patched oracle should emit one descriptor record followed by one state record per tick. The browser must not fetch or read those records at runtime.

## First-failure rule

Compare fields in a stable declared order. Stop diagnosis at the earliest `(tick, phase, field)` mismatch and retain its value type, native value, browser value, numeric bits when relevant, and source producer. Do not use later visual drift to route a fix while an earlier exact mismatch remains.

## Visual promotion

Only add numbered frame comparison after the exact scenario is fully bound and both streams cover the same ticks. Capture pitch, players, ball, and HUD independently so renderer drift does not obscure gameplay-state parity.
