#!/bin/bash
# turner-keepalive.sh: Ensures the World Turner daemon is always running.

WEB_ROOT=$(dirname "$(readlink -f "$0")")/..
LOG_FILE="${WEB_ROOT}/data/world_turner.log"
PID_FILE="${WEB_ROOT}/data/world_turner.pid"

# Ensure data directory exists
mkdir -p "${WEB_ROOT}/data"

# Check if process is running via PID file
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p $PID > /dev/null; then
        # Already running, exit silently
        exit 0
    fi
fi

# Not running, start it in the background
echo "[$(date)] CRITICAL: World Turner was down. Restarting..." >> "$LOG_FILE"
cd "$WEB_ROOT"
nohup php bin/world_turner.php >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
