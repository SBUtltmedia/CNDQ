/**
 * Stress Test - Playability & Flow Verification (Refactored)
 * 
 * Verifies the complete game loop with:
 * - 3 Real Players (simulated via RPC)
 * - 3 NPCs (Beginner, Novice, Expert)
 * - 2 Sessions per scenario
 * - Scenario A: Manual Phase Advancement
 * - Scenario B: Auto-Advance
 * 
 * Uses separate browser contexts to allow persistent polling.
 */

const path = require('path');
const BrowserHelper = require('./helpers/browser');
const ReportingHelper = require('./helpers/reporting');
const TeamHelper = require('./helpers/team');
const SessionHelper = require('./helpers/session');

const CONFIG = {
    baseUrl: 'http://cndq.test/CNDQ/',
    teams: [
        'alpha@stonybrook.edu',
        'beta@stonybrook.edu',
        'gamma@stonybrook.edu'
    ],
    targetSessions: 2,
    headless: true,
    slowMo: 0,
    verbose: false
};

async function runScenario(scenarioName, autoAdvance) {
    ReportingHelper.printHeader(`SCENARIO: ${scenarioName}`);
    
    const browserHelper = new BrowserHelper(CONFIG);
    const session = new SessionHelper(browserHelper);
    const teamHelper = new TeamHelper(browserHelper);
    
    try {
        const browser = await browserHelper.launch();

        // --- STEP 1: RESET & SETUP ---
        ReportingHelper.printStep(1, 'Resetting game and initializing NPCs');
        await session.resetGame();
        
        const adminContext = await browser.createBrowserContext();
        const adminPage = await adminContext.newPage();
        await browserHelper.login(adminPage, 'admin@stonybrook.edu');
        
        // Setup NPCs and Auto-Advance state
        await adminPage.evaluate(async (aa) => {
            // Enable NPCs
            await fetch('api/admin/npc/toggle-system.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: true })
            });
            // Create 6 NPCs (2 of each level) for a thicker market
            const levels = ['beginner', 'novice', 'expert'];
            for (const skill of levels) {
                await fetch('api/admin/npc/create.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ skillLevel: skill, count: 2 })
                });
            }
            // Setup session
            await fetch('api/admin/session.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggleAutoAdvance', enabled: aa })
            });
            if (aa) {
                await fetch('api/admin/session.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'setTradingDuration', seconds: 60 }) 
                });
            }
        }, autoAdvance);

        // --- STEP 2: PERSISTENT POLLING ---
        // This page stays open as Admin and hits session API to drive NPCs and Auto-Advance
        console.log('   - Starting persistent game driver (Poller)...');
        const pollerContext = await browser.createBrowserContext();
        const pollerPage = await pollerContext.newPage();
        await browserHelper.login(pollerPage, 'admin@stonybrook.edu');
        
        const driveGame = async () => {
            try {
                await pollerPage.evaluate(async () => {
                    await fetch('api/session/status.php'); // Triggers SessionManager::getState()
                    await fetch('api/admin/process-reflections.php'); // Syncs trades
                });
            } catch (e) {}
        };
        const pollerInterval = setInterval(driveGame, 5000);

        // Initialize human teams (one-time login to generate folders)
        for (const email of CONFIG.teams) {
            const context = await browser.createBrowserContext();
            const page = await context.newPage();
            await browserHelper.login(page, email);
            await context.close();
        }

        // --- STEP 3: MULTI-SESSION LOOP ---
        for (let s = 1; s <= CONFIG.targetSessions; s++) {
            ReportingHelper.printSessionHeader(s, 'TRADING');

            // Perform 3 rounds of actions per session to simulate a busy 60s window
            for (let round = 1; round <= 3; round++) {
                console.log(`   - [Session ${s} Round ${round}] Players performing actions...`);
                
                for (const email of CONFIG.teams) {
                    const context = await browser.createBrowserContext();
                    const page = await context.newPage();
                    await browserHelper.login(page, email);
                    
                    try {
                        const shadows = await teamHelper.getShadowPrices(page);
                        const inventory = await teamHelper.getInventory(page);
                        
                        // 1. Post NEEDS (Demand)
                        // Post Buy Requests for all chemicals where shadow price > 1.0
                        for (const [chem, price] of Object.entries(shadows)) {
                            if (price > 1.0) {
                                await teamHelper.postBuyRequest(page, chem, price);
                            }
                        }

                        // 2. Fulfill others (Supply)
                        // Look for a BUY ad to satisfy for anything we have > 1 gallon of
                        for (const chem of ['C','N','D','Q']) {
                            if (inventory[chem] > 1) {
                                const buyReq = await teamHelper.findBuyer(page, chem);
                                if (buyReq) {
                                    await teamHelper.respondToBuyRequest(page, buyReq, chem, shadows[chem], inventory[chem]);
                                }
                            }
                        }
                        
                        await page.evaluate(() => fetch('api/admin/process-reflections.php'));
                        
                        // Mixed Response Logic: 40% Haggle, 60% standard response
                        if (Math.random() < 0.4) {
                            // Try to HAGGLE
                            const res = await teamHelper.respondToNegotiations(page, shadows, 0.0); // 0% auto-accept
                            if (res && res.chemical) {
                                await teamHelper.haggleWithMerchant(page, res.chemical, shadows[res.chemical]);
                            }
                        } else {
                            // Standard response (Accept/Reject)
                            const res = await teamHelper.respondToNegotiations(page, shadows, 1.2);
                            if (res && res.action === 'accepted') {
                                console.log(`      ✓ ${email} accepted trade for ${res.chemical}`);
                            }
                        }
                    } finally {
                        await context.close();
                    }
                }
                
                // Allow poller to drive NPCs between rounds
                await new Promise(r => setTimeout(r, 10000));
            }

            // Global Sync before session ends
            await pollerPage.evaluate(() => fetch('api/admin/process-reflections.php'));

            // 2. Advance Session
            if (autoAdvance) {
                console.log('   - Waiting for Auto-Advance (max 90s)...');
                let currentS = s;
                const timeout = Date.now() + 90000;
                while (currentS === s && Date.now() < timeout) {
                    await new Promise(r => setTimeout(r, 5000));
                    const state = await pollerPage.evaluate(async () => {
                        const r = await fetch('api/session/status.php');
                        const data = await r.json();
                        return data.session;
                    });
                    currentS = state;
                }
                if (currentS === s) throw new Error('Auto-advance timed out!');
                console.log(`   ✓ Auto-advanced to session ${currentS}`);
            } else {
                ReportingHelper.printSection('⚙️', `[Session ${s}] Manually advancing...`);
                await adminPage.evaluate(async () => {
                    await fetch('api/admin/session.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'advance' })
                    });
                });
                console.log(`   ✓ Manually advanced`);
            }

            // 3. Leaderboard Verification
            const lbContext = await browser.createBrowserContext();
            const lbPage = await lbContext.newPage();
            await browserHelper.login(lbPage, CONFIG.teams[0]);
            await new Promise(r => setTimeout(r, 2000));
            const standings = await teamHelper.getLeaderboard();
            ReportingHelper.printLeaderboard(standings, s);
            await lbContext.close();
        }

        clearInterval(pollerInterval);
        await browser.close();
        ReportingHelper.printSuccess(`
✨ Scenario '${scenarioName}' Complete!`);

    } catch (error) {
        ReportingHelper.printError(`Scenario '${scenarioName}' failed: ${error.message}`);
        console.error(error.stack);
        await browserHelper.close();
        process.exit(1);
    }
}

async function runAll() {
    await runScenario('Manual Advance', false);
    console.log('\n\n' + '='.repeat(80));
    console.log('PREPARING NEXT SCENARIO...');
    console.log('='.repeat(80) + '\n\n');
    await new Promise(r => setTimeout(r, 5000));
    await runScenario('Auto Advance', true);
}

runAll().catch(err => {
    console.error('Fatal Test Error:', err);
    process.exit(1);
});