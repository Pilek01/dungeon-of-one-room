# Online v3 Ranked trust model

Status: accepted architectural decision for R2.

## Decision

Online v3 Ranked keeps the existing product boundary:

- combat simulation and presentation remain local;
- Practice and Ranked use the same gameplay mechanics;
- the Worker owns canonical meta-progression at documented checkpoints;
- no per-turn networking, server combat engine or deterministic combat replay
  is introduced;
- the player-facing mode names remain unchanged.

R1-P0-001 is classified as:

`ACCEPTED_PRODUCT_LIMITATION`

It is not classified as fixed. A deliberately modified client can attest a
room completion without proving that every combat turn was genuinely played.
Production and release documentation must not describe Ranked as cheat-proof,
server-authoritative combat or cryptographic proof of gameplay.

## Canonical server-controlled systems

The Worker and registered ruleset control:

- sequential room directives, depth and checkpoint revisions;
- canonical gold and Camp Gold ledgers;
- server-issued offers, prices, costs, choices and replacements;
- canonical build, lives, outcome, extraction and final score;
- exact retry, conflicting retry and final leaderboard publication;
- authenticated run recovery and canonical public resynchronization.

Client-provided score, depth, gold, lives, outcome, build, price, rarity,
stacks, offers and finalization results are never authoritative.

## Bounded client-attested systems

The browser attests that locally simulated combat reached a room-completion or
fatal/extraction boundary. The Worker may accept only the documented bounded
claims for that issued boundary. It validates the current run, ruleset,
revision, directive, nonce, state digest and allowed claim bounds before any
canonical mutation.

This protects against straightforward request and state manipulation but does
not prove an honest combat client.

## Threats mitigated

Online v3 is intended to prevent or substantially reduce:

- direct score, depth, gold, lives and outcome manipulation;
- fabricated prices, offers, purchases, replacements and reward selections;
- stale or cross-run boundary-token use;
- duplicate rewards, transactions, finalization and leaderboard publication;
- conflicting concurrent canonical mutations;
- loss of acknowledged results within the supported retry and recovery
  windows.

## Threats intentionally not fully solved

Online v3 does not fully prevent:

- a modified client claiming a locally completed room;
- fabricated but protocol-valid local command or timing telemetry;
- automation that plays or attests local combat;
- broad resource abuse without the production edge controls required by the
  release gate.

Monitoring may record anomalies, but ordinary gameplay is not changed and
heuristics are not presented as proof. Hard rejection is reserved for
mathematically or protocol-impossible input.

## Rejected alternative

Per-turn server authority is rejected for this project because it would replace
the protected v0.8 local-combat architecture, add latency-sensitive networking
to movement, combat, AI and presentation, and create a second gameplay engine
whose parity would be a new release risk. That cost is not justified for this
small browser-game Ranked mode.

Practice remains fully local and offline. Ranked adds canonical
meta-progression around the same gameplay; it does not receive different
combat rules or player-facing trust branding.
