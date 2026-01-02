/**
 * Debug Loading Test
 * Checks for JavaScript errors during page load
 */

const puppeteer = require('puppeteer');

async function debugLoad() {
    console.log('\n🔍 Debug Loading Test\n');
    console.log('=' .repeat(80));

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 100,
        args: ['--no-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Collect console messages
        const messages = [];
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            messages.push({ type, text });
            console.log(`[${type.toUpperCase()}] ${text}`);
        });

        // Collect errors
        const errors = [];
        page.on('pageerror', error => {
            errors.push(error.message);
            console.error('❌ PAGE ERROR:', error.message);
        });

        // Collect failed requests
        const failedRequests = [];
        page.on('requestfailed', request => {
            const failure = `${request.url()} - ${request.failure().errorText}`;
            failedRequests.push(failure);
            console.error('❌ REQUEST FAILED:', failure);
        });

        console.log('\n📍 Navigating to http://cndq.test/CNDQ/\n');

        await page.goto('http://cndq.test/CNDQ/', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        console.log('\n✓ Page loaded\n');

        // Wait a bit for any delayed errors
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Summary
        console.log('\n' + '='.repeat(80));
        console.log('SUMMARY');
        console.log('='.repeat(80));
        console.log(`Console messages: ${messages.length}`);
        console.log(`Page errors: ${errors.length}`);
        console.log(`Failed requests: ${failedRequests.length}`);

        if (errors.length > 0) {
            console.log('\n⚠️  Page Errors:');
            errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
        }

        if (failedRequests.length > 0) {
            console.log('\n⚠️  Failed Requests:');
            failedRequests.forEach((req, i) => console.log(`  ${i + 1}. ${req}`));
        }

        // Check specific elements
        console.log('\n📦 Checking Elements:');
        const checks = {
            'Loading overlay': await page.$('#loading-overlay'),
            'Header': await page.$('header'),
            'Chemical cards': (await page.$$('chemical-card')).length,
            'Main script': await page.$('#main-app-script')
        };

        for (const [name, result] of Object.entries(checks)) {
            const status = result ? '✓' : '✗';
            const value = typeof result === 'number' ? `${result}` : (result ? 'found' : 'missing');
            console.log(`  ${status} ${name}: ${value}`);
        }

        // Check if loading overlay is still visible
        const loadingVisible = await page.evaluate(() => {
            const overlay = document.getElementById('loading-overlay');
            if (!overlay) return 'not found';
            const display = window.getComputedStyle(overlay).display;
            return display === 'none' ? 'hidden' : 'visible';
        });

        console.log(`\n  Loading overlay status: ${loadingVisible}`);
        if (loadingVisible === 'visible') {
            console.log('  ⚠️  Loading overlay is still showing!');
        }

        console.log('\n⏸️  Browser left open. Close manually to exit.\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        throw error;
    }
}

debugLoad().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
