# Online v3 M2 — Runtime and compact idempotency

Status: implementation in progress. No client integration or deployment.

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

Local release-candidate activation, endpoint dispatch and real Wrangler/D1
lifecycle coverage are not yet complete.
