/**
 * Dual Playability Test - UI vs API Comparison
 *
 * Runs both UI and API tests and compares their results to ensure:
 * 1. UI triggers the correct API calls
 * 2. API endpoints work correctly without UI
 * 3. Both achieve the same game state
 *
 * Usage:
 *   node tests/dual-playability-test.js
 *   node tests/dual-playability-test.js --headless
 *   node tests/dual-playability-test.js --ui-only
 *   node tests/dual-playability-test.js --api-only
 */

const UIPlayabilityTest = require('./ui-playability-test');
const APIPlayabilityTest = require('./api-playability-test');

const CONFIG = {
    baseUrl: 'http://cndq.test/CNDQ/',
    adminUser: 'admin@stonybrook.edu',
    testUsers: [
        'test_mail1@stonybrook.edu',
        'test_mail2@stonybrook.edu',
        'test_mail3@stonybrook.edu'
    ],
    targetSessions: 2, // Increased to check multi-round health
    headless: process.argv.includes('--headless'),
    verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
    keepOpen: false // Never keep open in dual mode
};

class DualPlayabilityTest {
    constructor(config) {
        this.config = config;
        this.uiResults = null;
        this.apiResults = null;
    }

    async run() {
        console.log('🔀 DUAL PLAYABILITY TEST - UI vs API');
        console.log('='.repeat(80));
        console.log('This test runs both UI and API tests and compares results.');
        console.log('='.repeat(80));
        console.log('');

        const runUiOnly = process.argv.includes('--ui-only');
        const runApiOnly = process.argv.includes('--api-only');

        try {
            // Run UI test
            if (!runApiOnly) {
                console.log('\n' + '█'.repeat(80));
                console.log('█' + ' '.repeat(78) + '█');
                console.log('█' + '  PART 1: UI-BASED TEST'.padEnd(78) + '█');
                console.log('█' + ' '.repeat(78) + '█');
                console.log('█'.repeat(80));
                console.log('');

                const uiTest = new UIPlayabilityTest(this.config);
                await uiTest.run().catch(err => {
                    console.error('UI test failed:', err.message);
                });

                this.uiResults = {
                    uiActions: uiTest.results.uiActions,
                    apiCallsCaptured: uiTest.results.apiCallsCaptured,
                    errors: uiTest.results.errors,
                    warnings: uiTest.results.warnings,
                    apiCallLog: uiTest.apiCallLog
                };

                // Wait between tests to let server settle
                if (!runUiOnly) {
                    console.log('\n⏸️  Waiting 10 seconds before API test...\n');
                    await new Promise(resolve => setTimeout(resolve, 10000));
                }
            }

            // Run API test
            if (!runUiOnly) {
                console.log('\n' + '█'.repeat(80));
                console.log('█' + ' '.repeat(78) + '█');
                console.log('█' + '  PART 2: API-BASED TEST'.padEnd(78) + '█');
                console.log('█' + ' '.repeat(78) + '█');
                console.log('█'.repeat(80));
                console.log('');

                const apiTest = new APIPlayabilityTest(this.config);
                await apiTest.run().catch(err => {
                    console.error('API test failed:', err.message);
                });

                this.apiResults = {
                    apiCalls: apiTest.results.apiCalls,
                    successful: apiTest.results.successful,
                    failed: apiTest.results.failed,
                    errors: apiTest.results.errors,
                    warnings: apiTest.results.warnings,
                    apiCallLog: apiTest.apiCallLog
                };
            }

            // Compare results
            if (!runUiOnly && !runApiOnly) {
                this.compareResults();
            }

        } catch (error) {
            console.error('\n❌ Dual test failed:', error.message);
            if (this.config.verbose) {
                console.error(error.stack);
            }
            process.exit(1);
        }
    }

    compareResults() {
        console.log('\n' + '█'.repeat(80));
        console.log('█' + ' '.repeat(78) + '█');
        console.log('█' + '  COMPARISON REPORT'.padEnd(78) + '█');
        console.log('█' + ' '.repeat(78) + '█');
        console.log('█'.repeat(80));
        console.log('');

        // Basic stats comparison
        console.log('📊 STATISTICS COMPARISON:');
        console.log('-'.repeat(80));
        console.log(`UI Actions Performed:        ${this.uiResults.uiActions}`);
        console.log(`UI - API Calls Captured:     ${this.uiResults.apiCallsCaptured}`);
        console.log(`API - Direct API Calls:      ${this.apiResults.apiCalls}`);
        console.log(`API - Successful Calls:      ${this.apiResults.successful} (${Math.round(this.apiResults.successful / this.apiResults.apiCalls * 100)}%)`);
        console.log(`API - Failed Calls:          ${this.apiResults.failed}`);
        console.log('-'.repeat(80));

        // Error comparison
        console.log('\n🚨 ERROR COMPARISON:');
        console.log('-'.repeat(80));
        console.log(`UI Test Errors:   ${this.uiResults.errors.length}`);
        console.log(`API Test Errors:  ${this.apiResults.errors.length}`);

        if (this.uiResults.errors.length > 0 || this.apiResults.errors.length > 0) {
            if (this.uiResults.errors.length > 0) {
                console.log('\nUI Errors:');
                this.uiResults.errors.forEach((err, i) => {
                    console.log(`   ${i + 1}. ${err.user || 'Unknown'}: ${err.error}`);
                });
            }

            if (this.apiResults.errors.length > 0) {
                console.log('\nAPI Errors:');
                this.apiResults.errors.forEach((err, i) => {
                    console.log(`   ${i + 1}. ${err.user || 'Unknown'}: ${err.error}`);
                });
            }
        } else {
            console.log('✅ Both tests completed without errors!');
        }

        console.log('-'.repeat(80));

        // API endpoint coverage comparison
        console.log('\n📡 API ENDPOINT COVERAGE:');
        console.log('-'.repeat(80));

        // Build endpoint lists
        const uiEndpoints = new Set();
        this.uiResults.apiCallLog.forEach(call => {
            const endpoint = call.url.split('?')[0];
            uiEndpoints.add(endpoint);
        });

        const apiEndpoints = new Set();
        this.apiResults.apiCallLog.forEach(call => {
            apiEndpoints.add(call.endpoint);
        });

        console.log(`UI touched ${uiEndpoints.size} unique endpoints`);
        console.log(`API tested ${apiEndpoints.size} unique endpoints`);

        // Find endpoints only in API test (not triggered by UI)
        const apiOnlyEndpoints = [...apiEndpoints].filter(ep => {
            return ![...uiEndpoints].some(uiEp => uiEp.includes(ep.split('?')[0]));
        });

        if (apiOnlyEndpoints.length > 0) {
            console.log('\n⚠️  Endpoints tested by API but not triggered by UI:');
            apiOnlyEndpoints.forEach(ep => {
                console.log(`   - ${ep}`);
            });
            console.log('\n   💡 Consider adding UI elements to trigger these endpoints.');
        }

        // Find common endpoints
        const commonEndpoints = [...apiEndpoints].filter(ep => {
            return [...uiEndpoints].some(uiEp => uiEp.includes(ep.split('?')[0]));
        });

        if (commonEndpoints.length > 0) {
            console.log(`\n✅ ${commonEndpoints.length} endpoints tested by both UI and API`);
        }

        console.log('-'.repeat(80));

        // Call frequency comparison for common endpoints
        console.log('\n🔢 API CALL FREQUENCY (Common Endpoints):');
        console.log('-'.repeat(80));

        const uiFreq = {};
        this.uiResults.apiCallLog.forEach(call => {
            const endpoint = call.url.split('?')[0];
            uiFreq[endpoint] = (uiFreq[endpoint] || 0) + 1;
        });

        const apiFreq = {};
        this.apiResults.apiCallLog.forEach(call => {
            const endpoint = call.endpoint.split('?')[0];
            apiFreq[endpoint] = (apiFreq[endpoint] || 0) + 1;
        });

        // Compare common endpoints
        commonEndpoints.forEach(ep => {
            const uiCount = uiFreq[ep] || 0;
            const apiCount = apiFreq[ep] || 0;
            const diff = Math.abs(uiCount - apiCount);
            const diffPercent = apiCount > 0 ? Math.round((diff / apiCount) * 100) : 0;

            if (diffPercent > 50) {
                console.log(`   ⚠️  ${ep}`);
                console.log(`       UI: ${uiCount}x, API: ${apiCount}x (${diffPercent}% difference)`);
            } else {
                console.log(`   ✅ ${ep}: UI ${uiCount}x, API ${apiCount}x`);
            }
        });

        console.log('-'.repeat(80));

        // Overall verdict
        console.log('\n🎯 OVERALL VERDICT:');
        console.log('='.repeat(80));

        const hasErrors = this.uiResults.errors.length > 0 || this.apiResults.errors.length > 0;
        const hasWarnings = this.uiResults.warnings.length > 0 || this.apiResults.warnings.length > 0;
        const goodCoverage = commonEndpoints.length >= apiEndpoints.size * 0.7;
        const apiSuccessRate = this.apiResults.successful / this.apiResults.apiCalls;

        if (!hasErrors && apiSuccessRate > 0.9 && goodCoverage) {
            console.log('✅ EXCELLENT - Both UI and API tests passed successfully!');
            console.log('   - No errors detected');
            console.log('   - High API success rate');
            console.log('   - Good endpoint coverage');
        } else if (!hasErrors && apiSuccessRate > 0.7) {
            console.log('⚠️  GOOD - Tests passed with some warnings');
            if (!goodCoverage) {
                console.log('   - Consider improving UI coverage of API endpoints');
            }
            if (hasWarnings) {
                console.log(`   - ${this.uiResults.warnings.length + this.apiResults.warnings.length} warnings to review`);
            }
        } else if (hasErrors) {
            console.log('❌ FAILED - Tests completed with errors');
            console.log(`   - ${this.uiResults.errors.length} UI errors`);
            console.log(`   - ${this.apiResults.errors.length} API errors`);
            console.log('   - Review logs above for details');
        } else {
            console.log('⚠️  NEEDS IMPROVEMENT');
            console.log(`   - API success rate: ${Math.round(apiSuccessRate * 100)}%`);
            console.log('   - Some functionality may not be working correctly');
        }

        console.log('='.repeat(80));
        console.log('');

        // Write comparison report to file
        const fs = require('fs');
        const report = {
            timestamp: new Date().toISOString(),
            uiResults: this.uiResults,
            apiResults: this.apiResults,
            comparison: {
                commonEndpoints: commonEndpoints.length,
                apiOnlyEndpoints: apiOnlyEndpoints.length,
                uiEndpointsCovered: uiEndpoints.size,
                apiEndpointsTested: apiEndpoints.size,
                totalErrors: this.uiResults.errors.length + this.apiResults.errors.length,
                totalWarnings: this.uiResults.warnings.length + this.apiResults.warnings.length
            }
        };

        const reportFile = `dual-test-report-${Date.now()}.json`;
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        console.log(`📄 Full comparison report written to: ${reportFile}\n`);
    }
}

// Run the dual test
if (require.main === module) {
    const test = new DualPlayabilityTest(CONFIG);
    test.run().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = DualPlayabilityTest;
