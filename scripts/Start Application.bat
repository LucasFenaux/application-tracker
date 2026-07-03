@echo off
title Application Tracker
echo Starting Application Tracker...

:: Check if node.exe exists
if not exist "%~dp0node.exe" (
    echo [ERROR] node.exe is missing. Please ensure you extracted all files correctly.
    pause
    exit /b 1
)

:: Set up environment for Playwright to install browser locally if needed
set PLAYWRIGHT_BROWSERS_PATH=%~dp0playwright-browsers
set NODE_ENV=production

:: Ensure public/uploads exists
if not exist "%~dp0public\uploads" mkdir "%~dp0public\uploads"

:: Install Playwright Chromium if it's not installed
if not exist "%PLAYWRIGHT_BROWSERS_PATH%" (
    echo Initializing local browser for the first time... This may take a minute.
    "%~dp0node.exe" "%~dp0node_modules\playwright\cli.js" install chromium
)

:: Wait a moment, then open the browser in the background
start /B "" cmd /c "timeout /t 3 > nul && start http://localhost:3000"

:: Start the server in the foreground
echo Starting server...
echo Keep this window open while using the application.
echo To close the app, simply close this window.
echo.
"%~dp0node.exe" server.js
