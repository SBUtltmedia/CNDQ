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

            // Step 1: Initial Game Reset & Setup
            ReportingHelper.printStep(1, 'Initial Game Setup');
            adminPage = await this.browser.loginAndNavigate('admin@stonybrook.edu', '/admin/');
            
            // Full Game Reset (wipes teams, negotiations, offers, session)
            await this.session.resetGame();
            ReportingHelper.printSuccess('Game reset to clean state.');

            // Ensure Auto-Advance is DISABLED (Admin Mode)
            await this.ensureAutoAdvanceDisabled(adminPage);

            // Create NPCs (1 of each skill)
            await this.npc.createTestNpcs(adminPage); 

            // Initialize RPCs (log them in once to create their accounts/folders)
            await this.initializeRpcTeams();

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

    async ensureAutoAdvanceDisabled(adminPage) {
        // Check checkbox state
        const isChecked = await adminPage.evaluate(() => {
            const cb = document.getElementById('auto-advance');
            return cb && cb.checked;
        });

        if (isChecked) {
            console.log('   - Disabling Auto-Advance...');
            await adminPage.click('#auto-advance');
            await this.browser.sleep(1000);
        }
        console.log('   ✓ Auto-Advance is OFF (Admin Mode)');
    }

    async initializeRpcTeams() {
        ReportingHelper.printInfo('Initializing RPC teams...');
        for (const teamEmail of this.config.teams) {
            const page = await this.browser.loginAndNavigate(teamEmail, '/');
            await this.browser.sleep(500); // Allow init scripts to run
            await page.close();
        }
        console.log('   ✓ RPC teams initialized');
    }

    async playMultipleSessions(adminPage) {
        let currentSession = 1;
        while (currentSession <= this.config.targetSessions) {
            ReportingHelper.printSessionHeader(currentSession, 'PRODUCTION');
            
            // 1. Ensure we are in PRODUCTION
            console.log('   - Waiting for production calculations...');
            await this.browser.sleep(3000); 

            ReportingHelper.printSessionHeader(currentSession, 'TRADING');

            // 2. Set phase to TRADING
            // Must re-login as admin because RPC actions in previous loop overwrote the cookie
            await this.browser.login(adminPage, 'admin@stonybrook.edu');
            await this.session.setPhase(adminPage, 'trading');

            // 3. RPCs post buy requests
            await this.runRpcBuyRequests();
            await this.browser.sleep(2000); 

            // 4. NPCs respond to buy requests (Trigger Cycle)
            await this.triggerNpcCycle();
            
            // 5. RPCs check their negotiations and respond
            await this.runRpcNegotiationResponses();

            // 6. Advance to Next Session (which starts with PRODUCTION)
            if (currentSession < this.config.targetSessions) {
                console.log('   - Advancing to next session...');
                // Must re-login as admin again
                await this.browser.login(adminPage, 'admin@stonybrook.edu');
                await this.session.setPhase(adminPage, 'production'); 
                // Using setPhase('production') is safer/clearer than clicking 'Advance' button
                // which might toggle unexpectedly if we are out of sync.
                // But wait, advancePhase() moves session +1. setPhase just changes phase.
                // We need to move to next session.
                
                // Use the API to advance
                await adminPage.evaluate(async (baseUrl) => {
                     await fetch(`${baseUrl}/api/admin/session.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'advance' })
                    });
                }, this.browser.config.baseUrl); // Use baseUrl from config since page location might vary
                
                await this.browser.sleep(2000);
            }

            currentSession++;
        }
    }

    async runRpcBuyRequests() {
        ReportingHelper.printSection('🙋‍♂️', 'RPCs are posting BUY requests...');
        for (const teamEmail of this.config.teams) {
            const rpcPage = await this.browser.loginAndNavigate(teamEmail, '/');
            try {
                const teamName = await this.team.getTeamName(rpcPage);
                const shadowPrices = await this.team.getShadowPrices(rpcPage);
                
                // Find all chemicals where shadow price > 1.0
                const chemicalsToBuy = Object.entries(shadowPrices)
                    .filter(([_, price]) => price > 1.0)
                    .sort((a, b) => b[1] - a[1]); // Sort by price descending

                if (chemicalsToBuy.length > 0) {
                    // Buy the top chemical we need most
                    const [chemical, price] = chemicalsToBuy[0];
                    await this.team.postBuyRequest(rpcPage, chemical, price);
                    console.log(`   - ${teamName} posted BUY request for ${chemical} (shadow price: $${price.toFixed(2)})`);
                } else {
                     console.log(`   - ${teamName} has no high-value needs (max shadow price <= 1.0).`);
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
        
        // Helper to run and log
        const run = async (label) => {
            try {
                const output = this.browser.runShellCommand('php npc_runner.php', this.cronDir);
                console.log(`   - NPC Runner (${label}):\n     ` + output.trim().replace(/\n/g, '\n     '));
            } catch (e) {
                ReportingHelper.printError(`NPC runner failed: ${e.message}`);
            }
        };

        // Run once
        await run('Attempt 1');
        
        // Wait 11 seconds to satisfy the 10s throttle in SessionManager
        console.log('   - Waiting 11s for NPC throttle...');
        await this.browser.sleep(11000);
        
        // Run again
        await run('Attempt 2');
        
        await this.browser.sleep(2000); // Give time for server processing
        ReportingHelper.printInfo('NPCs have checked the market.');
    }

    async runRpcNegotiationResponses() {
        ReportingHelper.printSection('🙋‍♂️', 'RPCs are checking negotiations...');
        for (const teamEmail of this.config.teams) {
            const rpcPage = await this.browser.loginAndNavigate(teamEmail, '/');
             try {
                const teamName = await this.team.getTeamName(rpcPage);
                const shadowPrices = await this.team.getShadowPrices(rpcPage);
                
                // RPCs are generally happy to accept anything within 10% of shadow price
                const response = await this.team.respondToNegotiations(rpcPage, shadowPrices, 0.9); 
                if (response) {
                    console.log(`   - ${teamName} responded to negotiation for ${response.chemical}: ${response.action}`);
                } else {
                    console.log(`   - ${teamName} found no pending negotiations.`);
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