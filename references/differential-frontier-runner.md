# Differential frontier runner

Use one command at the start of every exact-parity iteration:

```sh
node tools/run-differential-frontier.mjs --continue
```

It verifies the retained native and Differential Testing bindings, qualifies
the current browser runtime independently, runs that runtime only through the
first exact mismatch, and prints one compact frontier packet. A temporary
diagnostic copy of the engine traces the failing tick so the packet identifies
the active browser file, function, and source line from execution.

The packet contains:

- the retained and current exact tick, phase, field, type, values, and bits;
- whether the current runtime advanced, regressed, or duplicates the previous
  diagnostic run;
- adjacent state transitions and bound native `match_player` changes;
- one grouped native producer when several missing `ball.*` fields are outputs
  of the same source transition, plus the executed browser owner where that
  transition belongs;
- the traced browser producer plus ranked alternatives;
- ranked native write sites, excluding comparisons mistaken for assignments;
- exactly one next action and the public evaluation command.

If the browser throws before a field can be compared, the same command replays
only to that coordinate with failure tracing enabled. Its packet names the
executed throwing file, function, original source line, bounded argument facts,
and parent call chain. Treat `repair-runtime-exception` as the earliest runtime
blocker; do not inspect a later parity symptom first.

Full evidence is retained under
`.local/cssoccer/parity/frontier-runner/current.json`. Use `--full-json` only
when the compact packet is insufficient.

If `duplicateOfPreviousRuntime` is true, do not spend another iteration
rerunning it. Inspect the named producer and rerun only after a runtime edit.
If the diagnostic runtime reaches exact completion, run the full browser
capture and synchronous publisher; the diagnostic runner does not establish
parity by itself.

The runner reads original source, linked maps, native raw state, and retained
captures only as bound local evidence. It writes no product data, modifies no
oracle source or capture range, and never substitutes native values into the
browser engine.

For a remaining compiled-code or runtime-global question, use the compiled
path checker after the runner has narrowed the browser producer and native
function. The compiled action derives its stop from the retained Exact
frontier; never supply a hand-written tick, address, or widened capture range.
