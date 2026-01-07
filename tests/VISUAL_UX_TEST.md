# Visual UX Test - UI-Only with Screenshots

**True UI/UX testing** simulating a realistic classroom scenario with screenshots at every step.

## What This Test Does

Simulates a **real classroom session** where:
- **1 Admin (Instructor)** manages the game through the UI
- **3 Students (Alice, Bob, Charlie)** play through the UI
- **2 Complete game sessions**
- **Screenshots captured** at every major UI interaction

## 🎯 Pure UI Testing - No API Calls

This test **only interacts with the UI**:
- ✅ Clicking buttons
- ✅ Filling forms
- ✅ Switching tabs
- ✅ Reading from UI elements
- ❌ No direct API calls
- ❌ No database manipulation

## 🎬 Test Flow

### Phase 1: Admin Setup
1. **Admin logs in** via dev.php
2. **Views admin panel** (screenshot)
3. **Clicks "Reset Game"** button (screenshot)
4. **Clicks "Start Game"** button (screenshot)
5. **Configures settings** - trading duration (screenshot)

### Phase 2: Students Play (×2 sessions)

**Each Student:**
1. **Logs in** and views dashboard (screenshot)
2. **Views inventory** section (screenshot)
3. **Opens marketplace** tab (screenshot)
4. **Posts advertisement**:
   - Clicks "Post Ad" button (screenshot)
   - Fills form: chemical, type, message (screenshot)
   - Submits (screenshot)
5. **Creates sell offer**:
   - Clicks "Create Offer" button (screenshot)
   - Fills form: chemical, quantity, price (screenshot)
   - Submits (screenshot)
6. **Views negotiations** tab (screenshot)
7. **Checks production** tab (screenshot)

**Student Interactions:**
1. **Alice initiates negotiation** with Bob:
   - Sees Bob's offer in marketplace (screenshot)
   - Clicks "Negotiate" button (screenshot)
   - Fills negotiation form (screenshot)
2. **Bob responds**:
   - Sees pending negotiation (screenshot)
   - Accepts or counters (screenshot)

**Admin Advances Session:**
1. **Opens admin panel** (screenshot)
2. **Clicks "Advance Session"** button (screenshot)
3. **Verifies new session** number (screenshot)

### Phase 3: Final Review

**Admin:**
1. Views final game state (screenshot)
2. Checks leaderboard (screenshot)
3. Views statistics (screenshot)

**Each Student:**
1. Views final dashboard (screenshot)

## 📸 Screenshots

All screenshots saved to: `screenshots/ux-test/`

### Naming Convention

```
001-admin-admin-panel-initial.png
002-admin-after-reset.png
003-admin-game-started.png
004-admin-settings-configured.png
005-Alice-dashboard-initial-s1.png
006-Alice-inventory-view-s1.png
007-Alice-marketplace-open-s1.png
008-Alice-ad-form-open-s1.png
009-Alice-ad-form-filled-s1.png
010-Alice-ad-posted-s1.png
...
```

**Format**: `NNN-actor-description.png`
- `NNN` - Sequential number (001, 002, etc.)
- `actor` - Who is performing the action (admin, Alice, Bob, Charlie)
- `description` - What's happening

## 🚀 Run the Test

```bash
# Watch it run (recommended first time)
npm run test:ux

# Headless mode (faster)
npm run test:ux:headless
```

## 📊 Expected Output

```
🎓 VISUAL UX TEST - Classroom Simulation
============================================================
Admin: admin@stonybrook.edu
Students: Alice, Bob, Charlie
Sessions: 2
Screenshots: ./screenshots/ux-test
============================================================

👨‍🏫 PHASE 1: ADMIN GAME SETUP
------------------------------------------------------------
   📸 Screenshot: 001-admin-admin-panel-initial.png
   🔄 Admin: Clicking Reset Game button...
   📸 Screenshot: 002-admin-after-reset.png
   ✅ Game reset
   ▶️  Admin: Clicking Start Game button...
   📸 Screenshot: 003-admin-game-started.png
   ✅ Game started
   ⚙️  Admin: Configuring game settings...
   ⏱️  Trading duration set to 300 seconds
   📸 Screenshot: 004-admin-settings-configured.png
   ✅ Admin setup complete

🎮 SESSION 1
------------------------------------------------------------

   👤 Alice (Session 1)
      📸 Screenshot: 005-Alice-dashboard-initial-s1.png
      📦 Alice: Viewing inventory...
      📸 Screenshot: 006-Alice-inventory-view-s1.png
      🏪 Alice: Opening marketplace...
      📸 Screenshot: 007-Alice-marketplace-open-s1.png
      📢 Alice: Posting advertisement...
      📸 Screenshot: 008-Alice-ad-form-open-s1.png
      📸 Screenshot: 009-Alice-ad-form-filled-s1.png
      📸 Screenshot: 010-Alice-ad-posted-s1.png
      ✅ Advertisement posted
      ...

   🔄 STUDENT INTERACTIONS (Session 1)
      💬 Alice: Initiating negotiation with Bob...
      📸 Screenshot: 025-Alice-sees-bobs-offer-s1.png
      ✅ Negotiation initiated
      💬 Bob: Responding to Alice's negotiation...
      📸 Screenshot: 026-Bob-sees-negotiation-s1.png
      ✅ Bob accepted negotiation

   👨‍🏫 ADMIN: Advancing from Session 1
   📸 Screenshot: 027-admin-before-advance-s1.png
   📸 Screenshot: 028-admin-after-advance-s1.png
   ✅ Advanced to Session 2

🎮 SESSION 2
------------------------------------------------------------
   [Same flow repeats...]

📊 PHASE 3: ADMIN FINAL REVIEW
------------------------------------------------------------
   📸 Screenshot: 055-admin-final-state.png
   🏆 Admin: Checking leaderboard...
   📸 Screenshot: 056-admin-final-leaderboard.png
   📈 Admin: Viewing team statistics...
   📸 Screenshot: 057-admin-final-stats.png
   ✅ Admin review complete
   📊 Alice: Viewing final results...
   📸 Screenshot: 058-Alice-final-dashboard.png
   ...

✅ Visual UX Test Complete!
📁 Screenshots saved to: ./screenshots/ux-test
📸 Total screenshots: 60+
```

## 🎯 What Gets Tested

### UI Elements

**Admin Panel:**
- [ ] Reset game button
- [ ] Start game button
- [ ] Trading duration input
- [ ] Advance session button
- [ ] Leaderboard display
- [ ] Statistics view

**Student Dashboard:**
- [ ] Inventory display
- [ ] Marketplace tab
- [ ] Negotiations tab
- [ ] Production tab
- [ ] Advertisement form
- [ ] Offer creation form
- [ ] Negotiation controls

### User Flows

**Admin:**
- [ ] Setup new game
- [ ] Configure settings
- [ ] Advance sessions
- [ ] Review results

**Students:**
- [ ] View inventory
- [ ] Browse marketplace
- [ ] Post advertisements
- [ ] Create offers
- [ ] Initiate negotiations
- [ ] Respond to negotiations
- [ ] Check production

### Interactions

- [ ] Student A initiates negotiation with Student B
- [ ] Student B responds to negotiation
- [ ] Admin advances session after trading
- [ ] All students see updated session number

## 📝 Customization

Edit CONFIG in [visual-ux-test.js](visual-ux-test.js):

```javascript
const CONFIG = {
    baseUrl: 'http://cndq.test/CNDQ',
    adminUser: 'admin@stonybrook.edu',
    students: [
        { email: 'student1@stonybrook.edu', name: 'Alice' },
        { email: 'student2@stonybrook.edu', name: 'Bob' },
        { email: 'student3@stonybrook.edu', name: 'Charlie' }
    ],
    targetSessions: 2,  // Number of sessions to play
    headless: false,
    screenshotDir: './screenshots/ux-test',
    slowMo: 100  // ms delay between actions (for visibility)
};
```

## 🔍 Reviewing Screenshots

After the test:

1. **Open screenshot folder**: `screenshots/ux-test/`
2. **Review in order**: Files are numbered sequentially
3. **Check UI state**: Each screenshot shows actual UI at that moment
4. **Verify flows**: Follow a student's journey through their numbered screenshots

### Quick Review

```bash
# Open folder
cd screenshots/ux-test

# View by actor
ls *Alice* | sort
ls *Bob* | sort
ls *admin* | sort

# View by session
ls *s1* | sort
ls *s2* | sort
```

## 🐛 Troubleshooting

### No screenshots generated

**Fix**: Check `screenshotDir` exists and is writable

```bash
mkdir -p screenshots/ux-test
```

### UI elements not found

**Fix**: Update selectors in `visual-ux-test.js`

Current selectors:
```javascript
'#reset-game-btn'              // Reset button
'#start-game-btn'              // Start button
'button[data-tab="marketplace"]' // Marketplace tab
'#post-ad-btn'                 // Post ad button
```

Check your HTML and update selectors to match.

### Test runs too fast

**Fix**: Increase `slowMo` in CONFIG

```javascript
slowMo: 500  // 500ms delay between actions
```

## 📚 Related Tests

- **[API Tests](API_TESTING.md)** - Direct API testing
- **[Dual Testing](DUAL_TESTING.md)** - UI vs API comparison
- **[Game Simulation](README.md)** - Full game flow tests

## ✨ Summary

This test provides:
- ✅ **Visual documentation** of UI/UX
- ✅ **Real user simulation** (admin + students)
- ✅ **Screenshot evidence** at every step
- ✅ **No API dependencies** - pure UI testing
- ✅ **Easy to review** - numbered screenshots
- ✅ **Realistic scenario** - classroom use case

Perfect for:
- 🎓 **Demonstrating UI** to stakeholders
- 🐛 **Debugging UI issues** visually
- 📖 **Creating documentation** from screenshots
- ✅ **Regression testing** UI changes

Run `npm run test:ux` and watch your UI come to life! 🚀
