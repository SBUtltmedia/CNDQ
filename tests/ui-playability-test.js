/**
 * UI-Only Playability Test
 *
 * Tests the complete game flow using ONLY UI interactions.
 * No direct API calls - everything is done by clicking buttons, filling forms, etc.
 *
 * Monitors and logs all API calls made by the UI for verification.
 *
 * Usage:
 *   node tests/ui-playability-test.js
 *   node tests/ui-playability-test.js --headless
 *   node tests/ui-playability-test.js --verbose
 */

const BrowserHelper = require('./helpers/browser');
const ApiClient = require('./helpers/api-client');

const CONFIG = {
    baseUrl: 'http://cndq.test/CNDQ/',
    adminUser: 'admin@stonybrook.edu',
    testUsers: [
        'test_mail1@stonybrook.edu',
        'test_mail2@stonybrook.edu',
        'test_mail3@stonybrook.edu'
    ],
    targetSessions: 1,
    headless: process.argv.includes('--headless'),
    verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
    keepOpen: process.argv.includes('--keep-open')
};

class UIPlayabilityTest {
    constructor(config) {
        this.config = config;
        this.browser = new BrowserHelper(config);
        this.apiCallLog = [];
        this.results = {
            uiActions: 0,
            apiCallsCaptured: 0,
            errors: [],
            warnings: []
        };
    }

    /**
     * Setup API call monitoring on a page
     */
    async setupApiMonitoring(page, teamId) {
        await page.evaluateOnNewDocument(() => {
            window.__apiCalls = [];

            const originalFetch = window.fetch;
            window.fetch = async function(...args) {
                const url = args[0];
                const options = args[1] || {};

                // Log the API call
                const logEntry = {
                    timestamp: Date.now(),
                    method: options.method || 'GET',
                    url: url,
                    body: options.body ? JSON.parse(options.body) : null
                };
                window.__apiCalls.push(logEntry);

                // Make the actual call
                return originalFetch.apply(this, args);
            };
        });

        // Also log to our central log
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/api/')) {
                const method = response.request().method();
                const status = response.status();

                try {
                    const data = await response.json();
                    this.apiCallLog.push({
                        timestamp: new Date().toISOString(),
                        teamId,
                        method,
                        url: url.replace(this.config.baseUrl, ''),
                        status,
                        success: response.ok,
                        data
                    });
                    this.results.apiCallsCaptured++;
                } catch (e) {
                    // Not JSON response
                }
            }
        });
    }

    /**
     * Get API calls made by the page
     */
    async getPageApiCalls(page) {
        return await page.evaluate(() => window.__apiCalls || []);
    }

    /**
     * Run complete UI playability test
     */
    async run() {
        console.log('🎮 UI Playability Test (Single Long Marketplace)');
        console.log('='.repeat(80));
        console.log(`Base URL: ${this.config.baseUrl}`);
        console.log(`Teams: ${this.config.testUsers.length} players`);
        console.log('='.repeat(80));
        console.log('');

        try {
            await this.browser.launch();

            // Step 1: Admin setup
            await this.setupGame();

            // Step 2: Play the marketplace run (Single Round)
            await this.playMarketplace();

            // Step 3: End game and check results
            await this.endGameAndCheckResults();

            // Step 4: Print results
            this.printResults();

            if (!this.config.keepOpen) {
                await this.browser.close();
            } else {
                console.log('\n⏸️  Browser kept open for inspection...');
                await this.browser.keepOpen();
            }

        } catch (error) {
            console.error('\n❌ Test failed:', error.message);
            if (this.config.verbose) {
                console.error(error.stack);
            }
            await this.browser.close();
            process.exit(1);
        }

        process.exit(this.results.errors.length > 0 ? 1 : 0);
    }

    /**
     * Setup game via admin UI
     */
    async setupGame() {
        console.log('\n🛡️  ADMIN SETUP');
        console.log('-'.repeat(80));

        const adminPage = await this.browser.loginAndNavigate(this.config.adminUser, 'admin/');
        await this.setupApiMonitoring(adminPage, 'admin');

        // Wait for admin page to load
        await adminPage.waitForSelector('button[onclick="resetGameData()"]', { timeout: 10000 });

        console.log('   📋 Resetting game...');
        this.results.uiActions++;

        // Click reset button
        await adminPage.click('button[onclick="resetGameData()"]');

        // Handle custom confirmation modal
        await adminPage.waitForSelector('#confirm-modal:not(.hidden)', { timeout: 5000 });
        await adminPage.click('#confirm-modal-yes');
        await this.browser.sleep(2000);

        console.log('   ✅ Game reset');

        // Step 3: Enable NPCs
        console.log('   🤖 Enabling NPCs...');
        await adminPage.click('#npc-system-enabled');
        await this.browser.sleep(500);
        
        // Add more NPCs of different levels to encourage variety and NPC-NPC interaction
        const npcLevels = ['expert', 'novice', 'expert', 'beginner', 'expert'];
        for (const level of npcLevels) {
            await adminPage.select('#npc-skill-level', level);
            await adminPage.click('button[onclick="createNPC()"]');
            await this.browser.sleep(500);
        }
        
        await this.browser.sleep(1000);
        console.log(`   ✅ ${npcLevels.length} NPCs created`);

        // Set trading duration
        console.log('   ⏱️  Setting trading duration to 10m...');
        this.results.uiActions++;

        const durationInput = await adminPage.$('#trading-duration-minutes');
        if (durationInput) {
            await durationInput.click({ clickCount: 3 }); // Select all
            await durationInput.type('10'); // 10 minutes

            await adminPage.click('button[onclick="updateTradingDuration()"]');
            await this.browser.sleep(500);
        }

        // Start the market (if not already started by reset/startNew)
        console.log('   🎬 Ensuring market is started...');
        const startStopBtn = await adminPage.waitForSelector('#start-stop-btn', { timeout: 5000 });
        const btnText = await adminPage.evaluate(el => el.textContent, startStopBtn);
        
        if (btnText.includes('Start')) {
            await adminPage.click('#start-stop-btn');
            await this.browser.sleep(1000);
        }

        console.log('   ✅ Market is running');

        const apiCalls = await this.getPageApiCalls(adminPage);
        console.log(`   📡 API calls captured: ${apiCalls.length}`);

        await adminPage.close();
    }

    /**
     * Play the marketplace run
     */
    async playMarketplace() {
        console.log(`\n🎮 PLAYING MARKETPLACE (Continuous)`);
        console.log('-'.repeat(80));

        // Multi-turn trading within the SAME session
        const turns = 5;
        for (let turn = 1; turn <= turns; turn++) {
            console.log(`\n   🔄 Turn ${turn}/${turns}...`);
            // Each player takes multiple actions sequentially
            for (const userId of this.config.testUsers) {
                await this.playerTakesActions(userId, turn);
            }
            if (turn < turns) {
                console.log('      ⏳ Waiting for market activity & NPC response...');
                await this.browser.sleep(10000); // 10s between turns
            }
        }
    }

    /**
     * A player takes various UI actions
     */
    async playerTakesActions(userId, turnNum) {
        const teamName = userId.split('@')[0];
        console.log(`      👤 ${teamName} acting...`);

        const page = await this.browser.loginAndNavigate(userId, '');
        await this.setupApiMonitoring(page, userId);

        try {
            // Ensure we are in TRADING phase before acting
            await page.waitForFunction(() => {
                const el = document.getElementById('current-phase');
                return el && el.textContent.toUpperCase().includes('TRADING');
            }, { timeout: 10000 }).catch(() => {});

            // Action 1: Check for negotiations
            const negotiationId = await page.evaluate(() => {
                const card = document.querySelector('negotiation-card[context="summary"]');
                if (card && card.innerText.includes('Your Turn')) {
                    return card.getAttribute('negotiation-id');
                }
                return null;
            });

            if (negotiationId) {
                console.log(`         ✅ Responding to negotiation: ${negotiationId}`);
                await page.evaluate((id) => {
                    const card = document.querySelector(`negotiation-card[negotiation-id="${id}"]`);
                    card.querySelector('[role="button"]').click();
                }, negotiationId);
                
                await this.browser.sleep(1500);
                
                // Randomly accept or counter
                const shouldAccept = Math.random() > 0.5;
                if (shouldAccept) {
                    await page.click('#accept-offer-btn');
                    await this.browser.sleep(1000);
                    await page.click('#confirm-ok');
                    console.log('         🎉 Trade accepted!');
                } else {
                    console.log('         ⚖️  Sending counter-offer...');
                    await page.click('#show-counter-form-btn');
                    await this.browser.sleep(500);
                    await page.click('#submit-counter-btn');
                    console.log('         📤 Counter-offer sent');
                }
                await this.browser.sleep(2000);
            }

            // Action 2: Post a Buy Request for a random chemical
            const chemicals = ['C', 'N', 'D', 'Q'];
            const chem = chemicals[Math.floor(Math.random() * chemicals.length)];
            
            console.log(`         📢 Posting interest to buy ${chem}...`);
            await page.evaluate((c) => {
                if (window.app) window.app.openBuyRequestModal(c);
            }, chem);
            
            await page.waitForSelector('#offer-modal:not(.hidden)', { timeout: 5000 });
            await page.click('#offer-submit-btn');
            await this.browser.sleep(1500);
            
            this.results.uiActions++;
        } catch (error) {
            this.results.errors.push({ turn: turnNum, user: userId, error: error.message });
            console.log(`         ❌ Error: ${error.message}`);
        } finally {
            await page.close();
        }
    }

    /**
     * Finalize game via admin UI
     */
    async finalizeGame() {
        console.log(`\n   ⏩ Finalizing game...`);

        const adminPage = await this.browser.loginAndNavigate(this.config.adminUser, 'admin/');
        await this.setupApiMonitoring(adminPage, 'admin-finalize');

        this.results.uiActions++;

        // Click finalize button
        const finalizeBtn = await adminPage.$('button[onclick="finalizeGame()"]');
        if (finalizeBtn) {
            await finalizeBtn.click();
            await this.browser.sleep(3000);

            // Verify market stopped
            const phase = await adminPage.evaluate(() => {
                return document.getElementById('current-phase')?.textContent?.trim();
            });

            if (phase === 'STOPPED') {
                console.log(`   ✅ Game finalized (Market STOPPED)`);
            } else {
                console.log(`   ⚠️  Unexpected phase: ${phase}`);
            }
        } else {
            console.log('   ❌ Finalize button not found');
            this.results.errors.push({ error: 'Finalize button not found' });
        }

        await adminPage.close();
    }

    /**
     * Advance session (legacy name, now calls finalizeGame)
     */
    async advanceSession(currentSession) {
        return this.finalizeGame();
    }

    /**
     * End game and check final results
     */
    async endGameAndCheckResults() {
        console.log(`\n🏁 ENDING GAME & CHECKING RESULTS (UI)`);
        console.log('-'.repeat(80));

        // 1. Finalize Game
        await this.finalizeGame();

        // 2. Switch to student to see final overlay
        const student = this.config.testUsers[0];
        const page = await this.browser.loginAndNavigate(student, '');
        
        // Wait for Game Over Overlay
        console.log('   ⌛ Waiting for Game Over overlay...');
        await page.waitForSelector('#game-over-overlay:not(.hidden)', { timeout: 10000 });
        await this.screenshot(page, 'game-over-overlay');

        // 3. Read Leaderboard from UI
        console.log('   🏆 Reading Leaderboard from UI...');
        const standings = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#final-leaderboard-container > div'));
            return rows.map(row => {
                const name = row.querySelector('.font-black.text-xl')?.textContent?.trim();
                const funds = row.querySelector('.text-3xl.font-black')?.textContent?.trim();
                return { name, funds };
            });
        });

        if (standings.length > 0) {
            console.log(`   📊 Found ${standings.length} teams on final leaderboard:`);
            standings.forEach((s, i) => console.log(`      ${i+1}. ${s.name}: ${s.funds}`));
        } else {
            console.log('   ⚠️  No teams found on final leaderboard UI');
            this.results.warnings.push('Final leaderboard UI was empty');
        }

        await page.close();
    }

    async screenshot(page, name) {
        if (this.config.headless) return;
        const path = `ui-test-${name}-${Date.now()}.png`;
        await page.screenshot({ path });
        console.log(`   📸 Screenshot saved: ${path}`);
    }

    printResults() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 TEST RESULTS');
        console.log('='.repeat(80));
        console.log(`UI Actions Performed: ${this.results.uiActions}`);
        console.log(`API Calls Captured: ${this.results.apiCallsCaptured}`);
        console.log(`Errors: ${this.results.errors.length}`);
        console.log(`Warnings: ${this.results.warnings.length}`);
        console.log('='.repeat(80));

        if (this.results.errors.length > 0) {
            console.log('\n❌ ERRORS:');
            this.results.errors.forEach((err, i) => {
                console.log(`   ${i + 1}. ${err.user || 'Unknown'}: ${err.error}`);
            });
        }

        if (this.results.warnings.length > 0) {
            console.log('\n⚠️  WARNINGS:');
            this.results.warnings.forEach((warn, i) => {
                console.log(`   ${i + 1}. ${warn}`);
            });
        }

        // API call summary
        if (this.apiCallLog.length > 0) {
            console.log('\n📡 API CALL SUMMARY:');

            const apiSummary = {};
            this.apiCallLog.forEach(call => {
                const endpoint = call.url.split('?')[0]; // Remove query params
                apiSummary[endpoint] = (apiSummary[endpoint] || 0) + 1;
            });

            Object.entries(apiSummary)
                .sort((a, b) => b[1] - a[1])
                .forEach(([endpoint, count]) => {
                    console.log(`   ${count.toString().padStart(3)}x  ${endpoint}`);
                });

            // Write detailed log to file
            const fs = require('fs');
            const logFile = `api-call-log-${Date.now()}.json`;
            fs.writeFileSync(logFile, JSON.stringify(this.apiCallLog, null, 2));
            console.log(`\n   📄 Detailed log written to: ${logFile}`);
        }

        console.log('');
    }
}

// Run the test
if (require.main === module) {
    const test = new UIPlayabilityTest(CONFIG);
    test.run().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = UIPlayabilityTest;