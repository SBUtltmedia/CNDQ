# CNDQ Game Rebuild Plan - Modern Marketplace Architecture

**Date:** 2025-12-26
**Status:** Planning Phase
**Goal:** Transform Excel-based Deicer & Solvent simulation into a modern web-based marketplace with team-isolated JSON storage

---

## Executive Summary

This plan outlines a **complete architectural overhaul** of the CNDQ (Chemical: C, N, D, Q) trading game. The current implementation uses a hybrid approach with Google Sheets integration and some JSON storage. We will rebuild it as a **fully file-based system** where:

1. **Each team = one email** (from `$_SERVER['mail']` or cookie override)
2. **All team data stored in isolated JSON files** (`data/user_<email>.json`)
3. **Marketplace aggregates from all team files** (no central database)
4. **Modern auction-style UX** with real-time updates
5. **All transactions stored at team level** (avoids most concurrency issues)

---

## Current System Analysis

### What Exists
- **Backend**: PHP files for offers, trades, production
- **Frontend**: HTML pages with Tailwind CSS, vanilla JS
- **Storage**: Mix of Google Sheets (legacy) and JSON files
- **Key Files**:
  - `fileHelpers.php` - Atomic file operations with `flock()`
  - `userData.php` - User session management
  - `market.html` - Negotiation interface (recently completed)
  - `production.php` - Linear programming solver integration
  - `offers.json` - Central offers file
  - `user_<email>.json` - Per-team data files

### What's Wrong
1. **Architecture inconsistency**: Some data in Sheets, some in JSON
2. **Central offers.json creates bottleneck**: All teams write to same file
3. **Trade logic is primitive**: Simple all-or-nothing transfers
4. **No proper marketplace**: Current negotiation flow is clunky
5. **UX not modern**: Lacks real auction feel with bid/ask columns for C, N, D, Q

### What's Right (Keep These)
- **File-based storage with flock()**: Good for single-server deployment
- **Email-based team identity**: Clean separation
- **Linear programming integration**: Shadow prices work well
- **Tailwind CSS**: Modern styling framework already in place

---

## New Architecture Overview

### Core Principle: **Team-Centric Storage**

```
data/
├── teams/
│   ├── team1@example.com/
│   │   ├── profile.json          # Team name, starting funds, current funds
│   │   ├── inventory.json        # Current C, N, D, Q quantities
│   │   ├── production_history.json  # Past production cycles
│   │   ├── offers_made.json      # Offers this team created (sell orders)
│   │   ├── offers_received.json  # Offers this team is interested in (buy interest)
│   │   ├── transactions.json     # Complete trade history
│   │   ├── notifications.json    # Unread notifications
│   │   └── shadow_prices.json    # PRIVATE - cached shadow prices (never shared!)
│   ├── team2@example.com/
│   │   └── ... (same structure)
│   └── ...
├── marketplace/
│   ├── active_offers.json        # Aggregated view (generated on-demand)
│   └── completed_trades.json     # Global trade log (append-only)
└── game_state/
    ├── current_session.json      # Which trading day/round
    ├── config.json               # Game parameters (recipes, starting funds)
    └── settings.json             # Global settings (allow hints, polling interval)
```

### Data Flow

1. **Team views marketplace** → Aggregator scans all `teams/*/offers_made.json`
2. **Team creates offer** → Writes to `teams/<email>/offers_made.json`
3. **Team bids on offer** → Writes to `teams/<email>/offers_received.json` + notifies seller
4. **Trade executes** → Updates both teams' `inventory.json`, `transactions.json`, and `marketplace/completed_trades.json`

---

## Detailed Component Design

### 1. Storage Layer (PHP)

**File: `lib/TeamStorage.php`**

```php
class TeamStorage {
    private $teamEmail;
    private $basePath;

    public function __construct($email) {
        $this->teamEmail = $email;
        $this->basePath = __DIR__ . "/../data/teams/" . $this->sanitizeEmail($email);
        $this->ensureDirectoryStructure();
    }

    // Atomic read-write methods
    public function getProfile();
    public function updateProfile($callback);
    public function getInventory();
    public function updateInventory($callback);
    public function getOffersMade();
    public function addOffer($offerData);
    public function removeOffer($offerId);
    public function getTransactions();
    public function addTransaction($transactionData);
    public function getNotifications();
    public function addNotification($notificationData);

    // Helper: Atomic file operations with flock()
    private function atomicUpdate($filename, $callback);
}
```

**File: `lib/MarketplaceAggregator.php`**

```php
class MarketplaceAggregator {
    // Scan all teams and build marketplace view
    public function getActiveOffers() {
        // Read teams/*/offers_made.json
        // Filter out completed/cancelled
        // Return unified array with seller info
    }

    public function getOffersByChemical($chemical) {
        // Return all active offers for specific chemical (C, N, D, Q)
        // Sorted by price (lowest first for buyers)
    }

    public function getAllTeams() {
        // Scan teams/ directory
        // Return list of active teams with basic info
    }
}
```

**File: `lib/TradeExecutor.php`**

```php
class TradeExecutor {
    public function executeTrade($sellerId, $buyerId, $chemical, $quantity, $pricePerGallon) {
        // 1. Lock both team directories (alphabetical order to prevent deadlock)
        // 2. Validate: seller has inventory, buyer has funds
        // 3. Update seller: inventory -= quantity, funds += total
        // 4. Update buyer: inventory += quantity, funds -= total
        // 5. Log to both teams' transactions.json
        // 6. Log to marketplace/completed_trades.json
        // 7. Remove offer from seller's offers_made.json
        // 8. Send notifications
        // 9. Unlock
    }
}
```

---

### 2. API Layer (PHP Endpoints)

All endpoints use team-centric storage:

**`api/team/profile.php`**
- GET: Returns current team profile, inventory, funds
- POST: Update team name (limited fields)

**`api/marketplace/offers.php`**
- GET: Returns aggregated active offers (optionally filtered by chemical)
- Query params: `?chemical=C` or `?chemical=N,D` etc.

**`api/offers/create.php`**
- POST: Create new sell offer
- Body: `{ chemical: "C", quantity: 100, minPrice: 5.50, type: "sell" }`
- Writes to `teams/<email>/offers_made.json`

**`api/offers/cancel.php`**
- POST: Cancel own offer
- Body: `{ offerId: "abc123" }`

**`api/offers/bid.php`**
- POST: Express interest in buying (create buy order)
- Body: `{ chemical: "C", quantity: 50, maxPrice: 6.00 }`
- Writes to `teams/<email>/offers_received.json`

**`api/trades/execute.php`**
- POST: Accept a match between buy/sell orders
- Body: `{ sellOfferId: "xyz", buyOfferId: "abc", agreedPrice: 5.75 }`
- Uses `TradeExecutor` to atomically update both teams

**`api/production/run.php`**
- POST: Run linear programming solver
- Body: `{ products: { deicer: X, solvent: Y } }`
- Updates inventory based on production
- Writes to `production_history.json`

**`api/production/shadow-prices.php`**
- GET: Calculate shadow prices for **current authenticated team only**
- **CRITICAL SECURITY**: Must validate user session, only return prices for requesting team
- Returns: `{ C: 12.50, N: 8.30, D: 15.00, Q: 3.20 }`
- **NEVER** expose other teams' shadow prices

**`api/notifications/list.php`**
- GET: List unread notifications
- POST: Mark as read

**`api/team/settings.php`**
- GET: Get team settings (showTradingHints, etc.)
- POST: Update team settings
- Body: `{ showTradingHints: true }`

---

### 3. Frontend - Modern Marketplace UX

**New Design Philosophy:**
- **Column-based layout**: One column per chemical (C, N, D, Q)
- **Order book style**: Bid/ask prices visible like stock exchange
- **Real-time updates**: Polling every 2-3 seconds
- **Shadow price integration**: Show your valuation vs market price

**File: `marketplace.html`** (replaces `market.html`)

#### Layout Structure:

```
┌─────────────────────────────────────────────────────────────┐
│  MARKETPLACE - Session 3 - Team: team7@example.com          │
│  Funds: $5,000  |  [⚙️ Settings] [🔔 Notifications: 2]      │
│  Shadow Prices (Last: 2 trades ago ⚠️): C:$12 N:$8 D:$15 Q:$3 │
│  [Recalculate Shadow Prices] ← Manual button                │
└─────────────────────────────────────────────────────────────┘
┌─────────────┬─────────────┬─────────────┬─────────────┐
│  Chemical C │  Chemical N │  Chemical D │  Chemical Q │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ Your Inv: 200 │ Your Inv: 150 │ Your Inv: 100 │ Your Inv: 50 │
│ YOUR Shadow: $12 │ YOUR Shadow: $8 │ YOUR Shadow: $15 │ YOUR Shadow: $3 │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ [+ Sell]    │ [+ Sell]    │ [+ Sell]    │ [+ Sell]    │
│ [+ Buy]     │ [+ Buy]     │ [+ Buy]     │ [+ Buy]     │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ SELL ORDERS │ SELL ORDERS │ SELL ORDERS │ SELL ORDERS │
│ Team3: 100g │ Team5: 75g  │ Team1: 200g │ Team2: 50g  │
│ @ $10.00   │ @ $7.50    │ @ $14.00   │ @ $4.00    │
│ [BUY NOW]  │ [BUY NOW]  │ [BUY NOW]  │ [BUY NOW]  │
│ (hints off) │ (hints off) │ (hints off) │ (hints off) │
│            │             │             │             │
│ Team9: 50g  │ Team8: 100g │             │ Team6: 25g  │
│ @ $11.50   │ @ $8.00    │             │ @ $4.50    │
│ [BUY NOW]  │ [BUY NOW]  │             │ [BUY NOW]  │
│            │             │             │             │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ BUY ORDERS  │ BUY ORDERS  │ BUY ORDERS  │ BUY ORDERS  │
│ Team4: 150g │ Team7: 50g  │ Team3: 100g │             │
│ @ $9.00    │ @ $7.00    │ @ $13.00   │             │
│ [SELL TO]  │ [SELL TO]  │ [SELL TO]  │             │
│            │             │             │             │
└─────────────┴─────────────┴─────────────┴─────────────┘

MY ACTIVE ORDERS
┌────────────────────────────────────────────────────────┐
│ Selling: 100g of C @ $10.00 minimum  [CANCEL]         │
│ Buying: 50g of N @ $7.00 maximum     [CANCEL]         │
└────────────────────────────────────────────────────────┘
```

#### Key Features:

1. **Order Book per Chemical**:
   - Sell orders sorted low-to-high (best deals first)
   - Buy orders sorted high-to-low (best prices first)
   - Each order shows: Team, Quantity, Price, Action button

2. **Shadow Price Integration** (PRIVATE - only visible to the team):
   - **CRITICAL**: Shadow prices are NEVER sent to other teams or displayed publicly
   - Each team sees only their own shadow prices
   - Displayed prominently for each chemical column
   - **Must be manually recalculated** after each transaction
   - **Educational Feature**: System warns if shadow prices are stale:
     - First transaction: "💡 Tip: Your shadow prices may be outdated. Recalculate after each trade!"
     - After 2+ transactions without recalc: "⚠️ Warning: Shadow prices are stale (last calculated before 2 transactions). Click [Recalculate] to update."

   **Trading Hints (Optional - Default OFF)**:
   - Settings toggle: "Show trading hints based on shadow prices"
   - When enabled, shows color-coded indicators (relative to YOUR shadow price):
     - **Green "Good Deal!"**: Market price < YOUR shadow price (good to buy)
     - **Red "Too High"**: Market price > YOUR shadow price (don't buy)
     - **Orange "Fair"**: Market price ≈ YOUR shadow price
     - For sell orders:
       - **Green "Good Deal!"**: Buyer offers > YOUR shadow price (good to sell)
       - **Red "Too Low"**: Buyer offers < YOUR shadow price (don't sell)
   - When disabled: No hints shown, students must interpret shadow prices themselves
   - Instructor can disable this feature entirely via game settings

3. **Quick Actions**:
   - **[+ Sell]**: Open modal to create sell order
   - **[+ Buy]**: Open modal to create buy order
   - **[BUY NOW]**: Accept sell order at listed price
   - **[SELL TO]**: Accept buy order at listed price

4. **Notifications Panel** (top-right):
   - Badge with count
   - Dropdown with recent activity
   - "Team3 bought your 50g of Chemical C for $500"

5. **Settings Modal** (⚙️ icon):
   - **Show Trading Hints**: Toggle (default: OFF)
     - Description: "Display color-coded indicators comparing market prices to your shadow prices"
     - Note: "This is a learning aid. Try trading without hints to better understand shadow prices!"
   - **Polling Interval**: Dropdown (3s, 5s, 10s)
   - **Notification Preferences**: Which events to notify about
   - **Save** and **Cancel** buttons

---

### 4. JavaScript Architecture

**File: `js/marketplace.js`**

```javascript
class Marketplace {
    constructor() {
        this.currentTeam = null;
        this.shadowPrices = {};
        this.activeOffers = { C: [], N: [], D: [], Q: [] };
        this.poller = null;
    }

    async init() {
        await this.loadTeamProfile();
        await this.calculateShadowPrices();
        await this.refreshMarketplace();
        this.startPolling();
    }

    async loadTeamProfile() {
        // GET /api/team/profile.php
    }

    async calculateShadowPrices() {
        // GET /api/production/shadow-prices.php
        // Updates shadowPrices object
        // Resets transaction counter for staleness tracking
        // Shows educational tip on first calculation
    }

    trackTransaction() {
        // Increment counter: transactionsSinceLastCalc
        // Update UI staleness indicator
        // Show warnings if > 1 transaction without recalc
    }

    getStalenessWarning() {
        // Returns warning message based on transactionsSinceLastCalc
        // 0: No warning
        // 1: Tip (first time only)
        // 2+: Warning message
    }

    async refreshMarketplace() {
        // GET /api/marketplace/offers.php
        // Group by chemical
        // Sort by price
        // Render columns
    }

    renderChemicalColumn(chemical) {
        // Build HTML for one column (C, N, D, or Q)
        // Show sell orders, buy orders
        // Highlight based on shadow price
    }

    async createSellOrder(chemical, quantity, minPrice) {
        // POST /api/offers/create.php
    }

    async createBuyOrder(chemical, quantity, maxPrice) {
        // POST /api/offers/bid.php
    }

    async acceptOffer(offerId, type) {
        // POST /api/trades/execute.php
    }

    startPolling() {
        this.poller = setInterval(() => this.refreshMarketplace(), 3000);
    }
}
```

**File: `js/production.js`**

```javascript
class ProductionManager {
    async runProduction(deicerQty, solventQty) {
        // POST /api/production/run.php
        // Uses LP solver to determine if feasible
        // Updates inventory
    }

    async getShadowPrices() {
        // GET /api/production/shadow-prices.php
    }

    renderProductionDashboard() {
        // Show current inventory
        // Input for desired production quantities
        // Button to run production
        // Display results
    }
}
```

---

## Migration Strategy

### Phase 1: Storage Layer (Week 1)
- [ ] Create `lib/TeamStorage.php`
- [ ] Create `lib/MarketplaceAggregator.php`
- [ ] Create `lib/TradeExecutor.php`
- [ ] Write unit tests for atomic file operations
- [ ] Migrate existing `data/user_*.json` to new structure

### Phase 2: API Endpoints (Week 2)
- [ ] Implement all `/api/team/*` endpoints
- [ ] Implement all `/api/marketplace/*` endpoints
- [ ] Implement all `/api/offers/*` endpoints
- [ ] Implement all `/api/trades/*` endpoints
- [ ] Implement all `/api/production/*` endpoints
- [ ] Test with curl/Postman

### Phase 3: Frontend Rebuild (Week 3)
- [ ] Build `marketplace.html` with 4-column layout
- [ ] Implement `js/marketplace.js`
- [ ] Implement order creation modals
- [ ] Implement trade acceptance flow
- [ ] Add polling and notifications
- [ ] Style with Tailwind CSS

### Phase 4: Production Integration (Week 4)
- [ ] Build `production.html`
- [ ] Integrate LP solver (existing `solver.js`)
- [ ] Connect shadow price calculations
- [ ] Add production history view

### Phase 5: Testing & Polish (Week 5)
- [ ] Multi-team simulation testing
- [ ] Performance testing (10+ concurrent teams)
- [ ] Edge case handling (insufficient funds, race conditions)
- [ ] Educational feedback messages ("Both teams won!")
- [ ] Admin dashboard for instructors

---

## Security & Privacy Requirements

### Shadow Price Privacy - CRITICAL ⚠️

**Shadow prices are the CORE SECRET of each team's strategy.**

#### Why Shadow Prices Must Be Private:
1. **Educational Goal**: Students learn to calculate and use their own valuations
2. **Strategic Advantage**: Teams with accurate shadow prices make better trades
3. **Fair Competition**: Knowing others' shadow prices eliminates the learning objective
4. **Win-Win Discovery**: Teams must figure out when trades benefit both sides

#### Implementation Requirements:

**API Layer:**
- ✅ `/api/production/shadow-prices.php` - Only returns prices for authenticated team
- ❌ NEVER include shadow prices in `/api/marketplace/offers.php` response
- ❌ NEVER include shadow prices in `/api/team/profile.php` for other teams
- ✅ Validate `$_SERVER['mail']` on every shadow price request

**Storage Layer:**
- ✅ `shadow_prices.json` stored in team's private directory only
- ✅ File permissions: 0600 (owner read/write only)
- ❌ Never copy shadow prices to shared/marketplace files

**Frontend Layer:**
- ✅ Shadow prices loaded client-side via authenticated API call
- ✅ Used for highlighting "Good Deal" / "Bad Deal" indicators
- ✅ Displayed in team's own UI only
- ❌ NEVER sent to server in trade requests (server doesn't need them)
- ❌ NEVER logged to console in production mode

**Testing:**
- [ ] Verify: Team A cannot access Team B's shadow prices via API
- [ ] Verify: Shadow prices not visible in network requests to marketplace
- [ ] Verify: No shadow prices in browser localStorage accessible to other tabs
- [ ] Verify: Trade execution doesn't log shadow prices

#### Example Security Test:
```bash
# This should FAIL (403 Forbidden)
curl -H "Cookie: mock_mail=team3@example.com" \
  http://cndq.ddev.site/api/production/shadow-prices.php?team=team7@example.com

# This should SUCCEED (only own prices)
curl -H "Cookie: mock_mail=team3@example.com" \
  http://cndq.ddev.site/api/production/shadow-prices.php
```

---

## Technical Decisions

### Why File-Based Storage?
- **Pros**: Simple deployment, no DB setup, atomic with `flock()`
- **Cons**: Doesn't scale beyond ~50 teams
- **Verdict**: Perfect for classroom use (10-20 teams)

### Why Team-Centric Files?
- **Pros**: Minimizes lock contention, clear ownership, easy backup
- **Cons**: Aggregation requires scanning multiple files
- **Verdict**: Read-heavy aggregation is acceptable for this use case

### Why HTTP Polling Instead of WebSockets?
- **Pros of Polling**:
  - Simple to implement and debug
  - No persistent server process required
  - Works with standard Laragon/Apache setup
  - Configurable interval (default 3-5 seconds)
  - Easy to pause/resume
- **Cons**:
  - Slight delay in updates (acceptable for classroom)
  - More HTTP requests (minimal impact with 10-20 teams)
- **Verdict**: HTTP polling every 3-5 seconds is perfect for classroom pace and simplifies deployment

### Why Column-Based UX?
- **Pros**: Familiar to traders, clear market visibility, easy to compare
- **Cons**: Takes more screen space
- **Verdict**: Desktop-first design is appropriate for classroom computers

---

## Educational Benefits of Manual Shadow Price Recalculation

### Why Manual Recalculation?

1. **Reinforces Linear Programming Concepts**:
   - Students actively engage with LP solver output
   - Forces awareness that shadow prices depend on current inventory
   - Demonstrates dynamic nature of opportunity costs

2. **Teaches Strategic Timing**:
   - Students learn when recalculation matters most
   - Builds intuition about inventory changes
   - Encourages planning before trading

3. **Prevents Autopilot Behavior**:
   - Can't blindly follow hints without understanding
   - Must consciously decide when to recalculate
   - Promotes critical thinking about trade impacts

4. **Real-World Analogy**:
   - Like businesses updating forecasts after major changes
   - Shadow prices = internal valuations that need updating
   - Not instant/automatic in real markets

### Staleness Warning System

**Purpose**: Guide students without doing the work for them

**Implementation**:
```javascript
// Track transactions since last calculation
let transactionsSinceCalc = 0;

function onTradeCompleted() {
    transactionsSinceCalc++;

    if (transactionsSinceCalc === 1 && !hasSeenTip) {
        showInfoBanner(
            "💡 Tip: Your inventory changed! Shadow prices may be outdated. " +
            "Click [Recalculate] to update them based on your new inventory."
        );
        hasSeenTip = true;
    }

    if (transactionsSinceCalc >= 2) {
        showWarningBanner(
            "⚠️ Shadow prices are stale (last calculated before " +
            transactionsSinceCalc + " transactions). " +
            "Your valuations may be inaccurate!"
        );
    }
}

function onRecalculate() {
    transactionsSinceCalc = 0;
    clearWarnings();
}
```

**Visual Indicators**:
- Green checkmark: "Fresh (0 trades ago)"
- Yellow warning: "Stale (1 trade ago)"
- Red alert: "Very stale (2+ trades ago)"

---

## Game Flow Example

### Session Start
1. Instructor sets session parameters (starting funds, inventory, recipes)
2. Teams log in, see initial inventory
3. Teams run LP solver to get shadow prices

### Trading Round
1. Teams calculate shadow prices (click [Recalculate] button)
2. Teams review their shadow prices: C:$12, N:$8, D:$15, Q:$3
3. Teams create sell/buy orders based on shadow prices
4. Marketplace aggregates all orders (via HTTP polling)
5. Teams browse columns, see opportunities
6. Team A sees: Team B selling C @ $10, their shadow price is $12 → **GOOD DEAL!** (if hints enabled)
7. Team A accepts offer, trade executes instantly
8. Both teams see updated funds/inventory
9. **Staleness indicator updates**: "⚠️ Stale (1 trade ago)"
10. Team A's notification: "💡 Tip: Shadow prices may be outdated. Recalculate after each trade!"
11. Team A clicks [Recalculate] to update shadow prices based on new inventory
12. Team A continues trading with fresh valuations

### Production Round
1. Teams input desired production quantities
2. LP solver validates feasibility
3. Inventory updated (chemicals consumed, products created)
4. New shadow prices calculated
5. Next trading round begins

### Session End
1. Instructor closes marketplace
2. Final funds calculated
3. Scoreboard shows % gain/loss vs starting funds
4. Discussion: "Which trades were win-win? Why?"

---

## API Endpoint Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/team/profile.php` | GET | Get team profile & inventory |
| `/api/marketplace/offers.php` | GET | Get all active market offers |
| `/api/offers/create.php` | POST | Create sell order |
| `/api/offers/bid.php` | POST | Create buy order |
| `/api/offers/cancel.php` | POST | Cancel own order |
| `/api/trades/execute.php` | POST | Execute trade |
| `/api/production/run.php` | POST | Run production cycle |
| `/api/production/shadow-prices.php` | GET | Calculate shadow prices (auth required) |
| `/api/notifications/list.php` | GET | Get notifications |
| `/api/team/settings.php` | GET/POST | Get/update team settings |
| `/api/admin/session.php` | GET/POST | Manage game session |

---

## Data Models

### Team Profile (`profile.json`)
```json
{
  "email": "team7@example.com",
  "teamName": "Team 7",
  "startingFunds": 10000,
  "currentFunds": 11500,
  "createdAt": 1703001234,
  "lastActive": 1703012345,
  "settings": {
    "showTradingHints": false,
    "hasSeenShadowPriceTip": false
  }
}
```

### Inventory (`inventory.json`)
```json
{
  "C": 200,
  "N": 150,
  "D": 100,
  "Q": 50,
  "updatedAt": 1703012345,
  "transactionsSinceLastShadowCalc": 2
}
```

### Offer (`offers_made.json`)
```json
{
  "offers": [
    {
      "id": "offer_abc123",
      "chemical": "C",
      "quantity": 100,
      "minPrice": 10.00,
      "type": "sell",
      "status": "active",
      "createdAt": 1703012000
    }
  ]
}
```

### Transaction (`transactions.json`)
```json
{
  "transactions": [
    {
      "id": "txn_xyz789",
      "chemical": "C",
      "quantity": 100,
      "pricePerGallon": 10.50,
      "totalCost": 1050,
      "role": "seller",
      "counterparty": "team3@example.com",
      "timestamp": 1703012345,
      "profitIndicator": "win"
    }
  ]
}
```

---

## Success Metrics

### Functional Requirements
- [ ] 10+ teams can trade simultaneously without errors
- [ ] Trades execute in < 500ms
- [ ] No race conditions (verified by stress testing)
- [ ] Shadow prices calculate correctly
- [ ] All trades logged accurately

### User Experience
- [ ] Students can create order in < 3 clicks
- [ ] Market updates visible within 3 seconds
- [ ] Visual feedback for "good deals" (shadow price comparison)
- [ ] Notifications clear and actionable

### Educational Goals
- [ ] Students understand shadow price concept
- [ ] Students identify win-win trades
- [ ] Students see entire marketplace at a glance
- [ ] Instructor can export trade data for analysis

---

## Future Enhancements (Post-MVP)

1. **Advanced Order Types**:
   - Limit orders (execute when price reached)
   - All-or-nothing orders
   - Good-til-cancelled vs immediate-or-cancel

2. **Analytics Dashboard**:
   - Price charts over time
   - Volume traded per chemical
   - Team performance rankings
   - Win-win trade identification

3. **Educational Features**:
   - Automated "Both teams won!" detection
   - Shadow price explanations
   - Strategy hints based on LP results

4. **Multi-Session Support**:
   - Save/load game states
   - Historical session comparison
   - Persistent leaderboards

---

## Questions to Resolve

1. **Session Management**: Should sessions be time-based or round-based?
2. **Order Matching**: Automatic matching vs manual acceptance?
3. **Price Discovery**: Allow negotiation or fixed-price only?
4. **Partial Fills**: Allow buying 50g when 100g offered?
5. **Admin Controls**: Can instructor pause trading? Reset session?

---

## Testing with Chrome DevTools MCP

### Setup
```bash
npm install -g @modelcontextprotocol/server-puppeteer
```

### Test URLs
- **API Test Page**: http://localhost/CNDQ/test_apis.php
- **Initialize Teams**: http://localhost/CNDQ/init_test_teams.php (run via PHP CLI)

### API Test Sequence
1. Navigate to test_apis.php
2. Test GET Profile - verify user authentication
3. Test Calculate Shadow Prices - verify privacy
4. Test Create Offer - verify inventory validation
5. Test View Marketplace - verify aggregation
6. Test security: Try accessing other team's shadow prices (should fail 403)

### Expected Results
- ✅ Profile returns team data with inventory
- ✅ Shadow prices calculated and stored
- ✅ Offers created and visible in marketplace
- ✅ Security: Cannot access other teams' shadow prices
- ✅ Trades execute atomically

---

## Next Steps

1. ✅ **Phase 1 Complete**: Storage layer implemented
2. ✅ **Phase 2 Complete**: All API endpoints implemented
3. 🚧 **Phase 3 In Progress**: Build marketplace.html frontend
4. **Phase 4**: Multi-team testing
5. **Phase 5**: Deploy to production

---

**END OF PLAN**

This plan provides a complete roadmap for rebuilding the CNDQ game with modern architecture, team-centric storage, and an intuitive marketplace UX. The file-based approach with atomic operations avoids concurrency issues while maintaining simplicity for classroom deployment.
