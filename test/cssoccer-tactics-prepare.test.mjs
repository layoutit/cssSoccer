import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertCssoccerPreparedTactics,
  parseCssoccerTactics,
} from "../src/prepare/cssoccer/tacticsParser.mjs";
import {
  createCssoccerTacticsState,
  resolveCssoccerZonalTarget,
} from "../src/cssoccer/tacticsState.mjs";

const tacticsUrl = new URL("../.local/actua-soccer/source/TAC_433.TAC", import.meta.url);

test("prepare decodes the complete pinned F_4_3_3 table once", async () => {
  const tactics = parseCssoccerTactics({ tacticsBytes: await readFile(tacticsUrl) });
  assertCssoccerPreparedTactics(tactics);
  assert.equal(tactics.layout.bytes, 5600);
  assert.equal(tactics.values.length, 70);
  assert.deepEqual(tactics.values[0][0], [72, 152]);
  assert.deepEqual(tactics.values[68][0], [288, 280]);
  assert.deepEqual(tactics.values[69][9], [592, 632]);
});

test("browser tactics consume prepared values and mirror native team B", async () => {
  const prepared = parseCssoccerTactics({ tacticsBytes: await readFile(tacticsUrl) });
  const slot = {
    formationId: prepared.formationId,
    tableSha256: prepared.tableSha256,
    values: prepared.values,
  };
  const state = createCssoccerTacticsState({ A: slot, B: slot });
  const a = resolveCssoccerZonalTarget(state, {
    nativeTeamSlot: "A",
    nativePlayerNumber: 2,
    ballZone: 0,
    teamInPossession: false,
  });
  const b = resolveCssoccerZonalTarget(state, {
    nativeTeamSlot: "B",
    nativePlayerNumber: 13,
    ballZone: 0,
    teamInPossession: false,
  });
  assert.deepEqual(a.target, { x: 72, y: 152 });
  assert.deepEqual(b.target, { x: 1208, y: 648 });
});

test("prepare rejects truncated or changed tactic bytes", async () => {
  const source = await readFile(tacticsUrl);
  assert.throws(() => parseCssoccerTactics({ tacticsBytes: source.subarray(0, -4) }), /5600 bytes/);
  const changed = Buffer.from(source);
  changed[0] ^= 1;
  assert.throws(() => parseCssoccerTactics({ tacticsBytes: changed }), /changed from the pinned/);
});
