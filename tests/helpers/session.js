/**
 * Session Helper - Game session and phase management
 */

class SessionHelper {
    constructor(browserHelper) {
        this.browser = browserHelper;
    }

    /**
     * Reset the entire game to a clean state
     * Resets all teams, session, inventory, and data
     */
    async resetGame() {
        const page = await this.browser.newPage();
        try {
            // Login as admin first
            await this.browser.login(page, 'admin@stonybrook.edu');
            await this.browser.sleep(1000);

            // Navigate to any page to set up context
            await page.goto(`${this.browser.config.baseUrl}/admin.html`);
            await this.browser.sleep(500);

            // Call reset endpoint via fetch
            const data = await page.evaluate(async (baseUrl) => {
                const response = await fetch(`${baseUrl}/api/admin/reset-game.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                return await response.json();
            }, this.browser.config.baseUrl);

            if (data.success) {
                console.log(`   ✓ Game reset: ${data.teamsReset} teams reset to session 1`);
                if (data.errors && data.errors.length > 0) {
                    console.log(`   ⚠ Reset warnings: ${data.errors.join(', ')}`);
                }
                return true;
            } else {
                throw new Error(data.error || 'Reset failed');
            }
        } finally {
            await page.close();
        }
    }

    /**
     * Get current session state
     */
    async getSessionState() {
        const page = await this.browser.newPage();
        try {
            const response = await page.goto(`${this.browser.config.baseUrl}/api/admin/session.php`);
            const data = await response.json();
            return data.session;
        } finally {
            await page.close();
        }
    }

    /**
     * Get current session number
     */
    async getCurrentSession() {
        const state = await this.getSessionState();
        return state.currentSession;
    }

    /**
     * Get current phase
     */
    async getCurrentPhase() {
        const state = await this.getSessionState();
        return state.phase;
    }

    /**
     * Wait for phase to change to target phase
     */
    async waitForPhaseChange(targetPhase, maxWaitSeconds = 120) {
        const startTime = Date.now();

        while ((Date.now() - startTime) / 1000 < maxWaitSeconds) {
            const currentPhase = await this.getCurrentPhase();

            if (currentPhase === targetPhase) {
                console.log(`   ✓ Phase changed to ${targetPhase}`);
                return true;
            }

            await this.browser.sleep(2000); // Check every 2 seconds
        }

        throw new Error(`Timeout waiting for ${targetPhase} phase`);
    }

    /**
     * Enable auto-advance via admin panel
     */
    async enableAutoAdvance() {
        const page = await this.browser.loginAndNavigate(
            'admin@stonybrook.edu',
            '/admin.html'
        );

        try {
            // Wait for checkbox to be available
            await page.waitForSelector('#auto-advance', { timeout: 10000 });

            // Check if already enabled
            const isChecked = await page.$eval('#auto-advance', el => el.checked);

            if (!isChecked) {
                await page.click('#auto-advance');
                console.log('   ✓ Auto-advance enabled');
            } else {
                console.log('   ✓ Auto-advance already enabled');
            }
        } finally {
            await page.close();
        }
    }

    /**
     * Set phase manually (admin only)
     */
    async setPhase(phase) {
        const page = await this.browser.loginAndNavigate(
            'admin@stonybrook.edu',
            '/admin.html'
        );

        try {
            const buttonId = `#set-${phase}-btn`;
            await page.waitForSelector(buttonId, { timeout: 5000 });
            await page.click(buttonId);
            await this.browser.sleep(1000);
            console.log(`   ✓ Phase set to ${phase}`);
        } finally {
            await page.close();
        }
    }
}

module.exports = SessionHelper;
