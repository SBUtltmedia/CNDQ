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
    baseUrl: 'http://cndq.test/CNDQ/',
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
        console.log('🔌 API Playability Test (Single Round Model)');
        console.log('='.repeat(80));
        console.log(`Base URL: ${this.config.baseUrl}`);
        console.log(`Teams: ${this.config.testUsers.length} players`);
        console.log('='.repeat(80));
        console.log('');

        try {
            await this.browser.launch();

            // Step 1: Admin setup
            await this.setupGameViaAPI();

            // Step 2: Play the single marketplace run
            await this.playMarketplaceViaAPI();

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
            throw error;
        }

        return this.results.failed === 0;
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

        // Enable NPC System
        console.log('   🤖 Enabling NPC System...');
        const npcToggleResponse = await api.toggleNPCSystem(true);
        this.logApiCall('POST', '/api/admin/npc/toggle-system', { enabled: true }, npcToggleResponse);

        // Create NPCs of various levels
        const npcLevels = ['expert', 'expert', 'novice', 'novice', 'beginner'];
        for (const level of npcLevels) {
            console.log(`      Adding ${level} NPC...`);
            const createResponse = await api.createNPC(level);
            this.logApiCall('POST', '/api/admin/npc/create', { skillLevel: level }, createResponse);
        }

        // Set auto-advance to TRUE (Continuous Mode) and duration
        console.log('   ⏱️  Setting trading duration to 600s...');

        const autoAdvanceResponse = await api.setAutoAdvance(true);
        this.logApiCall('POST', '/api/admin/session', { action: 'setAutoAdvance', enabled: true }, autoAdvanceResponse);

        const durationResponse = await api.setTradingDuration(600);
        this.logApiCall('POST', '/api/admin/session', { action: 'setTradingDuration', seconds: 600 }, durationResponse);

        // Start the game
        console.log('   🎬 Starting game...');

        const startResponse = await api.startGame();
        this.logApiCall('POST', '/api/admin/session', { action: 'start' }, startResponse);

        if (!startResponse.ok) {
            throw new Error(`Failed to start game: ${startResponse.data.error}`);
        }

        console.log('   ✅ Game started with NPCs');
        console.log(`   📡 Admin setup API calls: ${this.results.apiCalls}`);

        await adminPage.close();
    }

    /**
     * Play the single marketplace run via API
     */
    async playMarketplaceViaAPI() {
        console.log(`\n🎮 PLAYING MARKETPLACE (API)`);
        console.log('-'.repeat(80));

        // Multi-turn trading
        const turns = 10;
        for (let turn = 1; turn <= turns; turn++) {
            console.log(`\n   🔄 Turn ${turn}/${turns}...`);
            // Each player takes multiple actions sequentially
            for (const userId of this.config.testUsers) {
                await this.playerTakesActionsViaAPI(userId);
            }
            if (turn < turns) {
                console.log('      ⏳ Waiting for market activity & NPC response (15s)...');
                await this.browser.sleep(15000); // Increased to 15s between turns
            }
        }
    }

    /**
     * A player takes actions
     */
    async playerTakesActionsViaAPI(userId) {
        const teamName = userId.split('@')[0];
        console.log(`      👤 ${teamName} acting (API)...`);

        const page = await this.browser.loginAndNavigate(userId, '');
        const api = new ApiClient(page, this.config.baseUrl);

        try {
            // 1. Get Shadow Prices and Inventory
            const shadowResponse = await api.getShadowPrices();
            this.logApiCall('GET', '/api/production/shadow-prices', {}, shadowResponse);
            
            const shadowPrices = shadowResponse.data.shadowPrices || { C: 0, N: 0, D: 0, Q: 0 };
            const inventory = shadowResponse.data.inventory || { C: 0, N: 0, D: 0, Q: 0 };

            // 2. Respond to Negotiations (Haggle/Accept)
            const negotiationsResponse = await api.listNegotiations();
            this.logApiCall('GET', '/api/negotiations/list', {}, negotiationsResponse);

            if (negotiationsResponse.ok) {
                const negotiations = negotiationsResponse.data.negotiations || [];
                const pending = negotiations.filter(n => n.status === 'pending' && n.lastOfferBy !== userId);
                
                for (const neg of pending) {
                    const latestOffer = neg.offers[neg.offers.length - 1];
                    const chem = neg.chemical;
                    const myValuation = shadowPrices[chem] || 0;
                    
                    let acceptable = false;
                    const isBuyer = (neg.type === 'buy' && neg.initiator_id === userId) || (neg.type === 'sell' && neg.initiator_id !== userId);

                    if (isBuyer) {
                        // I want to buy for LESS than my shadow price
                        if (latestOffer.price <= myValuation * 1.05) acceptable = true;
                    } else {
                        // I want to sell for MORE than my shadow price
                        if (latestOffer.price >= myValuation * 0.95) acceptable = true;
                    }

                    if (acceptable) {
                        console.log(`         ✅ Accepting negotiation: ${neg.id} for ${chem} at $${latestOffer.price}`);
                        const acceptResponse = await api.acceptNegotiation(neg.id);
                        this.logApiCall('POST', '/api/negotiations/accept', { negotiationId: neg.id }, acceptResponse);
                    } else if (neg.offers.length < 3) {
                        // Counter-offer logic (split the difference)
                        const targetPrice = (latestOffer.price + myValuation) / 2;
                        console.log(`         ⚖️  Countering negotiation: ${neg.id} for ${chem} at $${targetPrice.toFixed(2)}`);
                        const counterResponse = await api.counterNegotiation(neg.id, latestOffer.quantity, targetPrice);
                        this.logApiCall('POST', '/api/negotiations/counter', { negotiationId: neg.id, quantity: latestOffer.quantity, price: targetPrice }, counterResponse);
                    }
                }
            }

            // 3. Browse Marketplace Advertisements
            const adsResponse = await api.listAdvertisements();
            this.logApiCall('GET', '/api/advertisements/list', {}, adsResponse);

            if (adsResponse.ok) {
                const allAds = adsResponse.data.advertisements || {};
                for (const [chem, chemAds] of Object.entries(allAds)) {
                    const myValuation = shadowPrices[chem] || 0;

                    // Check for interesting SELL ads (I might want to BUY)
                    for (const ad of (chemAds.sell || [])) {
                        if (ad.teamId === userId) continue;
                        if (myValuation > 5 && Math.random() > 0.5) {
                            console.log(`         🤝 Initiating BUY for ${chem} from ${ad.teamName} (Shadow: $${myValuation.toFixed(2)})`);
                            const initResponse = await api.initiateNegotiation(ad.teamId, chem, 100, myValuation * 0.9, 'buy', ad.id);
                            this.logApiCall('POST', '/api/negotiations/initiate', { responderId: ad.teamId, chemical: chem, price: myValuation * 0.9 }, initResponse);
                        }
                    }
                }
            }

            // 4. Post Maintenance Ads (Buy bottlenecks, Sell surplus)
            for (const chem of ['C', 'N', 'D', 'Q']) {
                const valuation = shadowPrices[chem] || 0;
                const stock = inventory[chem] || 0;

                if (valuation > 10 && Math.random() > 0.7) {
                    console.log(`         📝 Posting BUY request for ${chem} (Shadow: $${valuation.toFixed(2)})`);
                    const bidResponse = await api.createBuyOrder(chem, 100, valuation);
                    this.logApiCall('POST', '/api/offers/bid', { chemical: chem, quantity: 100, maxPrice: valuation }, bidResponse);
                } else if (valuation < 1 && stock > 300 && Math.random() > 0.7) {
                    console.log(`         📢 Posting SELL ad for ${chem} (Stock: ${Math.round(stock)})`);
                    const adResponse = await api.postAdvertisement(chem, 'sell', "Surplus sale!");
                    this.logApiCall('POST', '/api/advertisements/post', { chemical: chem, type: 'sell' }, adResponse);
                }
            }

        } catch (error) {
            console.log(`         ⚠️ Error acting for ${teamName}: ${error.message}`);
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

        // 1. Finalize Game (Ends Round)
        console.log('   ⏩ Finalizing Game (Closing Market)...');
        const finalizeResponse = await api.controlSession('finalize');
        this.logApiCall('POST', '/api/admin/session', { action: 'finalize' }, finalizeResponse);

        if (!finalizeResponse.ok) {
            throw new Error(`Failed to finalize game: ${finalizeResponse.data.error}`);
        }

        // Wait for processing
        await this.browser.sleep(2000);

        // 2. Verify Session Status
        const statusResponse = await api.getSessionStatus();
        this.logApiCall('GET', '/api/session/status', {}, statusResponse);
        
        const isFinished = statusResponse.data.gameFinished;
        console.log(`   📊 Game Finished: ${isFinished}`);
        
        if (!isFinished) {
             this.results.warnings.push('Game did not report "gameFinished: true" after finalizing.');
        }

        // 3. Get Leaderboard (Final Results)
        console.log('   🏆 Fetching Final Leaderboard...');
        const leaderboardResponse = await api.getLeaderboard();
        this.logApiCall('GET', '/api/leaderboard/standings', {}, leaderboardResponse);

        if (leaderboardResponse.ok) {
            const standings = leaderboardResponse.data.standings || [];
            console.log(`   📊 Leaderboard (${standings.length} teams):`);
            
            // Validate Results - Sanity Check
            if (standings.length === 0) {
                 this.results.failed++;
                 this.results.errors.push({ user: 'system', error: 'Leaderboard is empty' });
            } else {
                 standings.forEach((team, i) => {
                    const totalValue = team.currentFunds;
                    const startingValue = team.startingFunds;
                    const roi = team.roi;
                    
                    console.log(`      ${i + 1}. ${team.teamName.padEnd(20)}: $${totalValue.toFixed(2).padStart(10)} (ROI: ${roi.toFixed(1)}%)`);
                    
                    // Sanity check: ROI should be calculated correctly
                    const expectedRoi = startingValue > 0 ? ((totalValue - startingValue) / startingValue) * 100 : (totalValue > 0 ? 100 : 0);
                    if (Math.abs(roi - expectedRoi) > 0.1) {
                        this.results.warnings.push(`ROI mismatch for ${team.teamName}: expected ${expectedRoi.toFixed(1)}%, got ${roi.toFixed(1)}%`);
                    }
                });

                // Check if anyone actually improved (at least some activity should happen)
                const improvedCount = standings.filter(t => t.currentFunds > t.startingFunds).length;
                console.log(`   📈 Teams with improved value: ${improvedCount}/${standings.length}`);
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
    test.run().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = APIPlayabilityTest;