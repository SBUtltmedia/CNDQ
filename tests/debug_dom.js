const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    await page.goto('http://cndq.test/CNDQ/dev.php?user=test_mail1@stonybrook.edu');
    await page.goto('http://cndq.test/CNDQ/');
    await new Promise(r => setTimeout(r, 5000));

    const domInfo = await page.evaluate(() => {
        const modal = document.getElementById('offer-modal');
        const prodModal = document.getElementById('production-results-modal');
        return {
            offerModal: {
                exists: !!modal,
                classes: modal ? modal.className : '',
                hidden: modal ? modal.classList.contains('hidden') : null
            },
            prodModal: {
                exists: !!prodModal,
                classes: prodModal ? prodModal.className : '',
                hidden: prodModal ? prodModal.classList.contains('hidden') : null
            },
            body: document.body.innerHTML.substring(0, 500)
        };
    });

    console.log(JSON.stringify(domInfo, null, 2));
    await browser.close();
})();
