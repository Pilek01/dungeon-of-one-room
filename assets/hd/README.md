# HD asset policy

`assets/hd/` is reserved for the new raster graphics used by the HD renderer. Organize images by visual domain (for example `environment/`, `actors/`, `objects/`, and `effects/`) and keep paths relative to the game root.

Gameplay code identifies every image by the stable semantic key declared in `render/hd-asset-manifest.js`, never by a filename. Filenames may change as art is revised; semantic keys should change only when the visual meaning changes. Manifest paths must remain under `assets/hd/`, use safe relative path segments, and end in a supported image extension.

Critical entries are the minimum images required for a coherent HD frame. For the Descent vertical slice this is the floor, four walls, and four wall corners. If any critical entry fails to load, the loader returns `ready: false` and `fallbackRequired: true`, and the caller must keep the legacy renderer active. Optional failures are recorded in `failures` but leave `ready: true` and `fallbackRequired: false`; a later renderer may omit or replace those individual visuals.

`render/hd-asset-manifest.js` exposes shipping preload descriptors as `entries`. Stable keys reserved for later actor, enemy, boss, region, object, hazard, and VFX tasks live in `stagedEntries`: `getByKey()` can discover them, but the loader does not request their nonexistent files. A staged descriptor moves into `entries` only when its production image ships and its fallback classification is reviewed.

Loading is preload infrastructure. Images are created once during group loading and retained in the returned `Map`; render loops must not construct images per frame. HD loading is not activated until the renderer integration task explicitly consumes this contract.

Audio is outside this directory and outside this manifest. Do not copy, rename, edit, re-encode, preload, or otherwise touch soundtrack files through the HD asset pipeline.

## Reproducing the Descent environment kit

Install the exact asset-build dependency, then run the non-publishing lock check:

```powershell
python -m pip install -r requirements-hd-assets.txt
python scripts/build-descent-environment-assets.py --check
```

The build requires Pillow 12.1.1 and the installed Codex ImageGen `remove_chroma_key.py` helper with SHA-256 `7e51236919203b61d07ddffdc6e0b5f501a28661003f5851f26ffbb64bdec1ea`. The script reports and verifies both before invoking the helper. `--check` builds the normalized atlas and all 28 PNGs under `art/work/`, validates them, compares every hash with `art/source/abyssal-gothic-hd/descent-environment-assets.lock.json`, publishes nothing, and always removes the work tree.

`python scripts/build-descent-environment-assets.py` performs the same locked build and publishes the complete atlas/asset set with backup rollback. Only an intentional reviewed asset revision may use `--update-lock`; that mode publishes the staged set and lock together. The lock is never rewritten during a normal build or check.

## Reproducing the approved player seed preparation

The player seed preparation uses the same pinned Pillow/helper policy and publishes no shipping actor frames:

```powershell
python -m pip install -r requirements-hd-assets.txt
python scripts/prepare-player-seed-assets.py --check
```

The check verifies both immutable 1254×1254 RGB hashes: the approved identity seed and the rejected 10×7 atlas evidence. It rebuilds the keyed seed, 64 px anchor preview, three-floor comparison, rejected-layout component report/contact sheet, three derived direction-anchor previews, four 1024 px whole-direction edit canvases, and four exact direction prompts entirely under unique children of `art/work/player-seed-prep/`. It compares every output with `art/source/player-hd/player-seed-prep.lock.json`, publishes nothing, and removes its isolated staging tree in `finally`.

`python scripts/prepare-player-seed-assets.py` republishes the prepared outputs only when they match the committed lock. `--update-lock` is reserved for an intentional reviewed seed or pipeline revision and atomically publishes the complete prepared set plus its replacement lock. The four direction sources are generated later through four built-in ImageGen edits; the prep script does not create them, `assets/hd/actors/player/frames/`, player manifest entries, or any other shipping asset.
