# HD 2.0 — local animation workshop

Current scope: player, all nine regular enemy types and nine boss/phase/biome
representations. Skitter has a modest new red-black chitin silhouette and clearer
articulated legs. The board, dark player palette, combat rules and turn durations
are preserved.

## Open

Run `node scripts/build-hd2-preview.mjs`, then serve the repository over HTTP.
The current local server uses port 5182:

- Comparison: http://127.0.0.1:5182/tools/hd2-preview/
- NPC skills and sound preview: http://127.0.0.1:5182/tools/hd2-preview/npc-skills.html
- Game: http://127.0.0.1:5182/output/hd2-dist/?hd2=1

The builder copies the current tree, including the new frames, and obtains the
boot commit/date from Git automatically. The game version remains v0.8.3.
HD2 is selected with `?hd2=1`; the default HD catalog keeps its original assets.

## Assets and timing

2400 real RGBA frames: 128x128 for ordinary actors and 256x256 for bosses.
Directional actors have four facings, eight idle/move/action poses and four
hit/death poses per facing. The stationary totem has one facing with idle,
awaken, cast, hit and death. Source sheets, prompts and repair provenance live
in `art/source/early-v2`, `art/source/all-v2` and `art/source/npc-skills-v2`;
original HD1 locks are intact. The NPC audit adds separate Acolyte heal/buff
sequences and replaces Bulwark's attack with a shield bash (96 authored frames,
64 additional files). When regenerating assets, run `build-hd2-npc-skills.py`
after the early/all asset builders, then rebuild the local preview.

Movement still takes 120 ms, player attacks 240 ms. Aiming enemies hold the
prepared pose until their actual action signal, then release/recover. Melee
enemies use real attack events and begin at the impact pose. Disorientation
flashes cannot impersonate an attack. Thirteen short procedural NPC sounds use
the existing game master/mute path and an 80 ms per-cue repetition limit.
Enemy death frames are included
in the workshop; enemies still disappear immediately when defeated in the game.
The preview's slow motion does not affect the game.

The built-in Images tool generated the artwork. Its invocation did not expose a
model selector or verifiable model identity, so these receipts do not assert
that a specific Images 2.5 model produced them.

## Verification

- `node --test tests/hd2-early-animation.test.js tests/hd2-all-animation.test.js tests/hd-player-motion.test.js tests/hd-renderer.test.js tests/hd-asset-loader.test.js`: 58 PASS.
- `python scripts/verify-hd2-assets.py`: 2400 frames; complete clips, actual alpha and transparent padding PASS (Pillow required).
- `node --test tests/hd2-npc-skills.test.js tests/hd2-npc-audio.test.js tests/audio-freeze.test.js`: 12 PASS (included in the 70-test combined focused run).
- `node scripts/verify-hd2-npc-skills.mjs`: 12 directional skill previews, actual heal/buff/rift/bash, misses, mute and 13 rendered sound signals PASS.
- `node scripts/verify-hd2-early.mjs`: 365 preview combinations plus roster/game actions and seven boss scenarios PASS; no missing assets or page errors.
- Installed `develop-web-game` Playwright client: three iterations with 15 s loading pauses; gameplay screenshots and state inspected.
- `npm run verify:ui-current -- --scenario hd`: PASS.
- `npm run verify:baseline`: committed HEAD 5242be0 PASS; this checks the protected committed baseline, not uncommitted HD2 artwork.
- Changed JavaScript `node --check` and `git diff --check`: PASS.

The first `verify:guard` detected stale generated game-source checksums. The
generator refresh changes provenance byte lengths/hashes, not canonical rules.
The resulting local ruleset manifest hash is
`sha256:83367e1a4e09d8f3527f63ea7ba805916e4eacf7ab7cd07cfd5f93612b097b12`.
Verification receipts and screenshots are in ignored `output/verification/`.

`npm run verify:phase`: generator drift PASS; Worker suite 1141/1149 PASS.
Eight release-binding tests fail because this local candidate hash has not been
promoted into the active descriptor/client allowlist. HD2 is therefore a local
visual candidate, not a release-ready Ranked deployment. All 35 generated JSON
diffs were compared structurally: only provenance byte lengths and hashes changed.
Canonical game rules are identical. Do not activate a hash merely to silence
these tests; a future explicitly authorized release must bind and verify it.

No commit, push, ruleset activation or deployment is part of this HD2 task.

Current NPC findings and verification details:
`docs/audits/2026-09-09-hd2-npc-skills-and-sfx.md`.
