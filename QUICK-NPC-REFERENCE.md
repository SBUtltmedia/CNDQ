# Quick NPC Strategy Reference

## 🎯 Quick Decision Guide

### When to Use Each Strategy?

| If NPC Should... | Use Strategy | Skill Level |
|------------------|--------------|-------------|
| Provide basic liquidity | Shadow Price Arbitrage | Beginner |
| Compete aggressively | Bottleneck Elimination | Novice |
| Demonstrate expert play | Recipe Balancing | Expert |

---

## 📊 At-a-Glance Comparison

```
BEGINNER: Shadow Price Arbitrage
├─ Buy Rule: price < shadow_price × 0.9
├─ Sell Rule: price > shadow_price × 1.1
├─ Trade Size: 50-300 units
└─ Style: Passive, reliable

NOVICE: Bottleneck Elimination
├─ Target: Chemical with HIGHEST shadow price
├─ Acquire: Pay up to 1.5× shadow price
├─ Trade Size: 100-500 units
└─ Style: Aggressive, strategic

EXPERT: Recipe Balancing
├─ Specialize: Solvent (N:D:Q=5:7:8) or Deicer (C:N:D=5:3:2)
├─ Haggle: ALWAYS counter first offer
├─ Trade Size: 100-400 units
└─ Style: Strategic negotiator
```

---

## 🎲 Variability Cheat Sheet

```
0.0 - 0.3  →  Predictable NPCs (tight margins, large trades)
0.4 - 0.6  →  Balanced NPCs (recommended)
0.7 - 1.0  →  Chaotic NPCs (wide margins, small trades)
```

---

## ⚡ Quick Integration

```php
// 1. Load factory
require_once 'lib/NPCStrategyFactory.php';

// 2. Set variability (one time)
$db = Database::getInstance();
NPCStrategyFactory::saveVariabilityToConfig($db, 0.5);

// 3. Create strategy for NPC
$strategy = NPCStrategyFactory::createStrategy($storage, $npc, $npcManager);

// 4. Execute
$action = $strategy->decideTrade();
$response = $strategy->respondToNegotiations();
```

---

## 🧪 Recommended Test Setup

```json
{
  "npcs": [
    { "skill": "beginner", "count": 2 },
    { "skill": "novice", "count": 2 },
    { "skill": "expert", "count": 2 }
  ],
  "variability": 0.5,
  "tradingDuration": 300,
  "expectedTrades": "20-50 per session",
  "expectedMutualBenefit": "60-80%"
}
```

---

## 🔍 Log Monitoring

```bash
# Watch for these patterns
grep "NPC.*BUY opportunity" error_log    # Shadow price arbitrage
grep "NPC.*Bottleneck=" error_log        # Bottleneck elimination
grep "NPC.*Specializing" error_log       # Recipe balancing
grep "NPC.*NEVER accept first" error_log # Haggling behavior
```

---

## ✅ Success Criteria

- [ ] All 6 NPCs initialize successfully
- [ ] Shadow prices calculated for each NPC
- [ ] Trades occurring (20+ per session)
- [ ] Mutual benefit rate > 60%
- [ ] No crashes or errors
- [ ] Overall gain for most players
- [ ] Diverse trading patterns observed

---

## 🚨 Troubleshooting

| Problem | Solution |
|---------|----------|
| NPCs not trading | Check shadow prices, ensure marketplace has offers |
| Too many rejections | Increase variability to 0.6+ |
| Not enough trades | Decrease variability to 0.3-0.4 |
| File not found errors | Verify strategy files in lib/strategies/ |
| Null shadow prices | Check LP solver, verify inventory > 0 |

---

## 📖 Full Documentation

- **Complete Strategy Guide**: See [NPC-STRATEGIES.md](NPC-STRATEGIES.md)
- **Implementation Summary**: See [NEW-NPC-SUMMARY.md](../NEW-NPC-SUMMARY.md)
- **Game Guide**: See [GAME-GUIDE.md](../GAME-GUIDE.md)
- **Architecture**: See [GAME-ARCHITECTURE.md](../GAME-ARCHITECTURE.md)
