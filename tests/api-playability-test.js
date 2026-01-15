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
        'test_mail3@stonybrook.edu',
        'test_mail4@stonybrook.edu',
        'test_mail5@stonybrook.edu',
        'test_mail6@stonybrook.edu'
    ],
    headless: process.argv.includes('--headless'),
    verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
    keepOpen: process.argv.includes('--keep-open'),
    skillLevel: 'expert', // Default oracle skill level
    skillLevels: null     // Optional array of skill levels for RPCs
};

class APIPlayabilityTest {
    constructor(config) {
        this.config = { ...CONFIG, ...config };
        this.browser = new BrowserHelper(this.config);
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
        const npcLevels = this.config.npcLevels || ['expert', 'expert', 'novice', 'novice', 'beginner'];
        for (const level of npcLevels) {
            console.log(`      Adding ${level} NPC...`);
            const createResponse = await api.createNPC(level);
            this.logApiCall('POST', '/api/admin/npc/create', { skillLevel: level }, createResponse);
        }

        // Set auto-advance to TRUE (Continuous Mode) and duration
        const durationSec = (this.config.tradingDuration || 10) * 60;
        console.log(`   ⏱️  Setting trading duration to ${durationSec}s...`);

        const autoAdvanceResponse = await api.setAutoAdvance(true);
        this.logApiCall('POST', '/api/admin/session', { action: 'setAutoAdvance', enabled: true }, autoAdvanceResponse);

        const durationResponse = await api.setTradingDuration(durationSec);
        this.logApiCall('POST', '/api/admin/session', { action: 'setTradingDuration', seconds: durationSec }, durationResponse);

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
    async asyncHeartbeat(api, durationMs) {
        const interval = 5000;
        let elapsed = 0;
        while (elapsed < durationMs) {
            await api.getSessionStatus();
            await this.browser.sleep(interval);
            elapsed += interval;
        }
    }

    async playMarketplaceViaAPI() {
        console.log(`\n🎮 PLAYING MARKETPLACE (API)`);
        console.log('-'.repeat(80));

        // Use a persistent admin page for heartbeats
        const adminPage = await this.browser.loginAndNavigate(this.config.adminUser, '');
        const api = new ApiClient(adminPage, this.config.baseUrl);

        // Multi-turn trading
        const turns = 10;
        for (let turn = 1; turn <= turns; turn++) {
            console.log(`\n   🔄 Turn ${turn}/${turns}...`);
            
            // 1. Heartbeat to trigger NPCs
            await api.getSessionStatus();

            // 2. Each player takes multiple actions sequentially
            for (let i = 0; i < this.config.testUsers.length; i++) {
                const userId = this.config.testUsers[i];
                await this.playerTakesActionsViaAPI(userId, i);
            }

            if (turn < turns) {
                console.log('      ⏳ Waiting for market activity & NPC response (15s heartbeat)...');
                await this.asyncHeartbeat(api, 15000);
            }
        }
        await adminPage.close();
    }

    /**
     * A player takes actions
     */
    async playerTakesActionsViaAPI(userId, playerIndex = 0) {
        const teamName = userId.split('@')[0];
        
        // Determine skill level for this specific player
        let skill = this.config.skillLevel;
        if (Array.isArray(this.config.skillLevels) && this.config.skillLevels[playerIndex]) {
            skill = this.config.skillLevels[playerIndex];
        }

        console.log(`      👤 ${teamName} acting (API via ${skill} Oracle)...`);

        const page = await this.browser.loginAndNavigate(userId, '');
        const api = new ApiClient(page, this.config.baseUrl);

        try {
            // 1. Consult the Oracle (Server-Side Strategy)
            const oracleResponse = await api.consultStrategy(skill);
            
            this.logApiCall('GET', '/api/test/consult-strategy', { skill: skill }, oracleResponse);

            if (!oracleResponse.ok || !oracleResponse.data.success) {
                console.log(`         ⚠️ Oracle Error: ${oracleResponse.data.error || 'Unknown error'}`);
                return;
            }

            const rec = oracleResponse.data.recommendation;

            // 2. Execute Negotiation Action (if any)
            if (rec.negotiation_action) {
                const action = rec.negotiation_action;
                const negId = action.negotiationId;
                
                if (action.type === 'accept_negotiation') {
                    console.log(`         👉 Oracle: Accepting negotiation ${negId}`);
                    const res = await api.acceptNegotiation(negId);
                    this.logApiCall('POST', '/api/negotiations/accept', { negotiationId: negId }, res);
                    
                } else if (action.type === 'counter_negotiation') {
                    console.log(`         👉 Oracle: Countering ${negId} (${action.quantity} @ $${action.price})`);
                    const res = await api.counterNegotiation(negId, action.quantity, action.price);
                    this.logApiCall('POST', '/api/negotiations/counter', { negotiationId: negId, quantity: action.quantity, price: action.price }, res);
                    
                } else if (action.type === 'reject_negotiation') {
                    console.log(`         👉 Oracle: Rejecting negotiation ${negId}`);
                    const res = await api.rejectNegotiation(negId);
                    this.logApiCall('POST', '/api/negotiations/reject', { negotiationId: negId }, res);
                }
            } 
            
            // 3. Execute New Trade Action (if any)
            else if (rec.trade_action) {
                const action = rec.trade_action;
                
                if (action.type === 'initiate_negotiation') {
                    console.log(`         👉 Oracle: Initiating trade for ${action.chemical} with ${action.responderName}`);
                    const res = await api.initiateNegotiation(
                        action.responderId, 
                        action.chemical, 
                        action.quantity, 
                        action.price, 
                        'buy', // Oracle usually suggests buying from advertisements
                        action.adId
                    );
                    this.logApiCall('POST', '/api/negotiations/initiate', { responderId: action.responderId, chemical: action.chemical }, res);
                    
                } else if (action.type === 'create_buy_order') {
                    console.log(`         👉 Oracle: Creating Buy Order for ${action.chemical} ($${action.maxPrice})`);
                    const res = await api.createBuyOrder(action.chemical, action.quantity, action.maxPrice);
                    this.logApiCall('POST', '/api/offers/bid', { chemical: action.chemical, quantity: action.quantity, maxPrice: action.maxPrice }, res);
                    
                } else if (action.type === 'create_sell_offer') {
                     console.log(`         👉 Oracle: Creating Sell Offer for ${action.chemical} ($${action.minPrice})`);
                     const res = await api.createOffer(action.chemical, action.quantity, action.minPrice);
                     this.logApiCall('POST', '/api/offers/create', { chemical: action.chemical, quantity: action.quantity, minPrice: action.minPrice }, res);
                }
            } else {
                console.log('         💤 Oracle: No profitable moves found');
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