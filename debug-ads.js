const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const page = await browser.newPage();

    // Set cookie to login as test_mail1
    await page.setCookie({
        name: 'mock_mail',
        value: 'test_mail1@stonybrook.edu',
        domain: 'cndq.test',
        path: '/'
    });

    console.log('🌐 Navigating to marketplace...');
    await page.goto('http://cndq.test/CNDQ/', { waitUntil: 'networkidle0' });

    // Wait a bit for everything to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n📊 Checking Chemical Cards...\n');

    // Check each chemical card
    for (const chemical of ['C', 'N', 'D', 'Q']) {
        console.log(`\n=== Chemical ${chemical} ===`);

        // Get the shadow root content
        const cardData = await page.evaluate((chem) => {
            const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
            if (!card) return { error: 'Card not found' };

            const shadowRoot = card.shadowRoot;
            if (!shadowRoot) return { error: 'No shadow root' };

            const adsContainer = shadowRoot.querySelector('.ads-container');
            if (!adsContainer) return { error: 'No ads-container' };

            const emptyMsg = adsContainer.querySelector('.empty-ads');
            const adItems = adsContainer.querySelectorAll('advertisement-item');

            const results = {
                hasEmptyMessage: !!emptyMsg,
                emptyMessageText: emptyMsg ? emptyMsg.textContent : null,
                adItemCount: adItems.length,
                adItems: []
            };

            // Check each ad-item
            adItems.forEach((adItem, index) => {
                const adShadow = adItem.shadowRoot;
                const info = {
                    index,
                    hasShadowRoot: !!adShadow,
                    teamName: adItem.teamName,
                    adId: adItem.adId,
                    isMyAd: adItem.isMyAd
                };

                if (adShadow) {
                    const adDiv = adShadow.querySelector('.ad-item');
                    const teamNameEl = adShadow.querySelector('.team-name');
                    const button = adShadow.querySelector('.btn');

                    info.hasAdDiv = !!adDiv;
                    info.adDivHTML = adDiv ? adDiv.innerHTML : null;
                    info.teamNameText = teamNameEl ? teamNameEl.textContent : null;
                    info.hasButton = !!button;
                    info.buttonText = button ? button.textContent : null;
                }

                results.adItems.push(info);
            });

            return results;
        }, chemical);

        console.log(JSON.stringify(cardData, null, 2));
    }

    console.log('\n\n📸 Taking screenshot...');
    await page.screenshot({ path: 'debug-ads-screenshot.png', fullPage: true });
    console.log('Screenshot saved to debug-ads-screenshot.png');

    console.log('\n\n⏸️  Browser left open for inspection. Press Ctrl+C to close.');

    // Keep browser open
    // await browser.close();
})();
