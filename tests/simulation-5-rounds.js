const puppeteer = require('puppeteer');

async function runComprehensiveSimulation() {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1280, height: 800 },
        args: ['--window-size=1400,900'],
        protocolTimeout: 120000
    });

    console.log('🚀 Starting 5-Round Comprehensive Simulation with 3 Humans and 3 NPCs...\n');

    try {
        // 1. SETUP: Admin Page - Reset Game and Setup NPCs
        const adminPage = await browser.newPage();
        adminPage.setDefaultNavigationTimeout(60000);
        adminPage.setDefaultTimeout(30000);
        await adminPage.goto('http://cndq.test/admin/index.php');
        
        // Handle admin authentication
        const isDenied = await adminPage.evaluate(() => document.body.innerText.includes('Access Denied'));
        if (isDenied) {
            console.log('  Admin access denied. Setting mock_mail cookie...');
            await adminPage.setCookie({ name: 'mock_mail', value: 'admin@system', domain: 'cndq.test' });
            await adminPage.reload();
        }

        console.log('  Resetting game data via UI...');
        await adminPage.evaluate(async () => {
            window.showConfirm = () => Promise.resolve(true);
            await resetGameData();
        });
        
        await new Promise(r => setTimeout(r, 3000));
        
        // Verify NPCs are cleared
        const npcCountAfterReset = await adminPage.evaluate(() => document.querySelectorAll('#npc-list > div').length);
        if (npcCountAfterReset > 0) {
            console.log(`  ⚠ Warning: ${npcCountAfterReset} NPCs still in UI. Waiting...`);
            await new Promise(r => setTimeout(r, 2000));
        } else {
            console.log('  ✓ UI confirms all teams and NPCs cleared');
        }

        console.log('  Setting up fresh NPCs...');
        await adminPage.evaluate(async () => {
            const select = document.getElementById('npc-skill-level');
            const countInput = document.getElementById('npc-count');
            
            select.value = 'beginner'; await createNPC();
            select.value = 'novice'; await createNPC();
            select.value = 'expert'; await createNPC();
            
            const checkbox = document.getElementById('npc-system-enabled');
            if (!checkbox.checked) {
                checkbox.checked = true;
                await toggleNPCSystem();
            }
        });
        console.log('  ✓ 3 NPCs created and enabled');

        // 2. SETUP: 3 Human Players
        const users = [
            { email: 'team1@example.com', name: 'Alpha Team' },
            { email: 'team2@example.com', name: 'Beta Team' },
            { email: 'team3@example.com', name: 'Gamma Team' }
        ];

        const userPages = [];
        for (const user of users) {
            const page = await browser.newPage();
            page.on('console', msg => {
                if (msg.type() === 'error') console.log(`    [Browser Error] ${user.name}:`, msg.text());
            });

            await page.setCookie({ name: 'mock_mail', value: user.email, domain: 'cndq.test' });
            await page.goto('http://cndq.test/');
            userPages.push({ page, ...user });
            console.log(`  ✓ User logged in: ${user.name}`);
        }

        // 3. MAIN SIMULATION LOOP (5 Rounds)
        for (let round = 1; round <= 5; round++) {
            console.log(`\n--- ROUND ${round} ---`);

            console.log('  Phase: Production');
            await adminPage.evaluate(() => setPhase('production'));
            await new Promise(r => setTimeout(r, 3000));
            
            await adminPage.evaluate(() => setPhase('trading'));
            await new Promise(r => setTimeout(r, 1000));
            console.log('  Phase: Trading Started');

            const chems = ['C', 'N', 'D', 'Q'];
            for (let i = 0; i < userPages.length; i++) {
                const { page, name } = userPages[i];
                const chem = chems[(round + i) % 4];
                const qty = 100 + (round * 5);
                const price = (3.50 + (i * 0.1)).toFixed(2);

                console.log(`    ${name} posting buy request: ${qty} gal of ${chem} @ $${price}`);
                
                await page.evaluate((c) => {
                    const card = document.querySelector(`chemical-card[chemical="${c}"]`);
                    if (card) card.querySelector('#post-buy-btn').click();
                }, chem);

                await page.waitForSelector('#offer-modal', { visible: true, timeout: 5000 });
                await new Promise(r => setTimeout(r, 500));
                
                // Native puppeteer typing is safer
                await page.click('#offer-quantity', { clickCount: 3 });
                await page.keyboard.press('Backspace');
                await page.type('#offer-quantity', qty.toString(), { delay: 50 });

                await page.click('#offer-price', { clickCount: 3 });
                await page.keyboard.press('Backspace');
                await page.type('#offer-price', price, { delay: 50 });

                await page.click('#offer-submit-btn');
                await new Promise(r => setTimeout(r, 1000));
            }

            console.log('    Waiting for NPC trading cycles (35s)...');
            await new Promise(r => setTimeout(r, 35000));

            for (const { page, name } of userPages) {
                await page.reload();
                await page.waitForSelector('#my-negotiations');
                
                const negs = await page.evaluate(() => {
                    const cards = Array.from(document.querySelectorAll('negotiation-card'));
                    return cards.map(c => ({
                        id: c.getAttribute('negotiation-id') || c.negotiation.id,
                        isMyTurn: c.negotiation.lastOfferBy !== c.currentUserId && c.negotiation.status === 'pending',
                        otherTeam: c.negotiation.initiatorId === c.currentUserId ? c.negotiation.responderName : c.negotiation.initiatorName
                    }));
                });

                for (const neg of negs) {
                    if (neg.isMyTurn) {
                        console.log(`    ${name} accepting offer from ${neg.otherTeam}...`);
                        await page.click(`negotiation-card[negotiation-id="${neg.id}"]`);
                        await page.waitForSelector('#accept-offer-btn', { visible: true });
                        await page.evaluate(() => { app.showConfirm = () => Promise.resolve(true); });
                        await page.click('#accept-offer-btn');
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }
            }
        }

        console.log('\n--- FINAL RESULTS ---');
        await adminPage.goto('http://cndq.test/index.php');
        await adminPage.reload();
        await adminPage.waitForSelector('#leaderboard-btn');
        await adminPage.click('#leaderboard-btn');
        await adminPage.waitForSelector('#leaderboard-body tr');

        const results = await adminPage.evaluate(() => {
            return Array.from(document.querySelectorAll('#leaderboard-body tr')).map(r => r.innerText.replace(/\t/g, ' | '));
        });

        console.log('Leaderboard:');
        results.forEach(r => console.log(`  ${r}`));
        console.log('\n✅ Simulation completed successfully!');

    } catch (error) {
        console.error('\n❌ Simulation failed:', error);
    } finally {
        await new Promise(r => setTimeout(r, 5000));
        await browser.close();
    }
}

runComprehensiveSimulation();