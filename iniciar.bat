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
REM Always run npm install: it is quick when everything is up to date, and it fixes a node_modules
REM folder left over from an older version of the app.
echo Checking dependencies, the first time this takes a minute or two...
call npm.cmd install --no-audit --no-fund
if errorlevel 1 (
  if not exist node_modules (
    echo npm install failed. Check the message above.
    pause
    exit /b 1
  )
  echo WARNING: npm install failed, trying to start with the dependencies already installed.
)
echo.
REM An old copy of the app still running on port 5173 means you would see an OLD version
REM with old bugs. Detect it and warn loudly. Spanish Windows prints ESCUCHANDO instead of LISTENING.
netstat -ano | findstr /R /C:":5173 .*LISTENING" /C:":5173 .*ESCUCHANDO" >nul 2>&1
if not errorlevel 1 (
  echo ============================================================================
  echo  WARNING: port 5173 is already in use. Another copy of the app, probably an
  echo  OLD version, is still running in another black window.
  echo  Close ALL other black windows of the app, then press a key here.
  echo  If you continue anyway, use ONLY the browser tab that opens now.
  echo ============================================================================
  pause
)
echo Starting the app; the browser opens automatically on the right address...
call npm.cmd run dev -- --open
pause
