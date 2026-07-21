import assert from "node:assert/strict";
import test from "node:test";

import { projectCssoccerSkyBackdrop } from "../src/cssoccer/skyBackdrop.mjs";

test("the retained Stand2 visual camera selects the exact BM_C1X sky crop", () => {
  const projection = projectCssoccerSkyBackdrop({
    rendered: {
      renderer: {
        eye: [639.8505249023438, 220, -780],
        target: [639.8505249023438, 165.35699462890625, 453.864990234375],
      },
    },
    projection: { scale: 220 },
  }, {
    viewportWidth: 320,
    viewportHeight: 200,
  });

  assert.deepEqual(
    [projection.sourceX, projection.sourceY],
    [0, 390],
  );
  assert.equal(projection.backgroundPositionX, 0);
  assert.equal(projection.backgroundPositionY, -390);
  assert.equal(projection.sourceVisible, true);
});
