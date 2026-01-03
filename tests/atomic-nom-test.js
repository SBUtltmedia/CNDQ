/**
 * Atomic No-M State Verification Test
 * 
 * Directly verifies the filesystem state after Puppeteer actions.
 */

const fs = require('fs');
const path = require('path');
const BrowserHelper = require('./helpers/browser');
const TeamHelper = require('./helpers/team');
const SessionHelper = require('./helpers/session');
const ReportingHelper = require('./helpers/reporting');

const DATA_DIR = path.resolve(__dirname, '../data/teams');
const SHARED_DIR = path.resolve(__dirname, '../data/marketplace/events');

const CONFIG = {
    baseUrl: 'http://cndq.test/CNDQ/',
    teams: [
        'alpha@stonybrook.edu',
        'beta@stonybrook.edu'
    ],
    headless: false,
    slowMo: 50
};

function getTeamDir(email) {
    const safeEmail = email.replace(/[^a-zA-Z0-9_\-@.]/g, '_');
    return path.join(DATA_DIR, safeEmail);
}

function findEvent(teamEmail, type) {
    const dir = getTeamDir(teamEmail);
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir);
    return files.find(f => f.includes(`_${type}.json`));
}

async function runAtomicTest() {
    ReportingHelper.printHeader('Atomic No-M Filesystem Test');
    
    const browser = new BrowserHelper(CONFIG);
    const team = new TeamHelper(browser);
    const session = new SessionHelper(browser);

    try {
        await browser.launch();

        // --- STEP 1: INITIALIZATION ---
        ReportingHelper.printStep(1, 'Initializing Teams');
        await session.resetGame();
        
        if (fs.existsSync(SHARED_DIR)) {
            const initialShared = fs.readdirSync(SHARED_DIR);
            console.log(`   [DEBUG] Shared directory after reset: ${initialShared.join(', ')}`);
        } else {
            console.log('   ✓ Shared directory correctly cleared (does not exist).');
        }

        for (const email of CONFIG.teams) {
            const page = await browser.loginAndNavigate(email, '/');
            await page.close();
            await new Promise(r => setTimeout(r, 500)); // Delay for unique microtime
            
            const initEvent = findEvent(email, 'init');
            const prodEvent = findEvent(email, 'add_production');
            
            if (initEvent && prodEvent) {
                console.log(`   ✓ ${email}: Filesystem initialized correctly.`);
            } else {
                throw new Error(`${email} failed to initialize filesystem events.`);
            }
        }

        // --- STEP 2: AD POSTING ---
        ReportingHelper.printStep(2, 'Player Alpha Posting Ad');
        const alphaEmail = CONFIG.teams[0];
        const pageA = await browser.loginAndNavigate(alphaEmail, '/');
        await team.postBuyRequest(pageA, 'D', 15.00);
        await pageA.close();

        await new Promise(r => setTimeout(r, 2000)); // Wait for mirroring

        const adEvent = findEvent(alphaEmail, 'add_buy_order');
        if (adEvent) {
            console.log(`   ✓ Alpha: 'add_buy_order' event found in user directory.`);
        } else {
            throw new Error(`Alpha failed to emit 'add_buy_order' event.`);
        }

        const sharedEvents = fs.readdirSync(SHARED_DIR);
        console.log(`   [DEBUG] Shared events on disk: ${sharedEvents.join(', ')}`);
        
        const sharedAds = sharedEvents.filter(f => f.includes('_add_ad.json'));
        if (sharedAds.length > 0) {
            console.log(`   ✓ System: Shared marketplace ad mirrored to global directory.`);
        } else {
            throw new Error(`Ad failed to mirror to shared directory.`);
        }

        // --- STEP 3: NEGOTIATION ---
        ReportingHelper.printStep(3, 'Player Beta Responding');
        const betaEmail = CONFIG.teams[1];
        const pageB = await browser.loginAndNavigate(betaEmail, '/');
        const buyAd = await team.findBuyer(pageB, 'D');
        if (!buyAd) throw new Error('Beta could not find Alpha\'s ad in UI.');
        
        await team.respondToBuyRequest(pageB, buyAd, 'D', 5.00, 1000);
        await pageB.close();

        await new Promise(r => setTimeout(r, 3000)); // Increased delay for Windows

        const negEvent = findEvent(betaEmail, 'initiate_negotiation');
        if (negEvent) {
            console.log(`   ✓ Beta: 'initiate_negotiation' event found.`);
        } else {
            throw new Error(`Beta failed to emit 'initiate_negotiation' event.`);
        }

        const alphaNegEvent = findEvent(alphaEmail, 'initiate_negotiation');
        if (alphaNegEvent) {
            console.log(`   ✓ Alpha: Successfully received 'initiate_negotiation' event.`);
        } else {
            throw new Error(`Alpha did not receive the negotiation event.`);
        }

        // --- STEP 4: ACCEPTANCE ---
        ReportingHelper.printStep(4, 'Player Alpha Accepting');
        const pageA2 = await browser.loginAndNavigate(alphaEmail, '/');
        const res = await team.respondToNegotiations(pageA2, { D: 10 }, 1.0);
        await pageA2.close();

        if (res && res.action === 'accepted') {
            console.log(`   ✓ Alpha: UI reports acceptance successful.`);
        } else {
            throw new Error(`Alpha failed to accept negotiation in UI.`);
        }

        const negsDir = path.resolve(__dirname, '../data/negotiations');
        if (fs.existsSync(negsDir)) {
            const negFiles = fs.readdirSync(negsDir);
            console.log(`   [DEBUG] Negotiation files on disk: ${negFiles.join(', ')}`);
        }

        await new Promise(r => setTimeout(r, 2000)); // Delay for event write

        const closeEvent = findEvent(alphaEmail, 'close_negotiation');
        if (closeEvent) {
            console.log(`   ✓ Alpha: 'close_negotiation' event confirmed on disk.`);
        } else {
            throw new Error(`Alpha failed to write 'close_negotiation' event.`);
        }

        // --- STEP 5: REFLECTION ---
        ReportingHelper.printStep(5, 'System Reflection');
        const adminPage = await browser.newPage();
        await browser.login(adminPage, 'admin@stonybrook.edu');
        await adminPage.goto(`${CONFIG.baseUrl}api/admin/process-reflections.php`);
        await adminPage.close();

        const betaTradeEvent = findEvent(betaEmail, 'add_transaction');
        if (betaTradeEvent) {
            console.log(`   ✓ Beta: Trade reflected successfully. Transaction recorded on disk.`);
        } else {
            throw new Error(`Beta did not receive the reflected transaction event.`);
        }

        ReportingHelper.printSuccess('\n✨ ALL ATOMIC STEPS PASSED IN FILESYSTEM!');

    } catch (error) {
        ReportingHelper.printError(`Atomic test failed: ${error.message}`);
        if (browser.browser) {
            const pages = await browser.browser.pages();
            if (pages.length > 0) {
                const screenshotPath = `atomic_failure_${Date.now()}.png`;
                await pages[pages.length - 1].screenshot({ path: screenshotPath, fullPage: true });
                console.log(`📸 Failure screenshot saved to: ${screenshotPath}`);
            }
        }
        process.exit(1);
    } finally {
        await browser.close();
    }
}

runAtomicTest();
