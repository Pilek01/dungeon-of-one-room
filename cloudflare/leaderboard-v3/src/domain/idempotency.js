export function findRecentOperation(recentOps, idempotencyKey) {
  const key = String(idempotencyKey || "");
  return (Array.isArray(recentOps) ? recentOps : []).find(
    (operation) => operation?.idempotencyKey === key
  ) || null;
}

export function resolveIdempotentReplay(recentOps, idempotencyKey, requestDigest) {
  const operation = findRecentOperation(recentOps, idempotencyKey);
  if (!operation) return { kind: "miss" };
  if (operation.requestDigest !== requestDigest) {
    return { kind: "conflict" };
  }
  return {
    kind: "replay",
    responseStatus: operation.responseStatus,
    responseBody: operation.responseBody,
    resultingRevision: operation.resultingRevision
  };
}

export function appendRecentOperation(recentOps, operation, limit) {
  const boundedLimit = Math.max(1, Math.floor(Number(limit) || 1));
  const current = Array.isArray(recentOps) ? recentOps : [];
  return [...current, { ...operation }].slice(-boundedLimit);
}
