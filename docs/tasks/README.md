# Online v3 task files

- The current chat prompt is the default task and scope authority.
- `CURRENT.md` is optional and contains only one explicitly active larger
  task. Keep `Status: NONE` when chat prompts are being used instead.
- After completion, reset or archive `CURRENT.md`; do not accumulate history
  in it. Completed content remains recoverable through Git history.
- Stable project and subsystem rules belong in `AGENTS.md`.
- Completed phase evidence belongs in `docs/history/` or the corresponding
  `docs/ONLINE_V3_*` record.
- Keep `CURRENT.md` compact; target at most 100 lines.
- `verify:guard` is a core safety check, not a replacement for a focused
  regression test of changed behavior.
- Verification code must not execute commands extracted from task Markdown.
