# Local Ranked Test Launcher — Design

## Purpose

Provide a double-click Windows launcher for testing historical local versions of
Dungeon Online v3. It must remove the need to manually build Pages, patch the
local ruleset hash, configure the local Worker, or type Wrangler commands.

The launcher is a local developer tool. It never deploys, opens a Cloudflare
tunnel, uses a production Worker configuration, or publishes a result to the
public leaderboard.

## User flow

1. The user double-clicks `Launch-Local-Ranked-Test.cmd`.
2. A native Windows dialog opens and discovers the local branch whose tip has
   the newest committer timestamp. Remote refs are not considered.
3. The dialog lists the five newest commits reachable from that branch, with
   commit date, short hash, and subject.
4. The user selects one commit and starts it either normally or with the
   local-only Observer Bot test mode enabled.
5. The launcher prepares the selected revision, starts a loopback-only Worker,
   waits for its health endpoint, and opens the game in the default browser.
6. The window displays the local URL, selected commit, non-secret status log,
   and a Stop button for the Worker it started.

## Architecture

### Windows entry point

`Launch-Local-Ranked-Test.cmd` is a small double-click wrapper. It invokes
PowerShell with `-NoProfile` and runs
`scripts/local-ranked-test-launcher.ps1`; it contains no secrets and no game
logic.

The PowerShell script renders the native selection/status window. It delegates
Git discovery and launch preparation to a Node core module so the important
selection, path, port, and argument decisions have direct automated tests.

### Node launcher core

`scripts/local-ranked-test-launcher-core.mjs` exposes pure helpers plus a
small CLI protocol for the PowerShell UI:

- enumerate local branch tips from `refs/heads`, sort by committer timestamp,
  and select the newest branch;
- list the newest five commits on that branch;
- validate a selected full commit hash against that list;
- derive only safe, launcher-owned cache paths below
  `output/local-ranked-test-launcher/`;
- allocate a free loopback port and construct only `wrangler dev --local`
  arguments;
- build the selected test Pages bundle and replace its `RULESET_HASH` with the
  selected revision's registered local manifest hash;
- start/stop the Worker and report a redacted, bounded launch log.

The Node process sets `CLOUDFLARE_INCLUDE_PROCESS_ENV=true` and a freshly
generated `RANKED_V3_HMAC_SECRET` when it starts the child Worker. This follows
the already-tested local headed harness. The secret is process-local, never
written to source, cache, log, or UI.

### Revision cache and isolation

For a selected commit, the core creates or reuses a detached linked worktree
at `output/local-ranked-test-launcher/worktrees/<full-hash>`. The launcher
owns only this directory. It never checks out, switches, commits, merges, or
modifies the user's `main` checkout or another worktree.

The selected revision's Worker dependencies are checked before startup. If
Wrangler is absent in that launcher-owned checkout, the launcher runs the
package's lockfile install there and presents a clear failure if dependencies
cannot be obtained. A successful cached checkout is reused on later launches.

Each run receives a fresh free loopback port and an isolated D1 persist path
below `output/local-ranked-test-launcher/state/<full-hash>/`. The browser URL
therefore has an origin distinct from another concurrently running test,
preventing Ranked localStorage from being shared accidentally.

### Observer Bot test mode

The dialog offers an `Observer Bot (local test)` checkbox. When selected, it
uses a visible default throwaway password `local-bot-test` that the user may
change before launch. The test Pages build receives the password only through
the child build environment; the bundle contains only its SHA-256 hash.

The game prompts for the same value after `Start + Observer Bot` is selected.
The launcher shows that value as local test information. This mode is never
available to a production build and the launcher provides no production URL,
credential, or deployment control.

## Error handling and safety

- Missing Git, Node, Worker dependencies, manifest, build output, or Worker
  readiness yields an actionable error in the launcher window and leaves the
  user's worktrees untouched.
- The launcher rejects a commit outside its displayed five-entry list.
- The Worker command is fixed to `--local`, `wrangler.local.jsonc`, and
  `127.0.0.1`; tunnel, remote preview, production configuration, Pages deploy,
  and Worker deploy are out of scope.
- Stop terminates only the recorded launcher-owned Worker process tree.
- The launcher does not delete cache, D1 state, browser storage, or records.
  Cache cleanup can be designed separately with explicit confirmation.

## Verification

Automated Node tests will cover branch/commit ordering, five-entry limiting,
rejection of an unlisted commit, safe cache path validation, loopback-only
Wrangler arguments, ruleset-hash patching, Observer Bot hash-only build input,
and log redaction.

A focused local smoke test will launch a fixture revision, wait for the
loopback availability endpoint, verify that its test bundle is served, and
stop only the process started by the test. Manual acceptance checks cover the
native dialog, selecting each displayed commit, normal start, Observer Bot
start, and opening two selected revisions without shared Ranked state.

## Non-goals

- Production deployment, public leaderboard writes, backfills, or deletion of
  public records.
- Merging the record-archive repair branch into `main`.
- Changing Ranked rules, Worker/D1 schemas, combat, records, or game UI.
- Automatic cache/state deletion.
