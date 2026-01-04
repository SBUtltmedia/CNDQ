/**
 * Debug Marketplace - Take screenshots to see inventory display issue
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const CONFIG = {
    baseUrl: 'http://cndq.test/CNDQ/',
    screenshotDir: path.resolve(__dirname, '../screenshots'),
    headless: false,
    slowMo: 100
};

async function takeMarketplaceScreenshots() {
    // Create screenshots directory
    if (!fs.existsSync(CONFIG.screenshotDir)) {
        fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
    }

    const browser = await puppeteer.launch({
        headless: CONFIG.headless,
        slowMo: CONFIG.slowMo,
        defaultViewport: { width: 1920, height: 1080 }
    });

    try {
        // Reset game as admin first
        console.log('Resetting game as admin...');
        const adminPage = await browser.newPage();
        const url = new URL(CONFIG.baseUrl);
        await adminPage.setCookie({
            name: 'mock_mail',
            value: 'admin@stonybrook.edu',
            domain: url.hostname,
            path: '/',
            expires: Math.floor(Date.now() / 1000) + 3600
        });

        await adminPage.goto(CONFIG.baseUrl + 'admin/', { waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Reset the game
        const resetResult = await adminPage.evaluate(async () => {
            const response = await fetch('/CNDQ/api/admin/reset-game.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            return await response.json();
        });
        console.log('Reset result:', resetResult);
        await adminPage.close();

        // Now login as alpha
        const page = await browser.newPage();
        console.log('Logging in as alpha@stonybrook.edu...');
        await page.setCookie({
            name: 'mock_mail',
            value: 'alpha@stonybrook.edu',
            domain: url.hostname,
            path: '/',
            expires: Math.floor(Date.now() / 1000) + 3600
        });

        // Navigate to marketplace
        console.log('Navigating to marketplace...');
        await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for Lit components to render

        // Take full page screenshot
        console.log('Taking full page screenshot...');
        await page.screenshot({
            path: path.join(CONFIG.screenshotDir, 'marketplace-full.png'),
            fullPage: true
        });

        // Take screenshot of each chemical card
        const chemicals = ['C', 'N', 'D', 'Q'];
        for (const chem of chemicals) {
            console.log(`Taking screenshot of Chemical ${chem} card...`);

            // Find the chemical card
            const cardSelector = `chemical-card[chemical="${chem}"]`;
            const card = await page.$(cardSelector);

            if (card) {
                await card.screenshot({
                    path: path.join(CONFIG.screenshotDir, `chemical-${chem}-card.png`)
                });
            } else {
                console.log(`  ⚠️ Chemical ${chem} card not found`);
            }
        }

        // Check what data was loaded
        console.log('\nChecking loaded data...');
        const marketplaceData = await page.evaluate(() => {
            const mp = window.marketplace;
            if (!mp) return { error: 'Marketplace not found' };

            return {
                profile: mp.profile,
                inventory: mp.inventory,
                shadowPrices: mp.shadowPrices,
                currentUser: mp.currentUser
            };
        });

        console.log('Marketplace Data:', JSON.stringify(marketplaceData, null, 2));

        // Check chemical card properties
        console.log('\nChecking chemical card properties...');
        for (const chem of chemicals) {
            const cardData = await page.evaluate((chemical) => {
                const card = document.querySelector(`chemical-card[chemical="${chemical}"]`);
                if (!card) return null;

                return {
                    chemical: card.chemical,
                    inventory: card.inventory,
                    shadowPrice: card.shadowPrice,
                    innerHTML: card.innerHTML.substring(0, 500) // First 500 chars
                };
            }, chem);

            console.log(`Chemical ${chem}:`, cardData ? JSON.stringify(cardData, null, 2) : 'NOT FOUND');
        }

        console.log('\n✅ Screenshots saved to:', CONFIG.screenshotDir);
        console.log('\nPress Ctrl+C to close browser...');

        // Keep browser open to inspect
        if (!CONFIG.headless) {
            await new Promise(() => {}); // Keep alive
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        if (CONFIG.headless) {
            await browser.close();
        }
    }
}

takeMarketplaceScreenshots();
