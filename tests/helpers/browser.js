/**
 * Browser Helper - Puppeteer browser and page management
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

class BrowserHelper {
    constructor(config) {
        this.config = config;
        this.browser = null;
        this.screenshotCounter = 0;
        this.screenshotDir = path.join(__dirname, '..', 'screenshots');
    }

    /**
     * Launch browser
     */
    async launch(options = {}) {
        const defaultOptions = {
            headless: this.config.headless || false,
            defaultViewport: { width: 1280, height: 800 },
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--hide-scrollbars',
                '--mute-audio'
            ]
        };

        this.browser = await puppeteer.launch({ ...defaultOptions, ...options });
        return this.browser;
    }

    /**
     * Get browser instance
     */
    getBrowser() {
        if (!this.browser) {
            throw new Error('Browser not launched. Call launch() first.');
        }
        return this.browser;
    }

    /**
     * Create new page
     */
    async newPage() {
        const browser = this.getBrowser();
        const page = await browser.newPage();

        // Set up error logging
        page.on('console', msg => {
            if (this.config.verbose) {
                console.log(`   [Browser ${msg.type()}]:`, msg.text());
            }
        });
        page.on('pageerror', err => {
            if (this.config.verbose) {
                console.error(`   [Page Error]:`, err.message);
            }
        });

        return page;
    }

    /**
     * Login as a user
     */
    async login(page, userEmail) {
        // dev.php is at the root of CNDQ project
        // Remove trailing slash from baseUrl to avoid double slashes
        const baseUrl = this.config.baseUrl.replace(/\/$/, '');
        const loginUrl = `${baseUrl}/dev.php?user=${userEmail}`;

        // Navigate to login page (which sets cookie and redirects)
        await page.goto(loginUrl, { waitUntil: 'networkidle2' });

        // Verify cookie was set
        const cookies = await page.cookies();
        const mockMailCookie = cookies.find(c => c.name === 'mock_mail');
        
        // Browser might return URL-encoded value (%40 for @)
        const actualValue = mockMailCookie ? decodeURIComponent(mockMailCookie.value) : 'none';

        if (!mockMailCookie || actualValue !== userEmail) {
            console.warn(`   ⚠️  Warning: Cookie not set correctly for ${userEmail}`);
            console.log(`   Expected: ${userEmail}, Got: ${actualValue}`);
        }

        await this.sleep(500); // Small sleep for safety
    }

    /**
     * Navigate to a page
     */
    async navigateTo(page, pathStr, options = {}) {
        if (pathStr.startsWith('http')) {
            await page.goto(pathStr, { waitUntil: 'networkidle2', ...options });
            return;
        }

        // Ensure proper slash handling
        const baseUrl = this.config.baseUrl.replace(/\/$/, '');
        const relativePath = pathStr.startsWith('/') ? pathStr : '/' + pathStr;
        const url = `${baseUrl}${relativePath}`;
        
        await page.goto(url, { waitUntil: 'networkidle2', ...options });
    }

    /**
     * Login and navigate to a path (simplified)
     * Now uses isolated browser contexts to prevent cookie bleeding between users.
     * The context is stored on the page object so it can be closed when the page is closed.
     */
    async loginAndNavigate(userEmail, pathStr) {
        // Create an isolated browser context for this user
        const context = await this.getBrowser().createBrowserContext();
        const page = await context.newPage();
        
        // Attach context to page for easier cleanup
        page._browserContext = context;
        
        // Wrap page.close to also close the context
        const originalClose = page.close.bind(page);
        page.close = async () => {
            await originalClose();
            await context.close();
        };

        // Set up error logging for this new page
        page.on('console', msg => {
            if (this.config.verbose) {
                console.log(`   [Browser ${msg.type()}]:`, msg.text());
            }
        });
        page.on('pageerror', err => {
            if (this.config.verbose) {
                console.error(`   [Page Error]:`, err.message);
            }
        });

        // dev_login.php redirects to index.php, which is our main app page.
        await this.login(page, userEmail);

        // Mark tutorial as seen so it doesn't pop up and block the test
        await page.evaluate(() => {
            localStorage.setItem('cndq_tutorial_seen', 'true');
        });

        // If we want a specific path OTHER than index.php, navigate there
        if (pathStr && !pathStr.includes('index.php')) {
            await this.navigateTo(page, pathStr);
        }

        await this.sleep(2000); // Wait for page to fully load

        // Auto-close production modal if it appears
        await this.closeProductionModalIfPresent(page);

        return page;
    }

    /**
     * Close production modal if it's visible
     */
    async closeProductionModalIfPresent(page) {
        try {
            const modalVisible = await page.evaluate(() => {
                const modal = document.getElementById('production-results-modal');
                return modal && !modal.classList.contains('hidden');
            });

            if (modalVisible) {
                if (this.config.verbose) {
                    console.log('   🎯 Production modal detected, waiting for complete state...');
                }

                // Wait for the modal to transition from "in-progress" to "complete" state
                // The continue button is only visible when production-complete is shown
                await page.waitForSelector('#production-complete:not(.hidden)', { timeout: 10000 });
                await this.sleep(500); // Small delay for animation

                // Click the continue button using evaluate (more reliable than .click())
                const clicked = await page.evaluate(() => {
                    const button = document.getElementById('prod-result-continue');
                    if (button) {
                        button.click();
                        return true;
                    }
                    return false;
                });

                if (!clicked) {
                    throw new Error('Continue button not found');
                }

                await this.sleep(500); // Small delay after closing

                if (this.config.verbose) {
                    console.log('   ✅ Production modal closed');
                }
            }
        } catch (error) {
            if (this.config.verbose) {
                console.log('   ℹ️  No production modal to close (or timeout):', error.message);
            }
        }
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Close browser
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    /**
     * Keep browser open (for debugging)
     */
    keepOpen() {
        return new Promise(() => {});
    }

    /**
     * Run a shell command synchronously.
     * @param {string} command - The shell command to run.
     * @param {string} [cwd=process.cwd()] - The current working directory for the command.
     * @returns {string} The stdout from the command.
     */
    runShellCommand(command, cwd = process.cwd()) {
        const { execSync } = require('child_process');
        try {
            return execSync(command, { cwd, encoding: 'utf8', stdio: 'pipe' });
        } catch (error) {
            console.error(`Error running shell command: ${command}`);
            console.error(error.message);
            if (error.stdout) console.error(`STDOUT: ${error.stdout}`);
            if (error.stderr) console.error(`STDERR: ${error.stderr}`);
            throw error;
        }
    }
}

module.exports = BrowserHelper;