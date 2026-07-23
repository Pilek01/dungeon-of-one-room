# HD biome Warden animation prompt set

Generation mode: built-in Codex ImageGen (`image_gen`).

Each generated source uses the approved three-pose biome prototype as the
mandatory identity, palette, silhouette and material reference, plus the
existing directional Warden sheet as the timing and semantic layout reference.

## Shared animation contract

Create one square 4x4 production pixel-art spritesheet containing exactly
sixteen isolated full-body poses of the same weaponless milestone Warden. Use
one direction per sheet: south, north, east or west.

- Row 1: `idle01` through `idle04` — breathing and core pulse.
- Row 2: `move01` through `move04` — heavy alternating march.
- Row 3: `cast01` through `cast04` — wind-up, compression, two-fist ground
  slam and recovery.
- Row 4: `hit01`, `hit02`, `death01`, `death02` — recoil, collapse and a fully
  grounded defeated pose.

Exactly one Warden per cell; shared scale and bottom-center anchor; no cell
overlap, weapon, shield, scenery, floor, shadow, text, grid, detached armor or
extra limbs. Use a perfectly flat uniform `#ff00ff` chroma-key background.

## Biome identities

- Descent: charcoal stone-and-steel armor, antique-gold trim, cyan eye/core.
- Corruption: tarnished black-green steel, dark bronze, attached roots and
  moss, toxic teal-green eye/core.
- Abyss: matte obsidian and near-black violet armor, integrated void-crystal
  inserts, cold silver edges, violet-magenta eye/core.

For north-facing sheets show only the back of the helmet, rear shoulders,
spine armor and back plates; never a face slit, front eye or chest emblem.
