# CNDQ API Testing Guide

Complete guide for testing all CNDQ API endpoints using Puppeteer.

## Quick Start

```bash
# Run all API tests (visible browser)
npm run test:api

# Run in headless mode (faster)
npm run test:api:headless

# Run with verbose output
npm run test:api:verbose
```

## API Test Suite

The API test suite ([api-tests.js](api-tests.js)) comprehensively tests all CNDQ API endpoints.

### What Gets Tested

✅ **54+ Test Cases** covering:

- **Session Management** (3 tests)
  - GET /api/session/status (public & authenticated)
  - POST /api/session/status

- **Marketplace** (4 tests)
  - GET /api/marketplace/offers
  - Chemical filtering
  - Authentication requirements

- **Offers & Buy Orders** (5 tests)
  - Create, cancel offers
  - Validation (invalid data, missing fields)

- **Negotiations** (5 tests)
  - List, initiate, accept, counter, reject
  - Edge cases (self-negotiation, invalid chemicals)

- **Advertisements** (4 tests)
  - List, post, view my ads
  - Validation

- **Notifications** (1 test)
- **Production** (2 tests)
- **Leaderboard** (1 test)
- **Team Settings** (2 tests)
- **Admin Endpoints** (6 tests)
  - Session control
  - NPC management
  - Authorization checks

### Example Output

```
🧪 CNDQ API Test Suite
============================================================
Base URL: http://cndq.test/CNDQ
Mode: Visible
============================================================

📡 Testing Session Endpoints
------------------------------------------------------------
[1/54] GET /api/session/status (public) ... ✅ PASS
[2/54] GET /api/session/status (authenticated) ... ✅ PASS
[3/54] POST /api/session/status (acknowledge production) ... ✅ PASS

🏪 Testing Marketplace Endpoints
------------------------------------------------------------
[4/54] GET /api/marketplace/offers ... ✅ PASS
[5/54] GET /api/marketplace/offers?chemical=C ... ✅ PASS
...

============================================================
📊 Test Summary
============================================================
Total Tests:  54
✅ Passed:     54 (100%)
❌ Failed:     0
⏭️  Skipped:    0
============================================================
```

## Using the API Client

The [ApiClient](helpers/api-client.js) helper makes API testing easy:

```javascript
const ApiClient = require('./helpers/api-client');
const BrowserHelper = require('./helpers/browser');

// Setup
const browser = new BrowserHelper(config);
await browser.launch();

// Login and get a page with session
const page = await browser.loginAndNavigate('test@example.com', '');

// Create API client
const api = new ApiClient(page, 'http://cndq.test/CNDQ');

// Make requests (session cookies included automatically!)
const session = await api.getSessionStatus();
const offers = await api.getMarketplaceOffers();
const result = await api.createOffer('C', 100, 5.0);

// Assertions
api.assertSuccess(response);
api.assertStatus(response, 200);
api.assertData(response, 'success', true);

// Cleanup
await page.close();
await browser.close();
```

## All API Methods

### Session
```javascript
await api.getSessionStatus()
await api.acknowledgeProduction()
```

### Marketplace
```javascript
await api.getMarketplaceOffers()
await api.getMarketplaceOffers('C')      // Filter by chemical
await api.getMarketplaceOffers('C,N,D')  // Multiple chemicals
```

### Offers
```javascript
await api.createOffer('C', 100, 5.0)
await api.createBuyOrder('N', 50, 10.0)
await api.cancelOffer('offer-id-123')
```

### Negotiations
```javascript
await api.listNegotiations()
await api.initiateNegotiation(
    'other-team@example.com',
    'C',    // chemical
    100,    // quantity
    5.50,   // price
    'buy'   // type: 'buy' or 'sell'
)
await api.acceptNegotiation('negotiation-id')
await api.counterNegotiation('negotiation-id', 90, 6.0)
await api.rejectNegotiation('negotiation-id')
await api.reactToNegotiation('negotiation-id', '👍')
```

### Advertisements
```javascript
await api.listAdvertisements()
await api.getMyAdvertisements()
await api.postAdvertisement('C', 'sell', 'Great prices on Carbon!')
```

### Notifications, Production, Leaderboard
```javascript
await api.listNotifications()
await api.getProductionResults()
await api.getShadowPrices()
await api.getLeaderboard()
```

### Team Settings
```javascript
await api.getTeamSettings()
await api.updateTeamSettings({ teamName: 'New Team Name' })
```

### Admin
```javascript
await api.getAdminSession()
await api.startGame()
await api.stopGame()
await api.advanceSession()
await api.setAutoAdvance(true, 300)  // 300 seconds
await api.resetGame()

await api.listNPCs()
await api.createNPC('Bot Team Alpha')
await api.deleteNPC('npc-id')
await api.toggleNPC('npc-id', true)
await api.toggleNPCSystem(true)
```

### Low-Level Methods
```javascript
// Generic request
await api.request('POST', 'custom/endpoint', { data: 'value' })

// Convenience methods
await api.get('endpoint')
await api.post('endpoint', { body: 'data' })
await api.put('endpoint', { body: 'data' })
await api.delete('endpoint')
```

## Writing Tests

### Basic Test Structure

```javascript
await this.test('Test name', async () => {
    // 1. Setup - login and create page
    const page = await this.browser.loginAndNavigate(
        this.config.testUsers[0],
        ''
    );
    const api = new ApiClient(page, this.config.baseUrl);

    // 2. Make API request
    const response = await api.getSomeEndpoint();

    // 3. Assert response
    api.assertSuccess(response);
    api.assertData(response, 'fieldName', 'expectedValue');

    // 4. Cleanup
    await page.close();
});
```

### Testing Success Cases

```javascript
await this.test('POST /api/offers/create (valid)', async () => {
    const page = await this.browser.loginAndNavigate(user, '');
    const api = new ApiClient(page, this.config.baseUrl);

    // Check phase first
    const status = await api.getSessionStatus();
    if (status.data.phase !== 'TRADING') {
        throw new Error('SKIPPED: Not in trading phase');
    }

    const response = await api.createOffer('C', 10, 5.0);

    // Handle possible insufficient inventory
    if (response.status === 400 &&
        response.data.error === 'Insufficient inventory') {
        return; // Test passes - acceptable outcome
    }

    // Otherwise expect success
    api.assertSuccess(response);
    api.assertData(response, 'offer');

    await page.close();
});
```

### Testing Error Cases

```javascript
await this.test('POST /api/offers/create (invalid chemical)', async () => {
    const page = await this.browser.loginAndNavigate(user, '');
    const api = new ApiClient(page, this.config.baseUrl);

    const response = await api.createOffer('INVALID', 10, 5.0);

    // Should return 400 Bad Request
    api.assertStatus(response, 400);

    await page.close();
});
```

### Testing Authentication

```javascript
await this.test('GET /api/offers (unauthenticated)', async () => {
    // Don't login - just create a page
    const page = await this.browser.newPage();
    await page.goto(this.config.baseUrl, { waitUntil: 'networkidle2' });

    const api = new ApiClient(page, this.config.baseUrl);
    const response = await api.getMarketplaceOffers();

    // Should return 401 Unauthorized
    api.assertStatus(response, 401);

    await page.close();
});
```

### Testing Authorization

```javascript
await this.test('GET /api/admin/session (as regular user)', async () => {
    // Login as regular user, not admin
    const page = await this.browser.loginAndNavigate(
        this.config.testUsers[0],  // NOT admin
        ''
    );
    const api = new ApiClient(page, this.config.baseUrl);

    const response = await api.getAdminSession();

    // Should return 403 Forbidden
    api.assertStatus(response, 403);

    await page.close();
});
```

## Configuration

Edit CONFIG in [api-tests.js](api-tests.js):

```javascript
const CONFIG = {
    baseUrl: 'http://cndq.test/CNDQ',
    adminUser: 'admin@stonybrook.edu',
    testUsers: [
        'test_mail1@stonybrook.edu',
        'test_mail2@stonybrook.edu',
        'test_mail3@stonybrook.edu'
    ],
    headless: false,
    verbose: true,
    keepOpen: false
};
```

## Command Line Options

```bash
# Headless mode
node tests/api-tests.js --headless

# Verbose output (show browser console)
node tests/api-tests.js --verbose

# Keep browser open after tests
node tests/api-tests.js --keep-open

# Combine options
node tests/api-tests.js --headless --verbose
```

## Assertion Methods

```javascript
// Assert successful response (status 200-299)
api.assertSuccess(response);

// Assert specific status code
api.assertStatus(response, 401);
api.assertStatus(response, 403, 'Should be forbidden');

// Assert response data contains key
api.assertData(response, 'success');

// Assert response data has specific value
api.assertData(response, 'success', true);
api.assertData(response, 'phase', 'TRADING');

// Debug - log response
api.logResponse(response, 'My API Call');
```

## Troubleshooting

### "Not authenticated" errors

1. Verify dev.php works:
   - Visit http://cndq.test/CNDQ/dev.php
   - Check user links appear
   - Click a link and verify cookie is set

2. Check browser helper login:
   ```javascript
   const page = await browser.loginAndNavigate(email, '');
   const cookies = await page.cookies();
   console.log('Cookies:', cookies);
   ```

### Tests timeout

Increase timeouts:
```javascript
await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 60000  // 60 seconds
});
```

### "Phase not TRADING" errors

Some tests require TRADING phase. Use admin controls to start trading:
```javascript
const adminPage = await browser.loginAndNavigate(adminUser, 'admin/');
const adminApi = new ApiClient(adminPage, baseUrl);
await adminApi.startGame();
await adminPage.close();
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: API Tests

on: [push, pull_request]

jobs:
  api-tests:
    runs-on: ubuntu-latest

    services:
      # Add PHP/MySQL if needed
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: cndq_test

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Install Chromium dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y chromium-browser

      - name: Run API tests
        run: npm run test:api:headless
        env:
          BASE_URL: http://localhost/CNDQ

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

## Related Documentation

- **[Main Tests README](README.md)** - Overview of all tests
- **[API Documentation](../docs/API.md)** - Complete API reference
- **[OpenAPI Spec](../docs/openapi.yaml)** - Machine-readable spec
- **[Swagger UI](../api-docs.php)** - Interactive API docs

## Files

```
tests/
├── api-tests.js              # Main API test suite ← START HERE
├── helpers/
│   ├── api-client.js        # API request helper
│   ├── browser.js           # Browser/login helper
│   └── ...
├── API_TESTING.md           # This file
└── README.md                # Main test docs
```
