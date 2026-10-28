@echo off
cd /d "%~dp0"
if not exist "backend\.env" copy "backend\.env.example" "backend\.env"
echo Instalando backend...
cd backend
call npm install
if errorlevel 1 (echo ERROR instalando backend & pause & exit /b 1)
cd ..\frontend
echo Instalando frontend...
call npm install
if errorlevel 1 (echo ERROR instalando frontend & pause & exit /b 1)
cd ..
echo Instalacion finalizada. Edita backend\.env e inicia iniciar-futbollive.bat
pause
