const puppeteer = require('puppeteer');

async function testModal() {
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 100
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        page.on('console', msg => console.log('BROWSER:', msg.text()));

        // Reset game
        console.log('Step 1: Reset');
        await page.goto('http://cndq.test/CNDQ/index.php?mock_mail=admin@stonybrook.edu');
        await new Promise(r => setTimeout(r, 2000));

        await page.evaluate(async () => {
            await fetch('/CNDQ/api/admin/reset-game.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        });

        // Load as alpha (session 1)
        console.log('Step 2: Load as alpha (session 1)');
        await page.goto('http://cndq.test/CNDQ/index.php?mock_mail=alpha@stonybrook.edu');
        await new Promise(r => setTimeout(r, 3000));

        // Advance to session 2 (runs production for session 1)
        console.log('Step 3: Advance to session 2');
        await page.goto('http://cndq.test/CNDQ/index.php?mock_mail=admin@stonybrook.edu');
        await new Promise(r => setTimeout(r, 2000));

        await page.evaluate(async () => {
            await fetch('/CNDQ/api/admin/session.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'advance' })
            });
        });

        // Reload as alpha - should show production modal
        console.log('Step 4: Reload as alpha - SHOULD SHOW MODAL');
        await page.goto('http://cndq.test/CNDQ/index.php?mock_mail=alpha@stonybrook.edu');
        await new Promise(r => setTimeout(r, 5000));

        // Check modal visibility
        const modalState = await page.evaluate(() => {
            const modal = document.getElementById('production-results-modal');
            const complete = document.getElementById('production-complete');
            return {
                modalVisible: modal && !modal.classList.contains('hidden'),
                completeVisible: complete && !complete.classList.contains('hidden')
            };
        });

        console.log('\nModal state:', modalState);

        if (modalState.modalVisible && modalState.completeVisible) {
            console.log('✅ SUCCESS: Production modal is showing!');
        } else {
            console.log('❌ FAIL: Production modal is NOT showing');
        }

        await page.screenshot({ path: 'test-modal-final.png', fullPage: true });
        await new Promise(r => setTimeout(r, 5000));

    } catch (error) {
        console.error('❌ Test error:', error);
    } finally {
        await browser.close();
    }
}

testModal();
