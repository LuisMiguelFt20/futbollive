@echo off
cd /d "%~dp0"
echo Iniciando FutbolLive (dos terminales)...
start "FutbolLive BACKEND" cmd /k "cd /d ""%~dp0backend"" && npm start"
start "FutbolLive FRONTEND" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"
echo Abre http://localhost:5173/ en tu navegador.
pause
