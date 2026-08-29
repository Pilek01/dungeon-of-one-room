Original prompt: Diagnose and repair the Ranked Observer Bot production crashes, verify the smallest robust fixes, merge them to main, and deploy a working release.

## 2026-08-29 - Ranked post-room Pact extraction ordering fix

- Production diagnostics reproduced a normal extraction request racing ahead of
  the mandatory canonical post-room Pact transaction.
- Added a RED/GREEN runtime regression proving the required order is checkpoint,
  Pact commit, then extraction.
- The Ranked client now presents and commits a returned meta transaction offer
  before consuming a remembered extraction intent. Worker fail-closed Pact
  validation remains unchanged.
- Focused Pact regressions pass 19/19, phase verification passes 1090/1090,
  the current-tree Ranked lifecycle scenario passes, and the safety guard
  passes 15/15. The gameplay screenshot from the headed scenario was visually
  inspected.
- No commit, push, deployment, ruleset activation, or D1 migration is included
  in this step.

## 2026-08-29 - Ranked gold parity and Observer economy released

- Ranked now reconstructs the Worker's exact floating-point mutator order before reporting room gold. Exhaustive coverage checked 352,000 legal combinations without a mismatch; server validation remains exact and fail-closed, and Practice arithmetic is unchanged.
- Observer economy spends on Vitality, Blade, Guard, potion slots, and potion strength through depth 10, reserves 326 gold from depth 11, and reserves 694 gold from depth 16.
- Source `09d69e5d6521533f47a43eb7d79c29005cd3c225` passed `verify:full` 1112/1112 and is tagged `online-v3-production-2026-08-29-09d69e5`.
- Worker version `eefeeff3-ec66-499b-bfb4-6eb6968e2a9f` passed 5% and 25% canaries and is active at 100% in deployment `3d781e55-0ac5-4c4d-a747-e1cf3e5e6af5`; rollback is `fec399a9-7ae6-4191-b281-a3b8f3fa4e94`.
- Pages deployment `8bfbe730-9bc6-4f0a-b510-756653f67ce6` serves the exact verified build at `https://8bfbe730.dungeon-of-one-room.pages.dev`; rollback is `dad85291-4ee2-499c-9f39-8cc43cbd9b17`.
- Active ruleset is `sha256:5ba35a1c03cf160787c553d55782ddb1ec4612a9a08f2dc26da562feeccc73c2`; previous `sha256:78ae2f6f797063b7f364e5652e3367f6b26d651302f5c6038576d304dc442ec3` remains retained. D1 had no migration; bookmark `00000d75-00000000-000050d6-ca57f10d044401fec88aec5830af14e4` was recorded.
- Stable and immutable smoke passed root, availability, leaderboard, exact key-asset bytes, and four non-mutating JSON POST probes on each host.

## 2026-08-28 - Shrine HP, Map Fragment depth gate, potion ordering, and exact chest carry released

- Ranked boundary capture now subtracts only the currently active temporary Shrine maximum-HP bonus before reporting combat resources. Local Shrine healing and display remain unchanged, while the Worker continues to validate exact canonical HP/max HP.
- Practice and the new Ranked ruleset convert a would-be Map Fragment to the existing gold outcome before depth 11; fragments unlock at depth 11 without an extra RNG roll. Existing fragment progress is preserved.
- Ranked potion claims now preserve their order around canonical potion chests. A legal `use x3 -> potion chest -> use x1` sequence no longer collapses into an impossible four-use claim before the chest. The Worker keeps the existing per-state and total limits, rejects adjacent duplicate segments, and applies one strict legacy repair only when a single later canonical potion chest proves the old aggregate ordering.
- Practice Continue and Ranked checkpoint hydration now preserve the exact Worker-issued chest ATK/ARM/HP values at depth-scaling boundaries. The versioned v2 ledger validates exact totals against its bounded depth buckets; v1 states and historical rulesets keep their previous projection.
- The combined behavior is hash-gated at `sha256:78ae2f6f797063b7f364e5652e3367f6b26d651302f5c6038576d304dc442ec3`. The previous production hash `sha256:25dbdb962a478b3a46375ad5b25a3603041edd95ff45b51e2846b13ce7ea2989` remains registered with its prior fragment behavior and the narrow potion-order compatibility repair for already-pinned runs.
- RED/GREEN regressions cover the Shrine 125/125 -> canonical 115/115 boundary, damage clamping, unchanged non-Shrine resources, generated Pages bridge wiring, Practice depth 10/11 rolls, canonical Ranked depth 10/11 issuance, exact chest carry at depth 11/21/31 boundaries, forged v2 total rejection, previous-hash compatibility, ordered potion segments, strict legacy repair, excess use rejection, and adjacent-duplicate rejection.
- Fresh combined checks pass: guard 15/15, Worker/ruleset/protocol phase 1076/1076, current-tree Practice Save/Continue, current-tree Ranked lifecycle, and protected committed baseline 3/3.
- Production source `617ef19` is tagged as `online-v3-production-2026-08-28-617ef19`. Pages deployment `dcbfbc0b-bb37-494e-9054-2229fda4c6a3` and Worker version `0fef666a-eee4-43a8-b29f-f635d47fe4f1` are active; ruleset `78ae2f6f...` sampled 50/50 at 100%. D1 required no migration.

## 2026-08-24 - Ranked boundary single-flight repair verified

- Added scope: prevent duplicate/out-of-order portal checkpoint operations while preserving the first recovery diagnostic and all fail-closed server validation.
- Root cause confirmed in the existing client runtime: two same-tick `onPortalEntry()` calls can both pass before either reaches `RESOLVING_ROOM`; the Observer Bot's nested boundary helper also permits the second task. If the first task enters recovery, the late task can call `resolveCheckpoint()` from `RECONNECT_REQUIRED`, producing the secondary `RANKED_STATE_TRANSITION_INVALID` error.
- Planned narrow repair: one shared boundary-operation flight for player and Observer Bot, generation-based stale-callback invalidation, delayed synchronization UI, guarded recovery states, and bounded automatic canonical resync. Practice and Worker authority stay unchanged.
- RED coverage reproduced duplicate portal recovery, stale post-recovery callbacks, missing automatic resync, and root-diagnostic replacement before the runtime change.
- Implemented one player/bot boundary flight, 180ms delayed loading, recovery-state guards, generation invalidation, one automatic canonical resync for transient failures, and stale portal-intent cleanup. Focused runtime coverage is green at 25/25, including unchanged legacy non-boundary handling and the existing fail-closed integrity downgrade.
- The current-tree headed Ranked lifecycle passes with a deliberately delayed checkpoint and three same-frame portal attempts: exactly one request, no pre-180ms overlay, one calm loading presentation, no reconnect popup, and one next-room transition.
- The shared web-game Playwright client also reached the current build's Main Menu and produced a visually healthy HD canvas. Its static-only harness reported only the known absent music files; the authoritative Ranked headed test ran through the real local Worker proxy without browser/page errors.
- A second RED client test proved the runtime token alone was insufficient because an older `checkpoint()` could still overwrite the client's persisted snapshot after a newer `resumeCanonical()`. The Ranked client now invalidates older response generations at resync/abandon/clear, and the late checkpoint response leaves the newer canonical revision untouched.
- Final current-tree evidence: focused client/runtime/Worker regressions 90/90, delayed multi-entry Ranked lifecycle PASS, six archive screenshots visually re-approved at `sha256:24a2d81c3da05464e6d16beec74af286e655a8de730acc560d6dde36be25a485`, and full release verification 1005/1005 (`output/verification/full-20260824T105032829Z.log`). No Worker authority, reward validation, ruleset bytes/hash, D1 schema, or Practice flow was relaxed.
- Release execution follows this amended commit and is reported from the deployment receipts; no post-deployment source commit is added.

## 2026-08-24 - Early balance package and Ranked Otter repairs in progress

- Confirmed the working repository is based on production commit `0a6ddcd` and preserved all in-progress changes for one combined commit and deploy.
- Implemented the approved early-game/Camp balance package, campaign-scoped Ranked Otter pity persistence, and canonical Ranked Otter Crimson Chest flow without trusting client relic IDs.
- Focused client, campaign parity, Observer Bot, and most Worker regressions are green. The remaining Camp regressions are being resolved before ruleset regeneration, full verification, browser QA, final diff review, and release.

## 2026-08-22 - Merchant + post-room Pact implementation verified

- Observer Bot now opens the authoritative Ranked Merchant offer before evaluating skill upgrades, waits on open/commit locks, and cannot count a missing canonical choice as a purchase.
- New ruleset `sha256:76514cf9e5c89079571a5be117ce84f949d7a3f5ed441d973adc05c95c6dde3c` settles a Pact room before issuing its opaque post-room offer. The next directive is withheld until apply/replace/break/leave commits exactly once.
- The pending Pact marker is bound to run, ruleset, completed revision/depth/room/directive/nonce, post-settlement revision, and build digest. Checkpoint replay, extraction, fatal, assistance, pre-open, stale and forged commits fail closed. Authenticated abandon remains possible and clears the marker.
- Avarice cannot retroactively modify the room just completed. The final transaction receipt digest now covers the persisted next-room state, not an intermediate sentinel.
- Client resume presents a pending Pact offer before its consumed directive sentinel. Mutation locks prevent double commits; teardown clears transient locks. Pact effects hydrate once on the freshly reset next room. Native local Pact open/apply/break paths reject Ranked while Practice is unchanged.
- Every previously released ruleset hash remains registered and pinned. The prior `5c3df81...` release retains its exact boundary behavior; no historical run is silently upgraded.
- Verification is green: guard 14/14, phase 907/907, focused client 31/31, real Worker HTTP lifecycle 12/12, generator/syntax/diff checks, and independent client/server anti-cheat reviews. Six archive screenshots were re-inspected and approved at source fingerprint `sha256:8d653f88f71d35c5ca2c44a7dc5236b5e684e81b7f837b4ca621cee0e375869b`.
- Released implementation commit `50e91c9ba4686ba3933769333bb70183e8bd9cb4` from `main`. Worker version `c931c69e-2947-4b2d-9d78-2ab7964e4e42` passed 5% and 25% canaries, including a disposable start/abandon on the new hash, and is active at 100%. Immediate rollback target: `d04a8fd5-44e1-48e8-906d-736cd56cc0af`. No D1 migration was pending or applied.
- Production Pages deployment `73eaf41c.dungeon-of-one-room.pages.dev` was uploaded from the repository root with its Functions bundle and `_routes.json`. The immutable deployment and stable hostname serve build `50e91c9`, active compatible ruleset `76514cf9...`, and all four Ranked POST probes return deterministic JSON validation envelopes through the proxy.

## 2026-08-22 - Approved Merchant + post-settlement Pact implementation

- User approved a coordinated Worker + Pages release. Merchant stays a client/runtime repair; Pact receives a new versioned ruleset capability while every prior hash remains pinned and registered.
- A direct server experiment proved that applying Avarice before checkpoint changes bounded enemy gold for the just-completed room (26 without Pact vs 27 with simulated pre-checkpoint Avarice), although the fixed award stays unchanged. Therefore the earlier plan to open Pact before checkpoint was rejected.
- Selected flow: checkpoint settles the Pact room with its pre-Pact build, consumes the room, increments revision, returns an opaque revision-bound post-room Pact offer, and withholds the next directive. Apply/replace/break/leave commits the canonical transaction and then issues exactly one next directive.
- Existing old-hash runs fail closed on Pages: Observer Bot skips the dormant local Pact altar and proceeds to the portal; no local Ranked Pact mutation is enabled. New runs use the post-settlement canonical flow. Practice remains local and separate.
- Design and implementation plan are committed in `docs/plans/2026-08-22-ranked-observer-merchant-pact-design.md` and `docs/plans/2026-08-22-ranked-observer-merchant-pact.md` at commit `efea543`.
- RED evidence before production changes: the focused Merchant/Pact client suite fails 8/8 for the intended missing contracts. Server RED coverage is being added separately for ordering, old-hash compatibility, replay/stale handling, resume, and next-directive issuance.

## 2026-08-22 - Ranked Pact room / Observer Bot altar-loop diagnosis

- The production Ranked Pact integration is broken even though the canonical server Pact policy itself is healthy. Focused server/domain tests passed 14/14, including deterministic offers, depth gates, apply/replace/break/leave, rollback, Pact effects, and 128 property cases.
- Active production uses boundary settlement. On local Pact-room clear, the runtime stores `pendingRoomSummary` and returns before the legacy `openMetaOffer("pact")` branch. Portal entry then settles the room and immediately installs the next directive; neither checkpoint nor post-checkpoint continuation issues a Pact offer. Therefore the canonical Pact transaction is never presented.
- The native Ranked clear path also returns before Practice's `state.pact.awakened = true`. The altar remains dormant. However, the Observer Bot post-clear target selection checks only `state.pact && !state.pact.used`, so it repeatedly routes toward the dormant altar. `isOnPact()` requires `awakened`, so no prompt opens. Once the bot reaches it, the next fallback heads toward the portal; on the following tick Pact again wins priority, producing the observed altar/portal up-down loop.
- Existing stall recovery cannot break this loop: post-clear handling resets the stall tracker every tick, and generic A-B-A-B detection is telemetry-only. Movement is counted as progress, so force-aggro/stall thresholds never fire.
- Simply awakening the local altar would be unsafe: local `applyPactChoice()` mutates Pact IDs/effects without a canonical server transaction. Server authority must remain the only source of Ranked Pact choices.
- A second integration defect exists after any future canonical Pact commit: `syncRankedRunModifiers()` copies canonical Pact IDs but does not remove/reapply direct numeric effects (`precision`, `blood`, `chains`) or rebuild `pactBasePlayerStats`; apply/replace/break can therefore leave local combat stats divergent from the canonical build.
- Planned robust repair for the later two-fix release: while the current Pact directive is still bound, open the canonical server Pact offer on boundary room clear; keep automation blocked during open/commit; consume/disable the local altar for Ranked; reconcile local direct Pact effects from the accepted canonical projection; then allow portal settlement. Practice remains on its native altar path. Add deterministic Observer Bot coverage for clear -> offer -> opaque canonical commit -> projection/effects -> portal, delayed responses/no duplicate commits, leave/break/replace, and no post-clear oscillation.

## 2026-08-22 - Observer Bot Ranked Merchant skill-upgrade diagnosis

- Production read-only evidence confirmed the symptom: recent `observer_bot` Ranked snapshots retained empty `build.skillTiers` even after depth 20 and with enough combined run/Camp gold to afford early upgrades (one snapshot had 628 run gold plus 1079 Camp Gold).
- Root cause is a Ranked-only state-order mismatch. The bot walks onto the Merchant and calls `tryBuySkillUpgradeFromMerchant` directly, but it never calls `openMerchantMenu`. In the production Ranked bridge, only `openMerchantMenu` invokes `DungeonOnlineV3.onMerchantOpen`, which fetches and installs the canonical `currentMerchantOffer`.
- Without that offer, `onMerchantAction` cannot find a legal canonical choice, reports `That Merchant offer is not available.`, and still returns `true` as a handled asynchronous UI action. The bot misreads that truthy return as a successful purchase, increments its per-room purchase count, and eventually marks the Merchant room done without committing any transaction.
- This is separate from the bot's conservative economy reserves. Those reserves can legitimately defer a purchase, but they do not explain the production snapshots with ample funds and permanently empty skill tiers.
- Existing Worker Merchant policy and manual headed Merchant flow are valid and fail closed. The test gap is specifically Ranked Observer Bot automation: no test covers bot open -> canonical offer -> skill commit -> projection sync -> leave/checkpoint, or the asynchronous mutation lock.
- Smallest robust repair: make Ranked Observer Bot explicitly open the Merchant first and wait for the canonical offer/mutation lock before evaluating purchases. Do not synthesize choices, bypass server prices, weaken legendary requirements, or change anti-cheat validation.

## 2026-08-22 - Pages Ranked API proxy deployment recovery

- Production `RESPONSE_NOT_JSON` was reproduced at the HTTP boundary: deployment `904810b1` returned an empty `405` for every Ranked POST (`start`, `resume`, `abandon`, and `camp`) while the previous `b8084ef7` deployment returned the expected JSON error envelope.
- Root cause was the Pages upload being invoked from `cloudflare/leaderboard-v3` instead of the repository root. Static assets and `_routes.json` were uploaded, but Wrangler could not discover the root `functions/api/v3/[[path]].js` proxy or its `RANKED_V3_BACKEND` service binding. GET availability alone was therefore an insufficient post-deploy smoke.
- This created the exact UI loop from the screenshot: resync and abandon both received non-JSON; Main Menu intentionally preserved recovery; Start New Ranked first retried abandon and received the same non-JSON response.
- Re-published the unchanged, fully verified `54f3490` Pages bundle from the repository root. Corrected production deployment: `d8c1ab17.dungeon-of-one-room.pages.dev`. Wrangler explicitly reported `Compiled Worker successfully`, `Uploading Functions bundle`, and `Uploading _routes.json`.
- Post-recovery matrix passed on both the stable hostname and corrected immutable deployment: all four Ranked POST endpoints returned `application/json` with deterministic HTTP 400 validation envelopes for stateless invalid probes. The broken immutable deployment remains a useful negative control and returns empty 405 for the same requests.
- No D1 data, run, profile, ruleset, Worker version, or anti-cheat logic was changed. The active Worker remains `d04a8fd5-44e1-48e8-906d-736cd56cc0af` at 100%. Future Pages releases must run Wrangler from the repository root and smoke at least one POST endpoint for JSON, not only GET availability.

## 2026-08-22 - Ranked canonical gold modifier synchronization release

- Observer Bot reproduced `REPORTED_GOLD_DELTA_MISMATCH` because Ranked synchronized canonical mutator IDs but skipped rebuilding the numeric local `runMods` and persistent pact effects at `startRun()`. The server correctly calculated canonical rewards while the client could inherit default or Practice values and report a different gold delta.
- Ranked starts now rebuild Camp upgrades, canonical mutator effects, and the canonical pact in the same order used by server reward policy. Production Ranked also clears the Observer Bot Unlimited Gold toggle and its baselines. Returning to Practice restores locally stored mutators, clears Ranked pact state, and resets run modifiers.
- Anti-cheat remains fail-closed. No server reward validation, bounds, tolerance, capability, rank eligibility, or assistance classification was weakened. The previous `87c30...` ruleset remains registered for already-pinned runs.
- Added client/server parity coverage for three simultaneous gold mutators plus Idol of Greed, Pact of Avarice, Bounty Contract level 3, and Treasure Sense level 4. Both sides produce 11 gold for a normal skeleton, 16 for an elite skeleton, and 30 for an 8-gold chest.
- Fresh verification passed: focused release/parity checks 17/17; guard 14/14; phase 884/884; full release gate 908/908; Ranked lifecycle and Camp headed scenarios; six archive screenshots; production bundle verification; and post-deploy preload/menu smoke with no console or page errors.
- Released source commit `b2cd883a9a1d84fbbdf477e510c40b7596851ded` from `main`. Production Worker version `f48a4379-88ef-4d41-ac86-51499320030f` passed 5% and 25% read-only canaries and is active at 100%; immediate rollback target is `96a46a6a-d408-4502-99a0-6eb742c86415`. No D1 migrations were pending or applied.
- Production Pages deployment `b8084ef7.dungeon-of-one-room.pages.dev` serves build `b2cd883`. Stable and immutable availability are active/compatible on `sha256:5c3df81af373b68fce4d8fa242fb61c29b7c3d4ca78d6865d2ee51a58bbab3dd`; leaderboard reads return 200. `index.html`, `config.js`, `game.js`, and `online-v3/ranked-v3-runtime.js` match the verified local release bundle byte-for-byte on both hostnames.

## 2026-08-21 - Ranked Arena gold and elite-budget parity repair

- Observer Bot exposed `REPORTED_GOLD_DELTA_MISMATCH` / `REPORTED_GOLD_TOTAL_MISMATCH`. The server correctly applies Arena's canonical `+2` reward bonus to every enemy, while the initial local Arena wave was created through `buildRegularRoom()` with reward bonus `0`; only the later wave received `+2`.
- The Pages build now assigns the canonical `+2` only to the initial Online Ranked Arena wave. Practice retains its existing initial-wave curve and the second Arena wave keeps its existing `+2` without double counting.
- Security review found a second Arena parity edge: the initial wave could consume all four local elite slots before wave two forced another elite. Online Ranked now reserves one slot by capping the initial wave at three elites, so the room total remains within the unchanged server limit of four. Practice and other rooms remain unchanged.
- Server reward bounds, claim validation, tokens, envelopes, ruleset bytes/hash, and monotonic provisional eligibility were not relaxed. Existing affected runs remain provisional; the repair applies to new room settlements after the updated Pages bundle is loaded.
- TDD first reproduced the missing initial-wave bonus and the absent elite reservation. Focused Ranked/Observer coverage passes `53/53`; the complete phase suite passes `882/882`; test Pages output contains both scoped changes and parses successfully. Independent anti-cheat review found no P0/P1 blockers.
- The generic headed lifecycle separately exposed an existing Combat-room gold mismatch at depth 11 and timed out while its integrity notice was open. That trace is not attributed to the Arena patch and remains a separate follow-up; deterministic Arena coverage and the full phase gate pass.
- Released Pages source commit `a46b2bc` to deployment `3b363cfe.dungeon-of-one-room.pages.dev`. The immutable deployment and stable production hostname both serve build `a46b2bc`; production `config.js` and `game.js` match the verified local bundle byte-for-byte. This was a Pages-only release: Worker, D1, protocol, ruleset hash, and server anti-cheat remained unchanged.

## 2026-08-21 - Ranked Shrine summoned-wave duplicate-clear repair

- Production evidence for active run prefix `run_07096036775a4b66...` showed `rankEligibility: provisional` with first reason `local_room_completion_capability_invalid` at revision 10 immediately after a Shrine checkpoint.
- Root cause confirmed: the initial Shrine clear correctly reported the one-use local room-completion capability. A cursed Shrine could then summon another wave and set the native room back to uncleared; killing that wave emitted a second `onLocalRoomCleared` for the same canonical directive after the capability had already been consumed.
- The Pages bridge now reports local completion at most once for the current boundary-settlement room. It does not mark the room cleared while summoned enemies remain, and the reward recorder stays open so all summoned-enemy claims are included in the later portal settlement.
- The latch is enabled only for the current event-journal boundary protocol. Practice and retained eager-settlement rulesets keep their existing behavior. A validated room rebuild resets the latch; server tokens, directive/envelope checks, bounded claims, revision checks, and monotonic provisional eligibility are unchanged.
- TDD covers the duplicate Shrine clear, live-summon extraction safety, Practice behavior, same-directive canonical rebuild, idempotent source patching, and a real reward-recorder snapshot containing both the original and summoned-wave claims.
- Verification passed: focused Ranked/Observer coverage `49/49`, full phase suite `878/878`, production Pages bundle validation, syntax/diff checks, and the complete headed Ranked lifecycle (network loss, reload, multi-tab, reward boundary, and death presentation).
- Released Pages source commit `d952f5c` to deployment `a6107911.dungeon-of-one-room.pages.dev`. The immutable deployment and stable production hostname both serve build `d952f5c`; production `config.js` and `game.js` match the verified local bundle byte-for-byte.
- This was a Pages-only release. Worker, D1, protocol, ruleset bytes/hash, and server anti-cheat were unchanged. A separate pre-existing same-directive prevented-fatal-after-clear lifecycle edge remains explicitly tracked for a dedicated regression/fix; it was not introduced or hidden by this Shrine repair.

## 2026-08-21 - Ranked fatal-pending room completion capability repair

- Production screenshot: `Ranked integrity check failed` with diagnostic `local_room_completion_capability_invalid`, run prefix `run_8a6aacb73e87...`, revision `3`. The run may continue but is permanently excluded from the leaderboard, as intended by the fail-closed integrity policy.
- Root cause confirmed: Ranked `gameOver()` leaves the native phase playing while the asynchronous fatal settlement is pending. The fatal boundary capture correctly consumes the one-use room completion capability, but the Observer Bot could execute another action after the current turn released its native lock. If that action cleared the room, the bridge reported a missing capability and the server correctly downgraded the run.
- What the signal means in current code: `onRoomEntered()` creates a random, room-local completion capability and binds it to the canonical directive ID; the Pages bridge stores it privately. At local room clear, the game returns that capability to `onLocalRoomCleared()`. The exact signal is emitted when the returned capability is missing/different, the runtime context is missing, or the runtime directive ID no longer matches the current canonical directive.
- This is distinct from the earlier gold-delta mismatch and from server credential/recovery failures. The server accepted the integrity downgrade instead of trusting an unverifiable local completion, so anti-cheat remained strict.
- Repair: generated Pages gameplay now freezes player input, Observer Bot actions (including the debug merchant branch), and local room-clear reporting while `onlineV3FatalPending` is true. The freeze is released only by a validated canonical active response or an existing authoritative fatal continuation/terminal handler. Practice remains unchanged.
- Anti-cheat remains fail-closed: no server rule, token, reward envelope, rank eligibility rule, or capability validation was relaxed. The repair prevents local simulation from advancing after its capability has already been consumed.
- TDD covered the Ranked freeze, Practice control path, debug-bot bypass, idempotent build patching, and authoritative recovery reset. Final verification: focused observer suites `29/29`, fatal/integrity review suite `39/39`, phase suite `875/875`, and headed Ranked lifecycle passed.
- Released Pages source commit `2cd676f` to deployment `a1d985ba.dungeon-of-one-room.pages.dev`. Both the immutable deployment URL and the production alias reported `DUNGEON_BUILD_COMMIT = "2cd676f"` and contained the fatal-pending Observer Bot guard. This was a Pages-only release; Worker, D1, protocol, ruleset hash, and server anti-cheat were unchanged.

## 2026-08-21 - Observer Bot post-Camp assistance and emergency-extract gold repair

- Production D1 evidence showed post-Camp Observer Bot runs were starting with `assistanceClass: none`: F9 marked only the run where test controls were unlocked, while the unlocked controls persisted into later Camp-started runs.
- Fresh Ranked starts now issue canonical `mark_test_assistance(observer_bot)` after the server accepts the new run but before the first room is handed to the game. A failed mark preserves the active recovery and blocks gameplay; ordinary runs without unlocked test controls do not emit the event.
- Reproduced the Warden-room gold mismatch at its source: Ranked emergency extraction applied the local loss before capturing the room boundary, so a `67 -> 73` room gain could be reduced to `21` and reported as delta `0` while the server correctly settled the recorded enemy/elite claim.
- The Pages patch now bypasses local emergency-loss mutation only in Ranked and captures the full pre-loss wallet for server settlement. Practice keeps its existing local loss behavior.
- TDD RED observed missing post-Camp assistance, gameplay continuing after mark failure, the fresh-campaign starting-relic ordering edge, a missing public assistance projection, and the absent emergency-extraction patch. The final client confirmation requires the authenticated `acceptedEvent: mark_test_assistance` response and rejects an explicit unassisted class if one is projected.
- Focused verification passes 26/26; fresh phase verification passes 872/872. The full current-tree Ranked browser scenario, the release `lifecycle` scenario, and the Practice `save` scenario pass after recovering disk space. Independent review found no remaining P0-P2 issues.
- Codex visually inspected and approved the six required Ranked/Practice archive screenshots. The production Pages bundle contains 2,174 files and passes the production-bundle verifier.
- Released source commits `bd57c37941b8771ae11e87c4f7bd4b4a5e2c5f0f` and `d52e0b4` from `main`. Production Pages deployment `0c3f3df9.dungeon-of-one-room.pages.dev` serves build `d52e0b4`; the stable hostname serves `game.js?v=d52e0b4`, and Ranked availability is active on the unchanged `sha256:87c30...` ruleset.
- This was a Pages/runtime-only release. Worker code, D1 schema/data, canonical ruleset bytes/hash, and server anti-cheat validation were unchanged.

## 2026-08-20 - Exhausted Ranked elixir Camp recovery hotfix

- Production screenshot identifies `CAMP_ELIXIR_LOADOUT_INVALID` after an Observer Bot run bought and later consumed an elixir.
- Root cause reproduced locally: canonical reward and fatal settlement decrement the last elixir charge to `0` but retain the loadout entry, while Camp accepts only an empty loadout or exactly one known elixir with `1..5` charges.
- A direct Camp-policy reproduction with `{ elixirId: "fury_1", charges: 0 }` throws the exact production diagnostic.
- Added a Worker compatibility repair on fresh authenticated Camp open: only a singleton known elixir with `charges === 0` becomes an empty loadout before the canonical Camp offer is issued and persisted. Unknown, negative, non-integer, multiple, and positive out-of-range loadouts remain fail-closed.
- The first implementation attempt imported the concrete Camp catalog into the Worker and was rejected by the source-isolation tests. The final implementation exposes a read-only membership predicate through each registered release descriptor, preserving the Worker/ruleset boundary and every historical ruleset hash.
- TDD reproduced the production HTTP 422 before implementation. The endpoint regression now proves the known exhausted elixir opens Camp and persists `elixirs: []`, while an unknown exhausted elixir still returns `CAMP_ELIXIR_LOADOUT_INVALID`.
- Focused Camp/anti-tamper tests pass 32/32, isolation tests pass 9/9, and the complete Worker phase suite passes 863/863. Independent review found no P0-P2 correctness, anti-cheat, historical-ruleset, pending-offer, or idempotency issues.
- Released code commit `c2f90d395b97da0988a6a352cbe9365aaeab5543` from `main`.
- No D1 migration, ruleset source/hash/activation, Pages artifact, or gameplay/client change was required. Production Worker version `96a46a6a-d408-4502-99a0-6eb742c86415` is deployed at 100% in deployment `96018ab8-eea7-4de0-b1a4-f4ec47a9144b`; previous stable version `dda4c227-9ba4-461c-a475-016771500c1a` remains the rollback target.
- Candidate availability and disposable start/abandon smoke passed before traffic. Canary stages at 5% and 25% passed 30/30 public availability checks; final availability is active and compatible on unchanged ruleset `sha256:87c30b2c011b5103398f9b03f6bf018d71f2a35427c0a04ef7a31b2559a7a6d9`.

## 2026-08-20 - Ranked Camp lost-response recovery

- Reproduced `POST /api/v3/profiles/camp` returning `422 CAMP_SESSION_PENDING_TRANSACTION` when a successful Camp open response is lost and the finalized run is resynced before Camp is opened again.
- Added endpoint coverage proving a repeated Camp open returns the existing canonical offer without advancing its revision.
- Kept post-extraction Camp failures in `FINALIZED`, preserved the original diagnostic, replaced run resync with `Retry Camp`, and added the indeterminate `Synchronizing Camp…` surface.
- Released code commit `e02e410d3329527b7e72a5c4947899e6729be47f` from `main`.
- Focused TDD coverage passes 17/17; phase verification passes 863/863; local Wrangler/D1 passes 21/21; current-tree Practice `save` and Ranked `lifecycle` browser scenarios pass. Independent review found no remaining P0/P1 after preserving recovery on Main Menu and resuming Observer Bot after a successful Camp retry.
- Codex visually inspected and approved all six archive screenshots at source fingerprint `sha256:765f99803c5d4b68af3ed555492c8edc6f5685817d10bce10ed103df5ac7fd5c`.
- The monolithic `verify:full -- --force` could not complete its clean-worktree baseline step because the C: drive lacked enough space to duplicate the tracked 584 MB `art/` tree. Its preceding gates passed (863/863, Wrangler/D1 21/21, protected baseline 3/3); the same committed source separately passed the current-tree browser scenarios and visual gate.
- Production Worker version `dda4c227-9ba4-461c-a475-016771500c1a` is deployed. Production Pages deployment `86f02925.dungeon-of-one-room.pages.dev` is live; stable `index.html`, `config.js`, `game.js`, and Ranked runtime match the local release bundle byte-for-byte. Availability reports the expected active `87c30...` production ruleset.
- Removed only reproducible `output/pages-*` and local Worker/D1 test directories while recovering from `SQLITE_FULL`; the production Pages bundle was rebuilt and verified before upload.

## 2026-08-19 - Ranked recovery diagnostics and Warden warning production release

- Released source commit `b89678f0de4b77098ad4086c4b5221949a42463f`
  from `codex/ranked-boundary-checkpoints-release`, fixed by annotated tag
  `online-v3-production-2026-08-19-b89678f`.
- Production Worker version `1811ba2d-986d-4271-a577-d6b7796ad8ba` is active
  at 100% in deployment `cc4ca52e-d1ab-4366-90eb-e5992d5bc52a`.
- Production Pages deployment `fdfdb0fa-c787-4e6c-a1d6-ef64f776f267` serves
  source `b89678f` on `main`.
- No canonical ruleset bytes changed. Production remains activated on
  `sha256:87c30b2c011b5103398f9b03f6bf018d71f2a35427c0a04ef7a31b2559a7a6d9`,
  with previous hashes retained for existing runs.
- Fresh `npm run verify:full -- --force` passed 879/879. Codex visually
  approved all six archive screenshots at fingerprint
  `sha256:466f3515e0d44adc8d45f5f29da0e5df89cb1a79d489893668e24464d983938c`.
- Post-deploy checks matched stable production `index.html`, `config.js`,
  `game.js`, and Ranked runtime byte-for-byte with the local release bundle;
  availability reports the expected active production ruleset.

## 2026-08-19 - Ranked Warden portal forewarning repair

- Restored the pre-Warden visual warning from the canonical five-depth
  schedule, so cleared Ranked depths 4, 9, 14, and later predecessors render
  the crimson Warden portal without requiring an early next-room directive.
- Checkpoint timing remains unchanged: the room journal stays open after
  clear, late chest interaction remains available, and the request occurs only
  on portal entry.
- TDD RED reproduced the missing warning in two assertions; GREEN passes
  17/17. Focused renderer/boundary coverage passes 40/40, Ranked lifecycle
  headed passes, and `ranked-warden-warning-before-entry.png` was visually
  inspected with the red portal visible on depth 4 before checkpoint.
- Protected `game.js`, Ranked runtime, build injection, Worker, protocol,
  ruleset, and D1 are unchanged. Commit, push, and deployment are not part of
  this local implementation.

## 2026-08-19 - Ranked checkpoint recovery diagnostics repair

- Reproduced the production `401 checkpoint -> canonical resync -> 422 normal
  extraction` chain. The reconnect hotfix preserved extraction intent but did
  not distinguish a committed checkpoint with a lost response from an expired
  or rejected checkpoint that resynced to the same room.
- Normal extraction intent now records its source directive, revision, and
  accepted-room count. Canonical resync continues extraction only after the
  server proves the checkpoint advanced; a same-room resync clears the local
  intent and restarts that uncommitted room without submitting extraction.
- Added a bounded, token-free browser diagnostic ring (20 entries), visible
  error identifiers, `DungeonOnlineV3.getDiagnostics()`, and
  `DungeonOnlineV3.clearDiagnostics()`. Provisional public projections now
  include bounded reason codes and the first detected revision.
- Production Worker diagnostics emit one structured log when a run first
  becomes provisional. No request payload, checkpoint token, recovery
  credential, combat state, or local save is logged.
- TDD RED/GREEN covers same-room recovery cancellation, committed-checkpoint
  continuation, diagnostic redaction, provisional projection, strict protocol
  validation, and structured Worker diagnostic emission. No `game.js`, D1,
  ruleset, ruleset hash, combat, movement, AI, renderer, or checkpoint timing
  change was made.

## 2026-08-18 - Ranked boundary checkpoints

- Moved capable Ranked room settlement from enemy clear to portal,
  normal extraction, emergency extraction, or fatal boundaries while keeping
  historical ruleset contracts unchanged.
- Added durable fatal/emergency claim settlement, idempotent retry coverage,
  provisional fallback for impossible boundary claims, and a late-chest headed
  regression. The production release descriptor activates the new capability
  while retaining the prior checkpoint-integrity runtime for pinned runs.
- Activated ruleset hash: sha256:87c30b2c011b5103398f9b03f6bf018d71f2a35427c0a04ef7a31b2559a7a6d9.
  Retained previous hash: sha256:0672eb9aaae11865ebae75a4c6d6dc77cc29f4a079afe562355172d26f073bca.

## 2026-08-18 - Ranked extraction reconnect hotfix

- Production evidence showed the room checkpoint committed successfully, but
  the follow-up normal extraction did not reach canonical storage after the
  client entered reconnect recovery.
- Added runtime regressions for preserving an in-flight normal extraction
  across a reconnect/Main Menu/Continue round trip and for repeated Main Menu
  activation after the local session is already abandoned.
- TDD RED reproduced both failures; the minimal runtime change keeps the
  in-memory extraction intent until canonical resync and makes the abandoned
  Main Menu path idempotent. Focused runtime tests pass 9/9.
- Current-tree Ranked Recovery and Camp headed scenarios pass. Their recovery,
  Camp, and error-to-Main-Menu screenshots were visually inspected with no
  visible regression.
- Worker, protocol, ruleset, D1, combat, and protected `game.js` remain
  unchanged. Commit `80014dc` passed the full 877/877 release gate and is live
  in production Pages deployment `97a82dee-c155-4169-ac52-f0bf3c2f0e0d`.
  Stable and versioned asset, API, leaderboard, and Chromium boot smoke pass.

## 2026-08-01 - Online Ranked boundary state and test controls repair

- Completed the separate Online-only repair for fresh-campaign reset
  semantics, canonical Camp mutators, canonical elixir charges, test music,
  and password-gated deployed Observer Bot.
- New campaigns reset highscore/depth and chest active effects through
  resetMetaProgressForFreshStart(); Extract -> Camp -> Start Next Run keeps
  campaign state intact.
- Canonical elixir accounting preserves 3/5 -> 2/5 after one use and a
  nonterminal death; retries are idempotent. Camp mutators are server-issued
  and projected into the profile/next run.
- Candidate ruleset hash: sha256:2ac2eb5499892cc49258c5b674beab846cb41906a5ef86a658d5e90325505a0d.
  Retained production hash: sha256:d784208aad891119b71c52324cea358997ee376313914d5799affa68c8678ff3.
  Candidate remains local/test-only; no ruleset activation, push, D1 migration,
  or backfill. Production Worker version 18cd3024-9ebf-44bf-9b4d-160f45e396bf
  is active at 100%; Pages deployment 0bc8fdd5 is live and both URLs served
  HTTP 200 availability with productionActivated=true and bot gate enabled.
- Verification: focused 20/20; verify:fast 51/51; verify:phase 762/762;
  verify:baseline 3/3 plus headed smoke; verify:full 786/786 including
  Wrangler/D1 21/21; headed Ranked lifecycle PASS; Pages build 3109 files.

Original prompt: Create a hard-forked Dungeon 1.0 in a new folder, keep the original game untouched, and push the fork toward a major 1.0 redesign while staying compatible with the current save and leaderboard protocol.

## 2026-07-30 - R2 leaderboard lifecycle defect reproduced

- Confirmed that extraction finalization always emits
  `insert_leaderboard`, although extraction is only the boundary required to
  persist a descent and enter native Camp.
- Confirmed that the local `profileId` currently survives completed and
  abandoned games, while D1 enforces uniqueness only by `run_id`.
- Therefore every extracted descent can publish a separate row and a browser
  profile can span multiple five-life games.
- Repair scope is now terminal-only publication, one ID per full campaign,
  a season/profile uniqueness invariant, and deterministic cleanup of
  historical duplicate rows. No source, production, or protected Vault
  Guardian state has been changed.

2026-07-29 - Online v3 R2 Ranked gameplay continuity and gold parity complete
- Internal commits: `b10c523` and `ab46761`.
- Fixed v0.8 room/enemy/elite/hazard/chest gold parity, legacy Camp upgrades,
  one-per-campaign starting relic, fifth-life final defeat, and post-Ranked
  Practice isolation.
- Focused regressions 21/21, threat matrix 30/30, verify:fast 48/48,
  verify:phase 728/728, verify:baseline 3/3 plus headed, and verify:full
  752/752 all pass.
- Production Worker `c7b6cdc1-c0df-4eee-bdf7-d2a0f8682900` and Pages
  deployment `d0e49664-29c7-47f0-80b1-a161d2630a09` are active on the
  existing project.
- Ruleset hash changed from
  `sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6`
  to `sha256:bfc32eb2fa252d6543e1c042cb6e45e828a8bf6237b0c30d0b9e2e0a13b99950`;
  the previous production hash remains resolvable.
- Public assets match the verified bundle byte-for-byte. Production
  start/abandon smoke completed at revision 1 with zero leaderboard writes.
- Source `game.js` and all 172 protected Vault Guardian deletions remain
  untouched; no push, M5, D1 schema migration, or combat-authority change.

2026-03-05
- Fork created in `dungeon-1.0/` with copied client files and assets.
- Rebranded fork to `v1.0.0-alpha` and added `window.DUNGEON_FORK_ID = "dungeon-1.0"`.
- Added campaign regions (`Descent`, `Corruption`, `Rupture`, `Collapse`, `Endgame`) to room intro and depth badge.
- Region configs now affect room odds, room pressure caps, boss add count, and milestone announcements.
- Added new pure module `build-identity.js`.
- Added test file `tests/build-identity.test.js` and verified it with `node tests/build-identity.test.js`.
- Build identity now appears in HUD as `Build`.
- Relic drafts in fork are now lightly biased toward current run archetype instead of pure random candidate selection.
- Relic draft UI now shows `ON BUILD` / `FLEX` badges and `Current Build` subtitle detail.
- Added new pure module `merchant-curation.js`.
- Added test file `tests/merchant-curation.test.js` and verified it with `node tests/merchant-curation.test.js`.
- Merchant relic offer in the fork is now curated toward the current build instead of being purely random within rarity tier.
- Merchant relic row now displays `ON BUILD` / `FLEX` when the offer is aligned with the current run archetype.
- Added `tests/smoke-actions.json` for minimal browser smoke verification.
- Verified fork boot/render with Playwright smoke run; latest canvas screenshot: `output/web-game/shot-0.png`.
- Added new pure module `boss-campaign.js`.
- Added test file `tests/boss-campaign.test.js` and verified it with `node tests/boss-campaign.test.js`.
- Warden now uses region-based boss profiles in the fork:
  - custom boss names per campaign region,
  - custom HP/ATK multipliers,
  - custom pulse/burst pacing,
  - custom anti-kite smartness,
  - Void Aegis unlocked only in later campaign regions through the profile system.
- Boss intro text and room intro splash now identify the current Warden form instead of generic boss text.
- Verified fork render after boss pass with Playwright smoke run; latest canvas screenshot: `output/web-game-bosspass/shot-0.png`.

Next good targets
- New room ecosystem pass: add 1 new strategic room type instead of adding filler content.
- Merchant follow-up: reserved relics could become region/build-aware too, not only the live slot.
- Boss follow-up: final depth 100 Warden can now get a unique one-off phase or event without touching earlier profiles.

2026-03-06
- Added `Forge` as the first 1.0-exclusive strategic room type.
- Added pure module `forge-room.js`.
- Added test file `tests/forge-room.test.js` and verified it with `node tests/forge-room.test.js`.
- Forge room behavior:
  - no combat,
  - immediately safe/cleared,
  - one forge interactable on the board,
  - pressing `E` on the forge opens a premium relic draft.
- Forge draft is build-aware and depth-aware:
  - early: rare/epic,
  - mid: rare/epic/legendary,
  - late: epic/legendary/mythic tail.
- Forge uses the existing relic draft/swap pipeline, so all cap logic and swap handling stay shared.
- Added forge persistence to run snapshot save/load.
- Added forge draw pass with warm fallback visuals.
- Taught the bot to route to forge after room clear before leaving through portal.
- Verified unit tests:
  - `node tests/forge-room.test.js`
  - `node tests/build-identity.test.js`
  - `node tests/merchant-curation.test.js`
  - `node tests/boss-campaign.test.js`
- Verified syntax:
  - `node --check forge-room.js`
  - `node --check game.js`
- Verified fork render with Playwright smoke run; current screenshot:
  - `output/web-game-forge-smoke/shot-2.png`

Updated next good targets
- Forge follow-up: add a true transmute/refine branch later instead of draft-only interaction.
- Merchant follow-up: make reserved relic logic region-aware and build-aware.
- Final boss follow-up: give depth 100 Warden a unique event/phase and payoff screen.

- Added `Run Climax` package foundations:
  - Forge 2.0 shell: forge now has `Refine` and `Transmute` entry flow instead of draft-only open.
  - Transmute path now exists end-to-end:
    - choose sacrifice relic,
    - receive curated 3-choice replacement draft,
    - selected relic replaces the sacrificed relic directly.
  - Added new pure module `pact-room.js`.
  - Added test file `tests/pact-room.test.js` and verified it with `node tests/pact-room.test.js`.
  - Added new strategic room type `Pact`:
    - safe room,
    - one sigil interactable,
    - pre-rolled pact offers saved into room state.
  - Added first pact set with persistent current-game effects:
    - Hunger,
    - Precision,
    - Velocity,
    - Avarice,
    - Iron,
    - Fury.
  - Pact effects are now integrated into runtime in the fork:
    - damage dealt,
    - potion healing,
    - merchant prices,
    - damage taken,
    - cooldown pacing,
    - fury behavior,
    - persistent stat-altering pacts reapplied on next run within the same game.
  - Depth 100 boss now uses a unique 2-phase final boss flow in the fork:
    - phase 1 defeat no longer ends the campaign,
    - room immediately shifts into phase 2,
    - only phase 2 death triggers final victory.
  - Final chamber branding added:
    - depth 100 boss intro now identifies the room as `Final Chamber`,
    - victory overlay now uses `FINAL VICTORY`.
  - Bot safety pass:
    - bot can resolve forge mode selection,
    - bot can resolve pact selection,
    - bot routes to pact room interactable after room clear.
  - Verified tests:
    - `node tests/forge-room.test.js`
    - `node tests/pact-room.test.js`
    - `node tests/boss-campaign.test.js`
  - Verified syntax:
    - `node --check game.js`
    - `node --check pact-room.js`
  - Verified fork boot/render with Playwright smoke run:
    - `output/web-game-run-climax-smoke/shot-2.png`
- Added scenario override module `scenario-overrides.js` for deterministic fork-only browser tests.
- Added URL scenarios:
  - `?scenario=forge`
  - `?scenario=forge_transmute`
  - `?scenario=pact`
  - `?scenario=final_chamber_transition`
- Added test file `tests/scenario-overrides.test.js` and verified it with `node tests/scenario-overrides.test.js`.
- Added fork-only bootstrap flow so scenarios auto-start directly into controlled states without touching the original game.
- Added deterministic scenario placement/setup:
  - forge/pact interactable spawns adjacent to player,
  - final chamber transition spawns a 1 HP phase-1 Warden next to player,
  - forge transmute scenario injects 1 sacrificial relic and opens transmute selection immediately.
- Added test hooks to the fork runtime:
  - `window.render_game_to_text`
  - `window.advanceTime(ms)`
- Added better keyboard fallback UX in the fork:
  - `Enter` confirms default Forge Refine,
  - `Enter` confirms default Pact pick,
  - `Enter` confirms first Forge Transmute sacrifice,
  - `A/B` work as Forge `Refine/Transmute` shortcuts.
- Verified browser scenarios with Playwright client and deterministic state output:
  - Forge Refine -> `output/scenario-forge-refine/state-0.json`
  - Forge Transmute -> `output/scenario-forge-transmute/state-0.json`
  - Pact pick -> `output/scenario-pact-pick/state-0.json`
  - Final Chamber phase shift -> `output/scenario-final-phase/state-0.json`
- Verified visuals via latest screenshots:
  - `output/scenario-pact-pick/shot-0.png`
  - `output/scenario-final-phase/shot-0.png`
- Original root game still untouched; all changes remain inside `dungeon-1.0/`.
- Fixed confirmed 1.0 fork bug: pact stat effects no longer reapply cumulatively when taking a second/third pact in the same current game.
  - Added `pact-effects.js`.
  - Added test `tests/pact-effects.test.js`.
  - `applyPactChoice()` now applies only the newly chosen pact effect.
  - `applyPersistentPactsToRun()` now remains the full reapply path for fresh run starts only.
- Fixed confirmed 1.0 fork bug: final boss phase shift now triggers immediately on phase-1 Warden kill instead of waiting for the room to become empty.
  - Added `final-boss-flow.js`.
  - Added test `tests/final-boss-flow.test.js`.
  - `killEnemy()` now checks final-boss phase-shift condition directly on Warden death.
- Verified fixes:
  - `node tests/pact-effects.test.js`
  - `node tests/final-boss-flow.test.js`
  - `node --check pact-effects.js`
  - `node --check final-boss-flow.js`
  - `node --check game.js`
  - browser scenario re-check: `output/scenario-final-phase-fix/state-0.json`

2026-03-06: Rolled back build-aware loot bias from relic draft, merchant, and forge. Removed Build row and build recommendation badges/subtitles from runtime UI. Kept build-identity module loaded only as dormant foundation.

2026-03-06: Reworked Pact Room toward v2. Pact room now unlocks at depth 25+, uses rare elite-gauntlet encounter data, awakens sigil only after room clear, and UI now offers 2 pacts plus Leave/Break. Added pact base-stat snapshot handling for single active pact and free break flow. Verified with node tests and browser smoke in output\\scenario-pact-v2.

- 2026-03-06: Forge Room v2 implemented: Blacksmith Guardian encounter, awakened forge flow, Temper single-relic gamble, Transmute preserved, forge room hazards set to 4-6 spikes and 2-3 mines.

- 2026-03-07: Forge setpiece layout added: 3x3 forge in top-middle, blocked forge tiles, interaction tile under forge, fixed forge/player/guardian spawns, forge and blacksmith sprite hooks wired in.

2026-07-12 — Graphics overhaul Task 1 checkpoint
- Corrected `tests/scenario-overrides.test.js` to load this `dungeon-2.0` worktree; the pre-freeze suite passed 17/17.
- Full command: `$tests = Get-ChildItem -LiteralPath tests -Filter '*.test.js' | ForEach-Object FullName; node --test $tests` — PASS, 18 tests, 0 failures.
- Audio freeze: `node --test tests/audio-freeze.test.js` — PASS, 1 test, 0 failures; exactly 13 active files plus protected `game.js` paths, volumes, loop behavior, and selection logic are hashed.
- Stored seven approved audit PNGs under `tests/fixtures/visual-baseline/`; desktop viewport metadata remains explicitly unknown, while mobile is recorded as 390×844.

2026-07-12 — Graphics overhaul Task 2 TDD evidence
- Original RED: `node --test tests/visual-snapshot.test.js` failed with `MODULE_NOT_FOUND` for the not-yet-created `render/visual-snapshot.js` (0 passed, 1 failed test file).
- Presentation-data RED is preserved in commit `6b8aac1624769372235f17f28524f87bf0a033bd`: the same command ran 9 tests with 5 passed and 4 failed. The failures were missing derived portal kind, missing enemy freeze status, missing derived player presentation status, and included forge simulation coordinates.

2026-07-12 — Graphics overhaul Task 3 TDD evidence
- Tests-only RED is preserved in commit `f9e69dbcf4489667aedb4546fb2816b06f93f461`: `node --test tests/hd-asset-loader.test.js` failed with `MODULE_NOT_FOUND` for the not-yet-created `render/hd-asset-manifest.js` (0 passed, 1 failed test file).
- The manifest/loader contract now covers semantic lookup, group preload, monotonic progress, critical fallback, deterministic failures, decode/onload/error/timeout paths, UMD order, and isolation from shared state.
- Targeted GREEN: `node --test tests/hd-asset-loader.test.js` passed 13/13 tests with 0 failures.
- HD preload remains inactive; `game.js` and every audio file/contract remain outside this task.

2026-07-12 — Graphics overhaul Task 3 quality-review hardening
- Tests-only RED is preserved in commit `e1a3298bf2cb94c276b0dbb8bc8f3cc40e6a785f`: 13 existing loader tests passed and 5 adversarial tests failed on descriptor TOCTOU/accessor rereads, cleanup exceptions, and falsy dependency fallback.
- Descriptor properties are now read exactly once into frozen plain snapshots before validation, progress, selection, or image loading.
- Timer and image-handler cleanup is best-effort; injected cleanup exceptions cannot strand settlement or reject the internal decode chain.
- Explicit falsy dependency options are rejected with `TypeError`; only `undefined` selects browser/runtime defaults.
- Targeted GREEN: `node --test tests/hd-asset-loader.test.js` passed 18/18 tests with 0 failures.

2026-07-12 — Graphics overhaul Task 3 sparse-manifest hardening
- Tests-only RED is preserved in commit `e812367633bb2e94edb8e233eefdd87e3b961bd8`: 19 existing tests passed and 3 sparse-manifest tests failed; deletion during snapshot leaked an internal `undefined.ok` TypeError.
- Snapshot and validation now inspect every numeric index explicitly and reject a missing/deleted own entry with its manifest index before reading descriptor properties.
- Dense empty manifests remain valid and complete immediately; normal dense manifests retain existing behavior.
- Targeted GREEN: `node --test tests/hd-asset-loader.test.js` passed 22/22 tests with 0 failures.

2026-07-12 - Graphics overhaul Task 4 TDD and verification
- Tests-only RED is preserved in commit `bb03a02f4421059dbd06aa051294c369c17a1a60`: `node --test tests/hd-renderer.test.js` ran 14 top-level tests and failed all 14 because the renderer modules, default flag, and game boundary did not yet exist.
- Added the opt-in 64 px renderer shell, exact nine-layer ordering, checked grid helpers, bottom-center actor anchoring, and a race-safe graphics controller with legacy fallback. The default flag remains `false` and the live game stays on its existing 144x144 legacy renderer.
- Independent review found and regression-tested controller and emergency-fallback edge cases: every intrinsic canvas resize now reapplies nearest-neighbor smoothing, all game-level fallback branches synchronize legacy markers, and a nominally ready loader result cannot activate HD unless every critical manifest key is present.
- Targeted renderer/loader/snapshot suite passed 55/55 tests; the full explicit suite passed 77/77 tests; the audio freeze passed 5/5 tests. Final independent review reported no remaining Critical or Important findings.
- Browser smoke at the default flag produced no console/page errors. Visually inspected the legacy boot canvas and deterministic Forge gameplay screenshots under `output/task4-default-legacy-*`.

2026-07-12 - Graphics overhaul Task 4 loader-result hardening
- Tests-only RED is preserved in commit `bb1013bd9bc974e6f0adc9974456f1d43f707a06`: the renderer suite ran 27 tests with 20 passing and 7 failing on shared loader Maps/results, missing or malformed `failures`, critical failures hidden behind ready flags, and unsnapshotted failure results.
- Controller initialization now snapshots loader flags, loaded assets, and dense failure records before validation. Missing/malformed failure data falls back diagnostically; any critical failure blocks HD; valid optional failures and real Task 3 loader results remain compatible.
- Targeted renderer/loader/snapshot suite passed 63/63 tests; full explicit suite passed 85/85 tests; audio freeze passed 5/5 tests.
- Default-disabled Forge browser smoke produced valid state, no console/page errors, and an inspected legacy 144x144 pixel-art frame under `output/task4-result-validation-smoke`.

2026-07-12 - Graphics overhaul Task 4 reentrancy hardening
- Tests-only RED is preserved in commit `c811ca2593a526681fcf022f42f17dd892fab72d`: the renderer suite ran 31 tests with 28 passing and 3 failing when `ready`, `failures`, or the loaded Map iterator synchronously selected newer legacy mode during result snapshotting.
- The controller now re-checks its generation immediately after the complete loader-result snapshot and before validation, asset selection, canvas activation, or success outcome publication. Reentrant throw/malformed paths remain stale and diagnostic-free through the existing guarded failure boundary.
- Targeted renderer/loader/snapshot suite passed 67/67 tests; full explicit suite passed 89/89 tests; audio freeze passed 5/5 tests.
- Default-disabled Forge browser smoke produced valid state, no console/page errors, and an inspected legacy frame under `output/task4-reentrancy-smoke`.

2026-07-12 - Graphics overhaul Task 4 pending-record and critical-value hardening
- Tests-only RED is preserved in commit `6a58c8f8b69b8be5f3c89a2634d9dda6b1d27867`: the renderer suite ran 39 tests with 34 passing and 5 failing on invalid critical values plus same-mode manifest/loader reentry, real-loader `onProgress` legacy reentry, and stale cleanup overwriting newer pending work. It also characterizes recovery after an initialize-time canvas exception.
- HD initialization now registers an identity-checked deferred pending record before canvas, manifest, or loader boundaries. Same-mode reentry shares its exact Promise; legacy invalidation stays synchronous; stale settlement cannot clear a newer record; a synchronous canvas failure rejects and clears its own record before rethrowing.
- Critical loaded keys must map to a non-null, non-array object or function. Fake callable assets and real Task 3 image objects remain valid, while nullish, array, and primitive values fall back diagnostically.
- Targeted renderer/loader/snapshot suite passed 75/75 tests; full explicit suite passed 97/97 tests; audio freeze passed 5/5 tests. Final independent review reported no Critical, Important, or Minor findings.
- Default-disabled Forge browser smoke produced valid state, no console/page errors, and an inspected legacy frame under `output/task4-pending-final-smoke`.

2026-07-12 - Graphics overhaul Task 4 publication-boundary hardening
- Tests-only RED is preserved in commit `1dff368b2b3e63fafd7811e9564d69628fecc316`: the renderer suite covers reentry from width and smoothing setters, success and failure publication, diagnostic callbacks, interrupted stale applies, same-cause fallback recursion, and retry after a fallback presentation exception.
- Mode presentation writes are serialized and reconciled to the authoritative mode after synchronous reentry. Initialization settlement checks both generation and pending-record identity after each injected apply/diagnostic boundary, so obsolete work can resolve only as stale and cannot replace assets, outcomes, diagnostics, or pending state.
- Interrupted stale applies perform best-effort presentation reconciliation before preserving the original exception. Same-cause fallback callback reentry shares the exact reserved outcome; a failed apply clears only its own reservation so retry can finish presentation and publish one diagnostic.
- Targeted renderer/loader/snapshot suite passed 82/82 tests; full suite passed 104/104 tests; audio freeze passed 5/5 tests; renderer syntax and `git diff --check` passed. Final independent review reported no Critical, Important, or Minor findings.
- Default-disabled Forge browser smoke produced valid playing/Forge state, no console/page errors, and an inspected legacy pixel-art frame under `output/task4-publication-final-smoke`.

2026-07-12 - Graphics overhaul Task 5 Phase A RED handoff
- Added `tests/hd-environment.test.js` first. It specifies 28 final Descent/common PNGs, exact semantic manifest mappings, safe unique `assets/hd/` paths, 64 px tile multiples, PNG signature/IHDR dimensions, RGBA requirements for overlays/objects/hazards, and critical classification limited to floor/wall/corner room-base assets.
- Baseline before the new test: `node --test tests/hd-asset-loader.test.js tests/hd-renderer.test.js` passed 68/68 tests.
- Expected RED: `node --test tests/hd-environment.test.js` ran 3 tests with 1 pass and 2 failures. Manifest coverage failed on the old floor path plus 27 absent final keys; PNG completeness failed because all 28 final files are absent. The unique/safe manifest-path test passed.
- Added `art/briefs/abyssal-gothic-hd.md` with the exact 1024x1024 flat-`#ff00ff` source-atlas contract, strict 4x4/256 px slot coordinates, approved Descent material/light direction, crop/alpha normalization rules, and the final manifest/file table.
- No bitmap art, placeholder PNG, manifest expansion, layer implementation, production drawing, or audio change was made in Phase A.
- TODO for the coordinator: use built-in ImageGen with the brief's exact sixteen-slot prompt constraints, save the untouched chroma source atlas at `art/source/abyssal-gothic-hd/descent-environment-source-1024.png`, then return for Phase B crop/normalization, manifest integration, and renderer-layer work.

2026-07-12 - Graphics overhaul Task 5 GREEN implementation
- Preserved the root-supplied built-in ImageGen output unchanged as `art/source/abyssal-gothic-hd/descent-environment-source-original-1254.png`: 1254x1254 RGB, SHA-256 `95d42f7402d5e8be87d9739069b090fd6c9f3269a6e0adb3e28565da065883d2`. The reproducible Pillow builder creates the exact 1024x1024 working atlas without invoking any generation CLI/API.
- `scripts/build-descent-environment-assets.py` crops all sixteen exact 256 px slots before key removal, invokes the installed ImageGen `remove_chroma_key.py` helper per slot with border auto-key, soft matte, thresholds, and despill, preserves intended shrine/portal magic, normalizes 28 production PNGs, validates alpha/chroma/components, and removes ignored `art/work/` intermediates.
- Crop QA found and removed disconnected neighboring fragments from corner and portal subslots. The build now rejects a large secondary alpha component. Two fresh complete rebuilds produced identical hashes for all 28 final assets plus the normalized atlas: aggregate SHA-256 `BDB81338F9D5CFE51F7007111CD70AA4BF24B60DF9DC69AACC57636BD5C423AB`, 0 differences.
- The active manifest now preloads exactly 28 shipping Descent/common assets. Floor, four walls, and four corners are the only critical entries. Future representative semantic keys live in optional `stagedEntries`, remain discoverable through `getByKey()`, and produce no preload 404s.
- HD layers draw the 9x9 floor and explicit borders, deterministic depth/x/y decorations without `Math.random`, snapshot hazards/objects, animated torch/portal frames from `nowMs`, and bottom-center 128 px shrine/portal assets. Missing optional images are skipped. Temporary code-native player/enemy silhouettes keep the slice readable until Tasks 6/7; no placeholder actor images were added.
- Added deterministic `?scenario=descent_hd` to arrange chest, torch, spikes, mine, shrine, active portal, and player without gameplay RNG. The default HD flag remains false.
- Browser QA used the installed web-game client loop and a test-only viewport copy of that same client against a response-only HD override. Inspected `output/task5-descent-hd/desktop-1440x1000.png`, `mobile-390x844.png`, both 576 px canvas captures, state JSON, and `assets-preview-final.png`. Desktop preserves the playfield and HUD; mobile keeps the full board, skills, controls, and Menu visible without horizontal overflow.
- A reported black/missing-floor frame was traced to `view_image(detail=original)`, not the PNG or renderer: the screenshot contained 331,776/331,776 opaque pixels and normal tile RGB throughout, and `detail=high` displayed the complete board. A separate custom Playwright context timed out all 28 `Image.decode()` calls (empty loaded Map); the unmodified installed client on the same probed server activated HD. Reusing the exact installed client architecture resolved viewport capture without production changes.
- Default legacy smoke remained a 144x144 canvas with valid `descent_hd` state and no console/page errors; inspected `output/task5-descent-hd/legacy-default/shot-0.png`.
- Spec review caught that ordinary runtime portals omit `active` and must still respect the legacy `roomCleared` reveal gate. A snapshot-boundary RED case now proves uncleared portals stay hidden and cleared portals animate; an explicitly inactive revealed portal still uses its inactive frame.
- A browser-only critical-failure probe forced only `environment.descent.floor.base` to 404. The installed game-playtest client loaded the other 27 assets, recorded one critical decode failure plus the fallback warning, selected the intact 144x144 legacy canvas, and preserved valid playable `descent_hd` state. Evidence: `output/task5-descent-hd/fallback-critical-installed/state-0.json` and inspected `shot-0.png`. The probe changed no production behavior.
- Independent spec and code-quality re-reviews approved the final slice with no remaining findings. Quality review also tightened the manifest test to compare the exact active preload key set and descriptors directly, preventing active/staged substitutions from passing.
- Fresh verification: targeted environment/renderer/loader/snapshot suite 93/93 PASS; full explicit suite 115/115 PASS; audio freeze 5/5 PASS; JS/Python syntax and `git diff --check` PASS.
- Honest visual limits: the single 64 px floor base remains visibly periodic over a 9x9 room, the dark crack decal is deliberately subtle, and diagnostic actor rectangles are temporary. Player/enemy production art, lighting, telegraphs, and combat VFX remain later tasks.

2026-07-12 - Graphics overhaul Task 5 strict chroma correction
- Tests-only RED is preserved in commit `560cc24255121884d67db731ebd82f64bad960ce`. Exact nontransparent `#ff00ff` remained in nine finals: crack 2/max alpha 1, rubble 1/1, stain 03 2/1, shrines 55/13 and 72/33, and portals 25-39/max alpha 5-13. The strict near-key fringe metric (alpha 1-128, RGB Euclidean distance <=48, strong balanced red/blue dominance) found the same nine assets and portal halo alpha up to 105; the executable builder-policy test also failed because the strict validator did not exist.
- Root cause was the combination of low-alpha keyed RGB surviving helper output/restoration, Lanczos normalization resampling that edge data, and a final validator that ignored alpha <=16 or <=128 for magic assets. The builder still uses the installed helper with border sampling, soft matte, thresholds, and despill; shrine/portal slots additionally use the helper's one-pixel edge contract. A deterministic post-key cleanup removes only exact key pixels or low/semitransparent pixels matching the strict near-key metric, both before normalization and at final RGBA write time. Final build validation invokes the identical policy with no chroma alpha exception.
- An initial all-slot edge contract was correctly rejected by the alpha-coverage regression test because it halved the thin crack's visible pixels. Limiting contraction to shrine/portal slots restored the crack while universal metric-targeted cleanup removed the remaining resize fringe.
- All 27 alpha finals now contain 0 exact-key and 0 strict near-key pixels. Transparent corners and >=15% alpha coverage remain enforced. Magic survived quantitatively: every shrine/portal retains at least 339 qualifying non-key violet pixels and 4,115 substantial-alpha unique colors; the set retains 1,354 qualifying turquoise pixels.
- Two fresh complete builds were byte-identical across the 28 final assets plus normalized atlas: aggregate SHA-256 `C080A6A33E974B448A4346E0C30F8BCFA0EABA9E12B82D0098500DB944065F20`, 0 differences. The untouched 1254 source remains SHA-256 `95d42f7402d5e8be87d9739069b090fd6c9f3269a6e0adb3e28565da065883d2`; the normalized atlas contract is unchanged.
- Inspected checkerboard contact sheet `output/task5-descent-hd/assets-preview-chroma-fixed.png`, HD desktop/mobile pages under `chroma-fixed-desktop` and `chroma-fixed-mobile`, default legacy under `chroma-fixed-legacy`, and the settled forced-critical fallback under `chroma-fixed-fallback-settled2`. No magenta fringe or eroded silhouettes are visible; portals/shrines retain saturated violet/turquoise magic. HD loaded all 28 assets at 576x576 with no warning, default legacy remained intact, and the forced floor 404 loaded the other 27 assets, warned, selected legacy 144x144, and kept valid playable state.
- Fresh verification: targeted environment/renderer/loader/snapshot suite 97/97 PASS; full explicit suite 119/119 PASS; audio freeze 5/5 PASS; JS/Python syntax and `git diff --check` PASS. No MP3 or legacy-renderer file changed.

2026-07-12 - Graphics overhaul Task 5 atomic/reproducible build hardening
- Tests-only RED is preserved in commit `58f0a548ea9529c19bac18bc0d573b80c6a8849b`. The expected failures proved the absence of a pinned dependency/lock, `--check`, pure rollback transaction, helper diagnostics wrapper, fixed scenario matrix, and pre-RNG scenario selector. Manifest assertions were changed from exact current-catalog equality to required Descent subset correctness so later art tasks may add active entries.
- The builder now writes the normalized atlas, intermediates, and all 28 finals only under same-filesystem `art/work/descent-environment/`, validates the complete staged set, verifies its lock, then atomically replaces the 29 published targets. Pre-copied backups restore every already-replaced target on failure and newly created targets are removed; the transaction/work tree is deleted in `finally` on success or any helper/save/validation/publish exception.
- An independently executable pure transaction test injects failure on replacement 28 of 29. It proves every prior target byte is restored, a new target is removed, the original error propagates, and the transaction tree is absent. Helper `CalledProcessError` is wrapped with slot/input path, helper path, return code, stdout, and stderr.
- `requirements-hd-assets.txt` pins `Pillow==12.1.1`. The builder rejects any other Pillow version and verifies the installed helper SHA-256 `7e51236919203b61d07ddffdc6e0b5f501a28661003f5851f26ffbb64bdec1ea` before execution. `descent-environment-assets.lock.json` (SHA-256 `a5f280b0b012ec0c0889ca3a0048aed922ddf3059588a06df86463875f848423`) pins pipeline schema 2, tool versions/hashes, source, normalized atlas, and all 28 final hashes.
- Normal builds compare staged output to the committed lock before publishing. `--check` performs a complete isolated non-publishing rebuild; `--update-lock` is the only explicit lock-revision path and publishes the staged atlas/assets/lock in the same transaction. Exact setup, check, normal publish, and intentional update commands are documented in `assets/hd/README.md`. Two consecutive manual locked checks passed and removed their work trees; production asset bytes did not change.
- `descent_hd` now owns one documented exact 9x9 floor matrix with six symmetric torch markers. The scenario API returns an independent clone without calling the random-pattern factory; normal scenarios still call the factory exactly once. `buildRoom()` selects through this API before `makeFloorPattern`, so showcase floor/torch state no longer consumes gameplay RNG. Browser state captured the exact matrix.
- Inspected HD desktop/mobile under `output/task5-descent-hd/atomic-lock-desktop-proof` and `atomic-lock-mobile`, default legacy under `atomic-lock-legacy`, and settled forced-critical fallback under `atomic-lock-fallback`. The fixed torch layout is coherent on both viewports; HD loaded all 28 assets, default legacy remained intact, and forced floor failure loaded the other 27, warned, selected complete legacy 144x144, and kept valid state.
- Fresh verification: targeted environment/renderer/loader/snapshot suite 101/101 PASS; full explicit suite 123/123 PASS; audio freeze 5/5 PASS; JS/Python syntax and `git diff --check` PASS. Strict chroma, magic coverage, original source hash, default-disabled HD, portal gating, and audio/legacy contracts remain protected.

2026-07-12 - Graphics overhaul Task 6 Phase A RED handoff
- Added `tests/hd-player-assets.test.js` first. It specifies the exact 64-frame contract: south/north/east/west; idle 4, move 4, attack 4, hit 2, death 2 per direction; 64x64 RGBA; zero visible `#ff00ff`; meaningful alpha coverage; shared scale and bottom-center anchoring; exact unique semantic paths/keys; player metadata direction/clip/frame order plus fps/loop behavior; active critical player classification; snapshot-only visual selection; and existing-controller fallback when one critical player frame is missing.
- Expected RED: `node --test tests/hd-player-assets.test.js` ran 7 tests with 1 pass and 6 failures. The unique expected-path/catalog-path test passed. Failures are the absent seed `art/source/player-hd/player-south-idle-seed.png`; zero active player entries plus all 64 absent semantic keys; all 64 absent final PNGs; absent `assets/hd/actors/player/player-manifest.json`; absent `selectPlayerVisual(snapshot)` renderer API; and zero active critical player entries for the fallback probe.
- Added `art/briefs/player-hd.md` with the compact Nameless Delver character lock, exact south-facing neutral-idle ImageGen seed constraints, flat `#ff00ff` chroma contract, strict top-down/three-quarter orthographic camera, three-floor contrast gate, and exact whole-sheet 8x8 production layout. The later atlas must be edited as one sheet from the approved seed, never generated frame-by-frame.
- No bitmap art, placeholder PNG, player manifest, active semantic entry, snapshot/renderer integration, gameplay change, audio change, or legacy asset change was made in Phase A.
- TODO for the coordinator: use built-in ImageGen for the single seed only, preserve it at `art/source/player-hd/player-south-idle-seed.png`, review it at 64 px against Descent/Corruption/Abyss, and return the approved seed before any atlas expansion or Phase B implementation.

2026-07-12 - Graphics overhaul Task 6 Phase B seed preparation
- Preserved the root-provided built-in ImageGen identity reference unchanged at `art/source/player-hd/player-south-idle-seed.png`: 1254x1254 RGB, SHA-256 `c890fc3c09eb7537faa2350793a1d6919f64dc31a6a85d2232d3d37ae46f474d`. The tests-only seed-prep RED is preserved in commit `607ab6f`: 10 focused tests ran with 2 passes and 8 failures; the three new failures were exactly the missing keyed/64/comparison outputs, missing edit canvas, and missing script/lock, while the five original full-atlas/integration failures remained expected.
- Added `scripts/prepare-player-seed-assets.py`, pinned to Pillow 12.1.1 and installed helper SHA-256 `7e51236919203b61d07ddffdc6e0b5f501a28661003f5851f26ffbb64bdec1ea`. It verifies the source identity, runs only the installed chroma helper, removes residual exact/near-key pixels, validates coverage/anchor, stages under ignored `art/work/player-seed-prep/`, publishes with backup rollback, locks deterministic hashes, and removes staging in `finally`. No ImageGen CLI/API fallback is used.
- Keyed source metrics: RGBA 1254x1254, alpha bbox `[322,150,893,1032]`, 293,126 visible pixels, transparent corners, 0 visible exact `#ff00ff`, and 0 strict near-key fringe pixels. The normalized 64 px candidate has bbox `[14,5,49,60]`, 1,468 visible pixels, bottom-center root y=60, and 0 exact/near-key pixels.
- Added `art/source/player-hd/player-seed-comparison.png`: exact 64 px and 4x nearest-neighbor views on transparency, real Descent `floor-base.png`, and deterministic preview-only Corruption/Abyss palette swatches. Honest review: helmet and steel highlights remain readable, the shadowed face behaves as intended, and there is no visible magenta halo. The sword is readable but long/thin rather than a short sword; the dark-purple cape becomes subdued and loses some right-edge contrast on Abyss; the source identity still reads frontal/tall rather than strongly top-down/compact.
- Added `art/source/player-hd/player-animation-edit-canvas-1024.png`: exact 1024x1024 RGB flat `#ff00ff`; only R1C1 is populated from the approved keyed seed, with bbox `[28,10,99,121]`, 5,872 non-key pixels inside R1C1, and 0 non-key pixels in the other 63 logical slots. `art/briefs/player-hd.md` now contains the exact whole-sheet built-in edit prompt assigning Image 1 as the immutable identity reference and Image 2 as the edit target.
- Seed-prep lock/check, the 118-test unaffected suite, and the 5-test audio freeze pass. Focused player tests now pass all 7 source/preparation/uniqueness/concurrency/cleanup gates and retain exactly 5 expected RED failures for the absent 64 active entries/finals, player manifest, visual selector, and critical-player fallback exercise. Review caught a fixed-directory race between simultaneous `--check` runs; a reproducing RED failed with one invocation deleting the other's keyed staging file, and each invocation now owns an atomic unique child under `art/work/player-seed-prep/` while the last finisher removes the empty parent. A second RED proved missing-helper setup validation leaked its new tree; source/tool verification now also runs inside the cleanup-protected boundary.
- No final player frame, player manifest, active player semantic entry, renderer/snapshot/gameplay integration, audio file, or legacy asset was created or changed. PAUSED before the one-shot whole-sheet built-in ImageGen edit.

2026-07-12 - Graphics overhaul Task 6 rejected-atlas architecture correction RED
- Preserved the rejected built-in ImageGen result unchanged at `art/source/player-hd/player-animation-atlas-rejected-layout.png`: 1254x1254 RGB, SHA-256 `3ae0de590ca039525d1db721c1539df146affc57a90939631cfccbc667d96d64`. Diagnostic keying detected `#f603f4`; alpha-threshold 16 produced 72 raw components and exactly 70 meaningful pose components with areas 3,631–7,355 px.
- Meaningful component centroids form exactly 10 column clusters with 7 poses each and 7 row clusters with 10 poses each: actual layout `10x7/70`, not required `8x8/64`. Six surplus poses, non-128 px cluster alignment, and changed row semantics make exact 8x8 semantic cropping impossible. The sheet is rejected evidence/style reference only and must not be integrated.
- Updated `tests/hd-player-assets.test.js` first and observed the targeted contract RED: 5/5 selected tests failed exactly on missing rejection analysis/preview, missing north/east/west anchor previews, missing four direction edit canvases, missing four generated direction sources, and the old schema-1 single-canvas lock. The final 64-frame paths, semantic keys, counts, fps, loops, critical classification, and integration requirements remain unchanged.
- Corrected only the production-source architecture to four whole-direction 4x4 sheets. Each normalized 1024x1024 direction source has 256 px logical slots: R1 idle01-04, R2 move01-04, R3 attack01-04, R4 hit01/hit02/death01/death02. This retains whole-animation generation and is not frame-by-frame generation.

2026-07-12 - Graphics overhaul Task 6 four-direction generation preparation GREEN
- Extended the pinned deterministic player-prep pipeline to verify and key both immutable sources, reproduce the rejected `72 raw / 70 meaningful / 10x7` component evidence, and publish `player-animation-rejected-layout-analysis.json` plus a labeled 1400x1400 component/contact preview. All 70 meaningful component boxes are labeled by detected row/column and color-coded by the visually evident direction groups; the report remains explicitly `shippable: false`.
- Direction anchors are unmistakable and high-confidence generation references: north R3C1/component 21/back-facing, east R4C1/component 31/screen-right, and west R6C1/component 51/screen-left. All three use one shared scale `0.41176471`, exact/near chroma `0/0`, and root y=60. Metrics: north bbox `[14,6,49,60]`/1,429 visible px; east `[18,5,45,60]`/1,075; west `[22,5,42,60]`/972. South remains the approved original-derived anchor `[14,5,49,60]`/1,468. The labeled 1120x320 anchor preview records that these are generation references only, not shipping frames.
- Added four exact 1024x1024 RGB flat-`#ff00ff` edit canvases with 256 px logical slots and only R1C1 populated. South bbox/non-key `[56,20,199,243]`/23,488; north `[56,24,199,243]`/22,864; east `[72,20,183,243]`/17,200; west `[88,20,171,243]`/15,552. Every canvas has zero non-key pixels outside R1C1. SHA-256: south `fc557a684dc99acc56eee87dc0be298076fd40be258ecbaade1a9f0703821e76`; north `0bdcb9ee872ec3a075b074976ec30c4f00b03ab2733adc6b28700783644acc14`; east `2d0d5aebb3d1ff7bb3049f4ebd9e33d9d6cb3b7b7509ebeb37286e2ffac30ae1`; west `b708165448bd130a724fda927e11740e6dd9c145700be62ef244c16636d754d2`.
- Added `art/briefs/player-hd-direction-prompts.json` with four fully resolved built-in edit prompts. Every prompt fixes input order as Image 1 original identity seed, Image 2 rejected multi-direction style/pose reference, Image 3 mandatory direction edit canvas; forbids copying the rejected 10x7 layout; and requires one exact 4x4/16-pose direction sheet with the unchanged semantic clip order.
- Focused player suite now runs 17 tests: all 11 preparation/evidence/helper-key/anchor/canvas/prompt/determinism/concurrency/cleanup/uniqueness gates pass; exactly 6 expected RED failures remain for the four not-yet-generated direction source sheets plus the deferred active manifest, 64 final frames, player manifest, visual selector, and critical-player fallback exercise. The nondeferred suite passes 123/123 including audio 5/5.
- Final review found no Critical or Important issues. Its two Minor handoff risks were resolved: the obsolete generically named 8x8 edit canvas was removed, and `helperDetectedKey` is parsed from the pinned helper's actual `Key color: #RRGGBB` stdout rather than hardcoded. A focused RED/green parser test protects the evidence path.
- No built-in ImageGen call, generated direction source, final 64 frame, active player manifest entry, renderer/snapshot/gameplay integration, audio change, or legacy asset change was made. PAUSED for root orchestration of four parallel whole-direction edits.

2026-07-12 - Graphics overhaul Task 6 Phase C production player GREEN
- Preserved all four root-provided built-in ImageGen sheets byte-for-byte at their supplied `*-source-1024.png` paths. They are actually 1254x1254 RGB: south `8945c8f41ea083cf5717072058466fd9ec19c8ebee77653956e1fcaea04e66d3`, north `ff130a2efd2677d758048a14bf697f7e0714d3167d0571444b9fcb648d74c861`, east `19da543aea6592de7cbdd398bcf6be551abef96eb1c323906f0338eb39a6fe40`, west `25f525a787acf7dca43b62fb51c31a1406d0e9f30da876cffb3ddaca7324db24`.
- The semantic source gate passed all four directions: exactly four centroid row clusters, four column clusters, sixteen occupied semantic slots, and zero ambiguous component assignments. South/west each have exactly 16 meaningful connected components. East has 16 meaningful components plus three removed specks (86/66/22 px). North has 17 meaningful components because R4C4 deliberately contains the collapsed body plus a detached sword; both are contained in the same unambiguous semantic slot. North's remaining disconnected noise is at most 12 px and is removed.
- Tests-first production RED is commit `24f12f9`: 20 focused tests ran with the 11 preparation gates passing and nine expected failures on the absent layout report/normalized sheets/builder lock/64 finals/player manifest/selector/draw path/critical fallback. Added `scripts/build-player-animation-assets.py`, pinned to Pillow 12.1.1 and helper SHA-256 `7e51236919203b61d07ddffdc6e0b5f501a28661003f5851f26ffbb64bdec1ea`. It verifies immutable inputs, stages in a unique ignored tree, keys whole sheets, validates semantic clusters, removes only sub-500 px disconnected debris, uses one global final scale, publishes transactionally with rollback, and supports isolated non-publishing `--check` plus intentional `--update-lock`.
- Published four 1024x1024 flat-key normalized review sheets, the evidence report, a 1024x256 contact sheet, exact player metadata, and 64 unique 64x64 RGBA frames. Global scale is `0.1901639344262295` from source max bounds 305x255; finals retain 623-1,154 visible pixels, widths 22-58, heights 19-48, root y 60, transparent corners, zero visible exact chroma, and one shared scale. Lock SHA-256 is `100872896c0b10a60c088c9ff48ff0c094d924bdf56436ededb465de29809759`.
- Promoted exactly 64 `actor.player.<direction>.<clip>.<NN>` entries to the active HD manifest as group `player`, `critical:true`. `selectPlayerVisual(snapshot)` uses priority death > hit > short-lived resolved bump attack > movement tween > idle and reads direction from facing/last move. The player layer draws the selected 64 px frame bottom-centered; missing critical art still uses the existing controller fallback and the diagnostic silhouette remains only as a defensive layer-level fallback.
- Added only a 240 ms visual marker to already-resolved bump attacks (`visualAction`/`visualActionTimer`), copied through the visual snapshot and decremented in the existing effects update. It does not delay attacks, turns, movement, input, hitboxes, damage, AI, RNG, or audio; transient visual state is reset rather than trusted from saves.
- Verification: targeted `node --test tests/hd-player-assets.test.js` PASS 20/20; full explicit suite PASS 143/143. Locked production check rebuilds twice without publishing or changing source/output hashes. Contact sheet inspection found coherent identity, handedness, directions and clips. Browser QA with the supplied Playwright runner plus dedicated viewport capture passed desktop 1280x800 and mobile 390x844: `phase=playing`, HD 576x576 active, movement and an adjacent bump-attack frame visible, no console errors or warnings. `config.js` was restored to default-disabled `false` immediately after QA and the local server was stopped. No MP3 or legacy asset changed.
- Formal review corrections are covered by four focused tests: the builder now rejects adjacent semantic-slot extents that overlap horizontally or vertically instead of reporting a constant zero; attack01-04 are distributed across the unchanged 240 ms visual-only marker in four 60 ms windows; death01-02 use a reset/incremented `visualDeathTimer` rather than the arbitrary global loop clock; and HD position uses the exact legacy 120 ms quadratic-out tween from `_tweenFromX/_tweenFromY` while converting legacy 16 px coordinates to the 64 px HD grid.
- Mobile visual review found the native one-tile draw too small after the 576 px canvas scales to about 289 px. Game-director-approved correction renders the unchanged 64x64 PNG at 80x80 bottom-center on the same logical tile; PNG bytes, root metadata, hitbox, coordinates, gameplay timing and mechanics remain unchanged. Fresh desktop/mobile gameplay plus adjacent attack captures report HD 576x576, no warnings/errors, and a larger body/weapon footprint; the default flag was again restored to `false` and the server stopped.
- Fresh post-review verification: focused fixes PASS 4/4; targeted player suite PASS 23/23; full sequential suite PASS 146/146; separate audio freeze PASS 5/5; independent player locked rebuild PASS. The earlier 142/146 parallel experiment was a harness-observation race caused by deliberately running full, targeted and standalone rebuild processes against the same staging parent; all child builders were isolated, the interrupted process's ignored child was removed, and the required sequential runs pass with no staging leak.
- Final read-only re-reviews report no findings. Code review verified all four prior Important issues closed, the focused tests and locked rebuild green, and bottom-center/tween/gameplay preserved at 80x80 presentation. Visual review verified the prior mobile readability Important closed: the fresh mobile attack has a distinct diagonal blade and directional lunge, while desktop remains unclipped and anchored.

2026-07-12 - Graphics overhaul Task 8 themed rooms GREEN
- Tests-first contract RED is commit `9ec51881ce3fc3e6502a6d847b8aeafd55e5281f`: 10 tests ran with 1 existing loader fallback pass and 9 expected failures for absent Corruption/Abyss assets, props, theme/hash API, renderer/snapshot/scenario integration, and locked build.
- Preserved five built-in ImageGen sources under `art/source/task8-hd/`: Corruption atlas, Abyss atlas, merchant identity seed, core setpieces atlas, and portal/boss atlas. Four atlases validate as exact 4x4/16-slot sources. The pinned transactional builder publishes 48 themed 64x64 RGBA environment PNGs plus 32 optional setpiece PNGs, five normalized 1024 px review sources, exact metadata, and a deterministic lock.
- Added depth theme selection (`Descent <20`, `Corruption <40`, `Abyss otherwise`), visual-only deterministic room hashing, themed floors/walls/corners/decals/torches, special-room props, valid common fallbacks for optional portals/chests, and legacy fallback preservation for missing critical environment art. Layer order remains floor -> decals/seals -> hazards -> objects -> enemies -> player.
- Visual snapshot now copies only derived vault-clear and otter-chest render state. The debug-only scenario matrix covers combat, cursed, merchant, forge, pact, vault, otter, and boss for both new themes; QA auto-start dismisses the boot overlay without changing the default-disabled global HD flag.
- Browser matrix under `output/task8-hd-room-qa/matrix` contains 32 desktop/mobile scenarios at 1440x1000 and 390x844. All 32 report `graphicsMode=hd`, canvas 576x576, playing state, no horizontal overflow, and zero unexpected console errors/warnings. Representative inspected frames confirm readable Corruption forge/merchant and Abyss otter/vault/final-phase seal geometry.
- Soundtrack files and protected audio code remain unchanged. Task 9 boss/guardian actors and Task 10 VFX/lighting remain intentionally out of scope.

2026-07-13 - Task 8 quality-review alignment hardening
- Forge HD rendering now uses the production 3x3 `originX/originY/width/height` footprint rather than bottom-centering the 192 px setpiece on its interaction tile. The QA Forge state mirrors the real `(origin 3,0; interact 4,3)` layout.
- Cleared Forge rooms select the orange Forge portal before the common optional fallback.
- The 32-scenario browser runner captures fresh by default; cached results are used only with explicit `--resume`. Fresh desktop/mobile Forge review confirms top-room alignment and orange portal presentation.
## 2026-07-13 — Graphics overhaul Task 9: guardians and Warden

- Added four directional boss profiles: Vault Guardian (128 px), Blacksmith Guardian (128 px), Warden phase 1 (160 px), and a physically transformed Warden phase 2 (192 px). Each profile ships 64 critical RGBA frames with idle, move, attack/cast, hit, and death clips on a shared bottom-center root.
- Preserved sixteen raw whole-direction 4x4 ImageGen sheets and immutable source hashes. The pinned, transactional builder publishes 256 boss frames, four manifests, eight optional barrier/Aegis overlay frames, normalized sheets, contact previews, and a reproducibility lock. Final frames contain zero visible exact or near-key magenta.
- `selectBossVisual()` reads only existing facing, tween, hit/cast/telegraph, barrier/Aegis, HP, and `finalBossPhase` presentation state. Logical coordinates, collision, AI, HP, damage, turn timing, gameplay RNG, saves, and audio are unchanged. Missing critical base art still requests the existing legacy fallback; missing optional overlay art draws a procedural fallback.
- Added deterministic `vault_guardian_hd`, `blacksmith_guardian_hd`, `warden_phase1_hd`, and `warden_phase2_aegis_hd` scenarios. Desktop 1440x1000 and mobile 390x844 browser QA passed 8/8 with a 576x576 HD canvas, scrollY 0, no horizontal overflow, and zero unexpected console diagnostics. Evidence: `output/task9-hd-boss-qa/matrix/`.
- The main worktree remains intentionally dirty only through the user's uncommitted `config.js=true` preview toggle. A fresh detached checkout at committed `config.js=false` passed the complete suite 179/179, targeted boss/campaign/final-flow checks 10/10, audio freeze 5/5, `build-boss-animation-assets.py --check`, and syntax checks. `.gitattributes` now pins repository text assets to LF so immutable source/build hashes survive a clean Windows checkout.

## 2026-07-13 — Final stages A1: wall topology correction

- Added a semantic alpha-topology regression test for all twelve Descent/Corruption/Abyss wall corners. RED identified the Descent northeast corner as nearly equally filled on the physical outer and room-facing quadrants (`0.969` versus `0.932`), matching the reported reversed-corner defect.
- Both locked environment builders now compose each corner from the canonical horizontal and vertical wall arms, while retaining the unique corner detail only in its physical outer quadrant. This also corrected Corruption southeast and the lower Abyss corners without changing the source atlases.
- Regenerated twelve corner PNGs and both deterministic locks. The wall/environment/room suite passes 35/35; both builders pass `--check`. Full 576×576 diagnostic rings for all three themes were visually inspected under `output/wall-audit/` and show the correct inward opening with continuous wall arms.

## 2026-07-13 — Final stages A2: combat VFX and telegraphs

- Added a deterministic, snapshot-only HD VFX adapter for mines, volatile bursts, dash/enemy aim, particles, floating combat text, ranged bolts/impacts, dash trails, shockwaves, shields, and the critical-health border. Quality and reduced-motion profiles cap particle count, motion, and flash intensity; the adapter never consumes gameplay RNG.
- Added the debug-only `vfx_showcase_hd` scenario and kept its presentation effects alive through cold HD asset loading. Browser QA at 576×576 confirmed readable translucent area warnings, all major effect families, corrected Corruption wall corners, and no console errors. Evidence: `output/vfx-a2-qa/`.
- Targeted VFX/scenario/snapshot/audio verification passes 27/27. Protected soundtrack files and audio code remain unchanged.

## 2026-07-13 — Final stages A3: HD lighting

- Added a composited ambient-lighting pass with deterministic snapshot-derived lights for torches, active portals, forge/pact setpieces, player shields, the Blacksmith barrier, and Warden Aegis. High/medium/low profiles bound ambient darkness, glow strength, and light count; reduced-effects preferences lower all three.
- Critical lights are prioritized before decorative torches when a budget is reached. The darkest normal profile remains capped at 0.26 opacity, so gameplay silhouettes and telegraphs remain readable.
- Lighting/VFX/renderer/audio verification passes 16/16. Browser inspection at 576×576 confirmed subtle torch pools, readable actors and warnings, no over-darkening, and no console diagnostics. Evidence: `output/lighting-a3-qa/`.

## 2026-07-13 — Final stages B1: restrained menu/HUD/mobile polish

- Preserved the boot menu logo, copy, credits, structure, and all music behavior. Added only a restrained dungeon vignette/panel treatment, clearer HUD inset hierarchy, visible keyboard focus rings, high-contrast support, and reduced-motion handling for nonessential UI animation.
- Raised mobile D-pad, action, and Menu controls to 48 px minimum touch targets without changing bindings or gameplay input behavior.
- Static UI/audio checks pass 9/9. Full desktop/mobile boss viewport QA passes 8/8: 576×576 HD canvas, visible skill bar and mobile controls where expected, scrollY 0, no horizontal overflow, and no console diagnostics. Evidence: `output/ui-b1-qa/`.

## 2026-07-13 — Final stages B2: deterministic final visual-audit matrix

- Added `scripts/capture-hd-final-audit.mjs`, covering the unchanged boot menu plus sixteen deterministic gameplay showcases on desktop 1440×1000 and mobile 390×844. The matrix includes all three wall themes, base/player/enemy presentation, combat/cursed/merchant/forge/pact/vault/otter rooms, combat VFX, both guardians, and both Warden phases.
- Every capture records the full viewport, canvas, text state, and console diagnostics. Automated gates reject wrong renderer/canvas size, scrolling/overflow, missing mobile chrome, blank or transparent frames, leaked magenta key pixels, implausibly dark/bright frames, and browser errors.
- The runner contract tests pass 2/2. The fresh complete matrix is intentionally scheduled after default activation so the final evidence audits the exact shipping configuration.

## 2026-07-13 — Final stages C1: fallback, save, performance, and audio gates

- Confirmed the run-save builder and loader are renderer-agnostic: no HD flag, graphics mode, renderer, manifest, or loaded-asset state enters persistence. Existing player/portal validity and legacy snapshot restoration remain the compatibility boundary.
- The loader/controller/snapshot/save/audio release selection passes 89/90 before activation. The sole expected pre-activation failure is the obsolete assertion that the default HD flag must remain false; all critical-missing, timeout, malformed-loader, reentry, emergency-fallback, and optional-asset paths pass.
- Added a real-browser frame-pacing gate on the heavyweight VFX showcase. Fresh results: desktop mean 16.666 ms / p95 16.7 ms and mobile mean 16.666 ms / p95 16.8 ms (both ~60.0 fps), HD mode retained, zero console diagnostics. Evidence: `output/final-hd-audit/performance.json`.
- Protected soundtrack files and active audio code remain byte/contract-identical to the approved baseline.

## 2026-07-13 — Final stages C2: shipping HD activation

- Promoted the completed 64 px renderer to the shipping default in `config.js`; setting the flag to false remains the explicit legacy-fallback diagnostic switch.
- Updated the controller dependency-order contract to include VFX and lighting before renderer layers. The activated loader/controller/snapshot/save/audio release selection passes 90/90.
- This activation changes no gameplay state, balance, input, save schema, soundtrack file, or active audio declaration.

## 2026-07-13 — Final stages C3: completed audit and corrective loop

- The complete repository suite passes 201/201 in the shipping `HD=true` configuration, including all locked asset rebuilds, wall topology, loaders/fallback, render layers, gameplay systems, save compatibility, UI, and the protected audio contract.
- The first long visual-matrix attempt exposed an audit-harness resource issue after 29 entries: one Chromium process retained decoded copies of the now-large manifest across too many pages. An isolated mobile VFX probe reached HD in 5.3 s with zero diagnostics, proving the game/scenario healthy. The runner now recycles Chromium every eight scenes; its regression contract passes.
- The corrected fresh matrix passes 34/34 views (boot plus sixteen gameplay scenarios on desktop and mobile): 32/32 gameplay views in HD, zero console errors, zero horizontal overflow, no blank/transparent frames or chroma-key leaks, and luminance bounded from 29.04 to 66.24. Evidence: `output/final-hd-audit/matrix/`.
- Manual inspection confirmed correct inward-opening and continuous corners for Descent, Corruption, and Abyss; readable VFX/telegraphs; correct forge, vault, guardian, and Warden anchoring; and intact desktop/mobile UI. The review found and fixed two minor presentation issues: boot prompt minimum opacity is now 0.6, and a subtle player-presence light improves the dark Abyss silhouette.
- Post-correction browser performance remains ~60.0 fps on desktop and mobile, with zero diagnostics. Audio freeze remains 5/5 and no soundtrack file or active audio declaration changed.

## 2026-07-13 — Portal layering and brazier correction

- Replaced independently generated full-portal animation poses with one complete immutable 128×128 frame plus eight transparent rotation phases derived from one coherent vortex texture for common, vault, forge, and otter portals. Runtime draws the full frame and swirl as separate bottom-centered layers; the existing three active composites remain as optional fallback assets.
- Regression tests require fixed swirl bounds/center, zero swirl pixels outside the aperture, distinct rotation phases, and hundreds of visible pixels in the untouched lower frame/platform. Fresh browser sequences confirm the frames no longer bob, morph, erase their lower structure, or report console errors.
- Replaced the HD visuals behind all existing `torch` identifiers with grounded common, corruption, and abyss braziers. Each theme uses one byte-identical bowl/base plus three flame-only overlays; map marker `3`, manifest keys, save compatibility, Classic fallback, menu behavior, and soundtrack remain unchanged.
- Preserved the approved ImageGen brazier atlas and pinned its SHA-256 in both deterministic asset locks. Full desktop browser inspection covers Descent, Corruption forge, and Abyss otter rooms; no green chroma leakage is present in the twelve final brazier PNGs.

## 2026-07-13 — HD mine visibility correction

- Confirmed the regression at the render boundary: normal room generation creates mines with `armed: false`, but the HD hazard layer drew only mines whose `armed` field was not false. Classic mode already drew both states.
- Added `hazard.common.mine.unarmed` while preserving the existing armed identifier, mine state, saves, mechanics, and Classic assets. The deterministic Descent builder now publishes a 64 px unarmed variant with the exact same alpha silhouette/static housing and a dark lens; the armed variant retains its bright orange-red core.
- Focused environment tests pass 23/23, including exact state routing, invariant housing/alpha checks, chroma policy, and isolated locked rebuild. Browser captures under `output/hd-mine-qa/` visually confirm an armed mine in `descent_hd` and visible unarmed mines in the Forge scenario.

## 2026-07-13 — Layered HD protection VFX overhaul

- Replaced the generic HD shield circle and the simple boss overlay arcs with four distinct layered effects: gold player Shield, cyan persistent player barrier, molten iron Blacksmith Guardian barrier, and violet Warden Void Aegis.
- Added a pinned transactional builder for 64 RGBA assets: rear/front passes across eight stable animation phases for each effect. Player effects use 128x128 canvases; boss effects use 256x256 canvases. Alpha bounds, centers, diameter, transparent corners, chroma policy, phase differences, and reproducible hashes are covered by tests and the lock file.
- Rendering order is now rear effect -> actor -> front effect for both player and boss layers. The effects read existing gameplay state only; mechanics, timing, saves, Classic identifiers/assets, menu behavior, and soundtrack remain unchanged.
- Added deterministic player Shield and persistent barrier scenarios alongside the existing Blacksmith and Warden showcases. A fresh desktop/mobile matrix captured three animation phases for all four effects. All 8 scenario/viewport entries used the 576x576 HD renderer, had no overflow or scroll drift, and reported zero console diagnostics. Evidence: `output/hd-protection-vfx-qa/`.
- Manual inspection of the final phase in all eight views confirms stable actor anchoring, full unclipped silhouettes, readable actors, and distinct protection identities at desktop and mobile sizes.
- Final release verification: both protection and boss asset locks pass; the full sequential repository suite passes 215/215; the independent audio freeze passes 5/5; syntax and diff checks pass; and the heavyweight VFX benchmark records 60.0 fps on desktop and mobile with zero console diagnostics.

## 2026-07-13 — HD dungeon variation and Abyss readability

- Audited the immutable Classic tilesets and renderer contract. Each 64×64 Classic sheet contains sixteen unique 16×16 slots: eight wall/corner slots plus eight floor/feature slots. Classic maps its fixed `floorPattern` values to base, B, C, skull, crack-cross, var3, var4, and brazier states; the HD renderer previously repeated only one base floor and treated sparse random decals as its only variation.
- Added seven deterministic full floor states per theme, derived only from the approved HD atlases and the real Classic skull motif. Existing `floor-base`, `torch`, gameplay, save, Classic, menu, audio, and soundtrack contracts remain unchanged. Rare semantic floors suppress unrelated random decals, and all optional variants safely fall back to `floor-base`.
- Added theme-specific HD spikes with the existing common spike retained as fallback. Corruption and Abyss environment contracts now contain thirty exact 64 px PNGs each; the locked Task 8 build contains 121 PNGs and seven verified immutable sources.
- Raised only Abyss floor midtones to a 56–62 readability band, capped its final ambient veil at 0.18 (0.12 with reduced effects), and strengthened only its existing player-presence separation light. Descent and Corruption lighting profiles are unchanged; no enemy-specific light was needed after visual review.
- Added deterministic `descent_floor_variants_hd`, `corruption_floor_variants_hd`, and `abyss_floor_variants_hd` scenarios exposing every semantic value `0…9`, plus a desktop/mobile capture runner. Fresh QA under `output/hd-dungeon-variation-qa/` passes 8/8: HD 576×576, scrollY 0, no overflow, zero console diagnostics, zero transparent or near-magenta pixels, and full semantic coverage. Desktop Abyss combat luminance improved from the audited 29.00 to 45.69; mobile records 45.34.
- Manually inspected every accepted canvas and viewport. Walls and inward-opening corners remain correct, all floor families are visibly distinct, braziers and skull/crack states are unclipped, the enemy remains readable, and the Abyss player silhouette now has a restrained local separation pool on desktop and mobile.
- Final evidence: all four deterministic asset lock checks pass; the complete sequential repository suite passes 225/225; the independent soundtrack/audio freeze passes 5/5; syntax and diff checks pass. The heavyweight VFX benchmark retains HD with zero console diagnostics at desktop mean 16.666 ms / p95 16.8 ms and mobile mean 16.666 ms / p95 16.8 ms (about 60.0 fps).

## 2026-07-14 — HD portal reveal regression

- Reproduced the clear-room regression at the HD presentation boundary: a playable room could be `roomCleared: true` while retaining the earlier `portal.active: false` flag, causing both the portal layers and its priority light to stay inactive.
- In active gameplay, room clearance is now authoritative for portal presentation. Non-playing diagnostic states retain their explicit inactive appearance.
- Verified the red/green regression in renderer and lighting tests, then ran the focused portal suite: 17/17 pass with syntax and diff checks clean. Commit: `20d9809`.
- Fresh browser transition QA used `enemy_roster_hd`: before clear there were seven enemies and no visible portal; after the real debug clear transition the state reported zero enemies, `roomCleared: true`, the portal at `(7,7)`, HD 576×576 retained, zero browser diagnostics, and a complete visible static frame plus animated inner swirl. Evidence: `output/portal-clear-qa/transition/`.

## 2026-07-14 — HD status-emblem showcase and browser QA

- Added deterministic `status_emblems_hd` coverage for seven player statuses, four enemy dynamic statuses, Elite, and all five elite affixes. The fixed combat room keeps hazards and interactables from obscuring the actor rails.
- Browser QA found and fixed a real cold-load presentation race: the HUD could render once in the temporary legacy canvas mode before asynchronous HD asset activation, leaving fallback dots/text in the side panels while canvas emblems were already active. Graphics initialization now marks the UI dirty after either successful HD activation or fallback settlement, so the HUD rebuilds against the final renderer mode.
- Fresh desktop 1440×1000 and narrow responsive 390×844 HD captures pass: 576×576 canvas, six loaded DOM emblems, all remaining showcase statuses on bounded actor rails, zero transparent or near-magenta pixels, no scroll/overflow, and zero browser diagnostics. The responsive effects pane keeps both Gothic rows fully inside its panel and retains the skill bar and mobile controls. Real mobile-device UA behavior remains intentionally unchanged behind the existing unsupported-device guard.
- Classic fallback was captured separately at 144×144 with zero HD status images and the original visual path intact. The supplied web-game client repeated the deterministic state twice without mutations or diagnostics. Evidence: `output/hd-status-emblems-qa/`.

## 2026-07-14 — HD status-emblem release verification

- All four locked production checks pass without publishing changes: status emblems, Descent environment, themed room environment, and layered protection VFX.
- The focused graphics/UI suite passes 71/71. The complete repository suite passes 237/237 sequentially, followed by an independent soundtrack/audio freeze pass of 5/5. This covers the portal reveal fix, wall topology, mines, VFX, lighting, player/enemy/boss animation, save/fallback behavior, UI, and Classic compatibility.
- Fresh heavyweight browser performance remains within the release budget with HD retained and zero diagnostics: desktop mean 16.759 ms / p95 16.8 ms (59.7 fps), responsive 390×844 mean 16.665 ms / p95 16.7 ms (60.0 fps). Evidence: `output/hd-status-emblems-qa/performance.json`.
- Removed only generated Python cache and the isolated enemy-build staging residue left by the exhaustive test run. The worktree is clean except for the user's untouched untracked `assets/hd/hd.zip`.

## 2026-07-14 — Runtime HD / Classic graphics selection

- Added a persistent `Options -> Graphics -> HD / Classic` choice that applies immediately through the existing race-safe graphics controller. The preference stays outside run saves, survives browser reloads, and safely falls back to Classic when HD loading cannot complete.
- Preserved the active run while switching HD -> Classic -> HD through the real Escape/save/Continue menu flow. Gameplay state, input, save compatibility, menu structure, Classic identifiers/assets, audio code, and soundtrack files remain unchanged.
- Fresh browser QA captured eight checkpoints covering both menu selections, both live renderers, return to the same run, and reload persistence in each mode. HD used 576x576, Classic used the original 144x144 canvas, every active label matched the live renderer, the run signature stayed identical, and browser diagnostics remained empty. Evidence: `output/graphics-toggle-qa/`.
- Manual inspection confirmed legible HD and Classic gameplay, correctly updated active labels, unclipped HUD panels, and the unchanged menu presentation around the new Graphics category. The supplied web-game client repeated the deterministic HD showcase twice without state drift or diagnostics.
- Final release verification passes 243/243 sequential repository tests after updating one obsolete asset-loader assertion from the retired `hdEnabled` startup variable to the persistent graphics preference contract. The independent soundtrack/audio freeze passes 5/5, and syntax plus diff checks are clean.
- Fresh heavyweight browser performance remains at 60.0 fps in both desktop and responsive profiles with HD retained and zero console diagnostics: desktop mean 16.666 ms / p95 16.8 ms, mobile mean 16.666 ms / p95 16.8 ms. Evidence: `output/graphics-toggle-qa/performance.json`.

## 2026-07-14 — HD actor proportion rebalance and release verification

- Rebalanced only HD presentation scale: Brute and Totem now render at 80×80 instead of 64×64, while Merchant renders at 96×96 instead of 128×128. All three retain the existing bottom-center logical tile anchor; Brute/Totem HP rails, status emblems, and crests are derived from the final presentation bounds.
- Source art was not resampled or replaced: all 64 Brute source PNGs and all 16 Totem source PNGs remain 64×64, and the four Merchant source PNGs remain 128×128. Merchant room-profile metadata now matches its 96×96 runtime presentation size.
- Fresh deterministic browser evidence is under `output/hd-actor-proportions-qa/`: desktop 1440×1000 and responsive 390×844 viewport/canvas/state/metrics/diagnostics captures, plus desktop Brute, Totem, Skeleton, and Merchant crops. Both views retained the 576×576 HD canvas, exact logical actor coordinates, scrollX/scrollY 0, no horizontal or vertical overflow, and zero console errors.
- Manual inspection confirms the larger Brute and Totem have a stronger combat silhouette, the smaller Merchant no longer dominates the room, bottom-center feet/bases stay anchored, and HP/status/crest rails remain centered, readable, separated, and unclipped in desktop and responsive views. The standard 64×64 Skeleton remains a useful unchanged scale reference.
- Final required focused release command passed 101/101 tests with 0 failures after adding the generator regression guard. The independent soundtrack/audio freeze passed 5/5. `node --check` passed for `game.js`, `scenario-overrides.js`, `render/hd-renderer-layers.js`, and `scripts/capture-hd-actor-proportions-qa.mjs`; `git diff --check` also passed.
- Isolation verification: `assets/sprite`, `assets/audio`, Classic renderer/config/menu/UI paths, and all HD actor PNG bytes are unchanged relative to `main`. `game.js` changes are confined to the deterministic QA scenario setup, apart from a cosmetic removal of two blank lines at EOF. Gameplay coordinates, hitboxes, balance, saves, input, and soundtrack remain unchanged.
- The Task 8 room-asset generator now reproduces the published 96x96 Merchant metadata instead of reverting it to 128x128. The metadata lock was refreshed to `97c6c4118f5716df528552a568fb82fa3ab5ada35422d077968bc554afd374bf`; `build-hd-room-assets.py --check`, the 18/18 room-asset suite, and 2/2 release gates pass without changing any PNG bytes.
- Minor QA-runner notes retained for follow-up: Merchant availability is selected through `localStorage`, and `summary.json` is written only after all assertions succeed. These do not affect game runtime or the captured successful evidence.
- Removed only the generated `scripts/__pycache__/` directory after resolving its absolute path and verifying it was inside this worktree; no other output/art or external worktree archive was touched.

## 2026-07-15 — Torch and setpiece safety zones

- HD torch rendering and lighting now ignore wall markers, matching Classic wall precedence.
- Added shared room-data cleanup for torch, mine, and spike conflicts around portals, shrine, merchant, pact, forge, Otter reward chest, Vault seal, and Boss center/north/south artwork.
- Existing saves and deterministic scenarios are sanitized after load/setup; the Otter reward chest is sanitized when it appears.
- Focused tests pass 11/11. Browser inspection of `warden_phase1_hd` shows clean Boss artwork and no console diagnostics; evidence: `output/torch-reservation-qa/`.

## 2026-07-15 — Tiered HD Dash and Shockwave VFX

- Rebuilt HD Dash as a tier-aware procedural ribbon: Rare dual edges, Epic afterimages/landing energy, and Legendary violet Void Lunge with first-hit burst and persistent animated afterline.
- Rebuilt HD Shockwave with a visible energy core, radial force spokes, Epic secondary ring, Fury-scaled detail, and Legendary gold/violet overload arcs. Shield rendering and assets remain unchanged.
- Extended transient VFX snapshots with presentation-only tier/style/seed/Fury metadata; gameplay damage, radius, cooldowns, and Classic rendering remain unchanged.
- Added deterministic `skill_vfx_tiers_hd` side-by-side showcase and reduced-motion detail scaling.
- Focused VFX/snapshot/scenario verification passes 25/25 with syntax checks clean. Browser evidence has zero diagnostics: `output/skill-vfx-tiers-qa/`.

## 2026-07-15 — Vault/Otter seals and late room-clear portal

- Moved the former chained/otter-emblem floor seal from Vault to Otter in both blocked and cleared states.
- Added two new generated Vault seal sources and deterministic 128x128 outputs: a locked keyhole mechanism and a visibly opened iris with brighter runes. The Task 8 generator, profiles, manifest, and lock now reproduce all 123 room assets.
- Audited the portal lifecycle and found a real late-turn gap: Chaos Orb resolved after the only room-clear check, so a final kill from its strike could leave `roomCleared` false indefinitely. A final post-Chaos clear check now closes that gap.
- Focused renderer, lighting, reservation, asset-contract, and portal-order checks pass. The real Vault Guardian debug-clear transition reaches zero enemies, `roomCleared: true`, and a visible portal with zero browser diagnostics.
- Final HD evidence covers locked Vault, cleared Vault plus portal, and cleared Otter plus portal under `output/vault-otter-portal-qa/hd/`.

## 2026-07-15 — Standard HD portal perspective correction

- Audited the common portal against the dimensional room walls and the forge/vault/otter portal kits. The common ring was a front-facing flat circle with no grounded depth cue.
- After rejecting the initial floor-ellipse direction, rebuilt the standard portal as a restrained low standing ring: near-circular opening, slight backward lean, visible lower thickness, and a compact grounded foot. Special-room portals and runtime size/anchor remain unchanged.
- The deterministic common-portal pipeline now supports an elliptical rotation space and re-centers every transformed swirl phase. The immutable frame remains byte-identical across animation composites; measured phase centroid jitter is below 0.15 px.
- `node --test tests/hd-environment.test.js` passes 26/26, including the full isolated locked rebuild and strict chroma/alpha checks.
- Browser smoke with the supplied web-game client passed on `?scenario=descent_hd`; state and inspected screenshots are under `output/portal-perspective-qa/` with the revealed portal at `(6,6)` and no browser diagnostics.

## 2026-07-15 — Standard portal grounding without a center foot

- Audited the standing common portal in isolation and in `descent_hd`. Its narrow center stem read as a separate decorative stand and collapsed to a thin line at gameplay scale.
- Removed the stem, column, pedestal, and round plinth. The upright ring now settles directly into a thickened lower arc with two low integrated side wedges and one continuous floor contact edge.
- Preserved the 128x128 bottom-center runtime anchor, common portal identity, near-circular aperture, immutable frame, and eight stabilized swirl phases. Special-room portals remain unchanged.
- `node --test tests/hd-environment.test.js` passes 26/26, including strict alpha/chroma validation and the isolated deterministic lock rebuild.
- Supplied-client browser smoke passed on `?scenario=descent_hd`; inspected gameplay evidence is under `output/portal-no-foot-qa/`, with the revealed portal at `(6,6)` and no reported browser diagnostics.

## 2026-07-15 — Fresh HD menu hides gameplay HUD

- Traced the startup composition regression to the ordinary `menu` phase continuing to build profile HUD data while the HD layout kept the live panel/board shell visible. The in-run pause menu intentionally shares the same phase but is distinguished by `menuOpenedFromRun`.
- Added an explicit `main-menu-only` body state only for a non-pause main menu. It hides Player/Info panels, log, canvas, rails, skills, controls, title bar, and footer, while stretching the menu overlay across the available framed viewport.
- Pause behavior is unchanged: opening the menu from an active run does not apply `main-menu-only`, so its live HUD remains visible.
- Regression and pause tests pass 3/3; `game.js` syntax passes. The supplied game client smoke passes after dismissing boot.
- Full-page Playwright inspection confirms a centered standalone menu with no gameplay HUD. Evidence: `output/playwright/main-menu-only/fresh-menu-final.png`. The only console entries are the pre-existing missing `favicon.ico` 404s.

## 2026-07-15 — Stable initial HD reveal

- Traced the intermittent Classic-to-HD flash to the boot screen revealing the application before asynchronous HD renderer initialization had settled.
- The first reveal now waits for the initial graphics-mode promise. Successful HD startup is shown directly as HD; failed or unavailable HD initialization still resolves safely to the Classic fallback instead of leaving the boot screen stuck.
- Regression, graphics-toggle, pause-menu, and HD overlay checks pass 11/11; `game.js` syntax passes.
- A throttled cold-start browser test confirmed that 50 ms after dismissing boot, while the renderer still reported `legacy`, the application remained hidden and the boot screen remained visible. The final revealed state was HD, with zero console errors or warnings.
- Full-page evidence: `output/playwright/boot-hd-stability/slow-load-final.png`.

## 2026-07-15 — HD Merchant consumables overlap fix

- Reproduced the overlap with long Epic-to-Legendary skill offers. The skill-description rule used `strong + span`, but a hidden `<br>` sits between those elements, so descriptions wrapped and the Skills section overflowed into Consumables.
- Corrected the HD-only selector to target the description span through the row structure. Long descriptions now remain on one ellipsized line while their full text stays available through the existing tooltip.
- The long-offer browser reproduction reports `overlap: false`; Shield ends above Consumables. Visual evidence: `output/playwright/merchant-overlap/after-long-legendary.png`.
- Merchant contract test and `game.js` syntax pass. The supplied game client also completed the Merchant interaction smoke with the player on the Merchant tile and no reported client errors.

## 2026-07-15 — HD Merchant relic buyback redesign

- Audited the buyback screen against the HD Merchant dashboard. The generic vertically centered selection layout produced excessive dead space, weak hierarchy, passive-looking rows, and prices buried inside sentence copy.
- Added a dedicated compact Buyback composition: top-aligned section summary, explicit 50% valuation rule, available-item count, two-column relic cards, and a separated `SELL 1 / GOLD` action area with stronger keyboard focus.
- Added the deterministic `merchant_buyback_hd` scenario for repeatable visual and interaction QA.
- Browser interaction passed: selling slot 1 changed gold from 861 to 911 and removed the relic row; `V` returned to the Merchant dashboard.
- Merchant, scenario, startup-menu, and HD overlay regression tests pass. Syntax and `git diff --check` also pass. Before/after evidence is under `output/product-design/merchant-buyback-audit/`.

## 2026-07-19 - HD checkpoint cleanup

- Kept the standard common portal at the intended 96x96 bottom-center runtime presentation; special-room portals remain unchanged.
- Updated stale contracts to include four intentional full-room biome backgrounds and the Warden burst-range snapshot enrichment used by HD VFX.
- Corrected two stale 128x128 portal assertions to the intended 96x96 contract. A headed descent_hd smoke shows the revealed portal at (6,6), correctly grounded and unclipped, with matching text state and zero browser diagnostics. Evidence: output/playwright/hd-portal-size-correction/.
## 2026-07-19 - Unified HD menu navigation and Camp relic management


- Added one HD-only spatial focus controller for Camp, Merchant, Merchant Buyback, Forge, Pact, relic drafts, swaps, and Emergency Extract. Arrow keys move between visible controls, Enter activates the selected control, pointer/focus input stays synchronized, and scrollable menus keep the selection visible.
- Kept Classic hotkeys as a compatibility path while replacing their primary HD presentation with arrow/Enter guidance and a visible gold focus treatment.
- Expanded Camp to four tabs: Upgrades, Mutators, Elixirs, and Relics. Relics are retained after extraction and can be sold one copy at a time from Camp with a two-step confirmation; the mandatory post-extract exchange no longer opens.
- Legacy saves paused on the old post-extract relic prompt migrate safely into Camp > Relics without losing carried relics.
- Added missing interactive contracts for Pact choices, Merchant Buyback rows, and explicit confirm/cancel rows for Emergency Extract.
- Syntax, diff hygiene, and focused HD Camp/Merchant/Relic/Forge/overlay/navigation tests pass.
- Headed QA confirms Camp relic selection and two-step sale, Merchant Buyback movement, Pact movement, and Forge left-to-right movement. The directional score was corrected after QA caught Forge selecting the diagonal Leave action. Evidence: output/playwright/hd-menu-navigation/asserted/.
## 2026-07-19 - Ember Sanctuary Camp HD redesign

- Implemented the user-selected first Camp concept: dedicated campfire sanctuary art on the left and the complete interactive Camp interface on the right.
- Added `assets/hd/ui/camp/ember-sanctuary-background.png` and reused real HD status/relic raster icons for Camp stats and item rows.
- Removed the generic full menu frame, widened the preparation area, simplified the footer to one primary Start Next Run action plus one contextual hint, and kept unavailable options readable with explicit missing-gold states.
- Separated active-tab green from keyboard-focus gold and disabled Camp tooltips that obscured adjacent rows.
- Preserved all four tabs, Classic hotkeys, relic sale confirmation, and the HD arrow/Enter controller.
- Fixed a geometry-sensitive navigation regression by capping the inverse-distance angular penalty; final ArrowDown targets are Upgrades 1, Mutators 1, Elixirs 6, and Relics 6.
- Headed QA passed all tabs at 2048 x 1152 and responsive layout at 1440 x 900 with one focus, no overflow, all icons loaded, and no browser diagnostics.
- Design comparison and QA evidence: `output/product-design/camp-ember-sanctuary/`; final result is recorded in `design-qa.md`.

## 2026-07-19 - Camp ornament and paired-row navigation follow-up

- Replaced the plain Camp ledger edge with the existing Abyssal Gothic board-frame raster and textured item surfaces.
- Rebuilt Start Next Run as a wider, taller ornamental plaque using the existing section-plaque, panel texture, and shrine icon assets.
- Added explicit row/column coordinates to Camp cards so horizontal arrows move between paired columns instead of drifting into tabs.
- Reproduced and fixed the reverse-direction `Number(null) === 0` edge case by excluding controls without Camp grid coordinates.
- Headed QA passes all tabs, `Vitality -> Potion Strength -> Vitality`, one-focus state, icons, diagnostics, and overflow checks at 2048 x 1152 and 1440 x 900.
- Final comparison evidence is under `output/product-design/camp-ember-sanctuary/`; `design-qa.md` ends with `final result: passed`.

## 2026-07-19 - HD welcome screen redesign

- Replaced the colorful HD boot composition with a dark abyssal-gothic dungeon gate while preserving the original arch, chest, torch, skull, weapon, and potion motifs.
- Kept the original raster logo and Classic boot screen unchanged; HD uses a separate semantic DOM title and dedicated stylesheet.
- Added restrained bone, aged-metal, and ember accents plus a gothic start plaque, vignette, reveal motion, mobile sizing, and reduced-motion handling.
- New generated background asset: `assets/hd/ui/boot/abyssal-gate.png`.
- Playwright verified the 1920 x 1080 composition, HD resource loading, and the Enter transition from boot to menu.

## 2026-07-19 - Underground Curio Market Merchant HD redesign

- Replaced the generic centered HD Merchant modal with an environmental Underground Curio Market: generated merchant-stall art occupies the left scenic zone and a complete responsive ledger occupies the right.
- Added `style-hd-merchant.css` plus `assets/hd/ui/merchant/curio-market-background.png`; the dashboard now uses category plaques, real raster item/relic icons, explicit price/action columns, visible descriptions, and one gold keyboard focus.
- Extended the same visual system to Buyback, Black Market, Legendary Exchange, and relic replacement states without changing their gameplay rules.
- Kept Classic isolated: it retains the Merchant title, legacy wallet summary, tooltip-backed rows, numeric keys, and original section markup.
- Headed QA passed at 1920 x 1080 and 1440 x 900. Buyback sale and return, dashboard arrow navigation, icon loading, focus count, viewport fit, resource diagnostics, and the Classic/HD boundary were verified.
- Contract and hygiene checks pass: `node --check game.js`, `node tests/hd-merchant-screen.test.js`, and `git diff --check`.
- Final visual comparisons and screenshots are under `output/product-design/merchant-curio-market/`; detailed QA ends with `final result: passed` in `design-qa.md`.

## 2026-07-19 - Merchant offer opening freeze regression fix

- Root cause: the HD reserve-offer row referenced block-scoped `slotRelic` after leaving the `if (relicSlot)` block. Real Merchant rooms normally have `merchantRelicSlot`, so opening the dashboard threw `ReferenceError: slotRelic is not defined`; empty-offer and Buyback scenarios did not exercise that branch.
- Fixed the reserve icon lookup to use the in-scope canonical `relicSlot.relicId` and added a contract assertion for this exact expression.
- The regression test failed before the fix and passes afterward.
- A headed continue-save reproduction with a real Fang Charm offer opened Curio Merchant, rendered the 100g offer, kept one HD navigation focus, stayed inside 1440 x 900, and reported zero page errors.
- `node --check game.js`, Merchant/navigation/overlay/curation tests, `git diff --check`, and the supplied web-game smoke client pass. Evidence: `output/playwright/merchant-open-freeze-repro/` and `output/playwright/merchant-open-freeze-fixed-smoke/`.


## 2026-07-19 - Standalone HD main menu frame fix

- Root cause: legacy `body:has(#game.graphics-hd)` selectors carried ID-level specificity, so they overrode the intended `main-menu-only` removal of the HUD and room frames.
- Raised only the standalone menu selectors to the same semantic `:has(#game.graphics-hd)` context; the in-run pause menu remains unchanged.
- Chromium confirms zero outer padding, no `board-frame.png`, the dedicated title backdrop, and no page errors at 2048 x 1152. The supplied web-game smoke client also completed without console errors.


## 2026-07-19 - HD Main Menu title environment

- Replaced the empty standalone menu backdrop with a full-viewport dungeon entrance composition using the existing HD abyssal-gate artwork: arch, torch and chest remain visible on the left while the framed vertical menu occupies the protected right column.
- Added a warm torch bloom, directional vignette, vertical brass divider and card shadow; this applies only to `main-menu-only`, so fresh launch and post-Game-Over return share it while in-run pause remains untouched.
- Chromium visual QA passed at 2048 x 1152 with correct full-viewport bounds and no page errors. The supplied web-game client completed without console errors; visual evidence is `output/playwright/main-menu-title-scene-v2.png`.


## 2026-07-19 - Debug first-time reset control

- Added `F - Fresh First-Time Reset` to the F9 cheat menu System section. It confirms before deleting every `dungeonOneRoom*` localStorage key, then reloads into the boot screen; unrelated origin storage is preserved.
- Debug action rows now expose the existing `data-hd-key` control path, so the reset and other cheat actions can be clicked or keyboard-activated without triggering the menu underneath.
- Playwright verified cancel preserves data, accept removes game data and reloads to the first-launch boot screen, unrelated storage survives, and no page errors occur. `node --check game.js` and the supplied web-game smoke client pass.


## 2026-07-19 - Warden death counsel frame overflow fix

- Root cause: the 955 px Warden counsel card was rendered inside a 552 px absolute board overlay with `overflow: hidden`, clipping the title and half of the row copy despite the card's own width.
- Promoted only the Warden-tip overlay to a fixed full-viewport layer above the HUD and enlarged the framed card target to 1280 x 720 while retaining responsive viewport caps.
- Playwright at 1366 x 768 and 1920 x 1080 confirms the card is fully contained, title and all four rows have no overflow, z-index is above HUD chrome, and no page errors occur. Evidence: `output/playwright/warden-tip-size-fix/`.


## 2026-07-19 - Unified HD tactical guide windows

- Increased Warden counsel typography by roughly 25-30% and corrected its eyebrow separator encoding.
- Restyled every HD tutorial modal (How To Play, Camp, Merchant, Portal, combat, status, skills, economy, and enemies) with the same full-screen gothic frame, larger readable type, responsive multi-column sections, and a scrollable content region.
- Audited HD control copy: Camp and Merchant now document arrow/Enter/Esc navigation, and How To Play no longer advertises Classic-only numeric/T-panel interaction in HD. Classic-specific instructions remain available in Classic mode.
- Static verification: node --check game.js, git diff --check, balanced CSS braces, and both referenced HD frame assets present. Visual browser QA remains for manual verification.

## 2026-07-19 - Dark HD outer-frame backdrop

- Replaced the gray-looking texture outside the capped 16:9 HD game frame with a near-black iron/stone vignette using existing Abyssal Gothic texture assets.
- Added a soft 44px outer shadow and one-pixel dark-metal seam to visually blend the capped game composition into the surrounding viewport.
- Kept the change scoped to `body.graphics-hd-ui:has(#game.graphics-hd)` at desktop widths, so Classic and gameplay content inside the frame remain unchanged.
- Headed 1920 x 1080 comparison confirmed the capped app remains 1680 x 1080, the outer body resolves to `#010202`, the new radial texture is active, and no page errors occurred.

## 2026-07-19 - How To Play utility copy trim

- Shortened the HD How To Play Utility copy to `Open the pause menu or go back.` and `Move between choices and confirm.`; removed explicit HD wording and left Classic copy unchanged.
- `node --check game.js` and `git diff --check -- game.js` pass. The web-game smoke client launched without console errors, but its fresh isolated profile stopped at the mandatory nickname modal before reaching the tutorial; manual visual confirmation remains.

## 2026-07-20 - Riftweaver and Abyss Bulwark HD v2 art pass

- Replaced all 128 placeholder actor frames for Riftweaver and Abyss Bulwark while preserving the existing manifests, clip counts, directions, frame sizes, and runtime keys.
- Replaced all 60 related VFX frames: Spatial Rift telegraph/detonation plus Bulwark guard, shield bash, blocked-hit, and backstab-hit.
- Added approved chroma/alpha source seeds, four normalized direction seeds per enemy, animation/VFX preview sheets, and reproducible generator tools/generate_expansion_enemy_hd_v2.py.
- Asset validation passed: 64 non-empty actor frames per enemy, 12 Riftweaver VFX, 48 Bulwark VFX, transparent corners, stable shared anchors, and no missing manifest paths.
- expansion-art-assets, expansion-content, and expansion-release tests pass. Playwright scenario expansion_enemies_hd loads both new actors without page errors; evidence: output/expansion-enemies-hd-v2-final/shot-0.png.

## 2026-07-20 - Riftweaver and Abyss Bulwark HD v3 animation correction

- Replaced the procedurally transformed actor frames with eight hand-painted 4x4 source sheets containing distinct idle, move, attack, hit, and death poses for all four directions.
- Corrected the HD runtime so a 120 ms movement tween advances through all four move frames and Riftweaver/Bulwark attacks animate continuously while their telegraphs are active.
- Added a reproducible v3 sheet slicer, chroma-keyed alpha sources, and focused frame-timing assertions. `tests/expansion-art-assets.test.js` passes 4/4.
- Playwright scenario `expansion_enemies_hd` loaded both actors from the current dungeon-3.0 server and captured visibly different animation frames without console errors in `output/expansion-enemies-hd-v3-final/`.

## 2026-07-20 - Vault Guardian room HD ability pass

- Added 32 optional 128 x 128 HD frames for sealed and destroyed Vault chests, Hoard Sentence, seal release, and Lockdown Pulse while leaving the Guardian sprite unchanged.
- Added reproducible source atlases, alpha sources, generator, and deterministic lockfile under `art/source/vault-guardian-hd-vfx/`.
- Wired optional manifest entries and procedural fallbacks into the HD renderer; Guardian events now trigger cast, detonation, and seal-break animations.
- Focused syntax, Vault integration, manifest, VFX, loader, visual-snapshot, generator-lock, and asset-contract checks pass.
- Headed Playwright scenario `expansion_vault_guardian_hd` reached gameplay without page errors; evidence: `output/vault-guardian-hd-assets-qa/shot-0.png`.

## 2026-07-20 - Bulwark and Spatial Rift animation stabilization

- Audited alpha bounds and lower-body anchors across every Bulwark direction and clip; the generated frames drifted horizontally by up to 12 px and hit frames floated up to 13 px above the floor.
- Added reproducible per-clip bottom/foot-anchor normalization without regenerating or changing the approved Bulwark model.
- Changed Shield Bash from a continuously looping telegraph animation to held anticipation/recovery poses, with the four-frame action reserved for `castFlash`.
- Horizontally normalized all Spatial Rift telegraph and detonation frames to the fixed 192 x 192 center while preserving vertical eruption growth.
- `tests/expansion-art-assets.test.js` passes 4/4; headed `expansion_enemies_hd` verification is in `artifacts/expansion-animation-fix-final/`.

## 2026-07-20 - Debug Cheats and Observer Cheat Merchant

- Rebuilt Debug Cheats as a full-viewport four-section console; all 32 actions fit at 1920x1080 without section overflow.
- Added direct forcing for Treasure, Shrine, Cursed, Merchant, Ambush, Horde, Duel, Crossroads, and Blood Arena alongside the existing special-room cheats.
- Added Observer Bot unlimited gold and a queued Cheat Merchant room with a free full catalog of 58 relics; manual selection and bot scoring both use normal relic legality rules.
- Verified with node --check game.js, node tests/debug-cheat-menu.test.js, the web-game Playwright client, and headed 1920x1080 browser checks. No page or console errors were reported.
## 2026-07-20 - Warden cast animation pacing

- Audited HD Warden spell animation timing: four cast frames were compressed into 100-140 ms while idle used 4 FPS and movement 8 FPS.
- Extended Warden-only cast presentation to 360 ms (90 ms per frame) for ranged casts, Void Aegis, Rift Lattice, Void Step, Doom Sigils, and Soul Chain. Gameplay turns, cooldowns, telegraphs, and damage timing are unchanged.
- Playwright scenario warden_phase2_aegis_hd captured a stable multi-frame cast sequence with no console errors. The focused boss suite passed 8/10; its two failures are existing stale manifest-count and phase2-key expectations unrelated to timing.
## 2026-07-20 - Riftweaver and Abyss Bulwark animation re-audit
- Confirmed two runtime causes: Riftweaver looped its full attack strip every 110 ms throughout the multi-turn rift telegraph, while Bulwark rendered its guard overlay unconditionally every 150 ms and treated generic `rests` as an attack state.
- Expansion-enemy special actions now play once across 320 ms (80 ms per frame), then hold a restrained anticipation pose until resolution; the shared movement and idle timing for other enemies is unchanged.
- Bulwark guard art is now limited to Shield Bash aiming and held on telegraph frames instead of free-running; `rests` alone returns Bulwark to idle. The HD showcase no longer injects a permanent `rests` state.
- Targeted test: `node --test --test-isolation=none tests/expansion-art-assets.test.js` (4/4 pass). Default Node test isolation was blocked by Windows `spawn EPERM`.
- Visual preview: `artifacts/rift-bulwark-animation-audit/shot-0.png` through `shot-2.png`; scenario `expansion_enemies_hd` rendered without browser errors.
## 2026-07-20 - Cheat Merchant multi-relic selection
- Removed the one-relic-per-room claim lock from manual and Observer Bot Cheat Merchant purchases.
- The catalog now remains open after each manual claim, allowing relic selection until the normal 8-slot base inventory cap (including existing expanded-cap rules); the Observer Bot keeps selecting its best legal relic on subsequent actions until no legal slot remains.
- Updated Cheat Merchant copy to communicate multi-pick behavior. Targeted `node tests/debug-cheat-menu.test.js` passes.
## 2026-07-20 - Mythic HUD border and Oath of Ruin bot stall fix
- Added the missing cyan Mythic rarity border, dark-cyan slot surface, and glow to the HD 8-10 relic inventory grid.
- Root cause of the Oath of Ruin Observer stall: potion actions remained eligible during `oathPotionLockTurns`, and the rejected `drinkPotion()` call was incorrectly reported as a successful bot action.
- Centralized Observer potion legality in `bot-safety.js`; Oath-locked potion actions are excluded from blast preparation, candidate scoring, and execution, and execution now reports success only after HP or potion count changes.
- `status_emblems_hd` now includes Oath of Ruin with an active potion lock for repeatable QA. Bot safety, HD left HUD, and scenario override tests pass.
- Browser QA reached `graphics-hd` without console errors. Computed Mythic border is `rgb(102, 228, 242)` with the expected cyan glow; artifacts are in `artifacts/mythic-oath-fix/`.
## 2026-07-20 - Abyss Bulwark HD scale
- Increased only the HD Abyss Bulwark render size from 88 px to 114 px (about 30%), preserving bottom anchoring, gameplay hitbox, stats, and Classic rendering.
- Playwright expansion_enemies_hd visual preview confirms the Bulwark reads larger than the player without clipping or console errors; artifacts: artifacts/bulwark-size-30/.

## 2026-07-20 - Generated hazards avoid the top playable row
- Random spikes, mines, flame vents, and frost runes now use y >= 2 in regular and boss rooms; Vault hazard candidates also begin at y = 2. Enemy placement is unchanged.
- Playwright expansion_traps_hd preview rendered the complete hazard set without console errors; artifacts: artifacts/hazard-top-row-fix/.


## 2026-07-20 - Endgame Warden staggered Rift Lattice
- Depth 80+ Abyssal Warden now casts single Rift Lattice A, casts single Rift Lattice B at the player's updated position on its next action, then detonates A and B on consecutive actions. The 5-turn cooldown starts only after B detonates; Collapse Warden at depths 60-79 keeps its existing single cast.
- Removed the simultaneous predicted extra line. Endgame boss rooms now spawn 2 forced elite adds instead of 3.
- Added a deterministic expansion_warden_lattice_sequence_hd QA scenario. Runtime states verified as A(2T), A(1T)+B(2T), B(1T), then no active pattern with cooldown 5. Targeted boss campaign, integration, release, and visual snapshot tests pass; artifacts: artifacts/warden-lattice-sequence/ and artifacts/warden-lattice-sequence-final/.


## 2026-07-20 - No elite Riftweaver in endgame boss rooms
- Boss add selection now rejects Riftweaver at depth 80+, while regular rooms and boss rooms below depth 80 retain the existing Riftweaver rules.
- Added expansion_endgame_boss_adds_hd for deterministic roster QA. At depth 85 it produced Abyssal Warden plus two elite adds (Skeleton and Acolyte), with no Riftweaver or console errors; artifacts: artifacts/endgame-boss-adds-no-riftweaver/.

## 2026-07-28 - Online v3 production release

- Deployed Online v3 to `https://dungeon-of-one-room.pages.dev` from verified source commit `7645e80`; final Pages deployment is `a218de92-6f9d-4301-a322-219c28a4f9a5`.
- Created the Free-plan production D1 `dungeon-online-v3-production` in WEUR and applied migrations 0001-0003; old v2 and older databases were not modified.
- Activated only `v08-meta-1` at `sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6` through private Worker `dungeon-online-v3-production`.
- Final gates passed: threat matrix 30/30, phase 706/706, baseline 3/3 plus headed smoke, and full 730/730 including 21/21 local Wrangler/D1 E2E.
- Production headed smoke passed menu labels, Practice with zero API calls, Ranked start, starting relic, first canonical room, resume, checkpoint, next room, leaderboard, and zero browser errors.
- Smoke run `run_d59efc9a79ce4ceb924c7cb9a53049de` was verified read-only in production D1 at revision 2, depth 1, room 2.
- No staging, Access gate, tester list, paid plan, soak, canary, M5, force push, or unrelated-history merge was performed.
- All 172 Vault Guardian deletions remain unstaged and outside the deployment.

## 2026-07-28 - Online v3 production UI hotfix

- Deployed native Online v3 menu integration, player-facing relic cards and copy,
  and automatic ordinary checkpoints to `https://dungeon-of-one-room.pages.dev`.
- Added a v2-style boot loading bar; after the first input, all keyboard and
  pointer input remains blocked until assets are ready and the boot fade is
  completely hidden.
- Final source commit is `797499d`; final Pages deployment is
  `2c5bab5b-e9fa-4446-b946-f3cb00df44de`.
- Final gates passed: threat matrix 30/30, phase 709/709, baseline 3/3 plus
  headed Practice/Ranked smoke, and full 733/733 including 21/21 Wrangler/D1 E2E.
- Production smoke passed Practice with zero API calls, Ranked start/resume,
  automatic checkpoint, next room, leaderboard status 200, and zero API,
  console, or page errors. Smoke run:
  `run_0f41876d60ee4a6e92996322b23945b1` at revision 2.
- Source `game.js`, ruleset hash, gameplay, Worker/D1, mode names, and combat
  authority remain unchanged. No staging, push, rollback, paid service, or M5.
- All 172 Vault Guardian deletions remain unstaged and outside the commits and
  deployment bundles.

## 2026-07-28 - Online v3 production portal synchronization hotfix

- Fixed the second-room portal block: the real Ranked descent now notifies the
  Online v3 runtime after `buildRoom()`, so the session returns from
  `ENTERING_NEXT_ROOM` to `ROOM_ACTIVE` before the next clear.
- Added a regression that clears and crosses two consecutive real player
  portals instead of using the bridge shortcut; the headed artifact reaches
  Depth 3 at `output/online-v3-m4-ranked-headed/ranked-two-player-portals.png`.
- Commit `1dc325c` deployed to production as Pages deployment
  `2aa78b63-90d7-444e-a78f-3f960b3ea3be`.
- Production smoke run `run_5c348fefba484959ae81d41a711808a0`
  crossed Depth 1 -> 2 -> 3 through two checkpoints and real portals with zero
  API, console, or page errors, then finalized normally.
- Gates passed: threat matrix 30/30, fast 39/39, phase 709/709, baseline 3/3
  plus headed smoke, and full 733/733 including 21/21 Wrangler/D1 E2E.
- Source `game.js`, ruleset hash, gameplay, Worker/D1, mode names, and combat
  authority remain unchanged. No staging, push, rollback, paid service, or M5.
- All 172 Vault Guardian deletions remain unstaged and outside both commits and
  the deployment bundle.

## 2026-07-28 - Online v3 complete-state production redeploy

- Rebuilt Pages from clean complete-state commit `0e2bb6f` and confirmed the
  deployable `game.js`, UI/runtime modules, and styles were byte-identical to
  the files already served by production.
- Redeployed the complete state to the existing production project as
  `b9053e9a-c5c0-4784-87ce-ecddb5a32d86`.
- A fresh-profile headed audit confirmed `Practice (Offline)`,
  `Ranked (Online)`, and `Ranked Leaderboard` as native menu rows; the former
  floating controls exist only as hidden compatibility nodes with
  `display: none`.
- Post-deploy browser diagnostics reported zero console and page errors.
  `verify:fast` passed 39/39 and the focused production release suite passed
  4/4; the deployed asset bytes are unchanged from the previously verified
  733/733 full release bundle.
- No gameplay, Worker/D1, ruleset, mode name, push, staging, rollback, paid
  service, or M5 change was made. All 172 protected Vault Guardian deletions
  remain unstaged and outside the deployment.
## 2026-07-28 - Native Ranked extraction and Camp production hotfix

- Removed the player-facing Ranked Extraction, manual Finalize, finalized, Open
  Camp, and separate Ranked Camp list from the normal lifecycle.
- Online v3 now performs canonical extraction/finalization in the background and
  reuses the original v0.8 Camp UI plus native Start Next Run.
- Commit `6e90aa0` is active as production Pages deployment
  `2d7c68be-1430-4f7c-ba81-5416f00193a9`.
- Threat matrix 30/30, fast 39/39, phase 709/709, baseline 3/3 plus headed
  smoke, full 733/733, focused headed lifecycle, and public production smoke all
  passed.
- Source `game.js`, ruleset, Worker/D1, gameplay tables, mode names, combat
  authority, and all 172 protected Vault Guardian deletions remain unchanged.

## 2026-07-28 - Ranked recovery acknowledgement production hotfix

- Fixed the stuck reconnect flow after a canonical Abandon succeeded but its
  browser acknowledgement was lost.
- A later authenticated Abandon with a new operation ID now returns the
  existing abandoned state as an idempotent success without changing revision
  or publishing a result.
- Commit `044839a` is deployed as Worker version
  `8e44d059-717c-4c6b-8cd9-591ed7c1bc1a`.
- Threat matrix 30/30, fast 39/39, phase 709/709, baseline 3/3 plus headed
  smoke, and full 733/733 all passed.
- Production smoke `run_0c4b6e458ce543eb86de3fd5deb97341` confirmed first
  Abandon 200, recovery Abandon 200 with a new operation ID, unchanged revision,
  `abandoned` persistence, and zero leaderboard rows.
- Pages, `game.js`, ruleset, D1 schema, gameplay, mode names, combat authority,
  and all 172 protected deletions remain unchanged.
2026-07-28 - Production ended Ranked recovery restart hotfix
- Fixed the post-Abandon reconnect loop: terminal recovery responses now show `Ranked Run Ended` with `Start New Ranked Run` instead of Resync/Abandon controls.
- Fixed exact start retry so recovery and single-writer ownership are established before Ranked begins.
- Added unit and headed regression coverage for lost Abandon acknowledgements, terminal resume 410, and a distinct restarted run.
- Code/test commit: `3d68783`; production Pages deployment: `071e6723-8222-4e42-9d7b-bca60e73b763`.
- Verification: threat matrix 30/30; fast 40/40; phase 710/710; baseline 3/3 plus headed smoke; full 734/734; focused headed lifecycle PASS.
- Public production headed smoke PASS; final test runs abandoned with zero leaderboard rows and zero unexpected browser errors.
- One revision-0 synthetic preflight run remains nonpublishable and is left to normal retention because its ephemeral recovery credential was lost when the helper exited.
- Ruleset and source `game.js` hashes unchanged; Worker/D1 schema/gameplay/mode names unchanged; 172 protected deletions untouched; no push, staging, rollback, paid service, or M5 work.
## 2026-07-28 - Practice/Ranked menu and recovery production hotfix

- Added `Main Menu` to the Practice pause menu while preserving the native
  Practice Continue snapshot and fixed mouse selection in the native
  `Start New Game / Load Continue / Cancel` prompt.
- Removed the ambiguous standalone Continue row; Practice and Ranked now expose
  separate save choices, and Ranked always opens an explicit
  `Start New Ranked / Continue Ranked / Cancel` screen.
- Closed terminal and invalid-recovery escape paths, released writer ownership
  on main-menu exit, and kept canonical Abandon ahead of replacing a Ranked run.
- Code/test commit `86cda91`; production Pages deployment
  `6d91dd40-0a75-4f8c-86a3-2c3ff22e468c`.
- Threat matrix 30/30, phase 712/712, baseline 3/3 plus headed, full 736/736,
  final Ranked headed lifecycle PASS, and public zero-API menu smoke PASS.
- Source `game.js`, ruleset, Worker/D1, gameplay, mode names, 172 protected
  Vault Guardian deletions, and the R1-P0-001 boundary remain unchanged.

## 2026-07-28 - Ranked reward/death presentation regression fix started

- New request: fix the player-reported early relic offer after an ordinary
  combat clear and the missing death screen/audio after a nonterminal Ranked
  life loss.
- Confirmed reward root cause: after an ordinary checkpoint, the response
  already contains the next directive and its reward envelope; the runtime
  consumed that upcoming room's relic slot before installing/entering the
  directive.
- Confirmed death root cause: the Ranked `gameOver` branch returns before the
  native death presentation, while `resumeAfterFatal` immediately rebuilds the
  next room.
- Baseline before edits: `main@af9b46f`, source `game.js` SHA-256
  `556829c909cdc9eaefb4238279457eb9b3427adef9ce494f35743542770ee7de`,
  ruleset `sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6`,
  and 172 unstaged protected deletions with path/status fingerprint
  `3350fde4b0f51e8c82607fe35c413de2849d46d171c793bb6ffd18ee08c3c08c`.
- Scope is local-only. Source `game.js`, Worker/D1, ruleset, Practice, and the
  protected deletions remain outside the implementation.

## 2026-07-28 - Ranked reward/death presentation regression fix complete

- Core commit: `9f60eaa` (`Fix Ranked reward and death presentation`), six files,
  204 insertions and 9 deletions. A later separate local recovery commit
  `c091b7c` contains the combined headed lifecycle coverage.
- Upcoming-room Warden/Otter/Arena relic slots now remain hidden until their own
  room has a real pending local clear.
- Accepted nonterminal Ranked life loss now holds the native v0.8 `You Died`
  presentation, invokes `assets/death.mp3`, shows the canonical relic loss, and
  waits for R/Enter before building the next canonical life. Server-prevented
  fatal events continue without a false death screen.
- Focused RED: 8/11 PASS with the three expected failures. Focused GREEN: 11/11.
- Headed Ranked lifecycle: PASS with a real ordinary-to-Warden boundary,
  post-Warden reward, native nonterminal death, death-audio invocation, R
  continuation, zero unexpected console errors, and zero page errors.
- Final verification on current `HEAD`: fast 44/44; phase 717/717; baseline 3/3
  plus headed smoke; full 741/741, including Wrangler/D1 21/21 and headed smoke;
  `git diff --check` PASS.
- Source `game.js` remains SHA-256
  `556829c909cdc9eaefb4238279457eb9b3427adef9ce494f35743542770ee7de`;
  source `game.js` and `index.html` have no diff from the initial `af9b46f`.
  Ruleset remains
  `sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6`.
- All 172 protected Vault Guardian deletions remain unstaged, with zero protected
  staged paths and no protected path included in either local commit.
- This task performed no push, deploy, staging, canary, soak, ruleset activation,
  migration, rollback, paid-service, or M5 action.
## 2026-07-28 - Ranked reward/death and stale-profile hotfixes completed

- Committed the local reward/death presentation fix as `9f60eaa` and the
  direct start/stale-profile recovery fix as `c091b7c`.
- Focused regressions pass: offers 6/6, production release 5/5, and
  client/recovery 14/14. The supplied headed lifecycle passes stale-profile
  repair, compact saved-run UI, reward-boundary ownership, native nonterminal
  death presentation, network loss, reload, multi-tab, and Camp.
- R2 threat matrix remains 30/30. `verify:fast` is 44/44, `verify:phase` is
  717/717, `verify:baseline` is 3/3 plus headed smoke, and `verify:full` is
  741/741 including 21/21 local Wrangler/D1 E2E.
- Built the exact source commit in an isolated worktree and deployed Pages
  production as `2eeead39-2f33-4f75-818e-5d9909bbb3a8` on the existing `dungeon-of-one-room` project.
- Public production smoke passed a real stale-profile rejection and automatic
  retry, reached the starting relic without reconnect, and canonically
  abandoned the repaired run. Remote D1 confirms `abandoned` and zero
  leaderboard rows.
- Source `game.js`, the ruleset hash, Worker/D1 behavior and schema, gameplay,
  Practice storage, mode names, combat authority, and R1-P0-001 are unchanged.
  No push, staging, paid service, or M5 work occurred; all 172 protected Vault
  Guardian deletions remain untouched and unstaged.

## 2026-07-28 - Ranked browser-storage recovery hotfix validated locally

- Reproduced the reported `Ranked Unavailable` screen with Chromium localStorage
  saturated to `QuotaExceededError` code 22; the failure happened before any
  `/api/v3/runs/start` request.
- Added safe one-retry reclamation for only retired `dungeonRankedV2Active` and
  the Online v3 leaderboard cache. Practice v3/v2 sentinels and unrelated
  storage remain preserved; insufficient space now has an explicit error.
- Failed-start cleanup now tolerates quota failure before a local session exists
  and cannot redirect that case into reconnect recovery.
- Focused GREEN 18/18; saturated-storage headed Ranked lifecycle PASS and was
  visually inspected at the native starting-relic screen.
- Threat matrix 30/30, fast 45/45, phase 721/721, baseline 3/3 plus headed,
  full 745/745 including local Wrangler/D1 21/21; `git diff --check` PASS.
- Source `game.js`, ruleset, Worker/D1, gameplay, mode names, Practice behavior,
  R1-P0-001, and all 172 protected deletions remain unchanged.
## 2026-07-28 - Ranked browser-storage recovery deployed and verified

- Code/test commit `3d76ea6`; production Pages deployment
  `47048250-f120-45c2-92e7-344cdb34c27f` on the existing project and `main`.
- Public saturated-storage smoke passed `201 start -> 200 abandon`, preserved
  both Practice sentinels, reached the native starting-relic screen with zero
  console/page errors, and was visually inspected.
- Remote D1 confirms `run_46b7c3ab52d649e8a0ddc32f14aedcd4` is abandoned
  at revision 1 with zero leaderboard rows. One assertion-stopped revision-0
  preflight has no relic or leaderboard row and remains under normal retention.
- No Worker/D1 schema or behavior change, gameplay change, push, staging, paid
  service, or M5 work occurred; all 172 protected deletions remain untouched.
## 2026-07-28 - Ranked extraction and Camp continuation deployed

- Reproduced the cleared-room Q race and the positive Camp Gold next-run failure.
  The latter was the exact Worker rejection `CAMP_GOLD_LEDGER_TOTAL_MISMATCH`.
- Worker profile boundaries now normalize the canonical net Camp balance without
  a ruleset-hash change. Existing legacy zeroed ledgers work without deleting
  cookies, while normal extraction and Camp writes persist a consistent ledger.
- Cleared-room Q waits for its checkpoint and remains normal extraction; fresh
  Ranked start resets only transient Ranked state when no recoverable run exists;
  failed Camp start `Main Menu` reaches the native Main Menu.
- Internal commits: `0794906` and `b107e3a`. Production Worker version
  `4ab7c6be-9fea-4bc3-aa37-c1687143cd55` is at 100%; Pages deployment is
  `4eebd3c0-2065-4474-8630-946fed56df7e` on `main`.
- Focused 12/12, threat matrix 30/30, fast 45/45, phase 723/723, baseline 3/3
  plus headed smoke, and full 747/747 including Wrangler/D1 21/21 all pass.
- Dedicated headed QA passed checkpoint+Q, native Camp, positive-gold next run,
  and failed-start Main Menu with zero console/page errors. Public build hashes
  match the verified bundle.
- Production smoke `run_cd9b7be2195b41d7a2fe2d901646a49a` is abandoned at
  revision 1 with zero leaderboard rows. One revision-0 assertion-preflight run
  remains incapable of publishing and is left to normal retention.
- Source `game.js` and ruleset hash remain unchanged; there was no D1 migration,
  push, staging, paid service, rollback, or M5 work. All 172 protected Vault
  Guardian deletions remain untouched and unstaged.
## 2026-07-29 - Native Ranked Merchant flow deployed

- Reproduced the automatic generic Merchant overlay and traced the reconnect /
  `still resolving` loop to `onRoomEntered` opening the canonical offer before
  the player interacted with the Merchant.
- Commit `c313e52` keeps Merchant room entry native, opens the existing
  `Curio Merchant` screen only on `E`, commits canonical opaque transactions,
  and closes the room with exactly one leave plus checkpoint before portal
  entry. Commit `ad5fdac` stabilizes an existing render-frame QA assertion.
- Dedicated headed keyboard QA passed native entry, one skill purchase, menu
  close, portal, and next Combat room with zero console/page/network errors.
- Threat matrix 30/30, fast 45/45, phase 723/723, baseline 3/3 plus headed
  smoke, and full 747/747 including Wrangler/D1 21/21 all pass.
- Deployed only Pages production as
  `78d976ff-48b1-40ff-869b-f3e1c8facbe3` from `ad5fdac`; the main URL serves
  byte-identical verified game/runtime assets.
- Source `game.js`, ruleset hash, Worker/D1 behavior and schema, gameplay,
  mode names, combat authority, R1-P0-001, and all 172 protected deletions are
  unchanged. No push, staging, paid service, rollback, or M5 work occurred.

## 2026-07-30 - R2 remaining gameplay-parity defects fixed locally

- Reproduced the real starting-relic reconnect loop as Worker HTTP 500 `META_STATE_INVALID:campaign`; the validator had compared JSON property order after D1 canonical serialization.
- Replaced order-sensitive validation with exact field/value validation and added a persisted-profile regression.
- Added canonical chest fallback gold, potion pickup/use, map fragments, room-clear parity, and Merchant potion synchronization.
- Persisted campaign map progress, one starting relic per campaign, first-Warden relic history, and unlocked start checkpoints across Camp descents.
- Ten map fragments now queue one Vault and the first Warden at a new boss depth guarantees its v0.8 relic offer.
- Added native Camp checkpoint selection and profile-authorized start depths.
- Kept Forge, Merchant, Camp, extraction, final defeat, and Practice on native v0.8 presentation paths.
- Extended boot input locking through load/fade with a short post-fade guard.
- Local Worker diagnostics now expose hidden dev exceptions without changing production responses.

- Dedicated native Merchant headed QA: PASS, one purchase and one portal transition, zero browser errors.
- Visible full Ranked lifecycle: PASS for start, network loss, reload, multi-tab, reward boundary, death presentation, and Camp.
- Threat matrix: 30/30 scenarios covered.
- `verify:fast`: 48/48 PASS.
- `verify:phase`: 736/736 PASS.
- `verify:baseline`: 3/3 PASS plus headed smoke.
- `verify:full`: 760/760 PASS, including 21/21 Wrangler/D1 E2E and headed smoke.
- `git diff --check`: PASS.

- Ruleset: `bfc32eb...99950` -> `08dfa4f9...5d403`.
- Source `game.js`: unchanged at `556829c9...ee7de`.
- Protected Vault Guardian deletions: 172, untouched and unstaged.
- No push, deploy, activation, migration, paid service, or M5 work.

## 2026-07-30 - R2 terminal leaderboard lifecycle deployed

- Extraction no longer publishes; only terminal defeat/victory is public, one
  season/profile row per five-life campaign.
- Campaign identity survives Camp descents and rotates only after terminal
  completion or confirmed abandon.
- Migrations `0004` and `0005` are active. Historical fanout was reduced
  from 30 to 6 campaign rows; five legacy `extract` rows remain preserved in
  D1 but hidden, leaving one public terminal result.
- Final commits: `d49822d`, `b7a6885`, `57091de`, `1fa6ffd`,
  `59512df`. Worker `deacb948-896e-444e-97f3-6fbda14a10b1` is at 100%;
  Pages deployment is `4cab3989-14cc-491d-80b1-9fc0d8bb1ba4`.
- Focused 10/10, threat matrix 31/31, fast 49/49, phase 740/740,
  baseline 3/3 plus headed smoke, and full 764/764 including D1 21/21 PASS.
- Production smoke start/abandon passed at revision 1 with zero leaderboard
  rows; API and three public asset hashes match the verified release.
- Source `game.js`, R1-P0-001, Ranked/Practice gameplay parity, mode names,
  and all 172 protected deletions remain unchanged. M5 was not started.

## 2026-07-31 - Local Ranked entry recovery and keyboard hotfix

- Reproduced the saved-run `Start New Ranked` trap: an abandonment failure from
  the initial menu tried the illegal `IDLE -> RECONNECT_REQUIRED` transition,
  leaving `Ending the saved Ranked run...` visible.
- The runtime now enters `RETRYING` before abandonment; the recovery UI stays
  actionable and preserves the saved run on a real failure.
- Added arrow-key focus cycling for all ordinary Ranked action buttons.
- Added focused and headed regressions: failed abandon exhausts three retries,
  resyncs the same saved run, and a later successful Start New receives a new
  run ID.
- Focused 10/10, headed lifecycle PASS, fast 49/49, phase 742/742, baseline
  3/3 plus headed smoke PASS. Ruleset and source `game.js` are unchanged; no
  push, deployment, migration, activation, or protected-Vault change occurred.

## 2026-07-31 - Ranked Warden checkpoint resource-settlement hotfix

- Reproduced the exact depth 5 Warden failure locally: a legal `potion-use`
  reward claim was settled, then rejected by the room layer's stale
  pre-settlement build snapshot.
- The meta-scope invariant now snapshots after validated settlement while
  continuing to reject any later room-layer build mutation.
- Added direct ruleset, real HTTP, protocol/client compatibility, and headed
  Warden regressions. The headed run consumed a potion, advanced to depth 6,
  and displayed no reconnect overlay.
- Retained the former production ruleset hash for active saved runs while
  rotating new starts to
  `sha256:e4175a6cb29f576a3ad85357a433d6595eb7e9d19a6c5f47ed125ecfe9ae538e`.
- Threat matrix 31/31, fast 51/51, phase 748/748, baseline 3/3 plus headed
  smoke, and full 772/772 including D1 21/21 PASS. Source `game.js`, Practice,
  gameplay, R1-P0-001, M5, and all 172 protected deletions remain unchanged.
- Implementation commit: `499a8e540cba6374a93f6fac003642dfbb02ba0e`.
- Production Worker `fdc2cb95-b5df-4deb-93dd-b08a642bdc73` is at 100%;
  clean Pages deployment `5797e57c-8d9d-4977-9f06-d25d74704dce` is live.
- Independent live checks matched the clean release hashes. Production smokes
  passed for the retained R2 hash, the current hash, and the exact depth 1-5
  Warden checkpoint with canonical potion use and advance to depth 6.
- The initial Pages upload was superseded after hashing exposed a generated
  headed-QA hook; source `game.js` stayed clean and the replacement deployment
  was rebuilt before activation.
- No D1 migration, M5 action, combat-authority change, gameplay/mode-name
  change, or protected Vault Guardian change occurred.
## 2026-07-31 - HD Warden portal forewarning and presentation coherence

- Added an HD-only, lock-backed Warden portal: ordinary portal framing,
  geometry, timing, and motion with crimson inner animation; blue common and
  Otter remain unchanged.
- Local derives the cue from the normal boss-depth boundary; Ranked derives it
  from the already-issued canonical boss/final directive without exposing it.
- Fixed HD HUD/canvas skew: the HD HUD class now follows the actual renderer
  during load, fallback, and mode switching. QA verifies player-visible canvas
  parity through HD -> Classic -> HD.
- Focused 33/33 and local/Ranked headed QA PASS. Baseline guard 3/3 plus headed
  smokes PASS. `verify:fast`/`verify:phase` are blocked before tests by the
  clean-HEAD-reproducible generated source-manifest drift; two `hd-room-assets`
  portal-input failures are likewise clean-HEAD-reproducible and unchanged.
- Ruleset remains `sha256:e4175a6cb29f576a3ad85357a433d6595eb7e9d19a6c5f47ed125ecfe9ae538e`;
  no deployment, Worker/D1, Classic, Otter, gameplay, or protected Vault
  Guardian change occurred.

## 2026-07-31 - Generator determinism and HD portal test-contract repair

- Canonicalized CRLF/LF text bytes for generator provenance and ruleset
  manifest hashing; independent CRLF and forced-LF checkouts now agree.
- Regenerated 35 provenance/manifest artifacts. Candidate ruleset is
  `sha256:72072daa1e807a03ffb2c6198b4c126a41fc69be7ae64c1ea8eabd198999b94c`;
  production remains pinned to released `e417` and the candidate is local-only.
- Updated stale HD portal test fixtures to pass `portal.kind`, retained common
  fallback coverage, and narrowed the baseline exception to the existing 13
  Warden HD portal assets. R2 tests now reject a local-only hash in the
  production client contract.
- Full HD assets 26/26, fast 51/51, phase 749/749, and baseline 3/3 plus
  headed smoke PASS. No deploy, activation, Worker/D1, gameplay, Classic,
  Otter, or protected Vault Guardian change occurred.

## 2026-07-31 - Ranked campaign Run Score carry repair

- Confirmed the legacy/Ranked divergence: v0.8 retains run depth and earned-gold
  score inputs through Extract -> Camp -> next descent, while Ranked previously
  recreated both from zero.
- Added six RED regressions; before implementation they failed 6/6, including
  4486 -> 4992. Focused campaign/finalization/protocol GREEN is 22/22.
- Added canonical profile campaign.scoreCarry, folds it exactly once in the
  real Extract transition, and composes public/final/leaderboard score from
  carry plus the active descent. A finalized Extract snapshot retains its
  already-folded score without double counting. Depth high-water and earned
  gold accumulate through Camp, while spent gold does not lower score.
- Added safe normalization for profiles without the new field, public protocol
  validation, build-bridge score synchronization, and a headed Extract -> Camp
  -> next-run HUD audit that asserts the same canonical public score.
- The generator/check and Pages build pass. Candidate ruleset rotates
  72072daa...9b94c -> 7027a84f...347e8; released production remains
  e4175a6c...e538e and was neither activated nor modified.
- verify:fast 51/51, verify:phase 756/756, clean baseline 3/3 plus headed
  smoke, and verify:full 780/780 including D1 21/21 pass. Source game.js
  is byte-identical; Practice, Classic, Otter, gameplay, local saves, combat
  authority, schema, deployment, and protected Vault Guardian deletions remain
  untouched.
- 53f7f48 is the separate one-file clean-baseline harness prerequisite. No
  D1 history was changed. Historical finalized Extract snapshots could support
  a full score reconstruction, but an explicit D1 read/recompute/write
  backfill decision is required before that operation.

## 2026-07-31 - Ranked score-carry production release

- Promoted commit `068ed1391570ee06b8eddfc3efe61a3b65efc7de`: active production
  ruleset is now `sha256:7027a84ff06d6d9304e3d8e4343dbd6b3071c8bec734fad10b85981fa92347e8`.
  The prior `e4175a6c...e538e` and all older released hashes remain supported
  for saved-run compatibility.
- Deployed Worker version `0b81687c-2686-4ecb-b949-c870703cbee8`, then Pages
  production deployment `4909c859-19b6-4a7f-ac78-f7e9870676e7` from the exact
  promotion commit. Public availability reports the active hash and
  `productionActivated: true`; the public bundle matches the local build after
  expected CRLF/BOM upload normalization.
- Fresh canonical production smoke passed start `201` -> abandon `200` on the
  active hash, with no leaderboard publication. No D1 migration or historical
  backfill occurred. The user confirmed old test campaigns need no recovery;
  testing can start with a fresh Ranked campaign.
- No push, gameplay, Practice, Classic, Otter, local-save, combat-authority,
  schema, or protected Vault Guardian WIP change occurred.

## 2026-07-31 - HD boot renderer synchronization repair

- Reproduced the public regression: fresh 068ed13 sessions painted the
  Classic logo for about eight seconds while the asynchronous HD renderer was
  pending, despite the HD feature flag being enabled.
- Fixed syncGraphicsUiMode so hidden initial boot follows the requested HD
  preference, while settled HUD state continues to follow the actual canvas
  and genuine renderer failure still falls back to Classic.
- Added the pending-boot RED/GREEN regression and final-audit DOM assertions.
  Headed local check: HD UI true, boot visible, HD brand visible, Classic
  logo hidden, app hidden, no page errors.
- Canonical generator refreshed 35 source-bound artifacts. Local candidate is
  sha256:d784208aad891119b71c52324cea358997ee376313914d5799affa68c8678ff3;
  previous deployed sha256:7027a84ff06d6d9304e3d8e4343dbd6b3071c8bec734fad10b85981fa92347e8
  is retained. Registry/bridge contracts were synchronized for the candidate
  without deploying it.
- Focused HD 13/13 and release/R2 14/14 PASS; Pages bundle 3109 files;
  verify:fast 51/51, verify:phase 756/756, verify:full 780/780 including D1
  21/21, and baseline 3/3 plus headed smoke PASS. No push, deploy, D1 change,
  gameplay, Classic, Otter, portal, combat
  authority, or protected Vault Guardian WIP change occurred.

## 2026-08-01 - HD boot renderer production deployment

- User explicitly approved deployment of commit `1eed59c7b3d26ce4e9eff4631e8bef2e95ad4a15`.
- Worker deployed as version `03335954-0a2f-442f-b1e9-ee4b5f127589`; Pages deployment `c9c5a1c8` at `https://c9c5a1c8.dungeon-of-one-room.pages.dev`.
- Stable and immutable Pages URLs returned availability `200`, `productionActivated=true`, and active hash `sha256:d784208aad891119b71c52324cea358997ee376313914d5799affa68c8678ff3`.
- Fresh headed public-browser verification found HD canvas mode, hidden app during boot, hidden Classic logo, visible HD brand, and no page errors.
- No D1 migration, historical backfill, push, or unrelated protected-WIP change was performed.

## 2026-08-02 - Package B headed QA optimization

- Original prompt for this package: `Pakiet B - zdecydowanie tak`.
- Completed the browser-QA split: baseline and Ranked now have independent
  focused current-tree scenarios, while release verification retains both
  complete committed-HEAD browser runs.
- Added `boot|hd|save` baseline scenarios and `recovery|lifecycle|camp` Ranked
  scenarios. Avoidable timeouts now wait for observable UI/runtime state;
  short negative-observation windows remain where absence of network activity
  is the behavior under test.
- Ranked QA builds only `output/pages-test-dist`, marked `QA_ONLY_BUILD.txt`.
  The normal 3109-file release output contains neither that marker nor the
  QA-only boot-readiness hook.
- Baseline reports no longer repeat all protected WIP paths: ordinary changes
  remain explicit, while Vault and `.wrangler` entries are counted. The
  dedicated compact status command remains the fingerprint authority.
- Fresh full headed results: baseline 24.5 s and Ranked 71.0 s. Both passed
  with zero unexpected console or page errors; the focused scenario entry
  points also passed during implementation. Representative boot, pause, Camp,
  next-run, and Final Defeat screenshots were inspected.
- No game, Worker, D1, schema, ruleset, production, deployment, or protected
  Vault Guardian change occurred. Package C was not started.

## 2026-08-02 - Ranked Observer Bot canonical boundary repair

- Added one shared Ranked automation boundary so the Observer Bot pauses local
  movement, special-room actions, and portal descent while Online v3 resolves
  a canonical offer or checkpoint.
- The Ranked runtime now selects stable legal server-issued relic,
  replacement, and meta choices; Forge completes open, choice, and checkpoint
  under the same boundary. Errors halt the bot and remain visible in the
  existing recovery UI.
- Added focused VM behavior coverage for relic/replacement and Forge ordering,
  plus generated-bridge contract coverage. Focused tests passed 9/9.
- Headed Ranked lifecycle passed the real Bot -> canonical Forge -> offer ->
  checkpoint -> portal path, then completed the existing lifecycle coverage
  with zero unexpected console or page errors. The post-portal screenshot was
  inspected.
- verify:guard 14/14, verify:phase 765/765, and the committed protected
  baseline 3/3 all passed. No push, deployment, ruleset activation, or
  protected Vault Guardian change was performed.
## 2026-08-02 - Ranked Practice-parity mutator progression candidate

- Added server-canonical Ranked mutator progression with all ten exact Practice
  thresholds, a bounded one-time Practice import, and a fresh-campaign reset
  that preserves the import receipt while Start Next Run preserves campaign
  progress.
- Ranked Camp now issues additions only for canonically unlocked mutators and
  always issues removals for active mutators. The generated bridge toggles both
  directions and projects unlocks from profile progress, never transient Camp
  offers. Online saves no longer write mutator/meta progress into Practice.
- Canonical checkpoint and transaction events advance kills, elite kills,
  depth, earned gold, Merchant potions, bounded shield uses, and potion-free
  normal extraction. Shield claims remain capped at 18 per room and accumulate
  toward the Practice threshold of 60.
- Candidate ruleset hash: `sha256:bc0d548d204557d0cc0ec7f8a358e18246778a13b27c58f5c6cdd73e73621711`.
  Focused integration: 36/36 PASS; `verify:guard`: 14/14 PASS;
  `verify:phase`: 773/773 PASS. `verify:full` passed Worker 773/773,
  Wrangler/D1 21/21, baseline guard 3/3, and clean committed game baseline;
  it remained FAIL because the clean committed Ranked browser harness detached
  the Ranked menu row during click.
- Focused current-tree Camp QA now passes from a shortened Windows worktree.
  The visible flow imports the exact Practice threshold for Berserker, proves
  only Berserker is unlocked, then performs two canonical Camp refreshes and
  verifies `OFF -> ACTIVE -> OFF` while the mutator remains unlocked. Both
  screenshots were inspected; unexpected console errors and page errors are
  zero.
- No push, deploy, D1 migration, backfill, or ruleset activation was performed.

## 2026-08-02 - Acolyte support-first AI

- Reclassified Acolytes as support units. They now anchor to the highest-priority
  heal or buff target, stay within support range, and close distance when an
  ally needs help outside that range.
- Preserved the solo-enemy fallback: an Acolyte with no ally still uses its
  existing ranged attack behavior. Skeleton and other enemy roles are
  unchanged.
- Added focused positioning and integration regressions. Focused Acolyte and
  pit coverage passed 12/12; production-release and R2 boundary coverage passed
  14/14; `verify:guard` passed 14/14; `verify:phase` passed 776/776; the
  committed protected baseline passed 3/3 and its complete headed smoke.
- Regenerated v08-meta-1 provenance after the protected `game.js` change.
  Local candidate hash:
  `sha256:146cd50a456c293c0e0c9a837c8205fc13364d62e2b0e3b0c1e0f221e3daec65`.
  The production hash remains unchanged and the local candidate is explicitly
  rejected by the production client.
- No merge, push, deployment, migration, backfill, or ruleset activation was
  performed.


## 2026-08-02 - Unified Ranked Leaderboard and Practice Records

- Main-menu Leaderboard now targets only the canonical Online Ranked season.
  Ranked terminal screens route to that same table; Practice terminal screens
  route to local Practice Records without adding another main-menu button.
- Local Practice entries are created only on final defeat or Depth 100 victory.
  Extract and ordinary life loss no longer record a result. New terminal
  entries preserve duration, completed rooms, build, active mutators, and the
  Game Over statistics; old records remain visible with an explicit unavailable
  Build Chronicle notice.
- Ranked and Practice share the Gothic record archive: gold/silver/bronze skull
  podium, ledger rows limited to Rank, Name, Score, Depth, and Gold, clickable
  names plus Inspect build, real relic icons, final statistics, and a
  keyboard-focusable exact mutator tooltip.
- Focused local, production-package, and M4 renderer regressions pass 20/20.
  The current-tree HD browser scenario and Ranked lifecycle both pass; Ranked
  opened the redesigned list and Build Chronicle. `verify:phase` passes
  776/776 and `verify:guard` passes 14/14.
- Regenerated test-only v08-meta-1 provenance after the protected `game.js`
  change. Local candidate hash:
  `sha256:9943c47912764a83eac2b06cc0524471fccd2b49e80c364ef5d894856f724ea6`.
  The committed protected baseline passes 3/3 and its complete headed smoke.
- No push, deployment, D1 migration/backfill, or ruleset activation was
  performed.

## 2026-08-02 - Acolyte, music, and record archive production release

- Pushed verified commit `1c9518d` to `origin/main` by fast-forward.
- `verify:full` passed 800/800, including Wrangler/D1 21/21, the clean
  committed baseline, and the clean committed Ranked lifecycle.
- Built a clean 3109-file Pages bundle with no QA marker or boot hook and
  deployed 3108 files as production deployment
  `aed78800-ae85-47f6-b66f-17abb6473f64`.
- The immutable deployment URL and stable project alias return HTTP 200 and
  active compatible availability. Three changed public assets match the local
  release bundle byte-for-byte.
- The existing Worker version and active production ruleset
  `sha256:bc0d548d204557d0cc0ec7f8a358e18246778a13b27c58f5c6cdd73e73621711`
  remain correct. Remote D1 reports no pending migrations; no migration,
  backfill, Worker rollout, or ruleset activation was performed.

## 2026-08-07 - Ranked reference-plate leaderboard and Inspect repair

- Rebuilt the two Ranked desktop surfaces around cleaned 1536 x 1080 raster
  plates derived from the approved references. All player names, ranks, scores,
  stats, item names, tooltips, and controls remain live DOM content.
- Leaderboard now collects up to 73 authoritative rows through the existing
  opaque cursor, keeps Top 3 visible on every page, and shows ranks 4-73 as ten
  local seven-row pages. The browser client request cap was corrected from 20
  to the Worker-supported 50.
- Inspect Build now shows the crowned player summary, ten ordered real relic
  icons, exactly the seven approved Chronicle values, compact live mutator count
  with the complete keyboard-focusable tooltip, truthful terminal cause, Back,
  and Close. Pacts, skills, camp upgrades, elixirs, and damage statistics remain
  stored but are not rendered on this surface.
- Fixed the escaped upper-left Inspect score by allowing the shared score
  renderer to use the positioned block element. Score numbers and pts units
  keep independent visual hierarchy; single-stack relics no longer show
  redundant Carried copy.
- Ranked headed QA now refuses to accept a Classic canvas with HD overlay CSS.
  It waits for completed HD preload, checks runtime mode plus canvas/body
  markers, and retries only bounded transient Chromium image-decode failures.
  The 73-row visual fixture is served through the real client and parser.
- Final visual evidence is in
  output/verification/ranked-reference-repair/final-leaderboard-full.jpg,
  final-inspect-full.jpg, and final-pages-1-2-10.jpg. The detailed report in
  design-qa.md records final result: passed with no actionable P0-P2 findings.
- Verification: focused reference/UI/style tests 9/9; focused Worker and client
  regressions 36/36; verify:phase 779/779; verify:baseline 3/3 plus clean headed
  baseline; final true-HD Ranked lifecycle PASS with page 1, page 2, page 10,
  Inspect, exact page return, terminal cause, and no browser console/page errors.
- Practice Records, source game.js, D1 schema/migrations, production release
  bindings, and the active production ruleset were not changed. No merge, push,
  deployment, backfill, or ruleset activation was performed.
## 2026-08-08 - Ranked reference-plate feedback calibration

- Recalibrated the desktop HD leaderboard against the approved plate: Rank 2,
  Rank 1, and Rank 3 now use the shield centers, while the six ledger tracks
  share one gap-free grid. Final browser measurements report effectively zero
  horizontal drift for Depth, Gold, and Inspect Build.
- Rebuilt Inspect loadout presentation as icon-only. Ten real catalogue icons
  align to the engraved five-by-two frames; relic name, description, and stack
  count are available through a keyboard-focusable hover tooltip instead of
  visible labels.
- Shifted Run Chronicle copy into the engraved icon gutter and restored the
  intended ledger type size for Depth and Gold. The relic tooltip is centered
  above its icon and remains fully inside the plate.
- Added RED/GREEN DOM and headed geometry regressions for podium centers,
  ledger columns, readable values, icon-only slots, tooltip content and bounds,
  and Chronicle label/value insets.
- Verification: focused reference/UI/style tests 8/8; focused M4 client tests
  7/7; final true-HD Ranked lifecycle PASS; `verify:phase` 780/780;
  `verify:baseline` 3/3 plus the clean committed headed baseline. Final visual
  comparisons and the full iteration history are recorded in `design-qa.md`.
- Mobile Ranked UX remains explicitly deferred. No commit, merge, push,
  deployment, D1 migration/backfill, or ruleset activation was performed.

## 2026-08-08 - Ranked presentation detailed re-audit

- Repeated the desktop visual audit from fresh true-HD captures and compared
  the full Leaderboard and Inspect Build screens side by side with the approved
  source images. Pages 1, 2, and 10 were checked with the Top 3 kept persistent.
- Corrected six remaining P2 details: Inspect stat hierarchy and separators,
  the redundant Close action, terminal text placement, first-row tooltip
  direction, second-row long-tooltip direction, and a Mutators tooltip clipped
  by host overflow.
- Inspect retains ten icon-only real relics with keyboard/mouse tooltips and
  exactly the seven approved Run Chronicle fields. The single Back action
  returns to the exact leaderboard page.
- Final evidence is in
  `output/verification/ranked-detailed-reaudit-20260808/60-leaderboard-accepted-reference-vs-implementation.jpg`,
  `61-inspect-accepted-reference-vs-implementation.jpg`, and
  `62-tooltip-suite-accepted.jpg`.
- Verification: focused tests 15/15; renderer and headed-script syntax PASS;
  final true-HD lifecycle PASS; `verify:phase` 780/780; `verify:baseline` 3/3
  plus clean committed headed baseline.
- Mobile Ranked UX remains deferred. No commit, merge, push, deployment, D1
  migration/backfill, or ruleset activation was performed.


## 2026-08-08 - Ranked reference-plate production release

- Committed the final Leaderboard/Inspect calibration as `ab546dc` and pushed
  it to `origin/codex/ranked-reference-plates`; `origin/main` was not merged or
  changed.
- Verified the exact clean commit with `verify:full` 803/803, including local
  Wrangler/D1 21/21, the clean committed Practice baseline, and the clean
  committed Ranked lifecycle.
- Built a clean 3111-file Pages bundle without the QA marker, test boot hook,
  or the unstaged Forge work. Wrangler uploaded 7 changed files and reused
  3103 existing assets.
- Deployed production Pages release
  `8c77e656-426e-43a8-bc2b-45843fe62cc6` from source `ab546dc`.
- The immutable deployment URL and stable project alias return HTTP 200 and an
  active compatible Ranked availability response. The leaderboard module,
  `style.css`, and both reference plates match the local release bundle
  byte-for-byte on both URLs.
- The production Worker, D1 schema/data, active ruleset, Practice gameplay,
  Forge behavior, and `origin/main` were not changed. Seven unrelated WIP
  files remain preserved and unstaged.
## 2026-08-09 - Leaderboard live-feedback calibration

- Root cause confirmed in true HD at 1536 x 1080: podium ranks were live DOM glyphs; name/meta anchors and two ledger content offsets differed from the approved composition.
- Added RED coverage for baked plaque numerals, accessible Top 3 rank semantics, exact podium anchors, larger/lower metadata, Name +32 px, Depth -32 px, and unchanged Score/Gold/Inspect anchors.
- Baked static 2 / 1 / 3 into the existing leaderboard plate using a measured metallic serif treatment; no other plate region or Inspect asset changed.
- Focused tests passed 9/9; JavaScript syntax passed; Ranked headed lifecycle passed with zero unexpected console or page errors.
- Final comparison evidence: output/verification/ranked-live-feedback-20260809/.
- No commit, push, or deployment was performed.

## 2026-08-09 - Canonical Practice archive and keyboard navigation

- Practice Records now uses the same canonical Ranked leaderboard and Inspect plates while remaining fully local and preserving legacy records without invented details.
- Added shared keyboard navigation for Name/Inspect rows, responsive equipment grids, mutators, Back, Previous Page, Next Page, and Close; native Tab remains available.
- Added exact focus-token restoration across list/detail/page transitions and a safe body fallback when an external opener is unavailable.
- Aligned Name and Depth headings with their live values, optically shifted single-digit Inspect ranks, and replaced small pseudo tooltips with one readable shared panel.
- Migrated current-tree Practice and Ranked browser QA plus the six-image visual fingerprint to canonical sources and selectors.
- Verification: focused archive/client/style/gate tests 41/41 PASS; Practice save browser scenario PASS with zero API requests; direct Ranked lifecycle PASS with keyboard, tooltip geometry, rank 1/9/10/73, and opener-focus assertions.
- Generated Practice and Ranked screenshots were visually inspected; final approval receipt remains intentionally pending explicit review of the six current artifacts.
- No push, deployment, D1 change, ruleset activation, or production-state change was performed.

## 2026-08-09 - HD-only v0.8.2 audit and design

- Created isolated worktree `codex/hd-only-v082` from the completed canonical archive branch.
- Confirmed the current boot eagerly requests more than 100 `assets/sprite/**` Classic images before HD initialization, honors persisted Classic preferences, and renders Classic while HD assets preload.
- Selected a fail-closed HD-only architecture: HD markers before first paint, no graphics selector or preference module, no Classic startup preloads/fallback, and no Classic presentation assets in the Pages bundle.
- Shared gameplay, saves, Online protocol, music, sound effects, historical fixtures, and physical Classic source files remain unchanged.
- Design saved in `docs/superpowers/specs/2026-08-09-hd-only-v082-design.md`; implementation will follow TDD and bump the live game version to `v0.8.2`.

## 2026-08-10 - HD-only v0.8.2 implementation

- Retired the Classic presentation path from live gameplay: the document starts
  in HD, the canvas is 576 x 576, and the graphics preference/toggle is gone.
- The HD controller now stays HD before, during, and after asset loading. Missing
  critical assets fail closed on the boot screen instead of invoking Classic.
- Removed all Classic sprite preload calls and active Classic UI-builder paths;
  the old source definitions and physical files remain only as unreachable data.
- Pages builds now omit assets/logo.png, all assets/sprite/**, and
  render/graphics-preference.js.
- Bumped the live game version and active Online/Ranked fallbacks to v0.8.2.
- Verification passed: focused HD/build/archive tests 89/89, current-tree boot
  and HD browser scenarios, direct HD startup/scenario/reload with zero retired
  asset requests, and the clean committed protected baseline.
- Boot and HD screenshots were visually inspected; no mixed Classic/HD frame,
  missing game chrome, or layout regression was observed.
- The user approved all six canonical Practice/Ranked archive screenshots.
  Their local approval receipt verifies fingerprint
  `sha256:d1947031bc12de3e3cb6036e0d9caa99f7b98c0b6fc6865d7c4235430cd964cd`
  in the prior archive worktree.
- After explicit authorization, regenerated the 34 `v08-meta-1` source-bound
  data files plus `ruleset-manifest.json`. Fresh verification passed:
  generator check, guard 14/14, and phase 781/781.
- `v08-meta-1` remains test-only. No production binding, push, deploy, merge,
  or ruleset activation occurred.

## 2026-08-10 - Remote HD-only browser acceptance

- Fresh current-tree Practice save and Ranked lifecycle browser scenarios passed.
- Ranked QA exposed a stale Classic preference hook in its isolated Pages build;
  added a RED regression guard and migrated the hook to the HD-only ready outcome.
- Generated and visually inspected all six current HD-only archive screenshots.
  Two match the prior approved bytes; four require a new current-tip approval receipt.

## 2026-08-10 - Narrow Practice archive HD skin

- Confirmed the 640 x 1080 Practice screenshot was using a deliberate flat
  responsive fallback: it hid the reference art and removed every HD texture.
- Kept the readable responsive DOM flow, but replaced the flat cards with the
  shared HD board frame, panel texture, section plaque, ranked podium hierarchy,
  styled ledger, and 44 px keyboard/touch actions. The same canonical selectors
  also protect narrow Ranked archive surfaces.
- Added a browser regression that inspects the computed narrow styles and
  requires real `assets/hd/**` presentation on the shell, header, podium,
  ledger, and Close action.
- TDD evidence: the new browser assertion first failed with every computed
  background and border image equal to `none`; after the CSS fix, the focused
  archive/UI tests passed 20/20 and the fresh Practice save scenario passed.
- Final screenshot inspected at
  `output/online-v3-baseline/save/practice-records-list-narrow.png`; no Classic
  asset request, push, deployment, merge, or ruleset activation occurred.

## 2026-08-10 - Final Defeat records focus repair

- Direct pointer activation of the second Final Defeat action already opened
  Practice Records and Ranked Leaderboard on the current HD-only tip.
- Reproduced the reported failure through keyboard focus: ArrowRight changed the
  visible selection to the records action while focus remained on Main Menu, so
  Enter activated the stale focused control.
- Synchronized the selected Final Defeat action with DOM focus, preserving the
  existing shared Online/Practice routing and preventing the focused control
  from disagreeing with the visible selection.
- Added headed regressions for focus + ArrowRight + Enter in Practice and direct
  Leaderboard activation in the terminal Ranked lifecycle.
- Fresh verification passed: Practice save browser scenario, direct Ranked
  lifecycle, focused HD/menu/leaderboard tests 26/26, guard 14/14, and phase
  781/781.
- Regenerated the 34 source-bound `v08-meta-1` data files and
  `ruleset-manifest.json` after the `game.js` fingerprint changed. The
  ruleset remains test-only; no activation, push, deployment, or merge occurred.

## 2026-08-12 - Ranked fatal compatibility Worker hotfix

- Created the clean Worker-only release commit
  `4041faa4836183b819a64a58d0ef351cd07ba020` directly on the live/GitHub
  production base `f67eb9554a1395d8399e23fda6094c6e22d7305d`; stale local
  `main` and the active `mobile-v1` worktree were not used or modified.
- Implemented accept-validate-strip compatibility for production legacy fatal
  payloads. f67 cause-bearing clients and cause-free clients are both accepted;
  `presentationCause` is validated, then removed before applying `bc0d`.
  Stripped and omitted cause produce identical canonical state, digests,
  checkpoint tokens, and terminal summaries. Unexpected internal failures
  remain 500-class.
- Fresh release verification passed 815/815 from exact clean commit `4041faa`.
  Candidate override and post-promotion smoke covered malformed-cause 422,
  cause-bearing and cause-free fatal events, replay/conflict behavior, Resume,
  and cleanup; all disposable diagnostic runs were abandoned.
- Uploaded Worker version `b03cb1ae-25e2-458f-8297-6aeeb298778d`, completed
  inactive, 5%, and 25% candidate checks, then promoted it to 100% in final
  deployment `cc896f3f-eb6f-40ba-989f-663e423af6c7`. The recorded rollback
  version remains `19b9174c-f720-4484-8f7b-c0918215c29b`; no rollback was
  required.
- The active ruleset remains
  `sha256:bc0d548d204557d0cc0ec7f8a358e18246778a13b27c58f5c6cdd73e73621711`.
  Pages stayed unchanged at deployment
  `4236fef9-1e2d-4e6c-aac8-752cc2f71b55` from source `f67eb95`; no visual
  receipt changed. D1 had no migration, backfill, restore, or schema/data
  release action and still reports `No migrations to apply`.
- Remote source provenance is the release branch
  `codex/ranked-fatal-worker-compat` plus annotated tag
  `online-v3-worker-production-2026-08-12-4041faa`, which anchors the exact
  deployed source commit rather than local `main`.

## 2026-08-11 - Mobile standards repair pass

- Original user request: approve the audited repair pass for mobile appearance
  and functionality, fixing every confirmed standards gap without changing
  gameplay rules or desktop HD composition.
- Made the portrait rotate gate a true modal boundary: gameplay, boot, and any
  existing screen overlay become inert; forward and reverse Tab stay trapped;
  landscape restores the previously focused gameplay control.
- Consolidated announcements into one atomic live game-status region with
  change-only updates, and added explicit group semantics to the D-pad and
  mobile action surfaces.
- Replaced visible keyboard-era mobile guidance with touch copy across Camp,
  Forge, Merchant, Pact, Options, Tutorial, records, nickname, death, and
  victory surfaces while retaining desktop keyboard instructions.
- Raised mobile label/support text, kept named action controls unclipped,
  restored real Camp icons, changed Camp to a readable one-column scroll list
  with two-line descriptions, and corrected Forge from five computed layout
  rows to four. Reduced-motion now suppresses descendant and pseudo-element
  overlay animation as well as control transitions.
- Added RED/GREEN static contracts plus browser assertions for portrait
  inert/focus restoration, touch-only guidance, command-label size, Camp
  readability/reachability, Forge geometry, reduced motion, and real computed
  CSS cascade. Fresh gallery comparisons use the approved gothic mobile plate.
- Verification: focused mobile/UI tests 27/27; JavaScript/script syntax PASS;
  mobile smoke PASS on iPhone, Android, browser-chrome-height, tablet, iPad,
  narrow fine-pointer, desktop, and hybrid touch-laptop; gallery PASS for ten
  states; `verify:ui-current -- --scenario hd`, `verify:baseline`,
  `verify:guard`, and `verify:phase` (781/781) PASS.
- The deterministic test-only source/ruleset manifests were regenerated only
  to record the changed `game.js` hash. No ruleset activation, commit, push,
  deployment, migration, or production change was performed.

## 2026-08-11 - Mobile button layout re-composition

- Original user request: audit the mobile button appearance and placement,
  then immediately implement the approved correction because the existing
  layout looked visually poor despite being functionally operable.
- Fresh 844x390 and 844x288 measurements confirmed two structural defects: a
  fixed 210px control shelf left a 66px dead zone at normal height, then
  overlapped the compact HUD by 26px when browser chrome reduced the viewport.
  Extract also occupied only half of the final row, leaving an orphaned cell.
- Re-composed the existing Gothic controls without changing IDs, action keys,
  canonical input dispatch, gameplay rules, or desktop composition. The D-pad
  and action bank now share one adaptive vertical center, Extract spans the
  full action width, icons scale with available height, and tall tablets cap
  and center the bank instead of stretching it.
- Added a compact <=320px layout with three combat/action columns and a
  full-width emergency Extract row. Normal phone landscape keeps the clearer
  two-column action hierarchy. Shockwave stays on one line where the viewport
  has enough height.
- Added a browser RED regression for HUD overlap/dead space, control overlap,
  clipped labels, D-pad/action alignment, and the Extract span. Before the CSS
  correction it failed at 844x390 (66px dead zone) and 844x288 (-26px HUD
  overlap); the corrected iPhone, Android, browser-chrome, tablet, iPad,
  narrow fine-pointer, desktop, and hybrid matrix passes.
- Audit, approved design rationale, and the implementation plan are recorded
  in `docs/audits/2026-08-11-mobile-button-layout-audit.md`,
  `docs/superpowers/specs/2026-08-11-mobile-button-layout-design.md`, and
  `docs/superpowers/plans/2026-08-11-mobile-button-layout.md`.
- No commit, push, deployment, migration, ruleset activation, or gameplay
  behavior change was performed.

## 2026-08-14 - Ranked test controls and assisted leaderboard rows

- Removed the separate Observer Bot start/continue choices. Test-enabled
  Ranked builds now always use the ordinary Ranked lifecycle.
- Added password-gated F9 unlock for the full test/cheat menu. A successful
  unlock canonically and irreversibly marks the run as assisted before any
  test controls become available.
- Added revision-safe assistance state transitions, including active room and
  reward-envelope rebinding, plus HTTP coverage for a later death snapshot.
- Assisted snapshots remain visible for QA but render as amber `TEST` rows,
  are excluded from official rank numbers and the podium, and show
  `TEST RUN - NOT RANKED` in details.
- Updated the lifecycle browser scenario to cover ordinary Ranked start,
  F9/password unlock, the full test menu, and Observer Bot toggling.
- Focused pure, HTTP, boundary, leaderboard UI, style, publication, and
  campaign-parity tests pass. Generator drift and guard pass (14/14), phase
  passes (822/822), the current-tree save UI and Ranked lifecycle scenarios
  pass, and the committed protected baseline passes (3/3).
- Automated behavior and screenshot generation completed, but manual visual
  approval was not recorded because both Windows image viewers failed during
  environment setup; no visual receipt was fabricated.

## 2026-08-20 - Observer Bot Ranked boundary compatibility repair

- Preserved the active room directive and reward envelope when a legacy
  `mark_test_assistance` response omits those optional projection fields.
- The client still adopts the canonical revision, checkpoint token, assistance
  classification, and all other response state; the fallback is limited to
  active boundary-settlement runs and missing fields only.
- Added a RED/GREEN client regression. Focused client tests pass 15/15, the
  Ranked phase gate passes 856/856, and the headed Ranked lifecycle passes.
- All six release archive screenshots were freshly generated and visually
  inspected. No Worker, D1 schema/data, ruleset source, ruleset manifest,
  ruleset hash, combat, movement, renderer, or `game.js` change was made.

## 2026-08-20 - Persisted Observer Bot boundary self-recovery

- Production `0dac1dd` proved the compatibility fallback was too narrow: it
  preserved a valid pre-event binding, but could not repair a browser snapshot
  that was already missing both boundary fields.
- Added a RED/GREEN runtime regression for portal entry with an already-missing
  directive and reward envelope. Portal settlement now resumes canonical state,
  verifies it belongs to the locally active room, and only then captures and
  checkpoints the boundary.
- The same recovery guard protects Forge exit, fatal settlement, extraction,
  and the post-assistance response. Focused runtime/client tests pass 26/26;
  `verify:phase` passes 857/857.
- Stabilized the browser QA hook so its late-chest assertion no longer depends
  on a randomly generated chest. The full headed Ranked scenario then passed,
  including lifecycle, network loss, reload, multi-tab ownership, reward
  boundaries, death presentation, Forge, and Camp. Fresh screenshots were
  visually inspected.
- Pending: release commit/push, Pages build/deploy, and production byte/boot
  verification.

## 2026-08-22 - Ranked run-status dot

- Added a Ranked-only status dot immediately before the player name: green for
  official eligibility, blue for a valid Observer Bot test run, and red for a
  provisional or otherwise ineligible run. Practice renders no dot.
- Pending requests preserve the last confirmed base color and add an amber
  synchronization ring. Hover/focus exposes an accessible explanation, and
  reduced-motion users receive a static ring.
- Observer assistance classification is retained in the local Ranked snapshot
  across resync/reload without changing the Worker, ruleset hash, scoring, or
  anti-cheat decisions.
- Focused status/client/runtime tests pass 38/38; `verify:guard` passes 14/14;
  `verify:phase` passes 912/912. Browser assertions for Practice absence,
  official green, Observer blue, and pending-sync ring pass, with fresh visual
  inspection. The broader headed lifecycle still stops later on its pre-existing
  leaderboard ledger-row pixel-position assertion.

## 2026-08-23 - Bounded Ranked relic proc gold

- Diagnosed `REPORTED_GOLD_DELTA_MISMATCH` on run
  `run_a3f3c1cc0cc0424c9a6483a1542e1d6b`: the canonical room reward was 34,
  while an honest Void Reaper critical kill added client-side gold that the
  pinned server ruleset intentionally could not attest.
- Added two explicit, amount-free claims for new Ranked runs only:
  `proc:void-reaper-crit-kill` and `proc:chaos-orb-gold-roll`. The Worker
  calculates every award from the canonical room-entry build and rejects
  missing relics, unknown or duplicate claims, invalid counts, and counts above
  room evidence before committing state.
- Void Reaper is capped by accepted enemy plus elite kills (hazards excluded)
  and uses the canonical global multiplier without Bounty Contract. Chaos Orb
  remains a flat 20 and is capped by `ceil(roomLocalTurnCount / 10)` to account
  for its carried cadence. Exact reported/canonical gold equality remains the
  final integrity check, so unexplained extra gold still makes the run
  provisional.
- Corrected Ranked room telemetry from run-global turns to a room-local turn
  delta and record proc claims only after the corresponding local award
  succeeds. Historical rulesets omit the capability and remain byte-pinned.
- Released ruleset hash
  `sha256:35707f6b5ea8b1ad18251dce5e6c18b87653893aad705b6c5543fdd140b88067`;
  previous `sha256:76514cf9e5c89079571a5be117ce84f949d7a3f5ed441d973adc05c95c6dde3c`
  remains supported without bounded proc claims.
- Fixed a Pages source/replacement marker regression exposed by the full suite;
  the generated game keeps the new room-local turn payload. Generator check,
  focused integration tests (84/84), guard (14/14), and the complete Worker
  phase (925/925) pass.
- The six-image record archive was regenerated from passing browser scenarios,
  visually inspected, and approved with receipt fingerprint
  `sha256:b2c985536891a63fcf9fc6169013caff4342982c0ace9b1325358c9532e7`.
  The current-tree Ranked browser suite and UI suite pass; the full local
  Worker+D1 E2E suite passes 21/21 after its depth-100 helper was corrected to
  resolve the canonical post-room Pact offer. The Worker phase passes 925/925.
- Released source `46e2c44eba681834dbe16a1a1a0cd23aa4d8a65f` to production without a D1
  migration. Worker version `da14b0a3-180b-499d-a634-93f41f555d9c` passed a
  staged 5% deployment (`6246b6e4-804c-46e1-93a6-66879e87c8ed`), 25%
  deployment (`8aff4a92-5626-41c3-8f0c-06712a4f720f`), and 100% deployment
  (`9a0b2f9d-3be1-4915-9913-73669f6c03da`). The immediate Worker rollback
  target is `c931c69e-2947-4b2d-9d78-2ab7964e4e42`.
- Cloudflare Pages production deployment
  `34fdb003-25b2-471f-9e96-ebc1bcfd92d8` serves the same bytes as the local
  release at both the stable and immutable URLs. The previous Pages rollback
  target is `73eaf41c-24f7-4ba9-84f2-2b548744cce2`.
- Production smoke confirmed exact byte matches for `index.html`, `config.js`,
  `game.js`, and `online-v3/ranked-v3-runtime.js`; active/compatible availability
  with the new ruleset hash; and deterministic JSON 400 rejection envelopes on
  start, resume, abandon, and Camp invalid-request probes.

## 2026-08-23 - Production mismatch run 5876 investigation

- Production D1 read-only evidence identifies the full run as
  `run_5876bfd4c3964a249b1e5f14c59bbce4`, current ruleset hash
  `sha256:35707f6b5ea8b1ad18251dce5e6c18b87653893aad705b6c5543fdd140b88067`,
  Observer assistance, first provisional revision 5, and final extraction at
  revision 6. The build had no relics or active mutators.
- Revisions 2-5 canonically settled room gold to 93, 104, 120, and 134. The
  failing depth-4 combat-room settlement accepted an authoritative delta of 14
  before issuing the depth-5 boss; its envelope contained two chest slots.
  The persisted reasons are `REPORTED_GOLD_DELTA_MISMATCH`,
  `REPORTED_GOLD_TOTAL_MISMATCH`, and `BOUNDARY_SETTLEMENT_INVALID`.
- The initial chest stat-cap hypothesis was disproved: both the current builder
  and live production `game.js` call `recordChestGold` inside
  `applyChestCapFallback`. Enemy and both spike-hazard kill paths are also wired.
- The supplied Observer trace identifies the matching sequence exactly. The
  depth-4 checkpoint request digest was recovered byte-for-byte as delta `14`,
  total `134`, five slime kills, one `fury_1` use, room-local turn count `5`,
  and elapsed time `17348`. It was honest and the checkpoint remained
  `official`; the mismatch did not originate in that room.
- Compact-operation replay proves the integrity failure was first attached at
  revision 5 by `request_extraction`, not by the preceding checkpoint. The bot
  had entered the depth-5 boss with canonical gold `134`, earned `12` local
  gold from two skeletons, used Fury twice, Shield twice and potions five
  times, then emergency-extracted at 21 HP. The emergency boundary fell back
  to an empty zero settlement and added `BOUNDARY_SETTLEMENT_INVALID`; comparing
  the original partial-room totals to that fallback then produced both
  `REPORTED_GOLD_*` reasons.
- The trace also exposes a client/canonical combat projection mismatch at run
  start and through the boss: local `135 HP / 10 ARM / 30 ATK` versus the
  canonical no-relic/no-mutator build (`110 max HP`, no canonical chest stat
  carry). The local `sessionChestAttackFlat`, `sessionChestArmorFlat`, and
  `sessionChestHealthFlat` are applied unconditionally by `startRun()` but are
  absent from the Ranked canonical build. This is the leading source of the
  invalid emergency claim/state seam and must be fixed without relaxing exact
  server gold validation. No anti-cheat or production behavior was changed
  during this investigation.
- A read-only replay reconstructed the extraction against the exact revision-5
  canonical state and deterministically throws
  `REWARD_CLAIM_POTION_USE_LIMIT`: the recorder reported five potion uses while
  the canonical build held four. The Worker then correctly failed closed, but
  its fallback compared the original local `12/146` gold telemetry against the
  fallback `0/134` settlement, which added two misleading `REPORTED_GOLD_*`
  reasons on top of the real `BOUNDARY_SETTLEMENT_INVALID` reason.
- The source mismatch is broader than the popup: `startRun()` unconditionally
  reapplies local `sessionChest*` combat bonuses on every run, including
  Camp-to-next-run and fatal restart, while Ranked has no canonical fields or
  claims for carrying those bonuses. Existing fresh-campaign handling calls
  `resetMetaProgressForFreshStart()`, which also writes/deletes shared Practice
  storage and therefore violates Practice/Ranked isolation.
- Recommended strict repair (awaiting user design approval): clear all
  non-canonical session-chest carry before every Ranked `startRun`, replace the
  fresh Ranked full Practice reset with an in-memory Ranked-only reset, leave
  Practice behavior/storage unchanged, and suppress only the cascading gold
  reason codes when a boundary has already failed closed. Valid boundary gold
  equality and all resource caps remain exact; invalid boundaries remain
  provisional via `BOUNDARY_SETTLEMENT_INVALID`.

## 2026-08-27 - Ranked whole-game hang audit and checkpoint-loop repair

- The supplied depth-9/Vault trace and read-only D1 state exposed a deterministic
  client/Worker start-resource mismatch: Practice-compatible Ranked produced
  123 HP for Vitality 3 + Berserker + 25 carried chest HP, while the Worker
  omitted Berserker's 0.75 maximum-HP multiplier and expected 155 HP.
- Profile hydration now applies the Practice order exactly: Camp Vitality,
  run-modifier maximum-HP multiplier, then additive chest carry. The regression
  fixture reproduces the traced 123 HP result.
- Recovery now preserves and retries the completed room checkpoint once when
  resume returns the exact same directive ID and nonce. Generic 500 responses
  stop in recoverable UI instead of rebuilding the completed room indefinitely.
- Reward-claim validation errors map to explicit 422 codes, and diagnostics add
  only a bounded source code alongside trace/path/status without request bodies
  or credentials.
- D1 retention now removes dependent non-finalized leaderboard snapshots before
  expired non-finalized runs in one batch, avoiding the observed foreign-key
  cleanup failure while preserving finalized entries.

## 2026-08-28 - Ranked and Observer Bot diagnostic correlation

- Ranked recovery diagnostics now retain a bounded, explicit allowlist of safe
  correlation fields, including the complete trace ID, operation ID, action,
  directive, depth, room type, ruleset, and game version.
- The reconnect screen can export a redacted diagnostic JSON package. When the
  Observer Bot is active, the same safe entry is also embedded in its trace so
  a future Worker error can be matched to the exact client action.
- Worker exception logs now add bounded request correlation context without
  recording request bodies, tokens, nonces, credentials, digests, or arbitrary
  client fields. Public error behavior and fail-closed recovery are unchanged.
- Focused regression tests passed 77/77. Ranked recovery, current boot, protected
  baseline, phase verification (1080/1080), guard verification (15/15), generated
  Pages bundle syntax, and visual screenshot review all passed.
- No gameplay, ruleset, D1 migration, commit, push, or deployment was included.
  The already-finished production `INTERNAL_ERROR` cannot be reconstructed after
  the fact; the added correlation is intended to identify its source on the next
  occurrence.

## 2026-08-28 - Ranked diagnostic correlation production release

- Source commit `ff0a0a2dac3ae0785818f4072091d1b2c2e92323` was pushed to
  `origin/main` and deployed to Pages and the production Worker.
- Forced release verification passed 1104/1104 from the exact committed source;
  the Worker suite passed 1080/1080, local Wrangler/D1 passed 21/21, the
  protected baseline guard passed 3/3, and both committed browser scenarios
  passed. Codex reviewed all six required archive screenshots; visual source
  fingerprint: `sha256:52d389001ab98b282608a4c96cc90ce5c3d86484db6ac99487b99134ac22834b`.
- Pages deployment `284844be-b8f4-49cc-a0db-67b01553d9fb` serves source
  `ff0a0a2` at `https://284844be.dungeon-of-one-room.pages.dev`; direct Pages
  rollback is `dcbfbc0b-bb37-494e-9054-2229fda4c6a3` from `617ef19`.
- Worker version `5b4a41e4-a0c5-4c11-9dfb-f67a6506f93b` is active at 100%
  in deployment `f71d42fc-245b-44cb-aee2-d1e01dc3cb48`; direct Worker rollback
  is version `0fef666a-eee4-43a8-b29f-f635d47fe4f1`.
- The Worker progressed through 5%, 25%, and 100%. The 5% window passed 60/60
  availability checks over 15 minutes. The 25% window remained active for about
  56 minutes across a local PC restart; pre-restart sampling reached 56/56 and
  the resumed gate passed 50/50 availability plus 10/10 leaderboard checks.
  Final production smoke passed 50/50 availability, 10/10 leaderboard, and 4/4
  exact static asset checks.
- Active ruleset remains
  `sha256:78ae2f6f797063b7f364e5652e3367f6b26d651302f5c6038576d304dc442ec3`.
  D1 reported no migrations to apply. Pre-release Time Travel bookmark:
  `00000d08-00000000-000050d5-26b50efec54268b0114cf17cbeaf1066`.

## 2026-08-28 - Ranked canonical max-HP checkpoint repair

- Reproduced the production depth-11 checkpoint failure as a local-versus-
  canonical maximum-HP mismatch caused by local relic and mutator effects.
- Boundary settlement now preserves the local missing-HP amount while projecting
  the result onto the Worker's canonical maximum HP. Worker validation remains
  exact and unchanged.
- Exact retry also normalizes an already-persisted legacy checkpoint before
  resending it with the same operation identity, allowing the reported active
  run to recover after the fixed Pages client is loaded.
- Focused regression tests passed 83/83, including Shrine, Glass Cannon-style
  reduced max HP, increased local max HP, runtime portal settlement, and legacy
  pending-operation recovery. The related architecture test passed 15/15,
  phase verification passed 1082/1082, the current-tree Ranked lifecycle browser
  scenario passed, baseline protection passed 3/3, and guard checks passed 15/15.
- No ruleset, Worker policy, D1 migration, commit, push, or deployment is included
  in this implementation step.

## 2026-08-29 - Ranked canonical max-HP production release

- Source commit `5fef218ab69a35e2d4d6e8415ebd5bf0315b820a` was pushed to
  `origin/main` and tagged `online-v3-production-2026-08-29-5fef218`.
- Forced release verification passed 1106/1106 from the exact committed source:
  Worker 1082/1082, local Wrangler/D1 21/21, protected baseline 3/3, and both
  committed browser scenarios. Codex reviewed all six required archive
  screenshots; visual source fingerprint is
  `sha256:aae4bd33a91adb28c507284e734155e0e8a02a55a2dda2d7b903d41ee3d8cdd8`.
- Pages deployment `dad85291-4ee2-499c-9f39-8cc43cbd9b17` serves source
  `5fef218` at `https://dad85291.dungeon-of-one-room.pages.dev`. Direct Pages
  rollback is `284844be-b8f4-49cc-a0db-67b01553d9fb` from `ff0a0a2`.
- Stable and immutable roots, availability, and leaderboard returned HTTP 200;
  local-versus-live hashes matched for `config.js`, `game.js`, Ranked runtime,
  and the sanitized visual receipt.
- The production Worker remains unchanged on version
  `5b4a41e4-a0c5-4c11-9dfb-f67a6506f93b` at 100% because this release changes
  no Worker source, ruleset, binding, or configuration. The active ruleset
  remains `sha256:78ae2f6f797063b7f364e5652e3367f6b26d651302f5c6038576d304dc442ec3`.
- D1 reported no migrations to apply. Pre-release Time Travel bookmark:
  `00000d1c-00000000-000050d5-2fb356d453a892670917e10600ef85a5`.

## 2026-08-29 - Ranked gold parity and Observer Bot early-economy release candidate

- Observer Bot now spends early gold on Vitality, Blade, Guard, potion slots,
  and potion strength through depth 10; it reserves 326 gold for the first
  skill from depth 11 and 694 gold for two skill upgrades from depth 16.
- Ranked gold grants rebuild the Worker's canonical modifier order before
  rounding. This fixes the reproduced decimal boundary where the client awarded
  37 room gold while the Worker expected 38 and rejected the checkpoint with
  `REPORTED_GOLD_DELTA_MISMATCH`. Practice keeps its previous calculation.
- The final local production ruleset hash is
  `sha256:5ba35a1c03cf160787c553d55782ddb1ec4612a9a08f2dc26da562feeccc73c2`;
  the current production hash
  `sha256:78ae2f6f797063b7f364e5652e3367f6b26d651302f5c6038576d304dc442ec3`
  remains registered and compatible for existing runs.
- Ranked headed QA now expands canonical relic stacks before choosing a Forge
  replacement key, dismisses a late-opening Camp Guide race, and retries a Camp
  checkpoint input when a tutorial consumes the first key press. The actual
  player-facing Forge selection path was already correct.
- Exhaustive client-versus-Worker gold parity covered 352,000 combinations with
  zero mismatches. Focused Forge/Camp regressions passed, current-tree Ranked
  Lifecycle and Camp browser scenarios passed, and full release verification
  passed 1112/1112.
- No commit, push, deployment, ruleset activation, or D1 migration was performed
  in this implementation and release-preparation step.

## 2026-08-29 - Full Help section-clipping fix

- Reproduced the HD How to Play defect in the current-tree browser scenario:
  the outer manual reported no overflow while four inner sections clipped up to
  109 pixels of their rows.
- The manual grid now sizes implicit rows to their full content. Complete
  section cards remain intact and the existing manual scroller exposes the
  remaining sections with the documented Up/Down controls.
- Added browser geometry regression coverage and a How to Play screenshot to
  the HD scenario. No commit, push, or deployment is included in this step.

## 2026-08-29 - Aegis Counter final-enemy portal regression

- The supplied Observer Bot trace isolated a depth-25 stall where the Warden
  died after the earlier room-clear check, leaving zero enemies while
  `roomCleared` stayed false and no portal was rendered.
- `tickBarrier()` can trigger the legendary Aegis Counter after the previous
  final-enemy check. Turn finalization now checks room completion again after
  that effect so its last-enemy kills reveal the portal normally.
- Observer Bot traces now include room-clear, portal, turn-finalization, and
  shield state so future stalls expose the relevant invariant directly.
- Focused regressions were observed failing before the change and now pass
  4/4. Broader browser and baseline verification is still in progress.
- Regenerating the source-bound ruleset produced candidate hash
  `sha256:91843a42a08ca6213e664cc0607e511fbd2c89f2bbfd749b45c0244924da067f`.
  The current production hash
  `sha256:5ba35a1c03cf160787c553d55782ddb1ec4612a9a08f2dc26da562feeccc73c2`
  is retained in protocol and Worker registries with the same capabilities so
  existing legal runs remain compatible after a future release.
- Focused protocol, production-registry, and integrity tests were observed
  failing before the compatibility binding and now pass 26/26.
- Final ruleset generation is stable at
  `sha256:91843a42a08ca6213e664cc0607e511fbd2c89f2bbfd749b45c0244924da067f`.
  Phase verification passed 1089/1089, current-tree Ranked Lifecycle passed,
  the protected committed baseline passed 3/3, current-tree HD browser QA
  passed, and the final safety guard passed 15/15.
- No commit, push, or deployment is included in this implementation step.
