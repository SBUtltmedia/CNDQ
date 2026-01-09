/**
 * UI Playability Test (Playwright Version)
 *
 * Runs the game simulation using a real browser (Playwright Chromium).
 * Interacts with UI elements and captures API traffic.
 */

const { chromium } = require('playwright');
const CONFIG = require('./config');
const fs = require('fs');

class UIPlayabilityTest {
    constructor() {
        this.browser = null;
        this.results = {
            uiActions: 0,
            apiCallsCaptured: 0,
            errors: [],
            warnings: []
        };
        this.apiCallLog = [];
    }

    async run() {
        console.log('🎮 UI Playability Test (Playwright Engine)');
        console.log('='.repeat(80));

        try {
            this.browser = await chromium.launch({
                headless: CONFIG.headless
            });

            // 1. Setup Admin
            await this.setupGame();

            // 2. Play Game
            await this.playMarketplace();

            // 3. Finish
            await this.endGame();

            this.printResults();

        } catch (error) {
            console.error('\n❌ Test failed:', error.message);
            if (CONFIG.verbose) console.error(error.stack);
        } finally {
            if (this.browser) await this.browser.close();
        }
    }

    async createPlayerSession(email) {
        const context = await this.browser.newContext({ baseURL: CONFIG.baseUrl });
        const page = await context.newPage();

        // Setup API logging
        page.on('response', async response => {
            const url = response.url();
            if (url.includes('/api/')) {
                this.results.apiCallsCaptured++;
                try {
                    const data = await response.json();
                    this.apiCallLog.push({
                        timestamp: new Date().toISOString(),
                        user: email,
                        method: response.request().method(),
                        url: url.split('/api/')[1],
                        status: response.status(),
                        data
                    });
                } catch (e) { /* ignore non-json */ }
            }
        });

        // Login
        // Ensure no double slash
        const path = `dev.php?user=${email}`; 
        console.log(`      Navigating to: ${path}`);
        await page.goto(path);
        await page.waitForLoadState('domcontentloaded');

        // Check where we ended up
        console.log(`      Landed on: ${page.url()}`);
        
        // Handle Production Modal if it appears
        return page;
    }

    async setupGame() {
        console.log('\n🛡️  ADMIN SETUP');
        const page = await this.createPlayerSession(CONFIG.adminUser);
        
        try {
            // Navigate to admin
            await page.goto('admin/');
            console.log(`      Admin page: ${page.url()}`);

            // Take debug screenshot
            await page.screenshot({ path: 'debug-admin-load.png' });

            // Reset
            console.log('      Waiting for reset button...');
            const resetBtn = page.locator('button[onclick="resetGameData()"]');
            await resetBtn.waitFor({ state: 'visible', timeout: 5000 });
            await resetBtn.click();
            
            await page.waitForSelector('#confirm-modal:not(.hidden)');
            await page.click('#confirm-modal-yes');
            console.log('   ✅ Game reset');
            this.results.uiActions++;

            // Start (if needed)
            try {
                const startBtn = page.locator('#start-stop-btn');
                await startBtn.waitFor({ state: 'visible', timeout: 5000 });
                if ((await startBtn.innerText()).includes('Start')) {
                    await startBtn.click();
                    console.log('   ✅ Market started');
                    this.results.uiActions++;
                }
            } catch (e) {
                console.log('   ℹ️  Market might already be running');
            }
        } catch (error) {
            console.error('   ❌ Admin setup failed:', error.message);
            await page.screenshot({ path: 'error-admin-setup.png' });
            throw error;
        } finally {
            await page.close();
        }
    }

    async playMarketplace() {
        console.log(`\n🎮 PLAYING MARKETPLACE (UI)`);
        
        const turns = 2; // Short run
        for (let turn = 1; turn <= turns; turn++) {
            console.log(`\n   🔄 Turn ${turn}/${turns}`);
            
            for (const email of CONFIG.testUsers) {
                await this.playerAction(email);
            }
            
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    async playerAction(email) {
        const name = email.split('@')[0];
        console.log(`      👤 ${name} acting...`);
        const page = await this.createPlayerSession(email);
        
        try {
            // Wait for App Data to Load
            // Wait for funds element to be visible
            const fundsEl = page.locator('#current-funds');
            await fundsEl.waitFor({ state: 'visible', timeout: 15000 });
            
            // Check for production results modal and close it if visible
            const prodModal = page.locator('#production-results-modal');
            if (await prodModal.isVisible()) {
                console.log(`         🎯 Closing production modal for ${name}`);
                await page.click('#prod-result-continue', { force: true });
                await prodModal.waitFor({ state: 'hidden', timeout: 5000 });
            }

            // Wait for window.app.profile to be populated
            console.log(`         ⏳ Waiting for app state initialization for ${name}...`);
            await page.waitForFunction(() => 
                window.app && 
                window.app.profile && 
                window.app.profile.currentFunds !== undefined,
                { timeout: 15000 }
            );

            // Action 1: Check for 'Your Turn' negotiations and accept them
            console.log(`         🔍 Checking for negotiations for ${name}...`);
            const negotiationId = await page.evaluate(() => {
                const card = document.querySelector('negotiation-card[context="summary"]');
                if (card && card.innerText.includes('Your Turn')) {
                    return card.getAttribute('negotiation-id');
                }
                return null;
            });

            if (negotiationId) {
                console.log(`         ✅ Found negotiation ${negotiationId}, accepting...`);
                // Open negotiation detail
                await page.click(`negotiation-card[negotiation-id="${negotiationId}"] [role="button"]`);
                await page.waitForSelector('#negotiation-detail-view:not(.hidden)', { timeout: 5000 });
                
                // Accept
                await page.click('#accept-offer-btn');
                await page.waitForSelector('#confirm-dialog:not(.hidden)', { timeout: 5000 });
                await page.click('#confirm-ok');
                
                console.log(`         🎉 Trade accepted for ${name}!`);
                await page.waitForSelector('#negotiation-list-view:not(.hidden)', { timeout: 10000 });
                this.results.uiActions++;
            }

            // Action 2: Post a Buy Request (existing logic)
            console.log(`         📢 Opening buy request modal for ${name}...`);
            await page.evaluate(() => {
                if (window.app) window.app.openBuyRequestModal('C');
            });
            
            const submitBtn = page.locator('#offer-submit-btn');
            await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
            await submitBtn.click();
            
            this.results.uiActions++;
            console.log(`         ✅ Posted buy request for ${name}`);

        } catch (e) {
            console.log(`         ❌ Error for ${name}: ${e.message}`);
            this.results.errors.push({ user: email, error: e.message });
            const errorPath = `error-player-${name}-${Date.now()}.png`;
            await page.screenshot({ path: errorPath });
            console.log(`         📸 Error screenshot saved: ${errorPath}`);
        } finally {
            await page.close();
        }
    }

    async endGame() {
        console.log('\n🏁 ENDING GAME');
        const page = await this.createPlayerSession(CONFIG.adminUser);
        await page.goto('admin/');
        
        try {
            // Stop
            const stopBtn = page.locator('#start-stop-btn');
            await stopBtn.waitFor({ state: 'visible', timeout: 10000 });
            
            if ((await stopBtn.innerText()).includes('Stop')) {
                await stopBtn.click({ force: true });
            }
            
            // Finalize
            await page.locator('button[onclick="finalizeGame()"]').click({ force: true });
            console.log('   ✅ Game finalized');
        } catch (error) {
            console.error('   ❌ End game failed:', error.message);
            await page.screenshot({ path: 'error-endgame.png' });
        } finally {
            await page.close();
        }
    }

    printResults() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 UI RESULTS');
        console.log('='.repeat(80));
        console.log(`Actions: ${this.results.uiActions}`);
        console.log(`API Calls Captured: ${this.results.apiCallsCaptured}`);
        
        const logFile = `playwright-ui-log-${Date.now()}.json`;
        fs.writeFileSync(logFile, JSON.stringify(this.apiCallLog, null, 2));
        console.log(`Log saved to ${logFile}`);
    }
}

if (require.main === module) {
    new UIPlayabilityTest().run();
}

module.exports = UIPlayabilityTest;
