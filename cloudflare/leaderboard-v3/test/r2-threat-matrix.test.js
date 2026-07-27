import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  R2_THREAT_MATRIX,
  R2_THREAT_STATUS
} from "./fixtures/r2-threat-matrix.js";

test("R2 rerun registry covers all 30 R1 threat scenarios with executable evidence", async () => {
  assert.equal(R2_THREAT_MATRIX.length, 30);
  assert.deepEqual(R2_THREAT_MATRIX.map(({ id }) => id), Array.from(
    { length: 30 },
    (_, index) => index + 1
  ));
  assert.equal(new Set(R2_THREAT_MATRIX.map(({ attempt }) => attempt)).size, 30);
  for (const scenario of R2_THREAT_MATRIX) {
    assert([
      R2_THREAT_STATUS.fixed,
      R2_THREAT_STATUS.accepted
    ].includes(scenario.status));
    const evidence = await readFile(new URL(
      `./${scenario.evidenceFile}`,
      import.meta.url
    ), "utf8");
    assert.match(evidence, scenario.evidencePattern, `missing evidence for threat ${scenario.id}`);
  }
});

test("R2 accepted product boundary is explicit and did not expand", () => {
  const accepted = R2_THREAT_MATRIX
    .filter(({ status }) => status === R2_THREAT_STATUS.accepted)
    .map(({ id }) => id);
  assert.deepEqual(accepted, [1, 4, 5, 6]);
  for (const id of [2, 3, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]) {
    assert.equal(R2_THREAT_MATRIX[id - 1].status, R2_THREAT_STATUS.fixed);
  }
});
