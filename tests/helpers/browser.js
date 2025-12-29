/**
 * Browser Helper - Puppeteer browser and page management
 */

const puppeteer = require('puppeteer');

class BrowserHelper {
    constructor(config) {
        this.config = config;
        this.browser = null;
    }

    /**
     * Launch browser
     */
    async launch(options = {}) {
        const defaultOptions = {
            headless: this.config.headless || false,
            defaultViewport: { width: 1280, height: 800 },
            args: ['--no-sandbox', '--disable-setuid-sandbox']
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
        await page.goto(`${this.config.baseUrl}/dev_login.php?user=${userEmail}`);
        await this.sleep(1000);
    }

    /**
     * Navigate to a page
     */
    async navigateTo(page, path, options = {}) {
        const url = path.startsWith('http') ? path : `${this.config.baseUrl}${path}`;
        await page.goto(url, { waitUntil: 'networkidle2', ...options });
    }

    /**
     * Login and navigate
     */
    async loginAndNavigate(userEmail, path) {
        const page = await this.newPage();
        await this.login(page, userEmail);
        await this.navigateTo(page, path);
        await this.sleep(2000); // Wait for page to fully load
        return page;
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
}

module.exports = BrowserHelper;
