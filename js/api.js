/**
 * CNDQ Marketplace API Client
 *
 * Centralized API abstraction layer for all backend communication.
 * Makes it easy to switch backends or modify request handling.
 *
 * Usage:
 *   import { api } from './api.js';
 *   const profile = await api.team.getProfile();
 *   await api.advertisements.post('C', 'sell');
 */

class ApiClient {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
    }

    /**
     * Generic fetch wrapper with error handling
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        const config = { ...defaultOptions, ...options };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.message || `HTTP ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    }

    /**
     * GET request
     */
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    /**
     * POST request
     */
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT request
     */
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE request
     */
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // ==========================================
    // Team & Profile APIs
    // ==========================================

    team = {
        /**
         * Get team profile and inventory
         * @returns {Promise<{success: boolean, profile: Object, inventory: Object}>}
         */
        getProfile: async () => {
            return this.get('/api/team/profile.php');
        },

        /**
         * Get team settings
         * @returns {Promise<{success: boolean, settings: Object}>}
         */
        getSettings: async () => {
            return this.get('/api/team/settings.php');
        },

        /**
         * Update team settings
         * @param {Object} settings - Settings to update
         * @returns {Promise<{success: boolean, settings: Object}>}
         */
        updateSettings: async (settings) => {
            return this.post('/api/team/settings.php', settings);
        }
    };

    // ==========================================
    // Production & Shadow Prices APIs
    // ==========================================

    production = {
        /**
         * Get or recalculate shadow prices
         * @returns {Promise<{success: boolean, shadowPrices: Object}>}
         */
        getShadowPrices: async () => {
            return this.get('/api/production/shadow-prices.php');
        }
    };

    // ==========================================
    // Advertisement APIs
    // ==========================================

    advertisements = {
        /**
         * List all marketplace advertisements
         * @returns {Promise<{success: boolean, advertisements: Object}>}
         */
        list: async () => {
            return this.get('/api/advertisements/list.php');
        },

        /**
         * Post buy or sell interest
         * @param {string} chemical - Chemical type (C, N, D, Q)
         * @param {string} type - 'buy' or 'sell'
         * @returns {Promise<{success: boolean, message: string, advertisement: Object}>}
         */
        post: async (chemical, type) => {
            return this.post('/api/advertisements/post.php', { chemical, type });
        },

        /**
         * Get my advertisements
         * @returns {Promise<{success: boolean, advertisements: Array}>}
         */
        getMyAds: async () => {
            return this.get('/api/advertisements/my-ads.php');
        }
    };

    // ==========================================
    // Offers APIs (Buy Requests)
    // ==========================================

    offers = {
        /**
         * Create a buy order (bid)
         * @param {string} chemical - Chemical type (C, N, D, Q)
         * @param {number} quantity - Quantity desired
         * @param {number} maxPrice - Maximum price willing to pay per gallon
         * @returns {Promise<{success: boolean, buyOrder: Object}>}
         */
        bid: async (chemical, quantity, maxPrice) => {
            return this.post('/api/offers/bid.php', {
                chemical,
                quantity,
                maxPrice
            });
        }
    };

    // ==========================================
    // Negotiation APIs
    // ==========================================

    negotiations = {
        /**
         * List my negotiations
         * @returns {Promise<{success: boolean, negotiations: Array}>}
         */
        list: async () => {
            return this.get('/api/negotiations/list.php');
        },

        /**
         * Initiate a new negotiation
         * @param {string} responderId - Other team's ID
         * @param {string} chemical - Chemical type
         * @param {number} quantity - Gallons
         * @param {number} price - Price per gallon
         * @returns {Promise<{success: boolean, negotiation: Object}>}
         */
        initiate: async (responderId, chemical, quantity, price) => {
            return this.post('/api/negotiations/initiate.php', {
                responderId,
                chemical,
                quantity,
                price
            });
        },

        /**
         * Send a counter-offer
         * @param {string} negotiationId - Negotiation ID
         * @param {number} quantity - Gallons
         * @param {number} price - Price per gallon
         * @returns {Promise<{success: boolean, negotiation: Object}>}
         */
        counter: async (negotiationId, quantity, price) => {
            return this.post('/api/negotiations/counter.php', {
                negotiationId,
                quantity,
                price
            });
        },

        /**
         * Accept a negotiation offer
         * @param {string} negotiationId - Negotiation ID
         * @returns {Promise<{success: boolean, trade: Object}>}
         */
        accept: async (negotiationId) => {
            return this.post('/api/negotiations/accept.php', { negotiationId });
        },

        /**
         * Reject or cancel a negotiation
         * @param {string} negotiationId - Negotiation ID
         * @returns {Promise<{success: boolean}>}
         */
        reject: async (negotiationId) => {
            return this.post('/api/negotiations/reject.php', { negotiationId });
        }
    };

    // ==========================================
    // Notification APIs
    // ==========================================

    notifications = {
        /**
         * List notifications
         * @returns {Promise<{success: boolean, notifications: Array, unreadCount: number}>}
         */
        list: async () => {
            return this.get('/api/notifications/list.php');
        }
    };

    // ==========================================
    // Admin APIs
    // ==========================================

    admin = {
        /**
         * Get session state
         * @returns {Promise<{success: boolean, session: Object}>}
         */
        getSession: async () => {
            return this.get('/api/admin/session.php');
        },

        /**
         * Update session (advance, set phase, etc.)
         * @param {string} action - Action to perform
         * @param {Object} params - Action parameters
         * @returns {Promise<{success: boolean, message: string, session: Object}>}
         */
        updateSession: async (action, params = {}) => {
            return this.post('/api/admin/session.php', { action, ...params });
        },

        /**
         * Reset all game data
         * @returns {Promise<{success: boolean, teamsReset: number}>}
         */
        resetGame: async () => {
            return this.post('/api/admin/reset-game.php');
        },

        /**
         * List all teams
         * @returns {Promise<{success: boolean, teams: Array}>}
         */
        listTeams: async () => {
            return this.get('/api/admin/list-teams.php');
        }
    };

    // ==========================================
    // Leaderboard APIs
    // ==========================================

    leaderboard = {
        /**
         * Get leaderboard standings
         * @returns {Promise<{success: boolean, standings: Array, session: string, phase: string}>}
         */
        getStandings: async () => {
            return this.get('/api/leaderboard/standings.php');
        }
    };
}

/**
 * Auto-detect base path from current script location
 * Handles deployment in subdirectories (e.g., /cndq/)
 */
function getBasePath() {
    // Get the current script's URL
    const scriptUrl = new URL(import.meta.url);

    // Remove /js/api.js to get the base path
    // Example: https://apps.tlt.stonybrook.edu/cndq/js/api.js
    //       -> https://apps.tlt.stonybrook.edu/cndq
    const pathParts = scriptUrl.pathname.split('/');
    pathParts.pop(); // Remove 'api.js'
    pathParts.pop(); // Remove 'js'

    // Reconstruct base URL (protocol + host + base path)
    return `${scriptUrl.protocol}//${scriptUrl.host}${pathParts.join('/')}`;
}

// Export singleton instance with auto-detected base path
export const api = new ApiClient(getBasePath());

// Also export class for testing/mocking
export { ApiClient };
