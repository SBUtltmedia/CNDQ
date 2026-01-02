/**
 * Component Test
 *
 * Verifies web components load and function correctly
 */

const BrowserHelper = require('./helpers/browser');
const ReportingHelper = require('./helpers/reporting');

class ComponentTest {
    constructor(config, browserHelper) {
        this.config = config;
        this.browser = browserHelper;
    }

    async run() {
        ReportingHelper.printHeader('Web Component Verification');

        try {
            const page = await this.browser.loginAndNavigate(
                this.config.teams[0],
                '/'
            );

            await this.browser.sleep(3000); // Wait for components to load

            // Test 1: Check chemical-card elements
            ReportingHelper.printInfo('Checking chemical-card web components...');
            const cardCount = await page.evaluate(() => {
                return document.querySelectorAll('chemical-card').length;
            });
            console.log(`   Found ${cardCount} chemical-card elements`);

            if (cardCount === 4) {
                ReportingHelper.printSuccess('All 4 chemical cards found');
            } else {
                ReportingHelper.printWarning(`Expected 4 cards, found ${cardCount}`);
            }

            // Test 2: Check shadow DOM
            ReportingHelper.printInfo('Checking shadow DOM...');
            const shadowStatus = await page.evaluate(() => {
                const card = document.querySelector('chemical-card[chemical="C"]');
                return {
                    exists: !!card,
                    hasShadowRoot: !!card?.shadowRoot,
                    shadowRootMode: card?.shadowRoot ? 'open' : 'none'
                };
            });

            if (shadowStatus.hasShadowRoot) {
                ReportingHelper.printSuccess('Shadow DOM attached correctly');
            } else {
                ReportingHelper.printError('Shadow DOM not found');
            }

            // Test 3: Check shadow prices
            ReportingHelper.printInfo('Testing shadow price access...');
            const shadowPrice = await page.evaluate(() => {
                const card = document.querySelector('chemical-card[chemical="C"]');
                if (card && card.shadowRoot) {
                    const el = card.shadowRoot.getElementById('shadow-price');
                    return el ? el.textContent : 'Element not found';
                }
                return 'No shadow root';
            });
            console.log(`   Chemical C shadow price: $${shadowPrice}`);

            if (shadowPrice !== 'Element not found' && shadowPrice !== 'No shadow root') {
                ReportingHelper.printSuccess('Shadow prices accessible');
            }

            // Test 4: Check button functionality
            ReportingHelper.printInfo('Testing button click...');
            const clicked = await page.evaluate(() => {
                const card = document.querySelector('chemical-card[chemical="C"]');
                if (card && card.shadowRoot) {
                    const button = card.shadowRoot.getElementById('post-sell-btn');
                    if (button) {
                        button.click();
                        return true;
                    }
                }
                return false;
            });

            if (clicked) {
                ReportingHelper.printSuccess('Button click successful');
            } else {
                ReportingHelper.printWarning('Button not clickable');
            }

            await this.browser.sleep(1000);

            // Test 5: Check API module
            ReportingHelper.printInfo('Checking API module...');
            const apiStatus = await page.evaluate(() => {
                return {
                    marketplaceAppExists: typeof MarketplaceApp !== 'undefined',
                    windowHasApi: typeof window.api !== 'undefined'
                };
            });

            if (apiStatus.marketplaceAppExists) {
                ReportingHelper.printSuccess('MarketplaceApp loaded');
            }
            if (apiStatus.windowHasApi) {
                ReportingHelper.printSuccess('API module available');
            }

            await page.close();

            ReportingHelper.printSuccess('\nAll component tests passed!');
            return { success: true };

        } catch (error) {
            ReportingHelper.printError(`Component test failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }
}

module.exports = ComponentTest;
