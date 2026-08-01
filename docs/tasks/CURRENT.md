# Online Ranked campaign boundary and test controls repair

## Active status

COMPLETED_LOCALLY; this separate Online-only repair phase is verified. It is explicitly
independent from the HD Warden portal, HD boot, and Ranked score-carry work.
The scope is limited to fresh-campaign reset semantics, canonical Ranked
mutator choices, canonical elixir charge accounting across checkpoints and
fatal events, and a gated deployed-test Observer Bot path. Music is disabled
only in the headed test harness and when the gated test bot is unlocked.

Do not modify `game.js`, Classic, Practice gameplay, Otter, combat authority,
local saves, assets, portal files, D1 schema/data, migrations/backfills, or
production/deploy configuration outside the explicitly listed test-bot hash
injection. Do not push or deploy in this phase.

Authorized paths:

- `docs/tasks/CURRENT.md`;
- `ONLINE_V3_HANDOFF.md`;
- `progress.md`;
- `scripts/build-pages-v3.mjs`;
- `scripts/online-v3-ranked-headed.mjs`;
- `online-v3/ranked-v3-runtime.js`;
- `online-v3/ranked-v3-client.js`;
- `online-v3/ranked-v3-protocol.js`;
- `cloudflare/leaderboard-v3/src/domain/ruleset-runtime.js`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/camp-policy.js`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/life-policy.js`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/reward-policy.js`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/profile-policy.js`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/run-modifiers.js`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/meta-state.js`;
- ruleset release/hash/projection files only when required by the repository
  generator for the above Worker changes;
- focused Online Ranked regression tests under
  `cloudflare/leaderboard-v3/test/` and `tests/`.

Required process: add RED regressions before implementation; preserve old
profiles without new fields; use `resetMetaProgressForFreshStart()` only at a
new campaign boundary through the production bridge; keep Extract -> Camp ->
Start Next Run state intact; account elixir use once and idempotently in the
canonical Worker; expose only server-issued mutator additions; gate the
Observer Bot with a deploy-time password hash and never re-enable global
debug cheats. Verify focused RED/GREEN, syntax, Pages build, headed Ranked
flow with music muted, all repository verification gates required by
`AGENTS.md`, and `git diff --check`. Create one precise local commit. Deploy
requires a separate explicit authorization after verification.

Completion evidence: focused boundary 6/6 and release/R2/boundary 20/20;
verify:fast 51/51; verify:phase 762/762; verify:baseline 3/3 plus headed
smoke; verify:full 786/786 including Wrangler/D1 21/21; headed Ranked lifecycle
PASS; Pages build 3109 files. Candidate hash is
sha256:2ac2eb5499892cc49258c5b674beab846cb41906a5ef86a658d5e90325505a0d;
production hash sha256:d784208aad891119b71c52324cea358997ee376313914d5799affa68c8678ff3
remains retained. No deploy, push, D1 migration, or backfill occurred.

# HD boot renderer synchronization repair

## Active status

COMPLETED_LOCALLY; the first-paint HD regression introduced by c12c08c is
fixed and verified locally. The selected HD presentation is visible while the
asynchronous renderer is pending; a real renderer failure still falls back to
Classic. The fix remains separate from the Warden portal and Ranked score
carry releases, and production was not redeployed.

Confirmed evidence: fresh public `068ed13` sessions report
`DUNGEON_HD_GRAPHICS_ENABLED=true` and `localStorage` without a Classic
override, but remain `canvas=legacy` and without `graphics-hd-ui` for about
8 seconds. Previous production `499a8e5` applied the preference before the
async renderer settled. Do not change portal assets, portal behavior, Classic gameplay, Worker/D1, or
protected Vault Guardian WIP. The only accepted protocol change is the local
candidate/retained hash synchronization listed below.

Authorized paths:

- `game.js` only for the initial graphics-UI synchronization;
- `tests/graphics-toggle.test.js`;
- `tests/hd-main-menu-visibility.test.js`;
- `scripts/capture-hd-final-audit.mjs`;
- `tests/hd-final-audit.test.js`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/data/*.generated.json` and
  `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/data/ruleset-manifest.json`
  only for the generator-required source hash refresh;
- `cloudflare/leaderboard-v3/src/rulesets/releases.js`;
- `cloudflare/leaderboard-v3/test/production-release.test.js`;
- `online-v3/ranked-v3-protocol.js` only for the local candidate hash and
  retained previous hash;
- `ONLINE_V3_HANDOFF.md`;
- `progress.md`;
- this file.

Completion evidence: focused HD tests 13/13 PASS; release and R2
contract tests 14/14 PASS; headed DOM check reports graphics-hd-ui=true,
boot visible, HD brand visible, Classic logo hidden, and no page errors while
the app remains hidden pending renderer settlement. The local candidate
ruleset hash is sha256:d784208aad891119b71c52324cea358997ee376313914d5799affa68c8678ff3;
full verifier: 780/780 including D1 21/21.
the previous deployed hash sha256:7027a84ff06d6d9304e3d8e4343dbd6b3071c8bec734fad10b85981fa92347e8
is retained.

Required verification: focused RED/GREEN boot regression, `node --check`
changed JavaScript, headed HD boot screenshot/DOM check, `npm.cmd run
verify:fast`, `npm.cmd run verify:phase`, clean `npm.cmd run
verify:baseline`, `git diff --check`, and one precise local commit. No push or
deploy without separate explicit authorization.

# Ranked score carry production release

## Active status

COMPLETED_AND_PRODUCTION_VERIFIED; the user explicitly authorized deployment
of the verified Ranked campaign score-carry change in f3764b4. The narrowly
scoped production release is complete and remains separate from the completed
HD Warden portal phase and unrelated protected Vault Guardian WIP.

Required release: promote the verified candidate
sha256:7027a84ff06d6d9304e3d8e4343dbd6b3071c8bec734fad10b85981fa92347e8
as the active production ruleset and the default Pages protocol hash. Retain
sha256:e4175a6cb29f576a3ad85357a433d6595eb7e9d19a6c5f47ed125ecfe9ae538e
and every already released hash for saved-run compatibility. Deploy the exact
verified Worker and Pages bundle only after the release contract passes. Do
not change game.js, combat authority, Practice, Classic, Otter, local saves,
the D1 schema, or historical data; do not migrate or backfill D1.

Authorized paths:

- cloudflare/leaderboard-v3/src/rulesets/releases.js;
- cloudflare/leaderboard-v3/src/production-ruleset-entry.js;
- online-v3/ranked-v3-protocol.js;
- release/protocol tests under cloudflare/leaderboard-v3/test/;
- docs/tasks/CURRENT.md;
- ONLINE_V3_HANDOFF.md;
- progress.md.

Required verification: RED/GREEN release contract, generator check, syntax,
pages:build, verify:fast, verify:phase, clean verify:baseline, and
verify:full. Commit the exact promotion before deployment. Verify Wrangler
authentication, deploy the production Worker first and Pages second, then
independently verify live availability, the public Pages bundle hash, and a
fresh canonical start/abandon smoke. No push or unrelated cleanup.

Completed release: promotion commit
068ed1391570ee06b8eddfc3efe61a3b65efc7de activated
sha256:7027a84ff06d6d9304e3d8e4343dbd6b3071c8bec734fad10b85981fa92347e8.
Worker version 0b81687c-2686-4ecb-b949-c870703cbee8 and Pages production
deployment 4909c859-19b6-4a7f-ac78-f7e9870676e7 are live. Availability and
the public Pages bundle match the promoted protocol/hash; a fresh canonical
start returned 201, its immediate abandon returned 200, and no leaderboard
entry was published. No D1 migration or history backfill occurred. The user
confirmed old test campaigns need no reconstruction and will start a fresh
campaign for testing.
# Ranked campaign Run Score carry repair

## Active status

COMPLETED_LOCALLY; this is a separate canonical Ranked score-carry phase.
The completed HD Warden portal phase and its assets are explicitly out of
scope.

Confirmed cause: legacy v0.8 keeps currentRunId, runMaxDepth, and
runGoldEarned across Extract -> Camp -> Start Next Run, resetting them only
for a fresh or terminally completed campaign. Ranked currently persists the
profile campaign and Camp ledger after Extract, but creates the next canonical
descent with maxDepth = 0 and a fresh run gold ledger. It has no carried
score high-water/earned-gold state, and the public projection/HD bridge derive
the displayed value from the active descent instead of a canonical campaign
score.

Completed outcome: the canonical profile now persists campaign.scoreCarry with
highWaterDepth and earnedGold. A real Extract folds the completed descent into
that carry before profile persistence, and the existing action idempotency
makes an Extract retry retain that single folded state. Public active/terminal
score, finalization, leaderboard entry, HD HUD, and native Ranked
victory/defeat presentation use carry plus the active descent. The exact
regression is 4486 -> 4992; repeated depth traversal adds no depth score and
spent Camp gold does not reduce earned-gold score.

Profiles missing the new field normalize safely, but no request-path guess or
D1 mutation reconstructs their earlier campaign total. The retained finalized
Extract canonical snapshots are sufficient source evidence for a separate,
explicitly approved D1 read/recompute/write backfill grouped by profile and
terminal campaign boundary. No such backfill, migration, push, deploy,
activation, or historical-data alteration occurred here.

Verification completed: RED score suite 0/6 before the implementation;
focused GREEN 22/22; generated ruleset check; pages:build; visible headed
Extract -> Camp -> new-descent score audit; verify:fast 51/51; verify:phase
756/756; clean verify:baseline 3/3 plus headed smoke; and verify:full 780/780
including Wrangler/D1 21/21. Candidate ruleset rotates from
sha256:72072daa1e807a03ffb2c6198b4c126a41fc69be7ae64c1ea8eabd198999b94c
to sha256:7027a84ff06d6d9304e3d8e4343dbd6b3071c8bec734fad10b85981fa92347e8.
Released registry/production remains pinned to
sha256:e4175a6cb29f576a3ad85357a433d6595eb7e9d19a6c5f47ed125ecfe9ae538e.
Source game.js remains byte-identical. Commit 53f7f48 is an isolated
one-file baseline-harness prerequisite; the score change itself remains in its
own exact local commit.

Authorized paths:

- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/meta-state.js`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/profile-policy.js`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/score-policy.js`;
- `cloudflare/leaderboard-v3/src/domain/ruleset-runtime.js`;
- `online-v3/ranked-v3-protocol.js`;
- `scripts/build-pages-v3.mjs`;
- `scripts/online-v3-ranked-headed.mjs` only for the visible
  Extract -> Camp -> new-descent scenario;
- focused score-carry regression coverage under
  `cloudflare/leaderboard-v3/test/`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/data/ruleset-manifest.json`,
  `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/ruleset-hash-policy.js`,
  and `cloudflare/leaderboard-v3/src/rulesets/releases.js` only if the
  repository generator/registry verification proves an update is necessary;
- `ONLINE_V3_HANDOFF.md`;
- `progress.md`;
- this file.

Required verification: preserve an observed RED test result before the
implementation, then run focused GREEN coverage for 4486 -> 4992, no repeated
depth points, cumulative earned gold despite spending, idempotent
Extract/retry, terminal/leaderboard score equality, and legacy-profile
compatibility. Also run syntax checks for changed JavaScript, `npm.cmd run
pages:build`, a headed Extract -> Camp -> new-descent scenario, `npm.cmd run
verify:fast`, `npm.cmd run verify:phase`, `npm.cmd run verify:baseline`,
`npm.cmd run verify:full`, and `git diff --check` before one exact local
commit. `game.js` must remain byte-identical.

# Generator determinism and HD portal test-contract repair

## Active status

`COMPLETED_LOCALLY`; production remains on
`sha256:e4175a6cb29f576a3ad85357a433d6595eb7e9d19a6c5f47ed125ecfe9ae538e`.
The repaired candidate
`sha256:72072daa1e807a03ffb2c6198b4c126a41fc69be7ae64c1ea8eabd198999b94c`
remains local/test-only. No deployment, Worker/D1 mutation, Online routing
activation, gameplay, Classic, or Otter change occurred.

The generator now canonicalizes CRLF/LF text bytes before recording source
provenance and before hashing the ruleset file manifest. Its regenerated
artifacts are identical in the current CRLF checkout and an independently
forced-LF checkout. Canonical rule data is unchanged; only source provenance,
canonical file-byte metadata, and the candidate hash rotate. The released
production descriptor and client protocol remain pinned to `e417`; the local
candidate is not accepted as a released browser hash.

The HD direct-renderer tests now supply the actual `visual.portal.kind`
contract for Vault/Forge. The common-portal fallback remains explicitly tested.
The baseline guard excepts only the thirteen committed Warden HD portal files,
and R2 protocol tests distinguish a local candidate from the released hash.
Authorized paths:

- `scripts/generate-online-v3-meta-rules.mjs`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/data/*.generated.json`
  and `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/data/ruleset-manifest.json`,
  only as deterministically regenerated by that script;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/ruleset-hash-policy.js`;
- `cloudflare/leaderboard-v3/src/rulesets/releases.js`;
- `cloudflare/leaderboard-v3/test/baseline-guard.test.js`;
- `cloudflare/leaderboard-v3/test/phase3a-spec.test.js`;
- `cloudflare/leaderboard-v3/test/ruleset-manifest.test.js`;
- `cloudflare/leaderboard-v3/test/production-release.test.js`;
- `cloudflare/leaderboard-v3/test/r2-protocol-cursor.test.js`;
- `tests/hd-room-assets.test.js`;
- `ONLINE_V3_HANDOFF.md`;
- `progress.md`;
- this file.

Completed outcome and verification: targeted generator, ruleset-manifest,
production-release, R2 protocol, and baseline guard suites pass; full HD room
assets pass 26/26. `verify:fast` passes 51/51, `verify:phase` passes 749/749,
and `verify:baseline` passes 3/3 plus the clean headed game smoke. `git diff
--check` is required immediately before the local commit. No push, deploy,
activation, or next phase.

# HD Warden portal forewarning

## Active status

`COMPLETED_LOCALLY`; production, Worker/D1, Online routing, and the ruleset
remain unchanged. This is one isolated HD presentation phase only.

Authorized paths:

- `assets/hd/objects/warden/portal-*.png`;
- `art/source/warden-portal-hd/warden-portal-hd.lock.json`;
- `render/hd-asset-manifest.js`;
- `render/visual-snapshot.js`;
- `render/hd-renderer-layers.js`;
- `render/hd-lighting.js`;
- `game.js` only for synchronizing HD HUD activation to the actual canvas renderer mode;
- `tests/visual-snapshot.test.js`;
- `tests/hd-lighting.test.js`;
- `tests/warden-portal-hd.test.js`;
- `tests/graphics-toggle.test.js`;
- `scripts/online-v3-ranked-headed.mjs`;
- `scripts/capture-graphics-toggle-qa.mjs`;
- `ONLINE_V3_HANDOFF.md`;
- `progress.md`;
- this file.

Completed outcome: when the next room is a Warden room, the existing HD portal
keeps its ordinary shell, scale, timing, and motion while its interior is
red/crimson. Local HD derives this only from the ordinary boss-depth boundary;
Ranked HD derives it only from the issued canonical `boss`/`final` directive,
without exposing that directive or inferring it from local depth. The normal
blue portal and every Otter asset/behavior remain unchanged. The sole
`game.js` exception makes HD HUD activation follow the actual canvas renderer
through loading, fallback, and runtime switching, so the player cannot see HD
HUD over a Classic canvas. Classic remains untouched.

Verification: focused portal, snapshot, lighting, and graphics-toggle coverage
passed 33/33; local headed pre-Warden HD audit and full headed Ranked lifecycle
passed. `verify:baseline` passed 3/3 plus clean headed baseline and Ranked
smokes. `verify:fast` and `verify:phase` halt before tests on the pre-existing
`GENERATED_FILE_DRIFT` for
`cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/data/source-manifest.generated.json`,
reproduced in clean `HEAD`; no ruleset generation/write was performed.
`tests/hd-room-assets.test.js` also has two pre-existing stale portal-input
failures, reproduced in clean `HEAD`; it remains unchanged. `git diff --check`
passed. No push, deploy, activation, or next phase.

# Ranked Warden checkpoint resource-settlement hotfix

## Active status

`COMPLETED_AND_PRODUCTION_VERIFIED`; player reproduction and a local Worker
probe confirmed that a Ranked room checkpoint containing the bounded
`potion-use` claim was settled correctly, then rejected by the older room-layer
build immutability guard with `PHASE_3B2A_META_SCOPE_VIOLATION`. A depth 5
Warden checkpoint without that claim succeeded.

The room-layer guard now snapshots the canonical build after validated reward
settlement and still rejects any later room-layer build mutation. The current
ruleset is rotated while the production R2 hash remains registered for saved
runs through a closed released-hash allowlist. Focused Worker/HTTP/client
regressions, headed Warden QA with potion use,
the 31-scenario threat matrix, `verify:fast` 51/51, `verify:phase` 748/748,
`verify:baseline` 3/3 plus headed smoke, and `verify:full` 772/772 including
Wrangler/D1 21/21 all pass.

Implementation commit `499a8e540cba6374a93f6fac003642dfbb02ba0e` is
active in production. Worker deployment
`fdc2cb95-b5df-4deb-93dd-b08a642bdc73` is at 100%, and the clean Pages
deployment is `5797e57c-8d9d-4977-9f06-d25d74704dce`. Independent production
smokes passed for both the retained R2 ruleset and the current ruleset,
including an exact depth 1-5 Warden checkpoint with potion consumption,
advance to depth 6, and confirmed abandon. No D1 migration was required.

Authorized paths:

- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/room-policy.js`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/index.js`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/meta-state.js`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/meta-transaction.js`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/relic-replacement.js`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/relic-reward-fallback.js`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/starting-relic-offer.js`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/ruleset-hash-policy.js`;
- `cloudflare/leaderboard-v3/src/local-ruleset-entry.js`;
- `online-v3/ranked-v3-protocol.js`;
- `online-v3/ranked-v3-client.js`;
- `online-v3/ranked-v3-runtime.js`;
- focused Worker/ruleset/client regression coverage under
  `cloudflare/leaderboard-v3/test/`;
- ruleset manifest/release descriptors only if verification proves a ruleset
  hash update is required;
- `scripts/online-v3-ranked-headed.mjs` only if needed for visible Warden QA;
- `ONLINE_V3_HANDOFF.md`;
- `progress.md`;
- this file.

Required outcome: preserve the room-layer meta-scope guard while comparing
against the already validated reward-settlement result, accept bounded
canonical potion consumption and pickup at the checkpoint, keep sequential
depth and Warden reward behavior unchanged, and retain compatibility with the
currently saved production ruleset. Run focused RED/GREEN, threat-matrix
rerun, `verify:fast`, `verify:phase`, `verify:baseline`, `verify:full`, headed
Warden QA, and `git diff --check`; create one exact internal commit. Production
deployment is authorized only after all gates pass. Do not change local combat
authority, gameplay, Practice, mode names, source `game.js`, D1 schema, M5, or
the 172 protected Vault Guardian deletions.

# Local Ranked entry recovery and keyboard hotfix

## Active status

`COMPLETED_LOCALLY`; production, Worker, D1, and the ruleset remain unchanged.

The saved-run `Start New Ranked` path now enters `RETRYING` before it requests
canonical abandonment. A request failure can therefore enter the existing
recoverable UI instead of stranding the player on `Ending the saved Ranked
run...`. Ordinary Ranked action menus now support Up, Down, Left, and Right
focus cycling, while native Enter and Space keep button activation.

Authorized paths:

- `online-v3/ranked-v3-runtime.js`;
- `online-v3/ranked-v3-ui.js`;
- `cloudflare/leaderboard-v3/test/r2-error-recovery.test.js`;
- `scripts/online-v3-ranked-headed.mjs`;
- `ONLINE_V3_HANDOFF.md`;
- `progress.md`;
- this file.

Required verification: focused RED/GREEN, headed saved-run recovery and
successful-new-run regression, `verify:fast`, `verify:phase`,
`verify:baseline`, and `git diff --check`. Create one local atomic commit and
stop. Do not push, deploy, activate a ruleset, change Worker/D1 behavior,
source `game.js`, gameplay, Practice, or protected Vault Guardian files.

# R2 terminal-only leaderboard publication and campaign identity repair

## Active status

`COMPLETED_AND_PRODUCTION_VERIFIED` at
`59512df5e8b3c218cdb723ac92e05faed61e54aa`.

Implemented:

- extraction still opens native Camp but no longer publishes a leaderboard row;
- terminal fifth-life defeat and terminal victory publish at most one result per
  season/campaign profile;
- one profile ID survives every extraction and Camp descent in the five-life
  campaign, then rotates only after terminal completion or confirmed abandon;
- D1 migration `0004` records profile identity, deterministically reduces the
  previous 30 fanout rows to one row per campaign profile, and enforces the
  season/profile uniqueness invariant;
- D1 migration `0005` adds an index for terminal result queries without
  deleting history; the public list and detail endpoints hide five preserved
  legacy `extract` rows and currently expose one terminal `defeat`;
- private profile credentials remain absent from public leaderboard responses.

Internal commits:

- `d49822d` - Fix Ranked leaderboard campaign lifecycle;
- `b7a6885` - Preserve Ranked campaign identity across Camp;
- `57091de` - Align Ranked E2E with terminal publication;
- `1fa6ffd` - Stabilize Ranked headed room traversal;
- `59512df` - Hide legacy extraction leaderboard rows.

Production:

- Worker `dungeon-online-v3-production` version
  `deacb948-896e-444e-97f3-6fbda14a10b1` is active at 100%;
- Pages deployment `4cab3989-14cc-491d-80b1-9fc0d8bb1ba4` from
  `59512df` is live at `https://dungeon-of-one-room.pages.dev`;
- D1 migrations `0004` and `0005` are applied with no pending migrations;
- the pre-`0005` Time Travel bookmark is
  `00000154-00000000-000050b8-b585654e88e8e3846a6d9a1430709aee`;
- production smoke `run_3da6d4aa91a241318c58bee241857909`
  completed `201 start -> 200 abandon`, revision 1, with zero leaderboard
  rows; one response-lost preflight remains at revision 0 with zero leaderboard
  rows and normal retention.

Verification:

- focused terminal filter/migration/D1 tests: 10/10 PASS;
- R2 threat matrix: 31/31 scenarios covered; accepted R1-P0-001 boundary
  unchanged;
- `verify:fast`: 49/49 PASS
  (`output/verification/fast-20260730T220433024Z.log`);
- `verify:phase`: 740/740 PASS
  (`output/verification/phase-20260730T220453165Z.log`);
- `verify:baseline`: 3/3 PASS plus headed v0.8 smoke
  (`output/verification/baseline-20260730T220614219Z.log`);
- `verify:full`: 764/764 PASS, including 21/21 local Wrangler/D1 E2E and
  headed v0.8 smoke
  (`output/verification/full-20260730T220815423Z.log`);
- visible headed Ranked lifecycle PASS for start, network loss, reload,
  multi-tab, rewards, death presentation, extraction and Camp;
- production API is active and compatible; public leaderboard contains only
  terminal outcomes; public `game.js`, Ranked runtime and protocol match the
  verified Pages bundle byte-for-byte;
- `git diff --check`: PASS.

Invariants:

- ruleset hash changed from
  `sha256:08dfa4f97d91b4f21dbfae7232246125ddbbc6a0270cf81a9e1ed012e5f5d403`
  to
  `sha256:956251f158e55a0a47f9e43d5680d9aae66a22045c833bd76b8798cdc00e012e`;
- source `game.js` remains byte-identical at
  `556829c909cdc9eaefb4238279457eb9b3427adef9ce494f35743542770ee7de`;
- 30 Milestone files changed; all 172 protected Vault Guardian deletions remain
  untouched and unstaged;
- no server-authoritative combat, gameplay divergence, mode rename, paid
  service, rollback, or M5 work occurred.

Stop after the R2 release handoff. M5 is not started.

---
# R2 local campaign, reward, resource, Forge, Camp, and checkpoint parity repair

## Active status

`COMPLETED_LOCALLY` in internal commits `50a7c34` and `dd83b49`.
Production remains unchanged until a separate explicit deployment authorization.

Implemented:

- Ranked chest gold, potion pickups/usage, map fragments, room-clear gold, and Merchant potion purchases now settle into the canonical checkpoint without changing local combat authority;
- map fragments and one-per-campaign starting relic progress survive Camp descents, ten fragments force one Vault, and the first Warden kill at each new boss depth guarantees its v0.8 relic offer;
- defeating checkpoint Wardens unlocks the matching later start depth for that profile, and native Camp presents the available checkpoint choices;
- Forge, Merchant, Camp, extraction, final defeat, and Practice keep the native v0.8 presentation and flow while Ranked accounting stays in the background;
- the persisted profile campaign validator accepts canonical D1 key ordering, eliminating the real post-relic HTTP 500/reconnect loop;
- boot input remains locked through loading and a short post-fade guard so the dismiss key cannot select Practice from the Main Menu.

Verification:

- focused campaign/reward regression: 7/7 PASS;
- dedicated native Merchant headed flow: 1 purchase, 1 portal transition, zero browser errors;
- R2 threat matrix: 30/30 scenarios covered, accepted boundary unchanged;
- `verify:fast`: 48/48 PASS;
- `verify:phase`: 736/736 PASS;
- `verify:baseline`: 3/3 PASS plus headed v0.8 smoke;
- `verify:full`: 760/760 PASS, including 21/21 local Wrangler/D1 E2E and headed v0.8 smoke;
- visible full Ranked lifecycle: PASS for start, network loss, reload, multi-tab, rewards, death presentation, and Camp;
- `git diff --check`: PASS.

Invariants:

- ruleset hash changed from `sha256:bfc32eb2fa252d6543e1c042cb6e45e828a8bf6237b0c30d0b9e2e0a13b99950` to `sha256:08dfa4f97d91b4f21dbfae7232246125ddbbc6a0270cf81a9e1ed012e5f5d403`;
- source `game.js` remains byte-identical at `556829c909cdc9eaefb4238279457eb9b3427adef9ce494f35743542770ee7de`;
- all 172 protected Vault Guardian deletions remain untouched and unstaged;
- R1-P0-001 remains the accepted local-combat product boundary; Ranked/Practice names and gameplay parity are unchanged;
- no push, deployment, production activation, D1 migration, paid service, or M5 work occurred.

Internal commits:

- `50a7c34` - restore Ranked campaign and reward parity;
- `dd83b49` - restore native Ranked gameplay flow.

---
# Production Ranked gameplay-continuity and gold-parity hotfix - Online v3

## Active status

`COMPLETED_AND_PRODUCTION_VERIFIED` on the existing `dungeon-of-one-room`
Pages project, deployment `d0e49664-29c7-47f0-80b1-a161d2630a09` from source
commit `ab46761`.

Internal commits `b10c523` and `ab46761` restore bounded v0.8 gold parity,
legacy Camp profile continuity, one-per-campaign starting relic behavior,
native final defeat after the fifth life, and full Practice cleanup after
Ranked. Production Worker version
`c7b6cdc1-c0df-4eee-bdf7-d2a0f8682900` and the Pages deployment above are
active without a D1 schema migration.

Completion evidence:

- focused regressions: 21/21 PASS, including a committed native Camp upgrade
  and empty-relic next descent without a second starting offer;
- R2 threat matrix: 30/30 scenarios covered;
- `verify:fast`: 48/48 PASS;
- `verify:phase`: 728/728 PASS;
- `verify:baseline`: 3/3 PASS plus headed game smoke;
- `verify:full`: 752/752 PASS, including 21/21 local Wrangler/D1 E2E and
  headed game smoke;
- dedicated headed lifecycle: native room/enemy/chest gold, Warden reward,
  fifth-life final defeat, terminal Main Menu, post-Ranked Practice with zero
  Online API requests, native Camp upgrade, and next-run continuation, with
  zero unexpected console/page/network errors;
- canonical production assets match the verified local Pages bundle
  byte-for-byte;
- production availability reports ruleset
  `sha256:bfc32eb2fa252d6543e1c042cb6e45e828a8bf6237b0c30d0b9e2e0a13b99950`;
- production smoke created and abandoned run
  `run_6e738c88e4f14b2dac9c3a8cc89d211c` at revision 1; D1 confirms zero
  leaderboard rows written;
- source `game.js` remains byte-identical at
  `556829c909cdc9eaefb4238279457eb9b3427adef9ce494f35743542770ee7de`;
- all 172 protected Vault Guardian deletions remain untouched and unstaged.

Authorized paths:

- `online-v3/ranked-v3-runtime.js`;
- `online-v3/ranked-v3-recorder.js`;
- `online-v3/ranked-v3-protocol.js`;
- `scripts/build-pages-v3.mjs`;
- `cloudflare/leaderboard-v3/src/index.js`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/camp-policy.js`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/profile-policy.js`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/reward-policy.js`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/index.js`;
- `cloudflare/leaderboard-v3/src/rulesets/v08-meta-1/data/ruleset-manifest.json`;
- `cloudflare/leaderboard-v3/src/rulesets/releases.js`;
- `cloudflare/leaderboard-v3/src/production-ruleset-entry.js`;
- focused `cloudflare/leaderboard-v3/test/{m4-*,r2-camp-profile}.test.js`,
  reward-policy, manifest, production-release, and recorder assurance coverage;
- focused headed Ranked gameplay-continuity/gold-parity QA and its hash-bound
  Merchant helper;
- `ONLINE_V3_HANDOFF.md`;
- `progress.md`;
- this file.

Required outcome:

- the existing v0.8 room-clear gold formula and `Room clear bonus` log are
  presented in Ranked without double-crediting;
- actual local enemy, elite, hazard, and supported bounded chest outcomes are
  aggregated into the already-existing reward envelope claims;
- the canonical checkpoint retains the same default-room gold total visible
  immediately before settlement;
- retry reuses the same immutable claim summary and a new room begins with an
  empty recorder;
- the Warden claim already present in canonical v0.8 reward data is accepted
  in boss/final rooms, while the prior production hash remains resolvable for
  browser saves created before the hotfix;
- a native Camp purchase commits and refreshes the native Camp without a
  technical error overlay;
- starting a later descent with an empty relic inventory does not reissue the
  one-per-campaign starting relic;
- the fifth canonical death opens the native final Game Over summary and
  cannot continue to another depth;
- leaving Ranked fully clears the presentation-mode flag, and Practice starts
  and continues through the untouched local v0.8 path with zero Online API
  requests;
- source `game.js`, D1 schema, combat authority, mode names, and R1-P0-001
  remain unchanged.

Run focused RED/GREEN regressions, headed player-visible QA with screenshot,
`render_game_to_text`, and console/page-error checks, the R2 threat matrix,
`verify:fast`, `verify:phase`, `verify:baseline`, `verify:full`, and
`git diff --check`. Create exact internal commits, deploy the ruleset
compatibility fix to the existing production Worker, then deploy Pages to the
existing production project. Do not push, stage or touch the 172 protected
Vault Guardian deletions, use a paid service, or start M5.

---
# Production native Ranked Merchant interaction hotfix - Online v3

## Active status

`COMPLETED_AND_PRODUCTION_VERIFIED` on the existing `dungeon-of-one-room`
Pages project, deployment `78d976ff-48b1-40ff-869b-f3e1c8facbe3` from source
commit `ad5fdac`.

Implementation commit `c313e52` restores the native Merchant room and screen;
verification-harness commit `ad5fdac` waits for the existing Camp DOM to leave
the render tree before asserting Main Menu. Focused regressions pass 15/15,
the dedicated headed Merchant flow passes one native purchase and one portal
transition with zero console/page/network errors, the R2 threat matrix remains
30/30, `verify:fast` is 45/45, `verify:phase` is 723/723,
`verify:baseline` is 3/3 plus headed smoke, and `verify:full` is 747/747
including 21/21 local Wrangler/D1 E2E. The main production URL serves byte-
identical verified `game.js` and Ranked runtime assets.

The player-reported failure is reproduced from source: entering a canonical
Merchant room immediately calls `open_meta_offer`, replaces the native game
with the generic Ranked choices overlay, and moves the session out of
`ROOM_ACTIVE`. A subsequent reconnect can therefore strand the room without a
next directive and surface `Online v3 is still resolving the next room.`.
This violates the canonical Merchant trigger, which is player interaction with
the Merchant, and does not match Practice presentation.

Authorized paths:

- `online-v3/ranked-v3-runtime.js`;
- `scripts/build-pages-v3.mjs`;
- focused `cloudflare/leaderboard-v3/test/m4-*.test.js` coverage;
- focused headed Ranked Merchant QA;
- existing headed Ranked lifecycle synchronization only if `verify:full`
  exposes a render-frame race without a product failure;
- `ONLINE_V3_HANDOFF.md`;
- `progress.md`;
- this file.

Required outcome:

- entering a Merchant room keeps the native room playable and shows no Ranked
  modal;
- only pressing the normal Merchant interaction while standing on the
  Merchant opens the existing Practice Merchant screen;
- the native Merchant rows use the canonical server offer and commit through
  the existing opaque transaction IDs without applying local purchases first;
- closing or skipping the Merchant consumes the canonical leave choice,
  resolves the checkpoint once, and prepares the next portal directive without
  reconnect or `still resolving` loops;
- transient request failure returns control to the room and permits retry
  without a forced reconnect screen.

Run focused RED/GREEN regressions, headed keyboard QA with screenshot,
`render_game_to_text`, console/page-error checks, the R2 threat matrix,
`verify:fast`, `verify:phase`, `verify:baseline`, `verify:full`, and
`git diff --check`. Create exact internal commits and deploy only Pages to the
existing production project. Do not change Worker/D1 behavior or schema,
source `game.js`, ruleset data/hash, gameplay, combat authority, mode names,
Practice, R1-P0-001, or the 172 protected Vault Guardian deletions. No push,
staging, paid service, or M5.

---

# Production Ranked extraction/Camp continuation hotfix - Online v3

## Active status

`COMPLETED_AND_PRODUCTION_VERIFIED` on the existing `dungeon-of-one-room` Pages project, deployment `4eebd3c0-2065-4474-8630-946fed56df7e` from source commit `b107e3a`.

This R2-only hotfix covers the reported cleared-room Q/checkpoint race, Camp
next-run failure, false Main Menu return to Camp, and stale Ranked-only browser
state. Authorized paths are `online-v3/ranked-v3-{runtime,session,storage,client}.js`,
`scripts/build-pages-v3.mjs`, the registered profile boundary in
`cloudflare/leaderboard-v3/src/index.js`, focused Online v3/Worker tests and headed QA,
`ONLINE_V3_HANDOFF.md`, `progress.md`, and this file.

Required outcome:

- cleared-room Q waits for an in-flight checkpoint, remains a normal
  extraction, and enters native Camp without reconnect or exposing the next
  depth;
- Camp can start a next run with positive Camp Gold, including an existing
  profile written with the legacy zeroed Camp ledger, and when the prior fatal
  event removed the final carried relic;
- `Main Menu` from a failed Camp next-run reaches the native Main Menu;
- stale Ranked-only transient storage repairs without deleting Practice or
  unrelated browser data and without discarding a recoverable canonical run.

Run focused RED/GREEN regressions, exact headed keyboard QA, the R2 threat
matrix, `verify:fast`, `verify:phase`, `verify:baseline`, `verify:full`, and
`git diff --check`. Create exact internal commits and deploy the minimal Worker
Camp-ledger fix plus Pages to the existing production project. The positive
Camp Gold regression proved the server defect; do not change D1 schema/data or
the ruleset data/hash. Do not change gameplay,
combat authority, mode names, Practice, R1-P0-001, or the 172 protected Vault
Guardian deletions. No push, staging, paid service, or M5.

Completion evidence:

- internal commits `0794906` and `b107e3a` preserve the Worker/client split;
- Worker version `4ab7c6be-9fea-4bc3-aa37-c1687143cd55` receives 100% production
  traffic; Pages deployment `4eebd3c0-2065-4474-8630-946fed56df7e` is Production
  on `main`;
- focused tests 12/12, threat matrix 30/30, fast 45/45, phase 723/723,
  baseline 3/3 plus headed smoke, and full 747/747 including Wrangler/D1 21/21;
- headed Ranked lifecycle passed cleared-room Q, normal extraction, native Camp,
  positive-gold next run, and failed-start Main Menu with zero console/page
  errors;
- public build hashes match the verified Pages bundle; production smoke passed
  `201 start -> 200 abandon`, with the abandoned run at revision 1 and zero
  leaderboard rows in remote D1;
- source `game.js`, ruleset data/hash, D1 schema/data, gameplay, combat authority,
  mode names, Practice, R1-P0-001, and all 172 protected deletions are unchanged.

---
# Production Ranked browser-storage recovery hotfix - Online v3

## Active status

`COMPLETED_AND_PRODUCTION_VERIFIED` on the existing `dungeon-of-one-room` Pages project, deployment `47048250-f120-45c2-92e7-344cdb34c27f` from source commit `3d76ea6`.

This is an R2-only production hotfix for the player-reported `Ranked
Unavailable` screen when starting a new Ranked run. The reproduced failure is
browser `QuotaExceededError` code 22 before `/api/v3/runs/start` is sent.

Authorized paths:

- `online-v3/ranked-v3-storage.js`;
- `online-v3/ranked-v3-client.js`;
- `online-v3/ranked-v3-runtime.js`;
- focused Online v3 unit and headed tests;
- `ONLINE_V3_HANDOFF.md`;
- `progress.md`;
- this file.

Required outcome:

- critical Ranked writes retry once after deleting only the retired
  `dungeonRankedV2Active` value and noncritical Online v3 leaderboard cache;
- Practice saves (`dungeonOneRoomRunSave` and `dungeonPracticeV2Active`) and
  unrelated browser data are never deleted;
- if safe reclamation is insufficient, the UI reports that browser storage is
  full instead of showing the generic Ranked start error;
- a failure before a local Ranked session exists is safely discarded and does
  not enter reconnect recovery;
- successful reclamation proceeds through the ordinary direct Ranked start.

Verification and release:

- keep focused RED/GREEN regression evidence;
- run headed browser QA with a deliberately saturated localStorage and visually
  inspect the successful direct start and Practice-save preservation;
- rerun the R2 threat matrix, `verify:fast`, `verify:phase`,
  `verify:baseline`, `verify:full`, and `git diff --check`;
- create exact internal local commits and deploy only Pages directly to the
  existing production project;
- do not change Worker/D1 behavior or schema, source `game.js`, gameplay,
  ruleset data/hash, combat authority, mode names, or R1-P0-001;
- do not push, create staging, touch or stage the 172 protected Vault Guardian
  deletions, use a paid service, or start M5.

Completion evidence:

- exact Chromium quota reproduction recovered automatically and reached the
  native starting-relic screen on both local and public production builds;
- production smoke returned `201 start -> 200 abandon`, preserved both Practice
  sentinels, reported zero console/page errors, and produced the visually
  correct starting-relic presentation;
- remote D1 confirms smoke run `run_46b7c3ab52d649e8a0ddc32f14aedcd4`
  is `abandoned` at revision 1 with zero leaderboard rows;
- one earlier smoke attempt stopped after successful start on a test assertion;
  its revision-0 `awaiting_starting_relic` run has zero leaderboard rows, no
  chosen relic, cannot publish, and is left to normal retention;
- R2 threat matrix 30/30, `verify:fast` 45/45, `verify:phase` 721/721,
  `verify:baseline` 3/3 plus headed smoke, and `verify:full` 745/745 including
  21/21 local Wrangler/D1 E2E;
- source `game.js`, ruleset hash, Worker/D1 schema and behavior, gameplay,
  combat authority, mode names, Practice behavior, R1-P0-001, and all 172
  protected Vault Guardian deletions remain unchanged;
- no push, staging, Worker deploy, paid service, or M5 work was performed.

---# Production direct Ranked start and stale-profile recovery hotfix - Online v3

## Active status

`COMPLETED_AND_PRODUCTION_VERIFIED` on the existing
`dungeon-of-one-room` Pages project, deployment `2eeead39-2f33-4f75-818e-5d9909bbb3a8` from source commit
`c091b7c`.

This is an R2 production hotfix only. It fixes the player-reported loop where
`Start New Ranked` becomes `Ranked reconnect required`, invalid recovery leads
to `Ranked Save Cannot Be Recovered`, and forgetting the recovery returns to
the same reconnect screen. It also makes the Ranked entry compact and native
to the existing game presentation.

Authorized paths:

- `online-v3/ranked-v3-client.js`;
- `online-v3/ranked-v3-storage.js`;
- `online-v3/ranked-v3-runtime.js`;
- `online-v3/ranked-v3-ui.js`;
- `style.css`, limited to Online v3 presentation;
- focused Online v3 unit, production, and headed tests;
- `scripts/online-v3-ranked-headed.mjs`;
- `ONLINE_V3_HANDOFF.md`;
- `progress.md`;
- this file.

Required outcome:

- with no local Ranked recovery, the native `Ranked (Online)` row starts the
  run directly without an intermediate menu;
- with a local recovery, the compact Ranked menu offers only Start New,
  Continue, and Cancel;
- Start New canonically abandons a recoverable run, but an invalid local
  recovery cannot trap the player behind additional forget/confirmation
  screens;
- a stale local Ranked profile credential is cleared once and the start is
  retried with a fresh anonymous profile identity;
- a failed start without a canonical run never enters the reconnect/resync
  flow and never leaves a pending local start that masquerades as recovery;
- network and rate-limit start failures remain explicit and do not rotate the
  profile identity or bypass abuse controls;
- Ranked message actions are centered, narrower, and use the same restrained
  gothic edge treatment as the native HD menus.

Verification and release:

- add focused failing regressions before implementation;
- run the supplied headed browser loop and visually inspect the stale-profile
  repair and compact saved-run menu;
- rerun the R2 threat matrix, `verify:phase`, `verify:baseline`,
  `verify:full`, and `git diff --check`;
- create exact internal local commits and deploy directly to the existing
  production Pages project;
- production smoke must exercise a real stale-profile rejection, successful
  automatic retry, starting relic, and canonical abandonment;
- do not change Worker/D1 behavior or schema, source `game.js`, gameplay,
  ruleset data/hash, combat authority, mode names, Practice storage, or the
  accepted R1-P0-001 boundary;
- do not push, create staging, touch or stage the 172 protected Vault Guardian
  deletions, use a paid service, or start M5.

Completion evidence:

- no-recovery `Ranked (Online)` starts directly; a stale profile produces one
  expected `PROFILE_UNAUTHORIZED`, rotates only the Ranked profile identity,
  retries automatically, and reaches the starting relic without reconnect;
- saved-run navigation is limited to compact `Start New Ranked`, `Continue
  Ranked`, and `Cancel` controls with the native gothic edge treatment;
- public smoke on `https://dungeon-of-one-room.pages.dev` passed the real
  sequence `201 start -> 200 abandon -> 401 stale profile -> 201 repaired
  start -> 200 abandon`, with zero page errors and no reconnect screen;
- the repaired production smoke run is `abandoned` with zero leaderboard rows;
- R2 threat matrix 30/30, `verify:fast` 44/44, `verify:phase` 717/717,
  `verify:baseline` 3/3 plus headed smoke, and `verify:full` 741/741;
- source `game.js`, ruleset hash, Worker/D1 schema and behavior, gameplay,
  combat authority, mode names, Practice storage, and the accepted R1-P0-001
  boundary remain unchanged;
- no push, staging, Worker deploy, paid service, or M5 work was performed, and
  all 172 protected Vault Guardian deletions remain untouched and unstaged.

---
# Local Ranked reward and death presentation regression fix - Online v3

## Active status

`COMPLETED_LOCALLY` in commit `9f60eaa`; included in the later authorized
production Pages deployment `2eeead39-2f33-4f75-818e-5d9909bbb3a8`.

This is one local-only integration hotfix for two player-reported Ranked
regressions:

- a relic reward belonging to an upcoming Warden, Otter, or Arena room must
  not be presented after clearing the preceding ordinary combat room;
- an accepted nonterminal Ranked life loss must show the native v0.8 death
  screen and play the native death track before the player starts the next
  canonical life.

Authorized paths:

- `online-v3/ranked-v3-runtime.js`;
- `online-v3/ranked-v3-offers.js`;
- `scripts/build-pages-v3.mjs`;
- `cloudflare/leaderboard-v3/test/m4-client-offers.test.js`;
- `cloudflare/leaderboard-v3/test/production-release.test.js`;
- `scripts/online-v3-ranked-headed.mjs`;
- `ONLINE_V3_HANDOFF.md`;
- `progress.md`;
- this file.

Required boundaries:

- source `game.js` and `index.html` remain byte-identical;
- Practice gameplay, saves, UI, audio, and zero-API behavior remain unchanged;
- the Worker, D1, ruleset data/hash, reward probabilities, life accounting,
  combat-authority model, and mode names remain unchanged;
- Chrono Loop and Second Chance prevention remain server-decided and do not
  show a false death screen;
- no push, deploy, staging, ruleset activation, migration, rollback, paid
  service, canary, soak, or M5 work;
- the 172 protected Vault Guardian deletions remain unchanged and unstaged.

Required verification:

- add focused regressions first and observe the relevant RED failures;
- run the focused unit/build tests and the supplied headed Ranked lifecycle;
- visually inspect the ordinary-to-Warden boundary, native nonterminal death
  screen, and post-death continuation artifacts;
- run `npm run verify:fast`, `npm run verify:phase`, `npm run verify:baseline`,
  `npm run verify:full`, and `git diff --check`;
- confirm source `game.js`, ruleset hash, and the protected-WIP fingerprint are
  unchanged.

Required local commit:

- `Fix Ranked reward and death presentation`

After the local commit, stop and report that production remains unchanged.

---
# Production Practice/Ranked menu and recovery hotfix - Online v3

## Active status

`COMPLETED_AND_PRODUCTION_VERIFIED` on the existing `dungeon-of-one-room`
Pages project, deployment `6d91dd40-0a75-4f8c-86a3-2c3ff22e468c` from
source commit `86cda91`.

This hotfix is limited to the production menu adapter and Ranked browser
recovery. It must not change gameplay, Worker/D1 behavior, ruleset data, combat
authority, mode names, source `game.js`, or the accepted R1-P0-001 boundary.

Authorized paths:

- `scripts/build-pages-v3.mjs`;
- `online-v3/ranked-v3-runtime.js`;
- focused Online v3 production, recovery, and headed tests;
- `ONLINE_V3_HANDOFF.md`;
- `progress.md`;
- this file.

Required outcome:

- a paused Practice run has `Main Menu` and preserves the Practice save;
- the main menu has no ambiguous standalone Continue row;
- Ranked always opens an explicit Start New / Continue / Cancel choice, with
  Practice and Ranked storage remaining separate;
- terminal Ranked recovery and acknowledged abandonment cannot loop back to
  generic reconnect controls;
- leaving recovery releases the browser writer lease without deleting the
  canonical Ranked recovery.

Verification and release:

- add focused regressions before implementation and use the supplied headed
  browser loop;
- rerun the R2 threat matrix, `verify:phase`, `verify:baseline`,
  `verify:full`, and `git diff --check`;
- create exact internal local commits and deploy directly to the existing
  production Pages project;
- do not push, stage or touch the 172 protected Vault Guardian deletions,
  change the Worker/D1 schema, start M5, or create staging.

Completion evidence:

- Practice pause, `Main Menu`, mouse-driven `Load Continue`, and separate
  Practice/Ranked saves pass the focused and headed regressions;
- Ranked now always offers `Start New Ranked`, `Continue Ranked`, and `Cancel`;
  replacing a saved run first abandons it canonically;
- finalized/absent recoveries leave the reconnect loop, the writer lease is
  released on main-menu exit, and an invalid local recovery has an explicit
  confirmed forget-and-restart fallback;
- R2 threat matrix 30/30, `verify:fast` 40/40, `verify:phase` 712/712,
  `verify:baseline` 3/3 plus headed smoke, and `verify:full` 736/736;
- final supplied headed lifecycle and public production smoke PASS; the public
  smoke made zero `/api/v3` requests and reported zero console/page errors;
- source `game.js`, ruleset hash, Worker/D1, gameplay, combat authority, mode
  names, and all 172 protected deletions remain unchanged;
- no push, staging, rollback, paid service, or M5 work was performed.

---
# Production ended Ranked recovery restart hotfix - Online v3

## Active status

`COMPLETED_AND_PRODUCTION_VERIFIED` on the existing Pages project
`dungeon-of-one-room`, deployment
`071e6723-8222-4e42-9d7b-bca60e73b763` from source commit `3d68783`.

The browser now distinguishes a canonically ended recovery from a retryable
reconnect. It offers `Start New Ranked Run`, clears only the ended recovery,
and creates a different canonical run. Exact retry of a lost start response
also persists recovery and writer ownership before entering Ranked.

Completion evidence:

- focused unit regressions and full headed lost-acknowledgement lifecycle PASS;
- threat matrix 30/30, `verify:fast` 40/40, `verify:phase` 710/710,
  `verify:baseline` 3/3 plus headed smoke, and `verify:full` 734/734;
- public production headed smoke passed ended recovery and new-run start with
  zero unexpected browser errors; both final smoke runs were abandoned and
  produced zero leaderboard rows;
- one nonpublishable revision-0 preflight run is left to normal retention after
  its one-shot helper lost the generated recovery credential;
- source `game.js`, ruleset hash, Worker, D1 schema, gameplay, mode names, and
  all 172 protected deletions remain unchanged;
- no push, staging, rollback, paid service, or M5 work was performed.

---
# Production recovery acknowledgement hotfix - Online v3

## Active status

`COMPLETED_AND_PRODUCTION_VERIFIED` on Worker
`dungeon-online-v3-production`, version
`8e44d059-717c-4c6b-8cd9-591ed7c1bc1a`.

An authenticated Abandon that was already committed but lost its client
acknowledgement is now semantically idempotent across a new operation ID. This
allows the existing recovery screen to clear a canonically abandoned run
instead of looping between failed Resync and Abandon attempts.

Completion evidence:

- code commit `044839a`;
- focused lost-acknowledgement regression PASS;
- threat matrix 30/30, `verify:fast` 39/39, `verify:phase` 709/709,
  `verify:baseline` 3/3 plus headed smoke, and `verify:full` 733/733;
- production smoke repeated Abandon with a new operation ID at the same
  revision, returned 200 with replay acknowledgement, and left zero leaderboard
  rows;
- source `game.js`, ruleset hash, Pages assets, D1 schema, gameplay, mode names,
  and all 172 protected deletions remain unchanged;
- no push, staging, rollback, paid service, or M5 work was performed.

---

# Native Ranked extraction and Camp hotfix - Online v3

## Active status

`COMPLETED_AND_PRODUCTION_VERIFIED` on the existing Pages project
`dungeon-of-one-room`.

The normal Ranked extraction path now performs Online v3 request/finalization
in the background and enters the original v0.8 Camp presentation. The former
technical extraction/finalization screens and separate Ranked Camp list are no
longer player-facing. Native Camp controls commit server-issued profile
transactions and `Start Next Run` starts the next canonical Ranked run.

Completion evidence:

- code commit `6e90aa0` and production deployment
  `2d7c68be-1430-4f7c-ba81-5416f00193a9`;
- threat matrix 30/30, `verify:fast` 39/39, `verify:phase` 709/709,
  `verify:baseline` 3/3 plus headed smoke, and `verify:full` 733/733;
- focused headed lifecycle passed native Camp, network loss, reload, multi-tab,
  and native `Start Next Run`;
- public production smoke reached native `phase=camp`, with no Online overlay,
  no `Finalize`/`Open Camp`, five successful API responses, and zero browser
  errors;
- ruleset hash, source `game.js`, Worker/D1, gameplay tables, combat authority,
  mode names, and all 172 protected deletions remain unchanged;
- no push, staging, rollback, paid service, or M5 work was performed.

---
# Production portal synchronization hotfix - Online v3

## Active status

`COMPLETED_AND_PRODUCTION_VERIFIED` on the existing Pages project
`dungeon-of-one-room`.

The hotfix is limited to the production adapter and focused regression coverage.
The real Ranked portal now calls `DungeonOnlineV3.onRoomEntered` after building
the next room, matching the existing bridge path. It does not change gameplay,
Worker or D1 behavior, protocol semantics, ruleset data, mode names, combat
authority, or the accepted R1-P0-001 boundary. Source `game.js` remains
byte-identical.

Completion evidence:

- code commit `1dc325c`, complete-state commit `0e2bb6f`, and final production
  deployment `b9053e9a-c5c0-4784-87ce-ecddb5a32d86`;
- headed regression and production smoke both crossed two consecutive real
  portals and reached Depth 3 in `ROOM_ACTIVE`;
- production smoke accepted exactly two checkpoints and reported zero API,
  console, or page errors;
- a fresh-profile post-deploy audit confirmed native `Ranked (Online)` and
  `Ranked Leaderboard` menu rows with both legacy floating controls hidden;
- threat matrix unchanged at 30/30 scenarios covered;
- `verify:phase` 709/709, `verify:baseline` 3/3 plus headed smoke, and
  `verify:full` 733/733;
- ruleset hash, source `game.js`, gameplay, Worker/D1, mode names, and all 172
  protected Vault Guardian deletions remain unchanged;
- no staging, push, rollback, paid service, or M5 work was performed.

---

# Production UI hotfix - Online v3

## Active status

`COMPLETED_AND_PRODUCTION_VERIFIED` on the existing Pages project
`dungeon-of-one-room`. The current production deployment remains active while
the owner tests each corrected release directly.

This hotfix may change presentation and menu flow only. It must not change
gameplay, protocol semantics, ruleset data, mode names, combat authority, D1
schema, Worker behavior, or the accepted R1-P0-001 boundary.

Authorized paths:

- `game.js` must remain byte-identical; the production builder may inject the
  fail-safe main-menu and boot-loading adapter into `output/pages-dist/game.js`;
- `style.css`, limited to Online v3 presentation;
- `style-hd-boot.css` must remain baseline-identical; the builder may append
  production-only loading rules to its `output/pages-dist` copy;
- `online-v3/ranked-v3-ui.js`;
- `online-v3/ranked-v3-runtime.js`;
- `online-v3/ranked-v3-leaderboard-ui.js`;
- focused Online v3 UI, production, and headed test files;
- `scripts/build-pages-v3.mjs`;
- `ONLINE_V3_HANDOFF.md`;
- `progress.md`;
- this file.

Required outcome:

- the first boot input starts a visible loading bar, all further keyboard and
  pointer input stays blocked until HD assets and the main menu are ready, and
  the boot layer then yields to the native menu;
- `Practice (Offline)`, `Ranked (Online)`, and Ranked leaderboard are native
  main-menu rows with the existing keyboard/pointer behavior;
- Online controls never remain visible over another game modal;
- Ranked relic offers use player-facing names, icons, rarity, and descriptions;
- ordinary room checkpoints resolve automatically with restrained save
  feedback and no player-facing protocol button;
- player-facing copy does not expose `canonical`, `opaque`, protocol, or
  Online-v3 implementation terminology;
- Practice remains zero-API and gameplay remains identical between modes.

Verification and release:

- use the supplied headed browser loop and visually inspect every changed view;
- run `verify:fast` during edits;
- before the production commit/deploy run `verify:phase`, `verify:baseline`,
  `verify:full`, and `git diff --check`;
- deploy directly to the existing production Pages project after all gates;
- do not create staging, push unrelated histories, touch the 172 protected
  Vault Guardian deletions, or begin another milestone.

Completion evidence:

- final production deployment `2c5bab5b-e9fa-4446-b946-f3cb00df44de` from
  source commit `797499d`;
- threat matrix 30/30 scenarios covered;
- `verify:phase` 709/709, `verify:baseline` 3/3 plus headed smoke, and
  `verify:full` 733/733;
- production smoke passed boot input lock, Practice zero-API, Ranked
  start/resume/automatic checkpoint/leaderboard, and zero browser/API errors;
- ruleset hash, source `game.js`, gameplay, Worker, D1, and all 172 protected
  deletions remained unchanged.

---

# Production release ? Online v3

## Active status

`AUTHORIZED_FOR_PRODUCTION_RELEASE` on the existing Cloudflare Pages project
`dungeon-of-one-room` and production branch `main`.

This task supersedes the earlier documentation-only M5 boundary below. It is
one production release phase, not the start of another gameplay milestone.

Authorized infrastructure:

- existing Pages project `dungeon-of-one-room`;
- one private Online v3 Worker behind a Pages service binding;
- one new Free-plan D1 database named `dungeon-online-v3-production`;
- the minimum required Worker secret and rate-limit binding;
- exact ruleset `v08-meta-1` at its currently tested hash.

Authorized code and documentation paths:

- `cloudflare/leaderboard-v3/src/index.js`;
- `cloudflare/leaderboard-v3/src/production-ruleset-entry.js`;
- `cloudflare/leaderboard-v3/src/rulesets/releases.js`;
- `cloudflare/leaderboard-v3/test/production-release.test.js`;
- `cloudflare/leaderboard-v3/test/r2-retention-abuse.test.js`;
- `cloudflare/leaderboard-v3/package.json`;
- `cloudflare/leaderboard-v3/wrangler.production.toml`;
- `functions/api/v3/[[path]].js`;
- `scripts/build-pages-v3.mjs`;
- `tests/online-v3-production-pages.test.js`;
- `package.json`;
- `wrangler.jsonc`;
- `config.js`;
- `game.js` only for the exact `Practice (Offline)` menu label;
- `online-v3/ranked-v3-ui.js` only for the exact `Ranked (Online)` label;
- `ONLINE_V3_HANDOFF.md`;
- `progress.md`;
- this file.

Required release boundaries:

- Practice stays local and performs zero `/api/v3` requests;
- Ranked alone uses same-origin `/api/v3/*`;
- combat remains locally authoritative and gameplay is identical between modes;
- R1-P0-001 remains `ACCEPTED_PRODUCT_LIMITATION`;
- old v2 and older D1 databases remain untouched and disconnected;
- exactly 172 Vault Guardian deletions remain unstaged and unchanged;
- no staging project, Access policy, paid-plan dependency, canary, or soak;
- no further milestone begins after production verification.

Required gates before remote mutation:

- `npm run verify:phase`;
- `npm run verify:baseline`;
- `npm run verify:full`;
- `git diff --check`;
- threat-matrix rerun;
- unchanged protected-WIP fingerprint.

Required remote sequence:

1. preserve the current successful Pages deployment and binding snapshot;
2. create and migrate the new D1 database;
3. deploy the private Worker with D1, secret, rate limit, cleanup schedule and
   exact production ruleset;
4. push required commits to `main` when an exact repository remote is
   discoverable;
5. deploy the existing Pages project with the same-origin proxy;
6. run production Practice and Ranked lifecycle smoke through the first
   checkpoint, resume and leaderboard;
7. rollback Pages and deactivate the production ruleset on serious failure.

---

# Milestone R2 — Online v3 Reliability & Security Remediation

## Status

M5P planning complete locally - `READY_FOR_M5A_AUTHORIZATION`.

The documentation-only staging/release plan is in
`docs/ONLINE_V3_M5_PLAN.md`. M5P created no Cloudflare resource, secret,
route, remote migration, deployment, production activation, or ruleset
promotion. M5A requires a fresh, explicitly authorized task.

Complete locally — `READY_FOR_M5_PLANNING`.

Implementation commits:

- `9f0cd8a` — R1 review and trust decision;
- `71a4e15` — Camp/extraction/profile lifecycle;
- `f69b4e6` — authenticated resume;
- `2d4dcf8` — error/abandon/resync flows;
- `60ef67c` — single-writer browser coordination;
- `e9299e5` — retention and abuse safeguards;
- `24d29e7` — protocol and cursor hardening;
- `972e2ea` — remediation lifecycle coverage and threat rerun;
- `41b9056` — local D1 schema assertion aligned with the R2 profile migration.

R1-P0-001 is `ACCEPTED_PRODUCT_LIMITATION`. No P1 remains. Deferred M5 items
have explicit production gates in `docs/ONLINE_V3_R2.md` and
`docs/ONLINE_V3_R2_REVIEW.md`.

Do not begin M5 staging, production activation or deployment automatically.

## Objective

Resolve the actionable P1 and release-relevant P2 findings from:

`docs/ONLINE_V3_R1_REVIEW.md`

while preserving the deliberately chosen Online v3 product model:

- Practice remains fully local and offline;
- Ranked uses server-controlled canonical meta-progression;
- combat simulation remains local;
- Practice and Ranked use the same gameplay mechanics;
- no per-turn combat networking is introduced;
- no server-authoritative combat engine is created;
- no UI renaming or visible trust-level branding is introduced.

Required end state:

> Online v3 closes the Camp lifecycle, recovery, client reliability, multi-tab, retention and protocol gaps identified by R1 and is ready for a separate M5 staging plan.

This milestone does not deploy anything.

---

# Product decision — accepted R1-P0 boundary

## Accepted limitation

R1 finding:

`R1-P0-001 — public Ranked results do not prove gameplay`

is accepted as a deliberate product limitation.

Online v3 is a small browser-game Ranked mode, not a tournament-grade competitive platform.

The product objective is to prevent or substantially reduce easy manipulation of:

- score;
- depth;
- gold;
- lives;
- outcome;
- rewards;
- purchases;
- replacements;
- finalization;
- duplicate leaderboard publication.

The product does not require cryptographic proof that every local combat turn was genuinely played.

## Required behavior

Keep the existing player-facing names:

```text
Ranked (Online)
Practice (Offline)

Do not add player-facing labels such as:

checkpoint verified;
client trusted;
honor leaderboard;
noncompetitive;
unverified combat.

Do not change gameplay mechanics between Practice and Ranked.

Internally document that Ranked provides:

canonical server-controlled meta-state;
bounded client-attested room completion;
protection against straightforward request/state manipulation;
no guarantee against a deliberately modified combat client.
Explicitly out of scope

Do not implement:

server-authoritative combat;
deterministic server combat replay;
per-turn requests;
command-proof verification;
anti-tamper obfuscation presented as security;
invasive anti-cheat software;
gameplay differences between Practice and Ranked.

Do not continue reporting R1-P0-001 as an implementation defect during R2 unless new code exceeds or contradicts this accepted model.

It must remain recorded as:

ACCEPTED_PRODUCT_LIMITATION

in internal architecture and release documentation.

Heuristics

Optional anomaly/timing telemetry may be retained or improved only when:

it does not change ordinary gameplay;
it does not falsely claim proof of combat;
it is monitoring-only by default;
hard rejection is limited to mathematically or protocol-impossible input.

Do not build a large heuristic anti-cheat system in R2.

Starting repository state

Expected starting point:

branch: main;
HEAD:
3991c153711530c63a2b47974fb663db514a3147;
ruleset:
v08-meta-1;
ruleset hash:
sha256:d1f28d957244002da574180c5c9a7040d4d18deba1551a24e6597712d971b231;
v08-meta-1 remains local/test-only;
production activation remains blocked;
Practice performs zero /api/v3 requests;
real Ranked local lifecycle is implemented;
R1 review exists as an untracked file:
docs/ONLINE_V3_R1_REVIEW.md;
no staging or deployment has occurred.

There are exactly 172 unrelated protected Vault Guardian deletions.

Before work begins, record:

exact protected path set;
protected fingerprint;
staged protected path count;
current HEAD;
current ruleset hash;
working-tree changes outside protected WIP.

The protected WIP must remain:

unchanged;
unstaged;
outside all R2 commits;
identical in path set and fingerprint.
Required context

Read:

AGENTS.md;
ONLINE_V3_HANDOFF.md;
cloudflare/leaderboard-v3/AGENTS.md;
this file;
docs/ONLINE_V3_R1_REVIEW.md;
docs/ONLINE_V3_M2B.md;
docs/ONLINE_V3_M3.md;
docs/ONLINE_V3_M4.md;
active v0.8 Camp/extraction/profile source code;
current Worker/D1 routes and storage;
client recovery, state machine and local storage code;
compact idempotency v2;
leaderboard cursor implementation;
real Wrangler/D1 and headed browser harnesses.

Do not use Ranked v2 as authority.

Workstream 0 — Preserve R1 review and trust decision

Add the existing review document to version control without modifying its findings:

docs/ONLINE_V3_R1_REVIEW.md

Create a short architectural decision record, for example:

docs/ONLINE_V3_RANKED_TRUST_MODEL.md

It must document:

accepted local-combat boundary;
canonical server-controlled systems;
bounded client-attested systems;
threats Online v3 mitigates;
threats Online v3 intentionally does not fully solve;
why per-turn server authority is rejected for this project;
requirement that Practice and Ranked gameplay remain identical;
player-facing names remain unchanged;
production documentation must not claim cheat-proof gameplay.

Do not rewrite R1 to hide the accepted P0.

Reclassify it in the decision record as:

ACCEPTED_PRODUCT_LIMITATION

not:

FIXED

Workstream 1 — Correct Camp and extraction lifecycle
Problem

R1 confirmed that Camp is currently offered after ordinary Ranked room clears, while active v0.8 source evidence binds Camp entry to extraction.

Current behavior must not remain.

Required audit

Before implementation, confirm from active v0.8 source:

exact extraction trigger;
when Camp opens;
whether Camp is before or after finalization;
how Camp Gold is earned;
whether Camp upgrades persist between runs;
which upgrades affect the next run;
whether Camp state is profile-scoped;
whether Practice stores Camp state locally;
exact ordering of extraction, Camp state mutation and next run.

Document the source evidence.

Required outcome

Camp must never be offered after an ordinary Ranked room.

Ranked Camp must follow the same gameplay lifecycle as Practice.

Acceptable implementation outcomes:

Outcome A — canonical anonymous Ranked profile

If Camp is confirmed as persistent cross-run meta-progression, R2 is authorized to implement a minimal anonymous Ranked profile boundary.

It must:

remain separate from accounts/login;
use an opaque profile ID;
use an independent high-entropy profile credential;
store only the canonical Camp/profile state required by v0.8;
never authenticate by player name, run ID or install hash alone;
load canonical profile state at Ranked run start;
credit extraction/Camp resources atomically;
apply canonical Camp upgrades to following Ranked runs;
preserve identical gameplay effects between Practice and Ranked;
remain test/local-only.

Any D1 migration must be additive and locally tested.

Outcome B — stop with a precise blocker

If exact v0.8 persistence semantics cannot be established safely, stop before implementing a fake or temporary Camp model.

Do not:

expose Camp after every room;
create run-local Camp upgrades that baseline treats as cross-run;
silently disable Camp and claim gameplay parity;
trust local Ranked profile state as canonical.

M5 must remain blocked until Camp parity is resolved.

Extraction integration

Extraction must:

derive eligibility canonically;
transition to the correct post-run Camp lifecycle;
not allow ordinary room access to Camp;
not allow post-finalization mutation of the finalized run;
keep leaderboard score/summary immutable;
apply profile mutations in a clearly defined atomic boundary.
Workstream 2 — Authenticated run resume and token refresh
Goal

Add a secure canonical recovery path for a valid server run when:

local recovery data is stale;
current boundary token expired;
a browser reload occurs;
an acknowledged response cannot be applied locally;
another tab committed a newer revision.

Do not authorize resume by runId alone.

Recovery credential

At run creation, issue an independent recovery credential.

Requirements:

cryptographically random;
minimum 256 bits of entropy;
separate from boundary tokens;
separate from operation IDs;
scoped to one run;
bound to ruleset ID/hash;
long-lived only for the run’s valid retention period;
raw value returned only to the authorized browser;
raw value never stored in D1;
D1 stores a hash/verifier;
credential comparison is timing-safe where applicable;
credential is redacted from logs and diagnostics;
install hash may be an additional signal but never the credential.

Document rotation and revocation policy.

Resume endpoint

Add an authenticated route conceptually equivalent to:

POST /api/v3/runs/resume

Use the existing route/version conventions.

Request must include only fields equivalent to:

{
  operationId,
  runId,
  recoveryCredential,
  clientProtocolVersion,
  lastKnownRevision
}

Do not place credentials in URLs.

Canonical response

The Worker derives the current run state from D1 and returns only the public projection required to continue.

Depending on canonical status, return:

awaiting starting relic:
current starting offer;
fresh run_bootstrap token;
active room:
current directive;
current reward envelope;
active public offer/transaction;
fresh room_checkpoint token;
terminal:
terminal projection;
fresh run_terminal token;
finalized:
immutable final summary;
leaderboard entry identity;
no mutation token;
expired/abandoned:
explicit terminal recovery error.

Do not return:

private canonical state;
HMAC secret;
raw recovery verifier;
private receipts;
recent operation history;
anomaly internals;
unreleased choices;
another user/client identity.
Token refresh

Resume must issue a fresh boundary token of the correct kind.

A short-lived boundary token expiring must not permanently strand an otherwise valid run with a valid recovery credential.

Exact retry

Resume must have explicit deterministic retry semantics.

If it mutates:

credential rotation;
last-access metadata;
revision;
another canonical field;

use stable operation identity and compact idempotency.

If it is a pure authenticated read, document why duplicate requests are safe.

Security tests

Cover:

valid credential;
wrong credential;
credential from another run;
run ID only;
install hash only;
expired boundary token plus valid recovery credential;
wrong ruleset binding;
finalized run;
expired run;
repeated failed attempts;
credential logging/redaction;
Worker restart.
Workstream 3 — Repair Ranked error and abandon flow
Problem

The current “Return to Practice” path may clear the only local recovery data before performing an illegal state transition.

Required state-machine behavior

Make error states actively reachable and meaningful:

RETRYING;
RECONNECT_REQUIRED;
UNRECOVERABLE_PROTOCOL_ERROR;
ABANDONED_LOCAL_SESSION.

Classify errors into at least:

temporary network failure;
timeout;
token expired;
stale revision;
conflicting retry;
ruleset/protocol mismatch;
unauthorized recovery;
unrecoverable malformed response;
server unavailable.
Return to Practice

“Return to Practice” must not silently destroy a recoverable Ranked run.

Required behavior:

enter a legal error/reconnect state;
preserve recovery data;
allow returning to Practice while keeping “Resume Ranked Run” available;
provide a separate explicit “Abandon Ranked Run” action;
require confirmation before permanent local deletion;
clear recovery only after the state transition and abandonment decision succeed.

If a canonical abandon endpoint is introduced:

authenticate it;
make it idempotent;
never publish a leaderboard entry;
mark the run unavailable for further mutation;
preserve explicit retention/cleanup semantics.

If the Worker is unreachable:

returning to Practice must preserve recovery by default;
local deletion must require a separate warning;
do not pretend the server run was abandoned.
Acknowledged-response adapter failure

If the Worker committed successfully but the local adapter/projection fails:

do not retry the mutation with a new operation ID;
use authenticated resume/resync;
preserve the canonical server result;
avoid clearing the recovery record.
Workstream 4 — Single-writer browser ownership and canonical resync
Goal

Prevent multiple tabs, double choices and stale local pending operations from dead-ending a valid run.

One active writer per run

Implement browser coordination using a suitable mechanism such as:

BroadcastChannel;
localStorage lease plus storage events;
both, with a tested fallback.

Each tab must have an opaque tab ID.

The active lease must include:

run ID;
tab ID;
lease version;
heartbeat/expiry;
last known revision.

Only the active owner may submit mutations.

Other tabs must:

show read-only/reconnect status;
not overwrite pending operation state;
be able to request ownership after lease expiry or explicit handoff.

Do not treat the lease as a server security boundary.

The Worker remains authoritative.

Global mutation lock

When one mutation is pending:

disable the complete relevant choice/action set;
preserve keyboard and accessibility state;
prevent different choices from being submitted concurrently;
reuse the same operation ID on retry;
clear the lock only after canonical acknowledgement, resync or explicit recovery state.
Conflict handling

On 409/stale revision/conflicting state:

stop blind retry;
preserve diagnostic context;
call authenticated resume;
replace local public projection with canonical current projection;
clear obsolete pending operation only after successful resync;
reopen the correct canonical UI state.

Do not retry a stale pending operation forever.

Multi-tab tests

Cover:

two tabs opening the same run;
simultaneous distinct choices;
owner tab closes;
lease expires;
stale tab tries to mutate;
storage record overwritten;
one tab finalizes;
another tab resumes after finalization;
BroadcastChannel unavailable fallback;
no duplicate canonical mutation.
Workstream 5 — Run retention and abuse safeguards
Goal

Prevent unlimited accumulation of abandoned runs and require explicit abuse-control readiness before public/shared deployment.

Retention

Use the existing expires_at field or an explicitly versioned replacement.

Implement deterministic cleanup for:

expired non-finalized runs;
explicitly abandoned runs after the retention window;
stale operation history as allowed by policy.

Do not delete:

finalized leaderboard entries;
immutable public summaries required by leaderboard;
active valid runs;
audit records required for exact retry inside the supported window.

Create a locally testable cleanup function and scheduled Worker entrypoint if appropriate.

Do not execute remote cleanup.

Active-run limits

Implement a bounded active-run policy for an authenticated anonymous profile or recovery principal when available.

Do not use player name as identity.

Do not claim client install hash is authentication.

If profile creation remains unauthenticated, document the remaining edge-abuse limitation.

Rate-control deployment gate

Do not invent an unreliable in-memory module-global rate limiter.

Create an explicit production readiness requirement for one of:

Cloudflare edge rate limiting;
another configured Cloudflare abuse-control binding;
Turnstile where product-appropriate;
a durable persistence-backed limiter justified by the architecture.

Production activation must remain blocked when required abuse-control configuration is absent.

Local/test behavior may use an explicit test adapter.

Monitoring contract

Define counters/metrics for at least:

run starts;
rejected starts;
active runs;
abandoned/expired cleanup;
resume success/failure;
invalid recovery credentials;
stale/conflicting requests;
finalizations;
leaderboard reads;
D1 write failures.

Do not log raw credentials or tokens.

Workstream 6 — Protocol and cursor hardening
Unknown-field policy

Create a consistent versioned policy for HTTP request bodies.

For each endpoint, explicitly choose:

reject unknown fields;
ignore unknown fields for forward compatibility.

Do not mix policies accidentally.

Security-sensitive mutation endpoints should prefer strict schemas unless a documented compatibility reason exists.

Response projection validation

Expand client validation for nested public projections used by:

bootstrap;
directives;
relic offers;
replacement;
fallback;
Merchant;
Forge;
Crossroads;
Camp;
Pact;
lives;
terminal;
final summary;
leaderboard details.

Fail closed on malformed or unknown response kinds.

A local adapter error after server commit must trigger canonical resume, not destructive local fallback.

Protocol versioning

Document supported client/server protocol versions.

Add an explicit mismatch response or availability descriptor suitable for M5 rolling deployment.

Do not activate production.

Leaderboard cursor

Choose and implement one documented policy:

Signed cursor
versioned;
purpose-specific signature;
tamper rejection;
no raw secret exposure.
Public seek tuple
explicitly documented as client-controlled;
strict schema validation;
malformed cursor returns a clear 400;
no silent fallback to first page.

Do not continue describing an unsigned seek tuple as cryptographically opaque.

Inactive proof modules

Audit:

ranked-v3-recorder.js;
ranked-v3-checkpoints.js;
other speculative/unused proof paths.

Either:

clearly mark them test/spec-only and remove them from active assurances;
or remove them if they are unused and safe to delete.

Do not wire them in as fake combat security.

Practice recovery read

Prefer deferring Ranked recovery-record reads until:

the user opens Ranked;
or a narrow menu-only recovery indicator explicitly requires it.

Practice simulation, save and startup must remain independent.

Workstream 7 — Documentation consistency

Update the current architecture documents to match HEAD.

Resolve known drift including:

recent operation ring size 12;
active real-ruleset client integration;
current token kinds;
recovery design;
Camp lifecycle;
accepted Ranked trust boundary;
production release gates.

Create:

docs/ONLINE_V3_R2.md

It must document:

R1 findings addressed;
accepted P0 product decision;
Camp/profile model;
resume credential design;
token refresh;
error/abandon state machine;
multi-tab ownership;
retention;
abuse-control deployment gate;
protocol/cursor policy;
remaining M5 work.

Keep ONLINE_V3_HANDOFF.md short.

Do not copy full test logs into the handoff.

Workstream 8 — Remediation test and review pass
Required tests

Add unit, property, Worker, Wrangler/D1 and headed coverage for the remediation.

At minimum cover:

Camp
no Camp after ordinary room;
extraction-to-Camp source binding;
canonical Camp resource credit;
profile persistence when implemented;
next run applies canonical upgrades;
fake local Camp state ignored;
Practice Camp unchanged.
Resume
valid resume;
expired boundary token refresh;
cleared local session with retained credential recovery;
wrong credential;
credential from another run;
run ID alone rejected;
install hash alone rejected;
terminal resume;
finalized resume;
expired run;
Worker restart;
credential redaction.
Error and abandon
network error enters reconnect state;
Return to Practice preserves recovery;
explicit abandonment confirmation;
clear occurs only after legal transition;
offline exit preserves recovery;
acknowledged-response adapter failure resyncs.
Multi-tab
one writer;
second tab read-only;
simultaneous different choices;
stale pending conflict;
owner tab closes;
lease takeover;
finalized run in another tab;
no infinite retry loop.
Retention and abuse
expired run cleanup;
active run preserved;
finalized leaderboard preserved;
active-run cap;
production abuse-control gate;
no module-global mutable limiter;
metrics contain no credentials.
Protocol
unknown-field policy;
malformed nested projection;
protocol version mismatch;
cursor tampering/malformed behavior;
unknown response kind;
resync after local projection failure.
R1 threat-matrix rerun

Rerun all 30 R1 threat scenarios.

For R1-P0-001, expected result is:

ACCEPTED_PRODUCT_LIMITATION

not PASS and not an implementation blocker.

Confirm that:

direct score/gold/depth/lives/outcome manipulation remains rejected;
duplicate rewards and transactions remain prevented;
the accepted local combat boundary has not expanded.
Remediation review document

Create:

docs/ONLINE_V3_R2_REVIEW.md

Final statuses must distinguish:

FIXED;
ACCEPTED_PRODUCT_LIMITATION;
DEFERRED_TO_M5;
OPEN_BLOCKER.

M5 planning may proceed only when:

no unaccepted P0 remains;
no P1 remains;
deferred items have explicit production gates.
Internal commits

Use separate local commits.

R2.0
Add Online v3 R1 review and Ranked trust decision

Contains only:

docs/ONLINE_V3_R1_REVIEW.md;
Ranked trust decision document;
no runtime changes.
R2.1
Correct Online v3 Camp and extraction lifecycle

Contains:

Camp source correction;
extraction integration;
canonical profile boundary if required;
Camp tests and source documentation.

If Camp requires an unresolved design, stop before this commit.

R2.2
Add authenticated Online v3 run resume

Contains:

recovery credential;
verifier storage;
resume/refresh endpoint;
canonical projection;
security and persistence tests.
R2.3
Fix Online v3 error abandon and resync flows

Contains:

legal error states;
Return to Practice behavior;
explicit abandonment;
canonical resync;
client tests.
R2.4
Add Online v3 single-writer browser coordination

Contains:

lease/BroadcastChannel;
global mutation lock;
multi-tab handling;
stale pending recovery;
headed tests.
R2.5
Add Online v3 run retention and abuse safeguards

Contains:

cleanup;
retention;
active-run policy;
abuse-control release gate;
monitoring contract;
D1/Worker tests.
R2.6
Harden Online v3 protocol and leaderboard cursor

Contains:

schema policy;
response validation;
protocol versioning;
cursor decision;
inactive proof-module cleanup;
tests.
R2.7
Add Online v3 R2 remediation lifecycle coverage

Contains:

combined Wrangler/D1 scenarios;
headed recovery/multi-tab/error/Camp coverage;
R1 threat-matrix rerun support.
Final documentation
Complete Online v3 R2 remediation milestone

Contains only:

docs/ONLINE_V3_R2.md;
docs/ONLINE_V3_R2_REVIEW.md;
current architecture updates;
short handoff;
CURRENT status;
no runtime changes.

Do not squash prior M1–M4 commits.

Allowed paths

R2 may modify only paths required for the remediation, including:

cloudflare/leaderboard-v3/src/**;
Worker/ruleset tests;
additive D1 migrations where proven necessary;
local Wrangler/D1 harness;
Online v3 browser client/runtime/UI modules;
Ranked state machine and storage;
narrow game-facing hooks only when required for Camp/extraction parity;
leaderboard cursor/protocol modules;
browser/headed tests;
verification registration;
relevant package scripts;
docs/ONLINE_V3_*;
docs/tasks/CURRENT.md;
ONLINE_V3_HANDOFF.md.

Changes to gameplay code must be minimal and must not alter Practice mechanics.

Do not perform unrelated refactors.

Out of scope

Do not implement:

server-authoritative combat;
per-turn networking;
new gameplay mechanics;
gameplay differences between Practice and Ranked;
player-facing trust-level labels;
accounts/login;
social identity;
public cloud-save UI;
production deployment;
production ruleset activation;
remote D1 migration;
Pages deployment;
full M5 observability/rollback implementation;
invasive anti-cheat;
unrelated UI redesign;
protected Vault Guardian work.

Do not begin M5.

Security requirements
Recovery
run ID is never sufficient;
player name is never sufficient;
install hash is never sufficient;
raw recovery credential is never stored server-side;
credentials and tokens are redacted;
resume returns only public canonical projection;
fresh token kind matches canonical run status.
Client reliability
one logical mutation uses one stable operation ID;
stale/conflicting mutations cause resume/resync;
no blind infinite retry;
no local state becomes canonical;
Return to Practice does not destroy recoverable runs;
one active browser writer per run.
Camp/profile
persistent Camp state is canonical for Ranked;
local Practice Camp remains unchanged;
extraction is the only confirmed Camp source;
ordinary room completion cannot open Camp.
Retention and abuse
no mutable module-global rate state;
expired runs are cleaned by deterministic policy;
production remains blocked without configured abuse controls;
credentials are absent from metrics and logs.
Stop conditions

Stop instead of guessing if:

exact Camp/profile behavior cannot be confirmed from v0.8;
gameplay parity requires an undefined persistent profile model;
recovery cannot be authenticated independently of run ID/install hash;
resume requires exposing private canonical state;
a destructive D1 migration is required;
multi-tab ownership cannot avoid data loss;
rate limiting requires pretending an unsafe local mechanism is production-grade;
protocol hardening requires a breaking client contract without versioning;
Practice gameplay or saves would change;
server-authoritative combat would become necessary;
protected 172-path WIP would be touched;
production activation would be enabled.

A partial R2 with a precise blocker is preferable to insecure recovery or fake Camp parity.

Verification workflow

During development:

npm run verify:fast

Before every internal commit, run targeted tests.

Before R2 completion:

npm run verify:phase
npm run verify:baseline
npm run verify:full
git diff --check

Final verification must include:

all existing ruleset and Worker tests;
recovery credential tests;
token refresh;
resume endpoint security;
Camp lifecycle;
profile persistence if implemented;
error and abandon state machine;
canonical resync;
multi-tab ownership;
stale operation recovery;
retention cleanup;
abuse-control release gate;
protocol schemas;
cursor behavior;
real Wrangler/D1 persistence and concurrency;
headed Practice and Ranked;
R1 threat matrix;
zero unexpected console/page errors;
protected WIP guard.

Practice must continue to produce:

zero /api/v3 requests

during normal Practice gameplay.

Acceptance criteria

R2 is complete only when:

R1-P0-001 is documented as an accepted product limitation;
no player-facing mode-name or gameplay change was introduced for that decision;
direct canonical-state manipulation remains blocked;
Camp is unavailable after ordinary room completion;
Ranked Camp matches confirmed extraction lifecycle;
persistent Camp state is canonical or R2 stops with a blocker;
run resume requires an independent recovery credential;
expired boundary tokens can be refreshed safely;
localStorage loss does not strand a run when the recovery credential is retained;
run ID/install hash alone cannot resume a run;
Return to Practice preserves recoverable Ranked state;
explicit abandon is legal, confirmed and idempotent;
acknowledged server state can be canonically resynced;
only one browser tab can actively mutate a run;
stale pending operations cannot loop forever;
expired abandoned runs have a cleanup policy;
production activation requires configured abuse controls;
protocol unknown-field semantics are consistent;
nested public projections are validated;
cursor behavior is explicit and tested;
no unaccepted P0 remains;
no P1 remains;
deferred M5 items have explicit release gates;
Practice remains behaviorally identical and offline-capable;
protected 172-path WIP has zero delta;
all verification commands pass;
no push, deployment or production activation occurred.
Required final report

Report concisely:

all R2 commit hashes;
accepted Ranked trust-model decision;
Camp/extraction/profile outcome;
resume credential design;
resume and token-refresh behavior;
error/Return-to-Practice behavior;
abandon behavior;
multi-tab ownership model;
stale/conflict resync behavior;
retention policy;
abuse-control deployment gate;
protocol unknown-field policy;
cursor policy;
R1 threat-matrix rerun result;
P0/P1/P2/P3 status after remediation;
remaining M5 gates;
ruleset hash before/after;
D1 migration status;
verify:phase;
verify:baseline;
verify:full;
headed scenario count;
protected WIP fingerprint/delta;
confirmation that Practice gameplay remained unchanged;
confirmation that production/deployment were untouched;
final recommendation:
READY_FOR_M5_PLANNING;
PARTIAL_R2_BLOCKED;
R2_FIXES_REQUIRED.

After the final documentation commit, stop.

Do not push, deploy, activate production or begin M5.