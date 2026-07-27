# Online v3 M4 client source audit

Status: completed before M4 runtime integration.

## Existing client modules

The disconnected `online-v3/` modules were Phase 1 scaffolding. They had no
transport, used a stale generic `signedRunToken` envelope, stored a client-owned
gold/build snapshot and expected obsolete leaderboard fields. None was loaded by
`index.html`.

M4 keeps the namespace and CommonJS/browser dual loading convention, but replaces
protocol-bearing code with the real M2B/M3 contracts. Ranked v2 code in
`game.js` is presentation evidence only: its `/api/leaderboard`,
`/run/start` and `/run/finalize` calls and client-computed score/outcome are not
reused as authority.

## Directive evidence

`v08-meta-1/room-policy.js` issues these active room types:

`combat`, `treasure`, `shrine`, `forge`, `pact`, `cursed`, `otter`, `vault`,
`merchant`, `ambush`, `horde`, `duel`, `crossroads`, `arena`, `boss`, `final`.

Every type has an existing v0.8 physical-room implementation. The authority
matrix classifies the directive type, depth, room index and boss/final category
as server-issued, while tile positions, hazard layout and local combat remain
client-only. Therefore M4 may pass the canonical type/depth into the existing
builder; it must not call `chooseRoomType()` for Ranked.

The directive contains no enemy coordinates or full layout. M4 must not invent
such a manifest. `specialRoomPayload` carries schedule evidence only and is not a
bootstrap directive.

## Planned narrow `game.js` hooks

1. Apply a canonical directive before the existing room builder.
2. Replace local room settlement with one Ranked checkpoint notification.
3. Route Ranked fatal/extraction/terminal boundaries to the runtime.
4. Publish a small bridge for start, canonical projection updates and room entry.

Mode selection, offers, meta-transactions, retry/recovery, finalization and the
v3 leaderboard stay in isolated `online-v3/` modules. Practice takes none of
these branches and retains its existing local saves, rewards, lives and v2/local
leaderboard presentation.

## Recovery evidence

There is no read-current-run endpoint. Safe recovery is still possible for the
supported same-browser states because compact idempotency reconstructs the exact
response when the client persists the exact pending request, token and operation
ID before sending it. Acknowledged public projections may also be re-rendered.
The client must fail visibly if that minimal record is absent or invalid; it must
never reconstruct canonical gold, build, lives or outcome from the Practice
save.
