# Online v3 Milestone M5P — staging and release plan

Status: planning complete; no Cloudflare resource, remote migration, secret, route, deployment, or production ruleset activation was created by M5P.

Platform documentation verified: **2026-07-27**, exclusively against current official Cloudflare documentation linked in section 25.

## 1. Executive summary

M5 must promote the existing checkpoint-authoritative Online v3 meta layer through three separately authorized milestones:

- **M5A — private staging:** implement release configuration and remaining operational controls, provision isolated staging resources, deploy a non-production ruleset, and make staging reachable only through Cloudflare Access.
- **M5B — staging soak:** run a minimum seven-day, player-visible soak against the exact release candidate; collect correctness, abuse, recovery, cleanup, latency, and cost evidence; close every release blocker.
- **M5C — public production release:** provision isolated production resources, apply compatible migrations, upload and canary the exact approved artifacts, explicitly promote one ruleset hash to `PRODUCTION_RELEASED`, and monitor the launch.

M5P itself is documentation-only. It does not execute M5A, M5B, or M5C.

The selected deployment model is:

- separate Cloudflare Workers, D1 databases, rate-limit namespaces, Analytics Engine datasets, secrets, routes, and access policies for staging and production;
- explicit `wrangler.staging.toml` and `wrangler.production.toml` release manifests planned for later milestones, rather than a deployable default environment;
- same-origin browser/API routing at `/api/v3/*`, so the current empty API base URL remains valid and no permissive CORS policy is needed;
- migration first, Worker second, ruleset activation last;
- upload and deployment as separate operations, with version IDs and traffic percentages recorded;
- forward-fix for D1 schema defects; D1 Time Travel only as a traffic-frozen disaster-recovery action;
- no automatic production deployment from a branch push.

The current ruleset hash remains:

`sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6`

It remains test/local-only after M5P. R1-P0-001 remains an accepted product boundary, not a release blocker: combat is locally authoritative for presentation and is not fully server-provable.

## 2. Reviewed repository state

Planning baseline reviewed at commit `f2ec175c2a379b8004a9538a05caf360565b6558` on `main`.

| Surface | Current state | M5 implication |
| --- | --- | --- |
| Worker entrypoint | `cloudflare/leaderboard-v3/src/index.js` | Has HTTP and scheduled handlers; must be packaged as an explicit staging or production version. |
| Wrangler | `cloudflare/leaderboard-v3/wrangler.toml`, Wrangler `4.116.0` | Current D1 ID is a placeholder and is not deployable release configuration. |
| Local ruleset entrypoint | `local-ruleset-entry.js` | Registers `v08-meta-1` only for test/local use. It must not become production merely because code is deployed. |
| API | `/api/v3` | Browser uses `DUNGEON_ONLINE_V3_API || ""`; same-origin routing is the lowest-risk topology. |
| Practice | No Online v3 API traffic | Must stay network-free in M5. |
| D1 | Migrations `0001`–`0003` | All current migrations are fresh-schema/additive. A new Worker cannot run safely on a schema missing them. |
| Leaderboard order | `season`, `score DESC`, `created_at ASC`, `run_id ASC` | Existing index omits the final `run_id` tie-break; correctness is preserved, scale efficiency needs one planned index. |
| HMAC | `RANKED_V3_HMAC_SECRET`, minimum 32 bytes | Production rotation requires active/previous key IDs and an overlap procedure. |
| Recovery | Random 256-bit credential stored as a contextual SHA-256 verifier | No recovery pepper is required; the credential must never be logged or exposed after issuance. |
| Abuse readiness | Production start checks `RANKED_V3_ABUSE_CONTROL`, but no rate-limiter call exists | M5A must implement and test the actual adapter before any staging start endpoint is opened. |
| Metrics | Optional `RANKED_V3_METRICS`; safe metric names already exist | M5A must make the binding mandatory in release manifests and define dimensions/redaction. |
| Availability | Public, no D1 read, `productionActivated:false` | Keep it minimal; add a separately protected dependency health check. |
| Cleanup | Scheduled expiry deletion without bounded batches | M5A must make cleanup bounded, observable, and safe to repeat. |
| CI/CD | No repository deployment workflow | M5A may add manually dispatched staging automation; M5C must add a separately protected production path. |
| Static hosting | No authoritative Pages/site release configuration found | The owner zone, hostname, and static hosting target are required user inputs before M5A. |
| Production resources | None identified or activated | This is the correct fail-closed pre-release state. |
| Protected baseline | Exactly 172 Vault Guardian deletions were present and unstaged | M5 must never touch, stage, restore, or commit them. |

M5P does not change gameplay, Ranked/Practice names, combat authority, or the behavior difference between modes.

## 3. Environment topology

| Property | Local | Private staging | Public production |
| --- | --- | --- | --- |
| Purpose | Deterministic development and tests | Release-candidate integration and soak | Public service |
| Worker | Existing local Worker/Miniflare | Dedicated `dungeon-online-v3-staging` | Dedicated `dungeon-online-v3-production` |
| D1 | Local/preview database | Dedicated staging D1 | Dedicated production D1 |
| Ruleset states allowed | `TEST_ONLY`, `LOCAL_RELEASE_CANDIDATE` | `STAGING_RELEASE_CANDIDATE`, plus retained staging predecessors | `PRODUCTION_RELEASED`, plus retained production predecessors |
| Public route | None | Same-origin `/api/v3/*` on staging hostname | Same-origin `/api/v3/*` on production hostname |
| Access | Local machine only | Cloudflare Access: named humans and CI service identity | Public game/API; operational health remains Access-protected |
| `workers.dev` | Local tooling only | Disabled | Disabled |
| Secrets | Local ignored file/test fixture | Staging-only Cloudflare secrets | Production-only Cloudflare secrets |
| Metrics/logs | Test output | 100% Workers Logs during soak; staging dataset | 100% first 72 hours, then reviewed sampling; production dataset |
| Data sharing | None | Never copied to production | Never copied to staging |

Future release manifests must be separate files with explicit Worker names and resource IDs. This deliberately rejects a deployable top-level fallback: omitting `--config wrangler.production.toml` must not be capable of targeting production. Each command must pass the configuration path and use the immutable D1 **database name**, not only the binding name.

## 4. Resource naming and binding matrix

`<ZONE>` and IDs are placeholders resolved only after the user selects the Cloudflare account and zone.

| Resource | Local | Staging | Production |
| --- | --- | --- | --- |
| Worker | `dungeon-online-v3-local-ruleset` | `dungeon-online-v3-staging` | `dungeon-online-v3-production` |
| Wrangler manifest | Existing local JSONC | `wrangler.staging.toml` | `wrangler.production.toml` |
| D1 database | Local fixture | `dungeon-online-v3-staging` | `dungeon-online-v3-production` |
| D1 binding | `DB` | `DB` | `DB` |
| Analytics Engine dataset | Optional/local | `dungeon_online_v3_staging_metrics` | `dungeon_online_v3_production_metrics` |
| Analytics binding | `RANKED_V3_METRICS` | Same binding, staging dataset | Same binding, production dataset |
| Abuse readiness var | Test value | `RANKED_V3_ABUSE_CONTROL=workers-rate-limit-v1` | Same value |
| Start limiter | Local fake | `RANKED_V3_RATE_START`, unique namespace | Same binding, different namespace |
| Resume limiter | Local fake | `RANKED_V3_RATE_RESUME`, unique namespace | Same binding, different namespace |
| Mutation limiter | Local fake | `RANKED_V3_RATE_MUTATE`, unique namespace | Same binding, different namespace |
| Finalize limiter | Local fake | `RANKED_V3_RATE_FINALIZE`, unique namespace | Same binding, different namespace |
| Read limiter | Local fake | `RANKED_V3_RATE_READ`, unique namespace | Same binding, different namespace |
| Credential-failure limiter | Local fake | `RANKED_V3_RATE_CREDENTIAL_FAILURE`, unique namespace | Same binding, different namespace |
| Human Access app | None | `dungeon-online-v3-staging` | Operations-only app |
| CI Access token | None | `dungeon-online-v3-staging-e2e` | None for player traffic |
| API route | Local port | `https://<STAGING_HOST>/api/v3/*` | `https://<PRODUCTION_HOST>/api/v3/*` |
| Cleanup cron | Manual/local | `*/15 * * * *` UTC | `*/15 * * * *` UTC |

Every release manifest must set `workers_dev = false`, declare all required secrets, repeat every non-inheritable binding, and fail validation when an ID is a placeholder. Staging and production namespace IDs must never be shared because Workers Rate Limiting counters are shared when namespace IDs match.

## 5. Routing, same-origin policy, CORS, caching, and browser security

**Decision: use same-origin routing.** The static game and `/api/v3/*` must be presented on the same hostname in each environment. The current browser client can keep an empty API base URL and all existing relative endpoints. Practice remains free of Online v3 requests.

The static hosting owner is not yet known. M5A must choose the exact Cloudflare-supported mechanism after that is resolved:

- if the static site has an external or Pages-backed origin on a proxied hostname, attach the Worker only to the exact HTTPS `/api/v3/*` route;
- if the Worker is the origin for the entire hostname, use a Custom Domain and explicitly serve/proxy static content;
- do not use `workers.dev` for release traffic.

Route acceptance tests must prove:

- `/api/v3/*` reaches the correct environment Worker;
- all other paths continue to serve the correct static build;
- a staging hostname can never reach the production Worker or D1;
- HTTP redirects to HTTPS;
- API responses are not cached (`Cache-Control: no-store`) and any zone Cache Rule bypasses `/api/v3/*`;
- the public static build carries a release ID matching the Worker release record;
- no production route is created during M5A.

Same-origin means no CORS headers are required. The Worker should reject unexpected cross-origin mutating requests using an exact `Origin`/`Host` allowlist. If cross-origin hosting becomes unavoidable later, it requires a separate reviewed change with:

- an exact environment allowlist, never `*`;
- only `GET`, `POST`, and `OPTIONS`;
- only required headers such as `Content-Type` and `Idempotency-Key`;
- `Vary: Origin`;
- no credential mode unless the protocol is deliberately changed;
- negative tests for foreign origins and preflight caching.

Planned browser/security headers are `Content-Security-Policy` appropriate to the actual static host, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, strict HTTPS/HSTS only after the hostname is proven, and a narrowly scoped `Permissions-Policy`. Header ownership must be singular: static-host config for documents/assets and Worker code for API responses.

## 6. Ruleset lifecycle and artifact identity

The release registry must expose these explicit states:

| State | New Ranked starts | Existing pinned runs | Intended environment |
| --- | --- | --- | --- |
| `TEST_ONLY` | Test fixtures only | Test fixtures only | Automated tests |
| `LOCAL_RELEASE_CANDIDATE` | Local only | Local only | Local validation |
| `STAGING_RELEASE_CANDIDATE` | Staging only | Yes | Private staging/soak |
| `PRODUCTION_RELEASED` | Production only | Yes | Public production |
| `DEPRECATED` | No | Yes until drained/expired | Any retained predecessor |
| `DISABLED` | No | No, except an explicitly documented recovery path | Emergency only |

Promotion is immutable and hash-based. A release record must bind:

- ruleset ID and exact SHA-256 hash;
- ruleset registry state and permitted environments;
- Git commit SHA;
- static artifact hash;
- Worker version ID and version tag;
- ordered migration set and migration-set hash;
- protocol version;
- reviewer/operator and UTC timestamp.

Deploying code does **not** promote a ruleset. The sequence is:

1. upload and verify an inactive Worker version;
2. verify schema and dependencies;
3. deploy the Worker version;
4. run smoke checks while production starts remain gated;
5. in a separate explicitly authorized action, change the exact reviewed hash to `PRODUCTION_RELEASED`;
6. verify one real start and publication path.

Unknown hashes, environment/state mismatches, missing registry entries, or a production registry with no `PRODUCTION_RELEASED` hash must fail closed.

Rollback must preserve pinned runs. Mark a superseded hash `DEPRECATED` to block new starts while still serving active runs. Retain its runtime until there are zero non-finalized runs for that hash and at least seven additional days have passed. `DISABLED` is reserved for a hash that must not execute at all; its effect on active runs requires incident-owner approval.

## 7. Secrets, key identifiers, and rotation

Required release secrets must be declared in Wrangler so upload fails when any is absent. No value may be stored in Git, generated logs, test artifacts, issue text, or deployment messages.

Planned cryptographic bindings:

- `RANKED_V3_HMAC_ACTIVE_SECRET`;
- `RANKED_V3_HMAC_PREVIOUS_SECRET` during overlap;
- non-secret `RANKED_V3_HMAC_ACTIVE_KID`;
- non-secret `RANKED_V3_HMAC_PREVIOUS_KID`.

Tokens must carry a key ID. Signing always uses the active key; verification accepts active and previous keys only. Normal rotation:

1. generate at least 32 cryptographically random bytes outside the repository;
2. upload the new key as inactive/previous without deploying it through `wrangler versions secret put`;
3. upload code/config that can verify both key IDs;
4. deploy and verify dual-key acceptance in staging;
5. flip active/previous IDs in a new version;
6. retain the old key for token TTL plus 30 minutes of clock/queue margin;
7. remove the old key in a later version and confirm old-key rejection.

An emergency compromise may revoke the previous key immediately. Revoking the active key can invalidate live tokens; the documented recovery credential must reissue a token without changing canonical progress.

The recovery verifier remains an SHA-256 digest of a high-entropy, one-time 256-bit credential with its purpose/context. A server pepper is not added: the stored verifier is not practically brute-forceable, while a pepper would add rotation risk to run recovery. Raw recovery credentials, bearer tokens, idempotency keys, Access headers, and HMAC material are always redacted.

Additional secret classes:

| Secret | Scope | Rotation |
| --- | --- | --- |
| Cloudflare deploy API token | Staging or production only; separate tokens | 90 days or immediately after suspected exposure |
| D1 migration API token | Environment database only; separate from code deploy | 90 days |
| Staging Access service token | CI E2E only | 30 days; revoke after soak if unused |
| Any future notification webhook | One environment and one destination | 90 days |

Production secrets require two-person custody or an approved secrets manager. The release operator may reference the secret but must never print it.

## 8. D1 provisioning, migration order, compatibility, and recovery

M5A creates only `dungeon-online-v3-staging`; M5C creates only `dungeon-online-v3-production`. IDs are copied into the matching release manifest after independent name/account verification. Production must start empty; staging data is never promoted.

Planned read-only preflight commands:

```powershell
npx wrangler d1 info dungeon-online-v3-staging --config wrangler.staging.toml
npx wrangler d1 migrations list dungeon-online-v3-staging --remote --config wrangler.staging.toml
npx wrangler d1 execute dungeon-online-v3-staging --remote --command "SELECT name FROM sqlite_master WHERE type IN ('table','index') ORDER BY name" --config wrangler.staging.toml
```

Planned mutation, authorized only inside M5A/M5C:

```powershell
npx wrangler d1 migrations apply dungeon-online-v3-staging --remote --config wrangler.staging.toml
```

Use the immutable database name, not only `DB`, to reduce wrong-target risk. Capture the `d1_migrations` rows and schema object list before and after.

| Migration | Change | Old Worker on new schema | New Worker on old schema | Downtime/rollback |
| --- | --- | --- | --- | --- |
| `0001_initial.sql` | Creates base run/leaderboard tables and index | Not applicable to an empty first deployment | Unsupported | Apply before first Worker. Reversal would be destructive, so never use a down migration. |
| `0002_ranked_profiles.sql` | Additive run column, profile table/index | Compatible; extra nullable/defaulted fields do not break old queries | Unsupported because new code references new columns/table | No expected downtime. Forward-fix if application defect appears. |
| `0003_ranked_recovery_and_expiry.sql` | Additive verifier/timestamps/index | Compatible | Unsupported because new code references new columns | No expected downtime. Forward-fix. |

Required order is migration first, then Worker. A release is `NO-GO` if the new Worker would see an old schema. Code rollback remains possible because the existing migrations are additive; storage rollback is neither necessary nor preferred.

Before every production migration:

1. freeze release mutations, but not normal player traffic, while the migration is still proven additive;
2. capture `wrangler d1 time-travel info dungeon-online-v3-production`;
3. record the current bookmark, migration list, row counts, and Worker version;
4. apply one reviewed migration set;
5. validate schema and old-Worker compatibility;
6. unfreeze release operations.

D1 Time Travel is always-on point-in-time recovery, not a normal rollback. Restoring overwrites the database and cancels in-flight queries; it therefore requires a full traffic/starts freeze, incident-owner approval, a captured post-incident bookmark, and a reconciliation plan. Forward-fix is the default. If a future migration contains destructive SQL, changes an enum/state meaning, rewrites identifiers, or breaks the old Worker, stop M5 and create a separately approved migration/cutover plan.

No production seed data is required. Staging synthetic records must be clearly tagged and must never be copied to production.

## 9. Leaderboard index decision

**Decision: add the full composite index before public production, after staging measurements.**

Current query order:

```sql
season, score DESC, created_at ASC, run_id ASC
```

Current index:

```sql
season, score DESC, created_at ASC
```

Planned additive index:

```sql
CREATE INDEX ... ON leaderboard_entries (
  season,
  score DESC,
  created_at ASC,
  run_id ASC
);
```

Correctness is already deterministic because SQL includes `run_id`; the missing suffix affects scan/sort efficiency. M5A measures the current query with `EXPLAIN QUERY PLAN`, D1 response metadata, `rowsRead`, and latency at 10,000 and 100,000 representative synthetic staging rows. M5B adds and re-measures the additive index. The index ships in a reviewed migration before M5C unless measurements prove a material write/storage regression and a replacement plan is approved. Acceptance: indexed search, no temporary full sort, p95 under 250 ms for leaderboard reads at the representative data set, and rows read within 3× returned rows for normal pages.

## 10. Player-name policy

Player display names are public labels, never authentication, ownership, identity, or an account guarantee. Duplicate and visually similar names are allowed.

Before staging publication, server and browser must use one shared policy:

1. decode valid UTF-8 and normalize to Unicode NFC;
2. trim leading/trailing Unicode whitespace and collapse internal whitespace runs to one ASCII space;
3. require 1–18 Unicode code points and at most 64 UTF-8 bytes after normalization;
4. reject C0/C1 controls, line/paragraph separators, bidirectional override/isolate controls, zero-width/invisible format characters, lone surrogates, and replacement characters;
5. reject a value that becomes empty or contains no visible letter, number, symbol, or emoji;
6. render only through text APIs/escaping; never interpolate a name into HTML, SQL, logs, metrics dimensions, or URLs;
7. store the normalized display value and a policy-version identifier;
8. return a stable validation code with a player-readable explanation.

Emoji and non-Latin scripts are allowed. No uniqueness, confusable blocking, nationality inference, or broad profanity list is introduced without an appeals/moderation mechanism. A small emergency denylist may block explicit slurs or impersonation of system labels, but it must be versioned, reviewed, and applied consistently. Name changes are out of M5 unless the protocol already supports them.

Public presentation must distinguish user names from system messages and escape all text. Reports are handled manually for the initial release; a takedown removes the public leaderboard row or replaces its display name without changing canonical score evidence.

## 11. Layered abuse-control plan

Workers Rate Limiting is fast but per-location, permissive, and eventually consistent. It is a pressure-control layer, not an accounting or security authority. D1 remains authoritative for active-run caps, token/recovery verification, sequential revisions, idempotency, and final publication.

| Endpoint class | Edge/WAF IP guardrail | Worker limiter/key | Hard canonical control |
| --- | --- | --- | --- |
| Ranked start | 10/min/IP | 3/min per profile/install signal | Maximum two active runs; authenticated reservation; exact season/ruleset |
| Resume/recovery | 30/min/IP | 12/min per run/profile; failed credential 5/min per IP+run | Verifier comparison; expiry/status; token reissue only |
| Checkpoint/event/Camp | 300/min/IP | 120/min per authenticated run | Sequential revision, action allowlist, idempotency, canonical reducer |
| Finalize/abandon | 60/min/IP | 20/min per authenticated run/profile | One finalization, exact receipt, unique leaderboard publication |
| Leaderboard list | 120/min/IP | 60/min per IP | Read-only bounded page size |
| Leaderboard detail | 240/min/IP | 120/min per IP | Public projection only |
| Availability | 120/min/IP | 60/min per IP | No D1 dependency |

Periods are 60 seconds because the Workers binding supports 10- or 60-second windows. Keys must be bounded and must not contain player names, secrets, or raw credentials. Authenticated operations use a pseudonymous profile/run identifier; pre-authentication endpoints add IP-derived pressure limits. All limiter bindings use unique staging/production namespace IDs.

Every limit failure returns HTTP `429`, a bounded `Retry-After`, stable error code, and one redacted metric. The system must not charge a canonical action or consume an idempotency result when the edge rejects before D1. If the rate-limiter binding is absent or throws in a release environment, Ranked start and mutations fail closed; leaderboard reads and availability may remain read-only with an explicit degraded status.

Staging exercises the same logical limits. The CI Access service identity may receive at most a documented 5× allowance through separate namespaces, never a bypass. Abuse tests include distributed requests, multi-tab retries, lost responses, replayed credentials, forged identities, and cross-environment IDs.

## 12. Retention, cleanup, and continuation

| Entity | Staging | Production | Cleanup behavior |
| --- | --- | --- | --- |
| Active non-finalized run | 24 hours | 24 hours | Expire, then delete after the exact-retry window closes |
| Abandoned/expired run | 7 days | 7 days | Bounded deletion with metrics |
| Profile/recovery record | 30 days since last staging use | 90 days since last use | Delete only when no retained run depends on it |
| Finalized run and exact-retry state | 30 days | 365 days initially | Delete with its leaderboard row unless a future additive compaction separates public projection from private state |
| Leaderboard entry | 30 days | Season lifetime plus 90 days, capped initially at 365 days | Delete/takedown with referentially valid run handling |
| Workers Logs | Platform limit: 3 or 7 days by plan | Platform limit: 3 or 7 days by plan | Automatic platform expiry |
| Analytics Engine metrics | 3 months | 3 months | Automatic platform expiry |
| D1 platform analytics | 31 days | 31 days | Automatic platform expiry |
| D1 Time Travel | 7 days Free / 30 days Paid | Require 30-day Paid coverage | Automatic platform expiry |

The current foreign-key layout couples finalized run retention to leaderboard retention. M5A must not delete either independently. M5B must design an additive compaction migration if the 365-day private-state retention is judged too broad; no destructive migration is allowed during release preparation.

Cleanup runs every 15 minutes UTC. Planned implementation:

- select at most 250 candidates in staging and 500 in production per batch;
- process no more than five batches or the safe CPU/write budget per invocation;
- use deterministic age/id ordering;
- keep each batch idempotent and safe after partial failure;
- record candidates, deleted rows, rows read/written, duration, and last-success timestamp without identifiers;
- let the next scheduled invocation continue naturally; do not create unbounded loops;
- alert after three missed/failed cadences or 45 minutes without success;
- re-run immediately after a failed scheduled event only through an explicitly authorized operator command.

Cron configuration is environment-specific and version-controlled. Operators wait up to 15 minutes for trigger propagation before diagnosing a missing schedule.

## 13. Availability, dependency health, and maintenance

Keep `/api/v3/availability` public, fast, and independent from D1. Its safe response may include:

- protocol/schema policy version;
- environment (`staging` or `production`);
- `rankedAvailable`, `maintenance`, and a stable reason code;
- current start-eligible ruleset ID/hash, which is already a public client artifact;
- release ID/Worker version tag;
- boolean readiness for required bindings;
- `productionActivated`, which remains false until the explicit M5C activation.

It must not expose account IDs, database IDs/names, secret names beyond public protocol contracts, row counts, stack traces, internal routes, player data, or historical rulesets.

Add a separate Access-protected operational health check that verifies:

- D1 `SELECT 1`;
- expected `d1_migrations` set;
- registry hash/state/environment agreement;
- required secret and rate-limit/metrics bindings by boolean readiness only;
- last cleanup success and backlog band;
- write/read canary against a dedicated health record where safe;
- current Worker version and static artifact identity.

Maintenance behavior is fail closed for new Ranked starts. Existing authenticated runs remain available only when their pinned ruleset and schema are healthy. Practice always stays playable and network-free.

## 14. Observability, alerts, redaction, and cost controls

Workers Logs:

- staging: `head_sampling_rate = 1` for the whole soak;
- production: `1` for the first 72 hours, then reduce only after volume/cost review (initial target `0.1`);
- structured events only; never raw request/response bodies;
- accept the platform retention limit rather than adding an external log vendor in M5.

Analytics Engine is the durable three-month operational metric store. Each point should carry bounded dimensions: environment, release ID, Worker version, event name, endpoint class, status class, stable outcome code, ruleset hash prefix, and optional pseudonymous correlation hash; doubles include duration, rows read, rows written, response bytes, and count. Do not use player names, tokens, recovery credentials, idempotency keys, raw run/profile IDs, IP addresses, user agents, or arbitrary error strings as dimensions.

Use D1 dashboard/GraphQL metrics for query count, latency, rows read/written, response bytes, and storage. Record the response metadata for release-critical queries. Do not make the experimental `wrangler d1 insights` command a release gate; it may assist diagnosis.

Initial alert thresholds:

| Signal | Warning | Critical/action |
| --- | --- | --- |
| Worker 5xx | ≥5 and >2% in 5 min | >5% in 5 min or any sustained 10 min: stop promotion/rollback Worker |
| D1 failures | 3 in 5 min | 10 in 5 min or write failure: close new starts |
| Finalize failures | 2 in 15 min | >5% with ≥5 attempts: close new starts and investigate |
| Conflict/duplicate responses | >10% with ≥10 mutations/15 min | Duplicate leaderboard row or divergent receipt: immediate `NO-GO` |
| Recovery failures | 20 per IP band/5 min | Distributed spike or any successful replay: incident |
| Abuse rejections | >25% with ≥50 calls/10 min | Sustained >50%: inspect attack/false positives |
| Cleanup freshness | No success in 30 min | No success in 45 min: incident/operator runbook |
| API latency | p95 >750 ms for 15 min | p99 >2 s or player-visible timeout rate >1% |
| D1 storage/rows budget | 60% | 75% plan review; 85% stop growth/release |

M5A must configure native Cloudflare notifications where the account plan exposes the needed signal and document any threshold that remains dashboard/manual. No external vendor is introduced without a concrete gap, data-flow review, retention review, and user approval.

## 15. Data policy and public/private boundary

| Data | Purpose | Public? | Storage/log rule |
| --- | --- | --- | --- |
| Normalized display name | Leaderboard presentation | Yes | Public only with score projection; never log/metric dimension |
| Score, depth, season, build summary | Ranked result | Yes | Public projection; bounded retention |
| Canonical run/checkpoints/recent operations | Sequential authority and exact retry | No | D1 only; no raw body logs |
| Profile/install signal hash | Active-run/recovery linkage and abuse signal | No | Not an identity claim; delete with profile retention |
| Recovery verifier | Recover one run | No | D1 only; raw credential never stored |
| Bearer token/signature/key ID | Authenticate actions | Token: no; key ID: operational | Token redacted; key ID may appear in bounded operational logs |
| Timestamps/status/revisions | Ordering, expiry, support | Public subset only | Exact private history limited to retained run |
| Request IP/Cloudflare metadata | Coarse abuse protection | No | Used transiently; do not persist in D1 or Analytics Engine |
| Release/ruleset hashes | Reproducibility | Yes | Safe to expose |

Initial public leaderboard retention is season lifetime plus 90 days, capped at 365 days until the product owner approves a longer public-history policy. A player takedown removes or anonymizes the public name without fabricating a score. Deletion requests require enough proof to locate the run without accepting a public display name as identity.

No ad profiling, cross-service identity, device fingerprinting expansion, geolocation storage, or third-party analytics is part of M5. A short public privacy/data notice must describe the displayed name, score, retention, recovery mechanism, and contact/takedown process before M5C.

## 16. Private staging access and shutdown

Protect the entire staging hostname with a self-hosted Cloudflare Access application:

- human policy: explicit named testers or an approved identity-provider group;
- service policy: one staging-only Access service token for CI E2E;
- default deny; no public bypass path;
- CI sends `CF-Access-Client-Id` and `CF-Access-Client-Secret` from protected environment secrets;
- service credentials are never placed in browser JavaScript, screenshots, traces, or test artifacts;
- token use is audited and rotated every 30 days.

The staging release record must list authorized testers and the expiry of access. `robots.txt`, `noindex`, and obscure URLs are supplementary only, not access control.

Shutdown procedure:

1. set Ranked availability to maintenance and stop new starts;
2. wait for or explicitly retire active staging runs;
3. replace Access with deny-all;
4. remove the staging route/custom domain and confirm `workers.dev` is disabled;
5. revoke CI Access/deploy secrets;
6. export only approved evidence, then retain/delete staging D1 under section 12;
7. keep the Worker version record for audit without a reachable route.

## 17. CI/CD, approvals, and least privilege

No push-triggered production deployment is allowed. The planned pipeline is manually dispatched and produces an auditable release record.

Mandatory pre-upload gates:

- clean expected checkout and explicit changed-file allowlist;
- exactly preserved Vault Guardian fingerprint;
- `git diff --check`;
- `npm run verify:phase`;
- `npm run verify:baseline`;
- `npm run verify:full`;
- Worker validation and ruleset/hash checks;
- release-manifest lint rejecting placeholders, `workers_dev = true`, shared IDs, and wrong hostnames;
- migration inventory, SQL review, compatibility classification, and staging evidence;
- secret scan and generated-artifact hash verification.

Staging and production use separate CI environments and API tokens. Minimum permissions are limited to the specific account resources needed to upload/manage the Worker, the target D1 database, required route/zone, Analytics Engine, rate-limit namespace/configuration, and Access app. Migration credentials are separated from code-deploy credentials where the Cloudflare permission model allows it. Production requires:

- protected environment approval by the user/release owner;
- exact Git SHA and release record;
- a second approval for migration and a separate explicit approval for ruleset activation;
- no reusable staging credential.

Use `wrangler versions upload` to create an inactive Worker version, capture its version ID, test a preview/version override where supported, then use `wrangler versions deploy` with explicit version IDs/percentages. A direct `wrangler deploy` is prohibited for production because it uploads and immediately sends 100% of traffic to the new version.

The pipeline stores no secret files as artifacts. Retained artifacts are test reports, manifest hashes, migration list, version IDs, traffic decisions, health results, and the release/rollback log.

## 18. M5A — private staging implementation and deployment

M5A is a new, explicitly authorized milestone. Its ordered scope:

1. resolve the account, zone, static hosting owner, staging hostname, Cloudflare plan, Access identities, and alert recipients;
2. add code/config tests for `STAGING_RELEASE_CANDIDATE`, release binding validation, same-origin origin checks, player-name policy, actual rate-limit calls, bounded cleanup, internal health, and redacted metrics;
3. add `wrangler.staging.toml` with placeholders first; review it before inserting real IDs;
4. create only staging Worker-support resources: D1, rate-limit namespaces, Analytics Engine dataset, Access application/service token, route, and notifications;
5. upload staging secrets without logging them;
6. capture D1 Time Travel bookmark, list migrations, apply `0001`–`0003`, and verify schema/compatibility;
7. upload an inactive Worker version tagged with commit/ruleset/migration identity;
8. verify preview/internal health, then deploy 100% because staging has no public predecessor;
9. deploy/route the exact static release candidate on the staging hostname;
10. mark the exact hash `STAGING_RELEASE_CANDIDATE`; never `PRODUCTION_RELEASED`;
11. verify human Access, service-token E2E, negative public access, Practice zero-API, Ranked start/resume/checkpoint/finalize, exact retry, recovery, cleanup, metrics, and alerts;
12. record resource IDs, version IDs, hashes, tests, and costs in the staging release record.

M5A stops after private staging acceptance. It does not start M5B automatically.

M5A acceptance:

- all verification gates pass;
- no secret/player data in logs or metrics;
- no route reaches production;
- abuse binding absence fails closed;
- migrations and internal health match;
- one full Ranked run publishes exactly once;
- Practice produces zero Online v3 requests;
- staging can be disabled using section 16;
- the 172 protected deletions are unchanged.

## 19. M5B — staging soak and release evidence

Minimum soak: **7 consecutive days after the last release-blocking code/config change**.

Minimum representative workload:

- 10 named testers;
- 100 completed Ranked runs;
- 20 successful resume/recovery flows;
- 20 lost-response/exact-retry scenarios;
- 10 multi-tab concurrency/conflict scenarios;
- 10 Camp/extraction/finalization scenarios;
- 5 injected dependency/rate-limit/cleanup failures;
- desktop Chromium plus at least one additional supported browser;
- at least two network locations where practicable.

Required success evidence:

- zero duplicate leaderboard publications;
- zero divergent canonical revisions/receipts;
- zero accepted forged/replayed credentials;
- zero Practice Online v3 requests;
- zero secret or private-data leakage;
- 100% recovery of acknowledged checkpoints within documented expiry;
- all cleanup cadences successful or a documented injected failure recovered in the next cadence;
- Worker 5xx below 1%, excluding documented injected faults;
- player-visible request timeout rate below 1%;
- mutation p95 below 750 ms and p99 below 2 seconds;
- leaderboard p95 below 250 ms on the representative data set;
- measured D1 rows read/written and storage stay below the warning budgets;
- alert simulations produce the expected notification/runbook action;
- ruleset/static/Worker/migration hashes remain unchanged through the final stable 48 hours.

Every incident receives severity, UTC timeline, affected version/hash, player-visible impact, data impact, mitigation, root cause, tests, and recurrence prevention. Any Sev-1/Sev-2, canonical divergence, duplicate publication, credential bypass, cross-environment access, or data loss resets the seven-day soak after the fix. Lesser fixes require at least 48 stable hours.

M5B also measures the current leaderboard index, adds/tests the full composite index, validates key rotation, exercises Worker rollback with additive schema, and proves staging shutdown. It produces a signed go/no-go evidence packet and stops; it does not start M5C automatically.

## 20. M5C — public production release

M5C requires explicit user authorization after an M5B `GO`.

Ordered release:

1. freeze the exact Git commit, static artifact, Worker bundle, ruleset hash, migration set, and runbook;
2. provision only production resources with production-only credentials;
3. verify account/zone/resource names twice and keep public route absent;
4. configure native monitoring, notifications, operational Access, rate-limit namespaces, and required secrets;
5. capture initial D1 bookmark; apply reviewed migrations by production database name; verify old/new Worker compatibility;
6. upload the exact inactive Worker version and record its ID; do not use direct `wrangler deploy`;
7. deploy route/static content while `productionActivated:false` and new Ranked starts remain closed;
8. run public availability, protected health, Practice zero-API, browser security, and read-only smoke checks;
9. deploy Worker canary at 5% for 15 minutes, then 25% for 30 minutes, then 100%, with version affinity keyed by a stable pseudonymous identifier where practical;
10. at each step require alert/latency/error/D1/canonical health below thresholds; otherwise roll back the Worker version;
11. after 100% Worker stability, perform the separate explicit ruleset activation to `PRODUCTION_RELEASED`;
12. open new Ranked starts and run one operator-controlled end-to-end publication;
13. monitor continuously for 72 hours at full logging, with checkpoints at 15 min, 1 h, 6 h, 24 h, and 72 h;
14. reduce sampling only after a documented cost/coverage review.

Because gradual deployment can route consecutive requests to different versions, old and new Worker versions must share the same protocol and additive D1 schema. If that cannot be proven, use an inactive route smoke plus a single 100% cutover during a maintenance window instead of a split deployment.

## 21. Rollback matrix

| Failure | Immediate action | Data/runs | Exit condition |
| --- | --- | --- | --- |
| Static UI/client defect before activation | Restore previous static artifact; keep starts closed | No new production runs | Static hash and Practice smoke pass |
| Worker 5xx/latency during canary | `wrangler rollback` to recorded stable version or deploy stable version at 100% | Additive schema remains; pinned runs continue | Error/latency stable for 30 min |
| New ruleset defect | Mark hash `DEPRECATED`, select prior `PRODUCTION_RELEASED` hash for new starts | Existing runs stay pinned to retained runtime | Zero affected active runs plus 7-day buffer before removal |
| Severe ruleset/security defect | Close new starts; use `DISABLED` only with incident approval | Active affected runs may be blocked; preserve evidence/recovery plan | Incident owner approves recovery/release |
| Abuse-control unavailable | Close starts and mutations; keep safe reads/Practice | No canonical mutation without control | Binding/metrics tests pass |
| D1 migration application fails | Keep new Worker inactive; inspect state; forward-fix | Old Worker remains compatible with applied additive subset | Schema inventory and compatibility pass |
| D1 application bug after additive migration | Roll back Worker; forward-fix schema/code | No D1 restore | Old Worker health and invariants pass |
| Confirmed destructive data corruption | Freeze all Online v3 traffic, capture current bookmark, approve Time Travel restore | In-flight queries cancelled; reconcile post-bookmark actions | Incident/data-owner sign-off |
| Route/CORS/cross-environment error | Remove route or deny Access; close starts | D1 preserved | Negative routing tests pass |
| Secret exposure | Close affected actions, rotate/revoke key/token, upload/deploy clean version | Recover tokens through recovery flow if HMAC changes | Leak scan and old-secret rejection pass |
| Duplicate/divergent publication | Close starts/finalize immediately; preserve evidence | Never manually rewrite scores without reconciliation plan | Root cause fixed, deterministic replay passes, soak reset |

Worker rollback does not roll back D1 or other bound resources. The release record therefore captures resource compatibility for every target version. No rollback command is run without an exact version ID and resource check.

## 22. Go/no-go checklist

Production is `GO` only when all are true:

- M5A and M5B were explicitly completed and committed;
- seven-day soak and final 48-hour stability window pass;
- exact commit, ruleset, static, Worker, and migration hashes are recorded;
- current hash is approved for production but not yet activated;
- all phase/baseline/full verification passes on the release commit;
- protected baseline fingerprint still reports exactly the same 172 unstaged deletions;
- production account, zone, hostnames, plan, owners, and permissions are confirmed;
- same-origin route and static hosting ownership are resolved;
- all required secrets exist, rotation was rehearsed, and no secret scan findings remain;
- D1 schema, migration compatibility, bookmark, index, budgets, and retention are accepted;
- actual rate limiting, canonical hard limits, cleanup, availability, health, metrics, alerts, and Access are proven;
- player-name and public data/privacy policy are published;
- Practice zero-API and full Ranked publication/recovery evidence pass;
- rollback targets, operators, communications, and maintenance controls are ready;
- R1-P0-001 is explicitly accepted as the product boundary rather than misrepresented.

Any missing item is `NO-GO`. No deadline, sunk cost, or partial pass waives a gate.

## 23. Accepted product limitation

R1-P0-001 is accepted. Online v3 is a checkpoint-authoritative meta-progression service around the existing v0.8 game. The Worker controls documented meta-state: room directives/sequential depth, gold and transaction ledgers, server-issued offers, canonical build/checkpoint revisions, and final leaderboard publication.

Movement, combat, AI, animation, audio, rendering, and combat presentation remain locally authoritative and make no Online v3 network requests. Therefore:

- do not call the product server-authoritative combat or cheat-proof;
- do not implement server-authoritative combat in M5;
- do not rename Ranked or Practice;
- do not introduce different gameplay rules between those modes;
- describe leaderboard assurance narrowly as checkpoint/meta verification with the accepted combat-proof boundary.

This limitation is not a `NO-GO` unless product messaging falsely claims stronger authority.

## 24. Unresolved decisions requiring user input

These are not guessed and must be resolved before M5A mutates Cloudflare:

1. Cloudflare account ID and zone that will own staging/production.
2. Exact staging and production hostnames.
3. Current static-site hosting mechanism and its operator/owner.
4. Whether the account will use Workers Paid; production planning assumes 30-day D1 Time Travel and 7-day Workers Logs.
5. Named human staging testers, identity provider/group, and alert recipients.
6. Release owner, migration approver, production deploy approver, ruleset activation approver, and incident owner.
7. Approved initial public leaderboard retention (the plan proposes season + 90 days, capped at 365).
8. Public privacy/takedown contact and whether manual name moderation is acceptable at launch.
9. Expected launch traffic/cost budget, needed to confirm rate and D1 warning thresholds.
10. Whether production must use gradual traffic splitting; the safer fallback is a maintenance-window 100% cutover if version affinity/compatibility cannot be proven.

M5A should stop before provisioning if items 1–6 are unresolved.

## 25. Recommended next milestone and verified sources

The next recommended milestone is **M5A — Private Staging**, in a fresh task restricted to the M5A paths and explicit staging-only Cloudflare authority. It must begin with a read-only preflight, resolve section 24, implement/test the staging controls, and stop after private staging acceptance. Do not start M5B automatically.

Official Cloudflare sources verified on **2026-07-27**:

- [Workers versions and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/) — version state is separate from deployment state; `wrangler deploy` immediately deploys 100%.
- [Wrangler Workers commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/) — current syntax for `versions upload`, `versions deploy`, version IDs/percentages, and rollback.
- [Gradual deployments](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/) and [version affinity](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/version-affinity/) — split traffic, version skew, and affinity.
- [Workers rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/) — rollback behavior and the fact that bound storage is not rolled back.
- [Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/) — bindings, variables, and secrets are non-inheritable per environment.
- [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/) — required secret declarations and non-deploying `versions secret put` workflow.
- [Workers routes](https://developers.cloudflare.com/workers/configuration/routing/routes/) and [routes/domains](https://developers.cloudflare.com/workers/configuration/routing/) — exact routes, Custom Domains, and disabling reliance on `workers.dev`.
- [Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) — 10/60-second windows, namespace sharing, locality, permissive consistency, and monitoring.
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/) — ordered migration tracking and database-name targeting.
- [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) — always-on bookmarks, 7/30-day windows, and destructive in-place restore.
- [D1 metrics and analytics](https://developers.cloudflare.com/d1/observability/metrics-analytics/) — latency, exact rows read/written, storage, 31-day analytics, and query insights.
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) — rows read/written and storage as cost dimensions.
- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) — UTC execution, environment configuration, and up to 15-minute propagation.
- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) — head sampling, retention, limits, and cost.
- [Workers Analytics Engine limits](https://developers.cloudflare.com/analytics/analytics-engine/limits/) — bounded point schema and three-month retention.
- [Cloudflare Access service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/) — human/service authentication headers and token behavior.

All Cloudflare commands in this plan are future runbook examples. M5P executed none of them.
