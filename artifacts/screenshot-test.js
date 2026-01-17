/**
 * Puppeteer screenshot test for Crafty Otter marketplace view
 */

const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        devtools: false
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Enable console logging
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('📢') || text.includes('🔧') || text.includes('🎪')) {
            console.log('PAGE LOG:', text);
        }
    });

    page.on('pageerror', error => {
        console.error('PAGE ERROR:', error.message);
    });

    try {
        console.log('Logging in as Crafty Otter...');
        await page.goto('http://cndq.test/CNDQ/dev.php?user=test_mail1@stonybrook.edu', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        console.log('Waiting for page to load...');
        await page.waitForSelector('chemical-card[chemical="D"]', { timeout: 10000 });

        // Wait for ads to load
        await new Promise(r => setTimeout(r, 3000));

        // Check Chemical D card
        const chemicalDInfo = await page.evaluate(() => {
            const card = document.querySelector('chemical-card[chemical="D"]');
            if (!card) return { error: 'Chemical D card not found' };

            const adItems = card.shadowRoot.querySelectorAll('advertisement-item');
            const ads = [];

            adItems.forEach(item => {
                const teamName = item.shadowRoot.querySelector('.team-name')?.textContent || 'Unknown';
                const sellButton = item.shadowRoot.querySelector('button');
                ads.push({
                    teamName,
                    hasSellButton: !!sellButton,
                    buttonText: sellButton?.textContent.trim() || 'No button'
                });
            });

            return {
                totalAds: adItems.length,
                ads
            };
        });

        console.log('\n=== CHEMICAL D CARD STATUS ===');
        console.log('Total advertisement items:', chemicalDInfo.totalAds);
        if (chemicalDInfo.ads && chemicalDInfo.ads.length > 0) {
            chemicalDInfo.ads.forEach((ad, i) => {
                console.log(`  ${i + 1}. ${ad.teamName} - Button: "${ad.buttonText}"`);
            });
        } else {
            console.log('  ❌ NO ADS FOUND');
        }

        // Screenshots
        const screenshotPath = path.join(__dirname, 'screenshot-crafty-otter.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`\n✓ Full page screenshot: ${screenshotPath}`);

        const cardElement = await page.$('chemical-card[chemical="D"]');
        if (cardElement) {
            const cardPath = path.join(__dirname, 'screenshot-chemical-d-card.png');
            await cardElement.screenshot({ path: cardPath });
            console.log(`✓ Chemical D card screenshot: ${cardPath}`);
        }

    } catch (error) {
        console.error('ERROR:', error.message);
        const errorPath = path.join(__dirname, 'screenshot-error.png');
        await page.screenshot({ path: errorPath, fullPage: true });
        console.log(`Error screenshot: ${errorPath}`);
    } finally {
        await browser.close();
        console.log('\nBrowser closed.');
    }
})();
