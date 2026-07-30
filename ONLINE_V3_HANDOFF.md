# Online v3 - Production handoff

## Ranked gameplay continuity and gold parity hotfix complete

The player-reported Ranked gold deficit, broken Camp upgrades, repeated
starting relic after losing the final carried relic, nonterminal fifth death,
and Practice/Ranked hybrid state are fixed on
`https://dungeon-of-one-room.pages.dev`.

- internal commits: `b10c523` (canonical gold/Camp profile continuity) and
  `ab46761` (native gameplay continuity and headed coverage);
- production Worker version:
  `c7b6cdc1-c0df-4eee-bdf7-d2a0f8682900`;
- production Pages deployment:
  `d0e49664-29c7-47f0-80b1-a161d2630a09` from `ab46761`;
- ruleset hash:
  `sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6`
  -> `sha256:bfc32eb2fa252d6543e1c042cb6e45e828a8bf6237b0c30d0b9e2e0a13b99950`;
- the previous production hash remains resolvable for existing browser saves;
- no D1 schema migration was performed.

Verification:

- focused regressions: 21/21 PASS;
- R2 threat matrix: 30/30 scenarios covered; R1-P0-001 remains accepted;
- `verify:fast`: 48/48 PASS;
- `verify:phase`: 728/728 PASS
  (`output/verification/phase-20260729T212936345Z.log`);
- `verify:baseline`: 3/3 PASS plus headed game smoke
  (`output/verification/baseline-20260729T213103293Z.log`);
- `verify:full`: 752/752 PASS, including 21/21 local Wrangler/D1 E2E and
  headed game smoke (`output/verification/full-20260729T213345075Z.log`);
- dedicated headed Ranked lifecycle covers bounded v0.8 gold, Warden reward,
  fifth-life final defeat, terminal Main Menu, post-Ranked zero-API Practice,
  native Camp purchase, and next-run continuation with zero unexpected errors;
- public `game.js`, Ranked runtime, and protocol hashes match the verified
  local Pages bundle byte-for-byte;
- production start/abandon smoke ended at revision 1 with zero leaderboard
  rows written.

Source `game.js` remains byte-identical at SHA-256
`556829c909cdc9eaefb4238279457eb9b3427adef9ce494f35743542770ee7de`.
No push, staging project, paid service, rollback, combat-authority change,
mode rename, M5 work, or protected Vault Guardian change was performed.

## Native Ranked Merchant parity hotfix complete

The reported automatic `MERCHANT CHOICES` overlay, reconnect interruption,
and `Online v3 is still resolving the next room.` portal loop are fixed on
`https://dungeon-of-one-room.pages.dev`.

- production Pages deployment:
  `78d976ff-48b1-40ff-869b-f3e1c8facbe3` from `ad5fdac`;
- internal commits: `c313e52` (native Merchant flow and focused QA) and
  `ad5fdac` (deterministic existing lifecycle assertion);
- entering a canonical Merchant room now stays in the normal playable room;
  only the normal `E` interaction opens the existing `Curio Merchant` screen;
- native Merchant actions commit the server-issued opaque transaction before
  the canonical projection updates the existing Practice presentation;
- leaving or skipping the Merchant performs one canonical leave, one
  checkpoint, and enters the prepared portal directive without reconnect.

Verification:

- focused regressions: 15/15 PASS;
- dedicated headed Merchant QA: native room entry, `E`, one skill purchase,
  `Esc`, portal, next Combat room, zero console/page/network errors;
- R2 threat matrix: 30/30 scenarios covered; R1-P0-001 remains accepted;
- `verify:fast`: 45/45 PASS;
- `verify:phase`: 723/723 PASS
  (`output/verification/phase-20260728T231643239Z.log`);
- `verify:baseline`: 3/3 PASS plus headed game smoke
  (`output/verification/baseline-20260728T232047521Z.log`);
- `verify:full`: 747/747 PASS, including 21/21 local Wrangler/D1 E2E and
  headed game smoke (`output/verification/full-20260728T232303475Z.log`);
- the public `game.js` and `online-v3/ranked-v3-runtime.js` hashes match the
  verified local Pages bundle byte-for-byte.

Source `game.js` remains byte-identical at SHA-256
`556829c909cdc9eaefb4238279457eb9b3427adef9ce494f35743542770ee7de`.
The ruleset remains `v08-meta-1` at
`sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6`.
No Worker/D1 change or deployment, schema/data migration, gameplay change,
push, staging, paid service, rollback, or M5 work was performed. All 172
protected Vault Guardian deletions remain untouched and unstaged.
## Ranked extraction and Camp continuation hotfix complete

The reported cleared-room Q reconnect, broken Camp next run, stale browser
state, and false Main Menu return are fixed on
`https://dungeon-of-one-room.pages.dev`.

- production Worker version: `4ab7c6be-9fea-4bc3-aa37-c1687143cd55` at 100%;
- production Pages deployment: `4eebd3c0-2065-4474-8630-946fed56df7e`;
- internal code commits: `0794906` (profile/Camp continuation) and `b107e3a`
  (extraction, recovery, Main Menu, and headed coverage);
- Q after an accepted room clear queues behind the in-flight checkpoint, stays
  a normal extraction, and enters the native Camp without exposing the next
  depth or showing reconnect;
- positive Camp Gold now receives a consistent profile ledger at the Worker
  boundary, and an existing zeroed legacy Camp ledger is repaired in memory on
  Camp access or next-run bootstrap without deleting cookies or migrating D1;
- transient Ranked-only state can reset for a fresh start only when no valid
  recovery exists; Practice and unrelated browser storage remain untouched;
- `Main Menu` after a failed Camp start invokes the native bridge and no longer
  reveals the Camp underneath.

Verification:

- focused regressions: 12/12 PASS;
- R2 threat matrix: 30/30 scenarios covered; R1-P0-001 remains accepted;
- `verify:fast`: 45/45 PASS;
- `verify:phase`: 723/723 PASS
  (`output/verification/phase-20260728T192005050Z.log`);
- `verify:baseline`: 3/3 PASS plus headed game smoke
  (`output/verification/baseline-20260728T192121287Z.log`);
- `verify:full`: 747/747 PASS, including 21/21 local Wrangler/D1 E2E and
  headed game smoke (`output/verification/full-20260728T192323050Z.log`);
- the dedicated headed Ranked lifecycle passed checkpoint+Q, normal Camp,
  next-run continuation and failed-start Main Menu with zero console/page
  errors; artifacts remain in `output/online-v3-m4-ranked-headed/`;
- the public production build matches the local runtime and `game.js` hashes;
  smoke passed `201 start -> 200 abandon`, and remote D1 confirms
  `run_cd9b7be2195b41d7a2fe2d901646a49a` is abandoned at revision 1 with zero
  leaderboard rows.

The first public smoke attempt started successfully but used an invalid
abandonment operation ID. Its revision-0 `awaiting_starting_relic` run
`run_2b3ffbcd18ac48edbc19d8514326621d` has no leaderboard row, cannot publish,
and is left to normal retention.

Source `game.js` remains byte-identical at SHA-256
`556829c909cdc9eaefb4238279457eb9b3427adef9ce494f35743542770ee7de`.
The ruleset remains `v08-meta-1` at
`sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6`.
No D1 schema/data migration, gameplay change, push, staging, paid service,
rollback, or M5 work was performed. All 172 protected Vault Guardian deletions
remain untouched and unstaged.
## Ranked browser-storage recovery hotfix complete

The player-reported generic `Ranked Unavailable` start failure is fixed on
`https://dungeon-of-one-room.pages.dev`.

- production Pages deployment: `47048250-f120-45c2-92e7-344cdb34c27f`;
- deployed source: `3d76ea6dc31e22dc4ed64d94a1f2bd674e4fb988` on production branch `main`;
- the failure was browser `QuotaExceededError` code 22 before any start API
  request; critical Ranked writes now retry once after removing only retired
  `dungeonRankedV2Active` and noncritical Online v3 leaderboard cache;
- Practice v3/v2 saves and unrelated browser data remain preserved;
- insufficient safe space has an explicit message and cannot enter reconnect
  recovery before a local session exists;
- public saturated-storage smoke passed `201 start -> 200 abandon`, reached the
  native starting-relic screen with zero console/page errors, and remote D1
  confirms `abandoned`, revision 1, and zero leaderboard rows.

Verification:

- focused regressions: 18/18 PASS;
- R2 threat matrix: 30/30 scenarios covered; R1-P0-001 remains accepted;
- `verify:fast`: 45/45 PASS;
- `verify:phase`: 721/721 PASS
  (`output/verification/phase-20260728T171838104Z.log`);
- `verify:baseline`: 3/3 PASS plus headed game smoke
  (`output/verification/baseline-20260728T171957035Z.log`);
- `verify:full`: 745/745 PASS, including 21/21 local Wrangler/D1 E2E and
  headed game smoke (`output/verification/full-20260728T172154637Z.log`);
- local and production saturated-storage screenshots were visually inspected.

One earlier public smoke attempt stopped after its start succeeded because the
test expected the wrong internal state label. Its revision-0
`awaiting_starting_relic` run has zero leaderboard rows, no selected relic,
cannot publish a result, and is left to normal retention.

Source `game.js` remains byte-identical at SHA-256
`556829c909cdc9eaefb4238279457eb9b3427adef9ce494f35743542770ee7de`.
The ruleset remains `v08-meta-1` at
`sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6`.
No Worker/D1 change, gameplay change, push, staging, paid service, rollback, or
M5 work was performed. All 172 protected Vault Guardian deletions remain
untouched and unstaged.
## Direct Ranked start and stale-profile recovery hotfix complete

The reported Ranked start/reconnect/forget loop is fixed on
`https://dungeon-of-one-room.pages.dev`.

- production Pages deployment: `2eeead39-2f33-4f75-818e-5d9909bbb3a8`;
- deployed source: `c091b7c1573d05e6c0c2afe17d6ecadd959940d8` on production branch `main`;
- with no Ranked recovery, `Ranked (Online)` starts immediately;
- a stale local Ranked profile is rejected once, replaced automatically, and
  retried without showing reconnect or forget screens;
- a saved Ranked run uses only the compact `Start New Ranked`, `Continue
  Ranked`, and `Cancel` menu, with narrower native gothic actions;
- the preceding local reward/death presentation fix is committed as `9f60eaa`
  and is included in the same Pages deployment.

Verification:

- R2 threat matrix: all 30 scenarios covered; R1-P0-001 remains accepted;
- `verify:fast`: 44/44 PASS
  (`output/verification/fast-20260728T150139026Z.log`);
- `verify:phase`: 717/717 PASS
  (`output/verification/phase-20260728T151817165Z.log`);
- `verify:baseline`: 3/3 PASS plus headed game smoke
  (`output/verification/baseline-20260728T152422708Z.log`);
- `verify:full`: 741/741 PASS, including 21/21 local Wrangler/D1 E2E and
  headed game smoke (`output/verification/full-20260728T152634804Z.log`);
- supplied headed Ranked lifecycle PASS for stale-profile repair, compact
  saved-run menu, reward boundary, native death presentation, network loss,
  reload, multi-tab, and Camp;
- public production smoke observed one expected `PROFILE_UNAUTHORIZED`,
  automatic fresh-profile start, a visible starting relic, no reconnect
  screen, zero page errors, and canonical abandonment; remote D1 confirms the
  smoke run is `abandoned` with zero leaderboard rows.

Source `game.js` remains byte-identical at SHA-256
`556829c909cdc9eaefb4238279457eb9b3427adef9ce494f35743542770ee7de`.
The ruleset remains `v08-meta-1` at
`sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6`.
No Worker/D1 change, gameplay change, push, staging, paid service, rollback, or
M5 work was performed. All 172 protected Vault Guardian deletions remain
untouched and unstaged.

## Practice/Ranked menu and recovery hotfix complete

The reported Practice pause, save selection, and stuck Ranked recovery flows
are fixed on `https://dungeon-of-one-room.pages.dev`.

- production Pages deployment: `6d91dd40-0a75-4f8c-86a3-2c3ff22e468c`;
- deployed source: `86cda91` on production branch `main`;
- Practice pause now shows `Main Menu`; the already-created Practice snapshot
  remains available through the native `Start New Game / Load Continue /
  Cancel` choice, including correct mouse selection;
- the ambiguous standalone Continue row is gone from the main menu;
- Ranked always opens `Start New Ranked / Continue Ranked / Cancel`; its local
  recovery remains separate from the Practice save;
- Start New with an existing Ranked save requires confirmation and canonically
  abandons the saved run before starting another;
- finalized/absent Ranked recoveries no longer return to generic reconnect,
  returning to the main menu releases the writer lease without abandoning the
  run, and an invalid local recovery can be explicitly forgotten after a
  warning so the browser is not permanently trapped.

Verification on commit `86cda91`:

- R2 threat matrix: 30/30 scenarios covered; R1-P0-001 unchanged;
- `verify:fast`: 40/40 PASS;
- `verify:phase`: 712/712 PASS
  (`output/verification/phase-20260728T134905229Z.log`);
- `verify:baseline`: 3/3 PASS plus headed baseline smoke
  (`output/verification/baseline-20260728T135044464Z.log`);
- `verify:full`: 736/736 PASS, including 21/21 local Wrangler/D1 E2E
  (`output/verification/full-20260728T135336347Z.log`);
- final supplied headed lifecycle PASS for Practice save navigation, Ranked
  lifecycle, network loss, reload, multi-tab, abandonment, restart, and Camp;
- public production smoke passed Practice pause/Load Continue and the Ranked
  selection screen with zero `/api/v3` requests, zero console errors, and zero
  page errors. Artifacts are under
  `output/production-smoke/menu-recovery-6d91dd40/`.

Source `game.js` remains byte-identical at SHA-256
`556829c909cdc9eaefb4238279457eb9b3427adef9ce494f35743542770ee7de`.
The ruleset remains `v08-meta-1` at
`sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6`.
No Worker, D1 schema, gameplay, mode name, combat-authority boundary, push,
staging, rollback, paid service, or M5 work changed. The 172 protected Vault
Guardian deletions remain untouched and unstaged.

## Ended Ranked recovery restart hotfix complete

The reported post-Abandon reconnect loop is fixed on
`https://dungeon-of-one-room.pages.dev`.

- production Pages deployment: `071e6723-8222-4e42-9d7b-bca60e73b763`;
- deployed source: `3d68783` on production branch `main`;
- an authenticated resume that proves the stored run is already abandoned,
  expired, or absent now shows `Ranked Run Ended` instead of the generic
  reconnect controls;
- `Start New Ranked Run` clears only that ended local recovery and starts a new
  canonical run; ordinary network/auth errors still preserve recovery;
- exact retry of a lost start response now persists the issued recovery record
  and reacquires the single-writer lease before entering Ranked.

Verification on commit `3d68783`:

- R2 threat matrix: 30/30 scenarios covered; R1-P0-001 unchanged;
- `verify:fast`: 40/40 PASS;
- `verify:phase`: 710/710 PASS
  (`output/verification/phase-20260728T102333628Z.log`);
- `verify:baseline`: 3/3 PASS plus headed baseline smoke
  (`output/verification/baseline-20260728T102516060Z.log`);
- `verify:full`: 734/734 PASS, including 21/21 local Wrangler/D1 E2E and
  headed smoke (`output/verification/full-20260728T102706847Z.log`);
- focused headed lifecycle reproduced three lost Abandon acknowledgements,
  terminal resume 410, the ended-run screen, and a different new run ID;
- public production headed smoke repeated ended recovery and new-run start with
  zero unexpected console/page errors. Its two final smoke runs are abandoned
  at revisions 1 and 2 and have zero leaderboard rows.

One earlier preflight-only synthetic run remains at
`awaiting_starting_relic`, revision 0, because its generated recovery credential
was intentionally not recoverable after the helper exited. It cannot publish a
result and is left to the normal retention policy instead of direct D1 deletion.

The source `game.js` remains byte-identical at SHA-256
`556829c909cdc9eaefb4238279457eb9b3427adef9ce494f35743542770ee7de`.
The ruleset remains `v08-meta-1` at
`sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6`.
No gameplay, Worker, D1 schema, combat-authority model, mode name, push,
staging, paid service, rollback, or M5 work changed. The 172 protected Vault
Guardian deletions remain untouched and unstaged.

## Ranked recovery acknowledgement hotfix complete

The stuck `Ranked reconnect required` flow is fixed in the production Worker.

- Worker version: `8e44d059-717c-4c6b-8cd9-591ed7c1bc1a`;
- source commit: `044839a`;
- an authenticated Abandon that was already committed but whose acknowledgement
  was lost now returns the same abandoned state successfully, even when the
  browser retries with a new operation ID;
- the repeated acknowledgement does not increment the run revision and cannot
  publish a leaderboard result;
- production smoke run `run_0c4b6e458ce543eb86de3fd5deb97341`
  passed start, first Abandon, recovery Abandon with a new operation ID, and
  terminal resume rejection; D1 confirms `abandoned`, revision 1, and zero
  leaderboard rows.

Verification:

- R2 threat matrix: 30/30 scenarios covered; R1-P0-001 unchanged;
- `verify:fast`: 39/39 PASS;
- `verify:phase`: 709/709 PASS;
- `verify:baseline`: 3/3 PASS plus headed baseline smoke;
- `verify:full`: 733/733 PASS, including 21/21 local Wrangler/D1 E2E and
  headed smoke.

No Pages asset, source `game.js`, gameplay, mode name, ruleset, D1 schema,
combat-authority boundary, push, staging, rollback, paid service, or M5 work
changed. The 172 protected Vault Guardian deletions remain untouched and
unstaged.

## Native Ranked extraction and Camp hotfix complete

The player-facing extraction lifecycle now uses the original v0.8 presentation
on `https://dungeon-of-one-room.pages.dev`.

- production Pages deployment: `2d7c68be-1430-4f7c-ba81-5416f00193a9`;
- deployed source: `6e90aa0` on production branch `main`;
- `Ranked Extraction`, manual `Finalize`, `Ranked Run Finalized`, `Open Camp`,
  and the separate scrollable `Ranked Camp` choice list were removed from the
  normal player flow;
- extraction now requests and finalizes the canonical result in the background,
  then projects the authenticated profile into the original v0.8 Camp;
- the native Camp Guide, tabs, upgrade/elixir/relic presentation, confirmation
  behavior, and `Start Next Run` control are reused unchanged;
- server-issued Camp upgrade, elixir, and relic-sale choices are committed
  through the native controls and the canonical profile is reprojected after
  acknowledgement;
- source `game.js` remains untouched; the integration exists only in the
  production builder output and Online v3 runtime.

Verification on commit `6e90aa0`:

- R2 threat matrix: 30/30 scenarios covered; R1-P0-001 unchanged;
- `verify:fast`: 39/39 PASS;
- `verify:phase`: 709/709 PASS
  (`output/verification/phase-20260728T090021133Z.log`);
- `verify:baseline`: 3/3 PASS plus headed baseline smoke
  (`output/verification/baseline-20260728T090217178Z.log`);
- `verify:full`: 733/733 PASS, including 21/21 local Wrangler/D1 E2E and headed
  smoke (`output/verification/full-20260728T090426026Z.log`);
- focused headed lifecycle: PASS for lifecycle, network loss, reload, multi-tab,
  native extraction-to-Camp, and native `Start Next Run`;
- post-deploy production smoke: PASS in native Camp with no visible Online
  overlay, no `Finalize`/`Open Camp`, five successful API responses, and zero
  console/page errors; finalized run
  `run_9a9e2f0efd59471cae9b8053ca123479`.

The source `game.js` remains byte-identical at SHA-256
`556829c909cdc9eaefb4238279457eb9b3427adef9ce494f35743542770ee7de`.
The ruleset remains `v08-meta-1` at
`sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6`.
No Worker, D1 schema, ruleset, combat authority, gameplay table, mode name,
push, staging, rollback, paid service, or M5 work changed. The 172 protected
Vault Guardian deletions remain unstaged and outside both commits and the
production bundle.

Hotfix commit:

- `6e90aa0` - restore the original extraction and Camp presentation while
  retaining canonical Online v3 accounting in the background.

## Production portal synchronization hotfix complete

The reported second-room portal block is fixed and active on
`https://dungeon-of-one-room.pages.dev`.

- final Pages deployment: `b9053e9a-c5c0-4784-87ce-ecddb5a32d86`;
- deployed source: `0e2bb6f` on production branch `main`;
- root cause: the real Ranked portal rebuilt the next room without calling
  `DungeonOnlineV3.onRoomEntered`, leaving the client session in
  `ENTERING_NEXT_ROOM` after the first descent;
- the production bundle now reports real portal room entry exactly as the
  existing test bridge already did; source `game.js` remains untouched;
- the headed regression clears and crosses two consecutive real player portals
  and reaches Depth 3 in `ROOM_ACTIVE`.

Verification on commit `1dc325c`:

- R2 threat matrix: all 30 scenarios covered; R1-P0-001 unchanged;
- `verify:fast`: 39/39 PASS;
- `verify:phase`: 709/709 PASS
  (`output/verification/phase-20260728T021317349Z.log`);
- `verify:baseline`: 3/3 PASS plus headed baseline smoke
  (`output/verification/baseline-20260728T021748914Z.log`);
- `verify:full`: 733/733 PASS, including 21/21 local Wrangler/D1 E2E and headed
  smoke (`output/verification/full-20260728T021929235Z.log`);
- focused headed lifecycle: PASS, including two consecutive real portal
  crossings; artifact: `output/online-v3-m4-ranked-headed/ranked-two-player-portals.png`;
- production headed smoke: PASS from Depth 1 through two checkpoints and two
  real portals to Depth 3, with zero API, console, or page errors; finalized
  smoke run: `run_5c348fefba484959ae81d41a711808a0`.
- post-redeploy fresh-profile menu audit: PASS; `Ranked (Online)` and
  `Ranked Leaderboard` render as native menu rows, both legacy floating controls
  are `display: none`, and console/page errors are zero.

The source `game.js` remains byte-identical at SHA-256
`556829c909cdc9eaefb4238279457eb9b3427adef9ce494f35743542770ee7de`.
The ruleset remains `v08-meta-1` at
`sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6`.
No gameplay, Worker, D1 schema, combat-authority model, mode names, push,
staging, rollback, paid service, or M5 work changed. The 172 Vault Guardian
deletions remain unstaged and outside the commit and deployment bundle.

Hotfix commit:

- `1dc325c` - synchronize the Online v3 session after a real portal descent and
  cover two consecutive player portal crossings.

## Previous production UI hotfix

The production UI hotfix is active on `https://dungeon-of-one-room.pages.dev`.

- final Pages deployment: `2c5bab5b-e9fa-4446-b946-f3cb00df44de`;
- deployed source: `797499d` on production branch `main`;
- native menu rows now contain `Practice (Offline)`, `Ranked (Online)`, and
  `Ranked Leaderboard`; the former floating controls remain hidden;
- the first boot input starts a visible loading bar and keyboard/pointer input
  stays locked through the complete boot fade until the menu is usable;
- Ranked relic offers use catalog names, descriptions, rarities, and icons;
- ordinary checkpoints save automatically with restrained feedback;
- player-facing Online v3 protocol terminology and raw identifiers are hidden.

Final verification on commit `797499d`:

- R2 threat matrix: all 30 scenarios covered; accepted R1-P0-001 boundary unchanged;
- `verify:phase`: 709/709 PASS (`output/verification/phase-20260728T014312884Z.log`);
- `verify:baseline`: 3/3 PASS plus headed Practice/Ranked smoke
  (`output/verification/baseline-20260728T014423271Z.log`);
- `verify:full`: 733/733 PASS, including 21/21 local Wrangler/D1 E2E and headed
  smoke (`output/verification/full-20260728T014601857Z.log`);
- focused headed lifecycle: PASS for lifecycle, network loss, reload, multi-tab,
  and Camp; visual artifacts are in ignored `output/online-v3-m4-ranked-headed/`;
- production headed smoke: PASS with Practice at zero `/api/v3` requests,
  start/resume/automatic checkpoint/next room/leaderboard all successful, and
  zero API, console, or page errors; smoke run
  `run_0f41876d60ee4a6e92996322b23945b1` reached revision 2.

The source `game.js` remains byte-identical at SHA-256
`556829c909cdc9eaefb4238279457eb9b3427adef9ce494f35743542770ee7de`.
The activated ruleset remains `v08-meta-1` at
`sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6`.
No gameplay, Worker, D1 schema, combat-authority model, mode names, or mode
rules changed. No staging, push, rollback, paid service, or M5 work was started.
The 172 Vault Guardian deletions remain unstaged and outside every commit and
both production bundles.

Hotfix commits:

- `24c2f4d` - integrate the production UI with the native game presentation;
- `877501f` - add focused production and headed coverage;
- `f2abf3a` - preserve the Ranked local recovery contract;
- `797499d` - hold boot input lock through the complete fade.

## Production release complete

Online v3 is active on the existing production Pages project:

- public URL: `https://dungeon-of-one-room.pages.dev`;
- Pages deployment: `a218de92-6f9d-4301-a322-219c28a4f9a5`;
- deployed source: `7645e80` on production branch `main`;
- private Worker: `dungeon-online-v3-production`, version `5ddb1e93-331a-4eef-b9f8-d86597f14fbd`;
- production D1: `dungeon-online-v3-production`, id `1a9e5378-420a-4088-8f1c-6d50af5a4f17`, region WEUR;
- applied migrations: `0001_initial.sql`, `0002_r2_ranked_profiles.sql`, `0003_r2_run_recovery.sql`;
- production binding: `RANKED_V3_BACKEND` -> `dungeon-online-v3-production`;
- HMAC secret is set in Cloudflare and was never printed or stored;
- start abuse control is bound at 10 requests per 60 seconds per profile;
- retention cron runs every 15 minutes.

The exact activated ruleset remains `v08-meta-1` with hash
`sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6`.
The ruleset data and hash did not change during release work.

## Production verification

Fresh verification on final commit `7645e80`:

- R2 threat matrix: all 30 R1 scenarios covered; R1-P0-001 remains accepted;
- `verify:phase`: 706/706 PASS (`output/verification/phase-20260727T234253162Z.log`);
- `verify:baseline`: 3/3 PASS plus headed smoke (`output/verification/baseline-20260727T234419707Z.log`);
- `verify:full`: 730/730 PASS, including 21/21 Wrangler/D1 E2E and headed smoke (`output/verification/full-20260727T234531139Z.log`);
- `git diff --check`: PASS.

Production headed smoke passed with zero browser errors:

- exact menu labels: `Practice (Offline)` and `Ranked (Online)`;
- Practice entered its first room with zero `/api/v3` requests;
- Ranked start, starting relic, first canonical directive, reload/resume, first checkpoint, next directive, and leaderboard all passed;
- smoke run `run_d59efc9a79ce4ceb924c7cb9a53049de` is present in production D1 at revision 2, depth 1, room 2, with the exact production ruleset hash.

Artifacts are in ignored `output/production-smoke/`.

## Release commits

- `9e0afa2` - prepare the production backend;
- `eeb0a22` - integrate Online v3 with production Pages;
- `ada513b` - bind the production D1;
- `6c3e5cf` - disconnect legacy bindings in the source manifest;
- `7645e80` - replace the legacy preview binding in future Pages configuration.

## Stop boundaries and recovery

R1-P0-001 is still an accepted product boundary. Combat remains local and is
not server-authoritative. Ranked and Practice keep the same gameplay rules and
their required names. No M5, staging, Access gate, tester allowlist, paid plan,
canary, or soak was started.

The production rollback target is Pages deployment
`29a15050-ad07-45e1-b2d8-90eba8f26a45`. Rolling Pages back removes production
access to the private v3 Worker.

Cloudflare production is exclusively connected to v3. The Pages project still
retains the old `RANKED_BACKEND` service binding in its dormant preview
configuration because production deployments cannot clear preview settings and
no preview/staging deployment was authorized. No new preview deployment was
created and production does not use this binding. Removing that administrative
preview setting requires a separate dashboard or Pages API mutation.

The configured GitHub `origin/main` has unrelated history (local/remote
146/62, no merge base). No force push, unrelated-history merge, or destructive
remote overwrite was attempted. Production was deployed directly through
Cloudflare Pages from the verified local commit.

The unrelated 172 Vault Guardian deletions remain unstaged, unmodified, and
outside every Online v3 commit and deployment.

## Local Ranked reward and death presentation regression fix

Core fix commit: `9f60eaa` (`Fix Ranked reward and death presentation`). The
current local `HEAD` also contains the later, separately scoped recovery commit
`c091b7c`; history was not rewritten or combined.

- reward slots belonging to an upcoming Warden, Otter, or Arena directive are
  fail-closed until that directive's room has a pending local clear;
- accepted nonterminal life loss now reuses the native v0.8 death overlay and
  death track, synchronizes the canonical server build/relic loss, and waits
  for R/Enter before entering the next canonical life;
- Chrono Loop and Second Chance server prevention retain the current room and
  do not show a false death presentation;
- source `game.js`, source `index.html`, Worker/D1, ruleset data/hash, reward
  probabilities, life accounting, Practice, combat authority, and mode names
  remain unchanged.

Verification on current local `HEAD`:

- focused regression tests: 11/11 PASS after the expected 8/11 RED;
- headed Ranked lifecycle: PASS, including ordinary-to-Warden reward ownership,
  post-Warden reward timing, `You Died`, `assets/death.mp3`, R continuation, and
  zero unexpected console/page errors;
- `verify:fast`: 44/44 PASS;
- `verify:phase`: 717/717 PASS;
- `verify:baseline`: 3/3 PASS plus headed baseline smoke;
- `verify:full`: 741/741 PASS, including 21/21 local Wrangler/D1 E2E and headed
  baseline smoke;
- source `game.js` SHA-256 remains
  `556829c909cdc9eaefb4238279457eb9b3427adef9ce494f35743542770ee7de`;
- ruleset remains `sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6`;
- all 172 protected Vault Guardian deletions remain unstaged with zero protected
  staged paths.

This task performed no push, deploy, staging, canary, soak, rollback, or M5
action. Production state was not mutated or re-verified by this task.

## R2 local gameplay-parity repair complete (2026-07-30)

`COMPLETED_LOCALLY` in commits `50a7c34` and `dd83b49`; production was not changed.

Implemented:

- canonical chest gold/potions/map fragments, potion use, room-clear gold, Merchant potions, first-Warden relic guarantees, and profile-scoped checkpoint unlocks;
- persistent campaign continuity across Camp descents, including one starting relic per campaign and a forced Vault after ten fragments;
- native Forge and Camp checkpoint flows without generic Ranked interruption screens;
- D1-order-independent campaign validation, which removes the reproduced HTTP 500/reconnect loop after selecting a starting relic;
- boot input lock through load/fade plus a short post-fade guard against accidental Main Menu selection.

Verification:

- R2 threat matrix 30/30 scenarios covered;
- `verify:fast` 48/48;
- `verify:phase` 736/736;
- `verify:baseline` 3/3 plus headed v0.8 smoke;
- `verify:full` 760/760, including Wrangler/D1 21/21 and headed v0.8 smoke;
- visible Ranked lifecycle PASS and dedicated native Merchant headed PASS.

Ruleset changed from `sha256:bfc32eb2fa252d6543e1c042cb6e45e828a8bf6237b0c30d0b9e2e0a13b99950` to `sha256:08dfa4f97d91b4f21dbfae7232246125ddbbc6a0270cf81a9e1ed012e5f5d403`.
Source `game.js` remains `556829c909cdc9eaefb4238279457eb9b3427adef9ce494f35743542770ee7de`.
All 172 protected Vault Guardian deletions remain untouched and unstaged.
R1-P0-001 remains accepted; local combat authority, mode names, and gameplay parity are unchanged.

No unresolved actionable R2 defect remains in this batch.
No push, deployment, activation, migration, paid service, or M5 work was performed.
