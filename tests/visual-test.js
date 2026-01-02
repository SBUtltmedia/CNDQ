/**
 * Visual Test - Quick UI Verification
 *
 * Tests that the UI loads correctly with all utility classes working
 */

const puppeteer = require('puppeteer');

const CONFIG = {
    baseUrl: 'http://cndq.test/CNDQ/',
    headless: false,
    slowMo: 100
};

async function testVisualLayout() {
    console.log('\n🎨 Visual Layout Test\n');
    console.log('=' .repeat(80));

    const browser = await puppeteer.launch({
        headless: CONFIG.headless,
        slowMo: CONFIG.slowMo,
        args: ['--no-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        console.log(`\n📍 Navigating to ${CONFIG.baseUrl}`);
        await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for page to load
        await page.waitForSelector('header', { timeout: 10000 });
        console.log('✓ Header loaded');

        // Check for chemical cards grid
        const gridExists = await page.$('.grid.grid-cols-1');
        console.log(gridExists ? '✓ Grid layout found' : '✗ Grid layout missing');

        // Check for session status
        const sessionStatus = await page.$('.border-l-4.border-purple-500');
        console.log(sessionStatus ? '✓ Session status bar found' : '✗ Session status bar missing');

        // Check for shadow prices section
        const shadowPrices = await page.$('#shadow-C');
        console.log(shadowPrices ? '✓ Shadow prices section found' : '✗ Shadow prices section missing');

        // Wait for web components to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Count chemical cards
        const cardCount = await page.$$eval('chemical-card', cards => cards.length);
        console.log(`✓ Found ${cardCount} chemical-card components${cardCount === 4 ? ' (expected)' : ' (expected 4)'}`);

        // Check if cards are rendering content
        if (cardCount > 0) {
            const hasContent = await page.evaluate(() => {
                const card = document.querySelector('chemical-card');
                return card && card.shadowRoot && card.shadowRoot.querySelector('.card') !== null;
            });
            console.log(hasContent ? '✓ Cards have shadow DOM content' : '✗ Cards missing shadow DOM content');
        }

        // Test responsive utilities
        console.log('\n📱 Testing Responsive Utilities:');

        // Desktop view (1280px)
        const desktopCols = await page.evaluate(() => {
            const grid = document.querySelector('.grid');
            if (!grid) return null;
            const styles = window.getComputedStyle(grid);
            return styles.gridTemplateColumns;
        });
        console.log(`   Desktop grid columns: ${desktopCols || 'not found'}`);

        // Tablet view (768px)
        await page.setViewport({ width: 768, height: 600 });
        await new Promise(resolve => setTimeout(resolve, 500));

        const tabletCols = await page.evaluate(() => {
            const grid = document.querySelector('.grid');
            if (!grid) return null;
            const styles = window.getComputedStyle(grid);
            return styles.gridTemplateColumns;
        });
        console.log(`   Tablet grid columns: ${tabletCols || 'not found'}`);

        // Mobile view (375px)
        await page.setViewport({ width: 375, height: 667 });
        await new Promise(resolve => setTimeout(resolve, 500));

        const mobileCols = await page.evaluate(() => {
            const grid = document.querySelector('.grid');
            if (!grid) return null;
            const styles = window.getComputedStyle(grid);
            return styles.gridTemplateColumns;
        });
        console.log(`   Mobile grid columns: ${mobileCols || 'not found'}`);

        // Check spacing utilities
        console.log('\n📐 Testing Spacing Utilities:');
        await page.setViewport({ width: 1280, height: 800 });
        await new Promise(resolve => setTimeout(resolve, 500));

        const spacing = await page.evaluate(() => {
            const results = {};

            // Test gap utilities
            const grid = document.querySelector('.grid');
            if (grid) results.gridGap = window.getComputedStyle(grid).gap;

            // Test padding utilities
            const card = document.querySelector('.p-4');
            if (card) results.padding = window.getComputedStyle(card).padding;

            // Test margin utilities
            const mb6 = document.querySelector('.mb-6');
            if (mb6) results.marginBottom = window.getComputedStyle(mb6).marginBottom;

            return results;
        });

        console.log(`   Grid gap: ${spacing.gridGap || 'not found'}`);
        console.log(`   Padding (.p-4): ${spacing.padding || 'not found'}`);
        console.log(`   Margin bottom (.mb-6): ${spacing.marginBottom || 'not found'}`);

        // Test border utilities
        console.log('\n🔲 Testing Border Utilities:');
        const borders = await page.evaluate(() => {
            const results = {};

            const border2 = document.querySelector('.border-2');
            if (border2) results.border2 = window.getComputedStyle(border2).borderWidth;

            const borderL4 = document.querySelector('.border-l-4');
            if (borderL4) results.borderL4 = window.getComputedStyle(borderL4).borderLeftWidth;

            const rounded = document.querySelector('.rounded-lg');
            if (rounded) results.borderRadius = window.getComputedStyle(rounded).borderRadius;

            return results;
        });

        console.log(`   Border width (.border-2): ${borders.border2 || 'not found'}`);
        console.log(`   Border left (.border-l-4): ${borders.borderL4 || 'not found'}`);
        console.log(`   Border radius (.rounded-lg): ${borders.borderRadius || 'not found'}`);

        // Take screenshot
        await page.screenshot({ path: 'tests/screenshots/visual-test.png', fullPage: true });
        console.log('\n📸 Screenshot saved to tests/screenshots/visual-test.png');

        console.log('\n' + '='.repeat(80));
        console.log('✅ Visual layout test completed successfully!\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        throw error;
    } finally {
        if (!CONFIG.headless) {
            console.log('\n⏸️  Browser left open for inspection. Close manually to exit.');
            // Don't close browser in visible mode
        } else {
            await browser.close();
        }
    }
}

// Run test
testVisualLayout().catch(error => {
    console.error('Test error:', error);
    process.exit(1);
});
