import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cmdPath = path.join(repoRoot, "Launch-Local-Ranked-Test.cmd");
const scriptPath = path.join(repoRoot, "scripts", "local-ranked-test-launcher.ps1");

test("Windows launcher exposes only the local Ranked test controls", async () => {
  const [cmdSource, psSource] = await Promise.all([
    readFile(cmdPath, "utf8"),
    readFile(scriptPath, "utf8")
  ]);

  assert.match(cmdSource, /local-ranked-test-launcher\.ps1/u);
  assert.match(cmdSource, /-NoProfile/u);
  assert.match(cmdSource, /for %%I in \("%~dp0\."\) do set "LAUNCHER_ROOT=%%~fI/u);
  assert.doesNotMatch(cmdSource, /set "LAUNCHER_ROOT=%~dp0\r?\n/u);
  assert.match(cmdSource, /-File "%LAUNCHER_ROOT%\\scripts\\local-ranked-test-launcher\.ps1"/u);
  assert.match(psSource, /System\.Windows\.Forms/u);
  assert.match(psSource, /Set-Location -LiteralPath \$RepositoryRoot/u);
  assert.match(psSource, /list --json/u);
  assert.match(psSource, /start --commit/u);
  assert.match(psSource, /--json-events/u);
  assert.match(psSource, /Start \+ Observer Bot/u);
  assert.match(psSource, /SelectedIndexChanged/u);
  assert.match(psSource, /function Quote-ProcessArgument/u);
  assert.match(psSource, /\.Arguments\s*=/u);
  assert.doesNotMatch(psSource, /\.ArgumentList/u);
  assert.match(psSource, /ConcurrentQueue\[string\]/u);
  assert.match(psSource, /LauncherProcessOutputPump/u);
  assert.match(psSource, /Process-LauncherEvents/u);
  assert.match(psSource, /eventTimer\.add_Tick/u);
  assert.doesNotMatch(psSource, /add_OutputDataReceived/u);
  assert.match(psSource, /commitList\.Items\[0\]\.Selected\s*=\s*\$true/u);
  assert.match(psSource, /Ready|Failed|Stopped/u);
  assert.match(psSource, /function Get-SecondaryPortraitScreen/u);
  assert.match(psSource, /Screen\]::AllScreens/u);
  assert.match(psSource, /-not \$_.Primary/u);
  assert.match(psSource, /WorkingArea\.Height -gt \$_.WorkingArea\.Width/u);
  assert.match(psSource, /start.*--multi-bot.*--json-events/su);
  for (const option of ["--monitor-x", "--monitor-y", "--monitor-width", "--monitor-height"]) {
    assert.match(psSource, new RegExp(option, "u"));
  }
  assert.match(psSource, /RedirectStandardInput\s*=\s*\$true/u);
  assert.match(psSource, /StandardInput\.WriteLine/u);
  assert.match(psSource, /ConvertTo-Json -Compress/u);
  assert.match(psSource, /Start 8 Observer Bots/u);
  assert.match(psSource, /Stop All/u);
  assert.match(psSource, /Open diagnostics folder/u);
  assert.match(psSource, /ListView/u);
  for (const column of ["Bot", "Status", "Depth", "Score", "HP", "Last decision", "Updated", "Error"]) {
    assert.match(psSource, new RegExp("Columns\\.Add\\(\"" + column + "\"", "u"));
  }
  assert.match(psSource, /function Update-BotWallSummary/u);
  assert.match(psSource, /function Add-BotMilestone/u);
  assert.match(psSource, /bot_status/u);
  assert.match(psSource, /bot_failure/u);
  assert.match(psSource, /wall_ready/u);
  assert.match(psSource, /artifact_root/u);
  assert.match(psSource, /focus_bot/u);
  assert.match(psSource, /stop_bot/u);
  assert.doesNotMatch(psSource, /Get-Process|Stop-Process/u);
  assert.doesNotMatch(psSource, /\$passwordBox\.Text\s*=\s*"[^"]+"/u);
  assert.doesNotMatch(psSource, /wrangler\s+deploy|pages\s+deploy|--remote|\btunnel\b/u);
  assert.doesNotMatch(psSource, /DUNGEON_ONLINE_TEST_BOT_PASSWORD\s*=/u);
});
