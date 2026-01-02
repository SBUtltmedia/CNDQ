# CNDQ Puppeteer Tests

Comprehensive UI testing suite for CNDQ (Chemical Negotiation & Distribution Quest).

## Test Suite

All tests use **pure UI interactions** - no API workarounds, no cookie manipulation, no cron scripts.

### Available Tests

| Test | Description | Duration |
|------|-------------|----------|
| **rpc-to-rpc-test.js** | Full game simulation with 2 real teams trading with each other. Tests advertisement posting, RPC-to-RPC negotiations, accepts/counters/rejects, auto-advance, and session transitions. | ~5-10 min |
| **haggle-test.js** | Player posts ad, NPC responds, player haggles with sliders, accepts deal. Tests NPC interaction and haggling UI. | ~1-2 min |
| **auto-advance-test.js** | Tests auto-advance functionality: game progresses from trading → production → next session automatically based on timers. | ~30-60 sec |
| **visual-test.js** | Quick UI verification - tests layout, spacing, responsive utilities, border utilities. Takes screenshot. | ~10 sec |

### Running Tests

**Option 1: With Real-Time Logging (Recommended)**
```bash
node tests/helpers/test-runner.js tests/rpc-to-rpc-test.js
node tests/helpers/test-runner.js tests/haggle-test.js
node tests/helpers/test-runner.js tests/auto-advance-test.js
```

**Option 2: Direct Execution**
```bash
node tests/rpc-to-rpc-test.js
node tests/haggle-test.js
node tests/auto-advance-test.js
```

### Test Output

All tests automatically log to `puppeteer.out` in the CNDQ root directory. The file is **cleared on each test run** to keep it token-efficient for AI analysis.

**If a test fails early:**
1. Press Ctrl+C to interrupt
2. Output is preserved in `puppeteer.out`
3. Tell AI: "Look at puppeteer.out and analyze what went wrong"

### Architecture

**NPCs and Client Polling:**
- NPCs are automatically processed when ANY client polls the server (every 3 seconds)
- SessionManager processes NPCs at most once every 10 seconds (throttled)
- No cron required - "set it and forget it" works perfectly

**Pure UI Testing:**
- All authentication via dev_login.php (click links)
- All admin actions via UI buttons/forms
- All data read from UI elements (no direct API calls)

## Test Coverage

✅ RPC ↔ RPC trading  
✅ RPC ↔ NPC trading  
✅ Auto-advance  
✅ Visual/UI rendering
