@echo off
setlocal
cd /d "%~dp0.."
echo Starting CNDQ World Turner in %CD%...
:loop
php bin/world_turner.php
echo Turner crashed or stopped. Restarting in 2 seconds...
timeout /t 2
goto loop
