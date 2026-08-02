# Acolyte Support AI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep Acolytes in support position and preserve `heal -> buff -> attack` as the shared Practice/Ranked cast priority.

**Architecture:** `game.js` selects the best support anchor using the existing Acolyte target priorities and passes only its position plus the support range into `enemy-director.js`. The director gives Acolytes a distinct `support` role, keeps them within four tiles of that anchor, and falls back to existing ranged movement only when no non-Acolyte ally exists.

**Tech Stack:** Browser JavaScript, Node test runner, existing Online v3 verification scripts.

---

### Task 1: Add RED support-role regressions

**Files:**
- Create: `tests/acolyte-support-ai.test.js`

1. Load `enemy-director.js` with deterministic `Math.random`.
2. Assert that an Acolyte with an anchor returns role/intent `support` and does not leave the four-tile support radius.
3. Assert that an out-of-range Acolyte reduces distance to the anchor.
4. Assert that a solo Acolyte retains the ranged attack fallback.
5. Assert that Skeleton behavior remains `ranged`.
6. Assert from `game.js` that heal selection precedes buff selection and attack remains the final fallback.
7. Run `node --test tests/acolyte-support-ai.test.js`; expect the support-role assertions to fail.

### Task 2: Implement support-aware positioning

**Files:**
- Modify: `game.js`
- Modify: `enemy-director.js`
- Test: `tests/acolyte-support-ai.test.js`

1. Add `getAcolyteSupportAnchor(caster)` to `game.js`, reusing existing heal, buff, and enemy-priority helpers.
2. Pass a plain `{ x, y }` anchor and `ACOLYTE_SUPPORT_RANGE` into both normal and preview director calls.
3. Return role `support` for Acolytes in `enemy-director.js`.
4. When an anchor exists, choose intent `support`, strongly penalize tiles outside its range, and prefer a stable two-to-four-tile support band.
5. Do not apply the generic adjacent-ally avoidance penalty to a support Acolyte.
6. When no anchor exists, evaluate movement with the existing ranged fallback while still reporting the Acolyte role as `support`.
7. Run the focused test and JavaScript syntax checks; expect PASS.

### Task 3: Verify protected gameplay and record the change

**Files:**
- Modify: `progress.md`

1. Run the directly affected AI tests and `git diff --check`.
2. Run `npm.cmd run verify:guard` once.
3. Run `npm.cmd run verify:baseline` because protected gameplay behavior changed.
4. Inspect the headed smoke screenshot/state and console result produced by baseline verification.
5. Append the implemented behavior, checks, and any remaining limitation to `progress.md`.
6. Inspect full status/diff, stage only explicit paths, and create one local implementation commit. Do not push or deploy.
