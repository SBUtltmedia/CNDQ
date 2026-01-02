/**
 * Comprehensive CNDQ Game Loop Test (Full Playability Demo)
 */

const BrowserHelper = require('./helpers/browser');
const SessionHelper = require('./helpers/session');
const TeamHelper = require('./helpers/team');
const NpcHelper = require('./helpers/npc');
const ReportingHelper = require('./helpers/reporting');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
    baseUrl: 'http://cndq.test/CNDQ/',
    teams: [
        'player_1@stonybrook.edu',
        'player_2@stonybrook.edu',
        'player_3@stonybrook.edu'
    ],
    targetSessions: 4,
    headless: true
};

async function runComprehensiveTest() {
    ReportingHelper.printHeader('CNDQ Full Playability Test (4 Sessions)');
    ReportingHelper.printInfo(`RPCs: 3 | NPCs: 3 | Sessions: 4`);
    
    const browser = new BrowserHelper(CONFIG);
    const session = new SessionHelper(browser);
    const team = new TeamHelper(browser);
    const npc = new NpcHelper(browser);

    const setupConsole = (page) => {
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('[DEBUG]') || text.includes('[BROWSER]')) {
                console.log(`      ${text}`);
            }
        });
    };

    const runNpcHeartbeat = () => {
        try {
            execSync('php CNDQ/cron/npc_runner.php', { stdio: 'ignore' });
        } catch (e) {}
    };

    try {
        await browser.launch();

        // --- STEP 1: SETUP ---
        ReportingHelper.printStep(1, 'Resetting game and creating NPCs');
        await session.resetGame();
        
        // Initialize RPCs
        for (const email of CONFIG.teams) {
            const page = await browser.loginAndNavigate(email, '/?v=init_' + Date.now());
            await page.close();
        }

        const adminPage = await browser.loginAndNavigate('admin@stonybrook.edu', '/admin/');
        await npc.createTestNpcs(adminPage);
        await adminPage.close();

        // --- STEP 2: MULTI-SESSION LOOP ---
        for (let s = 1; s <= CONFIG.targetSessions; s++) {
            ReportingHelper.printSessionHeader(s, 'TRADING');
            await session.waitForPhaseChange('trading', 30);

            // 1. RPCs post ads
            for (const email of CONFIG.teams) {
                const page = await browser.loginAndNavigate(email, '/?v=s' + s + '_' + Date.now());
                const shadows = await team.getShadowPrices(page);
                for (const chem of ['C', 'N', 'D', 'Q']) {
                    if (shadows[chem] > 1) {
                        await team.postBuyRequest(page, chem, shadows[chem]);
                        console.log(`   - ${email} posted Buy Request for ${chem}`);
                        break;
                    }
                }
                await page.close();
            }

            // 2. Negotiation Rounds
            for (let round = 1; round <= 2; round++) {
                runNpcHeartbeat();
                console.log(`   ⌛ Round ${round}: Waiting for market activity (15s)...`);
                await new Promise(r => setTimeout(r, 15000));

                for (const email of CONFIG.teams) {
                    const page = await browser.loginAndNavigate(email, '/?v=s' + s + 'r' + round + '_' + Date.now());
                    const shadows = await team.getShadowPrices(page);
                    const res = await team.respondToNegotiations(page, shadows, 0.9);
                    if (res) console.log(`   - ${email} ${res.action} ${res.chemical}`);
                    await page.close();
                }
            }

            // 3. Wait for session to advance
            ReportingHelper.printSection('⚙️', `Session ${s}: Production...`);
            runNpcHeartbeat();
            await new Promise(r => setTimeout(r, 10000)); 
            
            const standings = await team.getLeaderboard();
            ReportingHelper.printLeaderboard(standings, s);
        }

        ReportingHelper.printSuccess('\n✨ Full Simulation Complete!');

    } catch (error) {
        ReportingHelper.printError(`Test failed: ${error.message}`);
    } finally {
        await browser.close();
    }
}

if (require.main === module) {
    runComprehensiveTest();
}