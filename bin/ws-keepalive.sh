#!/bin/bash

# CNDQ WebSocket Keep-Alive
# Add this to your crontab:
# * * * * * /path/to/CNDQ/bin/ws-keepalive.sh > /dev/null 2>&1

WEB_ROOT=$(dirname "$(readlink -f "$0")")/..
LOG_FILE="${WEB_ROOT}/data/websocket.log"
PID_FILE="${WEB_ROOT}/data/websocket.pid"

# Check if process is running via PID file and pgrep
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null; then
        # Already running
        exit 0
    fi
fi

# Not running, start it
echo "[$(date)] Starting WebSocket Server..." >> "$LOG_FILE"
cd "$WEB_ROOT"
nohup php bin/websocket-server.php >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
