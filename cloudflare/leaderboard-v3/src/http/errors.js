export class HttpError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const CONFLICT_CODES = new Set([
  "REVISION_CONFLICT",
  "IDEMPOTENCY_KEY_REUSED",
  "ROOM_DIRECTIVE_MISMATCH",
  "ROOM_NONCE_MISMATCH",
  "RUN_ALREADY_FINALIZED",
  "REWARD_ALREADY_CLAIMED"
]);

const UNPROCESSABLE_CODES = new Set([
  "ROOM_PROOF_INVALID",
  "ROOM_PROOF_TOO_LARGE",
  "COMMAND_JOURNAL_INVALID",
  "COMMAND_CODE_INVALID",
  "COMMAND_JOURNAL_IMPLAUSIBLE",
  "JOURNAL_DIGEST_INVALID",
  "JOURNAL_DIGEST_MISMATCH",
  "ROOM_RESULT_INVALID",
  "TURN_COUNT_INVALID",
  "ELAPSED_MS_INVALID",
  "SEQUENTIAL_DEPTH_REQUIRED",
  "META_EVENT_REJECTED",
  "RELIC_NOT_OFFERED",
  "MUTATOR_NOT_OFFERED",
  "SKILL_NOT_OFFERED",
  "ELIXIR_NOT_OFFERED",
  "CAMP_UPGRADE_NOT_OFFERED",
  "FORGE_ACTION_NOT_OFFERED",
  "PACT_NOT_OFFERED",
  "MERCHANT_ITEM_NOT_FOUND",
  "INSUFFICIENT_GOLD",
  "STACK_LIMIT_EXCEEDED",
  "NO_LIVES_REMAINING",
  "EVENT_TYPE_INVALID",
  "FINALIZE_OUTCOME_INVALID",
  "FATAL_EVENT_PAYLOAD_INVALID",
  "FATAL_EVENT_PAYLOAD_INVALID_FIELDS",
  "REWARD_CLAIM_POTION_USE_LIMIT",
  "FATAL_EVENT_CLASSIFICATION_INVALID",
  "FATAL_ELIXIR_USAGE_INVALID",
  "FATAL_ELIXIR_USAGE_UNAVAILABLE",
  "FATAL_PRESENTATION_CAUSE_INVALID"
]);

export function errorFromCause(cause) {
  if (cause instanceof HttpError) return cause;
  const message = String(cause?.message || cause || "INTERNAL_ERROR");
  const code = message.split(":")[0];
  if (code === "RULESET_UNAVAILABLE" || code === "RULESET_HASH_MISSING") {
    return new HttpError(503, "RULESET_UNAVAILABLE", "A production ruleset is not configured.");
  }
  if (code === "RULESET_HASH_MISMATCH") {
    return new HttpError(409, code, "The requested ruleset does not match.");
  }
  if (code === "RUN_NOT_FOUND") return new HttpError(404, code, "Run not found.");
  if (code === "RUN_NOT_ACTIVE") return new HttpError(409, code, "Run is not active.");
  if (CONFLICT_CODES.has(code)) return new HttpError(409, code, code);
  if (UNPROCESSABLE_CODES.has(code)) return new HttpError(422, code, code);
  if (/token is expired/iu.test(message)) {
    return new HttpError(401, "TOKEN_EXPIRED", "Checkpoint token is expired.");
  }
  if (
    /Checkpoint token|Boundary token|TOKEN_BOUNDARY_KIND_MISMATCH|base64url|JSON serialization is not canonical/iu.test(message)
  ) {
    return new HttpError(401, "TOKEN_INVALID", "Checkpoint token is invalid.");
  }
  if (
    /^(STARTING_RELIC_|RELIC_|META_TRANSACTION_|MERCHANT_|FORGE_|CROSSROADS_|CAMP_|PACT_|ROOM_CHECKPOINT_|REWARD_CLAIM_|BOUNDARY_|PUBLIC_|NORMAL_EXTRACTION_|EXTRACTION_)/u.test(code)
  ) {
    return new HttpError(422, code, code);
  }
  if (code === "REAL_RULESET_FINALIZATION_REQUIRES_M3") {
    return new HttpError(
      409,
      code,
      "Real ruleset finalization remains fail-closed until M3 defines canonical outcome and score."
    );
  }
  if (code.startsWith("RULESET_")) return new HttpError(422, code, code);
  return new HttpError(500, "INTERNAL_ERROR", "Internal server error.");
}
