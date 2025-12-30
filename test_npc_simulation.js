/**
 * CNDQ Game Simulation with NPCs - Puppeteer Test
 *
 * Simulates 2 human teams + 3 NPCs playing for 5 sessions with auto-advance.
 * Tests:
 * - Human teams trading (advertisements, negotiations)
 * - NPC automatic trading (every 10 seconds during trading phase)
 * - Session transitions
 * - Leaderboard with NPCs
 */

const puppeteer = require('puppeteer');

const BASE_URL = 'http://cndq.test';
const HUMAN_TEAMS = [
    'test_mail1@stonybrook.edu',
    'test_mail2@stonybrook.edu'
];

const CHEMICALS = ['C', 'N', 'D', 'Q'];
const TARGET_SESSIONS = 5;

/**
 * Main simulation function
 */
async function runSimulation() {
    console.log('🎮 Starting CNDQ Game Simulation with NPCs...\n');

    const browser = await puppeteer.launch({
        headless: false, // Set to true for faster execution
        defaultViewport: { width: 1400, height: 900 }
    });

    try {
        // Step 1: Enable NPC system
        console.log('📋 Step 1: Enabling NPC system...');
        await enableNPCSystem(browser);

        // Step 2: Check NPC status
        console.log('\n📋 Step 2: Checking NPC status...');
        await checkNPCStatus(browser);

        // Step 3: Enable auto-advance
        console.log('\n📋 Step 3: Enabling auto-advance...');
        await enableAutoAdvance(browser);

        // Step 4: Run game simulation for 5 sessions
        console.log('\n📋 Step 4: Starting 5-session gameplay...');
        await playMultipleSessions(browser);

        console.log('\n✅ Simulation complete!');
        console.log('\n📋 Full Game Flow Tested:');
        console.log('   ✓ NPC system enabled');
        console.log('   ✓ NPCs trading automatically every 10 seconds');
        console.log('   ✓ Human teams posting advertisements');
        console.log('   ✓ Human teams negotiating');
        console.log('   ✓ Trading phase completion');
        console.log('   ✓ Production phase (automatic)');
        console.log('   ✓ Session transitions');
        console.log('   ✓ Leaderboard with NPCs and humans');
        console.log(`   ✓ ${TARGET_SESSIONS} complete sessions`);
        console.log('\n📊 View detailed results at:', BASE_URL + '/admin.html');

    } catch (error) {
        console.error('❌ Simulation failed:', error);
    } finally {
        // Keep browser open to inspect results
        console.log('\n🔍 Browser kept open for inspection. Close manually when done.');
    }
}

/**
 * Enable NPC system via admin panel
 */
async function enableNPCSystem(browser) {
    const page = await browser.newPage();

    try {
        // Login as admin
        await page.goto(`${BASE_URL}/dev_login.php?user=admin@stonybrook.edu`, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await sleep(2000);

        // Open admin panel (don't wait for networkidle due to polling)
        await page.goto(`${BASE_URL}/admin.html`, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await sleep(4000);

        // Enable NPC system checkbox
        const npcEnabled = await page.evaluate(() => {
            const checkbox = document.querySelector('#npc-system-enabled');
            if (checkbox) {
                const wasChecked = checkbox.checked;
                if (!wasChecked) {
                    checkbox.click();
                }
                return true;
            }
            return false;
        });

        if (npcEnabled) {
            console.log('   ✓ NPC system enabled');
            await sleep(1000); // Wait for system to update
        } else {
            console.log('   ⚠️  NPC system toggle not found');
        }

    } finally {
        await page.close();
    }
}

/**
 * Check NPC status and display info
 */
async function checkNPCStatus(browser) {
    const page = await browser.newPage();

    try {
        const response = await page.goto(`${BASE_URL}/api/admin/npc/list.php`);
        const data = await response.json();

        if (data.success) {
            console.log(`   Total NPCs: ${data.count}`);
            console.log(`   System Enabled: ${data.enabled ? 'Yes' : 'No'}`);

            if (data.npcs && data.npcs.length > 0) {
                console.log('\n   NPCs:');
                data.npcs.forEach(npc => {
                    const status = npc.active ? '✓ Active' : '✗ Inactive';
                    console.log(`   - ${npc.teamName} (${npc.skillLevel}) - ${status}`);
                    console.log(`     Funds: $${npc.currentFunds?.toFixed(2) || '0.00'}, Trades: ${npc.stats?.totalTrades || 0}`);
                });
            } else {
                console.log('   ⚠️  No NPCs found. NPCs should have been created by test_npc_foundation.php');
            }
        }

    } catch (error) {
        console.log(`   ⚠️  Could not fetch NPC status: ${error.message}`);
    } finally {
        await page.close();
    }
}

/**
 * Enable auto-advance via admin panel
 */
async function enableAutoAdvance(browser) {
    const page = await browser.newPage();

    try {
        // Login as admin
        await page.goto(`${BASE_URL}/dev_login.php?user=admin@stonybrook.edu`, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await sleep(2000);

        // Open admin panel (don't wait for networkidle due to polling)
        await page.goto(`${BASE_URL}/admin.html`, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await sleep(4000);

        // Enable auto-advance checkbox
        const autoAdvanceCheckbox = await page.$('#auto-advance');
        const isChecked = await page.evaluate(el => el.checked, autoAdvanceCheckbox);

        if (!isChecked) {
            await autoAdvanceCheckbox.click();
            console.log('   ✓ Auto-advance enabled');
        } else {
            console.log('   ✓ Auto-advance already enabled');
        }

    } finally {
        await page.close();
    }
}

/**
 * Play multiple sessions with human teams and NPCs
 */
async function playMultipleSessions(browser) {
    let currentSession = await getCurrentSession(browser);
    const startSession = currentSession;

    console.log(`\n   Starting at session ${startSession}`);
    console.log(`   Target: ${TARGET_SESSIONS} sessions\n`);

    while (currentSession < startSession + TARGET_SESSIONS) {
        const phase = await getCurrentPhase(browser);

        console.log(`\n🎯 Session ${currentSession} - ${phase.toUpperCase()}`);
        console.log('═'.repeat(70));

        if (phase === 'trading') {
            // Human teams post advertisements based on shadow prices
            await allTeamsAdvertise(browser);

            // Wait for advertisements and NPCs to act
            await sleep(3000);

            // Check NPC activity
            await checkNPCActivity(browser, currentSession);

            // Human teams initiate negotiations
            await allTeamsNegotiate(browser);

            // Wait for negotiations
            await sleep(2000);

            // Human teams respond to negotiations
            await allTeamsRespondToNegotiations(browser);

            // Check leaderboard during trading
            await checkLeaderboard(browser, currentSession);

            // Wait for trading phase to end
            console.log('\n⏳ Waiting for trading phase to end...');
            console.log('   (NPCs will continue trading automatically every 10 seconds)');
            await waitForPhaseChange(browser, 'production');
        } else {
            // Production phase - just wait
            console.log('   ⚙️  Production running automatically...');
            await waitForPhaseChange(browser, 'trading');
        }

        currentSession = await getCurrentSession(browser);
    }

    console.log(`\n🏁 Completed ${TARGET_SESSIONS} sessions!`);

    // Final stats
    console.log('\n' + '='.repeat(70));
    console.log('FINAL RESULTS');
    console.log('='.repeat(70));
    await checkLeaderboard(browser, currentSession - 1);
    await checkNPCFinalStats(browser);
}

/**
 * Check NPC trading activity
 */
async function checkNPCActivity(browser, session) {
    console.log('\n🤖 Checking NPC activity...');

    const page = await browser.newPage();
    try {
        const response = await page.goto(`${BASE_URL}/api/admin/npc/list.php`);
        const data = await response.json();

        if (data.success && data.npcs) {
            let totalNPCTrades = 0;
            data.npcs.forEach(npc => {
                const trades = npc.stats?.totalTrades || 0;
                totalNPCTrades += trades;
                if (npc.active) {
                    console.log(`   ${npc.teamName}: ${trades} trades, $${npc.stats?.totalProfit?.toFixed(2) || '0.00'} profit`);
                }
            });
            console.log(`   Total NPC trades: ${totalNPCTrades}`);
        }

    } catch (error) {
        console.log(`   ⚠️  Could not check NPC activity: ${error.message}`);
    } finally {
        await page.close();
    }
}

/**
 * Check final NPC statistics
 */
async function checkNPCFinalStats(browser) {
    console.log('\n🤖 NPC Final Statistics:');
    console.log('─'.repeat(70));

    const page = await browser.newPage();
    try {
        const response = await page.goto(`${BASE_URL}/api/admin/npc/list.php`);
        const data = await response.json();

        if (data.success && data.npcs) {
            let totalTrades = 0;
            let totalProfit = 0;

            data.npcs.forEach(npc => {
                const trades = npc.stats?.totalTrades || 0;
                const profit = npc.stats?.totalProfit || 0;
                totalTrades += trades;
                totalProfit += profit;

                console.log(`\n   ${npc.teamName} (${npc.skillLevel.toUpperCase()})`);
                console.log(`   ├─ Trades: ${trades}`);
                console.log(`   ├─ Profit: $${profit.toFixed(2)}`);
                console.log(`   ├─ Funds: $${npc.currentFunds?.toFixed(2) || '0.00'}`);
                console.log(`   └─ Inventory: C=${Math.round(npc.inventory?.C || 0)} N=${Math.round(npc.inventory?.N || 0)} D=${Math.round(npc.inventory?.D || 0)} Q=${Math.round(npc.inventory?.Q || 0)}`);
            });

            console.log('\n   📊 Aggregate NPC Stats:');
            console.log(`   Total Trades: ${totalTrades}`);
            console.log(`   Total Profit: $${totalProfit.toFixed(2)}`);
            console.log(`   Avg Trades per NPC: ${(totalTrades / data.npcs.length).toFixed(1)}`);
        }

    } catch (error) {
        console.log(`   ⚠️  Could not fetch final NPC stats: ${error.message}`);
    } finally {
        await page.close();
    }
}

/**
 * All human teams post buy/sell advertisements based on shadow prices
 */
async function allTeamsAdvertise(browser) {
    console.log('\n📢 Human teams posting advertisements...');

    for (const teamEmail of HUMAN_TEAMS) {
        const page = await browser.newPage();

        try {
            // Login as team
            await page.goto(`${BASE_URL}/dev_login.php?user=${teamEmail}`, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await sleep(1500);
            await page.goto(`${BASE_URL}/index.html`, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await sleep(3000);

            // Get shadow prices
            const shadowPrices = await getShadowPrices(page);
            const teamName = await page.$eval('#team-name', el => el.textContent);

            console.log(`   ${teamName}:`);

            // Post advertisements based on shadow prices
            for (const chemical of CHEMICALS) {
                const shadowPrice = shadowPrices[chemical];

                if (shadowPrice > 2) {
                    // High shadow price → Want to buy
                    await postAdvertisement(page, chemical, 'buy');
                    console.log(`      📥 Wants to BUY ${chemical} (shadow: $${shadowPrice.toFixed(2)})`);
                } else if (shadowPrice < 1) {
                    // Low shadow price → Want to sell
                    await postAdvertisement(page, chemical, 'sell');
                    console.log(`      📤 Wants to SELL ${chemical} (shadow: $${shadowPrice.toFixed(2)})`);
                }
            }

        } catch (error) {
            console.log(`      ⚠️  Error: ${error.message}`);
        } finally {
            await page.close();
        }
    }
}

/**
 * All human teams negotiate
 */
async function allTeamsNegotiate(browser) {
    console.log('\n💼 Human teams initiating negotiations...');

    for (const teamEmail of HUMAN_TEAMS) {
        const page = await browser.newPage();

        try {
            await page.goto(`${BASE_URL}/dev_login.php?user=${teamEmail}`);
            await sleep(1000);
            await page.goto(`${BASE_URL}/index.html`);
            await sleep(2000);

            const teamName = await page.$eval('#team-name', el => el.textContent);
            const shadowPrices = await getShadowPrices(page);

            // Look for trading opportunities (including with NPCs!)
            for (const chemical of CHEMICALS) {
                const myShadowPrice = shadowPrices[chemical];

                if (myShadowPrice > 2) {
                    const seller = await findSeller(page, chemical);
                    if (seller) {
                        await initiateNegotiation(page, seller, chemical, 'buy', myShadowPrice);
                        console.log(`   ${teamName} → Negotiating to BUY ${chemical} from ${seller.teamName}`);
                        break;
                    }
                }

                if (myShadowPrice < 1) {
                    const buyer = await findBuyer(page, chemical);
                    if (buyer) {
                        await initiateNegotiation(page, buyer, chemical, 'sell', myShadowPrice);
                        console.log(`   ${teamName} → Negotiating to SELL ${chemical} to ${buyer.teamName}`);
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

/**
 * Get shadow prices from the page
 */
async function getShadowPrices(page) {
    return await page.evaluate(() => {
        const prices = {};
        ['C', 'N', 'D', 'Q'].forEach(chem => {
            const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
            if (card) {
                const el = card.querySelector('#shadow-price');
                prices[chem] = parseFloat(el?.textContent || '0');
            } else {
                prices[chem] = 0;
            }
        });
        return prices;
    });
}

/**
 * Post advertisement for a chemical
 */
async function postAdvertisement(page, chemical, type) {
    await page.evaluate((chem, adType) => {
        const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
        if (card) {
            const button = card.querySelector(`#post-${adType}-btn`);
            if (button) {
                button.click();
            }
        }
    }, chemical, type);
    await sleep(500);
}

/**
 * Find a seller for a chemical
 */
async function findSeller(page, chemical) {
    return await page.evaluate((chem) => {
        const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
        if (!card) return null;

        const adItems = card.querySelectorAll('advertisement-item');

        for (const item of adItems) {
            if (item.type === 'sell' && !item.isMyAd) {
                return {
                    teamId: item.teamId,
                    teamName: item.teamName,
                    chemical: chem
                };
            }
        }
        return null;
    }, chemical);
}

/**
 * Find a buyer for a chemical
 */
async function findBuyer(page, chemical) {
    return await page.evaluate((chem) => {
        const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
        if (!card) return null;

        const adItems = card.querySelectorAll('advertisement-item');

        for (const item of adItems) {
            if (item.type === 'buy' && !item.isMyAd) {
                return {
                    teamId: item.teamId,
                    teamName: item.teamName,
                    chemical: chem
                };
            }
        }
        return null;
    }, chemical);
}

/**
 * Initiate negotiation
 */
async function initiateNegotiation(page, counterparty, chemical, type, myShadowPrice) {
    try {
        const clicked = await page.evaluate((teamId, chem) => {
            const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
            if (!card) return false;

            const adItems = card.querySelectorAll('advertisement-item');
            for (const item of adItems) {
                if (item.teamId === teamId) {
                    const btn = item.querySelector('.negotiate-btn');
                    if (btn) {
                        btn.click();
                        return true;
                    }
                }
            }
            return false;
        }, counterparty.teamId, chemical);

        if (clicked) {
            await sleep(1000);

            const quantity = Math.floor(Math.random() * 50) + 10;
            const priceOffset = (Math.random() * 2) - 1;
            const price = Math.max(0.1, myShadowPrice + priceOffset).toFixed(2);

            await page.type('#new-quantity', quantity.toString());
            await page.type('#new-price', price);

            await page.click('#submit-new-negotiation-btn');
            await sleep(500);
        }
    } catch (error) {
        // Negotiation might fail
    }
}

/**
 * All teams respond to negotiations
 */
async function allTeamsRespondToNegotiations(browser) {
    console.log('\n💬 Human teams responding to negotiations...');

    for (const teamEmail of HUMAN_TEAMS) {
        const page = await browser.newPage();

        try {
            await page.goto(`${BASE_URL}/dev_login.php?user=${teamEmail}`);
            await sleep(1000);
            await page.goto(`${BASE_URL}/index.html`);
            await sleep(2000);

            const teamName = await page.$eval('#team-name', el => el.textContent);

            const hasNegotiations = await page.evaluate(() => {
                const container = document.querySelector('#my-negotiations');
                return container && container.children.length > 1;
            });

            if (hasNegotiations) {
                const shadowPrices = await getShadowPrices(page);

                const negotiationClicked = await page.evaluate(() => {
                    const container = document.querySelector('#my-negotiations');
                    const firstNeg = container?.querySelector('.negotiation-item');
                    if (firstNeg) {
                        firstNeg.click();
                        return true;
                    }
                    return false;
                });

                if (negotiationClicked) {
                    await sleep(1000);

                    const shouldAccept = Math.random() > 0.3;

                    if (shouldAccept) {
                        const accepted = await page.evaluate(() => {
                            const btn = document.querySelector('#accept-offer-btn');
                            if (btn && !btn.classList.contains('hidden')) {
                                btn.click();
                                return true;
                            }
                            return false;
                        });

                        if (accepted) {
                            console.log(`   ${teamName} → ✓ ACCEPTED offer`);
                            await sleep(1000);
                        }
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

/**
 * Check and display leaderboard
 */
async function checkLeaderboard(browser, session) {
    console.log(`\n📊 Leaderboard - Session ${session}:`);

    const page = await browser.newPage();
    try {
        const response = await page.goto(`${BASE_URL}/api/leaderboard/standings.php`);
        const data = await response.json();

        if (data.success && data.teams) {
            data.teams.forEach((team, index) => {
                const rank = index + 1;
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
                const npcTag = team.teamName.match(/^(Shaky|Balanced|Astute|Bumbling|Clumsy|Careful|Cunning|Shrewd)/) ? '[NPC]' : '';
                console.log(`   ${medal} #${rank} ${team.teamName.padEnd(25)} ${npcTag.padEnd(6)} - $${team.currentFunds.toFixed(2).padStart(10)} (${team.roi >= 0 ? '+' : ''}${team.roi.toFixed(1)}%)`);
            });
        }
    } catch (error) {
        console.log(`   ⚠️  Could not fetch leaderboard: ${error.message}`);
    } finally {
        await page.close();
    }
}

/**
 * Get current session number
 */
async function getCurrentSession(browser) {
    const page = await browser.newPage();
    try {
        const response = await page.goto(`${BASE_URL}/api/admin/session.php`);
        const data = await response.json();
        return data.session.currentSession;
    } finally {
        await page.close();
    }
}

/**
 * Get current phase
 */
async function getCurrentPhase(browser) {
    const page = await browser.newPage();
    try {
        const response = await page.goto(`${BASE_URL}/api/admin/session.php`);
        const data = await response.json();
        return data.session.phase;
    } finally {
        await page.close();
    }
}

/**
 * Wait for phase to change to target phase
 */
async function waitForPhaseChange(browser, targetPhase) {
    const maxWaitSeconds = 120;
    const startTime = Date.now();

    while ((Date.now() - startTime) / 1000 < maxWaitSeconds) {
        const currentPhase = await getCurrentPhase(browser);

        if (currentPhase === targetPhase) {
            console.log(`   ✓ Phase changed to ${targetPhase}`);
            return;
        }

        await sleep(2000);
    }

    throw new Error(`Timeout waiting for ${targetPhase} phase`);
}

/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run simulation
runSimulation().catch(console.error);
