# Online v3 Milestone R2

Status: complete locally. Ready for a separate M5 planning task; not staged,
deployed, activated, or migrated remotely.

## Product boundary

R1-P0-001 is `ACCEPTED_PRODUCT_LIMITATION`. Ranked remains
checkpoint-authoritative meta-progression around local v0.8 combat. The Worker
owns directives, revisions, gold and transaction ledgers, canonical build,
lives, outcomes, final score, and leaderboard publication. It does not prove
that local combat was honestly played. Practice and Ranked keep the same
gameplay and their existing player-facing names.

## R2 commits

- `9f0cd8a` — preserve the R1 review and record the trust decision;
- `71a4e15` — correct the Camp/extraction lifecycle;
- `f69b4e6` — add authenticated run resume;
- `2d4dcf8` — repair error, abandon, and resync flows;
- `60ef67c` — add single-writer browser coordination;
- `e9299e5` — add retention and abuse safeguards;
- `24d29e7` — harden protocol projections and the leaderboard cursor;
- `972e2ea` — add combined lifecycle, D1, headed, and threat-matrix coverage.

## Camp and anonymous profile

Active v0.8 source confirms that Camp is persistent cross-run progression and
is entered through extraction. Ranked now uses an opaque anonymous profile ID
plus an independent 256-bit profile credential. D1 stores only the credential
verifier and canonical profile projection.

An ordinary room cannot open Camp. Extraction updates the profile and run in
one storage boundary; finalization must succeed before Camp opens. Camp
transactions are server-issued and profile-scoped. The next Ranked run hydrates
the canonical extracted profile, including its build and upgrades. Practice
continues to use its original local Camp/save state.

## Recovery and token refresh

Every start creates an independent 256-bit run recovery credential. Only its
derived verifier is stored in D1; the raw value is absent from canonical state,
recent operations, metrics, and logs. Run ID, player name, and installation
hash cannot authorize resume.

`POST /api/v3/runs/resume` authenticates the credential and returns only the
public canonical projection plus a fresh boundary token matching the stored
state: bootstrap, room, terminal, or no token for finalized state. Resume works
after Worker restart and after a short-lived boundary token expires.

Returning to Practice clears only the local Ranked session and preserves
recovery. Canonical abandonment is separately confirmed, authenticated,
idempotent, and clears recovery only after acknowledgement. Finalized recovery
is cleared from the active browser flow when the completed lifecycle is left;
the server endpoint still supports retained finalized projection checks.

## Client reliability and tabs

Mutations use one persisted operation ID and exact body until acknowledgement.
Network, stale-state, and projection failures enter explicit reconnect/protocol
states. A malformed local projection after a server commit triggers
authenticated canonical resume; it never promotes a local fallback.

Each run has one browser writer lease stored outside Practice data. A second tab
is read-only while the owner lease is live. BroadcastChannel is advisory; the
localStorage lease is authoritative for the browser. Owner unload releases the
lease, an expired/released lease can be taken over, and every takeover resyncs
the canonical projection before further mutation.

## Retention, abuse, and metrics

The scheduled cleanup deletes expired non-finalized runs while preserving
active valid runs and immutable finalized leaderboard entries. A profile may
hold at most two non-finalized retained runs. Production start is fail-closed
unless the `RANKED_V3_ABUSE_CONTROL` binding is configured; no module-global
mutable limiter pretends to provide distributed protection.

The bounded metric contract covers starts, rejections, active runs, cleanup,
resume results, invalid credentials, stale conflicts, finalization,
leaderboard reads, and D1 failures. Metric dimensions exclude credentials,
tokens, direct contact data, and canonical state.

## Protocol and cursor policy

The supported client/server version is `ranked-v3-checkpoint-1`.
`GET /api/v3/availability` reports compatibility, the strict request-schema
policy, test-only/production-gated availability, and
`productionActivated: false`.

Registered security-sensitive mutations reject unknown top-level fields.
Browser validation fails closed for malformed nested directives, reward
envelopes, builds, lives, offers, Camp projections, final projections, and
leaderboard details. Unknown response status/kind is rejected.

The leaderboard cursor is a versioned, client-controlled public seek tuple. It
is not described as cryptographically opaque. Its schema is exact and bounded;
malformed, unsupported, or noncanonical input returns
`400 LEADERBOARD_CURSOR_INVALID` and never silently restarts pagination.

`ranked-v3-recorder.js` and `ranked-v3-checkpoints.js` are explicitly
`test_spec_only`. They are not active combat-security assurances.

## M5 gates

M5 remains a separate task. Before any shared/public environment:

- provision staging D1 and apply reviewed migrations `0001`–`0003`;
- configure a distinct HMAC secret and real distributed abuse control;
- configure metrics, alerts, rollback, retention scheduling, and data policy;
- decide the final leaderboard index tie-break migration and Unicode display
  policy;
- perform staging soak and rollback exercises;
- explicitly authorize ruleset activation and deployment.

No production resource, binding, migration, activation, push, or deployment
was changed by R2.
