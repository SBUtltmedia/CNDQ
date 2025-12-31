# NPC Negotiation Response Test Plan

## Overview
This test verifies that NPCs can now respond to player buy requests (negotiations) with accept, counter, or reject actions based on their skill level and inventory.

## Bug Being Tested
**Issue**: NPCs were not responding to player-initiated negotiations. When players sent buy requests to NPCs, the negotiations would remain in "pending" status indefinitely.

**Fix**: Added negotiation handling logic to all three NPC strategies (Beginner, Novice, Expert) that runs every trading cycle (~10 seconds).

## Prerequisites
1. Herd server running at http://cndq.test/
2. NPCs enabled in admin panel
3. At least one NPC of each skill level active (Beginner, Novice, Expert)
4. Session in Trading Phase
5. Player has sufficient funds (~$5000+)

## Manual Test Steps

### Setup
1. Navigate to http://cndq.test/
2. Login as a player
3. Go to Admin Panel
4. Ensure NPCs are enabled and active
5. Create NPCs if needed:
   - 1 Beginner NPC
   - 1 Novice NPC
   - 1 Expert NPC
6. Start Session and advance to Trading Phase

### Test 1: Beginner NPC Response (Random Behavior)
**Expected**: Beginner NPCs respond randomly (30% chance per cycle)

1. Go to Negotiations page
2. Click "Start New Negotiation"
3. Select a Beginner NPC from the dropdown
4. Enter negotiation details:
   - Chemical: Q
   - Quantity: 100
   - Price: $3.00/gal
5. Submit negotiation
6. Wait 10-30 seconds and refresh
7. **Verify**: NPC should eventually respond with Accept, Counter, or Reject
8. **Check logs**: Look for message like `"NPC [TeamName] accepted/countered/rejected negotiation..."`

### Test 2: Novice NPC Response (Inventory-Based)
**Expected**: Novice NPCs only sell when they have excess inventory (>1800 gal) at price ≥ $3.00

#### Test 2a: Low Price (Should Reject or Counter)
1. Start negotiation with Novice NPC
2. Offer:
   - Chemical: N
   - Quantity: 200
   - Price: $2.00/gal (below threshold)
3. Wait 10-30 seconds
4. **Verify**: NPC should reject OR counter at $3.00/gal

#### Test 2b: Good Price with Excess Inventory (Should Accept)
1. Check Novice NPC inventory in admin panel
2. If NPC has >1800 gal of a chemical, start negotiation:
   - Chemical: [the one with >1800]
   - Quantity: 300
   - Price: $3.50/gal (above threshold)
3. Wait 10-30 seconds
4. **Verify**: NPC should accept
5. **Verify**: Trade executes (check inventory changes)

#### Test 2c: Low Inventory (Should Reject)
1. Check Novice NPC inventory for chemical <1800 gal
2. Start negotiation for that chemical
3. **Verify**: NPC should reject within 30 seconds

### Test 3: Expert NPC Response (Shadow Price Analysis)
**Expected**: Expert NPCs use LP solver to calculate shadow prices and only accept if offer price ≥ (shadow price × 1.05)

#### Test 3a: Low Offer (Should Counter or Reject)
1. Start negotiation with Expert NPC
2. Offer:
   - Chemical: C
   - Quantity: 400
   - Price: $2.50/gal
3. Wait 10-30 seconds
4. **Verify**: NPC should counter with higher price OR reject

#### Test 3b: High Offer (Should Accept)
1. Start negotiation with Expert NPC
2. Offer:
   - Chemical: D
   - Quantity: 500
   - Price: $4.50/gal (high price)
3. Wait 10-30 seconds
4. **Verify**: NPC should accept if they have inventory

### Test 4: Multiple Pending Negotiations
**Expected**: NPCs handle one negotiation at a time

1. Create 3 negotiations with the same NPC
2. Wait for NPC to respond
3. **Verify**: NPC responds to first negotiation
4. Wait another cycle
5. **Verify**: NPC then responds to second negotiation
6. Continue until all handled

### Test 5: Counter-Offer Flow
**Expected**: Players can accept NPC counter-offers

1. Start negotiation at low price (e.g., $2.00/gal)
2. Wait for NPC to counter
3. Accept the NPC's counter-offer
4. **Verify**: Trade executes
5. **Verify**: Both player and NPC inventories update
6. **Verify**: Funds transfer correctly

## Puppeteer Automated Test

```javascript
// test/npc-negotiation-test.js
const puppeteer = require('puppeteer');

async function testNPCNegotiationResponse() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  console.log('Starting NPC Negotiation Response Test...\n');

  try {
    // 1. Login
    await page.goto('http://cndq.test/login.html');
    await page.type('input[name="email"]', 'test@example.com');
    await page.type('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();
    console.log('✓ Logged in');

    // 2. Verify NPCs are enabled and get NPC list
    await page.goto('http://cndq.test/admin.php');
    await page.waitForSelector('.npc-section');

    const npcEnabled = await page.$eval('#npcEnabled', el => el.checked);
    if (!npcEnabled) {
      throw new Error('NPCs are not enabled! Enable in admin panel first.');
    }
    console.log('✓ NPCs enabled');

    // Get list of active NPCs
    const npcs = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.npc-table tbody tr'));
      return rows.map(row => ({
        email: row.querySelector('td:nth-child(1)').textContent.trim(),
        teamName: row.querySelector('td:nth-child(2)').textContent.trim(),
        skillLevel: row.querySelector('td:nth-child(3)').textContent.trim()
      })).filter(npc => npc.email.includes('npc_'));
    });

    if (npcs.length === 0) {
      throw new Error('No NPCs found! Create NPCs in admin panel first.');
    }
    console.log(`✓ Found ${npcs.length} NPC(s):`, npcs.map(n => n.teamName).join(', '));

    // 3. Start negotiation with first NPC
    const testNPC = npcs[0];
    console.log(`\nTesting negotiation with ${testNPC.teamName} (${testNPC.skillLevel})...`);

    await page.goto('http://cndq.test/negotiations.html');
    await page.waitForSelector('button:has-text("Start New Negotiation")');
    await page.click('button:has-text("Start New Negotiation")');

    // Fill negotiation form
    await page.waitForSelector('#respondent');
    await page.select('#respondent', testNPC.email);
    await page.select('#chemical', 'Q');
    await page.type('#quantity', '200');
    await page.type('#price', '3.50');

    console.log('  Initiating negotiation: 200 gal of Q at $3.50/gal');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1000);

    // Get negotiation ID
    const negotiationId = await page.evaluate(() => {
      const rows = document.querySelectorAll('.negotiations-table tbody tr');
      return rows[0]?.getAttribute('data-negotiation-id');
    });

    if (!negotiationId) {
      throw new Error('Failed to create negotiation');
    }
    console.log(`✓ Negotiation created: ${negotiationId}`);

    // 4. Wait for NPC response (check every 5 seconds for up to 60 seconds)
    console.log('  Waiting for NPC response...');
    let responded = false;
    let attempts = 0;
    const maxAttempts = 12; // 60 seconds total

    while (!responded && attempts < maxAttempts) {
      await page.waitForTimeout(5000);
      await page.reload();

      const status = await page.evaluate((negId) => {
        const row = document.querySelector(`tr[data-negotiation-id="${negId}"]`);
        return row?.querySelector('.status')?.textContent.trim();
      }, negotiationId);

      attempts++;
      console.log(`  Check ${attempts}/${maxAttempts}: Status = ${status}`);

      if (status && status !== 'pending') {
        responded = true;
        console.log(`✓ NPC responded with: ${status}`);

        // Check for counter-offer details
        if (status === 'pending' || status.includes('counter')) {
          const latestOffer = await page.evaluate((negId) => {
            const row = document.querySelector(`tr[data-negotiation-id="${negId}"]`);
            return {
              quantity: row?.querySelector('.offer-quantity')?.textContent,
              price: row?.querySelector('.offer-price')?.textContent
            };
          }, negotiationId);
          console.log(`  Counter offer: ${latestOffer.quantity} gal at ${latestOffer.price}/gal`);
        }
      }
    }

    if (!responded) {
      throw new Error('NPC did not respond within 60 seconds! Check SessionManager trading cycle.');
    }

    // 5. Test with each skill level
    const skillLevels = ['beginner', 'novice', 'expert'];
    for (const skillLevel of skillLevels) {
      const npc = npcs.find(n => n.skillLevel.toLowerCase() === skillLevel);
      if (!npc) {
        console.log(`⚠ No ${skillLevel} NPC found, skipping...`);
        continue;
      }

      console.log(`\n--- Testing ${skillLevel.toUpperCase()} NPC: ${npc.teamName} ---`);

      // Test low price
      await page.goto('http://cndq.test/negotiations.html');
      await page.click('button:has-text("Start New Negotiation")');
      await page.waitForSelector('#respondent');
      await page.select('#respondent', npc.email);
      await page.select('#chemical', 'C');
      await page.type('#quantity', '150');
      await page.type('#price', '2.00'); // Low price
      await page.click('button[type="submit"]');

      console.log('  Testing LOW price ($2.00/gal)...');

      // Wait for response
      await page.waitForTimeout(15000);
      await page.reload();

      const lowPriceResponse = await page.evaluate(() => {
        const rows = document.querySelectorAll('.negotiations-table tbody tr');
        return rows[0]?.querySelector('.status')?.textContent.trim();
      });

      console.log(`  Response: ${lowPriceResponse}`);

      if (skillLevel === 'expert' || skillLevel === 'novice') {
        if (lowPriceResponse === 'rejected' || lowPriceResponse?.includes('counter')) {
          console.log(`  ✓ ${skillLevel} correctly rejected/countered low price`);
        }
      }
    }

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run test
testNPCNegotiationResponse().catch(console.error);
```

## Expected Results

### Beginner NPCs
- Random responses (30% chance per cycle)
- May accept, counter (±20% qty, ±15% price), or reject randomly
- Less predictable behavior

### Novice NPCs
- **Accept**: If inventory > 1800 AND price ≥ $3.00
- **Counter**: If inventory > 1800 BUT price < $3.00 (counter at $3.00)
- **Reject**: If inventory < 1800 OR cannot fulfill

### Expert NPCs
- **Accept**: If price ≥ (shadow price × 1.05)
- **Counter**: If price ≥ (shadow price × 0.95) with optimal pricing
- **Reject**: If price < (shadow price × 0.95) OR low inventory
- Most sophisticated and optimal pricing

## Success Criteria
- ✅ NPCs respond to negotiations within 30 seconds
- ✅ Different skill levels show different behaviors
- ✅ Accepted negotiations execute trades correctly
- ✅ Counter-offers update negotiation state
- ✅ Rejected negotiations update to 'rejected' status
- ✅ No console errors or PHP errors
- ✅ Inventory and funds update correctly after trades

## Debug Checklist
If NPCs are not responding:

1. **Check SessionManager is running**:
   - Look for `"[SessionManager] Trading cycle triggered"` in browser console
   - Should trigger every 10 seconds during trading phase

2. **Check NPCs are enabled**:
   - Admin panel → NPC section → System enabled checkbox

3. **Check NPCs are active**:
   - Admin panel → Each NPC should have green "Active" status

4. **Check session phase**:
   - Must be in "Trading" phase, not "Production"

5. **Check PHP error logs**:
   - Look for NPC response messages
   - Look for any PHP errors in strategy files

6. **Check browser console**:
   - No JavaScript errors blocking SessionManager
   - Trading cycle interval is running

7. **Verify negotiation file exists**:
   - Check `data/negotiations/negotiation_*.json`
   - Status should change from 'pending' to 'accepted'/'rejected'

## Files Modified in This Fix
- `lib/NPCManager.php` - Added negotiation handling
- `lib/NPCTradingStrategy.php` - Added abstract respondToNegotiations()
- `lib/strategies/BeginnerStrategy.php` - Random response logic
- `lib/strategies/NoviceStrategy.php` - Inventory-based response
- `lib/strategies/ExpertStrategy.php` - Shadow price response
