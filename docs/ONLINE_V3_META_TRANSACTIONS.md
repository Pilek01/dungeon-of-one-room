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
