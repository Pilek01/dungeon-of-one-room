param(
  [Parameter(Mandatory = $true)][string] $ProfileDir,
  [Parameter(Mandatory = $true)][int] $X,
  [Parameter(Mandatory = $true)][int] $Y,
  [Parameter(Mandatory = $true)][int] $Width,
  [Parameter(Mandatory = $true)][int] $Height
)

$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class RankedNativeWindow {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

  [StructLayout(LayoutKind.Sequential)]
  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }

  [DllImport("shcore.dll")]
  public static extern int SetProcessDpiAwareness(int awareness);

  [DllImport("user32.dll")]
  public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

  [DllImport("user32.dll")]
  public static extern bool IsWindowVisible(IntPtr hWnd);

  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int GetClassName(IntPtr hWnd, StringBuilder className, int maxCount);

  [DllImport("user32.dll")]
  public static extern bool ShowWindowAsync(IntPtr hWnd, int command);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool SetWindowPos(
    IntPtr hWnd,
    IntPtr insertAfter,
    int x,
    int y,
    int width,
    int height,
    uint flags
  );

  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
}
"@

[void] [RankedNativeWindow]::SetProcessDpiAwareness(2)
$deadline = [DateTime]::UtcNow.AddSeconds(8)
$windowHandle = [IntPtr]::Zero
$resolvedProfileDir = [System.IO.Path]::GetFullPath($ProfileDir)

while ($windowHandle -eq [IntPtr]::Zero -and [DateTime]::UtcNow -lt $deadline) {
  $candidateProcessIds = @(
    Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
      Where-Object {
        $commandLine = [string] $_.CommandLine
        $commandLine.IndexOf($resolvedProfileDir, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and
          $commandLine.IndexOf("--app=about:blank", [StringComparison]::OrdinalIgnoreCase) -ge 0
      } |
      ForEach-Object { [uint32] $_.ProcessId }
  )
  $callback = [RankedNativeWindow+EnumWindowsProc] {
    param([IntPtr] $handle, [IntPtr] $state)
    [uint32] $ownerProcessId = 0
    [void] [RankedNativeWindow]::GetWindowThreadProcessId($handle, [ref] $ownerProcessId)
    if ($candidateProcessIds -notcontains $ownerProcessId -or -not [RankedNativeWindow]::IsWindowVisible($handle)) {
      return $true
    }
    $className = [System.Text.StringBuilder]::new(128)
    [void] [RankedNativeWindow]::GetClassName($handle, $className, $className.Capacity)
    if ($className.ToString() -eq "Chrome_WidgetWin_1") {
      $script:windowHandle = $handle
      return $false
    }
    return $true
  }
  [void] [RankedNativeWindow]::EnumWindows($callback, [IntPtr]::Zero)
  if ($script:windowHandle -ne [IntPtr]::Zero) {
    $windowHandle = $script:windowHandle
    break
  }
  Start-Sleep -Milliseconds 50
}

if ($windowHandle -eq [IntPtr]::Zero) {
  throw "Chrome window for isolated profile $resolvedProfileDir was not found."
}

$SW_RESTORE = 9
$SWP_NOZORDER = 0x0004
$SWP_NOACTIVATE = 0x0010
$SWP_SHOWWINDOW = 0x0040
[void] [RankedNativeWindow]::ShowWindowAsync($windowHandle, $SW_RESTORE)

$observed = $null
for ($attempt = 0; $attempt -lt 4; $attempt += 1) {
  $moved = [RankedNativeWindow]::SetWindowPos(
    $windowHandle,
    [IntPtr]::Zero,
    $X,
    $Y,
    $Width,
    $Height,
    ($SWP_NOZORDER -bor $SWP_NOACTIVATE -bor $SWP_SHOWWINDOW)
  )
  if (-not $moved) {
    throw "SetWindowPos failed with Win32 error $([Runtime.InteropServices.Marshal]::GetLastWin32Error())."
  }
  Start-Sleep -Milliseconds 50
  $rect = [RankedNativeWindow+RECT]::new()
  if (-not [RankedNativeWindow]::GetWindowRect($windowHandle, [ref] $rect)) {
    throw "GetWindowRect failed."
  }
  $observed = [pscustomobject]@{
    left = $rect.Left
    top = $rect.Top
    width = $rect.Right - $rect.Left
    height = $rect.Bottom - $rect.Top
  }
  $matches = (
    [Math]::Abs($observed.left - $X) -le 2 -and
    [Math]::Abs($observed.top - $Y) -le 2 -and
    [Math]::Abs($observed.width - $Width) -le 2 -and
    [Math]::Abs($observed.height - $Height) -le 2
  )
  if ($matches) { break }
}

$observed | ConvertTo-Json -Compress
