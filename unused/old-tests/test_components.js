/**
 * Quick test to verify web components and API are working
 */
const puppeteer = require('puppeteer');

const BASE_URL = 'http://cndq.test';

async function testComponents() {
    console.log('Testing web components and API...\n');

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1280, height: 800 }
    });

    try {
        const page = await browser.newPage();

        // Listen for console messages
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            console.log(`[Browser ${type}]:`, text);
        });

        // Listen for page errors
        page.on('pageerror', error => {
            console.error('[Page Error]:', error.message);
            console.error('[Stack]:', error.stack);
        });

        // Login as test user
        console.log('1. Logging in...');
        await page.goto(`${BASE_URL}/dev_login.php?user=test_mail1@stonybrook.edu`);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Go to main page
        console.log('2. Loading main page...');
        await page.goto(`${BASE_URL}/index.html`);
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Test 1: Check if chemical-card elements exist
        console.log('\n3. Checking if chemical-card web components exist...');
        const cardCount = await page.evaluate(() => {
            return document.querySelectorAll('chemical-card').length;
        });
        console.log(`   Found ${cardCount} chemical-card elements`);

        // Test 2: Check if shadow roots are attached
        console.log('\n4. Checking shadow DOM...');
        const shadowStatus = await page.evaluate(() => {
            const card = document.querySelector('chemical-card[chemical="C"]');
            return {
                exists: !!card,
                hasShadowRoot: !!card?.shadowRoot,
                shadowRootMode: card?.shadowRoot ? 'open' : 'none'
            };
        });
        console.log('   Chemical C card:', shadowStatus);

        // Test 3: Check if shadow prices are accessible
        console.log('\n5. Testing shadow price access...');
        const shadowPrice = await page.evaluate(() => {
            const card = document.querySelector('chemical-card[chemical="C"]');
            if (card && card.shadowRoot) {
                const el = card.shadowRoot.getElementById('shadow-price');
                return el ? el.textContent : 'Element not found';
            }
            return 'No shadow root';
        });
        console.log(`   Chemical C shadow price: $${shadowPrice}`);

        // Test 4: Test clicking a button
        console.log('\n6. Testing button click (Post Sell Interest for C)...');
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
        console.log(`   Button clicked: ${clicked}`);
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Test 5: Check if API module loaded
        console.log('\n7. Checking if API module is available...');
        const apiStatus = await page.evaluate(() => {
            return {
                marketplaceAppExists: typeof MarketplaceApp !== 'undefined',
                windowHasApi: typeof window.api !== 'undefined'
            };
        });
        console.log('   API Status:', apiStatus);

        console.log('\n✅ Component test complete! Check browser for visual inspection.');
        console.log('   Press Ctrl+C to close when done.');

        // Keep browser open for inspection
        await new Promise(() => {});

    } catch (error) {
        console.error('\n❌ Test failed:', error);
    }
}

testComponents();
