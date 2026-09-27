@echo off
REM Windows: installs dependencies and starts excavation-app. Double-click to run.
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed or not on the PATH. Install it from https://nodejs.org ^(version 20.19 or newer^).
  pause
  exit /b 1
)
echo Node version:
node -v
if not exist node_modules (
  echo Installing dependencies, this takes a minute or two...
  call npm.cmd install
  if errorlevel 1 (
    echo npm install failed. Check the message above.
    pause
    exit /b 1
  )
)
echo.
echo IMPORTANT: close any older black windows running the app first, so you do not see an old version.
echo Starting the app; the browser opens on the port Vite actually uses ^(5173, or 5174 if 5173 is busy^)...
call npm.cmd run dev -- --open
pause
