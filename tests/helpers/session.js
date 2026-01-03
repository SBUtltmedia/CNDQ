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
            await page.goto(`${this.browser.config.baseUrl}/admin/`);
            await this.browser.sleep(500);

            // Call reset endpoint via fetch
            const data = await page.evaluate(async (baseUrl) => {
                const response = await fetch(`${baseUrl}/api/admin/reset-game.php`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'same-origin'  // Ensure cookies are sent
                });
                const text = await response.text();
                try {
                    return JSON.parse(text);
                } catch (e) {
                    return { success: false, error: 'Invalid JSON response from server: ' + text.substring(0, 500) };
                }
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
     * NOTE: In the new model, 'trading' is the permanent phase.
     */
    async waitForPhaseChange(targetPhase, maxWaitSeconds = 120) {
        if (targetPhase === 'trading') {
            console.log('   ✓ (Bypass) Already in permanent trading phase');
            return true;
        }

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
            '/admin/'
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
    async setPhase(adminPage, phase) {
        if (!['production', 'trading'].includes(phase)) {
            throw new Error(`Invalid phase "${phase}" specified.`);
        }
        
        const result = await adminPage.evaluate(async (ph, baseUrl) => {
            try {
                // Use explicit baseUrl from test config
                const response = await fetch(`${baseUrl}/api/admin/session.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'setPhase', phase: ph }),
                    credentials: 'same-origin'  // Ensure cookies are sent
                });

                const text = await response.text();
                try {
                    return JSON.parse(text);
                } catch (e) {
                    return { success: false, message: 'Invalid JSON (' + response.status + '): ' + text.substring(0, 100) };
                }
            } catch (e) {
                return { success: false, message: 'Fetch error: ' + e.message };
            }
        }, phase, this.browser.config.baseUrl);

        if (result.success) {
            console.log(`   - Phase set to ${phase}`);
        } else {
            const msg = result.message || result.error || JSON.stringify(result);
            throw new Error(`Failed to set phase to ${phase}: ${msg}`);
        }
        
        await this.browser.sleep(500);
    }
}

module.exports = SessionHelper;
