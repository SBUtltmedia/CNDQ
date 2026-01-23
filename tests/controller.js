#!/usr/bin/env node
/**
 * Test Controller - Unified test runner for CNDQ test suite
 *
 * Runs any combination of tests using a shared JSON config file.
 *
 * Usage:
 *   node tests/controller.js                      # Run all tests
 *   node tests/controller.js --test dual          # Run dual playability test
 *   node tests/controller.js --test stress        # Run stress test
 *   node tests/controller.js --test lighthouse    # Run lighthouse audit
 *   node tests/controller.js --test accessibility # Run accessibility test
 *   node tests/controller.js --test visual        # Run visual screenshot test
 *   node tests/controller.js --test dual,stress   # Run multiple tests
 *
 * Config:
 *   --config <path>     Use custom config file (default: test-config.json)
 *
 * CLI Overrides:
 *   --headless          Run in headless mode
 *   --verbose / -v      Enable verbose output
 *   --npcs <n>          Number of NPCs
 *   --rpcs <n>          Number of real player clients
 *   --duration <s>      Trading duration in seconds
 *   --skill <level>     Set all skill levels (beginner, novice, expert)
 *   --baseUrl <url>     Override base URL
 */

const fs = require('fs');
const path = require('path');

// Available tests
const AVAILABLE_TESTS = {
    dual: {
        name: 'Dual Playability Test',
        file: './dual-playability-test.js',
        description: 'UI vs API comparison with ROI validation'
    },
    stress: {
        name: 'Stress Test',
        file: './stress-test-playability.js',
        description: 'Load testing with multiple concurrent users'
    },
    lighthouse: {
        name: 'Lighthouse Audit',
        file: './lighthouse.js',
        description: 'Performance, accessibility, best practices'
    },
    accessibility: {
        name: 'Accessibility Test',
        file: './accessibility.js',
        description: 'WCAG 2.1 Level AA compliance'
    },
    visual: {
        name: 'Visual UX Screenshot Test',
        file: './visual-ux-screenshot-test.js',
        description: 'Visual regression screenshots'
    }
};

// Parse CLI arguments
function parseArgs() {
    const args = {
        tests: [],
        configPath: path.join(__dirname, 'test-config.json'),
        overrides: {}
    };

    const argv = process.argv.slice(2);

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const nextArg = argv[i + 1];

        switch (arg) {
            case '--test':
            case '-t':
                if (nextArg) {
                    args.tests = nextArg.split(',').map(t => t.trim().toLowerCase());
                    i++;
                }
                break;
            case '--config':
            case '-c':
                if (nextArg) {
                    args.configPath = path.resolve(nextArg);
                    i++;
                }
                break;
            case '--headless':
                args.overrides.headless = true;
                break;
            case '--verbose':
            case '-v':
                args.overrides.verbose = true;
                break;
            case '--npcs':
                if (nextArg) {
                    args.overrides.npcCount = parseInt(nextArg);
                    i++;
                }
                break;
            case '--rpcs':
                if (nextArg) {
                    args.overrides.rpcCount = parseInt(nextArg);
                    i++;
                }
                break;
            case '--duration':
                if (nextArg) {
                    args.overrides.tradingDuration = parseInt(nextArg);
                    i++;
                }
                break;
            case '--skill':
                if (nextArg) {
                    args.overrides.skillLevel = nextArg;
                    i++;
                }
                break;
            case '--baseUrl':
                if (nextArg) {
                    args.overrides.baseUrl = nextArg;
                    i++;
                }
                break;
            case '--help':
            case '-h':
                printHelp();
                process.exit(0);
                break;
            case '--list':
                listTests();
                process.exit(0);
                break;
        }
    }

    // Default to all tests if none specified
    if (args.tests.length === 0) {
        args.tests = ['dual'];
    }

    return args;
}

function printHelp() {
    console.log(`
CNDQ Test Controller - Unified test runner

Usage:
  node tests/controller.js [options]

Options:
  --test, -t <tests>    Tests to run (comma-separated): dual, stress, lighthouse, accessibility, visual
  --config, -c <path>   Config file path (default: test-config.json)
  --headless            Run browsers in headless mode
  --verbose, -v         Enable verbose output
  --npcs <n>            Number of NPCs to create
  --rpcs <n>            Number of real player clients
  --duration <s>        Trading duration in seconds
  --skill <level>       Set all skill levels (beginner, novice, expert)
  --baseUrl <url>       Override base URL
  --list                List available tests
  --help, -h            Show this help

Examples:
  node tests/controller.js --test dual --headless
  node tests/controller.js --test dual,stress --npcs 10 --duration 120
  node tests/controller.js --config my-config.json --test accessibility
`);
}

function listTests() {
    console.log('\nAvailable Tests:\n');
    Object.entries(AVAILABLE_TESTS).forEach(([key, test]) => {
        console.log(`  ${key.padEnd(15)} ${test.name}`);
        console.log(`  ${''.padEnd(15)} ${test.description}\n`);
    });
}

function loadConfig(configPath, overrides) {
    let config = {};

    // Load base config if exists
    if (fs.existsSync(configPath)) {
        try {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            console.log(`📄 Loaded config from: ${configPath}`);
        } catch (e) {
            console.error(`⚠️  Failed to parse config: ${e.message}`);
            console.log('   Using default config...');
        }
    } else {
        console.log(`⚠️  Config file not found: ${configPath}`);
        console.log('   Using default config...');
    }

    // Apply defaults
    config = {
        baseUrl: 'http://cndq.test/CNDQ/',
        adminUser: 'admin@stonybrook.edu',
        npcCount: 6,
        rpcCount: 6,
        tradingDuration: 300,
        targetSessions: 2,
        npcSkillMix: ['expert', 'expert', 'expert', 'expert', 'expert', 'expert'],
        rpcSkillMix: ['expert', 'expert', 'expert', 'expert', 'expert', 'expert'],
        headless: true,
        verbose: false,
        passCriteria: {
            minPositiveRoiTeams: 1,
            minAverageRoi: -50,
            minTotalTrades: 3,
            maxAcceptableErrors: 2
        },
        // Lighthouse/Accessibility specific
        pages: [
            { name: 'Login Page', url: '' },
            { name: 'Main App', url: 'index.php' },
            { name: 'Admin Panel', url: 'admin/' }
        ],
        themes: ['light', 'dark'],
        wcagLevel: 'AA',
        ...config
    };

    // Apply CLI overrides
    if (overrides.headless !== undefined) config.headless = overrides.headless;
    if (overrides.verbose !== undefined) config.verbose = overrides.verbose;
    if (overrides.npcCount !== undefined) config.npcCount = overrides.npcCount;
    if (overrides.rpcCount !== undefined) config.rpcCount = overrides.rpcCount;
    if (overrides.tradingDuration !== undefined) config.tradingDuration = overrides.tradingDuration;
    if (overrides.baseUrl !== undefined) config.baseUrl = overrides.baseUrl;

    // Apply skill level override to all mixes
    if (overrides.skillLevel) {
        config.npcSkillMix = Array(config.npcCount).fill(overrides.skillLevel);
        config.rpcSkillMix = Array(config.rpcCount).fill(overrides.skillLevel);
    }

    // Derive skill levels from mix
    config.npcLevels = config.npcSkillMix.slice(0, config.npcCount);
    config.rpcLevels = config.rpcSkillMix.slice(0, config.rpcCount);
    config.skillLevels = config.rpcLevels;

    // Flatten pass criteria for easy access
    if (config.passCriteria) {
        config.minPositiveRoiTeams = config.passCriteria.minPositiveRoiTeams;
        config.minAverageRoi = config.passCriteria.minAverageRoi;
        config.minTotalTrades = config.passCriteria.minTotalTrades;
        config.maxAcceptableErrors = config.passCriteria.maxAcceptableErrors;
    }

    // Test users for RPC tests
    config.testUsers = [
        'test_mail1@stonybrook.edu',
        'test_mail2@stonybrook.edu',
        'test_mail3@stonybrook.edu',
        'test_mail4@stonybrook.edu',
        'test_mail5@stonybrook.edu',
        'test_mail6@stonybrook.edu'
    ].slice(0, config.rpcCount);

    // Stress test teams
    config.teams = [
        'alpha@stonybrook.edu',
        'beta@stonybrook.edu',
        'gamma@stonybrook.edu'
    ];

    return config;
}

async function runTest(testKey, config) {
    const testInfo = AVAILABLE_TESTS[testKey];

    if (!testInfo) {
        console.error(`❌ Unknown test: ${testKey}`);
        console.log('   Use --list to see available tests');
        return { success: false, error: 'Unknown test' };
    }

    console.log(`\n${'█'.repeat(80)}`);
    console.log(`█ ${testInfo.name.toUpperCase().padEnd(76)} █`);
    console.log(`█ ${testInfo.description.padEnd(76)} █`);
    console.log(`${'█'.repeat(80)}\n`);

    try {
        switch (testKey) {
            case 'dual': {
                const DualPlayabilityTest = require(testInfo.file);
                const test = new DualPlayabilityTest(config);
                await test.run();
                return { success: true };
            }

            case 'stress': {
                // Stress test has hardcoded config, we need to modify it
                const StressTest = require(testInfo.file);
                // Override the module's CONFIG if possible, or just run it
                const test = new StressTest();
                // Inject config values
                test.browserHelper.config = { ...test.browserHelper.config, ...config };
                await test.run();
                return { success: true };
            }

            case 'lighthouse': {
                const LighthouseTest = require(testInfo.file);
                const BrowserHelper = require('./helpers/browser');
                const browserHelper = new BrowserHelper(config);
                await browserHelper.launch();
                const test = new LighthouseTest(config, browserHelper);
                const result = await test.run();
                await browserHelper.close();
                return result;
            }

            case 'accessibility': {
                const AccessibilityTest = require(testInfo.file);
                const BrowserHelper = require('./helpers/browser');
                const browserHelper = new BrowserHelper(config);
                await browserHelper.launch();
                const test = new AccessibilityTest(config, browserHelper);
                const result = await test.run();
                await browserHelper.close();
                return result;
            }

            case 'visual': {
                const VisualTest = require(testInfo.file);
                const test = new VisualTest(config);
                await test.run();
                return { success: true };
            }

            default:
                return { success: false, error: 'Test not implemented' };
        }
    } catch (error) {
        console.error(`\n❌ ${testInfo.name} failed:`, error.message);
        if (config.verbose) {
            console.error(error.stack);
        }
        return { success: false, error: error.message };
    }
}

async function main() {
    console.log('🎮 CNDQ Test Controller');
    console.log('='.repeat(80));

    const args = parseArgs();
    const config = loadConfig(args.configPath, args.overrides);

    console.log(`\n📋 Configuration:`);
    console.log(`   Base URL: ${config.baseUrl}`);
    console.log(`   Headless: ${config.headless}`);
    console.log(`   Verbose: ${config.verbose}`);
    console.log(`   NPCs: ${config.npcCount}`);
    console.log(`   RPCs: ${config.rpcCount}`);
    console.log(`   Duration: ${config.tradingDuration}s`);
    console.log(`\n🧪 Tests to run: ${args.tests.join(', ')}`);

    const results = {};
    let allPassed = true;

    for (const testKey of args.tests) {
        results[testKey] = await runTest(testKey, config);
        if (!results[testKey].success) {
            allPassed = false;
        }
    }

    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));

    Object.entries(results).forEach(([testKey, result]) => {
        const testInfo = AVAILABLE_TESTS[testKey];
        const status = result.success ? '✅ PASSED' : '❌ FAILED';
        console.log(`   ${testInfo.name.padEnd(30)} ${status}`);
        if (!result.success && result.error) {
            console.log(`      Error: ${result.error}`);
        }
    });

    console.log('='.repeat(80));
    console.log(allPassed ? '\n🎉 All tests passed!' : '\n⚠️  Some tests failed');

    process.exit(allPassed ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { runTest, loadConfig, AVAILABLE_TESTS };
