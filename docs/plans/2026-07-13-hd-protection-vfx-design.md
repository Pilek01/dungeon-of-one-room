# HD Protection VFX Design

## Goal

Replace the placeholder-quality HD protection circles with four layered effects that preserve the readable color identity and animation rhythm of Classic mode while matching the scale and finish of the HD actors.

## Scope and compatibility

The pass covers player Shield, player persistent barrier, Blacksmith Guardian Barrier, and Warden Void Aegis. It reads only the existing visual snapshot fields and hit presentation signals. Shield values, absorption order, duration, damage, AI, save data, controls, menu, Classic assets, soundtrack files, and audio code remain unchanged.

Existing boss overlay semantic keys remain valid. New rear-layer and player protection keys are additive.

## Shared construction

Each effect is an eight-frame deterministic RGBA animation built at 4x resolution and downsampled cleanly. Every frame keeps one fixed canvas, center, diameter, anchor, and faint outer shell. Only contained highlights, runes, energy bands, cracks, and motes change phase. The whole shield never bobs, inflates, or shifts.

Every effect has two transparent layers:

- Rear: upper/back hemisphere, dim field, rear runes and secondary particles, drawn behind the actor.
- Front: lower/front rim, contact highlights and foreground energy, drawn after the actor.

On an existing `hitFlash`, both layers brighten briefly without changing geometry. Reduced-motion mode preserves the shell and front rim while freezing or suppressing nonessential motes.

## Effect identities

- Player Shield: compact gold/amber sphere, subtle hex lattice, rotating highlights and a crisp front arc. It stays closer to the player body.
- Player barrier: larger cyan/blue crystalline shell, segmented runes and heavier front plates. When Shield and barrier coexist, both remain distinguishable as nested layers.
- Blacksmith Barrier: orange molten dome with dark iron ribs, glowing seams, heat arcs and contained embers. It encloses the guardian rather than reading as a UI oval.
- Warden Void Aegis: indigo/violet sphere with two counter-phased arcane bands, void runes and inward-moving motes. It encloses the complete Warden silhouette without covering the boss identity.

## Rendering architecture

The player and boss actor render paths draw protection rear layers immediately before their actor and front layers immediately after. The current single-circle player VFX command is retired to avoid double rendering. Missing optional frames use distinct procedural fallbacks with the same color and rear/front split; they do not affect the HD renderer readiness contract.

Player Shield and barrier use separate size profiles. Boss effects remain bottom-centered and scale to their existing actor profiles. All selection is deterministic from `snapshot.nowMs`, protection state, accessibility settings, and existing hit presentation state; it never consumes gameplay RNG.

## Verification

Tests first reject the current placeholder implementation. They require eight rear and eight front frames per effect, stable alpha bounds and anchors, meaningful frame variation inside a fixed shell, distinct palettes/silhouettes, additive preserved boss identifiers, deterministic rebuilds, rear/actor/front call order, nested player effects, reduced-motion behavior, and no duplicate legacy circle.

Browser QA captures four deterministic showcases on desktop and mobile, samples multiple animation phases, compares them with the Classic reference assets, checks clipping and actor readability, and rejects console errors. The complete suite, performance gate, and audio freeze run before completion.
