/**
 * Robust CNDQ Game Simulation
 *
 * Simulates a full game with 3 human players and 3 NPCs (one of each skill).
 * Operates in "Admin Mode" with manual phase advancement.
 */

const BrowserHelper = require('./helpers/browser');
const SessionHelper = require('./helpers/session');
const TeamHelper = require('./helpers/team');
const NpcHelper = require('./helpers/npc');
const ReportingHelper = require('./helpers/reporting');
const path = require('path');

class RobustGameSimulation {
    constructor(config) {
        this.config = {
            ...config,
            // Override config for this specific test
            teams: [
                'rpc_player_1@test.edu',
                'rpc_player_2@test.edu',
                'rpc_player_3@test.edu'
            ],
            targetSessions: 3,
            headless: config.headless !== undefined ? config.headless : false,
        };
        this.browser = new BrowserHelper(this.config);
        this.session = new SessionHelper(this.browser);
        this.team = new TeamHelper(this.browser);
        this.npc = new NpcHelper(this.browser);
        
        // Find the cron directory relative to this test file
        // This file is in CNDQ/tests/
        this.cronDir = path.resolve(__dirname, '../cron');
    }

    async run() {
        ReportingHelper.printHeader('Robust CNDQ Game Simulation');
        ReportingHelper.printInfo(`Simulating ${this.config.targetSessions} sessions with ${this.config.teams.length} RPCs and 3 NPCs.`);

        let adminPage;
        try {
            await this.browser.launch();

            // Step 1: Initial Setup
            ReportingHelper.printStep(1, 'Initial Game Setup');
            adminPage = await this.browser.loginAndNavigate('admin@stonybrook.edu', '/admin/');
            await this.npc.deleteAllNpcs(adminPage); 
            await this.npc.createTestNpcs(adminPage); 

            // Step 2: Main Simulation Loop
            await this.playMultipleSessions(adminPage);

            ReportingHelper.printSuccess('\n✅ Simulation completed successfully!');
            return { success: true };

        } catch (error) {
            ReportingHelper.printError(`Simulation failed: ${error.message}`);
            console.error(error.stack);
            return { success: false, error: error.message };
        } finally {
            if (adminPage) await adminPage.close();
            if (!this.config.keepOpen) {
                await this.browser.close();
            }
        }
    }

    async playMultipleSessions(adminPage) {
        let currentSession = 1;
        while (currentSession <= this.config.targetSessions) {
            ReportingHelper.printSessionHeader(currentSession, 'TRADING');

            // 1. Set phase to TRADING
            await this.session.setPhase(adminPage, 'trading');

            // 2. RPCs post buy requests
            await this.runRpcBuyRequests();
            await this.browser.sleep(2000); // Give server time to process

            // 3. NPCs respond to buy requests
            await this.triggerNpcCycle();
            
            // 4. RPCs check their negotiations and respond
            await this.runRpcNegotiationResponses();

            // 5. Set phase to PRODUCTION
            await this.session.setPhase(adminPage, 'production');

            ReportingHelper.printSessionHeader(currentSession, 'PRODUCTION');
            ReportingHelper.printInfo('Production running automatically...');
            await this.browser.sleep(5000); // Simulate production time

            currentSession++;
        }
    }

    async runRpcBuyRequests() {
        ReportingHelper.printSection('🙋‍♂️', 'RPCs are posting BUY requests...');
        for (const teamEmail of this.config.teams) {
            // Path is root of CNDQ project
            const rpcPage = await this.browser.loginAndNavigate(teamEmail, '/');
            try {
                const teamName = await this.team.getTeamName(rpcPage);
                const shadowPrices = await this.team.getShadowPrices(rpcPage);
                
                // Find all chemicals where shadow price > 1.0
                const chemicalsToBuy = Object.entries(shadowPrices)
                    .filter(([_, price]) => price > 1.0)
                    .sort((a, b) => b[1] - a[1]); // Sort by price descending

                if (chemicalsToBuy.length > 0) {
                    // Buy the top 2 chemicals we need most
                    for (const [chemical, price] of chemicalsToBuy.slice(0, 2)) {
                        await this.team.postBuyRequest(rpcPage, chemical, price);
                        console.log(`   - ${teamName} wants to BUY ${chemical} (shadow price: $${price.toFixed(2)})`);
                    }
                } else {
                     console.log(`   - ${teamName} chose not to buy anything.`);
                }
            } catch(e) {
                ReportingHelper.printWarning(`Could not simulate buy request for ${teamEmail}: ${e.message}`);
            }
            finally {
                await rpcPage.close();
            }
        }
    }
    
    async triggerNpcCycle() {
        ReportingHelper.printSection('🤖', 'Triggering NPC response cycle...');
        // Execute the PHP NPC runner to force NPCs to act
        try {
            // Run php script in its own directory to avoid path issues
            await this.browser.runShellCommand('php npc_runner.php', this.cronDir);
            await this.browser.sleep(5000); // Give time for NPC actions and server processing
            ReportingHelper.printInfo('NPCs have had a chance to respond.');
        } catch (e) {
            ReportingHelper.printError(`NPC runner failed: ${e.message}`);
        }
    }

    async runRpcNegotiationResponses() {
        ReportingHelper.printSection('🙋‍♂️', 'RPCs are checking and responding to negotiations...');
        for (const teamEmail of this.config.teams) {
            const rpcPage = await this.browser.loginAndNavigate(teamEmail, '/');
             try {
                const teamName = await this.team.getTeamName(rpcPage);
                const shadowPrices = await this.team.getShadowPrices(rpcPage);
                
                // RPCs are generally happy to accept anything within 10% of shadow price
                const response = await this.team.respondToNegotiations(rpcPage, shadowPrices, 0.9); 
                if (response) {
                    console.log(`   - ${teamName} responded to a negotiation for ${response.chemical}: ${response.action}`);
                } else {
                    console.log(`   - ${teamName} had no negotiations to respond to.`);
                }
             } catch(e) {
                ReportingHelper.printWarning(`Could not simulate negotiation response for ${teamEmail}: ${e.message}`);
             }
             finally {
                await rpcPage.close();
            }
        }
    }
}

module.exports = RobustGameSimulation;