# HD Status Emblems Art Brief

## Purpose

Two immutable 1024x1024 source atlases provide thirty-two hand-painted Gothic emblems for the HD HUD and actor status rails. The art must remain readable when reduced to 20x20 pixels and must match the restrained dark-fantasy material language of the existing HD player, enemy, boss, and protection art.

## Shared source contract

- Strict 4 columns by 4 rows; sixteen cells in row-major order.
- One complete, centered emblem in each 256x256 logical cell.
- Perfectly flat solid `#ff00ff` background across the entire canvas.
- No grid lines, text, letters, numbers, labels, watermark, shadows, particles, scenery, or floor plane.
- No emblem may cross or touch a cell boundary; keep at least 28 pixels of clear magenta padding on every side.
- Orthographic front view, consistent camera, identical visual scale, broad high-contrast silhouette.
- Hand-painted dark-fantasy Gothic heraldry: aged iron, dark silver, carved stone, tarnished gold, colored glass or enamel, and restrained magical glow.
- Strong internal values and silhouette separation at 20 pixels; meaning cannot depend on color alone.
- Do not use magenta, fuchsia, or hot pink anywhere in the emblems.
- Harmful family: crimson, toxic green, cold blue, violet accents.
- Positive/protection family: tarnished gold, cyan, turquoise, pale blue accents.

## Combat atlas slots

1. Bleed — pointed blood drop split by a diagonal blade cut.
2. Poison — squat poison vial wrapped by a small serpent.
3. Burn — angular iron brand holding a three-pronged flame.
4. Freeze — broad fractured ice crystal inside an iron collar.
5. Disorient — broken compass rose combined with a split eye.
6. Enemy Buff — violet empowering chalice with two upward horns.
7. Fury — snarling wolf head over a compact red-gold sunburst.
8. Attack Up — upward sword piercing a small Gothic crown.
9. Armor Up — heavy breastplate with an upward chevron.
10. Max HP Up — crowned anatomical heart with a small upward ray.
11. Lifesteal — paired fang silhouette around a blood-red jewel.
12. Elixir — stoppered alchemical flask inside a silver quatrefoil.
13. Shield — round steel shield with a cyan central ward.
14. Barrier — turquoise crystal wall made of three vertical facets.
15. Second Chance — cracked death mask restored by a golden halo.
16. Shrine Blessing — stone shrine arch with a pale radiant sigil.

## Special and affix atlas slots

1. Chaos — asymmetric eight-point star split into mismatched shards.
2. Pact — two hooked hands clasping around a sealed red oath stone.
3. Hunger — open fanged maw inside a thin iron ring.
4. Swap — two opposing curved arrows around twin black-and-white stones.
5. Noise — cracked iron bell emitting two sharp side waves.
6. Soul Harvest — hooked reaper sickle drawing in a pale ghost flame.
7. Storm Sigil — forked lightning rune inside a triangular silver seal.
8. Quickloader — compact crossbow magazine with a circular speed notch.
9. Chest Upgrade — reinforced treasure chest crowned by an upward gem.
10. Last Stand — broken tower shield planted before a final candle flame.
11. Elite — ornate three-point Gothic crown crest, clearly wider than tall.
12. Relentless — winged boot or forward spear crest with a strong rightward silhouette.
13. Juggernaut — massive horned iron helm crest with a square silhouette.
14. Blooddrinker — bat-winged chalice holding a suspended blood drop.
15. Thorned — circular blackthorn wreath with four long outward spikes.
16. Volatile — cracked alchemical orb with a contained orange explosion.

## Acceptance

Reject a source if it contains a missing or duplicated subject, text, merged objects, inconsistent perspective, clipped content, boundary contact, non-flat background, fine-detail-only symbols, or two silhouettes that collapse into the same 20-pixel read.

## Immutable source registry

The built-in generator returned square 1254x1254 RGB originals. They remain byte-identical and are normalized only inside the isolated build staging directory.

| Source | Dimensions | Mode | SHA-256 |
| --- | --- | --- | --- |
| `combat-status-atlas-source-original-v2.png` | 1254x1254 | RGB | `c35798a2584da1891da96bf92954ff2a66bb8223b4674fbc26ae9b35e640c85f` |
| `special-affix-atlas-source-original-v2.png` | 1254x1254 | RGB | `d58436ea48dbf29d40606539bb5abf6f91bc80a326c52cc4d2df51c008488016` |

The first generated pair remains in Git history as rejected source evidence. It was superseded because several tall emblems reached logical row boundaries after normalization. The v2 pair deliberately uses smaller silhouettes and continuous key-color gutters.
