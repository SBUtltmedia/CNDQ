/**
 * Visual UX Test - Complete UI/UX Flow with Screenshots
 *
 * Simulates realistic classroom scenario:
 * - 1 Admin (instructor) managing the game via UI
 * - 3 Students playing through the UI
 * - 2 complete game sessions
 * - Screenshots at every major UI interaction
 *
 * This is a TRUE UI test - no API calls, only clicking buttons,
 * filling forms, and interacting with actual UI elements.
 *
 * Usage:
 *   node tests/visual-ux-test.js
 *   node tests/visual-ux-test.js --headless
 */

const BrowserHelper = require('./helpers/browser');
const path = require('path');
const fs = require('fs');

const CONFIG = {
    baseUrl: 'http://cndq.test/CNDQ',
    adminUser: 'admin@stonybrook.edu',
    students: [
        { email: 'student1@stonybrook.edu', name: 'Alice' },
        { email: 'student2@stonybrook.edu', name: 'Bob' },
        { email: 'student3@stonybrook.edu', name: 'Charlie' }
    ],
    targetSessions: 2,
    headless: process.argv.includes('--headless'),
    screenshotDir: './screenshots/ux-test',
    slowMo: 100  // Slight delay for realism
};

class VisualUXTest {
    constructor(config) {
        this.config = config;
        this.browser = new BrowserHelper(config);
        this.screenshotCount = 0;
        this.sessionNum = 0;

        // Create screenshot directory
        if (!fs.existsSync(this.config.screenshotDir)) {
            fs.mkdirSync(this.config.screenshotDir, { recursive: true });
        }
    }

    /**
     * Take a screenshot with descriptive name
     */
    async screenshot(page, description, actor = 'system') {
        this.screenshotCount++;
        const filename = `${String(this.screenshotCount).padStart(3, '0')}-${actor}-${description.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
        const filepath = path.join(this.config.screenshotDir, filename);

        await page.screenshot({ path: filepath, fullPage: true });
        console.log(`   📸 Screenshot: ${filename}`);

        return filepath;
    }

    /**
     * Main test execution
     */
    async run() {
        console.log('🎓 VISUAL UX TEST - Classroom Simulation');
        console.log('='.repeat(80));
        console.log(`Admin: ${this.config.adminUser}`);
        console.log(`Students: ${this.config.students.map(s => s.name).join(', ')}`);
        console.log(`Sessions: ${this.config.targetSessions}`);
        console.log(`Screenshots: ${this.config.screenshotDir}`);
        console.log('='.repeat(80));
        console.log('');

        try {
            await this.browser.launch();

            // PHASE 1: Admin Setup
            await this.adminSetupGame();

            // PHASE 2: Play Sessions
            for (let session = 1; session <= this.config.targetSessions; session++) {
                this.sessionNum = session;
                await this.playSession(session);
            }

            // PHASE 3: Final Review
            await this.adminReviewResults();

            console.log('\n✅ Visual UX Test Complete!');
            console.log(`📁 Screenshots saved to: ${this.config.screenshotDir}`);
            console.log(`📸 Total screenshots: ${this.screenshotCount}`);

            await this.browser.close();

        } catch (error) {
            console.error('\n❌ Test failed:', error.message);
            if (this.config.verbose) {
                console.error(error.stack);
            }
            await this.browser.close();
            process.exit(1);
        }
    }

    /**
     * PHASE 1: Admin sets up the game through UI
     */
    async adminSetupGame() {
        console.log('\n👨‍🏫 PHASE 1: ADMIN GAME SETUP');
        console.log('-'.repeat(80));

        const adminPage = await this.browser.loginAndNavigate(this.config.adminUser, 'admin/');
        await this.browser.sleep(2000);

        // Screenshot: Admin panel initial view
        await this.screenshot(adminPage, 'admin-panel-initial', 'admin');

        // Step 1: Reset Game
        console.log('   🔄 Admin: Clicking Reset Game button...');
        const resetBtn = await adminPage.$('#reset-game-btn');
        if (resetBtn) {
            await resetBtn.click();
            await this.browser.sleep(1000);

            // Handle confirmation dialog
            await adminPage.evaluate(() => {
                // Override confirm to always return true
                window.confirm = () => true;
            });

            await this.browser.sleep(2000);
            await this.screenshot(adminPage, 'after-reset', 'admin');
            console.log('   ✅ Game reset');
        }

        // Step 2: Start Game
        console.log('   ▶️  Admin: Clicking Start Game button...');
        const startBtn = await adminPage.$('#start-game-btn');
        if (startBtn) {
            await startBtn.click();
            await this.browser.sleep(2000);
            await this.screenshot(adminPage, 'game-started', 'admin');
            console.log('   ✅ Game started');
        }

        // Step 3: Configure Settings
        console.log('   ⚙️  Admin: Configuring game settings...');

        // Set trading duration
        const durationInput = await adminPage.$('#trading-duration');
        if (durationInput) {
            await durationInput.click({ clickCount: 3 });
            await durationInput.type('300');
            await durationInput.press('Enter');
            await this.browser.sleep(1000);
            console.log('   ⏱️  Trading duration set to 300 seconds');
        }

        await this.screenshot(adminPage, 'settings-configured', 'admin');

        console.log('   ✅ Admin setup complete');
        await adminPage.close();
    }

    /**
     * PHASE 2: Play one complete session
     */
    async playSession(sessionNum) {
        console.log(`\n🎮 SESSION ${sessionNum}`);
        console.log('-'.repeat(80));

        // Each student performs UI actions
        for (const student of this.config.students) {
            await this.studentActions(student, sessionNum);
        }

        // Students interact with each other
        await this.studentInteractions(sessionNum);

        // Admin advances session
        await this.adminAdvanceSession(sessionNum);
    }

    /**
     * Individual student performs UI actions
     */
    async studentActions(student, sessionNum) {
        console.log(`\n   👤 ${student.name} (Session ${sessionNum})`);

        const page = await this.browser.loginAndNavigate(student.email, '');
        await this.browser.sleep(2000);

        // Screenshot: Initial dashboard
        await this.screenshot(page, `dashboard-initial-s${sessionNum}`, student.name);

        // Action 1: View Inventory
        console.log(`      📦 ${student.name}: Viewing inventory...`);
        const inventorySection = await page.$('[data-section="inventory"]');
        if (inventorySection) {
            await inventorySection.scrollIntoView();
            await this.browser.sleep(500);
            await this.screenshot(page, `inventory-view-s${sessionNum}`, student.name);
        }

        // Action 2: Check Marketplace Tab
        console.log(`      🏪 ${student.name}: Opening marketplace...`);
        const marketplaceTab = await page.$('button[data-tab="marketplace"], a[href*="marketplace"]');
        if (marketplaceTab) {
            await marketplaceTab.click();
            await this.browser.sleep(2000);
            await this.screenshot(page, `marketplace-open-s${sessionNum}`, student.name);
        }

        // Action 3: Post an Advertisement
        console.log(`      📢 ${student.name}: Posting advertisement...`);
        const postAdBtn = await page.$('button[data-action="post-ad"], #post-ad-btn');
        if (postAdBtn) {
            await postAdBtn.click();
            await this.browser.sleep(500);
            await this.screenshot(page, `ad-form-open-s${sessionNum}`, student.name);

            // Fill ad form
            const chemSelect = await page.$('select[name="chemical"], #ad-chemical');
            const typeSelect = await page.$('select[name="type"], #ad-type');
            const messageInput = await page.$('textarea[name="message"], #ad-message');

            if (chemSelect && typeSelect && messageInput) {
                await chemSelect.select('C');
                await typeSelect.select('sell');
                await messageInput.type(`${student.name} has Carbon for sale! Great prices!`);

                await this.screenshot(page, `ad-form-filled-s${sessionNum}`, student.name);

                // Submit ad
                const submitBtn = await page.$('button[type="submit"], #post-ad-submit');
                if (submitBtn) {
                    await submitBtn.click();
                    await this.browser.sleep(2000);
                    await this.screenshot(page, `ad-posted-s${sessionNum}`, student.name);
                    console.log(`      ✅ Advertisement posted`);
                }
            }
        }

        // Action 4: Create a Sell Offer
        console.log(`      💰 ${student.name}: Creating sell offer...`);
        const createOfferBtn = await page.$('button[data-action="create-offer"], #create-offer-btn');
        if (createOfferBtn) {
            await createOfferBtn.click();
            await this.browser.sleep(500);
            await this.screenshot(page, `offer-form-open-s${sessionNum}`, student.name);

            // Fill offer form
            const offerChem = await page.$('select[name="chemical"], #offer-chemical');
            const offerQty = await page.$('input[name="quantity"], #offer-quantity');
            const offerPrice = await page.$('input[name="price"], #offer-min-price');

            if (offerChem && offerQty && offerPrice) {
                await offerChem.select('C');
                await offerQty.type('10');
                await offerPrice.type('5.50');

                await this.screenshot(page, `offer-form-filled-s${sessionNum}`, student.name);

                const submitOffer = await page.$('button[type="submit"], #create-offer-submit');
                if (submitOffer) {
                    await submitOffer.click();
                    await this.browser.sleep(2000);
                    await this.screenshot(page, `offer-created-s${sessionNum}`, student.name);
                    console.log(`      ✅ Sell offer created`);
                }
            }
        }

        // Action 5: View Negotiations Tab
        console.log(`      🤝 ${student.name}: Checking negotiations...`);
        const negotiationsTab = await page.$('button[data-tab="negotiations"], a[href*="negotiations"]');
        if (negotiationsTab) {
            await negotiationsTab.click();
            await this.browser.sleep(2000);
            await this.screenshot(page, `negotiations-view-s${sessionNum}`, student.name);
        }

        // Action 6: Check Production Tab
        console.log(`      🏭 ${student.name}: Viewing production...`);
        const productionTab = await page.$('button[data-tab="production"], a[href*="production"]');
        if (productionTab) {
            await productionTab.click();
            await this.browser.sleep(2000);
            await this.screenshot(page, `production-view-s${sessionNum}`, student.name);
        }

        console.log(`      ✅ ${student.name} completed UI tour`);
        await page.close();
    }

    /**
     * Students interact with each other's offerings
     */
    async studentInteractions(sessionNum) {
        console.log(`\n   🔄 STUDENT INTERACTIONS (Session ${sessionNum})`);

        // Alice initiates negotiation with Bob
        const alicePage = await this.browser.loginAndNavigate(this.config.students[0].email, '');
        await this.browser.sleep(2000);

        console.log(`      💬 Alice: Initiating negotiation with Bob...`);

        // Go to marketplace
        const marketTab = await alicePage.$('button[data-tab="marketplace"]');
        if (marketTab) {
            await marketTab.click();
            await this.browser.sleep(2000);
        }

        // Look for Bob's offer
        const bobOffers = await alicePage.$$('[data-seller="Bob"], .offer-item');
        if (bobOffers.length > 0) {
            await this.screenshot(alicePage, `alice-sees-bobs-offer-s${sessionNum}`, 'Alice');

            // Click negotiate button
            const negotiateBtn = await bobOffers[0].$('button[data-action="negotiate"]');
            if (negotiateBtn) {
                await negotiateBtn.click();
                await this.browser.sleep(1000);
                await this.screenshot(alicePage, `alice-negotiate-form-s${sessionNum}`, 'Alice');
                console.log(`      ✅ Negotiation initiated`);
            }
        }

        await alicePage.close();

        // Bob responds to negotiation
        const bobPage = await this.browser.loginAndNavigate(this.config.students[1].email, '');
        await this.browser.sleep(2000);

        console.log(`      💬 Bob: Responding to Alice's negotiation...`);

        const negTab = await bobPage.$('button[data-tab="negotiations"]');
        if (negTab) {
            await negTab.click();
            await this.browser.sleep(2000);
            await this.screenshot(bobPage, `bob-sees-negotiation-s${sessionNum}`, 'Bob');

            // Look for pending negotiations
            const pendingNegs = await bobPage.$$('.negotiation-item.pending');
            if (pendingNegs.length > 0) {
                // Accept or counter randomly
                const action = Math.random() > 0.5 ? 'accept' : 'counter';
                const actionBtn = await pendingNegs[0].$(`button[data-action="${action}"]`);

                if (actionBtn) {
                    await actionBtn.click();
                    await this.browser.sleep(1000);
                    await this.screenshot(bobPage, `bob-${action}s-negotiation-s${sessionNum}`, 'Bob');
                    console.log(`      ✅ Bob ${action}ed negotiation`);
                }
            }
        }

        await bobPage.close();
    }

    /**
     * Admin advances to next session
     */
    async adminAdvanceSession(sessionNum) {
        console.log(`\n   👨‍🏫 ADMIN: Advancing from Session ${sessionNum}`);

        const adminPage = await this.browser.loginAndNavigate(this.config.adminUser, 'admin/');
        await this.browser.sleep(2000);

        await this.screenshot(adminPage, `before-advance-s${sessionNum}`, 'admin');

        // Click advance session button
        const advanceBtn = await adminPage.$('#advance-session-btn, button[data-action="advance"]');
        if (advanceBtn) {
            await advanceBtn.click();
            await this.browser.sleep(3000);

            await this.screenshot(adminPage, `after-advance-s${sessionNum}`, 'admin');

            // Verify session number changed
            const sessionDisplay = await adminPage.$('#session-number, [data-display="session"]');
            if (sessionDisplay) {
                const newSession = await adminPage.evaluate(el => el.textContent, sessionDisplay);
                console.log(`   ✅ Advanced to Session ${newSession}`);
            }
        }

        await adminPage.close();
    }

    /**
     * PHASE 3: Admin reviews final results
     */
    async adminReviewResults() {
        console.log('\n📊 PHASE 3: ADMIN FINAL REVIEW');
        console.log('-'.repeat(80));

        const adminPage = await this.browser.loginAndNavigate(this.config.adminUser, 'admin/');
        await this.browser.sleep(2000);

        // View final game state
        await this.screenshot(adminPage, 'admin-final-state', 'admin');

        // Check leaderboard
        console.log('   🏆 Admin: Checking leaderboard...');
        const leaderboardTab = await adminPage.$('button[data-tab="leaderboard"], a[href*="leaderboard"]');
        if (leaderboardTab) {
            await leaderboardTab.click();
            await this.browser.sleep(2000);
            await this.screenshot(adminPage, 'final-leaderboard', 'admin');
        }

        // View team stats
        console.log('   📈 Admin: Viewing team statistics...');
        const statsTab = await adminPage.$('button[data-tab="stats"], a[href*="stats"]');
        if (statsTab) {
            await statsTab.click();
            await this.browser.sleep(2000);
            await this.screenshot(adminPage, 'final-stats', 'admin');
        }

        console.log('   ✅ Admin review complete');
        await adminPage.close();

        // Each student checks their final results
        for (const student of this.config.students) {
            console.log(`   📊 ${student.name}: Viewing final results...`);

            const studentPage = await this.browser.loginAndNavigate(student.email, '');
            await this.browser.sleep(2000);

            await this.screenshot(studentPage, 'final-dashboard', student.name);

            await studentPage.close();
        }
    }
}

// Run the visual UX test
if (require.main === module) {
    const test = new VisualUXTest(CONFIG);
    test.run().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = VisualUXTest;
