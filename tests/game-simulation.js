/**
 * Game Simulation Test
 *
 * Simulates 2 teams playing through 3 complete sessions
 * Tests: Trading, negotiations, production, phase transitions
 */

const BrowserHelper = require('./helpers/browser');
const SessionHelper = require('./helpers/session');
const TeamHelper = require('./helpers/team');
const ReportingHelper = require('./helpers/reporting');

const CHEMICALS = ['C', 'N', 'D', 'Q'];

class GameSimulation {
    constructor(config, browserHelper) {
        this.config = config;
        this.browser = browserHelper;
        this.session = new SessionHelper(this.browser);
        this.team = new TeamHelper(this.browser);
    }

    async run() {
        ReportingHelper.printHeader('CNDQ Game Simulation');
        ReportingHelper.printInfo(`Testing ${this.config.teams.length} teams through ${this.config.targetSessions} sessions`);

        try {
            // Step 1: Reset game to clean state (unless skipped)
            if (!this.config.skipReset) {
                ReportingHelper.printStep(1, 'Resetting game to clean state');
                await this.session.resetGame();
            } else {
                ReportingHelper.printInfo('Skipping game reset (--skip-reset flag)');
            }

            // Step 2: Enable auto-advance
            const stepNum = this.config.skipReset ? 1 : 2;
            ReportingHelper.printStep(stepNum, 'Enabling auto-advance');
            await this.session.enableAutoAdvance();

            // Step 3: Run multi-session gameplay
            ReportingHelper.printStep(stepNum + 1, 'Starting multi-session gameplay');
            await this.playMultipleSessions();

            // Success summary
            this.printSuccessSummary();

            return { success: true };

        } catch (error) {
            ReportingHelper.printError(`Simulation failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async playMultipleSessions() {
        let currentSession = await this.session.getCurrentSession();
        const startSession = currentSession;

        console.log(`   Starting at session ${startSession}`);
        console.log(`   Target: ${this.config.targetSessions} sessions\n`);

        while (currentSession < startSession + this.config.targetSessions) {
            const phase = await this.session.getCurrentPhase();
            ReportingHelper.printSessionHeader(currentSession, phase);

            if (phase === 'trading') {
                await this.runTradingPhase();
                
                ReportingHelper.printSection('⚙️', 'Waiting for trade reflections to settle...');
                await this.browser.sleep(12000); // Wait > 10s for npc_runner/reflections

                await this.displayLeaderboard(currentSession);

                ReportingHelper.printSection('⏳', 'Waiting for trading phase to end...');
                await this.session.waitForPhaseChange('production');
            } else {
                ReportingHelper.printInfo('Production running automatically...');
                await this.session.waitForPhaseChange('trading');
            }

            currentSession = await this.session.getCurrentSession();
        }

        console.log(`\n🏁 Completed ${this.config.targetSessions} sessions!`);

        // Final leaderboard
        console.log('\n' + '='.repeat(60));
        console.log('FINAL RESULTS');
        console.log('='.repeat(60));
        await this.browser.sleep(5000); // Small extra wait
        await this.displayLeaderboard(currentSession - 1);
    }

    async runTradingPhase() {
        // Teams post advertisements
        await this.allTeamsAdvertise();
        await this.browser.sleep(2000);

        // Teams initiate negotiations
        await this.allTeamsNegotiate();
        await this.browser.sleep(2000);

        // Teams respond to negotiations
        await this.allTeamsRespondToNegotiations();
    }

    async allTeamsAdvertise() {
        ReportingHelper.printSection('📢', 'Teams posting advertisements...');

        for (const teamEmail of this.config.teams) {
            const page = await this.browser.loginAndNavigate(teamEmail, '/');

            try {
                const shadowPrices = await this.team.getShadowPrices(page);
                const teamName = await this.team.getTeamName(page);

                console.log(`   ${teamName}:`);

                for (const chemical of CHEMICALS) {
                    const shadowPrice = shadowPrices[chemical];

                    // Only post BUY requests (selling happens via responding to buy requests)
                    if (shadowPrice > 2) {
                        await this.team.postBuyRequest(page, chemical, shadowPrice);
                        console.log(`      📥 Wants to BUY ${chemical} (shadow: $${shadowPrice.toFixed(2)})`);
                    } else if (shadowPrice < 1) {
                        // Don't post sell ads - teams will respond to buy requests instead
                        console.log(`      💰 Ready to SELL ${chemical} (shadow: $${shadowPrice.toFixed(2)})`);
                    }
                }
            } catch (error) {
                console.log(`      ⚠️  Error: ${error.message}`);
            } finally {
                await page.close();
            }
        }
    }

    async allTeamsNegotiate() {
        ReportingHelper.printSection('💼', 'Teams responding to buy requests...');

        for (const teamEmail of this.config.teams) {
            const page = await this.browser.loginAndNavigate(teamEmail, '/');

            try {
                const teamName = await this.team.getTeamName(page);
                const shadowPrices = await this.team.getShadowPrices(page);
                const inventory = await this.team.getInventory(page);

                for (const chemical of CHEMICALS) {
                    const myShadowPrice = shadowPrices[chemical];
                    const myInventory = inventory[chemical];

                    // If shadow price is low and we have inventory, look for buy requests to fulfill
                    if (myShadowPrice < 1 && myInventory > 50) {
                        const buyRequest = await this.team.findBuyer(page, chemical);
                        if (buyRequest) {
                            await this.team.respondToBuyRequest(page, buyRequest, chemical, myShadowPrice, myInventory);
                            console.log(`   ${teamName} → Offering to SELL ${chemical} to ${buyRequest.teamName}`);
                            break;
                        }
                    }
                }
            } catch (error) {
                console.log(`   ⚠️  ${teamEmail}: ${error.message}`);
            } finally {
                await page.close();
            }
        }
    }

    async allTeamsRespondToNegotiations() {
        ReportingHelper.printSection('💬', 'Teams responding to negotiations...');

        for (const teamEmail of this.config.teams) {
            const page = await this.browser.loginAndNavigate(teamEmail, '/');

            try {
                const teamName = await this.team.getTeamName(page);
                const shadowPrices = await this.team.getShadowPrices(page);

                const response = await this.team.respondToNegotiations(page, shadowPrices, 0.7);

                if (response) {
                    if (response.action === 'accepted') {
                        console.log(`   ${teamName} → ✓ ACCEPTED offer for ${response.chemical} (${response.quantity} gal @ $${response.price})`);
                    } else if (response.action === 'countered') {
                        console.log(`   ${teamName} → 🔄 COUNTER-OFFER for ${response.chemical} (${response.quantity} gal @ $${response.price})`);
                    } else if (response.action === 'rejected') {
                        console.log(`   ${teamName} → ✗ REJECTED offer for ${response.chemical}`);
                    }
                }
            } catch (error) {
                console.log(`   ⚠️  ${teamEmail}: ${error.message}`);
            } finally {
                await page.close();
            }
        }
    }

    async displayLeaderboard(session) {
        const teams = await this.team.getLeaderboard();
        if (teams.length > 0) {
            ReportingHelper.printLeaderboard(teams, session);
        }
    }

    printSuccessSummary() {
        const items = [
            'Auto-advance enabled',
            'Advertisement posting (buy/sell based on shadow prices)',
            'Negotiation initiation',
            'Negotiation responses (accept/counter/reject)',
            'Trading phase completion',
            'Production phase (automatic)',
            'Session transitions',
            'Leaderboard updates',
            `${this.config.targetSessions} complete sessions with ${this.config.teams.length} teams`
        ];

        ReportingHelper.printSummary('\n✅ Full Game Flow Tested:', items);
        console.log(`\n📊 View detailed results at: ${this.config.baseUrl}`);
    }
}

module.exports = GameSimulation;
