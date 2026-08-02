# Online v3 - Current handoff

Updated: 2026-08-02

## Task authority

There is no standing file-based task. The current user prompt in chat defines
the task and allowed scope. `docs/tasks/CURRENT.md` is `Status: NONE`.

Do not infer implementation, push, deployment, migration, backfill, or
ruleset-activation authority from this handoff.

## Architecture boundary

Online v3 is checkpoint-authoritative meta progression around the local v0.8
game. Combat simulation and presentation remain local and offline during
movement, combat, AI, animation, audio, and rendering.

The Worker controls only documented meta-state such as directives, sequential
depth, canonical gold/build/transactions, server-issued offers, checkpoint
revisions, campaign lifecycle, and final leaderboard publication.

Do not describe the system as server-authoritative combat or cheat-proof.

## Current production snapshot

- Latest deployed source commit: `cc84cf1` on local `main`.
- Latest merged Online Ranked feature commit: `c72e30d`.
- Production Worker version:
  `19b9174c-f720-4484-8f7b-c0918215c29b` at 100%.
- Production Pages deployment: `b8255226`.
- Active production ruleset:
  `sha256:bc0d548d204557d0cc0ec7f8a358e18246778a13b27c58f5c6cdd73e73621711`.
- Retained previous ruleset:
  `sha256:d784208aad891119b71c52324cea358997ee376313914d5799affa68c8678ff3`.
- D1 migrations were already current (`No migrations to apply`). No D1
  mutator backfill was performed: ranked profiles import the authoritative
  Practice unlock state on first use, which cannot be reconstructed in D1.

The latest production repair separates a fresh Ranked campaign from
Extract -> Camp -> Start Next Run, preserves next-run campaign state, resets
fresh-campaign score/chest effects, supports only server-issued Camp mutator
additions, and accounts elixir use once across checkpoint/death retries. The
deployed Observer Bot remains gated by the preserved build-time password hash;
no plaintext password was read or stored during this release.

## Latest release evidence

- Focused activation and R2 protocol set: 14/14 PASS.
- `verify:full`: 800/800 PASS, including Wrangler/D1 21/21, clean committed
  baseline, and clean committed Ranked lifecycle.
- Pages build: 3109 files; 3108 uploaded by Wrangler.
- Independent live checks: HTTP 200, availability active, activated ruleset
  hash matches, Observer Bot gate preserved, and protocol asset matches on
  both the deployment URL and the project alias.

These totals are point-in-time release evidence. They do not require rerunning
the same suites for unrelated small changes.

## Browser QA workflow

Package B separates fast, current-tree browser checks from committed release
coverage without reducing release scope:

- `verify:ui-current -- --scenario boot|hd|save` runs one affected baseline
  surface from the current working tree;
- `verify:ranked-headed -- --scenario recovery|lifecycle|camp` runs one
  affected Ranked browser surface from the current working tree;
- `verify:baseline` runs the complete protected baseline from committed
  `HEAD`, without Ranked;
- `verify:full` / `verify:release` still runs phase checks, the complete
  committed baseline, complete committed Ranked lifecycle, and Wrangler/D1.

Ranked QA uses the marked `output/pages-test-dist` bundle. The deployable
`output/pages-dist` contains no QA marker or test-only boot-readiness hook.
Passing receipts are scenario-specific and reusable when their fingerprint is
unchanged. The latest fresh full headed timings were 24.5 seconds for
the baseline and 71.0 seconds for Ranked, with zero unexpected console/page
errors. Package C has not started.

## Protected working tree

At this snapshot, preserve without staging or editing:

- 172 tracked deletions under
  `Dungeon-v0.8.1-Vault-Guardian-Codex-Pack/`, fingerprint
  `sha256:067236e55ded3f10dfc46bfe7fb3014e177ffba2636d256e58ce367e7a5a08bf`;
- 3 untracked entries under `.wrangler/`, fingerprint
  `sha256:81967eb2b72c4c4d0685a9879b8e802f101d9599b0deac97174634a55c9a6eb3`.

Always confirm with `npm run status:compact`. Before staging or committing,
also inspect the full `git status --short`.

## History

This file intentionally contains only the current operational snapshot.
Completed handoff history remains available through Git history and the
relevant `docs/ONLINE_V3_*` or `docs/history/` records. Do not load that
history automatically for a small isolated task.
