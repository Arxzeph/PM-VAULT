@echo off
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
cd /d "%~dp0desktop"
echo Starting PM - Personal Password Manager...
npm run tauri dev
pause
