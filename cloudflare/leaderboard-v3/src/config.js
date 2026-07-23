export const PROTOCOL_VERSION = "ranked-v3-checkpoint-1";
export const VERIFICATION_LEVEL = "checkpoint_verified_v3";
export const HMAC_SECRET_BINDING = "RANKED_V3_HMAC_SECRET";
export const TOKEN_TTL_MS = 15 * 60 * 1000;
export const RUN_TTL_MS = 24 * 60 * 60 * 1000;
export const RECENT_OPS_LIMIT = 24;
export const MAX_REQUEST_BYTES = 64 * 1024;
export const MAX_JOURNAL_COMMANDS = 512;
export const MAX_COMPACT_PROOF_BYTES = 24 * 1024;
export const MAX_TURN_COUNT = 100_000;
export const MAX_ELAPSED_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_LEADERBOARD_LIMIT = 20;
export const MAX_LEADERBOARD_LIMIT = 50;

export const ALLOWED_COMMAND_CODES = Object.freeze([
  "move",
  "attack",
  "skill",
  "potion",
  "elixir",
  "interact",
  "wait"
]);

export const ALLOWED_META_EVENTS = Object.freeze([
  "reward_selected",
  "relic_selected",
  "mutator_selected",
  "skill_upgraded",
  "elixir_selected",
  "merchant_purchase",
  "camp_upgrade",
  "forge_action",
  "pact_selected",
  "life_lost",
  "extract"
]);
