# Milestone M2B — Authenticated Run Bootstrap & Real Ruleset Runtime

## Status

Completed locally with an explicit M3 finalization dependency.

Implementation commits:

- `80b8edf` — authenticated run-bootstrap boundary;
- `90a597c` — atomic starting-relic transition and first directive;
- `87c3da9` — exact local `v08-meta-1` Worker dispatch;
- `4963754` — real Wrangler/D1 lifecycle and restart coverage.

The real ruleset now starts, selects its starting relic, issues the first
canonical room and continues through authenticated room/meta operations.
Real finalization remains deliberately fail-closed with
`REAL_RULESET_FINALIZATION_REQUIRES_M3`; M2B did not invent score, outcome,
lives or extract policy.

Final ruleset hash:

`sha256:58528474cf072fbeddfc68a29c1eda00414996cd8fb4ea2871e0b954a1f95276`

This milestone resolves the canonical pre-room boundary blocker discovered during M2 and completes the previously blocked M2.4 and M2.5 workstreams.

Do not start M3 automatically.

## Objective

Implement an authenticated canonical run-bootstrap state that exists before the first room directive, then wire the real `v08-meta-1` ruleset into the existing local Worker endpoints and prove the complete lifecycle through real Wrangler and D1.

Required end state:

> A real `v08-meta-1` run can be started locally, the starting relic can be selected through an authenticated pre-room operation, the first room directive can be issued deterministically, and the remaining lifecycle works through the existing HTTP/D1 runtime.

No game-client integration and no deployment.

---

## Starting state

Expected HEAD includes:

- `e267999` — compact idempotency v2;
- `7f52493` — v1/v2 compatibility and D1 persistence;
- `3898db7` — local release candidate;
- `a5d94c9` — documented pre-room blocker.

Current ruleset hash:

`sha256:2fcc9df6032f7966ff0ede0e723dc1f0f3b0b28cc0d77533caaeb7ae886a8594`

Current conditions:

- compact `recent_ops` v2 is implemented;
- ring size is 12;
- legacy v1 retry remains supported;
- `v08-meta-1` is a local/test release candidate;
- production activation remains blocked;
- real endpoint dispatch is not yet enabled;
- fixture Worker runtime remains active;
- game and client remain untouched.

There are exactly 172 unrelated protected Vault Guardian deletions.

They must remain:

- unstaged;
- unmodified;
- outside every M2B commit;
- identical in path set and delta.

---

## Required context

Read:

1. `AGENTS.md`;
2. `ONLINE_V3_HANDOFF.md`;
3. `cloudflare/leaderboard-v3/AGENTS.md`;
4. this file;
5. current token-signing and verification code;
6. run start/event/checkpoint/finalize handlers;
7. starting relic offer domain code;
8. room directive generation;
9. compact idempotency v2 reconstruction;
10. current Wrangler/D1 E2E harness.

Do not read the entire history archive unless required by a specific unresolved contract.

---

# Workstream 1 — Canonical bootstrap state

## Required state machine

Introduce an explicit canonical state transition:

```text
RUN_CREATED
→ AWAITING_STARTING_RELIC
→ ROOM_DIRECTIVE_ACTIVE
The names may follow existing project conventions, but the states must remain distinguishable.
A newly created run must not require:
roomDirectiveId;
roomNonce;
fake depth;
synthetic room;
placeholder room result.
The starting relic must be selected before generation of the first playable room directive.
Bootstrap state
Canonical server state must bind at least:
run ID;
ruleset ID;
exact ruleset hash;
current revision;
current state digest;
starting offer ID;
starting reward slot or equivalent canonical source;
allowed starting choices;
bootstrap status;
bootstrap nonce or equivalent replay-binding value.
Client-provided build, relic, depth, directive, nonce or revision are not sources of truth.
Workstream 2 — Authenticated bootstrap token
Token type
Add a versioned authenticated boundary token capable of representing a pre-room state.
Preferred conceptual form:
{
  tokenVersion: 2,
  boundaryKind: "run_bootstrap",
  runId,
  rulesetId,
  rulesetHash,
  revision,
  startingOfferId,
  stateDigest,
  bootstrapNonce
}
Use existing HMAC infrastructure.
Do not create an unrelated second signing system.
Token separation
The verifier must distinguish at least:
bootstrap token;
room/checkpoint token;
finalized or otherwise invalid boundary.
A bootstrap token must not be accepted for:
room checkpoint;
normal room event;
finalization requiring a room boundary.
A room token must not be accepted for:
starting relic selection.
Wrong token kind must fail closed with a precise error.
Compatibility
Existing fixture token behavior must remain available for explicit fixture tests.
Production activation remains blocked.
Do not silently reinterpret old tokens as bootstrap tokens.
Workstream 3 — Starting relic transition
Implement one explicit authenticated operation for selecting the starting relic.
The operation may use the existing event endpoint if its contract can be safely extended with an explicit operation type.
Do not add a generic state-patch endpoint.
Client intent should contain only fields equivalent to:
{
  operationId,
  operationType: "select_starting_relic",
  bootstrapToken,
  offerId,
  choiceId
}
Exact field names must follow existing contracts.
Server responsibilities
The Worker/ruleset must derive:
current starting offer;
legal choices;
selected relic;
resulting build;
build digest;
next revision;
first room directive;
room nonce;
next checkpoint token.
The client must not provide any of those results.
Atomic transition
A successful operation atomically:
verifies the bootstrap token;
verifies run/ruleset/hash/revision/state digest;
verifies the canonical starting offer;
resolves the opaque choice ID;
applies the canonical starting relic;
consumes the starting offer exactly once;
advances the revision;
generates the first room directive;
generates the first room nonce;
issues the normal room token;
writes compact idempotency history;
persists the complete resulting run state.
Failure at any step must leave the run in the original bootstrap state.
Workstream 4 — Bootstrap retry and reconstruction
Compact idempotency v2 must support the bootstrap operation.
Exact retry
An exact retry must reproduce the original externally observable result:
status;
revision;
selected starting relic projection;
build projection;
first room directive;
room directive ID;
room nonce;
checkpoint token;
public state digest;
response kind.
Reconstruction must use immutable historical operation data.
It must never regenerate the first room from the newest run state.
Conflicting retry
The same operation identity with another:
choice ID;
offer ID;
token;
request digest;
must be rejected as a conflicting retry.
Restart behavior
After Worker restart and D1 reload:
exact bootstrap retry returns an equivalent result;
conflicting retry remains rejected;
the first directive does not change.
Workstream 5 — Real ruleset endpoint wiring
After bootstrap is complete, wire the existing local Online v3 endpoint surface to v08-meta-1.
Use exact ruleset dispatch:
ruleset ID + exact ruleset hash
→ immutable registered implementation
Never resolve to the newest hash automatically.
Start
The real start endpoint must:
create a canonical real-ruleset run;
create revision zero or the existing canonical initial revision;
issue the starting relic offer;
enter AWAITING_STARTING_RELIC;
return a signed bootstrap token;
not issue a fake room directive.
Event/bootstrap selection
The authenticated starting selection must transition into the first real room.
Checkpoint
After bootstrap completion, existing room checkpoint semantics must operate using:
canonical directives;
reward envelopes;
gold ledger;
relic offers;
replacement;
fallback;
Merchant;
Forge;
Crossroads;
Camp;
Pact.
Do not create combat-per-turn authority.
Finalize
Preserve the existing atomic finalize behavior.
Do not invent unresolved M3 systems such as:
final score;
lives;
victory/defeat policy;
extract policy.
If current real ruleset finalization lacks those canonical values, keep the documented provisional/local behavior and record the M3 dependency.
Workstream 6 — Real HTTP/Wrangler/D1 E2E
Add real local E2E coverage using v08-meta-1.
Required scenarios include:
Bootstrap start
start creates AWAITING_STARTING_RELIC;
response contains a bootstrap token;
response does not require room directive fields;
exact start retry is equivalent;
conflicting start retry is rejected;
restart preserves start retry.
Starting relic
legal starting choice;
invalid choice;
fake relic ID;
fake build payload;
wrong offer ID;
wrong bootstrap nonce;
stale revision;
wrong ruleset hash;
room token used as bootstrap token;
bootstrap token used as room token;
exact selection retry;
conflicting selection retry;
retry after Worker restart;
first directive remains identical.
Atomicity
failed relic selection leaves offer unconsumed;
failed directive generation rolls back relic acquisition;
failed persistence leaves no partial revision;
duplicate request creates only one first directive;
concurrent conflicting choices commit at most one result.
Real lifecycle
first room checkpoint;
next sequential room;
relic reward;
replacement transaction;
fallback reward;
Merchant;
Forge Temper;
Forge Transmute;
Crossroads;
Camp;
Pact;
restart during run;
compact retry within ring;
explicit error outside retained ring;
atomic finalize;
exact finalize retry;
leaderboard entry created once.
Fail-closed registry
unknown ruleset ID;
unknown hash;
mismatched ID/hash;
production activation rejected;
fixture ruleset cannot silently replace the real ruleset.
Use real Wrangler and D1 for persistence-specific tests.
Do not replace them with mocks.
Internal commits
Use separate local commits.
M2B.1
Implement authenticated Online v3 run bootstrap boundary
Contains:
canonical bootstrap state;
bootstrap token type;
verification;
pure-domain transitions;
unit/property tests.
M2B.2
Add Online v3 starting relic bootstrap transition
Contains:
authenticated starting selection;
atomic first-directive generation;
compact retry reconstruction;
concurrency/restart tests.
M2B.3
Wire v08-meta-1 into local Worker runtime
Contains:
start/event/checkpoint/finalize dispatch;
local release-candidate routing;
HTTP contract tests.
M2B.4
Add real ruleset Wrangler and D1 lifecycle tests
Contains:
full real-ruleset E2E;
persistence;
restart;
concurrency;
rollback;
finalize coverage.
Final documentation
Complete Online v3 authenticated runtime milestone
Contains only:
handoff;
M2B documentation;
CURRENT status;
no runtime changes.
Do not squash previous M2 commits.
Allowed paths
Only where required:
cloudflare/leaderboard-v3/src/**;
Worker/ruleset tests;
Wrangler/D1 local test harness;
token and HTTP contract schemas;
generated manifests only when source inputs genuinely change;
scripts/verify-online-v3.mjs only when registering stable tests;
relevant package scripts;
docs/ONLINE_V3_*;
docs/tasks/CURRENT.md;
ONLINE_V3_HANDOFF.md.
Out of scope
Do not modify:
game client;
game.js;
index.html;
CSS;
rendering;
audio;
HUD;
cheat menu;
Observer Bot;
special rooms;
Ranked UI;
client networking;
leaderboard UI;
final score design;
lives;
victory/defeat/extract design;
accounts/profile systems;
production activation;
production D1;
Cloudflare deployment;
Pages integration;
protected Vault Guardian WIP.
Do not start M3.
Stop conditions
Stop instead of guessing if:
bootstrap cannot be represented without breaking existing token security;
starting relic selection requires client changes;
the first directive cannot be deterministically retained for retry;
exact retry would depend on latest mutable state;
existing endpoint schemas cannot safely distinguish bootstrap from room operations;
real finalization requires unresolved M3 rules;
a destructive D1 migration is required;
production activation would be enabled;
protected WIP would be touched.
Verification
During development:
npm run verify:fast
Before each internal commit, run targeted tests.
Before milestone completion:
npm run verify:phase
npm run verify:baseline
npm run verify:full
git diff --check
Final verification must include:
bootstrap token tests;
token-kind separation;
exact/conflicting retry;
compact v2 reconstruction;
Worker restart;
concurrent starting choices;
atomic rollback;
real ruleset HTTP contracts;
real Wrangler/D1 lifecycle;
registry fail-closed;
all existing ruleset fixtures/property tests;
protected-files guard;
headed baseline smoke.
Acceptance criteria
M2B is complete only when:
a real run starts without a fake room directive;
the run enters an explicit pre-room bootstrap state;
the starting relic is selected through an authenticated canonical operation;
the transition is atomic;
the first room directive is deterministic;
exact retry reproduces the original first directive and token;
conflicting retry is rejected;
retry survives Worker restart;
existing local endpoints execute the real ruleset;
the exact ruleset hash remains bound to the run;
production activation remains blocked;
real HTTP/Wrangler/D1 lifecycle passes;
fixture tests remain available explicitly;
game/client remain untouched;
protected 172-path WIP has zero delta;
all verification commands pass;
no push or deployment occurred.
Final report
Report concisely:
M2B commit hashes;
bootstrap state model;
bootstrap token version and fields;
token-kind separation;
starting relic transition;
first-directive generation;
exact retry reconstruction;
concurrency result;
restart result;
real endpoints wired;
real E2E scenario count;
ruleset state and hash;
verify:phase;
verify:baseline;
verify:full;
protected WIP delta;
confirmation that game/client/production were untouched;
remaining M3 dependency.
After the final documentation commit, stop.
Do not push, deploy or begin M3.
