# Online v3 - Production handoff

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
