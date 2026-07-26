# Current task — Phase <id>

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

- `npm run verify:phase`
- `npm run verify:baseline`
- `npm run verify:full` only when this phase requires it

## Commit message

`<Exact local commit subject>`

## Required final report

- Commit and scope
- Unresolved items
- Test totals and baseline result
- Ruleset hash before/after
- Changed-file count and next phase