#!/usr/bin/env node
/**
 * Central Test Controller - Run all CNDQ tests with options
 *
 * This is the single entry point for running all test suites.
 * Each test can be enabled/disabled and configured via CLI options.
 *
 * Usage:
 *   node tests/run-all-tests.js                    # Run all tests
 *   node tests/run-all-tests.js --ui               # UI element + accessibility tests only
 *   node tests/run-all-tests.js --gameplay         # Gameplay/ROI tests only
 *   node tests/run-all-tests.js --a11y             # Accessibility tests only
 *   node tests/run-all-tests.js --visual           # Visual regression tests only
 *   node tests/run-all-tests.js --ui --gameplay    # Multiple test suites
 *
 * Global Options:
 *   --headless     Run browsers in headless mode
 *   --verbose      Verbose output for all tests
 *   --fail-fast    Stop on first test failure
 *
 * Gameplay-specific Options:
 *   --ui-only      Gameplay: UI tests only (no API)
 *   --api-only     Gameplay: API tests only (no UI)
 *   --npcs <n>     Number of NPCs (default: 6)
 *   --duration <m> Trading duration in minutes
 *
 * UI-specific Options:
 *   --a11y-only    UI: Skip interaction tests
 *   --ui-only      UI: Skip accessibility tests
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const TESTS = {
    ui: {
        name: 'UI & Accessibility',
        file: 'comprehensive-ui-test.js',
        description: 'Tests all interactive elements and accessibility compliance',
        passThrough: ['--headless', '--verbose', '--a11y-only', '--ui-only']
    },
    gameplay: {
        name: 'Gameplay & ROI',
        file: 'dual-playability-test.js',
        description: 'Tests trading mechanics and validates ROI-based pass criteria',
        passThrough: ['--headless', '--verbose', '--ui-only', '--api-only', '--npcs', '--duration', '--skill']
    },
    visual: {
        name: 'Visual Regression',
        file: 'visual-regression-test.js',
        description: 'Captures screenshots and compares against baselines',
        passThrough: ['--headless', '--update-baselines']
    },
    accessibility: {
        name: 'Lighthouse Accessibility',
        file: 'accessibility.js',
        description: 'Runs Lighthouse accessibility audit',
        passThrough: ['--headless']
    }
};

class TestController {
    constructor() {
        this.args = process.argv.slice(2);
        this.config = this.parseArgs();
        this.results = [];
    }

    parseArgs() {
        const config = {
            tests: [],
            headless: this.args.includes('--headless'),
            verbose: this.args.includes('--verbose') || this.args.includes('-v'),
            failFast: this.args.includes('--fail-fast'),
            help: this.args.includes('--help') || this.args.includes('-h')
        };

        // Determine which tests to run
        if (this.args.includes('--ui')) config.tests.push('ui');
        if (this.args.includes('--gameplay')) config.tests.push('gameplay');
        if (this.args.includes('--visual')) config.tests.push('visual');
        if (this.args.includes('--a11y') || this.args.includes('--accessibility')) config.tests.push('accessibility');

        // If no specific tests requested, run essential ones (ui + gameplay)
        if (config.tests.length === 0 && !config.help) {
            config.tests = ['ui', 'gameplay'];
        }

        return config;
    }

    showHelp() {
        console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                     CNDQ CENTRAL TEST CONTROLLER                             ║
╚══════════════════════════════════════════════════════════════════════════════╝

USAGE:
  node tests/run-all-tests.js [test-flags] [options]

TEST FLAGS (pick one or more, default: --ui --gameplay):
  --ui              UI element interactions + accessibility tests
  --gameplay        Gameplay/trading mechanics + ROI validation
  --visual          Visual regression screenshot comparison
  --a11y            Lighthouse accessibility audit

GLOBAL OPTIONS:
  --headless        Run browsers without visible window
  --verbose, -v     Show detailed output
  --fail-fast       Stop immediately on first test failure
  --help, -h        Show this help message

PASS-THROUGH OPTIONS (forwarded to specific tests):
  --a11y-only       [ui] Skip interaction tests, only run accessibility
  --ui-only         [ui/gameplay] Skip API tests in gameplay, or a11y in UI
  --api-only        [gameplay] Skip UI tests, only run API validation
  --npcs <n>        [gameplay] Number of NPC traders (default: 6)
  --duration <min>  [gameplay] Trading duration in minutes
  --skill <level>   [gameplay] NPC skill level (novice/intermediate/expert)

EXAMPLES:
  node tests/run-all-tests.js                     # Run UI + Gameplay tests
  node tests/run-all-tests.js --ui --verbose      # UI tests with detailed output
  node tests/run-all-tests.js --gameplay --api-only --headless
  node tests/run-all-tests.js --ui --gameplay --visual --fail-fast

AVAILABLE TEST SUITES:
`);
        for (const [key, test] of Object.entries(TESTS)) {
            console.log(`  ${key.padEnd(12)} ${test.name}`);
            console.log(`               ${test.description}`);
            console.log(`               File: ${test.file}\n`);
        }
    }

    getPassThroughArgs(testKey) {
        const test = TESTS[testKey];
        const passArgs = [];

        for (const arg of test.passThrough) {
            const idx = this.args.indexOf(arg);
            if (idx !== -1) {
                passArgs.push(arg);
                // Check if next arg is a value (not a flag)
                if (idx + 1 < this.args.length && !this.args[idx + 1].startsWith('-')) {
                    passArgs.push(this.args[idx + 1]);
                }
            }
        }

        // Always pass headless if set globally
        if (this.config.headless && !passArgs.includes('--headless')) {
            passArgs.push('--headless');
        }
        if (this.config.verbose && !passArgs.includes('--verbose')) {
            passArgs.push('--verbose');
        }

        return passArgs;
    }

    async runTest(testKey) {
        const test = TESTS[testKey];
        const testPath = path.join(__dirname, test.file);

        if (!fs.existsSync(testPath)) {
            console.log(`   ⚠️  Test file not found: ${test.file}`);
            return { name: test.name, status: 'skipped', reason: 'file not found' };
        }

        const args = this.getPassThroughArgs(testKey);
        console.log(`\n${'─'.repeat(80)}`);
        console.log(`▶ Running: ${test.name}`);
        console.log(`  Command: node ${test.file} ${args.join(' ')}`);
        console.log(`${'─'.repeat(80)}\n`);

        return new Promise((resolve) => {
            const startTime = Date.now();
            const child = spawn('node', [testPath, ...args], {
                cwd: __dirname,
                stdio: 'inherit',
                shell: true
            });

            child.on('close', (code) => {
                const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                const result = {
                    name: test.name,
                    file: test.file,
                    status: code === 0 ? 'passed' : 'failed',
                    exitCode: code,
                    duration: `${duration}s`
                };
                resolve(result);
            });

            child.on('error', (err) => {
                resolve({
                    name: test.name,
                    file: test.file,
                    status: 'error',
                    error: err.message
                });
            });
        });
    }

    async run() {
        if (this.config.help) {
            this.showHelp();
            return 0;
        }

        console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                     CNDQ CENTRAL TEST CONTROLLER                             ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);
        console.log(`Tests to run: ${this.config.tests.map(t => TESTS[t].name).join(', ')}`);
        console.log(`Options: ${this.config.headless ? 'headless ' : ''}${this.config.verbose ? 'verbose ' : ''}${this.config.failFast ? 'fail-fast' : ''}`);
        console.log(`${'═'.repeat(80)}`);

        const startTime = Date.now();

        for (const testKey of this.config.tests) {
            const result = await this.runTest(testKey);
            this.results.push(result);

            if (result.status === 'failed' && this.config.failFast) {
                console.log(`\n⛔ FAIL-FAST: Stopping due to test failure in ${result.name}`);
                break;
            }
        }

        const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
        this.printSummary(totalDuration);

        const failed = this.results.filter(r => r.status === 'failed' || r.status === 'error');
        return failed.length === 0 ? 0 : 1;
    }

    printSummary(totalDuration) {
        console.log(`\n${'═'.repeat(80)}`);
        console.log('                           TEST SUMMARY');
        console.log(`${'═'.repeat(80)}\n`);

        const passed = this.results.filter(r => r.status === 'passed').length;
        const failed = this.results.filter(r => r.status === 'failed').length;
        const skipped = this.results.filter(r => r.status === 'skipped').length;
        const errors = this.results.filter(r => r.status === 'error').length;

        for (const result of this.results) {
            const icon = result.status === 'passed' ? '✅' :
                         result.status === 'failed' ? '❌' :
                         result.status === 'skipped' ? '⏭️' : '⚠️';
            const duration = result.duration ? ` (${result.duration})` : '';
            console.log(`  ${icon} ${result.name}${duration}`);
            if (result.reason) console.log(`     └─ ${result.reason}`);
            if (result.error) console.log(`     └─ Error: ${result.error}`);
        }

        console.log(`\n${'─'.repeat(80)}`);
        console.log(`  Total: ${this.results.length} suites | ✅ ${passed} passed | ❌ ${failed} failed | ⏭️ ${skipped} skipped`);
        console.log(`  Duration: ${totalDuration}s`);
        console.log(`${'─'.repeat(80)}\n`);

        if (failed === 0 && errors === 0) {
            console.log('✅ ALL TEST SUITES PASSED\n');
        } else {
            console.log('❌ SOME TEST SUITES FAILED\n');
        }
    }
}

// Run if called directly
if (require.main === module) {
    const controller = new TestController();
    controller.run()
        .then(exitCode => process.exit(exitCode))
        .catch(err => {
            console.error('Test controller error:', err);
            process.exit(1);
        });
}

module.exports = TestController;
