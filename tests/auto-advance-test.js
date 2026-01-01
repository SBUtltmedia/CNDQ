/**
 * MANUAL DIAGNOSTIC TEST for Haggle UI
 * 
 * This test will open a VISIBLE browser window and pause.
 * PLEASE FOLLOW THE INSTRUCTIONS IN THE CONSOLE.
 */

const puppeteer = require('puppeteer');

async function runTest() {
    const baseUrl = 'http://herd.test/cndq';
    const testUser = 'test_mail1@stonybrook.edu';
    const adminUser = 'admin@stonybrook.edu';

    console.log(`🚀 Starting MANUAL DIAGNOSTIC targeting ${baseUrl}...`);
    
    const browser = await puppeteer.launch({
        headless: false, // <-- BROWSER WILL BE VISIBLE
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1400, height: 900 }
    });

    let page;

    try {
        page = await browser.newPage();
        
        // --- ADMIN SETUP ---
        console.log('🛡️  ADMIN: Setting up short timers and enabling NPCs...');
        await page.setCookie({ name: 'mock_mail', value: adminUser, domain: 'herd.test', path: '/' });
        await page.goto(`${baseUrl}/admin/index.php`, { waitUntil: 'networkidle2' });
        
        await page.evaluate(async () => {
            if (!document.getElementById('npc-system-enabled').checked) document.getElementById('npc-system-enabled').click();
            await new Promise(r => setTimeout(r, 200));
            setPhase('trading');
        });
        console.log('✅ Admin setup complete.');

        // --- PLAYER ACTION ---
        console.log('👤 PLAYER: Logging in and posting Buy Ad...');
        await page.setCookie({ name: 'mock_mail', value: testUser, domain: 'herd.test', path: '/' });
        await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForSelector('#app');

        console.log('📝 Posting activity ad to trigger NPC...');
        await page.waitForFunction(() => customElements.get('chemical-card'));
        await page.click('chemical-card[chemical="C"] .btn');
        await page.waitForSelector('#offer-modal:not(.hidden)');
        await page.click('#offer-submit-btn');
        
        console.log('\n✅ Setup Complete. The script will now pause.');
        console.log('==================================================');
        console.log('🔴 YOUR TURN: Please interact with the browser window.');
        console.log('1. Wait for a "Negotiation Card" to appear under "MY NEGOTIATIONS".');
        console.log('2. Click on it.');
        console.log('3. Does the negotiation detail modal open?');
        console.log('==================================================');
        
        await new Promise(r => setTimeout(r, 60000)); // Pause for 60 seconds

        console.log('⌛ 60 seconds have passed. Test finished.');

    } catch (error) {
        console.error('❌ Test Failed During Setup:', error.message);
        if (page) {
            await page.screenshot({ path: 'manual-test-failure.png' });
        }
        process.exit(1);
    } finally {
        await browser.close();
    }
}

runTest();