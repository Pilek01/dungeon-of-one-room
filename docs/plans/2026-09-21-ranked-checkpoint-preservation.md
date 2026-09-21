# Ranked accepted checkpoint preservation

## Approved design
Preserve the server-derived result from the last accepted checkpoint when a
later room has a gold telemetry mismatch or invalid local completion capability.
Do not trust submitted score/depth/build or publish any part of the suspect room.
Missing integrity envelopes, invalid boundary settlement and unknown reasons
withhold publication. Preserve existing validation, authentication and CAS.
Continuation remains the existing provisional (unranked) flow; it cannot mutate
the Ranked profile. Recovery shows the frozen result. No commit/deploy requested.

## Implementation plan
1. Add HTTP regressions in m2b-real-runtime-http.test.js proving preservation,
   exact retries, no prior checkpoint, withheld reasons and no profile rewards.
   Run the focused test and observe missing-feature failures.
2. Add domain checkpoint-result policy; store one bounded leaderboard projection
   per accepted checkpoint (not recursive full states). Handle both checkpoint
   and fatal/extract integrity transitions; publish atomically with the run.
3. Expose a compact preservation receipt in public meta state and update the
   existing integrity notice. Test the exact message and continuation behavior.
4. Keep preserved records through cleanup; add storage/retention regression.
   No database schema or canonical combat/score rule changes.
5. Run focused tests, browser recovery scenario, current UI boot, required
   full gate for the D1 query change, and git diff --check. Inspect exact diff.
   Keep local changes uncommitted; no production mutation.

## Implementation notes
- The saved projection is server-only and bounded to one accepted checkpoint or
  accepted death/extract boundary. Publication uses existing conditional D1
  update + leaderboard upsert; accepted checkpoints do not publish prematurely.
- The first downgrade freezes preserved/withheld/unavailable. Later unranked
  telemetry cannot change this decision. Retrospective moderation needs separate
  evidence; no automatic moderation queue or new cheat-proof claim is introduced.
- Provisional extraction never mutates the Ranked profile. Existing credited
  progress remains; this does not grant an extraction payout for an interrupted run.
- Existing best-per-profile ranking remains. First-room failures and older saves
  lacking the newly stored projection cannot fabricate a result.
- Recovery remains the existing provisional continuation, not a new offline-save
  conversion. The UI explicitly says unranked.
- New outcome label required a generated ruleset manifest update. Candidate:
  sha256:00c934a0f4bfbe3b35f01b36cb0b99e8372eb48c49e012213ca813c1da8830b5.
  Retained deployed descriptor:
  sha256:f3101eee949400ce36eb65ebe4ccf211125960d4e5223855e451693d55bd1f2b.
  Existing capabilities and scoring formulas are unchanged. No schema migration.

## Verification result
- npm run verify:full: PASS, 1191/1191 (1166 Worker, 21 Wrangler/D1, 4 guard),
  plus clean committed baseline and Ranked lifecycle. No failures or skips.
  Log: output/verification/full-20260921T154932743Z.log.
  The committed scenarios use HEAD 4cd55aa; the new behavior was additionally
  exercised on the current working tree by the following browser scenarios.
- npm run verify:ranked-headed -- --scenario recovery: PASS on final candidate,
  including a real accepted checkpoint, altered gold telemetry, frozen leaderboard
  score, unranked continuation and reload. Screenshot inspected.
  Log: output/verification/ranked-headed-20260921T154813781Z.log.
- npm run verify:ui-current -- --scenario boot: PASS; automatic checkout identity.
- node scripts/online-v3-ranked-headed.mjs --scenario lifecycle: PASS.
- node scripts/online-v3-baseline-smoke.mjs --scenario save: PASS.
  Six archive screenshots inspected; visual approval receipt refreshed.
- node --test cloudflare/leaderboard-v3/test-e2e/d1-storage-atomicity.test.mjs:
  PASS; failed CAS cannot upsert a forged higher score, frozen result survives TTL.
- Focused node --test runs covered accepted-checkpoint-result.test.js,
  m2b-real-runtime-http.test.js, m3-finalization.test.js,
  observer-bot-runtime.test.js, m4-client-leaderboard.test.js,
  ranked-integrity.test.js, checkpoint-result-release.test.js,
  ranked-integrity-release.test.js, production-release.test.js and
  hd1-presentation-release.test.js (all under cloudflare/leaderboard-v3/test/).
- Initial red regressions and the generator/compatibility failures were resolved;
  final full verification passed. Final git diff --check: PASS.
- 27 task files changed. No remaining implementation blocker. Physical-device
  testing and retrospective moderation tooling are outside this task.


## Follow-up: respawn potion repair and commit preparation

The user authorized committing the prepared Ranked changes on 2026-09-21.
The final combined candidate supersedes the checkpoint-only hash above:
sha256:dd2bc67015aabc40cb833aec4f224e9a0e9a952a5d3bcd05e33f6144a2f59c05.
Only the new candidate enables respawnPotionResources v1; retained production
hashes keep their prior capabilities. A nonterminal life loss renews the
server-derived Ranked starting potion budget after relic loss. The browser
applies that budget after its native restart. Prevention and final defeat do
not refill potions. No production records were edited or deployment performed.

Final combined code verification before commit:
- verify:phase PASS, 1174/1174; phase-20260921T165406380Z.log.
- verify:ranked-headed -- --scenario lifecycle PASS, including actual bot respawn
  potion count/capacity parity; ranked-headed-20260921T165709274Z.log.
- verify:ui-current -- --scenario boot PASS; ui-current-20260921T165843714Z.log.
- verify:baseline PASS (committed HEAD baseline and four guards);
  baseline-20260921T165902628Z.log.
- git diff --check PASS. Earlier full/D1 and recovery receipts above cover the
  checkpoint preservation implementation; the later potion repair did not
  modify its D1 implementation.

Launcher investigation (read-only): listLocalCandidates excludes the current
non-main branch. From codex/hd2-early-animations it therefore selects main at
5242be0d946da83ca1796cf0f60911b8fbd26fb5 (2026-09-09), not the newer feature
branch. Committing on the excluded branch does not change that selection.
Launcher behavior was not modified in this commit task.
