@echo off
setlocal
chcp 65001 >nul

cd /d "%~dp0"

echo ==================================================
echo   PDF Quotation Parser Web を起動しています...
echo ==================================================

:: Vite開発サーバーをバックグラウンドウィンドウで起動
start "PDF Quotation Parser Web Server" /min cmd /c "npm run dev"

:: サーバー起動待ち (3秒)
timeout /t 3 /nobreak >nul

:: Edge または Chrome をアプリモード（アドレスバー/タブ非表示の単独ウィンドウ）で起動
where msedge >nul 2>nul
if %ERRORLEVEL% equ 0 (
    start msedge --app=http://localhost:5173
    goto END
)

where chrome >nul 2>nul
if %ERRORLEVEL% equ 0 (
    start chrome --app=http://localhost:5173
    goto END
)

:: 上記ブラウザが見つからない場合は既定のブラウザで開く
start http://localhost:5173

:END
exit /b 0
