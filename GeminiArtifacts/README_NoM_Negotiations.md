# NoM-Compliant User-Pair Negotiation System

## Overview

This is a complete redesign of the CNDQ negotiation system to align with the **NoM (No-M) Architecture Philosophy** - using the filesystem as state instead of a relational database.

## The Problem

Your `data/marketplace/events/` directory had **4000+ event files**, mostly `remove_buy_order.json`. This violates NoM principles:
- ❌ Global marketplace state (not user-sovereign)
- ❌ Write conflicts possible
- ❌ Scales poorly (O(n) where n = all events ever)
- ❌ Not ephemeral (old events never cleaned up)

## The Solution: User-Pair Namespaces

Following [Philosophy.md](Philosophy.md:1-119), negotiations now:
- ✅ Live in **isolated user-pair directories**
- ✅ Each user writes **only their own state file** (atomic)
- ✅ **Symlinks** connect the pair (no duplication)
- ✅ **Ephemeral** - deleted after agreement → transactions
- ✅ Scales to O(m) where m = active negotiations (~10-50)

## Architecture

```
data/teams/
├── alice@stonybrook.edu/
│   ├── negotiations/
│   │   └── alice_bob_C_1704312345/     # Alice owns this namespace
│   │       ├── alice_state.json        # Alice writes here
│   │       └── bob_state.json          # Bob writes here
│   └── transactions/
│       └── 1704312400_buy_C_from_bob.json
│
└── bob@stonybrook.edu/
    ├── negotiations/
    │   └── alice_bob_C_1704312345 → ../../alice@stonybrook.edu/negotiations/alice_bob_C_1704312345/
    └── transactions/
        └── 1704312400_sell_C_to_alice.json
```

## Files Created

| File | Purpose |
|------|---------|
| [UserPairNegotiationManager.php](../lib/UserPairNegotiationManager.php:1-450) | Core negotiation logic |
| [negotiation_poller.php](../cron/negotiation_poller.php:1-35) | Polling script (run via cron) |
| [UserPairNegotiation.md](UserPairNegotiation.md:1-250) | Architecture documentation |
| [MIGRATION_PLAN.md](MIGRATION_PLAN.md:1-200) | Migration strategy |

## How It Works

### 1. Initiation
```php
$manager = new UserPairNegotiationManager();
$negotiationId = $manager->createNegotiation(
    'alice@stonybrook.edu',
    'bob@stonybrook.edu',
    'C',  // chemical
    ['price' => 5.50, 'quantity' => 1000, 'role' => 'buyer']
);
// Creates: data/teams/alice@stonybrook.edu/negotiations/alice_bob_C_1704312345/
//          data/teams/bob@stonybrook.edu/negotiations/alice_bob_C_1704312345/ (symlink)
```

### 2. State Updates
```php
// Alice updates her offer
$manager->updateUserState('alice@stonybrook.edu', $negotiationId, [
    'role' => 'buyer',
    'offer' => ['price' => 5.50, 'quantity' => 1000],
    'status' => 'agreed'  // This generates agreement_key
]);

// Bob updates his offer
$manager->updateUserState('bob@stonybrook.edu', $negotiationId, [
    'role' => 'seller',
    'offer' => ['price' => 5.50, 'quantity' => 1000],
    'status' => 'agreed'  // This generates agreement_key
]);
```

### 3. Polling (Cron)
```php
// Run every 30-60 seconds
$agreements = $manager->pollForAgreements();
// If alice_state.json and bob_state.json have matching agreement_key:
//   1. Creates transaction in alice's directory
//   2. Creates transaction in bob's directory
//   3. Deletes negotiation directory (ephemeral)
```

## Setup

### 1. Install Cron Job
```bash
crontab -e
```
Add:
```cron
* * * * * cd /path/to/CNDQ && php cron/negotiation_poller.php >> logs/negotiation_poller.log 2>&1
```

### 2. Create Logs Directory
```bash
mkdir -p CNDQ/logs
touch CNDQ/logs/negotiation_poller.log
```

### 3. Test
```bash
cd CNDQ
php cron/negotiation_poller.php
```

## Key Benefits

1. **No More Event Pollution**: `data/marketplace/events/` stays empty
2. **Atomic Writes**: Each user writes only their own file
3. **Auto-Cleanup**: Negotiations deleted after agreement
4. **Scalable**: Polls ~50 files instead of 4000+
5. **Audit Trail**: Negotiation history in user directories
6. **NoM-Compliant**: Filesystem as state, user sovereignty

## State Files

### Alice's State (`alice_state.json`)
```json
{
    "user": "alice@stonybrook.edu",
    "role": "buyer",
    "chemical": "C",
    "offer": {
        "price": 5.50,
        "quantity": 1000,
        "timestamp": 1704312345
    },
    "status": "agreed",
    "agreement_key": "sha256_hash_of_offer",
    "last_updated": 1704312400
}
```

### Transaction Created (`alice/transactions/1704312400_buy_C_from_bob.json`)
```json
{
    "type": "buy",
    "chemical": "C",
    "price": 5.50,
    "quantity": 1000,
    "counterparty": "bob@stonybrook.edu",
    "negotiation_id": "alice_bob_C_1704312345",
    "timestamp": 1704312400,
    "settled": false
}
```

## API Integration

Old endpoints can remain for backward compatibility:
- `/api/negotiations/initiate.php` (uses old NegotiationManager)

New endpoints (to be created):
- `/api/v2/negotiations/initiate.php` (uses UserPairNegotiationManager)
- `/api/v2/negotiations/update.php`
- `/api/v2/negotiations/list.php`

## Migration

See [MIGRATION_PLAN.md](MIGRATION_PLAN.md:1-200) for detailed migration strategy.

Quick cleanup of old events:
```bash
cd data/marketplace
mkdir -p events_archive
mv events/*.json events_archive/
```

## Monitoring

Check poller logs:
```bash
tail -f CNDQ/logs/negotiation_poller.log
```

Expected output:
```
[2026-01-03 15:30:00] Starting negotiation polling...
  ✓ Processed 2 agreement(s):
    - alice_bob_C_1704312345
    - charlie_david_D_1704312350
[2026-01-03 15:30:00] Completed in 45.23ms
```

## Testing

Create a test negotiation:
```bash
cd CNDQ
php -r "
require 'lib/UserPairNegotiationManager.php';
\$m = new UserPairNegotiationManager();
\$id = \$m->createNegotiation(
    'test1@test.com',
    'test2@test.com',
    'C',
    ['price' => 5, 'quantity' => 100, 'role' => 'buyer']
);
echo \"Created: \$id\n\";
"
```

Check it was created:
```bash
ls -R data/teams/test1@test.com/negotiations/
ls -R data/teams/test2@test.com/negotiations/
```

## Troubleshooting

### Symlinks not working on Windows?
Windows requires admin rights for symlinks. Options:
1. Run PHP as administrator
2. Enable Developer Mode (Windows 10+): Settings → Update & Security → For Developers
3. Use junctions instead (modify code to use `mklink /J` on Windows)

### Negotiations not cleaning up?
Check cron is running:
```bash
ps aux | grep negotiation_poller
```

Check for errors:
```bash
tail -n 50 CNDQ/logs/negotiation_poller.log
```

### Old events still being created?
UI is still calling old API endpoints. Update frontend to use v2 endpoints.

---

**This system fully embraces the NoM philosophy**:
- Filesystem as state ✅
- User sovereignty ✅
- Atomic isolation ✅
- Event sourcing ✅
- Zero write conflicts ✅
