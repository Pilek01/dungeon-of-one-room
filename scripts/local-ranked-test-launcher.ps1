param(
  [Parameter(Mandatory = $true)]
  [string] $RepositoryRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System.Collections.Concurrent;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;

public static class LauncherProcessOutputPump
{
    public static void Start(Process process, ConcurrentQueue<string> queue)
    {
        Task.Factory.StartNew(
            () => Pump(process.StandardOutput, queue),
            TaskCreationOptions.LongRunning
        );
        Task.Factory.StartNew(
            () => Pump(process.StandardError, queue),
            TaskCreationOptions.LongRunning
        );
    }

    private static void Pump(StreamReader reader, ConcurrentQueue<string> queue)
    {
        string line;
        while ((line = reader.ReadLine()) != null)
        {
            queue.Enqueue(line);
        }
    }
}
"@

$RepositoryRoot = [System.IO.Path]::GetFullPath($RepositoryRoot)
Set-Location -LiteralPath $RepositoryRoot
$corePath = Join-Path $RepositoryRoot "scripts\local-ranked-test-launcher-core.mjs"
$script:activeProcess = $null
$script:readyUrl = $null
$script:artifactRoot = $null
$script:isMultiBotSession = $false
$script:botRows = @{}
$script:botMilestones = @{}
$script:launcherEventQueue = [System.Collections.Concurrent.ConcurrentQueue[string]]::new()

function Quote-ProcessArgument([string] $Argument) {
  if ($null -eq $Argument -or $Argument.Length -eq 0) { return '""' }
  $escaped = [regex]::Replace($Argument, '(\\*)"', '$1$1\"')
  $escaped = [regex]::Replace($escaped, '(\\+)$', '$1$1')
  return '"' + $escaped + '"'
}

function Get-SecondaryPortraitScreen {
  $candidate = [System.Windows.Forms.Screen]::AllScreens |
    Where-Object { -not $_.Primary -and $_.WorkingArea.Height -gt $_.WorkingArea.Width } |
    Select-Object -First 1
  if ($null -eq $candidate) {
    throw "Eight-bot mode requires a connected secondary portrait monitor."
  }
  return $candidate
}

function Send-LauncherCommand([hashtable] $Command) {
  if ($null -eq $script:activeProcess -or $script:activeProcess.HasExited) {
    throw "No local launcher session is running."
  }
  $json = $Command | ConvertTo-Json -Compress
  $script:activeProcess.StandardInput.WriteLine($json)
  $script:activeProcess.StandardInput.Flush()
}

function Set-ArtifactRoot([string] $Candidate) {
  $fullPath = [System.IO.Path]::GetFullPath($Candidate)
  $ownedRoot = [System.IO.Path]::GetFullPath((Join-Path $RepositoryRoot "output\multi-bot-runs")) +
    [System.IO.Path]::DirectorySeparatorChar
  if (-not $fullPath.StartsWith($ownedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "The diagnostics path is outside output\multi-bot-runs."
  }
  $script:artifactRoot = $fullPath
  $openDiagnosticsButton.Enabled = $true
}

function Initialize-BotRows {
  $botList.Items.Clear()
  $script:botRows = @{}
  $script:botMilestones = @{}
  foreach ($index in 1..8) {
    $botId = "bot-{0:D2}" -f $index
    $row = [System.Windows.Forms.ListViewItem]::new("bot $index")
    foreach ($value in @("Waiting", "0", "0", "0", "", "", "")) {
      [void] $row.SubItems.Add($value)
    }
    $row.Tag = $botId
    [void] $botList.Items.Add($row)
    $script:botRows[$botId] = $row
  }
}

function Update-BotRow($Message) {
  $botId = [string] $Message.botId
  if (-not $script:botRows.ContainsKey($botId)) { return }
  $row = $script:botRows[$botId]
  $row.SubItems[1].Text = [string] $Message.status
  $row.SubItems[2].Text = [string] $Message.depth
  $row.SubItems[3].Text = [string] $Message.score
  $row.SubItems[4].Text = [string] $Message.hp
  $row.SubItems[5].Text = [string] $Message.lastDecision
  try {
    $row.SubItems[6].Text = [DateTimeOffset]::Parse([string] $Message.updatedAt).ToLocalTime().ToString("HH:mm:ss")
  } catch {
    $row.SubItems[6].Text = [string] $Message.updatedAt
  }
  $row.SubItems[7].Text = [string] $Message.error
  if ([string] $Message.status -in @("failed", "blocked")) {
    $row.BackColor = [System.Drawing.Color]::DarkRed
    $row.ForeColor = [System.Drawing.Color]::White
  } else {
    $row.BackColor = $botList.BackColor
    $row.ForeColor = $botList.ForeColor
  }
}

function Add-StatusLine([string] $Text) {
  $safeText = [string] $Text
  $password = [string] $passwordBox.Text
  if ($password) {
    $safeText = $safeText.Replace($password, "[redacted]")
  }
  $safeText = $safeText -replace "(?i)(RANKED_V3_HMAC_SECRET\\s*[=:]\\s*)\\S+", '$1[redacted]'
  $statusBox.AppendText("$safeText`r`n")
  $statusBox.SelectionStart = $statusBox.TextLength
  $statusBox.ScrollToCaret()
}

function Add-BotMilestone($Message) {
  $botId = [string] $Message.botId
  $status = [string] $Message.status
  $depth = [string] $Message.depth
  $errorText = [string] $Message.error
  $milestone = "$status|$depth|$errorText"
  if ($script:botMilestones.ContainsKey($botId) -and $script:botMilestones[$botId] -eq $milestone) {
    return
  }
  $script:botMilestones[$botId] = $milestone
  $detail = if ($errorText) { " | $errorText" } elseif ([string] $Message.lastDecision) {
    " | $([string] $Message.lastDecision)"
  } else { "" }
  Add-StatusLine "$([string] $Message.name): $status | depth $depth$detail"
}

function Update-BotWallSummary {
  $active = 0
  $completed = 0
  $failed = 0
  $stopped = 0
  foreach ($row in $script:botRows.Values) {
    switch ([string] $row.SubItems[1].Text) {
      { $_ -in @("starting", "running") } { $active += 1; break }
      "completed" { $completed += 1; break }
      { $_ -in @("failed", "blocked") } { $failed += 1; break }
      "stopped" { $stopped += 1; break }
    }
  }
  Set-SessionState "Active $active | Completed $completed | Failed $failed | Stopped $stopped"
}

function Set-SessionState([string] $State) {
  $statusLabel.Text = "Status: $State"
}

function Set-StartAvailability {
  $startButton.Enabled = ($null -eq $script:activeProcess -and $commitList.SelectedItems.Count -eq 1)
  $startEightButton.Enabled = ($null -eq $script:activeProcess -and $commitList.Items.Count -gt 0)
}

function Clear-LauncherEvents {
  [string] $discardedLine = $null
  while ($script:launcherEventQueue.TryDequeue([ref] $discardedLine)) { }
}

function Process-LauncherEvents {
  [string] $line = $null
  while ($script:launcherEventQueue.TryDequeue([ref] $line)) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    try {
      $message = $line | ConvertFrom-Json -ErrorAction Stop
      if ($message.type -eq "ready") {
        $script:readyUrl = [string] $message.url
        $openGameButton.Enabled = $true
        Set-SessionState "Ready"
        Add-StatusLine "Ready: $($script:readyUrl)"
        Start-Process $script:readyUrl
      } elseif ($message.type -eq "wall_starting") {
        Set-SessionState "Starting 8 bots"
        Add-StatusLine "Starting 8 Observer Bots on commit $(([string] $message.commit).Substring(0, 12))."
      } elseif ($message.type -eq "bot_status") {
        Update-BotRow $message
        Add-BotMilestone $message
        Update-BotWallSummary
      } elseif ($message.type -eq "bot_failure") {
        if ($script:botRows.ContainsKey([string] $message.botId)) {
          $row = $script:botRows[[string] $message.botId]
          $row.SubItems[7].Text = [string] $message.kind
          $row.BackColor = [System.Drawing.Color]::DarkRed
          $row.ForeColor = [System.Drawing.Color]::White
        }
        Update-BotWallSummary
        Add-StatusLine "Failure $($message.botId): $($message.kind). Diagnostics: $($message.artifactDir)"
      } elseif ($message.type -eq "artifact_root") {
        Set-ArtifactRoot ([string] $message.path)
        Add-StatusLine "Diagnostics folder: $($script:artifactRoot)"
      } elseif ($message.type -eq "wall_ready") {
        Update-BotWallSummary
        Add-StatusLine "All 8 Observer Bots are running on the newest local commit."
      } elseif ($message.type -eq "command_failed") {
        Add-StatusLine "Command failed: $($message.message)"
      } elseif ($message.type -eq "failed") {
        Set-SessionState "Failed"
        Add-StatusLine "Failed: $($message.message)"
      } elseif ($message.type -eq "stopped") {
        Set-SessionState "Stopped"
        Add-StatusLine "Stopped local launcher session."
      } else {
        Add-StatusLine $line
      }
    } catch {
      Add-StatusLine $line
    }
  }

  if ($null -ne $script:activeProcess -and $script:activeProcess.HasExited) {
    $script:activeProcess = $null
    $stopButton.Enabled = $false
    $stopAllButton.Enabled = $false
    $focusBotButton.Enabled = $false
    $stopBotButton.Enabled = $false
    if ($statusLabel.Text -notmatch "Failed") {
      Set-SessionState "Stopped"
      Add-StatusLine "Stopped local launcher session."
    }
    Set-StartAvailability
  }
}

function Stop-LauncherSession {
  if ($null -eq $script:activeProcess) { return }
  $process = $script:activeProcess
  $processId = $process.Id
  try {
    if ($script:isMultiBotSession) {
      Send-LauncherCommand @{ type = "stop" }
      if (-not $process.WaitForExit(10000)) {
        Add-StatusLine "Graceful Stop All timed out; closing only the owned launcher process tree."
        & taskkill.exe /PID $processId /T /F | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "taskkill.exe returned exit code $LASTEXITCODE." }
      }
    } else {
      & taskkill.exe /PID $processId /T /F | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "taskkill.exe returned exit code $LASTEXITCODE." }
    }
    Set-SessionState "Stopped"
    Add-StatusLine "Stopped local launcher session."
  } catch {
    Set-SessionState "Failed"
    Add-StatusLine "Failed to stop the local launcher session: $($_.Exception.Message)"
  } finally {
    $script:activeProcess = $null
    $stopButton.Enabled = $false
    $stopAllButton.Enabled = $false
    $focusBotButton.Enabled = $false
    $stopBotButton.Enabled = $false
    $script:isMultiBotSession = $false
    Set-StartAvailability
  }
}

function Start-LauncherSession([switch] $MultiBot) {
  if (-not $MultiBot -and $commitList.SelectedItems.Count -ne 1) {
    Set-SessionState "Awaiting commit selection"
    Add-StatusLine "Select one commit before starting the local test."
    return
  }

  if ($MultiBot -and [string]::IsNullOrWhiteSpace([string] $passwordBox.Text)) {
    throw "Enter the local Observer Bot password before starting 8 bots."
  }
  $commit = if ($MultiBot) {
    [string] $commitList.Items[0].Tag
  } else {
    [string] $commitList.SelectedItems[0].Tag
  }
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = "node.exe"
  $startInfo.WorkingDirectory = $RepositoryRoot
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.RedirectStandardInput = $true
  if ($MultiBot) {
    $screen = Get-SecondaryPortraitScreen
    $workingArea = $screen.WorkingArea
    # Node protocol: start --multi-bot --json-events with exact portrait working-area bounds.
    $rawArguments = @(
      $corePath, "start", "--multi-bot", "--json-events",
      "--monitor-x", [string] $workingArea.X,
      "--monitor-y", [string] $workingArea.Y,
      "--monitor-width", [string] $workingArea.Width,
      "--monitor-height", [string] $workingArea.Height
    )
  } else {
    # Node protocol: start --commit <full-hash> --json-events.
    $rawArguments = @($corePath, "start", "--commit", $commit, "--json-events")
  }
  $nodeArguments = @($rawArguments | ForEach-Object {
    Quote-ProcessArgument ([string] $_)
  })
  $startInfo.Arguments = [string]::Join(" ", $nodeArguments)
  [void] $startInfo.EnvironmentVariables.Remove("DUNGEON_ONLINE_TEST_BOT_PASSWORD")
  if ($MultiBot -or $observerCheckbox.Checked) {
    $startInfo.EnvironmentVariables["DUNGEON_ONLINE_TEST_BOT_PASSWORD"] = [string] $passwordBox.Text
  }

  $script:readyUrl = $null
  $script:artifactRoot = $null
  $script:isMultiBotSession = [bool] $MultiBot
  Clear-LauncherEvents
  Initialize-BotRows
  $openGameButton.Enabled = $false
  $openDiagnosticsButton.Enabled = $false
  $startButton.Enabled = $false
  $startEightButton.Enabled = $false
  $stopButton.Enabled = $true
  $stopAllButton.Enabled = [bool] $MultiBot
  $focusBotButton.Enabled = [bool] $MultiBot
  $stopBotButton.Enabled = [bool] $MultiBot
  Set-SessionState "Starting"
  if ($MultiBot) {
    Add-StatusLine "Preparing 8 HD Observer Bots on newest local commit $($commit.Substring(0, 12))."
  } else {
    Add-StatusLine "Preparing selected local revision $($commit.Substring(0, 12))."
  }

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  if (-not $process.Start()) {
    throw "Could not start Node.js for the local launcher."
  }
  $script:activeProcess = $process
  [LauncherProcessOutputPump]::Start($process, $script:launcherEventQueue)
}

function Get-LocalCandidates {
  $json = & node.exe $corePath list --json 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ([string]::Join([Environment]::NewLine, @($json)))
  }
  return ([string]::Join("`n", @($json)) | ConvertFrom-Json -ErrorAction Stop)
}

$form = [System.Windows.Forms.Form]::new()
$form.Text = "Dungeon Online v3 - Local Ranked Test"
$form.ClientSize = [System.Drawing.Size]::new(1180, 850)
$form.StartPosition = "CenterScreen"
$form.MinimizeBox = $false
$form.MaximizeBox = $false

$branchLabel = [System.Windows.Forms.Label]::new()
$branchLabel.Location = [System.Drawing.Point]::new(16, 16)
$branchLabel.Size = [System.Drawing.Size]::new(1148, 24)
$branchLabel.Text = "Eligible branch: loading..."
$form.Controls.Add($branchLabel)

$commitList = [System.Windows.Forms.ListView]::new()
$commitList.Location = [System.Drawing.Point]::new(16, 50)
$commitList.Size = [System.Drawing.Size]::new(1148, 145)
$commitList.View = [System.Windows.Forms.View]::Details
$commitList.FullRowSelect = $true
$commitList.MultiSelect = $false
[void] $commitList.Columns.Add("Date", 190)
[void] $commitList.Columns.Add("Commit", 110)
[void] $commitList.Columns.Add("Subject", 825)
$commitList.add_SelectedIndexChanged({ Set-StartAvailability })
$form.Controls.Add($commitList)

$observerCheckbox = [System.Windows.Forms.CheckBox]::new()
$observerCheckbox.Location = [System.Drawing.Point]::new(16, 210)
$observerCheckbox.Size = [System.Drawing.Size]::new(200, 24)
$observerCheckbox.Text = "Observer Bot (local test)"
$form.Controls.Add($observerCheckbox)

$passwordLabel = [System.Windows.Forms.Label]::new()
$passwordLabel.Location = [System.Drawing.Point]::new(230, 213)
$passwordLabel.Size = [System.Drawing.Size]::new(160, 20)
$passwordLabel.Text = "Local bot password:"
$form.Controls.Add($passwordLabel)

$passwordBox = [System.Windows.Forms.TextBox]::new()
$passwordBox.Location = [System.Drawing.Point]::new(390, 210)
$passwordBox.Size = [System.Drawing.Size]::new(210, 24)
$passwordBox.UseSystemPasswordChar = $true
$form.Controls.Add($passwordBox)

$startButton = [System.Windows.Forms.Button]::new()
$startButton.Location = [System.Drawing.Point]::new(16, 250)
$startButton.Size = [System.Drawing.Size]::new(185, 34)
$startButton.Text = "Start selected test"
$startButton.Enabled = $false
$startButton.add_Click({
  try {
    Start-LauncherSession
  } catch {
    Set-SessionState "Failed"
    Add-StatusLine "Failed to start the local launcher: $($_.Exception.Message)"
    $script:activeProcess = $null
    $stopButton.Enabled = $false
    Set-StartAvailability
  }
})
$form.Controls.Add($startButton)

$openGameButton = [System.Windows.Forms.Button]::new()
$openGameButton.Location = [System.Drawing.Point]::new(215, 250)
$openGameButton.Size = [System.Drawing.Size]::new(185, 34)
$openGameButton.Text = "Open Game"
$openGameButton.Enabled = $false
$openGameButton.add_Click({ if ($script:readyUrl) { Start-Process $script:readyUrl } })
$form.Controls.Add($openGameButton)

$stopButton = [System.Windows.Forms.Button]::new()
$stopButton.Location = [System.Drawing.Point]::new(415, 250)
$stopButton.Size = [System.Drawing.Size]::new(185, 34)
$stopButton.Text = "Stop selected test"
$stopButton.Enabled = $false
$stopButton.add_Click({ Stop-LauncherSession })
$form.Controls.Add($stopButton)

$startEightButton = [System.Windows.Forms.Button]::new()
$startEightButton.Location = [System.Drawing.Point]::new(615, 250)
$startEightButton.Size = [System.Drawing.Size]::new(210, 34)
$startEightButton.Text = "Start 8 Observer Bots"
$startEightButton.Enabled = $false
$startEightButton.add_Click({
  try {
    Start-LauncherSession -MultiBot
  } catch {
    Set-SessionState "Failed"
    Add-StatusLine "Failed to start 8 Observer Bots: $($_.Exception.Message)"
    $script:activeProcess = $null
    $stopButton.Enabled = $false
    $stopAllButton.Enabled = $false
    Set-StartAvailability
  }
})
$form.Controls.Add($startEightButton)

$stopAllButton = [System.Windows.Forms.Button]::new()
$stopAllButton.Location = [System.Drawing.Point]::new(840, 250)
$stopAllButton.Size = [System.Drawing.Size]::new(145, 34)
$stopAllButton.Text = "Stop All"
$stopAllButton.Enabled = $false
$stopAllButton.add_Click({ Stop-LauncherSession })
$form.Controls.Add($stopAllButton)

$openDiagnosticsButton = [System.Windows.Forms.Button]::new()
$openDiagnosticsButton.Location = [System.Drawing.Point]::new(1000, 250)
$openDiagnosticsButton.Size = [System.Drawing.Size]::new(164, 34)
$openDiagnosticsButton.Text = "Open diagnostics folder"
$openDiagnosticsButton.Enabled = $false
$openDiagnosticsButton.add_Click({
  if ($script:artifactRoot -and [System.IO.Directory]::Exists($script:artifactRoot)) {
    Start-Process "explorer.exe" -ArgumentList @($script:artifactRoot)
  }
})
$form.Controls.Add($openDiagnosticsButton)

$botList = [System.Windows.Forms.ListView]::new()
$botList.Location = [System.Drawing.Point]::new(16, 305)
$botList.Size = [System.Drawing.Size]::new(1148, 250)
$botList.View = [System.Windows.Forms.View]::Details
$botList.FullRowSelect = $true
$botList.MultiSelect = $false
$botList.GridLines = $true
[void] $botList.Columns.Add("Bot", 90)
[void] $botList.Columns.Add("Status", 115)
[void] $botList.Columns.Add("Depth", 70)
[void] $botList.Columns.Add("Score", 90)
[void] $botList.Columns.Add("HP", 70)
[void] $botList.Columns.Add("Last decision", 285)
[void] $botList.Columns.Add("Updated", 90)
[void] $botList.Columns.Add("Error", 320)
$form.Controls.Add($botList)

$focusBotButton = [System.Windows.Forms.Button]::new()
$focusBotButton.Location = [System.Drawing.Point]::new(16, 570)
$focusBotButton.Size = [System.Drawing.Size]::new(150, 32)
$focusBotButton.Text = "Focus selected bot"
$focusBotButton.Enabled = $false
$focusBotButton.add_Click({
  if ($botList.SelectedItems.Count -eq 1) {
    Send-LauncherCommand @{ type = "focus_bot"; botId = [string] $botList.SelectedItems[0].Tag }
  }
})
$form.Controls.Add($focusBotButton)

$stopBotButton = [System.Windows.Forms.Button]::new()
$stopBotButton.Location = [System.Drawing.Point]::new(180, 570)
$stopBotButton.Size = [System.Drawing.Size]::new(150, 32)
$stopBotButton.Text = "Stop selected bot"
$stopBotButton.Enabled = $false
$stopBotButton.add_Click({
  if ($botList.SelectedItems.Count -eq 1) {
    Send-LauncherCommand @{ type = "stop_bot"; botId = [string] $botList.SelectedItems[0].Tag }
  }
})
$form.Controls.Add($stopBotButton)

$botList.add_DoubleClick({
  if ($botList.SelectedItems.Count -eq 1 -and $focusBotButton.Enabled) {
    Send-LauncherCommand @{ type = "focus_bot"; botId = [string] $botList.SelectedItems[0].Tag }
  }
})

$statusLabel = [System.Windows.Forms.Label]::new()
$statusLabel.Location = [System.Drawing.Point]::new(16, 615)
$statusLabel.Size = [System.Drawing.Size]::new(1148, 24)
$statusLabel.Text = "Status: Stopped"
$form.Controls.Add($statusLabel)

$statusBox = [System.Windows.Forms.TextBox]::new()
$statusBox.Location = [System.Drawing.Point]::new(16, 645)
$statusBox.Size = [System.Drawing.Size]::new(1148, 180)
$statusBox.Multiline = $true
$statusBox.ReadOnly = $true
$statusBox.ScrollBars = [System.Windows.Forms.ScrollBars]::Vertical
$form.Controls.Add($statusBox)

Initialize-BotRows

$eventTimer = [System.Windows.Forms.Timer]::new()
$eventTimer.Interval = 100
$eventTimer.add_Tick({ Process-LauncherEvents })
$eventTimer.Start()

try {
  $candidates = Get-LocalCandidates
  $branchLabel.Text = "Eligible branch: $($candidates.branch.name)"
  foreach ($commit in @($candidates.commits | Select-Object -First 5)) {
    $row = [System.Windows.Forms.ListViewItem]::new([string] $commit.date)
    [void] $row.SubItems.Add(([string] $commit.hash).Substring(0, 12))
    [void] $row.SubItems.Add([string] $commit.subject)
    $row.Tag = [string] $commit.hash
    [void] $commitList.Items.Add($row)
  }
  Add-StatusLine "The newest eligible commit will be selected automatically."
} catch {
  $branchLabel.Text = "Eligible branch: unavailable"
  Set-SessionState "Failed"
  Add-StatusLine "Failed to read local launch candidates: $($_.Exception.Message)"
}

$form.add_Shown({
  if ($commitList.Items.Count -gt 0) {
    $commitList.Items[0].Selected = $true
    $commitList.Items[0].Focused = $true
    $commitList.Select()
    Set-StartAvailability
    Add-StatusLine "Newest eligible commit selected. Choose Start or Start + Observer Bot."
  }
})
$form.add_FormClosing({
  $eventTimer.Stop()
  Stop-LauncherSession
})
[void] $form.ShowDialog()
