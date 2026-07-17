# Differential-testing blueprint

cssGTA is the implementation blueprint, not a source-code dependency. cssoccer should keep the same evidence boundaries with Actua-specific state and tooling.

## Proven cssGTA pattern

| Boundary | cssGTA | cssoccer equivalent |
| --- | --- | --- |
| Pinned source | `references/carnage3d-oracle.json` | `references/actua-soccer-oracle.json` |
| Ignored checkout | `.local/carnage3d/source` | `.local/actua-soccer/source` |
| Local oracle patch | tracked patch applied to ignored source | reproducible patch against the pinned Actua revision |
| Native state | scenario-bound profile plus contiguous JSONL frames | fixed-seed match profile plus contiguous JSONL ticks |
| Browser state | `window.__cssGtaDebug` scripted replay | `window.__cssoccerDebug` scripted replay |
| Exact comparison | typed fields, aligned ticks, earliest mismatch | same contract for ball, player, animation, possession, and match phase |
| Visual comparison | separate world/cars/HUD frame domains | separate pitch/players/ball/HUD domains |
| Publication | fail-closed atomic Differential Testing bundle | same Burnlist bundle contract |

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

