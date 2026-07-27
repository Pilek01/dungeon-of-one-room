# Milestone M4 — Online v3 Client Integration

## Status

Complete locally.

Implementation commits:

- `4cd353b` — isolated Online v3 client transport;
- `7a43dcc` — Ranked bootstrap and canonical directives;
- `a6c648c` — canonical rewards and meta-transactions;
- `4c76ccb` — canonical lives and terminal run flow;
- `1fa8e4b` — leaderboard and public build details;
- `d7eaf33` — real local Worker/D1 headed lifecycle coverage.

Final verification is run against the documentation commit at the end of M4.

Do not begin staging, production activation or deployment automatically.

## Objective

Integrate the completed Online v3 backend and real `v08-meta-1` ruleset with the browser game while preserving the original v0.8 Practice experience.

M4 must implement:

- an isolated Online v3 browser client;
- Ranked run start and authenticated bootstrap;
- starting relic selection;
- canonical room directives and checkpoints;
- canonical rewards and meta-transactions;
- canonical lives and terminal states;
- atomic finalization;
- leaderboard and build-detail UI;
- deterministic retry, reconnect and network-loss handling;
- headed end-to-end coverage for a complete Ranked lifecycle.

Required end state:

> Practice remains behaviorally identical to v0.8 and performs zero Online v3 requests, while Ranked can complete a full canonical run lifecycle against the local Worker through the real `v08-meta-1` ruleset.

M4 is a client-integration milestone.

It may modify explicitly authorized game-facing files, but it must not redesign or replace the existing game engine.

---

## Starting state

Expected repository state includes M3 commits:

- `d7a0071` — canonical lives and outcome state;
- `ee2de2c` — canonical duration and scoring;
- `6b01106` — atomic real-ruleset finalization;
- `61a0f89` — canonical leaderboard publication;
- `d042f53` — finalization Wrangler/D1 lifecycle;
- `7802927` — M3 documentation and handoff.

Current ruleset hash:

`sha256:08f023da2700e76e862d7adec7045dc8aa6e931b5c97976d955182aa19f2cebb`

Current backend capabilities:

- authenticated `run_bootstrap` token;
- authenticated `room_checkpoint` token;
- authenticated `run_terminal` token;
- real `v08-meta-1` local runtime;
- starting relic offer;
- deterministic room directives;
- canonical reward envelopes;
- relic offers and replacement;
- Warden, Otter and Arena rewards;
- Merchant;
- Forge Temper and Transmute;
- Crossroads;
- Camp;
- Pact;
- canonical lives;
- victory, defeat and extraction;
- canonical duration and scoring;
- atomic finalization;
- immutable leaderboard publication;
- compact idempotency v2;
- exact retry, restart and concurrency protection.

Production activation remains blocked.

There are exactly 172 unrelated protected Vault Guardian deletions in the working tree.

They must remain:

- unstaged;
- unmodified;
- outside every M4 commit;
- identical in path set and content fingerprint.

Before any implementation, record:

- the exact set of 172 paths;
- their fingerprint;
- staged protected-path count;
- current HEAD;
- current ruleset hash.

---

## Required context

Read:

1. `AGENTS.md`;
2. `ONLINE_V3_HANDOFF.md`;
3. `cloudflare/leaderboard-v3/AGENTS.md`;
4. this file;
5. existing Online v3 client modules, even if currently inactive;
6. game boot and mode-selection code;
7. current loading screen and leaderboard inventory from previous Online versions;
8. active v0.8 room-generation and reward UI code;
9. current Worker HTTP contracts;
10. token kinds and compact retry semantics;
11. `docs/ONLINE_V3_M2B.md`;
12. `docs/ONLINE_V3_M3.md`;
13. baseline smoke runner;
14. existing browser/headed test harness.

Do not use Ranked v2 logic as a source of authority.

Ranked v2 UI assets or presentation components may be reused only after auditing that they do not carry stale v2 state or protocol behavior.

---

# Core architecture boundary

## Practice

Practice remains the untouched local v0.8 game.

Practice must:

- generate rooms locally;
- generate rewards locally;
- use the existing local save/Continue behavior;
- use existing local lives and finalization behavior;
- perform zero `/api/v3` requests;
- not instantiate the Online v3 transport;
- not require Worker availability;
- remain playable offline.

## Ranked

Ranked uses canonical Online v3 meta-progression.

Ranked must obtain from the Worker:

- starting offer;
- room directives;
- reward offers;
- transaction choices;
- lives;
- terminal eligibility;
- score;
- final summary;
- leaderboard result.

Ranked combat remains locally simulated according to the existing authority classification.

Do not introduce requests during:

- movement;
- attacks;
- enemy AI;
- turn animation;
- VFX;
- audio playback;
- rendering;
- hover/tooltips;
- ordinary UI repaint.

Network operations are allowed only at explicit meta-boundaries.

## No second game engine

Do not fork or duplicate the gameplay engine.

Practice and Ranked should share existing presentation and combat code.

Add a narrow Ranked adapter around meta-progression boundaries.

Avoid large conditional branches spread throughout `game.js`.

Prefer isolated modules and a small number of explicit hooks.

---

# Workstream 1 — Client architecture and transport

## Goal

Create an isolated, testable Online v3 client layer.

Preferred structure may resemble:

```text
online-v3/
  client/
  runtime/
  adapters/
  ui/
Use the existing repository conventions where possible.
Transport responsibilities
Implement one transport abstraction responsible for:
Worker base URL;
request serialization;
operation IDs;
request digests where client-side generation is required;
timeouts;
abort handling;
HTTP error parsing;
exact retry;
conflicting retry display;
bounded retry policy;
offline detection;
reconnect;
structured logging;
redaction of tokens and secrets.
Do not scatter raw fetch() calls throughout gameplay code.
Token handling
Support and distinguish:
run_bootstrap;
room_checkpoint;
run_terminal.
The client must never reinterpret one token kind as another.
Token values may be held only in Ranked runtime state.
Do not store signed tokens in:
global debug logs;
leaderboard display;
DOM data attributes;
local analytics;
crash messages shown to players.
Operation identity
A logical user action must retain the same operationId across retry.
Examples:
selecting starting relic;
resolving room checkpoint;
selecting reward;
committing replacement;
Merchant purchase;
Forge action;
finalization.
A retry must not create a new logical operation ID.
A genuinely new user choice must use a new operation ID.
Workstream 2 — Ranked session state
Implement an explicit client-side Ranked session state machine.
Conceptually:
IDLE
→ STARTING_RUN
→ AWAITING_STARTING_RELIC
→ ENTERING_ROOM
→ ROOM_ACTIVE
→ RESOLVING_ROOM
→ AWAITING_REWARD_OR_TRANSACTION
→ ENTERING_NEXT_ROOM
→ TERMINAL_PENDING
→ FINALIZING
→ FINALIZED
Add explicit states for:
retrying;
reconnect required;
unrecoverable protocol error;
abandoned local session.
Use names matching project conventions.
The UI must derive allowed actions from the state machine.
Do not rely on loosely related booleans such as:
isOnline
waiting
pendingReward
networkBusy
without one canonical session state.
Ranked runtime snapshot
Store only the minimum client runtime data required to resume/retry:
run ID;
ruleset ID and exact hash;
current revision;
current token and token kind;
current operation ID when pending;
canonical public projection;
active directive;
active offer/transaction projection;
last acknowledged response identity;
connection state.
Do not treat locally stored build, gold, lives or score as canonical.
Workstream 3 — Ranked mode entry and start
Mode selection
Add a clear entry point for:
Practice;
Ranked Online v3.
Do not remove existing Practice entry points.
Ranked must be visibly marked as requiring a connection.
Do not call the API merely because the game booted or the main menu opened.
Worker availability
Before starting Ranked:
allow an explicit lightweight availability check only when the player selects Ranked;
show a clear error when the local/staging Worker is unavailable;
allow returning to Practice;
do not block the entire game boot.
Start flow
Implement:
Player selects Ranked
→ create stable start operation ID
→ POST real run/start
→ receive AWAITING_STARTING_RELIC state
→ show canonical starting relic offer
→ select opaque choice ID
→ submit authenticated bootstrap operation
→ receive first canonical room directive and room token
→ enter the first room
The client must not locally choose:
starting relic candidates;
first room type;
depth;
room nonce;
directive ID;
initial lives;
initial gold.
Start retry
Cover:
lost start response;
start timeout;
duplicate click;
reload while start request is unresolved;
exact retry after Worker restart;
conflicting start state.
Never create two runs from one intentional start action when an exact retry is possible.
Workstream 4 — Directive adapter
Goal
Translate canonical room directives into the existing local room setup without replacing the game engine.
Create one explicit adapter, conceptually:
applyOnlineV3RoomDirective(...)
It should map canonical directive data into the minimum existing setup inputs.
The adapter must not:
reroll the room locally;
substitute another special room;
change depth;
change boss identity;
change reward source;
silently fall back to local generation.
Supported directive categories
Audit and support all directive kinds used by v08-meta-1, including:
regular combat;
elite;
boss;
final boss;
Shrine;
Vault;
Merchant;
Forge;
Crossroads;
Camp;
Pact;
other active special rooms present in the canonical ruleset.
Use source evidence and current directive contracts.
If a directive cannot be represented by the current game without changing gameplay semantics, stop and report the exact mismatch.
Local combat
During an active combat room:
local combat logic runs normally;
animations remain local;
AI remains local;
no network request occurs per turn.
At the canonical room boundary, the client submits only the documented bounded outcome/attestation required by the Worker.
Do not submit a full arbitrary game-state patch.
Workstream 5 — Room completion and checkpoint lifecycle
At room completion:
freeze local room-result input;
create one stable operation ID;
show a resolving state;
submit the canonical checkpoint/event request;
process the server response;
display any canonical reward or transaction;
receive the next directive or terminal token;
continue only after canonical acknowledgement.
Duplicate actions
Disable or safely deduplicate:
double portal clicks;
double reward clicks;
repeated Merchant purchases;
repeated Forge confirmations;
double finalize clicks.
UI disabling is not the security boundary.
The server remains authoritative through operation identity and revision binding.
Lost responses
When the request may have committed but the response was lost:
retain the original operation ID;
resend the exact request;
accept reconstructed response;
do not rerun local room completion;
do not locally award rewards twice;
do not advance to another room before acknowledgement.
Workstream 6 — Canonical reward UI
Implement adapters for existing UI surfaces using server-provided projections.
Required flows:
starting relic;
regular relic offer;
Warden relic offer;
Otter relic offer;
Arena relic offer;
canonical replacement transaction;
no-reward result;
fallback gold;
other currently supported canonical reward envelopes.
Rules
The UI must render:
public IDs and display metadata mapped from the local catalog;
opaque choice IDs;
canonical stack information;
canonical slots and limits;
canonical replacement candidates;
canonical fallback outcome.
The client must not calculate legal choices independently.
Local catalog metadata may provide:
name;
icon;
description;
rarity presentation.
Local metadata must not alter:
availability;
choice count;
stack amount;
legality;
gold delta;
slot limit.
Replacement
When the server returns a pending replacement:
show only canonical legal replacement choices;
submit only the opaque replacement choice ID;
preserve the incoming choice and transaction ID;
support exact retry;
respect canonical cancel behavior;
do not mutate local build before server commit.
Workstream 7 — Meta-transaction UI
Integrate all completed M1 systems:
Merchant;
Forge Temper;
Forge Transmute;
Crossroads;
Camp;
Pact.
Use one shared transaction adapter where practical.
Transaction lifecycle
Conceptually:
canonical preflight
→ render canonical choices/costs/effects
→ player submits opaque choice
→ server commit
→ apply returned public projection
Do not calculate or commit effects locally before acknowledgement.
Merchant
Render canonical:
inventory;
price;
affordability;
purchase result;
resulting gold/build state.
Do not trust existing local Merchant prices in Ranked.
Forge
Support:
Temper;
Transmute;
replacement flow where required;
canonical costs;
canonical resulting build.
Crossroads, Camp and Pact
Render only canonical choices and consequences.
Do not reuse local random choice generation in Ranked.
Workstream 8 — Canonical lives and terminal flow
Lives
Ranked HUD must display canonical lives from server projections.
Support visual presentation for:
current lives;
maximum lives;
Chrono Loop prevention;
Second Chance prevention;
canonical life loss;
terminal defeat.
Local animation may present the result, but it must not change canonical life state.
Terminal token
Handle run_terminal separately from room tokens.
When the Worker returns terminal eligibility:
stop normal room progression;
prevent further transactions;
show the appropriate victory, defeat or extraction presentation;
retain the terminal token for finalize.
Finalization
Implement:
terminal state
→ stable finalize operation ID
→ finalize request
→ canonical outcome, score, duration and summary
→ leaderboard entry
Do not calculate score locally.
Do not derive outcome from presentation state.
Retry
A lost finalize response must:
reuse the same operation ID;
reproduce the original final result;
not create another leaderboard entry;
not restart the run.
Workstream 9 — Leaderboard and run details
Integrate the existing Online v3 leaderboard endpoints.
Required UI:
leaderboard list;
pagination/cursor;
loading state;
empty state;
network error state;
run detail view.
Display canonical fields where available:
rank;
player/display name according to current contract;
score;
outcome;
depth;
duration;
final gold;
ruleset/version;
timestamp;
relics and stacks;
run modifiers;
skill tiers;
elixirs;
lives;
public build summary.
Do not expose:
signed tokens;
internal receipts;
request digests;
anomaly flags;
private operation history;
internal state digest unless explicitly part of public diagnostics.
Ordering
Do not reorder leaderboard entries locally beyond the server contract.
Cursor state must be treated as opaque.
Workstream 10 — Recovery and persistence
Define safe recovery behavior for an interrupted Ranked session.
Audit whether the current game can persist a minimal Ranked resume record without conflicting with Practice save data.
Requirements
Practice save data and Ranked recovery data must be separate.
Do not migrate or overwrite Practice saves.
A Ranked recovery record may contain only the client runtime data required for:
exact retry;
reconnect;
fetching or resuming canonical state through supported contracts.
It must not be treated as authoritative game state.
Reload scenarios
Cover:
reload while awaiting starting relic;
reload during a pending checkpoint;
reload while reward choice is displayed;
reload during a pending transaction;
reload after terminal state before finalize;
reload after finalize response was lost.
If the current backend lacks a safe state-resume/read endpoint required for these scenarios, stop and document the exact missing contract instead of inventing local authority.
Do not add an endpoint outside the allowed scope without documenting and testing it.
Workstream 11 — UI/UX and accessibility
Ranked network state must be understandable without overwhelming the player.
Required presentation states:
connecting;
starting;
resolving;
retrying;
offline;
reconnect required;
protocol/ruleset mismatch;
maintenance/unavailable;
finalized.
Do not expose raw JSON or internal error stacks to players.
Keep diagnostic details available in development logs with tokens redacted.
Prevent accidental repeated input while preserving keyboard navigation.
Maintain current responsive behavior where applicable.
Do not redesign the entire game UI in this milestone.
Workstream 12 — Browser and headed E2E
Add headed browser coverage for both Practice and Ranked.
Practice regression
Required:
boot Practice;
zero /api/v3 requests;
Classic mode;
HD mode;
audio;
32 cheat options;
Observer Bot;
Shrine;
Vault Guardian;
save/Continue;
Final Defeat;
local reward flow;
local special-room flow.
Practice must work when the Worker is unavailable.
Ranked bootstrap
select Ranked;
start request;
canonical starting relic choices;
starting relic selection;
first canonical directive;
first room starts;
no requests during active combat animation.
Ranked progression
regular room checkpoint;
next directive;
relic offer;
replacement;
Warden;
Otter;
Arena;
Merchant;
Forge Temper;
Forge Transmute;
Crossroads;
Camp;
Pact.
Where full natural navigation would make E2E excessively long, use approved deterministic test/dev controls that still exercise the real client/Worker contracts.
Do not bypass HTTP or inject final state directly into the UI.
Lives and terminal
life loss;
Chrono Loop or Second Chance presentation where available;
terminal defeat;
victory;
supported extraction;
terminal token handling;
finalize;
final score and summary;
one leaderboard entry.
Network behavior
start response lost;
checkpoint response lost;
reward commit response lost;
transaction response lost;
finalize response lost;
Worker temporary outage;
retry after reconnect;
conflicting retry error;
ruleset mismatch;
stale revision;
duplicate click protection.
Reload/recovery
reload during bootstrap;
reload during pending checkpoint;
reload during reward;
reload before finalize;
reload after lost finalize response.
Only implement scenarios supported safely by canonical recovery contracts.
Internal commits
Use separate logical local commits.
Do not create one enormous commit.
M4.1
Add isolated Online v3 client transport
Contains:
transport;
operation identity;
token handling;
structured errors;
retry/reconnect foundation;
unit tests.
No gameplay integration yet.
M4.2
Integrate Online v3 Ranked bootstrap and directives
Contains:
mode entry;
Ranked session state machine;
run start;
starting relic;
directive adapter;
first-room flow;
Practice isolation tests.
M4.3
Integrate Online v3 rewards and meta transactions
Contains:
relic offers;
replacement;
fallback;
Merchant;
Forge;
Crossroads;
Camp;
Pact;
shared UI transaction adapter.
M4.4
Integrate Online v3 canonical lives and finalization
Contains:
canonical lives presentation;
terminal state;
finalize;
retry/recovery;
final summary.
M4.5
Add Online v3 leaderboard and build details
Contains:
leaderboard list;
cursor;
details;
canonical build display;
loading/error states.
M4.6
Add Online v3 Ranked headed lifecycle coverage
Contains:
headed Practice regression additions;
real local Worker Ranked lifecycle;
network-loss;
duplicate/retry;
reload/recovery tests.
Final documentation
Complete Online v3 client integration milestone
Contains only:
M4 documentation;
short handoff update;
CURRENT status;
no runtime changes.
If M4 becomes too large for one session, stop only at a clean internal commit boundary and update the handoff.
Do not silently reduce acceptance criteria.
Allowed paths
M4 is explicitly authorized to modify only the paths required for client integration, including:
new online-v3/** client/runtime/UI modules;
existing Online v3 client modules;
index.html, only for explicit Ranked loading/integration;
game.js, only for narrow documented Online v3 integration hooks;
existing UI modules directly required for canonical offers and transactions;
relevant CSS for Ranked states and leaderboard;
local catalog/display metadata adapters;
browser/headed tests;
local test/dev harness;
package scripts required for stable verification;
docs/ONLINE_V3_*;
docs/tasks/CURRENT.md;
ONLINE_V3_HANDOFF.md.
Changes to game.js must be minimal and documented by hook.
Do not perform unrelated cleanup or refactoring.
Do not modify gameplay mechanics merely to simplify integration.
Required integration-hook budget
Before editing game.js, create an inventory of planned integration points.
Prefer no more than approximately eight logical hooks:
mode selection/start;
Ranked bootstrap;
room directive application;
room completion/checkpoint;
reward resolution;
special-room transaction resolution;
terminal/finalize;
leaderboard entry/display.
A hook may delegate to isolated modules.
Do not interpret this as a requirement to force exactly eight code edits.
If substantially more hooks are required, stop and explain why before spreading Online v3 logic throughout the game.
Document every modified game.js region:
purpose;
Practice behavior;
Ranked behavior;
network boundary;
tests protecting it.
Out of scope
Do not:
activate production ruleset;
deploy Worker or Pages;
run remote D1 migrations;
modify production secrets;
add accounts;
add login;
add profile cloud saves;
synchronize profile unlocks;
redesign gameplay;
create server-authoritative per-turn combat;
add combat requests;
redesign score;
redesign lives;
change canonical backend rules;
modify D1 schema unless a proven client-resume blocker requires a separately documented decision;
rewrite the game engine;
restore or commit Vault Guardian WIP;
begin M5.
Security requirements
Client is untrusted
The client must not become authoritative for:
depth;
room type;
offers;
reward legality;
gold;
build;
relic stacks;
modifiers;
lives;
terminal outcome;
duration;
score;
leaderboard data.
Token safety
redact tokens from logs;
do not put tokens in URLs;
do not expose tokens in DOM;
do not persist more token data than required for recovery;
clear Ranked token state when the run is permanently abandoned or finalized.
Request safety
stable operation ID per logical action;
no automatic mutation retry with a new operation ID;
bounded timeout/retry;
precise handling of 409/stale/conflict responses;
no generic state-patch requests;
fail closed on unknown response kinds.
Content safety
Map server-provided IDs through known local catalogs.
Do not inject untrusted server text as HTML.
Use text-safe rendering.
Stop conditions
Stop instead of guessing if:
canonical directive cannot be represented by current gameplay;
Practice behavior would need to change;
integration requires per-turn network calls;
more than a narrow adapter layer is required in game.js;
current backend lacks a safe recovery contract required for mandatory reload scenarios;
client would need to treat local gold/build/lives as canonical;
an endpoint contract must be changed substantially;
leaderboard identity/display-name behavior is ambiguous;
Ranked v2 assets contain inseparable stale protocol behavior;
a required change touches the protected 172-path WIP;
production activation would be enabled;
a destructive migration is required.
A partial M4 with a precise blocker is preferable to a hidden local-authority fallback.
Verification workflow
During development:
npm run verify:fast
Before each internal commit, run targeted tests for that workstream.
Before final completion:
npm run verify:phase
npm run verify:baseline
npm run verify:full
git diff --check
Required final verification
Must include:
client transport unit tests;
stable operation identity;
exact/conflicting retry;
token-kind handling;
Ranked session state-machine tests;
directive adapter tests;
reward and transaction UI tests;
terminal/finalization tests;
leaderboard UI tests;
XSS/text-safe rendering checks;
reload/recovery tests where supported;
real local Worker/D1 Ranked browser lifecycle;
network-loss headed tests;
all Worker/ruleset regression tests;
Practice baseline smoke;
protected 172-path guard;
zero unexpected console errors;
zero page errors;
git diff --check.
Practice invariants
Practice acceptance is mandatory.
Practice must preserve:
existing boot behavior;
Classic;
HD;
audio;
animations;
HUD;
all 32 cheat options;
Observer Bot;
Shrine;
Vault Guardian;
special rooms;
local rewards;
save/Continue;
Final Defeat;
offline play.
Practice must produce:
zero /api/v3 requests
No Practice regression may be accepted as a temporary M4 compromise.
Ranked invariants
Ranked must:
use real local Worker HTTP;
use the exact run-bound ruleset hash;
use authenticated token kinds;
receive canonical directives;
receive canonical offers;
receive canonical transactions;
display canonical lives;
use canonical finalization;
publish one canonical leaderboard entry;
reuse operation identity on retry;
avoid network requests during active combat;
fail visibly rather than silently switching to Practice/local authority.
Acceptance criteria
M4 is complete only when:
Practice remains behaviorally equivalent to v0.8;
Practice performs zero /api/v3 requests;
Practice works while Worker is unavailable;
Ranked is entered explicitly;
Ranked start and bootstrap use the real Worker;
starting relic selection is canonical;
first room directive is canonical;
Ranked room progression uses server directives;
no per-turn combat networking exists;
rewards are rendered from canonical offers;
replacement uses canonical candidates;
all M1 meta-transactions are integrated;
canonical lives are displayed;
terminal token is handled correctly;
finalize uses canonical score/outcome/duration;
exact finalize retry creates no duplicate entry;
leaderboard and build details render canonical data;
network-loss retries preserve logical operation identity;
reload/recovery is safe for every supported state;
unknown/stale/conflicting responses fail visibly;
real local Ranked browser lifecycle passes;
all existing Worker/ruleset tests remain green;
protected 172-path WIP has zero delta;
production remains blocked;
no push or deployment occurred;
verify:phase, verify:baseline and verify:full pass.
Required documentation
Create:
docs/ONLINE_V3_M4.md
Document:
client architecture;
session state machine;
transport and retry policy;
token storage;
operation-ID lifecycle;
integration hook inventory;
Practice/Ranked separation;
directive adapter;
reward/transaction adapters;
terminal/finalize flow;
leaderboard UI;
recovery behavior;
headed E2E coverage;
unresolved staging blockers.
Update ONLINE_V3_HANDOFF.md as a short current snapshot.
Do not copy full test logs into the handoff.
Final report
Report concisely:
M4 commit hashes;
client module structure;
number and location of game.js integration hooks;
Ranked session states;
token storage and redaction policy;
operation-ID retry policy;
Practice API request count;
Ranked network boundaries;
supported canonical directive types;
integrated reward flows;
integrated meta-transactions;
lives and terminal behavior;
finalization behavior;
leaderboard UI fields;
reload/recovery support;
headed Ranked scenario count;
network-loss scenario count;
verify:phase;
verify:baseline;
verify:full;
ruleset hash before/after;
protected WIP fingerprint/delta;
confirmation that production and deployment were untouched;
unresolved M5 blockers;
next recommended milestone without starting it.
After the final documentation commit, stop.
Do not push, deploy, activate production or begin M5.
