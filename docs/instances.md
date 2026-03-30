# Multi-Instance Deployment

Running multiple simultaneous game sessions (e.g. `fall2026`, `spring2027`) from a single codebase.

---

## Directory Layout

```
/var/www/html/CNDQ/
  template/               ← real files, git repo lives here
    index.php
    api/
    css/
    js/
    lib/
    admin/
    …
  templateLink/           ← committed to git, contains only symlinks
    index.php  → ../template/index.php
    api/       → ../template/api/
    css/       → ../template/css/
    js/        → ../template/js/
    lib/       → ../template/lib/
    admin/     → ../template/admin/
    …                     (no data/ — added per instance)

  fall2026/               ← cp -aP templateLink/ fall2026/
    index.php  → ../template/index.php   (symlinks preserved by cp -aP)
    api/       → ../template/api/
    …
    data/      → /var/cndq-data/fall2026/ ← manually: ln -s /var/cndq-data/fall2026 data

  spring2027/             ← same process
    …
    data/      → /var/cndq-data/spring2027/
```

Users access `/CNDQ/fall2026/`, `/CNDQ/spring2027/` etc.
Browser-side relative API calls (e.g. `./api/session/status.php`) scope naturally to each instance URL — no JS changes needed.

---

## The PHP `__DIR__` Problem

The symlink structure is not enough for data isolation on its own.

When Apache serves `fall2026/index.php` (a symlink), PHP resolves it to the **real file** before execution. Inside `lib/Database.php`:

```
__DIR__  →  /var/www/html/CNDQ/template/lib/
data dir →  /var/www/html/CNDQ/template/data/   ← wrong
```

The manually added `fall2026/data/` symlink is never reached. All instances would share `template/data/`.

This is documented PHP behaviour: `__FILE__` and `__DIR__` always return the `realpath()` of the file, with symlinks resolved.

---

## The Fix — Apache `SetEnv` + one line per data-accessing file

### Apache config (one block per instance)

```apache
<Location /CNDQ/fall2026>
    SetEnv CNDQ_DATA_DIR /var/cndq-data/fall2026
</Location>

<Location /CNDQ/spring2027>
    SetEnv CNDQ_DATA_DIR /var/cndq-data/spring2027
</Location>
```

### PHP files — replace the hardcoded data path (4 files)

**`lib/Database.php`** line ~31:
```php
// Before
$dataDir = __DIR__ . '/../data';

// After
$dataDir = $_SERVER['CNDQ_DATA_DIR'] ?? __DIR__ . '/../data';
```

**`lib/AdminAuth.php`** constructor:
```php
// Before
$this->configFile = __DIR__ . '/../data/admin_config.json';

// After
$dataDir = $_SERVER['CNDQ_DATA_DIR'] ?? __DIR__ . '/../data';
$this->configFile = $dataDir . '/admin_config.json';
```

**`lib/TeamStorage.php`** `getTeamDirectory()`:
```php
// Before
return __DIR__ . '/../data/teams/' . $this->safeEmail;

// After
$dataDir = $_SERVER['CNDQ_DATA_DIR'] ?? __DIR__ . '/../data';
return $dataDir . '/teams/' . $this->safeEmail;
```

**`lib/NPCManager.php`** line ~233:
```php
// Before
$teamDir = __DIR__ . '/../data/teams/' . TeamStorage::sanitizeEmail($npcEmail);

// After
$dataDir = $_SERVER['CNDQ_DATA_DIR'] ?? __DIR__ . '/../data';
$teamDir = $dataDir . '/teams/' . TeamStorage::sanitizeEmail($npcEmail);
```

`$_SERVER['CNDQ_DATA_DIR']` is populated by Apache's `SetEnv`. Local dev (Herd) never sets it, so the fallback `__DIR__ . '/../data'` keeps existing behaviour exactly.

---

## Creating a New Instance

```bash
# 1. Copy the template (preserve symlinks)
cp -aP /var/www/html/CNDQ/templateLink/ /var/www/html/CNDQ/fall2026/

# 2. Create the data directory
mkdir -p /var/cndq-data/fall2026

# 3. Symlink it into the instance
ln -s /var/cndq-data/fall2026 /var/www/html/CNDQ/fall2026/data

# 4. Add the Apache SetEnv block (see above) and reload
apachectl graceful
```

### SELinux (if enforcing)

```bash
# Apply the correct context so Apache can read/write the data dir
chcon -R -t httpd_sys_rw_content_t /var/cndq-data/fall2026

# Or persist across relabels with semanage
semanage fcontext -a -t httpd_sys_rw_content_t "/var/cndq-data/fall2026(/.*)?"
restorecon -R /var/cndq-data/fall2026
```

---

## Updating All Instances

All instances share `template/` via symlinks, so a single git pull updates every instance simultaneously:

```bash
cd /var/www/html/CNDQ/template
git pull
```

No per-instance steps needed for code updates.

---

## Local Development

Local dev (Herd) runs a single instance. No `SetEnv`, no `templateLink/`, no changes to workflow.
The `$_SERVER['CNDQ_DATA_DIR']` fallback means the app behaves identically to today.
