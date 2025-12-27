# CNDQ Marketplace SPA - Testing Guide

## Game Modes

The CNDQ marketplace supports **two operating modes**:

### 1. Auto-Advance Mode (DEFAULT) ✅

**Best for**: Autonomous classroom play without constant instructor supervision

- **✅ Auto-advance enabled by default** - game runs itself!
- Market automatically cycles: `Trading (10 min) → Closed (5 sec pause) → Next Session`
- Students can play multiple sessions without admin intervention
- Trading windows are timed (default 10 minutes per session)
- Brief 5-second pause between sessions for teams to prepare

**How it works:**
1. Session 1 starts in Trading phase (10 minutes)
2. After 10 minutes, market automatically closes
3. After 5-second pause, Session 2 begins (Trading phase)
4. Repeat indefinitely

**No admin needed!** Just load `http://localhost/CNDQ/` and play.

### 2. Manual Control Mode

**Best for**: Instructor-led demonstrations or controlled classroom environments

- Admin unchecks "Enable Auto-Advance" in dashboard
- Instructor manually controls when market opens/closes
- Allows for discussions between sessions
- More flexibility for teaching moments

**Access:** `http://localhost/CNDQ/admin.html` (admin login required)

---

## Quick Start Testing

### 1. Access the Marketplace

Open your browser to: `http://localhost/CNDQ/`

The marketplace SPA will load automatically as the new index.html

### 2. Test with Multiple Teams (Cookie Override)

Since the app uses `$_SERVER['mail']` for team identity, you can override it with a cookie for local testing:

#### Using Browser Console:

```javascript
// Team 1
document.cookie = "mock_mail=team1@example.com; path=/";
location.reload();

// Team 2 (open in incognito/different browser)
document.cookie = "mock_mail=team2@example.com; path=/";
location.reload();

// Team 3
document.cookie = "mock_mail=team3@example.com; path=/";
location.reload();
```

#### Using Browser DevTools:

1. Open DevTools (F12)
2. Go to **Application** → **Cookies** → `http://localhost`
3. Add a new cookie:
   - Name: `mock_mail`
   - Value: `team1@example.com` (or any team email)
   - Path: `/`
4. Refresh the page

### 3. Testing Workflow

#### Create Offers (Team 1)

1. Click **[+ Sell]** on Chemical C
2. Enter quantity: `100`
3. Enter price: `10.00`
4. Click **Create Offer**
5. Verify offer appears in "MY ACTIVE ORDERS"

#### Buy Offers (Team 2)

1. Switch to Team 2 (different browser/incognito)
2. Set cookie: `mock_mail=team2@example.com`
3. Refresh page
4. You should see Team 1's offer in Chemical C column
5. Click **[BUY NOW]**
6. Confirm purchase
7. Verify:
   - Funds decrease
   - Chemical C inventory increases
   - Notification appears

#### Verify Trade (Team 1)

1. Switch back to Team 1 browser
2. Wait 3 seconds (polling interval) or refresh
3. Verify:
   - Funds increase
   - Chemical C inventory decrease
   - Notification appears
   - Offer removed from "MY ACTIVE ORDERS"

### 4. Test Shadow Prices (Linear Programming)

Shadow prices are calculated using **real Linear Programming (Simplex method)** - not a placeholder formula!

1. Click **[Recalculate Shadow Prices]**
2. Verify prices update based on current inventory
3. Execute a trade (e.g., sell 200g of C)
4. Notice staleness indicator: "⚠ Stale (1 trade ago)"
5. **Important**: Shadow prices are now STALE (inventory changed!)
6. Recalculate again
7. Verify shadow price for C **increased** (C is now scarcer)
8. Verify staleness indicator: "✓ Fresh"

**Educational moment**: Students learn shadow prices are marginal values that change with inventory!

### 5. Test Trading Hints

1. Click **Settings** (gear icon)
2. Toggle **Show Trading Hints** ON
3. Close settings modal
4. Look for color-coded indicators on offers:
   - **Green border**: Good deal (price < your shadow price)
   - **Red border**: Too high (price > your shadow price)
   - **Orange border**: Fair (price ≈ your shadow price)

### 6. Test Notifications

1. Execute a trade
2. Click notifications bell icon (top-right)
3. Verify notification appears
4. Check badge shows unread count

### 7. Test Cancel Order

1. Create an offer
2. Find it in "MY ACTIVE ORDERS"
3. Click **[CANCEL]**
4. Confirm cancellation
5. Verify offer disappears from marketplace

## Pre-Initialized Test Teams

The system has 5 test teams already initialized:

- `team1@example.com` - Alpha Team
- `team2@example.com` - Beta Team
- `team3@example.com` - Gamma Team
- `team4@example.com` - Delta Team
- `team5@example.com` - Epsilon Team

Each has:
- Starting funds: $10,000
- Inventory: C=850-1000, N=740-1000, D=630-1000, Q=520-1000 (varies)

### Admin Users

The system has an admin allowlist with special privileges:

- `admin@stonybrook.edu` - Full system access
- `instructor@stonybrook.edu` - Course management
- `instructor1@stonybrook.edu` - Additional instructor
- `instructor2@stonybrook.edu` - Additional instructor

Admin users can access special endpoints like `/api/admin/list-teams.php`

## API Testing (Alternative)

Use the test page: `http://localhost/CNDQ/test_apis.php`

This provides buttons to test each API endpoint individually.

### Admin Dashboard & Session Controls

**Access:** `http://localhost/CNDQ/admin.html` (admin login required)

The admin dashboard provides full session management:

#### Features:

1. **Session Management**:
   - View current session number and phase (production/trading/closed)
   - Advance to next phase manually with **[Advance to Next Phase →]** button
   - Jump directly to any phase (Production/Trading/Closed)
   - Reset to Session 1

2. **Auto-Advance Mode** ✅:
   - Enable checkbox to automatically close trading after time limit
   - Set trading duration (default 10 minutes)
   - Real-time countdown timer shows time remaining
   - Automatically advances when timer expires

3. **Team Overview**:
   - See all teams with current funds
   - Active offers and trade counts
   - Real-time updates every 5 seconds

#### Testing Session Controls:

1. **Login as admin**: `http://localhost/CNDQ/dev_login.php` → Click "Admin"
2. **Open dashboard**: `http://localhost/CNDQ/admin.html`
3. **Close the market**: Click "Set: Closed" button
4. **Try to trade** (as a team): Get error "Trading not allowed"
5. **Open the market**: Click "Set: Trading" button
6. **Test auto-advance**:
   - Check "Enable Auto-Advance" checkbox
   - Set duration to 1 minute
   - Watch countdown timer
   - Market auto-closes when timer reaches 00:00

#### Trading Enforcement:

When market is **NOT** in trading phase:
- Teams **cannot create offers** (403 error)
- Teams **cannot execute trades** (403 error)
- Marketplace shows appropriate message

This prevents unlimited trading and enforces proper session boundaries!

### LP Solver Testing (Advanced)

To verify the Linear Programming solver is working correctly:

```bash
# Run the LP solver test script
php test_lp_solver.php
```

Expected output:
- Optimal production mix (deicer and solvent quantities)
- Maximum profit calculation
- Shadow prices for all chemicals (C, N, D, Q)
- Demonstrates how shadow prices change with inventory

**Key insight**: When inventory of a chemical decreases, its shadow price typically increases (scarcity drives up marginal value).

## Multi-Team Simulation

### Setup 3 Browsers:

1. **Chrome (Normal)**: Team 1
2. **Chrome (Incognito)**: Team 2
3. **Firefox**: Team 3

### Scenario: Price Discovery

1. **Team 1**: Create offer - Sell 100g C @ $10/gal
2. **Team 2**: Create offer - Sell 100g C @ $12/gal
3. **Team 3**:
   - Sees both offers
   - Calculates shadow price for C
   - If shadow > $10, buys from Team 1 (good deal!)
   - Verifies "Good Deal!" indicator (if hints enabled)

### Scenario: Win-Win Trade

1. **Team 1**: Shadow price for C = $8/gal
2. **Team 2**: Shadow price for C = $14/gal
3. **Trade**: Team 1 sells to Team 2 @ $11/gal
4. **Result**:
   - Team 1 wins: $11 > $8 (their valuation)
   - Team 2 wins: $11 < $14 (their valuation)
   - Both teams profit!

## Polling Behavior

The SPA polls every **3 seconds** for:
- Marketplace updates
- New notifications

You can test this by:
1. Opening two browsers (different teams)
2. Creating an offer in Browser 1
3. Waiting 3 seconds
4. Offer should appear in Browser 2 automatically

## Known Limitations (Expected)

1. **Buy orders not implemented yet**: Only sell orders work
2. **Partial fills**: Not supported (all-or-nothing trades)
3. **No production page**: Only marketplace trading (production.html needs rebuild)
4. **No negotiation system**: Counter-offers not yet implemented

## Troubleshooting

### "Not authenticated" Error

- Make sure cookie `mock_mail` is set correctly
- Path must be `/` not `/CNDQ`
- Check in DevTools → Application → Cookies

### Offers Don't Appear

- Wait 3 seconds for polling
- Hard refresh (Ctrl+F5)
- Check browser console for errors

### Trades Fail

- Verify sufficient inventory (seller)
- Verify sufficient funds (buyer)
- Check browser console for detailed error

## Success Criteria ✓

- [ ] Load marketplace with team info
- [ ] Display inventory and funds
- [ ] Show shadow prices
- [ ] Create sell offer successfully
- [ ] Cancel offer successfully
- [ ] Execute trade between two teams
- [ ] Both teams see updated inventory/funds
- [ ] Notifications delivered to both parties
- [ ] Staleness indicator updates after trade
- [ ] Trading hints toggle works
- [ ] Polling updates marketplace automatically
- [ ] Can test with 3+ teams simultaneously

## Next Steps

After testing, consider:

1. Integrate actual LP solver for shadow prices
2. Implement buy orders
3. Add production cycle page
4. Add admin dashboard
5. Add team statistics/leaderboard
