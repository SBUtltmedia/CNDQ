# CNDQ Implementation Status

## Completed Backend Implementation

### New Files Created

#### 1. [fileHelpers.php](fileHelpers.php)
**Purpose:** File-based JSON storage utilities with proper locking

**Functions:**
- `updateOffers($callback)` - Atomic read-modify-write for offers.json
- `getOffers()` - Read offers with shared lock
- `logTrade($tradeData)` - Append trades to log
- `sendNotification($recipientEmail, $notification)` - Deliver notifications to users
- `executeTrade($sellerId, $buyerId, $chemical, $quantity, $pricePerGallon)` - Atomic two-party transaction
- `getUserData($email)` - Read user data with lock
- `updateUserData($email, $callback)` - Update user data atomically

**Key Features:**
- Uses PHP `flock()` for file locking
- Alphabetical file locking order to prevent deadlocks
- Proper error handling with try-finally blocks

---

#### 2. [createOffer.php](createOffer.php)
**Endpoint:** `POST /createOffer.php`

**Parameters:**
- `chemical` - C, N, D, or Q
- `quantity` - Gallons to sell
- `reserve_price` - Minimum acceptable price per gallon

**Validations:**
- User has sufficient inventory
- No duplicate offers for same chemical
- Quantity and price > 0

**Returns:**
```json
{
  "success": true,
  "offer_id": "offer_abc123_1735000000",
  "message": "Offer created for 200 gal of Chemical C",
  "offer": { /* full offer object */ }
}
```

---

#### 3. [expressInterest.php](expressInterest.php)
**Endpoint:** `POST /expressInterest.php`

**Parameters:**
- `offer_id` - ID of offer to express interest in

**Validations:**
- Offer exists and is open
- User is not the seller
- User hasn't already expressed interest

**Actions:**
- Adds buyer to `interested_buyers` array
- Sends notification to seller

**Returns:**
```json
{
  "success": true,
  "message": "Interest expressed successfully. Waiting for seller to set a price.",
  "offer_id": "offer_abc123_1735000000"
}
```

---

#### 4. [setInitialPrice.php](setInitialPrice.php)
**Endpoint:** `POST /setInitialPrice.php`

**Parameters:**
- `offer_id` - The offer ID
- `buyer_id` - Buyer's email
- `price` - Initial price per gallon

**Validations:**
- User is the seller
- Buyer has expressed interest
- Price >= reserve price

**Actions:**
- Updates offer status to "negotiating"
- Creates `active_negotiation` object
- Sends price notification to buyer

**Returns:**
```json
{
  "success": true,
  "message": "Initial price of $50/gal sent to Team 3",
  "offer_id": "offer_abc123_1735000000",
  "price": 50.00
}
```

---

#### 5. [respondToOffer.php](respondToOffer.php)
**Endpoint:** `POST /respondToOffer.php`

**Parameters:**
- `offer_id` - The offer ID
- `action` - "accept" or "reject"

**Accept Action:**
- Executes trade using `executeTrade()`
- Logs to trades_log.json
- Updates offer status to "completed"
- Sends success notifications to both parties

**Reject Action:**
- Adds rejection to negotiation history
- Sends notification to seller
- Allows seller to counter

**Returns (Accept):**
```json
{
  "success": true,
  "message": "Trade completed successfully!",
  "trade": {
    "chemical": "C",
    "quantity": 200,
    "price_per_gallon": 48.00,
    "total_cost": 9600.00
  }
}
```

---

#### 6. [counterOffer.php](counterOffer.php)
**Endpoint:** `POST /counterOffer.php`

**Parameters:**
- `offer_id` - The offer ID
- `new_price` - Counter-offer price per gallon

**Validations:**
- User is the seller
- Last action was buyer rejection
- new_price < current_price
- new_price >= reserve_price

**Actions:**
- Updates current_price in negotiation
- Adds to history
- Sends notification to buyer

**Returns:**
```json
{
  "success": true,
  "message": "Counter-offer of $48/gal sent to Team 3",
  "offer_id": "offer_abc123_1735000000",
  "new_price": 48.00
}
```

---

#### 7. [cancelOffer.php](cancelOffer.php)
**Endpoint:** `POST /cancelOffer.php`

**Parameters:**
- `offer_id` - The offer ID to cancel

**Actions:**
- Marks offer as "cancelled"
- Notifies all interested buyers

**Returns:**
```json
{
  "success": true,
  "message": "Offer cancelled successfully",
  "offer_id": "offer_abc123_1735000000"
}
```

---

#### 8. [getMarketUpdates.php](getMarketUpdates.php)
**Endpoint:** `GET /getMarketUpdates.php?lastPoll=1735000000`

**Purpose:** Real-time polling for market changes

**Returns:**
```json
{
  "success": true,
  "timestamp": 1735001000,
  "offers_changed": true,
  "my_offers": [ /* offers created by user */ ],
  "available_offers": [ /* offers from other users */ ],
  "active_negotiations": [
    {
      "offer_id": "...",
      "role": "buyer",
      "chemical": "C",
      "quantity": 200,
      "current_price": 48.00,
      "last_action": "seller_counter",
      "counterparty": "team7@example.com",
      "counterparty_name": "Team 7",
      "history": [ /* negotiation history */ ]
    }
  ],
  "notifications": [ /* unread notifications */ ],
  "notification_count": 3,
  "user_inventory": { "C": 850, "N": 700, "D": 820, "Q": 1200 },
  "user_fund": 17450.00,
  "shadow_prices": { "C": 52, "N": 48, "D": 61, "Q": 0 }
}
```

**Features:**
- Only returns changes since last poll
- Categorizes offers by user role (seller/buyer)
- Includes shadow prices for decision support
- Returns active negotiations with full history

---

## Data Files Created

### data/offers.json
```json
{
  "offers": [ /* array of offer objects */ ],
  "last_modified": 1735000000
}
```

### data/trades_log.json
```json
{
  "trades": [ /* array of completed trades */ ]
}
```

### Updated: data/user_*.json
New fields added:
- `shadowPrices` - LP solver results
- `notifications` - User notification inbox
- `teamRoles` - Team member assignments
- `lastProduction` - Last production results

---

## API Flow Example

### Complete Negotiation Flow

**Step 1: Seller Creates Offer**
```
POST /createOffer.php
{
  "chemical": "C",
  "quantity": 200,
  "reserve_price": 45
}

→ Offer created with status "open"
→ Appears in market for all users
```

**Step 2: Buyer Expresses Interest**
```
POST /expressInterest.php
{
  "offer_id": "offer_abc123"
}

→ Buyer added to interested_buyers
→ Notification sent to seller
```

**Step 3: Seller Sets Initial Price**
```
POST /setInitialPrice.php
{
  "offer_id": "offer_abc123",
  "buyer_id": "team3@example.com",
  "price": 50
}

→ Status changes to "negotiating"
→ Notification sent to buyer
```

**Step 4a: Buyer Accepts**
```
POST /respondToOffer.php
{
  "offer_id": "offer_abc123",
  "action": "accept"
}

→ Trade executed
→ Inventory and funds updated
→ Trade logged
→ Notifications sent
```

**Step 4b: Buyer Rejects**
```
POST /respondToOffer.php
{
  "offer_id": "offer_abc123",
  "action": "reject"
}

→ Rejection logged
→ Notification sent to seller
```

**Step 5: Seller Counters**
```
POST /counterOffer.php
{
  "offer_id": "offer_abc123",
  "new_price": 48
}

→ Price updated
→ Notification sent to buyer
→ Loop back to Step 4
```

---

## Testing the Backend

### Prerequisites
```bash
# Using DDEV
ddev start

# Create test user files
mkdir -p data
```

### Test Sequence

1. **Create an offer as Team 7:**
```bash
curl -X POST http://cndq.ddev.site/createOffer.php \
  -H "Content-Type: application/json" \
  -b "mock_mail=team7@example.com" \
  -d '{"chemical":"C","quantity":200,"reserve_price":45}'
```

2. **Express interest as Team 3:**
```bash
curl -X POST http://cndq.ddev.site/expressInterest.php \
  -H "Content-Type: application/json" \
  -b "mock_mail=team3@example.com" \
  -d '{"offer_id":"[OFFER_ID_FROM_STEP_1]"}'
```

3. **Set initial price as Team 7:**
```bash
curl -X POST http://cndq.ddev.site/setInitialPrice.php \
  -H "Content-Type: application/json" \
  -b "mock_mail=team7@example.com" \
  -d '{"offer_id":"[OFFER_ID]","buyer_id":"team3@example.com","price":50}'
```

4. **Poll for updates as Team 3:**
```bash
curl http://cndq.ddev.site/getMarketUpdates.php?lastPoll=0 \
  -b "mock_mail=team3@example.com"
```

5. **Accept offer as Team 3:**
```bash
curl -X POST http://cndq.ddev.site/respondToOffer.php \
  -H "Content-Type: application/json" \
  -b "mock_mail=team3@example.com" \
  -d '{"offer_id":"[OFFER_ID]","action":"accept"}'
```

---

## Next Steps (Frontend)

### To Implement:
1. **Shadow Price Panel** - Side panel on market.html showing LP results
2. **Market Polling** - JavaScript polling loop (3-second interval)
3. **Notifications UI** - Badge and dropdown for alerts
4. **Offer Creation Modal** - Form to create sell offers
5. **Negotiation Modals** - UI for setting prices, accepting/rejecting
6. **Active Negotiations Panel** - Track ongoing deals

### Frontend Files to Modify:
- [market.html](market.html) - Add UI components
- `js/market.js` (new) - Market-specific JavaScript
- `js/api.js` - Add API calls for new endpoints

---

## File Locking Strategy Summary

### No Conflicts (Safe):
- User reads/writes own `user_{id}.json`
- Append to `trades_log.json`

### Managed Conflicts (Using `flock()`):
- `offers.json` - Multiple users creating/updating offers
- Two-party trades - Lock both users' files in alphabetical order

### Admin-Only (No Student Conflicts):
- `session_state.json` - Only instructor modifies

---

## Error Handling

All endpoints include:
- HTTP status codes (400, 404, 405, etc.)
- JSON error responses
- Validation before state changes
- Transaction rollback on failure (via finally blocks)

Example error response:
```json
{
  "error": "Insufficient inventory",
  "available": 150,
  "requested": 200
}
```
