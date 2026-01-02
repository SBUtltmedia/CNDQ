/**
 * Auto-Advance Integration Test
 * 
 * Verifies that the game advances automatically based on timers
 * without any admin interaction after initial setup.
 */

const puppeteer = require('puppeteer');

async function runTest() {
    const baseUrl = 'http://herd.test/cndq';
    const adminUser = 'admin@stonybrook.edu';
    const testUser = 'test_mail1@stonybrook.edu';

    console.log(`🚀 Starting Auto-Advance Test targeting ${baseUrl}...`);
    
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    let page; // Define page in a higher scope

    try {
        page = await browser.newPage();
        // --- STEP 1: ADMIN SETUP ---
        console.log('🛡️  ADMIN: Setting up short timers and enabling NPCs...');
        await page.setCookie({ name: 'mock_mail', value: adminUser, domain: 'herd.test', path: '/' });
        await page.goto(`${baseUrl}/admin/index.php`, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // 1. Reset Game for clean slate
        console.log('   Resetting game data...');
        // We'll use evaluate to bypass modals for speed
        await page.evaluate(async () => {
            await fetch('api/admin/reset-game.php', { method: 'POST' });
        });
        await new Promise(r => setTimeout(r, 2000));
        await page.reload({ waitUntil: 'networkidle2' });

        // 2. Setup NPCs (one of each)
        console.log('   Creating NPCs (Beginner, Novice, Expert)...');
        await page.evaluate(async () => {
            const levels = ['beginner', 'novice', 'expert'];
            for (const level of levels) {
                await fetch('api/admin/npc/create.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ skillLevel: level, count: 1 })
                });
            }
            // Enable NPC system
            await fetch('api/admin/npc/toggle-system.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: true })
            });
        });

        // 3. Configure Auto-Advance with SHORT timers (10s trading, 5s production)
        console.log('   Configuring short session timers...');
        await page.evaluate(async () => {
            await fetch('api/admin/session.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'setTradingDuration', seconds: 10 })
            });
            await fetch('api/admin/session.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'setProductionDuration', seconds: 5 })
            });
            await fetch('api/admin/session.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'setAutoAdvance', enabled: true })
            });
            // Force start at Trading phase
            await fetch('api/admin/session.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'setPhase', phase: 'trading' })
            });
        });

        console.log('✅ Admin setup complete. Closing admin session...');

        // --- STEP 2: PLAYER OBSERVATION ---
        console.log('👤 PLAYER: Logging in to watch the world turn...');
        await page.setCookie({ name: 'mock_mail', value: testUser, domain: 'herd.test', path: '/' });
        await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForSelector('#app:not(.hidden)');

        // Post a single ad so Auto-Advance doesn't stop (it checks for activity)
        console.log('📝 Posting activity ad to keep auto-advance alive...');
        await page.evaluate(() => {
            const card = document.querySelector('chemical-card[chemical="C"]');
            if (card) {
                // Lit components have their own render lifecycle, access internal button
                const btn = card.renderRoot.querySelector('.btn');
                if (btn) btn.click();
            }
        });
        await page.waitForSelector('#offer-modal:not(.hidden)');
        await page.click('#offer-submit-btn');

        const getStatus = async () => {
            return await page.evaluate(() => {
                return {
                    session: document.getElementById('session-num-display').innerText.trim(),
                    phase: document.getElementById('phase-badge').innerText.trim(),
                    timer: document.getElementById('session-timer').innerText.trim()
                };
            });
        };

        let initialStatus = await getStatus();
        console.log(`⏱️ Initial State: Session ${initialStatus.session}, Phase: ${initialStatus.phase}, Time: ${initialStatus.timer}`);

        console.log('⌛ Waiting for Trading Phase to expire (10s)...');
        await new Promise(r => setTimeout(r, 12000));

        let midStatus = await getStatus();
        console.log(`⏱️ After 12s: Session ${midStatus.session}, Phase: ${midStatus.phase}, Time: ${midStatus.timer}`);

        if (midStatus.phase.toLowerCase() === 'production') {
            console.log('✅ Auto-Advance: TRADING -> PRODUCTION successful.');
        } else {
            throw new Error(`Failed to advance. Phase is still ${midStatus.phase}`);
        }

        console.log('⌛ Waiting for Production Phase to expire (5s)...');
        await new Promise(r => setTimeout(r, 15000));

        let finalStatus = await getStatus();
        console.log(`⏱️ Final State: Session ${finalStatus.session}, Phase: ${finalStatus.phase}, Time: ${finalStatus.timer}`);

        if (parseInt(finalStatus.session) > parseInt(initialStatus.session)) {
            console.log('✅ Auto-Advance: PRODUCTION -> NEXT SESSION successful.');
        } else {
            throw new Error(`Failed to advance to next session. Session is still ${finalStatus.session}`);
        }

        console.log('\n✨ Auto-Advance Test Passed! The game loop is autonomous.');

    } catch (error) {
        console.error('❌ Test Failed:', error.message);
        await page.screenshot({ path: 'auto-advance-failure.png' });
        process.exit(1);
    } finally {
        await browser.close();
    }
}

runTest();
