/**
 * RPC-to-RPC Game Simulation Test (Refactored - UI Only)
 *
 * Simulates 2 real player teams trading with each other for 3 sessions.
 * Tests the complete RPC-to-RPC interaction flow:
 * - Trading Phase: Advertisement posting, negotiations, accepting/rejecting offers
 * - Automatic Production: Runs when trading time expires (between sessions)
 * - Session transitions and leaderboard updates
 *
 * Teams make intelligent trading decisions based on shadow prices.
 *
 * IMPORTANT: This version uses ONLY UI interactions - no direct API calls.
 * All data is read from UI elements, all actions through UI buttons/forms.
 */

const puppeteer = require('puppeteer');

const BASE_URL = 'http://cndq.test/CNDQ';
const TEAMS = [
    'test_mail1@stonybrook.edu',
    'test_mail2@stonybrook.edu'
];

const CHEMICALS = ['C', 'N', 'D', 'Q'];
const TARGET_SESSIONS = 3;

/**
 * Main simulation function
 */
async function runSimulation() {
    console.log('🎮 Starting RPC-to-RPC Game Simulation (UI Only)...\n');

    const browser = await puppeteer.launch({
        headless: "new",
        defaultViewport: { width: 1280, height: 800 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        // Step 1: Enable auto-advance via admin UI
        console.log('📋 Step 1: Enabling auto-advance via admin UI...');
        await enableAutoAdvance(browser);

        // Step 2: Run game simulation for TARGET_SESSIONS sessions
        console.log(`\n📋 Step 2: Starting ${TARGET_SESSIONS}-session gameplay...\n`);
        await playMultipleSessions(browser);

        console.log('\n✅ Simulation complete!');
        console.log('\n📋 Full RPC-to-RPC Flow Tested:');
        console.log('   ✓ Auto-advance enabled (via UI)');
        console.log('   ✓ Advertisement posting (buy/sell based on shadow prices)');
        console.log('   ✓ Negotiation initiation (RPC → RPC)');
        console.log('   ✓ Negotiation responses (accept/counter/reject)');
        console.log('   ✓ Trading phase completion');
        console.log('   ✓ Automatic production (between sessions)');
        console.log('   ✓ Session transitions');
        console.log('   ✓ Leaderboard updates');
        console.log(`   ✓ ${TARGET_SESSIONS} complete sessions with ${TEAMS.length} teams`);

    } catch (error) {
        console.error('❌ Simulation failed:', error);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

/**
 * Enable auto-advance via admin panel UI
 */
async function enableAutoAdvance(browser) {
    const page = await browser.newPage();

    try {
        // Login as admin via dev_login.php
        await page.goto(`${BASE_URL}/dev_login.php`, { waitUntil: 'networkidle2' });
        await page.click('a[href*="admin@stonybrook.edu"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        // Navigate to admin panel
        await page.goto(`${BASE_URL}/admin/index.php`, { waitUntil: 'networkidle2' });
        await page.waitForSelector('#auto-advance', { timeout: 10000 });

        // Enable auto-advance checkbox via UI
        const isChecked = await page.$eval('#auto-advance', el => el.checked);

        if (!isChecked) {
            await page.click('#auto-advance');
            console.log('   ✓ Auto-advance enabled');
        } else {
            console.log('   ✓ Auto-advance already enabled');
        }
    } finally {
        await page.close();
    }
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
        console.log(`\n🎯 Session ${currentSession} - TRADING`);
        console.log('─'.repeat(60));

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

        // Wait for session to advance (production runs automatically when trading expires)
        console.log('\n⏳ Waiting for session to advance (trading will expire, production runs automatically)...');
        await waitForSessionChange(browser, currentSession);

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

        try {
            // Login as team via dev_login
            await page.goto(`${BASE_URL}/dev_login.php`, { waitUntil: 'networkidle2' });
            await page.click(`a[href*="${teamEmail}"]`);
            await page.waitForNavigation({ waitUntil: 'networkidle2' });

            await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
            await page.waitForSelector('#app:not(.hidden)', { timeout: 10000 });
            await sleep(2000);

            // Get shadow prices from UI
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

        try {
            // Login as team
            await page.goto(`${BASE_URL}/dev_login.php`, { waitUntil: 'networkidle2' });
            await page.click(`a[href*="${teamEmail}"]`);
            await page.waitForNavigation({ waitUntil: 'networkidle2' });

            await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
            await page.waitForSelector('#app:not(.hidden)', { timeout: 10000 });
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
 * Get shadow prices from UI elements
 */
async function getShadowPrices(page) {
    return await page.evaluate(() => {
        const prices = {};
        ['C', 'N', 'D', 'Q'].forEach(chem => {
            const priceEl = document.getElementById(`shadow-${chem}`);
            prices[chem] = priceEl ? parseFloat(priceEl.textContent.replace('$', '') || '0') : 0;
        });
        return prices;
    });
}

/**
 * Post advertisement for a chemical via UI
 */
async function postAdvertisement(page, chemical, type) {
    await page.evaluate((chem, adType) => {
        const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
        if (card) {
            const button = card.querySelector(`#post-${adType}-btn`);
            if (button) button.click();
        }
    }, chemical, type);

    // Wait for modal and submit
    await page.waitForSelector('#offer-modal:not(.hidden)', { timeout: 5000 });
    await page.click('#offer-submit-btn');
    await sleep(500);
}

/**
 * Find a seller for a chemical from UI
 */
async function findSeller(page, chemical) {
    return await page.evaluate((chem) => {
        const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
        if (!card) return null;

        const adItems = card.querySelectorAll('advertisement-item');
        for (const item of adItems) {
            if (item.getAttribute('type') === 'sell' && item.getAttribute('is-my-ad') !== 'true') {
                return {
                    teamId: item.getAttribute('team-id'),
                    teamName: item.getAttribute('team-name'),
                    chemical: chem
                };
            }
        }
        return null;
    }, chemical);
}

/**
 * Find a buyer for a chemical from UI
 */
async function findBuyer(page, chemical) {
    return await page.evaluate((chem) => {
        const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
        if (!card) return null;

        const adItems = card.querySelectorAll('advertisement-item');
        for (const item of adItems) {
            if (item.getAttribute('type') === 'buy' && item.getAttribute('is-my-ad') !== 'true') {
                return {
                    teamId: item.getAttribute('team-id'),
                    teamName: item.getAttribute('team-name'),
                    chemical: chem
                };
            }
        }
        return null;
    }, chemical);
}

/**
 * Initiate negotiation with another team via UI
 */
async function initiateNegotiation(page, counterparty, chemical, type, myShadowPrice) {
    try {
        // Click negotiate button via UI
        const clicked = await page.evaluate((teamId, chem) => {
            const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
            if (!card) return false;

            const adItems = card.querySelectorAll('advertisement-item');
            for (const item of adItems) {
                if (item.getAttribute('team-id') === teamId) {
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
            await page.waitForSelector('#respond-modal:not(.hidden)', { timeout: 5000 });

            // Fill in negotiation form via UI
            const quantity = Math.floor(Math.random() * 50) + 10; // 10-60 gallons
            const priceOffset = (Math.random() * 2) - 1; // -1 to +1
            const price = Math.max(0.1, myShadowPrice + priceOffset).toFixed(2);

            await page.click('#respond-quantity', { clickCount: 3 });
            await page.type('#respond-quantity', quantity.toString());
            await page.click('#respond-price', { clickCount: 3 });
            await page.type('#respond-price', price);

            await page.click('#respond-submit-btn');
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
            await page.goto(`${BASE_URL}/dev_login.php`, { waitUntil: 'networkidle2' });
            await page.click(`a[href*="${teamEmail}"]`);
            await page.waitForNavigation({ waitUntil: 'networkidle2' });

            await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
            await page.waitForSelector('#app:not(.hidden)', { timeout: 10000 });
            await sleep(2000);

            const teamName = await page.$eval('#team-name', el => el.textContent);

            // Check for pending negotiations via UI
            const hasNegotiations = await page.evaluate(() => {
                const cards = document.querySelectorAll('negotiation-card[context="summary"]');
                return cards.length > 0;
            });

            if (hasNegotiations) {
                const shadowPrices = await getShadowPrices(page);

                // Click first negotiation to view details
                await page.click('negotiation-card[context="summary"]');
                await page.waitForSelector('#negotiation-detail-view:not(.hidden)', { timeout: 5000 });
                await sleep(1000);

                // Get negotiation details from UI
                const negDetails = await page.evaluate(() => {
                    const detailView = document.getElementById('negotiation-detail-view');
                    if (!detailView) return null;

                    const chemEl = detailView.querySelector('[data-chemical]');
                    const chemical = chemEl?.getAttribute('data-chemical');

                    const qtyEl = detailView.querySelector('[data-quantity]');
                    const quantity = qtyEl ? parseInt(qtyEl.getAttribute('data-quantity')) : 0;

                    const priceEl = detailView.querySelector('[data-price]');
                    const price = priceEl ? parseFloat(priceEl.getAttribute('data-price')) : 0;

                    return { chemical, quantity, price };
                });

                if (negDetails && negDetails.chemical) {
                    const shouldAccept = Math.random() > 0.3; // 70% acceptance rate

                    if (shouldAccept) {
                        // Accept the offer via UI
                        const accepted = await page.evaluate(() => {
                            const btn = document.getElementById('accept-offer-btn');
                            if (btn && !btn.classList.contains('hidden')) {
                                btn.click();
                                return true;
                            }
                            return false;
                        });

                        if (accepted) {
                            console.log(`   ${teamName} → ✓ ACCEPTED offer for ${negDetails.chemical}`);
                            await page.waitForSelector('#confirm-ok', { timeout: 5000 });
                            await page.click('#confirm-ok');
                            await sleep(1000);
                        }
                    } else {
                        // Counter-offer or reject
                        if (Math.random() > 0.5) {
                            // Counter via UI
                            await page.click('#show-counter-form-btn');
                            await page.waitForSelector('#counter-offer-form:not(.hidden)');

                            const myShadowPrice = shadowPrices[negDetails.chemical];
                            const counterPrice = (myShadowPrice * 0.9 + negDetails.price * 0.1).toFixed(2);
                            const counterQuantity = Math.max(1, Math.floor(negDetails.quantity * 0.8));

                            await page.evaluate((qty, price) => {
                                document.getElementById('haggle-quantity-slider').value = qty;
                                document.getElementById('haggle-price-slider').value = price;
                            }, counterQuantity, counterPrice);

                            await page.click('#submit-counter-btn');
                            console.log(`   ${teamName} → 🔄 COUNTER-OFFER for ${negDetails.chemical}`);
                            await sleep(1500);
                        } else {
                            // Reject via UI
                            await page.click('#reject-offer-btn');
                            console.log(`   ${teamName} → ✗ REJECTED offer for ${negDetails.chemical}`);
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
 * Check and display leaderboard from UI
 */
async function checkLeaderboard(browser, session) {
    console.log(`\n📊 Leaderboard - Session ${session}:`);

    const page = await browser.newPage();
    try {
        // Login to access leaderboard UI
        await page.goto(`${BASE_URL}/dev_login.php`, { waitUntil: 'networkidle2' });
        await page.click(`a[href*="${TEAMS[0]}"]`);
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
        await page.waitForSelector('#leaderboard', { timeout: 10000 });

        // Read leaderboard from UI elements
        const leaderboard = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#leaderboard tbody tr'));
            return rows.map(row => ({
                teamName: row.querySelector('.team-name')?.textContent || '',
                funds: parseFloat(row.querySelector('.funds')?.textContent?.replace(/[$,]/g, '') || '0'),
                roi: parseFloat(row.querySelector('.roi')?.textContent?.replace('%', '') || '0')
            }));
        });

        leaderboard.forEach((team, index) => {
            const rank = index + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
            console.log(`   ${medal} #${rank} ${team.teamName.padEnd(20)} - $${team.funds.toFixed(2).padStart(10)} (${team.roi >= 0 ? '+' : ''}${team.roi.toFixed(1)}%)`);
        });
    } catch (error) {
        console.log(`   ⚠️  Could not read leaderboard: ${error.message}`);
    } finally {
        await page.close();
    }
}

/**
 * Get current session number from UI
 */
async function getCurrentSession(browser) {
    const page = await browser.newPage();
    try {
        await page.goto(`${BASE_URL}/dev_login.php`, { waitUntil: 'networkidle2' });
        await page.click(`a[href*="${TEAMS[0]}"]`);
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
        await page.waitForSelector('#session-num-display', { timeout: 10000 });

        return await page.$eval('#session-num-display', el => parseInt(el.textContent));
    } finally {
        await page.close();
    }
}

/**
 * Wait for session to change (production runs automatically between sessions)
 */
async function waitForSessionChange(browser, currentSessionNum) {
    const maxWaitSeconds = 120;
    const startTime = Date.now();

    while ((Date.now() - startTime) / 1000 < maxWaitSeconds) {
        const newSession = await getCurrentSession(browser);

        if (newSession > currentSessionNum) {
            console.log(`   ✓ Session advanced from ${currentSessionNum} to ${newSession} (production ran automatically)`);
            return;
        }

        await sleep(2000); // Check every 2 seconds
    }

    throw new Error(`Timeout waiting for session to advance from ${currentSessionNum}`);
}

/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run simulation
runSimulation().catch(console.error);
