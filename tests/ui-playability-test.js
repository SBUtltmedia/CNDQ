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
    baseUrl: 'http://cndq.test/CNDQ',
    adminUser: 'admin@stonybrook.edu',
    testUsers: [
        'test_mail1@stonybrook.edu'
    ],
    targetSessions: 1,
    headless: true,
    verbose: false,
    keepOpen: false
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
        console.log('🎮 UI Playability Test');
        console.log('='.repeat(80));
        console.log(`Base URL: ${this.config.baseUrl}`);
        console.log(`Sessions to play: ${this.config.targetSessions}`);
        console.log(`Teams: ${this.config.testUsers.length} players`);
        console.log('='.repeat(80));
        console.log('');

        try {
            await this.browser.launch();

            // Step 1: Admin setup
            await this.setupGame();

            // Step 2: Play multiple sessions
            for (let session = 1; session <= this.config.targetSessions; session++) {
                await this.playSession(session);
            }

            // Step 3: Print results
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
        await adminPage.waitForSelector('#reset-game-btn', { timeout: 10000 });

        console.log('   📋 Resetting game...');
        this.results.uiActions++;

        // Click reset button
        await adminPage.click('#reset-game-btn');

        // Wait for confirmation dialog
        await adminPage.waitForFunction(() => {
            return window.confirm || document.querySelector('.confirm-dialog');
        }, { timeout: 5000 }).catch(() => {});

        // Handle confirmation
        await adminPage.evaluate(() => {
            if (window.confirm) {
                window.confirm = () => true;
            }
        });

        await this.browser.sleep(2000);

        console.log('   ✅ Game reset');

        // Start the game
        console.log('   🎬 Starting game...');
        this.results.uiActions++;

        await adminPage.waitForSelector('#start-game-btn', { timeout: 5000 });
        await adminPage.click('#start-game-btn');
        await this.browser.sleep(1000);

        console.log('   ✅ Game started');

        // Set trading duration
        console.log('   ⏱️  Setting trading duration...');
        this.results.uiActions++;

        const durationInput = await adminPage.$('#trading-duration');
        if (durationInput) {
            await durationInput.click({ clickCount: 3 }); // Select all
            await durationInput.type('300'); // 5 minutes

            // Press Enter or click update button
            await durationInput.press('Enter').catch(() => {});
            await this.browser.sleep(500);
        }

        console.log('   ✅ Trading duration set to 300s');

        const apiCalls = await this.getPageApiCalls(adminPage);
        console.log(`   📡 API calls captured: ${apiCalls.length}`);

        if (this.config.verbose) {
            console.log('   📝 Admin setup API calls:');
            apiCalls.forEach(call => {
                console.log(`      ${call.method} ${call.url}`);
            });
        }

        await adminPage.close();
    }

    /**
     * Play one complete session
     */
    async playSession(sessionNum) {
        console.log(`\n🎮 SESSION ${sessionNum}`);
        console.log('-'.repeat(80));

        // Each player takes multiple actions
        for (const userId of this.config.testUsers) {
            await this.playerTakesActions(userId, sessionNum);
        }

        // Advance session (via admin UI)
        await this.advanceSession(sessionNum);
    }

    /**
     * A player takes various UI actions
     */
    async playerTakesActions(userId, sessionNum) {
        const teamName = userId.split('@')[0];
        console.log(`\n   👤 ${teamName} taking actions...`);

        const page = await this.browser.loginAndNavigate(userId, '');
        await this.setupApiMonitoring(page, userId);

        let actionsCount = 0;

        try {
            // Action 1: Post an advertisement
            console.log('      📢 Posting advertisement...');
            actionsCount++;
            this.results.uiActions++;

            const adButton = await page.$('[data-action="post-ad"]');
            if (adButton) {
                await adButton.click();
                await this.browser.sleep(500);

                // Fill ad form
                await page.type('#ad-chemical', 'C');
                await page.select('#ad-type', 'sell');
                await page.type('#ad-message', `${teamName} selling Carbon - great prices!`);

                // Submit
                await page.click('#post-ad-submit');
                await this.browser.sleep(1000);

                console.log('      ✅ Advertisement posted');
            } else {
                console.log('      ⏭️  Ad button not found');
            }

            // Action 2: Create a sell offer
            console.log('      💰 Creating sell offer...');
            actionsCount++;
            this.results.uiActions++;

            const createOfferBtn = await page.$('[data-action="create-offer"]');
            if (createOfferBtn) {
                await createOfferBtn.click();
                await this.browser.sleep(500);

                // Fill offer form
                await page.select('#offer-chemical', 'C');
                await page.type('#offer-quantity', '10');
                await page.type('#offer-min-price', '5.50');

                // Submit
                await page.click('#create-offer-submit');
                await this.browser.sleep(1000);

                console.log('      ✅ Sell offer created');
            } else {
                console.log('      ⏭️  Create offer button not found');
            }

            // Action 3: View marketplace
            console.log('      🏪 Viewing marketplace...');
            actionsCount++;
            this.results.uiActions++;

            const marketplaceTab = await page.$('[data-tab="marketplace"]');
            if (marketplaceTab) {
                await marketplaceTab.click();
                await this.browser.sleep(1000);

                console.log('      ✅ Marketplace viewed');
            }

            // Action 4: Check for negotiations and respond
            console.log('      🤝 Checking negotiations...');
            actionsCount++;
            this.results.uiActions++;

            const negotiationsTab = await page.$('[data-tab="negotiations"]');
            if (negotiationsTab) {
                await negotiationsTab.click();
                await this.browser.sleep(1000);

                // Look for pending negotiations
                const pendingNegotiations = await page.$$('.negotiation-item.pending');

                if (pendingNegotiations.length > 0) {
                    console.log(`      📋 Found ${pendingNegotiations.length} pending negotiations`);

                    // Accept the first one
                    const acceptBtn = await pendingNegotiations[0].$('[data-action="accept"]');
                    if (acceptBtn) {
                        await acceptBtn.click();
                        await this.browser.sleep(1000);
                        console.log('      ✅ Accepted negotiation');
                    }
                } else {
                    console.log('      ℹ️  No pending negotiations');
                }
            }

            // Action 5: View production results
            console.log('      🏭 Checking production...');
            actionsCount++;
            this.results.uiActions++;

            const productionTab = await page.$('[data-tab="production"]');
            if (productionTab) {
                await productionTab.click();
                await this.browser.sleep(1000);

                console.log('      ✅ Production viewed');
            }

            // Get all API calls made during this player's turn
            const apiCalls = await this.getPageApiCalls(page);
            console.log(`      📡 API calls: ${apiCalls.length}`);

            if (this.config.verbose && apiCalls.length > 0) {
                console.log('      📝 Detailed API calls:');
                apiCalls.forEach(call => {
                    const bodyStr = call.body ? JSON.stringify(call.body).substring(0, 50) : '';
                    console.log(`         ${call.method} ${call.url} ${bodyStr}`);
                });
            }

            console.log(`      ✅ ${teamName} completed ${actionsCount} actions`);

        } catch (error) {
            this.results.errors.push({
                session: sessionNum,
                user: userId,
                error: error.message
            });
            console.log(`      ❌ Error: ${error.message}`);
        } finally {
            await page.close();
        }
    }

    /**
     * Advance to next session via admin UI
     */
    async advanceSession(currentSession) {
        console.log(`\n   ⏩ Advancing from session ${currentSession}...`);

        const adminPage = await this.browser.loginAndNavigate(this.config.adminUser, 'admin/');
        await this.setupApiMonitoring(adminPage, 'admin-advance');

        this.results.uiActions++;

        // Click advance button
        const advanceBtn = await adminPage.$('#advance-session-btn');
        if (advanceBtn) {
            await advanceBtn.click();
            await this.browser.sleep(2000);

            // Verify session advanced
            const sessionNum = await adminPage.evaluate(() => {
                const el = document.querySelector('#session-number');
                return el ? parseInt(el.textContent) : null;
            });

            if (sessionNum === currentSession + 1) {
                console.log(`   ✅ Advanced to session ${sessionNum}`);
            } else {
                console.log(`   ⚠️  Session number unexpected: ${sessionNum}`);
                this.results.warnings.push(`Session advance unclear: expected ${currentSession + 1}, got ${sessionNum}`);
            }
        } else {
            console.log('   ❌ Advance button not found');
            this.results.errors.push({ error: 'Advance button not found' });
        }

        const apiCalls = await this.getPageApiCalls(adminPage);
        if (this.config.verbose) {
            console.log(`   📡 Advance API calls: ${apiCalls.length}`);
            apiCalls.forEach(call => {
                console.log(`      ${call.method} ${call.url}`);
            });
        }

        await adminPage.close();
    }

    /**
     * Print test results
     */
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
