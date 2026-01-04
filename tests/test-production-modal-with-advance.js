const puppeteer = require('puppeteer');

async function testProductionModalWithAdvance() {
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

        console.log('📋 Step 2: Load page as alpha team');
        await page.goto('http://cndq.test/CNDQ/index.php?mock_mail=alpha@stonybrook.edu');
        await new Promise(r => setTimeout(r, 3000));

        // Check initial inventory
        const initialProfile = await page.evaluate(async () => {
            const res = await fetch('/CNDQ/api/team/profile.php');
            return await res.json();
        });
        console.log('Initial profile:', {
            funds: initialProfile.currentFunds,
            inventory: initialProfile.inventory
        });

        await page.screenshot({ path: 'test-modal-1-initial-load.png', fullPage: true });
        console.log('Screenshot 1: Initial page load (should NOT show modal - no production yet)');

        console.log('\n📋 Step 3: Manually advance session (trigger production)');
        await page.goto('http://cndq.test/CNDQ/index.php?mock_mail=admin@stonybrook.edu');
        await new Promise(r => setTimeout(r, 2000));

        const advanceResponse = await page.evaluate(async () => {
            const res = await fetch('/CNDQ/api/admin/session.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'advance' })
            });
            return await res.json();
        });
        console.log('Advance response:', advanceResponse);

        console.log('\n📋 Step 4: Check session status after advance');
        const sessionStatus = await page.evaluate(async () => {
            const res = await fetch('/CNDQ/api/session/status.php');
            return await res.json();
        });
        console.log('Session status:', sessionStatus);

        console.log('\n📋 Step 5: Load alpha page again (should show production modal)');
        await page.goto('http://cndq.test/CNDQ/index.php?mock_mail=alpha@stonybrook.edu');
        await new Promise(r => setTimeout(r, 3000));

        // Check if modal is visible
        const modalState = await page.evaluate(() => {
            const modal = document.getElementById('production-results-modal');
            const inProgress = document.getElementById('production-in-progress');
            const complete = document.getElementById('production-complete');

            return {
                modalHidden: modal?.classList.contains('hidden'),
                inProgressHidden: inProgress?.classList.contains('hidden'),
                completeHidden: complete?.classList.contains('hidden'),
                modalExists: !!modal
            };
        });
        console.log('Modal state after advance:', modalState);

        await page.screenshot({ path: 'test-modal-2-after-advance.png', fullPage: true });
        console.log('Screenshot 2: After session advance (SHOULD show modal)');

        // Wait to see modal
        await new Promise(r => setTimeout(r, 5000));

        const finalProfile = await page.evaluate(async () => {
            const res = await fetch('/CNDQ/api/team/profile.php');
            return await res.json();
        });
        console.log('Final profile after production:', {
            funds: finalProfile.currentFunds,
            inventory: finalProfile.inventory
        });

        await page.screenshot({ path: 'test-modal-3-final.png', fullPage: true });
        console.log('Screenshot 3: Final state');

        console.log('\n✅ Test complete. Check screenshots: test-modal-*.png');

        await new Promise(r => setTimeout(r, 5000));

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await browser.close();
    }
}

testProductionModalWithAdvance();
