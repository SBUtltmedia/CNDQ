#!/usr/bin/env node
/**
 * Test Base Path Detection
 *
 * Verifies that API calls use the correct base path when the app is in a subdirectory
 */

const puppeteer = require('puppeteer');

async function testBasePath() {
    console.log('🧪 Testing Base Path Detection\n');
    console.log('Target URL: http://cndq.test/CNDQ\n');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Track all network requests
    const apiRequests = [];

    page.on('request', request => {
        const url = request.url();

        // Only track API requests
        if (url.includes('/api/')) {
            apiRequests.push({
                url: url,
                method: request.method()
            });
        }
    });

    // Track all console messages
    page.on('console', msg => {
        const type = msg.type();
        const text = msg.text();
        if (type === 'error') {
            console.log('❌ Console Error:', text);
        } else if (text.includes('[API]')) {
            console.log('🔍', text);
        }
    });

    // Track failed requests
    page.on('requestfailed', request => {
        console.log('❌ Request Failed:', request.url(), request.failure().errorText);
    });

    try {
        console.log('📍 Navigating to http://cndq.test/CNDQ...\n');

        // Navigate and wait for network to settle
        await page.goto('http://cndq.test/CNDQ', {
            waitUntil: 'networkidle2',
            timeout: 10000
        });

        // Wait a bit more for any async requests
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Analyze the requests
        console.log('📊 API Request Analysis:\n');
        console.log(`Total API requests: ${apiRequests.length}\n`);

        if (apiRequests.length === 0) {
            console.log('⚠️  No API requests detected. The page might not have loaded correctly.\n');
        } else {
            const correctRequests = apiRequests.filter(req => req.url.includes('/CNDQ/api/'));
            const incorrectRequests = apiRequests.filter(req =>
                req.url.includes('/api/') && !req.url.includes('/CNDQ/api/')
            );

            console.log('✅ Correct paths (include /CNDQ/api/):');
            correctRequests.forEach(req => {
                console.log(`   ${req.method} ${req.url}`);
            });

            if (incorrectRequests.length > 0) {
                console.log('\n❌ INCORRECT paths (missing /CNDQ/ prefix):');
                incorrectRequests.forEach(req => {
                    console.log(`   ${req.method} ${req.url}`);
                });
                console.log('\n⚠️  BASE PATH DETECTION IS BROKEN!');
                console.log('   API calls should go to http://cndq.test/CNDQ/api/');
                console.log('   but they are going to http://cndq.test/api/\n');
            } else {
                console.log('\n✅ All API requests use correct base path!');
            }
        }

        // Get the detected base path from the page
        const basePath = await page.evaluate(() => {
            // Try to get from api.js module if available
            return window.location.pathname.split('/').slice(0, -1).join('/') || '/';
        });

        console.log(`\n📁 Detected base path: ${basePath}`);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await browser.close();
    }
}

testBasePath().catch(console.error);
