# User-Pair Negotiation Namespace Design

## Philosophy Alignment with NoM
Following the NoM architecture from [Philosophy.md](Philosophy.md:1-119), negotiations should be:
- **Sovereign**: Each user pair owns their negotiation namespace
- **Atomic**: No write conflicts - each user writes only to their own state file
- **Ephemeral**: Negotiation state is temporary, becomes transactions on agreement
- **Event-driven**: Polling detects agreement, triggers transaction creation

## Directory Structure

```
data/
├── teams/
│   ├── alice@stonybrook.edu/           # User's personal namespace
│   │   ├── init.json                   # Team state
│   │   ├── transactions/               # Finalized transactions
│   │   │   └── 1234567890_buy_C.json
│   │   └── negotiations/               # Active negotiations (ephemeral)
│   │       ├── alice_bob_C_1234/       # Negotiation namespace (initiator_responder_chem_id)
│   │       │   ├── alice_state.json    # Alice's current offer/state
│   │       │   └── bob_state.json      # Bob's current counter/state
│   │       └── alice_charlie_D_5678/
│   │           └── alice -> ../../alice@stonybrook.edu/negotiations/alice_charlie_D_5678/
│   │
│   ├── bob@stonybrook.edu/
│   │   ├── init.json
│   │   ├── transactions/
│   │   └── negotiations/
│   │       └── alice_bob_C_1234/       # Symlink to Alice's negotiation
│   │           └── alice_bob_C_1234 -> ../../alice@stonybrook.edu/negotiations/alice_bob_C_1234/
```

## Namespace Naming Convention

**Format**: `{initiator}_{responder}_{chemical}_{timestamp}`

- **initiator**: Email prefix of user who posted buy/sell order
- **responder**: Email prefix of user who responded
- **chemical**: C, N, D, or Q
- **timestamp**: Unix timestamp (ensures uniqueness)

**Example**: `alice_bob_C_1704312345`

## File Structure

### 1. Negotiation State File (`{user}_state.json`)

Each user has their own state file in the negotiation namespace:

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
    "status": "pending|agreed|rejected",
    "agreement_key": "sha256_hash_of_terms",  // Only present when status=agreed
    "last_updated": 1704312345
}
```

### 2. Transaction Files (created on agreement)

When both users have matching `agreement_key`, create two transaction files:

**`alice@stonybrook.edu/transactions/{timestamp}_buy_C_from_bob.json`**
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

**`bob@stonybrook.edu/transactions/{timestamp}_sell_C_to_alice.json`**
```json
{
    "type": "sell",
    "chemical": "C",
    "price": 5.50,
    "quantity": 1000,
    "counterparty": "alice@stonybrook.edu",
    "negotiation_id": "alice_bob_C_1704312345",
    "timestamp": 1704312400,
    "settled": false
}
```

## Implementation Flow

### Phase 1: Initiate Negotiation

```php
// Alice posts a buy order, Bob responds
$initiator = "alice@stonybrook.edu";
$responder = "bob@stonybrook.edu";
$chemical = "C";
$negotiationId = createNegotiationNamespace($initiator, $responder, $chemical);

// Creates:
// - data/teams/alice@stonybrook.edu/negotiations/alice_bob_C_1234/
// - data/teams/bob@stonybrook.edu/negotiations/alice_bob_C_1234/ (symlink)
```

### Phase 2: State Updates

```php
// Each user updates ONLY their own state file
function updateNegotiationState($user, $negotiationId, $offer, $status) {
    $stateFile = getNegotiationPath($negotiationId) . "/{$user}_state.json";

    $state = [
        'user' => $user,
        'offer' => $offer,
        'status' => $status,
        'last_updated' => time()
    ];

    if ($status === 'agreed') {
        $state['agreement_key'] = generateAgreementKey($offer);
    }

    atomicWrite($stateFile, json_encode($state));
}
```

### Phase 3: Polling for Agreement

```php
// Cron/polling checks all negotiations for matching agreement_key
function pollNegotiations() {
    $allUsers = glob('data/teams/*@*', GLOB_ONLYDIR);

    foreach ($allUsers as $userDir) {
        $negotiations = glob("$userDir/negotiations/*", GLOB_ONLYDIR);

        foreach ($negotiations as $negPath) {
            // Skip symlinks (we only process from initiator's perspective)
            if (is_link($negPath)) continue;

            $stateFiles = glob("$negPath/*_state.json");

            if (count($stateFiles) === 2) {
                $states = array_map(function($f) {
                    return json_decode(file_get_contents($f), true);
                }, $stateFiles);

                // Check for agreement
                if (isset($states[0]['agreement_key']) &&
                    isset($states[1]['agreement_key']) &&
                    $states[0]['agreement_key'] === $states[1]['agreement_key']) {

                    // Agreement found! Create transactions
                    createTransactionsFromAgreement($negPath, $states);

                    // Cleanup ephemeral negotiation
                    cleanupNegotiation($negPath);
                }
            }
        }
    }
}
```

### Phase 4: Transaction Creation

```php
function createTransactionsFromAgreement($negPath, $states) {
    $buyer = findRole($states, 'buyer');
    $seller = findRole($states, 'seller');
    $terms = $buyer['offer']; // Both should be identical

    // Create buyer transaction
    $buyerTxn = [
        'type' => 'buy',
        'chemical' => $terms['chemical'],
        'price' => $terms['price'],
        'quantity' => $terms['quantity'],
        'counterparty' => $seller['user'],
        'timestamp' => time(),
        'settled' => false
    ];

    $buyerPath = getUserDir($buyer['user']) . '/transactions/' .
                 time() . "_buy_{$terms['chemical']}_from_" .
                 emailPrefix($seller['user']) . '.json';

    atomicWrite($buyerPath, json_encode($buyerTxn));

    // Create seller transaction (mirror)
    // ... similar logic
}
```

## Benefits of This Approach

1. **No Global Marketplace Events**: Eliminates the 4000+ `remove_buy_order` events
2. **Atomic Isolation**: Each user writes only their state file - no conflicts
3. **Scalable Polling**: Only checks negotiations, not all events
4. **Clean Aggregation**: Transactions are already in user namespaces
5. **Audit Trail**: Negotiation history preserved until cleanup
6. **Ephemeral by Design**: Negotiations auto-cleanup after agreement

## Cleanup Strategy

```php
// Remove negotiation after transactions created
function cleanupNegotiation($negPath) {
    // Archive negotiation for audit (optional)
    $archivePath = str_replace('/negotiations/', '/negotiations_archive/', $negPath);
    rename($negPath, $archivePath);

    // OR delete immediately
    // array_map('unlink', glob("$negPath/*"));
    // rmdir($negPath);
}

// Cleanup stale negotiations (no activity for 24h)
function cleanupStaleNegotiations() {
    $cutoff = time() - 86400; // 24 hours

    foreach (glob('data/teams/*/negotiations/*', GLOB_ONLYDIR) as $negPath) {
        if (is_link($negPath)) continue;

        $stateFiles = glob("$negPath/*_state.json");
        $lastUpdate = max(array_map('filemtime', $stateFiles));

        if ($lastUpdate < $cutoff) {
            cleanupNegotiation($negPath);
        }
    }
}
```

## Migration Path

1. Create new negotiation endpoints using user-pair namespaces
2. Update UI to use new API
3. Run both systems in parallel briefly
4. Migrate existing negotiations to new structure
5. Remove old marketplace/events system
6. Cleanup old event files

---

**This design fully embraces the NoM philosophy**: filesystem as state, atomic user namespaces, event sourcing through state files, and zero write conflicts.
