@echo off
cd /d "%~dp0"

echo ==================================================
echo   PDF Quotation Parser Web
echo ==================================================
echo.

if exist "C:\Program Files\nodejs" (
    set "PATH=C:\Program Files\nodejs;%PATH%"
)

start /b powershell -ExecutionPolicy Bypass -File "%~dp0scripts\open-app.ps1"

echo [Server Starting] Do not close this window while using the app.
echo.

call npm run dev

pause