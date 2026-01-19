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

            const listingsContainer = shadowRoot.querySelector('.listings-container');
            if (!listingsContainer) return { error: 'No listings-container' };

            const emptyMsg = listingsContainer.querySelector('.empty-listings');
            const adItems = listingsContainer.querySelectorAll('listing-item');

            const results = {
                hasEmptyMessage: !!emptyMsg,
                emptyMessageText: emptyMsg ? emptyMsg.textContent : null,
                listingItemCount: adItems.length,
                listingItems: []
            };

            // Check each listing-item
            adItems.forEach((adItem, index) => {
                const adShadow = adItem.shadowRoot;
                const info = {
                    index,
                    hasShadowRoot: !!adShadow,
                    teamName: adItem.teamName,
                    listingId: adItem.adId,
                    isMyListing: adItem.isMyAd
                };

                if (adShadow) {
                    const adDiv = adShadow.querySelector('.listing-item');
                    const teamNameEl = adShadow.querySelector('.team-name');
                    const button = adShadow.querySelector('.btn');

                    info.hasListingDiv = !!adDiv;
                    info.listingDivHTML = adDiv ? adDiv.innerHTML : null;
                    info.teamNameText = teamNameEl ? teamNameEl.textContent : null;
                    info.hasButton = !!button;
                    info.buttonText = button ? button.textContent : null;
                }

                results.listingItems.push(info);
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
