/**
 * API-Only Playability Test (Single Round)
 *
 * Tests the complete game flow using ONLY direct API calls.
 * Mirrors the UI test but validates API endpoints work correctly without UI.
 *
 * Architecture: Single Round, Unlimited Capital, Final Production Only.
 *
 * Usage:
 *   node tests/api-playability-test.js
 *   node tests/api-playability-test.js --headless
 *   node tests/api-playability-test.js --verbose
 */

const BrowserHelper = require('./helpers/browser');
const ApiClient = require('./helpers/api-client');

const CONFIG = {
    baseUrl: 'http://cndq.test/CNDQ',
    adminUser: 'admin@stonybrook.edu',
    testUsers: [
        'test_mail1@stonybrook.edu',
        'test_mail2@stonybrook.edu',
        'test_mail3@stonybrook.edu'
    ],
    headless: process.argv.includes('--headless'),
    verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
    keepOpen: process.argv.includes('--keep-open')
};

class APIPlayabilityTest {
    constructor(config) {
        this.config = config;
        this.browser = new BrowserHelper(config);
        this.apiCallLog = [];
        this.results = {
            apiCalls: 0,
            successful: 0,
            failed: 0,
            errors: [],
            warnings: []
        };
    }

    /**
     * Log an API call
     */
    logApiCall(method, endpoint, request, response) {
        this.results.apiCalls++;
        if (response.ok) {
            this.results.successful++;
        } else {
            this.results.failed++;
        }

        this.apiCallLog.push({
            timestamp: new Date().toISOString(),
            method,
            endpoint,
            request,
            response: {
                status: response.status,
                ok: response.ok,
                data: response.data
            }
        });

        if (this.config.verbose) {
            const status = response.ok ? '✅' : '❌';
            console.log(`      ${status} ${method} ${endpoint} (${response.status})`);
        }
    }

    /**
     * Run complete API playability test
     */
    async run() {
        console.log('🔌 API Playability Test (Single Round)');
        console.log('='.repeat(80));
        console.log(`Base URL: ${this.config.baseUrl}`);
        console.log(`Teams: ${this.config.testUsers.length} players`);
        console.log('='.repeat(80));
        console.log('');

        try {
            await this.browser.launch();

            // Step 1: Admin setup
            await this.setupGameViaAPI();

            // Step 2: Play the single session
            await this.playGameViaAPI();

            // Step 3: End game and check results
            await this.endGameAndCheckResultsViaAPI();

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

        process.exit(this.results.failed > 0 ? 1 : 0);
    }

    /**
     * Setup game via admin API
     */
    async setupGameViaAPI() {
        console.log('\n🛡️  ADMIN SETUP (API)');
        console.log('-'.repeat(80));

        const adminPage = await this.browser.loginAndNavigate(this.config.adminUser, '');
        const api = new ApiClient(adminPage, this.config.baseUrl);

        console.log('   📋 Resetting game...');

        // Reset game
        const resetResponse = await api.resetGame();
        this.logApiCall('POST', '/api/admin/reset-game', {}, resetResponse);

        if (!resetResponse.ok) {
            throw new Error(`Failed to reset game: ${resetResponse.data.error}`);
        }

        console.log('   ✅ Game reset');
        await this.browser.sleep(2000);

        // Start the game
        console.log('   🎬 Starting game...');

        const startResponse = await api.startGame();
        this.logApiCall('POST', '/api/admin/session', { action: 'start' }, startResponse);

        if (!startResponse.ok) {
            throw new Error(`Failed to start game: ${startResponse.data.error}`);
        }

        console.log('   ✅ Game started');

        // Set auto-advance to FALSE (manual control) and duration
        console.log('   ⏱️  Setting trading duration...');

        const autoAdvanceResponse = await api.setAutoAdvance(false);
        this.logApiCall('POST', '/api/admin/session', { action: 'setAutoAdvance', enabled: false }, autoAdvanceResponse);

        const durationResponse = await api.setTradingDuration(300);
        this.logApiCall('POST', '/api/admin/session', { action: 'setTradingDuration', seconds: 300 }, durationResponse);

        console.log('   ✅ Trading duration set to 300s');
        console.log(`   📡 Admin setup API calls: ${this.results.apiCalls}`);

        await adminPage.close();
    }

    /**
     * Play the single session via API
     */
    async playGameViaAPI() {
        console.log(`\n🎮 PLAYING GAME (API)`);
        console.log('-'.repeat(80));

        // Verify session status
        const statusPage = await this.browser.newPage();
        await statusPage.goto(this.config.baseUrl);
        const statusApi = new ApiClient(statusPage, this.config.baseUrl);

        const statusResponse = await statusApi.getSessionStatus();
        this.logApiCall('GET', '/api/session/status', {}, statusResponse);

        console.log(`   📊 Current session: ${statusResponse.data.session}, Phase: ${statusResponse.data.phase}`);

        if (statusResponse.data.phase !== 'TRADING') {
            this.results.warnings.push('Game phase is not TRADING as expected.');
        }

        await statusPage.close();

        // Each player takes multiple actions
        for (const userId of this.config.testUsers) {
            await this.playerTakesActionsViaAPI(userId);
        }
    }

    /**
     * A player takes various API actions
     */
    async playerTakesActionsViaAPI(userId) {
        const teamName = userId.split('@')[0];
        console.log(`\n   👤 ${teamName} taking actions (API)...`);

        const page = await this.browser.loginAndNavigate(userId, '');
        const api = new ApiClient(page, this.config.baseUrl);

        let actionsCount = 0;

        try {
            // Action 1: Post an advertisement
            console.log('      📢 Posting advertisement...');
            actionsCount++;

            const adResponse = await api.postAdvertisement(
                'C',
                'sell',
                `${teamName} selling Carbon - great prices!`
            );
            this.logApiCall('POST', '/api/advertisements/post', {
                chemical: 'C',
                type: 'sell',
                message: `${teamName} selling Carbon - great prices!`
            }, adResponse);

            if (adResponse.ok) {
                console.log('      ✅ Advertisement posted');
            } else if (adResponse.status === 403) {
                console.log('      ⏭️  Not in trading phase');
            } else {
                console.log(`      ⚠️  Failed: ${adResponse.data.error}`);
            }

            // Action 2: Create a sell offer
            console.log('      💰 Creating sell offer...');
            actionsCount++;

            const offerResponse = await api.createOffer('C', 10, 5.50);
            this.logApiCall('POST', '/api/offers/create', {
                chemical: 'C',
                quantity: 10,
                minPrice: 5.50
            }, offerResponse);

            if (offerResponse.ok) {
                console.log('      ✅ Sell offer created');
            } else if (offerResponse.status === 400 && offerResponse.data.error === 'Insufficient inventory') {
                console.log('      ℹ️  Insufficient inventory (acceptable)');
            } else if (offerResponse.status === 403) {
                console.log('      ⏭️  Not in trading phase');
            } else {
                console.log(`      ⚠️  Failed: ${offerResponse.data.error}`);
            }

            // Action 3: Create a buy order
            console.log('      💵 Creating buy order...');
            actionsCount++;

            const buyResponse = await api.createBuyOrder('N', 5, 10.0);
            this.logApiCall('POST', '/api/offers/bid', {
                chemical: 'N',
                quantity: 5,
                maxPrice: 10.0
            }, buyResponse);

            if (buyResponse.ok) {
                console.log('      ✅ Buy order created');
            } else if (buyResponse.status === 403) {
                console.log('      ⏭️  Not in trading phase');
            } else {
                console.log(`      ⚠️  Failed: ${buyResponse.data.error || 'Unknown error'}`);
            }

            // Action 4: View marketplace
            console.log('      🏪 Fetching marketplace...');
            actionsCount++;

            const marketResponse = await api.getMarketplaceOffers();
            this.logApiCall('GET', '/api/marketplace/offers', {}, marketResponse);

            if (marketResponse.ok) {
                const offerCount = Object.values(marketResponse.data.offersByChemical || {})
                    .reduce((sum, offers) => sum + offers.length, 0);
                console.log(`      ✅ Marketplace fetched (${offerCount} offers)`);
            } else {
                console.log(`      ⚠️  Failed: ${marketResponse.data.error}`);
            }

            // Action 5: List negotiations
            console.log('      🤝 Checking negotiations...');
            actionsCount++;

            const negotiationsResponse = await api.listNegotiations();
            this.logApiCall('GET', '/api/negotiations/list', {}, negotiationsResponse);

            if (negotiationsResponse.ok) {
                const negotiations = negotiationsResponse.data.negotiations || [];
                console.log(`      📋 Found ${negotiations.length} negotiations`);

                // Accept first pending negotiation if any
                const pending = negotiations.find(n => n.status === 'pending' && n.responderId === userId);
                if (pending) {
                    console.log('      🤝 Accepting negotiation...');
                    const acceptResponse = await api.acceptNegotiation(pending.id);
                    this.logApiCall('POST', '/api/negotiations/accept', { negotiationId: pending.id }, acceptResponse);

                    if (acceptResponse.ok) {
                        console.log('      ✅ Negotiation accepted');
                    }
                }
            } else {
                console.log(`      ⚠️  Failed: ${negotiationsResponse.data.error}`);
            }

            // Action 6: Get shadow prices
            console.log('      🏭 Fetching shadow prices...');
            actionsCount++;

            const shadowResponse = await api.getShadowPrices();
            this.logApiCall('GET', '/api/production/shadow-prices', {}, shadowResponse);

            if (shadowResponse.ok) {
                console.log('      ✅ Shadow prices fetched');
            } else {
                console.log(`      ⚠️  Failed: ${shadowResponse.data.error}`);
            }

            // Action 7: Get notifications
            console.log('      🔔 Fetching notifications...');
            actionsCount++;

            const notifResponse = await api.listNotifications();
            this.logApiCall('GET', '/api/notifications/list', {}, notifResponse);

            if (notifResponse.ok) {
                const notifications = notifResponse.data.notifications || [];
                console.log(`      ✅ Fetched ${notifications.length} notifications`);
            } else {
                console.log(`      ⚠️  Failed: ${notifResponse.data.error}`);
            }

            console.log(`      ✅ ${teamName} completed ${actionsCount} API calls`);

        } catch (error) {
            this.results.errors.push({
                user: userId,
                error: error.message
            });
            console.log(`      ❌ Error: ${error.message}`);
        } finally {
            await page.close();
        }
    }

    /**
     * End game and check final results
     */
    async endGameAndCheckResultsViaAPI() {
        console.log(`\n🏁 ENDING GAME & CHECKING RESULTS`);
        console.log('-'.repeat(80));

        const adminPage = await this.browser.loginAndNavigate(this.config.adminUser, '');
        const api = new ApiClient(adminPage, this.config.baseUrl);

        // 1. Advance Session (Ends Game)
        console.log('   ⏩ Advancing session (Ending Game)...');
        const advanceResponse = await api.advanceSession();
        this.logApiCall('POST', '/api/admin/session', { action: 'advance' }, advanceResponse);

        if (!advanceResponse.ok) {
            throw new Error(`Failed to advance session: ${advanceResponse.data.error}`);
        }

        // Wait for processing
        await this.browser.sleep(2000);

        // 2. Verify Session Status
        const statusResponse = await api.getSessionStatus();
        this.logApiCall('GET', '/api/session/status', {}, statusResponse);
        
        const isStopped = statusResponse.data.gameStopped;
        console.log(`   📊 Game Stopped: ${isStopped}`);
        
        if (!isStopped) {
             this.results.warnings.push('Game did not report "gameStopped: true" after advancing.');
        }

        // 3. Get Leaderboard (Final Results)
        console.log('   🏆 Fetching Final Leaderboard...');
        const leaderboardResponse = await api.getLeaderboard();
        this.logApiCall('GET', '/api/leaderboard/standings', {}, leaderboardResponse);

        if (leaderboardResponse.ok) {
            const standings = leaderboardResponse.data.standings || [];
            console.log(`   📊 Leaderboard (${standings.length} teams):`);
            
            // Validate Results
            if (standings.length === 0) {
                 this.results.failed++;
                 this.results.errors.push({ user: 'system', error: 'Leaderboard is empty' });
            } else {
                 standings.slice(0, 5).forEach((team, i) => {
                    const totalValue = team.currentFunds; // This should be the sorting metric
                    console.log(`      ${i + 1}. ${team.teamName}: $${totalValue} (Profit: ${team.productionProfit || 'N/A'})`);
                });

                // Check if most players improved
                let improvedCount = 0;
                standings.forEach(team => {
                    if (team.currentFunds > team.startingFunds) {
                        improvedCount++;
                    }
                });
                console.log(`   📈 Players improved: ${improvedCount}/${standings.length}`);
                if (improvedCount < standings.length / 2) {
                     this.results.warnings.push('Less than half of the players improved their value.');
                }

                // Check sorting
                const first = standings[0];
                const last = standings[standings.length - 1];
                if (first.currentFunds < last.currentFunds) {
                    this.results.warnings.push('Leaderboard does not appear to be sorted by currentFunds descending.');
                }
            }
        } else {
             this.results.failed++;
             this.results.errors.push({ user: 'system', error: 'Failed to fetch leaderboard' });
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
        console.log(`Total API Calls: ${this.results.apiCalls}`);
        console.log(`✅ Successful: ${this.results.successful} (${Math.round(this.results.successful / this.results.apiCalls * 100)}%)`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`⚠️  Warnings: ${this.results.warnings.length}`);
        console.log(`🚨 Errors: ${this.results.errors.length}`);
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

        // API endpoint summary
        if (this.apiCallLog.length > 0) {
            console.log('\n📡 API ENDPOINT SUMMARY:');

            const endpointSummary = {};
            this.apiCallLog.forEach(call => {
                const key = `${call.method} ${call.endpoint}`;
                if (!endpointSummary[key]) {
                    endpointSummary[key] = { total: 0, success: 0, failed: 0 };
                }
                endpointSummary[key].total++;
                if (call.response.ok) {
                    endpointSummary[key].success++;
                } else {
                    endpointSummary[key].failed++;
                }
            });

            Object.entries(endpointSummary)
                .sort((a, b) => b[1].total - a[1].total)
                .forEach(([endpoint, stats]) => {
                    const successRate = Math.round(stats.success / stats.total * 100);
                    console.log(`   ${stats.total.toString().padStart(3)}x  ${endpoint.padEnd(50)} (${successRate}% success)`);
                });

            // Write detailed log to file
            const fs = require('fs');
            const logFile = `api-playability-log-${Date.now()}.json`;
            fs.writeFileSync(logFile, JSON.stringify(this.apiCallLog, null, 2));
            console.log(`\n   📄 Detailed log written to: ${logFile}`);
        }

        console.log('');
    }
}

// Run the test
if (require.main === module) {
    const test = new APIPlayabilityTest(CONFIG);
    test.run().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = APIPlayabilityTest;