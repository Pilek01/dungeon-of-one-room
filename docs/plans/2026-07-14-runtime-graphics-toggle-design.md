# Runtime HD / Classic Graphics Toggle — Design

## Goal

Let the player switch between the completed HD presentation and the untouched Classic presentation from the existing Options menu at any time, without losing the current run, restarting the page, or changing soundtrack behavior.

## Approved UX

- Add `Graphics` as the third category in `Options`, following the existing Enemy Speed and Audio patterns.
- The Graphics submenu contains `HD` and `Classic` choices and marks the active preference.
- Keyboard navigation, number shortcuts, Enter, and Escape follow the existing Options conventions.
- Pressing Escape during a run already saves the Continue snapshot before entering the menu. The player can change graphics, leave Options, and continue the same run.
- The selected preference persists across browser restarts.

## Runtime Architecture

- Store the preference under a new renderer-only local-storage key. Accepted values are `hd` and `classic`; malformed or missing data falls back to the shipping default from `config.js`.
- Startup reads the saved preference before initializing the existing graphics controller.
- Selecting Classic calls the existing race-safe controller with HD disabled. The controller immediately restores the original 144×144 canvas and legacy renderer.
- Selecting HD calls the same controller with HD enabled. Critical assets load asynchronously and the controller switches atomically to the 576×576 renderer after validation.
- A settled mode change marks the DOM UI dirty so HD-only status emblems and Classic fallback markers rebuild against the actual renderer.
- Simulation state, save snapshots, RNG, inputs, balance, and audio remain independent of the selected renderer.

## Failure Behavior

- The requested preference remains `hd` when HD asset loading fails, allowing a clean retry on the next launch or selection.
- The current runtime mode remains Classic through the existing critical-asset fallback path.
- The Graphics menu distinguishes the saved preference from an active Classic fallback so the player is not misled.
- Repeated or rapidly reversed selections rely on the controller's existing stale-initialization protection; an older HD load cannot override a newer Classic choice.

## Verification

- Unit and static contracts cover preference sanitization, default selection, persistence, menu routing, and no inclusion in run saves.
- Controller integration covers `HD → Classic → HD`, including stale async HD completion after a newer Classic selection.
- Browser QA starts a deterministic run, records state, switches to Classic through the real Options flow, continues the same run, switches back to HD, reloads, and confirms persistence.
- Each browser checkpoint records canvas mode and dimensions, gameplay state, screenshots, and console diagnostics.
- Full repository tests, Classic/HD visual inspection, performance gate, and the independent soundtrack freeze run before merge.
