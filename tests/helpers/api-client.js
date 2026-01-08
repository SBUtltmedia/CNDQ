/**
 * API Client Helper - Puppeteer-based API testing utility
 *
 * Provides methods to test all CNDQ API endpoints using Puppeteer's page.evaluate()
 * which runs fetch requests with proper session cookies.
 */

class ApiClient {
    constructor(page, baseUrl) {
        this.page = page;
        this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash (kept for reference)
    }

    /**
     * Make an API request using the page context (with cookies)
     */
    async request(method, endpoint, body = null, options = {}) {
        // Construct absolute URL using baseUrl to be safe
        const url = endpoint.startsWith('http') ? endpoint : 
            `${this.baseUrl}/api/${endpoint.replace(/^\/api\//, '')}`;

        const result = await this.page.evaluate(async ({ url, method, body, options }) => {
            const fetchOptions = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                credentials: 'include', // Include cookies
                ...options
            };

            if (body && method !== 'GET') {
                fetchOptions.body = JSON.stringify(body);
            }

            try {
                const response = await fetch(url, fetchOptions);
                const contentType = response.headers.get('content-type');

                let data;
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    data = await response.text();
                }

                return {
                    ok: response.ok,
                    status: response.status,
                    statusText: response.statusText,
                    data,
                    headers: Object.fromEntries(response.headers.entries())
                };
            } catch (error) {
                return {
                    ok: false,
                    status: 0,
                    statusText: error.message,
                    data: { error: error.message },
                    headers: {}
                };
            }
        }, { url, method, body, options });

        return result;
    }

    // Convenience methods
    async get(endpoint, options = {}) {
        return this.request('GET', endpoint, null, options);
    }

    async post(endpoint, body, options = {}) {
        return this.request('POST', endpoint, body, options);
    }

    async put(endpoint, body, options = {}) {
        return this.request('PUT', endpoint, body, options);
    }

    async delete(endpoint, options = {}) {
        return this.request('DELETE', endpoint, null, options);
    }

    // ===================
    // SESSION ENDPOINTS
    // ===================

    async getSessionStatus() {
        return this.get('session/status.php');
    }

    async acknowledgeProduction() {
        return this.post('session/status.php', { acknowledgeProduction: true });
    }

    // ===================
    // MARKETPLACE ENDPOINTS
    // ===================

    async getMarketplaceOffers(chemicalFilter = null) {
        const endpoint = chemicalFilter ? `marketplace/offers.php?chemical=${chemicalFilter}` : 'marketplace/offers.php';
        return this.get(endpoint);
    }

    // ===================
    // OFFERS ENDPOINTS
    // ===================

    async createOffer(chemical, quantity, minPrice) {
        return this.post('offers/create.php', { chemical, quantity, minPrice });
    }

    async createBuyOrder(chemical, quantity, maxPrice) {
        return this.post('offers/bid.php', { chemical, quantity, maxPrice });
    }

    async cancelOffer(offerId) {
        return this.post('offers/cancel.php', { offerId });
    }

    // ===================
    // NEGOTIATIONS ENDPOINTS
    // ===================

    async listNegotiations() {
        return this.get('negotiations/list.php');
    }

    async initiateNegotiation(responderId, chemical, quantity, price, type = 'buy', adId = null) {
        const body = { responderId, chemical, quantity, price, type };
        if (adId) body.adId = adId;
        return this.post('negotiations/initiate.php', body);
    }

    async acceptNegotiation(negotiationId) {
        return this.post('negotiations/accept.php', { negotiationId });
    }

    async counterNegotiation(negotiationId, quantity, price) {
        return this.post('negotiations/counter.php', { negotiationId, quantity, price });
    }

    async rejectNegotiation(negotiationId) {
        return this.post('negotiations/reject.php', { negotiationId });
    }

    async reactToNegotiation(negotiationId, emoji) {
        return this.post('negotiations/react.php', { negotiationId, emoji });
    }

    // ===================
    // ADVERTISEMENTS ENDPOINTS
    // ===================

    async listAdvertisements() {
        return this.get('advertisements/list.php');
    }

    async getMyAdvertisements() {
        return this.get('advertisements/my-ads.php');
    }

    async postAdvertisement(chemical, type, message) {
        return this.post('advertisements/post.php', { chemical, type, message });
    }

    // ===================
    // NOTIFICATIONS ENDPOINTS
    // ===================

    async listNotifications() {
        return this.get('notifications/list.php');
    }

    // ===================
    // PRODUCTION ENDPOINTS
    // ===================

    async getProductionResults() {
        return this.get('production/results.php');
    }

    async getShadowPrices() {
        return this.get('production/shadow-prices.php');
    }

    // ===================
    // LEADERBOARD ENDPOINTS
    // ===================

    async getLeaderboard() {
        return this.get('leaderboard/standings.php');
    }

    // ===================
    // TEAM ENDPOINTS
    // ===================

    async getTeamSettings() {
        return this.get('team/settings.php');
    }

    async updateTeamSettings(settings) {
        return this.post('team/settings.php', settings);
    }

    // ===================
    // ADMIN ENDPOINTS
    // ===================

    async getAdminSession() {
        return this.get('admin/session.php');
    }

    async controlSession(action, params = {}) {
        return this.post('admin/session.php', { action, ...params });
    }

    async startGame() {
        return this.controlSession('start');
    }

    async stopGame() {
        return this.controlSession('stop');
    }

    async advanceSession() {
        return this.controlSession('advance');
    }

    async setAutoAdvance(enabled) {
        return this.controlSession('setAutoAdvance', { enabled });
    }

    async setTradingDuration(seconds) {
        return this.controlSession('setTradingDuration', { seconds });
    }

    async resetGame() {
        return this.post('admin/reset-game.php', {});
    }

    async listNPCs() {
        return this.get('admin/npc/list.php');
    }

    async createNPC(teamName) {
        return this.post('admin/npc/create.php', { teamName });
    }

    async deleteNPC(npcId) {
        return this.post('admin/npc/delete.php', { npcId });
    }

    async toggleNPC(npcId, isActive) {
        return this.post('admin/npc/toggle.php', { npcId, isActive });
    }

    async toggleNPCSystem(enabled) {
        return this.post('admin/npc/toggle-system.php', { enabled });
    }

    // ===================
    // UTILITIES
    // ===================

    /**
     * Assert response is successful
     */
    assertSuccess(response, message = '') {
        if (!response.ok) {
            throw new Error(`API request failed: ${message}\nStatus: ${response.status}\nData: ${JSON.stringify(response.data)}`);
        }
        return response;
    }

    /**
     * Assert response has specific status code
     */
    assertStatus(response, expectedStatus, message = '') {
        if (response.status !== expectedStatus) {
            throw new Error(`Expected status ${expectedStatus}, got ${response.status}: ${message}\nData: ${JSON.stringify(response.data)}`);
        }
        return response;
    }

    /**
     * Assert response contains specific data
     */
    assertData(response, key, value = undefined) {
        if (!(key in response.data)) {
            throw new Error(`Response missing key: ${key}\nData: ${JSON.stringify(response.data)}`);
        }
        if (value !== undefined && response.data[key] !== value) {
            throw new Error(`Expected ${key}=${value}, got ${response.data[key]}`);
        }
        return response;
    }

    /**
     * Print response for debugging
     */
    logResponse(response, label = 'API Response') {
        console.log(`\n${label}:`);
        console.log(`  Status: ${response.status} ${response.statusText}`);
        console.log(`  OK: ${response.ok}`);
        console.log(`  Data:`, JSON.stringify(response.data, null, 2));
    }
}

module.exports = ApiClient;
