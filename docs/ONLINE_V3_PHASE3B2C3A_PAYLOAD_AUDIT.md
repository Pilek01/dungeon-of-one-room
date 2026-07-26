# Online v3 Phase 3B2C3A payload and `recent_ops` audit

Scope: measurement only. Phase 3B2C3A does not modify the D1 schema, `recent_ops_json`, its ring limit, response storage, endpoints, or HTTP contracts.

## Measured UTF-8 JSON payloads

| Response | Bytes |
|---|---:|
| legal canonical relic fallback | 284 B |
| legal `NO_REWARD` | 248 B |
| pending replacement with 8 choices | 1,896 B |
| maximum complete replacement projection | 14,484 B |

The 14,484 B case is the existing 10-slot composite Abyssal replacement projection. Phase 3B2C3A retains every legal candidate and does not truncate the response.

## Hypothetical `recent_ops_json`

Using the measured 14,484 B response in every operation and the current-style minimal wrapper containing a 64-character idempotency key, a 64-character request digest, and `responseBody`:

| Ring entries | Serialized bytes |
|---:|---:|
| 12 | 176,029 B |
| 24 | 352,057 B |

These figures intentionally isolate the large response effect. A real operation may be larger after adding other persisted fields.

## Recommendation for a future dedicated phase

- Use a ring of 12 only after the retry-window contract is explicitly changed and restart/delayed-retry tests prove it.
- Enforce a per-response limit, but keep the current 14,484 B replacement response legal until a compact representation is available; truncating legal replacement choices would change gameplay.
- Do not store complete replacement projections in every recent operation. Store a compact deterministic result reference: transaction ID, resulting revision/digest, response kind, candidate-set digest, and the minimum immutable source binding.
- Reconstruct the public replacement projection deterministically from canonical historical transaction data. Do not reconstruct from the latest build or regenerate opaque IDs.
- Preserve the full response only when deterministic reconstruction cannot reproduce exact retry semantics.

No optimization is implemented in Phase 3B2C3A.
