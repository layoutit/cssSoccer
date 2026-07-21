# css.soccer: Full Match Alpha

A focused source-backed PolyCSS match demo: one Spain vs Argentina friendly,
with either team available for local control. Two one-real-minute halves represent a
complete 90-minute match at a fixed 20 Hz. This offers more match gameplay than
the 1995 Actua Soccer demo; it is not the complete Actua Soccer game.

The canonical browser route starts with a Spain-or-Argentina team choice, then
advances only from current keyboard or touch input and browser-owned match state.
It includes live movement, dribbling, passing,
crossing, shooting, chipping, tackling, stealing, player and goalkeeper AI,
goals, restarts, fouls, advantage, discipline, offside, halftime, ends swap,
full time, pause, and rematch. There is no product replay route or alternate
gameplay engine.

## Local setup

Use Node.js 20.19+ or 22.12+ and pnpm 10.33. The prepared match also requires
the pinned, ignored source/data inputs described in
`references/spain-argentina-source-data.json`; they are deliberately absent
from Git.

```sh
pnpm install --frozen-lockfile
pnpm source:setup
pnpm prepare:cssoccer
pnpm dev
```

The browser consumes only deterministic prepared output under
`build/generated/public/cssoccer/`. Original source, game data, native builds,
oracle patches, captures, traces, and retained evidence stay local and ignored.
Source parsing, geometry construction, atlas work, topology merging, and
animation packaging happen before browser runtime.

Native and differential tooling remains local development evidence only. It is
not imported by the product graph:

```sh
pnpm source:setup
pnpm source:verify
node tools/run-differential-frontier.mjs --continue
```

`pnpm oven:differential` reads its local transport module from
`BURNLIST_DIFFERENTIAL_TESTING_TRANSPORT`. Native frame packaging reads an
optional override from `FRAME_SEQUENCE_ORACLE_TOOL`.

See `references/full-match-alpha.md` for the exact release scope and exclusions.

## License

Repository-authored code is MIT licensed. Actua Soccer source, game data, and
assets are not included and remain subject to their own terms.
