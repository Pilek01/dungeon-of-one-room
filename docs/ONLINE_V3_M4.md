# Online v3 Milestone M4 — Client Integration

Status: implemented locally; production remains inactive.

## Architecture and authority boundary

Practice continues to use the original v0.8 boot, saves, room generation,
rewards, lives, outcome and presentation. Loading the Online v3 modules does not
instantiate their transport. Only an explicit Ranked or leaderboard click can
create a network client. The Practice browser suite asserts zero `/api/v3`
requests, including while the Worker is unavailable.

Ranked reuses the existing local renderer and combat simulation. Meta-progression
is isolated in `online-v3/`:

- `ranked-v3-protocol.js`: exact endpoints, token kinds and ruleset binding;
- `ranked-v3-transport.js`: bounded HTTP retry, stable operation IDs, timeouts,
  structured errors and redacted logs;
- `ranked-v3-storage.js`: separate, versioned minimal recovery record;
- `ranked-v3-client.js`: authenticated mutations, exact pending-operation
  persistence and public leaderboard reads;
- `ranked-v3-session.js`: fail-closed Ranked state machine;
- `ranked-v3-directives.js`: canonical directive allowlist;
- `ranked-v3-offers.js`: shared public reward and transaction projections;
- `ranked-v3-ui.js` and `ranked-v3-leaderboard-ui.js`: text-safe presentation;
- `ranked-v3-runtime.js`: orchestration at explicit meta-boundaries.

## Session and transport contract

The session states are:

`IDLE → STARTING_RUN → AWAITING_STARTING_RELIC → ENTERING_ROOM → ROOM_ACTIVE
→ RESOLVING_ROOM / AWAITING_REWARD_OR_TRANSACTION → ENTERING_NEXT_ROOM
→ TERMINAL_PENDING → FINALIZING → FINALIZED`.

Explicit retry, reconnect, protocol-error and abandoned-local-session states
fail closed. Illegal transitions throw rather than falling back to local
authority.

The client persists the exact endpoint, operation ID and body before a mutation.
An automatic or user-triggered retry reuses that tuple. A conflicting retry is
shown as a canonical-state conflict. The transport performs at most three
attempts with bounded backoff. Tokens are distinguished as `run_bootstrap`,
`room_checkpoint` and `run_terminal`; they live only in the Ranked recovery
record and are removed after acknowledged finalization. Token and digest fields
are recursively redacted from diagnostics.

## Integration hooks

The source audit is in `docs/ONLINE_V3_M4_CLIENT_AUDIT.md`. Seven narrow
`game.js` hook sites, grouped into four roles, were added:

1. directive selection and depth/category binding before the existing room
   builder;
2. room-clear notification plus acknowledged next-room portal entry;
3. fatal-event and extraction boundaries;
4. one frozen bridge for run start, canonical projection, fatal recovery,
   terminal hold and directive entry.

The bridge contains no HTTP code. Practice does not enter any Ranked branch.
The active canonical directive allowlist is:

`combat`, `treasure`, `shrine`, `forge`, `pact`, `cursed`, `otter`, `vault`,
`merchant`, `ambush`, `horde`, `duel`, `crossroads`, `arena`, `boss`, `final`.

No artificial room directive is created for bootstrap.

## Rewards and transactions

One shared adapter renders opaque server-issued choices for:

- starting relic, regular relic reward and replacement;
- Warden, Otter and Arena reward slots and canonical fallback;
- Merchant;
- Forge Temper and Forge Transmute;
- Crossroads;
- Camp;
- Pact.

The client never submits price, resulting gold, rarity, stacks, target relic,
RNG result, final build, lives, score or outcome. Local projection updates
occur only after an acknowledged response.

## Lives, terminal state and finalization

Fatal events are reported only at the explicit local fatal boundary. A
canonical prevention keeps the current directive; a canonical life loss starts
the new server-issued directive. Defeat, victory and extraction stop local
simulation and require a `run_terminal` token.

Finalization sends only the run ID and terminal token. Score, outcome, duration,
summary and leaderboard publication come from the Worker. A lost response is
retried with the exact operation ID and produces the original result and one
leaderboard row.

## Leaderboard

The public list preserves server order and treats the cursor as opaque. It
shows rank, display name, score, outcome, depth, duration and final gold.
Details show the immutable public ruleset/version summary, timestamp, lives,
relics and stacks, pacts, run modifiers, skill tiers, Camp upgrades and
elixirs. Loading, empty and network-error states are explicit.

Tokens, receipts, request/build/state digests, anomaly data and private
operation history are never rendered.

## Recovery

There is no read-current-run endpoint. Supported same-browser recovery uses
only:

- the last acknowledged public projection at bootstrap, active-room, offer and
  terminal boundaries;
- the exact persisted pending request for an interrupted start, event,
  checkpoint or finalization.

Reload during an acknowledged active room rebuilds presentation from the
canonical directive. Reload during a pending operation performs exact replay.
Missing, malformed, stale or mismatched recovery data fails visibly. Practice
saves are neither read as Ranked authority nor migrated.

## Browser evidence

`scripts/online-v3-baseline-smoke.mjs` covers the existing Practice surfaces and
asserts zero API requests, console errors and page errors.

`scripts/online-v3-ranked-headed.mjs` starts the real local `v08-meta-1`
Wrangler runtime with an isolated migrated D1 database and drives one headed
Ranked lifecycle through browser HTTP. It covers bootstrap, starting relic,
first room/checkpoint, a no-network active-combat interval, reload recovery,
canonical defeat, terminal token, a deliberately lost finalize response,
exact replay, one D1 publication, leaderboard list and build detail. Artifacts
remain under ignored `output/online-v3-m4-ranked-headed/`.

## Production boundary

`v08-meta-1` remains test-only. M4 changes no active endpoint contract, D1
migration, `recent_ops`, Wrangler deployment configuration, staging or
production activation. No push or deployment is part of this milestone.
