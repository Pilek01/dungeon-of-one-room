# Online v3 R1 — Full Architecture & Security Review

## 1. Executive summary

Review objął cały aktywny system Online v3 na commicie
`3991c153711530c63a2b47974fb663db514a3147`, a nie tylko ostatni commit.
Kod produkcyjny, klient, gra, Worker, D1, testy i konfiguracja nie zostały
zmienione.

**Final verdict: REJECT_FOR_M5**

Liczba findings:

| Severity | Count |
| --- | ---: |
| P0 | 1 |
| P1 | 5 |
| P2 | 6 |
| P3 | 2 |

Najważniejszy pozytywny wynik: canonical meta-state jest konsekwentnie
utrzymywany po stronie Workera/rulesetu, tokeny są silnie związane z runem,
rulesetem, revision, digestem i rodzajem granicy, a D1 chroni mutacje
warunkowym update oraz atomowym finalization batch. Exact retry, conflicting
retry, restart i rollback mają szerokie testy, w tym realny Wrangler/D1.

Najważniejsza blokada: publiczny wynik nadal można uzyskać bez rozegrania
walki. Worker uznaje lokalne `local-room-completed`, przyjmuje ograniczone
client-attested reward claims, a następnie publikuje wynik jako
`checkpoint_verified_v3`. Jest to jawnie udokumentowane ograniczenie
checkpoint-authoritative meta-progression, nie ukryty błąd implementacyjny.
Pozostaje jednak P0 dla publicznego Ranked leaderboardu: zmodyfikowany klient
może przejść do głębi 100, victory i wysokiego canonical score bez
wiarygodnego dowodu walki.

M5 staging/release nie powinien się rozpocząć równolegle z naprawami. Dozwolone
jest wyłącznie równoległe, lokalne przygotowanie remediation i projektu
deploymentu. Publiczny lub współdzielony staging Ranked powinien poczekać na
zamknięcie P0/P1 albo być ściśle prywatnym testem technicznym bez traktowania
leaderboardu jako wiarygodnego.

## 2. Reviewed commit and scope

- Branch: `main`.
- HEAD: `3991c153711530c63a2b47974fb663db514a3147`.
- Ruleset: `v08-meta-1`.
- Ruleset hash:
  `sha256:d1f28d957244002da574180c5c9a7040d4d18deba1551a24e6597712d971b231`.
- Ruleset release state: local release candidate, dozwolony tylko w `test` i
  `local`; produkcyjny entrypoint nie ma aktywnego realnego rulesetu.
- Objęte: Worker, D1, registry, HTTP, tokens, compact `recent_ops`, bootstrap,
  room checkpoints, offers, meta-transactions, lives, extraction,
  finalization, leaderboard, browser client, Ranked session/recovery, wszystkie
  siedem pierwotnych hook sites w `game.js`, późniejsze terminal hooks,
  headed/baseline/Worker/D1 tests i deployment boundaries.
- Nie oceniano estetyki gry ani mechaniki v0.8 poza granicą Online v3.

Stan wejściowy chronionego WIP:

- 172 unstaged deletions Vault Guardian;
- staged protected paths: 0;
- working-tree delta poza chronionym WIP: 0;
- zapisany fingerprint:
  `88694fd9f7df0b6895440856a7b03b5a198a949e9dc541526d15f3796b7ad616`.

## 3. Architecture map

```text
v0.8 browser simulation
  └─ seven conditional game.js hook sites + frozen bridge
       └─ ranked-v3-runtime.js (UI/orchestration/state machine)
            ├─ ranked-v3-client.js (pending operation + local recovery)
            │    └─ ranked-v3-transport.js (HTTP, timeout, exact retry ID)
            └─ leaderboard client/UI
                  │
                  ▼
              Worker src/index.js
                ├─ HTTP parsing/error mapping
                ├─ token verification + idempotent replay lookup
                ├─ ruleset registry/release gate
                ├─ pure ruleset/domain transition
                └─ conditional D1 repository write
                       ├─ ranked_runs
                       └─ leaderboard_entries
```

Separation of concerns is generally sound:

- Worker routing does not compute Merchant/Forge/Crossroads/Camp/Pact prices or
  results; it delegates to the selected ruleset.
- Ruleset modules own canonical gold/build/lives/outcome/score transitions.
- D1 repositories own SQL and conditional persistence.
- Browser transport has no domain authority.
- The fixture ruleset and real registered runtime have explicit separate
  entrypoints.

No import-time mutation of run state was found in Worker/ruleset modules.
Module-level maps are immutable catalog indexes. No active circular dependency
was identified by source inspection. The broadest modules are
`src/index.js` (routing, validation, token/replay orchestration and persistence)
and `ranked-v3-runtime.js` (all browser orchestration and UI flow); this is
maintainability debt, not by itself a security defect.

Duplicated boundaries:

- legacy fixture token/runtime paths coexist with registered real ruleset paths
  in `src/index.js`;
- browser has partial response/state projection validation separate from
  server validation;
- unused browser recorder/checkpoint modules define command limits and proof
  shapes that are not the active M4 request path.

### Seven original `game.js` hook sites

| # | Location | Responsibility | Practice behavior | Ranked behavior | Network boundary | Risk |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | `game.js:4745-4748`, `saveRunSnapshot` | Save ownership | Existing Practice save is written | Ranked run save is suppressed | None | Low; branch is narrow |
| 2 | `game.js:12715-12717`, standard room builder | Room type source | `chooseRoomType()` unchanged | Uses canonical directive room type | None | Medium; local contents remain locally generated |
| 3 | `game.js:13067-13069`, boss builder | Boss/final type source | Existing boss type | Uses canonical `boss`/`final` directive type | None | Low |
| 4 | `game.js:13746-13774`, `buildRoom` | Depth, room index, category | Existing depth/category logic | Binds directive depth/index/category | None | Medium; directive seed is not applied to local generation |
| 5 | `game.js:14092-14098`, run initialization | Persistent Practice meta | Existing Camp upgrades, mutators and pacts | Does not import local persistent meta | None | Low and correctly isolated |
| 6 | `game.js:15652-15662`, room clear | Reward/checkpoint boundary | Existing local rewards and progression | Stops local reward path and notifies runtime | Callback later performs HTTP | High; local clear occurrence is trusted |
| 7 | `game.js:20494-20507`, portal entry | Next-room gate | Existing local depth increment | Requires acknowledged next directive | None at entry | Low; fail-closed gate |

Later terminal integration adds conditional fatal/extraction callbacks at
`game.js:14265-14272` and `game.js:14410-14412`, plus the frozen bridge at
`game.js:32779-32843`. All are inactive when `state.onlineV3Ranked` is false.

## 4. Canonical lifecycle map

### Server lifecycle

```text
start
  -> awaiting_starting_relic + run_bootstrap token
  -> select_starting_relic
  -> active + room directive/reward envelope + room_checkpoint token
  -> zero or more event transitions at the same canonical room boundary
     (offer, purchase, replacement, fallback, fatal event, extraction)
  -> checkpoint consumes the current room once
  -> active with next directive, or victory/defeat/extraction
  -> terminal run + run_terminal token
  -> finalize
  -> finalized run + exactly one leaderboard row
```

Every successful mutation increments revision except idempotent no-op returns
where the ruleset deliberately returns the same state. Persistence requires
the previously loaded revision, status and state digest. A post-finalization
event/checkpoint/finalize cannot satisfy the expected status/revision.

### Browser lifecycle

```text
IDLE
 -> STARTING_RUN
 -> AWAITING_STARTING_RELIC
 -> ENTERING_ROOM
 -> ROOM_ACTIVE
 -> RESOLVING_ROOM / AWAITING_REWARD_OR_TRANSACTION
 -> ENTERING_NEXT_ROOM -> ROOM_ACTIVE
 -> TERMINAL_PENDING
 -> FINALIZING
 -> FINALIZED
```

Auxiliary states are `RETRYING`, `RECONNECT_REQUIRED`,
`UNRECOVERABLE_PROTOCOL_ERROR` and `ABANDONED_LOCAL_SESSION`.
`RECONNECT_REQUIRED` and `UNRECOVERABLE_PROTOCOL_ERROR` exist in the table but
the active error presenter does not transition into them. Consequently the
only legal transitions to `ABANDONED_LOCAL_SESSION` are not reached by normal
errors; this causes R1-P1-003.

Offer/replacement/fallback safety:

- one pending server offer/inventory/replacement is bound to run, ruleset,
  revision, directive/source and canonical state/build digest;
- exact retry reconstructs the original historical public projection and
  token;
- another choice with the same transaction/operation identity conflicts;
- no-reward and fallback receipts are bounded;
- replacement is immutable and atomic;
- the browser cannot continue to the next room until the Worker acknowledges
  checkpoint and issues the next directive.

Impossible or practically unrecoverable client states:

- current token expired with no pending operation;
- local recovery record deleted or corrupted;
- same run opened on another device without a transferable recovery
  credential;
- stale pending request after another tab has committed a newer revision;
- selecting “Return to Practice” from a normal error state;
- acknowledged response followed by a local adapter/projection exception,
  because there is no server read/resume path and the pending operation has
  already been cleared.

## 5. Trust boundaries

Trusted:

- Worker code and configured ruleset registry;
- `RANKED_V3_HMAC_SECRET` Worker secret;
- D1 canonical state and stored compact operation history;
- server-created RNG purposes, offer IDs, transaction IDs, directives,
  nonces, prices, costs, build transitions, lives, outcome and score.

Untrusted:

- browser storage, UI state and all HTTP request fields;
- player name and install hash;
- choice IDs until matched against a current canonical offer;
- room completion occurrence;
- command journal/turn/elapsed telemetry;
- bounded enemy, elite, hazard and chest reward claims;
- fatal-event and extraction requests.

The Worker does not trust direct client gold/build/lives/score/outcome/depth,
prices, target relics or RNG results. It does, by design, trust a bounded
attestation that a locally simulated room was completed and may award bounded
client-attested gold. That distinction is the central release boundary.

Token boundary:

- HMAC-SHA-256 uses WebCrypto signing and verification;
- secret must contain at least 32 UTF-8 bytes;
- canonical JSON and exact field sets prevent alternate serialization;
- token kind/version, run, ruleset ID/hash, revision, state digest,
  directive/nonce or bootstrap offer/nonce are checked;
- expired tokens are decoded/verified before replay lookup so an exact lost
  response can still be replayed; a new mutation with an expired token is
  rejected;
- tokens are body-only, never URL parameters, and client diagnostics redact
  keys matching token/authorization/digest.

## 6. Endpoint and token matrix

| Endpoint | Input authority | Token | Idempotency | Mutation/result | Review |
| --- | --- | --- | --- | --- | --- |
| `POST /api/v3/runs/start` | name, season, version, exact ruleset ID/hash, install hash | none | globally unique start key + request digest | Creates awaiting-bootstrap run | Canonical, but public write surface has no abuse control |
| `POST /api/v3/runs/event` starting relic | opaque offer/choice | `run_bootstrap` | per-run compact history | Selects once, issues first directive | Strong binding and real concurrency test |
| `POST /api/v3/runs/event` room/meta | event type plus exact opaque payload | `room_checkpoint` | per-run compact history | Offers, purchases, replacement, fallback, fatal/extract | Domain delegated to ruleset; top-level unknown fields are inconsistently tolerated |
| `POST /api/v3/runs/checkpoint` | local clear attestation, telemetry, bounded claims | `room_checkpoint` | per-run compact history | Consumes room, awards canonical/bounded rewards, issues next/terminal | Atomic but not proof of combat |
| `POST /api/v3/runs/finalize` | only run ID and token | `run_terminal` | per-run compact history | Finalized run + leaderboard row in one batch | Strong, exactly-once |
| `GET /api/v3/leaderboard` | season, limit, cursor | none | n/a | Public compact rows | Keyset ordered; cursor is unsigned |
| `GET /api/v3/leaderboard/:runId` | canonical run ID | none | n/a | Public build/summary | Text-safe client rendering |
| Health/availability | absent | n/a | n/a | none | Deployment prerequisite, not current production bug |
| Read/resume run | absent | n/a | n/a | none | Required before public release |

Protocol observations:

- operation ID remains stable through automatic and user-triggered retry;
- request digest covers method, path and validated body;
- exact retry returns original status/body/token and marks replay;
- conflicting payload returns 409;
- stale revision/digest/directive/nonce fails closed;
- request reader requires JSON and enforces 64 KiB by declared and streamed
  byte count;
- finalization and bootstrap selection reject unknown fields, while start and
  ordinary room envelopes ignore or carry some unknown top-level fields;
- there is one hard-coded protocol/ruleset version in the client and no
  negotiated supported-version response. This is acceptable for local M4 but
  must be planned before a rolling deployment.

## 7. Recovery matrix

| Scenario | Current behavior | Verdict |
| --- | --- | --- |
| Reload after acknowledged bootstrap | Public offer + bootstrap token in namespaced localStorage | Recoverable on same origin/browser while data remains valid |
| Reload with pending start | Exact body and operation ID replayed | Recoverable |
| Reload with pending event/checkpoint/finalize | Exact body, token and operation ID replayed | Recoverable, including expired token if operation already committed and remains in history |
| Reload in acknowledged active room | Rebuilds presentation from saved public directive | Recoverable only with valid current token |
| Reload during reward/transaction/replacement | Saved public projection and token reopen UI | Recoverable on the tested same-browser boundary |
| Reload before finalize | Terminal projection and token redisplay Finalize | Recoverable while token is valid |
| Lost finalize response after commit | Transport/client exact retry returns stored result | Recoverable and tested against real D1 |
| Worker restart | Stateless Worker reloads run and recent ops from D1 | Recoverable with same HMAC secret |
| Current token expires before a new operation | New mutation returns `TOKEN_EXPIRED` | Unrecoverable; no refresh/resume endpoint |
| localStorage cleared/corrupt | No credential or state; corrupt record deserializes to null | Existing server run is stranded |
| Incognito/private window closed | Local recovery disappears | Existing server run is stranded |
| Different browser/device | No credential transfer/account binding | Existing server run is stranded |
| Multiple tabs | Independent in-memory snapshots share one storage key | Race can leave a stale pending record and conflict loop |
| Acknowledged response then local projection/bridge exception | Pending is already cleared | No canonical re-read path |

### Minimal required resume design

A resume route is required. It must not authorize by `runId`,
`clientInstallIdHash` or player name alone.

Minimal contract direction:

- `POST /api/v3/runs/resume`, not a credential in the URL;
- request: `runId`, opaque high-entropy recovery credential, client protocol
  version and optional last-known revision;
- credential: independent from the short-lived boundary token, issued at
  start, scoped to run/ruleset, rotatable/revocable, and stored server-side as
  a verifier/hash or represented by a purpose-specific signed token;
- response: only current public meta projection, status/revision, current
  public offer/replacement data, and a freshly issued boundary token of the
  correct kind;
- never return canonical private state, private offer payloads, recent ops,
  raw journal, HMAC secret or another client identity;
- same-browser installation hash may be an additional signal, not the secret;
- cross-device recovery requires an authenticated account or an explicit
  transferable recovery code. Run ID alone would permit run takeover.

## 8. Threat-scenario matrix

| # | Attempt | Expected protection | Actual protection and evidence | Test coverage | Status |
| ---: | --- | --- | --- | --- | --- |
| 1 | Change gold in payload | Client cannot set canonical gold | Direct fields are ignored/rejected and prices are server-derived; however valid-shaped bounded reward claims influence canonical gold (`reward-policy.js:384-460`) | anti-tamper, reward golden/property | DESIGN_LIMITATION |
| 2 | Change build | Only opaque current choice can mutate build | Exact payload/offer/build digest validation; no direct build field authority | anti-tamper, M1/3B2 properties | PASS |
| 3 | Change lives | Server life ledger only | Fatal-event classification is exact and server derives prevention/loss; direct lives has no authority | M3 life tests, real runtime | PASS |
| 4 | Change score | Finalize derives score | Finalize accepts only run ID/token; indirect fake clears can still produce canonical score | M3 score/finalize tests | DESIGN_LIMITATION |
| 5 | Change outcome | Terminal eligibility is server state | Direct outcome rejected; fake local clears can indirectly reach victory | M3 outcome/finalize tests | DESIGN_LIMITATION |
| 6 | Change depth | Directive scheduler owns depth | Direct depth has no effect; fake checkpoints advance canonical scheduler | room property tests | DESIGN_LIMITATION |
| 7 | Change directive ID | Exact current directive required | Request, token, state and reward envelope are cross-checked | HTTP/anti-tamper tests | PASS |
| 8 | Change room nonce | Exact nonce required | Token and state nonce must match | token/HTTP tests | PASS |
| 9 | Change ruleset hash | Exact registry/hash binding | Start resolves exact ID/hash; token/state mutations preserve it | registry/token tests | PASS |
| 10 | Token from another run | Run-bound bearer token | Decoded run must equal body and stored run; HMAC verified | token and real E2E | PASS |
| 11 | Wrong token kind | Kind separation | v2 exact field/kind schema and expected boundary kind | M2B token tests | PASS |
| 12 | Old token | Stale non-replay rejected | Replay lookup permits only exact stored request; otherwise revision/digest/expiry reject | revision/token tests | PASS |
| 13 | Replay old checkpoint | At-most-once room | Exact key/body returns history; different key with stale token conflicts | network-loss/revision tests | PASS |
| 14 | Replay Merchant purchase | At-most-once debit/item | Transaction receipt + HTTP idempotency + conditional revision | M1 Merchant and real concurrent E2E | PASS |
| 15 | Replay Forge | At-most-once temper/transmute | Same shared transaction core and receipt binding | M1 Forge property/retry tests | PASS |
| 16 | Replay replacement | At-most-once build change | Pending transaction/receipt and immutable commit | 3B2C2 golden/property | PASS |
| 17 | Replay fallback | At-most-once slot/gold | Slot consumption + fallback receipt + idempotency | 3B2C3A tests | PASS |
| 18 | Replay finalize | One row/result | Stored exact response; finalized status blocks new finalize | network-loss/finalization tests | PASS |
| 19 | Two concurrent finalize | One D1 winner | Conditional update and insert batch; loser 409 | real Wrangler/D1 concurrency | PASS |
| 20 | Two concurrent starting choices | One directive/build | Conditional revision; one 200, one 409 | real ruleset E2E | PASS |
| 21 | Reuse operation ID with other payload | Reject conflict | Canonical request digest mismatch -> 409 | idempotency tests | PASS |
| 22 | Reuse operation ID in another run | No cross-run effect | Mutation history is run-scoped and token/run bound; reuse is allowed but isolated | run-binding tests; no dedicated cross-run ID test | PASS |
| 23 | Lose response after commit | Exact response replay | Pending request retained until validation; Worker stores response history in same write | network-loss unit/E2E/headed finalize | PASS |
| 24 | Reload before acknowledgement | Replay same operation | Pending request is written before fetch | M4 client and headed reload/loss | PASS |
| 25 | Delete local session | Secure recovery without takeover | No backend resume or independent credential | Documented M4 limit; no positive test possible | DESIGN_LIMITATION |
| 26 | Tamper leaderboard cursor | Reject or safely constrain cursor | Decoded fields are bounded and SQL-bound, but unsigned values can seek arbitrary positions; invalid cursor silently becomes first page | ordering/pagination tests, no tamper semantics test | GAP |
| 27 | XSS through display fields | Text-only rendering | `textContent`/created elements; no `innerHTML` in Ranked UI | dedicated M4 text-safety test | PASS |
| 28 | Oversized JSON | Bound before parse/domain | Content-Length and streamed count enforce 64 KiB | request/payload tests | PASS |
| 29 | Unknown response kind/state | Fail closed | Client rejects unknown status/missing token/ruleset; UX becomes generic error | protocol unit tests | PASS |
| 30 | Worker restart between write/response | Persisted exact replay | D1 write/history is durable; stateless Worker with same secret reconstructs response | real restart and controlled response-loss E2E | PASS |

## 9. Findings P0/P1/P2/P3

### R1-P0-001 — public Ranked results do not prove gameplay

- Severity: **P0**
- Confidence: **high**
- Title: Local room-clear and bounded reward attestations permit trivial
  leaderboard farming.
- Affected files/symbols:
  `src/domain/ruleset-runtime.js:applyRulesetCheckpoint`,
  `src/rulesets/v08-meta-1/reward-policy.js:settleRoomRewardEnvelopeV3`,
  `src/rulesets/v08-meta-1/room-policy.js:consumeRoomDirectiveV08`,
  `src/rulesets/v08-meta-1/meta-state.js:verificationLevel`,
  `scripts/online-v3-ranked-headed.mjs:354-359`.
- Evidence: Worker creates `completionAttestation: "local-room-completed"` from
  receipt of the request, not from a verifiable simulation. Reward claims
  accept bounded client evidence and can credit gold. The headed test advances
  by calling `DungeonOnlineV3.onLocalRoomCleared` directly with empty commands.
  Architecture documentation explicitly states that a modified client can
  fabricate a plausible journal and combat outcome.
- Attack/failure scenario: modified client repeatedly submits valid current
  tokens/directive IDs/nonces with empty or fabricated local proof and maximum
  legal reward claims, reaches final depth, claims victory and publishes a
  canonical high score without playing.
- Impact: competitive integrity of score, depth, outcome and leaderboard is
  absent even though all stored values are internally canonical.
- Existing protection: server controls schedule, offers, caps, gold formulas,
  build, lives, outcome transition and score formula; claims are bounded and
  anomaly flags are recorded.
- Missing protection: authoritative or independently verifiable room
  simulation/proof, or a release model that explicitly treats results as
  untrusted/noncompetitive and does not publish them as Ranked.
- Test coverage: tests confirm bounds and determinism, but the headed test also
  demonstrates that no combat proof is required. Anomaly score does not block
  finalization/publication.
- Minimal remediation direction: before public Ranked, either implement a
  server-authoritative/verifiable combat boundary, or change product/release
  semantics so this is not a competitive leaderboard and clearly label the
  trust level. Do not attempt to solve this with more client-side checks.
- Release recommendation: **block M5 staging/release of public Ranked**.

### R1-P1-001 — Camp is exposed at the wrong lifecycle boundary

- Severity: **P1**
- Confidence: **high**
- Title: M4 offers Camp after ordinary room clears although v0.8 enters Camp
  from extraction.
- Affected files/symbols:
  `ranked-v3-runtime.js:onLocalRoomCleared/openCamp`,
  `camp-policy.js:beginCampSessionV08`,
  `outcome-policy.js:requestExtractionV08`,
  `docs/ONLINE_V3_META_TRANSACTIONS.md:129-158`.
- Evidence: every ordinary clear presents “Visit Camp”; server
  `beginCampSessionV08` checks only pending inventory/session, not extraction
  or terminal eligibility. Source audit binds Camp entry to
  `game.js:enterCampFromExtract`. Extraction credits camp gold only after the
  run becomes terminal, when further event mutations are forbidden. A new run
  always starts with `campGold: 0` and there is no authenticated cross-run
  profile load.
- Attack/failure scenario: player sells a relic and performs Camp upgrades
  mid-run before checkpoint, or extracted camp gold becomes an inert terminal
  summary rather than persistent Camp progression.
- Impact: canonical build can diverge from active v0.8 lifecycle; Camp is not
  functionally integrated as the audited baseline system.
- Existing protection: all Camp prices, targets, balances and commits are
  server-derived and atomic.
- Missing protection: canonical Camp availability/source binding and a
  designed cross-run/profile persistence boundary.
- Test coverage: M1 tests cover Camp transaction correctness in isolation;
  M4 headed path does not exercise Camp availability or persistence.
- Minimal remediation direction: define the authenticated persistent meta
  owner and exact extraction-to-Camp lifecycle, then make Camp issuance require
  that canonical source. Remove the convenient per-room entry.
- Release recommendation: close before staging.

### R1-P1-002 — no secure resume/refresh path

- Severity: **P1**
- Confidence: **high**
- Title: Loss of local storage or expiration of the current 15-minute token
  permanently strands an otherwise valid server run.
- Affected files/symbols: `src/config.js:TOKEN_TTL_MS`,
  `src/index.js:createWorker`, `ranked-v3-storage.js`,
  `ranked-v3-runtime.js:resumeRanked`, `docs/ONLINE_V3_M4.md:107-120`.
- Evidence: only six active routes exist and none reads/resumes a run. Recovery
  requires the local public projection and boundary token. New mutations reject
  expired tokens. `deserialize` returns null for corrupt data.
- Attack/failure scenario: player pauses longer than token TTL, clears site
  data, closes an incognito window, changes device, or loses the local record
  after a server commit.
- Impact: ordinary reconnect/data-loss scenarios cause permanent loss of the
  run despite intact canonical D1 state.
- Existing protection: exact pending operations can replay after response loss,
  and Worker restart is safe.
- Missing protection: independent recovery credential and current-state resume
  route with token refresh.
- Test coverage: one same-browser reload and one lost finalize response; no
  token-expiry, cleared-storage, corrupt-storage or cross-device recovery.
- Minimal remediation direction: add the purpose-specific authenticated resume
  contract described in section 7; never resume by run ID alone.
- Release recommendation: close before staging/public release.

### R1-P1-003 — “Return to Practice” clears recovery before an illegal transition

- Severity: **P1**
- Confidence: **high**
- Title: Error escape can delete the only credential and then throw.
- Affected files/symbols: `ranked-v3-runtime.js:presentError/abandon`,
  `ranked-v3-session.js:TRANSITIONS`.
- Evidence: `abandon()` calls `client.clear()` before transitioning to
  `ABANDONED_LOCAL_SESSION`. That transition is legal only from
  `RECONNECT_REQUIRED` or `UNRECOVERABLE_PROTOCOL_ERROR`, but `presentError`
  never enters either state. A direct state-machine check produces
  `RANKED_STATE_TRANSITION_INVALID:STARTING_RUN:ABANDONED_LOCAL_SESSION`.
- Attack/failure scenario: any start, offer, checkpoint or finalize error;
  player selects “Return to Practice”.
- Impact: local recovery is erased, UI handler throws, and server run becomes
  unrecoverable because R1-P1-002 exists.
- Existing protection: transition table is fail-closed.
- Missing protection: legal error-state transition and clear-after-success
  ordering.
- Test coverage: state-machine legal paths exist, but no test clicks the error
  escape action from real error states.
- Minimal remediation direction: classify error into reconnect/protocol state,
  transition first, and only then clear after explicit confirmation.
- Release recommendation: close before staging.

### R1-P1-004 — concurrent input/tabs can poison the shared recovery record

- Severity: **P1**
- Confidence: **high**
- Title: independent in-memory clients overwrite one localStorage session and
  have no canonical resynchronization path.
- Affected files/symbols: `ranked-v3-client.js:createRankedClient/execute`,
  `ranked-v3-storage.js:STORAGE_KEYS.session`,
  `ranked-v3-ui.js:showChoices`, `ranked-v3-runtime.js:presentError`.
- Evidence: each tab loads one snapshot once; every request writes
  `pendingOperation` to the same key before fetch. There is no storage event,
  BroadcastChannel, tab lease or server read. Each choice button is one-shot
  individually, so two different choices can be submitted concurrently.
- Attack/failure scenario: tab A commits revision N+1; tab B writes a stale
  pending operation and receives 409. On reload the stale request is retried
  forever. A fast double-choice can similarly leave a generic conflict UI with
  no useful pending action.
- Impact: canonical D1 remains safe, but client recovery and UX can dead-end a
  real run.
- Existing protection: D1 conditional update ensures only one canonical
  winner.
- Missing protection: single-tab ownership/global input lock plus authenticated
  canonical resync after conflict.
- Test coverage: server concurrency is strong; browser tests do not cover two
  tabs, different simultaneous choices or stale localStorage overwrite.
- Minimal remediation direction: establish a per-run browser lease/coordination
  channel, disable the full choice set while one mutation is pending, and use
  resume/resync for 409 recovery.
- Release recommendation: close before staging.

### R1-P1-005 — unbounded unauthenticated write surface and no run retention

- Severity: **P1**
- Confidence: **high**
- Title: public start can create unlimited durable run rows without rate,
  quota or cleanup policy.
- Affected files/symbols: `src/index.js:handleRegisteredStart`,
  `src/storage/d1-runs.js:insert`, `migrations/0001_initial.sql`,
  `wrangler.toml`.
- Evidence: start has no authentication/attestation/rate limiter; install hash
  is client-supplied. `expires_at` is stored but never enforced by a cleanup
  query or scheduled process. Leaderboard reads are also public, though
  indexed and paginated.
- Attack/failure scenario: automated clients create unique operation IDs and
  continuously start abandoned runs, consuming D1 storage and writes.
- Impact: resource/cost exhaustion and operational instability before gameplay
  security is considered.
- Existing protection: request size, strict field lengths, D1 uniqueness and
  production ruleset gate.
- Missing protection: edge rate limiting/abuse control, per-principal quota,
  retention/cleanup and capacity monitoring.
- Test coverage: payload bounds and start concurrency are tested; abuse volume
  and retention are not.
- Minimal remediation direction: define access/rate policy outside domain
  logic, add scheduled retention for expired non-finalized runs, and monitor
  storage/write budgets. Do not treat client install hash as authentication.
- Release recommendation: required before any public/shared staging.

### R1-P2-001 — Practice host reads Ranked recovery metadata

- Severity: **P2**
- Confidence: **high**
- Title: strict “Practice does not read Ranked session record” invariant is not
  literally true.
- Affected files/symbols: `ranked-v3-runtime.js:25-26`.
- Evidence: runtime is loaded on every page and calls
  `recoveryStore.loadSession()` at boot to label the entry button.
- Attack/failure scenario: corrupted/stale Ranked metadata changes the menu
  affordance while the player otherwise uses Practice.
- Impact: separation is weaker than the requested mechanical invariant, but
  Practice simulation/save/rewards remain unaffected and no API call occurs.
- Existing protection: namespaced key, no transport creation until explicit
  Ranked/leaderboard action, all game branches check `onlineV3Ranked`.
- Missing protection: a mode-neutral availability layer or deferred read after
  explicit Ranked intent.
- Test coverage: baseline confirms zero `/api/v3` and Practice parity, not zero
  Ranked-storage reads.
- Minimal remediation direction: document the narrow menu-only read or defer it.
- Release recommendation: document/fix; not a release blocker alone.

### R1-P2-002 — leaderboard cursor is not authenticated

- Severity: **P2**
- Confidence: **high**
- Title: cursor is base64url JSON, not opaque in the integrity sense.
- Affected files/symbols: `domain/leaderboard-cursor.js`,
  `storage/d1-leaderboard.js:list`.
- Evidence: any safe integer score/time and any string run ID are accepted.
  Invalid data silently becomes no cursor.
- Attack/failure scenario: caller crafts a cursor to seek arbitrary positions
  or forces first-page repetition.
- Impact: no SQL injection or state mutation; pagination integrity and abuse
  behavior are caller-controlled.
- Existing protection: prepared statements, bounded limit and deterministic
  ordering.
- Missing protection: signed/versioned cursor or explicit 400 for malformed
  cursor.
- Test coverage: order/ties/no-duplicate normal pagination; no tamper matrix.
- Minimal remediation direction: sign a versioned cursor with a distinct
  purpose or formally document it as a client-controlled seek tuple.
- Release recommendation: fix or document before public API commitment.

### R1-P2-003 — inconsistent unknown-field and response-schema strictness

- Severity: **P2**
- Confidence: **high**
- Title: strict contracts vary by endpoint and browser validation is shallow.
- Affected files/symbols: `src/index.js:validateRegisteredStartBody`,
  `validateRegisteredRoomEnvelope`, `validateRegisteredFinalizeBody`,
  `ranked-v3-protocol.js:validateMetaState`.
- Evidence: bootstrap/finalize reject extra fields; start discards them;
  ordinary room envelopes spread them and domain ignores many top-level fields.
  Client validates only core meta fields before handing nested projections to
  adapters/game.
- Attack/failure scenario: rolling M5 client/server versions disagree on a
  nested projection; client acknowledges and stores it, then fails in the local
  adapter with no resync route.
- Impact: fail-closed but brittle upgrades and poor recovery.
- Existing protection: exact ruleset hash and unknown status/token failure.
- Missing protection: uniform schema/version policy and full public projection
  validation.
- Test coverage: core protocol mismatch tests; not every malformed nested
  projection.
- Minimal remediation direction: publish versioned schemas and decide uniform
  reject-vs-ignore semantics.
- Release recommendation: required protocol hardening before rolling release.

### R1-P2-004 — browser orchestration has unreachable recovery states and unused proof modules

- Severity: **P2**
- Confidence: **high**
- Title: implementation structure overstates active recovery/proof support.
- Affected files/symbols: `ranked-v3-runtime.js`,
  `ranked-v3-session.js`, `ranked-v3-recorder.js`,
  `ranked-v3-checkpoints.js`.
- Evidence: reconnect/protocol states are defined but not entered; active client
  sends `commands: []`; recorder/checkpoint modules are not wired into M4 and
  define different command bounds/shapes from Worker.
- Attack/failure scenario: maintainer assumes recorder proof or reconnect state
  is active and builds M5 behavior on a false boundary.
- Impact: maintenance and security-assurance risk, not direct state corruption.
- Existing protection: real runtime remains fail-closed and documented as
  checkpoint-authoritative only.
- Missing protection: one active contract and removal/quarantine of speculative
  modules.
- Test coverage: modules have unit coverage but active headed flow does not use
  them.
- Minimal remediation direction: explicitly mark test/spec-only modules or
  converge them with the active path after security design is decided.
- Release recommendation: clean up/document during remediation.

### R1-P2-005 — deployment/availability contract is intentionally incomplete

- Severity: **P2**
- Confidence: **high**
- Title: no production ruleset entry, route topology, CORS policy, health
  contract or staged observability budget exists.
- Affected files/symbols: `wrangler.toml`, `wrangler.local.jsonc`,
  `local-ruleset-entry.js`, `src/index.js`, browser `baseUrl`.
- Evidence: production main has no active ruleset registry; local entry is
  explicitly guarded and local-only. Client defaults to same-origin and Worker
  sends no CORS headers. There is no health route.
- Attack/failure scenario: M5 deploys the Worker on a different origin or
  activates a ruleset without a defined routing/access/monitoring plan.
- Impact: staging can fail operationally or accidentally widen exposure.
- Existing protection: production is currently safely fail-closed.
- Missing protection: explicit same-origin route or narrow CORS policy, staged
  release descriptor, secrets/rollback/observability plan and health signal.
- Test coverage: local config and real local Worker only.
- Minimal remediation direction: make these explicit M5 prerequisites without
  weakening the current production gate.
- Release recommendation: design before deployment; current state is safely
  inactive.

### R1-P2-006 — architecture/handoff documentation has release-relevant drift

- Severity: **P2**
- Confidence: **high**
- Title: older architecture statements no longer match HEAD.
- Affected files/symbols: `docs/ONLINE_V3_ARCHITECTURE.md`,
  lower historical sections of `ONLINE_V3_HANDOFF.md`.
- Evidence: architecture doc still says recent-op ring 24 while runtime uses
  12; lower handoff text describes pre-M4 endpoint/client integration state.
- Attack/failure scenario: M5 operator uses stale limits or assumes client is
  disconnected/connected at the wrong boundary.
- Impact: rollout and incident-response mistakes.
- Existing protection: M2/M3/M4 milestone docs and top handoff are current.
- Missing protection: one canonical current architecture/operations document.
- Test coverage: no documentation consistency test.
- Minimal remediation direction: after fixes, refresh the architecture and
  archive stale claims explicitly.
- Release recommendation: required documentation cleanup before release.

### R1-P3-001 — leaderboard index omits the final tie-break column

- Severity: **P3**
- Confidence: **medium**
- Title: query orders by `run_id` after indexed season/score/created time.
- Affected files/symbols: migration index
  `leaderboard_entries_season_score_created`,
  `d1-leaderboard.js:list`.
- Evidence: index columns stop at `created_at`; ordering and cursor include
  `run_id`.
- Attack/failure scenario: very large tie groups require an additional sort or
  table lookup.
- Impact: minor scale efficiency only; page limit is at most 50.
- Existing protection: keyset pagination and primary key.
- Missing protection: covering tie-break index if profiling proves necessary.
- Test coverage: tie order is tested.
- Minimal remediation direction: measure first; add migration only if query
  plan/latency warrants it.
- Release recommendation: optional.

### R1-P3-002 — public player names permit display-confusing Unicode

- Severity: **P3**
- Confidence: **medium**
- Title: length is bounded but controls/bidirectional characters are not
  normalized.
- Affected files/symbols: `src/index.js:validateStartBody`,
  leaderboard UI.
- Evidence: player name uses trimmed string length only.
- Attack/failure scenario: visually deceptive or blank-looking leaderboard
  names.
- Impact: moderation/readability issue; not XSS because rendering uses
  `textContent`.
- Existing protection: 18-character limit and text-safe rendering.
- Missing protection: public-name normalization/moderation policy.
- Test coverage: XSS-safe text rendering is tested.
- Minimal remediation direction: define allowed Unicode/control policy.
- Release recommendation: optional before public exposure.

## 10. Test-gap analysis

Verification results on reviewed HEAD:

| Command | Result |
| --- | --- |
| `npm run verify:phase` | PASS — 678/678, 0 fail, 0 skipped |
| `npm run verify:baseline` | PASS — 3/3 guard tests plus headed Practice and Ranked smoke |
| `npm run verify:full` | PASS — 700/700, including 19 real Wrangler/D1 E2E, baseline guard, headed Practice and headed Ranked |
| `git diff --check` | PASS |

Full logs:

- `output/verification/phase-20260727T143743243Z.log`
- `output/verification/baseline-20260727T143909852Z.log`
- `output/verification/full-20260727T144018401Z.log`

The suite explicitly reports at least 26,696 seeded property cases across meta
transactions, bootstrap, score/lives, room rewards, relic offers,
run-modifiers, replacement and fallback. Real local D1 evidence reports:

- concurrent checkpoint/reward/Merchant/finalize: one 200 and one 409;
- exact response-loss replay for start/checkpoint/event/finalize;
- same-secret restart accepted, other-secret restart rejected;
- 12 recent operations, 27,554 bytes in the fixture E2E;
- leaderboard list/detail bounded and one row per finalized run;
- headed Ranked: one lifecycle, one lost-finalize-response scenario, one reload,
  zero active-combat API requests.

Strong coverage:

- atomic D1 finalization and rollback of second-statement failure;
- real parallel conditional writes;
- token kind/run/ruleset/revision/digest/expiry;
- exact and conflicting idempotency;
- deterministic ruleset generation and restart;
- text-safe leaderboard rendering;
- Practice zero `/api/v3`;
- payload and projection size bounds.

Critical gaps:

- no adversarial proof that a room was played; current headed test bypasses
  gameplay by invoking the clear hook directly;
- no Camp lifecycle/source availability or cross-run persistence headed test;
- no click test for “Return to Practice” after error;
- no token-expiry recovery;
- no cleared/corrupt storage, incognito or device-change recovery;
- no multiple-tab/shared-storage or simultaneous distinct UI choice test;
- no browser coverage for every Merchant/Forge/Crossroads/Camp/Pact and
  replacement/fallback path;
- no public abuse/rate/retention test;
- no cursor tamper semantics test;
- fixture runtime remains useful for generic contracts but can mask real
  ruleset lifecycle gaps; real-ruleset HTTP tests reduce, but do not eliminate,
  that risk.

The network-loss headed test is valid: it calls `route.fetch()` so the Worker/D1
commit occurs, then aborts delivery; the retry uses the same operation ID and
the database contains exactly one leaderboard row.

## 11. Performance/D1 analysis

D1 correctness:

- one canonical `ranked_runs` row per run;
- one `leaderboard_entries` row per finalized run, keyed by run ID;
- ordinary mutation is one conditional `UPDATE` on run ID, revision, status
  and optional state digest;
- finalization uses `db.batch([update, insert])`; the insert is conditional on
  the immediately preceding update and finalized revision;
- real D1 tests demonstrate rollback on second-statement failure and no
  inconsistent intermediate state;
- all persistence is awaited;
- recent-op migration and compact history are written in the same run update.

The Cloudflare D1 batch contract is relied upon for transactional rollback; the
implementation and test behavior are consistent with the official
[`D1Database.batch()` documentation](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).
Production planning should continue to check current
[`D1 limits`](https://developers.cloudflare.com/d1/platform/limits/) and keep
the HMAC value in
[`Workers secrets`](https://developers.cloudflare.com/workers/configuration/secrets/),
not plaintext variables.

Bounded hot paths:

- request body: 64 KiB;
- recent-op ring: 12;
- leaderboard page: 50 maximum, client requests 20;
- public replacement projection measured at 14,484 bytes;
- keyset pagination avoids offset scans;
- digest/clone/patch reconstruction is O(12 × bounded projection size);
- catalog lookups use module-level maps;
- canonical state and history are rewritten per mutation, which is acceptable
  at current bounds but creates write amplification.

No pre-M5 micro-optimization is required. Required production work is abuse
control/retention and query/storage monitoring, not lower-level JSON tuning.
The optional covering index is P3.

## 12. UX findings

Positive:

- Ranked entry is explicit and connection requirement is in the aria label;
- start, offer, resolution, terminal and finalization use visible modal states;
- server-provided text is rendered safely;
- retry preserves the same operation;
- leaderboard keeps server order and exposes build details without secrets;
- Practice remains usable when Worker is absent.

Problems:

- “Return to Practice” is destructive and broken in normal error states
  (R1-P1-003);
- all conflicts receive the same message even when retry cannot succeed;
- retry is shown even when an acknowledged response was locally rejected and
  no pending operation remains;
- no expiry countdown/pause warning or token refresh;
- no indication that `checkpoint_verified_v3` verifies meta boundaries, not
  gameplay;
- Camp is offered at the wrong lifecycle boundary;
- multiple choice buttons are not globally locked during an in-flight request;
- reconnect/protocol states exist but do not have distinct player flows;
- stale/corrupt recovery can silently remove the Resume entry rather than
  explain that a server run may still exist.

## 13. M5 release blockers

Blockers:

1. Decide and implement the integrity model for room completion/reward claims,
   or explicitly remove competitive Ranked/leaderboard semantics.
2. Correct Camp source/lifecycle and define persistent meta ownership.
3. Add secure resume/refresh with an independent credential.
4. Fix destructive error abandon ordering/state.
5. Coordinate tabs/global input and provide conflict resync.
6. Add abuse control, run retention and capacity monitoring.

Production remains safely inactive now:

- `v08-meta-1` is not production-released;
- production registry is not activated;
- local real ruleset entry is environment guarded;
- no deployment/push was performed.

## 14. Recommended remediation order

1. **Security model milestone:** resolve R1-P0-001 and the public meaning of
   “Ranked”/`checkpoint_verified_v3`.
2. **Canonical lifecycle milestone:** repair Camp/extraction/persistent profile
   ownership without inventing v0.8 behavior.
3. **Recovery milestone:** recovery credential, resume/refresh contract,
   expiry, stale/conflict and device policy.
4. **Client reliability milestone:** error state transitions, clear ordering,
   one in-flight mutation, multi-tab lease/resync.
5. **Operational security milestone:** rate limiting, quotas, retention,
   monitoring, route/CORS/secrets/rollback plan.
6. **Protocol/documentation hardening:** schemas/version negotiation, cursor
   semantics, current architecture/handoff.
7. Rerun threat matrix, full Wrangler/D1 concurrency, all meta-system headed
   paths and public staging go/no-go review.

A separate security remediation milestone is required. M5 should not begin
staging/release in parallel. Offline M5 planning may proceed, but activation,
shared staging and release gates must wait.

## 15. Final verdict

**REJECT_FOR_M5**

Reason: one P0 architectural release blocker and five P1 issues remain. The
canonical meta-transaction, token, idempotency and D1 layers are strong, but
they cannot make a public Ranked leaderboard trustworthy while room completion
and bounded reward occurrence remain client attestations. Recovery, Camp
lifecycle, browser concurrency/error escape and operational abuse controls
also require remediation.

No implementation fix, code change, test change, D1 change, production
activation, push or deployment was made as part of R1.
