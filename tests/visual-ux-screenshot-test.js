/**
 * Visual UX Screenshot Test
 *
 * Role plays Admin and 3 Students to capture UI state in screenshots.
 * Validates the UX by capturing "all aspects of the changed UI".
 *
 * Usage:
 *   node tests/visual-ux-screenshot-test.js
 *   node tests/visual-ux-screenshot-test.js --headless
 */

const fs = require('fs');
const path = require('path');
const BrowserHelper = require('./helpers/browser');

const CONFIG = {
    baseUrl: 'http://cndq.test/CNDQ/',
    adminUser: 'admin@stonybrook.edu',
    testUsers: [
        'test_student1@stonybrook.edu',
        'test_student2@stonybrook.edu',
        'test_student3@stonybrook.edu'
    ],
    targetSessions: 2,
    headless: process.argv.includes('--headless'),
    verbose: true,
    screenshotDir: path.join(__dirname, 'screenshots', 'ux-test')
};

// Ensure screenshot directory exists
if (!fs.existsSync(CONFIG.screenshotDir)) {
    fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
}

class VisualUXTest {
    constructor(config) {
        this.config = config;
        this.browser = new BrowserHelper(config);
    }

    async run() {
        console.log('📸 Visual UX Screenshot Test Starting...');
        console.log(`   Output Directory: ${this.config.screenshotDir}`);
        
        try {
            await this.browser.launch();
            
            // --- SESSION 1 ---
            console.log('\n--- SESSION 1 ---');

            // 1. Admin Reset & Start
            await this.adminSetup();

            // 2. Students Play (Session 1)
            for (let i = 0; i < this.config.testUsers.length; i++) {
                await this.studentPlaySession1(this.config.testUsers[i], i + 1);
            }

            // 3. Admin Advance Session
            await this.adminAdvanceSession(1);

            // --- SESSION 2 ---
            console.log('\n--- SESSION 2 ---');

            // 4. Students Play (Session 2)
            for (let i = 0; i < this.config.testUsers.length; i++) {
                await this.studentPlaySession2(this.config.testUsers[i], i + 1);
            }

            console.log('\n✅ Test Complete. Check screenshots.');
            
        } catch (error) {
            console.error('❌ Test Failed:', error);
        } finally {
            await this.browser.close();
        }
    }

    async takeScreenshot(page, name) {
        const filePath = path.join(this.config.screenshotDir, `${name}.png`);
        await page.screenshot({ path: filePath, fullPage: true });
        console.log(`   🖼️  Screenshot saved: ${name}.png`);
    }

    async adminSetup() {
        console.log('👤 Admin: Setting up game...');
        const page = await this.browser.loginAndNavigate(this.config.adminUser, 'admin/');

        // Screenshot Admin Dashboard Initial
        await this.takeScreenshot(page, '01-admin-dashboard-initial');

        // Reset Game (Try to find the button by text if ID fails)
        console.log('   Resetting Game...');
        
        // Debug: Dump HTML
        const html = await page.content();
        fs.writeFileSync(path.join(this.config.screenshotDir, 'debug-admin-page.html'), html);
        
        // Use CSS selector for onclick attribute which is more robust than text with emojis
        const resetBtn = await page.$('button[onclick="resetGameData()"]');
        
        if (resetBtn) {
            await resetBtn.click();
        } else {
            console.log('   ⚠️ Reset button not found by onclick, trying text...');
            const resetBtnText = await page.$('::-p-xpath(//button[contains(text(), "RESET GAME")])');
            if (resetBtnText) {
                 await resetBtnText.click();
            } else {
                console.error('   ❌ Could not find reset button!');
                throw new Error('Reset button missing');
            }
        }
        
        // Handle confirm dialogs (Admin page uses custom confirm modal now?)
        // The admin/index.php uses a custom #confirm-modal div, not window.confirm!
        // We need to handle that.
        
        try {
             await page.waitForSelector('#confirm-modal:not(.hidden)', { timeout: 3000 });
             console.log('   Handling custom confirm modal 1...');
             await page.click('#confirm-modal-yes');
             await this.browser.sleep(1000);
             
             // Second confirmation for "Danger Zone" reset
             await page.waitForSelector('#confirm-modal:not(.hidden)', { timeout: 3000 });
             console.log('   Handling custom confirm modal 2...');
             await page.click('#confirm-modal-yes');
        } catch (e) {
            console.log('   ℹ️ Custom modal handling skipped or failed (might utilize native dialogs in some versions?): ' + e.message);
            // Fallback for native dialogs if the page used them (old version)
            page.on('dialog', async dialog => await dialog.accept());
        }

        await this.browser.sleep(2000); // Wait for reset
        await this.takeScreenshot(page, '02-admin-game-reset');

        // Start Game
        console.log('   Start Game...');
        // Check if game is already running (button says "Stop Game")
        const startStopBtn = await page.$('#start-stop-btn');
        if (startStopBtn) {
            const btnText = await page.evaluate(el => el.textContent, startStopBtn);
            if (btnText.includes('Start Game')) {
                await startStopBtn.click();
                 // Might have a confirmation if it was stopped?
                 // toggleGameStop only confirms when stopping. Starting is immediate? 
                 // Let's check admin/index.php: "const action = newState ? 'Stop' : 'Start'; ... Only confirm for stopping"
            } else {
                console.log('   Game already started.');
            }
        }
        
        await this.browser.sleep(1000);
        await this.takeScreenshot(page, '03-admin-game-started');

        // Set Duration
        const durationInput = await page.$('#trading-duration-minutes'); // Note: ID changed in admin/index.php to trading-duration-minutes
        if (durationInput) {
            await durationInput.click({ clickCount: 3 });
            await durationInput.type('10'); // 10 minutes
            // Update button
            await page.click('button[onclick="updateTradingDuration()"]');
            await this.browser.sleep(500);
        }
        await this.takeScreenshot(page, '04-admin-settings-configured');

        await page.close();
    }

    async adminAdvanceSession(currentSession) {
        console.log(`👤 Admin: Advancing from Session ${currentSession}...`);
        const page = await this.browser.loginAndNavigate(this.config.adminUser, 'admin/');
        
        await this.takeScreenshot(page, `05-admin-pre-advance-session${currentSession}`);

        // Use onclick selector as there is no ID
        const advanceBtn = await page.$('button[onclick="advancePhase()"]');
        if (advanceBtn) {
            await advanceBtn.click();
            console.log('   Clicked Advance Session...');
            await this.browser.sleep(3000); // Wait for processing
        } else {
            console.error('   ❌ Advance button not found!');
        }

        await this.takeScreenshot(page, `06-admin-post-advance-session${currentSession}`);
        await page.close();
    }

        async studentPlaySession1(email, studentNum) {
            const studentName = `Student ${studentNum}`;
            console.log(`👤 ${studentName} (${email}): Playing Session 1...`);
            
            const page = await this.browser.loginAndNavigate(email, '');
            
            // 1. Dashboard / Main View (The Marketplace is now here)
            await this.takeScreenshot(page, `s1-student${studentNum}-01-dashboard`);
    
            // 2. Post Buy Request (Student 1 only, to create activity)
            if (studentNum === 1) {
                console.log('   Posting Buy Request for C...');
                
                // Access button inside Shadow DOM of chemical-card
                const postBuyBtn = await page.evaluateHandle(`
                    document.querySelector('chemical-card[chemical="C"]').shadowRoot.querySelector('#post-buy-btn')
                `);
                
                if (postBuyBtn) {
                    await postBuyBtn.click();
                    await this.browser.sleep(1000);
                    await this.takeScreenshot(page, `s1-student${studentNum}-02-buy-request-modal`);
                    
                    // Fill modal
                    await page.type('#offer-quantity', '150');
                    await page.type('#offer-price', '12.50');
                    
                    await this.takeScreenshot(page, `s1-student${studentNum}-03-buy-request-filled`);
                    
                    await page.click('#offer-submit-btn');
                    await this.browser.sleep(1500);
                    await this.takeScreenshot(page, `s1-student${studentNum}-04-buy-request-posted`);
                } else {
                    console.log('   ❌ Post Buy button not found in shadow DOM!');
                }
            }
    
            // 3. Sell to (Student 2 only, targeting Student 1's request)
            if (studentNum === 2) {
                 console.log('   Responding to Student 1...');
                 // Wait for ad to appear
                 await this.browser.sleep(2000);
                 
                 // Access 'Sell to' button inside listing-item, which is inside chemical-card's shadow DOM
                 // listing-item also has its own shadow DOM!
                              const sellToBtn = await page.evaluateHandle(() => {
                                 const card = document.querySelector('chemical-card[chemical="C"]');
                                 if (!card || !card.shadowRoot) return null;
                                 const adItem = card.shadowRoot.querySelector('listing-item:not([isMyAd])');
                                 return adItem ? adItem.shadowRoot.querySelector('.btn') : null;
                              });    
                 if (sellToBtn && await sellToBtn.asElement()) {
                     await sellToBtn.click();
                     await this.browser.sleep(1000);
                     await this.takeScreenshot(page, `s1-student${studentNum}-02-respond-modal`);
    
                     await page.type('#respond-quantity', '50');
                     await page.type('#respond-price', '11.00');
                     await page.click('#respond-submit-btn');
                     await this.browser.sleep(1500);
                     await this.takeScreenshot(page, `s1-student${studentNum}-03-offer-sent`);
                 } else {
                     console.log('   ❌ Sell to button not found! (Maybe no ads yet?)');
                 }
            }
    
            // 4. View Negotiations (Student 1 again, to see incoming offer)
            if (studentNum === 1) {
                // Need to reopen student 1's page or just wait? 
                // Actually this loop is sequential. Student 1 is done.
                // Let's add a separate step for checking negotiations if needed.
            }
    
            await page.close();
        }
    
        async studentPlaySession2(email, studentNum) {
            const studentName = `Student ${studentNum}`;
            console.log(`👤 ${studentName} (${email}): Playing Session 2...`);
            
            const page = await this.browser.loginAndNavigate(email, '');
            
            // Dashboard Session 2 (should see production results modal automatically)
            await this.takeScreenshot(page, `s2-student${studentNum}-01-dashboard-with-production`);
            
            await page.close();
        }}

if (require.main === module) {
    const test = new VisualUXTest(CONFIG);
    test.run();
}

module.exports = VisualUXTest;
