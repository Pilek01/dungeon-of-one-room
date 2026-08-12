# Mobile standards hardening implementation plan

1. Add behavior-first mobile smoke assertions for language, dialog semantics, focus containment/restoration, explicit touch exits, pointer cancellation, focus visibility, readable Pact terms, and dynamic button semantics.
2. Update mobile markup language/labels, add a concise live game-state description, and remove the decorative rotate glyph.
3. Add overlay accessibility synchronization and a mobile-only focus trap while preserving existing HD navigation and canonical keyboard dispatch.
4. Change mobile command buttons to up-event activation with cancellation and keyboard parity; synchronize `aria-label`, `aria-disabled`, and `aria-pressed` from authoritative game state.
5. Add visible Back/Close actions to Options/Tutorial/Merchant through existing canonical action keys.
6. Harden mobile gothic CSS: focus rings, 48 px exits, readable command/status copy, wrapping Pact terms, and complete reduced-motion coverage.
7. Run focused syntax/static tests, fresh mobile smoke profiles and gallery, inspect the new screenshots, then run the affected current-tree HD scenario, baseline verification, and `git diff --check`.
