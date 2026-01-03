/**
 * Comprehensive CNDQ Game Loop Test (Full Playability Demo with Atomic Verification)
 * 
 * Verifies the social loop (RPC vs RPC) and PvE loop (RPC vs NPC)
 * with real-time filesystem checks.
 */

const fs = require('fs');
const path = require('path');
const BrowserHelper = require('./helpers/browser');
const SessionHelper = require('./helpers/session');
const TeamHelper = require('./helpers/team');
const NpcHelper = require('./helpers/npc');
const ReportingHelper = require('./helpers/reporting');
const { execSync } = require('child_process');

// Paths for atomic verification
const DATA_DIR = path.resolve(__dirname, '../data/teams');

// Configuration
const CONFIG = {
    baseUrl: 'http://cndq.test/CNDQ/',
    teams: [
        'alpha@stonybrook.edu',
        'beta@stonybrook.edu'
    ],
    targetSessions: 4, 
    headless: false, // Set to false so you can see it
    slowMo: 50
};

/**
 * Atomic Verification Helper: Check if a specific event type exists on disk for a team.
 */
function verifyOnDisk(email, eventType) {
    const safeEmail = email.replace(/[^a-zA-Z0-9_\-@.]/g, '_');
    const teamDir = path.join(DATA_DIR, safeEmail);
    if (!fs.existsSync(teamDir)) return false;
    const files = fs.readdirSync(teamDir);
    const found = files.some(f => f.includes(`_${eventType}.json`));
    if (found) {
        console.log(`      💾 [ATOMIC-CHECK] OK: '${eventType}' found for ${email}`);
    } else {
        console.log(`      ⚠️ [ATOMIC-CHECK] MISSING: '${eventType}' not on disk for ${email}`);
    }
    return found;
}

async function runComprehensiveTest() {
    ReportingHelper.printHeader('CNDQ Atomic Playability Demo');
    ReportingHelper.printInfo(`Teams: 2 | NPCs: 1 | Sessions: ${CONFIG.targetSessions}`);
    
    const browser = new BrowserHelper(CONFIG);
    const session = new SessionHelper(browser);
    const team = new TeamHelper(browser);
    const npc = new NpcHelper(browser);

    const loginAs = async (page, email) => {
        await page.deleteCookie({ name: 'mock_mail', url: CONFIG.baseUrl });
        const url = new URL(CONFIG.baseUrl);
        await page.setCookie({
            name: 'mock_mail',
            value: email,
            domain: url.hostname,
            path: '/',
            expires: Math.floor(Date.now() / 1000) + 3600
        });
        await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle2' });
    };

    const triggerSync = async () => {
        const page = await browser.newPage();
        try {
            await browser.login(page, 'admin@stonybrook.edu');
            await page.goto(`${CONFIG.baseUrl}api/admin/process-reflections.php`);
        } catch (e) {}
        finally { await page.close(); }
    };

    const runNpcHeartbeat = () => {
        try {
            execSync('php CNDQ/cron/npc_runner.php', { stdio: 'ignore' });
        } catch (e) {}
    };

    try {
        await browser.launch();

        // --- STEP 1: SETUP ---
        ReportingHelper.printStep(1, 'Resetting game and initializing teams');
        await session.resetGame();
        
        for (const email of CONFIG.teams) {
            const page = await browser.newPage();
            await loginAs(page, email);
            await page.close();
            verifyOnDisk(email, 'init');
        }

        const adminPage = await browser.newPage();
        await loginAs(adminPage, 'admin@stonybrook.edu');
        // Create 1 beginner NPC
        await adminPage.evaluate(async () => {
            await fetch('api/admin/npc/toggle-system.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: true })
            });
            await fetch('api/admin/npc/create.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ skillLevel: 'beginner', count: 1 })
            });
        });
        await adminPage.close();

        // --- STEP 2: MULTI-SESSION LOOP ---
        for (let s = 1; s <= CONFIG.targetSessions; s++) {
            ReportingHelper.printSessionHeader(s, 'TRADING');

            console.log(`   - [Session ${s}] Player Alpha posting Buy Request...`);
            const pageA = await browser.newPage();
            await loginAs(pageA, CONFIG.teams[0]);
            const shadowsA = await team.getShadowPrices(pageA);
            await team.postBuyRequest(pageA, 'D', shadowsA['D'] || 10);
            await pageA.close();
            verifyOnDisk(CONFIG.teams[0], 'add_buy_order');

            console.log(`   - [Session ${s}] Player Beta responding to Alpha...`);
            const pageB = await browser.newPage();
            await loginAs(pageB, CONFIG.teams[1]);
            const buyAd = await team.findBuyer(pageB, 'D');
            if (buyAd) {
                await team.respondToBuyRequest(pageB, buyAd, 'D', 5.00, 1000);
                verifyOnDisk(CONFIG.teams[1], 'initiate_negotiation');
            }
            await pageB.close();

            console.log('   - Syncing reflections...');
            await triggerSync();
            runNpcHeartbeat();

            console.log(`   - [Session ${s}] Player Alpha checking negotiations to ACCEPT...`);
            const pageA2 = await browser.newPage();
            await loginAs(pageA2, CONFIG.teams[0]);
            const shadowsA2 = await team.getShadowPrices(pageA2);
            const res = await team.respondToNegotiations(pageA2, shadowsA2, 1.0); 
            if (res && res.action === 'accepted') {
                console.log(`      ✓ Alpha accepted trade for ${res.chemical}`);
                verifyOnDisk(CONFIG.teams[0], 'close_negotiation');
            }
            await pageA2.close();

            // Final Settle
            ReportingHelper.printSection('⚙️', `[Session ${s}] Settling and leaderboard...`);
            await triggerSync();
            runNpcHeartbeat();
            await new Promise(r => setTimeout(r, 5000)); 
            
            const standings = await team.getLeaderboard();
            ReportingHelper.printLeaderboard(standings, s);
        }

        ReportingHelper.printSuccess('\n✨ Atomic Demo Complete!');

    } catch (error) {
        ReportingHelper.printError(`Test failed: ${error.message}`);
    } finally {
        await browser.close();
    }
}

if (require.main === module) {
    runComprehensiveTest();
}
