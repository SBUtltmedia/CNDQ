# CNDQ: Dev vs. Production Interpretation

This document outlines the architectural constraints and operational strategies required to maintain parity between local development (Windows/macOS) and the hardened production environment (OREL7 with SELinux).

## 1. The Subdirectory Mandate

**Crucial Rule:** The application must ALWAYS be accessed via a `/CNDQ/` subdirectory. 

*   **Dev (Windows/Herd):** `http://cndq.test/CNDQ/`
*   **Dev (macOS/Valet):** `http://cndq.test/CNDQ/`
*   **Production (OREL7):** `https://[server-domain]/CNDQ/`

**Why?** Production deployments on OREL7 often reside behind reverse proxies or in shared namespaces where root access is unavailable. Developing at `http://cndq.test/` (root) leads to "Path Drift"—where asset links and API calls fail immediately upon deployment.

### Pathing Strategy
*   **Frontend:** Use relative paths (`./js/...` or `../api/...`) to allow the browser to resolve depth automatically.
*   **Backend:** Use `__DIR__` based pathing for requires and storage to remain agnostic of the OS-level web root.

---

## 2. Environment Matrix

| Feature | Development (Win/Mac) | Production (OREL7) |
| :--- | :--- | :--- |
| **Server** | Herd (Nginx) / Valet (Nginx) | Apache 2.4 |
| **OS** | Windows 11 / macOS | OREL7 (RHEL Derivative) |
| **Security** | Open | **SELinux (Enforcing)** |
| **Persistence** | Local `data/` directory | Symlinked `userData/CNDQ` |
| **URL Path** | `/CNDQ/` | `/CNDQ/` |

---

## 3. Background Processes (The "Cron" Simulation)

CNDQ does not use standard 1-minute cron jobs for game logic because the simulation requires 1-second granularity for "World Turns."

### A. The WebSocket Server (`bin/websocket-server.php`)
Provides real-time pushes to the UI (Marketplace updates, session advances).
*   **Dev:** Run manually in terminal or via `Start-Process`.
*   **Prod:** Managed via `bin/ws-keepalive.sh` (triggered by crontab) or as a systemd service.

### B. The World Turner (`bin/world_turner.php`)
The "Heartbeat" of the game. It aggregates the marketplace, advances sessions, and runs NPC trading logic.
*   **Local Simulation:** Open a dedicated terminal and run `php bin/world_turner.php`. 
*   **Interpretation:** This script is a singleton daemon. If it isn't running, the "World" stops—time won't expire and NPCs won't trade.
*   **Fallback:** `SessionManager::getState()` contains a throttled (10s) trigger for NPC logic to ensure the game moves forward even if the daemon stutters, driven by client polling.

---

## 4. SELinux & Production Hardening

On OREL7, the "Filesystem-as-State" model faces SELinux restrictions.

### Filesystem Access
The `data/` directory (which symlinks to `userData/`) must have the correct security context for the web server to write JSON events:
```bash
# Example context for OREL7
chcon -R -t httpd_sys_rw_content_t data/
```

### Network Connectivity
The WebSocket server and internal Push API (Port 8081) require the `httpd_can_network_connect` boolean:
```bash
# Essential for WS -> Internal API communication
sudo setsebool -P httpd_can_network_connect 1
```

---

## 5. Developer Checklist
1.  **Never** hardcode the absolute root `/`.
2.  **Always** keep a terminal open running `php bin/world_turner.php` during dev.
3.  **Verify** that `data/` is writable by the PHP process (especially when switching between OSs).
4.  **Test** using the full `http://cndq.test/CNDQ/` URL to ensure asset resolution is subdirectory-aware.
