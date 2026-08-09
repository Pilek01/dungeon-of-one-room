import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const APPROVAL_RECEIPT_RELATIVE_PATH = "output/verification/record-archive-visual-approval.json";
export const RELEASE_RECEIPT_FILE = "record-archive-release-receipt.json";
export const REQUIRED_SCREENSHOTS = Object.freeze([
  Object.freeze({ id: "ranked-list-desktop", relativePath: "output/online-v3-ranked-headed/lifecycle/ranked-leaderboard.png" }),
  Object.freeze({ id: "ranked-list-page-2", relativePath: "output/online-v3-ranked-headed/lifecycle/ranked-leaderboard-page-2.png" }),
  Object.freeze({ id: "ranked-detail", relativePath: "output/online-v3-ranked-headed/lifecycle/ranked-leaderboard-detail.png" }),
  Object.freeze({ id: "practice-list-desktop", relativePath: "output/online-v3-baseline/save/practice-records-list-desktop.png" }),
  Object.freeze({ id: "practice-list-narrow", relativePath: "output/online-v3-baseline/save/practice-records-list-narrow.png" }),
  Object.freeze({ id: "practice-detail-rank4", relativePath: "output/online-v3-baseline/save/practice-records-detail-rank4.png" })
]);
export const REQUIRED_SOURCE_PATHS = Object.freeze([
  "record-archive-ui.js",
  "practice-records-adapter.js",
  "online-v3/ranked-v3-leaderboard-ui.js",
  "online-v3/ranked-v3-runtime.js",
  "game.js",
  "style-record-archive.css",
  "style.css",
  "assets/hd/ui/ranked-reference-plates/ranked-leaderboard-desktop-plate.png",
  "assets/hd/ui/ranked-reference-plates/ranked-build-inspect-desktop-plate.png",
  "index.html",
  "assets/hd/ui/leaderboard/skull-medallion-gold.png",
  "assets/hd/ui/leaderboard/skull-medallion-silver.png",
  "assets/hd/ui/leaderboard/skull-medallion-bronze.png"
]);

const sha256 = (value) => `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
const absolutePath = (root, relativePath) => path.resolve(root, relativePath);

async function hashRequiredFile(root, relativePath, label) {
  try {
    return sha256(await readFile(absolutePath(root, relativePath)));
  } catch (error) {
    if (error && error.code === "ENOENT") throw new Error(`${label} is missing: ${relativePath}`);
    throw error;
  }
}

export function approvalReceiptPath(root = defaultRoot) {
  return absolutePath(root, APPROVAL_RECEIPT_RELATIVE_PATH);
}

export function requiredScreenshotPaths(root = defaultRoot) {
  return REQUIRED_SCREENSHOTS.map((screenshot) => Object.freeze({
    id: screenshot.id,
    absolutePath: absolutePath(root, screenshot.relativePath)
  }));
}

export async function collectRecordArchiveVisualEvidence({ root = defaultRoot } = {}) {
  const screenshots = [];
  for (const screenshot of REQUIRED_SCREENSHOTS) {
    screenshots.push(Object.freeze({
      id: screenshot.id,
      sha256: await hashRequiredFile(root, screenshot.relativePath, "required screenshot")
    }));
  }

  const sourceHashes = [];
  for (const relativePath of REQUIRED_SOURCE_PATHS) {
    sourceHashes.push(Object.freeze({
      relativePath,
      sha256: await hashRequiredFile(root, relativePath, "required source")
    }));
  }
  const fingerprintInput = sourceHashes.map((entry) => `${entry.relativePath}\u0000${entry.sha256}\n`).join("");
  return Object.freeze({
    sourceFingerprint: sha256(fingerprintInput),
    screenshots: Object.freeze(screenshots)
  });
}

function isExactScreenshotSet(screenshots) {
  return Array.isArray(screenshots) &&
    screenshots.length === REQUIRED_SCREENSHOTS.length &&
    screenshots.every((screenshot, index) => (
      screenshot && screenshot.id === REQUIRED_SCREENSHOTS[index].id &&
      typeof screenshot.sha256 === "string" && /^sha256:[a-f0-9]{64}$/u.test(screenshot.sha256)
    ));
}

function validateReceiptShape(receipt) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw new Error("visual approval receipt must be an object");
  }
  if (receipt.schema !== 1) throw new Error("visual approval receipt schema must be 1");
  if (typeof receipt.reviewer !== "string" || !receipt.reviewer.trim()) {
    throw new Error("visual approval receipt reviewer is required");
  }
  if (typeof receipt.reviewedAt !== "string" || Number.isNaN(Date.parse(receipt.reviewedAt))) {
    throw new Error("visual approval receipt reviewedAt must be ISO-8601");
  }
  if (typeof receipt.sourceFingerprint !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(receipt.sourceFingerprint)) {
    throw new Error("visual approval receipt source fingerprint is invalid");
  }
  if (!isExactScreenshotSet(receipt.screenshots)) {
    throw new Error("visual approval receipt screenshot IDs must match the required set exactly");
  }
}

export async function verifyRecordArchiveVisualApproval({ root = defaultRoot } = {}) {
  const receiptPath = approvalReceiptPath(root);
  let receipt;
  try {
    receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") throw new Error("missing visual approval receipt");
    if (error instanceof SyntaxError) throw new Error("visual approval receipt is not valid JSON");
    throw error;
  }
  validateReceiptShape(receipt);
  const evidence = await collectRecordArchiveVisualEvidence({ root });
  if (receipt.sourceFingerprint !== evidence.sourceFingerprint) {
    throw new Error("source fingerprint mismatch");
  }
  for (const [index, screenshot] of evidence.screenshots.entries()) {
    if (receipt.screenshots[index].sha256 !== screenshot.sha256) {
      throw new Error(`screenshot hash mismatch: ${screenshot.id}`);
    }
  }
  return Object.freeze({
    sourceFingerprint: evidence.sourceFingerprint,
    screenshots: evidence.screenshots
  });
}

export function sanitizedReleaseReceipt(evidence) {
  return Object.freeze({
    schema: 1,
    sourceFingerprint: evidence.sourceFingerprint,
    screenshots: evidence.screenshots.map(({ id, sha256: hash }) => Object.freeze({ id, sha256: hash }))
  });
}
