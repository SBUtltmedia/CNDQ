const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    try {
        await page.goto('http://cndq.test/CNDQ/', { waitUntil: 'networkidle0', timeout: 10000 });

        // Wait a bit for any dynamic content
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Scroll down to see chemical cards
        await page.evaluate(() => window.scrollBy(0, 500));
        await new Promise(resolve => setTimeout(resolve, 500));

        await page.screenshot({ path: 'screenshot-with-cards.png', fullPage: false });
        console.log('Screenshot with cards saved to screenshot-with-cards.png');
    } catch (error) {
        console.error('Error taking screenshot:', error.message);
        // Take screenshot anyway
        await page.screenshot({ path: 'screenshot-with-cards.png', fullPage: false });
    }

    await browser.close();
})();
