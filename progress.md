Original prompt: Create a hard-forked Dungeon 1.0 in a new folder, keep the original game untouched, and push the fork toward a major 1.0 redesign while staying compatible with the current save and leaderboard protocol.

2026-03-05
- Fork created in `dungeon-1.0/` with copied client files and assets.
- Rebranded fork to `v1.0.0-alpha` and added `window.DUNGEON_FORK_ID = "dungeon-1.0"`.
- Added campaign regions (`Descent`, `Corruption`, `Rupture`, `Collapse`, `Endgame`) to room intro and depth badge.
- Region configs now affect room odds, room pressure caps, boss add count, and milestone announcements.
- Added new pure module `build-identity.js`.
- Added test file `tests/build-identity.test.js` and verified it with `node tests/build-identity.test.js`.
- Build identity now appears in HUD as `Build`.
- Relic drafts in fork are now lightly biased toward current run archetype instead of pure random candidate selection.
- Relic draft UI now shows `ON BUILD` / `FLEX` badges and `Current Build` subtitle detail.
- Added new pure module `merchant-curation.js`.
- Added test file `tests/merchant-curation.test.js` and verified it with `node tests/merchant-curation.test.js`.
- Merchant relic offer in the fork is now curated toward the current build instead of being purely random within rarity tier.
- Merchant relic row now displays `ON BUILD` / `FLEX` when the offer is aligned with the current run archetype.
- Added `tests/smoke-actions.json` for minimal browser smoke verification.
- Verified fork boot/render with Playwright smoke run; latest canvas screenshot: `output/web-game/shot-0.png`.
- Added new pure module `boss-campaign.js`.
- Added test file `tests/boss-campaign.test.js` and verified it with `node tests/boss-campaign.test.js`.
- Warden now uses region-based boss profiles in the fork:
  - custom boss names per campaign region,
  - custom HP/ATK multipliers,
  - custom pulse/burst pacing,
  - custom anti-kite smartness,
  - Void Aegis unlocked only in later campaign regions through the profile system.
- Boss intro text and room intro splash now identify the current Warden form instead of generic boss text.
- Verified fork render after boss pass with Playwright smoke run; latest canvas screenshot: `output/web-game-bosspass/shot-0.png`.

Next good targets
- New room ecosystem pass: add 1 new strategic room type instead of adding filler content.
- Merchant follow-up: reserved relics could become region/build-aware too, not only the live slot.
- Boss follow-up: final depth 100 Warden can now get a unique one-off phase or event without touching earlier profiles.

2026-03-06
- Added `Forge` as the first 1.0-exclusive strategic room type.
- Added pure module `forge-room.js`.
- Added test file `tests/forge-room.test.js` and verified it with `node tests/forge-room.test.js`.
- Forge room behavior:
  - no combat,
  - immediately safe/cleared,
  - one forge interactable on the board,
  - pressing `E` on the forge opens a premium relic draft.
- Forge draft is build-aware and depth-aware:
  - early: rare/epic,
  - mid: rare/epic/legendary,
  - late: epic/legendary/mythic tail.
- Forge uses the existing relic draft/swap pipeline, so all cap logic and swap handling stay shared.
- Added forge persistence to run snapshot save/load.
- Added forge draw pass with warm fallback visuals.
- Taught the bot to route to forge after room clear before leaving through portal.
- Verified unit tests:
  - `node tests/forge-room.test.js`
  - `node tests/build-identity.test.js`
  - `node tests/merchant-curation.test.js`
  - `node tests/boss-campaign.test.js`
- Verified syntax:
  - `node --check forge-room.js`
  - `node --check game.js`
- Verified fork render with Playwright smoke run; current screenshot:
  - `output/web-game-forge-smoke/shot-2.png`

Updated next good targets
- Forge follow-up: add a true transmute/refine branch later instead of draft-only interaction.
- Merchant follow-up: make reserved relic logic region-aware and build-aware.
- Final boss follow-up: give depth 100 Warden a unique event/phase and payoff screen.

- Added `Run Climax` package foundations:
  - Forge 2.0 shell: forge now has `Refine` and `Transmute` entry flow instead of draft-only open.
  - Transmute path now exists end-to-end:
    - choose sacrifice relic,
    - receive curated 3-choice replacement draft,
    - selected relic replaces the sacrificed relic directly.
  - Added new pure module `pact-room.js`.
  - Added test file `tests/pact-room.test.js` and verified it with `node tests/pact-room.test.js`.
  - Added new strategic room type `Pact`:
    - safe room,
    - one sigil interactable,
    - pre-rolled pact offers saved into room state.
  - Added first pact set with persistent current-game effects:
    - Hunger,
    - Precision,
    - Velocity,
    - Avarice,
    - Iron,
    - Fury.
  - Pact effects are now integrated into runtime in the fork:
    - damage dealt,
    - potion healing,
    - merchant prices,
    - damage taken,
    - cooldown pacing,
    - fury behavior,
    - persistent stat-altering pacts reapplied on next run within the same game.
  - Depth 100 boss now uses a unique 2-phase final boss flow in the fork:
    - phase 1 defeat no longer ends the campaign,
    - room immediately shifts into phase 2,
    - only phase 2 death triggers final victory.
  - Final chamber branding added:
    - depth 100 boss intro now identifies the room as `Final Chamber`,
    - victory overlay now uses `FINAL VICTORY`.
  - Bot safety pass:
    - bot can resolve forge mode selection,
    - bot can resolve pact selection,
    - bot routes to pact room interactable after room clear.
  - Verified tests:
    - `node tests/forge-room.test.js`
    - `node tests/pact-room.test.js`
    - `node tests/boss-campaign.test.js`
  - Verified syntax:
    - `node --check game.js`
    - `node --check pact-room.js`
  - Verified fork boot/render with Playwright smoke run:
    - `output/web-game-run-climax-smoke/shot-2.png`
- Added scenario override module `scenario-overrides.js` for deterministic fork-only browser tests.
- Added URL scenarios:
  - `?scenario=forge`
  - `?scenario=forge_transmute`
  - `?scenario=pact`
  - `?scenario=final_chamber_transition`
- Added test file `tests/scenario-overrides.test.js` and verified it with `node tests/scenario-overrides.test.js`.
- Added fork-only bootstrap flow so scenarios auto-start directly into controlled states without touching the original game.
- Added deterministic scenario placement/setup:
  - forge/pact interactable spawns adjacent to player,
  - final chamber transition spawns a 1 HP phase-1 Warden next to player,
  - forge transmute scenario injects 1 sacrificial relic and opens transmute selection immediately.
- Added test hooks to the fork runtime:
  - `window.render_game_to_text`
  - `window.advanceTime(ms)`
- Added better keyboard fallback UX in the fork:
  - `Enter` confirms default Forge Refine,
  - `Enter` confirms default Pact pick,
  - `Enter` confirms first Forge Transmute sacrifice,
  - `A/B` work as Forge `Refine/Transmute` shortcuts.
- Verified browser scenarios with Playwright client and deterministic state output:
  - Forge Refine -> `output/scenario-forge-refine/state-0.json`
  - Forge Transmute -> `output/scenario-forge-transmute/state-0.json`
  - Pact pick -> `output/scenario-pact-pick/state-0.json`
  - Final Chamber phase shift -> `output/scenario-final-phase/state-0.json`
- Verified visuals via latest screenshots:
  - `output/scenario-pact-pick/shot-0.png`
  - `output/scenario-final-phase/shot-0.png`
- Original root game still untouched; all changes remain inside `dungeon-1.0/`.
- Fixed confirmed 1.0 fork bug: pact stat effects no longer reapply cumulatively when taking a second/third pact in the same current game.
  - Added `pact-effects.js`.
  - Added test `tests/pact-effects.test.js`.
  - `applyPactChoice()` now applies only the newly chosen pact effect.
  - `applyPersistentPactsToRun()` now remains the full reapply path for fresh run starts only.
- Fixed confirmed 1.0 fork bug: final boss phase shift now triggers immediately on phase-1 Warden kill instead of waiting for the room to become empty.
  - Added `final-boss-flow.js`.
  - Added test `tests/final-boss-flow.test.js`.
  - `killEnemy()` now checks final-boss phase-shift condition directly on Warden death.
- Verified fixes:
  - `node tests/pact-effects.test.js`
  - `node tests/final-boss-flow.test.js`
  - `node --check pact-effects.js`
  - `node --check final-boss-flow.js`
  - `node --check game.js`
  - browser scenario re-check: `output/scenario-final-phase-fix/state-0.json`

2026-03-06: Rolled back build-aware loot bias from relic draft, merchant, and forge. Removed Build row and build recommendation badges/subtitles from runtime UI. Kept build-identity module loaded only as dormant foundation.

2026-03-06: Reworked Pact Room toward v2. Pact room now unlocks at depth 25+, uses rare elite-gauntlet encounter data, awakens sigil only after room clear, and UI now offers 2 pacts plus Leave/Break. Added pact base-stat snapshot handling for single active pact and free break flow. Verified with node tests and browser smoke in output\\scenario-pact-v2.

- 2026-03-06: Forge Room v2 implemented: Blacksmith Guardian encounter, awakened forge flow, Temper single-relic gamble, Transmute preserved, forge room hazards set to 4-6 spikes and 2-3 mines.

- 2026-03-07: Forge setpiece layout added: 3x3 forge in top-middle, blocked forge tiles, interaction tile under forge, fixed forge/player/guardian spawns, forge and blacksmith sprite hooks wired in.

2026-07-12 — Graphics overhaul Task 1 checkpoint
- Corrected `tests/scenario-overrides.test.js` to load this `dungeon-2.0` worktree; the pre-freeze suite passed 17/17.
- Full command: `$tests = Get-ChildItem -LiteralPath tests -Filter '*.test.js' | ForEach-Object FullName; node --test $tests` — PASS, 18 tests, 0 failures.
- Audio freeze: `node --test tests/audio-freeze.test.js` — PASS, 1 test, 0 failures; exactly 13 active files plus protected `game.js` paths, volumes, loop behavior, and selection logic are hashed.
- Stored seven approved audit PNGs under `tests/fixtures/visual-baseline/`; desktop viewport metadata remains explicitly unknown, while mobile is recorded as 390×844.

2026-07-12 — Graphics overhaul Task 2 TDD evidence
- Original RED: `node --test tests/visual-snapshot.test.js` failed with `MODULE_NOT_FOUND` for the not-yet-created `render/visual-snapshot.js` (0 passed, 1 failed test file).
- Presentation-data RED is preserved in commit `6b8aac1624769372235f17f28524f87bf0a033bd`: the same command ran 9 tests with 5 passed and 4 failed. The failures were missing derived portal kind, missing enemy freeze status, missing derived player presentation status, and included forge simulation coordinates.

2026-07-12 — Graphics overhaul Task 3 TDD evidence
- Tests-only RED is preserved in commit `f9e69dbcf4489667aedb4546fb2816b06f93f461`: `node --test tests/hd-asset-loader.test.js` failed with `MODULE_NOT_FOUND` for the not-yet-created `render/hd-asset-manifest.js` (0 passed, 1 failed test file).
- The manifest/loader contract now covers semantic lookup, group preload, monotonic progress, critical fallback, deterministic failures, decode/onload/error/timeout paths, UMD order, and isolation from shared state.
- Targeted GREEN: `node --test tests/hd-asset-loader.test.js` passed 13/13 tests with 0 failures.
- HD preload remains inactive; `game.js` and every audio file/contract remain outside this task.

2026-07-12 — Graphics overhaul Task 3 quality-review hardening
- Tests-only RED is preserved in commit `e1a3298bf2cb94c276b0dbb8bc8f3cc40e6a785f`: 13 existing loader tests passed and 5 adversarial tests failed on descriptor TOCTOU/accessor rereads, cleanup exceptions, and falsy dependency fallback.
- Descriptor properties are now read exactly once into frozen plain snapshots before validation, progress, selection, or image loading.
- Timer and image-handler cleanup is best-effort; injected cleanup exceptions cannot strand settlement or reject the internal decode chain.
- Explicit falsy dependency options are rejected with `TypeError`; only `undefined` selects browser/runtime defaults.
- Targeted GREEN: `node --test tests/hd-asset-loader.test.js` passed 18/18 tests with 0 failures.

2026-07-12 — Graphics overhaul Task 3 sparse-manifest hardening
- Tests-only RED is preserved in commit `e812367633bb2e94edb8e233eefdd87e3b961bd8`: 19 existing tests passed and 3 sparse-manifest tests failed; deletion during snapshot leaked an internal `undefined.ok` TypeError.
- Snapshot and validation now inspect every numeric index explicitly and reject a missing/deleted own entry with its manifest index before reading descriptor properties.
- Dense empty manifests remain valid and complete immediately; normal dense manifests retain existing behavior.
- Targeted GREEN: `node --test tests/hd-asset-loader.test.js` passed 22/22 tests with 0 failures.

2026-07-12 - Graphics overhaul Task 4 TDD and verification
- Tests-only RED is preserved in commit `bb03a02f4421059dbd06aa051294c369c17a1a60`: `node --test tests/hd-renderer.test.js` ran 14 top-level tests and failed all 14 because the renderer modules, default flag, and game boundary did not yet exist.
- Added the opt-in 64 px renderer shell, exact nine-layer ordering, checked grid helpers, bottom-center actor anchoring, and a race-safe graphics controller with legacy fallback. The default flag remains `false` and the live game stays on its existing 144x144 legacy renderer.
- Independent review found and regression-tested controller and emergency-fallback edge cases: every intrinsic canvas resize now reapplies nearest-neighbor smoothing, all game-level fallback branches synchronize legacy markers, and a nominally ready loader result cannot activate HD unless every critical manifest key is present.
- Targeted renderer/loader/snapshot suite passed 55/55 tests; the full explicit suite passed 77/77 tests; the audio freeze passed 5/5 tests. Final independent review reported no remaining Critical or Important findings.
- Browser smoke at the default flag produced no console/page errors. Visually inspected the legacy boot canvas and deterministic Forge gameplay screenshots under `output/task4-default-legacy-*`.

2026-07-12 - Graphics overhaul Task 4 loader-result hardening
- Tests-only RED is preserved in commit `bb1013bd9bc974e6f0adc9974456f1d43f707a06`: the renderer suite ran 27 tests with 20 passing and 7 failing on shared loader Maps/results, missing or malformed `failures`, critical failures hidden behind ready flags, and unsnapshotted failure results.
- Controller initialization now snapshots loader flags, loaded assets, and dense failure records before validation. Missing/malformed failure data falls back diagnostically; any critical failure blocks HD; valid optional failures and real Task 3 loader results remain compatible.
- Targeted renderer/loader/snapshot suite passed 63/63 tests; full explicit suite passed 85/85 tests; audio freeze passed 5/5 tests.
- Default-disabled Forge browser smoke produced valid state, no console/page errors, and an inspected legacy 144x144 pixel-art frame under `output/task4-result-validation-smoke`.

2026-07-12 - Graphics overhaul Task 4 reentrancy hardening
- Tests-only RED is preserved in commit `c811ca2593a526681fcf022f42f17dd892fab72d`: the renderer suite ran 31 tests with 28 passing and 3 failing when `ready`, `failures`, or the loaded Map iterator synchronously selected newer legacy mode during result snapshotting.
- The controller now re-checks its generation immediately after the complete loader-result snapshot and before validation, asset selection, canvas activation, or success outcome publication. Reentrant throw/malformed paths remain stale and diagnostic-free through the existing guarded failure boundary.
- Targeted renderer/loader/snapshot suite passed 67/67 tests; full explicit suite passed 89/89 tests; audio freeze passed 5/5 tests.
- Default-disabled Forge browser smoke produced valid state, no console/page errors, and an inspected legacy frame under `output/task4-reentrancy-smoke`.

2026-07-12 - Graphics overhaul Task 4 pending-record and critical-value hardening
- Tests-only RED is preserved in commit `6a58c8f8b69b8be5f3c89a2634d9dda6b1d27867`: the renderer suite ran 39 tests with 34 passing and 5 failing on invalid critical values plus same-mode manifest/loader reentry, real-loader `onProgress` legacy reentry, and stale cleanup overwriting newer pending work. It also characterizes recovery after an initialize-time canvas exception.
- HD initialization now registers an identity-checked deferred pending record before canvas, manifest, or loader boundaries. Same-mode reentry shares its exact Promise; legacy invalidation stays synchronous; stale settlement cannot clear a newer record; a synchronous canvas failure rejects and clears its own record before rethrowing.
- Critical loaded keys must map to a non-null, non-array object or function. Fake callable assets and real Task 3 image objects remain valid, while nullish, array, and primitive values fall back diagnostically.
- Targeted renderer/loader/snapshot suite passed 75/75 tests; full explicit suite passed 97/97 tests; audio freeze passed 5/5 tests. Final independent review reported no Critical, Important, or Minor findings.
- Default-disabled Forge browser smoke produced valid state, no console/page errors, and an inspected legacy frame under `output/task4-pending-final-smoke`.

2026-07-12 - Graphics overhaul Task 4 publication-boundary hardening
- Tests-only RED is preserved in commit `1dff368b2b3e63fafd7811e9564d69628fecc316`: the renderer suite covers reentry from width and smoothing setters, success and failure publication, diagnostic callbacks, interrupted stale applies, same-cause fallback recursion, and retry after a fallback presentation exception.
- Mode presentation writes are serialized and reconciled to the authoritative mode after synchronous reentry. Initialization settlement checks both generation and pending-record identity after each injected apply/diagnostic boundary, so obsolete work can resolve only as stale and cannot replace assets, outcomes, diagnostics, or pending state.
- Interrupted stale applies perform best-effort presentation reconciliation before preserving the original exception. Same-cause fallback callback reentry shares the exact reserved outcome; a failed apply clears only its own reservation so retry can finish presentation and publish one diagnostic.
- Targeted renderer/loader/snapshot suite passed 82/82 tests; full suite passed 104/104 tests; audio freeze passed 5/5 tests; renderer syntax and `git diff --check` passed. Final independent review reported no Critical, Important, or Minor findings.
- Default-disabled Forge browser smoke produced valid playing/Forge state, no console/page errors, and an inspected legacy pixel-art frame under `output/task4-publication-final-smoke`.

2026-07-12 - Graphics overhaul Task 5 Phase A RED handoff
- Added `tests/hd-environment.test.js` first. It specifies 28 final Descent/common PNGs, exact semantic manifest mappings, safe unique `assets/hd/` paths, 64 px tile multiples, PNG signature/IHDR dimensions, RGBA requirements for overlays/objects/hazards, and critical classification limited to floor/wall/corner room-base assets.
- Baseline before the new test: `node --test tests/hd-asset-loader.test.js tests/hd-renderer.test.js` passed 68/68 tests.
- Expected RED: `node --test tests/hd-environment.test.js` ran 3 tests with 1 pass and 2 failures. Manifest coverage failed on the old floor path plus 27 absent final keys; PNG completeness failed because all 28 final files are absent. The unique/safe manifest-path test passed.
- Added `art/briefs/abyssal-gothic-hd.md` with the exact 1024x1024 flat-`#ff00ff` source-atlas contract, strict 4x4/256 px slot coordinates, approved Descent material/light direction, crop/alpha normalization rules, and the final manifest/file table.
- No bitmap art, placeholder PNG, manifest expansion, layer implementation, production drawing, or audio change was made in Phase A.
- TODO for the coordinator: use built-in ImageGen with the brief's exact sixteen-slot prompt constraints, save the untouched chroma source atlas at `art/source/abyssal-gothic-hd/descent-environment-source-1024.png`, then return for Phase B crop/normalization, manifest integration, and renderer-layer work.

2026-07-12 - Graphics overhaul Task 5 GREEN implementation
- Preserved the root-supplied built-in ImageGen output unchanged as `art/source/abyssal-gothic-hd/descent-environment-source-original-1254.png`: 1254x1254 RGB, SHA-256 `95d42f7402d5e8be87d9739069b090fd6c9f3269a6e0adb3e28565da065883d2`. The reproducible Pillow builder creates the exact 1024x1024 working atlas without invoking any generation CLI/API.
- `scripts/build-descent-environment-assets.py` crops all sixteen exact 256 px slots before key removal, invokes the installed ImageGen `remove_chroma_key.py` helper per slot with border auto-key, soft matte, thresholds, and despill, preserves intended shrine/portal magic, normalizes 28 production PNGs, validates alpha/chroma/components, and removes ignored `art/work/` intermediates.
- Crop QA found and removed disconnected neighboring fragments from corner and portal subslots. The build now rejects a large secondary alpha component. Two fresh complete rebuilds produced identical hashes for all 28 final assets plus the normalized atlas: aggregate SHA-256 `BDB81338F9D5CFE51F7007111CD70AA4BF24B60DF9DC69AACC57636BD5C423AB`, 0 differences.
- The active manifest now preloads exactly 28 shipping Descent/common assets. Floor, four walls, and four corners are the only critical entries. Future representative semantic keys live in optional `stagedEntries`, remain discoverable through `getByKey()`, and produce no preload 404s.
- HD layers draw the 9x9 floor and explicit borders, deterministic depth/x/y decorations without `Math.random`, snapshot hazards/objects, animated torch/portal frames from `nowMs`, and bottom-center 128 px shrine/portal assets. Missing optional images are skipped. Temporary code-native player/enemy silhouettes keep the slice readable until Tasks 6/7; no placeholder actor images were added.
- Added deterministic `?scenario=descent_hd` to arrange chest, torch, spikes, mine, shrine, active portal, and player without gameplay RNG. The default HD flag remains false.
- Browser QA used the installed web-game client loop and a test-only viewport copy of that same client against a response-only HD override. Inspected `output/task5-descent-hd/desktop-1440x1000.png`, `mobile-390x844.png`, both 576 px canvas captures, state JSON, and `assets-preview-final.png`. Desktop preserves the playfield and HUD; mobile keeps the full board, skills, controls, and Menu visible without horizontal overflow.
- A reported black/missing-floor frame was traced to `view_image(detail=original)`, not the PNG or renderer: the screenshot contained 331,776/331,776 opaque pixels and normal tile RGB throughout, and `detail=high` displayed the complete board. A separate custom Playwright context timed out all 28 `Image.decode()` calls (empty loaded Map); the unmodified installed client on the same probed server activated HD. Reusing the exact installed client architecture resolved viewport capture without production changes.
- Default legacy smoke remained a 144x144 canvas with valid `descent_hd` state and no console/page errors; inspected `output/task5-descent-hd/legacy-default/shot-0.png`.
- Spec review caught that ordinary runtime portals omit `active` and must still respect the legacy `roomCleared` reveal gate. A snapshot-boundary RED case now proves uncleared portals stay hidden and cleared portals animate; an explicitly inactive revealed portal still uses its inactive frame.
- A browser-only critical-failure probe forced only `environment.descent.floor.base` to 404. The installed game-playtest client loaded the other 27 assets, recorded one critical decode failure plus the fallback warning, selected the intact 144x144 legacy canvas, and preserved valid playable `descent_hd` state. Evidence: `output/task5-descent-hd/fallback-critical-installed/state-0.json` and inspected `shot-0.png`. The probe changed no production behavior.
- Independent spec and code-quality re-reviews approved the final slice with no remaining findings. Quality review also tightened the manifest test to compare the exact active preload key set and descriptors directly, preventing active/staged substitutions from passing.
- Fresh verification: targeted environment/renderer/loader/snapshot suite 93/93 PASS; full explicit suite 115/115 PASS; audio freeze 5/5 PASS; JS/Python syntax and `git diff --check` PASS.
- Honest visual limits: the single 64 px floor base remains visibly periodic over a 9x9 room, the dark crack decal is deliberately subtle, and diagnostic actor rectangles are temporary. Player/enemy production art, lighting, telegraphs, and combat VFX remain later tasks.

2026-07-12 - Graphics overhaul Task 5 strict chroma correction
- Tests-only RED is preserved in commit `560cc24255121884d67db731ebd82f64bad960ce`. Exact nontransparent `#ff00ff` remained in nine finals: crack 2/max alpha 1, rubble 1/1, stain 03 2/1, shrines 55/13 and 72/33, and portals 25-39/max alpha 5-13. The strict near-key fringe metric (alpha 1-128, RGB Euclidean distance <=48, strong balanced red/blue dominance) found the same nine assets and portal halo alpha up to 105; the executable builder-policy test also failed because the strict validator did not exist.
- Root cause was the combination of low-alpha keyed RGB surviving helper output/restoration, Lanczos normalization resampling that edge data, and a final validator that ignored alpha <=16 or <=128 for magic assets. The builder still uses the installed helper with border sampling, soft matte, thresholds, and despill; shrine/portal slots additionally use the helper's one-pixel edge contract. A deterministic post-key cleanup removes only exact key pixels or low/semitransparent pixels matching the strict near-key metric, both before normalization and at final RGBA write time. Final build validation invokes the identical policy with no chroma alpha exception.
- An initial all-slot edge contract was correctly rejected by the alpha-coverage regression test because it halved the thin crack's visible pixels. Limiting contraction to shrine/portal slots restored the crack while universal metric-targeted cleanup removed the remaining resize fringe.
- All 27 alpha finals now contain 0 exact-key and 0 strict near-key pixels. Transparent corners and >=15% alpha coverage remain enforced. Magic survived quantitatively: every shrine/portal retains at least 339 qualifying non-key violet pixels and 4,115 substantial-alpha unique colors; the set retains 1,354 qualifying turquoise pixels.
- Two fresh complete builds were byte-identical across the 28 final assets plus normalized atlas: aggregate SHA-256 `C080A6A33E974B448A4346E0C30F8BCFA0EABA9E12B82D0098500DB944065F20`, 0 differences. The untouched 1254 source remains SHA-256 `95d42f7402d5e8be87d9739069b090fd6c9f3269a6e0adb3e28565da065883d2`; the normalized atlas contract is unchanged.
- Inspected checkerboard contact sheet `output/task5-descent-hd/assets-preview-chroma-fixed.png`, HD desktop/mobile pages under `chroma-fixed-desktop` and `chroma-fixed-mobile`, default legacy under `chroma-fixed-legacy`, and the settled forced-critical fallback under `chroma-fixed-fallback-settled2`. No magenta fringe or eroded silhouettes are visible; portals/shrines retain saturated violet/turquoise magic. HD loaded all 28 assets at 576x576 with no warning, default legacy remained intact, and the forced floor 404 loaded the other 27 assets, warned, selected legacy 144x144, and kept valid playable state.
- Fresh verification: targeted environment/renderer/loader/snapshot suite 97/97 PASS; full explicit suite 119/119 PASS; audio freeze 5/5 PASS; JS/Python syntax and `git diff --check` PASS. No MP3 or legacy-renderer file changed.

2026-07-12 - Graphics overhaul Task 5 atomic/reproducible build hardening
- Tests-only RED is preserved in commit `58f0a548ea9529c19bac18bc0d573b80c6a8849b`. The expected failures proved the absence of a pinned dependency/lock, `--check`, pure rollback transaction, helper diagnostics wrapper, fixed scenario matrix, and pre-RNG scenario selector. Manifest assertions were changed from exact current-catalog equality to required Descent subset correctness so later art tasks may add active entries.
- The builder now writes the normalized atlas, intermediates, and all 28 finals only under same-filesystem `art/work/descent-environment/`, validates the complete staged set, verifies its lock, then atomically replaces the 29 published targets. Pre-copied backups restore every already-replaced target on failure and newly created targets are removed; the transaction/work tree is deleted in `finally` on success or any helper/save/validation/publish exception.
- An independently executable pure transaction test injects failure on replacement 28 of 29. It proves every prior target byte is restored, a new target is removed, the original error propagates, and the transaction tree is absent. Helper `CalledProcessError` is wrapped with slot/input path, helper path, return code, stdout, and stderr.
- `requirements-hd-assets.txt` pins `Pillow==12.1.1`. The builder rejects any other Pillow version and verifies the installed helper SHA-256 `7e51236919203b61d07ddffdc6e0b5f501a28661003f5851f26ffbb64bdec1ea` before execution. `descent-environment-assets.lock.json` (SHA-256 `a5f280b0b012ec0c0889ca3a0048aed922ddf3059588a06df86463875f848423`) pins pipeline schema 2, tool versions/hashes, source, normalized atlas, and all 28 final hashes.
- Normal builds compare staged output to the committed lock before publishing. `--check` performs a complete isolated non-publishing rebuild; `--update-lock` is the only explicit lock-revision path and publishes the staged atlas/assets/lock in the same transaction. Exact setup, check, normal publish, and intentional update commands are documented in `assets/hd/README.md`. Two consecutive manual locked checks passed and removed their work trees; production asset bytes did not change.
- `descent_hd` now owns one documented exact 9x9 floor matrix with six symmetric torch markers. The scenario API returns an independent clone without calling the random-pattern factory; normal scenarios still call the factory exactly once. `buildRoom()` selects through this API before `makeFloorPattern`, so showcase floor/torch state no longer consumes gameplay RNG. Browser state captured the exact matrix.
- Inspected HD desktop/mobile under `output/task5-descent-hd/atomic-lock-desktop-proof` and `atomic-lock-mobile`, default legacy under `atomic-lock-legacy`, and settled forced-critical fallback under `atomic-lock-fallback`. The fixed torch layout is coherent on both viewports; HD loaded all 28 assets, default legacy remained intact, and forced floor failure loaded the other 27, warned, selected complete legacy 144x144, and kept valid state.
- Fresh verification: targeted environment/renderer/loader/snapshot suite 101/101 PASS; full explicit suite 123/123 PASS; audio freeze 5/5 PASS; JS/Python syntax and `git diff --check` PASS. Strict chroma, magic coverage, original source hash, default-disabled HD, portal gating, and audio/legacy contracts remain protected.

2026-07-12 - Graphics overhaul Task 6 Phase A RED handoff
- Added `tests/hd-player-assets.test.js` first. It specifies the exact 64-frame contract: south/north/east/west; idle 4, move 4, attack 4, hit 2, death 2 per direction; 64x64 RGBA; zero visible `#ff00ff`; meaningful alpha coverage; shared scale and bottom-center anchoring; exact unique semantic paths/keys; player metadata direction/clip/frame order plus fps/loop behavior; active critical player classification; snapshot-only visual selection; and existing-controller fallback when one critical player frame is missing.
- Expected RED: `node --test tests/hd-player-assets.test.js` ran 7 tests with 1 pass and 6 failures. The unique expected-path/catalog-path test passed. Failures are the absent seed `art/source/player-hd/player-south-idle-seed.png`; zero active player entries plus all 64 absent semantic keys; all 64 absent final PNGs; absent `assets/hd/actors/player/player-manifest.json`; absent `selectPlayerVisual(snapshot)` renderer API; and zero active critical player entries for the fallback probe.
- Added `art/briefs/player-hd.md` with the compact Nameless Delver character lock, exact south-facing neutral-idle ImageGen seed constraints, flat `#ff00ff` chroma contract, strict top-down/three-quarter orthographic camera, three-floor contrast gate, and exact whole-sheet 8x8 production layout. The later atlas must be edited as one sheet from the approved seed, never generated frame-by-frame.
- No bitmap art, placeholder PNG, player manifest, active semantic entry, snapshot/renderer integration, gameplay change, audio change, or legacy asset change was made in Phase A.
- TODO for the coordinator: use built-in ImageGen for the single seed only, preserve it at `art/source/player-hd/player-south-idle-seed.png`, review it at 64 px against Descent/Corruption/Abyss, and return the approved seed before any atlas expansion or Phase B implementation.

2026-07-12 - Graphics overhaul Task 6 Phase B seed preparation
- Preserved the root-provided built-in ImageGen identity reference unchanged at `art/source/player-hd/player-south-idle-seed.png`: 1254x1254 RGB, SHA-256 `c890fc3c09eb7537faa2350793a1d6919f64dc31a6a85d2232d3d37ae46f474d`. The tests-only seed-prep RED is preserved in commit `607ab6f`: 10 focused tests ran with 2 passes and 8 failures; the three new failures were exactly the missing keyed/64/comparison outputs, missing edit canvas, and missing script/lock, while the five original full-atlas/integration failures remained expected.
- Added `scripts/prepare-player-seed-assets.py`, pinned to Pillow 12.1.1 and installed helper SHA-256 `7e51236919203b61d07ddffdc6e0b5f501a28661003f5851f26ffbb64bdec1ea`. It verifies the source identity, runs only the installed chroma helper, removes residual exact/near-key pixels, validates coverage/anchor, stages under ignored `art/work/player-seed-prep/`, publishes with backup rollback, locks deterministic hashes, and removes staging in `finally`. No ImageGen CLI/API fallback is used.
- Keyed source metrics: RGBA 1254x1254, alpha bbox `[322,150,893,1032]`, 293,126 visible pixels, transparent corners, 0 visible exact `#ff00ff`, and 0 strict near-key fringe pixels. The normalized 64 px candidate has bbox `[14,5,49,60]`, 1,468 visible pixels, bottom-center root y=60, and 0 exact/near-key pixels.
- Added `art/source/player-hd/player-seed-comparison.png`: exact 64 px and 4x nearest-neighbor views on transparency, real Descent `floor-base.png`, and deterministic preview-only Corruption/Abyss palette swatches. Honest review: helmet and steel highlights remain readable, the shadowed face behaves as intended, and there is no visible magenta halo. The sword is readable but long/thin rather than a short sword; the dark-purple cape becomes subdued and loses some right-edge contrast on Abyss; the source identity still reads frontal/tall rather than strongly top-down/compact.
- Added `art/source/player-hd/player-animation-edit-canvas-1024.png`: exact 1024x1024 RGB flat `#ff00ff`; only R1C1 is populated from the approved keyed seed, with bbox `[28,10,99,121]`, 5,872 non-key pixels inside R1C1, and 0 non-key pixels in the other 63 logical slots. `art/briefs/player-hd.md` now contains the exact whole-sheet built-in edit prompt assigning Image 1 as the immutable identity reference and Image 2 as the edit target.
- Seed-prep lock/check, the 118-test unaffected suite, and the 5-test audio freeze pass. Focused player tests now pass all 7 source/preparation/uniqueness/concurrency/cleanup gates and retain exactly 5 expected RED failures for the absent 64 active entries/finals, player manifest, visual selector, and critical-player fallback exercise. Review caught a fixed-directory race between simultaneous `--check` runs; a reproducing RED failed with one invocation deleting the other's keyed staging file, and each invocation now owns an atomic unique child under `art/work/player-seed-prep/` while the last finisher removes the empty parent. A second RED proved missing-helper setup validation leaked its new tree; source/tool verification now also runs inside the cleanup-protected boundary.
- No final player frame, player manifest, active player semantic entry, renderer/snapshot/gameplay integration, audio file, or legacy asset was created or changed. PAUSED before the one-shot whole-sheet built-in ImageGen edit.

2026-07-12 - Graphics overhaul Task 6 rejected-atlas architecture correction RED
- Preserved the rejected built-in ImageGen result unchanged at `art/source/player-hd/player-animation-atlas-rejected-layout.png`: 1254x1254 RGB, SHA-256 `3ae0de590ca039525d1db721c1539df146affc57a90939631cfccbc667d96d64`. Diagnostic keying detected `#f603f4`; alpha-threshold 16 produced 72 raw components and exactly 70 meaningful pose components with areas 3,631–7,355 px.
- Meaningful component centroids form exactly 10 column clusters with 7 poses each and 7 row clusters with 10 poses each: actual layout `10x7/70`, not required `8x8/64`. Six surplus poses, non-128 px cluster alignment, and changed row semantics make exact 8x8 semantic cropping impossible. The sheet is rejected evidence/style reference only and must not be integrated.
- Updated `tests/hd-player-assets.test.js` first and observed the targeted contract RED: 5/5 selected tests failed exactly on missing rejection analysis/preview, missing north/east/west anchor previews, missing four direction edit canvases, missing four generated direction sources, and the old schema-1 single-canvas lock. The final 64-frame paths, semantic keys, counts, fps, loops, critical classification, and integration requirements remain unchanged.
- Corrected only the production-source architecture to four whole-direction 4x4 sheets. Each normalized 1024x1024 direction source has 256 px logical slots: R1 idle01-04, R2 move01-04, R3 attack01-04, R4 hit01/hit02/death01/death02. This retains whole-animation generation and is not frame-by-frame generation.

2026-07-12 - Graphics overhaul Task 6 four-direction generation preparation GREEN
- Extended the pinned deterministic player-prep pipeline to verify and key both immutable sources, reproduce the rejected `72 raw / 70 meaningful / 10x7` component evidence, and publish `player-animation-rejected-layout-analysis.json` plus a labeled 1400x1400 component/contact preview. All 70 meaningful component boxes are labeled by detected row/column and color-coded by the visually evident direction groups; the report remains explicitly `shippable: false`.
- Direction anchors are unmistakable and high-confidence generation references: north R3C1/component 21/back-facing, east R4C1/component 31/screen-right, and west R6C1/component 51/screen-left. All three use one shared scale `0.41176471`, exact/near chroma `0/0`, and root y=60. Metrics: north bbox `[14,6,49,60]`/1,429 visible px; east `[18,5,45,60]`/1,075; west `[22,5,42,60]`/972. South remains the approved original-derived anchor `[14,5,49,60]`/1,468. The labeled 1120x320 anchor preview records that these are generation references only, not shipping frames.
- Added four exact 1024x1024 RGB flat-`#ff00ff` edit canvases with 256 px logical slots and only R1C1 populated. South bbox/non-key `[56,20,199,243]`/23,488; north `[56,24,199,243]`/22,864; east `[72,20,183,243]`/17,200; west `[88,20,171,243]`/15,552. Every canvas has zero non-key pixels outside R1C1. SHA-256: south `fc557a684dc99acc56eee87dc0be298076fd40be258ecbaade1a9f0703821e76`; north `0bdcb9ee872ec3a075b074976ec30c4f00b03ab2733adc6b28700783644acc14`; east `2d0d5aebb3d1ff7bb3049f4ebd9e33d9d6cb3b7b7509ebeb37286e2ffac30ae1`; west `b708165448bd130a724fda927e11740e6dd9c145700be62ef244c16636d754d2`.
- Added `art/briefs/player-hd-direction-prompts.json` with four fully resolved built-in edit prompts. Every prompt fixes input order as Image 1 original identity seed, Image 2 rejected multi-direction style/pose reference, Image 3 mandatory direction edit canvas; forbids copying the rejected 10x7 layout; and requires one exact 4x4/16-pose direction sheet with the unchanged semantic clip order.
- Focused player suite now runs 17 tests: all 11 preparation/evidence/helper-key/anchor/canvas/prompt/determinism/concurrency/cleanup/uniqueness gates pass; exactly 6 expected RED failures remain for the four not-yet-generated direction source sheets plus the deferred active manifest, 64 final frames, player manifest, visual selector, and critical-player fallback exercise. The nondeferred suite passes 123/123 including audio 5/5.
- Final review found no Critical or Important issues. Its two Minor handoff risks were resolved: the obsolete generically named 8x8 edit canvas was removed, and `helperDetectedKey` is parsed from the pinned helper's actual `Key color: #RRGGBB` stdout rather than hardcoded. A focused RED/green parser test protects the evidence path.
- No built-in ImageGen call, generated direction source, final 64 frame, active player manifest entry, renderer/snapshot/gameplay integration, audio change, or legacy asset change was made. PAUSED for root orchestration of four parallel whole-direction edits.

2026-07-12 - Graphics overhaul Task 6 Phase C production player GREEN
- Preserved all four root-provided built-in ImageGen sheets byte-for-byte at their supplied `*-source-1024.png` paths. They are actually 1254x1254 RGB: south `8945c8f41ea083cf5717072058466fd9ec19c8ebee77653956e1fcaea04e66d3`, north `ff130a2efd2677d758048a14bf697f7e0714d3167d0571444b9fcb648d74c861`, east `19da543aea6592de7cbdd398bcf6be551abef96eb1c323906f0338eb39a6fe40`, west `25f525a787acf7dca43b62fb51c31a1406d0e9f30da876cffb3ddaca7324db24`.
- The semantic source gate passed all four directions: exactly four centroid row clusters, four column clusters, sixteen occupied semantic slots, and zero ambiguous component assignments. South/west each have exactly 16 meaningful connected components. East has 16 meaningful components plus three removed specks (86/66/22 px). North has 17 meaningful components because R4C4 deliberately contains the collapsed body plus a detached sword; both are contained in the same unambiguous semantic slot. North's remaining disconnected noise is at most 12 px and is removed.
- Tests-first production RED is commit `24f12f9`: 20 focused tests ran with the 11 preparation gates passing and nine expected failures on the absent layout report/normalized sheets/builder lock/64 finals/player manifest/selector/draw path/critical fallback. Added `scripts/build-player-animation-assets.py`, pinned to Pillow 12.1.1 and helper SHA-256 `7e51236919203b61d07ddffdc6e0b5f501a28661003f5851f26ffbb64bdec1ea`. It verifies immutable inputs, stages in a unique ignored tree, keys whole sheets, validates semantic clusters, removes only sub-500 px disconnected debris, uses one global final scale, publishes transactionally with rollback, and supports isolated non-publishing `--check` plus intentional `--update-lock`.
- Published four 1024x1024 flat-key normalized review sheets, the evidence report, a 1024x256 contact sheet, exact player metadata, and 64 unique 64x64 RGBA frames. Global scale is `0.1901639344262295` from source max bounds 305x255; finals retain 623-1,154 visible pixels, widths 22-58, heights 19-48, root y 60, transparent corners, zero visible exact chroma, and one shared scale. Lock SHA-256 is `100872896c0b10a60c088c9ff48ff0c094d924bdf56436ededb465de29809759`.
- Promoted exactly 64 `actor.player.<direction>.<clip>.<NN>` entries to the active HD manifest as group `player`, `critical:true`. `selectPlayerVisual(snapshot)` uses priority death > hit > short-lived resolved bump attack > movement tween > idle and reads direction from facing/last move. The player layer draws the selected 64 px frame bottom-centered; missing critical art still uses the existing controller fallback and the diagnostic silhouette remains only as a defensive layer-level fallback.
- Added only a 240 ms visual marker to already-resolved bump attacks (`visualAction`/`visualActionTimer`), copied through the visual snapshot and decremented in the existing effects update. It does not delay attacks, turns, movement, input, hitboxes, damage, AI, RNG, or audio; transient visual state is reset rather than trusted from saves.
- Verification: targeted `node --test tests/hd-player-assets.test.js` PASS 20/20; full explicit suite PASS 143/143. Locked production check rebuilds twice without publishing or changing source/output hashes. Contact sheet inspection found coherent identity, handedness, directions and clips. Browser QA with the supplied Playwright runner plus dedicated viewport capture passed desktop 1280x800 and mobile 390x844: `phase=playing`, HD 576x576 active, movement and an adjacent bump-attack frame visible, no console errors or warnings. `config.js` was restored to default-disabled `false` immediately after QA and the local server was stopped. No MP3 or legacy asset changed.
- Formal review corrections are covered by four focused tests: the builder now rejects adjacent semantic-slot extents that overlap horizontally or vertically instead of reporting a constant zero; attack01-04 are distributed across the unchanged 240 ms visual-only marker in four 60 ms windows; death01-02 use a reset/incremented `visualDeathTimer` rather than the arbitrary global loop clock; and HD position uses the exact legacy 120 ms quadratic-out tween from `_tweenFromX/_tweenFromY` while converting legacy 16 px coordinates to the 64 px HD grid.
- Mobile visual review found the native one-tile draw too small after the 576 px canvas scales to about 289 px. Game-director-approved correction renders the unchanged 64x64 PNG at 80x80 bottom-center on the same logical tile; PNG bytes, root metadata, hitbox, coordinates, gameplay timing and mechanics remain unchanged. Fresh desktop/mobile gameplay plus adjacent attack captures report HD 576x576, no warnings/errors, and a larger body/weapon footprint; the default flag was again restored to `false` and the server stopped.
- Fresh post-review verification: focused fixes PASS 4/4; targeted player suite PASS 23/23; full sequential suite PASS 146/146; separate audio freeze PASS 5/5; independent player locked rebuild PASS. The earlier 142/146 parallel experiment was a harness-observation race caused by deliberately running full, targeted and standalone rebuild processes against the same staging parent; all child builders were isolated, the interrupted process's ignored child was removed, and the required sequential runs pass with no staging leak.
- Final read-only re-reviews report no findings. Code review verified all four prior Important issues closed, the focused tests and locked rebuild green, and bottom-center/tween/gameplay preserved at 80x80 presentation. Visual review verified the prior mobile readability Important closed: the fresh mobile attack has a distinct diagonal blade and directional lunge, while desktop remains unclipped and anchored.

2026-07-12 - Graphics overhaul Task 8 themed rooms GREEN
- Tests-first contract RED is commit `9ec51881ce3fc3e6502a6d847b8aeafd55e5281f`: 10 tests ran with 1 existing loader fallback pass and 9 expected failures for absent Corruption/Abyss assets, props, theme/hash API, renderer/snapshot/scenario integration, and locked build.
- Preserved five built-in ImageGen sources under `art/source/task8-hd/`: Corruption atlas, Abyss atlas, merchant identity seed, core setpieces atlas, and portal/boss atlas. Four atlases validate as exact 4x4/16-slot sources. The pinned transactional builder publishes 48 themed 64x64 RGBA environment PNGs plus 32 optional setpiece PNGs, five normalized 1024 px review sources, exact metadata, and a deterministic lock.
- Added depth theme selection (`Descent <20`, `Corruption <40`, `Abyss otherwise`), visual-only deterministic room hashing, themed floors/walls/corners/decals/torches, special-room props, valid common fallbacks for optional portals/chests, and legacy fallback preservation for missing critical environment art. Layer order remains floor -> decals/seals -> hazards -> objects -> enemies -> player.
- Visual snapshot now copies only derived vault-clear and otter-chest render state. The debug-only scenario matrix covers combat, cursed, merchant, forge, pact, vault, otter, and boss for both new themes; QA auto-start dismisses the boot overlay without changing the default-disabled global HD flag.
- Browser matrix under `output/task8-hd-room-qa/matrix` contains 32 desktop/mobile scenarios at 1440x1000 and 390x844. All 32 report `graphicsMode=hd`, canvas 576x576, playing state, no horizontal overflow, and zero unexpected console errors/warnings. Representative inspected frames confirm readable Corruption forge/merchant and Abyss otter/vault/final-phase seal geometry.
- Soundtrack files and protected audio code remain unchanged. Task 9 boss/guardian actors and Task 10 VFX/lighting remain intentionally out of scope.

2026-07-13 - Task 8 quality-review alignment hardening
- Forge HD rendering now uses the production 3x3 `originX/originY/width/height` footprint rather than bottom-centering the 192 px setpiece on its interaction tile. The QA Forge state mirrors the real `(origin 3,0; interact 4,3)` layout.
- Cleared Forge rooms select the orange Forge portal before the common optional fallback.
- The 32-scenario browser runner captures fresh by default; cached results are used only with explicit `--resume`. Fresh desktop/mobile Forge review confirms top-room alignment and orange portal presentation.
## 2026-07-13 — Graphics overhaul Task 9: guardians and Warden

- Added four directional boss profiles: Vault Guardian (128 px), Blacksmith Guardian (128 px), Warden phase 1 (160 px), and a physically transformed Warden phase 2 (192 px). Each profile ships 64 critical RGBA frames with idle, move, attack/cast, hit, and death clips on a shared bottom-center root.
- Preserved sixteen raw whole-direction 4x4 ImageGen sheets and immutable source hashes. The pinned, transactional builder publishes 256 boss frames, four manifests, eight optional barrier/Aegis overlay frames, normalized sheets, contact previews, and a reproducibility lock. Final frames contain zero visible exact or near-key magenta.
- `selectBossVisual()` reads only existing facing, tween, hit/cast/telegraph, barrier/Aegis, HP, and `finalBossPhase` presentation state. Logical coordinates, collision, AI, HP, damage, turn timing, gameplay RNG, saves, and audio are unchanged. Missing critical base art still requests the existing legacy fallback; missing optional overlay art draws a procedural fallback.
- Added deterministic `vault_guardian_hd`, `blacksmith_guardian_hd`, `warden_phase1_hd`, and `warden_phase2_aegis_hd` scenarios. Desktop 1440x1000 and mobile 390x844 browser QA passed 8/8 with a 576x576 HD canvas, scrollY 0, no horizontal overflow, and zero unexpected console diagnostics. Evidence: `output/task9-hd-boss-qa/matrix/`.
- The main worktree remains intentionally dirty only through the user's uncommitted `config.js=true` preview toggle. A fresh detached checkout at committed `config.js=false` passed the complete suite 179/179, targeted boss/campaign/final-flow checks 10/10, audio freeze 5/5, `build-boss-animation-assets.py --check`, and syntax checks. `.gitattributes` now pins repository text assets to LF so immutable source/build hashes survive a clean Windows checkout.

## 2026-07-13 — Final stages A1: wall topology correction

- Added a semantic alpha-topology regression test for all twelve Descent/Corruption/Abyss wall corners. RED identified the Descent northeast corner as nearly equally filled on the physical outer and room-facing quadrants (`0.969` versus `0.932`), matching the reported reversed-corner defect.
- Both locked environment builders now compose each corner from the canonical horizontal and vertical wall arms, while retaining the unique corner detail only in its physical outer quadrant. This also corrected Corruption southeast and the lower Abyss corners without changing the source atlases.
- Regenerated twelve corner PNGs and both deterministic locks. The wall/environment/room suite passes 35/35; both builders pass `--check`. Full 576×576 diagnostic rings for all three themes were visually inspected under `output/wall-audit/` and show the correct inward opening with continuous wall arms.

## 2026-07-13 — Final stages A2: combat VFX and telegraphs

- Added a deterministic, snapshot-only HD VFX adapter for mines, volatile bursts, dash/enemy aim, particles, floating combat text, ranged bolts/impacts, dash trails, shockwaves, shields, and the critical-health border. Quality and reduced-motion profiles cap particle count, motion, and flash intensity; the adapter never consumes gameplay RNG.
- Added the debug-only `vfx_showcase_hd` scenario and kept its presentation effects alive through cold HD asset loading. Browser QA at 576×576 confirmed readable translucent area warnings, all major effect families, corrected Corruption wall corners, and no console errors. Evidence: `output/vfx-a2-qa/`.
- Targeted VFX/scenario/snapshot/audio verification passes 27/27. Protected soundtrack files and audio code remain unchanged.

## 2026-07-13 — Final stages A3: HD lighting

- Added a composited ambient-lighting pass with deterministic snapshot-derived lights for torches, active portals, forge/pact setpieces, player shields, the Blacksmith barrier, and Warden Aegis. High/medium/low profiles bound ambient darkness, glow strength, and light count; reduced-effects preferences lower all three.
- Critical lights are prioritized before decorative torches when a budget is reached. The darkest normal profile remains capped at 0.26 opacity, so gameplay silhouettes and telegraphs remain readable.
- Lighting/VFX/renderer/audio verification passes 16/16. Browser inspection at 576×576 confirmed subtle torch pools, readable actors and warnings, no over-darkening, and no console diagnostics. Evidence: `output/lighting-a3-qa/`.

## 2026-07-13 — Final stages B1: restrained menu/HUD/mobile polish

- Preserved the boot menu logo, copy, credits, structure, and all music behavior. Added only a restrained dungeon vignette/panel treatment, clearer HUD inset hierarchy, visible keyboard focus rings, high-contrast support, and reduced-motion handling for nonessential UI animation.
- Raised mobile D-pad, action, and Menu controls to 48 px minimum touch targets without changing bindings or gameplay input behavior.
- Static UI/audio checks pass 9/9. Full desktop/mobile boss viewport QA passes 8/8: 576×576 HD canvas, visible skill bar and mobile controls where expected, scrollY 0, no horizontal overflow, and no console diagnostics. Evidence: `output/ui-b1-qa/`.

## 2026-07-13 — Final stages B2: deterministic final visual-audit matrix

- Added `scripts/capture-hd-final-audit.mjs`, covering the unchanged boot menu plus sixteen deterministic gameplay showcases on desktop 1440×1000 and mobile 390×844. The matrix includes all three wall themes, base/player/enemy presentation, combat/cursed/merchant/forge/pact/vault/otter rooms, combat VFX, both guardians, and both Warden phases.
- Every capture records the full viewport, canvas, text state, and console diagnostics. Automated gates reject wrong renderer/canvas size, scrolling/overflow, missing mobile chrome, blank or transparent frames, leaked magenta key pixels, implausibly dark/bright frames, and browser errors.
- The runner contract tests pass 2/2. The fresh complete matrix is intentionally scheduled after default activation so the final evidence audits the exact shipping configuration.

## 2026-07-13 — Final stages C1: fallback, save, performance, and audio gates

- Confirmed the run-save builder and loader are renderer-agnostic: no HD flag, graphics mode, renderer, manifest, or loaded-asset state enters persistence. Existing player/portal validity and legacy snapshot restoration remain the compatibility boundary.
- The loader/controller/snapshot/save/audio release selection passes 89/90 before activation. The sole expected pre-activation failure is the obsolete assertion that the default HD flag must remain false; all critical-missing, timeout, malformed-loader, reentry, emergency-fallback, and optional-asset paths pass.
- Added a real-browser frame-pacing gate on the heavyweight VFX showcase. Fresh results: desktop mean 16.666 ms / p95 16.7 ms and mobile mean 16.666 ms / p95 16.8 ms (both ~60.0 fps), HD mode retained, zero console diagnostics. Evidence: `output/final-hd-audit/performance.json`.
- Protected soundtrack files and active audio code remain byte/contract-identical to the approved baseline.

## 2026-07-13 — Final stages C2: shipping HD activation

- Promoted the completed 64 px renderer to the shipping default in `config.js`; setting the flag to false remains the explicit legacy-fallback diagnostic switch.
- Updated the controller dependency-order contract to include VFX and lighting before renderer layers. The activated loader/controller/snapshot/save/audio release selection passes 90/90.
- This activation changes no gameplay state, balance, input, save schema, soundtrack file, or active audio declaration.

## 2026-07-13 — Final stages C3: completed audit and corrective loop

- The complete repository suite passes 201/201 in the shipping `HD=true` configuration, including all locked asset rebuilds, wall topology, loaders/fallback, render layers, gameplay systems, save compatibility, UI, and the protected audio contract.
- The first long visual-matrix attempt exposed an audit-harness resource issue after 29 entries: one Chromium process retained decoded copies of the now-large manifest across too many pages. An isolated mobile VFX probe reached HD in 5.3 s with zero diagnostics, proving the game/scenario healthy. The runner now recycles Chromium every eight scenes; its regression contract passes.
- The corrected fresh matrix passes 34/34 views (boot plus sixteen gameplay scenarios on desktop and mobile): 32/32 gameplay views in HD, zero console errors, zero horizontal overflow, no blank/transparent frames or chroma-key leaks, and luminance bounded from 29.04 to 66.24. Evidence: `output/final-hd-audit/matrix/`.
- Manual inspection confirmed correct inward-opening and continuous corners for Descent, Corruption, and Abyss; readable VFX/telegraphs; correct forge, vault, guardian, and Warden anchoring; and intact desktop/mobile UI. The review found and fixed two minor presentation issues: boot prompt minimum opacity is now 0.6, and a subtle player-presence light improves the dark Abyss silhouette.
- Post-correction browser performance remains ~60.0 fps on desktop and mobile, with zero diagnostics. Audio freeze remains 5/5 and no soundtrack file or active audio declaration changed.

## 2026-07-13 — Portal layering and brazier correction

- Replaced independently generated full-portal animation poses with one complete immutable 128×128 frame plus eight transparent rotation phases derived from one coherent vortex texture for common, vault, forge, and otter portals. Runtime draws the full frame and swirl as separate bottom-centered layers; the existing three active composites remain as optional fallback assets.
- Regression tests require fixed swirl bounds/center, zero swirl pixels outside the aperture, distinct rotation phases, and hundreds of visible pixels in the untouched lower frame/platform. Fresh browser sequences confirm the frames no longer bob, morph, erase their lower structure, or report console errors.
- Replaced the HD visuals behind all existing `torch` identifiers with grounded common, corruption, and abyss braziers. Each theme uses one byte-identical bowl/base plus three flame-only overlays; map marker `3`, manifest keys, save compatibility, Classic fallback, menu behavior, and soundtrack remain unchanged.
- Preserved the approved ImageGen brazier atlas and pinned its SHA-256 in both deterministic asset locks. Full desktop browser inspection covers Descent, Corruption forge, and Abyss otter rooms; no green chroma leakage is present in the twelve final brazier PNGs.

## 2026-07-13 — HD mine visibility correction

- Confirmed the regression at the render boundary: normal room generation creates mines with `armed: false`, but the HD hazard layer drew only mines whose `armed` field was not false. Classic mode already drew both states.
- Added `hazard.common.mine.unarmed` while preserving the existing armed identifier, mine state, saves, mechanics, and Classic assets. The deterministic Descent builder now publishes a 64 px unarmed variant with the exact same alpha silhouette/static housing and a dark lens; the armed variant retains its bright orange-red core.
- Focused environment tests pass 23/23, including exact state routing, invariant housing/alpha checks, chroma policy, and isolated locked rebuild. Browser captures under `output/hd-mine-qa/` visually confirm an armed mine in `descent_hd` and visible unarmed mines in the Forge scenario.

## 2026-07-13 — Layered HD protection VFX overhaul

- Replaced the generic HD shield circle and the simple boss overlay arcs with four distinct layered effects: gold player Shield, cyan persistent player barrier, molten iron Blacksmith Guardian barrier, and violet Warden Void Aegis.
- Added a pinned transactional builder for 64 RGBA assets: rear/front passes across eight stable animation phases for each effect. Player effects use 128x128 canvases; boss effects use 256x256 canvases. Alpha bounds, centers, diameter, transparent corners, chroma policy, phase differences, and reproducible hashes are covered by tests and the lock file.
- Rendering order is now rear effect -> actor -> front effect for both player and boss layers. The effects read existing gameplay state only; mechanics, timing, saves, Classic identifiers/assets, menu behavior, and soundtrack remain unchanged.
- Added deterministic player Shield and persistent barrier scenarios alongside the existing Blacksmith and Warden showcases. A fresh desktop/mobile matrix captured three animation phases for all four effects. All 8 scenario/viewport entries used the 576x576 HD renderer, had no overflow or scroll drift, and reported zero console diagnostics. Evidence: `output/hd-protection-vfx-qa/`.
- Manual inspection of the final phase in all eight views confirms stable actor anchoring, full unclipped silhouettes, readable actors, and distinct protection identities at desktop and mobile sizes.
- Final release verification: both protection and boss asset locks pass; the full sequential repository suite passes 215/215; the independent audio freeze passes 5/5; syntax and diff checks pass; and the heavyweight VFX benchmark records 60.0 fps on desktop and mobile with zero console diagnostics.

## 2026-07-13 — HD dungeon variation and Abyss readability

- Audited the immutable Classic tilesets and renderer contract. Each 64×64 Classic sheet contains sixteen unique 16×16 slots: eight wall/corner slots plus eight floor/feature slots. Classic maps its fixed `floorPattern` values to base, B, C, skull, crack-cross, var3, var4, and brazier states; the HD renderer previously repeated only one base floor and treated sparse random decals as its only variation.
- Added seven deterministic full floor states per theme, derived only from the approved HD atlases and the real Classic skull motif. Existing `floor-base`, `torch`, gameplay, save, Classic, menu, audio, and soundtrack contracts remain unchanged. Rare semantic floors suppress unrelated random decals, and all optional variants safely fall back to `floor-base`.
- Added theme-specific HD spikes with the existing common spike retained as fallback. Corruption and Abyss environment contracts now contain thirty exact 64 px PNGs each; the locked Task 8 build contains 121 PNGs and seven verified immutable sources.
- Raised only Abyss floor midtones to a 56–62 readability band, capped its final ambient veil at 0.18 (0.12 with reduced effects), and strengthened only its existing player-presence separation light. Descent and Corruption lighting profiles are unchanged; no enemy-specific light was needed after visual review.
- Added deterministic `descent_floor_variants_hd`, `corruption_floor_variants_hd`, and `abyss_floor_variants_hd` scenarios exposing every semantic value `0…9`, plus a desktop/mobile capture runner. Fresh QA under `output/hd-dungeon-variation-qa/` passes 8/8: HD 576×576, scrollY 0, no overflow, zero console diagnostics, zero transparent or near-magenta pixels, and full semantic coverage. Desktop Abyss combat luminance improved from the audited 29.00 to 45.69; mobile records 45.34.
- Manually inspected every accepted canvas and viewport. Walls and inward-opening corners remain correct, all floor families are visibly distinct, braziers and skull/crack states are unclipped, the enemy remains readable, and the Abyss player silhouette now has a restrained local separation pool on desktop and mobile.
- Final evidence: all four deterministic asset lock checks pass; the complete sequential repository suite passes 225/225; the independent soundtrack/audio freeze passes 5/5; syntax and diff checks pass. The heavyweight VFX benchmark retains HD with zero console diagnostics at desktop mean 16.666 ms / p95 16.8 ms and mobile mean 16.666 ms / p95 16.8 ms (about 60.0 fps).

## 2026-07-14 — HD portal reveal regression

- Reproduced the clear-room regression at the HD presentation boundary: a playable room could be `roomCleared: true` while retaining the earlier `portal.active: false` flag, causing both the portal layers and its priority light to stay inactive.
- In active gameplay, room clearance is now authoritative for portal presentation. Non-playing diagnostic states retain their explicit inactive appearance.
- Verified the red/green regression in renderer and lighting tests, then ran the focused portal suite: 17/17 pass with syntax and diff checks clean. Commit: `20d9809`.
- Fresh browser transition QA used `enemy_roster_hd`: before clear there were seven enemies and no visible portal; after the real debug clear transition the state reported zero enemies, `roomCleared: true`, the portal at `(7,7)`, HD 576×576 retained, zero browser diagnostics, and a complete visible static frame plus animated inner swirl. Evidence: `output/portal-clear-qa/transition/`.

## 2026-07-14 — HD status-emblem showcase and browser QA

- Added deterministic `status_emblems_hd` coverage for seven player statuses, four enemy dynamic statuses, Elite, and all five elite affixes. The fixed combat room keeps hazards and interactables from obscuring the actor rails.
- Browser QA found and fixed a real cold-load presentation race: the HUD could render once in the temporary legacy canvas mode before asynchronous HD asset activation, leaving fallback dots/text in the side panels while canvas emblems were already active. Graphics initialization now marks the UI dirty after either successful HD activation or fallback settlement, so the HUD rebuilds against the final renderer mode.
- Fresh desktop 1440×1000 and narrow responsive 390×844 HD captures pass: 576×576 canvas, six loaded DOM emblems, all remaining showcase statuses on bounded actor rails, zero transparent or near-magenta pixels, no scroll/overflow, and zero browser diagnostics. The responsive effects pane keeps both Gothic rows fully inside its panel and retains the skill bar and mobile controls. Real mobile-device UA behavior remains intentionally unchanged behind the existing unsupported-device guard.
- Classic fallback was captured separately at 144×144 with zero HD status images and the original visual path intact. The supplied web-game client repeated the deterministic state twice without mutations or diagnostics. Evidence: `output/hd-status-emblems-qa/`.

## 2026-07-14 — HD status-emblem release verification

- All four locked production checks pass without publishing changes: status emblems, Descent environment, themed room environment, and layered protection VFX.
- The focused graphics/UI suite passes 71/71. The complete repository suite passes 237/237 sequentially, followed by an independent soundtrack/audio freeze pass of 5/5. This covers the portal reveal fix, wall topology, mines, VFX, lighting, player/enemy/boss animation, save/fallback behavior, UI, and Classic compatibility.
- Fresh heavyweight browser performance remains within the release budget with HD retained and zero diagnostics: desktop mean 16.759 ms / p95 16.8 ms (59.7 fps), responsive 390×844 mean 16.665 ms / p95 16.7 ms (60.0 fps). Evidence: `output/hd-status-emblems-qa/performance.json`.
- Removed only generated Python cache and the isolated enemy-build staging residue left by the exhaustive test run. The worktree is clean except for the user's untouched untracked `assets/hd/hd.zip`.

## 2026-07-14 — Runtime HD / Classic graphics selection

- Added a persistent `Options -> Graphics -> HD / Classic` choice that applies immediately through the existing race-safe graphics controller. The preference stays outside run saves, survives browser reloads, and safely falls back to Classic when HD loading cannot complete.
- Preserved the active run while switching HD -> Classic -> HD through the real Escape/save/Continue menu flow. Gameplay state, input, save compatibility, menu structure, Classic identifiers/assets, audio code, and soundtrack files remain unchanged.
- Fresh browser QA captured eight checkpoints covering both menu selections, both live renderers, return to the same run, and reload persistence in each mode. HD used 576x576, Classic used the original 144x144 canvas, every active label matched the live renderer, the run signature stayed identical, and browser diagnostics remained empty. Evidence: `output/graphics-toggle-qa/`.
- Manual inspection confirmed legible HD and Classic gameplay, correctly updated active labels, unclipped HUD panels, and the unchanged menu presentation around the new Graphics category. The supplied web-game client repeated the deterministic HD showcase twice without state drift or diagnostics.
- Final release verification passes 243/243 sequential repository tests after updating one obsolete asset-loader assertion from the retired `hdEnabled` startup variable to the persistent graphics preference contract. The independent soundtrack/audio freeze passes 5/5, and syntax plus diff checks are clean.
- Fresh heavyweight browser performance remains at 60.0 fps in both desktop and responsive profiles with HD retained and zero console diagnostics: desktop mean 16.666 ms / p95 16.8 ms, mobile mean 16.666 ms / p95 16.8 ms. Evidence: `output/graphics-toggle-qa/performance.json`.

## 2026-07-14 — HD actor proportion rebalance and release verification

- Rebalanced only HD presentation scale: Brute and Totem now render at 80×80 instead of 64×64, while Merchant renders at 96×96 instead of 128×128. All three retain the existing bottom-center logical tile anchor; Brute/Totem HP rails, status emblems, and crests are derived from the final presentation bounds.
- Source art was not resampled or replaced: all 64 Brute source PNGs and all 16 Totem source PNGs remain 64×64, and the four Merchant source PNGs remain 128×128. Merchant room-profile metadata now matches its 96×96 runtime presentation size.
- Fresh deterministic browser evidence is under `output/hd-actor-proportions-qa/`: desktop 1440×1000 and responsive 390×844 viewport/canvas/state/metrics/diagnostics captures, plus desktop Brute, Totem, Skeleton, and Merchant crops. Both views retained the 576×576 HD canvas, exact logical actor coordinates, scrollX/scrollY 0, no horizontal or vertical overflow, and zero console errors.
- Manual inspection confirms the larger Brute and Totem have a stronger combat silhouette, the smaller Merchant no longer dominates the room, bottom-center feet/bases stay anchored, and HP/status/crest rails remain centered, readable, separated, and unclipped in desktop and responsive views. The standard 64×64 Skeleton remains a useful unchanged scale reference.
- Final required focused release command passed 101/101 tests with 0 failures after adding the generator regression guard. The independent soundtrack/audio freeze passed 5/5. `node --check` passed for `game.js`, `scenario-overrides.js`, `render/hd-renderer-layers.js`, and `scripts/capture-hd-actor-proportions-qa.mjs`; `git diff --check` also passed.
- Isolation verification: `assets/sprite`, `assets/audio`, Classic renderer/config/menu/UI paths, and all HD actor PNG bytes are unchanged relative to `main`. `game.js` changes are confined to the deterministic QA scenario setup, apart from a cosmetic removal of two blank lines at EOF. Gameplay coordinates, hitboxes, balance, saves, input, and soundtrack remain unchanged.
- The Task 8 room-asset generator now reproduces the published 96x96 Merchant metadata instead of reverting it to 128x128. The metadata lock was refreshed to `97c6c4118f5716df528552a568fb82fa3ab5ada35422d077968bc554afd374bf`; `build-hd-room-assets.py --check`, the 18/18 room-asset suite, and 2/2 release gates pass without changing any PNG bytes.
- Minor QA-runner notes retained for follow-up: Merchant availability is selected through `localStorage`, and `summary.json` is written only after all assertions succeed. These do not affect game runtime or the captured successful evidence.
- Removed only the generated `scripts/__pycache__/` directory after resolving its absolute path and verifying it was inside this worktree; no other output/art or external worktree archive was touched.

## 2026-07-15 — Torch and setpiece safety zones

- HD torch rendering and lighting now ignore wall markers, matching Classic wall precedence.
- Added shared room-data cleanup for torch, mine, and spike conflicts around portals, shrine, merchant, pact, forge, Otter reward chest, Vault seal, and Boss center/north/south artwork.
- Existing saves and deterministic scenarios are sanitized after load/setup; the Otter reward chest is sanitized when it appears.
- Focused tests pass 11/11. Browser inspection of `warden_phase1_hd` shows clean Boss artwork and no console diagnostics; evidence: `output/torch-reservation-qa/`.

## 2026-07-15 — Tiered HD Dash and Shockwave VFX

- Rebuilt HD Dash as a tier-aware procedural ribbon: Rare dual edges, Epic afterimages/landing energy, and Legendary violet Void Lunge with first-hit burst and persistent animated afterline.
- Rebuilt HD Shockwave with a visible energy core, radial force spokes, Epic secondary ring, Fury-scaled detail, and Legendary gold/violet overload arcs. Shield rendering and assets remain unchanged.
- Extended transient VFX snapshots with presentation-only tier/style/seed/Fury metadata; gameplay damage, radius, cooldowns, and Classic rendering remain unchanged.
- Added deterministic `skill_vfx_tiers_hd` side-by-side showcase and reduced-motion detail scaling.
- Focused VFX/snapshot/scenario verification passes 25/25 with syntax checks clean. Browser evidence has zero diagnostics: `output/skill-vfx-tiers-qa/`.

## 2026-07-15 — Vault/Otter seals and late room-clear portal

- Moved the former chained/otter-emblem floor seal from Vault to Otter in both blocked and cleared states.
- Added two new generated Vault seal sources and deterministic 128x128 outputs: a locked keyhole mechanism and a visibly opened iris with brighter runes. The Task 8 generator, profiles, manifest, and lock now reproduce all 123 room assets.
- Audited the portal lifecycle and found a real late-turn gap: Chaos Orb resolved after the only room-clear check, so a final kill from its strike could leave `roomCleared` false indefinitely. A final post-Chaos clear check now closes that gap.
- Focused renderer, lighting, reservation, asset-contract, and portal-order checks pass. The real Vault Guardian debug-clear transition reaches zero enemies, `roomCleared: true`, and a visible portal with zero browser diagnostics.
- Final HD evidence covers locked Vault, cleared Vault plus portal, and cleared Otter plus portal under `output/vault-otter-portal-qa/hd/`.

## 2026-07-15 — Standard HD portal perspective correction

- Audited the common portal against the dimensional room walls and the forge/vault/otter portal kits. The common ring was a front-facing flat circle with no grounded depth cue.
- After rejecting the initial floor-ellipse direction, rebuilt the standard portal as a restrained low standing ring: near-circular opening, slight backward lean, visible lower thickness, and a compact grounded foot. Special-room portals and runtime size/anchor remain unchanged.
- The deterministic common-portal pipeline now supports an elliptical rotation space and re-centers every transformed swirl phase. The immutable frame remains byte-identical across animation composites; measured phase centroid jitter is below 0.15 px.
- `node --test tests/hd-environment.test.js` passes 26/26, including the full isolated locked rebuild and strict chroma/alpha checks.
- Browser smoke with the supplied web-game client passed on `?scenario=descent_hd`; state and inspected screenshots are under `output/portal-perspective-qa/` with the revealed portal at `(6,6)` and no browser diagnostics.

## 2026-07-15 — Standard portal grounding without a center foot

- Audited the standing common portal in isolation and in `descent_hd`. Its narrow center stem read as a separate decorative stand and collapsed to a thin line at gameplay scale.
- Removed the stem, column, pedestal, and round plinth. The upright ring now settles directly into a thickened lower arc with two low integrated side wedges and one continuous floor contact edge.
- Preserved the 128x128 bottom-center runtime anchor, common portal identity, near-circular aperture, immutable frame, and eight stabilized swirl phases. Special-room portals remain unchanged.
- `node --test tests/hd-environment.test.js` passes 26/26, including strict alpha/chroma validation and the isolated deterministic lock rebuild.
- Supplied-client browser smoke passed on `?scenario=descent_hd`; inspected gameplay evidence is under `output/portal-no-foot-qa/`, with the revealed portal at `(6,6)` and no reported browser diagnostics.

## 2026-07-15 — Fresh HD menu hides gameplay HUD

- Traced the startup composition regression to the ordinary `menu` phase continuing to build profile HUD data while the HD layout kept the live panel/board shell visible. The in-run pause menu intentionally shares the same phase but is distinguished by `menuOpenedFromRun`.
- Added an explicit `main-menu-only` body state only for a non-pause main menu. It hides Player/Info panels, log, canvas, rails, skills, controls, title bar, and footer, while stretching the menu overlay across the available framed viewport.
- Pause behavior is unchanged: opening the menu from an active run does not apply `main-menu-only`, so its live HUD remains visible.
- Regression and pause tests pass 3/3; `game.js` syntax passes. The supplied game client smoke passes after dismissing boot.
- Full-page Playwright inspection confirms a centered standalone menu with no gameplay HUD. Evidence: `output/playwright/main-menu-only/fresh-menu-final.png`. The only console entries are the pre-existing missing `favicon.ico` 404s.

## 2026-07-15 — Stable initial HD reveal

- Traced the intermittent Classic-to-HD flash to the boot screen revealing the application before asynchronous HD renderer initialization had settled.
- The first reveal now waits for the initial graphics-mode promise. Successful HD startup is shown directly as HD; failed or unavailable HD initialization still resolves safely to the Classic fallback instead of leaving the boot screen stuck.
- Regression, graphics-toggle, pause-menu, and HD overlay checks pass 11/11; `game.js` syntax passes.
- A throttled cold-start browser test confirmed that 50 ms after dismissing boot, while the renderer still reported `legacy`, the application remained hidden and the boot screen remained visible. The final revealed state was HD, with zero console errors or warnings.
- Full-page evidence: `output/playwright/boot-hd-stability/slow-load-final.png`.

## 2026-07-15 — HD Merchant consumables overlap fix

- Reproduced the overlap with long Epic-to-Legendary skill offers. The skill-description rule used `strong + span`, but a hidden `<br>` sits between those elements, so descriptions wrapped and the Skills section overflowed into Consumables.
- Corrected the HD-only selector to target the description span through the row structure. Long descriptions now remain on one ellipsized line while their full text stays available through the existing tooltip.
- The long-offer browser reproduction reports `overlap: false`; Shield ends above Consumables. Visual evidence: `output/playwright/merchant-overlap/after-long-legendary.png`.
- Merchant contract test and `game.js` syntax pass. The supplied game client also completed the Merchant interaction smoke with the player on the Merchant tile and no reported client errors.

## 2026-07-15 — HD Merchant relic buyback redesign

- Audited the buyback screen against the HD Merchant dashboard. The generic vertically centered selection layout produced excessive dead space, weak hierarchy, passive-looking rows, and prices buried inside sentence copy.
- Added a dedicated compact Buyback composition: top-aligned section summary, explicit 50% valuation rule, available-item count, two-column relic cards, and a separated `SELL 1 / GOLD` action area with stronger keyboard focus.
- Added the deterministic `merchant_buyback_hd` scenario for repeatable visual and interaction QA.
- Browser interaction passed: selling slot 1 changed gold from 861 to 911 and removed the relic row; `V` returned to the Merchant dashboard.
- Merchant, scenario, startup-menu, and HD overlay regression tests pass. Syntax and `git diff --check` also pass. Before/after evidence is under `output/product-design/merchant-buyback-audit/`.

## 2026-07-19 - HD checkpoint cleanup

- Kept the standard common portal at the intended 96x96 bottom-center runtime presentation; special-room portals remain unchanged.
- Updated stale contracts to include four intentional full-room biome backgrounds and the Warden burst-range snapshot enrichment used by HD VFX.
- Corrected two stale 128x128 portal assertions to the intended 96x96 contract. A headed descent_hd smoke shows the revealed portal at (6,6), correctly grounded and unclipped, with matching text state and zero browser diagnostics. Evidence: output/playwright/hd-portal-size-correction/.
## 2026-07-19 - Unified HD menu navigation and Camp relic management


- Added one HD-only spatial focus controller for Camp, Merchant, Merchant Buyback, Forge, Pact, relic drafts, swaps, and Emergency Extract. Arrow keys move between visible controls, Enter activates the selected control, pointer/focus input stays synchronized, and scrollable menus keep the selection visible.
- Kept Classic hotkeys as a compatibility path while replacing their primary HD presentation with arrow/Enter guidance and a visible gold focus treatment.
- Expanded Camp to four tabs: Upgrades, Mutators, Elixirs, and Relics. Relics are retained after extraction and can be sold one copy at a time from Camp with a two-step confirmation; the mandatory post-extract exchange no longer opens.
- Legacy saves paused on the old post-extract relic prompt migrate safely into Camp > Relics without losing carried relics.
- Added missing interactive contracts for Pact choices, Merchant Buyback rows, and explicit confirm/cancel rows for Emergency Extract.
- Syntax, diff hygiene, and focused HD Camp/Merchant/Relic/Forge/overlay/navigation tests pass.
- Headed QA confirms Camp relic selection and two-step sale, Merchant Buyback movement, Pact movement, and Forge left-to-right movement. The directional score was corrected after QA caught Forge selecting the diagonal Leave action. Evidence: output/playwright/hd-menu-navigation/asserted/.
## 2026-07-19 - Ember Sanctuary Camp HD redesign

- Implemented the user-selected first Camp concept: dedicated campfire sanctuary art on the left and the complete interactive Camp interface on the right.
- Added `assets/hd/ui/camp/ember-sanctuary-background.png` and reused real HD status/relic raster icons for Camp stats and item rows.
- Removed the generic full menu frame, widened the preparation area, simplified the footer to one primary Start Next Run action plus one contextual hint, and kept unavailable options readable with explicit missing-gold states.
- Separated active-tab green from keyboard-focus gold and disabled Camp tooltips that obscured adjacent rows.
- Preserved all four tabs, Classic hotkeys, relic sale confirmation, and the HD arrow/Enter controller.
- Fixed a geometry-sensitive navigation regression by capping the inverse-distance angular penalty; final ArrowDown targets are Upgrades 1, Mutators 1, Elixirs 6, and Relics 6.
- Headed QA passed all tabs at 2048 x 1152 and responsive layout at 1440 x 900 with one focus, no overflow, all icons loaded, and no browser diagnostics.
- Design comparison and QA evidence: `output/product-design/camp-ember-sanctuary/`; final result is recorded in `design-qa.md`.

## 2026-07-19 - Camp ornament and paired-row navigation follow-up

- Replaced the plain Camp ledger edge with the existing Abyssal Gothic board-frame raster and textured item surfaces.
- Rebuilt Start Next Run as a wider, taller ornamental plaque using the existing section-plaque, panel texture, and shrine icon assets.
- Added explicit row/column coordinates to Camp cards so horizontal arrows move between paired columns instead of drifting into tabs.
- Reproduced and fixed the reverse-direction `Number(null) === 0` edge case by excluding controls without Camp grid coordinates.
- Headed QA passes all tabs, `Vitality -> Potion Strength -> Vitality`, one-focus state, icons, diagnostics, and overflow checks at 2048 x 1152 and 1440 x 900.
- Final comparison evidence is under `output/product-design/camp-ember-sanctuary/`; `design-qa.md` ends with `final result: passed`.

## 2026-07-19 - HD welcome screen redesign

- Replaced the colorful HD boot composition with a dark abyssal-gothic dungeon gate while preserving the original arch, chest, torch, skull, weapon, and potion motifs.
- Kept the original raster logo and Classic boot screen unchanged; HD uses a separate semantic DOM title and dedicated stylesheet.
- Added restrained bone, aged-metal, and ember accents plus a gothic start plaque, vignette, reveal motion, mobile sizing, and reduced-motion handling.
- New generated background asset: `assets/hd/ui/boot/abyssal-gate.png`.
- Playwright verified the 1920 x 1080 composition, HD resource loading, and the Enter transition from boot to menu.

## 2026-07-19 - Underground Curio Market Merchant HD redesign

- Replaced the generic centered HD Merchant modal with an environmental Underground Curio Market: generated merchant-stall art occupies the left scenic zone and a complete responsive ledger occupies the right.
- Added `style-hd-merchant.css` plus `assets/hd/ui/merchant/curio-market-background.png`; the dashboard now uses category plaques, real raster item/relic icons, explicit price/action columns, visible descriptions, and one gold keyboard focus.
- Extended the same visual system to Buyback, Black Market, Legendary Exchange, and relic replacement states without changing their gameplay rules.
- Kept Classic isolated: it retains the Merchant title, legacy wallet summary, tooltip-backed rows, numeric keys, and original section markup.
- Headed QA passed at 1920 x 1080 and 1440 x 900. Buyback sale and return, dashboard arrow navigation, icon loading, focus count, viewport fit, resource diagnostics, and the Classic/HD boundary were verified.
- Contract and hygiene checks pass: `node --check game.js`, `node tests/hd-merchant-screen.test.js`, and `git diff --check`.
- Final visual comparisons and screenshots are under `output/product-design/merchant-curio-market/`; detailed QA ends with `final result: passed` in `design-qa.md`.

## 2026-07-19 - Merchant offer opening freeze regression fix

- Root cause: the HD reserve-offer row referenced block-scoped `slotRelic` after leaving the `if (relicSlot)` block. Real Merchant rooms normally have `merchantRelicSlot`, so opening the dashboard threw `ReferenceError: slotRelic is not defined`; empty-offer and Buyback scenarios did not exercise that branch.
- Fixed the reserve icon lookup to use the in-scope canonical `relicSlot.relicId` and added a contract assertion for this exact expression.
- The regression test failed before the fix and passes afterward.
- A headed continue-save reproduction with a real Fang Charm offer opened Curio Merchant, rendered the 100g offer, kept one HD navigation focus, stayed inside 1440 x 900, and reported zero page errors.
- `node --check game.js`, Merchant/navigation/overlay/curation tests, `git diff --check`, and the supplied web-game smoke client pass. Evidence: `output/playwright/merchant-open-freeze-repro/` and `output/playwright/merchant-open-freeze-fixed-smoke/`.


## 2026-07-19 - Standalone HD main menu frame fix

- Root cause: legacy `body:has(#game.graphics-hd)` selectors carried ID-level specificity, so they overrode the intended `main-menu-only` removal of the HUD and room frames.
- Raised only the standalone menu selectors to the same semantic `:has(#game.graphics-hd)` context; the in-run pause menu remains unchanged.
- Chromium confirms zero outer padding, no `board-frame.png`, the dedicated title backdrop, and no page errors at 2048 x 1152. The supplied web-game smoke client also completed without console errors.


## 2026-07-19 - HD Main Menu title environment

- Replaced the empty standalone menu backdrop with a full-viewport dungeon entrance composition using the existing HD abyssal-gate artwork: arch, torch and chest remain visible on the left while the framed vertical menu occupies the protected right column.
- Added a warm torch bloom, directional vignette, vertical brass divider and card shadow; this applies only to `main-menu-only`, so fresh launch and post-Game-Over return share it while in-run pause remains untouched.
- Chromium visual QA passed at 2048 x 1152 with correct full-viewport bounds and no page errors. The supplied web-game client completed without console errors; visual evidence is `output/playwright/main-menu-title-scene-v2.png`.


## 2026-07-19 - Debug first-time reset control

- Added `F - Fresh First-Time Reset` to the F9 cheat menu System section. It confirms before deleting every `dungeonOneRoom*` localStorage key, then reloads into the boot screen; unrelated origin storage is preserved.
- Debug action rows now expose the existing `data-hd-key` control path, so the reset and other cheat actions can be clicked or keyboard-activated without triggering the menu underneath.
- Playwright verified cancel preserves data, accept removes game data and reloads to the first-launch boot screen, unrelated storage survives, and no page errors occur. `node --check game.js` and the supplied web-game smoke client pass.


## 2026-07-19 - Warden death counsel frame overflow fix

- Root cause: the 955 px Warden counsel card was rendered inside a 552 px absolute board overlay with `overflow: hidden`, clipping the title and half of the row copy despite the card's own width.
- Promoted only the Warden-tip overlay to a fixed full-viewport layer above the HUD and enlarged the framed card target to 1280 x 720 while retaining responsive viewport caps.
- Playwright at 1366 x 768 and 1920 x 1080 confirms the card is fully contained, title and all four rows have no overflow, z-index is above HUD chrome, and no page errors occur. Evidence: `output/playwright/warden-tip-size-fix/`.


## 2026-07-19 - Unified HD tactical guide windows

- Increased Warden counsel typography by roughly 25-30% and corrected its eyebrow separator encoding.
- Restyled every HD tutorial modal (How To Play, Camp, Merchant, Portal, combat, status, skills, economy, and enemies) with the same full-screen gothic frame, larger readable type, responsive multi-column sections, and a scrollable content region.
- Audited HD control copy: Camp and Merchant now document arrow/Enter/Esc navigation, and How To Play no longer advertises Classic-only numeric/T-panel interaction in HD. Classic-specific instructions remain available in Classic mode.
- Static verification: node --check game.js, git diff --check, balanced CSS braces, and both referenced HD frame assets present. Visual browser QA remains for manual verification.

## 2026-07-19 - Dark HD outer-frame backdrop

- Replaced the gray-looking texture outside the capped 16:9 HD game frame with a near-black iron/stone vignette using existing Abyssal Gothic texture assets.
- Added a soft 44px outer shadow and one-pixel dark-metal seam to visually blend the capped game composition into the surrounding viewport.
- Kept the change scoped to `body.graphics-hd-ui:has(#game.graphics-hd)` at desktop widths, so Classic and gameplay content inside the frame remain unchanged.
- Headed 1920 x 1080 comparison confirmed the capped app remains 1680 x 1080, the outer body resolves to `#010202`, the new radial texture is active, and no page errors occurred.

## 2026-07-19 - How To Play utility copy trim

- Shortened the HD How To Play Utility copy to `Open the pause menu or go back.` and `Move between choices and confirm.`; removed explicit HD wording and left Classic copy unchanged.
- `node --check game.js` and `git diff --check -- game.js` pass. The web-game smoke client launched without console errors, but its fresh isolated profile stopped at the mandatory nickname modal before reaching the tutorial; manual visual confirmation remains.

## 2026-07-20 - Riftweaver and Abyss Bulwark HD v2 art pass

- Replaced all 128 placeholder actor frames for Riftweaver and Abyss Bulwark while preserving the existing manifests, clip counts, directions, frame sizes, and runtime keys.
- Replaced all 60 related VFX frames: Spatial Rift telegraph/detonation plus Bulwark guard, shield bash, blocked-hit, and backstab-hit.
- Added approved chroma/alpha source seeds, four normalized direction seeds per enemy, animation/VFX preview sheets, and reproducible generator tools/generate_expansion_enemy_hd_v2.py.
- Asset validation passed: 64 non-empty actor frames per enemy, 12 Riftweaver VFX, 48 Bulwark VFX, transparent corners, stable shared anchors, and no missing manifest paths.
- expansion-art-assets, expansion-content, and expansion-release tests pass. Playwright scenario expansion_enemies_hd loads both new actors without page errors; evidence: output/expansion-enemies-hd-v2-final/shot-0.png.

## 2026-07-20 - Riftweaver and Abyss Bulwark HD v3 animation correction

- Replaced the procedurally transformed actor frames with eight hand-painted 4x4 source sheets containing distinct idle, move, attack, hit, and death poses for all four directions.
- Corrected the HD runtime so a 120 ms movement tween advances through all four move frames and Riftweaver/Bulwark attacks animate continuously while their telegraphs are active.
- Added a reproducible v3 sheet slicer, chroma-keyed alpha sources, and focused frame-timing assertions. `tests/expansion-art-assets.test.js` passes 4/4.
- Playwright scenario `expansion_enemies_hd` loaded both actors from the current dungeon-3.0 server and captured visibly different animation frames without console errors in `output/expansion-enemies-hd-v3-final/`.

## 2026-07-20 - Vault Guardian room HD ability pass

- Added 32 optional 128 x 128 HD frames for sealed and destroyed Vault chests, Hoard Sentence, seal release, and Lockdown Pulse while leaving the Guardian sprite unchanged.
- Added reproducible source atlases, alpha sources, generator, and deterministic lockfile under `art/source/vault-guardian-hd-vfx/`.
- Wired optional manifest entries and procedural fallbacks into the HD renderer; Guardian events now trigger cast, detonation, and seal-break animations.
- Focused syntax, Vault integration, manifest, VFX, loader, visual-snapshot, generator-lock, and asset-contract checks pass.
- Headed Playwright scenario `expansion_vault_guardian_hd` reached gameplay without page errors; evidence: `output/vault-guardian-hd-assets-qa/shot-0.png`.

## 2026-07-20 - Bulwark and Spatial Rift animation stabilization

- Audited alpha bounds and lower-body anchors across every Bulwark direction and clip; the generated frames drifted horizontally by up to 12 px and hit frames floated up to 13 px above the floor.
- Added reproducible per-clip bottom/foot-anchor normalization without regenerating or changing the approved Bulwark model.
- Changed Shield Bash from a continuously looping telegraph animation to held anticipation/recovery poses, with the four-frame action reserved for `castFlash`.
- Horizontally normalized all Spatial Rift telegraph and detonation frames to the fixed 192 x 192 center while preserving vertical eruption growth.
- `tests/expansion-art-assets.test.js` passes 4/4; headed `expansion_enemies_hd` verification is in `artifacts/expansion-animation-fix-final/`.

## 2026-07-20 - Debug Cheats and Observer Cheat Merchant

- Rebuilt Debug Cheats as a full-viewport four-section console; all 32 actions fit at 1920x1080 without section overflow.
- Added direct forcing for Treasure, Shrine, Cursed, Merchant, Ambush, Horde, Duel, Crossroads, and Blood Arena alongside the existing special-room cheats.
- Added Observer Bot unlimited gold and a queued Cheat Merchant room with a free full catalog of 58 relics; manual selection and bot scoring both use normal relic legality rules.
- Verified with node --check game.js, node tests/debug-cheat-menu.test.js, the web-game Playwright client, and headed 1920x1080 browser checks. No page or console errors were reported.
## 2026-07-20 - Warden cast animation pacing

- Audited HD Warden spell animation timing: four cast frames were compressed into 100-140 ms while idle used 4 FPS and movement 8 FPS.
- Extended Warden-only cast presentation to 360 ms (90 ms per frame) for ranged casts, Void Aegis, Rift Lattice, Void Step, Doom Sigils, and Soul Chain. Gameplay turns, cooldowns, telegraphs, and damage timing are unchanged.
- Playwright scenario warden_phase2_aegis_hd captured a stable multi-frame cast sequence with no console errors. The focused boss suite passed 8/10; its two failures are existing stale manifest-count and phase2-key expectations unrelated to timing.
## 2026-07-20 - Riftweaver and Abyss Bulwark animation re-audit
- Confirmed two runtime causes: Riftweaver looped its full attack strip every 110 ms throughout the multi-turn rift telegraph, while Bulwark rendered its guard overlay unconditionally every 150 ms and treated generic `rests` as an attack state.
- Expansion-enemy special actions now play once across 320 ms (80 ms per frame), then hold a restrained anticipation pose until resolution; the shared movement and idle timing for other enemies is unchanged.
- Bulwark guard art is now limited to Shield Bash aiming and held on telegraph frames instead of free-running; `rests` alone returns Bulwark to idle. The HD showcase no longer injects a permanent `rests` state.
- Targeted test: `node --test --test-isolation=none tests/expansion-art-assets.test.js` (4/4 pass). Default Node test isolation was blocked by Windows `spawn EPERM`.
- Visual preview: `artifacts/rift-bulwark-animation-audit/shot-0.png` through `shot-2.png`; scenario `expansion_enemies_hd` rendered without browser errors.
## 2026-07-20 - Cheat Merchant multi-relic selection
- Removed the one-relic-per-room claim lock from manual and Observer Bot Cheat Merchant purchases.
- The catalog now remains open after each manual claim, allowing relic selection until the normal 8-slot base inventory cap (including existing expanded-cap rules); the Observer Bot keeps selecting its best legal relic on subsequent actions until no legal slot remains.
- Updated Cheat Merchant copy to communicate multi-pick behavior. Targeted `node tests/debug-cheat-menu.test.js` passes.
## 2026-07-20 - Mythic HUD border and Oath of Ruin bot stall fix
- Added the missing cyan Mythic rarity border, dark-cyan slot surface, and glow to the HD 8-10 relic inventory grid.
- Root cause of the Oath of Ruin Observer stall: potion actions remained eligible during `oathPotionLockTurns`, and the rejected `drinkPotion()` call was incorrectly reported as a successful bot action.
- Centralized Observer potion legality in `bot-safety.js`; Oath-locked potion actions are excluded from blast preparation, candidate scoring, and execution, and execution now reports success only after HP or potion count changes.
- `status_emblems_hd` now includes Oath of Ruin with an active potion lock for repeatable QA. Bot safety, HD left HUD, and scenario override tests pass.
- Browser QA reached `graphics-hd` without console errors. Computed Mythic border is `rgb(102, 228, 242)` with the expected cyan glow; artifacts are in `artifacts/mythic-oath-fix/`.
## 2026-07-20 - Abyss Bulwark HD scale
- Increased only the HD Abyss Bulwark render size from 88 px to 114 px (about 30%), preserving bottom anchoring, gameplay hitbox, stats, and Classic rendering.
- Playwright expansion_enemies_hd visual preview confirms the Bulwark reads larger than the player without clipping or console errors; artifacts: artifacts/bulwark-size-30/.

## 2026-07-20 - Generated hazards avoid the top playable row
- Random spikes, mines, flame vents, and frost runes now use y >= 2 in regular and boss rooms; Vault hazard candidates also begin at y = 2. Enemy placement is unchanged.
- Playwright expansion_traps_hd preview rendered the complete hazard set without console errors; artifacts: artifacts/hazard-top-row-fix/.


## 2026-07-20 - Endgame Warden staggered Rift Lattice
- Depth 80+ Abyssal Warden now casts single Rift Lattice A, casts single Rift Lattice B at the player's updated position on its next action, then detonates A and B on consecutive actions. The 5-turn cooldown starts only after B detonates; Collapse Warden at depths 60-79 keeps its existing single cast.
- Removed the simultaneous predicted extra line. Endgame boss rooms now spawn 2 forced elite adds instead of 3.
- Added a deterministic expansion_warden_lattice_sequence_hd QA scenario. Runtime states verified as A(2T), A(1T)+B(2T), B(1T), then no active pattern with cooldown 5. Targeted boss campaign, integration, release, and visual snapshot tests pass; artifacts: artifacts/warden-lattice-sequence/ and artifacts/warden-lattice-sequence-final/.


## 2026-07-20 - No elite Riftweaver in endgame boss rooms
- Boss add selection now rejects Riftweaver at depth 80+, while regular rooms and boss rooms below depth 80 retain the existing Riftweaver rules.
- Added expansion_endgame_boss_adds_hd for deterministic roster QA. At depth 85 it produced Abyssal Warden plus two elite adds (Skeleton and Acolyte), with no Riftweaver or console errors; artifacts: artifacts/endgame-boss-adds-no-riftweaver/.

## 2026-07-28 - Online v3 production release

- Deployed Online v3 to `https://dungeon-of-one-room.pages.dev` from verified source commit `7645e80`; final Pages deployment is `a218de92-6f9d-4301-a322-219c28a4f9a5`.
- Created the Free-plan production D1 `dungeon-online-v3-production` in WEUR and applied migrations 0001-0003; old v2 and older databases were not modified.
- Activated only `v08-meta-1` at `sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6` through private Worker `dungeon-online-v3-production`.
- Final gates passed: threat matrix 30/30, phase 706/706, baseline 3/3 plus headed smoke, and full 730/730 including 21/21 local Wrangler/D1 E2E.
- Production headed smoke passed menu labels, Practice with zero API calls, Ranked start, starting relic, first canonical room, resume, checkpoint, next room, leaderboard, and zero browser errors.
- Smoke run `run_d59efc9a79ce4ceb924c7cb9a53049de` was verified read-only in production D1 at revision 2, depth 1, room 2.
- No staging, Access gate, tester list, paid plan, soak, canary, M5, force push, or unrelated-history merge was performed.
- All 172 Vault Guardian deletions remain unstaged and outside the deployment.

## 2026-07-28 - Online v3 production UI hotfix

- Deployed native Online v3 menu integration, player-facing relic cards and copy,
  and automatic ordinary checkpoints to `https://dungeon-of-one-room.pages.dev`.
- Added a v2-style boot loading bar; after the first input, all keyboard and
  pointer input remains blocked until assets are ready and the boot fade is
  completely hidden.
- Final source commit is `797499d`; final Pages deployment is
  `2c5bab5b-e9fa-4446-b946-f3cb00df44de`.
- Final gates passed: threat matrix 30/30, phase 709/709, baseline 3/3 plus
  headed Practice/Ranked smoke, and full 733/733 including 21/21 Wrangler/D1 E2E.
- Production smoke passed Practice with zero API calls, Ranked start/resume,
  automatic checkpoint, next room, leaderboard status 200, and zero API,
  console, or page errors. Smoke run:
  `run_0f41876d60ee4a6e92996322b23945b1` at revision 2.
- Source `game.js`, ruleset hash, gameplay, Worker/D1, mode names, and combat
  authority remain unchanged. No staging, push, rollback, paid service, or M5.
- All 172 Vault Guardian deletions remain unstaged and outside the commits and
  deployment bundles.

## 2026-07-28 - Online v3 production portal synchronization hotfix

- Fixed the second-room portal block: the real Ranked descent now notifies the
  Online v3 runtime after `buildRoom()`, so the session returns from
  `ENTERING_NEXT_ROOM` to `ROOM_ACTIVE` before the next clear.
- Added a regression that clears and crosses two consecutive real player
  portals instead of using the bridge shortcut; the headed artifact reaches
  Depth 3 at `output/online-v3-m4-ranked-headed/ranked-two-player-portals.png`.
- Commit `1dc325c` deployed to production as Pages deployment
  `2aa78b63-90d7-444e-a78f-3f960b3ea3be`.
- Production smoke run `run_5c348fefba484959ae81d41a711808a0`
  crossed Depth 1 -> 2 -> 3 through two checkpoints and real portals with zero
  API, console, or page errors, then finalized normally.
- Gates passed: threat matrix 30/30, fast 39/39, phase 709/709, baseline 3/3
  plus headed smoke, and full 733/733 including 21/21 Wrangler/D1 E2E.
- Source `game.js`, ruleset hash, gameplay, Worker/D1, mode names, and combat
  authority remain unchanged. No staging, push, rollback, paid service, or M5.
- All 172 Vault Guardian deletions remain unstaged and outside both commits and
  the deployment bundle.

## 2026-07-28 - Online v3 complete-state production redeploy

- Rebuilt Pages from clean complete-state commit `0e2bb6f` and confirmed the
  deployable `game.js`, UI/runtime modules, and styles were byte-identical to
  the files already served by production.
- Redeployed the complete state to the existing production project as
  `b9053e9a-c5c0-4784-87ce-ecddb5a32d86`.
- A fresh-profile headed audit confirmed `Practice (Offline)`,
  `Ranked (Online)`, and `Ranked Leaderboard` as native menu rows; the former
  floating controls exist only as hidden compatibility nodes with
  `display: none`.
- Post-deploy browser diagnostics reported zero console and page errors.
  `verify:fast` passed 39/39 and the focused production release suite passed
  4/4; the deployed asset bytes are unchanged from the previously verified
  733/733 full release bundle.
- No gameplay, Worker/D1, ruleset, mode name, push, staging, rollback, paid
  service, or M5 change was made. All 172 protected Vault Guardian deletions
  remain unstaged and outside the deployment.
## 2026-07-28 - Native Ranked extraction and Camp production hotfix

- Removed the player-facing Ranked Extraction, manual Finalize, finalized, Open
  Camp, and separate Ranked Camp list from the normal lifecycle.
- Online v3 now performs canonical extraction/finalization in the background and
  reuses the original v0.8 Camp UI plus native Start Next Run.
- Commit `6e90aa0` is active as production Pages deployment
  `2d7c68be-1430-4f7c-ba81-5416f00193a9`.
- Threat matrix 30/30, fast 39/39, phase 709/709, baseline 3/3 plus headed
  smoke, full 733/733, focused headed lifecycle, and public production smoke all
  passed.
- Source `game.js`, ruleset, Worker/D1, gameplay tables, mode names, combat
  authority, and all 172 protected Vault Guardian deletions remain unchanged.

## 2026-07-28 - Ranked recovery acknowledgement production hotfix

- Fixed the stuck reconnect flow after a canonical Abandon succeeded but its
  browser acknowledgement was lost.
- A later authenticated Abandon with a new operation ID now returns the
  existing abandoned state as an idempotent success without changing revision
  or publishing a result.
- Commit `044839a` is deployed as Worker version
  `8e44d059-717c-4c6b-8cd9-591ed7c1bc1a`.
- Threat matrix 30/30, fast 39/39, phase 709/709, baseline 3/3 plus headed
  smoke, and full 733/733 all passed.
- Production smoke `run_0c4b6e458ce543eb86de3fd5deb97341` confirmed first
  Abandon 200, recovery Abandon 200 with a new operation ID, unchanged revision,
  `abandoned` persistence, and zero leaderboard rows.
- Pages, `game.js`, ruleset, D1 schema, gameplay, mode names, combat authority,
  and all 172 protected deletions remain unchanged.
2026-07-28 - Production ended Ranked recovery restart hotfix
- Fixed the post-Abandon reconnect loop: terminal recovery responses now show `Ranked Run Ended` with `Start New Ranked Run` instead of Resync/Abandon controls.
- Fixed exact start retry so recovery and single-writer ownership are established before Ranked begins.
- Added unit and headed regression coverage for lost Abandon acknowledgements, terminal resume 410, and a distinct restarted run.
- Code/test commit: `3d68783`; production Pages deployment: `071e6723-8222-4e42-9d7b-bca60e73b763`.
- Verification: threat matrix 30/30; fast 40/40; phase 710/710; baseline 3/3 plus headed smoke; full 734/734; focused headed lifecycle PASS.
- Public production headed smoke PASS; final test runs abandoned with zero leaderboard rows and zero unexpected browser errors.
- One revision-0 synthetic preflight run remains nonpublishable and is left to normal retention because its ephemeral recovery credential was lost when the helper exited.
- Ruleset and source `game.js` hashes unchanged; Worker/D1 schema/gameplay/mode names unchanged; 172 protected deletions untouched; no push, staging, rollback, paid service, or M5 work.
## 2026-07-28 - Practice/Ranked menu and recovery production hotfix

- Added `Main Menu` to the Practice pause menu while preserving the native
  Practice Continue snapshot and fixed mouse selection in the native
  `Start New Game / Load Continue / Cancel` prompt.
- Removed the ambiguous standalone Continue row; Practice and Ranked now expose
  separate save choices, and Ranked always opens an explicit
  `Start New Ranked / Continue Ranked / Cancel` screen.
- Closed terminal and invalid-recovery escape paths, released writer ownership
  on main-menu exit, and kept canonical Abandon ahead of replacing a Ranked run.
- Code/test commit `86cda91`; production Pages deployment
  `6d91dd40-0a75-4f8c-86a3-2c3ff22e468c`.
- Threat matrix 30/30, phase 712/712, baseline 3/3 plus headed, full 736/736,
  final Ranked headed lifecycle PASS, and public zero-API menu smoke PASS.
- Source `game.js`, ruleset, Worker/D1, gameplay, mode names, 172 protected
  Vault Guardian deletions, and the R1-P0-001 boundary remain unchanged.

## 2026-07-28 - Ranked reward/death presentation regression fix started

- New request: fix the player-reported early relic offer after an ordinary
  combat clear and the missing death screen/audio after a nonterminal Ranked
  life loss.
- Confirmed reward root cause: after an ordinary checkpoint, the response
  already contains the next directive and its reward envelope; the runtime
  consumed that upcoming room's relic slot before installing/entering the
  directive.
- Confirmed death root cause: the Ranked `gameOver` branch returns before the
  native death presentation, while `resumeAfterFatal` immediately rebuilds the
  next room.
- Baseline before edits: `main@af9b46f`, source `game.js` SHA-256
  `556829c909cdc9eaefb4238279457eb9b3427adef9ce494f35743542770ee7de`,
  ruleset `sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6`,
  and 172 unstaged protected deletions with path/status fingerprint
  `3350fde4b0f51e8c82607fe35c413de2849d46d171c793bb6ffd18ee08c3c08c`.
- Scope is local-only. Source `game.js`, Worker/D1, ruleset, Practice, and the
  protected deletions remain outside the implementation.

## 2026-07-28 - Ranked reward/death presentation regression fix complete

- Core commit: `9f60eaa` (`Fix Ranked reward and death presentation`), six files,
  204 insertions and 9 deletions. A later separate local recovery commit
  `c091b7c` contains the combined headed lifecycle coverage.
- Upcoming-room Warden/Otter/Arena relic slots now remain hidden until their own
  room has a real pending local clear.
- Accepted nonterminal Ranked life loss now holds the native v0.8 `You Died`
  presentation, invokes `assets/death.mp3`, shows the canonical relic loss, and
  waits for R/Enter before building the next canonical life. Server-prevented
  fatal events continue without a false death screen.
- Focused RED: 8/11 PASS with the three expected failures. Focused GREEN: 11/11.
- Headed Ranked lifecycle: PASS with a real ordinary-to-Warden boundary,
  post-Warden reward, native nonterminal death, death-audio invocation, R
  continuation, zero unexpected console errors, and zero page errors.
- Final verification on current `HEAD`: fast 44/44; phase 717/717; baseline 3/3
  plus headed smoke; full 741/741, including Wrangler/D1 21/21 and headed smoke;
  `git diff --check` PASS.
- Source `game.js` remains SHA-256
  `556829c909cdc9eaefb4238279457eb9b3427adef9ce494f35743542770ee7de`;
  source `game.js` and `index.html` have no diff from the initial `af9b46f`.
  Ruleset remains
  `sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6`.
- All 172 protected Vault Guardian deletions remain unstaged, with zero protected
  staged paths and no protected path included in either local commit.
- This task performed no push, deploy, staging, canary, soak, ruleset activation,
  migration, rollback, paid-service, or M5 action.
## 2026-07-28 - Ranked reward/death and stale-profile hotfixes completed

- Committed the local reward/death presentation fix as `9f60eaa` and the
  direct start/stale-profile recovery fix as `c091b7c`.
- Focused regressions pass: offers 6/6, production release 5/5, and
  client/recovery 14/14. The supplied headed lifecycle passes stale-profile
  repair, compact saved-run UI, reward-boundary ownership, native nonterminal
  death presentation, network loss, reload, multi-tab, and Camp.
- R2 threat matrix remains 30/30. `verify:fast` is 44/44, `verify:phase` is
  717/717, `verify:baseline` is 3/3 plus headed smoke, and `verify:full` is
  741/741 including 21/21 local Wrangler/D1 E2E.
- Built the exact source commit in an isolated worktree and deployed Pages
  production as `2eeead39-2f33-4f75-818e-5d9909bbb3a8` on the existing `dungeon-of-one-room` project.
- Public production smoke passed a real stale-profile rejection and automatic
  retry, reached the starting relic without reconnect, and canonically
  abandoned the repaired run. Remote D1 confirms `abandoned` and zero
  leaderboard rows.
- Source `game.js`, the ruleset hash, Worker/D1 behavior and schema, gameplay,
  Practice storage, mode names, combat authority, and R1-P0-001 are unchanged.
  No push, staging, paid service, or M5 work occurred; all 172 protected Vault
  Guardian deletions remain untouched and unstaged.

## 2026-07-28 - Ranked browser-storage recovery hotfix validated locally

- Reproduced the reported `Ranked Unavailable` screen with Chromium localStorage
  saturated to `QuotaExceededError` code 22; the failure happened before any
  `/api/v3/runs/start` request.
- Added safe one-retry reclamation for only retired `dungeonRankedV2Active` and
  the Online v3 leaderboard cache. Practice v3/v2 sentinels and unrelated
  storage remain preserved; insufficient space now has an explicit error.
- Failed-start cleanup now tolerates quota failure before a local session exists
  and cannot redirect that case into reconnect recovery.
- Focused GREEN 18/18; saturated-storage headed Ranked lifecycle PASS and was
  visually inspected at the native starting-relic screen.
- Threat matrix 30/30, fast 45/45, phase 721/721, baseline 3/3 plus headed,
  full 745/745 including local Wrangler/D1 21/21; `git diff --check` PASS.
- Source `game.js`, ruleset, Worker/D1, gameplay, mode names, Practice behavior,
  R1-P0-001, and all 172 protected deletions remain unchanged.