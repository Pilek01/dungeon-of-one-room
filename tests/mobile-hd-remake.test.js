const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), "utf8");
const readOptional = (relative) => {
  const target = path.join(ROOT, relative);
  return fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
};

const html = read("index.html");
const game = read("game.js");
const mobileCss = readOptional("style-mobile-hd.css");
const scenarios = read("scenario-overrides.js");

test("approved mobile HD stylesheet is the final composition layer", () => {
  assert.match(html, /href=["']style-mobile-hd\.css["']/u);
  assert(
    html.indexOf("style-mobile-hd.css") > html.indexOf("style-hd-boot.css"),
    "mobile HD stylesheet must load after every desktop HD stylesheet"
  );
});

test("mobile command deck exposes semantic HD controls and a real D-pad", () => {
  for (const id of [
    "mobileCommandDeck",
    "mobileHud",
    "mobileFuryMeter",
    "mobileDetailsButton",
    "mbtnUp",
    "mbtnDown",
    "mbtnLeft",
    "mbtnRight"
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`, "u"), `${id} must exist`);
  }

  for (const [id, key] of [
    ["mbtnZ", "z"],
    ["mbtnX", "x"],
    ["mbtnC", "c"],
    ["mbtnF", "f"],
    ["mbtnG", "g"],
    ["mbtnE", "e"],
    ["mbtnQ", "q"]
  ]) {
    assert.match(
      html,
      new RegExp(`id=["']${id}["'][^>]*data-action-key=["']${key}["']`, "u"),
      `${id} must declare its canonical action key`
    );
  }

  for (const asset of [
    "skill-dash.png",
    "skill-shockwave.png",
    "skill-shield.png",
    "status/potion.png",
    "status/elixir.png"
  ]) {
    assert.match(html, new RegExp(asset.replace(/[./]/gu, "\\$&"), "u"), `${asset} must be visible in the command deck`);
  }
  assert.match(html, /id=["']mobileDetailsButton["'][^>]*aria-expanded=["']false["']/u);
  assert.match(game, /setMobileDetailsOpen/u);
  assert.match(game, /mobileDetailsButtonEl\.addEventListener\(["']click["']/u);
  assert.match(mobileCss, /body[^\n{]*\.mobile-details-open[\s\S]*\.panel-left/u);
});

test("mobile Fury uses one stable current/max meter and supports effective 7/7", () => {
  assert.match(html, /id=["']mobileFuryMeter["'][^>]*role=["']meter["']/u);
  assert.match(html, /id=["']mobileFuryValue["']/u);
  assert.match(html, /status\/fury\.png/u);
  assert.match(game, /getEffectiveAdrenaline\s*\(\)/u);
  assert.match(game, /getEffectiveMaxAdrenaline\s*\(\)/u);
  assert.match(game, /mobileFury(?:Meter|Value)/u);
  assert.match(game, /--meter-fill|--mobile-fury-fill/u);
  assert.doesNotMatch(
    game,
    /mobileFury[^\n]*Array\.from\s*\(\s*\{\s*length\s*:\s*furyMax/iu,
    "mobile Fury must not create one pip per maximum stack"
  );
  assert.match(scenarios, /fury_seven_hd[\s\S]*forceFurySevenHDShowcaseSetup\s*:\s*true/u);
  assert.match(
    game,
    /forceFurySevenHDShowcaseSetup\)\s*\{[\s\S]*maxAdrenaline\s*=\s*5[\s\S]*adrenaline\s*=\s*5[\s\S]*furyBlessingTurns\s*=\s*99/u,
    "the deterministic fixture must combine stored 5/5 with the real +2 Fury blessing"
  );
});

test("mobile landscape is a single square playfield plus visible command deck", () => {
  assert.match(mobileCss, /body\.mobile-touch\.mobile-landscape/u);
  assert.match(mobileCss, /--mobile-playfield-size/u);
  assert.match(mobileCss, /aspect-ratio\s*:\s*1(?:\s*\/\s*1)?/u);
  assert.match(mobileCss, /--mobile-command-width/u);
  assert.match(mobileCss, /env\(safe-area-inset-(?:top|right|bottom|left)/u);
  assert.match(mobileCss, /100vh[\s\S]*100dvh/u);
  assert.match(mobileCss, /#mobileCommandDeck/u);
  assert.match(mobileCss, /\.mobile-dpad/u);
  assert.match(mobileCss, /min-(?:width|height)\s*:\s*48px/u);
  assert.doesNotMatch(mobileCss, /\.layout-track[^}]*width\s*:\s*300%/su);
  assert.doesNotMatch(mobileCss, /\.mobile-dpad[^}]*display\s*:\s*none/isu);
});
