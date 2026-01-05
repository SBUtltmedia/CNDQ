# CNDQ Decruft Plan - COMPLETED

This document identifies obsolete files, legacy code patterns, and architectural leftovers resulting from the migration to SQLite and Lit components.

## 1. Obsolete Storage Files [CLEANED]
The project has migrated from file-based JSON storage to a single SQLite database (`cndq.db`).

- **`CNDQ/fileHelpers.php`**: [DELETED]
- **`CNDQ/data/` (JSON files)**: [CLEANED] Legacy artifacts removed.
- **`lib/*.backup`**: [DELETED]
- **`lib/UserPairNegotiationManager.php`**: [DELETED]

## 2. Incomplete Frontend Migration [ARCHIVED]
There is a split between the current SPA (`marketplace.js`) and a newer route-based architecture.

- **`js/main.js`, `js/router.js`, `js/views/`**: [ARCHIVED] Moved to `unused/archive/frontend_leftovers/`.
- **`index.php` dual logic**: [PENDING] Modals convert to Lit components remains a future task.

## 3. Legacy Code Paths [DEPRECATED]
- **`userData.php` -> `getUserDataFilePath()`**: [DEPRECATED] Function commented out.
- **`cron/negotiation_poller.php`**: [DELETED] Replaced by passive heartbeat in `session.php`.

## 4. Unused Scripts [ARCHIVED]
The `unused/` directory was cluttered with over 40 scripts and documents.
- Action: Archived all contents into `unused/archive/`.

## 5. Immediate Action Items
1. [x] Remove `lib/*.backup` files.
2. [x] Update `status.php` to ensure `gameStopped` safety.
3. [x] Deprecate `fileHelpers.php` (Removed).
4. [x] Resolve the state of `js/main.js` vs `js/marketplace.js` (Archived unused).