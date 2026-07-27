export const RETENTION_POLICY_VERSION = "ranked-v3-retention-1";

export async function cleanupExpiredRuns(runRepository, now) {
  if (!runRepository || typeof runRepository.deleteExpired !== "function") {
    throw new TypeError("RUN_RETENTION_REPOSITORY_REQUIRED");
  }
  const timestamp = Number(now);
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
    throw new TypeError("RUN_RETENTION_TIME_INVALID");
  }
  const deleted = await runRepository.deleteExpired(timestamp);
  return Object.freeze({
    policyVersion: RETENTION_POLICY_VERSION,
    deleted: Math.max(0, Number(deleted) || 0),
    ranAt: timestamp
  });
}
