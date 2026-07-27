# Milestone M3 — Canonical Run Completion, Outcome & Scoring

## Status

Completed locally on 2026-07-27.

Do not begin client integration or deployment automatically.

## Completion record

- `d7a0071` — canonical lives and outcome state.
- `ee2de2c` — canonical server duration and `v08-score-1`.
- `6b01106` — terminal boundary and atomic real-ruleset finalization.
- `61a0f89` — canonical leaderboard publication, detail, ordering and cursor.
- `d042f53` — real Wrangler/D1 completion lifecycle and rollback coverage.
- Source audit: `docs/ONLINE_V3_M3_SOURCE_AUDIT.md`.
- Milestone report: `docs/ONLINE_V3_M3.md`.
- Ruleset hash changed from
  `sha256:58528474cf072fbeddfc68a29c1eda00414996cd8fb4ea2871e0b954a1f95276`
  to
  `sha256:08f023da2700e76e862d7adec7045dc8aa6e931b5c97976d955182aa19f2cebb`.
- Final verification: phase 656/656, baseline guard 3/3 plus headed smoke,
  full 678/678 including local Wrangler/D1 19/19.
- M4 was not started.

## Objective

Implement the complete canonical end-of-run contract for the real `v08-meta-1` ruleset.

M3 must define and implement:

- canonical lives;
- death and continuation semantics;
- victory;
- defeat;
- extraction, only if supported by v0.8;
- final run outcome;
- canonical score;
- final duration;
- final build and run summary;
- atomic finalization;
- single leaderboard publication;
- deterministic exact retry.

Required end state:

> A real local `v08-meta-1` run can reach a canonical terminal state, finalize atomically and create exactly one leaderboard entry through the real Worker and D1 runtime.

The game client remains untouched.

---

## Starting state

Expected repository state includes M2B commits:

- `80b8edf` — authenticated bootstrap boundary;
- `90a597c` — atomic starting-relic transition;
- `87c3da9` — local real-ruleset Worker runtime;
- `4963754` — real Wrangler/D1 lifecycle;
- `f5b1dc8` — M2B documentation.

Current ruleset hash:

`sha256:58528474cf072fbeddfc68a29c1eda00414996cd8fb4ea2871e0b954a1f95276`

Current behavior:

- real `v08-meta-1` run start works locally;
- starting relic bootstrap works;
- first room directive is deterministic;
- room lifecycle and meta-transactions work;
- compact idempotency v2 works;
- finalize currently fails closed with:
  `REAL_RULESET_FINALIZATION_REQUIRES_M3`;
- fixture runtime remains separate;
- production activation remains blocked;
- game and client remain untouched.

There are exactly 172 protected unrelated Vault Guardian deletions.

They must remain:

- unchanged;
- unstaged;
- outside every M3 commit;
- identical in path set and content fingerprint.

---

## Required context

Read:

1. `AGENTS.md`;
2. `ONLINE_V3_HANDOFF.md`;
3. `cloudflare/leaderboard-v3/AGENTS.md`;
4. this file;
5. baseline v0.8 code related to:
   - player lives;
   - death;
   - resurrection or continuation;
   - Final Defeat;
   - victory;
   - depth 100;
   - extraction or run abandonment;
   - score;
   - run duration;
   - final summary;
6. current Worker finalize implementation;
7. leaderboard entry schema;
8. compact idempotency v2;
9. real-ruleset Wrangler/D1 lifecycle tests.

Do not infer missing behavior from Ranked v2.

Use active v0.8 source evidence.

---

# Workstream 1 — End-of-run source audit

Before implementation, inventory every active v0.8 rule related to:

- starting lives;
- maximum lives;
- life loss;
- death prevention;
- resurrection;
- relic or mutator effects on lives;
- terminal defeat;
- final boss victory;
- depth 100 completion;
- extract/quit/abandon behavior;
- score calculation;
- score modifiers;
- gold contribution;
- depth contribution;
- time contribution;
- boss or elite contribution;
- build summary;
- run statistics;
- leaderboard fields.

For each rule document:

- source file;
- symbol/function;
- trigger;
- canonical inputs;
- calculation order;
- rounding;
- caps;
- mutator/relic interaction;
- authority classification;
- whether exact server derivation is possible.

Stop instead of guessing where evidence is ambiguous.

---

# Workstream 2 — Canonical lives ledger

Implement canonical lives as part of run meta-state.

The server must derive:

- initial lives;
- maximum lives;
- current lives;
- life gains;
- life losses;
- death-prevention effects;
- terminal defeat.

Client input may report only a bounded, classified room/combat result required by the existing authority matrix.

The client must not provide authoritative:

- current lives;
- maximum lives;
- life delta;
- death count;
- terminal defeat;
- resurrection result.

Use existing canonical relic and run-modifier effects.

Do not create a second build or effect evaluator.

## Required transitions

Implement pure transitions for confirmed v0.8 behavior, such as:

- room completion without death;
- nonterminal death;
- life loss;
- prevented death;
- life gain;
- terminal defeat.

Exact names should follow project conventions.

Every transition must be:

- immutable;
- revision-bound;
- state-digest-bound;
- idempotent;
- restart deterministic;
- atomic.

---

# Workstream 3 — Canonical outcome state machine

Define explicit run states.

Conceptually:

```text
ACTIVE
→ VICTORY_ELIGIBLE
→ DEFEAT_ELIGIBLE
→ EXTRACTION_ELIGIBLE
→ FINALIZED
Use names matching the existing architecture.
At minimum distinguish:
active run;
terminal victory;
terminal defeat;
valid extraction;
abandoned/invalid run, if required;
finalized run.
A run must not finalize merely because the client claims an outcome.
The ruleset must derive eligibility from canonical state.
Victory
Confirm and implement:
required depth;
final boss completion;
required room/reward completion;
terminal transition timing.
Defeat
Confirm and implement:
zero-lives behavior;
Final Defeat eligibility;
pending reward or transaction behavior;
whether unfinished transactions must block finalization.
Extraction
Implement only if active v0.8 evidence supports a real extraction mechanic.
Do not invent extraction solely because the endpoint has an outcome field.
If no active extraction exists, document:
EXTRACTION_NOT_SUPPORTED_BY_V08
and reject it fail-closed.
Workstream 4 — Canonical duration
Define canonical run duration.
Audit whether existing infrastructure already tracks:
server start time;
checkpoint timestamps;
monotonic elapsed time;
pause time;
disconnected time;
client-reported gameplay time.
Prefer server-derived duration based on persisted timestamps.
Document:
start timestamp;
final timestamp;
precision;
pause/disconnect treatment;
maximum allowed duration;
clock-skew behavior;
retry behavior.
Client-reported duration may be telemetry only unless source evidence requires otherwise.
Exact retry must reproduce the original finalized duration.
Workstream 5 — Canonical score
Implement one versioned score projector:
deriveFinalScoreV08(...)
or equivalent.
It must be the only canonical source for leaderboard score.
Audit and include only confirmed v0.8 components.
Potential inputs must be validated from source evidence:
depth;
victory/defeat;
gold;
elites;
bosses;
lives remaining;
relic/build state;
mutators;
duration;
room outcomes;
challenge modifiers.
Do not invent score bonuses.
Requirements
explicit score version;
deterministic calculation;
explicit calculation order;
explicit rounding;
integer final score;
bounded numeric range;
no client-provided score;
property tests for overflow and negative inputs;
exact retry stability;
restart stability.
If v0.8 has no complete existing score formula, stop and report the unresolved components rather than designing a new scoring system without user approval.
Workstream 6 — Final summary projection
Build canonical immutable final projections.
Build summary
Include where applicable:
relic IDs and stacks;
rarity;
slot usage and limit;
run modifiers;
skill tiers;
elixirs;
canonical build digest.
Do not include assets, HTML or presentation strings.
Run summary
Include where confirmed:
outcome;
final depth;
score;
gold earned/spent/final;
duration;
lives;
rooms completed;
bosses;
elites;
relevant transaction counts;
ruleset ID/hash;
score version.
Separate:
private/internal summary;
public leaderboard summary;
detailed leaderboard build projection.
Do not expose private anti-abuse or anomaly internals.
Workstream 7 — Atomic finalize
Replace REAL_RULESET_FINALIZATION_REQUIRES_M3 with real canonical finalization.
A successful finalize must atomically:
authenticate the current boundary token;
verify run/ruleset/hash/revision/state digest;
verify canonical terminal eligibility;
reject unfinished blocking offers or transactions where required;
derive outcome;
freeze duration;
derive final score;
create immutable final build summary;
create immutable run summary;
mark run finalized;
create exactly one leaderboard entry;
write compact idempotency v2 history;
persist all changes atomically.
No partial state may remain after failure.
Exact retry
Exact finalize retry must return the original:
status;
outcome;
score;
duration;
final revision;
leaderboard entry identity;
build summary;
run summary.
It must not recalculate using current time or latest state.
Conflicting retry
The same operation ID with another payload or claimed outcome must fail as a conflicting retry.
Post-finalization
Reject:
further checkpoints;
further events;
further transactions;
second finalization with a different request;
build mutations.
Workstream 8 — Leaderboard publication
Use the existing leaderboard tables and endpoint contracts.
Do not introduce accounts or profiles.
Ensure:
exactly one entry per finalized run;
score comes only from canonical score projection;
outcome comes only from canonical state;
ruleset ID/hash is persisted;
score version is persisted or reconstructible;
build summary is immutable;
public details do not trust client JSON;
leaderboard retry does not create duplicates;
concurrent finalize creates at most one entry.
Audit cursor and ordering behavior.
Define tie-breaking deterministically using existing schema capabilities.
Do not silently change public leaderboard ordering without documentation and tests.
Workstream 9 — Real HTTP/Wrangler/D1 lifecycle
Extend the real-ruleset E2E suite.
Required scenarios include:
Lives
initial lives;
ordinary room without life loss;
life loss;
prevented death, if supported;
life gain, if supported;
nonterminal death;
terminal defeat;
fake client lives rejected/ignored;
exact retry;
restart persistence.
Victory
premature victory rejected;
final-depth requirements;
final boss completion;
valid victory eligibility;
valid victory finalization.
Extraction
valid extraction, if supported;
invalid extraction;
extraction explicitly rejected when unsupported.
Finalization
nonterminal finalize rejected;
pending blocking transaction rejected;
valid defeat finalize;
valid victory finalize;
valid extraction finalize, if supported;
exact finalize retry;
conflicting retry;
retry after Worker restart;
concurrent duplicate finalize;
concurrent conflicting finalize;
rollback after simulated D1 failure;
no partial leaderboard entry.
Scoring
deterministic score;
score modifier behavior;
rounding boundary;
overflow boundary;
fake client score ignored;
same canonical run gives same score after restart.
Leaderboard
entry created exactly once;
public summary matches canonical final state;
details match canonical build;
ordering and tie-break;
cursor remains valid;
finalized run cannot mutate;
unknown ruleset/hash fail closed.
Use real local Wrangler and D1 for persistence and concurrency cases.
Internal commits
Use larger logical commits.
M3.1
Implement Online v3 canonical lives and outcome state
Contains:
source audit;
lives ledger;
outcome state machine;
pure-domain tests.
M3.2
Implement Online v3 canonical duration and scoring
Contains:
duration policy;
score projector;
final projections;
golden/property tests.
If the score formula is unresolved, stop before this commit and report the exact missing evidence.
M3.3
Implement atomic Online v3 real-ruleset finalization
Contains:
finalize domain transition;
compact retry reconstruction;
post-finalization guards;
Worker runtime integration.
M3.4
Publish canonical Online v3 leaderboard results
Contains:
leaderboard persistence;
public summary/details;
duplicate/concurrency protection;
ordering tests.
M3.5
Add Online v3 finalization Wrangler and D1 lifecycle coverage
Contains:
real HTTP/D1 finalization scenarios;
restart;
concurrency;
rollback;
scoring and leaderboard E2E.
Final documentation
Complete Online v3 run finalization milestone
Contains only:
M3 documentation;
short handoff update;
CURRENT status;
no runtime code.
Allowed paths
Only where required:
cloudflare/leaderboard-v3/src/**;
Worker and ruleset tests;
real Wrangler/D1 test harness;
leaderboard contracts and projections;
generated ruleset data only if canonical source inputs change;
verification registration where necessary;
docs/ONLINE_V3_*;
docs/tasks/CURRENT.md;
ONLINE_V3_HANDOFF.md.
Out of scope
Do not implement:
game-client integration;
game.js;
Ranked UI;
loading screen;
reward UI;
network client;
accounts;
profiles;
global unlock synchronization;
production activation;
remote D1 migration;
deployment;
Cloudflare Pages integration;
anti-cheat beyond existing authority model;
new gameplay mechanics;
redesigned score not evidenced by v0.8;
M4 client integration.
Do not touch protected Vault Guardian WIP.
Stop conditions
Stop instead of guessing if:
v0.8 has no unambiguous score formula;
life-loss behavior cannot be derived canonically;
victory conditions are ambiguous;
extraction is not confirmed;
duration semantics require client authority;
finalization needs game-client changes;
leaderboard schema cannot retain required immutable data safely;
a destructive D1 migration is required;
protected WIP would be touched;
production activation would become possible.
A documented partial M3 is preferable to invented scoring or outcome rules.
Verification
During development:
npm run verify:fast
Before every internal commit, run targeted tests.
Before milestone completion:
npm run verify:phase
npm run verify:baseline
npm run verify:full
git diff --check
Final verification must include:
source-evidence completeness;
lives ledger;
terminal-state invariants;
duration determinism;
score golden fixtures;
score property tests;
exact/conflicting finalize retry;
restart;
concurrency;
atomic rollback;
leaderboard uniqueness;
real Wrangler/D1 lifecycle;
registry fail-closed;
all existing ruleset tests;
protected-files guard;
headed baseline smoke.
Acceptance criteria
M3 is complete only when:
lives are canonical and server-derived;
victory and defeat eligibility are canonical;
extraction is either implemented from evidence or explicitly unsupported;
duration is deterministic and frozen at finalization;
score is versioned and derived only from canonical state;
final build and run summaries are immutable;
finalize is atomic;
exact retry reproduces the original final result;
conflicting retry is rejected;
concurrent finalize creates at most one result;
exactly one leaderboard entry exists per finalized run;
finalized runs cannot mutate;
real HTTP/Wrangler/D1 finalization passes;
production remains blocked;
game/client remain untouched;
protected 172-path WIP has zero delta;
all verification commands pass;
no push or deployment occurred.
Final report
Report concisely:
M3 commit hashes;
canonical lives rules;
outcome state machine;
victory requirements;
defeat requirements;
extraction status;
duration policy;
score formula and version;
score source evidence;
final build/run projections;
finalize atomicity;
retry and concurrency results;
leaderboard uniqueness;
real E2E scenario count;
ruleset hash before/after;
verify:phase;
verify:baseline;
verify:full;
protected WIP fingerprint/delta;
confirmation that game/client/production were untouched;
next recommended milestone without starting it.
After the final documentation commit, stop.
Do not push, deploy or begin M4.
