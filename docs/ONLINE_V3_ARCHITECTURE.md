# Dungeon Online v3 architecture

Status: Phase 1 contract only. No Worker, endpoint handler, transport, or gameplay integration exists.

## 1. Boundary

Online v3 is checkpoint-authoritative meta progression around the unchanged v0.8.0 game. The browser remains authoritative for moment-to-moment combat, movement, enemy AI, animation, sound, HUD, Classic/HD presentation, cheat tools, Observer Bot, and special-room interaction. The server never participates in the movement/combat/animation loop.

Practice is the baseline game. Its synchronous adapter is:

```js
window.DungeonOnlineV3 = {
  mode: "practice",
  emit() {},
  recordCommand() {},
  requestCheckpoint() {},
  getRoomDirective() { return null; },
  openLeaderboard() {}
};
```

No adapter method returns a Promise. No input or game-loop caller waits for Online v3.

Online v3 may eventually communicate only at lifecycle boundaries:

- campaign start;
- accepted checkpoints after room/reward/economy/life transitions;
- low-volume semantic events;
- terminal finalize;
- leaderboard reads from menu UI.

There is no request during movement, combat resolution, enemy turns, animation frames, audio playback, or HUD rendering.

## 2. `RankedStateV3`

`online-v3/ranked-v3-checkpoints.js` is the canonical browser-side shape. A checkpoint contains:

```text
schemaVersion
runId
revision
season
gameVersion
rulesetHash
status
depth
roomIndex
roomDirectiveId
roomType
roomNonce
gold
lives
build
  relics[] { id, stacks }
  mutators[]
  skillTiers{}
  elixirs[]
statistics
  kills
  eliteKills
  bossesCleared
  damageDone
  damageTaken
  potionsUsed
  elixirsUsed
  roomsCleared
  commandsAccepted
rewardOffer
merchantInventory[]
specialRoomSchedule[]
journalDigest
  compactProof
    roomDirectiveId
    roomNonce
    roomIndex
    roomType
    generationDigest
    clearDigest
    commandCount
    journalDigest
```

The server owns `runId`, `season`, `rulesetHash`, the next accepted `revision`, signed run-token claims, room directives, room nonces, reward offers, merchant inventory, special-room scheduling, and terminal publication. The client projects the original game into this shape at a boundary and supplies a compact command proof; it does not replace the original game state with an Online runtime.

## 3. Lifecycle

1. Start returns a signed run token, revision 0, and the first room directive/nonce.
2. Gameplay proceeds locally and synchronously.
3. The recorder observes accepted commands locally. Recording itself is synchronous and does not contact a server.
4. At a boundary, the client submits a checkpoint with the exact expected revision, idempotency key, current room nonce, journal digest, and compact proof.
5. An accepted checkpoint advances the revision and may issue the next directive/nonce.
6. A semantic event records a low-volume transition that does not justify a full state replacement.
7. Finalize seals the run once. Only a finalized server row can produce a leaderboard entry.
8. Network loss never pauses the current combat or animation. Pending boundary work is retried outside the input/game loop with the same idempotency key. A run that cannot be reconciled is not published.

## 4. Hook plan — maximum eight hook families

No hook below is inserted in Phase 1. Line numbers identify the v0.8.0 baseline at commit `f98820c99066d810169e100beb23a54a332734bd`.

| # | Event | Exact function and proposed location | Minimal payload | Reason | Main risk |
|---|---|---|---|---|---|
| 1 | Run started | `game.js:13856 startRun(options)`, after `buildRoom()` and all carried build effects, before tutorial UI | `runId, gameVersion, startDepth, lives, build, activeMutators` | First stable complete run projection | Firing twice on continue; require a new-run marker |
| 2 | Accepted player command | `game.js:20206 finalizeTurn(command?)`, immediately after phase/re-entrancy gates; add an optional already-normalized descriptor from input/skill dispatchers | `sequence, roomIndex, roomNonce, turn, type, payload` | One synchronous acceptance seam shared by movement, attack, skills, potion and hazards | A blocked move must not be recorded; Observer Bot and mobile must use the same descriptor path |
| 3 | Room generated | `game.js:13740 buildRoom()`, after room type, enemies, objects, portal, hazards and intro are finalized, before the final `markUiDirty()` | `depth, roomIndex, directiveId, roomType, roomNonce, generationSummary` | Stable room-boundary proof without replacing rendering or AI | Scenario/debug overrides must be clearly flagged and ineligible for Ranked |
| 4 | Room cleared | `game.js:15581 checkRoomClearBonus()`, after rewards/unlocks/portal reveal have committed | `depth, roomIndex, roomNonce, roomType, clearStats` | Canonical checkpoint boundary | Arena wave transitions and final-boss phase shift are not full room clears |
| 5 | Reward/economy committed | `game.js:4745 saveRunSnapshot()`, after the local snapshot write; recorder compares the last Ranked projection and emits only if gold/build/offer/inventory changed | `gold, build, rewardOffer, merchantInventory, changeReason` | Reuses an existing post-commit seam instead of changing every merchant/reward function | Snapshot is frequent; strict diffing and reason tags must suppress noise |
| 6 | Life lost | `game.js:14250 gameOver(reason, context)`, immediately after `state.lives` is decremented and before the zero-lives branch | `depth, roomIndex, roomNonce, lives, reasonCode, statistics` | Server-authoritative life/meta transition | Do not leak free-text logs as authoritative reason codes |
| 7 | Portal / extract / finalize | One `run_transition` hook family at accepted transitions: `game.js:20445 attemptDescend()` after portal validation; `game.js:14380 extractRun()` before entering camp; `game.js:14159 triggerDepth100Victory()` after final totals; terminal branch of `game.js:14250 gameOver()` before local reset | `kind, depth, roomIndex, roomNonce, revision, gold, lives, finalSummary?` | Covers the only transitions that advance a room, leave a run, or seal it | Finalize must be idempotent; ordinary death with lives remaining is not terminal |
| 8 | Leaderboard opened | `game.js:3931 openLeaderboardModal()`, after local modal state is opened | `season, limit, detailEntryId?` | Keeps network/UI work menu-only | Practice must retain the local ledger and emit zero Online v3 requests |

Hook calls remain synchronous. A Ranked implementation may enqueue boundary work, but it must not wait in these functions.

## 5. D1 schema

Exactly two core tables are planned. There is no per-command or per-move table.

```sql
CREATE TABLE ranked_runs (
  run_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  season TEXT NOT NULL,
  game_version TEXT NOT NULL,
  ruleset_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  revision INTEGER NOT NULL,
  room_nonce TEXT NOT NULL,
  state_json TEXT NOT NULL,
  journal_digest TEXT NOT NULL,
  compact_proof_json TEXT NOT NULL,
  started_at TEXT NOT NULL,
  checkpointed_at TEXT NOT NULL,
  finalized_at TEXT,
  terminal_reason TEXT,
  score INTEGER,
  UNIQUE (season, run_id)
);

CREATE TABLE leaderboard_entries (
  entry_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL UNIQUE,
  season TEXT NOT NULL,
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL,
  depth INTEGER NOT NULL,
  gold INTEGER NOT NULL,
  lives INTEGER NOT NULL,
  bosses_cleared INTEGER NOT NULL,
  build_json TEXT NOT NULL,
  game_version TEXT NOT NULL,
  ruleset_hash TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES ranked_runs(run_id)
);

CREATE INDEX ranked_runs_player_status
  ON ranked_runs(player_id, status, checkpointed_at);

CREATE INDEX leaderboard_entries_season_score
  ON leaderboard_entries(season, score DESC, finished_at ASC);
```

`build_json` contains relic IDs with stacks, mutators, skill tiers, elixirs, and a `bossDepthSummary` array with compact boss/depth outcomes displayed in build details. Commands remain in the bounded request proof and optional client recovery journal, never as D1 rows.

## 6. Threat model

### Server-authoritative meta

- identity/eligibility and season;
- signed token validity and expiry;
- ruleset and game-version allowlist;
- monotonic revision;
- idempotency-key binding;
- room directive ID and nonce;
- legal reward offer and selected reward;
- merchant stock and legal purchase effects;
- special-room schedule;
- lives, gold and build transitions at accepted checkpoints;
- terminal state, score calculation and leaderboard publication.

### Client-trusted or heuristically checked combat

- exact movement path and timing;
- enemy AI decisions;
- hit/crit/damage rolls;
- animation and audio timing;
- frame pacing;
- detailed combat order between checkpoints.

The compact journal is evidence, not a complete server replay. The server checks sequence continuity, digest chaining, command counts, plausible time/room budgets, impossible stat jumps, legal checkpoint deltas, and nonce/revision continuity. These checks deter casual tampering but cannot prove an honest combat simulation. Online v3 must state this limitation plainly; it must not claim server-authoritative combat.

### Abuse outcomes

- invalid token, revision, idempotency binding, or nonce: reject the boundary;
- impossible meta transition: reject and mark the run ineligible;
- suspicious but not conclusive combat proof: quarantine or accept as unranked according to the future ruleset;
- lost connectivity: continue local gameplay, queue a bounded boundary retry, never block input;
- unreconciled terminal state: keep local summary, do not publish.

## 7. Guardrails

- Practice performs zero Online v3 requests.
- No `await` or Promise dependency enters input, turn resolution, animation, audio, HUD, cheat, Observer Bot, or special-room code.
- Phase 1 changes no original game file.
- New DOM/CSS naming is restricted to `ranked-v3-*`.
- New storage keys are restricted to `dungeonRankedV3*`.
- New routes are restricted to `/api/v3`.
- No Online/Ranked v2 runtime, sim-core, presentation director, HUD projection, input router, Worker, endpoint, or compatibility layer is imported.
- The original save/continue keys and behavior remain untouched.

## 8. Read-only v2 presentation inventory

Source inspected: `D:\Codex workstation\Dungeon\dungeon-3.0`. This is reference only.

| Element | Source file | Source line/function | Dependencies | Pure presentation? | Safe to copy later? |
|---|---|---|---|---|---|
| Boot markup and progressbar | `index.html` | `19-33`, `#bootScreen`, `#bootLoading` | Existing logo copy and boot element IDs | Yes | Yes, but already present in the v0.8.0 baseline; no copy needed |
| HD boot composition | `style-hd-boot.css` | `4-200` | `assets/hd/ui/boot/abyssal-gate.png`, existing fonts/textures | Yes | Yes |
| Boot progress binding | `game.js` | `1008-1053`, boot DOM references/update | Boot DOM IDs and preload inventory | Mostly; includes loading state | Reimplement narrowly, do not copy unrelated preload/runtime code |
| Boot dismiss transition | `game.js` | `9539-9559`, `dismissBootScreen()` | Boot classes `loading`, `fading`, `hidden`; audio/menu transition | No, mixed lifecycle | No direct copy; retain only timing/class sequence as reference |
| Ranked row data sanitizers | `game.js` | `5691-5735`, `sanitizeRankedV2RunDetails()`, `sanitizeRankedV2LeaderboardEntry()` | v2 response fields, `MAX_DEPTH`, `MAX_LIVES`, nickname sanitizer | No, v2 contract-specific | No; use only as display-field inventory |
| Leaderboard open/detail state | `game.js` | `5770-5808`, `openLeaderboardModal()`, `openLeaderboardDetails()` | v2 transport refresh, global game state, `markUiDirty()` | No, mixed transport/state | No direct copy |
| Top 20 row markup | `game.js` | `24205-24241`, `buildRankedV2LeaderboardRows()` | escaped strings, date formatter, `MAX_LIVES`, shrine emblem asset | Yes after supplying a v3 view model | Yes, reimplement under `ranked-v3-*` |
| Build-detail markup | `game.js` | `24283-24319`, `buildRankedV2LeaderboardDetails()` | relic/mutator catalogs, rarity colors, relic icon paths, escaping | Yes after supplying a v3 view model | Yes, adapt for stacks, skill tiers, elixirs, outcome/time and boss/depth summary |
| Modal composition | `game.js` | `24567-24608`, leaderboard branch in `buildScreenOverlay()` | shared overlay DOM, global modal state, requestAnimationFrame | Mostly presentation but embedded in HUD renderer | Reimplement as isolated v3 component; do not copy the whole branch |
| Keyboard/pointer navigation | `game.js` | `33550-33575`, `34535-34544` | global key/pointer routers and v2 modal state | No | No; reproduce behavior through isolated menu UI later |
| HD leaderboard/detail CSS | `style-hd-menu.css` | `676-1181` | gothic panel texture, section plaque, shrine emblem, menu fonts | Yes | Yes, after prefixing every selector `ranked-v3-*` |

Pure presentation ideas that may be reimplemented later under `ranked-v3-*`: Top 20 hierarchy, distinct top-three treatment, keyboard selection/scroll, status/empty/error states, build summary, relic cards with stacks, mutator chips, skill tiers, elixirs, outcome/time, boss/depth summary, and Back-to-Top-20 flow.

Do not copy:

- `refreshRankedV2Leaderboard()` (`game.js:5737-5768`) or its route;
- launch/resume campaign functions (`game.js:3545-3623`);
- `ranked-runtime.bundle.js`, `ranked-turnstile.js`, Cloudflare Worker code, v2 protocol, sim-core adapters, projection/reconciliation code, or input routing;
- v2 selectors or storage/routes.
