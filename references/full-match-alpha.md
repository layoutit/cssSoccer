# css.soccer: Full Match Alpha

Full Match Alpha is one browser-owned Spain vs Argentina friendly. The user
chooses either Spain or Argentina, then plays two one-real-minute halves representing a complete
90-minute match at a fixed 20 Hz. It is a focused playable demo with more match
gameplay than the 1995 Actua Soccer demo; it is not the complete Actua Soccer
game.

## Included release surface

- One fixed Spain vs Argentina friendly, with a pre-match choice to control either team.
- Keyboard and coarse-pointer touch controls for movement, dribbling, passing,
  crossing, shooting, chipping, tackling, and stealing.
- Current-state player and goalkeeper intelligence; goals, score,
  celebrations, boundary and foul restarts, advantage, discipline, in-match
  penalties, and live offside.
- Half-time, one ends swap, full-time, pause, and rematch.
- One manifest-driven canonical route. Source parsing, geometry construction,
  atlas work, topology merging, and animation packaging finish at prepare time.

`penalties: false` in the pinned native fixture means no post-draw penalty
shootout. In-match penalty kicks remain part of the live foul/restart rules.
The native golden binds the full-game source configuration with offside enabled,
so the browser and native full-match fixture share the same live-offside rule.

## Explicitly excluded

No additional teams or fixture selection, England vs Brazil conversion,
substitutions, multiple local players, audio, selectable cameras, replay,
league, cup, campaign, persistence, multiplayer, or networking.

## Asset and publication boundary

Original source, game data, oracle patches/builds, captures, traces, and
retained evidence stay under ignored local paths. The browser consumes only
the deterministic prepared publication beneath
`build/generated/public/cssoccer/`; it performs no runtime source parsing or
geometry construction.
