# Online v3 - Production handoff

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
