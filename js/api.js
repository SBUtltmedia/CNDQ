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
    constructor() {
        // Priority 1: Global variable injected by PHP
        if (typeof window.APP_BASE_PATH !== 'undefined') {
            this.basePath = window.APP_BASE_PATH;
        } else {
            // Priority 2: Data attribute on script tag
            const scriptTag = document.getElementById('main-app-script');
            this.basePath = scriptTag ? scriptTag.getAttribute('data-base-path') : '';
        }

        // Handle null/undefined
        if (!this.basePath) {
            this.basePath = '';
        }

        // Ensure no trailing slash
        if (this.basePath.endsWith('/')) {
            this.basePath = this.basePath.slice(0, -1);
        }
        
        console.log('API Client initialized with basePath:', this.basePath);
    }

    /**
     * Generic fetch wrapper with error handling
     */
    async request(endpoint, options = {}) {
        const url = `${this.basePath}${endpoint}`;
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        const config = { ...defaultOptions, ...options };

        try {
            const response = await fetch(url, config);
            
            // specific handling for 204 No Content
            if (response.status === 204) {
                return null;
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || data.message || `HTTP ${response.status}`);
                }

                return data;
            } else {
                // Handle non-JSON response (likely HTML error page from server)
                const text = await response.text();
                // Extract title from HTML if possible for better error message
                const titleMatch = text.match(/<title>(.*?)<\/title>/i);
                const title = titleMatch ? titleMatch[1] : 'Unknown Error';
                
                console.error(`API Error: Expected JSON but got ${contentType || 'unknown type'} from ${url}`);
                console.error('Response preview:', text.substring(0, 500));
                
                throw new Error(`Server returned non-JSON response: ${title} (HTTP ${response.status})`);
            }
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

// Export singleton instance
export const api = new ApiClient();
