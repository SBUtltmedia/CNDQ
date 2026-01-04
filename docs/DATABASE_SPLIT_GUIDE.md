# Database Split Strategy: From Single DB to Multiple DBs

This guide explains how to split `cndq.db` into multiple databases (Option 1) when ready for production optimization.

## Current State (Option 3)

**Single Database:** `data/cndq.db`

All tables in one file:
- `team_events`, `team_state_cache`, `team_snapshots` (team data)
- `marketplace_events`, `marketplace_snapshot` (marketplace data)
- `negotiations`, `negotiation_offers` (negotiation data)
- `config` (configuration data)

**Benefits:**
- ✓ Simple to manage (one file)
- ✓ Atomic transactions across all data
- ✓ Easy backup/restore
- ✓ Perfect for development and testing

## Target State (Option 1)

**Multiple Databases:**

1. **teams.db** - High write volume, team-specific
2. **marketplace.db** - Read-heavy, global queries
3. **negotiations.db** - Low volume, transactional
4. **config.db** - Rare updates, small

**Benefits:**
- ✓ Performance isolation (heavy writes don't block reads)
- ✓ Independent scaling (can move to separate servers)
- ✓ Targeted optimization per database
- ✓ Selective backups (backup teams.db hourly, config.db daily)

---

## When to Split?

Split when you experience:
1. **Performance issues** - Single database becomes bottleneck
2. **Lock contention** - Writers blocking readers excessively
3. **Large database size** - cndq.db grows beyond 1GB
4. **Need for distribution** - Want to scale horizontally

**Rule of thumb:** Keep single database until you have 100+ active teams or database exceeds 500MB.

---

## Split Process

### Step 1: Create Split SQL Script

Create `bin/split_database.sql`:

```sql
-- Attach new databases
ATTACH DATABASE 'data/teams.db' AS teams;
ATTACH DATABASE 'data/marketplace.db' AS marketplace;
ATTACH DATABASE 'data/negotiations.db' AS negotiations;
ATTACH DATABASE 'data/config.db' AS config;

-- Create tables in new databases
-- TEAMS.DB
CREATE TABLE teams.team_events AS SELECT * FROM main.team_events;
CREATE INDEX teams.idx_team_events_email ON team_events(team_email, timestamp);
CREATE INDEX teams.idx_team_events_type ON team_events(event_type);
CREATE INDEX teams.idx_team_events_timestamp ON team_events(timestamp);

CREATE TABLE teams.team_state_cache AS SELECT * FROM main.team_state_cache;
CREATE TABLE teams.team_snapshots AS SELECT * FROM main.team_snapshots;
CREATE INDEX teams.idx_team_snapshots_email ON team_snapshots(team_email, created_at DESC);

-- MARKETPLACE.DB
CREATE TABLE marketplace.marketplace_events AS SELECT * FROM main.marketplace_events;
CREATE INDEX marketplace.idx_marketplace_events_type ON marketplace_events(event_type);
CREATE INDEX marketplace.idx_marketplace_events_timestamp ON marketplace_events(timestamp DESC);
CREATE INDEX marketplace.idx_marketplace_events_team ON marketplace_events(team_email);

CREATE TABLE marketplace.marketplace_snapshot AS SELECT * FROM main.marketplace_snapshot;

-- NEGOTIATIONS.DB
CREATE TABLE negotiations.negotiations AS SELECT * FROM main.negotiations;
CREATE INDEX negotiations.idx_negotiations_initiator ON negotiations(initiator_id, status);
CREATE INDEX negotiations.idx_negotiations_responder ON negotiations(responder_id, status);
CREATE INDEX negotiations.idx_negotiations_status ON negotiations(status, updated_at);

CREATE TABLE negotiations.negotiation_offers AS SELECT * FROM main.negotiation_offers;
CREATE INDEX negotiations.idx_negotiation_offers_neg_id ON negotiation_offers(negotiation_id, created_at);

-- CONFIG.DB
CREATE TABLE config.config AS SELECT * FROM main.config;

-- Verify row counts match
SELECT 'team_events', COUNT(*) FROM main.team_events
UNION SELECT 'teams.team_events', COUNT(*) FROM teams.team_events;
```

### Step 2: Execute Split

```bash
cd CNDQ
php -r "
\$db = new PDO('sqlite:data/cndq.db');
\$sql = file_get_contents('bin/split_database.sql');
\$db->exec(\$sql);
echo 'Database split complete\n';
"
```

### Step 3: Update Database.php

Modify `lib/Database.php` to support multiple databases:

```php
public static function getInstance($dbName = 'cndq') {
    // Map logical names to physical databases
    $dbMap = [
        'teams' => 'teams',
        'marketplace' => 'marketplace',
        'negotiations' => 'negotiations',
        'config' => 'config',
        'cndq' => 'cndq'  // Fallback for backward compatibility
    ];

    $physicalDb = $dbMap[$dbName] ?? $dbName;

    if (!isset(self::$instances[$physicalDb])) {
        self::$instances[$physicalDb] = new self($physicalDb);
    }
    return self::$instances[$physicalDb];
}
```

### Step 4: Update Classes to Use Split Databases

**TeamStorage.php:**
```php
public function __construct($email) {
    // Change this line:
    // $this->db = Database::getInstance();

    // To this:
    $this->db = Database::getInstance('teams');

    // Rest stays the same
}
```

**MarketplaceAggregator.php:**
```php
public function __construct() {
    // Change this line:
    // $this->db = Database::getInstance();

    // To this:
    $this->db = Database::getInstance('marketplace');
}
```

**NegotiationManager.php:**
```php
public function __construct() {
    // Change this line:
    // $this->db = Database::getInstance();

    // To this:
    $this->db = Database::getInstance('negotiations');
}
```

### Step 5: Test Split

```bash
php bin/test_sqlite.php
```

Verify:
- All tests pass
- 4 database files exist
- Row counts match pre-split

### Step 6: Cleanup

After verification:
```bash
# Backup original
cp data/cndq.db data/cndq.db.backup

# Remove original (optional)
rm data/cndq.db
```

---

## Code Changes Summary

Total lines to change: **~50 lines**

Files to modify:
1. `lib/Database.php` - Add database mapping (~10 lines)
2. `lib/TeamStorage.php` - Change 1 line (getInstance call)
3. `lib/MarketplaceAggregator.php` - Change 1 line
4. `lib/NegotiationManager.php` - Change 1 line
5. Any config management classes - Change getInstance call

**No logic changes needed** - just connection routing!

---

## Performance Impact

### Before Split (Single DB)
```
Heavy team writes → Lock entire database
Marketplace reads → Blocked by team writes
Average latency: 50-200ms (under load)
```

### After Split (Multiple DBs)
```
Heavy team writes → Lock only teams.db
Marketplace reads → Unaffected, reads from marketplace.db
Average latency: 5-20ms (same load)
```

**Expected improvement:** 3-10x faster under concurrent load

---

## Rollback Plan

If issues arise:

1. **Keep cndq.db.backup** as failsafe
2. **Revert code changes** (4 getInstance calls)
3. **Restore single database:**
   ```bash
   rm data/*.db
   cp data/cndq.db.backup data/cndq.db
   ```

---

## Monitoring After Split

Track these metrics:

1. **Database sizes:**
   ```bash
   ls -lh data/*.db
   ```

2. **Query performance:**
   - Monitor average getState() time
   - Track marketplace snapshot generation time

3. **Lock contention:**
   - SQLite WAL mode shows in `data/*.db-wal` files
   - Large WAL files indicate heavy write load

---

## Future: Multi-Server Split

Once on multiple databases, you can distribute:

```
Server 1 (Write-heavy): teams.db
Server 2 (Read-heavy): marketplace.db (read replica)
Server 3 (Low-volume): negotiations.db + config.db
```

Just update Database.php with remote PDO DSNs:
```php
$dbMap = [
    'teams' => 'mysql:host=server1;dbname=teams',
    'marketplace' => 'mysql:host=server2;dbname=marketplace',
    // ...
];
```

---

## Summary

- ✓ Start with single database (Option 3) - **you are here**
- ✓ Split when needed (Option 1) - **~1 hour of work**
- ✓ Distribute when scaling (Multi-server) - **future optimization**

The architecture is designed for this exact progression!
