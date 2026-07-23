# Abyssal Gothic HD — Player Sprite Production Contract

## Purpose and non-negotiable runtime boundary

This brief defines the production source and final animation contract for the player in *Dungeon of One Room*. The approved direction is **Abyssal Gothic HD**. The player is the compact **Nameless Delver**, designed as a strict top-down/three-quarter orthographic game sprite that stays readable on a 64 px tile.

Animation is presentation only. Existing movement, bump attacks, damage, death, turn resolution, collision, hitboxes, input timing, enemy timing, and simulation state remain authoritative. The HD renderer may read a visual snapshot and select a clip, but it must never delay, replay, cancel, or otherwise change a gameplay action.

## Character lock

- Compact, grounded dungeon-delver proportions rather than a tall portrait or chibi mascot.
- Cold steel armor with restrained wear, dark iron fittings, worn brown-black leather, and a dark purple mantle/cape.
- Shadowed face under a practical helmet; no clearly lit heroic face and no exposed modern hairstyle.
- One readable short-sword silhouette. The blade and hand must remain legible in every facing without becoming oversized.
- Restrained material highlights and controlled value grouping. The silhouette and center of mass must remain clear at 64 px.
- The same armor design, mantle shape, sword, palette, proportions, scale, handedness, camera, and bottom-center root must persist through every direction and clip.
- Contrast must be checked against all three floor palettes: cold stone/iron **Descent**, damp bone/toxic-green **Corruption**, and dark obsidian/void **Abyss**.

Avoid bright high-fantasy gold, ornate royal armor, modern or industrial gear, guns, backpacks, oversized pauldrons, huge weapons, broad magical auras, large glow, bloom, scenery, UI, lettering, and watermarks. Purple belongs to the subdued cloth; it must not turn into a luminous silhouette. No magenta may appear anywhere in the character because `#ff00ff` is the source key.

## Seed source — stop for approval before animation expansion

The first ImageGen deliverable is exactly one source image:

`art/source/player-hd/player-south-idle-seed.png`

It is a single **south-facing neutral idle**, full-body sprite. This seed is reviewed at 64 px for silhouette, palette, center of mass, weapon readability, and contrast on Descent, Corruption, and Abyss floors. Do not expand the animation atlas until this seed is approved.

### Seed prompt contract

Use case: `stylized-concept`

Asset type: production seed for a 64 px top-down dungeon game player sprite

Primary request: one full-body, south-facing neutral-idle sprite of the compact Nameless Delver in the approved Abyssal Gothic HD direction

Subject: cold steel armor, dark iron fittings, restrained worn leather, dark purple mantle/cape, readable short sword, practical helmet with shadowed face

Style/medium: detailed hand-painted 2D game sprite with crisp, controlled edges and shapes that survive reduction to 64×64; not pixel art, concept-sheet art, portrait art, or 3D product rendering

Composition/framing: strict top-down/three-quarter orthographic game view; single centered full-body figure; south-facing; neutral idle; feet/root aligned to bottom-center; generous empty padding on every side; sword fully inside the canvas

Scene/backdrop: perfectly flat solid `#ff00ff` chroma-key field

Lighting/mood: restrained cool dungeon light, consistent material separation, no dramatic rim-light halo

Constraints: exactly one character and one short sword; same compact production-ready silhouette described above; uniform `#ff00ff` background; no magenta in the character

Avoid: scenery, floor, floor tile, pedestal, cast shadow, contact shadow, reflection, fog, particles, aura, large glow, border, grid, labels, text, watermark, cropped body, perspective camera, front-facing portrait camera, bright gold, modern equipment

The chroma background must be one perfectly uniform color with no gradients, texture, lighting variation, floor plane, shadows, or reflected color. Reject any output that contains multiple poses, a scene, a baked floor/shadow, edge contact, magenta character detail, or a camera that is not a strict top-down/three-quarter orthographic game-sprite view.

## Whole-direction animation sources

The rejected single-sheet attempt is preserved unchanged at `art/source/player-hd/player-animation-atlas-rejected-layout.png`. Component analysis proves that ImageGen replaced the mandatory 8×8/64-slot layout with **70 poses in a 10-column × 7-row layout**. Its clusters do not align with 128 px target slots, it contains six surplus poses, and its rows no longer preserve the semantic clip/direction mapping. It is evidence and a style/pose reference only; no crop from it is a final shipping frame.

Production generation is therefore corrected to **four whole-direction sheets**, never 64 independent frame generations. The environment pipeline already demonstrated reliable 4×4 layout adherence. Each direction is still generated as one coherent 16-pose edit, preserving within-direction motion and reducing identity drift.

- Four immutable generated source sheets, one each for `south`, `north`, `east`, and `west`.
- Exact immutable source paths: `art/source/player-hd/player-animation-<direction>-source-1024.png`. The historical suffix is retained, but the built-in ImageGen bytes are **1254×1254 RGB** and must never be overwritten.
- Exact normalized review paths: `art/source/player-hd/player-animation-<direction>-normalized-1024.png`.
- Every normalized review source is exactly **1024×1024**, with an invisible **4 columns × 4 rows** logical grid.
- Every logical slot is exactly **256×256 px** after normalization.
- No gutters, labels, borders, dividers, overlapping slots, or poses touching slot boundaries.
- Perfectly flat solid `#ff00ff` behind every isolated pose; no magenta in the character.
- Each sheet contains only one unmistakable direction. All 16 poses keep the same identity, palette, proportions, handedness, camera, scale, and bottom-center root.
- South R1C1 is anchored from the approved seed. North/east/west R1C1 use visually reviewed direction anchors extracted only as generation references from the rejected candidate; they are not shipping frames.

### Exact 4×4 layout for every direction

| Row | C1 | C2 | C3 | C4 |
| --- | --- | --- | --- | --- |
| R1 | idle01 | idle02 | idle03 | idle04 |
| R2 | move01 | move02 | move03 | move04 |
| R3 | attack01 | attack02 | attack03 | attack04 |
| R4 | hit01 | hit02 | death01 | death02 |

Motion intent is compact and readable: idle breath/weight shift, short grounded walking cycle, quick short-sword bump attack, controlled hit recoil, and a restrained collapse. Attack and hit poses must not introduce gameplay anticipation or recovery time. Death is a visual response to an already-completed game-over transition.

## Final production contract

The build verifies each immutable source hash, keys each whole direction through the pinned helper, detects four row and four column centroid clusters, and accepts only sixteen occupied semantic slots with no ambiguous component assignment. It removes tiny disconnected debris, preserves the intentional detached sword in north R4C4, then normalizes every character with one shared scale and bottom-center root and exports exactly 64 final files. No placeholder PNG is permitted.

- Final format: **64×64 RGBA PNG**, PNG color type 6 preferred.
- Runtime presentation: draw the unchanged final frame at **80×80 HD canvas pixels** for mobile readability, bottom-centered on the same logical 64 px tile. This presentation overhang does not change the logical coordinate, hitbox, pathing, or timing.
- Anchor: bottom-center, normalized as `[0.5, 1]`; the shared stance/root target is `(32, 60)` within each final canvas, retaining transparent padding below and around the silhouette.
- Four directions in exact order: `south`, `north`, `east`, `west`.
- Per direction: idle 4, move 4, attack 4, hit 2, death 2; 16 frames per direction and 64 total.
- Exact final path template: `assets/hd/actors/player/frames/<direction>-<clip>-<two-digit-frame>.png`.
- Exact semantic key template: `actor.player.<direction>.<clip>.<two-digit-frame>`.
- Frame numbers start at `01` independently for every direction/clip.
- Every shipping player frame belongs to group `player` and is `critical: true` once promoted to the active HD manifest.
- The active manifest may contain environment, enemy, object, hazard, boss, and effect assets in addition to these 64 frames. Player validation therefore checks the exact player subset, not total manifest size.
- All paths must be unique across active and staged manifest catalogs.

Examples:

- `actor.player.south.idle.01` → `assets/hd/actors/player/frames/south-idle-01.png`
- `actor.player.north.attack.04` → `assets/hd/actors/player/frames/north-attack-04.png`
- `actor.player.east.hit.02` → `assets/hd/actors/player/frames/east-hit-02.png`
- `actor.player.west.death.02` → `assets/hd/actors/player/frames/west-death-02.png`

The production metadata file will be:

`assets/hd/actors/player/player-manifest.json`

Its contract is:

```json
{
  "schemaVersion": 1,
  "actor": "player",
  "frameSize": [64, 64],
  "anchor": [0.5, 1],
  "directions": ["south", "north", "east", "west"],
  "clips": [
    { "name": "idle", "frameCount": 4, "fps": 4, "loop": true },
    { "name": "move", "frameCount": 4, "fps": 8, "loop": true },
    { "name": "attack", "frameCount": 4, "fps": 12, "loop": false },
    { "name": "hit", "frameCount": 2, "fps": 10, "loop": false },
    { "name": "death", "frameCount": 2, "fps": 6, "loop": false }
  ],
  "frames": [
    {
      "direction": "south",
      "clip": "idle",
      "frame": 1,
      "key": "actor.player.south.idle.01",
      "src": "assets/hd/actors/player/frames/south-idle-01.png"
    }
  ]
}
```

The shown `frames` record is the first of 64. The complete array follows direction order, then clip order, then ascending frame number exactly as defined above.

## Runtime visual selection contract

The visual snapshot supplies or derives player facing from the existing last movement delta and carries only short-lived presentation signals. Renderer selection priority is:

1. `death` when the snapshot phase is `dead` or player HP is zero;
2. `hit` while `hitFlash > 0`;
3. `attack` while the short-lived `visualAction` is `attack` after a bump attack has already resolved;
4. `move` while the existing movement tween is active;
5. `idle` otherwise.

Direction is one of north/south/east/west; the initial neutral fallback is south. Looping clips use snapshot time only. Non-looping clips clamp at their last frame and never hold the simulation, input, or turn loop open. Missing any promoted critical player frame must make the existing graphics controller select the complete legacy renderer.

## Acceptance gates

Reject the seed or atlas if any of these fail:

- compact Nameless Delver identity, cold steel/dark purple/worn iron-leather palette, helmeted shadowed face, or short-sword silhouette;
- readability at final 64 px on Descent, Corruption, and Abyss floors;
- exact camera, direction order, slot order, character identity, shared scale, bottom-center root, or handedness;
- uniform `#ff00ff`, isolation, padding, or zero-magenta character rule;
- no scenery, text, floor, shadow, aura, or cross-slot contamination;
- exactly 64 unique RGBA finals, zero visible chroma, meaningful alpha coverage, and the manifest/timing contract;
- visual-only integration with no gameplay delay or state mutation.

## Exact built-in whole-direction edit prompts

Each direction uses three inputs in the same order:

1. Image 1: `art/source/player-hd/player-south-idle-seed.png` — immutable identity reference.
2. Image 2: `art/source/player-hd/player-animation-atlas-rejected-layout.png` — rejected multi-direction style/pose reference only; never copy its 10×7 layout.
3. Image 3: `art/source/player-hd/player-animation-<direction>-edit-canvas-1024.png` — mandatory edit target and layout reference.

The four fully resolved prompts are stored for orchestration in `art/briefs/player-hd-direction-prompts.json`. Each prompt requires exactly one direction and the same 4×4 semantic layout above. Do not call ImageGen until all four edit canvases and anchors pass review.
