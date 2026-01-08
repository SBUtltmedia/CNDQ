@echo off
setlocal
cd /d "%~dp0.."
echo Starting CNDQ WebSocket Server in %CD%...
:loop
php bin/websocket-server.php
echo Server crashed or stopped. Restarting in 2 seconds...
timeout /t 2
goto loop
