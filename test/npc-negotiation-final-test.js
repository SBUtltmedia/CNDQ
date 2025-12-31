const puppeteer = require('puppeteer');
const { execSync } = require('child_process');

async function runNPCCycle() {
    console.log('  [Action] Triggering NPC trading cycle via cron script...');
    try {
        execSync('php cron/npc_runner.php');
    } catch (e) {
        console.warn('  [Warning] NPC runner script failed:', e.message);
    }
}

async function testNPCNegotiation() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    page.on('console', msg => console.log('  [Browser]', msg.text()));
    await page.setViewport({ width: 1280, height: 1024 });

    console.log('Starting NPC Negotiation Response Test (Fixed Flow)...\n');

    try {
        // 1. Login
        console.log('Step 1: Logging in as Team 1...');
        await page.goto('http://cndq.test/dev_login.php?user=test_mail1@stonybrook.edu', { waitUntil: 'networkidle2' });
        console.log('✓ Logged in');

        // 2. Wait for Marketplace to load
        console.log('Step 2: Waiting for Marketplace to initialize...');
        await page.waitForSelector('#app:not(.hidden)');
        console.log('✓ Marketplace loaded');

        // 3. Look for "Measured Otter" (NPC) BUY request for Chemical C
        console.log('Step 3: Finding NPC buy request...');
        
        let npcAd = null;
        let retryCount = 0;
        while (!npcAd && retryCount < 3) {
            await runNPCCycle();
            await new Promise(r => setTimeout(r, 3000)); // Wait for polling to update UI
            
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
                console.log(`  NPC buy request not found, retrying... (${retryCount + 1}/3)`);
                retryCount++;
            }
        }

        if (!npcAd) {
            throw new Error('Could not find Measured Otter buy request for Chemical C');
        }
        console.log('✓ Clicked "Sell to" (Negotiate) on Measured Otter\'s buy request');

        // 4. Fill Respond Modal
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

        // 5. Wait for NPC response
        console.log('Step 5: Waiting for NPC response (up to 60s)...');
        let responded = false;
        let attempts = 0;
        while (!responded && attempts < 12) {
            attempts++;
            console.log(`  Wait cycle ${attempts}/12...`);
            
            // Trigger NPC runner
            await runNPCCycle();
            await new Promise(r => setTimeout(r, 5000));
            
            // Check status in UI
            const status = await page.evaluate(() => {
                const negCard = document.querySelector('negotiation-card');
                if (!negCard) return 'not_found';
                return negCard.negotiation.status;
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

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        await page.screenshot({ path: 'test-failure.png' });
        process.exit(1);
    } finally {
        await browser.close();
    }
}

testNPCNegotiation();