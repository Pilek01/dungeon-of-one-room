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

- Latest production-recording source commit: `9d6a179` on `main`.
- Latest Online Ranked boundary implementation: `fe439c8`.
- Production Worker version:
  `18cd3024-9ebf-44bf-9b4d-160f45e396bf` at 100%.
- Production Pages deployment: `0bc8fdd5`.
- Production/retained ruleset:
  `sha256:d784208aad891119b71c52324cea358997ee376313914d5799affa68c8678ff3`.
- Local unpromoted candidate:
  `sha256:2ac2eb5499892cc49258c5b674beab846cb41906a5ef86a658d5e90325505a0d`.
- No old test campaign backfill, D1 data migration, or history rewrite was
  performed for the latest repair.

The latest production repair separates a fresh Ranked campaign from
Extract -> Camp -> Start Next Run, preserves next-run campaign state, resets
fresh-campaign score/chest effects, supports only server-issued Camp mutator
additions, and accounts elixir use once across checkpoint/death retries. The
deployed Observer Bot remains gated by a build-time password hash; with no
password it is not exposed.

## Latest release evidence

- Focused boundary regressions: 6/6 PASS.
- Release/R2/boundary focused set: 20/20 PASS.
- `verify:fast`: 51/51 PASS under the historical pre-optimization suite.
- `verify:phase`: 762/762 PASS.
- `verify:baseline`: 3/3 guard tests plus headed smoke PASS.
- `verify:full`: 786/786 PASS, including Wrangler/D1 21/21.
- Headed Ranked lifecycle PASS.
- Pages build: 3109 files.

These totals are point-in-time release evidence. They do not require rerunning
the same suites for unrelated small changes.

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
