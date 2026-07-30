export const R2_THREAT_STATUS = Object.freeze({
  fixed: "FIXED",
  accepted: "ACCEPTED_PRODUCT_LIMITATION"
});

export const R2_THREAT_MATRIX = Object.freeze([
  [1, "change_gold", R2_THREAT_STATUS.accepted, "anti-tamper.test.js", /gold/u],
  [2, "change_build", R2_THREAT_STATUS.fixed, "anti-tamper.test.js", /relic outside reward offer/u],
  [3, "change_lives", R2_THREAT_STATUS.fixed, "m3-lives-outcome.test.js", /life|lives/u],
  [4, "change_score", R2_THREAT_STATUS.accepted, "m3-finalization.test.js", /score/u],
  [5, "change_outcome", R2_THREAT_STATUS.accepted, "m3-finalization.test.js", /outcome/u],
  [6, "change_depth", R2_THREAT_STATUS.accepted, "phase3b1-property.test.js", /depth/u],
  [7, "change_directive_id", R2_THREAT_STATUS.fixed, "anti-tamper.test.js", /directive/u],
  [8, "change_room_nonce", R2_THREAT_STATUS.fixed, "checkpoint-token.test.js", /nonce/u],
  [9, "change_ruleset_hash", R2_THREAT_STATUS.fixed, "ruleset-registry.test.js", /hash/u],
  [10, "token_from_another_run", R2_THREAT_STATUS.fixed, "checkpoint-token.test.js", /run/u],
  [11, "wrong_token_kind", R2_THREAT_STATUS.fixed, "m2b-bootstrap-boundary.test.js", /BOUNDARY_KIND/u],
  [12, "old_token", R2_THREAT_STATUS.fixed, "revision-idempotency.test.js", /stale/u],
  [13, "replay_old_checkpoint", R2_THREAT_STATUS.fixed, "network-loss.test.js", /checkpoint/u],
  [14, "replay_merchant", R2_THREAT_STATUS.fixed, "m1-merchant.test.js", /retry|replay/u],
  [15, "replay_forge", R2_THREAT_STATUS.fixed, "m1-forge.test.js", /retry|replay/u],
  [16, "replay_replacement", R2_THREAT_STATUS.fixed, "phase3b2c2-golden.test.js", /exact retry is idempotent/u],
  [17, "replay_fallback", R2_THREAT_STATUS.fixed, "phase3b2c3a-golden.test.js", /exact retry is stable/u],
  [18, "replay_finalize", R2_THREAT_STATUS.fixed, "m3-finalization.test.js", /retry|replay/u],
  [19, "concurrent_finalize", R2_THREAT_STATUS.fixed, "m3-finalization.test.js", /parallel|concurrent/u],
  [20, "concurrent_starting_choices", R2_THREAT_STATUS.fixed, "m2b-real-runtime-http.test.js", /concurrent/u],
  [21, "operation_id_other_payload", R2_THREAT_STATUS.fixed, "revision-idempotency.test.js", /IDEMPOTENCY_KEY_REUSED/u],
  [22, "operation_id_other_run", R2_THREAT_STATUS.fixed, "revision-idempotency.test.js", /run/u],
  [23, "response_loss_after_commit", R2_THREAT_STATUS.fixed, "network-loss.test.js", /response/u],
  [24, "reload_before_ack", R2_THREAT_STATUS.fixed, "m4-client-terminal.test.js", /lost finalize response/u],
  [25, "delete_local_session", R2_THREAT_STATUS.fixed, "r2-resume.test.js", /independent credential/u],
  [26, "tamper_cursor", R2_THREAT_STATUS.fixed, "r2-protocol-cursor.test.js", /cursor/u],
  [27, "display_xss", R2_THREAT_STATUS.fixed, "m4-client-leaderboard.test.js", /innerHTML|text-safe/u],
  [28, "oversized_json", R2_THREAT_STATUS.fixed, "payload-size.test.js", /64 KiB|payload/u],
  [29, "unknown_response_kind", R2_THREAT_STATUS.fixed, "r2-protocol-cursor.test.js", /unknown response kinds/u],
  [30, "worker_restart_write_response", R2_THREAT_STATUS.fixed, "r2-resume.test.js", /Worker restart/u],
  [31, "profile_leaderboard_fanout", R2_THREAT_STATUS.fixed, "m3-leaderboard-publication.test.js", /campaign profile publish at most one/u]
].map(([id, attempt, status, evidenceFile, evidencePattern]) => Object.freeze({
  id,
  attempt,
  status,
  evidenceFile,
  evidencePattern
})));
