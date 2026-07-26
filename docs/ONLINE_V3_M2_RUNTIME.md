# Online v3 M2 — Runtime and compact idempotency

Status: partially implemented locally; endpoint integration is blocked. No
client integration or deployment.

## Compact operation history

The Phase 2 Worker stored a complete HTTP response in every entry of the
24-operation `recent_ops_json` ring. The measured ordinary ring was 57,767 B.
A legal 14,484 B replacement response repeated across the ring would require
176,029 B at 12 entries or 352,057 B at 24 entries.

The v2 local D1 run measured 27,554 B at 12 ordinary operations. A controlled
12-operation fixture with the same legal 14,484 B replacement projection in
every response measured 175,291 B in the legacy full-response shape and
29,573 B in v2. These are UTF-8 serialized JSON sizes; the compact result is
not an estimate.

M2 defines `recent_ops` format v2. It retains a bounded ordered chain of:

- operation identity and canonical request digest;
- operation and response kinds;
- run, ruleset ID and exact ruleset hash;
- revision before and after;
- response status, state digest, creation time and result digest;
- exact historical checkpoint token;
- response-specific fields excluding the public state projection;
- one immutable base public-state snapshot followed by deterministic patches.

The first retained record is always a snapshot. Later records contain only
sorted `set` and `delete` patch operations relative to the previous historical
projection. When the ring evicts its oldest record, the next projection is
reconstructed and promoted to the new immutable base snapshot. Reconstruction
never reads the newest run state.

Exact retry equivalence is semantic object equality plus the original HTTP
status. JSON object key order is not part of the contract. A SHA-256 digest of
the complete original response is verified after reconstruction, so corrupt or
incomplete historical data fails closed.

The selected retention window is 12 accepted operations. The client protocol
permits only one unresolved dependent mutation at a time, while 12 operations
cover delayed transport retry, reconnect and finalize reconciliation without
repeating full projections 24 times. A start retry outside the retained window
returns `IDEMPOTENCY_WINDOW_EXPIRED`. An evicted mutation is indistinguishable
from a new request carrying an old signed token and retains the documented
`REVISION_CONFLICT`; neither path executes against the latest revision.

## Remaining M2 work

The existing D1 `recent_ops_json` column can store the versioned object, so M2
does not add a table or run a migration. Legacy arrays are explicit v1 data:
they remain exact-replay compatible on read and are deterministically converted
to v2 on the next successful run mutation. Unknown versions and malformed
legacy records fail closed; old data is never silently reinterpreted.

## Local release candidate

Release state is deliberately outside the canonical ruleset directory, so
promotion does not change domain inputs or the ruleset hash. The pure ruleset
manifest remains `test-only`; `V08_META_1_LOCAL_RELEASE_DESCRIPTOR` marks the
exact ID/hash pair as `local-release-candidate` only for `test` and `local`
environments. The registry distinguishes fixture-test, test-only,
local-release-candidate, production-released and deprecated descriptors.

Resolution requires an exact ruleset ID, exact hash, environment and lifecycle.
Unknown IDs/hashes, mismatched ID/hash pairs, deprecated hashes, fixture use in
a ranked lifecycle and production use of the local candidate all fail closed.
Production activation remains unavailable.

## Endpoint integration blocker

M2.4 cannot be implemented without changing or inventing an HTTP boundary:

- `v08-meta-1` starts in `awaiting_starting_relic`, issues a mandatory opaque
  starting offer and deliberately has no room directive until the choice is
  committed;
- the current start orchestration immediately dereferences
  `state.roomDirective.id` and `state.roomDirective.roomNonce` when signing its
  checkpoint token;
- every current event request requires `roomDirectiveId` and `roomNonce`;
- the documented protocol explicitly says that no endpoint exposes the
  pre-room starting-relic flow;
- there is no canonical directive ID or nonce for the starting offer, and the
  current event allowlist has no separate pre-room offer boundary.

Using the offer ID as a synthetic directive, auto-selecting a starting relic,
making the mutation envelope optional, or adding an unreviewed pre-room route
would change the existing HTTP/token contract. `CURRENT.md` requires that
contract to remain unchanged and explicitly says to stop if it is insufficient.
M2.4 is therefore blocked rather than guessed.

M2.5 depends on M2.4. The existing fixture Wrangler/D1 lifecycle still proves
compact v2 persistence, exact retries, restart, concurrency and atomic
finalization, but it is not evidence for a real-ruleset lifecycle. The required
real Merchant, Forge, Crossroads, Camp and Pact HTTP scenarios remain blocked
with endpoint dispatch.

The M3 scoring/lives/outcome policies also remain unimplemented, but they are
not the M2.4 stop cause because `CURRENT.md` permits the current explicitly
provisional finalization behavior.

Final verification of the implemented partial milestone is phase 612/612,
baseline guard 3/3 plus headed smoke, and full 624/624 including the existing
fixture Wrangler/D1 lifecycle 9/9. These passing fixture tests do not remove
the real-ruleset M2.5 blocker.

## Deployment blockers

- define and approve a canonical authenticated pre-room offer boundary while
  preserving or explicitly versioning the HTTP/token contract;
- map every supported opaque real-ruleset transaction to explicit event
  operations, including Crossroads and the two Forge modes;
- complete the real-ruleset Wrangler/D1 lifecycle suite;
- retain local-only release state until a separate production release task.
