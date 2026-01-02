# Game Loop Logic Diagnosis: "No-M" Event-Sourced User Journey

This document traces a single team's state across 3 game sessions (rounds) to diagnose the logic of the event-sourced game loop and the aggregator's reduction efficiency.

## Scenario Overview
- **User**: `diagnostic_user@example.com`
- **Goal**: Verify state consistency across multiple production/trading cycles.
- **System State**: Freshly reset (`data/` is empty).

---

## Session 1: Initiation & Initial Capital

### Step 1.1: Registration (Production Phase)
The user hits the profile API. `TeamStorage` initializes the directory.
- **Event Emitted**: `event_1735680000.000000_init.json` 
  - *Payload*: Initial random chemicals (C, N, D, Q).
- **Event Emitted**: `event_1735680001.000000_set_funds.json`
  - *Payload*: `amount: 1200, is_starting: true` (Result of `runAutomaticFirstProduction`).
- **Logic Check**: `Aggregator` must merge `init` into the empty state. 
- **State Result**: `currentFunds: 1200`, `inventory: {C: 100, ...}`.

### Step 1.2: Trading Phase Open
Session advances to 'trading'. The user wants to sell Chemical 'C'.
- **Event Emitted**: `event_1735680010.000000_add_ad.json`
  - *Payload*: `{chemical: 'C', type: 'sell'}`.
- **Action**: User negotiates and executes a trade (10 units of C for $200).
- **Event Emitted**: `event_1735680015.000000_adjust_chemical.json` (`amount: -10, chemical: 'C'`).
- **Event Emitted**: `event_1735680015.000001_set_funds.json` (`amount: 1400`).
- **Event Emitted**: `event_1735680015.000002_add_transaction.json`.
- **Logic Check**: Aggregator must round 'C' to 4 decimals and increment `transactionsSinceLastShadowCalc`.
- **Observation**: `adjust_chemical` logic in `Aggregator` correctly handles the atomic decrement.

---

## Session 2: Inventory Depletion & Re-Production

### Step 2.1: Production Phase Advance
`SessionManager` triggers `runAutoProduction()`.
- **Event Emitted**: `event_1735680100.000000_adjust_chemical.json` (Consumed chemicals).
- **Event Emitted**: `event_1735680100.000001_set_funds.json` (`amount: 2500`).
- **Event Emitted**: `event_1735680100.000002_add_production.json`.
- **Logic Check**: Does the aggregator maintain the history?
- **State Result**: `state['productions']` now contains 2 entries (Initial + Session 2). `currentFunds` is cumulative.

### Step 2.2: Trading Phase (The "Stale" Warning)
User buys 50 units of 'N'. 
- **Event Emitted**: `event_1735680120.000000_adjust_chemical.json` (`amount: 50, chemical: 'N'`).
- **Logic Check**: `transactionsSinceLastShadowCalc` is now 2. 
- **UI Logic Diagnosis**: `api/team/profile.php` reads this and should flag `stalenessLevel: 'stale'`.

---

## Session 3: Optimization & Shadow Prices

### Step 3.1: Shadow Price Update
User requests shadow price calculation to optimize for next session.
- **Event Emitted**: `event_1735680200.000000_update_shadow_prices.json`.
- **Logic Check**: Reducer must update `shadowPrices` AND reset `transactionsSinceLastShadowCalc` to 0.
- **Verification**: `Aggregator::reduce` case `update_shadow_prices` resets the counter.

### Step 3.2: Final Trading before Session End
User removes their ad.
- **Event Emitted**: `event_1735680210.000000_remove_ad.json`.
- **Logic Check**: `Aggregator` uses `array_filter` to remove the ad from the array.

---

## Summary of Diagnostic Observations

1. **Ordering Consistency**: Because event filenames use `microtime(true)`, sorting by glob ensures the state machine (Aggregator) always reaches the same conclusion regardless of when it's run.
2. **Atomic Integrity**: Since `set_funds` is an absolute value (not a delta) in `TeamStorage::updateFunds`, if an event were missed, the funds would "snap" to the last known absolute state. *Recommendation*: Consider if `adjust_funds` (delta) is safer for concurrent trades.
3. **Cache Efficiency**: During Session 2, the team directory mtime updates with every event. The `cached_state.json` is deleted/invalidated, forcing a re-aggregation. In a busy 100-user game, this happens every ~5-10 seconds per user, which is well within the Page Cache performance threshold of the "No-M" model.
4. **Rounding**: The 4-decimal rounding in `adjust_chemical` prevents the `D=-1.1368683772162E-13` floating point errors observed in legacy systems.
