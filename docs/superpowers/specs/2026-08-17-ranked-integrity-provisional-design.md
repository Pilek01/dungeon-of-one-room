# Ranked checkpoint integrity and provisional results

## Scope

Protect Ranked against simple DevTools room-completion and gold manipulation without adding network traffic during movement, combat, AI, animation, audio, or rendering. The existing checkpoint remains the only combat-boundary request.

## Approved behavior

- Every newly entered Ranked room receives an in-memory, one-use completion capability. The generated game bridge keeps it in its private closure and returns it only with the real room-clear summary.
- The room-clear summary reports the local gold delta measured from room entry through room clear. The Worker compares this telemetry with the gold derived from the canonical reward envelope, including canonical build effects and mutators.
- A missing or invalid completion capability, or a mismatched gold delta, changes `rankEligibility` monotonically from `official` to `provisional`.
- A provisional run may continue normally. The client shows one neutral notice per run: the integrity check failed and the result will not be included in the official leaderboard.
- Death, extraction, and final snapshots from provisional runs are not written to leaderboard storage. `assistanceClass` remains independent and keeps its current test-assistance semantics.
- Canonical runs created before this change remain in legacy compatibility mode when their checkpoint omits the new integrity version. Every newly created run requires integrity version 1; omitting the whole envelope makes that run provisional. The generated current client always sends integrity version 1.

## Trust boundary

The completion capability is client-side hardening, not a cryptographic proof against an advanced attacker who rewrites the whole client. Server-issued room bindings, tokens, revisions, reward envelopes, canonical build state, and idempotency remain the actual authority. The design is intentionally aimed at simple DevTools manipulation and must not be described as cheat-proof or server-authoritative combat.

## Gold model

The Worker already bounds enemy, elite, hazard, chest, room-clear, build, and mutator rewards. The new check compares the local room delta with the amount settled from those bounded claims. It does not duplicate or guess the exact v0.8 room generator on the Worker. Exact per-seed enemy roster validation is deferred until room composition is deliberately moved into shared deterministic rules.

The pinned v08-meta-1 settlement predates the local v0.8 `+3` elite reward bonus. Integrity comparison accounts for that known presentation delta with the same canonical build and run-mutator multipliers, without changing the pinned ruleset economy or its release hash.

## Compatibility and storage

`rankEligibility` and its reason ledger live in canonical run JSON, so no D1 migration or leaderboard schema change is required. Public state exposes only the eligibility class. No new endpoint, request during combat, or production deployment is part of this task.
