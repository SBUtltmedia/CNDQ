#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"
echo "Launching CNDQ Dev Services in new Terminal windows..."
osascript -e "tell application \"Terminal\" to do script \"cd '$DIR/..'; ./bin/run-ws.sh\""
osascript -e "tell application \"Terminal\" to do script \"cd '$DIR/..'; ./bin/run-turner.sh\""
