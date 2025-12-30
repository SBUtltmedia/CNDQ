# Admin Authentication System

## Overview

The CNDQ game uses a JSON-based admin allowlist for access control. Only users in the allowlist can access admin features like NPC management, session control, and system configuration.

## Security Model

- **CLI-Only Editing**: Admin allowlist can ONLY be modified via command line
- **No Web API**: Web endpoints CANNOT add/remove admins (prevents privilege escalation)
- **Read-Only Checks**: API endpoints can only check if a user is an admin
- **Atomic Operations**: File operations use atomic writes to prevent corruption

## Files

```
data/admin_config.json       # Admin allowlist (JSON)
lib/AdminAuth.php            # Admin authentication class
bin/manage_admins.php        # CLI management script
```

## CLI Management

### List all admins
```bash
php bin/manage_admins.php list
```

### Add an admin
```bash
php bin/manage_admins.php add professor@university.edu
```

### Remove an admin
```bash
php bin/manage_admins.php remove old_admin@university.edu
```

### Check if someone is an admin
```bash
php bin/manage_admins.php check admin@stonybrook.edu
```

### Get help
```bash
php bin/manage_admins.php help
```

## Usage in PHP Code

### Protect an API Endpoint

```php
<?php
require_once __DIR__ . '/../../lib/AdminAuth.php';
require_once __DIR__ . '/../../userData.php';

header('Content-Type: application/json');

// Get current user's email
$userEmail = $_SESSION['user_email'] ?? null;

// Check admin access
$adminAuth = new AdminAuth();

if (!$adminAuth->isAdmin($userEmail)) {
    // Sends 403 Forbidden and exits
    AdminAuth::sendForbiddenResponse();
}

// Admin-only code here...
echo json_encode(['success' => true]);
```

### Check Admin Status (No Exit)

```php
$adminAuth = new AdminAuth();
$isAdmin = $adminAuth->isAdmin($userEmail);

if ($isAdmin) {
    // Show admin features
} else {
    // Show regular user features
}
```

### Require Admin (Throws Exception)

```php
try {
    $adminAuth = new AdminAuth();
    $adminAuth->requireAdmin($userEmail);

    // Admin-only code here...

} catch (Exception $e) {
    http_response_code(403);
    echo json_encode(['error' => $e->getMessage()]);
}
```

## Configuration File Format

**data/admin_config.json**:
```json
{
    "adminAllowlist": [
        "admin@stonybrook.edu",
        "professor@university.edu"
    ],
    "lastModified": 1767120370
}
```

## Default Admin

The default admin is `admin@stonybrook.edu`. This is created automatically if the config file doesn't exist.

## Security Best Practices

1. **Never expose admin list via API** - Use `getAdminCount()` instead of listing emails
2. **Always validate user email** - Check session/auth before passing to `isAdmin()`
3. **Log admin actions** - AdminAuth automatically logs add/remove operations
4. **Use HTTPS in production** - Protect admin session cookies
5. **Rotate admin access** - Remove admins who no longer need access

## Examples

### Adding Multiple Admins
```bash
php bin/manage_admins.php add prof1@university.edu
php bin/manage_admins.php add prof2@university.edu
php bin/manage_admins.php add ta@university.edu
php bin/manage_admins.php list
```

### Checking Before Operations
```bash
# Check if someone is admin before granting access
if php bin/manage_admins.php check $USER_EMAIL > /dev/null 2>&1; then
    echo "User is an admin"
else
    echo "User is NOT an admin"
fi
```

## Troubleshooting

### "File not found" error
The config file will be created automatically with default admin. Check that `data/` directory exists and is writable.

### Can't add admin via web
This is intentional! Admin management is CLI-only for security. Use `php bin/manage_admins.php add <email>`.

### Admin lost access
If you're locked out, manually edit `data/admin_config.json`:
```json
{
    "adminAllowlist": ["your_email@university.edu"],
    "lastModified": 1767120370
}
```

Or delete the file - it will recreate with default admin `admin@stonybrook.edu`.
