# Online v3 — Current Handoff

## Milestone R2 complete locally

R2 resolves every actionable R1 P1 and every P2 selected by
`docs/tasks/CURRENT.md`. R1-P0-001 remains the accepted product boundary:
Ranked owns canonical meta-progression but does not prove local combat.

Internal commits:

- `9f0cd8a` — R1 review and trust decision;
- `71a4e15` — extraction-only Camp and canonical anonymous profile;
- `f69b4e6` — authenticated run resume and token refresh;
- `2d4dcf8` — error, abandon, and canonical resync flows;
- `60ef67c` — single-writer browser coordination;
- `e9299e5` — retention, active-run cap, abuse gate, and metrics;
- `24d29e7` — strict protocol projections and public seek cursor;
- `972e2ea` — D1/headed lifecycle and 30-scenario threat rerun.

Current test-only ruleset hash:
`sha256:0bf00607056dbf3c30ffe57bbcfc77cea95b21c9ccc23aa985ec555856d1cbd6`.

The final documentation commit is followed by fresh `verify:phase`,
`verify:baseline`, and `verify:full`. See:

- `docs/ONLINE_V3_R2.md` for architecture and release gates;
- `docs/ONLINE_V3_R2_REVIEW.md` for finding dispositions and threat rerun;
- `docs/ONLINE_V3_PROTOCOL.md` for the current HTTP contract.

## Boundaries for the next task

Status is `READY_FOR_M5_PLANNING`, not production-ready and not deployed.
`v08-meta-1` remains test-only. M5 must be a separate authorized task covering
staging resources, migrations, distributed abuse control, monitoring/alerts,
data policy, soak, rollback, and explicit activation.

Do not merge, push, deploy, activate production, apply remote D1 migrations, or
start M5 from this handoff.

The unrelated 172 Vault Guardian deletions remain unstaged, unmodified, and
outside every R2 commit.