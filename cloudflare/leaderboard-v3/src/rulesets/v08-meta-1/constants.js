export const RULESET_ID = "v08-meta-1";
export const RULESET_STATUS = "test-only";
export const RULESET_MANIFEST_VERSION = 2;

export const AUTHORITY_CLASSES = Object.freeze([
  "SERVER_DERIVED",
  "SERVER_ISSUED",
  "BOUNDED_CLIENT_ATTESTED",
  "HEURISTIC_ONLY",
  "CLIENT_ONLY"
]);

export const RNG_DOMAIN = "dungeon-online-v3/ruleset-rng/v1";
export const RNG_SECRET_BINDING = "RANKED_V3_RULESET_RNG_SECRET";
export const CONSUMED_DIRECTIVE_HISTORY_LIMIT = 64;
