const puppeteer = require('puppeteer');

async function testInitialModal() {
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 100
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        page.on('console', msg => console.log('BROWSER:', msg.text()));

        // Step 1: Reset game
        console.log('Step 1: Reset game');
        await page.goto('http://cndq.test/CNDQ/index.php?mock_mail=admin@stonybrook.edu');
        await new Promise(r => setTimeout(r, 2000));

        await page.evaluate(async () => {
            await fetch('/CNDQ/api/admin/reset-game.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        });
        await new Promise(r => setTimeout(r, 1000));

        // Step 2: Load as NEW user (triggers session 0 production modal)
        console.log('\nStep 2: Load as alpha team - SHOULD SHOW SESSION 0 MODAL');
        await page.goto('http://cndq.test/CNDQ/index.php?mock_mail=alpha@stonybrook.edu');
        await new Promise(r => setTimeout(r, 5000));

        // Check modal visibility
        const modalState = await page.evaluate(() => {
            const modal = document.getElementById('production-results-modal');
            const complete = document.getElementById('production-complete');
            const sessionSpan = document.getElementById('prod-result-session');
            return {
                modalVisible: modal && !modal.classList.contains('hidden'),
                completeVisible: complete && !complete.classList.contains('hidden'),
                sessionNumber: sessionSpan ? sessionSpan.textContent : null
            };
        });

        console.log('\nModal state:', modalState);

        if (modalState.modalVisible && modalState.completeVisible) {
            console.log(`✅ SUCCESS: Production modal showing for session ${modalState.sessionNumber}`);
        } else {
            console.log('❌ FAIL: Production modal is NOT showing');
        }

        await page.screenshot({ path: 'test-initial-modal.png', fullPage: true });
        await new Promise(r => setTimeout(r, 5000));

    } catch (error) {
        console.error('❌ Test error:', error);
    } finally {
        await browser.close();
    }
}

testInitialModal();
