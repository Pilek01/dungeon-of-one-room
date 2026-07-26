# Milestone M2 — Ruleset Runtime & Compact Idempotency

## Status

Partially implemented locally. M2.1-M2.3 are complete; M2.4 is blocked because
the existing authenticated mutation contract requires a room directive while
the mandatory `v08-meta-1` starting-relic choice occurs before the first room.
M2.5 depends on M2.4 and is also blocked. No later milestone was started.

Do not start any later milestone automatically.

## Objective

Promote the completed Online v3 pure-domain ruleset into a locally runnable Worker runtime while preserving exact retry behavior and keeping response storage compact.

This milestone must:

1. replace full-response `recent_ops` storage with compact, deterministic idempotency records;
2. reconstruct exact retry responses from historical canonical transaction data, never from the latest mutable run state;
3. prepare `v08-meta-1` as a local release candidate;
4. wire existing Online v3 endpoints to the real `v08-meta-1` ruleset;
5. verify the full run lifecycle through real local HTTP, Wrangler and D1;
6. keep the game client completely untouched.

The required end state is:

> Online v3 backend works locally end-to-end with the real ruleset, without integration with the game client and without deployment.

---

## Current repository state

Expected starting point:

- branch: `main`;
- latest Online v3 milestone: M1 Meta Transactions;
- latest ruleset hash:
  `sha256:2fcc9df6032f7966ff0ede0e723dc1f0f3b0b28cc0d77533caaeb7ae886a8594`;
- `v08-meta-1` remains test-only or unreleased at milestone start;
- active endpoints still use the fixture ruleset;
- game and Online v3 client remain unintegrated;
- D1 schema and current `recent_ops` behavior have not yet been changed for compact reconstruction;
- no deployment has occurred.

There are exactly 172 pre-existing unrelated deletions belonging to the protected Vault Guardian package WIP.

They are not part of M2.

The milestone must preserve:

- the same set of 172 paths;
- the same path delta;
- zero staged protected WIP paths;
- zero protected WIP paths in M2 commits.

Do not restore, edit, stage, commit or delete those paths.

---

## Required context

Before implementation, read:

1. `AGENTS.md`;
2. `ONLINE_V3_HANDOFF.md`;
3. `cloudflare/leaderboard-v3/AGENTS.md`;
4. this file;
5. relevant Online v3 Worker, D1, ruleset registry and idempotency code;
6. M1 source-evidence and transaction documentation;
7. current Wrangler/D1 E2E tests.

Do not read the full historical archive unless a specific unresolved rule requires it.

---

# Workstream 1 — Compact idempotency records

## Goal

Replace storage of large complete response payloads in `recent_ops` with a compact, versioned record capable of reproducing the exact original response.

The design must preserve:

- exact retry;
- conflicting retry rejection;
- request identity;
- run binding;
- ruleset binding;
- revision binding;
- operation type;
- response semantics;
- restart determinism;
- bounded storage;
- historical correctness.

## Requirements

Audit the current implementation of:

- `recent_ops`;
- request digests;
- operation IDs;
- response persistence;
- exact retry;
- conflicting retry;
- D1 serialization;
- start/checkpoint/event/finalize flows;
- transaction receipts;
- offer and replacement receipts;
- fallback receipts;
- meta-transaction receipts.

Measure the current worst-case storage for:

- a normal response;
- an 8-choice replacement response;
- the known maximum replacement response of approximately 14,484 bytes;
- rings of 12 and 24 operations.

Design a versioned compact record, for example conceptually:

```js
{
  version,
  operationId,
  operationType,
  requestDigest,
  responseKind,
  runId,
  rulesetId,
  rulesetHash,
  revisionBefore,
  revisionAfter,
  historicalRecordRef,
  publicProjectionVersion,
  resultDigest
}
The exact schema must follow the existing architecture.
Do not store enough mutable state to accidentally reconstruct from the newest run revision.
Historical reconstruction rule
A retry response must be reconstructed only from immutable historical facts associated with the original operation.
Allowed sources may include:
bounded canonical transaction receipts;
immutable reward receipts;
historical revision snapshots already supported by the architecture;
finalized operation records;
explicitly persisted compact public projections;
immutable operation-specific reconstruction payloads.
Forbidden reconstruction:
original request
+ latest current run state
= guessed response
If exact reconstruction requires data that is not currently retained, persist the minimum immutable operation-specific data required.
Do not persist an entire current run state unless the audit proves it is necessary.
Response equivalence
Define and test response equivalence.
An exact retry must reproduce the same externally observable response, including where applicable:
status;
response kind;
revision;
public state projection;
offer IDs;
opaque choice IDs;
transaction IDs;
fallback award;
gold delta;
finalization result;
cursor or leaderboard identifiers;
error semantics.
Canonical JSON key ordering does not need to match raw byte order unless the existing contract explicitly requires byte-identical responses.
Document whether equivalence is:
semantic object equality;
canonical JSON equality;
byte-for-byte body equality.
Prefer canonical semantic equality unless the existing HTTP contract already promises raw byte equality.
Bounded storage
Choose a justified ring size.
The previous recommendation suggested 12, but do not adopt it without tests.
The final choice must consider:
maximum compact record size;
expected checkpoint/event retry window;
D1 row size;
long runs;
client reconnect behavior;
duplicate request patterns.
Do not silently reduce the ring below the minimum required for valid retry behavior.
Workstream 2 — Idempotency migration and D1 compatibility
Goal
Introduce the compact record without breaking existing local development data or current Worker tests.
Requirements
Determine whether the compact format requires:
a D1 schema migration;
a new JSON version inside the existing column;
a new table;
a new operation-history structure;
compatibility reading for the old full-response format.
Prefer the smallest safe migration.
If the current recent_ops column can contain a versioned compact structure safely, avoid adding tables without need.
Support explicit format versions, for example:
recent_ops v1 — stored full responses
recent_ops v2 — compact reconstruction records
Define behavior for old data:
migrate on read;
support read-only legacy retry;
reject legacy retry fail-closed;
clear only in isolated test fixtures.
Do not silently reinterpret old records.
Any migration must be:
additive or safely reversible where practical;
covered by D1 tests;
deterministic;
safe under Worker restart;
safe under concurrent retry.
Do not modify production resources or execute remote migrations.
Workstream 3 — Real ruleset release candidate
Goal
Prepare v08-meta-1 for local runtime use.
Requirements
Audit the ruleset registry and release gates.
Create an explicit state distinction:
fixture/test ruleset;
test-only canonical ruleset;
local release candidate;
production-released ruleset.
Do not mark the ruleset production-released.
A suitable state may be:
LOCAL_RELEASE_CANDIDATE
or an equivalent existing project convention.
The local Worker must be able to resolve and execute the exact hash produced by this milestone.
The registry must remain fail-closed for:
unknown ruleset ID;
unknown hash;
mismatched ID/hash;
deprecated hash;
fixture ruleset requested in a real ranked lifecycle;
unreleased production activation.
Document:
ruleset ID;
previous hash;
new hash, if domain changes alter it;
release state;
allowed environments;
activation rules.
Do not change domain behavior merely to activate the ruleset.
If no ruleset-domain files change, the canonical ruleset hash should remain unchanged.
Workstream 4 — Wire real ruleset into existing endpoints
Goal
Use the completed v08-meta-1 runtime through the existing Online v3 HTTP surface.
Existing endpoint families include:
run start;
checkpoint;
event;
finalize;
leaderboard/list;
leaderboard details.
Use the actual existing endpoint paths and contracts from the repository.
Requirements
Replace fixture-domain execution in local ranked lifecycle with real ruleset dispatch.
Preserve:
HTTP method;
path;
request schema;
response schema;
error shape;
HMAC checkpoint token behavior;
optimistic concurrency;
request digest behavior;
idempotency;
D1 transaction boundaries;
atomic finalize;
cursor behavior.
Do not create a second parallel set of endpoints unless the current architecture explicitly requires a versioned local route.
All endpoint calls must resolve:
run ruleset ID
+ exact ruleset hash
→ immutable ruleset implementation
Never select the newest ruleset implicitly.
A run started under one hash must remain bound to that hash.
Start endpoint
The real start flow must issue canonical initial state including applicable:
run identity;
revision;
signed checkpoint token;
depth/progression state;
starting offer;
starting build ledger;
run modifiers state;
initial directives;
operation idempotency record.
Do not trust client-provided initial build, gold, relics, modifiers or depth.
Checkpoint endpoint
The real checkpoint flow must use canonical:
directive progression;
room outcome envelope;
gold ledger;
offers;
build ledger;
replacements;
fallback rewards;
meta-transactions;
revision advancement.
Combat details remain client-attested or heuristic only where already classified.
Do not create per-turn combat authority.
Event endpoint
Wire existing event operations to the real domain contract.
Supported operations must be explicit and fail closed.
Do not accept a generic arbitrary state patch.
Finalize endpoint
Use the existing finalization contract.
Do not invent final score or missing run-completion rules in M2.
If final score/lives/victory/defeat are still incomplete, preserve the current fixture-compatible or explicitly provisional finalization behavior and document the remaining M3 dependency.
Do not implement M3 scoring inside this milestone.
Workstream 5 — Real HTTP/D1 lifecycle E2E
Goal
Prove that the real ruleset works through Worker HTTP and D1, not only through pure-domain unit tests.
Required scenarios
Add real local Wrangler/D1 E2E coverage for at least:
Start and retry
start real v08-meta-1 run;
exact start retry returns equivalent response;
same operation identity with conflicting payload is rejected;
Worker restart preserves retry response;
ruleset ID/hash binding persists.
Checkpoint progression
valid sequential checkpoint;
stale revision rejected;
skipped revision rejected;
invalid checkpoint token rejected;
exact checkpoint retry reconstructed from compact history;
conflicting checkpoint retry rejected;
Worker restart preserves checkpoint retry.
Reward and build flow
canonical relic offer;
canonical replacement transaction;
canonical fallback reward;
Merchant transaction;
Forge Temper;
Forge Transmute;
Crossroads;
Camp;
Pact;
exact retry for at least one large replacement response;
reconstructed large response is externally equivalent.
Persistence and concurrency
concurrent duplicate request;
concurrent conflicting request;
D1 rollback on failed domain commit;
no partial gold/build/reward changes;
run reload after Worker restart;
recent operation ring bound respected;
retry inside retained window succeeds;
retry outside retained window returns explicit documented error.
Finalization
finalize remains atomic;
exact finalize retry;
conflicting finalize retry;
leaderboard entry created once;
run cannot be finalized twice with a different result.
Fail-closed ruleset behavior
unknown ruleset ID;
unknown ruleset hash;
mismatched ruleset ID/hash;
production activation remains unavailable;
fixture ruleset is not accidentally used for a real v0.8-meta run.
Use the current local Wrangler/D1 harness.
Do not substitute mocks for scenarios that specifically require D1 persistence.
Internal commits
This milestone must use separate local commits.
Do not combine everything into one commit.
Recommended sequence:
Commit M2.1
Implement compact Online v3 idempotency records
Contains only:
idempotency audit;
compact record format;
reconstruction logic;
related tests;
documentation.
Commit M2.2
Add Online v3 idempotency storage compatibility
Contains only:
D1/storage format compatibility;
migration or version reader;
persistence/concurrency tests.
Skip this commit only if no storage-format change is required. Explain why.
Commit M2.3
Promote v08-meta-1 to local release candidate
Contains only:
registry/release-state changes;
local activation rules;
fail-closed tests;
manifest/documentation.
Commit M2.4
Wire Online v3 Worker endpoints to the real ruleset
Contains only:
endpoint dispatch integration;
real ruleset request handling;
HTTP contract regression tests.
Commit M2.5
Add real ruleset Wrangler and D1 lifecycle coverage
Contains only:
real local E2E;
restart/concurrency/retry scenarios;
test harness changes required for those tests.
Final documentation commit
Complete Online v3 ruleset runtime milestone
Contains only:
ONLINE_V3_HANDOFF.md;
M2 documentation;
update to docs/tasks/CURRENT.md status;
no runtime changes.
If implementation naturally requires a slightly different split, preserve the separation between:
compact idempotency;
persistence;
ruleset activation;
endpoint wiring;
E2E;
documentation.
Do not amend or squash prior milestone commits.
Allowed paths
Changes are allowed only where required within:
cloudflare/leaderboard-v3/src/**;
cloudflare/leaderboard-v3/test/**;
cloudflare/leaderboard-v3/tests/**;
Worker package scripts directly required by validation;
D1 migration files, only if audit proves a migration is required;
scripts/verify-online-v3.mjs, only if new stable test groups must be registered;
relevant root/package scripts, only when necessary;
docs/ONLINE_V3_*;
docs/tasks/CURRENT.md;
ONLINE_V3_HANDOFF.md.
Generated canonical ruleset files may change only when their source inputs genuinely change.
Out of scope
Do not implement or modify:
game.js;
index.html;
CSS;
rendering;
audio;
HUD;
cheat menu;
Observer Bot;
special rooms;
game save/Continue;
Final Defeat presentation;
Online v3 client modules;
Ranked UI;
loading screen;
leaderboard UI;
client networking;
per-turn combat networking;
accounts;
profile persistence;
profile unlock synchronization;
final scoring design;
lives design;
victory/defeat/extract lifecycle beyond existing contracts;
production deployment;
remote D1 migration;
production ruleset release;
Cloudflare Pages integration;
Vault Guardian protected WIP;
unrelated cleanup.
Do not begin M3.
Security and correctness requirements
Server authority
Never trust client-provided:
gold totals;
build;
relic inventory;
relic stacks;
rarity;
slot limits;
modifier effects;
offers;
transaction effects;
final score;
revision;
reconstructed retry result.
Only accept documented request intents and opaque IDs.
Idempotency
Every mutating operation must have:
stable operation identity;
request digest;
exact retry behavior;
conflicting retry rejection;
bounded history;
deterministic reconstruction;
restart persistence.
Atomicity
No failed request may leave partial:
revision advancement;
gold change;
build change;
reward consumption;
transaction consumption;
finalization;
leaderboard entry.
Ruleset binding
Every ranked run remains bound to:
ruleset ID;
exact ruleset hash;
release state valid for the current environment.
Cloudflare Worker constraints
Keep request state local to each request.
Do not add mutable module-global run state.
Pure-domain logic must remain separate from HTTP and D1.
Stop conditions
Stop instead of guessing if:
exact retry cannot be reconstructed from retained immutable history;
the existing HTTP contract is insufficient for real ruleset operations;
endpoint wiring requires game-client changes;
finalization requires unresolved M3 score/lives/outcome rules;
a D1 migration would be destructive;
legacy recent_ops compatibility is ambiguous;
compact storage would make valid retries impossible;
ruleset activation would accidentally permit production use;
fixture and real ruleset semantics cannot be cleanly separated;
implementation would require touching the protected 172-path WIP;
a required change falls outside allowed paths.
A partial milestone with a documented blocker is preferable to invented behavior.
Verification workflow
During development use:
npm run verify:fast
Before every internal commit run the targeted tests for that workstream.
Before final M2 completion run:
npm run verify:phase
npm run verify:baseline
npm run verify:full
The final verification must include:
generator checks;
node syntax;
all ruleset unit tests;
all golden fixtures;
all property tests;
registry fail-closed tests;
compact idempotency tests;
legacy compatibility tests;
HTTP contract tests;
real local Wrangler/D1 E2E;
concurrency tests;
restart tests;
atomic rollback tests;
protected-files guard;
headed baseline smoke;
git diff --check.
Expected baseline requirements:
Classic PASS;
HD PASS;
audio PASS;
32 cheat options;
Observer Bot PASS;
Shrine PASS;
Vault Guardian PASS;
save/Continue PASS;
Final Defeat PASS;
zero /api/v3 calls in Practice;
zero console errors;
zero page errors.
Acceptance criteria
M2 is complete only when:
full responses are no longer stored in recent_ops unless explicitly justified for a small response type;
exact retries are reconstructed deterministically from immutable historical records;
conflicting retries are rejected;
reconstruction survives Worker restart;
compact records are bounded;
storage compatibility is documented and tested;
v08-meta-1 has an explicit local release-candidate state;
production activation remains blocked;
existing endpoints execute the real ruleset locally;
runs remain bound to exact ruleset hash;
real HTTP/D1 lifecycle tests pass;
finalize remains atomic;
fixture ruleset remains available only for explicit tests;
game and client remain untouched;
protected 172-path WIP remains identical and outside every commit;
verify:phase, verify:baseline and verify:full pass;
no push or deployment occurred.
Required documentation
Create or update an M2 document covering:
old recent_ops behavior;
compact record schema;
reconstruction sources;
response equivalence definition;
ring-size decision;
legacy compatibility;
local release-candidate state;
endpoint-to-ruleset dispatch;
HTTP/D1 lifecycle;
unresolved M3 dependencies;
deployment blockers.
Update ONLINE_V3_HANDOFF.md with a short current snapshot only.
Do not paste full test logs into the handoff.
Required final report
The final response must be concise and include:
all M2 commit hashes;
compact record version and schema summary;
old versus new worst-case storage size;
selected ring size and justification;
exact retry reconstruction method;
legacy recent_ops compatibility behavior;
response equivalence definition;
local ruleset release state;
ruleset hash before and after;
endpoints wired to the real ruleset;
HTTP/D1 E2E scenario count;
concurrency and restart results;
finalization result;
verify:phase result;
verify:baseline result;
verify:full result;
protected 172-path WIP delta;
confirmation that game/client/production were untouched;
changed file count;
next recommended milestone, without starting it.
Prohibited actions
Do not:
use git add .;
use git add -A;
stash or reset protected WIP;
amend or squash old commits;
rebase;
merge;
push;
deploy;
run remote migrations;
activate production ruleset;
modify the game;
begin M3.
After the final documentation commit and report, stop.
