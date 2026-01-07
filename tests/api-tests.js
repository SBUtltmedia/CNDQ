/**
 * Comprehensive API Test Suite
 *
 * Tests all CNDQ API endpoints using Puppeteer and the ApiClient helper.
 * This ensures APIs work correctly with real browser sessions and cookies.
 *
 * Usage:
 *   node tests/api-tests.js
 *   node tests/api-tests.js --verbose
 *   node tests/api-tests.js --headless
 */

const BrowserHelper = require('./helpers/browser');
const ApiClient = require('./helpers/api-client');

// Configuration
const CONFIG = {
    baseUrl: 'http://cndq.test/CNDQ',
    adminUser: 'admin@stonybrook.edu',
    testUsers: [
        'test_mail1@stonybrook.edu',
        'test_mail2@stonybrook.edu',
        'test_mail3@stonybrook.edu'
    ],
    headless: process.argv.includes('--headless'),
    verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
    keepOpen: process.argv.includes('--keep-open')
};

class ApiTestSuite {
    constructor(config) {
        this.config = config;
        this.browser = new BrowserHelper(config);
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            tests: []
        };
    }

    /**
     * Run all API tests
     */
    async runAll() {
        console.log('🧪 CNDQ API Test Suite');
        console.log('='.repeat(60));
        console.log(`Base URL: ${this.config.baseUrl}`);
        console.log(`Mode: ${this.config.headless ? 'Headless' : 'Visible'}`);
        console.log('='.repeat(60));
        console.log('');

        try {
            await this.browser.launch();

            // Run test categories in sequence
            await this.testSession();
            await this.testMarketplace();
            await this.testOffers();
            await this.testNegotiations();
            await this.testAdvertisements();
            await this.testNotifications();
            await this.testProduction();
            await this.testLeaderboard();
            await this.testTeamSettings();
            await this.testAdminEndpoints();

            this.printSummary();

            if (!this.config.keepOpen) {
                await this.browser.close();
            } else {
                console.log('\n⏸️  Browser kept open for inspection...');
                await this.browser.keepOpen();
            }
        } catch (error) {
            console.error('\n❌ Fatal error:', error.message);
            if (this.config.verbose) {
                console.error(error.stack);
            }
            await this.browser.close();
            process.exit(1);
        }

        // Exit with appropriate code
        process.exit(this.results.failed > 0 ? 1 : 0);
    }

    /**
     * Test runner utility
     */
    async test(name, testFn) {
        this.results.total++;
        const testNum = this.results.total;
        const prefix = `[${testNum}/${this.results.total}]`;

        try {
            process.stdout.write(`${prefix} ${name} ... `);
            await testFn();
            console.log('✅ PASS');
            this.results.passed++;
            this.results.tests.push({ name, status: 'passed' });
        } catch (error) {
            console.log('❌ FAIL');
            console.log(`   Error: ${error.message}`);
            if (this.config.verbose && error.stack) {
                console.log(`   ${error.stack.split('\n').slice(1, 3).join('\n   ')}`);
            }
            this.results.failed++;
            this.results.tests.push({ name, status: 'failed', error: error.message });
        }
    }

    /**
     * SESSION TESTS
     */
    async testSession() {
        console.log('\n📡 Testing Session Endpoints');
        console.log('-'.repeat(60));

        // Test public endpoint (no auth required)
        await this.test('GET /api/session/status (public)', async () => {
            const page = await this.browser.newPage();
            const api = new ApiClient(page, this.config.baseUrl);

            // Navigate to a page first to establish origin
            await page.goto(this.config.baseUrl, { waitUntil: 'networkidle2' });

            const response = await api.getSessionStatus();
            if (!response.ok) throw new Error(`Status ${response.status}`);
            if (!response.data.success) throw new Error('Response not successful');
            if (typeof response.data.session !== 'number') throw new Error('Missing session number');
            if (!['TRADING', 'PRODUCTION', 'STOPPED'].includes(response.data.phase)) {
                throw new Error(`Invalid phase: ${response.data.phase}`);
            }

            await page.close();
        });

        // Test with authentication
        await this.test('GET /api/session/status (authenticated)', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.getSessionStatus();
            api.assertSuccess(response);
            api.assertData(response, 'success', true);
            api.assertData(response, 'session');
            api.assertData(response, 'phase');

            await page.close();
        });

        await this.test('POST /api/session/status (acknowledge production)', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.acknowledgeProduction();
            api.assertSuccess(response);

            await page.close();
        });
    }

    /**
     * MARKETPLACE TESTS
     */
    async testMarketplace() {
        console.log('\n🏪 Testing Marketplace Endpoints');
        console.log('-'.repeat(60));

        await this.test('GET /api/marketplace/offers', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.getMarketplaceOffers();
            api.assertSuccess(response);
            api.assertData(response, 'success', true);
            api.assertData(response, 'offersByChemical');
            api.assertData(response, 'buyOrdersByChemical');

            await page.close();
        });

        await this.test('GET /api/marketplace/offers?chemical=C', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.getMarketplaceOffers('C');
            api.assertSuccess(response);
            api.assertData(response, 'offersByChemical');

            await page.close();
        });

        await this.test('GET /api/marketplace/offers?chemical=C,N', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.getMarketplaceOffers('C,N');
            api.assertSuccess(response);

            await page.close();
        });

        await this.test('GET /api/marketplace/offers (unauthenticated)', async () => {
            const page = await this.browser.newPage();
            await page.goto(this.config.baseUrl, { waitUntil: 'networkidle2' });
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.getMarketplaceOffers();
            api.assertStatus(response, 401, 'Should return 401 for unauthenticated users');

            await page.close();
        });
    }

    /**
     * OFFERS TESTS
     */
    async testOffers() {
        console.log('\n💰 Testing Offers Endpoints');
        console.log('-'.repeat(60));

        await this.test('POST /api/offers/create (valid offer)', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            // First check if trading is allowed
            const status = await api.getSessionStatus();
            if (status.data.phase !== 'TRADING') {
                throw new Error('SKIPPED: Trading not allowed in current phase');
            }

            const response = await api.createOffer('C', 10, 5.0);

            // Could be 200 (success) or 400 (insufficient inventory)
            if (response.status === 400 && response.data.error === 'Insufficient inventory') {
                // This is acceptable - user doesn't have inventory
                return;
            }

            api.assertSuccess(response);
            api.assertData(response, 'success', true);
            api.assertData(response, 'offer');

            await page.close();
        });

        await this.test('POST /api/offers/create (invalid chemical)', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.createOffer('X', 10, 5.0);
            api.assertStatus(response, 400, 'Should reject invalid chemical');

            await page.close();
        });

        await this.test('POST /api/offers/create (negative quantity)', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.createOffer('C', -10, 5.0);
            api.assertStatus(response, 400, 'Should reject negative quantity');

            await page.close();
        });

        await this.test('POST /api/offers/create (missing fields)', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.post('offers/create', { chemical: 'C' });
            api.assertStatus(response, 400, 'Should reject missing fields');

            await page.close();
        });

        await this.test('POST /api/offers/bid (valid buy order)', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            // Check if trading is allowed
            const status = await api.getSessionStatus();
            if (status.data.phase !== 'TRADING') {
                throw new Error('SKIPPED: Trading not allowed');
            }

            const response = await api.createBuyOrder('N', 5, 10.0);

            // Could be 200 (success) or 400 (insufficient funds)
            if (response.status === 400) {
                // Acceptable - might not have funds
                return;
            }

            api.assertSuccess(response);

            await page.close();
        });
    }

    /**
     * NEGOTIATIONS TESTS
     */
    async testNegotiations() {
        console.log('\n🤝 Testing Negotiations Endpoints');
        console.log('-'.repeat(60));

        await this.test('GET /api/negotiations/list', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.listNegotiations();
            api.assertSuccess(response);
            api.assertData(response, 'success', true);
            api.assertData(response, 'negotiations');

            await page.close();
        });

        await this.test('POST /api/negotiations/initiate (valid)', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            // Check if trading is allowed
            const status = await api.getSessionStatus();
            if (status.data.phase !== 'TRADING') {
                throw new Error('SKIPPED: Trading not allowed');
            }

            const response = await api.initiateNegotiation(
                this.config.testUsers[1], // responderId
                'C',    // chemical
                10,     // quantity
                5.50,   // price
                'buy'   // type
            );

            api.assertSuccess(response);
            api.assertData(response, 'negotiation');

            await page.close();
        });

        await this.test('POST /api/negotiations/initiate (negotiate with self)', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.initiateNegotiation(
                this.config.testUsers[0], // Same user!
                'C',
                10,
                5.50,
                'buy'
            );

            api.assertStatus(response, 400, 'Should reject negotiating with self');

            await page.close();
        });

        await this.test('POST /api/negotiations/initiate (invalid chemical)', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.initiateNegotiation(
                this.config.testUsers[1],
                'Z', // Invalid!
                10,
                5.50,
                'buy'
            );

            api.assertStatus(response, 400);

            await page.close();
        });

        await this.test('POST /api/negotiations/react (emoji reaction)', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            // Try to react to a non-existent negotiation (should fail gracefully)
            const response = await api.reactToNegotiation('fake-id', '👍');

            // Could be 400 (not found) or 500 (error) - both acceptable
            if (response.ok) {
                throw new Error('Should not succeed with fake ID');
            }

            await page.close();
        });
    }

    /**
     * ADVERTISEMENTS TESTS
     */
    async testAdvertisements() {
        console.log('\n📢 Testing Advertisements Endpoints');
        console.log('-'.repeat(60));

        await this.test('GET /api/advertisements/list', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.listAdvertisements();
            api.assertSuccess(response);
            api.assertData(response, 'advertisements');

            await page.close();
        });

        await this.test('GET /api/advertisements/my-ads', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.getMyAdvertisements();
            api.assertSuccess(response);

            await page.close();
        });

        await this.test('POST /api/advertisements/post (valid)', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            // Check if trading is allowed
            const status = await api.getSessionStatus();
            if (status.data.phase !== 'TRADING') {
                throw new Error('SKIPPED: Trading not allowed');
            }

            const response = await api.postAdvertisement(
                'C',
                'sell',
                'Looking to sell Carbon at great prices!'
            );

            api.assertSuccess(response);

            await page.close();
        });

        await this.test('POST /api/advertisements/post (invalid type)', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.postAdvertisement(
                'C',
                'invalid-type',
                'Test message'
            );

            api.assertStatus(response, 400);

            await page.close();
        });
    }

    /**
     * NOTIFICATIONS TESTS
     */
    async testNotifications() {
        console.log('\n🔔 Testing Notifications Endpoints');
        console.log('-'.repeat(60));

        await this.test('GET /api/notifications/list', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.listNotifications();
            api.assertSuccess(response);
            api.assertData(response, 'notifications');

            await page.close();
        });
    }

    /**
     * PRODUCTION TESTS
     */
    async testProduction() {
        console.log('\n🏭 Testing Production Endpoints');
        console.log('-'.repeat(60));

        await this.test('GET /api/production/results', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.getProductionResults();
            api.assertSuccess(response);

            await page.close();
        });

        await this.test('GET /api/production/shadow-prices', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.getShadowPrices();
            api.assertSuccess(response);
            api.assertData(response, 'shadowPrices');

            await page.close();
        });
    }

    /**
     * LEADERBOARD TESTS
     */
    async testLeaderboard() {
        console.log('\n🏆 Testing Leaderboard Endpoints');
        console.log('-'.repeat(60));

        await this.test('GET /api/leaderboard/standings', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.getLeaderboard();
            api.assertSuccess(response);
            api.assertData(response, 'standings');

            await page.close();
        });
    }

    /**
     * TEAM SETTINGS TESTS
     */
    async testTeamSettings() {
        console.log('\n⚙️  Testing Team Settings Endpoints');
        console.log('-'.repeat(60));

        await this.test('GET /api/team/settings', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.getTeamSettings();
            api.assertSuccess(response);

            await page.close();
        });

        await this.test('POST /api/team/settings (update team name)', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.updateTeamSettings({
                teamName: 'Test Team Alpha'
            });

            api.assertSuccess(response);

            await page.close();
        });
    }

    /**
     * ADMIN ENDPOINTS TESTS
     */
    async testAdminEndpoints() {
        console.log('\n🛡️  Testing Admin Endpoints');
        console.log('-'.repeat(60));

        await this.test('GET /api/admin/session (as admin)', async () => {
            const page = await this.browser.loginAndNavigate(this.config.adminUser, '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.getAdminSession();
            api.assertSuccess(response);

            await page.close();
        });

        await this.test('GET /api/admin/session (as regular user)', async () => {
            const page = await this.browser.loginAndNavigate(this.config.testUsers[0], '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.getAdminSession();
            api.assertStatus(response, 403, 'Regular users should be forbidden');

            await page.close();
        });

        await this.test('GET /api/admin/npc/list', async () => {
            const page = await this.browser.loginAndNavigate(this.config.adminUser, '');
            const api = new ApiClient(page, this.config.baseUrl);

            const response = await api.listNPCs();
            api.assertSuccess(response);

            await page.close();
        });
    }

    /**
     * Print test summary
     */
    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 Test Summary');
        console.log('='.repeat(60));
        console.log(`Total Tests:  ${this.results.total}`);
        console.log(`✅ Passed:     ${this.results.passed} (${Math.round(this.results.passed / this.results.total * 100)}%)`);
        console.log(`❌ Failed:     ${this.results.failed}`);
        console.log(`⏭️  Skipped:    ${this.results.skipped}`);
        console.log('='.repeat(60));

        if (this.results.failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.results.tests
                .filter(t => t.status === 'failed')
                .forEach(t => console.log(`   - ${t.name}: ${t.error}`));
        }

        console.log('');
    }
}

// Run the test suite
if (require.main === module) {
    const suite = new ApiTestSuite(CONFIG);
    suite.runAll().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = ApiTestSuite;
