# HD-Only v0.8.2 Design

## Goal

Ship Dungeon of One Room as a single HD presentation in version `v0.8.2`. Classic source files may remain in the repository for history and offline tooling, but the playable page and Pages bundle must not load or expose the Classic renderer, Classic graphics preference, Classic UI branch, Classic boot logo, or `assets/sprite/**` presentation assets.

## Scope and interpretation

?Classic? means the retired 144?144 renderer and its presentation assets/UI. Shared simulation, save compatibility, Online v3 protocol, sound effects, and soundtrack remain unchanged because they are common game behavior rather than an alternate graphics version.

Historical fixtures, backup files, asset-builder inputs, and old documentation remain intact. Old `dungeonOneRoomGraphicsMode=classic` values are ignored; the game no longer reads or writes a graphics-mode preference.

## Chosen architecture

### One render mode from the first paint

The HTML shell starts with `body.graphics-hd-ui` and a 576?576 `#game.graphics-hd` canvas carrying `data-graphics-mode="hd"`. This prevents the current mixed state where HD UI surrounds a legacy canvas while assets preload. The hidden Classic logo element is removed so `assets/logo.png` is never requested.

`game.js` owns a trivial `isHdGraphics()` invariant that always returns true. Existing HD UI builders may keep using that semantic helper while dead Classic builder functions remain physically present. The Options menu no longer contains a Graphics category, and all keyboard handling for the former submenu is removed.

### HD controller without a legacy fallback

`render/hd-renderer.js` becomes an HD-only controller:

- it applies the 576?576 HD presentation synchronously at construction;
- it does not accept or call `renderLegacy`;
- initialization always loads the HD manifest;
- rendering always calls the HD renderer with a `Map`;
- critical or malformed asset-load failures remain in HD mode and return an explicit unsuccessful HD outcome instead of switching to legacy.

`game.js` converts an unsuccessful initialization into a fail-closed boot state. The boot screen remains visible with a readable reload instruction. Gameplay is not revealed with missing critical HD art, and the Classic renderer is never used as recovery.

### No Classic network graph

The unconditional Classic image-loader calls at startup are removed. The Classic draw functions and loader definitions may remain dormant in the monolith, but no reachable HD path calls them. The former graphics-preference script is removed from `index.html`.

The Pages build excludes runtime-only Classic presentation artifacts from its output:

- `assets/sprite/**`;
- `assets/logo.png`;
- `render/graphics-preference.js`.

Shared audio stays in the bundle. Keeping Classic files in the repository preserves asset provenance and builder inputs without allowing the shipped page to request them.

### Version identity

`window.GAME_VERSION` changes from `v0.8.0` to `v0.8.2`. The existing boot identity continues to render `GAME_VERSION ? short commit ? commit date`, with commit metadata injected automatically by the build. Historical Practice/Ranked fixtures keep their original versions; only live defaults and current-version assertions change.

## Failure policy

An HD critical-asset failure is a load failure, not permission to launch Classic. The canvas and body stay marked HD, the boot screen stays visible, and the player is told to reload. Optional HD assets retain their existing omission/fallback behavior inside the HD renderer.

## Verification strategy

TDD begins with guards that fail against the current dual-mode implementation. Coverage must prove:

- the HTML load graph contains no preference module or Classic logo;
- Options contains no Graphics/Classic selector;
- old stored `classic` cannot affect startup;
- the controller is HD before and during preload and cannot enter legacy mode after failures;
- startup contains no Classic loader calls;
- the Pages bundle omits the retired presentation artifacts;
- source and built boot screens report `v0.8.2` with automatic commit metadata;
- browser boot and gameplay request no `/assets/sprite/` or `/assets/logo.png` URL, stay 576?576 HD, and report no new errors.

Focused unit tests run during implementation. Final validation includes syntax/whitespace checks, the affected boot and HD browser scenarios, the current-tree baseline, and the required guard/phase checks. Generated manifest drift that predates this work is reported separately unless the authorized workflow permits its regeneration.

## Non-goals

- deleting Classic files or historical tests/backups solely for cleanup;
- changing gameplay, balance, save format, audio behavior, Ranked rules, or network protocol;
- deploying, pushing, merging, or activating rulesets.
