@echo off
setlocal
cd /d "%~dp0"
echo Launching CNDQ Dev Services...
start "CNDQ WS Server" cmd /k "run-ws.bat"
start "CNDQ World Turner" cmd /k "run-turner.bat"
echo Services launched in separate windows.
