/**
 * Debug Shadow DOM Access
 * Tests if we can properly access shadow prices from chemical cards
 */

const puppeteer = require('puppeteer');

async function debugShadowAccess() {
    console.log('\n🔍 Debug Shadow DOM Access\n');
    console.log('='.repeat(80));

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 100,
        args: ['--no-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Set cookie to login as test team
        await page.setCookie({
            name: 'mock_mail',
            value: 'test_mail1@stonybrook.edu',
            domain: 'cndq.test',
            path: '/'
        });

        console.log('\n📍 Navigating to http://cndq.test/CNDQ/\n');
        await page.goto('http://cndq.test/CNDQ/', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        console.log('✓ Page loaded\n');

        // Wait for components to load
        await page.waitForSelector('chemical-card', { timeout: 10000 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Test shadow DOM access
        const shadowTest = await page.evaluate(() => {
            const results = {};
            const chemicals = ['C', 'N', 'D', 'Q'];

            chemicals.forEach(chem => {
                const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
                results[chem] = {
                    cardExists: !!card,
                    hasShadowRoot: !!(card && card.shadowRoot),
                    shadowRootMode: card?.shadowRoot ? 'open' : 'none'
                };

                if (card && card.shadowRoot) {
                    const shadowPriceEl = card.shadowRoot.querySelector('#shadow-price');
                    const inventoryEl = card.shadowRoot.querySelector('#inventory');

                    results[chem].shadowPriceElement = !!shadowPriceEl;
                    results[chem].shadowPriceText = shadowPriceEl?.textContent || 'not found';
                    results[chem].inventoryElement = !!inventoryEl;
                    results[chem].inventoryText = inventoryEl?.textContent || 'not found';

                    // Try to find all IDs in shadow root
                    const allElements = card.shadowRoot.querySelectorAll('[id]');
                    results[chem].allIds = Array.from(allElements).map(el => el.id);
                }
            });

            return results;
        });

        console.log('Shadow DOM Access Results:\n');
        Object.entries(shadowTest).forEach(([chem, data]) => {
            console.log(`Chemical ${chem}:`);
            console.log(`  Card exists: ${data.cardExists}`);
            console.log(`  Has shadowRoot: ${data.hasShadowRoot}`);
            console.log(`  Shadow price element: ${data.shadowPriceElement}`);
            console.log(`  Shadow price value: ${data.shadowPriceText}`);
            console.log(`  Inventory element: ${data.inventoryElement}`);
            console.log(`  Inventory value: ${data.inventoryText}`);
            console.log(`  All IDs in shadow root: ${data.allIds?.join(', ') || 'none'}`);
            console.log('');
        });

        console.log('\n⏸️  Browser left open. Close manually to exit.\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        throw error;
    }
}

debugShadowAccess().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
