# Puppeteer Test Coverage Evaluation & Strategy

## Current State Analysis

### 1. `game-simulation.js`
- **Focus:** Basic RPC vs. RPC flow.
- **Coverage:** 
    - [x] Advertisement posting.
    - [x] Initial negotiation response.
    - [x] Basic accept/reject.
- **Gaps:** 
    - [ ] No NPC involvement.
    - [ ] No verification of asynchronous trade reflections.
    - [ ] Very basic DOM interaction (may fail on Lit components).

### 2. `robust-game-simulation.js`
- **Focus:** Full game loop with both RPCs and NPCs.
- **Coverage:**
    - [x] Multi-session flow.
    - [x] NPC creation and manual phase control.
    - [x] RPCs responding to NPC offers.
- **Gaps:**
    - [ ] Does not specifically test RPC vs. RPC negotiations.
    - [ ] Uses slow PHP shell calls instead of leveraging the background runner loop.

### 3. `haggle-test.js`
- **Focus:** The "Witcher 3" haggle system (RPC vs. NPC).
- **Coverage:**
    - [x] Slider interaction.
    - [x] Patience/Mood verification.
- **Gaps:**
    - [ ] Hardcoded targeting of `herd.test` (brittle).
    - [ ] Single-threaded (one player only).

---

## Suggested Implementation: `unified-game-loop-test.js`

To assure full playability, a single unified test should verify the following "Golden Path" and "Edge Case" scenarios:

### Phase A: RPC vs. RPC (The Social Loop)
1. **Player A** posts a Buy Request.
2. **Player B** responds with an Offer.
3. **Player A** receives the negotiation, views it, and sends a **Counter-Offer**.
4. **Player B** receives the counter, sees the **Patience Bar**, and **Accepts**.
5. **Verification:** Both players see the "🔥 Hot Trade" toast and their balances update after the ~10s reflection window.

### Phase B: RPC vs. NPC (The PvE Loop)
1. **Player A** posts a Buy Request.
2. **NPC** detects and responds (triggered by background cron).
3. **Player A** haggles with the NPC using sliders.
4. **Verification:** NPC patience decreases on aggressive counters. NPC eventually accepts or walks away.

### Phase C: NPC vs. NPC (The Constraint Check)
1. **Verification:** Programmatic check (or log audit) to ensure NPCs never initiate negotiations with each other, preventing "infinite money" loops or resource draining.

### Phase D: "No-M" Integrity
1. **Verification:** After multiple trades, trigger a **Snapshot**. Clear the `event_*.json` files and verify the `Aggregator` recovers the exact same state from `snapshot.json`.

## Implementation Priority
1. Update `TeamHelper` to use robust component-querying (already partially done).
2. Create `comprehensive-loop.js` that orchestrates 2 RPCs and 1 NPC.
3. Add specific assertions for the "Reflection" delay.
