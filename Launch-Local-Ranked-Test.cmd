@echo off
setlocal
for %%I in ("%~dp0.") do set "LAUNCHER_ROOT=%%~fI"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER_ROOT%\scripts\local-ranked-test-launcher.ps1" -RepositoryRoot "%LAUNCHER_ROOT%"
endlocal
