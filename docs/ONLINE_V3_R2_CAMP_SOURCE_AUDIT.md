# Online v3 R2 Camp source audit

## Active v0.8 evidence

- `extractRun()` is the only player action that converts the current run into
  an extraction result. A normal extraction requires the cleared-room portal;
  emergency extraction applies the canonical loss ratio.
- `enterCampFromExtract()` runs after extraction and copies the extracted gold
  into persistent Camp Gold before opening the Camp screen.
- Ordinary room completion does not enter Camp. It resolves rewards and exposes
  the next-room portal.
- `persistCampProgress()` stores Camp upgrades, skill tiers, the elixir loadout,
  start-depth unlocks and carried relics independently from a run snapshot.
- `startRun()` applies persistent Camp upgrades to the next run. Practice reads
  and writes that profile data only through local storage.
- Final leaderboard publication is a terminal operation. Camp changes are
  cross-run profile changes and must not mutate a finalized run or its summary.

## R2 binding

Ranked therefore uses an anonymous canonical profile:

- opaque `profile_<128-bit-id>` identifier;
- independent 256-bit profile credential; only its SHA-256 verifier is stored;
- profile state is loaded at Ranked start and never accepted from the browser;
- extraction credits the profile in the same D1 batch as the terminal run
  transition;
- Camp opens only for the profile whose extracted source run is finalized;
- Camp transactions use server-issued choices and conditional profile revision
  updates;
- the following Ranked run hydrates canonical upgrades, skills, elixir and
  carried relic state;
- Practice Camp storage and mechanics are unchanged.

The run-local `begin_camp_session` and `open_camp_offer` events are rejected.
This removes the former ordinary-room Camp path without changing combat or mode
names.
