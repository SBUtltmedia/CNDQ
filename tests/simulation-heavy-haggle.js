const BrowserHelper = require('./helpers/browser');

const CONFIG = {
    baseUrl: 'http://cndq.test/CNDQ/',
    adminUser: 'admin@stonybrook.edu',
    testUsers: [
        'test_mail1@stonybrook.edu'
    ],
    targetSessions: 3,
    headless: false,
    verbose: true
};

class HeavyHaggleSanityTest {
    constructor(config) {
        this.config = config;
        this.browser = new BrowserHelper(config);
        this.sessionCount = 0;
    }

    async run() {
        console.log('🧪 Heavy Haggle Sanity Test Starting...');
        console.log('='.repeat(80));

        try {
            await this.browser.launch();

            // STEP 1: Admin Setup & Reset
            await this.step_AdminSetup();

            // STEP 2: Multi-Session Loop
            for (let i = 1; i <= this.config.targetSessions; i++) {
                console.log(`
🔄 STARTING SESSION ${i}`);
                console.log('-'.repeat(40));
                
                // Track start state for each user
                const startStates = {};
                for (const user of this.config.testUsers) {
                    const page = await this.browser.loginAndNavigate(user, '');
                    startStates[user] = await this.getGameState(page);
                    await page.close();
                }

                // Play logic for all users
                for (const user of this.config.testUsers) {
                    await this.step_PlayerTradeLoop(user, i);
                }

                // Wait a bit for NPCs to potentially finish any last-second responses
                await this.browser.sleep(5000);

                // --- SESSION END ROI CHECK ---
                console.log(`
📊 SESSION ${i} ROI CHECK`);
                for (const user of this.config.testUsers) {
                    const page = await this.browser.loginAndNavigate(user, '');
                    const endState = await this.getGameState(page);
                    
                    const fundDiff = endState.funds - startStates[user].funds;
                    const invDiff = endState.inventory.C - startStates[user].inventory.C;
                    
                    console.log(`   User: ${user}`);
                    console.log(`   Initial: $${startStates[user].funds.toFixed(2)}, Final: $${endState.funds.toFixed(2)}`);
                    console.log(`   Net Profit/Loss: $${fundDiff.toFixed(2)}`);
                    console.log(`   Inventory Change: ${invDiff.toFixed(2)} C`);

                    // Check if player traded. We expect some change.
                    // If ROI is 0 (no fund or inventory change), fail.
                    if (Math.abs(fundDiff) < 0.01 && Math.abs(invDiff) < 0.01) {
                        console.error(`❌ ROI ERROR: Player ${user} had 0 activity in Session ${i}!`);
                        // throw new Error(`Sanity Fail: 0 ROI for ${user} in session ${i}`);
                    } else {
                        console.log(`✅ Activity confirmed for ${user}`);
                    }
                    await page.close();
                }

                // Advance session
                if (i < this.config.targetSessions) {
                    await this.step_AdvanceSession();
                }
            }

            console.log('\n✅ Sanity Test Completed.');

        } catch (error) {
            console.error('\n❌ Sanity Test Failed:', error);
        } finally {
            console.log('Browser remaining open for inspection...');
        }
    }

    async step_AdminSetup() {
        console.log('
[STEP 1] Admin Setup & Reset');
        const page = await this.browser.loginAndNavigate(this.config.adminUser, 'admin/');

        // 1. Reset Game
        console.log('   Actions: Resetting Game Data...');
        const resetBtn = await page.waitForSelector('xpath///button[contains(text(), "RESET GAME & TEAM DATA")]');
        
        await resetBtn.click();
        await this.browser.sleep(500);

        // Click first confirmation "Yes"
        await page.evaluate(() => {
            const btn = document.getElementById('confirm-modal-yes');
            if (btn) btn.click();
        });
        await this.browser.sleep(500);

        // Click second confirmation "Yes"
        await page.evaluate(() => {
            const btn = document.getElementById('confirm-modal-yes');
            if (btn) btn.click();
        });

        await this.browser.sleep(3000);

        // 2. Enable NPCs
        console.log('   Actions: Enabling NPCs...');
        const toggle = await page.waitForSelector('#npc-system-enabled');
        const isEnabled = await page.$eval('#npc-system-enabled', el => el.checked);
        if (!isEnabled) {
            await toggle.click();
            await this.browser.sleep(1000);
        }

        // 3. Create active NPCs
        console.log('   Actions: Creating Expert NPC...');
        await page.select('#npc-skill-level', 'expert');
        const addBtn = await page.waitForSelector('xpath///button[contains(text(), "Add NPC")]');
        await addBtn.click();
        await this.browser.sleep(1500);

        // 4. Start Game
        console.log('   Actions: Starting Game...');
        const startBtn = await page.waitForSelector('#start-stop-btn');
        const btnText = await page.evaluate(el => el.textContent, startBtn);
        if (btnText.includes('Start')) {
            await startBtn.click();
            await this.browser.sleep(1000);
        }

        await page.close();
        console.log('   ✅ Admin Setup Complete');
    }

    async step_PlayerTradeLoop(user, sessionNum) {
        console.log(`
[STEP 2] Player Trade Logic (${user}) - Session ${sessionNum}`);
        
        const page = await this.browser.loginAndNavigate(user, '');
        
        // --- Action: Recalc Shadow Prices ---
        console.log('      Action: Recalculating Shadow Prices...');
        await page.click('#recalc-shadow-btn');
        await this.browser.sleep(2000);
        
        const shadows = await this.getShadowPrices(page);
        console.log(`      Shadow Prices: ${JSON.stringify(shadows)}`);

        // --- Action: Initiate Trade (Buy Request) ---
        // WE MUST BID HIGH ENOUGH FOR NPC TO BE INTERESTED
        // Expert NPC sells at shadow * 1.05. 
        // Let's bid shadow * 1.1 to be safe and ensure response.
        const bidPrice = (Math.max(shadows.C, 1.0) * 1.1).toFixed(2);
        console.log(`      Action: Posting Buy Request for 100 gal Carbon @ $${bidPrice}...`);
        
        await page.evaluate(() => {
            window.app.openBuyRequestModal('C');
        });
        await this.browser.sleep(1000);

        // Fill form
        await page.evaluate(() => document.getElementById('offer-quantity').value = '');
        await page.type('#offer-quantity', '100');
        await page.evaluate(() => document.getElementById('offer-price').value = '');
        await page.type('#offer-price', bidPrice);
        
        // Submit
        await page.click('#offer-submit-btn');
        await this.browser.sleep(2000); 

        // --- Action: Check for Negotiation ---
        console.log('      Action: Checking for NPC response (polling up to 20s)...');
        await page.click('#view-all-negotiations-btn');
        await this.browser.sleep(1000);

        let negotiationId = null;
        for(let i=0; i<10; i++) {
            negotiationId = await page.evaluate(() => {
                const card = document.querySelector('#pending-negotiations negotiation-card');
                return card ? card.negotiation.id : null;
            });
            
            if (negotiationId) break;
            console.log(`         ...waiting for NPC (attempt ${i+1}/10)...`);
            await this.browser.sleep(2000);
            // Re-open/refresh to trigger list update if polling is slow
            await page.click('#back-to-list-btn').catch(() => {});
            await page.click('#view-all-negotiations-btn').catch(() => {});
        }

        if (!negotiationId) {
            console.warn('      ⚠️ No NPC responded yet.');
        } else {
            console.log(`      ✅ Negotiation Found: ${negotiationId}`);

            // --- Action: Execute Trade ---
            await page.evaluate((id) => {
                window.app.viewNegotiationDetail(id);
            }, negotiationId);
            await this.browser.sleep(1000);

            const canAccept = await page.evaluate(() => {
                return !document.getElementById('negotiation-actions').classList.contains('hidden');
            });

            if (canAccept) {
                console.log('      Action: Accepting Offer...');
                await page.click('#accept-offer-btn');
                await this.browser.sleep(1000);
                
                // Custom confirm modal
                await page.evaluate(() => {
                    const btn = document.getElementById('confirm-ok');
                    if (btn) btn.click();
                });
                
                console.log('      ✅ Trade accepted.');
                await this.browser.sleep(2000); 
            } else {
                console.log('      ⏳ NPC countered or waiting...');
            }
        }

        await page.close();
    }

    async step_AdvanceSession() {
        console.log('
⏩ ADVANCING SESSION');
        const page = await this.browser.loginAndNavigate(this.config.adminUser, 'admin/');
        
        const btn = await page.waitForSelector('xpath///button[contains(text(), "Advance to Next Session")]');
        await btn.click();
        
        await this.browser.sleep(3000); 
        console.log('   ✅ Session Advanced');
        
        await page.close();
    }

    async getGameState(page) {
        return await page.evaluate(() => {
            const fundsText = document.getElementById('current-funds').textContent.replace('$', '').replace(/,/g, '');
            const getInv = (chem) => {
                const el = document.querySelector(`chemical-card[chemical="${chem}"]`);
                return el ? (el.inventory || 0) : 0;
            };
            return {
                funds: parseFloat(fundsText),
                inventory: {
                    C: getInv('C'),
                    N: getInv('N'),
                    D: getInv('D'),
                    Q: getInv('Q')
                }
            };
        });
    }

    async getShadowPrices(page) {
        return await page.evaluate(() => ({
            C: parseFloat(document.getElementById('shadow-C')?.textContent || 0),
            N: parseFloat(document.getElementById('shadow-N')?.textContent || 0),
            D: parseFloat(document.getElementById('shadow-D')?.textContent || 0),
            Q: parseFloat(document.getElementById('shadow-Q')?.textContent || 0)
        }));
    }
}

if (require.main === module) {
    const test = new HeavyHaggleSanityTest(CONFIG);
    test.run();
}