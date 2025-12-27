# Shadow Price Recalculation - Educational Workflow

## Overview

The CNDQ marketplace implements **manual shadow price recalculation** as a key educational feature. This teaches students that shadow prices are dynamic valuations that change as inventory changes through trading.

---

## 🎓 Educational Goal

Students must learn:
1. Shadow prices represent the **marginal value** of each chemical to their production capacity
2. Shadow prices **become stale** after trades (inventory changes)
3. They must **actively recalculate** to make good trading decisions
4. Trading with stale shadow prices leads to suboptimal deals

---

## 🔄 Recalculation Workflow

### Initial State (App Launch)

```
✅ Shadow prices calculated automatically on first load
✅ Indicator shows: "✓ Fresh" (green)
```

### After First Transaction

```
⚠️ Staleness counter increments to 1
⚠️ Indicator shows: "⚠ Stale (1 trade ago)" (yellow)
💡 Warning banner appears:
   "💡 Tip: Your inventory changed! Shadow prices may be outdated.
    Click [Recalculate] to update them."
```

**Purpose:** First-time educational hint - teach students they need to recalculate

### After Multiple Transactions (2+)

```
🚨 Staleness counter increments to 2+
🚨 Indicator shows: "⚠ Very Stale (2 trades ago)" (red)
⚠️ Warning banner appears:
   "⚠️ Warning: Shadow prices are very stale (last calculated before 2 transactions).
    Your valuations may be inaccurate!"
```

**Purpose:** Strong reminder - shadow prices are likely wrong now

### Manual Recalculation

```
Student clicks [Recalculate Shadow Prices] button
↓
API call to /api/production/shadow-prices.php
↓
Backend calculates fresh shadow prices based on current inventory
↓
Staleness counter resets to 0
↓
Indicator shows: "✓ Fresh" (green)
↓
Warning banner disappears
```

---

## 🎨 Visual Indicators

### Header Shadow Price Display

```
┌─────────────────────────────────────────────────┐
│ Shadow Prices ✓ Fresh                          │
│ C: $10.50  N: $8.30  D: $15.00  Q: $3.20       │
│                    [Recalculate Shadow Prices]  │
└─────────────────────────────────────────────────┘
```

**States:**
- **✓ Fresh (green)**: 0 transactions since last calc
- **⚠ Stale (yellow)**: 1 transaction since last calc
- **⚠ Very Stale (red)**: 2+ transactions since last calc

### Warning Banner (appears below)

**First Trade (Yellow):**
```
┌─────────────────────────────────────────────────┐
│ 💡 Tip: Your inventory changed! Shadow prices  │
│    may be outdated. Click [Recalculate] to     │
│    update them.                                 │
└─────────────────────────────────────────────────┘
```

**Multiple Trades (Red):**
```
┌─────────────────────────────────────────────────┐
│ ⚠️ Warning: Shadow prices are very stale (last  │
│    calculated before 2 transactions). Your      │
│    valuations may be inaccurate!                │
└─────────────────────────────────────────────────┘
```

---

## 💻 Implementation Details

### Backend Tracking ([api/team/profile.php](c:\laragon\www\CNDQ\api\team\profile.php))

```php
// Inventory includes transaction counter
$inventory = [
    'C' => 850,
    'N' => 740,
    'D' => 630,
    'Q' => 520,
    'transactionsSinceLastShadowCalc' => 2  // ← Tracked here
];

// Staleness level calculated
if ($count >= 2) {
    $stalenessLevel = 'stale';
} elseif ($count === 1) {
    $stalenessLevel = 'warning';
} else {
    $stalenessLevel = 'fresh';
}
```

### Frontend Display ([js/marketplace.js:117-141](c:\laragon\www\CNDQ\js\marketplace.js))

```javascript
updateStalenessIndicator(level, count) {
    const indicator = document.getElementById('staleness-indicator');
    const warning = document.getElementById('staleness-warning');

    if (level === 'fresh') {
        indicator.innerHTML = '<span class="text-green-500">✓ Fresh</span>';
        warning.classList.add('hidden');
    } else if (level === 'warning') {
        indicator.innerHTML = '<span class="text-yellow-500">⚠ Stale (1 trade ago)</span>';
        // Show yellow tip
    } else if (level === 'stale') {
        indicator.innerHTML = `<span class="text-red-500">⚠ Very Stale (${count} trades ago)</span>`;
        // Show red warning
    }
}
```

### Counter Increment ([lib/TeamStorage.php:236-250](c:\laragon\www\CNDQ\lib\TeamStorage.php))

```php
public function adjustChemical($chemical, $amount) {
    return $this->updateInventory(function($data) use ($chemical, $amount) {
        $data[$chemical] += $amount;
        $data['updatedAt'] = time();

        // Increment transaction counter on ANY inventory change
        if ($amount != 0) {
            $data['transactionsSinceLastShadowCalc'] =
                ($data['transactionsSinceLastShadowCalc'] ?? 0) + 1;
        }

        return $data;
    });
}
```

### Counter Reset ([lib/TeamStorage.php:253-258](c:\laragon\www\CNDQ\lib\TeamStorage.php))

```php
public function resetShadowCalcCounter() {
    return $this->updateInventory(function($data) {
        $data['transactionsSinceLastShadowCalc'] = 0;
        return $data;
    });
}
```

Called from [api/production/shadow-prices.php:67](c:\laragon\www\CNDQ\api\production\shadow-prices.php) when recalculating.

---

## 🧪 Testing the Workflow

### Test Case 1: Initial State

```
1. Open marketplace
2. Verify shadow prices loaded
3. Verify indicator: "✓ Fresh" (green)
4. Verify no warning banner
```

**Expected:** Shadow prices calculated on load, indicator fresh

### Test Case 2: First Transaction

```
1. Create sell offer (100g of C @ $10)
2. Switch to Team 2 (incognito)
3. Buy the offer
4. Switch back to Team 1
5. Wait 3 seconds (polling)
```

**Expected:**
- ✅ Indicator changes to: "⚠ Stale (1 trade ago)" (yellow)
- ✅ Yellow tip banner appears
- ✅ Shadow prices still show old values

### Test Case 3: Manual Recalculation

```
1. Click [Recalculate Shadow Prices]
2. Wait for API response
```

**Expected:**
- ✅ Shadow prices update to new values
- ✅ Indicator changes to: "✓ Fresh" (green)
- ✅ Warning banner disappears

### Test Case 4: Multiple Transactions Without Recalc

```
1. Execute 2+ trades without recalculating
2. Verify staleness counter increments
```

**Expected:**
- ✅ Indicator: "⚠ Very Stale (2 trades ago)" (red)
- ✅ Red warning banner appears with strong language
- ✅ Shadow prices remain stale

### Test Case 5: Trading with Stale Prices

```
Scenario: Student ignores warnings and trades with stale prices

1. Team 1 has C shadow price = $12
2. Team 1 sells 100g C to Team 2
3. Inventory drops significantly
4. NEW shadow price should be $20 (scarcity)
5. But student doesn't recalculate
6. Student creates another sell offer @ $13
7. Loses money (could have sold @ $18)
```

**Expected Learning:** Student realizes they made a bad deal by not recalculating

---

## 📊 Staleness Tracking Table

| Transactions Since Calc | Indicator | Color | Warning Level | Message Type |
|------------------------|-----------|-------|---------------|--------------|
| 0 | ✓ Fresh | Green | None | - |
| 1 | ⚠ Stale | Yellow | Info | 💡 Tip |
| 2+ | ⚠ Very Stale | Red | Warning | ⚠️ Warning |

---

## 🎯 Teaching Moments

### When to Recalculate?

**Good Practice:**
- ✅ After every trade (especially large trades)
- ✅ Before creating new offers
- ✅ When inventory changes significantly
- ✅ At the start of each trading session

**Bad Practice:**
- ❌ Never recalculating
- ❌ Ignoring staleness warnings
- ❌ Using initial shadow prices all day
- ❌ Trading with red "Very Stale" indicator

### Instructor Discussion Points

1. **Why do shadow prices change?**
   - "Your inventory changed! If you sold 500g of C, C is now scarcer for you, so its shadow price increases."

2. **What happens if you don't recalculate?**
   - "You might sell at $10 when your new shadow price is $20. You just lost $10/gallon!"

3. **When is it okay to trade with stale prices?**
   - "If the change was small (traded 10g out of 1000g), staleness might be negligible."

4. **Advanced concept: Frequency vs. Magnitude**
   - "Don't recalculate after every 1-gallon trade. Recalculate when trades are large relative to your inventory."

---

## 🔧 Configuration

### Staleness Thresholds

Currently hardcoded in [api/team/profile.php](c:\laragon\www\CNDQ\api\team\profile.php):

```php
$transactionsSinceCalc = $inventory['transactionsSinceLastShadowCalc'] ?? 0;
$stalenessLevel = 'fresh';
if ($transactionsSinceCalc >= 2) {
    $stalenessLevel = 'stale';
} elseif ($transactionsSinceCalc === 1) {
    $stalenessLevel = 'warning';
}
```

**Possible Enhancements:**
- Make thresholds configurable per session
- Track magnitude of inventory changes (weighted staleness)
- Auto-suggest recalculation after large trades

---

## ✅ Summary

The shadow price recalculation system:

1. ✅ **Requires manual action** - Students must click button
2. ✅ **Provides progressive warnings** - Yellow → Red
3. ✅ **Tracks staleness counter** - Number of trades since calc
4. ✅ **Teaches cause and effect** - Inventory change → Price change
5. ✅ **Prevents autopilot trading** - Can't rely on stale prices
6. ✅ **Reinforces LP concepts** - Shadow prices are dynamic

This design ensures students actively engage with the linear programming concepts rather than passively following hints.
