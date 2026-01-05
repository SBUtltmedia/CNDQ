# CNDQ Data Directory

This directory contains the SQLite database for CNDQ.

## Database Files

- `cndq.db` - Main SQLite database (auto-created on first use)
- `cndq.db-wal` - Write-Ahead Log (performance optimization)
- `cndq.db-shm` - Shared memory file (performance optimization)

## Schema

The database schema is defined in `schema.sql` and includes:
- Team events and state (event sourcing)
- Marketplace offers and buy orders
- Negotiations between teams
- Configuration settings

## Auto-Initialization

The database is **automatically initialized** when first accessed. No manual setup required.

```php
// In any PHP file:
require_once __DIR__ . '/lib/Database.php';
$db = Database::getInstance(); // Auto-creates and initializes if needed
```

## Production Setup

In production, this directory is typically a **symlink** to persistent storage:

```bash
# Example production setup
ln -s /var/cndq-data /path/to/CNDQ/data
```

The database will be automatically created in the symlinked location.

## Manual Initialization

To verify database setup:

```bash
php bin/init-db.php
```

## Git

The database files are in `.gitignore` and will not be committed to version control.
