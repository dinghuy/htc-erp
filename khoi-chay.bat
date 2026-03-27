@echo off
title CRM HT Group - Launcher
echo 🚀 Dang khoi chay he thong CRM Huynh Thy...
echo ------------------------------------------

:: Khoi chay Backend trong cua so moi
start "CRM_BACKEND" cmd /k "cd backend && npm run dev"

:: Khoi chay Frontend trong cua so moi
start "CRM_FRONTEND" cmd /k "cd frontend && npm run dev"

echo ✅ Da mo cac terminal cho Backend (Port 3001) va Frontend (Vite).
echo 💡 Ban co the dong cua so nay. 
pause
