# HD2 NPC skills and SFX audit — 2026-09-09

Scope: hostile NPCs and bosses in the local HD2 candidate on
`codex/hd2-early-animations`, committed baseline `5242be0`. The user requested
additional animation where needed, particularly skill use and SFX. This is a
presentation audit, not an authorization to activate a Ranked release.

## Findings and implemented corrections

| Finding | Correction |
| --- | --- |
| Riftweaver and Bulwark set `castFlash` during preparation; the renderer could show release before execution. | Preparation flags take precedence: poses 1–5 then hold 5, execution uses 6–8. |
| Lattice, Void Step, Soul Chain, Chain Hook and Lockdown had incomplete boss windup handling. A missed chain could have no release pose. | Recognize all five preparation flags and source-ID-matched actual release events. A lattice burst overrides another pending lattice windup only for the event duration. |
| Acolyte heal/buff used the same gesture and AI cleared the cast kind immediately. | Two new four-direction, eight-pose sequences. Short visual events preserve the action identity after the AI resets its field. |
| Bulwark's previous attack did not clearly communicate shield bash. | New four-direction shield thrust, keeping the sword low. |
| Generic flashes could make disorientation look like a melee attack; a full attack animation delayed visible impact until after damage. | Real melee events select impact/recovery poses directly. Existing telegraphed attacks retain their preparation. |
| Several skill cues depended on damage or were absent, so a miss could be silent. | Event-driven procedural SFX for charge, melee, bolt, heal, buff, hex, venom, bash, rift, chain, blink, slam and aura. Launch cues also play on a miss. |

Main integration: `game.js`, `render/hd-renderer-layers.js`,
`render/hd-asset-manifest.js`, `render/hd2-npc-cues.js` and `index.html`.
Audio uses the existing `playSfx`/master/mute path, respects simulation audio
suppression and limits repeated same-kind cues to one per 80 ms. It does not
play from the render loop or create a second game AudioContext. Passive totem
aura has no repetitive per-turn cue. Attack damage, AI decisions, RNG, cooldowns,
turn duration and soundtrack assets are unchanged.

Three generated sheets contribute 96 normalized frames: 64 new Acolyte frames
and 32 replacement Bulwark frames. Total HD2 catalog: 2400 RGBA frames. Other
boss skills reuse existing cast poses with corrected preparation/release timing
and their existing VFX; separate new sheets were not needed for this audit.
Enemy death sequences remain workshop-only because defeated enemies are still
removed immediately. Friendly noncombat NPC interaction animations were not
part of this hostile-NPC skill pass.

Sources, prompts and receipts: `art/source/npc-skills-v2`. The built-in Images
tool does not expose verifiable model identity; no Images 2.5 identity is
asserted. Packaging is reproducible with `scripts/build-hd2-npc-skills.py`
(Pillow), after the base HD2 asset builders. Source keying can leave a faint
colored edge at workshop zoom; gameplay-size screenshots were inspected.

## Verification

- Combined `node --test` run over `hd2-npc-skills`, `hd2-npc-audio`,
  `hd2-early-animation`, `hd2-all-animation`, `hd-player-motion`, `hd-renderer`,
  `hd-asset-loader` and `audio-freeze`: 70/70 PASS. Final NPC/audio subset:
  12/12 PASS after removing two repeated cue calls found in review.
- `python scripts/verify-hd2-assets.py`: 2400 complete RGBA frames with real
  transparency and clear padding PASS.
- `node scripts/verify-hd2-early.mjs`: 365 preview combinations, seven boss
  scenarios, 2400 loaded assets, game boot/actions, no page errors or missing
  resources PASS. A transient navigation failure was rerun; the diagnostic
  handler now preserves the original error if the page context disappears.
- `node scripts/verify-hd2-npc-skills.mjs`: 12 directional previews, actual
  healing/buff application, rift/bash preparation and misses, mute, and 13
  finite nonzero OfflineAudioContext signals PASS. No hardware listening test
  is claimed; the preview provides opt-in audition buttons.
- Installed `develop-web-game/scripts/web_game_playwright_client.js` with
  `tools/hd2-preview/actions.json`, three iterations and 15000 ms pauses:
  completed; `state-2.json` and gameplay `shot-2.png` inspected.
- `npm run verify:ui-current -- --scenario hd`: PASS.
- `npm run verify:guard`: 15/15 core checks, generator drift, syntax and
  whitespace PASS. Final changed-source `node --check` also PASS.
- Existing committed `npm run verify:baseline` receipt for unchanged HEAD
  `5242be0`: PASS; this is not a test of uncommitted HD2 assets.
- `npm run verify:phase`: 1141/1149 PASS; eight release-binding failures remain.
  An earlier run had 29 failures because CRLF source broke exact-text build
  patches. Restoring the original LF format removed the extra 21 failures.
- All 35 generated Worker JSON diffs were compared structurally after removing
  only `sha256`, `byteLength` and `rulesetHash`: canonical content is identical.

Detailed receipts and screenshots remain in ignored `output/verification/`.

## Remaining release gate

Local candidate hash:
`sha256:83367e1a4e09d8f3527f63ea7ba805916e4eacf7ab7cd07cfd5f93612b097b12`.
The active descriptor/client allowlist still references the prior release.
Eight tests require candidate activation and client compatibility binding.
These tests were not weakened and the bindings were not changed. The visual
candidate is local, not a release-ready Ranked deployment. An authorized
release must bind and verify the final committed candidate.
