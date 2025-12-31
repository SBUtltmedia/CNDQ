/**
 * Browser Helper - Puppeteer browser and page management
 */

const puppeteer = require('puppeteer');
const path = require('path');

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
        // dev_login.php is at the root of CNDQ project
        const loginUrl = `${this.config.baseUrl}/dev_login.php?user=${userEmail}`;
        const targetUrl = `${this.config.baseUrl}/`;

        await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
        
        // Wait for the URL to change to the target, which confirms the redirect
        await page.waitForFunction((url) => window.location.href.includes(url), { timeout: 15000 }, targetUrl);
        
        await this.sleep(1000); // Small sleep for safety
    }

    /**
     * Navigate to a page
     */
    async navigateTo(page, pathStr, options = {}) {
        const url = pathStr.startsWith('http') ? pathStr : `${this.config.baseUrl}${pathStr}`;
        await page.goto(url, { waitUntil: 'networkidle2', ...options });
    }

    /**
     * Login and navigate to a path (simplified)
     */
    async loginAndNavigate(userEmail, pathStr) {
        const page = await this.newPage();
        // dev_login.php redirects to index.php, which is our main app page.
        await this.login(page, userEmail); 
        
        // If we want a specific path OTHER than index.php, navigate there
        if (pathStr && !pathStr.includes('index.php')) {
            await this.navigateTo(page, pathStr);
        }
        
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