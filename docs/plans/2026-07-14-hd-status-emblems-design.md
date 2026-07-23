# HD Status Emblems Design

## Goal

Replace the remaining code-native buff, debuff, and enemy-affix presentation with a coherent set of hand-painted Gothic HD emblems. The same semantic symbols must work in the desktop HUD, mobile HUD, and above HD actors without changing gameplay state or the Classic renderer.

## Current mismatch

The current status presentation comes from several unrelated systems:

- `Active Effects` reuses generic text-only `statline` rows;
- Bleed and Poison beside HP are inline CSS shapes;
- Shield and Barrier beside HP are flat text tags;
- enemy Freeze, Burn, Disorient, and Acolyte buff are small solid rectangles;
- Elite and five enemy affixes use procedural rectangle geometry.

These states remain mechanically correct, but their shapes, scale, material, and rendering language do not match the painted HD actors, environment, and protection VFX.

## Approved direction

Use two coherent 4x4 source atlases and publish thirty-two hand-painted Gothic emblems. Symbols use strong silhouettes and internal shapes so color is never the only differentiator.

The combat atlas contains:

1. Bleed
2. Poison
3. Burn
4. Freeze
5. Disorient
6. enemy/Acolyte buff
7. Fury
8. attack up
9. armor up
10. max HP up
11. Lifesteal
12. Elixir
13. Shield
14. Barrier
15. Second Chance
16. Shrine Blessing

The special/affix atlas contains:

1. Chaos
2. Pact
3. Hunger
4. Swap
5. Noise
6. Soul Harvest
7. Storm Sigil
8. Quickloader
9. chest upgrade
10. Last Stand
11. Elite
12. Relentless
13. Juggernaut
14. Blooddrinker
15. Thorned
16. Volatile

Positive states favor gold, cyan, and turquoise. Harmful states favor crimson, toxic green, cold blue, and violet. Affixes use distinct heraldic silhouettes. Every icon must still read when displayed at 18-24 CSS pixels.

## Actor presentation

HD actors use one fixed status rail anchored above the actor. It never bobs and never changes the actor draw origin.

- Show at most three dynamic status emblems.
- Show harmful control/damage states first, protection second, and temporary buffs third.
- Show a compact `+N` counter when more dynamic states are active.
- Enemy affixes have a fixed crest position separate from the dynamic rail.
- Elite and affix crests do not compete with Freeze, Burn, Disorient, or Acolyte buff slots.
- Boss protection remains the existing full Shield/Barrier/Aegis VFX; a small emblem may summarize it but cannot replace the effect.

The icons are static. No vertical movement, scale pumping, or position-changing animation is allowed. A last-turn or newly-applied state may use a restrained opacity/glow response only if reduced-motion mode disables it and visual QA proves it does not reduce clarity.

## HUD presentation

In HD mode, every `Active Effects` row becomes a compact status row containing:

- a 24 px emblem;
- the existing effect name;
- the existing value or duration;
- the existing tooltip/copy.

The HP row uses the same Bleed, Poison, Shield, and Barrier emblems at 18-20 px instead of inline CSS shapes and flat `SH`/`BR` tags. Text labels, numbers, and tooltips remain available, so color and icon recognition are not required to understand the state.

Effects without a unique emblem map to the closest semantic family while keeping their own name and tooltip. Examples: Grave Whisper maps to attack up, Fractured Sigil maps to Barrier, Burn DPS maps to Burn, and shrine stat variants map to Shrine Blessing with their original values.

Classic mode retains the existing presentation. If an optional HD emblem is unavailable, the HUD keeps its readable text and the actor rail omits that icon; it must never draw procedural placeholder geometry or magenta diagnostics.

## Asset pipeline

Preserve the two untouched generated source atlases under `art/source/status-emblems-hd/`. A pinned transactional Pillow builder will:

- verify immutable source hashes and dimensions;
- normalize and chroma-key each complete atlas;
- split the exact 4x4 layout;
- normalize scale and optical centering as one icon family;
- publish unique 64x64 RGBA emblems under `assets/hd/ui/status/`;
- validate transparency, alpha coverage, visible bounds, chroma policy, and small-size readability;
- publish a contact sheet, semantic metadata, and deterministic lock;
- support isolated `--check` and intentional `--update-lock` modes.

All manifest entries are optional. Missing status art cannot force the whole game back to Classic because readable text and actor omission are safe fallbacks.

## Runtime architecture

Add a pure status-presentation module shared by the HUD and HD renderer. It owns:

- canonical status identifiers and aliases;
- mapping from existing state fields/effect rows to emblem keys;
- tone (`buff`, `debuff`, `protection`, `affix`, `neutral`);
- deterministic actor priority and overflow count;
- semantic HUD-family mapping.

The module reads existing state only. It cannot mutate state, consume RNG, change durations, or introduce new save fields. `visual-snapshot.js` exposes only the additional derived booleans/counts required by the HD actor rail.

## QA and acceptance

Add a deterministic `status_emblems_hd` scenario containing:

- a player with protection, one buff, and harmful states;
- enemies covering Freeze, Burn, Disorient, Acolyte buff, Elite, and all five affixes;
- enough simultaneous states to exercise the three-icon rail and `+N` overflow;
- a populated `Active Effects` panel.

Fresh desktop 1440x1000 and mobile 390x844 captures must prove:

- HD 576x576 remains active;
- every emblem is visible at least once in a contact or scenario capture;
- icons do not cover faces, HP bars, telegraphs, or each other;
- actor anchors and sprite bounds remain unchanged;
- text values and tooltips remain present;
- icon meaning does not depend on color alone;
- no overflow, transparent/blank frames, chroma-key leakage, or console diagnostics;
- reduced-motion mode keeps icons static;
- Classic, saves, gameplay RNG, audio code, and soundtrack files remain unchanged.

## Out of scope

- gameplay balance or new status mechanics;
- changing effect names, durations, descriptions, or save schema;
- redesigning the boot menu or skill bar;
- replacing the existing full protection VFX;
- changing Classic sprites or soundtrack/audio behavior.
