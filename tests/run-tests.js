#!/usr/bin/env node
/**
 * CNDQ Test Runner
 *
 * Main orchestrator for running all tests or individual test suites
 *
 * Usage:
 *   node tests/run-tests.js                    # Run all tests
 *   node tests/run-tests.js game               # Game simulation only
 *   node tests/run-tests.js components         # Components only
 *   node tests/run-tests.js accessibility      # Accessibility only (axe-core)
 *   node tests/run-tests.js lighthouse         # Lighthouse audit
 *
 * Options:
 *   --headless         # Run headless (faster)
 *   --keep-open        # Keep browser open after tests
 *   --skip-reset       # Skip game reset (continue from current state)
 *   --verbose          # Show detailed browser logs
 */

const GameSimulation = require('./game-simulation');
const ComponentTest = require('./components');
const AccessibilityTest = require('./accessibility');
const LighthouseTest = require('./lighthouse');
const BrowserHelper = require('./helpers/browser');
const ReportingHelper = require('./helpers/reporting');

// Configuration
const CONFIG = {
    baseUrl: 'http://cndq.test/CNDQ',
    teams: [
        'test_mail1@stonybrook.edu',
        'test_mail2@stonybrook.edu',
        'test_mail3@stonybrook.edu'
    ],
    targetSessions: 2,
    headless: process.argv.includes('--headless'),
    verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
    keepOpen: process.argv.includes('--keep-open'),
    skipReset: process.argv.includes('--skip-reset'),  // Skip game reset before tests

    // Accessibility config
    wcagLevel: 'AA',
    standards: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
    outputDir: './accessibility-reports',
    pages: [
        { name: 'Main Page', url: '/' },
        { name: 'Admin Page', url: '/admin/' }
    ],
    themes: ['dark', 'light', 'high-contrast']
};

class TestRunner {
    constructor(config) {
        this.config = config;
        this.results = {};
    }

    async run() {
        const args = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
        const testType = args[0] || 'all';

        ReportingHelper.printHeader('CNDQ Test Suite');
        console.log(`Test Type: ${testType}`);
        console.log(`Mode: ${this.config.headless ? 'Headless' : 'Visible Browser'}`);
        console.log(`Base URL: ${this.config.baseUrl}\n`);

        const startTime = Date.now();

        try {
            switch (testType.toLowerCase()) {
                case 'game':
                case 'simulation':
                    await this.runGameSimulation();
                    break;

                case 'robust':
                    await this.runRobustGameSimulation();
                    break;

                case 'components':
                case 'component':
                    await this.runComponentTest();
                    break;

                case 'accessibility':
                case 'a11y':
                    await this.runAccessibilityTest();
                    break;

                case 'lighthouse':
                    await this.runLighthouseTest();
                    break;

                case 'all':
                default:
                    await this.runAllTests();
                    break;
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            this.printFinalSummary(duration);

        } catch (error) {
            ReportingHelper.printError(`Test execution failed: ${error.message}`);
            console.error(error.stack);
            process.exit(1);
        }
    }

    async runRobustGameSimulation() {
        ReportingHelper.printSection('🚀', 'Running Robust Game Simulation Test');

        const browserHelper = new BrowserHelper(this.config);
        
        try {
            const RobustGameSimulation = require('./robust-game-simulation');
            const test = new RobustGameSimulation(this.config);
            this.results.robustGameSimulation = await test.run();
        } finally {
            if (!this.config.keepOpen) {
                // The test itself should handle browser closing, but as a fallback:
                if (browserHelper.browser) {
                    await browserHelper.close();
                }
            }
        }
    }

    async runGameSimulation() {
        ReportingHelper.printSection('🎮', 'Running Game Simulation Test');

        const browserHelper = new BrowserHelper(this.config);
        await browserHelper.launch();

        try {
            const test = new GameSimulation(this.config, browserHelper);
            this.results.gameSimulation = await test.run();

            if (this.config.keepOpen) {
                ReportingHelper.printInfo('\n🔍 Browser kept open for inspection. Close manually when done.');
                await browserHelper.keepOpen();
            }
        } finally {
            if (!this.config.keepOpen) {
                await browserHelper.close();
            }
        }
    }

    async runComponentTest() {
        ReportingHelper.printSection('🧩', 'Running Component Test');

        const browserHelper = new BrowserHelper(this.config);
        await browserHelper.launch();

        try {
            const test = new ComponentTest(this.config, browserHelper);
            this.results.components = await test.run();

            if (this.config.keepOpen) {
                ReportingHelper.printInfo('\n🔍 Browser kept open for inspection. Close manually when done.');
                await browserHelper.keepOpen();
            }
        } finally {
            if (!this.config.keepOpen) {
                await browserHelper.close();
            }
        }
    }

    async runAccessibilityTest() {
        ReportingHelper.printSection('♿', 'Running Accessibility Test');

        const browserHelper = new BrowserHelper({ ...this.config, headless: 'new' });
        await browserHelper.launch();

        try {
            const test = new AccessibilityTest(this.config, browserHelper);
            this.results.accessibility = await test.run();
        } finally {
            await browserHelper.close();
        }
    }

    async runLighthouseTest() {
        ReportingHelper.printSection('🏠', 'Running Lighthouse Test');

        const browserHelper = new BrowserHelper({ ...this.config, headless: 'new' });
        await browserHelper.launch();

        try {
            const lighthouseConfig = {
                ...this.config,
                outputDir: './lighthouse-reports',
                minAccessibilityScore: 90
            };
            const test = new LighthouseTest(lighthouseConfig, browserHelper);
            this.results.lighthouse = await test.run();
        } finally {
            await browserHelper.close();
        }
    }

    async runAllTests() {
        ReportingHelper.printInfo('Running all tests in sequence...\n');

        // 1. Component test (fast)
        await this.runComponentTest();
        console.log('\n');

        // 2. Accessibility test with modals (medium)
        await this.runAccessibilityTest();
        console.log('\n');

        // 3. Lighthouse audit (medium-slow)
        await this.runLighthouseTest();
        console.log('\n');

        // 4. Game simulation (slow)
        await this.runGameSimulation();
    }

    printFinalSummary(duration) {
        ReportingHelper.printHeader('Test Summary');

        const testCount = Object.keys(this.results).length;
        let passCount = 0;
        let failCount = 0;

        Object.entries(this.results).forEach(([name, result]) => {
            const status = result.success ? '✓ PASS' : '✗ FAIL';
            const color = result.success ? '\x1b[32m' : '\x1b[31m';
            console.log(`${color}${status}\x1b[0m ${name}`);

            if (result.success) {
                passCount++;
            } else {
                failCount++;
                if (result.error) {
                    console.log(`       Error: ${result.error}`);
                }
                if (result.violations) {
                    console.log(`       Violations: ${result.violations}`);
                }
            }
        });

        console.log(`\nTests run: ${testCount}`);
        console.log(`Passed: ${passCount}`);
        console.log(`Failed: ${failCount}`);
        console.log(`Duration: ${duration}s`);

        if (failCount > 0) {
            ReportingHelper.printError('\n❌ Some tests failed');
            process.exit(1);
        } else {
            ReportingHelper.printSuccess('\n✅ All tests passed!');
            process.exit(0);
        }
    }
}

// Run tests
if (require.main === module) {
    const runner = new TestRunner(CONFIG);
    runner.run().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = TestRunner;
