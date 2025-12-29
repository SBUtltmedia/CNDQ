/**
 * Puppeteer Test: Duplicate Advertisement Prevention
 * Tests that users cannot post duplicate advertisements
 */

const puppeteer = require('puppeteer');

const BASE_URL = 'http://cndq.test';
const TIMEOUT = 30000;

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForToast(page, expectedText, timeout = 5000) {
    try {
        await page.waitForFunction(
            (text) => {
                const toasts = Array.from(document.querySelectorAll('#toast-container > div'));
                return toasts.some(toast => toast.textContent.includes(text));
            },
            { timeout },
            expectedText
        );
        return true;
    } catch (error) {
        return false;
    }
}

async function getToastText(page) {
    return page.evaluate(() => {
        const toasts = Array.from(document.querySelectorAll('#toast-container > div'));
        return toasts.map(toast => toast.textContent.trim());
    });
}

async function clickPostButton(page, chemical, type) {
    const selector = `chemical-card[chemical="${chemical}"] #post-${type}-btn`;
    await page.waitForSelector(selector, { visible: true });
    await page.click(selector);
    await sleep(500); // Wait for toast animation
}

async function runTests() {
    console.log('╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║         Duplicate Advertisement Prevention Tests                 ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1280, height: 800 },
        args: ['--no-sandbox']
    });

    const page = await browser.newPage();

    // Enable console logging
    page.on('console', msg => {
        const type = msg.type();
        if (type === 'error' || type === 'warning') {
            console.log(`  [Browser ${type}]:`, msg.text());
        }
    });

    let testsPassed = 0;
    let testsFailed = 0;

    try {
        console.log('📱 Navigating to marketplace...\n');
        await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: TIMEOUT });

        // Wait for app to initialize
        await page.waitForSelector('#app:not(.hidden)', { timeout: TIMEOUT });
        await sleep(2000); // Wait for data to load

        console.log('═'.repeat(70));
        console.log('TEST 1: First Advertisement Post (Should Succeed)');
        console.log('═'.repeat(70));

        await clickPostButton(page, 'C', 'sell');

        const foundSuccess = await waitForToast(page, 'Posted interest to sell C');

        if (foundSuccess) {
            console.log('✓ PASS: Successfully posted sell advertisement for Chemical C\n');
            testsPassed++;
        } else {
            const toasts = await getToastText(page);
            console.log('✗ FAIL: Did not see success toast');
            console.log('  Toasts found:', toasts);
            testsFailed++;
        }

        // Wait for toast to clear
        await sleep(3500);

        console.log('═'.repeat(70));
        console.log('TEST 2: Duplicate Advertisement (Should Be Prevented)');
        console.log('═'.repeat(70));

        await clickPostButton(page, 'C', 'sell');

        const foundWarning = await waitForToast(page, 'You already have an active sell advertisement for Chemical C');

        if (foundWarning) {
            console.log('✓ PASS: Duplicate advertisement prevented\n');
            testsPassed++;
        } else {
            const toasts = await getToastText(page);
            console.log('✗ FAIL: Did not see warning toast for duplicate');
            console.log('  Toasts found:', toasts);
            testsFailed++;
        }

        // Wait for toast to clear
        await sleep(3500);

        console.log('═'.repeat(70));
        console.log('TEST 3: Different Type (Should Succeed)');
        console.log('═'.repeat(70));

        // Try posting a BUY ad for same chemical (should work)
        await clickPostButton(page, 'C', 'buy');

        const foundBuySuccess = await waitForToast(page, 'Posted interest to buy C');

        if (foundBuySuccess) {
            console.log('✓ PASS: Can post buy ad even with existing sell ad\n');
            testsPassed++;
        } else {
            const toasts = await getToastText(page);
            console.log('✗ FAIL: Should allow different type of ad');
            console.log('  Toasts found:', toasts);
            testsFailed++;
        }

        // Wait for toast to clear
        await sleep(3500);

        console.log('═'.repeat(70));
        console.log('TEST 4: Different Chemical (Should Succeed)');
        console.log('═'.repeat(70));

        // Try posting a sell ad for different chemical (should work)
        await clickPostButton(page, 'N', 'sell');

        const foundNSuccess = await waitForToast(page, 'Posted interest to sell N');

        if (foundNSuccess) {
            console.log('✓ PASS: Can post ad for different chemical\n');
            testsPassed++;
        } else {
            const toasts = await getToastText(page);
            console.log('✗ FAIL: Should allow ad for different chemical');
            console.log('  Toasts found:', toasts);
            testsFailed++;
        }

        // Wait for toast to clear
        await sleep(3500);

        console.log('═'.repeat(70));
        console.log('TEST 5: Verify Marketplace Shows Ads');
        console.log('═'.repeat(70));

        // Check that ads appear in the marketplace
        const adCount = await page.evaluate(() => {
            const sellAdsC = document.querySelector('chemical-card[chemical="C"] #sell-ads');
            const buyAdsC = document.querySelector('chemical-card[chemical="C"] #buy-ads');
            const sellAdsN = document.querySelector('chemical-card[chemical="N"] #sell-ads');

            const sellCCount = sellAdsC ? sellAdsC.querySelectorAll('advertisement-item').length : 0;
            const buyCCount = buyAdsC ? buyAdsC.querySelectorAll('advertisement-item').length : 0;
            const sellNCount = sellAdsN ? sellAdsN.querySelectorAll('advertisement-item').length : 0;

            return { sellCCount, buyCCount, sellNCount };
        });

        console.log(`  Chemical C - Sell ads: ${adCount.sellCCount}, Buy ads: ${adCount.buyCCount}`);
        console.log(`  Chemical N - Sell ads: ${adCount.sellNCount}`);

        if (adCount.sellCCount >= 1 && adCount.buyCCount >= 1 && adCount.sellNCount >= 1) {
            console.log('✓ PASS: All posted ads visible in marketplace\n');
            testsPassed++;
        } else {
            console.log('✗ FAIL: Not all ads are visible in marketplace\n');
            testsFailed++;
        }

        console.log('═'.repeat(70));
        console.log('TEST 6: Multiple Rapid Clicks (Should All Be Prevented)');
        console.log('═'.repeat(70));

        // Rapidly click the same button 5 times
        for (let i = 0; i < 5; i++) {
            await clickPostButton(page, 'D', 'sell');
            await sleep(100); // Very short delay between clicks
        }

        await sleep(2000); // Wait for all toasts

        const allToasts = await getToastText(page);
        const warningCount = allToasts.filter(t => t.includes('already have an active')).length;

        console.log(`  Rapid clicks resulted in ${warningCount} warning toasts`);

        if (warningCount >= 4) {
            console.log('✓ PASS: Rapid duplicate clicks properly prevented\n');
            testsPassed++;
        } else {
            console.log('✗ FAIL: Should have shown warnings for duplicate clicks');
            console.log('  All toasts:', allToasts);
            testsFailed++;
        }

    } catch (error) {
        console.error('\n❌ Test execution error:', error.message);
        testsFailed++;
    } finally {
        console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
        console.log('║                          TEST SUMMARY                             ║');
        console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

        console.log(`  Tests Passed: ${testsPassed}/6`);
        console.log(`  Tests Failed: ${testsFailed}/6`);
        console.log();

        if (testsFailed === 0) {
            console.log('  ✅ All duplicate advertisement prevention tests PASSED!\n');
        } else {
            console.log(`  ⚠️  ${testsFailed} test(s) FAILED\n`);
        }

        await browser.close();

        // Exit with appropriate code
        process.exit(testsFailed > 0 ? 1 : 0);
    }
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
