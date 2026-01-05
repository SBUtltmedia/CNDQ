#!/usr/bin/env node
const puppeteer = require('puppeteer');

async function testAdminPaths() {
    console.log('Testing admin page at http://cndq.test/CNDQ/admin/\n');

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    // Set dev_user cookie
    await page.setCookie({
        name: 'mock_mail',
        value: 'dev_user@localhost',
        domain: 'cndq.test',
        path: '/'
    });

    page.on('requestfailed', request => {
        console.log('❌ Request Failed:', request.url(), request.failure().errorText);
    });

    const apiRequests = [];
    page.on('request', request => {
        if (request.url().includes('/api/')) {
            apiRequests.push(request.url());
        }
    });

    page.on('console', msg => {
        if (msg.text().includes('Failed')) {
            console.log('❌', msg.text());
        }
    });

    try {
        await page.goto('http://cndq.test/CNDQ/admin/', {
            waitUntil: 'networkidle2',
            timeout: 10000
        });
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log(`📊 API Requests from admin page:\n`);

        const correctPaths = apiRequests.filter(url => url.includes('/CNDQ/api/'));
        const incorrectPaths = apiRequests.filter(url =>
            url.includes('/api/') && !url.includes('/CNDQ/api/')
        );

        if (correctPaths.length > 0) {
            console.log('✅ Correct paths:');
            correctPaths.forEach(url => console.log(`   ${url}`));
        }

        if (incorrectPaths.length > 0) {
            console.log('\n❌ INCORRECT paths:');
            incorrectPaths.forEach(url => console.log(`   ${url}`));
            console.log('\n⚠️  Admin page base path detection is broken!');
        } else if (correctPaths.length > 0) {
            console.log('\n✅ All admin API requests use correct base path!');
        } else {
            console.log('⚠️  No API requests detected');
        }

    } catch (e) {
        console.log(`❌ Error: ${e.message}`);
    }

    await browser.close();
}

testAdminPaths();
