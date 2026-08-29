function safeRelicId(entry) {
  return String(entry?.relicId || entry?.id || "");
}

export function getCanonicalRelicReplacementKey(publicState) {
  const choice = publicState?.metaTransactionOffer?.choices?.find((candidate) =>
    Array.isArray(candidate?.removals) && candidate.removals[0]?.relicId
  );
  const relicId = String(choice?.removals?.[0]?.relicId || "");
  const expandedRelics = (Array.isArray(publicState?.build?.relics)
    ? publicState.build.relics
    : []
  ).flatMap((entry) => Array.from(
    { length: Math.max(1, Number(entry?.stacks) || 1) },
    () => safeRelicId(entry)
  )).filter(Boolean);
  const index = expandedRelics.indexOf(relicId);
  const key = index === 9 ? "0" : index >= 0 && index < 9 ? String(index + 1) : "";
  return { relicId, key };
}

export function shouldDismissCampGuide(campAudit) {
  return /Camp Guide/u.test(String(campAudit?.game?.overlayText || ""));
}

export async function triggerCheckpointWithRetry(options = {}) {
  const trigger = options.trigger;
  const checkpointStarted = options.checkpointStarted;
  const timeoutMs = Math.max(1, Number(options.timeoutMs) || 2_000);
  const attempts = Math.max(1, Number(options.attempts) || 2);
  const failureLabel = String(options.failureLabel || "Ranked Camp checkpoint");
  if (typeof trigger !== "function" || !checkpointStarted?.then) {
    throw new TypeError("Ranked Camp checkpoint retry requires a trigger and start promise.");
  }
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await trigger();
    const started = await Promise.race([
      checkpointStarted.then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs))
    ]);
    if (started) return attempt;
  }
  throw new Error(`${failureLabel} did not start after ${attempts} attempts.`);
}

export async function triggerPortalWithRetry(options = {}) {
  const trigger = options.trigger;
  const waitForProgress = options.waitForProgress;
  const attempts = Math.max(1, Number(options.attempts) || 3);
  if (typeof trigger !== "function" || typeof waitForProgress !== "function") {
    throw new TypeError("Ranked portal retry requires trigger and progress functions.");
  }
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await trigger();
    try {
      await waitForProgress();
      return attempt;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Ranked portal did not start after ${attempts} attempts.`, {
    cause: lastError
  });
}
