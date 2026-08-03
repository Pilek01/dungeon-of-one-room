import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
globalThis.DungeonRelicData = {
  RELICS: [{ id: "fang", name: "Fang Charm", desc: "+10 ATK", rarity: "normal" }]
};
const clientApi = require("../../../online-v3/ranked-v3-client.js");
const leaderboardUi = require("../../../online-v3/ranked-v3-leaderboard-ui.js");
const rankedUi = require("../../../online-v3/ranked-v3-ui.js");

function fakeDocument() {
  return {
    createElement(tag) {
      return {
        tag,
        className: "",
        textContent: "",
        children: [],
        attributes: new Map(),
        append(...children) { this.children.push(...children); },
        setAttribute(name, value) { this.attributes.set(String(name), String(value)); },
        addEventListener(type, handler) { this.listener = { type, handler }; }
      };
    }
  };
}

test("M4 leaderboard client preserves opaque cursor and canonical server order", async () => {
  const requests = [];
  const client = clientApi.createLeaderboardClient({
    transport: {
      async request(endpoint) {
        requests.push(endpoint);
        return {
          payload: {
            ok: true,
            season: "season-a",
            entries: [
              { runId: "run_aa", playerName: "Second", score: 90 },
              { runId: "run_bb", playerName: "Third", score: 80 }
            ],
            cursor: "opaque+/cursor=="
          }
        };
      }
    }
  });
  const payload = await client.list({
    season: "season-a",
    limit: 20,
    cursor: "opaque+/cursor=="
  });
  const view = leaderboardUi.createLeaderboardViewModel(payload, 1);
  assert.deepEqual(view.rows.map((row) => row.runId), ["run_aa", "run_bb"]);
  assert.deepEqual(view.rows.map((row) => row.rank), [2, 3]);
  assert.equal(view.cursor, "opaque+/cursor==");
  assert.match(requests[0].path, /cursor=opaque%2B%2Fcursor%3D%3D/u);
});

test("M4 leaderboard detail uses canonical public build and excludes private fields", async () => {
  let observedPath = "";
  const client = clientApi.createLeaderboardClient({
    transport: {
      async request(endpoint) {
        observedPath = endpoint.path;
        return {
          payload: {
            ok: true,
            entry: {
              runId: "run_ab12",
              season: "season-a",
              playerName: "Player",
              score: 123,
              outcome: "victory",
              build: {
                relics: [{ relicId: "fang", stacks: 2, rarity: "rare" }],
                pacts: ["glass-cannon"],
                skillTiers: { dash: 2 },
                campUpgrades: { hp: 1 },
                elixirs: [{ elixirId: "haste" }],
                runModifiers: {
                  active: [{ modifierId: "ascension", stacks: 1 }],
                  modifierDigest: "private-not-rendered"
                },
                buildDigest: "private-not-rendered"
              },
              summary: {
                lives: { remaining: 1, maximum: 3 },
                rulesetId: "v08-meta-1",
                scoreVersion: "v08-score-1"
              },
              stateDigest: "private-not-rendered"
            }
          }
        };
      }
    }
  });
  const detail = leaderboardUi.createDetailViewModel(await client.detail("run_ab12"));
  assert.equal(observedPath, "/api/v3/leaderboard/run_ab12");
  assert.deepEqual(detail.build.relics, [{ relicId: "fang", stacks: 2 }]);
  assert.deepEqual(detail.build.runModifiers, [{ modifierId: "ascension", stacks: 1 }]);
  assert.equal(Object.hasOwn(detail.build, "buildDigest"), false);
  assert.equal(Object.hasOwn(detail, "stateDigest"), false);
});

test("M4 leaderboard rendering is text-safe and never uses innerHTML", () => {
  const documentRef = fakeDocument();
  const rows = [leaderboardUi.toLeaderboardRow({
    runId: "run_ab12",
    playerName: "<img src=x onerror=alert(1)>",
    score: 5,
    outcome: "defeat"
  })];
  const rendered = leaderboardUi.renderList(documentRef, rows, () => {});
  const text = (node) => [node.textContent, ...(node.children || []).map(text)].join(" ");
  const visible = text(rendered);
  assert.match(visible, /Champion.*Rank.*#1.*<img src=x onerror=alert\(1\)>.*Score.*5/su);
  const allNodes = (node) => [node, ...(node.children || []).flatMap(allNodes)];
  assert.equal(allNodes(rendered).some((node) => "innerHTML" in node), false);
});

test("M4 leaderboard detail rejects non-canonical run IDs before transport", async () => {
  let called = false;
  const client = clientApi.createLeaderboardClient({
    transport: {
      async request() {
        called = true;
        return { payload: {} };
      }
    }
  });
  await assert.rejects(() => client.detail("../private"), /LEADERBOARD_RUN_ID_INVALID/u);
  assert.equal(called, false);
});
test("M4 leaderboard renders player-facing relic names without protocol metadata", () => {
  const documentRef = fakeDocument();
  const detail = leaderboardUi.createDetailViewModel({
    entry: {
      playerName: "Player",
      outcome: "victory",
      createdAt: 1,
      build: { relics: [{ relicId: "fang", stacks: 2 }] },
      summary: { rulesetId: "v08-meta-1", scoreVersion: "v08-score-1" }
    }
  });
  const rendered = leaderboardUi.renderDetail(documentRef, detail);
  const text = (node) => [node.textContent, ...(node.children || []).map(text)].join(" ");
  const visible = text(rendered);
  assert.match(visible, /Fang Charm.*Stack x2/su);
  assert.doesNotMatch(visible, /v08-meta-1|v08-score-1|\bfang\b/u);
});
test("M4 Ranked relic choices resolve catalog name, description, rarity, and icon", () => {
  globalThis.DungeonRelicData.RELICS[0].icon = "assets/hd/ui/relics/fang.png";
  const details = rankedUi.relicDetails({ choiceId: "opaque-1", relicId: "fang" });
  assert.deepEqual({
    id: details.id,
    name: details.name,
    description: details.description,
    rarity: details.rarity,
    icon: details.icon
  }, {
    id: "fang",
    name: "Fang Charm",
    description: "+10 ATK",
    rarity: "normal",
    icon: "assets/hd/ui/relics/fang.png"
  });
});
test("M4 Ranked choice copy hides protocol-style separators", () => {
  assert.equal(rankedUi.playerText("Upgrade crit_chance to 1"), "Upgrade crit chance to 1");
  assert.equal(rankedUi.playerText("buy_iron-1"), "Buy iron 1");
});
test("M4 archive consumers load the shared renderer before the adapter and game", async () => {
  const index = await readFile(new URL("../../../index.html", import.meta.url), "utf8");
  const renderer = index.indexOf('<script src="record-archive-ui.js"></script>');
  const adapter = index.indexOf('<script src="online-v3/ranked-v3-leaderboard-ui.js"></script>');
  const game = index.indexOf('<script src="game.js"></script>');
  assert(renderer >= 0);
  assert(renderer < adapter);
  assert(adapter < game);
});
