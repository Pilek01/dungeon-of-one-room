# Abyssal Gothic HD — Descent Environment Source Atlas

## Approved direction

This is a production source sheet for the Descent vertical slice of *Dungeon of One Room*. It is not a concept board and must not depict a room, scene, UI, character, enemy, lettering, or explanatory diagram.

The approved visual direction is **Abyssal Gothic HD**: detailed hand-painted 2D game art with readable silhouettes at a 64 px tile scale. Descent uses cold worn stone, dark iron, dust, restrained ancient ornament, blue-steel shadows, and warm amber/orange fire. Purple or turquoise is reserved for portal and shrine magic. Avoid Corruption's toxic green, Abyss obsidian, boss crimson, glossy photorealism, modern machinery, and bright high-fantasy gold.

Every source uses a top-down orthographic 2D game-asset perspective, with no horizon, camera tilt, perspective convergence, or environmental backdrop. Use one consistent upper-left key light. Only lit torch frames may add warm local emission; shrine and portal states may add controlled magical emission without changing the upper-left material lighting.

## Required atlas contract

- One PNG, exactly **1024×1024 px**.
- Entire background is one perfectly flat, uniform **`#ff00ff`** chroma field.
- Strict **4×4 grid** of sixteen 256×256 slots. Slot boundaries are coordinate boundaries only: draw no grid, dividers, frames, labels, numbers, captions, or text.
- Keep at least 24 px of untouched `#ff00ff` padding inside every outer slot edge. Keep unrelated pieces at least 16 px apart inside multi-state slots.
- Nothing may cross a slot boundary. No cast shadow, glow, smoke, sparks, or debris may enter another slot.
- Do not use magenta, pink-purple, or `#ff00ff` in any asset, antialias fringe, glow, or reflected light.
- Center each asset in its slot. Preserve a consistent scale: a normal one-tile prop should occupy roughly 150–190 source pixels before normalization; larger shrine/portal art may use the full safe area.
- Keep silhouettes crisp and isolated. No fake transparency, checkerboards, paper texture, mockup panels, drop-shadow cards, or baked floor beneath overlay/object assets.
- Floor and wall sources must be neutral room materials. Object and hazard sources must remain readable against both cold stone and darkness.

## Exact 4×4 slot map

Coordinates are inclusive pixel bounds in the 1024×1024 atlas.

| Slot | Grid | Bounds `(x, y)` | Required source content |
|---:|:---:|:---|:---|
| 01 | R1C1 | `0–255, 0–255` | Seamless cold-stone floor base. Center one 192×192 repeatable square inside chroma padding; its own four edges must tile without seams. |
| 02 | R1C2 | `256–511, 0–255` | North wall master plus a separated south-facing companion edge in the same material language. Horizontal wall geometry only. |
| 03 | R1C3 | `512–767, 0–255` | West/east side-wall source pair, separated, orthographic, matching slot 02 in thickness and material. |
| 04 | R1C4 | `768–1023, 0–255` | Four matching wall-corner sources in a clean 2×2 arrangement: northwest, northeast, southwest, southeast. |
| 05 | R2C1 | `0–255, 256–511` | One branching stone crack decal only; no floor slab and no baked rectangular background. |
| 06 | R2C2 | `256–511, 256–511` | One square dark-iron floor grate overlay, worn but intact, with transparent/chroma openings. |
| 07 | R2C3 | `512–767, 256–511` | One compact rubble scatter of cold stone chips and dust; isolated overlay silhouette. |
| 08 | R2C4 | `768–1023, 256–511` | Torch source in a 2×2 arrangement: unlit, lit frame 01, lit frame 02, lit frame 03. Identical iron mount and anchor; flame motion only. |
| 09 | R3C1 | `0–255, 512–767` | Closed normal chest, dark iron bands over weathered wood, no magical rarity glow. |
| 10 | R3C2 | `256–511, 512–767` | Shrine inactive and active source states side by side. Identical stone silhouette and anchor; active state adds restrained violet/turquoise runic emission. |
| 11 | R3C3 | `512–767, 512–767` | Portal source in a 2×2 arrangement: inactive, active frame 01, active frame 02, active frame 03. Identical stone/iron ring and anchor; energy motion only. |
| 12 | R3C4 | `768–1023, 512–767` | Armed floor spikes: one-tile iron mechanism viewed from above, readable danger silhouette, no blood. |
| 13 | R4C1 | `0–255, 768–1023` | Armed mine: compact dark-iron floor device with a restrained amber warning core, no explosion or telegraph radius. |
| 14 | R4C2 | `256–511, 768–1023` | Decal variant 01: dry pale dust/scuff scatter, isolated overlay, no base tile. |
| 15 | R4C3 | `512–767, 768–1023` | Decal variant 02: charcoal soot drag/smear, isolated overlay, no base tile. |
| 16 | R4C4 | `768–1023, 768–1023` | Decal variant 03: muted iron-oxide/mineral stain, isolated overlay, no base tile and no blood-red treatment. |

Directional sources must already contain the named final orientations. Do not create east/west or corner finals by blindly mirroring baked light. If geometric derivation is needed during cleanup, restore the approved upper-left lighting before export.

## Crop and normalization pipeline

1. Preserve the untouched generated 1254×1254 chroma output at `art/source/abyssal-gothic-hd/descent-environment-source-original-1254.png`; its approved SHA-256 is `95d42f7402d5e8be87d9739069b090fd6c9f3269a6e0adb3e28565da065883d2`.
2. Resize the complete source once with high-quality resampling to the exact 1024×1024 working atlas at `art/source/abyssal-gothic-hd/descent-environment-source-1024.png`, preserving the 4×4 grid geometry.
3. Crop each working-atlas slot by its exact 256×256 coordinate bounds before any keying or state splitting. Never auto-detect a crop across slot boundaries.
4. For multi-state slots, crop each separated source piece independently. Preserve identical canvas anchor, scale, and non-emissive pixels across animation/state frames.
5. Remove only the flat `#ff00ff` background. Clean magenta fringe without eroding the silhouette. Do not use a global hue removal that alters violet/turquoise magic.
6. Normalize one-tile assets to exactly **64×64 px**. Center floor/wall tiles on the tile canvas; bottom-center props where applicable; center floor overlays/hazards in the tile.
7. Normalize shrine and portal states to exactly **128×128 px** (2×2 tile multiples), with identical bottom-center anchors across their states. Source art may remain smaller inside that transparent canvas; do not upscale merely to fill it.
8. Preserve opaque edges on base floor/wall tiles. Export every overlay, object, and hazard as RGBA PNG with a real alpha channel (PNG color type 6 preferred), including pixels that happen to be fully opaque.
9. Confirm each final output is an exact 64 px tile multiple, contains no chroma pixels or magenta halo, and visually matches the same upper-left light.

## Final manifest and file contract

`Critical` is limited to the player-independent room base: floor, four walls, and four wall corners. Decals and all optional dressing must not force legacy fallback.

| Semantic key | Final path | Size | Alpha | Group | Critical |
|:---|:---|:---:|:---:|:---:|:---:|
| `environment.descent.floor.base` | `assets/hd/environment/descent/floor-base.png` | 64×64 | not required | environment | yes |
| `environment.descent.wall.north` | `assets/hd/environment/descent/wall-north.png` | 64×64 | not required | environment | yes |
| `environment.descent.wall.south` | `assets/hd/environment/descent/wall-south.png` | 64×64 | not required | environment | yes |
| `environment.descent.wall.east` | `assets/hd/environment/descent/wall-east.png` | 64×64 | not required | environment | yes |
| `environment.descent.wall.west` | `assets/hd/environment/descent/wall-west.png` | 64×64 | not required | environment | yes |
| `environment.descent.corner.northwest` | `assets/hd/environment/descent/wall-corner-northwest.png` | 64×64 | not required | environment | yes |
| `environment.descent.corner.northeast` | `assets/hd/environment/descent/wall-corner-northeast.png` | 64×64 | not required | environment | yes |
| `environment.descent.corner.southwest` | `assets/hd/environment/descent/wall-corner-southwest.png` | 64×64 | not required | environment | yes |
| `environment.descent.corner.southeast` | `assets/hd/environment/descent/wall-corner-southeast.png` | 64×64 | not required | environment | yes |
| `environment.descent.decal.crack` | `assets/hd/environment/descent/decal-crack.png` | 64×64 | required | environment | no |
| `environment.descent.grate.base` | `assets/hd/environment/descent/grate.png` | 64×64 | required | environment | no |
| `environment.descent.rubble.base` | `assets/hd/environment/descent/rubble.png` | 64×64 | required | environment | no |
| `environment.descent.decal.stain01` | `assets/hd/environment/descent/decal-stain-01.png` | 64×64 | required | environment | no |
| `environment.descent.decal.stain02` | `assets/hd/environment/descent/decal-stain-02.png` | 64×64 | required | environment | no |
| `environment.descent.decal.stain03` | `assets/hd/environment/descent/decal-stain-03.png` | 64×64 | required | environment | no |
| `object.common.torch.unlit` | `assets/hd/objects/common/torch-unlit.png` | 64×64 | required | objects | no |
| `object.common.torch.lit01` | `assets/hd/objects/common/torch-lit-01.png` | 64×64 | required | objects | no |
| `object.common.torch.lit02` | `assets/hd/objects/common/torch-lit-02.png` | 64×64 | required | objects | no |
| `object.common.torch.lit03` | `assets/hd/objects/common/torch-lit-03.png` | 64×64 | required | objects | no |
| `object.common.chest.normal` | `assets/hd/objects/common/chest-normal.png` | 64×64 | required | objects | no |
| `object.common.shrine.inactive` | `assets/hd/objects/common/shrine-inactive.png` | 128×128 | required | objects | no |
| `object.common.shrine.active` | `assets/hd/objects/common/shrine-active.png` | 128×128 | required | objects | no |
| `object.common.portal.inactive` | `assets/hd/objects/common/portal-inactive.png` | 128×128 | required | objects | no |
| `object.common.portal.active01` | `assets/hd/objects/common/portal-active-01.png` | 128×128 | required | objects | no |
| `object.common.portal.active02` | `assets/hd/objects/common/portal-active-02.png` | 128×128 | required | objects | no |
| `object.common.portal.active03` | `assets/hd/objects/common/portal-active-03.png` | 128×128 | required | objects | no |
| `hazard.common.spikes.armed` | `assets/hd/hazards/common/spikes-armed.png` | 64×64 | required | hazards | no |
| `hazard.common.mine.armed` | `assets/hd/hazards/common/mine-armed.png` | 64×64 | required | hazards | no |

## Image generation prompt constraints

The generation request must explicitly include all of the following:

- “one production-ready 1024×1024 PNG source atlas”;
- “strict invisible 4×4 grid, sixteen 256×256 slots, follow the supplied R1C1–R4C4 slot map exactly”;
- “flat uniform `#ff00ff` chroma background, no transparency in the source atlas”;
- “no labels, text, numbers, borders, grid lines, UI, characters, enemies, scene, room mockup, or concept-board presentation”;
- “minimum 24 px internal chroma padding, nothing crosses slots, isolated centered assets”;
- “top-down orthographic 2D game assets, consistent upper-left key light, no perspective convergence”;
- “Abyssal Gothic HD Descent palette: cold stone, dark iron, dust, blue-steel shadows, warm amber torchlight, restrained violet/turquoise magic”;
- “do not use magenta/pink in the assets; no green corruption, boss crimson, blood, modern machinery, photorealism, or bright cartoon style”;
- “production asset silhouettes legible after normalization to 64×64; shrine and portal share stable 128×128 bottom-center anchors across states”;
- the exact sixteen slot descriptions above, in row-major order.

Reject the generation and regenerate if the atlas has text, a non-uniform background, missing or reordered slots, inconsistent camera/light, cross-slot effects, baked floors behind overlays/props, or fewer than the required separated state/frame sources.
