# CNDQ Game Simulation

Automated end-to-end testing script that simulates multiple teams playing the Chemical Trading Game for 10 sessions.

## What It Does

The simulation script:

1. **Enables auto-advance** - Sets up automatic session progression
2. **Simulates 6 teams** - Each team makes intelligent trading decisions
3. **Shadow-price-based strategy**:
   - High shadow price (>$2) → Team wants to BUY (chemical is valuable)
   - Low shadow price (<$1) → Team wants to SELL (excess inventory)
4. **Automated negotiations** - Teams initiate trades with counterparties
5. **10-session gameplay** - Runs through complete production → trading cycle
6. **Realistic data generation** - Creates leaderboard standings and transaction history

## Installation

```bash
# Install Puppeteer
npm install
```

## Running the Simulation

```bash
# Run full 10-session simulation
npm run simulate
```

Or directly:

```bash
node test_game_simulation.js
```

## Configuration

Edit `test_game_simulation.js` to customize:

```javascript
const TEAMS = [
    'test_mail1@stonybrook.edu',
    'test_mail2@stonybrook.edu',
    // Add more teams...
];

const TARGET_SESSIONS = 10; // Number of sessions to simulate
const TRADING_PHASE_DURATION = 60; // Seconds per trading phase
```

## What to Expect

The script will:
- Open a browser window (set `headless: true` to hide it)
- Log into each team sequentially
- Post buy/sell advertisements based on shadow prices
- Initiate negotiations when profitable opportunities exist
- Wait for auto-advance to cycle through sessions
- Complete after 10 sessions

## Output

Console output shows:
```
🎮 Starting CNDQ Game Simulation...

📋 Step 1: Enabling auto-advance...
   ✓ Auto-advance enabled

📋 Step 2: Starting multi-session gameplay...
   Starting at session 1
   Target: 10 sessions

🎯 Session 1 - TRADING
────────────────────────────────────────────────────────────
📢 Teams posting advertisements...
   Lucky Hawk:
      📥 Wants to BUY C (shadow: $4)
      📤 Wants to SELL N (shadow: $0)

💼 Teams initiating negotiations...
   Lucky Hawk → Negotiating to BUY C from Crafty Otter

⏳ Waiting for trading phase to end...
   ✓ Phase changed to production

🏁 Completed 10 sessions!
```

## Viewing Results

After simulation completes:
1. Open http://cndq.test/index.html
2. Click the **Leaderboard** button (gold medal icon)
3. See team standings ranked by ROI%

## Troubleshooting

**Script hangs during trading phase:**
- Check that auto-advance is enabled in admin.html
- Verify trading duration is set appropriately (60s recommended)

**Negotiations not completing:**
- This is normal - some negotiations may fail
- The script continues regardless of individual trade success

**Browser won't close:**
- Intentional - kept open for result inspection
- Close manually when done reviewing

## Testing Without Simulation

To manually test individual components:

```javascript
// Test shadow price calculation
node -e "require('./lib/LPSolver.php')"

// Test session advancement
curl http://cndq.test/api/admin/session.php

// Check leaderboard
curl http://cndq.test/api/leaderboard/standings.php
```
