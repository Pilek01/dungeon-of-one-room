# Local Bot Leaderboard Design

## Scope

Enhance only the Windows local Ranked test launcher and its Observer Bot telemetry. Do not change gameplay, production Ranked behavior, D1, the production leaderboard, or any ruleset binding.

## Live wall

- Show each bot's immutable starting relic.
- Preserve the last valid current depth, score, lives, gold, HP, decision, and build when a later boundary or terminal sample omits those fields.
- Keep depth highscore, score, and total earned gold monotonic.
- Preserve terminal metrics for `completed`, `failed`, `blocked`, and `stopped` rows instead of replacing them with zeroes.

## Durable local results

- Store one schema-versioned JSON result per launcher-created bot below its owned `output/multi-bot-runs/<session>/bot-XX/` directory.
- Persist during the run at a throttled interval and immediately on terminal status.
- Use an atomic same-directory temporary-file rename.
- Record session, bot, commit, timestamps, status/error, terminal metrics, starting relic, and canonical relic stacks.
- A completed record labels the relic list as the final/last-life build. Failed, blocked, or stopped records label it as the last observed build.

## Leaderboard UI

- Add a `Bot Leaderboard` button that opens a separate Windows Forms window.
- Build the list only from valid local bot-result files; never query or write the production leaderboard.
- Provide `Today` and `All Time` scopes plus status filtering.
- Sort by score descending, then depth highscore descending, then finish/update time descending.
- Show rank, bot, score, depth highscore, starting relic, status, local timestamp, session, and short commit.
- Show the selected record's complete relic build with stack counts in a detail panel.
- Start history with result files created by this feature; do not infer missing values from older sessions.

## Safety

- Treat local result files as untrusted input: validate shape, cap list size, and ignore malformed files.
- Keep result files under the already ignored `output/` tree.
- Do not stop or mutate Observer Bots that are already running while implementing the feature.
