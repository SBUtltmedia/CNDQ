/**
 * API-Only Playability Test (Playwright Version)
 *
 * Runs the complete game simulation using ONLY direct API calls via Playwright's APIRequestContext.
 * Much faster and more reliable than the Puppeteer-based version.
 */

const { request } = require('playwright');
const CONFIG = require('./config');
const ApiClient = require('./lib/api-client');
const fs = require('fs');

class APIPlayabilityTest {
    constructor() {
        this.results = {
            apiCalls: 0,
            successful: 0,
            failed: 0,
            errors: [],
            warnings: []
        };
        this.apiCallLog = [];
    }

    async run() {
        console.log('🔌 API Playability Test (Playwright Engine)');
        console.log('='.repeat(80));
        
        try {
            // 1. Create Admin Context & Client
            this.adminClient = await this.createClient(CONFIG.adminUser);
            
            // 2. Create Player Contexts & Clients
            this.players = [];
            for (const email of CONFIG.testUsers) {
                const client = await this.createClient(email);
                this.players.push({ email, client });
            }

            // Step 1: Admin setup
            await this.setupGame();

            // Step 2: Play the marketplace run
            await this.playMarketplace();

            // Step 3: End game and check results
            await this.endGameAndCheckResults();

            this.printResults();

        } catch (error) {
            console.error('\n❌ Test failed:', error.message);
            if (CONFIG.verbose) console.error(error.stack);
            process.exit(1);
        }
    }

    async createClient(email) {
        const context = await request.newContext({
            baseURL: CONFIG.baseUrl
        });
        
        // Login via dev backdoor
        // Note: dev.php returns a 302 redirect usually, APIRequestContext follows it by default
        const loginUrl = `${CONFIG.baseUrl}/dev.php?user=${email}`;
        await context.get(loginUrl);
        
        return new ApiClient(context, CONFIG.baseUrl);
    }

    logResult(method, endpoint, response) {
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
            status: response.status,
            ok: response.ok,
            data: response.data
        });

        if (CONFIG.verbose) {
            const icon = response.ok ? '✅' : '❌';
            console.log(`      ${icon} ${method} ${endpoint} (${response.status})`);
        }
    }

    async setupGame() {
        console.log('\n🛡️  ADMIN SETUP');
        console.log('-'.repeat(80));

        // Reset
        const reset = await this.adminClient.resetGame();
        this.logResult('POST', 'admin/reset-game', reset);
        if (!reset.ok) throw new Error('Failed to reset game');
        console.log('   ✅ Game reset');

        // Enable NPCs
        console.log('   🤖 Enabling NPCs...');
        await this.adminClient.admin.toggleNPCSystem(true);
        await this.adminClient.admin.createNPC('expert', 4);
        await this.adminClient.admin.createNPC('novice', 4);

        // Configure
        await this.adminClient.setAutoAdvance(false);
        await this.adminClient.setTradingDuration(600);
        
        // Start
        const start = await this.adminClient.startGame();
        this.logResult('POST', 'admin/session/start', start);
        if (!start.ok) throw new Error('Failed to start game');
        console.log('   ✅ Game started with NPCs');
    }

    async playMarketplace() {
        console.log(`\n🎮 PLAYING MARKETPLACE (API)`);
        console.log('-'.repeat(80));

        const turns = 6; 
        for (let turn = 1; turn <= turns; turn++) {
            console.log(`\n   🔄 Turn ${turn}/${turns}...`);
            
            // Trigger NPC cycle by polling status (SessionManager logic)
            await this.pollStatus();

            for (const player of this.players) {
                await this.playerTurn(player);
            }

            if (turn < turns) {
                console.log('      ⏳ Waiting for market movement & NPC activity...');
                // Poll every 2s during wait to keep NPCs active
                for (let i = 0; i < 3; i++) {
                    await new Promise(r => setTimeout(r, 2000));
                    await this.pollStatus();
                }
            }
        }
    }

    async pollStatus() {
        // Calling session/status triggers SessionManager::getState() which runs NPC logic
        const status = await this.adminClient.session.getStatus();
        if (CONFIG.verbose) console.log('      📡 Polled status (triggered NPC cycle)');
        return status;
    }

    async playerTurn(player) {
        const name = player.email.split('@')[0];
        const api = player.client;

        // 1. Get Shadow Prices & Profile (Inventory)
        const profileResponse = await api.team.getProfile();
        const profile = profileResponse.data.profile;
        const inventory = profileResponse.data.inventory;

        const shadowResponse = await api.production.getShadowPrices();
        const shadowPrices = shadowResponse.data.shadowPrices;

        // 2. Prioritize Responding to pending negotiations
        const negs = await api.listNegotiations();
        if (negs.ok && negs.data.negotiations) {
            const pending = negs.data.negotiations.filter(n => 
                n.status === 'pending' && n.lastOfferBy !== player.email
            );
            
            for (const neg of pending) {
                const latestOffer = neg.offers[neg.offers.length - 1];
                const chem = neg.chemical;
                const myValuation = shadowPrices[chem] || 0;
                
                let acceptable = false;
                if (neg.type === 'buy') {
                    // initiator is buyer.
                    if (neg.initiator_id === player.email) {
                        // I am initiator (buyer) -> want low price
                        if (latestOffer.price <= myValuation * 1.05) acceptable = true;
                    } else {
                        // I am responder (seller) -> want high price
                        if (latestOffer.price >= myValuation * 0.95) acceptable = true;
                    }
                } else {
                    // neg.type === 'sell'
                    if (neg.initiator_id === player.email) {
                        // I am initiator (seller) -> want high price
                        if (latestOffer.price >= myValuation * 0.95) acceptable = true;
                    } else {
                        // I am responder (buyer) -> want low price
                        if (latestOffer.price <= myValuation * 1.05) acceptable = true;
                    }
                }

                if (acceptable) {
                    console.log(`         ✅ Accepting negotiation ${neg.id} for ${chem} at $${latestOffer.price}`);
                    const accept = await api.acceptNegotiation(neg.id);
                    this.logResult('POST', 'negotiations/accept', accept);
                } else {
                    // counter offer
                    if (neg.offers.length < 3) {
                        const targetPrice = (neg.type === 'buy' && neg.initiator_id === player.email) || (neg.type === 'sell' && neg.initiator_id !== player.email) 
                            ? myValuation * 0.95 : myValuation * 1.05;
                        console.log(`         ⚖️  Countering negotiation ${neg.id} for ${chem} at $${targetPrice.toFixed(2)}`);
                        const counter = await api.negotiations.counter(neg.id, latestOffer.quantity, targetPrice);
                        this.logResult('POST', 'negotiations/counter', counter);
                    } else {
                        console.log(`         ❌ Rejecting bad deal for ${chem}`);
                        const reject = await api.rejectNegotiation(neg.id);
                        this.logResult('POST', 'negotiations/reject', reject);
                    }
                }
            }
        }

        // 3. Browse Marketplace Ads & Initiate Negotiations
        const adsResponse = await api.advertisements.list();
        if (adsResponse.ok && adsResponse.data.advertisements) {
            const allAds = adsResponse.data.advertisements;
            
            for (const [chem, chemAds] of Object.entries(allAds)) {
                const myValuation = shadowPrices[chem] || 0;
                
                // Check SELL ads (I might want to BUY)
                for (const ad of (chemAds.sell || [])) {
                    if (ad.teamId === player.email) continue;
                    
                    if (myValuation > 5 && Math.random() > 0.5) {
                        console.log(`         🤝 Initiating BUY negotiation for ${chem} from ${ad.teamName} (Shadow: $${myValuation.toFixed(2)})`);
                        const neg = await api.negotiations.initiate(ad.teamId, chem, 50, myValuation * 0.9, 'buy', ad.id);
                        this.logResult('POST', 'negotiations/initiate', neg);
                    }
                }

                // Check BUY ads (I might want to SELL)
                for (const ad of (chemAds.buy || [])) {
                    if (ad.teamId === player.email) continue;
                    
                    if (myValuation < 3 && inventory[chem] > 100 && Math.random() > 0.5) {
                        console.log(`         💰 Initiating SELL negotiation for ${chem} to ${ad.teamName} (Shadow: $${myValuation.toFixed(2)})`);
                        const neg = await api.negotiations.initiate(ad.teamId, chem, 50, myValuation * 1.1, 'sell', ad.id);
                        this.logResult('POST', 'negotiations/initiate', neg);
                    }
                }
            }
        }

        // 4. Post Advertisements based on Shadow Prices
        const chemicals = ['C', 'N', 'D', 'Q'];
        for (const chem of chemicals) {
            const valuation = shadowPrices[chem] || 0;
            const currentStock = inventory[chem] || 0;

            if (valuation > 10 && Math.random() > 0.8) {
                const ad = await api.postAdvertisement(chem, 'buy', `Need ${chem}`);
                this.logResult('POST', 'advertisements/post', ad);
            } else if (valuation < 1 && currentStock > 300 && Math.random() > 0.8) {
                const ad = await api.postAdvertisement(chem, 'sell', `Selling ${chem}`);
                this.logResult('POST', 'advertisements/post', ad);
            }
        }
    }

    async endGameAndCheckResults() {
        console.log(`\n🏁 ENDING GAME`);
        console.log('-'.repeat(80));

        // Finalize
        const finalize = await this.adminClient.controlSession('finalize');
        this.logResult('POST', 'admin/session/finalize', finalize);
        if (!finalize.ok) throw new Error('Failed to finalize');

        // Leaderboard
        const leaderboard = await this.adminClient.getLeaderboard();
        this.logResult('GET', 'leaderboard/standings', leaderboard);

        if (leaderboard.ok && leaderboard.data.standings) {
            const standings = leaderboard.data.standings;
            console.log(`   📊 Final Standings:`);
            
            let totalRoi = 0;
            let positiveCount = 0;

            standings.forEach((t, i) => {
                const roi = t.startingFunds > 0 ? ((t.currentFunds - t.startingFunds) / t.startingFunds) * 100 : 0;
                totalRoi += roi;
                if (roi > 0) positiveCount++;
                
                const icon = roi > 0 ? '📈' : (roi < 0 ? '📉' : '➖');
                console.log(`      ${i+1}. ${t.teamName.padEnd(20)}: $${t.currentFunds?.toFixed(2).padStart(10)} (${icon} ROI: ${roi.toFixed(1)}%)`);
            });

            const avgRoi = totalRoi / (standings.length || 1);
            console.log('\n📊 MARKET PERFORMANCE:');
            console.log(`   Average ROI: ${avgRoi.toFixed(1)}%`);
            console.log(`   Teams with Positive ROI: ${positiveCount}/${standings.length}`);

            // Quantifiable Test Requirement
            if (positiveCount < standings.length * 0.5) {
                console.warn('\n⚠️  WARNING: Less than 50% of teams improved. Market may be sluggish.');
            } else {
                console.log('\n✅ MARKET HEALTH: Verified (Healthy interaction detected)');
            }
            
            this.results.marketRoi = avgRoi;
            this.results.positiveRoiCount = positiveCount;
        }
    }

    printResults() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 RESULTS');
        console.log('='.repeat(80));
        console.log(`Calls: ${this.results.apiCalls}`);
        console.log(`Success: ${this.results.successful}`);
        console.log(`Failed: ${this.results.failed}`);
        
        // Save log
        const logFile = `playwright-api-log-${Date.now()}.json`;
        fs.writeFileSync(logFile, JSON.stringify(this.apiCallLog, null, 2));
        console.log(`\nLog saved to ${logFile}`);
    }
}

// Run if called directly
if (require.main === module) {
    new APIPlayabilityTest().run();
}

module.exports = APIPlayabilityTest;
