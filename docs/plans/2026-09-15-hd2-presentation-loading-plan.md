# HD2 — implementation plan (2026-09-15)

Approved scope: enemy deaths, motion/anchors/impact, distinct skill VFX, material SFX/mix, on-demand HD2 loading. Preserve combat, turn timing, rewards, room rules and existing worktree changes. Audit: docs/audits/2026-09-15-hd2-visual-sfx-totem-audit.md.

1. Add tested HD2 presentation helpers: one-shot death frame selection, bounded lower-body anchor compensation, lightweight skill-specific effects.
2. Add tested actor streaming: player/base fallback at boot; atomic per-actor HD2 loading based on visual scene, deduplication, bounded inactive cache, failed-load fallback/retry policy. Keep HD1 behavior and critical boot validation.
3. Emit presentation-only death records before normal removal and reward resolution; copy only presentation fields to visual snapshots. Draw corpses without HP/status/occupancy and expire them by event time.
4. Correct immediate skill release poses and distinguish aura/hex/venom/heal/rift effects without changing AI delays or damage application.
5. Extend event SFX with quiet material transients, source-aware limiting and a compressor on the existing master path. Validate mute, finite bounded signals and multi-NPC playback; provide auditable listening samples without claiming physical listening.
6. Integrate and test: focused regressions, actual gameplay/death/room transition/fallback browser checks, current-tree HD, baseline, generator/protocol provenance and required phase check. Build/test commands sharing output directories run serially.

No commit or deploy is requested. Totem forced-movement rule is outside the five selected presentation/loading items; avoid changing combat rules in this pass. Its renderer must never select a missing movement clip, and idle/aura should remain visually anchored.
