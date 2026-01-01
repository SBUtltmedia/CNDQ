#!/bin/bash

# Launch Chrome Canary with remote debugging for MCP Chrome DevTools
CHROME_CANARY="/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
USER_DATA_DIR="$HOME/.cache/chrome-devtools-mcp/chrome-profile"
REMOTE_DEBUGGING_PORT=9222

# --- CLEANUP HANDLER ---
# This kills Chrome if you press Ctrl+C or the script exits
cleanup() {
    echo ""
    echo "👋 Shutting down Chrome Canary..."
    kill $CHROME_PID 2>/dev/null
    exit
}
trap cleanup SIGINT SIGTERM

# Kill any existing Chrome Canary instances using this profile
pkill -f "Google Chrome Canary.*chrome-devtools-mcp" 2>/dev/null

# Wait a moment for processes to fully terminate
sleep 2

# Create user data directory if it doesn't exist
mkdir -p "$USER_DATA_DIR"

echo "🚀 Launching Chrome Canary with remote debugging..."
echo "📍 Remote debugging port: $REMOTE_DEBUGGING_PORT"
echo "📁 User data directory: $USER_DATA_DIR"

# Launch Chrome Canary with remote debugging enabled
# Added --remote-allow-origins for better MCP compatibility
"$CHROME_CANARY" \
  --remote-debugging-port=$REMOTE_DEBUGGING_PORT \
  --user-data-dir="$USER_DATA_DIR" \
  --remote-allow-origins="*" \
  --no-first-run \
  --no-default-browser-check \
  "http://localhost:53134/" \
  > /dev/null 2>&1 &

CHROME_PID=$!
echo "✅ Chrome Canary launched (PID: $CHROME_PID)"
echo ""

# --- GEMINI CLI EXECUTION ---
# We export BROWSER here so ONLY the Gemini CLI sees Canary as the default.
# This does not affect your system-wide settings.
export BROWSER="$CHROME_CANARY"

echo "🤖 Starting Gemini CLI..."
echo "--------------------------------------------------"

# Replace 'gemini-cli-command' with your actual command (e.g., npx @google/gemini-cli)
gemini

# If the CLI exits, we trigger the cleanup manually
cleanup