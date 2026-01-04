const puppeteer = require('puppeteer');

async function testProductionModal() {
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 100
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // Enable console logging
        page.on('console', msg => console.log('BROWSER:', msg.text()));

        console.log('📋 Step 1: Reset game as admin');
        await page.goto('http://cndq.test/CNDQ/index.php?mock_mail=admin@stonybrook.edu');
        await new Promise(r => setTimeout(r, 2000));

        // Reset the game
        const resetResponse = await page.evaluate(async () => {
            const res = await fetch('/CNDQ/api/admin/reset-game.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            return await res.json();
        });
        console.log('Reset response:', resetResponse);
        await new Promise(r => setTimeout(r, 2000));

        console.log('📋 Step 2: Check session status for productionJustRan flag');
        const sessionStatus = await page.evaluate(async () => {
            const res = await fetch('/CNDQ/api/session/status.php');
            return await res.json();
        });
        console.log('Session status:', sessionStatus);

        console.log('📋 Step 3: Load page as alpha team');
        await page.goto('http://cndq.test/CNDQ/index.php?mock_mail=alpha@stonybrook.edu');
        await new Promise(r => setTimeout(r, 3000));

        // Take screenshot
        await page.screenshot({ path: 'test-production-modal-1-initial.png', fullPage: true });
        console.log('Screenshot 1: Initial page load');

        // Check if modal is visible
        const modalVisible = await page.evaluate(() => {
            const modal = document.getElementById('production-results-modal');
            const inProgress = document.getElementById('production-in-progress');
            const complete = document.getElementById('production-complete');

            return {
                modalHidden: modal ? modal.classList.contains('hidden') : null,
                inProgressHidden: inProgress ? inProgress.classList.contains('hidden') : null,
                completeHidden: complete ? complete.classList.contains('hidden') : null,
                modalExists: !!modal,
                inProgressExists: !!inProgress,
                completeExists: !!complete
            };
        });
        console.log('Modal state:', modalVisible);

        // Wait for any async operations
        await new Promise(r => setTimeout(r, 5000));

        // Take another screenshot
        await page.screenshot({ path: 'test-production-modal-2-after-wait.png', fullPage: true });
        console.log('Screenshot 2: After 5 second wait');

        // Check session status again from browser
        const sessionStatus2 = await page.evaluate(async () => {
            const res = await fetch('/CNDQ/api/session/status.php');
            return await res.json();
        });
        console.log('Session status (from browser):', sessionStatus2);

        // Check production history
        const productionHistory = await page.evaluate(async () => {
            const res = await fetch('/CNDQ/api/production/results.php');
            return await res.json();
        });
        console.log('Production history:', productionHistory);

        console.log('\n✅ Test complete. Check screenshots: test-production-modal-*.png');

        await new Promise(r => setTimeout(r, 5000));

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await browser.close();
    }
}

testProductionModal();
