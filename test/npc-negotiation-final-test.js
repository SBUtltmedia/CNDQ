/**
 * NPC Negotiation Response Test (Refactored - Client Polling)
 *
 * Tests NPC negotiation responses using natural client polling.
 * SessionManager automatically processes NPCs when ANY client polls (throttled to 10s intervals).
 *
 * IMPORTANT: This version uses ONLY natural timing via client polling.
 * No admin heartbeat, no manual cron execution - NPCs are processed automatically
 * by SessionManager::getState() which is called by all clients every 3 seconds.
 */

const puppeteer = require('puppeteer');

async function testNPCNegotiation() {
    const baseUrl = 'http://cndq.test/CNDQ';
    const testUser = 'test_mail1@stonybrook.edu';

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    page.on('console', msg => console.log('  [Browser]', msg.text()));
    await page.setViewport({ width: 1280, height: 1024 });

    console.log('Starting NPC Negotiation Response Test (Natural Client Polling)...\n');

    try {
        // --- STEP 1: PLAYER LOGIN ---
        console.log('Step 1: Logging in as Team 1...');
        await page.goto(`${baseUrl}/dev_login.php`, { waitUntil: 'networkidle2' });
        await page.click(`a[href*="${testUser}"]`);
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        console.log('✓ Logged in');

        // --- STEP 2: WAIT FOR MARKETPLACE ---
        console.log('Step 2: Waiting for Marketplace to initialize...');
        await page.waitForSelector('#app:not(.hidden)');
        console.log('✓ Marketplace loaded');

        // --- STEP 3: FIND NPC BUY REQUEST ---
        console.log('Step 3: Finding NPC buy request...');
        console.log('   (Player polling auto-triggers NPC processing every 10s via SessionManager)');

        let npcAd = null;
        let retryCount = 0;
        while (!npcAd && retryCount < 3) {
            // Wait for natural NPC processing (client polling triggers SessionManager every 3s)
            console.log(`  Waiting for NPC processing cycle (${retryCount + 1}/3)...`);
            await new Promise(r => setTimeout(r, 12000)); // Wait for SessionManager throttle window (10s + buffer)
            await page.reload({ waitUntil: 'networkidle2' });

            npcAd = await page.evaluate(() => {
                const ads = Array.from(document.querySelectorAll('advertisement-item'));
                console.log(`Found ${ads.length} ads`);
                ads.forEach(ad => {
                    console.log(`Ad: ${ad.getAttribute('team-name')}, chem: ${ad.getAttribute('chemical')}, type: ${ad.getAttribute('type')}`);
                });
                const otterAd = ads.find(ad =>
                    ad.getAttribute('team-name') === 'Measured Otter' &&
                    ad.getAttribute('chemical') === 'C' &&
                    ad.getAttribute('type') === 'buy'
                );
                if (otterAd) {
                    const btn = otterAd.querySelector('.negotiate-btn');
                    if (btn) {
                        btn.click();
                        return true;
                    }
                }
                return false;
            });

            if (!npcAd) {
                console.log(`  NPC buy request not found, retrying...`);
                retryCount++;
            }
        }

        if (!npcAd) {
            throw new Error('Could not find Measured Otter buy request for Chemical C');
        }
        console.log('✓ Clicked "Sell to" (Negotiate) on Measured Otter\'s buy request');

        // --- STEP 4: FILL RESPOND MODAL ---
        console.log('Step 4: Filling respond offer (initiating negotiation)...');
        await page.waitForSelector('#respond-modal:not(.hidden)');

        // Clear and type
        await page.click('#respond-quantity', { clickCount: 3 });
        await page.type('#respond-quantity', '100');

        await page.click('#respond-price', { clickCount: 3 });
        await page.type('#respond-price', '3.50'); // Offer a price

        console.log('  Offering 100 gal @ $3.50/gal');
        await page.click('#respond-submit-btn');
        console.log('✓ Offer sent');

        // --- STEP 5: WAIT FOR NPC RESPONSE ---
        console.log('Step 5: Waiting for NPC response (up to 60s)...');
        console.log('  (Client polling auto-triggers SessionManager every 3s, NPCs process every 10s)');

        let responded = false;
        let attempts = 0;
        while (!responded && attempts < 12) {
            attempts++;
            console.log(`  Wait cycle ${attempts}/12...`);

            // Wait for natural NPC processing via client polling
            await new Promise(r => setTimeout(r, 5000));

            // Check status in UI
            const status = await page.evaluate(() => {
                const negCard = document.querySelector('negotiation-card');
                if (!negCard) return 'not_found';
                return negCard.negotiation ? negCard.negotiation.status : 'no_negotiation';
            });

            const isMyTurn = await page.evaluate(() => {
                const badge = document.querySelector('negotiation-card .bg-green-600');
                return badge && badge.textContent.includes('Your Turn');
            });

            console.log(`  Current negotiation status: ${status}, Is My Turn: ${isMyTurn}`);

            if (status === 'accepted') {
                responded = true;
                console.log('✅ SUCCESS: NPC ACCEPTED THE NEGOTIATION!');
                break;
            } else if (status === 'rejected') {
                responded = true;
                console.log('✅ SUCCESS: NPC REJECTED THE NEGOTIATION! (Response received)');
                break;
            } else if (status === 'pending' && isMyTurn) {
                responded = true;
                console.log('✅ SUCCESS: NPC COUNTERED THE NEGOTIATION!');
                break;
            }
        }

        if (!responded) {
            throw new Error('NPC did not respond within timeout');
        }

        console.log('\n✅ TEST COMPLETED SUCCESSFULLY!');
        console.log('   Natural NPC processing via client polling works as expected.');

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        await page.screenshot({ path: 'test-failure.png' });
        console.log('📸 Screenshot saved to test-failure.png');
        process.exit(1);
    } finally {
        await browser.close();
    }
}

testNPCNegotiation();
