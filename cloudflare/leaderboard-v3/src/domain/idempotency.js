import { canonicalDigest } from "../security/digests.js";

export const RECENT_OPERATIONS_FORMAT_V2 = 2;
export const PUBLIC_PROJECTION_VERSION = 1;

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function requireText(value, code) {
  const text = String(value || "");
  if (!text) throw new TypeError(code);
  return text;
}

function requireInteger(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(code);
  return value;
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function createProjectionPatch(previous, next, path = [], operations = []) {
  if (sameValue(previous, next)) return operations;
  if (!isObject(previous) || !isObject(next)) {
    operations.push(["set", path, clone(next)]);
    return operations;
  }
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  for (const key of [...keys].sort()) {
    const childPath = [...path, key];
    if (!(key in next)) {
      operations.push(["delete", childPath]);
    } else if (!(key in previous)) {
      operations.push(["set", childPath, clone(next[key])]);
    } else {
      createProjectionPatch(previous[key], next[key], childPath, operations);
    }
  }
  return operations;
}

function parentAtPath(root, path) {
  let current = root;
  for (const segment of path) {
    if (!isObject(current)) throw new TypeError("RECENT_OPS_PATCH_INVALID");
    if (!isObject(current[segment])) current[segment] = {};
    current = current[segment];
  }
  return current;
}

function applyProjectionPatch(previous, operations) {
  if (!Array.isArray(operations)) throw new TypeError("RECENT_OPS_PATCH_INVALID");
  let next = clone(previous);
  for (const operation of operations) {
    if (!Array.isArray(operation) || operation.length < 2 || !Array.isArray(operation[1])) {
      throw new TypeError("RECENT_OPS_PATCH_INVALID");
    }
    const [kind, path, value] = operation;
    if (path.some((segment) => typeof segment !== "string" || !segment)) {
      throw new TypeError("RECENT_OPS_PATCH_INVALID");
    }
    if (path.length === 0) {
      if (kind !== "set") throw new TypeError("RECENT_OPS_PATCH_INVALID");
      next = clone(value);
      continue;
    }
    const parent = parentAtPath(next, path.slice(0, -1));
    const key = path.at(-1);
    if (kind === "set") parent[key] = clone(value);
    else if (kind === "delete") delete parent[key];
    else throw new TypeError("RECENT_OPS_PATCH_INVALID");
  }
  return next;
}

function responseWithoutHistoricalFields(responseBody) {
  const response = clone(responseBody);
  const metaState = response.metaState;
  const checkpointToken = response.checkpointToken;
  delete response.metaState;
  delete response.checkpointToken;
  return { responseFields: response, metaState, checkpointToken };
}

function responseFromRecord(record, metaState) {
  return {
    ...clone(record.responseFields),
    ...(record.checkpointToken ? { checkpointToken: record.checkpointToken } : {}),
    metaState: clone(metaState)
  };
}

function assertCompactRecord(record) {
  if (!record || record.version !== RECENT_OPERATIONS_FORMAT_V2) {
    throw new TypeError("RECENT_OPS_RECORD_VERSION_UNSUPPORTED");
  }
  for (const field of [
    "operationId",
    "operationType",
    "requestDigest",
    "responseKind",
    "runId",
    "rulesetHash",
    "stateDigest",
    "resultDigest"
  ]) {
    requireText(record[field], `RECENT_OPS_RECORD_INVALID:${field}`);
  }
  for (const field of [
    "revisionBefore",
    "revisionAfter",
    "responseStatus",
    "createdAt"
  ]) {
    requireInteger(record[field], `RECENT_OPS_RECORD_INVALID:${field}`);
  }
  if (!isObject(record.responseFields)) {
    throw new TypeError("RECENT_OPS_RECORD_INVALID:responseFields");
  }
  if (!record.projection || !["snapshot", "patch"].includes(record.projection.kind)) {
    throw new TypeError("RECENT_OPS_RECORD_INVALID:projection");
  }
  return record;
}

function assertCompactStore(store) {
  if (
    !store ||
    store.version !== RECENT_OPERATIONS_FORMAT_V2 ||
    store.publicProjectionVersion !== PUBLIC_PROJECTION_VERSION ||
    !Array.isArray(store.records)
  ) {
    throw new TypeError("RECENT_OPS_FORMAT_UNSUPPORTED");
  }
  store.records.forEach(assertCompactRecord);
  if (store.records.length && store.records[0].projection.kind !== "snapshot") {
    throw new TypeError("RECENT_OPS_BASE_SNAPSHOT_REQUIRED");
  }
  return store;
}

function projectionAt(store, targetIndex) {
  assertCompactStore(store);
  if (targetIndex < 0 || targetIndex >= store.records.length) {
    throw new TypeError("RECENT_OPS_RECORD_NOT_FOUND");
  }
  let projection = null;
  for (let index = 0; index <= targetIndex; index += 1) {
    const record = store.records[index];
    if (record.projection.kind === "snapshot") {
      projection = clone(record.projection.value);
    } else {
      if (projection === null) throw new TypeError("RECENT_OPS_BASE_SNAPSHOT_REQUIRED");
      projection = applyProjectionPatch(projection, record.projection.operations);
    }
  }
  return projection;
}

export async function createCompactOperationRecord({
  operationId,
  operationType,
  requestDigest,
  responseKind,
  runId,
  rulesetId = "",
  rulesetHash,
  revisionBefore,
  revisionAfter,
  responseStatus,
  responseBody,
  stateDigest,
  createdAt
}) {
  if (!isObject(responseBody) || !isObject(responseBody.metaState)) {
    throw new TypeError("RECENT_OPS_RESPONSE_PROJECTION_REQUIRED");
  }
  const separated = responseWithoutHistoricalFields(responseBody);
  const resultDigest = await canonicalDigest(responseBody);
  return assertCompactRecord({
    version: RECENT_OPERATIONS_FORMAT_V2,
    operationId: requireText(operationId, "RECENT_OPS_OPERATION_ID_REQUIRED"),
    operationType: requireText(operationType, "RECENT_OPS_OPERATION_TYPE_REQUIRED"),
    requestDigest: requireText(requestDigest, "RECENT_OPS_REQUEST_DIGEST_REQUIRED"),
    responseKind: requireText(responseKind, "RECENT_OPS_RESPONSE_KIND_REQUIRED"),
    runId: requireText(runId, "RECENT_OPS_RUN_ID_REQUIRED"),
    rulesetId: String(rulesetId || ""),
    rulesetHash: requireText(rulesetHash, "RECENT_OPS_RULESET_HASH_REQUIRED"),
    revisionBefore: requireInteger(revisionBefore, "RECENT_OPS_REVISION_BEFORE_INVALID"),
    revisionAfter: requireInteger(revisionAfter, "RECENT_OPS_REVISION_AFTER_INVALID"),
    responseStatus: requireInteger(responseStatus, "RECENT_OPS_RESPONSE_STATUS_INVALID"),
    responseFields: separated.responseFields,
    checkpointToken: separated.checkpointToken || null,
    stateDigest: requireText(stateDigest, "RECENT_OPS_STATE_DIGEST_REQUIRED"),
    createdAt: requireInteger(createdAt, "RECENT_OPS_CREATED_AT_INVALID"),
    resultDigest,
    projection: {
      kind: "snapshot",
      value: clone(separated.metaState)
    }
  });
}

export function createRecentOperationsV2() {
  return {
    version: RECENT_OPERATIONS_FORMAT_V2,
    publicProjectionVersion: PUBLIC_PROJECTION_VERSION,
    records: []
  };
}

export function appendCompactRecentOperation(recentOps, inputRecord, limit) {
  const boundedLimit = Math.max(1, Math.floor(Number(limit) || 1));
  const store = assertCompactStore(recentOps);
  const record = assertCompactRecord(clone(inputRecord));
  const records = store.records.map(clone);
  if (records.length) {
    const previousProjection = projectionAt(store, records.length - 1);
    record.projection = {
      kind: "patch",
      operations: createProjectionPatch(
        previousProjection,
        record.projection.value
      )
    };
  }
  records.push(record);
  while (records.length > boundedLimit) {
    const temporary = {
      version: RECENT_OPERATIONS_FORMAT_V2,
      publicProjectionVersion: PUBLIC_PROJECTION_VERSION,
      records
    };
    const promotedProjection = projectionAt(temporary, 1);
    records.shift();
    records[0].projection = {
      kind: "snapshot",
      value: promotedProjection
    };
  }
  return {
    version: RECENT_OPERATIONS_FORMAT_V2,
    publicProjectionVersion: PUBLIC_PROJECTION_VERSION,
    records
  };
}

export async function resolveCompactIdempotentReplay(
  recentOps,
  operationId,
  requestDigest
) {
  const store = assertCompactStore(recentOps);
  const index = store.records.findIndex(
    (record) => record.operationId === String(operationId || "")
  );
  if (index < 0) return { kind: "miss" };
  const record = store.records[index];
  if (record.requestDigest !== requestDigest) return { kind: "conflict" };
  const metaState = projectionAt(store, index);
  const responseBody = responseFromRecord(record, metaState);
  if (await canonicalDigest(responseBody) !== record.resultDigest) {
    throw new TypeError("RECENT_OPS_RESULT_DIGEST_MISMATCH");
  }
  return {
    kind: "replay",
    responseStatus: record.responseStatus,
    responseBody,
    resultingRevision: record.revisionAfter
  };
}

export function recentOperationsByteLength(recentOps) {
  return new TextEncoder().encode(JSON.stringify(recentOps)).byteLength;
}

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
