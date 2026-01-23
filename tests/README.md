# CNDQ Test Suite

Comprehensive testing suite for CNDQ (Chemical Negotiation & Distribution Quest).

## Quick Start

```bash
# Run the main test (dual playability)
node tests/controller.js

# Run all tests
node tests/controller.js --test all --headless

# Run specific tests
node tests/controller.js --test dual,lighthouse
```

## Test Controller

The unified test runner (`controller.js`) manages all tests with a single interface.

### Basic Usage

```bash
node tests/controller.js [options]
```

### Available Tests

| Test | Key | Description |
|------|-----|-------------|
| Dual Playability | `dual` | UI vs API comparison with ROI validation (default) |
| Stress Test | `stress` | Load testing with multiple concurrent users |
| Lighthouse Audit | `lighthouse` | Performance, accessibility, best practices |
| Accessibility | `accessibility` | WCAG 2.1 Level AA compliance |
| Visual UX | `visual` | Visual regression screenshots |

### Options

#### Test Selection
| Option | Description |
|--------|-------------|
| `--test, -t <tests>` | Tests to run (comma-separated or `all`) |
| `--list` | List available tests |

#### Output Control
| Option | Description |
|--------|-------------|
| `--report, -r <path>` | Output report file (default: `test-report-{timestamp}.json`) |
| `--background, -b` | Headless mode with minimal output |
| `--quiet, -q` | Only show summary |
| `--verbose, -v` | Show detailed output including stack traces |

#### Configuration
| Option | Description |
|--------|-------------|
| `--config, -c <path>` | Config file (default: `test-config.json`) |
| `--headless` | Run browsers in headless mode |
| `--baseUrl <url>` | Override base URL |

#### Game Parameters
| Option | Description |
|--------|-------------|
| `--npcs <n>` | Number of NPCs to create |
| `--rpcs <n>` | Number of real player clients |
| `--duration <s>` | Trading duration in seconds |
| `--skill <level>` | Set all skill levels (`beginner`, `novice`, `expert`) |

### Examples

```bash
# Run dual test in headless mode
node tests/controller.js --test dual --headless

# Run all tests in background with custom report
node tests/controller.js --test all --background --report ./results.json

# Run with custom parameters
node tests/controller.js --test dual --npcs 10 --duration 120 --skill expert

# Use custom config file
node tests/controller.js --config production-config.json --test accessibility
```

### Output Report

The controller generates a JSON report with:

```json
{
  "timestamp": "2026-01-22T...",
  "summary": {
    "total": 5,
    "passed": 4,
    "failed": 1,
    "passRate": 80,
    "totalDurationMs": 125000
  },
  "tests": [
    {
      "test": "dual",
      "name": "Dual Playability Test",
      "success": true,
      "durationMs": 45000,
      "startTime": "...",
      "endTime": "...",
      "error": null
    }
  ]
}
```

## Configuration File

Default config: `test-config.json`

```json
{
  "baseUrl": "http://cndq.test/CNDQ/",
  "adminUser": "admin@stonybrook.edu",
  "npcCount": 6,
  "rpcCount": 6,
  "tradingDuration": 300,
  "targetSessions": 2,
  "npcSkillMix": ["expert", "expert", "expert", "expert", "expert", "expert"],
  "rpcSkillMix": ["expert", "expert", "expert", "expert", "expert", "expert"],
  "headless": true,
  "verbose": false,
  "passCriteria": {
    "minPositiveRoiTeams": 1,
    "minAverageRoi": -50,
    "minTotalTrades": 3,
    "maxAcceptableErrors": 2
  }
}
```

## Test Descriptions

### Dual Playability Test (`dual`)
Runs both UI and API tests, comparing results to ensure:
- UI triggers correct API calls
- API endpoints work correctly without UI
- Both achieve the same game state
- Game produces measurable economic activity (ROI-based validation)

**Pass Criteria:**
- At least 1 team with positive ROI
- Average ROI > -50%
- At least 3 trades executed
- Maximum 2 errors

### Stress Test (`stress`)
Simulates multiple concurrent users to verify:
- System handles load without errors
- Database concurrency (SQLite WAL + busy_timeout)
- NPC trading behavior under load

### Lighthouse Audit (`lighthouse`)
Google Lighthouse testing for:
- Performance metrics
- Accessibility score
- Best practices
- SEO

### Accessibility Test (`accessibility`)
WCAG 2.1 Level AA compliance using axe-core:
- Color contrast
- ARIA labels
- Keyboard navigation
- Screen reader compatibility

### Visual UX Test (`visual`)
Captures screenshots at each game stage for visual regression testing.

## Architecture

### Test Isolation
Each test runs in full try/catch isolation:
- One failure won't crash other tests
- Browser cleanup in `finally` blocks
- 2-second delay between tests for resource cleanup

### NPC Processing
- NPCs processed when any client polls server (every 3 seconds)
- SessionManager throttles NPC processing (max once per 10 seconds)
- No cron required

### Database Concurrency
- SQLite WAL mode for better read/write concurrency
- `busy_timeout = 5000ms` waits for locks instead of failing immediately

## Helpers

| File | Purpose |
|------|---------|
| `helpers/browser.js` | Puppeteer browser management |
| `helpers/api-client.js` | API request wrapper |
| `helpers/team.js` | Team actions and trading operations |
| `helpers/session.js` | Session/game state management |
| `helpers/reporting.js` | Console output formatting |
