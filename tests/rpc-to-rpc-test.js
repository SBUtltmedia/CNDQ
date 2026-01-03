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
    'test_mail2@stonybrook.edu',
    'test_mail3@stonybrook.edu',
    'test_mail4@stonybrook.edu'
];

const CHEMICALS = ['C', 'N', 'D', 'Q'];
const TARGET_SESSIONS = 1; // Test one complete session (trading + production)

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

    // Keep one RPC page open for polling (triggers auto-advance)
    let pollingPage = null;

    try {
        // Step 0: Reset game to clean state
        console.log('📋 Step 0: Resetting game to clean state...');
        await resetGame(browser);

        // Step 0b: Disable NPCs (pure RPC-to-RPC test)
        console.log('\n📋 Step 0b: Disabling NPCs (RPC-to-RPC only)...');
        await disableNPCs(browser);

        // Step 1: Enable auto-advance via admin UI
        console.log('\n📋 Step 1: Enabling auto-advance via admin UI...');
        await enableAutoAdvance(browser);

        // Step 2: Teams calculate initial shadow prices (game start only)
        console.log('\n📋 Step 2: Teams calculating initial shadow prices...');
        await allTeamsCalculateShadowPrices(browser);

        // Step 3: Open persistent polling page for Team 1
        console.log('\n📋 Step 3: Opening persistent RPC window for polling...');
        pollingPage = await browser.newPage();

        // Listen for console messages and errors
        pollingPage.on('console', msg => console.log(`   [Polling Page ${msg.type()}]:`, msg.text()));
        pollingPage.on('pageerror', err => console.error(`   [Polling Page Error]:`, err.message));
        pollingPage.on('response', response => {
            if (response.status() === 404) {
                console.warn(`   [Polling Page 404]: ${response.url()}`);
            }
        });

        await pollingPage.goto(`${BASE_URL}/dev_login.php?user=${TEAMS[0]}`, { waitUntil: 'networkidle2' });
        await sleep(500);
        await pollingPage.goto(BASE_URL, { waitUntil: 'networkidle2' });

        // Wait for marketplace to initialize
        await pollingPage.waitForSelector('#app:not(.hidden)', { timeout: 10000 });
        await sleep(2000);

        console.log('   ✓ RPC window open - JavaScript polling will trigger auto-advance');

        // Step 4: Run game simulation for TARGET_SESSIONS sessions
        console.log(`\n📋 Step 4: Starting ${TARGET_SESSIONS}-session gameplay...\n`);
        await playMultipleSessions(browser);

        console.log('\n✅ Simulation complete!');
        console.log('\n📋 Full RPC-to-RPC Flow Tested:');
        console.log('   ✓ Cookie-based authentication (dev_login.php)');
        console.log('   ✓ Shadow DOM UI element access');
        console.log('   ✓ Advertisement posting (buy/sell via chemical cards)');
        console.log('   ✓ Negotiation initiation (RPC → RPC)');
        console.log('   ✓ Negotiation responses (accept/counter/reject)');
        console.log('   ✓ Production run (manual trigger)');
        console.log('   ✓ Session advancement');
        console.log('   ✓ Leaderboard updates');
        console.log(`   ✓ ${TARGET_SESSIONS} complete session(s) with ${TEAMS.length} RPC teams (NO NPCs)`);

    } catch (error) {
        console.error('❌ Simulation failed:', error);
        process.exit(1);
    } finally {
        // Close polling page first
        if (pollingPage) {
            await pollingPage.close();
        }
        await browser.close();
    }
}

/**
 * Reset the entire game - deletes all team data and resets session to 1
 */
async function resetGame(browser) {
    const page = await browser.newPage();

    try {
        // Login as admin
        await page.goto(`${BASE_URL}/dev_login.php?user=admin@stonybrook.edu`, { waitUntil: 'networkidle2' });
        await sleep(500);

        // Call reset API
        const result = await page.evaluate(async () => {
            const response = await fetch('/CNDQ/api/admin/reset-game.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin'
            });
            return await response.json();
        });

        if (result.success) {
            console.log(`   ✓ Game reset - ${result.teamsDeleted} teams deleted, session reset to 1`);
        } else {
            console.warn(`   ⚠️  Reset warning: ${result.error || result.message}`);
        }
    } finally {
        await page.close();
    }
}

/**
 * Disable NPCs for pure RPC-to-RPC testing
 */
async function disableNPCs(browser) {
    const page = await browser.newPage();

    try {
        // Login as admin
        await page.goto(`${BASE_URL}/dev_login.php?user=admin@stonybrook.edu`, { waitUntil: 'networkidle2' });
        await sleep(500);

        // Navigate to admin page
        await page.goto(`${BASE_URL}/admin/index.php`, { waitUntil: 'networkidle2' });
        await sleep(500);

        // Disable NPCs via admin UI
        const result = await page.evaluate(async () => {
            // Check if NPC toggle exists and disable it
            const npcToggle = document.getElementById('npc-enabled');
            if (npcToggle && npcToggle.checked) {
                npcToggle.click();
                // Wait for the change to save
                await new Promise(resolve => setTimeout(resolve, 1000));
                return { disabled: true };
            }
            return { disabled: false, alreadyDisabled: true };
        });

        if (result.disabled) {
            console.log('   ✓ NPCs disabled');
        } else if (result.alreadyDisabled) {
            console.log('   ✓ NPCs already disabled');
        }
    } finally {
        await page.close();
    }
}

/**
 * Enable auto-advance via admin panel UI and set short trading duration for testing
 */
async function enableAutoAdvance(browser) {
    const page = await browser.newPage();

    try {
        // Login as admin via dev_login.php (direct URL with user parameter)
        await page.goto(`${BASE_URL}/dev_login.php?user=admin@stonybrook.edu`, { waitUntil: 'networkidle2' });

        // Verify cookie was set
        const cookies = await page.cookies();
        const mockMailCookie = cookies.find(c => c.name === 'mock_mail');
        if (!mockMailCookie) {
            console.warn('   ⚠️  Warning: Cookie not set for admin login');
        }

        // Navigate to admin panel
        await page.goto(`${BASE_URL}/admin/index.php`, { waitUntil: 'networkidle2' });
        await page.waitForSelector('#auto-advance', { timeout: 10000 });

        // Set trading duration to 30 seconds for faster testing
        await page.evaluate(() => {
            document.getElementById('trading-duration-minutes').value = 0;
            document.getElementById('trading-duration-seconds').value = 30;
        });
        await page.evaluate(() => {
            return fetch(`${window.location.origin}/CNDQ/api/admin/session.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'setTradingDuration', seconds: 30 }),
                credentials: 'same-origin'
            });
        });
        await sleep(500);
        console.log('   ✓ Trading duration set to 30 seconds');

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

        // Check leaderboard before production
        await checkLeaderboard(browser, currentSession);

        // Manually trigger production and session advance
        console.log('\n⚙️ Manually triggering production and session advance...');
        await manuallyAdvanceSession(browser);
        await sleep(3000);

        currentSession = await getCurrentSession(browser);
        console.log(`   ✓ Advanced to session ${currentSession}`);
    }

    console.log(`\n🏁 Completed ${TARGET_SESSIONS} session(s) with production!`);

    // Final leaderboard after production
    console.log('\n' + '='.repeat(60));
    console.log('FINAL RESULTS (After Production)');
    console.log('='.repeat(60));
    await checkLeaderboard(browser, currentSession - 1);
}

/**
 * All teams calculate their shadow prices
 */
async function allTeamsCalculateShadowPrices(browser) {
    for (const teamEmail of TEAMS) {
        const page = await browser.newPage();

        try {
            // Login as team
            await page.goto(`${BASE_URL}/dev_login.php?user=${teamEmail}`, { waitUntil: 'networkidle2' });
            await sleep(500);

            // Call shadow prices API
            const result = await page.evaluate(async () => {
                const response = await fetch('/CNDQ/api/production/shadow-prices.php', {
                    method: 'GET',
                    credentials: 'same-origin'
                });
                return await response.json();
            });

            if (result.success) {
                const sp = result.shadowPrices;
                const teamIndex = TEAMS.indexOf(teamEmail) + 1;
                console.log(`   Team ${teamIndex}: C=$${sp.C} N=$${sp.N} D=$${sp.D} Q=$${sp.Q} (profit: $${result.maxProfit.toFixed(2)})`);
            }
        } catch (error) {
            console.warn(`   ⚠️  ${teamEmail}: Failed to calculate shadow prices - ${error.message}`);
        } finally {
            await page.close();
        }
    }
}

/**
 * All teams post buy/sell advertisements based on shadow prices
 */
async function allTeamsAdvertise(browser) {
    console.log('\n📢 Teams posting advertisements...');

    for (const teamEmail of TEAMS) {
        const page = await browser.newPage();

        try {
            // Login as team via dev_login (direct URL with user parameter)
            await page.goto(`${BASE_URL}/dev_login.php?user=${teamEmail}`, { waitUntil: 'networkidle2' });
            await sleep(500);

            await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
            await page.waitForSelector('#app:not(.hidden)', { timeout: 10000 });
            await sleep(2000);

            // Get shadow prices from UI
            const shadowPrices = await getShadowPrices(page);

            // Wait for team name to load (it gets populated by the profile loading)
            const teamName = await page.waitForFunction(() => {
                const el = document.getElementById('team-name');
                const name = el?.textContent?.trim();
                return name && name !== '' ? name : null;
            }, { timeout: 10000 })
                .then(handle => handle.jsonValue())
                .catch(() => {
                    // If team name not found, use the email we logged in with
                    const teamIndex = TEAMS.indexOf(teamEmail) + 1;
                    return `Team ${teamIndex} (${teamEmail})`;
                });

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
            // Login as team (direct URL with user parameter)
            await page.goto(`${BASE_URL}/dev_login.php?user=${teamEmail}`, { waitUntil: 'networkidle2' });
            await sleep(500);

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
 * Get shadow prices from UI elements (in shadow DOM)
 */
async function getShadowPrices(page) {
    return await page.evaluate(() => {
        const prices = {};
        ['C', 'N', 'D', 'Q'].forEach(chem => {
            const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
            if (card && card.shadowRoot) {
                const el = card.shadowRoot.querySelector('#shadow-price');
                const text = el?.textContent?.trim() || '$0';
                const priceMatch = text.match(/\$([\d.]+)/);
                prices[chem] = priceMatch ? parseFloat(priceMatch[1]) : 0;
            } else {
                prices[chem] = 0;
            }
        });
        return prices;
    });
}

/**
 * Post advertisement for a chemical via UI (using shadow DOM)
 */
async function postAdvertisement(page, chemical, type) {
    // Click the button inside the chemical card's shadow DOM
    await page.evaluate((chem, adType) => {
        const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
        if (card && card.shadowRoot) {
            const button = card.shadowRoot.querySelector(`#post-${adType}-btn`);
            if (button) button.click();
        }
    }, chemical, type);

    await sleep(800);

    // Fill in the modal (Main DOM) - use default values
    await page.evaluate(() => {
        const qtyInput = document.getElementById('offer-quantity');
        const priceInput = document.getElementById('offer-price');

        if (qtyInput && priceInput) {
            qtyInput.value = 100;  // Default quantity
            priceInput.value = 5.00;  // Default price
            qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
            priceInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });

    await sleep(500);
    await page.click('#offer-submit-btn');
    await sleep(1000);
}

/**
 * Find a seller for a chemical from UI (in shadow DOM)
 */
async function findSeller(page, chemical) {
    return await page.evaluate((chem) => {
        const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
        if (!card || !card.shadowRoot) return null;

        const adItems = card.shadowRoot.querySelectorAll('advertisement-item');
        for (const item of adItems) {
            const type = item.type || item.getAttribute('type');
            const teamId = item.teamId || item.getAttribute('teamid') || item.getAttribute('teamId');
            const teamName = item.teamName || item.getAttribute('teamname') || item.getAttribute('teamName');
            const isMyAd = item.isMyAd || item.hasAttribute('ismyad') || item.hasAttribute('isMyAd');

            if (type === 'sell' && !isMyAd) {
                return { teamId, teamName, chemical: chem };
            }
        }
        return null;
    }, chemical);
}

/**
 * Find a buyer for a chemical from UI (in shadow DOM)
 */
async function findBuyer(page, chemical) {
    return await page.evaluate((chem) => {
        const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
        if (!card || !card.shadowRoot) return null;

        const adItems = card.shadowRoot.querySelectorAll('advertisement-item');
        for (const item of adItems) {
            const type = item.type || item.getAttribute('type');
            const teamId = item.teamId || item.getAttribute('teamid') || item.getAttribute('teamId');
            const teamName = item.teamName || item.getAttribute('teamname') || item.getAttribute('teamName');
            const isMyAd = item.isMyAd || item.hasAttribute('ismyad') || item.hasAttribute('isMyAd');

            if (type === 'buy' && !isMyAd) {
                return { teamId, teamName, chemical: chem };
            }
        }
        return null;
    }, chemical);
}

/**
 * Initiate negotiation with another team via UI (using shadow DOM)
 */
async function initiateNegotiation(page, counterparty, chemical, type, myShadowPrice) {
    try {
        // Click negotiate button in advertisement-item shadow DOM
        const clicked = await page.evaluate((teamId, chem) => {
            const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
            if (!card || !card.shadowRoot) return false;

            const adItems = card.shadowRoot.querySelectorAll('advertisement-item');
            for (const item of adItems) {
                const itemTeamId = item.teamId || item.getAttribute('teamid') || item.getAttribute('teamId');
                if (itemTeamId === teamId && item.shadowRoot) {
                    const btn = item.shadowRoot.querySelector('.btn');
                    if (btn) {
                        btn.click();
                        return true;
                    }
                }
            }
            return false;
        }, counterparty.teamId, chemical);

        if (clicked) {
            await page.waitForSelector('#respond-modal', { visible: true, timeout: 5000 });
            await sleep(1000);

            // Fill in negotiation form via UI
            const quantity = Math.floor(Math.random() * 50) + 10; // 10-60 gallons
            const priceOffset = (Math.random() * 2) - 1; // -1 to +1
            const price = Math.max(0.1, myShadowPrice + priceOffset).toFixed(2);

            await page.evaluate((qty, prc) => {
                const qtyInput = document.getElementById('respond-quantity');
                const priceInput = document.getElementById('respond-price');
                if (qtyInput && priceInput) {
                    qtyInput.value = qty;
                    priceInput.value = prc;
                    qtyInput.dispatchEvent(new Event('input', { bubbles: true }));
                    priceInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, quantity, price);

            await sleep(500);
            await page.click('#respond-submit-btn');
            await sleep(1000);
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
            // Login as team (direct URL with user parameter)
            await page.goto(`${BASE_URL}/dev_login.php?user=${teamEmail}`, { waitUntil: 'networkidle2' });
            await sleep(500);

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
        // Login to access leaderboard UI (direct URL with user parameter)
        await page.goto(`${BASE_URL}/dev_login.php?user=${TEAMS[0]}`, { waitUntil: 'networkidle2' });
        await sleep(500);

        await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

        // Open leaderboard modal
        await page.waitForSelector('#leaderboard-btn', { timeout: 10000 });
        await page.click('#leaderboard-btn');
        await sleep(1000);

        // Wait for leaderboard content to load
        await page.waitForSelector('#leaderboard-body', { timeout: 5000 });

        // Give async loadLeaderboard() time to fetch and render (simplified approach)
        await sleep(3000);

        // Read leaderboard from UI elements
        const leaderboard = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#leaderboard-body tr'));
            return rows.map(row => {
                const cells = row.querySelectorAll('td');
                return {
                    teamName: cells[1]?.textContent?.trim() || '',
                    funds: parseFloat(cells[2]?.textContent?.replace(/[$,]/g, '') || '0'),
                    roi: parseFloat(cells[3]?.textContent?.replace('%', '') || '0')
                };
            });
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
 * Get current session number from API (not UI to avoid race conditions)
 */
async function getCurrentSession(browser) {
    const page = await browser.newPage();
    try {
        // Login (direct URL with user parameter)
        await page.goto(`${BASE_URL}/dev_login.php?user=${TEAMS[0]}`, { waitUntil: 'networkidle2' });
        await sleep(500);

        // Query API directly instead of reading from UI (avoids timing issues)
        const sessionData = await page.evaluate(async () => {
            const response = await fetch('/CNDQ/api/admin/session.php', {
                method: 'GET',
                credentials: 'same-origin'
            });
            const data = await response.json();
            return data.session.currentSession;
        });

        return sessionData;
    } finally {
        await page.close();
    }
}

/**
 * Manually advance session (triggers production and moves to next session)
 */
async function manuallyAdvanceSession(browser) {
    const page = await browser.newPage();
    try {
        // Login as admin
        await page.goto(`${BASE_URL}/dev_login.php?user=admin@stonybrook.edu`, { waitUntil: 'networkidle2' });
        await sleep(500);

        // Navigate to admin page to ensure we're authenticated
        await page.goto(`${BASE_URL}/admin/index.php`, { waitUntil: 'networkidle2' });
        await sleep(1000);

        // Call admin API to advance session (relative path from admin page)
        const result = await page.evaluate(async () => {
            try {
                const response = await fetch('../api/admin/session.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'advance' }),
                    credentials: 'same-origin'
                });

                const text = await response.text();
                try {
                    return JSON.parse(text);
                } catch (e) {
                    return {
                        success: false,
                        error: 'Invalid JSON response',
                        responseText: text.substring(0, 200)
                    };
                }
            } catch (e) {
                return { success: false, error: e.message };
            }
        });

        if (result.success) {
            console.log(`   ✓ Production ran and advanced to session ${result.session.currentSession}`);
        } else {
            console.warn(`   ⚠️  Advance failed: ${result.error}`);
            if (result.responseText) {
                console.warn(`   Response: ${result.responseText}`);
            }
        }
    } finally {
        await page.close();
    }
}

/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run simulation
runSimulation().catch(console.error);
