# CNDQ Automated Testing Guide

This document describes the modular automated testing suite for the CNDQ Chemical Trading Game.

## Overview

The testing suite is now **modularized** with shared helper modules and a main orchestrator:

```
tests/
├── run-tests.js           # Main orchestrator
├── game-simulation.js     # Full game flow testing
├── components.js          # Web component verification
├── accessibility.js       # WCAG compliance testing
└── helpers/               # Shared utilities
    ├── browser.js         # Browser & page management
    ├── session.js         # Session & phase management
    ├── team.js            # Team actions & trading
    └── reporting.js       # Console output formatting
```

## Prerequisites

- Node.js and npm installed
- Local development server running at `http://cndq.test`
- Test users created in the system:
  - `test_mail1@stonybrook.edu`
  - `test_mail2@stonybrook.edu`

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests (sequential)
npm test
npm run test:all

# Run specific test suites
npm run test:game         # Game simulation only
npm run test:components   # Component verification only
npm run test:a11y         # Accessibility testing only

# Run with options
npm run test:headless     # All tests headless (faster)
npm run simulate          # Game simulation with browser visible
```

---

## Architecture

### Modular Design Benefits

- ✅ **Shared helpers** - No code duplication across tests
- ✅ **Single entry point** - All tests through `run-tests.js`
- ✅ **Consistent reporting** - Unified console output
- ✅ **Easy to extend** - Add new tests easily
- ✅ **Better maintainability** - Changes in one place

### Helper Modules

All test scripts use shared helper modules:

- **BrowserHelper** - Launch browser, create pages, handle auth
- **SessionHelper** - Manage game sessions and phases
- **TeamHelper** - Team actions, trading, negotiations
- **ReportingHelper** - Consistent console formatting

See [`tests/README.md`](tests/README.md) for detailed helper documentation.

---

## 1. Game Simulation Testing

**Script**: `tests/game-simulation.js`
**Command**: `npm run test:game` or `npm run simulate`
**Duration**: ~5-10 minutes
**Teams**: 2
**Sessions**: 3

### What It Tests

This comprehensive end-to-end test simulates the complete game flow with 2 teams through 3 sessions:

#### Trading Phase ✅
- Advertisement posting (buy/sell) based on shadow prices
- Negotiation initiation between teams
- Negotiation responses (accept/counter/reject)
- Intelligent decision-making based on shadow prices
- Leaderboard updates during trading

#### Production Phase ✅
- Automatic production based on inventory
- Phase transitions (trading → production → trading)

#### Session Management ✅
- Auto-advance configuration
- Multi-session progression (3 sessions)
- Session state persistence

### How It Works

1. **Enables Auto-Advance**
   - Logs in as admin
   - Opens admin panel
   - Enables auto-advance for automated phase transitions

2. **For Each Session (3 total):**
   - **Trading Phase:**
     - Each team logs in
     - Reads shadow prices to determine needs
     - Posts advertisements (buy if shadow price > $2, sell if < $1)
     - Initiates negotiations with other teams
     - Responds to incoming negotiations (70% accept rate, 30% counter/reject)
     - Displays leaderboard
   - **Production Phase:**
     - Waits for auto-advance to production
     - Waits for auto-advance back to trading

3. **Final Results**
   - Displays final leaderboard with rankings
   - Shows ROI for each team
   - Keeps browser open for manual inspection

### Configuration

Edit `tests/run-tests.js` CONFIG object to customize all tests:

```javascript
const CONFIG = {
    baseUrl: 'http://cndq.test',
    teams: [
        'test_mail1@stonybrook.edu',
        'test_mail2@stonybrook.edu'
    ],
    targetSessions: 3,
    headless: false,
    verbose: false,

    // Accessibility settings
    wcagLevel: 'AA',
    themes: ['dark', 'light', 'high-contrast'],
    pages: [
        { name: 'Main Page', url: '/index.html' },
        { name: 'Admin Page', url: '/admin.html' }
    ]
};
```

### Sample Output

```
🎮 Starting CNDQ Game Simulation...

📋 Step 1: Enabling auto-advance...
   ✓ Auto-advance enabled

📋 Step 2: Starting multi-session gameplay...
   Starting at session 1
   Target: 3 sessions

🎯 Session 1 - TRADING
────────────────────────────────────────────────────────────

📢 Teams posting advertisements...
   Team Alpha:
      📥 Wants to BUY C (shadow: $3.50)
      📤 Wants to SELL Q (shadow: $0.75)
   Team Beta:
      📥 Wants to BUY N (shadow: $4.20)

💼 Teams initiating negotiations...
   Team Alpha → Negotiating to BUY C from Team Beta
   Team Beta → Negotiating to SELL C to Team Alpha

💬 Teams responding to negotiations...
   Team Beta → ✓ ACCEPTED offer for C (25 gal @ $2.80)
   Team Alpha → 🔄 COUNTER-OFFER for N (20 gal @ $3.50)

📊 Leaderboard - Session 1:
   🥇 #1 Team Beta           - $   1250.50 (+25.1%)
   🥈 #2 Team Alpha          - $   1180.25 (+18.0%)

⏳ Waiting for trading phase to end...
   ✓ Phase changed to production

🎯 Session 1 - PRODUCTION
────────────────────────────────────────────────────────────
   ⚙️  Production running automatically...
   ✓ Phase changed to trading

[... sessions 2 and 3 ...]

🏁 Completed 3 sessions!

============================================================
FINAL RESULTS
============================================================

📊 Leaderboard - Session 3:
   🥇 #1 Team Beta           - $   2450.75 (+145.1%)
   🥈 #2 Team Alpha          - $   2280.50 (+128.0%)

✅ Simulation complete!

📋 Full Game Flow Tested:
   ✓ Auto-advance enabled
   ✓ Advertisement posting (buy/sell based on shadow prices)
   ✓ Negotiation initiation
   ✓ Negotiation responses (accept/counter/reject)
   ✓ Trading phase completion
   ✓ Production phase (automatic)
   ✓ Session transitions
   ✓ Leaderboard updates
   ✓ 3 complete sessions with 2 teams

📊 View detailed results at: http://cndq.test/index.html

🔍 Browser kept open for inspection. Close manually when done.
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Teams can't log in | Ensure dev_login.php is accessible and test users exist |
| Web components not found | Check index.html loads properly and JS modules work |
| Phase doesn't change | Verify auto-advance is working and check session timers |
| Negotiations fail | Check negotiation API endpoints and database tables |

---

## 2. Component Testing

**Script**: `tests/components.js`
**Command**: `npm run test:components`
**Duration**: ~10 seconds

### What It Tests

Development/debugging tool that verifies web components load correctly:

- ✅ Chemical-card custom elements exist
- ✅ Shadow DOM is properly attached
- ✅ Shadow prices are accessible
- ✅ Buttons are clickable
- ✅ API module is loaded
- ✅ MarketplaceApp is initialized

### Sample Output

```
Testing web components and API...

1. Logging in...
2. Loading main page...

3. Checking if chemical-card web components exist...
   Found 4 chemical-card elements

4. Checking shadow DOM...
   Chemical C card: { exists: true, hasShadowRoot: true, shadowRootMode: 'open' }

5. Testing shadow price access...
   Chemical C shadow price: $2.50

6. Testing button click (Post Sell Interest for C)...
   Button clicked: true

7. Checking if API module is available...
   API Status: { marketplaceAppExists: true, windowHasApi: true }

✅ Component test complete! Check browser for visual inspection.
   Press Ctrl+C to close when done.
```

### Use Cases

- Debugging web component issues
- Verifying DOM structure after changes
- Testing shadow DOM accessibility
- Quick visual inspection of UI

---

## 3. Accessibility Testing

**Script**: `tests/accessibility.js`
**Command**: `npm run test:a11y`
**Duration**: ~30 seconds

### What It Tests

Comprehensive WCAG 2.1 Level AA compliance testing:

- ✅ All pages (index.html, admin.html)
- ✅ All themes (dark, light, high-contrast)
- ✅ 90+ accessibility rules
- ✅ Color contrast (4.5:1 for normal text, 3:1 for large)
- ✅ Keyboard navigation
- ✅ ARIA attributes and labels
- ✅ Form labels and associations
- ✅ Semantic HTML structure

See [ACCESSIBILITY.md](./ACCESSIBILITY.md) for detailed documentation.

### Sample Output

```
================================================================================
  WCAG 2.1 Accessibility Testing
================================================================================

ℹ Testing WCAG Level: AA
ℹ Base URL: http://localhost:8080
ℹ Testing 2 page(s) with 3 theme(s)

ℹ Testing: Main Page
ℹ Testing: Main Page (dark theme)
ℹ Testing: Main Page (light theme)
ℹ Testing: Main Page (high-contrast theme)

────────────────────────────────────────────────────────────────────────────────
Main Page (dark theme)
────────────────────────────────────────────────────────────────────────────────
✓ No accessibility violations found!

────────────────────────────────────────────────────────────────────────────────
Main Page (light theme)
────────────────────────────────────────────────────────────────────────────────
✗ Found 2 violation type(s)

  [MODERATE] color-contrast
  Elements must have sufficient color contrast
  Affected elements: 3
  https://dequeuniversity.com/rules/axe/4.11/color-contrast

================================================================================
  Test Summary
================================================================================
Pages tested: 8
Total violations: 5

  Critical:  0
  Serious:   0
  Moderate:  3
  Minor:     2

✓ JSON report saved: ./accessibility-reports/accessibility-report-2025-12-28T....json
✓ HTML report saved: ./accessibility-reports/accessibility-report-2025-12-28T....html

⚠ Tests completed with 5 violation(s). Please review the reports.
```

### Generated Reports

After each run, find reports in `./accessibility-reports/`:

1. **JSON Report** - Machine-readable for CI/CD
2. **HTML Report** - Human-readable, open in browser for detailed view

---

## Test Maintenance

### Changing Number of Teams

Edit `tests/run-tests.js`:
```javascript
const CONFIG = {
    teams: [
        'test_mail1@stonybrook.edu',
        'test_mail2@stonybrook.edu',
        'test_mail3@stonybrook.edu'  // Add 3rd team
    ],
    // ...
};
```

### Changing Number of Sessions

Edit `tests/run-tests.js`:
```javascript
const CONFIG = {
    targetSessions: 5,  // Was 3
    // ...
};
```

### Adjusting Trading Behavior

Edit `tests/game-simulation.js`:

**More aggressive buying:**
```javascript
// In allTeamsAdvertise() method
if (shadowPrice > 1.5) {  // Was 2
    await this.team.postAdvertisement(page, chemical, 'buy');
}
```

**Higher acceptance rate:**
```javascript
// In allTeamsRespondToNegotiations() method
const response = await this.team.respondToNegotiations(page, shadowPrices, 0.9);  // Was 0.7
```

### Running Headless

Use command-line flag:
```bash
npm run test:headless
```

Or edit `tests/run-tests.js`:
```javascript
const CONFIG = {
    headless: true,  // Was false
    // ...
};
```

### Adding Pages to Test

Edit `tests/run-tests.js`:
```javascript
const CONFIG = {
    pages: [
        { name: 'Main Page', url: '/index.html' },
        { name: 'Admin Page', url: '/admin.html' },
        { name: 'New Page', url: '/new.html' }  // Add here
    ],
    // ...
};
```

### Creating New Tests

See [`tests/README.md`](tests/README.md) for detailed instructions on adding new test modules.

---

## Continuous Integration

### GitHub Actions Example

```yaml
name: CNDQ Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Start server
        run: |
          # Start your dev server
          npm start &
          sleep 5

      - name: Run component tests
        run: npm run test:components

      - name: Run accessibility tests
        run: npm run test:a11y
        continue-on-error: true

      - name: Run game simulation
        run: npm run simulate
        timeout-minutes: 15

      - name: Upload reports
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: accessibility-reports/
```

---

## Best Practices

### Before Committing
```bash
npm run test:a11y  # Quick accessibility check
```

### Before Pull Requests
```bash
npm run test:all   # Full test suite
```

### After UI Changes
```bash
npm run test:a11y:verbose  # Detailed accessibility review
npm run test:components    # Verify components still work
```

### After API Changes
```bash
npm run simulate  # Ensure full game flow works
```

### During Development
- Set `headless: false` to watch browser
- Keep browser open to inspect results
- Use Chrome DevTools during tests

---

## Troubleshooting

### General Issues

**Tests hang or timeout**
- Check server is running at correct URL
- Increase timeout values in test scripts
- Look for JavaScript errors in browser console

**Browser won't launch**
- Run `npm install` to ensure Puppeteer is installed
- On Linux: Install Chrome dependencies
  ```bash
  sudo apt-get install -y chromium-browser
  ```

**Authentication fails**
- Verify `dev_login.php` works manually
- Check test user emails exist in database
- Ensure PHP session handling is working

### Platform-Specific

**Windows**
- Use forward slashes in URLs
- May need to escape backslashes in file paths

**Linux**
- Install Chrome/Chromium:
  ```bash
  sudo apt-get install google-chrome-stable
  ```

**macOS**
- Approve Puppeteer in Security & Privacy settings
- Use `open` command to view HTML reports:
  ```bash
  open accessibility-reports/*.html
  ```

---

## Summary

| Test | Command | Teams | Sessions | Duration | Purpose |
|------|---------|-------|----------|----------|---------|
| All Tests | `npm test` or `npm run test:all` | - | - | 6-11 min | Complete validation |
| Game Simulation | `npm run test:game` | 2 | 3 | 5-10 min | Full gameplay testing |
| Components | `npm run test:components` | 1 | - | 10 sec | Web component verification |
| Accessibility | `npm run test:a11y` | - | - | 30 sec | WCAG compliance |
| Headless Mode | `npm run test:headless` | - | - | 5-9 min | Fast CI/CD testing |

### File Structure

```
tests/
├── run-tests.js           # Single entry point ⭐
├── game-simulation.js     # Refactored with helpers
├── components.js          # Refactored with helpers
├── accessibility.js       # Refactored with helpers
└── helpers/               # Shared modules
    ├── browser.js
    ├── session.js
    ├── team.js
    └── reporting.js

old-tests/                 # Archived original files
```

### Recommended Workflow

1. **During development**: `npm run test:components` (quick feedback)
2. **Before committing**: `npm run test:a11y` (ensure accessibility)
3. **Before releases**: `npm run test:all` (complete validation)
4. **After major changes**: `npm run simulate` (verify game flow)

---

## Resources

- [Puppeteer Documentation](https://pptr.dev/)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Accessibility Testing Guide](./ACCESSIBILITY.md)
- [Manual Testing Guide](./TESTING.md)
