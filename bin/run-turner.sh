#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR/.."
echo "Starting CNDQ World Turner in $(pwd)..."
while true; do
  php bin/world_turner.php
  echo "Turner crashed or stopped. Restarting in 2 seconds..."
  sleep 2
done
