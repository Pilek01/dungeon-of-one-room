import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  approvalReceiptPath,
  collectRecordArchiveVisualEvidence,
  REQUIRED_SCREENSHOTS,
  requiredScreenshotPaths
} from "./record-archive-visual-receipt.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function optionValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || "") : "";
}

function confirmations(value) {
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

const screenshotPaths = requiredScreenshotPaths(root);
for (const screenshot of screenshotPaths) {
  console.log(`${screenshot.id}: ${screenshot.absolutePath}`);
}

const reviewer = optionValue("--reviewer").trim();
const confirmed = confirmations(optionValue("--confirm"));
const requiredIds = REQUIRED_SCREENSHOTS.map((screenshot) => screenshot.id);
const exactConfirmation = confirmed.length === requiredIds.length &&
  new Set(confirmed).size === requiredIds.length &&
  requiredIds.every((id) => confirmed.includes(id));

if (!reviewer) {
  throw new Error("Explicit reviewer required: --reviewer <name>");
}
if (!exactConfirmation) {
  throw new Error(`Explicit confirmation of all screenshots required: --confirm ${requiredIds.join(",")}`);
}

const evidence = await collectRecordArchiveVisualEvidence({ root });
const receipt = {
  schema: 1,
  reviewer,
  reviewedAt: new Date().toISOString(),
  sourceFingerprint: evidence.sourceFingerprint,
  screenshots: evidence.screenshots.map(({ id, sha256 }) => ({ id, sha256 }))
};
const receiptPath = approvalReceiptPath(root);
await mkdir(path.dirname(receiptPath), { recursive: true });
await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
console.log(`Visual archive approval written: ${receiptPath}`);
