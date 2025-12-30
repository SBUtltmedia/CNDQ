#!/usr/bin/env node
// Test both root and subdirectory paths
const puppeteer = require('puppeteer');

async function testEnvironment(url, expectedPrefix) {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    const apiRequests = [];
    page.on('request', request => {
        if (request.url().includes('/api/')) apiRequests.push(request.url());
    });

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
        await new Promise(resolve => setTimeout(resolve, 1000));

        const allCorrect = apiRequests.every(req => req.includes(expectedPrefix));
        console.log(`${allCorrect ? '✅' : '❌'} ${url}`);
        console.log(`   Expected: ${expectedPrefix}/api/...`);
        if (apiRequests.length > 0) {
            console.log(`   Sample: ${apiRequests[0]}`);
        }
        console.log();
    } catch (e) {
        console.log(`❌ ${url} - ${e.message}\n`);
    }

    await browser.close();
}

(async () => {
    console.log('Testing both environments:\n');
    await testEnvironment('http://cndq.test/', 'http://cndq.test');
    await testEnvironment('http://cndq.test/CNDQ', 'http://cndq.test/CNDQ');
})();
