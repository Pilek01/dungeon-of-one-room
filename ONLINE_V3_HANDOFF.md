# Online v3 handoff - Phase 2

Date: 2026-07-23

Workspace: `D:\Codex workstation\Dungeon\dungeon-online-v3`

Protected baseline: `f98820c99066d810169e100beb23a54a332734bd`

Phase 1 commit: `0fe1423 Add Online v3 architecture and no-op boundary`

## Delivered

Phase 2 adds an isolated Cloudflare Worker under `cloudflare/leaderboard-v3` with:

- pure domain transitions returning `{ nextState, response, storageEffects }`;
- injected, fail-closed `RulesetV3` with six required methods;
- fixture-only deterministic ruleset data;
- canonical HMAC-SHA-256 checkpoint tokens using Web Crypto;
- D1 repositories and one migration containing exactly two tables;
- optimistic revision concurrency and atomic finalize/publication;
- bounded in-row idempotency replay history;
- all six `/api/v3` endpoints;
- authoritative gold, depth, build, offer, inventory, schedule, and score transitions;
- explicit `checkpoint_verified_v3` publication;
- fixture endpoint, domain, token, migration, D1-budget, network-loss, idempotency, and baseline-guard tests;
- an explicit 20-case anti-tamper matrix.

No production ruleset is included. No Online v3 module is loaded by `index.html`, and no game/client integration was performed.

## Validation

Worker suite:

```text
npm.cmd test
64 tests, 64 pass, 0 fail
```

Payload-size diagnostics included in that suite:

```text
fixture checkpoint token: 614 bytes
fixture checkpoint request: 1167 bytes
request limit: 65536 bytes
```

Other checks:

```text
node --check every Worker JavaScript file: pass
node --check game.js: pass
node tests/expansion-release.test.js: pass
focused active soundtrack/audio contract: 1/1 pass
node scripts/online-v3-baseline-smoke.mjs: PASS (headed)
```

The headed browser artifacts remain ignored under:

```text
output/online-v3-baseline
```

The local baseline runner `scripts/online-v3-baseline-smoke.mjs` remains intentionally untracked and is not part of either implementation commit.

`wrangler` is not installed in this workspace. No package was downloaded and no local Worker runtime or deployment was started. Migration shape is exercised with Node SQLite; Worker behavior uses injected repositories.

## Security and storage contract

- Secret binding: `RANKED_V3_HMAC_SECRET`, minimum 32 UTF-8 bytes.
- Token claims: protocol, run, revision, season, ruleset hash, state digest, directive, nonce, issue time, expiry.
- D1 is authoritative even when a token signature is valid.
- Normal mutation: one read plus `UPDATE ... WHERE run_id = ? AND revision = ?`.
- Finalize: one read plus a two-statement D1 batch.
- Losing an optimistic-concurrency race returns `409 REVISION_CONFLICT`.
- Exact request/key replay returns the stored response, including after the original token expires.
- Changed content under an existing key returns `409 IDEMPOTENCY_KEY_REUSED`.
- Recent operation history is capped at 24 entries in `ranked_runs.recent_ops_json`.
- No per-command, replay, event, or idempotency table exists.

## Deliberate limitation

Online v3 verifies checkpoint continuity and authoritative meta progression. It does not verify combat execution.

A modified client can fabricate a plausible compact command journal and combat outcome. The journal is a bounded heuristic signal only. The Worker therefore publishes `verification_level = "checkpoint_verified_v3"` and makes no claim of server-authoritative combat.

## Network-loss contract

Retry with the exact same serialized body and the same `Idempotency-Key`. If the original operation committed but its response was lost, the Worker returns the stored response and performs no second reward, charge, revision advance, finalize, or leaderboard insert. If execution never began, the first received retry performs the operation once. Browser-side retry queue implementation remains future work.

## Protected baseline

Phase 2 changes none of:

```text
game.js
config.js
index.html
style.css
style-hd-*.css
assets/**
audio/**
cheat behavior
Observer Bot behavior
special-room behavior
```

The Worker imports no game, DOM, audio, HUD, renderer, or Ranked/Online v2 module. `index.html` contains no v3 script reference.

## Not done

- no production v0.8 ruleset or invented balance data;
- no browser fetch client or retry queue;
- no hooks in the game;
- no leaderboard UI integration;
- no Worker runtime launch;
- no D1 resource creation;
- no secret creation;
- no deploy, push, rebase, merge, or worktree.

The Phase 2 commit subject is:

```text
Implement isolated Online v3 Worker and fixture tests
```
