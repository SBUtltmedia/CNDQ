# Dual Testing Framework - UI vs API

Complete guide for testing CNDQ using both UI interactions and direct API calls.

## Overview

This framework provides **three complementary testing approaches**:

1. **UI-Only Testing** - Tests through user interface (clicks, forms, etc.)
2. **API-Only Testing** - Tests via direct API calls
3. **Dual Testing** - Runs both and compares results

## Why Dual Testing?

### UI Testing Benefits
- ✅ Tests actual user experience
- ✅ Catches UI bugs and UX issues
- ✅ Validates that UI triggers correct APIs
- ✅ Monitors what API calls the UI makes

### API Testing Benefits
- ✅ Faster execution (no UI rendering)
- ✅ More reliable (no UI timing issues)
- ✅ Tests API independently of UI
- ✅ Better for CI/CD pipelines

### Dual Testing Benefits
- ✅ Ensures UI and API stay in sync
- ✅ Identifies endpoints not exposed in UI
- ✅ Validates API responses match UI expectations
- ✅ Comprehensive coverage

## Quick Start

```bash
# UI-only playability test
npm run test:ui-play

# API-only playability test
npm run test:api-play

# Run both and compare (RECOMMENDED)
npm run test:dual

# Headless mode
npm run test:dual:headless
```

## Test Files

```
tests/
├── ui-playability-test.js      # UI-only test
├── api-playability-test.js     # API-only test
├── dual-playability-test.js    # Comparison test
└── DUAL_TESTING.md             # This file
```

## UI Playability Test

**File**: [ui-playability-test.js](ui-playability-test.js)

### What It Does

Simulates real users playing the game through the UI:

1. **Admin Setup** (via UI)
   - Click "Reset Game" button
   - Click "Start Game" button
   - Set trading duration

2. **Player Actions** (via UI)
   - Post advertisements (click button, fill form)
   - Create sell offers (click, fill, submit)
   - View marketplace (click tab)
   - Respond to negotiations (click accept/reject)
   - Check production results

3. **API Monitoring**
   - Intercepts all `fetch()` calls
   - Logs every API request/response
   - Tracks which endpoints UI triggers

### Usage

```bash
# Run UI test
node tests/ui-playability-test.js

# With options
node tests/ui-playability-test.js --headless
node tests/ui-playability-test.js --verbose
node tests/ui-playability-test.js --keep-open
```

### Output

```
🎮 UI Playability Test
============================================================

🛡️  ADMIN SETUP
------------------------------------------------------------
   📋 Resetting game...
   ✅ Game reset
   🎬 Starting game...
   ✅ Game started
   📡 API calls captured: 3

🎮 SESSION 1
------------------------------------------------------------

   👤 test_mail1 taking actions...
      📢 Posting advertisement...
      ✅ Advertisement posted
      💰 Creating sell offer...
      ✅ Sell offer created
      🏪 Viewing marketplace...
      ✅ Marketplace viewed
      📡 API calls: 8
      ✅ test_mail1 completed 5 actions

...

📊 TEST RESULTS
============================================================
UI Actions Performed: 45
API Calls Captured: 127
Errors: 0
Warnings: 0
============================================================

📡 API CALL SUMMARY:
  42x  /api/marketplace/offers
  28x  /api/session/status
  15x  /api/offers/create
  12x  /api/advertisements/post
  ...

   📄 Detailed log written to: api-call-log-1704567890123.json
```

### API Call Monitoring

The UI test monitors all API calls by:

1. Intercepting `fetch()` before page loads
2. Logging each call to `window.__apiCalls`
3. Tracking responses via page event listeners
4. Exporting full log to JSON file

**Access API calls made by a page:**

```javascript
const apiCalls = await page.evaluate(() => window.__apiCalls || []);
console.log('API calls:', apiCalls);
```

## API Playability Test

**File**: [api-playability-test.js](api-playability-test.js)

### What It Does

Performs the same game flow using **only** direct API calls:

1. **Admin Setup** (via API)
   - POST /api/admin/reset-game
   - POST /api/admin/session (action: start)
   - POST /api/admin/session (setAutoAdvance)

2. **Player Actions** (via API)
   - POST /api/advertisements/post
   - POST /api/offers/create
   - POST /api/offers/bid
   - GET /api/marketplace/offers
   - GET /api/negotiations/list
   - POST /api/negotiations/accept
   - GET /api/production/shadow-prices
   - GET /api/notifications/list

3. **Session Management** (via API)
   - POST /api/admin/session (action: advance)
   - GET /api/leaderboard/standings

### Usage

```bash
# Run API test
node tests/api-playability-test.js

# With options
node tests/api-playability-test.js --headless
node tests/api-playability-test.js --verbose
```

### Output

```
🔌 API Playability Test
============================================================

🛡️  ADMIN SETUP (API)
------------------------------------------------------------
   📋 Resetting game...
      ✅ POST /api/admin/reset-game (200)
   ✅ Game reset
   🎬 Starting game...
      ✅ POST /api/admin/session (200)
   ✅ Game started
   📡 Admin setup API calls: 3

🎮 SESSION 1 (API)
------------------------------------------------------------
   📊 Current session: 1, Phase: TRADING

   👤 test_mail1 taking actions (API)...
      📢 Posting advertisement...
      ✅ POST /api/advertisements/post (200)
      ✅ Advertisement posted
      💰 Creating sell offer...
      ✅ POST /api/offers/create (200)
      ✅ Sell offer created
      ...
      ✅ test_mail1 completed 7 API calls

...

📊 TEST RESULTS
============================================================
Total API Calls: 89
✅ Successful: 82 (92%)
❌ Failed: 7
⚠️  Warnings: 0
🚨 Errors: 0
============================================================

📡 API ENDPOINT SUMMARY:
  28x  GET /api/marketplace/offers            (100% success)
  21x  POST /api/offers/create                (85% success)
  14x  GET /api/session/status                (100% success)
  ...

   📄 Detailed log written to: api-playability-log-1704567890456.json
```

## Dual Testing (Comparison)

**File**: [dual-playability-test.js](dual-playability-test.js)

### What It Does

Runs **both** UI and API tests, then compares:

- Number of actions vs API calls
- Which endpoints each test touched
- Success/failure rates
- Endpoint coverage gaps

### Usage

```bash
# Run both tests and compare
npm run test:dual

# Options
npm run test:dual:headless

# Run only one part
node tests/dual-playability-test.js --ui-only
node tests/dual-playability-test.js --api-only
```

### Output

```
🔀 DUAL PLAYABILITY TEST - UI vs API
============================================================

████████████████████████████████████████████████████████████████████████████████
█                                                                              █
█  PART 1: UI-BASED TEST                                                      █
█                                                                              █
████████████████████████████████████████████████████████████████████████████████

[... UI test runs ...]

⏸️  Waiting 5 seconds before API test...

████████████████████████████████████████████████████████████████████████████████
█                                                                              █
█  PART 2: API-BASED TEST                                                     █
█                                                                              █
████████████████████████████████████████████████████████████████████████████████

[... API test runs ...]

████████████████████████████████████████████████████████████████████████████████
█                                                                              █
█  COMPARISON REPORT                                                          █
█                                                                              █
████████████████████████████████████████████████████████████████████████████████

📊 STATISTICS COMPARISON:
------------------------------------------------------------
UI Actions Performed:        45
UI - API Calls Captured:     127
API - Direct API Calls:      89
API - Successful Calls:      82 (92%)
API - Failed Calls:          7
------------------------------------------------------------

🚨 ERROR COMPARISON:
------------------------------------------------------------
UI Test Errors:   0
API Test Errors:  0
✅ Both tests completed without errors!
------------------------------------------------------------

📡 API ENDPOINT COVERAGE:
------------------------------------------------------------
UI touched 18 unique endpoints
API tested 22 unique endpoints

⚠️  Endpoints tested by API but not triggered by UI:
   - /api/notifications/list
   - /api/production/shadow-prices
   - /api/leaderboard/standings
   - /api/team/settings

   💡 Consider adding UI elements to trigger these endpoints.

✅ 18 endpoints tested by both UI and API
------------------------------------------------------------

🔢 API CALL FREQUENCY (Common Endpoints):
------------------------------------------------------------
   ✅ /api/marketplace/offers: UI 42x, API 28x
   ⚠️  /api/offers/create
       UI: 15x, API: 21x (28% difference)
   ✅ /api/session/status: UI 28x, API 14x
   ...
------------------------------------------------------------

🎯 OVERALL VERDICT:
============================================================
✅ EXCELLENT - Both UI and API tests passed successfully!
   - No errors detected
   - High API success rate
   - Good endpoint coverage
============================================================

📄 Full comparison report written to: dual-test-report-1704567890789.json
```

## Comparison Report

The dual test generates a JSON report with detailed comparison data.

### Report Structure

```json
{
  "timestamp": "2026-01-05T19:30:00.000Z",
  "uiResults": {
    "uiActions": 45,
    "apiCallsCaptured": 127,
    "errors": [],
    "warnings": [],
    "apiCallLog": [...]
  },
  "apiResults": {
    "apiCalls": 89,
    "successful": 82,
    "failed": 7,
    "errors": [],
    "warnings": [],
    "apiCallLog": [...]
  },
  "comparison": {
    "commonEndpoints": 18,
    "apiOnlyEndpoints": 4,
    "uiEndpointsCovered": 18,
    "apiEndpointsTested": 22,
    "totalErrors": 0,
    "totalWarnings": 0
  }
}
```

## Interpreting Results

### ✅ Good Results

- Both tests have 0 errors
- API success rate > 90%
- Common endpoints > 70% of total
- UI triggers most major endpoints

### ⚠️ Needs Attention

- **API-only endpoints**: UI doesn't expose these features
  - Add UI buttons/tabs to trigger them
  - Or mark as internal-only endpoints

- **High API failure rate**: Some endpoints broken
  - Check API logs for specific errors
  - Fix validation or permission issues

- **Call frequency differences**: UI calling wrong amount
  - UI might be over-fetching (bad UX)
  - Or under-fetching (stale data)

### ❌ Problems

- Errors in either test
- API success rate < 70%
- UI covers < 50% of endpoints
- Critical endpoints not working

## Advanced Usage

### Custom Configuration

Edit CONFIG in the test files:

```javascript
const CONFIG = {
    baseUrl: 'http://cndq.test/CNDQ',
    adminUser: 'admin@stonybrook.edu',
    testUsers: [
        'test_mail1@stonybrook.edu',
        'test_mail2@stonybrook.edu',
        'test_mail3@stonybrook.edu'
    ],
    targetSessions: 2,  // Number of game sessions to play
    headless: false,
    verbose: true
};
```

### Adding New UI Actions

In [ui-playability-test.js](ui-playability-test.js), add to `playerTakesActions()`:

```javascript
// Action: Do something new
console.log('      🆕 New action...');
this.results.uiActions++;

const button = await page.$('[data-action="new-action"]');
if (button) {
    await button.click();
    await this.browser.sleep(1000);
    console.log('      ✅ New action completed');
}
```

### Adding New API Actions

In [api-playability-test.js](api-playability-test.js), add to `playerTakesActionsViaAPI()`:

```javascript
// Action: Call new endpoint
console.log('      🆕 Calling new API...');
actionsCount++;

const response = await api.someNewEndpoint();
this.logApiCall('GET', '/api/new/endpoint', {}, response);

if (response.ok) {
    console.log('      ✅ API call successful');
}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Dual Playability Tests

on: [push, pull_request]

jobs:
  dual-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run dual test
        run: npm run test:dual:headless

      - name: Upload test reports
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: |
            dual-test-report-*.json
            api-call-log-*.json
            api-playability-log-*.json
```

## Troubleshooting

### UI test can't find elements

The UI might have changed. Update selectors in `ui-playability-test.js`:

```javascript
// Old selector
await page.click('#old-button-id');

// New selector
await page.click('[data-action="create-offer"]');
```

### API test getting 401 errors

Authentication issue. Verify:
1. dev.php is accessible
2. Cookies are being set
3. Session is active

```javascript
const cookies = await page.cookies();
console.log('Cookies:', cookies);
```

### Comparison shows many differences

This could be normal:
- UI makes more calls (polling, re-fetching)
- API tests each endpoint thoroughly
- Look for *major* discrepancies (>50% difference)

## Best Practices

1. **Run dual test regularly** - Catches UI/API drift early
2. **Fix API-only endpoints** - Add UI or document as internal
3. **Monitor success rates** - Should stay > 90%
4. **Keep tests in sync** - When adding features, update both tests
5. **Review comparison reports** - Look for patterns over time

## Related Documentation

- [API Testing Guide](API_TESTING.md) - Detailed API testing docs
- [Test Suite README](README.md) - Overview of all tests
- [API Documentation](../docs/API.md) - Complete API reference

## Summary

The dual testing framework gives you:

- **UI Test**: Validates user experience and UI behavior
- **API Test**: Validates API functionality independently
- **Comparison**: Ensures they stay in sync

Run `npm run test:dual` regularly to maintain quality! 🚀
