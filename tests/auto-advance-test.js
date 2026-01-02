/**
 * Auto-Advance Integration Test (Refactored - UI Only)
 *
 * Verifies that the game advances automatically based on timers
 * without any admin interaction after initial setup.
 *
 * IMPORTANT: This version uses ONLY UI interactions - no direct API calls or cookie manipulation.
 * All authentication uses dev_login.php, all admin actions use the admin interface.
 */

const puppeteer = require('puppeteer');

async function runTest() {
    const baseUrl = 'http://cndq.test/CNDQ';
    const adminUser = 'admin@stonybrook.edu';
    const testUser = 'test_mail1@stonybrook.edu';

    console.log(`🚀 Starting Auto-Advance Test (UI Only) targeting ${baseUrl}...`);

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    let page; // Define page in a higher scope

    try {
        page = await browser.newPage();

        // --- STEP 1: ADMIN LOGIN ---
        console.log('🛡️  ADMIN: Logging in via dev_login.php...');
        await page.goto(`${baseUrl}/dev_login.php`, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.click(`a[href*="${adminUser}"]`);
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        console.log('✅ Admin logged in');

        await page.goto(`${baseUrl}/admin/index.php`, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.waitForSelector('#session-number', { timeout: 10000 });

        // --- STEP 2: RESET GAME ---
        console.log('   Resetting game data via UI...');
        await page.click('button[onclick="resetGameData()"]');

        // Handle first confirmation modal
        await page.waitForSelector('#confirm-modal:not(.hidden)', { timeout: 5000 });
        await page.click('#confirm-modal-yes');

        // Handle second confirmation modal
        await page.waitForSelector('#confirm-modal:not(.hidden)', { timeout: 5000 });
        await page.click('#confirm-modal-yes');

        // Wait for reset to complete and toast to appear
        await page.waitForFunction(() => {
            const toast = document.querySelector('#toast-container');
            return toast && toast.textContent.includes('reset');
        }, { timeout: 10000 });

        await new Promise(r => setTimeout(r, 2000));
        await page.reload({ waitUntil: 'networkidle2' });
        console.log('✅ Game reset complete');

        // --- STEP 3: CREATE NPCs ---
        console.log('   Creating NPCs (Beginner, Novice, Expert) via UI...');
        const skillLevels = ['beginner', 'novice', 'expert'];

        for (const skillLevel of skillLevels) {
            // Select skill level from dropdown
            await page.select('#npc-skill-level', skillLevel);

            // Set count to 1
            await page.$eval('#npc-count', el => el.value = '1');

            // Click create button
            await page.click('button[onclick="createNPC()"]');

            // Wait for toast confirmation
            await page.waitForFunction(() => {
                const toast = document.querySelector('#toast-container');
                return toast && toast.textContent.includes('created');
            }, { timeout: 5000 });

            console.log(`   ✓ Created ${skillLevel} NPC`);
            await new Promise(r => setTimeout(r, 500)); // Brief pause between creations
        }

        // Enable NPC system if not already enabled
        const npcEnabled = await page.$eval('#npc-system-enabled', el => el.checked);
        if (!npcEnabled) {
            console.log('   Enabling NPC system via UI...');
            await page.click('#npc-system-enabled');
            await page.waitForFunction(() => {
                const toast = document.querySelector('#toast-container');
                return toast && toast.textContent.includes('NPC system');
            }, { timeout: 5000 });
        }
        console.log('✅ NPCs created and enabled');

        // --- STEP 4: CONFIGURE SESSION TIMERS ---
        console.log('   Configuring short session timers via UI...');

        // Set Trading Session Duration to 15 seconds (0 minutes, 15 seconds)
        await page.$eval('#trading-duration-minutes', el => el.value = '0');
        await page.$eval('#trading-duration-seconds', el => el.value = '15');
        await page.click('button[onclick="updateTradingDuration()"]');
        await page.waitForFunction(() => {
            const toast = document.querySelector('#toast-container');
            return toast && toast.textContent.includes('duration');
        }, { timeout: 5000 });
        console.log('   ✓ Session duration set to 15s (production runs automatically when time expires)');

        // --- STEP 5: ENABLE AUTO-ADVANCE ---
        const autoAdvanceEnabled = await page.$eval('#auto-advance', el => el.checked);
        if (!autoAdvanceEnabled) {
            console.log('   Enabling auto-advance via UI...');
            await page.click('#auto-advance');
            await page.waitForFunction(() => {
                const toast = document.querySelector('#toast-container');
                return toast && toast.textContent.includes('Auto-advance');
            }, { timeout: 5000 });
        }
        console.log('✅ Auto-advance enabled');
        console.log('✅ Admin setup complete. Game will auto-advance when trading expires.');

        // --- STEP 6: SWITCH TO PLAYER ---
        console.log('👤 PLAYER: Logging in to watch the world turn...');
        await page.goto(`${baseUrl}/dev_login.php`, { waitUntil: 'networkidle2' });
        await page.click(`a[href*="${testUser}"]`);
        await page.waitForNavigation({ waitUntil: 'networkidle2' });
        console.log('✅ Test user logged in');

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
        await new Promise(r => setTimeout(r, 1000));

        // --- STEP 7: OBSERVE AUTO-ADVANCE ---
        const getStatus = async () => {
            return await page.evaluate(() => {
                return {
                    session: document.getElementById('session-num-display')?.innerText.trim() || 'N/A',
                    phase: document.getElementById('phase-badge')?.innerText.trim() || 'N/A',
                    timer: document.getElementById('session-timer')?.innerText.trim() || 'N/A'
                };
            });
        };

        let initialStatus = await getStatus();
        console.log(`⏱️  Initial State: Session ${initialStatus.session}, Phase: ${initialStatus.phase}, Time: ${initialStatus.timer}`);

        console.log('⌛ Waiting for Session 1 Trading to expire (15s + buffer)...');
        await new Promise(r => setTimeout(r, 17000));

        let midStatus = await getStatus();
        console.log(`⏱️  After 17s: Session ${midStatus.session}, Phase: ${midStatus.phase}, Time: ${midStatus.timer}`);

        if (parseInt(midStatus.session) === 2 && midStatus.phase.toLowerCase().includes('trading')) {
            console.log('✅ Auto-Advance: Session 1 → Session 2 (production ran automatically, phase stayed Trading)');
        } else {
            throw new Error(`Failed to advance. Expected Session 2/Trading, got Session ${midStatus.session}/${midStatus.phase}`);
        }

        console.log('⌛ Waiting for Session 2 Trading to expire (15s + buffer)...');
        await new Promise(r => setTimeout(r, 17000));

        let finalStatus = await getStatus();
        console.log(`⏱️  Final State: Session ${finalStatus.session}, Phase: ${finalStatus.phase}, Time: ${finalStatus.timer}`);

        if (parseInt(finalStatus.session) === 3 && finalStatus.phase.toLowerCase().includes('trading')) {
            console.log('✅ Auto-Advance: Session 2 → Session 3 (production ran automatically, phase stayed Trading)');
        } else {
            throw new Error(`Failed to advance. Expected Session 3/Trading, got Session ${finalStatus.session}/${finalStatus.phase}`);
        }

        console.log('\n✨ Auto-Advance Test Passed! The game loop is autonomous.');

    } catch (error) {
        console.error('❌ Test Failed:', error.message);
        if (page) {
            await page.screenshot({ path: 'auto-advance-failure.png' });
            console.log('📸 Screenshot saved to auto-advance-failure.png');
        }
        process.exit(1);
    } finally {
        await browser.close();
    }
}

runTest();
