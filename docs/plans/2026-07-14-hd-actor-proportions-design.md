# HD Actor Proportions Design

## Goal

Correct the visual hierarchy of three HD actors without changing Classic graphics or gameplay. The brute and totem should carry more visual mass, while the merchant should no longer dominate the room.

## Approved proportions

- Brute: 80x80 pixels, up from 64x64.
- Totem: 80x80 pixels, up from 64x64.
- Merchant: 96x96 pixels, down from 128x128.
- All three remain bottom-center anchored to their existing logical tile.

## Rendering design

The HD renderer will own explicit presentation-only size profiles. Standard enemies remain 64x64, the player remains 80x80, bosses retain their existing profiles, and only the brute and totem receive the approved 80x80 override. The merchant object draw uses the approved 96x96 profile.

Enemy draw coordinates will be computed from the selected render size for every non-boss actor, using the same bottom-center rule already used by bosses and room objects. HP bars, status rails, and crests will use the final draw bounds so they stay centered above the resized sprite.

## Preserved contracts

- No source sprite or animation frame is regenerated.
- No hitbox, grid coordinate, collision, AI, balance, timing, save data, or asset identifier changes.
- Classic rendering remains byte-for-byte and behaviorally untouched.
- Soundtrack and audio code remain unchanged.
- Existing fallback behavior remains unchanged.

## Verification

Add renderer tests that assert exact 80x80 brute/totem and 96x96 merchant destinations, bottom-center anchoring, centered HP/status geometry, and unchanged 64x64 standard enemies. Add a deterministic HD comparison scenario containing the brute, totem, merchant, and player with enough spacing to judge hierarchy. Capture desktop and responsive views, inspect for clipping and overlap, and run the focused graphics, Classic fallback, save, and audio gates.
