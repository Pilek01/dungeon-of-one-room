# Online v3 M1 — Meta Transaction Evidence

Status: disconnected, test-only. Baseline source commit:
`f98820c99066d810169e100beb23a54a332734bd`.

## Shared transaction contract

- `meta-transaction.js` issues opaque source, offer, transaction, and choice
  IDs through the versioned Online v3 HMAC RNG.
- Bindings cover run, ruleset hash, revision, canonical state digest, relic
  build digest, source instance, and offer.
- Requests contain only `transactionId` and `choiceId`.
- Evaluation occurs on a structured clone. The input state is never mutated;
  any validation or evaluator failure discards the clone.
- Exact retry is reconstructed from a bounded 64-entry receipt history.
  Reusing a transaction ID with another choice fails closed.
- Run gold and camp gold use the existing `goldLedger`; no parallel gold ledger
  or relic/build ledger is introduced.
- Multi-slot sources mark the committed choice sold and rebind only the
  remaining canonical choices to the resulting state.

## Merchant

Source evidence:

- `game.js:MERCHANT_RELIC_TIERS` and `generateMerchantSlots`: one relic rarity
  roll with weights 60/25/12/3 for normal/rare/epic/legendary, then one random
  relic from the unowned tier pool when possible; base prices
  300/600/1000/2000.
- `merchant-curation.js:chooseMerchantRelicOffer`: uniform selection from the
  supplied tier pool; there is no additional active curation ranking.
- `game.js:merchantPotionCost`: 10/20/30/40/50 per-run sequence, capped at 50,
  Merchant's Favor discount, run `shopCostMult`, and Pact of Avarice x2.
- `skills-data.js:MERCHANT_SKILL_UPGRADES` plus
  `game.js:merchantSkillUpgradeCost`: sequential skill tiers, exact base costs,
  Merchant's Favor, run `shopCostMult`, and Depth Highscore 20 for tier 3.
- `camp-runtime.js:spendMerchantUpgradeGold`: run gold is spent before camp
  gold for Merchant purchases.
- `camp-runtime.js:tryBuyRelicFromMerchant`,
  `tryBuyReservedRelicFromMerchant`, and swap handlers: the relic slot is
  consumed only by a successful direct acquisition/replacement; legal full
  builds use canonical replacement choices.
- `camp-runtime.js:tryReserveRelicFromMerchant` and
  `tryDiscardReservedRelicFromMerchant`: 25% rounded deposit, deposit consumed
  immediately, no refund, remaining price paid only on successful claim.
- `camp-runtime.js:tryBuyFullHeal`, `tryBuyCombatBoost`,
  `tryBuySecondChance`, and `tryBuyOneLife`: exact service costs
  150/200/800/2000; extra life has a 10% slot roll below the five-life cap;
  successful use consumes the service slot.
- `camp-runtime.js:tryUseBlackMarket`: normal to rare or rare to epic only;
  the target is removed atomically with the server-derived random result.
- `camp-runtime.js:trySellRelicToMerchant` plus
  `relic-data.js:RELIC_RETURN_VALUE`: one owned stack consumed for 50% of the
  rarity return value, paid as run gold.

Canonical RNG order is isolated into relic rarity, relic candidate, extra-life
roll, service choice, and per-target black-market result purposes. Cancel/leave
consumes no purchase and closes the Merchant offer. Exact retry cannot spend,
sell, reserve, replace, or grant twice.

## Forge Temper and Transmute

Source evidence:

- `game.js:openForgeRoom` and `executeForgeTemper`: the Forge is available only
  after the Blacksmith Guardian is cleared and the room Forge is still unused.
  Temper has no gold cost.
- `forge-room.js:FORGE_PROFILES`: Depth 0 uses rare/epic, Depth 20 adds
  legendary, and Depth 40 uses epic/legendary/mythic with the exact active
  profile weights retained in the generated policy.
- `forge-room.js:chooseForgeDraft`: the first (and only) Temper result is
  selected uniformly from the complete eligible profile pool; its rarity
  weights are not consulted for index zero.
- `game.js:isRelicEligibleForDraft`: Temper excludes an owned unique relic, a
  normal stack already at cap, and a second mythic. Slot and legendary
  pressure flows through the existing canonical replacement policy.
- `game.js:executeForgeTemper`: an empty pool leaves the Forge unused. A
  non-empty offer consumes the Forge when opened; declining loses the offered
  relic and does not reopen the Forge.
- `game.js:executeForgeTransmute` and
  `forge-room.js:planForgeTransmute`: the target is one owned relic stack and
  up to three unique results are generated. Each result first rolls a profile
  rarity at or above the sacrificed rarity, then selects uniformly from that
  rarity; an empty preferred tier falls back to the full legal profile pool.
- `game.js:canForgeTransmuteTakeRelic`: result legality is evaluated against
  the prospective build without the sacrificed relic, excluding the source
  relic itself and enforcing duplicate, legendary, mythic, slot, and stack
  limits.
- `game.js:chooseRelic` in the `forgeTransmutePending` branch: the source stack
  is removed only when a result is chosen; failed acquisition restores it.
  Skipping retains the source stack while the already-opened Forge remains
  consumed.

Online v3 exposes only opaque final Forge choices. Temper reuses canonical
acquisition/replacement. Transmute commits removal and acquisition on one
immutable clone, so neither half can persist by itself and the client cannot
report the target, rarity, RNG result, stacks, cost, or final build.

## Crossroads

Source evidence:

- `game.js:buildCrossroadsRoom` creates mutually exclusive POWER and MERCY
  chests. `closeOtherCrossroadsChest` closes the unchosen chest.
- `game.js:armCrossroadsPowerConfirmation` requires a second interaction for
  POWER. MERCY is applied immediately without the extra confirmation.
- `game.js:openCrossroadsPowerChest` deducts
  `max(1, round(maxHp * 0.15))`, clamps current HP to the reduced maximum, and
  records the exact penalty until canonical turn + 100.
- POWER uses three plus canonical `extraRelicChoices`, filters to
  epic/legendary/mythic, and preserves `buildRelicDraftChoices` RNG order:
  non-boss rarity roll, then uniform candidate, falling back to the complete
  remaining eligible pool when the rolled rarity is absent.
- POWER cost is applied before its relic offer. Declining the offer retains the
  penalty. If the canonical pool is empty, the penalty remains and base 80
  gold is granted through the existing canonical gold modifiers and ledger.
- `restoreExpiredCrossroadsPowerPenalty` restores the exact recorded max-HP
  penalty at expiry and clears the active Crossroads penalty state.
- `game.js:openCrossroadsMercyChest` heals to max HP, resets every skill
  cooldown, and fills every empty potion slot.
- With Pact of Avarice, MERCY does not refill potions. Each empty slot becomes
  base 12 gold through the existing canonical gold modifier and ledger.

The server issues opaque POWER result/replacement, POWER skip/fallback, and
MERCY choices. Committing any choice consumes the room source once. The client
cannot provide HP, duration, rarity, target, result, potion count, cooldowns,
gold, price, or final state.

## Camp

Source evidence:

- `game.js:enterCampFromExtract` freezes the canonical run
  `shopCostMult` as the Camp visit multiplier. It is stored in a server-issued
  Camp session and cannot come from a purchase request.
- `camp-data.js:CAMP_UPGRADES` defines the ten active upgrades, exact base
  costs, 1.4 growth, and maximum levels.
- `game.js:getCampUpgradeCost` first rounds
  `baseCost * costGrowth ** currentLevel`, then rounds the product with the
  frozen visit multiplier. All active upgrades spend camp gold.
- `game.js:buyCampUpgrade` spends only after affordability/max validation and
  increments exactly one level. Vitality and Satchel update current Camp
  resource previews; the canonical upgrade levels remain the effect source.
- `elixir-data.js:ELIXIRS` defines the nine active tier 1/2/3 choices, Depth
  Highscore gates 0/20/40, base costs 75/200/500, five charges, and five-turn
  runtime duration.
- `game.js:buyOrRefillElixir` permits one carried type, buys five charges, and
  refills with `ceil(baseCost * missing / 5)`.
- `game.js:discardElixirLoadout` returns
  `floor(baseCost * 0.5 * charges / 5)` camp gold and clears the loadout.
- `game.js:sellCampRelicAtIndex` requires two UI confirmations, consumes one
  exact carried relic copy, and awards the canonical rarity return value as
  camp gold.

Every Camp offer is regenerated from the canonical session, build, balances,
levels, unlocks, elixir loadout, and relic stacks. The request contains only an
opaque choice; price, currency, level, charges, refund, sale target, reward,
and final state are server authority.

## Pact

Source evidence:

- `pact-room.js:PACT_ROOM_PROFILES` enables Pact rooms at Depth 25 and keeps the
  active room weights 0.025/0.04/0.05/0.06 across the depth profiles.
- `pact-room.js:PACTS` defines eleven active pacts and exact minimum depths:
  Hunger/Precision/Velocity/Iron 25, Avarice/Blood 30, Ruin/Silence 35,
  Cinders/Chains 40, and Hunt 45.
- `pact-room.js:choosePactOffers` selects two uniformly without replacement
  from depth-eligible pacts, excluding the currently active pact.
- `game.js:applyPactChoice` removes an existing pact before applying the
  selected pact, preserves a maximum of one active pact, and consumes the room.
- `game.js:breakCurrentPact` is available only with an active pact, clears it,
  and consumes the room.
- `game.js:closePactPrompt` leaves an empty-pact room untouched and reusable;
  it does not invent or consume a pact choice.

Apply, replace, and break are zero-gold atomic transactions. Leave is offered
only without a current pact and does not consume the room source. The client
cannot report pact ID, depth eligibility, cost, result, or final build.
