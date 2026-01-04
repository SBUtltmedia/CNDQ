# Migration Plan: Old Marketplace Events → User-Pair Negotiations

## Problem Statement

The current system creates **thousands of marketplace events** (seen in `data/marketplace/events/`):
- 4000+ `remove_buy_order.json` files
- Global marketplace state that all users poll
- Write conflicts and race conditions possible
- Not aligned with NoM (No-M) philosophy

## New Architecture (User-Pair Namespaces)

Following the principles in [Philosophy.md](Philosophy.md:1-119) and detailed in [UserPairNegotiation.md](UserPairNegotiation.md:1-250):

### Key Benefits
1. **Atomic Isolation**: Each user writes only their own state file
2. **No Global State**: Negotiations exist in isolated pair namespaces
3. **Ephemeral by Design**: Negotiation state becomes transactions on agreement
4. **Scalable Polling**: Only check negotiations, not all events
5. **Audit Trail**: Clear negotiation history per user-pair

## Files Created

### 1. Core Library
- **[UserPairNegotiationManager.php](../lib/UserPairNegotiationManager.php:1-450)** - Main negotiation management class
  - Creates user-pair namespaces with symlinks
  - Manages state files atomically
  - Polls for agreements
  - Creates transactions on agreement
  - Cleans up ephemeral data

### 2. Cron/Polling
- **[negotiation_poller.php](../cron/negotiation_poller.php:1-35)** - Periodic polling script
  - Runs every 30-60 seconds
  - Detects matching agreement keys
  - Creates transactions automatically
  - Cleans up stale negotiations hourly

### 3. Documentation
- **[UserPairNegotiation.md](UserPairNegotiation.md:1-250)** - Complete architecture guide
- **[Philosophy.md](Philosophy.md:1-119)** - NoM principles (already existed)

## Migration Strategy

### Phase 1: Parallel Running (Week 1-2)
1. Deploy new `UserPairNegotiationManager` alongside existing `NegotiationManager`
2. Create new API endpoints (v2):
   - `/api/v2/negotiations/initiate.php`
   - `/api/v2/negotiations/update.php`
   - `/api/v2/negotiations/list.php`
3. Update UI to call v2 endpoints for NEW negotiations
4. Keep old system running for existing negotiations

### Phase 2: Migration (Week 3)
1. Write migration script to convert existing negotiations:
   ```php
   // Convert old negotiations to new user-pair format
   $oldNegotiations = getActiveNegotiations(); // from old system
   foreach ($oldNegotiations as $neg) {
       $manager->createFromLegacy($neg);
   }
   ```
2. Test thoroughly in staging
3. Run migration in production during low-traffic window

### Phase 3: Cleanup (Week 4)
1. Monitor new system for issues
2. Archive old marketplace events:
   ```bash
   mkdir -p data/marketplace/events_archive
   mv data/marketplace/events/*.json data/marketplace/events_archive/
   ```
3. Remove old API endpoints
4. Remove old `NegotiationManager` class

## Directory Structure Comparison

### OLD (Current)
```
data/
├── marketplace/
│   └── events/              # 4000+ files, global pollution
│       ├── event_123_remove_buy_order.json
│       ├── event_124_remove_buy_order.json
│       └── ...
└── teams/
    └── alice@stonybrook.edu/
        ├── init.json
        └── ... (other files)
```

### NEW (User-Pair)
```
data/
└── teams/
    ├── alice@stonybrook.edu/
    │   ├── init.json
    │   ├── transactions/                    # Final transactions
    │   │   └── 1234_buy_C_from_bob.json
    │   └── negotiations/                    # Ephemeral
    │       └── alice_bob_C_1234/           # Real directory
    │           ├── alice_state.json        # Alice's offer
    │           └── bob_state.json          # Bob's counter
    └── bob@stonybrook.edu/
        ├── init.json
        ├── transactions/
        │   └── 1234_sell_C_to_alice.json
        └── negotiations/
            └── alice_bob_C_1234 -> ../../alice@stonybrook.edu/negotiations/alice_bob_C_1234/
```

## Testing Plan

### 1. Unit Tests
```bash
cd CNDQ/tests
node test-user-pair-negotiations.js
```

### 2. Integration Tests
- Create negotiation between two test users
- Update states independently
- Verify polling detects agreement
- Confirm transactions created
- Check cleanup works

### 3. Load Testing
- Simulate 50 concurrent negotiations
- Verify no race conditions
- Check performance (should be faster than old system)

## Rollback Plan

If issues arise:
1. Disable cron poller: `crontab -e` (comment out negotiation_poller)
2. Revert UI to use old API endpoints
3. Restore old system
4. Investigation and fix
5. Retry migration

## Performance Expectations

### Current System
- Polls 4000+ event files
- O(n) complexity where n = total events
- Slow as system grows

### New System
- Polls only active negotiations (~10-50 typical)
- O(m) complexity where m = active negotiations
- Constant performance regardless of history

## Monitoring

Add logging to track:
- Negotiation creation rate
- Agreement detection rate
- Transaction creation success/failure
- Cleanup operations
- Any errors or exceptions

```php
// Add to negotiation_poller.php
file_put_contents(
    __DIR__ . '/../logs/negotiation_stats.log',
    json_encode([
        'timestamp' => time(),
        'agreements' => count($agreements),
        'cleaned' => $cleaned,
        'duration_ms' => $duration
    ]) . "\n",
    FILE_APPEND
);
```

## Success Criteria

- [ ] Zero marketplace event files for new negotiations
- [ ] All negotiations complete within 60 seconds
- [ ] No write conflicts or race conditions
- [ ] Cleanup runs without errors
- [ ] Performance improved vs old system
- [ ] User experience unchanged or better

---

**Status**: Ready for Phase 1 implementation
**Created**: 2026-01-03
**Author**: Paul (with Claude's assistance)
