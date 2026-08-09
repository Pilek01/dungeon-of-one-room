# Boot Build Metadata Design

## Goal

Show accurate build identity directly below `Made by Kamil Matysek` on the boot screen in this format:

`v0.8.0 · caf92d2 · 2026-08-09`

The version label comes from the existing `window.GAME_VERSION`. The short commit hash and date come from the Git commit used to build the game.

## Design

The Pages build script reads the current commit hash and commit date from Git. It writes those values into the built copy of `config.js`; tracked source configuration does not contain a manually maintained commit hash.

The boot screen gains a dedicated metadata element below the credits. A small boot-time binding reads `GAME_VERSION`, the injected short commit hash, and the injected ISO commit date, then renders the single metadata line. Development runs that have not gone through the build pipeline use an explicit development fallback instead of presenting a false commit identity.

The styling remains secondary to the author credit: smaller type, muted color, centered alignment, and no additional interaction.

## Failure Handling

The build fails with a clear error if Git cannot provide a commit hash or commit date. This prevents release and Local Ranked Test builds from silently displaying stale or placeholder metadata.

## Tests

- A focused build test verifies that a build injects the selected commit hash and date.
- A focused UI/source test verifies the metadata element and the expected `version · commit · date` binding.
- The boot browser scenario verifies that the metadata is visible without disturbing the existing launcher screen.
- JavaScript syntax checks and `git diff --check` cover the changed files.

## Repository Instruction

`AGENTS.md` will require every game-changing task to preserve the boot build identity and keep `GAME_VERSION` correct for the intended release. Commit hash and date remain automatically generated and must never be updated manually.

## Scope

This change affects only boot-screen build identity, its build-time injection, focused tests, and the matching repository instruction. It does not change gameplay, Ranked rules, leaderboard data, deployment state, or production configuration.
