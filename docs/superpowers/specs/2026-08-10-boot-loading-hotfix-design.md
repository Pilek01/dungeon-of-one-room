# Boot Loading Hotfix Design

## Problem

The production Pages build adds the loading bar when `dismissBootScreen()` starts. Since `enterSplash()` now waits for `initialGraphicsReady` before calling `dismissBootScreen()`, the bar appears only after HD loading has completed and jumps directly to its ready state.

## Approved behavior

- On the first boot input, `enterSplash()` synchronously adds the `loading` class to `#bootScreen` before awaiting `initialGraphicsReady`.
- HD readiness remains fail-closed.
- `enterMenu()` still runs before `dismissBootScreen()`, preserving the fix that prevents a gameplay-board flash.
- The production builder may add `loading` again; `classList.add()` is idempotent.
- No Worker, D1, protocol, gameplay, or ruleset behavior changes.

## Verification

Add one focused regression assertion to the existing HD-only boot transition contract. Verify the RED-to-GREEN transition, JavaScript syntax, the generated provenance manifests, the protected loading/browser baseline, the production Pages bundle, and the live Pages deployment. Do not deploy the Worker or activate a ruleset.
