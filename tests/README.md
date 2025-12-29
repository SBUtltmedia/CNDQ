# CNDQ Tests

Modular testing suite for the CNDQ Chemical Trading Game.

## Directory Structure

```
tests/
├── run-tests.js           # Main test orchestrator
├── game-simulation.js     # Full game flow testing (2 teams, 3 sessions)
├── components.js          # Web component verification
├── accessibility.js       # WCAG 2.1 compliance testing
├── helpers/               # Shared utilities
│   ├── browser.js         # Browser & page management
│   ├── session.js         # Session & phase management
│   ├── team.js            # Team actions & trading
│   └── reporting.js       # Console output formatting
└── README.md              # This file
```

## Quick Start

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:game         # Game simulation only
npm run test:components   # Component verification only
npm run test:a11y         # Accessibility testing only

# Run with options
npm run test:headless     # Run all tests headless (faster)
npm run simulate          # Run game simulation with browser visible
```

## Test Suites

### 1. Game Simulation (`game-simulation.js`)

Full end-to-end testing of complete game flow:
- 2 teams playing through 3 sessions
- Trading phase: advertisements, negotiations, responses
- Production phase: automatic production
- Session transitions and leaderboard updates

**Duration**: ~5-10 minutes
**Teams**: test_mail1@stonybrook.edu, test_mail2@stonybrook.edu

### 2. Component Test (`components.js`)

Quick verification that web components load correctly:
- Chemical-card custom elements exist
- Shadow DOM is attached
- Shadow prices are accessible
- Buttons are functional
- API module is loaded

**Duration**: ~10 seconds

### 3. Accessibility Test (`accessibility.js`)

WCAG 2.1 Level AA compliance:
- Tests all pages (index.html, admin.html)
- Tests all themes (dark, light, high-contrast)
- Checks 90+ accessibility rules
- Generates JSON and HTML reports

**Duration**: ~30 seconds
**Reports**: `./accessibility-reports/`

## Helper Modules

### BrowserHelper (`helpers/browser.js`)

Manages Puppeteer browser and page instances:

```javascript
const browser = new BrowserHelper(config);
await browser.launch();
const page = await browser.loginAndNavigate('user@example.com', '/index.html');
await browser.sleep(1000);
await browser.close();
```

### SessionHelper (`helpers/session.js`)

Handles game session and phase management:

```javascript
const session = new SessionHelper(browser);
await session.enableAutoAdvance();
const currentPhase = await session.getCurrentPhase();
await session.waitForPhaseChange('production');
```

### TeamHelper (`helpers/team.js`)

Team actions and trading operations:

```javascript
const team = new TeamHelper(browser);
const shadowPrices = await team.getShadowPrices(page);
await team.postAdvertisement(page, 'C', 'sell');
const seller = await team.findSeller(page, 'N');
await team.initiateNegotiation(page, seller, 'N', shadowPrice);
```

### ReportingHelper (`helpers/reporting.js`)

Consistent console output formatting:

```javascript
ReportingHelper.printHeader('Test Name');
ReportingHelper.printSuccess('Test passed');
ReportingHelper.printError('Test failed');
ReportingHelper.printLeaderboard(teams, session);
```

## Configuration

Edit `run-tests.js` to customize:

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

## Command-Line Options

```bash
# Test selection
node tests/run-tests.js              # Run all tests
node tests/run-tests.js game         # Game simulation only
node tests/run-tests.js components   # Components only
node tests/run-tests.js accessibility # Accessibility only

# Options
node tests/run-tests.js --headless   # Run headless (faster)
node tests/run-tests.js --keep-open  # Keep browser open after tests
node tests/run-tests.js --verbose    # Show detailed browser logs
```

## Adding New Tests

### 1. Create New Test Module

```javascript
// tests/my-new-test.js
const BrowserHelper = require('./helpers/browser');
const ReportingHelper = require('./helpers/reporting');

class MyNewTest {
    constructor(config) {
        this.config = config;
        this.browser = new BrowserHelper(config);
    }

    async run() {
        ReportingHelper.printHeader('My New Test');

        try {
            // Your test logic here
            return { success: true };
        } catch (error) {
            ReportingHelper.printError(`Test failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

module.exports = MyNewTest;
```

### 2. Add to Orchestrator

```javascript
// In run-tests.js
const MyNewTest = require('./my-new-test');

// Add new method
async runMyNewTest() {
    const test = new MyNewTest(this.config);
    this.results.myNewTest = await test.run();
}

// Add to switch statement
case 'mynew':
    await this.runMyNewTest();
    break;
```

### 3. Add NPM Script

```json
"scripts": {
    "test:mynew": "node tests/run-tests.js mynew"
}
```

## Best Practices

1. **Use helper modules** - Don't duplicate browser/session/team logic
2. **Return results** - Always return `{ success: boolean, ... }` from tests
3. **Clean up** - Close pages and browser instances
4. **Report clearly** - Use ReportingHelper for consistent output
5. **Handle errors** - Wrap test logic in try/catch

## Troubleshooting

**Issue**: Browser won't launch
**Solution**: Run `npm install` to ensure Puppeteer is installed

**Issue**: Tests can't find pages
**Solution**: Verify server is running at `http://cndq.test`

**Issue**: Authentication fails
**Solution**: Ensure test users exist and dev_login.php works

**Issue**: Tests timeout
**Solution**: Increase timeout values in helper modules

## Migration from Old Tests

Old test files have been moved to `old-tests/` for reference:
- `old-tests/test_game_simulation.js`
- `old-tests/test_components.js`
- `old-tests/test_accessibility.js`

The new modular structure provides:
- ✅ Shared helper modules (less duplication)
- ✅ Single entry point (`run-tests.js`)
- ✅ Consistent reporting
- ✅ Easier to extend and maintain
- ✅ Better error handling

## Resources

- [Puppeteer Documentation](https://pptr.dev/)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Main Testing Guide](../TEST_AUTOMATION.md)
