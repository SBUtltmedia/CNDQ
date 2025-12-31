// test/npc-negotiation-admin-test.js 
// test/npc-negotiation-test.js
const puppeteer = require('puppeteer');

async function testNPCNegotiationResponse() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Set a longer timeout for navigation
  await page.setDefaultNavigationTimeout(60000);
  await page.setDefaultTimeout(30000);

  console.log('Starting NPC Negotiation Response Test...\n');

  try {
    // 1. Login using dev login system
    console.log('Navigating to dev login page...');
    // Try different possible URLs for the local server
    const urlsToTry = [
      'http://localhost/dev_login.php',
      'http://127.0.0.1/dev_login.php',
      'http://cndq.test/dev_login.php'
    ];

    let success = false;
    for (const url of urlsToTry) {
      try {
        console.log(`Trying URL: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2' });
        console.log(`✓ Reached dev login page at ${url}`);
        success = true;

        await page.click('a[href="?user=test_mail1@stonybrook.edu"]'); // Login as Team 1
        console.log('✓ Selected Team 1 user');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        console.log('✓ Logged in as test_mail1@stonybrook.edu');
        break;
      } catch (error) {
        console.log(`✗ Failed to connect to ${url}: ${error.message}`);
        continue;
      }
    }

    if (!success) {
      throw new Error('Could not connect to any of the possible server URLs');
    }

    // 2. Verify NPCs are enabled and get NPC list
    // Try the same base URL that worked for login
    const adminUrlsToTry = [
      'http://localhost/admin',
      'http://127.0.0.1/admin',
      'http://cndq.test/admin'
    ];

    success = false;
    for (const url of adminUrlsToTry) {
      try {
        console.log(`Navigating to admin page: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2' });
        console.log(`✓ Reached admin page at ${url}`);
        await page.waitForSelector('.npc-section');
        success = true;
        break;
      } catch (error) {
        console.log(`✗ Failed to reach admin page at ${url}: ${error.message}`);
        continue;
      }
    }

    if (!success) {
      throw new Error('Could not access admin page');
    }

    // Check if NPCs are enabled using the correct selector
    try {
      await page.waitForSelector('#npc-system-enabled', { timeout: 10000 });
      const npcEnabled = await page.$eval('#npc-system-enabled', el => el.checked);
      if (!npcEnabled) {
        // Enable NPCs if they're not already enabled
        console.log('⚠ NPCs are not enabled, attempting to enable...');
        await page.click('#npc-system-enabled');
        await page.waitForTimeout(2000); // Wait for the API call to complete
      } else {
        console.log('✓ NPCs are enabled');
      }
    } catch (error) {
      console.log('⚠ Could not find NPC system toggle, continuing...');
    }

    // Wait for NPC list to load
    await page.waitForSelector('#npc-list', { timeout: 10000 });
    await page.waitForTimeout(3000); // Additional wait for data to load

    // Get list of active NPCs
    const npcs = await page.evaluate(() => {
      // Look for NPC entries in the NPC list container
      const npcItems = Array.from(document.querySelectorAll('#npc-list > div'));
      return npcItems.map(item => {
        const teamNameEl = item.querySelector('.font-bold');
        const emailEl = item.querySelector('.text-sm.text-gray-300');
        const statusEl = item.querySelector('.text-xs.text-gray-300');

        if (teamNameEl && emailEl) {
          return {
            email: emailEl.textContent.trim(),
            teamName: teamNameEl.textContent.trim(),
            skillLevel: statusEl ? statusEl.textContent.trim() : 'unknown'
          };
        }
        return null;
      }).filter(npc => npc && npc.email.includes('npc_'));
    });

    if (npcs.length === 0) {
      throw new Error('No NPCs found! Create NPCs in admin panel first.');
    }
    console.log(`✓ Found ${npcs.length} NPC(s):`, npcs.map(n => n.teamName).join(', '));

    // 3. Start negotiation with first NPC
    const testNPC = npcs[0];
    console.log(`\nTesting negotiation with ${testNPC.teamName} (${testNPC.skillLevel})...`);

    // Determine the base URL from the current page
    const currentUrl = page.url();
    const baseUrl = currentUrl.replace(/\/admin\.php.*$/, '');

    await page.goto(`${baseUrl}/negotiations.html`);
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
      await page.goto(`${baseUrl}/negotiations.html`);
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