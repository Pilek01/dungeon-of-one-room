import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function verifyPagesProductionBundle({ root = defaultRoot } = {}) {
  const configPath = path.join(root, "output", "pages-dist", "config.js");
  const config = await readFile(configPath, "utf8");
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

  return Object.freeze({ configPath, passwordHash: hashMatch[1] });
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
