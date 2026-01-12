# Database Schema Management

## Overview

The CNDQ application uses SQLite with automatic schema versioning to ensure databases stay in sync across development, staging, and production environments.

## How It Works

1. **Schema Version File**: `lib/schema_version.txt` contains a single integer representing the current schema version
2. **Schema Definition**: `lib/schema.sql` contains the complete database schema (idempotent with `CREATE IF NOT EXISTS`)
3. **Auto-Migration**: On application startup, the database automatically checks and updates its schema if needed
4. **Version Tracking**: The `config` table stores the current schema version in the database

## Workflow for Schema Changes

### When You Change the Schema

1. **Edit** `lib/schema.sql` with your changes (ADD new tables/columns, DON'T remove existing ones without migration)
2. **Increment** the version number in `lib/schema_version.txt`
3. **Commit** both files to git
4. **Deploy** - the schema will auto-update on next request

### Production Deployment with Symlinked Data

Since `/data` is gitignored and symlinked to a writable location:

```bash
# 1. Pull latest code (includes schema.sql and schema_version.txt)
git pull

# 2. Check schema status
php bin/check-schema.php

# 3. Schema will auto-update on next page request
# OR manually apply:
php bin/apply-schema.php
```

## Tools

### Check Schema Version
```bash
php bin/check-schema.php
```
Shows current vs expected schema version.

### Apply Schema Manually
```bash
php bin/apply-schema.php
```
Manually applies the schema from `schema.sql` and updates the version.

### View Database Stats
```bash
php bin/db-stats.php
```
Shows table sizes and row counts.

## Important Notes

### ✅ Safe Schema Changes (Additive Only)

- **ADD** new tables with `CREATE TABLE IF NOT EXISTS`
- **ADD** new columns with `ALTER TABLE ADD COLUMN IF NOT EXISTS` (SQLite 3.35+)
- **ADD** new indexes with `CREATE INDEX IF NOT EXISTS`
- Increment `schema_version.txt` after making changes

### ⚠️ Unsafe Schema Changes (Require Migration)

- **DROPPING** tables or columns
- **RENAMING** tables or columns
- **CHANGING** column types

For these, you need to create a migration script in `bin/migrations/`.

## Troubleshooting

### Schema out of sync after git pull
```bash
# Auto-fixes on next page load, OR:
php bin/apply-schema.php
```

### Database exists but tables are missing
```bash
php bin/apply-schema.php
```

### Schema version is higher than expected
This happens if you rolled back code but not the database. Either:
- Roll forward the code, OR
- Manually reset the version in the database:
```sql
UPDATE config SET value = '1' WHERE key = 'schema_version';
```

## Data Directory Symlink Setup

On production with write-restricted deployment:

```bash
# Create writable data directory
mkdir -p /var/app-data/cndq/data

# Create symlink from app to data
cd /var/www/CNDQ
rm -rf data  # Remove gitignored data if exists
ln -s /var/app-data/cndq/data ./data

# Verify
ls -la data  # Should show symlink
```

Now:
- Code updates via `git pull` (read-only)
- Database persists in `/var/app-data/cndq/data/cndq.db`
- Schema auto-updates on next request
