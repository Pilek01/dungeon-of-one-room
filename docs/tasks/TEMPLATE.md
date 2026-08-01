# Current task — Phase <id>

Status: ACTIVE

## Task name

<Short name>

## Objective

<One outcome for this phase>

## Allowed paths

- `<exact path or glob>`

## Required work

- <Required behavior or evidence>

## Out of scope

- <Explicit exclusion>

## Stop conditions

Stop and report instead of guessing when:

- <Unresolved evidence or boundary>

## Acceptance

- <Observable result>
- Existing regressions and protected baseline pass.
- Ruleset status and activation boundary remain explicit.

## Verification

- Focused test(s): `<exact command>`
- `npm run verify:phase` only for Worker/ruleset/protocol/shared-runtime or
  cross-subsystem changes.
- `npm run verify:baseline` only for protected game/UI/loading/renderer/build
  integration or milestone/release work.
- `npm run verify:full` only for milestone, D1/Wrangler, staging, release, or
  deployment work; it replaces separate phase and baseline runs.
- Do not rerun a passing gate unless relevant files changed after it ran.

## Commit message

`<Exact local commit subject>`

## Required final report

- Implemented scope and unresolved items
- Exact checks executed and their totals
- Changed-file count
- Commit only when created
- Ruleset hash or baseline result only when relevant
- Next phase only when phased work continues
