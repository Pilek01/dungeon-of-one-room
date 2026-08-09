# Worktree Consolidation Implementation Plan

> **For agentic workers:** Execute inline with `superpowers:executing-plans`. Project instructions require one agent and no delegation.

**Goal:** Preserve all intentional local work, integrate every valuable branch into `main`, verify the combined game, and remove only worktrees proven safe to delete.

**Architecture:** Treat named branches and uncommitted working trees as separate recovery sources. First classify and commit intentional WIP on its source branch, then merge the three branches not contained by `main`, resolve overlaps on `main`, run release-level verification, and remove only clean worktrees whose commits remain reachable.

**Tech Stack:** Git worktrees, PowerShell, Node.js, repository verification scripts.

## Global Constraints

- Do not push, deploy, activate a ruleset, or modify production state.
- Preserve the protected v0.8 baseline and all unrelated user changes.
- Do not use `git add .`, `git add -A`, force deletion, reset, or checkout-based discard.
- Keep every intentional change reachable from a named branch or `main` before cleanup.

---

### Task 1: Classify and preserve working-tree changes

**Files:** All dirty worktrees reported by `git worktree list --porcelain`.

- [ ] Inventory concise status and diffs for each dirty named worktree.
- [ ] Compare untracked duplicates against committed branch content.
- [ ] Commit intentional WIP on its owning branch with explicit path staging.
- [ ] Leave generated output, `.wrangler`, and filename-length artifacts out of commits.

### Task 2: Integrate branches into main

**Branches:** `codex/observer-bot-record-archive-repair`, `codex/ranked-reference-plates`, `codex/local-test-launcher`.

- [ ] Confirm each branch forked from current `main` and preserve a safety reference.
- [ ] Merge record archive repair into `main`.
- [ ] Merge ranked reference plates and resolve overlapping leaderboard/archive behavior.
- [ ] Merge the local Ranked launcher.
- [ ] Confirm all local named branch tips are ancestors of `main`.

### Task 3: Verify the integrated repository

**Checks:** Repository-defined focused checks plus `npm run verify:full` because this is a cross-subsystem milestone integration.

- [ ] Run syntax and focused tests implicated by preserved WIP/conflict resolution.
- [ ] Run `npm run verify:full` once.
- [ ] Run `git diff --check` and inspect full `git status --short`.

### Task 4: Clean merged worktrees

**Paths:** Only exact registered worktree paths proven clean or consisting solely of disposable generated state.

- [ ] Verify every removable HEAD is reachable from `main`.
- [ ] Remove registered project-owned worktrees individually.
- [ ] Preserve any worktree with unresolved intentional changes.
- [ ] Prune stale registrations and report remaining worktrees.
