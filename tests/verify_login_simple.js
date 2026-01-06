const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    console.log('🚀 Starting Login Verification Test...');

    const browser = await puppeteer.launch({
        headless: "new", // Use new headless mode
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const baseUrl = 'http://cndq.test/CNDQ';
    const userEmail = 'test_mail1@stonybrook.edu';

    try {
        // 1. Navigate to dev_login
        console.log(`📍 Navigating to ${baseUrl}/dev_login.php`);
        await page.goto(`${baseUrl}/dev_login.php`, { waitUntil: 'networkidle2' });

        // 2. Click on the user link
        console.log(`👤 Clicking login for ${userEmail}...`);
        
        // Find the link with the specific user email
        // We do NOT encodeURIComponent because the HTML source has raw '@'
        const linkSelector = `a[href*="user=${userEmail}"]`;
        await page.waitForSelector(linkSelector);
        
        // Click and wait for navigation
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.click(linkSelector),
        ]);

        console.log('🔄 Redirected. Checking for Marketplace elements...');

        // 3. Verify we are on the main page and authenticated
        // Check for key elements that only appear when logged in and app is running
        try {
            await page.waitForSelector('#app', { timeout: 5000 });
            await page.waitForSelector('#current-funds', { timeout: 5000 });
            await page.waitForSelector('#team-name', { timeout: 5000 });
        } catch (e) {
            throw new Error('Marketplace elements (#app, #current-funds, #team-name) not found. Login might have failed.');
        }

        // 4. Validate Team Name matches expectation (optional but good)
        const teamName = await page.$eval('#team-name', el => el.textContent.trim());
        console.log(`✅ Logged in successfully! Team Name: "${teamName}"`);

        // 5. Take a screenshot for evidence
        const screenshotPath = path.resolve(__dirname, 'login_success.png');
        await page.screenshot({ path: screenshotPath });
        console.log(`📸 Screenshot saved to: ${screenshotPath}`);

    } catch (error) {
        console.error('❌ Test Failed:', error.message);
        const errorScreenshotPath = path.resolve(__dirname, 'login_failure.png');
        await page.screenshot({ path: errorScreenshotPath });
        console.error(`📸 Error screenshot saved to: ${errorScreenshotPath}`);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
