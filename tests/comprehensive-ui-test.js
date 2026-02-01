/**
 * Comprehensive UI Test - Registry-Driven Testing
 *
 * Uses element-registry.js as the single source of truth.
 * Tests every interactive element and verifies accessibility.
 *
 * Usage:
 *   node tests/comprehensive-ui-test.js
 *   node tests/comprehensive-ui-test.js --headless
 *   node tests/comprehensive-ui-test.js --a11y-only    (skip interaction tests)
 *   node tests/comprehensive-ui-test.js --ui-only      (skip a11y tests)
 *   node tests/comprehensive-ui-test.js --verbose
 */

const BrowserHelper = require('./helpers/browser');
const { ELEMENT_REGISTRY, getInteractiveElements, getA11yElements } = require('./element-registry');
const fs = require('fs');
const path = require('path');

const CONFIG = {
    baseUrl: 'http://cndq.test/CNDQ/',
    testUser: 'test_mail1@stonybrook.edu',
    adminUser: 'admin@stonybrook.edu',
    headless: process.argv.includes('--headless'),
    verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
    a11yOnly: process.argv.includes('--a11y-only'),
    uiOnly: process.argv.includes('--ui-only'),
};

class ComprehensiveUITest {
    constructor(config = CONFIG) {
        this.config = config;
        this.browser = new BrowserHelper(config);
        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            interactions: [],
            a11y: [],
            errors: []
        };
    }

    async run() {
        console.log('🔬 COMPREHENSIVE UI TEST (Registry-Driven)');
        console.log('='.repeat(70));
        console.log(`Total elements in registry: ${ELEMENT_REGISTRY.length}`);
        console.log(`Interactive elements: ${getInteractiveElements().length}`);
        console.log(`A11y-checkable elements: ${getA11yElements().length}`);
        console.log('='.repeat(70));
        console.log('');

        try {
            await this.browser.launch();

            // Setup: Reset game and login
            await this.setupGame();

            // Get a page for testing
            const page = await this.browser.loginAndNavigate(this.config.testUser, '');

            // Wait for app to initialize
            await page.waitForFunction(() => window.marketplaceApp?.profile, { timeout: 15000 });
            console.log('✅ App initialized\n');

            // Run interaction tests
            if (!this.config.a11yOnly) {
                await this.runInteractionTests(page);
            }

            // Run accessibility tests
            if (!this.config.uiOnly) {
                await this.runAccessibilityTests(page);
            }

            // Print results
            this.printResults();

            // Save report
            this.saveReport();

            await page.close();
            await this.browser.close();

            return this.results.failed === 0;

        } catch (error) {
            console.error('\n❌ Test failed:', error.message);
            if (this.config.verbose) {
                console.error(error.stack);
            }
            await this.browser.close();
            throw error;
        }
    }

    async setupGame() {
        console.log('🛡️  Setting up game...');
        const adminPage = await this.browser.loginAndNavigate(this.config.adminUser, 'admin/');

        // Reset game
        await adminPage.waitForSelector('button[onclick="resetGameData()"]', { timeout: 10000 });
        await adminPage.click('button[onclick="resetGameData()"]');
        await adminPage.waitForSelector('#confirm-modal:not(.hidden)', { timeout: 5000 });
        await adminPage.click('#confirm-modal-yes');
        await this.browser.sleep(2000);

        // Start market
        const startBtn = await adminPage.$('#start-stop-btn');
        const btnText = await adminPage.evaluate(el => el.textContent, startBtn);
        if (btnText.includes('Start')) {
            await adminPage.click('#start-stop-btn');
            await this.browser.sleep(1000);
        }

        console.log('✅ Game ready\n');
        await adminPage.close();
    }

    /**
     * Run interaction tests for all interactive elements
     */
    async runInteractionTests(page) {
        console.log('🖱️  INTERACTION TESTS');
        console.log('-'.repeat(70));

        const interactiveElements = getInteractiveElements();

        for (const element of interactiveElements) {
            this.results.total++;
            const result = await this.testInteraction(page, element);
            this.results.interactions.push(result);

            if (result.status === 'passed') {
                this.results.passed++;
                console.log(`   ✅ ${element.id}`);
            } else if (result.status === 'skipped') {
                this.results.skipped++;
                console.log(`   ⏭️  ${element.id} (${result.reason})`);
            } else {
                this.results.failed++;
                console.log(`   ❌ ${element.id}: ${result.error}`);
            }

            // Run cleanup if defined
            if (element.cleanup) {
                try {
                    await element.cleanup(page);
                } catch (e) {
                    // Ignore cleanup errors
                }
            }

            await this.browser.sleep(200); // Brief pause between tests
        }

        console.log('');
    }

    /**
     * Test a single element's interaction
     */
    async testInteraction(page, element) {
        const result = {
            id: element.id,
            selector: element.selector,
            type: element.type,
            interaction: element.interaction,
            status: 'pending',
            error: null,
            reason: null
        };

        try {
            // Check precondition
            if (element.precondition) {
                const canTest = await element.precondition(page);
                if (!canTest) {
                    result.status = 'skipped';
                    result.reason = 'precondition not met';
                    return result;
                }
            }

            // Find element (handle shadow DOM)
            const elementHandle = await this.findElement(page, element.selector);
            if (!elementHandle) {
                result.status = 'failed';
                result.error = 'element not found';
                return result;
            }

            // Check if visible and enabled
            const state = await elementHandle.evaluate(el => ({
                visible: el.offsetParent !== null || getComputedStyle(el).display !== 'none',
                enabled: !el.disabled
            }));

            if (!state.visible) {
                result.status = 'skipped';
                result.reason = 'element not visible';
                return result;
            }

            if (!state.enabled && element.interaction === 'click') {
                result.status = 'skipped';
                result.reason = 'element disabled';
                return result;
            }

            // Perform interaction
            if (element.interaction === 'click') {
                await elementHandle.click();
                await this.browser.sleep(300);
            } else if (element.interaction === 'type') {
                await elementHandle.type('test');
                await this.browser.sleep(100);
            } else if (element.interaction === 'hover') {
                await elementHandle.hover();
                await this.browser.sleep(100);
            } else if (element.interaction === 'focus') {
                await elementHandle.focus();
                await this.browser.sleep(100);
            }

            // Verify outcome
            if (element.expectedOutcome) {
                const outcomeOk = await element.expectedOutcome(page);
                if (!outcomeOk) {
                    result.status = 'failed';
                    result.error = 'expected outcome not achieved';
                    return result;
                }
            }

            result.status = 'passed';
            return result;

        } catch (error) {
            result.status = 'failed';
            result.error = error.message;
            return result;
        }
    }

    /**
     * Run accessibility tests for all elements
     */
    async runAccessibilityTests(page) {
        console.log('♿ ACCESSIBILITY TESTS');
        console.log('-'.repeat(70));

        const a11yElements = getA11yElements();

        for (const element of a11yElements) {
            this.results.total++;
            const result = await this.testAccessibility(page, element);
            this.results.a11y.push(result);

            if (result.status === 'passed') {
                this.results.passed++;
                if (this.config.verbose) {
                    console.log(`   ✅ ${element.id}`);
                }
            } else if (result.status === 'skipped') {
                this.results.skipped++;
                if (this.config.verbose) {
                    console.log(`   ⏭️  ${element.id} (${result.reason})`);
                }
            } else {
                this.results.failed++;
                console.log(`   ❌ ${element.id}: ${result.errors.join(', ')}`);
            }
        }

        // Summary for non-verbose mode
        if (!this.config.verbose) {
            const passed = this.results.a11y.filter(r => r.status === 'passed').length;
            const failed = this.results.a11y.filter(r => r.status === 'failed').length;
            console.log(`   ${passed} passed, ${failed} failed`);
        }

        console.log('');
    }

    /**
     * Test a single element's accessibility
     */
    async testAccessibility(page, element) {
        const result = {
            id: element.id,
            selector: element.selector,
            status: 'pending',
            errors: [],
            reason: null
        };

        try {
            const elementHandle = await this.findElement(page, element.selector);
            if (!elementHandle) {
                result.status = 'skipped';
                result.reason = 'element not found';
                return result;
            }

            const a11yInfo = await elementHandle.evaluate((el, expected) => {
                const info = {
                    tagName: el.tagName.toLowerCase(),
                    role: el.getAttribute('role') || el.tagName.toLowerCase(),
                    ariaLabel: el.getAttribute('aria-label'),
                    ariaLabelledBy: el.getAttribute('aria-labelledby'),
                    title: el.getAttribute('title'),
                    textContent: el.textContent?.trim().substring(0, 50),
                    tabIndex: el.tabIndex,
                    disabled: el.disabled,
                    type: el.type
                };

                // Compute accessible name
                let accessibleName = info.ariaLabel;
                if (!accessibleName && info.ariaLabelledBy) {
                    const labelEl = document.getElementById(info.ariaLabelledBy);
                    accessibleName = labelEl?.textContent?.trim();
                }
                if (!accessibleName) {
                    accessibleName = info.title || info.textContent;
                }
                info.accessibleName = accessibleName;

                // Check if focusable
                const focusableElements = ['a', 'button', 'input', 'select', 'textarea'];
                info.isFocusable = focusableElements.includes(info.tagName) ||
                    info.tabIndex >= 0 ||
                    el.getAttribute('contenteditable') === 'true';

                return info;
            }, element.a11y);

            // Validate against expected a11y requirements
            const a11y = element.a11y;

            if (a11y.role && !this.matchesRole(a11yInfo, a11y.role)) {
                result.errors.push(`expected role "${a11y.role}", got "${a11yInfo.role}"`);
            }

            if (a11y.label) {
                const labelMatch = a11y.label instanceof RegExp
                    ? a11y.label.test(a11yInfo.accessibleName || '')
                    : (a11yInfo.accessibleName || '').toLowerCase().includes(a11y.label.toLowerCase());

                if (!labelMatch) {
                    result.errors.push(`missing accessible label matching "${a11y.label}"`);
                }
            }

            if (a11y.focusable === true && !a11yInfo.isFocusable) {
                result.errors.push('should be focusable but is not');
            }

            if (a11y.focusable === false && a11yInfo.isFocusable && a11yInfo.tabIndex >= 0) {
                // Only flag if explicitly tabbable
                result.errors.push('should not be focusable but has tabIndex >= 0');
            }

            result.status = result.errors.length === 0 ? 'passed' : 'failed';
            return result;

        } catch (error) {
            result.status = 'failed';
            result.errors.push(error.message);
            return result;
        }
    }

    /**
     * Check if element role matches expected
     */
    matchesRole(a11yInfo, expectedRole) {
        const role = a11yInfo.role?.toLowerCase();
        const tagName = a11yInfo.tagName;

        // Implicit roles
        const implicitRoles = {
            'button': 'button',
            'a': 'link',
            'input': a11yInfo.type === 'checkbox' ? 'checkbox' : 'textbox',
            'select': 'combobox',
            'dialog': 'dialog',
            'article': 'article',
            'nav': 'navigation',
            'main': 'main',
            'header': 'banner',
            'footer': 'contentinfo',
            'section': 'region'
        };

        const actualRole = role || implicitRoles[tagName] || tagName;
        return actualRole === expectedRole.toLowerCase();
    }

    /**
     * Find element, handling shadow DOM chains
     */
    async findElement(page, selector) {
        if (Array.isArray(selector)) {
            // Shadow DOM chain
            return await page.evaluateHandle((selectors) => {
                let root = document;
                for (const sel of selectors) {
                    const el = (root.shadowRoot || root).querySelector(sel);
                    if (!el) return null;
                    root = el;
                }
                return root;
            }, selector);
        } else {
            return await page.$(selector);
        }
    }

    printResults() {
        console.log('='.repeat(70));
        console.log('📊 TEST RESULTS');
        console.log('='.repeat(70));
        console.log(`Total tests:    ${this.results.total}`);
        console.log(`Passed:         ${this.results.passed} ✅`);
        console.log(`Failed:         ${this.results.failed} ❌`);
        console.log(`Skipped:        ${this.results.skipped} ⏭️`);
        console.log('='.repeat(70));

        if (this.results.failed > 0) {
            console.log('\n❌ FAILURES:');
            [...this.results.interactions, ...this.results.a11y]
                .filter(r => r.status === 'failed')
                .forEach(r => {
                    const err = r.error || r.errors?.join(', ');
                    console.log(`   • ${r.id}: ${err}`);
                });
        }

        console.log('');
        if (this.results.failed === 0) {
            console.log('✅ ALL TESTS PASSED');
        } else {
            console.log('❌ SOME TESTS FAILED');
        }
    }

    saveReport() {
        const reportDir = path.join(__dirname, '..', 'artifacts');
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }

        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total: this.results.total,
                passed: this.results.passed,
                failed: this.results.failed,
                skipped: this.results.skipped
            },
            interactions: this.results.interactions,
            accessibility: this.results.a11y,
            registrySize: ELEMENT_REGISTRY.length
        };

        const reportPath = path.join(reportDir, `comprehensive-ui-report-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n📄 Report saved: ${reportPath}`);
    }
}

// Run if called directly
if (require.main === module) {
    const test = new ComprehensiveUITest();
    test.run()
        .then(passed => process.exit(passed ? 0 : 1))
        .catch(() => process.exit(1));
}

module.exports = ComprehensiveUITest;
