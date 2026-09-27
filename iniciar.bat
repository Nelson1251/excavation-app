@echo off
REM Windows: installs dependencies and starts excavation-app. Double-click to run.
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js no esta instalado o no esta en el PATH. Instalalo desde https://nodejs.org ^(version 20.19 o mas nueva^).
  pause
  exit /b 1
)
echo Node version:
node -v
if not exist node_modules (
  echo Instalando dependencias, tarda uno o dos minutos...
  call npm.cmd install
  if errorlevel 1 (
    echo Fallo npm install. Revisa el mensaje de arriba.
    pause
    exit /b 1
  )
)
echo Abriendo la app en http://localhost:5173 ...
start "" http://localhost:5173
call npm.cmd run dev
pause
