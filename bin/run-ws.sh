#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR/.."
echo "Starting CNDQ WebSocket Server in $(pwd)..."
while true; do
  php bin/websocket-server.php
  echo "Server crashed or stopped. Restarting in 2 seconds..."
  sleep 2
done
