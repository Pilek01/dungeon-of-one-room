# Online v3 R2 Remediation Review

Status: `READY_FOR_M5_PLANNING`. This is not production approval.

## Finding disposition

| Finding | Status | R2 result or gate |
|---|---|---|
| R1-P0-001 combat proof boundary | `ACCEPTED_PRODUCT_LIMITATION` | Meta-progression remains authoritative; local combat is not proven and the boundary did not expand. |
| R1-P1-001 Camp lifecycle | `FIXED` | Extraction-only canonical profile Camp; ordinary rooms rejected; next run hydrates profile. |
| R1-P1-002 secure resume | `FIXED` | Independent recovery credential/verifier and state-correct token refresh. |
| R1-P1-003 Return to Practice | `FIXED` | Recovery is preserved; abandonment is explicit and acknowledged. |
| R1-P1-004 concurrent tabs/input | `FIXED` | Single-writer lease, mutation lock, takeover, and canonical resync. |
| R1-P1-005 write abuse/retention | `FIXED` | Cleanup, two-active-run cap, production abuse-control gate, safe metrics. |
| R1-P2-001 Practice recovery read | `FIXED` | Ranked recovery is read only on Ranked entry; Practice startup/simulation remains independent. |
| R1-P2-002 cursor integrity semantics | `FIXED` | Documented versioned public seek tuple; strict 400 on malformed input. |
| R1-P2-003 schema strictness | `FIXED` | Versioned strict mutation fields and nested fail-closed response validation. |
| R1-P2-004 unreachable recovery/proof modules | `FIXED` | Legal reconnect/protocol flows; inactive proof helpers marked test/spec-only. |
| R1-P2-005 deployment/availability | `DEFERRED_TO_M5` | Availability descriptor exists; production stays gated pending real resources, abuse control, alerts, soak, and rollback. |
| R1-P2-006 documentation drift | `FIXED` | R2, protocol, architecture, review, handoff, and current-task documents match HEAD. |
| R1-P3-001 leaderboard index tie-break | `DEFERRED_TO_M5` | Decide and migrate the production index before public scale; correctness already uses the full seek tuple. |
| R1-P3-002 confusing Unicode names | `DEFERRED_TO_M5` | Decide normalization/display policy before public launch; rendering remains text-only. |

There are no `OPEN_BLOCKER` findings and no unaccepted P0 or remaining P1.

## Threat-matrix rerun

All 30 R1 scenarios are registered in the executable R2 rerun and their
referenced evidence runs in `verify:phase`.

| Scenarios | Final result |
|---|---|
| 1, 4, 5, 6 | `ACCEPTED_PRODUCT_LIMITATION` — a modified client can fabricate plausible local completion, while direct canonical field manipulation remains rejected. |
| 2–3, 7–30 | `FIXED` — active unit/property/Worker/browser or Wrangler/D1 evidence is present. |

The rerun confirms:

- direct score, gold, depth, lives, outcome, build, directive, and token
  substitutions do not become canonical;
- reward, Merchant, Forge, replacement, fallback, checkpoint, start, and
  finalization duplication remains at-most-once;
- two starting choices/finalizers produce one canonical winner;
- response loss and Worker restart recover exact persisted outcomes;
- recovery requires the independent credential;
- malformed cursors and unknown/malformed projections fail closed;
- no new per-turn networking, server combat simulation, or gameplay difference
  was introduced.

## Verification evidence

- R2.7 phase: 702/702 unit, fixture, property, and regression tests;
- real Wrangler/D1: 12 lifecycle scenarios plus one D1 atomicity scenario;
- headed browser: lifecycle, lost response, reload recovery, multi-tab
  takeover, extraction-to-Camp, and next-run profile hydration;
- protected baseline: 3/3 plus headed Practice/Ranked smoke;
- final gates: `verify:phase` 702/702, `verify:baseline` 3/3 plus headed
  smoke, and `verify:full` 726/726.

## Release decision

R2 supports `READY_FOR_M5_PLANNING` only. M5 must keep production activation
fail-closed until every deferred item above has its explicit staging,
observability, abuse-control, migration, and rollback gate satisfied.
