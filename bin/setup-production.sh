#!/bin/bash

# CNDQ Production Setup Script (Portable Version)
# Run this after 'git pull'

set -e

# Configuration
WEB_ROOT=$(pwd)
# Default persistent storage path (Override if needed)
USER_DATA_DIR="/home/tltsecure/apache2/htdocs/userData/CNDQ"

echo "=========================================================="
echo "      CNDQ PRODUCTION SETUP: VERBOSE LOG"
echo "=========================================================="
echo "Current Directory: $WEB_ROOT"
echo "Target UserData:  $USER_DATA_DIR"
echo "Timestamp:        $(date)"

# 1. PHP & Extension Check
echo "[1/6] Checking PHP environment..."
php -v | head -n 1
for ext in sqlite3 curl mbstring xml openssl; do
    if php -m | grep -i "$ext" > /dev/null; then
        echo "  [OK] Extension '$ext' found."
    else
        echo "  [FAIL] Extension '$ext' is MISSING."
    fi
done

# 2. Apache Module Check
echo "[2/6] Checking Apache Proxy modules (Informational)..."
for mod in proxy proxy_http proxy_wstunnel rewrite; do
    if httpd -M 2>/dev/null | grep -q "${mod}_module"; then
        echo "  [OK] Module ${mod}_module detected."
    else
        echo "  [WARN] ${mod}_module not detected in CLI. Check httpd.conf."
    fi
done

# 3. SELinux configuration (Requires Sudo)
echo "[3/6] Checking SELinux status..."
if command -v getenforce >/dev/null 2>&1; then
    STATUS=$(getenforce)
    echo "  Status: $STATUS"
    if [ "$STATUS" == "Enforcing" ]; then
        echo "  Attempting to set network boolean (requires sudo)..."
        sudo setsebool -P httpd_can_network_connect 1 || echo "  [!] Sudo failed or not allowed."
    fi
fi

# 4. Data Directory & Symlink Logic
echo "[4/6] Setting up Filesystem-as-State..."
if [ ! -d "$USER_DATA_DIR" ]; then
    echo "  Creating persistent storage: $USER_DATA_DIR"
    mkdir -p "$USER_DATA_DIR"
    chmod 775 "$USER_DATA_DIR"
fi

# Move local data to persistent if it's a real directory
if [ -d "data" ] && [ ! -L "data" ]; then
    echo "  Migrating local data to persistent storage..."
    mv data/* "$USER_DATA_DIR/" 2>/dev/null || true
    rm -rf data
fi

# Link it up
if [ ! -L "data" ]; then
    ln -s "$USER_DATA_DIR" data
    echo "  [OK] Created symlink: data -> $USER_DATA_DIR"
fi

# 5. Dependencies
echo "[5/6] Installing dependencies via Composer..."
composer install --no-dev --optimize-autoloader

# 6. Initialize Background Daemons
echo "[6/6] Initializing Background Daemons..."
chmod +x bin/*.sh

echo "  Starting WebSocket Server keep-alive..."
./bin/ws-keepalive.sh

echo "  Starting World Turner keep-alive..."
./bin/turner-keepalive.sh

echo "=========================================================="
echo "         SETUP COMPLETE: NEXT STEPS"
echo "=========================================================="
echo "1. Add these to your crontab (crontab -e):"
echo "   * * * * * $WEB_ROOT/bin/ws-keepalive.sh > /dev/null 2>&1"
echo "   * * * * * $WEB_ROOT/bin/turner-keepalive.sh > /dev/null 2>&1"
echo ""
echo "2. Check Logs if something fails:"
echo "   tail -f data/websocket.log"
echo "   tail -f data/world_turner.log"
echo "=========================================================="