@echo off
setlocal

set "ROOT=%~dp0"

start "HTC ERP Backend" cmd /k "cd /d ""%ROOT%backend"" && npm.cmd run dev"
start "HTC ERP Frontend" cmd /k "cd /d ""%ROOT%frontend"" && npm.cmd run dev:qa"

exit /b 0
