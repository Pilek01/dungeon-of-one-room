import { createHash } from "node:crypto";

export function observerBotReleaseConfig(env = {}, target = "release") {
  const password = String(env.DUNGEON_ONLINE_TEST_BOT_PASSWORD || "");
  if (target === "release" && !password) {
    throw new Error(
      "DUNGEON_ONLINE_TEST_BOT_PASSWORD is required for release builds."
    );
  }
  return Object.freeze({
    enabled: Boolean(password),
    passwordHash: password
      ? "sha256:" + createHash("sha256").update(password, "utf8").digest("hex")
      : ""
  });
}