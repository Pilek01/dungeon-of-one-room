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
$script:launcherEventQueue = [System.Collections.Concurrent.ConcurrentQueue[string]]::new()

function Quote-ProcessArgument([string] $Argument) {
  if ($null -eq $Argument -or $Argument.Length -eq 0) { return '""' }
  $escaped = [regex]::Replace($Argument, '(\\*)"', '$1$1\"')
  $escaped = [regex]::Replace($escaped, '(\\+)$', '$1$1')
  return '"' + $escaped + '"'
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

function Set-SessionState([string] $State) {
  $statusLabel.Text = "Status: $State"
}

function Set-StartAvailability {
  $startButton.Enabled = ($null -eq $script:activeProcess -and $commitList.SelectedItems.Count -eq 1)
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
    if ($statusLabel.Text -notmatch "Failed") {
      Set-SessionState "Stopped"
      Add-StatusLine "Stopped local launcher session."
    }
    Set-StartAvailability
  }
}

function Stop-LauncherSession {
  if ($null -eq $script:activeProcess) { return }
  $processId = $script:activeProcess.Id
  try {
    & taskkill.exe /PID $processId /T /F | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "taskkill.exe returned exit code $LASTEXITCODE." }
    Set-SessionState "Stopped"
    Add-StatusLine "Stopped local launcher session."
  } catch {
    Set-SessionState "Failed"
    Add-StatusLine "Failed to stop the local launcher session: $($_.Exception.Message)"
  } finally {
    $script:activeProcess = $null
    $stopButton.Enabled = $false
    Set-StartAvailability
  }
}

function Start-LauncherSession {
  if ($commitList.SelectedItems.Count -ne 1) {
    Set-SessionState "Awaiting commit selection"
    Add-StatusLine "Select one commit before starting the local test."
    return
  }

  $commit = [string] $commitList.SelectedItems[0].Tag
  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = "node.exe"
  $startInfo.WorkingDirectory = $RepositoryRoot
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  # Node protocol: start --commit <full-hash> --json-events.
  $nodeArguments = @($corePath, "start", "--commit", $commit, "--json-events" | ForEach-Object {
    Quote-ProcessArgument ([string] $_)
  })
  $startInfo.Arguments = [string]::Join(" ", $nodeArguments)
  [void] $startInfo.EnvironmentVariables.Remove("DUNGEON_ONLINE_TEST_BOT_PASSWORD")
  if ($observerCheckbox.Checked) {
    $startInfo.EnvironmentVariables["DUNGEON_ONLINE_TEST_BOT_PASSWORD"] = [string] $passwordBox.Text
  }

  $script:readyUrl = $null
  Clear-LauncherEvents
  $openGameButton.Enabled = $false
  $startButton.Enabled = $false
  $stopButton.Enabled = $true
  Set-SessionState "Starting"
  Add-StatusLine "Preparing selected local revision $($commit.Substring(0, 12))."

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
$form.ClientSize = [System.Drawing.Size]::new(900, 620)
$form.StartPosition = "CenterScreen"
$form.MinimizeBox = $false
$form.MaximizeBox = $false

$branchLabel = [System.Windows.Forms.Label]::new()
$branchLabel.Location = [System.Drawing.Point]::new(16, 16)
$branchLabel.Size = [System.Drawing.Size]::new(860, 24)
$branchLabel.Text = "Eligible branch: loading..."
$form.Controls.Add($branchLabel)

$commitList = [System.Windows.Forms.ListView]::new()
$commitList.Location = [System.Drawing.Point]::new(16, 50)
$commitList.Size = [System.Drawing.Size]::new(860, 180)
$commitList.View = [System.Windows.Forms.View]::Details
$commitList.FullRowSelect = $true
$commitList.MultiSelect = $false
[void] $commitList.Columns.Add("Date", 190)
[void] $commitList.Columns.Add("Commit", 110)
[void] $commitList.Columns.Add("Subject", 540)
$commitList.add_SelectedIndexChanged({ Set-StartAvailability })
$form.Controls.Add($commitList)

$observerCheckbox = [System.Windows.Forms.CheckBox]::new()
$observerCheckbox.Location = [System.Drawing.Point]::new(16, 245)
$observerCheckbox.Size = [System.Drawing.Size]::new(200, 24)
$observerCheckbox.Text = "Observer Bot (local test)"
$form.Controls.Add($observerCheckbox)

$passwordLabel = [System.Windows.Forms.Label]::new()
$passwordLabel.Location = [System.Drawing.Point]::new(230, 248)
$passwordLabel.Size = [System.Drawing.Size]::new(160, 20)
$passwordLabel.Text = "Local bot password:"
$form.Controls.Add($passwordLabel)

$passwordBox = [System.Windows.Forms.TextBox]::new()
$passwordBox.Location = [System.Drawing.Point]::new(390, 245)
$passwordBox.Size = [System.Drawing.Size]::new(210, 24)
$passwordBox.Text = "local-bot-test"
$form.Controls.Add($passwordBox)

$startButton = [System.Windows.Forms.Button]::new()
$startButton.Location = [System.Drawing.Point]::new(16, 285)
$startButton.Size = [System.Drawing.Size]::new(185, 34)
$startButton.Text = "Start"
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
$openGameButton.Location = [System.Drawing.Point]::new(215, 285)
$openGameButton.Size = [System.Drawing.Size]::new(185, 34)
$openGameButton.Text = "Open Game"
$openGameButton.Enabled = $false
$openGameButton.add_Click({ if ($script:readyUrl) { Start-Process $script:readyUrl } })
$form.Controls.Add($openGameButton)

$stopButton = [System.Windows.Forms.Button]::new()
$stopButton.Location = [System.Drawing.Point]::new(415, 285)
$stopButton.Size = [System.Drawing.Size]::new(185, 34)
$stopButton.Text = "Stop"
$stopButton.Enabled = $false
$stopButton.add_Click({ Stop-LauncherSession })
$form.Controls.Add($stopButton)

$statusLabel = [System.Windows.Forms.Label]::new()
$statusLabel.Location = [System.Drawing.Point]::new(16, 340)
$statusLabel.Size = [System.Drawing.Size]::new(860, 24)
$statusLabel.Text = "Status: Stopped"
$form.Controls.Add($statusLabel)

$statusBox = [System.Windows.Forms.TextBox]::new()
$statusBox.Location = [System.Drawing.Point]::new(16, 370)
$statusBox.Size = [System.Drawing.Size]::new(860, 220)
$statusBox.Multiline = $true
$statusBox.ReadOnly = $true
$statusBox.ScrollBars = [System.Windows.Forms.ScrollBars]::Vertical
$form.Controls.Add($statusBox)

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
