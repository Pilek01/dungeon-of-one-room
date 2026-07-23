# Online v3 `recent_ops_json` size audit

Date: 2026-07-23. Scope: read-only analysis of the existing Phase 2.5 local Wrangler/D1 artifact. No schema, retention limit or endpoint behavior changed.

## Measured shape

The largest local row contains:

```text
entries                              24
recent_ops_json                  57,767 B
canonical_state_json              1,489 B
average operation entry         2,405.9 B
minimum / maximum entry     2,348 / 2,418 B
```

Average field contribution per operation:

```text
responseBody                     2,159.7 B
  metaState                      1,257.6 B
  checkpointToken                  614.6 B
  authoritativeDelta               125.9 B
requestDigest                         64 B
idempotencyKey                       56.6 B
runId                                36 B
```

`responseBody` is about 89.8% of an average entry. `metaState + checkpointToken` alone is about 77.8%. The operation ring is about 38.8 times larger than the current canonical state because it stores a full public state and signed token for every retryable response.

## Does exact retry require all full bodies?

Exact retry requires the original status and semantically exact response for every idempotency key still inside the supported retry window. It does not necessarily require storing the response as the current nested object, but reconstruction must reproduce:

- the historical revision;
- historical public meta state, not the latest one;
- the original token payload/signature and timestamps;
- response-specific deltas/offers;
- headers that affect retry semantics.

The current Worker cannot reconstruct historical public state from only the latest canonical row. Dropping old bodies without adding a compact historical result record would break exact retry.

The planned browser queue is serialized by revision/token: one boundary request is in flight, and it must reconcile before the next dependent mutation is sent. A well-behaved client therefore has one unresolved network mutation at a time. Allowing multiple UI intents queued behind it does not make those operations committed or independently retryable. A retention window of 8-12 completed operations provides substantial room for delayed retries, tab resume and finalize reconciliation. It is not a proof that arbitrary months-old keys remain replayable; that guarantee was never part of the protocol.

## Options

| Option | Expected size at measured average | Idempotency | Operational risk | Assessment |
|---|---:|---|---|---|
| A. Keep ring 24 | 57.8 KiB | Current exact behavior | Continued large row rewrites | Safest behavior, misses preferred size target |
| B. Ring 8 | about 18.8 KiB | Exact for last 8 | Shorter retry window | Safely under 32 KiB |
| B. Ring 12 | about 28.2 KiB plus array overhead | Exact for last 12 | Requires explicit retention contract | Recommended Phase 3B interim |
| C. Compact replay record + deterministic reconstruction | likely 8-16 KiB at 24, design-dependent | Can remain exact if reconstruction is byte/semantic stable | Highest implementation and migration risk | Long-term target after dedicated tests |

## Recommendation

Adopt a ring of 12 in Phase 3B only after:

1. documenting “exact replay for the last 12 accepted operations”;
2. verifying the client keeps at most one unresolved request;
3. testing retries across restart, token expiry, delayed tab resume and finalize;
4. confirming measured worst-case rows remain at or below 32 KiB.

Then prototype option C separately. A compact record should retain idempotency key, request digest, status, resulting revision, original token, response kind, authoritative delta/offer and the smallest historical public-state representation needed to reconstruct the response. It must not regenerate a token with a new timestamp or use the latest state. Do not choose C until golden replay tests prove exactness.

There is no critical correctness defect in the current ring. Its cost is storage/write amplification, so Phase 3A leaves `RECENT_OPS_LIMIT = 24` and the D1 schema unchanged.
