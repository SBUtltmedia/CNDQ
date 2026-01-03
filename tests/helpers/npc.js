/**
 * NPC Helper
 *
 * Manages NPC creation, deletion, and status checking via the admin panel.
 */

const ReportingHelper = require('./reporting');

class NpcHelper {
    constructor(browserHelper) {
        this.browser = browserHelper;
    }

    /**
     * Deletes all existing NPCs to ensure a clean slate.
     * @param {puppeteer.Page} adminPage - An admin-authenticated page instance.
     */
    async deleteAllNpcs(adminPage) {
        ReportingHelper.printInfo('Deleting all existing NPCs...');

        // First, ensure we are logged in as admin.
        // The login helper should handle the redirect and cookie setting.
        await this.browser.login(adminPage, 'admin@stonybrook.edu');

        // Now, navigate directly to the reset API endpoint.
        // The browser will automatically send the admin cookie.
        const resetUrl = `${this.browser.config.baseUrl}/api/admin/reset-game.php`;
        
        // We need to make a POST request, but goto only does GET.
        // So we use evaluate to do a POST fetch, but we do it from a logged-in page context.
        await adminPage.goto(`${this.browser.config.baseUrl}/admin/`, { waitUntil: 'networkidle2' });
        
        const data = await adminPage.evaluate(async (url) => {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            return await response.json();
        }, resetUrl);
        
        if (!data.success) {
            throw new Error(data.message || "Failed to delete NPCs via API.");
        }

        await this.browser.sleep(1000); // Wait for reset to process
        ReportingHelper.printSuccess('All existing NPCs and game data cleared.');
    }

    /**
     * Creates the required NPCs for the test (1 of each skill level).
     * @param {puppeteer.Page} adminPage - An admin-authenticated page instance.
     */
    async createTestNpcs(adminPage) {
        ReportingHelper.printInfo('Creating 1 NPC of each skill level...');

        const skills = ['beginner', 'novice', 'expert'];
        for (const skill of skills) {
            await this.createNpc(adminPage, skill);
        }

        await this.enableNpcSystem(adminPage);

        const npcs = await this.listNpcs(adminPage);
        if (npcs.length === 3) {
            ReportingHelper.printSuccess('Successfully created 3 test NPCs.');
        } else {
            throw new Error(`Expected 3 NPCs, but found ${npcs.length}.`);
        }
    }

    /**
     * Creates a single NPC of a given skill level via the admin UI.
     * @param {puppeteer.Page} adminPage
     * @param {string} skillLevel - 'beginner', 'novice', or 'expert'.
     */
    async createNpc(adminPage, skillLevel) {
        await adminPage.waitForSelector('#npc-skill-level', { timeout: 10000 });
        await adminPage.select('#npc-skill-level', skillLevel);
        await adminPage.click('button[onclick="createNPC()"]');
        await this.browser.sleep(1500); // Wait for creation and UI update
        console.log(`   - Created 1 ${skillLevel} NPC`);
    }

    /**
     * Enables the global NPC system via the admin UI.
     * @param {puppeteer.Page} adminPage
     */
    async enableNpcSystem(adminPage) {
        const isEnabled = await adminPage.$eval('#npc-system-enabled', el => el.checked);
        if (!isEnabled) {
            await adminPage.click('#npc-system-enabled');
            await this.browser.sleep(500);
            ReportingHelper.printInfo('NPC system has been enabled.');
        } else {
            ReportingHelper.printInfo('NPC system is already enabled.');
        }
    }

    /**
     * Lists all current NPCs by evaluating the admin page.
     * @param {puppeteer.Page} adminPage
     * @returns {Array} A list of NPC objects.
     */
    async listNpcs(adminPage) {
        // Retry for a few seconds to wait for UI to update
        for (let i = 0; i < 5; i++) {
            const npcs = await adminPage.evaluate(() => {
                const npcRows = Array.from(document.querySelectorAll('#npc-list .bg-gray-700'));
                return npcRows.map(row => {
                    const teamName = row.querySelector('.font-bold.text-lg')?.textContent.trim();
                    const skillLevel = row.querySelector('.text-xs.px-2.py-1.rounded')?.textContent.trim().toLowerCase();
                    return { teamName, skillLevel };
                });
            });
            if (npcs.length > 0) {
                return npcs;
            }
            await this.browser.sleep(500); // Wait and retry
        }
        return []; // Return empty if still not found
    }
}

module.exports = NpcHelper;
