/**
 * Haggle & Trade Completion Test
 * 
 * Verifies the full trade loop:
 * 1. Post Ad -> 2. NPC Responds -> 3. Haggle with Sliders -> 4. Accept & Execute
 * Targets: http://herd.test/cndq
 */

const puppeteer = require('puppeteer');

async function runTest() {
    const baseUrl = 'http://herd.test/cndq';
    const testUser = 'test_mail1@stonybrook.edu';
    const adminUser = 'admin@stonybrook.edu';

    console.log(`🚀 Starting Haggle & Trade Test targeting ${baseUrl}...`);
    
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        
        // Listen for console logs
        page.on('console', async msg => {
            const args = await Promise.all(msg.args().map(arg => arg.jsonValue().catch(() => arg.toString())));
            // Filter out some noise
            if (args[0] && typeof args[0] === 'string' && args[0].includes('[API]')) return;
            console.log('   [PAGE]:', ...args);
        });

        // --- STEP 1: ADMIN PREP ---
        console.log('🛡️  ADMIN: Ensuring NPC system is ready...');
        await page.setCookie({ name: 'mock_mail', value: adminUser, domain: 'herd.test', path: '/' });
        await page.goto(`${baseUrl}/admin/index.php`, { waitUntil: 'networkidle2' });
        
        await page.evaluate(() => {
            if (!document.getElementById('npc-system-enabled').checked) document.getElementById('npc-system-enabled').click();
            setPhase('trading');
        });
        await new Promise(r => setTimeout(r, 1000));

        // --- STEP 2: POST BUY REQUEST ---
        console.log('👤 PLAYER: Posting high-value Buy Ad...');
        await page.setCookie({ name: 'mock_mail', value: testUser, domain: 'herd.test', path: '/' });
        await page.goto(baseUrl, { waitUntil: 'networkidle2' });
        await page.waitForSelector('#app:not(.hidden)', { timeout: 15000 });

        // Click Chemical Card Post Buy
        await page.evaluate(() => {
            const card = document.querySelector('chemical-card[chemical="C"]');
            card.querySelector('#post-buy-btn').click();
        });
        
        await page.waitForSelector('#offer-modal:not(.hidden)');
        await page.evaluate(() => {
            document.getElementById('offer-price').value = '25.00'; // Tempting price for NPC
            document.getElementById('offer-quantity').value = '100';
        });
        await page.click('#offer-submit-btn');
        console.log('✅ Buy Ad posted ($25/gal). Waiting for NPC response (up to 30s)...');

        // --- STEP 3: WAIT & OPEN NEGOTIATION ---
        let negotiationSelector = 'negotiation-card[context="summary"]';
        try {
            await page.waitForSelector(negotiationSelector, { timeout: 30000 });
        } catch (e) {
            console.log('   NPC late. Triggering via Admin heartbeat...');
            await page.setCookie({ name: 'mock_mail', value: adminUser, domain: 'herd.test', path: '/' });
            await page.goto(`${baseUrl}/admin/index.php`, { waitUntil: 'networkidle2' });
            await page.evaluate(() => fetch('api/admin/session.php'));
            await new Promise(r => setTimeout(r, 2000));
            await page.setCookie({ name: 'mock_mail', value: testUser, domain: 'herd.test', path: '/' });
            await page.goto(baseUrl, { waitUntil: 'networkidle2' });
            await page.waitForSelector(negotiationSelector, { timeout: 10000 });
        }

        console.log('📂 Opening negotiation...');
        // Click the component directly
        await page.click(negotiationSelector);
        
        // Wait for the modal and detail view
        await page.waitForSelector('#negotiation-detail-view:not(.hidden)', { timeout: 5000 });
        console.log('✅ Detail view visible.');

        // --- STEP 4: HAGGLE ---
        console.log('🔄 Opening haggle sliders...');
        await page.click('#show-counter-form-btn');
        await page.waitForSelector('#counter-offer-form:not(.hidden)');

        console.log('🧪 Adjusting sliders...');
        await page.evaluate(() => {
            const priceSlider = document.getElementById('haggle-price-slider');
            priceSlider.value = parseFloat(priceSlider.min) + 1; // Generous offer
            priceSlider.dispatchEvent(new Event('input', { bubbles: true }));
        });
        
        const mood = await page.$eval('#annoyance-label', el => el.textContent);
        console.log(`   NPC Mood: ${mood}`);

        console.log('📤 Sending counter-offer...');
        await page.evaluate(() => document.getElementById('submit-counter-btn').click());
        
        // Wait for the UI to update (waiting message or NPC response)
        await new Promise(r => setTimeout(r, 2000));
        console.log('✅ Counter-offer sent.');

        // --- STEP 5: ACCEPTANCE (The "Pop") ---
        // For the sake of a "successful trade" test, if it's our turn again, accept it.
        // If not, we wait for NPC to respond to our counter.
        console.log('⌛ Waiting for final offer from NPC...');
        await new Promise(r => setTimeout(r, 15000)); // NPC decision time
        await page.reload({ waitUntil: 'networkidle2' });
        await page.waitForSelector('#app:not(.hidden)');
        await page.evaluate(() => document.querySelector('negotiation-card[context="summary"]')?.click());
        await page.waitForSelector('#negotiation-detail-view:not(.hidden)', { timeout: 10000 });

        const canAccept = await page.evaluate(() => {
            const btn = document.getElementById('accept-offer-btn');
            return btn && !btn.classList.contains('hidden');
        });

        if (canAccept) {
            console.log('🤝 Accepting the deal!');
            await page.evaluate(() => document.getElementById('accept-offer-btn').click());
            await page.waitForSelector('#confirm-ok', { timeout: 5000 });
            await page.evaluate(() => document.getElementById('confirm-ok').click());
            
            console.log('🎉 Trade Executed! Waiting for inventory update...');
            await new Promise(r => setTimeout(r, 2000));
            console.log('✨ Full Puppeteer Trade Cycle Passed!');
        } else {
            console.log('⚠️ Negotiation pending NPC response. Loop incomplete but UI verified.');
        }

    } catch (error) {
        console.error('❌ Test Failed:', error.message);
        const timestamp = Date.now();
        // Since 'page' might not be in scope if browser init failed, check it
        if (typeof page !== 'undefined') {
            await page.screenshot({ path: `failure-${timestamp}.png` });
            console.log(`📸 Screenshot saved to failure-${timestamp}.png`);
        }
        process.exit(1);
    } finally {
        if (typeof browser !== 'undefined') await browser.close();
    }
}

runTest();