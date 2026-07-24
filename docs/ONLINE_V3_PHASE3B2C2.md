# Online v3 Phase 3B2C2 — canonical relic replacement

## Completed v0.8 replacement audit

The audit below was completed before implementation. “Global draft” means the
shared `relicDraft` path used by starting relics, Warden drops, Otter, Arena,
Crossroads POWER and Forge Temper. Only starting/Warden/Otter are integrated in
this phase. Merchant, Forge, Arena and Crossroads remain deferred.

Every audited record was evaluated against this complete schema:
`flowId`, `legacySourceFiles`, `legacyFunctionOrSymbol`, `trigger`,
`incomingRelicType`, `incomingStacks`, `reason`, `pendingStateFields`,
`candidateSelectionRules`, `candidateExclusions`, `removalSemantics`,
`stackRemovalSemantics`, `legendarySemantics`, `mythicSemantics`,
`slotRecalculationOrder`, `bonusSlotSemantics`,
`mutualExclusionSemantics`, `cancelAllowed`, `offerConsumptionMoment`,
`replacementCommitMoment`, `fallbackBehavior`, `saveResumeBehavior`, and
`sourceEvidence`.

| flowId | legacySourceFiles | legacyFunctionOrSymbol | trigger | incomingRelicType / stacks | reason / pendingStateFields | candidateSelectionRules and exclusions | removal / stack semantics | legendary / mythic / slots / exclusions | cancel, consumption, commit, fallback, resume | sourceEvidence |
|---|---|---|---|---|---|---|---|---|---|---|
| `GLOBAL_LEGENDARY_DUEL_V08` | `game.js`, `relic-runtime.js`, `relic-data.js` | `chooseRelic`; `legendarySwapPending`; `applyRelic`; `removeRelic` | A selected legendary reaches the current cap and the cap is one. | One canonical legendary, one stack. | `LEGENDARY_LIMIT_REACHED`; `{incomingRelicId,currentRelicId}`. | Exactly the currently owned legendary can be exchanged. The other choice keeps it and discards incoming. Final build is revalidated. | The unique legendary is removed completely, then incoming is added. | Crown Concord raises the cap before incoming validation. With Crown and two legendary relics the global capacity mode below is used. | Cancel is allowed and discards incoming; it does not return to the offer. The selected incoming is locked while pending. Commit removes/adds before clearing the draft. Pending state is saved and restored. No replacement reward fallback. | `game.js:9763-9807`, `game.js:9967-9987`, `game.js:10038-10058`, `game.js:4666-4668`, `game.js:4861-4881` |
| `GLOBAL_CAPACITY_REPLACEMENT_V08` | `game.js`, `relic-runtime.js`, `relic-data.js` | `chooseRelic`; `relicSwapPending`; `getRelicSlotCapWithIncoming`; `isLegendaryRelicCapReached`; `hasMythicRelic` | Selected incoming cannot fit after applying its own slot bonus, or a legendary reaches a cap greater than one. | Any offered relic, one stack. | `RELIC_SLOTS_FULL`, `LEGENDARY_LIMIT_REACHED` or `MYTHIC_LIMIT_REACHED`; `relicSwapPending`, `relicSwapAdditionalDiscards`. | A physical owned slot is selected. A legendary incoming must leave the final legendary count legal; a mythic incoming must remove the current mythic. Every canonical candidate is accepted only if the complete final build is legal. | `removeRelic` removes the first matching physical occurrence. In the aggregated ledger this is `-1`; it is `remove_all` only when the target has one stack. Acquisition metadata on remaining stacks is preserved. | Incoming Abyssal’s +2 slots apply before its cost. Removing Abyssal is rejected when the resulting lower limit is exceeded. Removing Crown is rejected if two legendary relics would remain. The one-mythic cap enforces the explicit mythic mutual exclusions. | Cancel is allowed and discards locked incoming and the draft. Offer cannot issue a second choice. Commit removes/decrements then adds, with legacy rollback on an immediate add failure. Pending state is saved/restored. No replacement reward fallback. | `game.js:9809-9910`, `game.js:9988-10011`, `game.js:10038-10058`, `relic-runtime.js:removeRelic`, `relic-runtime.js:applyRelic` |
| `GLOBAL_ABYSSAL_REBALANCE_V08` | `game.js`, `relic-runtime.js`, `relic-data.js` | `relicSwapAdditionalDiscards`; `MYTHIC_RELIC_ID`; `MAX_RELICS` | A non-Abyssal mythic replaces Abyssal while 9 or 10 physical slots are occupied. | One non-Abyssal mythic, one stack. | `MYTHIC_LIMIT_REACHED` plus `BUILD_CAPACITY_REBALANCE`; the global pending fields plus a remaining-discard count. | Abyssal is locked until `length - 8` other physical occurrences are chosen. The final action removes Abyssal and adds incoming. Canonical candidates are complete removal bundles and are simulated as a final build. | Each selected other target loses one physical occurrence; Abyssal is removed completely. Duplicate stack targets may therefore lose one or more stacks when required by the selected bundle. | Final limit is eight because the +2 bonus disappears. The final mythic count is one and all slot/cap/exclusion rules are recalculated after the full bundle. | Legacy saves after each partial discard and cancellation retains those losses. Phase 3B2C2 intentionally represents the same complete outcomes as one atomic server transaction, as required by the phase safety contract; no partial state is exposed. Cancel before commit discards incoming and leaves the original build intact. | `game.js:9819-9872`, `game.js:10038-10058`, `relic-data.js:abyssalreliquary` |
| `FORGE_TRANSMUTE_V08` | `game.js`, `forge-room.js` | `executeForgeTransmute`; `forgeTransmutePending`; `canForgeTransmuteTakeRelic` | Player chooses Transmute and a sacrifice before seeing/selecting output. | One generated output, one stack. | Forge sacrifice transaction, not global replacement. | Output pool is evaluated against the build after removing every occurrence matching the sacrifice ID in planning; selection removes one occurrence and applies output with rollback. | Actual commit removes one physical occurrence. | Dedicated Forge pool legality; no gold cost. | Sacrifice is pending until output selection. Separate Forge lifecycle and outside this phase. | `game.js:9608-9634`, `game.js:9945-9964`, `forge-room.js:188-226` |
| `MERCHANT_RELIC_SWAP_V08` | `camp-runtime.js`, `merchant-curation.js` | `tryBuyRelicFromMerchant`; `tryBuyReservedRelicFromMerchant`; `tryMerchantRelicSwap`; `resolveMerchantLegendarySwap` | Paid live or reserved Merchant relic cannot fit, or reaches legendary/mythic cap. | Merchant offer/reservation, one stack. | Merchant-specific capacity or unique duel pending fields including price and source. | Target is chosen from owned physical slots; unique duel binds the current legendary/mythic. Payment and offer/reservation ownership are checked at commit. | One physical occurrence is removed; rollback restores it on add failure. | Merchant has its own legendary/mythic branches and economy bindings. | Cancel keeps the current build and does not charge the remaining price; reservation deposit rules are separate. Commit spends gold and clears Merchant inventory. Saved separately. Outside this phase. | `camp-runtime.js:210-285`, `camp-runtime.js:340-415`, `camp-runtime.js:450-493`, `camp-runtime.js:675-710` |
| `STORED_REWARD_EMPTY_FALLBACK_V08` | `game.js` | `openStoredRelicChest`; Otter/Crossroads empty branches | A stored reward has no usable relic choices. | No incoming relic. | Replacement reward fallback, not relic replacement. | None. | None. | None. | Arena/stored cache gives 60 gold, Otter gives 50 gold, Crossroads POWER gives 80 gold. These remain `BLOCKED_BY_REPLACEMENT_REWARD_POLICY` and are not implemented here. | `game.js:16529-16663` |

## Canonical policy decisions

- The evaluator has exactly three outcomes: `ACQUIRE_DIRECT`,
  `REQUIRE_REPLACEMENT`, and `REJECT`.
- Confirmed reason codes are `RELIC_SLOTS_FULL`,
  `LEGENDARY_LIMIT_REACHED`, `MYTHIC_LIMIT_REACHED`, and the secondary
  `BUILD_CAPACITY_REBALANCE` marker for a composite Abyssal shift.
- A pending transaction binds run, ruleset hash, revision, build digest, source
  offer, source choice and reward slot. Incoming and candidate mappings are
  immutable.
- The client may submit only `transactionId` and
  `replacementChoiceId`. Candidate removal IDs and stack counts are never
  accepted from the client.
- Selecting an incoming choice locks the offer. Successful commit or cancel
  consumes it exactly once. Cancel discards incoming and does not reopen the
  offer or reward slot.
- Starting selection is direct-only in a valid v0.8 run because its canonical
  build is empty. A non-empty starting build is rejected as a source-state
  violation rather than inventing an unreachable starting replacement.
- Phase 3B2C2 makes the full Abyssal rebalance atomic. This is the only safe
  canonicalization of the baseline’s complete legal outcomes; it deliberately
  removes the baseline’s intermediate-save partial-loss hazard.

## Arena dependency after Phase 3B2C2

Canonical run modifiers and `extraRelicChoices` are resolved. The global relic
replacement transaction is resolved for normal legal pools and full builds.
Arena’s empty stored-pool gold fallback remains open under
`BLOCKED_BY_REPLACEMENT_REWARD_POLICY`; therefore Arena is not implemented or
activated by this phase.
