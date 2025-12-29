# CNDQ - Chemical Trading Game

> **C**hemical **N**egotiation for **D**eicer and Solvent (CNDQ)
>
> An educational business simulation game teaching linear programming, shadow price analysis, and win-win negotiation strategies through chemical trading markets.

[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)]()
[![WCAG 2.2](https://img.shields.io/badge/WCAG%202.2-AA-blue)]()
[![PHP 8.5+](https://img.shields.io/badge/PHP-8.5+-777BB4?logo=php&logoColor=white)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

---

## Overview

CNDQ is a web-based business simulation game where student teams compete as chemical manufacturing companies. Teams produce **Deicer** and **Solvent** using four raw materials (C, N, D, Q), optimize production with linear programming, and trade excess chemicals to maximize profit.

### Key Learning Objectives

- 📊 **Linear Programming**: Use LP solvers to optimize production mix
- 💰 **Shadow Price Analysis**: Understand marginal value of constrained resources
- 🤝 **Win-Win Negotiations**: Discover non-zero-sum economic opportunities
- 🎯 **Business Strategy**: Balance cooperation vs. competition
- 📈 **Economic Growth**: See how markets create value through trade

---

## Game Mechanics

### 1. Team Organization

Students form teams of 3-4 and assign roles (President, Marketing Director, etc.). Each team starts with:

- **Initial Funds**: $7,000 - $12,000
- **Random Inventory**: 500-2,000 gallons per chemical (C, N, D, Q)
- **Production Capacity**: Ability to manufacture Deicer and Solvent

### 2. Production Phase

Teams manufacture two products:

| Product | Formula | Profit/Gallon |
|---------|---------|---------------|
| **Deicer** | 1 C + 2 N + 1 D | Variable |
| **Solvent** | 1 N + 2 D + 3 Q | Variable |

A **Linear Programming solver** calculates:
- Optimal product mix (maximize profit)
- Shadow prices (marginal value of each chemical)

### 3. Trading Phase

#### Buy-Only Marketplace Model

Teams post **buy requests** for chemicals they need:

1. **Buyer** posts request: "Want 100 gallons of Chemical N @ max $8/gallon"
2. **Sellers** respond with offers: "I'll sell 80 gallons @ $5/gallon"
3. **Negotiation** begins: back-and-forth until agreement or rejection
4. **Trade executes**: Both teams' inventories and funds update

#### Shadow Price Strategy

- **High shadow price (>$5)**: Chemical is valuable to you → BUY it
- **Low shadow price (<$1)**: Chemical has little value → SELL it
- **Win-win zone**: When buyer's shadow price > seller's shadow price

**Example Win-Win Trade:**
```
Team A: Needs Chemical Q (shadow price: $8)
Team B: Has excess Q (shadow price: $2)

Negotiation settles at $5/gallon:
✅ Team A saves $3/gallon vs. their shadow price → Profits!
✅ Team B gains $3/gallon vs. their shadow price → Profits!

Both teams improve their position!
```

### 4. Session Loop

```
Session 1:
  ├─ Production Phase → Calculate shadow prices
  ├─ Trading Phase → Post buy requests, negotiate
  └─ End Session → Tally profits

Session 2:
  ├─ Production Phase → New shadow prices
  ├─ Trading Phase → More trades
  └─ End Session → Update leaderboard

Session N:
  └─ Final standings
```

### 5. Scoring

Teams are ranked by **profit percentage** from initial funds:

```
Score = ((Current Funds - Initial Funds) / Initial Funds) × 100%
```

---

## Technology Stack

### Frontend

- **Web Components**: Custom elements (`<chemical-card>`, `<advertisement-item>`)
- **Tailwind CSS**: Responsive design with dark/light/high-contrast themes
- **Vanilla JavaScript**: No framework dependencies
- **Real-time Updates**: API polling for live negotiation feed

### Backend

- **PHP 8.5+**: RESTful API endpoints
- **JSON File Storage**: No database required (files in `data/`)
- **LP Solver**: PHP-based linear programming for shadow prices
- **Authentication**:
  - Production: Apache + Shibboleth SSO
  - Development: `.env` file simulation

### Testing

- **Puppeteer**: Headless browser automation
- **Game Simulation**: Multi-team, multi-session testing
- **WCAG 2.2 AA**: Accessibility compliance testing
- **Component Tests**: Web component validation

---

## Quick Start

### Production Deployment (Linux + Apache + Shibboleth)

```bash
# Clone repository
git clone <repo-url> /var/www/cndq
cd /var/www/cndq

# Set permissions
chmod -R 755 data/
chown -R www-data:www-data data/

# Configure Apache with Shibboleth
# (See production deployment docs)
```

**Access**: https://your-domain.edu/cndq

### Local Development (macOS + Valet)

**Full setup guide**: See [`setup_mac_localdev.md`](./setup_mac_localdev.md)

```bash
# Prerequisites
brew install php composer

# Install Laravel Valet
composer global require laravel/valet
valet install

# Clone and link
git clone <repo-url> CNDQ
cd CNDQ
valet link cndq

# Configure authentication
cp .env.example .env
nano .env  # Set MAIL=your_email@stonybrook.edu

# Open browser
open http://cndq.test
```

**Access**: http://cndq.test

### Local Development (Windows + Herd)

**Full setup guide**: See [`LOCAL_SETUP.md`](./LOCAL_SETUP.md)

```bash
# Download and install Laravel Herd
# Link the CNDQ folder
# Configure .env file
# Access: http://cndq.test
```

---

## Testing

### Run All Tests

```bash
# Install dependencies
npm install

# Run full test suite
npm test

# Run specific suites
npm run test:game         # Game simulation (3 teams, 2 sessions)
npm run test:components   # Component verification
npm run test:a11y         # Accessibility testing
```

### Test Configuration

Current test setup (3 teams, 2 sessions):

```javascript
// tests/run-tests.js
const CONFIG = {
    baseUrl: 'http://cndq.test',
    teams: [
        'test_mail1@stonybrook.edu',
        'test_mail2@stonybrook.edu',
        'test_mail3@stonybrook.edu'
    ],
    targetSessions: 2,
    headless: false
};
```

**Test Documentation**: See [`tests/README.md`](./tests/README.md)

---

## Architecture

### Authentication Flow

**Development (Valet/Herd)**:
```
Browser → Nginx/PHP-FPM → .env file → userData.php → Authenticated
```

**Production (Apache + Shibboleth)**:
```
Browser → Apache → .htaccess → Shibboleth → $_SERVER['mail'] → Authenticated
```

### File Structure

```
CNDQ/
├── index.html              # Main game interface
├── admin.html              # Admin controls (session/phase management)
├── api/                    # RESTful API endpoints
│   ├── profile/            # User profile data
│   ├── offers/             # Buy request API
│   ├── negotiations/       # Negotiation management
│   └── leaderboard/        # Standings API
├── js/                     # Frontend JavaScript
│   ├── main.js             # Core application logic
│   ├── marketplace.js      # Buy request & negotiation UI
│   ├── api.js              # API client abstraction
│   └── components/         # Web Components
│       ├── chemical-card.js
│       ├── advertisement-item.js
│       └── negotiation-card.js
├── data/                   # JSON file storage
│   ├── teams.json          # Team data
│   ├── inventory.json      # Chemical inventory
│   ├── advertisements.json # Buy requests
│   └── negotiations.json   # Active negotiations
├── tests/                  # Automated testing
│   ├── run-tests.js        # Test orchestrator
│   ├── game-simulation.js  # Full game flow test
│   └── helpers/            # Test utilities
├── docs/                   # Additional documentation
└── .env                    # Local authentication config
```

---

## API Reference

### Profile API

```javascript
// Get current user profile
GET /api/profile/get.php
Response: {
  success: true,
  profile: {
    email: "user@stonybrook.edu",
    teamName: "Crafty Otter",
    currentFunds: 10250.50,
    initialFunds: 9000,
    currentSession: 3
  }
}
```

### Buy Request API

```javascript
// Post buy request
POST /api/offers/bid.php
Body: {
  chemical: "N",
  quantity: 100,
  maxPrice: 8.00
}
```

### Negotiation API

```javascript
// Accept offer
POST /api/negotiations/accept.php
Body: { negotiationId: "abc123" }

// Counter offer
POST /api/negotiations/counter.php
Body: {
  negotiationId: "abc123",
  newQuantity: 80,
  newPrice: 6.50
}
```

**Full API Documentation**: See inline comments in `api/` directory

---

## User Interface

### Buy Request Modal

<img src="docs/screenshots/buy-request-modal.png" alt="Buy Request Modal" width="500">

**Features**:
- Quantity slider with real-time total calculation
- Max price input with shadow price hint
- Fund validation (prevents overspending)
- Disabled submit button when insufficient funds

### Respond to Buy Request Modal

<img src="docs/screenshots/respond-modal.png" alt="Respond Modal" width="500">

**Features**:
- Inventory slider (capped at actual inventory)
- Price input with shadow price context
- Inventory validation (prevents overselling)
- Total revenue preview

### Negotiation Interface

Real-time negotiation feed with:
- Offer history timeline
- Accept/Counter/Reject buttons
- Back-and-forth messaging
- Automatic inventory/fund checks

---

## Pedagogical Design

### Original Vision vs. Current Implementation

**Document**: See [`Problem_vs_dev.md`](./Problem_vs_dev.md)

**Key Alignment**:
- ✅ Shadow price concept preserved
- ✅ Win-win economics achievable
- ✅ LP solver integration
- ✅ Multi-session gameplay

**Strategic Simplification**:
- **Original**: Two-sided marketplace (buy AND sell ads)
- **Current**: Buy-only request model (Request for Quote)
- **Rationale**: Simpler onboarding, prevents common mistakes, preserves learning objectives

### Win-Win Economics Lesson

The game demonstrates that **trades can benefit both parties**:

> "Team 3 and Team 7 made a deal and BOTH of them ended up increasing their profit!"

This happens when:
1. Buyer values chemical more than seller (different shadow prices)
2. Price settles between both shadow prices
3. Both teams profit from the exchange

**Revelation**: Not all deals are zero-sum. Cooperation creates economic value.

---

## Documentation Index

### Setup Guides
- [**setup_mac_localdev.md**](./setup_mac_localdev.md) - macOS + Valet setup (recommended for Mac)
- [**LOCAL_SETUP.md**](./LOCAL_SETUP.md) - Windows + Herd setup
- [**.env.example**](./.env.example) - Environment configuration template

### Game Design
- [**Problem.md**](./Problem.md) - Original project specification
- [**Problem_vs_dev.md**](./Problem_vs_dev.md) - Implementation comparison

### Testing
- [**tests/README.md**](./tests/README.md) - Testing framework documentation
- [**TEST_AUTOMATION.md**](./TEST_AUTOMATION.md) - Test automation guide
- [**TESTING.md**](./TESTING.md) - Manual testing procedures

### Technical Documentation
- [**SHADOW_PRICE_WORKFLOW.md**](./SHADOW_PRICE_WORKFLOW.md) - LP solver integration
- [**ACCESSIBILITY.md**](./ACCESSIBILITY.md) - WCAG compliance details
- [**docs/**](./docs/) - Additional technical documents

---

## Configuration

### Admin Controls (`admin.html`)

- **Session Management**: Advance to next session
- **Phase Control**: Toggle Trading ↔ Production
- **Auto-Advance**: Automatic phase progression (configurable duration)
- **Game Reset**: Reset all teams to Session 1

### Environment Variables (`.env`)

```env
# Local development authentication
MAIL=your_email@stonybrook.edu
CN=your_cn
NICKNAME=YourName
GIVENNAME=Your
SN=Name
```

### Theme Switching

Users can select themes:
- **Dark Mode** (default)
- **Light Mode**
- **High Contrast Mode**

Themes persist via `localStorage` and meet WCAG 2.2 AA standards.

---

## Common Workflows

### Starting a New Game Session

1. Admin visits `admin.html`
2. Click "Reset Game" (all teams → Session 1)
3. Enable "Auto-Advance" for automatic phase transitions
4. Students login and start playing

### Student Workflow (Trading Phase)

1. View shadow prices from LP solver
2. Post buy requests for high-value chemicals
3. Respond to buy requests for low-value chemicals
4. Negotiate prices between shadow prices
5. Accept deals that profit both parties

### Instructor Monitoring

1. Watch leaderboard in real-time
2. Identify which teams are making good trades
3. Highlight win-win deals to the class
4. Discuss shadow price interpretation

---

## Troubleshooting

### Site Not Loading

```bash
# macOS (Valet)
valet restart

# Windows (Herd)
# Restart Herd application
```

### Authentication Issues

```bash
# Check .env file exists
ls -la .env

# Verify MAIL variable set
cat .env

# Test authentication
open http://cndq.test/check_auth.php
```

### File Permission Errors

```bash
# Fix data directory permissions
chmod -R 755 data/
chown -R $(whoami) data/
```

### Test Failures

```bash
# Ensure server is running
curl http://cndq.test

# Reinstall dependencies
npm install

# Run verbose
node tests/run-tests.js --verbose
```

---

## Contributing

### Development Workflow

1. Fork the repository
2. Create feature branch: `git checkout -b feature/your-feature`
3. Make changes and test: `npm test`
4. Commit with clear messages
5. Push and create pull request

### Code Style

- **PHP**: Follow PSR-12 standards
- **JavaScript**: Use ESLint configuration
- **HTML/CSS**: Maintain accessibility (WCAG 2.2 AA)

### Testing Requirements

All pull requests must:
- ✅ Pass game simulation test
- ✅ Pass component tests
- ✅ Pass accessibility tests
- ✅ Include documentation updates

---

## Performance

### Optimization Features

- **Client-side caching**: Shadow prices, inventory
- **Debounced inputs**: Real-time validation without API spam
- **Lazy loading**: Web components load on demand
- **Minimal dependencies**: Vanilla JS, no framework overhead

### Scalability

- **File-based storage**: No database bottleneck for small classes (<50 teams)
- **Session isolation**: Teams operate independently during phases
- **Async API**: Non-blocking request handling

---

## Security

### Authentication

- **Production**: Shibboleth SSO (university authentication)
- **Development**: `.env` simulation (never commit `.env`!)

### Data Privacy

- **Shadow prices**: Private to each team (not visible to others)
- **Negotiation history**: Only visible to involved teams
- **Funds**: Team balances are private until leaderboard reveal

### Input Validation

- **API-level**: All endpoints validate chemical types, quantities, prices
- **Client-side**: Real-time checks prevent invalid submissions
- **SQL Injection**: N/A (file-based storage)

---

## License

MIT License - See [LICENSE](./LICENSE) file

---

## Credits

**Original Concept**: Educational business simulation game
**Developed By**: Computer Science Department, Stony Brook University
**Technologies**: PHP, JavaScript, Tailwind CSS, Puppeteer
**Special Thanks**: To all the student teams who play-tested this game

---

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/cndq/issues)
- **Documentation**: See [docs/](./docs/) directory
- **Email**: cndq-support@stonybrook.edu

---

## Version History

- **v2.0** (2024) - Buy-only marketplace, web components, accessibility overhaul
- **v1.0** (2023) - Initial digital implementation
- **v0.x** (2022) - Physical classroom game with blackboard

---

**Happy Trading!** 🧪💰📈
