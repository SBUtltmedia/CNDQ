const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto('http://cndq.test/CNDQ/', { waitUntil: 'networkidle0' });
    await page.screenshot({ path: 'screenshot-current.png', fullPage: true });
    console.log('Screenshot saved to screenshot-current.png');
    await browser.close();
})();
