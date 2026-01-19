const puppeteer = require('puppeteer');

(async () => {
    // Launch browser
    const browser = await puppeteer.launch({
        headless: "new"
    });
    const page = await browser.newPage();
    
    // Set viewport to a standard desktop size
    await page.setViewport({ width: 1440, height: 900 });

    try {
        console.log('Logging in as Crafty Otter...');
        // Login via dev.php using the Herd domain
        await page.goto('http://cndq.test/CNDQ/dev.php?user=test_mail1@stonybrook.edu', { 
            waitUntil: 'networkidle0',
            timeout: 30000 
        });

        console.log('Waiting for marketplace to load...');
        // Wait for loading overlay to be hidden or removed
        await page.waitForFunction(() => {
            const overlay = document.getElementById('loading-overlay');
            if (!overlay) return true; // Removed from DOM
            return overlay.classList.contains('hidden') || overlay.style.display === 'none';
        }, { timeout: 30000 });

        // Wait a few more seconds for the specific cards to render
        await new Promise(r => setTimeout(r, 5000));

        console.log('Taking screenshot...');
        await page.screenshot({ 
            path: 'CNDQ/artifacts/screenshot-otter-debug.png',
            fullPage: true 
        });
        
        console.log('Screenshot saved to CNDQ/artifacts/screenshot-otter-debug.png');

        // Extract some debug info from the page
        const debugInfo = await page.evaluate(() => {
            const container = document.querySelector('chemical-card[chemical="D"]')?.shadowRoot?.querySelector('.ads-container');
            if (!container) return "Container not found";
            
            const styles = window.getComputedStyle(container);
            return {
                tagName: container.tagName,
                display: styles.display,
                height: styles.height,
                visibility: styles.visibility,
                opacity: styles.opacity,
                childCount: container.children.length,
                innerHTML: container.innerHTML.substring(0, 500)
            };
        });
        console.log('Debug Info for Chemical D ads-container:', JSON.stringify(debugInfo, null, 2));

    } catch (error) {
        console.error('Error during screenshot:', error);
    } finally {
        await browser.close();
    }
})();
