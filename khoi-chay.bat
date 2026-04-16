@echo off
setlocal

set "ROOT=%~dp0"

start "HTC ERP Backend" cmd /k "cd /d ""%ROOT%backend"" && npm.cmd run dev"
start "HTC ERP Frontend" cmd /k "cd /d ""%ROOT%frontend"" && npm.cmd run dev -- --host 127.0.0.1 --port 5173"

exit /b 0
