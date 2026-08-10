import assert from "node:assert/strict";
import crypto from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  REQUIRED_SCREENSHOTS,
  REQUIRED_SOURCE_PATHS,
  collectRecordArchiveVisualEvidence,
  verifyRecordArchiveVisualApproval
} from "../scripts/record-archive-visual-receipt.mjs";

const sha256 = (value) => `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;

async function writeFixture(root) {
  for (const relative of REQUIRED_SOURCE_PATHS) {
    const target = path.join(root, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `source:${relative}\n`, "utf8");
  }
  for (const screenshot of REQUIRED_SCREENSHOTS) {
    const target = path.join(root, screenshot.relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, `screenshot:${screenshot.id}\n`, "utf8");
  }
}

function approvedReceipt(evidence) {
  return {
    schema: 1,
    reviewer: "Kamil",
    reviewedAt: "2026-08-03T15:00:00.000Z",
    sourceFingerprint: evidence.sourceFingerprint,
    screenshots: evidence.screenshots.map(({ id, sha256: hash }) => ({ id, sha256: hash }))
  };
}

async function writeReceipt(root, receipt) {
  const target = path.join(root, "output", "verification", "record-archive-visual-approval.json");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return target;
}

async function tempRoot(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "record-archive-visual-gate-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFixture(root);
  return root;
}

test("visual fingerprint tracks canonical archive sources and excludes the retired Practice renderer", () => {
  const canonicalSources = [
    "practice-records-adapter.js",
    "online-v3/ranked-v3-leaderboard-ui.js",
    "online-v3/ranked-v3-runtime.js",
    "online-v3/ranked-v3-ui.js",
    "game.js",
    "style.css"
  ];
  for (const relativePath of canonicalSources) {
    assert.ok(REQUIRED_SOURCE_PATHS.includes(relativePath), `missing canonical source: ${relativePath}`);
  }
  assert.equal(REQUIRED_SOURCE_PATHS.includes("record-archive-ui.js"), false);
  assert.equal(REQUIRED_SOURCE_PATHS.includes("style-record-archive.css"), false);
});

test("record archive visual gate rejects a missing, incomplete, stale, or mismatched receipt", async (t) => {
  await t.test("missing receipt", async (t) => {
    const root = await tempRoot(t);
    await assert.rejects(() => verifyRecordArchiveVisualApproval({ root }), /missing visual approval receipt/u);
  });

  await t.test("one required screenshot missing", async (t) => {
    const root = await tempRoot(t);
    const evidence = await collectRecordArchiveVisualEvidence({ root });
    await writeReceipt(root, approvedReceipt(evidence));
    await rm(path.join(root, REQUIRED_SCREENSHOTS[0].relativePath));
    await assert.rejects(() => verifyRecordArchiveVisualApproval({ root }), /required screenshot is missing/u);
  });

  await t.test("screenshot bytes changed after approval", async (t) => {
    const root = await tempRoot(t);
    const evidence = await collectRecordArchiveVisualEvidence({ root });
    await writeReceipt(root, approvedReceipt(evidence));
    await writeFile(path.join(root, REQUIRED_SCREENSHOTS[1].relativePath), "changed screenshot\n", "utf8");
    await assert.rejects(() => verifyRecordArchiveVisualApproval({ root }), /screenshot hash mismatch/u);
  });

  await t.test("relevant source fingerprint changed after approval", async (t) => {
    const root = await tempRoot(t);
    const evidence = await collectRecordArchiveVisualEvidence({ root });
    await writeReceipt(root, approvedReceipt(evidence));
    await writeFile(path.join(root, REQUIRED_SOURCE_PATHS[0]), "changed source\n", "utf8");
    await assert.rejects(() => verifyRecordArchiveVisualApproval({ root }), /source fingerprint mismatch/u);
  });

  await t.test("all six screenshot hashes and source fingerprint match", async (t) => {
    const root = await tempRoot(t);
    const evidence = await collectRecordArchiveVisualEvidence({ root });
    await writeReceipt(root, approvedReceipt(evidence));
    const verified = await verifyRecordArchiveVisualApproval({ root });
    assert.equal(verified.sourceFingerprint, evidence.sourceFingerprint);
    assert.deepEqual(verified.screenshots, evidence.screenshots);
    assert.equal(verified.screenshots.length, 6);
    assert.equal(verified.screenshots[0].sha256, sha256("screenshot:ranked-list-desktop\n"));
  });
});
