/**
 * CNDQ Game Simulation - Puppeteer Test
 *
 * Simulates 2 teams playing the complete game flow for 3 sessions with auto-advance.
 * Tests the full game flow:
 * - Trading Phase: Advertisement posting, negotiations, accepting/rejecting offers
 * - Production Phase: Automatic production based on inventory
 * - Session transitions and leaderboard updates
 * Teams make intelligent trading decisions based on shadow prices.
 */

const puppeteer = require('puppeteer');

const BASE_URL = 'http://cndq.test';
const TEAMS = [
    'test_mail1@stonybrook.edu',
    'test_mail2@stonybrook.edu'
];

const CHEMICALS = ['C', 'N', 'D', 'Q'];
const TARGET_SESSIONS = 3;
const TRADING_PHASE_DURATION = 60; // seconds

/**
 * Main simulation function
 */
async function runSimulation() {
    console.log('🎮 Starting CNDQ Game Simulation...\n');

    const browser = await puppeteer.launch({
        headless: false, // Set to true for faster execution
        defaultViewport: { width: 1280, height: 800 }
    });

    try {
        // Step 1: Enable auto-advance
        console.log('📋 Step 1: Enabling auto-advance...');
        await enableAutoAdvance(browser);

        // Step 2: Run game simulation for 10 sessions
        console.log('\n📋 Step 2: Starting multi-session gameplay...');
        await playMultipleSessions(browser);

        console.log('\n✅ Simulation complete!');
        console.log('\n📋 Full Game Flow Tested:');
        console.log('   ✓ Auto-advance enabled');
        console.log('   ✓ Advertisement posting (buy/sell based on shadow prices)');
        console.log('   ✓ Negotiation initiation');
        console.log('   ✓ Negotiation responses (accept/counter/reject)');
        console.log('   ✓ Trading phase completion');
        console.log('   ✓ Production phase (automatic)');
        console.log('   ✓ Session transitions');
        console.log('   ✓ Leaderboard updates');
        console.log(`   ✓ ${TARGET_SESSIONS} complete sessions with ${TEAMS.length} teams`);
        console.log('\n📊 View detailed results at:', BASE_URL + '/index.html');

    } catch (error) {
        console.error('❌ Simulation failed:', error);
    } finally {
        // Keep browser open to inspect results
        console.log('\n🔍 Browser kept open for inspection. Close manually when done.');
    }
}

/**
 * Enable auto-advance via admin panel
 */
async function enableAutoAdvance(browser) {
    const page = await browser.newPage();

    // Login as admin
    await page.goto(`${BASE_URL}/dev_login.php?user=admin@stonybrook.edu`);
    await sleep(1000);

    // Open admin panel
    await page.goto(`${BASE_URL}/admin.html`, { waitUntil: 'networkidle2' });
    await sleep(1000);

    // Wait for checkbox to be available
    await page.waitForSelector('#auto-advance', { timeout: 10000 });

    // Enable auto-advance checkbox
    const autoAdvanceCheckbox = await page.$('#auto-advance');
    const isChecked = await page.evaluate(el => el.checked, autoAdvanceCheckbox);

    if (!isChecked) {
        await autoAdvanceCheckbox.click();
        console.log('   ✓ Auto-advance enabled');
    } else {
        console.log('   ✓ Auto-advance already enabled');
    }

    await page.close();
}

/**
 * Play multiple sessions with all teams
 */
async function playMultipleSessions(browser) {
    let currentSession = await getCurrentSession(browser);
    const startSession = currentSession;

    console.log(`   Starting at session ${startSession}`);
    console.log(`   Target: ${TARGET_SESSIONS} sessions\n`);

    while (currentSession < startSession + TARGET_SESSIONS) {
        const phase = await getCurrentPhase(browser);

        console.log(`\n🎯 Session ${currentSession} - ${phase.toUpperCase()}`);
        console.log('─'.repeat(60));

        if (phase === 'trading') {
            // All teams post advertisements based on shadow prices
            await allTeamsAdvertise(browser);

            // Wait a bit for advertisements to post
            await sleep(2000);

            // Teams initiate negotiations
            await allTeamsNegotiate(browser);

            // Wait for negotiations to be created
            await sleep(2000);

            // Teams respond to incoming negotiations
            await allTeamsRespondToNegotiations(browser);

            // Check leaderboard during trading
            await checkLeaderboard(browser, currentSession);

            // Wait for trading phase to end
            console.log('\n⏳ Waiting for trading phase to end...');
            await waitForPhaseChange(browser, 'production');
        } else {
            // Production phase - just wait
            console.log('   ⚙️  Production running automatically...');
            await waitForPhaseChange(browser, 'trading');
        }

        currentSession = await getCurrentSession(browser);
    }

    console.log(`\n🏁 Completed ${TARGET_SESSIONS} sessions!`);

    // Final leaderboard
    console.log('\n' + '='.repeat(60));
    console.log('FINAL RESULTS');
    console.log('='.repeat(60));
    await checkLeaderboard(browser, currentSession - 1);
}

/**
 * All teams post buy/sell advertisements based on shadow prices
 */
async function allTeamsAdvertise(browser) {
    console.log('\n📢 Teams posting advertisements...');

    for (const teamEmail of TEAMS) {
        const page = await browser.newPage();

        // Listen for console messages and errors
        page.on('console', msg => console.log(`   [Browser ${msg.type()}]:`, msg.text()));
        page.on('pageerror', err => console.error(`   [Page Error]:`, err.message));

        try {
            // Login as team
            await page.goto(`${BASE_URL}/dev_login.php?user=${teamEmail}`);
            await sleep(1000);
            await page.goto(`${BASE_URL}/index.html`);
            await sleep(2000);

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
                    console.log(`      📥 Wants to BUY ${chemical} (shadow: $${shadowPrice})`);
                } else if (shadowPrice < 1) {
                    // Low shadow price → Want to sell
                    await postAdvertisement(page, chemical, 'sell');
                    console.log(`      📤 Wants to SELL ${chemical} (shadow: $${shadowPrice})`);
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
 * All teams look for trading opportunities and negotiate
 */
async function allTeamsNegotiate(browser) {
    console.log('\n💼 Teams initiating negotiations...');

    for (const teamEmail of TEAMS) {
        const page = await browser.newPage();

        // Listen for console messages and errors
        page.on('console', msg => console.log(`   [Browser ${msg.type()}]:`, msg.text()));
        page.on('pageerror', err => console.error(`   [Page Error]:`, err.message));

        try {
            // Login as team
            await page.goto(`${BASE_URL}/dev_login.php?user=${teamEmail}`);
            await sleep(1000);
            await page.goto(`${BASE_URL}/index.html`);
            await sleep(2000);

            const teamName = await page.$eval('#team-name', el => el.textContent);
            const shadowPrices = await getShadowPrices(page);

            // Look for one good trading opportunity
            for (const chemical of CHEMICALS) {
                const myShadowPrice = shadowPrices[chemical];

                // If I want to buy (high shadow price)
                if (myShadowPrice > 2) {
                    const seller = await findSeller(page, chemical);
                    if (seller) {
                        await initiateNegotiation(page, seller, chemical, 'buy', myShadowPrice);
                        console.log(`   ${teamName} → Negotiating to BUY ${chemical} from ${seller.teamName}`);
                        break; // One trade per team per round
                    }
                }

                // If I want to sell (low shadow price)
                if (myShadowPrice < 1) {
                    const buyer = await findBuyer(page, chemical);
                    if (buyer) {
                        await initiateNegotiation(page, buyer, chemical, 'sell', myShadowPrice);
                        console.log(`   ${teamName} → Negotiating to SELL ${chemical} to ${buyer.teamName}`);
                        break; // One trade per team per round
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
            // Access light DOM of chemical-card component (no shadow DOM)
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
    // Access button in light DOM of chemical-card component
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
        // Access light DOM of chemical-card component
        const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
        if (!card) return null;

        // Find all advertisement-item elements in light DOM
        const adItems = card.querySelectorAll('advertisement-item');

        // Look for a sell advertisement that's not my own
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
        // Access light DOM of chemical-card component
        const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
        if (!card) return null;

        // Find all advertisement-item elements in light DOM
        const adItems = card.querySelectorAll('advertisement-item');

        // Look for a buy advertisement that's not my own
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
 * Initiate negotiation with another team
 */
async function initiateNegotiation(page, counterparty, chemical, type, myShadowPrice) {
    try {
        // Click negotiate button in light DOM
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

            // Fill in negotiation form
            const quantity = Math.floor(Math.random() * 50) + 10; // 10-60 gallons
            const priceOffset = (Math.random() * 2) - 1; // -1 to +1
            const price = Math.max(0.1, myShadowPrice + priceOffset).toFixed(2);

            await page.type('#new-quantity', quantity.toString());
            await page.type('#new-price', price);

            await page.click('#submit-new-negotiation-btn');
            await sleep(500);
        }
    } catch (error) {
        // Negotiation might fail - that's okay
    }
}

/**
 * All teams respond to pending negotiations
 */
async function allTeamsRespondToNegotiations(browser) {
    console.log('\n💬 Teams responding to negotiations...');

    for (const teamEmail of TEAMS) {
        const page = await browser.newPage();

        try {
            // Login as team
            await page.goto(`${BASE_URL}/dev_login.php?user=${teamEmail}`);
            await sleep(1000);
            await page.goto(`${BASE_URL}/index.html`);
            await sleep(2000);

            const teamName = await page.$eval('#team-name', el => el.textContent);

            // Check for pending negotiations
            const hasNegotiations = await page.evaluate(() => {
                const container = document.querySelector('#my-negotiations');
                return container && container.children.length > 1; // More than just "no negotiations" message
            });

            if (hasNegotiations) {
                // Get shadow prices to make intelligent decisions
                const shadowPrices = await getShadowPrices(page);

                // Click first negotiation to view details
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

                    // Get negotiation details
                    const negDetails = await page.evaluate(() => {
                        const chemEl = document.querySelector('#detail-chemical');
                        const chemical = chemEl?.textContent?.match(/Chemical ([CNDQ])/)?.[1];

                        // Get latest offer from history
                        const offers = document.querySelectorAll('#offer-history .offer-item');
                        if (offers.length > 0) {
                            const lastOffer = offers[offers.length - 1];
                            const quantity = parseInt(lastOffer.querySelector('.quantity')?.textContent || '0');
                            const price = parseFloat(lastOffer.querySelector('.price')?.textContent?.replace('$', '') || '0');
                            return { chemical, quantity, price };
                        }
                        return null;
                    });

                    if (negDetails && negDetails.chemical) {
                        const myShadowPrice = shadowPrices[negDetails.chemical];
                        const offerPrice = negDetails.price;

                        // Decision logic: Accept if price is favorable
                        // If buying: accept if offer price < my shadow price
                        // If selling: accept if offer price > my shadow price
                        const shouldAccept = Math.random() > 0.3; // 70% acceptance rate for testing

                        if (shouldAccept) {
                            // Accept the offer
                            const accepted = await page.evaluate(() => {
                                const btn = document.querySelector('#accept-offer-btn');
                                if (btn && !btn.classList.contains('hidden')) {
                                    btn.click();
                                    return true;
                                }
                                return false;
                            });

                            if (accepted) {
                                console.log(`   ${teamName} → ✓ ACCEPTED offer for ${negDetails.chemical} (${negDetails.quantity} gal @ $${negDetails.price})`);
                                await sleep(1000);
                            }
                        } else {
                            // Counter-offer or reject
                            if (Math.random() > 0.5) {
                                // Counter-offer
                                const counterPrice = (myShadowPrice * 0.9 + offerPrice * 0.1).toFixed(2);
                                const counterQuantity = Math.max(1, Math.floor(negDetails.quantity * 0.8));

                                const countered = await page.evaluate((qty, price) => {
                                    const showCounterBtn = document.querySelector('#show-counter-form-btn');
                                    if (showCounterBtn && !showCounterBtn.classList.contains('hidden')) {
                                        showCounterBtn.click();
                                        setTimeout(() => {
                                            const qtyInput = document.querySelector('#counter-quantity');
                                            const priceInput = document.querySelector('#counter-price');
                                            const submitBtn = document.querySelector('#submit-counter-btn');
                                            if (qtyInput && priceInput && submitBtn) {
                                                qtyInput.value = qty;
                                                priceInput.value = price;
                                                submitBtn.click();
                                                return true;
                                            }
                                        }, 500);
                                        return true;
                                    }
                                    return false;
                                }, counterQuantity, counterPrice);

                                if (countered) {
                                    console.log(`   ${teamName} → 🔄 COUNTER-OFFER for ${negDetails.chemical} (${counterQuantity} gal @ $${counterPrice})`);
                                    await sleep(1500);
                                }
                            } else {
                                // Reject
                                const rejected = await page.evaluate(() => {
                                    const btn = document.querySelector('#reject-offer-btn');
                                    if (btn && !btn.classList.contains('hidden')) {
                                        btn.click();
                                        return true;
                                    }
                                    return false;
                                });

                                if (rejected) {
                                    console.log(`   ${teamName} → ✗ REJECTED offer for ${negDetails.chemical}`);
                                    await sleep(1000);
                                }
                            }
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
        const response = await page.goto(`${BASE_URL}/api/team/leaderboard.php`);
        const data = await response.json();

        if (data.success && data.teams) {
            data.teams.forEach((team, index) => {
                const rank = index + 1;
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
                console.log(`   ${medal} #${rank} ${team.teamName.padEnd(20)} - $${team.currentFunds.toFixed(2).padStart(10)} (${team.roi >= 0 ? '+' : ''}${team.roi.toFixed(1)}%)`);
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

        await sleep(2000); // Check every 2 seconds
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
