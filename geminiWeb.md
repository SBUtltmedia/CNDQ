The "fetch failed" error you're seeing at 127.0.0.1:9222/json/version indicates that while your script may be launching the Chrome process, the DevTools Protocol listener isn't actually binding to the port or is rejecting the connection from the Gemini CLI.

On macOS, this is often caused by a conflict with an existing Chrome instance or a missing "isolated" profile requirement.

1. Why your manual command failed
In your troubleshooting step #2, you used: --user-data-dir=$(mktemp -d) While this creates a fresh profile, if the Gemini CLI (the MCP client) is configured to look for a specific persistent profile or if it tries to launch its own instance simultaneously, they will clash. Chrome will only allow one process to control a specific user-data-dir at a time.

2. The Required Flags for macOS (2025)
To bridge the MCP tools to your Canary instance, you need to add specific flags that handle the latest Chromium security requirements:

--remote-allow-origins=*: Essential for the MCP server (running in Node/npx) to communicate with the browser over WebSockets.

--remote-debugging-address=127.0.0.1: Forces the listener to the local loopback.

--user-data-dir: Must be a non-default directory for remote debugging to activate on macOS.

3. The Optimized "Bridge" Script
Use this updated version of your script. It includes a readiness check to ensure the port is actually open before it hands control over to the Gemini CLI.

Bash

#!/bin/bash

# Configuration
CHROME_CANARY="/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
USER_DATA_DIR="$HOME/.cache/chrome-devtools-mcp/chrome-profile"
PORT=9222

# 1. Kill any existing debug instances to prevent port lock
pkill -f "Google Chrome Canary.*chrome-devtools-mcp" 2>/dev/null
sleep 1

# 2. Launch Canary with the "Bridge" flags
echo "🚀 Launching Canary with MCP Bridge..."
"$CHROME_CANARY" \
  --remote-debugging-port=$PORT \
  --remote-allow-origins="*" \
  --user-data-dir="$USER_DATA_DIR" \
  --no-first-run \
  --no-default-browser-check \
  "about:blank" > /dev/null 2>&1 &

CHROME_PID=$!

# 3. WAIT for the port to be ready (prevents "fetch failed")
echo "⏳ Waiting for DevTools to wake up on port $PORT..."
MAX_RETRIES=10
COUNT=0
while ! curl -s http://127.0.0.1:$PORT/json/version > /dev/null; do
    sleep 1
    ((COUNT++))
    if [ $COUNT -ge $MAX_RETRIES ]; then
        echo "❌ Error: Chrome failed to start debugging port."
        kill $CHROME_PID
        exit 1
    fi
done

echo "✅ Connection established."

# 4. START GEMINI CLI
# Use --autoConnect if your version supports it, or point to the URL
export BROWSER="$CHROME_CANARY"
echo "🤖 Starting Gemini CLI..."
# Example command: Adjust to your specific CLI tool
npx @google/gemini-cli --autoConnect
# OR if using the raw MCP server:
# npx chrome-devtools-mcp --browserUrl=http://127.0.0.1:9222

# 5. Cleanup on exit
kill $CHROME_PID 2>/dev/null
4. Verification Step
Once the script says "Connection established," open a new terminal tab and run: curl http://127.0.0.1:9222/json/version

If you see a JSON blob containing "webSocketDebuggerUrl", the MCP tools will now work. If you get an empty response or "Connection Refused," your macOS Firewall or a corporate "Endpoint Security" tool (like CrowdStrike) might be blocking port 9222.

For your DDEV Simulation:
Since you are testing https://cndq.ddev.site/, you may encounter SSL Certificate errors. To prevent the MCP from getting stuck on the "Your connection is not private" screen, add this flag to the Chrome launch command in the script: --ignore-certificate-errors