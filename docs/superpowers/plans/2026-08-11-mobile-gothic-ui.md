# Mobile Gothic UI Implementation Plan

## 1. Lock the visual contract with RED tests

- Add `tests/mobile-gothic-ui.test.js`.
- Assert the final stylesheet is loaded after `style-mobile-hd.css`.
- Assert real gothic assets are referenced by gameplay controls.
- Assert coverage for Menu/Options/Tutorial/dialogs/Camp/Forge/Merchant/Pact/relic/extract/death/victory/records/nickname.
- Assert ≥48px touch targets, focus/pressed/disabled states, sticky overlay actions and reduced-motion behavior.
- Run the focused test and confirm it fails only for missing implementation.

## 2. Prepare project assets

- Chroma-remove and optimize the generated button frame and D-pad plate.
- Validate alpha, dimensions and file size.
- Keep existing skill/status/sanctuary art authoritative.

## 3. Implement the shared gothic layer

- Add `style-mobile-gothic.css` and load it last from `index.html`.
- Define scoped mobile tokens and shared frame/button/tab/row/footer states.
- Restyle Stats/Menu/D-pad/actions/Restart without changing markup contracts or handlers.

## 4. Skin all mobile overlays

- Apply the shared shell and action system.
- Add deliberate mobile compositions for the full player-facing surface inventory.
- Preserve one scroll region and a reachable sticky footer for long cards.
- Keep desktop and no-touch layouts unchanged.

## 5. Browser and visual verification

- Regenerate fresh gameplay/Fury/Menu/Camp/Forge/Merchant screenshots.
- Capture the remaining representative overlay families.
- Compare current vs reference vs implementation at the same viewport.
- Verify 844×390 and 844×288, all mobile profiles, desktop and hybrid.

## 6. Repository gates

- Run focused static tests and JavaScript syntax checks.
- Run `node scripts/mobile-v1-smoke.mjs --profile all`.
- Run affected `verify:ui-current -- --scenario hd` and `verify:baseline`.
- Run `git diff --check` and inspect exact task diff.
- Do not commit, push or deploy.
