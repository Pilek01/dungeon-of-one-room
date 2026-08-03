@echo off
setlocal
set "LAUNCHER_ROOT=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER_ROOT%scripts\local-ranked-test-launcher.ps1" -RepositoryRoot "%LAUNCHER_ROOT%"
endlocal
