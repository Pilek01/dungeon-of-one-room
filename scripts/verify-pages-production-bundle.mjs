import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { RELEASE_RECEIPT_FILE, sanitizedReleaseReceipt, verifyRecordArchiveVisualApproval } from "./record-archive-visual-receipt.mjs";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function assertNoLocalMultiBotTelemetry(game) {
  if (String(game).includes("__DUNGEON_MULTI_BOT_TELEMETRY__")) {
    throw new Error("Production Pages bundle must not contain local multi-bot telemetry.");
  }
}

export async function verifyPagesProductionBundle({ root = defaultRoot } = {}) {
  const configPath = path.join(root, "output", "pages-dist", "config.js");
  const config = await readFile(configPath, "utf8");
  const gamePath = path.join(root, "output", "pages-dist", "game.js");
  const game = await readFile(gamePath, "utf8");
  assertNoLocalMultiBotTelemetry(game);
  const enabled = /window\.DUNGEON_ONLINE_TEST_BOT_ENABLED\s*=\s*true;/u.test(config);
  const hashMatch = config.match(
    /window\.DUNGEON_ONLINE_TEST_BOT_PASSWORD_HASH\s*=\s*"(sha256:[a-f0-9]{64})";/u
  );
  if (!enabled || !hashMatch) {
    throw new Error("Production Pages bundle must enable the Observer Bot with a SHA-256 password hash.");
  }

  const currentPassword = String(process.env.DUNGEON_ONLINE_TEST_BOT_PASSWORD || "");
  if (currentPassword && config.includes(currentPassword)) {
    throw new Error("Production Pages bundle must not contain the Observer Bot password.");
  }

  const visualApproval = await verifyRecordArchiveVisualApproval({ root });
  const releaseReceiptPath = path.join(root, "output", "pages-dist", RELEASE_RECEIPT_FILE);
  let releaseReceipt;
  try {
    releaseReceipt = JSON.parse(await readFile(releaseReceiptPath, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error("Production Pages bundle is missing the reviewed record archive receipt.");
    }
    throw new Error("Production Pages bundle has an invalid record archive receipt.");
  }
  const expectedReleaseReceipt = sanitizedReleaseReceipt(visualApproval);
  if (JSON.stringify(releaseReceipt) !== JSON.stringify(expectedReleaseReceipt)) {
    throw new Error("Production Pages bundle record archive receipt does not match the current reviewed evidence.");
  }

  return Object.freeze({ configPath, passwordHash: hashMatch[1], sourceFingerprint: visualApproval.sourceFingerprint });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyPagesProductionBundle().then(
    ({ configPath }) => console.log(`Verified production Pages bundle: ${configPath}`),
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  );
}
