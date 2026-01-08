# CNDQ Production Deployment Guide (OREL7 / SELinux)

This document is the authoritative guide for moving CNDQ from Dev to the OREL7 production environment.

## 1. Environment Prerequisites
*   **Web Server:** Apache 2.4+ (with `mod_proxy`, `mod_proxy_wstunnel`, `mod_rewrite`).
*   **PHP:** 8.1+ with extensions: `php-sqlite3`, `php-curl`, `php-mbstring`, `php-xml`.
*   **Persistent Storage:** A directory outside the web root for user data (to survive git pulls).
*   **URL Context:** Must be hosted at `/CNDQ/`.

## 2. The "Subdirectory" Apache Config
Ensure your Apache virtual host has the following (or equivalent `.htaccess` support):

```apache
<Directory "/var/www/html/CNDQ">
    AllowOverride All
    Require all granted
</Directory>

# WebSocket Proxy (Crucial for amphp)
ProxyPass "/CNDQ/ws" "ws://127.0.0.1:8080/"
ProxyPassReverse "/CNDQ/ws" "ws://127.0.0.1:8081/"
```

## 3. SELinux "Permission Matrix"
OREL7 is strictly enforced. You must run these as `sudo`:

```bash
# Allow Apache to talk to the local WebSocket server (Port 8080/8081)
sudo setsebool -P httpd_can_network_connect 1

# Allow Apache to write to the data/ directory (Filesystem-as-State)
# Replace /path/to/userData with your actual persistent path
sudo chcon -R -t httpd_sys_rw_content_t /path/to/userData
```

## 4. Background Processes (The Daemons)
Two processes must run continuously. We use "Keep-Alive" scripts triggered by Crontab to ensure they stay up.

### Process 1: WebSocket Server (Amphp)
*   **File:** `bin/websocket-server.php`
*   **Role:** Real-time UI updates.
*   **Keep-Alive:** `bin/ws-keepalive.sh`

### Process 2: World Turner (The Heartbeat)
*   **File:** `bin/world_turner.php`
*   **Role:** Turn advancement and NPC trading.
*   **Keep-Alive:** `bin/turner-keepalive.sh`

## 5. Deployment Workflow
1.  **Clone/Pull:** Update the code.
2.  **Run Setup:** Execute `bash bin/setup-production.sh`.
3.  **Check Logs:** 
    *   `data/websocket.log`
    *   `data/world_turner.log`
4.  **Verify Heartbeat:** Check `http://your-domain.com/CNDQ/api/session/status.php`.

## 6. Troubleshooting for AI
If the site is "frozen" or WebSockets aren't connecting, copy/paste this to your AI chat:
> "I am running CNDQ on OREL7. The subdirectory is /CNDQ/. SELinux is enforcing. The WebSocket server is on port 8080. `httpd_can_network_connect` is set to 1. The data directory is a symlink. Here is the output of `tail -n 50 data/websocket.log`..."
