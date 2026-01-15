const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Capture console messages
    page.on('console', async msg => {
        const text = msg.text();
        if (text.includes('[DEBUG]')) {
            // Get all the arguments
            const args = await Promise.all(msg.args().map(arg => arg.jsonValue()));
            console.log(msg.type(), ...args);
        }
    });

    await page.setViewport({ width: 1920, height: 1080 });

    try {
        await page.goto('http://cndq.test/CNDQ/', { waitUntil: 'networkidle0', timeout: 10000 });

        // Wait for the page to fully load and render
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log('Page loaded, console logs captured above');
    } catch (error) {
        console.error('Error:', error.message);
    }

    await browser.close();
})();
