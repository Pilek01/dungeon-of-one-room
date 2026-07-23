# HD Dungeon Variation and Abyss Contrast Design

## Goal

Restore the environmental variation carried by the Classic `floorPattern` while preserving the approved HD art direction, and make Abyss combat readable without flattening its darker identity.

## Approved direction

The audit considered three approaches:

1. Brighten Abyss only. This fixes the most visible symptom but leaves every HD room built from one repeated floor tile.
2. Increase random decal density. This adds clutter without restoring the semantic Classic floor system.
3. Restore semantic floor variants and correct Abyss contrast. This is the approved approach.

No new generative source is required. The approved HD atlases already contain enough real floor material, and the Classic sheets contain the original skull motif. The builders will derive the shipping variants deterministically from those sources so the current art style and reproducible locks remain intact.

## Environment contract

Each theme ships seven ground states plus its existing brazier object:

- `base` — Classic floor A and the floor beneath a brazier;
- `b` — alternate slab distribution;
- `c` — secondary alternate distribution;
- `skull` — restrained theme-matched skull carving derived from the real Classic motif;
- `crack_cross` — a full floor tile carrying the approved HD crack source;
- `var3` — worn/broken material variation;
- `var4` — alternate wear and value distribution.

The renderer maps the existing `floorPattern` values exactly as Classic does:

- `2` and `5` -> `crack_cross`;
- `3` -> `base`, with the existing brazier drawn later;
- `4` -> `var3`;
- `7` -> `skull`;
- `8` -> `var4`;
- `6` -> `c`;
- `1` and `9` -> `b`;
- everything else -> `base`.

Walls and corners keep their current eight directional assets. Existing decals remain a secondary sparse layer, but rare semantic tiles and brazier positions will not receive an unrelated random decal.

## Asset pipeline

`build-descent-environment-assets.py` remains responsible for Descent and common assets. `build-hd-room-assets.py` remains responsible for Corruption and Abyss.

Both pipelines will:

- derive variants from immutable approved sources;
- publish 64x64 final PNGs under `assets/hd/environment/<theme>/`;
- keep `floor-base.png` as the compatibility name for floor A;
- add `floor-b.png`, `floor-c.png`, `floor-skull.png`, `floor-crack-cross.png`, `floor-var3.png`, and `floor-var4.png`;
- validate unique hashes, seamless edge behavior, luminance bounds, chroma policy, and exact dimensions;
- update their deterministic locks transactionally.

The current common spike remains the fallback. Three theme-specific HD spike assets will be derived from the approved spike source and theme palettes, then selected by depth.

## Abyss readability

Abyss must remain the darkest theme, but not the least readable playfield.

- Raise Abyss floor midtones from the current mean of about 33 into a target band of 50–62.
- Preserve dark cracks and violet/cyan accents instead of applying a flat brightness wash.
- Keep Corruption and Descent within their current value ranges.
- Cap the depth-40+ ambient darkness below the other high-quality profile rather than stacking a 26% near-black veil over the already-dark texture.
- Use the existing player-presence light as the first separation mechanism. Add enemy-specific presentation light only if browser QA still shows actors blending after the material and ambient corrections.

The target whole-canvas Abyss combat luminance is 45–55 at the deterministic desktop audit state. Descent and Corruption must not regress by more than five luminance points.

## Runtime behavior and compatibility

The change is presentation-only:

- no changes to `floorPattern` generation, RNG consumption, room layout, collision, hazards, AI, saves, input, balance, audio, or soundtrack;
- Classic assets and renderer remain byte-identical;
- new floor variants are optional manifest entries with a tested fallback to `floor-base`;
- theme-specific spikes fall back to the existing common spike;
- deterministic visual selection consumes no gameplay RNG.

## Verification

Tests will be written before implementation and will cover:

- exact Classic-to-HD floor mapping;
- manifest coverage and safe fallback;
- seven unique 64x64 variants per theme;
- locked reproducible builds and chroma rules;
- Abyss luminance bounds and theme ordering;
- sparse decal exclusions on semantic tiles;
- theme-specific spike selection;
- Classic and audio immutability.

Fresh browser QA will capture Descent, Corruption, and Abyss floor-variant showcases plus Abyss combat on desktop and mobile. Accepted screenshots must show all seven variants, readable actors, correct walls/corners, no clipped assets, no overflow, and no console diagnostics. The heavyweight VFX benchmark will be rerun after asset integration.
