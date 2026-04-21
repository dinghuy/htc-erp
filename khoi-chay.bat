@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND_ROOT=%ROOT%backend"
set "FRONTEND_ROOT=%ROOT%frontend"
set "BACKEND_PORT=3001"
set "FRONTEND_PORT=4173"
set "BACKEND_DB=%BACKEND_ROOT%\crm.db"
set "BACKEND_URL=http://127.0.0.1:%BACKEND_PORT%"
set "FRONTEND_URL=http://127.0.0.1:%FRONTEND_PORT%"
set "PORT_RESOLVER=powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -Command"

if not exist "%BACKEND_DB%" (
  echo Missing backend DB: %BACKEND_DB%
  echo Restore or create backend\crm.db before launching.
  exit /b 1
)

for /f "usebackq delims=" %%I in (`%PORT_RESOLVER% "$ports = 3001,4173; $listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | ForEach-Object Port; $busy = $ports | Where-Object { $listeners -contains $_ }; if ($busy.Count -gt 0) { Write-Output ($busy -join ','); exit 0 }"`) do set "BUSY_PORTS=%%I"

if defined BUSY_PORTS (
  echo The standard launcher ports are already in use: %BUSY_PORTS%
  echo Stop the existing local runtime first, then run khoi-chay.bat again.
  echo Expected ports:
  echo   Backend  : %BACKEND_PORT%
  echo   Frontend : %FRONTEND_PORT%
  exit /b 1
)

echo Starting HTC ERP backend on %BACKEND_URL%
echo Using database: %BACKEND_DB%
echo Starting HTC ERP frontend on %FRONTEND_URL%

start "HTC ERP Backend" cmd /k "cd /d ""%BACKEND_ROOT%"" && set PORT=%BACKEND_PORT% && set DB_PATH=%BACKEND_DB% && node -r ts-node/register/transpile-only server.ts"
start "HTC ERP Frontend" cmd /k "cd /d ""%FRONTEND_ROOT%"" && set VITE_API_URL=%BACKEND_URL%/api && npm.cmd run dev -- --host 127.0.0.1 --port %FRONTEND_PORT% --strictPort"

echo.
echo Runtime targets:
echo   %BACKEND_URL%
echo   %FRONTEND_URL%

exit /b 0
