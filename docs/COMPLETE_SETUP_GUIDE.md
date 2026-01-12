# CNDQ Chemical Trading Game - Complete Setup Guide

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Prerequisites](#prerequisites)
4. [Initial Setup](#initial-setup)
5. [Database Setup](#database-setup)
6. [Local Development Environment](#local-development-environment)
7. [Project Structure](#project-structure)
8. [Configuration](#configuration)
9. [Running the Application](#running-the-application)
10. [Testing](#testing)
11. [Deployment](#deployment)
12. [Troubleshooting](#troubleshooting)

---

## Project Overview

CNDQ is an online chemical trading simulation game designed to teach linear programming, shadow pricing, and business strategy concepts. Students work in teams to:

- Run optimal production analysis using Linear Programming
- Trade chemicals (C, N, D, Q) based on shadow prices
- Negotiate deals that benefit both parties (non-zero-sum economics)
- Learn about value creation through cooperation

### Educational Goals
- Understand shadow prices and their business applications
- Learn the difference between zero-sum and non-zero-sum deals
- Practice strategic decision-making in a simulated market
- Apply linear programming to real business scenarios

### Game Mechanics
- **Random Starting Inventory**: Each team gets 500-2000 units of each chemical
- **Production Recipes**:
  - Deicer: C=0.5, N=0.3, D=0.2, Q=0.0 ($2/gal profit)
  - Solvent: C=0.0, N=0.25, D=0.35, Q=0.4 ($3/gal profit)
- **Trading Phase**: Teams buy/sell chemicals based on shadow prices
- **Final Production**: LP solver maximizes profit with final inventory
- **Success Metric**: % improvement over initial production potential

---

## Technology Stack

### Backend
- **PHP 8.5+** - Server-side application logic
- **SQLite 3** - Database (event-sourced architecture)
- **Composer** - PHP dependency management
- **Linear Programming Solver** - PHP-based LP solver for optimization

### Frontend
- **Vanilla JavaScript (ES6+)** - Application logic
- **Lit 3.x** - Web Components for UI elements
- **Tailwind CSS** - Utility-first CSS framework
- **No build step** - Direct ES6 module imports

### Development & Testing
- **Valet/Herd** - Local PHP development server (macOS)
- **Puppeteer** - Headless browser automation
- **Playwright** - End-to-end testing
- **Lighthouse** - Performance and accessibility auditing

### Architecture Patterns
- **Event Sourcing** - All team actions stored as events
- **CQRS** - Command-Query Responsibility Segregation
- **RESTful API** - JSON-based endpoints
- **Web Components** - Encapsulated, reusable UI elements

---

## Prerequisites

### Required Software

1. **PHP 8.5 or higher**
   ```bash
   # macOS (using Homebrew)
   brew install php@8.5

   # Verify installation
   php --version
   ```

2. **Composer** (PHP dependency manager)
   ```bash
   # macOS
   brew install composer

   # Verify
   composer --version
   ```

3. **SQLite 3** (usually comes with PHP)
   ```bash
   # Verify
   sqlite3 --version
   ```

4. **Node.js 18+** (for testing tools)
   ```bash
   # macOS
   brew install node

   # Verify
   node --version
   npm --version
   ```

5. **Git**
   ```bash
   # macOS (comes with Xcode Command Line Tools)
   xcode-select --install

   # Or via Homebrew
   brew install git
   ```

### Optional but Recommended

6. **Laravel Valet** or **Herd** (macOS local development)
   ```bash
   # Valet
   composer global require laravel/valet
   valet install

   # Or Herd (download from herd.laravel.com)
   ```

7. **VS Code** or preferred editor
   ```bash
   brew install --cask visual-studio-code
   ```

---

## Initial Setup

### 1. Create Project Directory

```bash
# Create a new directory for the project
mkdir cndq-trading-game
cd cndq-trading-game

# Initialize git repository
git init
```

### 2. Create Directory Structure

```bash
# Create main directories
mkdir -p admin api bin css data docs js/components lib tests

# Create subdirectories
mkdir -p api/admin api/leaderboard api/negotiations api/session api/team api/trades
mkdir -p bin/git-hooks bin/migrations
mkdir -p tests/components tests/game
```

### 3. Initialize Composer

```bash
# Create composer.json
cat > composer.json << 'EOF'
{
    "require": {
        "codeguy/upload": "^1.3",
        "google/apiclient": "^2.0"
    },
    "require-dev": {
        "squizlabs/php_codesniffer": "^3.5"
    }
}
EOF

# Install PHP dependencies
composer install
```

### 4. Initialize NPM

```bash
# Create package.json
cat > package.json << 'EOF'
{
  "name": "cndq-game-simulation",
  "version": "1.0.0",
  "description": "CNDQ Chemical Trading Game Simulation",
  "scripts": {
    "test": "node tests/run-tests.js",
    "test:game": "node tests/run-tests.js game",
    "test:components": "node tests/run-tests.js components",
    "test:all": "node tests/run-tests.js all",
    "simulate": "node tests/run-tests.js game --keep-open"
  },
  "dependencies": {
    "lit": "^3.3.2",
    "puppeteer": "^24.1.0"
  },
  "devDependencies": {
    "@axe-core/puppeteer": "^4.11.0",
    "axe-core": "^4.11.0",
    "lighthouse": "^13.0.1",
    "playwright": "^1.57.0"
  }
}
EOF

# Install Node dependencies
npm install
```

### 5. Create .gitignore

```bash
cat > .gitignore << 'EOF'
# Environment files
.env

# Data directory (symlink in production)
/data

# Dependencies
node_modules
package-lock.json
vendor

# IDE
.vscode
.idea

# Logs and temp files
*.log
*.tmp
api-call-log-*.json
api-playability-log-*.json
puppeteer.out

# OS files
.DS_Store
Thumbs.db

# Test artifacts
accessibility-reports/
test-*.png
EOF
```

---

## Database Setup

### 1. Create Database Schema

Create `lib/schema.sql`:

```sql
-- CNDQ Database Schema
-- Single SQLite database with event-sourced architecture

-- Team events table - Event sourcing for all team actions
CREATE TABLE IF NOT EXISTS team_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_email TEXT NOT NULL,
    team_name TEXT,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,           -- JSON payload
    timestamp REAL NOT NULL,          -- Microtime for ordering
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_team_events_email ON team_events(team_email, timestamp);
CREATE INDEX IF NOT EXISTS idx_team_events_type ON team_events(event_type);

-- Team state cache - Aggregated state for fast reads
CREATE TABLE IF NOT EXISTS team_state_cache (
    team_email TEXT PRIMARY KEY,
    state TEXT NOT NULL,              -- JSON aggregated state
    last_event_id INTEGER,
    events_processed INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (last_event_id) REFERENCES team_events(id)
);

-- Marketplace events - Shared event log for offers, ads
CREATE TABLE IF NOT EXISTS marketplace_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_email TEXT NOT NULL,
    team_name TEXT,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    timestamp REAL NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_marketplace_events_type ON marketplace_events(event_type);
CREATE INDEX IF NOT EXISTS idx_marketplace_events_timestamp ON marketplace_events(timestamp DESC);

-- Marketplace snapshot - Cached aggregated marketplace state
CREATE TABLE IF NOT EXISTS marketplace_snapshot (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    offers TEXT,
    buy_orders TEXT,
    ads TEXT,
    recent_trades TEXT,
    last_event_id INTEGER,
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

INSERT OR IGNORE INTO marketplace_snapshot (id, offers, buy_orders, ads, recent_trades)
VALUES (1, '[]', '[]', '[]', '[]');

-- Negotiations - Private negotiation sessions
CREATE TABLE IF NOT EXISTS negotiations (
    id TEXT PRIMARY KEY,
    chemical TEXT NOT NULL,
    type TEXT NOT NULL,
    initiator_id TEXT NOT NULL,
    initiator_name TEXT,
    responder_id TEXT NOT NULL,
    responder_name TEXT,
    session_number INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    last_offer_by TEXT,
    accepted_by TEXT,
    rejected_by TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    ad_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_negotiations_initiator ON negotiations(initiator_id, status);
CREATE INDEX IF NOT EXISTS idx_negotiations_responder ON negotiations(responder_id, status);

-- Negotiation offers - Counter-offers within a negotiation
CREATE TABLE IF NOT EXISTS negotiation_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    negotiation_id TEXT NOT NULL,
    from_team_id TEXT NOT NULL,
    from_team_name TEXT,
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    heat_is_hot INTEGER DEFAULT 0,
    heat_total REAL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (negotiation_id) REFERENCES negotiations(id) ON DELETE CASCADE
);

-- Configuration key-value store
CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

### 2. Create Schema Version Tracking

Create `lib/schema_version.txt`:
```
2
```

### 3. Create Database Class

Create `lib/Database.php` (see full implementation in codebase - includes auto-migration logic).

### 4. Create Schema Management Tools

Create `bin/apply-schema.php`:
```php
#!/usr/bin/env php
<?php
require_once __DIR__ . '/../lib/Database.php';

echo "Apply Database Schema\n";
echo "=====================\n\n";

$db = Database::getInstance();
$schemaFile = __DIR__ . '/../lib/schema.sql';
$schema = file_get_contents($schemaFile);
$db->getPdo()->exec($schema);

// Set schema version
$versionFile = __DIR__ . '/../lib/schema_version.txt';
$version = (int)trim(file_get_contents($versionFile));
$db->getPdo()->exec("INSERT OR REPLACE INTO config (key, value, updated_at)
    VALUES ('schema_version', '" . json_encode($version) . "', " . time() . ")");

echo "✅ Schema applied successfully! (Version: $version)\n";
```

Make executable:
```bash
chmod +x bin/apply-schema.php
```

---

## Local Development Environment

### Option 1: Laravel Valet (Recommended for macOS)

```bash
# Install Valet globally
composer global require laravel/valet
valet install

# Navigate to your project directory
cd /path/to/cndq-trading-game

# Park the directory (makes all subdirectories available as .test domains)
valet park

# Access via: http://cndq-trading-game.test/
```

### Option 2: Herd (macOS - GUI Application)

1. Download Herd from https://herd.laravel.com/
2. Install the app
3. Add your project directory to Herd
4. Access via: http://cndq-trading-game.test/

### Option 3: PHP Built-in Server

```bash
# From project root
php -S localhost:8000

# Access via: http://localhost:8000/
```

### Create Local Environment File

```bash
# Create .env from example
cat > .env << 'EOF'
# Local Development Environment
MAIL=test_mail1@stonybrook.edu
CN=Test User
NICKNAME=testuser
GIVENNAME=Test
SN=User
EOF
```

**Note**: `.env` is gitignored and only needed for local development. Production uses Shibboleth authentication.

---

## Project Structure

```
cndq-trading-game/
├── admin/                      # Admin control panel
│   ├── index.php              # Main admin interface
│   └── css/                   # Admin-specific styles
├── api/                       # RESTful API endpoints
│   ├── admin/                 # Admin-only endpoints
│   ├── leaderboard/          # Standings and rankings
│   ├── negotiations/         # Trading negotiations
│   ├── session/              # Game session management
│   ├── team/                 # Team profile and inventory
│   └── trades/               # Transaction history
├── bin/                      # Command-line tools
│   ├── apply-schema.php     # Apply database schema
│   ├── check-schema.php     # Verify schema version
│   ├── db-stats.php         # Database statistics
│   └── git-hooks/           # Git hooks for schema checks
├── css/                      # Global stylesheets
│   └── tailwind.css         # Tailwind CSS utilities
├── data/                     # SQLite database (gitignored)
│   └── cndq.db              # Main database file
├── docs/                     # Documentation
│   ├── COMPLETE_SETUP_GUIDE.md
│   ├── SCHEMA_MANAGEMENT.md
│   ├── API_DOCUMENTATION.md
│   └── EXCEL_ANALYSIS.md    # Original Excel version analysis
├── js/                       # Frontend JavaScript
│   ├── marketplace.js       # Main application logic
│   ├── api.js              # API wrapper
│   └── components/         # Lit web components
│       ├── chemical-card.js
│       ├── negotiation-modal.js
│       └── trade-history.js
├── lib/                      # PHP backend classes
│   ├── Database.php         # Database connection manager
│   ├── TeamStorage.php      # Event-sourced team state
│   ├── LPSolver.php        # Linear programming solver
│   ├── NegotiationManager.php
│   ├── MarketplaceAggregator.php
│   ├── SessionManager.php
│   ├── NPCManager.php      # Automated NPC trading
│   ├── schema.sql          # Database schema
│   └── schema_version.txt  # Schema version number
├── tests/                    # Automated tests
│   ├── run-tests.js        # Test runner
│   ├── game/               # Game flow tests
│   └── components/         # Component tests
├── index.php                # Main player interface
├── dev.php                 # Development tools
├── config.php              # App configuration
├── userData.php            # Authentication helper
├── composer.json           # PHP dependencies
├── package.json            # Node dependencies
└── .htaccess              # Apache configuration
```

---

## Configuration

### 1. Create config.php

```php
<?php
/**
 * Application Configuration
 */

// Database configuration
define('DB_PATH', __DIR__ . '/data/cndq.db');

// Application settings
define('TRADING_DURATION', 20); // minutes per trading session
define('NPC_ENABLED', true);
define('NPC_SKILL_LEVELS', [1, 2, 3]); // Beginner, Intermediate, Expert

// Production recipes
define('RECIPES', [
    'deicer' => [
        'C' => 0.5,
        'N' => 0.3,
        'D' => 0.2,
        'Q' => 0.0,
        'profit' => 2.00
    ],
    'solvent' => [
        'C' => 0.0,
        'N' => 0.25,
        'D' => 0.35,
        'Q' => 0.4,
        'profit' => 3.00
    ]
]);

// Starting inventory range (random)
define('INVENTORY_MIN', 500);
define('INVENTORY_MAX', 2000);
```

### 2. Create userData.php (Authentication Helper)

```php
<?php
/**
 * User Data - Authentication and User Information
 */

function getCurrentUserEmail() {
    // Load .env file for local development
    if (file_exists(__DIR__ . '/.env')) {
        $lines = file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (strpos($line, '=') !== false && strpos($line, '#') !== 0) {
                list($key, $value) = explode('=', $line, 2);
                $_ENV[trim($key)] = trim($value);
            }
        }
    }

    // Check for dev cookie (set by dev_login.php)
    if (isset($_COOKIE['mock_mail'])) {
        return $_COOKIE['mock_mail'];
    }

    // Check Shibboleth (production)
    if (isset($_SERVER['mail'])) {
        return $_SERVER['mail'];
    }

    // Check .env file (local development)
    if (isset($_ENV['MAIL'])) {
        return $_ENV['MAIL'];
    }

    return null;
}

function isAdmin() {
    $adminEmails = [
        'admin@stonybrook.edu',
        'paul.st.denis@stonybrook.edu'
    ];

    $currentUser = getCurrentUserEmail();
    return in_array($currentUser, $adminEmails);
}

function getUserDisplayName() {
    if (isset($_SERVER['cn'])) {
        return $_SERVER['cn'];
    }
    if (isset($_ENV['CN'])) {
        return $_ENV['CN'];
    }
    return getCurrentUserEmail();
}
```

### 3. Create .htaccess (Apache Configuration)

```apache
# Enable Rewrite Engine
RewriteEngine On

# Block access to sensitive files
<FilesMatch "\.(sql|txt|log|db|md)$">
    Order allow,deny
    Deny from all
</FilesMatch>

# PHP Configuration
php_flag display_errors On
php_value error_reporting E_ALL
php_value max_execution_time 300
php_value memory_limit 256M

# Security Headers
Header set X-Content-Type-Options "nosniff"
Header set X-Frame-Options "SAMEORIGIN"
Header set X-XSS-Protection "1; mode=block"

# CORS (if needed for development)
# Header set Access-Control-Allow-Origin "*"
```

---

## Running the Application

### 1. Initialize Database

```bash
# Apply schema
php bin/apply-schema.php

# Verify
php bin/check-schema.php
```

### 2. Start Development Server

```bash
# Option 1: Valet (if installed)
# Just navigate to http://cndq-trading-game.test/

# Option 2: Built-in PHP server
php -S localhost:8000

# Option 3: Herd
# Use the Herd GUI application
```

### 3. Access the Application

- **Player Interface**: http://cndq-trading-game.test/ (or http://localhost:8000/)
- **Admin Panel**: http://cndq-trading-game.test/admin/
- **API Documentation**: http://cndq-trading-game.test/api-docs.php
- **Dev Tools**: http://cndq-trading-game.test/dev.php

### 4. Login Methods

**Local Development Only**:

Create `dev_login.php` in root:
```php
<?php
// Set mock user via cookie
$email = $_GET['email'] ?? 'test_mail1@stonybrook.edu';
setcookie('mock_mail', $email, time() + 86400, '/');
header('Location: /');
?>
```

Access: `http://cndq-trading-game.test/dev_login.php?email=test@stonybrook.edu`

---

## Testing

### Run All Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:game          # Game flow tests
npm run test:components    # Component tests

# Run in headless mode (CI/CD)
npm run test:headless

# Simulate gameplay (keeps browser open)
npm run simulate
```

### Manual Testing Checklist

1. **Game Flow**
   - [ ] Admin can start/stop market
   - [ ] Players can join and see their team
   - [ ] Shadow prices calculate correctly
   - [ ] Advertisements post and display
   - [ ] Negotiations work end-to-end
   - [ ] Final production runs and displays results

2. **Trading**
   - [ ] Buy requests filtered by inventory
   - [ ] Negotiations create counter-offers
   - [ ] Heat calculation (mutual benefit) works
   - [ ] Ads removed when negotiation accepted
   - [ ] Transactions reflected in both teams

3. **NPCs**
   - [ ] NPCs can be enabled/disabled
   - [ ] NPCs trade based on shadow prices
   - [ ] Different skill levels behave differently

4. **Admin Functions**
   - [ ] Session control (start/stop/reset)
   - [ ] Team management
   - [ ] Leaderboard displays correctly
   - [ ] NPC configuration works

---

## Deployment

### Production Requirements

1. **Server Environment**
   - Apache 2.4+ with mod_rewrite
   - PHP 8.5+
   - SQLite 3.35+
   - Shibboleth SSO (for authentication)

2. **Directory Permissions**
   ```bash
   chmod 755 /var/www/cndq/
   chmod 775 /var/www/cndq/data/
   chown www-data:www-data /var/www/cndq/data/
   ```

3. **Symlinked Data Directory** (if deployment is read-only)
   ```bash
   # Create writable data directory
   mkdir -p /var/app-data/cndq/data

   # Remove local data dir
   cd /var/www/cndq
   rm -rf data

   # Create symlink
   ln -s /var/app-data/cndq/data ./data

   # Set permissions
   chown -R www-data:www-data /var/app-data/cndq/data
   ```

### Deployment Checklist

- [ ] Pull latest code: `git pull origin main`
- [ ] Install dependencies: `composer install --no-dev`
- [ ] Check schema: `php bin/check-schema.php`
- [ ] Schema auto-updates on first request
- [ ] Verify Shibboleth authentication works
- [ ] Test admin panel access
- [ ] Clear any cached data if needed

---

## Troubleshooting

### Database Issues

**Problem**: Tables not created
```bash
# Solution: Manually apply schema
php bin/apply-schema.php
```

**Problem**: Schema out of sync
```bash
# Check version
php bin/check-schema.php

# Will auto-update on next page load, or manually:
php bin/apply-schema.php
```

**Problem**: Database locked
```bash
# Check for stale connections
lsof data/cndq.db

# Restart PHP-FPM (if using Valet/Herd)
valet restart
```

### Authentication Issues

**Problem**: "Not authenticated" error locally
```bash
# Verify .env file exists
cat .env

# Or use dev_login.php
curl http://cndq-trading-game.test/dev_login.php?email=test@stonybrook.edu
```

### Performance Issues

**Problem**: Slow page loads
```bash
# Check database size
php bin/db-stats.php

# Vacuum database
sqlite3 data/cndq.db "VACUUM;"

# Rebuild shadow prices cache
# (handled automatically, but can force via admin panel)
```

### NPCs Not Trading

**Problem**: NPCs enabled but not making offers
```bash
# Check NPC configuration
php -r "require 'lib/NPCManager.php'; \$m = new NPCManager(); var_dump(\$m->isSystemEnabled());"

# Check game state
php debug-session.php

# Manually trigger NPC cycle (admin only)
curl http://cndq-trading-game.test/api/admin/npc/trigger-cycle.php
```

---

## Key Concepts for Developers

### Event Sourcing

All team actions are stored as events in `team_events`:
- `init` - Team created
- `trade` - Chemical bought/sold
- `shadow_update` - Shadow prices recalculated
- `production` - Final production run

State is reconstructed by replaying events.

### Shadow Prices

Calculated using Linear Programming solver:
- **High shadow price** → Chemical is valuable for production, buy more
- **Low shadow price** → Chemical is excess, sell it
- Trading profitable when: `buyer_shadow_price > deal_price > seller_shadow_price`

### Success Metric

Formula: `(Current Profit - Initial Potential) / Initial Potential × 100`

Where:
- **Initial Potential**: LP solution with starting inventory (no trading)
- **Current Profit**: Actual profit after trading and production
- Measures value created through trading, not just raw profit

### Heat Calculation

"Heat" = mutual benefit of a trade deal:
- Calculate value to buyer: `(buyer_shadow - price) × quantity`
- Calculate value to seller: `(price - seller_shadow) × quantity`
- Deal is "hot" if both values > 0 (win-win)

---

## Additional Resources

- **Problem Description**: See `Problem.md` for educational context
- **Schema Management**: See `docs/SCHEMA_MANAGEMENT.md`
- **NPC Strategies**: See `NPC-STRATEGIES.md`
- **Testing Guide**: See `TESTING_READY.md`
- **Original Excel Analysis**: See `docs/EXCEL_ANALYSIS.md`

---

## Quick Start Checklist

For an experienced developer starting from scratch:

```bash
# 1. Create project structure
mkdir cndq-trading-game && cd cndq-trading-game
mkdir -p admin api/{admin,leaderboard,negotiations,session,team,trades} bin css data docs js/components lib tests

# 2. Copy files from existing repository
# (Clone the repo or copy files manually)

# 3. Install dependencies
composer install
npm install

# 4. Configure environment
cp .env.example .env
# Edit .env with your test email

# 5. Initialize database
php bin/apply-schema.php

# 6. Start development server
valet link cndq
# Or: php -S localhost:8000

# 7. Access application
open http://cndq.test/
# Or: open http://localhost:8000/

# 8. Run tests
npm test
```

---

## Support and Contributing

For questions or issues:
1. Check documentation in `/docs`
2. Review `topology.md` for architecture overview
3. Check git commit history for recent changes
4. Consult `Problem.md` for educational requirements

---

**Last Updated**: January 2026
**Version**: 2.0
**Schema Version**: 2
