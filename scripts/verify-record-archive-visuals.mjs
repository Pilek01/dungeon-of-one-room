import { verifyRecordArchiveVisualApproval } from "./record-archive-visual-receipt.mjs";

try {
  const approval = await verifyRecordArchiveVisualApproval();
  console.log(`Verified record archive visuals: ${approval.sourceFingerprint} (${approval.screenshots.length} screenshots)`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
