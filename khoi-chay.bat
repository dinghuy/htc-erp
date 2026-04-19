@echo off
setlocal

set "ROOT=%~dp0"
set "PORT_RESOLVER=powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command"

for /f "usebackq delims=" %%I in (`%PORT_RESOLVER% "$preferred = 3001; $listeningPorts = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | ForEach-Object Port; for ($port = $preferred; $port -lt ($preferred + 200); $port++) { if ($listeningPorts -notcontains $port) { Write-Output $port; exit 0 } }; throw 'No free backend port found'"`) do set "BACKEND_PORT=%%I"
for /f "usebackq delims=" %%I in (`%PORT_RESOLVER% "$preferred = 4173; $listeningPorts = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | ForEach-Object Port; for ($port = $preferred; $port -lt ($preferred + 200); $port++) { if ($listeningPorts -notcontains $port) { Write-Output $port; exit 0 } }; throw 'No free frontend port found'"`) do set "FRONTEND_PORT=%%I"

if not defined BACKEND_PORT (
  echo Failed to resolve a backend port.
  exit /b 1
)

if not defined FRONTEND_PORT (
  echo Failed to resolve a frontend port.
  exit /b 1
)

set "BACKEND_URL=http://127.0.0.1:%BACKEND_PORT%"
set "FRONTEND_URL=http://127.0.0.1:%FRONTEND_PORT%"

echo Starting HTC ERP backend on %BACKEND_URL%
echo Starting HTC ERP frontend on %FRONTEND_URL%

start "HTC ERP Backend" cmd /k "cd /d ""%ROOT%backend"" && set PORT=%BACKEND_PORT% && set QA_BACKEND_URL=%BACKEND_URL% && npm.cmd run dev"
start "HTC ERP Frontend" cmd /k "cd /d ""%ROOT%frontend"" && set VITE_API_URL=%BACKEND_URL%/api && set QA_FRONTEND_URL=%FRONTEND_URL% && set QA_BACKEND_URL=%BACKEND_URL% && npm.cmd run dev -- --host 127.0.0.1 --port %FRONTEND_PORT%"

exit /b 0
