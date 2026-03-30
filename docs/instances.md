# Multi-Instance Deployment

Running multiple simultaneous game sessions (e.g. `CNDQ-fall2026`, `CNDQ-spring2027`) from a single codebase with isolated data directories.

---

## How It Works

Each instance is a directory of symlinks pointing back to the shared repo. The browser's relative API calls (e.g. `./api/session/status.php`) naturally scope to whichever instance URL the user is on — no JS changes needed.

Data isolation is handled by `cndq_data_dir()` in `lib/Database.php`. On production, Apache passes the **unresolved** symlink path in `SCRIPT_FILENAME`, so walking up from that path finds the correct per-instance `data/` directory without any Apache configuration. On Herd (local dev), `SCRIPT_FILENAME` is Valet's own `server.php`, so the function falls back to the `__DIR__`-relative path — local dev is unchanged.

---

## Directory Layout

```
/var/www/html/
  CNDQ/               ← git repo, real files
    index.php
    api/  css/  js/  lib/  admin/  …
    data/             ← this instance's data (real dir or symlink)

  CNDQ-fall2026/      ← symlink farm (see: Creating a New Instance)
    index.php  → ../CNDQ/index.php
    api/       → ../CNDQ/api/
    lib/       → ../CNDQ/lib/
    …
    data/             ← unique data dir for this instance (real dir or symlink)

  CNDQ-spring2027/    ← same pattern
    …
    data/             ← different data dir
```

---

## Creating a New Instance

```bash
# 1. Create the instance directory and symlink everything from the repo
mkdir /var/www/html/CNDQ-fall2026
cd /var/www/html/CNDQ-fall2026
ln -s ../CNDQ/* .

# 2. Replace the data symlink (which points to CNDQ/data) with a unique one
rm data
mkdir /var/cndq-data/fall2026          # wherever instance data lives
ln -s /var/cndq-data/fall2026 data
```

No Apache config changes required.

### SELinux (if enforcing)

```bash
chcon -R -t httpd_sys_rw_content_t /var/cndq-data/fall2026
# or persist across relabels:
semanage fcontext -a -t httpd_sys_rw_content_t "/var/cndq-data/fall2026(/.*)?"
restorecon -R /var/cndq-data/fall2026
```

---

## Updating All Instances

All instances symlink to the same `CNDQ/` repo, so a single git pull updates every instance simultaneously — no per-instance steps needed:

```bash
cd /var/www/html/CNDQ
git pull
```

---

## How `cndq_data_dir()` Works

Defined in `lib/Database.php` and called by `Database`, `AdminAuth`, `TeamStorage`, and `NPCManager`.

```php
function cndq_data_dir(): string {
    $script = $_SERVER['SCRIPT_FILENAME'] ?? '';
    // Herd/Valet (local dev): SCRIPT_FILENAME is Valet's server.php — fall back
    if (empty($script) || str_contains($script, 'server.php')) {
        return __DIR__ . '/../data';
    }
    // Production: SCRIPT_FILENAME is the unresolved symlink path set by Apache.
    // Walk up until we find the directory containing data/.
    $dir = dirname($script);
    for ($i = 0; $i < 4; $i++) {
        if (is_dir($dir . '/data') || is_link($dir . '/data')) {
            return $dir . '/data';
        }
        $parent = dirname($dir);
        if ($parent === $dir) break;
        $dir = $parent;
    }
    return __DIR__ . '/../data';
}
```

**Why `SCRIPT_FILENAME` and not `__DIR__`**: PHP resolves `__FILE__` and `__DIR__` via `realpath()`, which follows symlinks back to the shared `CNDQ/` code. `SCRIPT_FILENAME` is set by Apache before PHP runs and preserves the original symlink path (e.g. `/CNDQ-fall2026/api/session/status.php`), so walking up from it correctly finds `CNDQ-fall2026/data/`.

---

## Local Development

Local dev (Herd) runs a single instance at `http://cndq.test/CNDQ/`. No symlinked instances, no extra config. The `cndq_data_dir()` fallback means behaviour is identical to before this feature was added.
