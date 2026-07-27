# Online v3 Milestone M2B

## Result

Milestone M2B implements the authenticated pre-room boundary and connects the
exact local `v08-meta-1` release candidate to the existing Worker/D1 surface.
It does not activate production, change the game/client, or begin M3.

The canonical state machine is:

```text
awaiting_starting_relic
  -> authenticated starting selection
  -> active with first canonical room directive
```

A newly started real run contains its canonical starting offer and no room
directive, room nonce, synthetic room or placeholder room result.

## Boundary tokens

Version 2 tokens use the existing HMAC signer and distinguish:

- `run_bootstrap`: run ID, exact ruleset ID/hash, revision, starting offer ID,
  state digest, bootstrap nonce and bounded timestamps;
- `room_checkpoint`: run ID, exact ruleset ID/hash, revision, room directive
  ID, room nonce, state digest and bounded timestamps.

Legacy checkpoint tokens remain accepted only by the explicit fixture runtime.
Wrong token kinds fail closed and are never reinterpreted.

## Starting relic transition

The client submits only the bootstrap token plus opaque offer/choice IDs. The
server verifies all bindings, resolves the canonical relic, applies the build,
advances the revision, consumes the offer once and derives the first room
directive/nonce from the ruleset RNG. One conditional D1 write persists the
complete state and compact idempotency record.

Exact retry reconstructs the original selected build, directive, nonce, token,
state digest and response from retained immutable history. A conflicting
offer, choice, token or request digest is rejected. Restart and concurrent
choice tests prove that at most one first directive commits.

## Local runtime

`wrangler.local.jsonc` resolves only the exact local-release-candidate ID/hash.
The legacy fixture uses a separate `wrangler.fixture.jsonc`; it cannot silently
replace the real ruleset.

The real HTTP runtime covers:

- start and starting-relic bootstrap;
- sequential room checkpoints and reward envelopes;
- relic offers and replacement;
- fallback dispatch with canonical server-derived source binding;
- Merchant;
- Forge Temper and Transmute;
- Crossroads;
- Camp;
- Pact;
- compact retry, restart and optimistic D1 concurrency.

Real finalization authenticates the room boundary but returns
`REAL_RULESET_FINALIZATION_REQUIRES_M3` without mutating the run or leaderboard.
The existing fixture atomic-finalize regression remains intact. Canonical score,
outcome, lives and extract behavior belong to M3 and were not guessed here.

## Persistence findings

Real D1 restart coverage exposed two integration defects that memory-only tests
could not reveal:

- public relic choice validation depended on object insertion order instead of
  the exact field set after canonical JSON serialization;
- gold evaluation treated the subset of Pact/Camp IDs with gold modifiers as
  the full legal Pact/Camp catalog.

Both are fixed at their canonical sources. The genuine source change updates
the ruleset hash from:

`sha256:2fcc9df6032f7966ff0ede0e723dc1f0f3b0b28cc0d77533caaeb7ae886a8594`

to:

`sha256:58528474cf072fbeddfc68a29c1eda00414996cd8fb4ea2871e0b954a1f95276`

## Verification inventory

- bootstrap/property matrices: 64 bootstrap seeds and 64 selection seeds;
- targeted M2B contracts: 18 passing cases;
- real Wrangler/D1 lifecycle: 5 passing cases;
- full real HTTP meta lifecycle reaches relic reward, replacement, Merchant,
  Forge Temper, Forge Transmute, Crossroads, Camp and Pact;
- existing fallback, Arena, Warden, Otter, replacement, gold and M1
  transaction regressions remain in the phase/full suites;
- retained compact idempotency window: 12 operations.

All test artifacts and detailed logs are written only below ignored `output/`.
