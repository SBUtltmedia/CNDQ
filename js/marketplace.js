/**
 * CNDQ Marketplace SPA
 * Single Page Application for Chemical Trading
 */

class MarketplaceApp {
    constructor() {
        // State
        this.currentUser = null;
        this.profile = null;
        this.inventory = null;
        this.shadowPrices = { C: 0, N: 0, D: 0, Q: 0 };
        this.advertisements = { C: { buy: [], sell: [] }, N: { buy: [], sell: [] }, D: { buy: [], sell: [] }, Q: { buy: [], sell: [] } };
        this.myNegotiations = [];
        this.notifications = [];
        this.settings = { showTradingHints: false };

        // Polling
        this.pollingInterval = null;
        this.pollingFrequency = 3000; // 3 seconds

        // Modal state
        this.currentNegotiation = null;
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            // Load team profile
            await this.loadProfile();

            // Load shadow prices
            await this.loadShadowPrices();

            // Load advertisements and negotiations
            await this.loadAdvertisements();
            await this.loadNegotiations();

            // Load notifications
            await this.loadNotifications();

            // Load settings
            await this.loadSettings();

            // Setup event listeners
            this.setupEventListeners();

            // Start polling
            this.startPolling();

            // Hide loading, show app
            document.getElementById('loading-overlay').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');

        } catch (error) {
            console.error('Failed to initialize marketplace:', error);
            alert('Failed to load marketplace. Please refresh the page.');
        }
    }

    /**
     * Show custom confirmation dialog (non-blocking)
     * Returns a Promise that resolves to true/false
     */
    showConfirm(message, title = 'Confirm Action') {
        return new Promise((resolve) => {
            const dialog = document.getElementById('confirm-dialog');
            const titleEl = document.getElementById('confirm-title');
            const messageEl = document.getElementById('confirm-message');
            const okBtn = document.getElementById('confirm-ok');
            const cancelBtn = document.getElementById('confirm-cancel');

            // Store previous focus to restore later
            const previousFocus = document.activeElement;

            titleEl.textContent = title;
            messageEl.textContent = message;
            dialog.classList.remove('hidden');
            dialog.setAttribute('role', 'alertdialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-labelledby', 'confirm-title');
            dialog.setAttribute('aria-describedby', 'confirm-message');

            // Focus the cancel button initially for safety
            setTimeout(() => cancelBtn.focus(), 100);

            const cleanup = () => {
                dialog.classList.add('hidden');
                dialog.removeAttribute('role');
                dialog.removeAttribute('aria-modal');
                dialog.removeAttribute('aria-labelledby');
                dialog.removeAttribute('aria-describedby');
                okBtn.removeEventListener('click', handleOk);
                cancelBtn.removeEventListener('click', handleCancel);
                dialog.removeEventListener('click', handleBackdrop);
                document.removeEventListener('keydown', handleKeydown);

                // Restore focus
                if (previousFocus) {
                    previousFocus.focus();
                }
            };

            const handleOk = () => {
                cleanup();
                resolve(true);
            };

            const handleCancel = () => {
                cleanup();
                resolve(false);
            };

            const handleBackdrop = (e) => {
                if (e.target === dialog) {
                    cleanup();
                    resolve(false);
                }
            };

            const handleKeydown = (e) => {
                // Esc key closes dialog
                if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCancel();
                }
                // Enter key confirms (if not focused on cancel button)
                else if (e.key === 'Enter' && document.activeElement !== cancelBtn) {
                    e.preventDefault();
                    handleOk();
                }
                // Tab key - trap focus within dialog
                else if (e.key === 'Tab') {
                    const focusableElements = [cancelBtn, okBtn];
                    const firstElement = focusableElements[0];
                    const lastElement = focusableElements[focusableElements.length - 1];

                    if (e.shiftKey && document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    } else if (!e.shiftKey && document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            };

            okBtn.addEventListener('click', handleOk);
            cancelBtn.addEventListener('click', handleCancel);
            dialog.addEventListener('click', handleBackdrop);
            document.addEventListener('keydown', handleKeydown);
        });
    }

    /**
     * Load team profile and inventory
     */
    async loadProfile() {
        const response = await fetch('/api/team/profile.php');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to load profile');
        }

        this.profile = data.profile;
        this.inventory = data.inventory;
        this.currentUser = this.profile.email;

        // Update UI
        document.getElementById('team-name').textContent = this.profile.teamName || this.profile.email;
        document.getElementById('current-funds').textContent = '$' + this.formatNumber(this.profile.currentFunds);

        // Update inventory displays
        ['C', 'N', 'D', 'Q'].forEach(chem => {
            document.getElementById(`inv-${chem}`).textContent = this.formatNumber(this.inventory[chem]);
        });

        // Update staleness indicator
        this.updateStalenessIndicator(data.inventory.stalenessLevel, data.inventory.transactionsSinceLastShadowCalc);
    }

    /**
     * Load shadow prices
     */
    async loadShadowPrices() {
        try {
            const response = await fetch('/api/production/shadow-prices.php');
            const data = await response.json();

            if (data.success) {
                this.shadowPrices = data.shadowPrices;
                this.updateShadowPricesUI();
            }
        } catch (error) {
            console.error('Failed to load shadow prices:', error);
        }
    }

    /**
     * Update shadow prices in UI
     */
    updateShadowPricesUI() {
        ['C', 'N', 'D', 'Q'].forEach(chem => {
            const price = this.shadowPrices[chem] || 0;
            document.getElementById(`shadow-${chem}`).textContent = this.formatNumber(price);
            document.getElementById(`your-shadow-${chem}`).textContent = this.formatNumber(price);
        });
    }

    /**
     * Update staleness indicator
     */
    updateStalenessIndicator(level, count) {
        const indicator = document.getElementById('staleness-indicator');
        const warning = document.getElementById('staleness-warning');

        if (level === 'fresh') {
            indicator.innerHTML = '<span class="text-green-500">✓ Fresh</span>';
            warning.classList.add('hidden');
        } else if (level === 'warning') {
            indicator.innerHTML = '<span class="text-yellow-500">⚠ Stale (1 trade ago)</span>';
            warning.classList.remove('hidden');
            warning.className = 'mt-3 p-3 rounded text-sm bg-yellow-900 bg-opacity-30 border border-yellow-600 text-yellow-300';
            warning.textContent = '💡 Tip: Your inventory changed! Shadow prices may be outdated. Click [Recalculate] to update them.';
        } else if (level === 'stale') {
            indicator.innerHTML = `<span class="text-red-500">⚠ Very Stale (${count} trades ago)</span>`;
            warning.classList.remove('hidden');
            warning.className = 'mt-3 p-3 rounded text-sm bg-red-900 bg-opacity-30 border border-red-600 text-red-300';
            warning.textContent = `⚠️ Warning: Shadow prices are very stale (last calculated before ${count} transactions). Your valuations may be inaccurate!`;
        }
    }

    /**
     * Recalculate shadow prices
     */
    async recalculateShadowPrices() {
        const btn = document.getElementById('recalc-shadow-btn');
        btn.disabled = true;
        btn.textContent = 'Calculating...';

        try {
            const response = await fetch('/api/production/shadow-prices.php');
            const data = await response.json();

            if (data.success) {
                this.shadowPrices = data.shadowPrices;
                this.updateShadowPricesUI();

                // Reload profile to get fresh staleness indicator
                await this.loadProfile();

                this.showToast('Shadow prices updated successfully', 'success');
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Failed to recalculate shadow prices:', error);
            this.showToast('Failed to recalculate shadow prices', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Recalculate Shadow Prices';
        }
    }

    /**
     * Load marketplace offers
     */
    /**
     * Load advertisements from API
     */
    async loadAdvertisements() {
        try {
            const response = await fetch('/api/advertisements/list.php');
            const data = await response.json();

            if (data.success) {
                this.advertisements = data.advertisements;
                this.renderAdvertisements();
            }
        } catch (error) {
            console.error('Failed to load advertisements:', error);
        }
    }

    /**
     * Load negotiations from API
     */
    async loadNegotiations() {
        try {
            const response = await fetch('/api/negotiations/list.php');
            const data = await response.json();

            if (data.success) {
                this.myNegotiations = data.negotiations || [];
                this.renderNegotiations();
            }
        } catch (error) {
            console.error('Failed to load negotiations:', error);
        }
    }

    /**
     * Render advertisement board
     */
    renderAdvertisements() {
        ['C', 'N', 'D', 'Q'].forEach(chemical => {
            // Render sell advertisements
            const sellContainer = document.getElementById(`sell-ads-${chemical}`);
            const sellAds = this.advertisements[chemical]?.sell || [];

            if (sellAds.length === 0) {
                sellContainer.innerHTML = '<p class="text-xs text-gray-300 text-center py-4">No sellers</p>';
            } else {
                sellContainer.innerHTML = sellAds.map(ad => this.renderAdvertisement(ad, chemical, 'sell')).join('');
            }

            // Render buy advertisements
            const buyContainer = document.getElementById(`buy-ads-${chemical}`);
            const buyAds = this.advertisements[chemical]?.buy || [];

            if (buyAds.length === 0) {
                buyContainer.innerHTML = '<p class="text-xs text-gray-300 text-center py-4">No buyers</p>';
            } else {
                buyContainer.innerHTML = buyAds.map(ad => this.renderAdvertisement(ad, chemical, 'buy')).join('');
            }
        });
    }

    /**
     * Render a single advertisement
     */
    renderAdvertisement(ad, chemical, type) {
        const isMyAd = ad.teamId === this.currentUser;
        const buttonText = type === 'sell' ? 'Buy from' : 'Sell to';
        const bgColor = type === 'sell' ? 'bg-green-700' : 'bg-blue-700';

        return `
            <div class="bg-gray-700 rounded p-3 border border-gray-600">
                <div class="flex items-center justify-between">
                    <div>
                        <div class="font-semibold text-sm">${ad.teamName}</div>
                        <div class="text-xs text-gray-300">Wants to ${type}</div>
                    </div>
                    ${!isMyAd ? `
                        <button
                            class="negotiate-btn ${bgColor} hover:opacity-90 text-white px-3 py-1 rounded text-xs font-semibold transition"
                            data-team-id="${ad.teamId}"
                            data-team-name="${ad.teamName}"
                            data-chemical="${chemical}"
                            data-type="${type}">
                            ${buttonText}
                        </button>
                    ` : '<span class="text-xs text-gray-400 italic">Your ad</span>'}
                </div>
            </div>
        `;
    }

    /**
     * Render negotiations summary
     */
    renderNegotiations() {
        const container = document.getElementById('my-negotiations');

        if (this.myNegotiations.length === 0) {
            container.innerHTML = '<p class="text-gray-300 text-center py-8">You have no active negotiations</p>';
            return;
        }

        // Show only pending negotiations in summary (max 5)
        const pending = this.myNegotiations.filter(n => n.status === 'pending').slice(0, 5);

        if (pending.length === 0) {
            container.innerHTML = '<p class="text-gray-300 text-center py-8">No pending negotiations</p>';
        } else {
            container.innerHTML = pending.map(neg => {
                const otherTeam = neg.initiatorId === this.currentUser ? neg.responderName : neg.initiatorName;
                const lastOffer = neg.offers[neg.offers.length - 1];
                const isMyTurn = neg.lastOfferBy !== this.currentUser;

                return `
                    <div class="bg-gray-700 rounded p-4 border border-gray-600 cursor-pointer hover:bg-gray-650 transition"
                         onclick="app.viewNegotiationDetail('${neg.id}')">
                        <div class="flex items-center justify-between">
                            <div>
                                <div class="font-semibold">Chemical ${neg.chemical} • ${otherTeam}</div>
                                <div class="text-sm text-gray-300">
                                    Latest: ${lastOffer.quantity} gal @ $${lastOffer.price.toFixed(2)}
                                </div>
                            </div>
                            ${isMyTurn ?
                                '<span class="px-2 py-1 bg-green-600 text-white rounded text-xs font-semibold">Your Turn</span>' :
                                '<span class="px-2 py-1 bg-gray-600 text-gray-300 rounded text-xs">Waiting</span>'
                            }
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    /**
     * Render a single offer
     */
    renderOffer(offer, chemical) {
        const price = offer.minPrice || offer.price;
        const shadowPrice = this.shadowPrices[chemical] || 0;
        const hints = this.settings.showTradingHints;

        // Determine deal quality (for buying)
        let dealClass = '';
        let dealLabel = '';
        if (hints && shadowPrice > 0) {
            const diff = ((price - shadowPrice) / shadowPrice) * 100;
            if (diff < -10) {
                dealClass = 'good-deal';
                dealLabel = '<span class="text-green-500 text-xs font-bold">Good Deal!</span>';
            } else if (diff > 10) {
                dealClass = 'bad-deal';
                dealLabel = '<span class="text-red-500 text-xs font-bold">Too High</span>';
            } else {
                dealClass = 'fair-deal';
                dealLabel = '<span class="text-orange-500 text-xs font-bold">Fair</span>';
            }
        }

        return `
            <div class="bg-gray-700 rounded p-3 ${dealClass}">
                <div class="flex items-center justify-between mb-2">
                    <div class="text-sm font-semibold">${offer.sellerName || 'Team'}</div>
                    ${dealLabel}
                </div>
                <div class="text-xs text-gray-300">
                    ${offer.quantity} gal @ $${this.formatNumber(price)}/gal
                </div>
                <div class="text-sm font-bold text-green-400 mt-1">
                    Total: $${this.formatNumber(price * offer.quantity)}
                </div>
                <button
                    class="buy-now-btn mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm font-semibold transition"
                    data-offer-id="${offer.id}"
                    data-chemical="${chemical}"
                    data-price="${price}"
                    data-quantity="${offer.quantity}"
                    data-seller="${offer.sellerName || 'Team'}">
                    BUY NOW
                </button>
            </div>
        `;
    }

    /**
     * Render a single buy order
     */
    renderBuyOrder(buyOrder, chemical) {
        const price = buyOrder.maxPrice || buyOrder.price;
        const shadowPrice = this.shadowPrices[chemical] || 0;
        const hints = this.settings.showTradingHints;

        // Determine deal quality (for selling to them)
        let dealClass = '';
        let dealLabel = '';
        if (hints && shadowPrice > 0) {
            // If their max price is HIGHER than my shadow price, it's a good deal for me to sell
            const diff = ((price - shadowPrice) / shadowPrice) * 100;
            if (diff > 10) {
                dealClass = 'good-deal';
                dealLabel = '<span class="text-green-500 text-xs font-bold">Good Deal!</span>';
            } else if (diff < -10) {
                dealClass = 'bad-deal';
                dealLabel = '<span class="text-red-500 text-xs font-bold">Too Low</span>';
            } else {
                dealClass = 'fair-deal';
                dealLabel = '<span class="text-orange-500 text-xs font-bold">Fair</span>';
            }
        }

        return `
            <div class="bg-gray-700 rounded p-3 ${dealClass}">
                <div class="flex items-center justify-between mb-2">
                    <div class="text-sm font-semibold">${buyOrder.buyerName || 'Team'}</div>
                    ${dealLabel}
                </div>
                <div class="text-xs text-gray-300">
                    Wants ${buyOrder.quantity} gal @ up to $${this.formatNumber(price)}/gal
                </div>
                <div class="text-sm font-bold text-blue-400 mt-1">
                    Max Total: $${this.formatNumber(price * buyOrder.quantity)}
                </div>
                <button
                    class="sell-to-btn mt-2 w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded text-sm font-semibold transition"
                    data-offer-id="${buyOrder.id}"
                    data-chemical="${chemical}"
                    data-price="${price}"
                    data-quantity="${buyOrder.quantity}"
                    data-buyer="${buyOrder.buyerName || 'Team'}">
                    SELL TO
                </button>
            </div>
        `;
    }

    /**
     * Load my active orders
     */
    async loadMyOrders() {
        try {
            const response = await fetch('/api/team/profile.php');
            const data = await response.json();

            if (data.success) {
                // Get my offers from profile
                const offersResponse = await fetch('/api/marketplace/offers.php');
                const offersData = await offersResponse.json();

                if (offersData.success) {
                    // Find my sell offers in the marketplace
                    this.myOrders = [];
                    Object.values(offersData.offersByChemical).forEach(offers => {
                        offers.forEach(offer => {
                            if (offer.sellerId === this.currentUser) {
                                this.myOrders.push(offer);
                            }
                        });
                    });

                    // Find my buy orders in the marketplace
                    this.myBuyOrders = [];
                    Object.values(offersData.buyOrdersByChemical || {}).forEach(buyOrders => {
                        buyOrders.forEach(buyOrder => {
                            if (buyOrder.buyerId === this.currentUser) {
                                this.myBuyOrders.push(buyOrder);
                            }
                        });
                    });

                    this.renderMyOrders();
                }
            }
        } catch (error) {
            console.error('Failed to load my orders:', error);
        }
    }

    /**
     * Render my active orders
     */
    renderMyOrders() {
        const container = document.getElementById('my-orders');

        if (this.myOrders.length === 0 && this.myBuyOrders.length === 0) {
            container.innerHTML = '<p class="text-gray-300 text-center py-8">You have no active orders</p>';
            return;
        }

        const sellOrdersHTML = this.myOrders.map(order => `
            <div class="bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                <div class="flex-1">
                    <div class="font-semibold text-green-400">
                        SELL: ${order.quantity} gallons of Chemical ${order.chemical}
                    </div>
                    <div class="text-sm text-gray-300">
                        @ $${this.formatNumber(order.minPrice || order.price)}/gal (min) = Total: $${this.formatNumber((order.minPrice || order.price) * order.quantity)}
                    </div>
                </div>
                <button
                    class="cancel-order-btn bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold transition"
                    data-offer-id="${order.id}">
                    CANCEL
                </button>
            </div>
        `).join('');

        const buyOrdersHTML = this.myBuyOrders.map(order => `
            <div class="bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                <div class="flex-1">
                    <div class="font-semibold text-blue-400">
                        BUY: ${order.quantity} gallons of Chemical ${order.chemical}
                    </div>
                    <div class="text-sm text-gray-300">
                        @ up to $${this.formatNumber(order.maxPrice || order.price)}/gal (max) = Total: $${this.formatNumber((order.maxPrice || order.price) * order.quantity)}
                    </div>
                </div>
                <button
                    class="cancel-order-btn bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold transition"
                    data-offer-id="${order.id}">
                    CANCEL
                </button>
            </div>
        `).join('');

        container.innerHTML = sellOrdersHTML + buyOrdersHTML;

        // Add event listeners to cancel buttons
        document.querySelectorAll('.cancel-order-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.cancelOrder(e.target.dataset.offerId));
        });
    }

    /**
     * Cancel an order
     */
    async cancelOrder(offerId) {
        const confirmed = await this.showConfirm('Are you sure you want to cancel this order?', 'Cancel Order');
        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch('/api/offers/cancel.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ offerId })
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Order cancelled successfully', 'success');
                await this.loadMarketplace();
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Failed to cancel order:', error);
            this.showToast('Failed to cancel order: ' + error.message, 'error');
        }
    }

    /**
     * Load notifications
     */
    async loadNotifications() {
        try {
            const response = await fetch('/api/notifications/list.php');
            const data = await response.json();

            if (data.success) {
                this.notifications = data.notifications;
                this.renderNotifications();

                // Update badge
                const badge = document.getElementById('notif-badge');
                if (data.unreadCount > 0) {
                    badge.textContent = data.unreadCount;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    }

    /**
     * Render notifications
     */
    renderNotifications() {
        const container = document.getElementById('notifications-list');

        if (this.notifications.length === 0) {
            container.innerHTML = '<p class="text-gray-300 text-center py-8">No notifications</p>';
            return;
        }

        container.innerHTML = this.notifications.map(notif => `
            <div class="bg-gray-700 rounded p-3 ${notif.read ? 'opacity-60' : ''}">
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <div class="text-sm ${notif.read ? 'text-gray-300' : 'text-white font-semibold'}">
                            ${notif.message}
                        </div>
                        <div class="text-xs text-gray-300 mt-1">
                            ${this.formatTimeAgo(notif.timestamp)}
                        </div>
                    </div>
                    ${!notif.read ? '<div class="w-2 h-2 bg-green-500 rounded-full ml-2 mt-1"></div>' : ''}
                </div>
            </div>
        `).join('');
    }

    /**
     * Load settings
     */
    async loadSettings() {
        try {
            const response = await fetch('/api/team/settings.php');
            const data = await response.json();

            if (data.success) {
                this.settings = data.settings;
                this.updateSettingsUI();
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    /**
     * Update settings UI
     */
    updateSettingsUI() {
        const toggle = document.getElementById('toggle-hints-btn');
        const dot = document.getElementById('toggle-hints-dot');

        if (this.settings.showTradingHints) {
            toggle.classList.remove('bg-gray-600');
            toggle.classList.add('bg-green-600');
            dot.classList.remove('translate-x-1');
            dot.classList.add('translate-x-6');
        } else {
            toggle.classList.add('bg-gray-600');
            toggle.classList.remove('bg-green-600');
            dot.classList.add('translate-x-1');
            dot.classList.remove('translate-x-6');
        }
    }

    /**
     * Toggle trading hints
     */
    async toggleTradingHints() {
        try {
            const newValue = !this.settings.showTradingHints;

            const response = await fetch('/api/team/settings.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ showTradingHints: newValue })
            });

            const data = await response.json();

            if (data.success) {
                this.settings = data.settings;
                this.updateSettingsUI();
                this.renderMarketplace(); // Re-render to show/hide hints
                this.showToast('Settings updated', 'success');
            }
        } catch (error) {
            console.error('Failed to update settings:', error);
            this.showToast('Failed to update settings', 'error');
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Recalculate shadow prices
        document.getElementById('recalc-shadow-btn').addEventListener('click', () => {
            this.recalculateShadowPrices();
        });

        // Create sell/buy buttons
        document.querySelectorAll('.create-sell-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chemical = e.target.dataset.chemical;
                this.openOfferModal(chemical, 'sell');
            });
        });

        document.querySelectorAll('.create-buy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chemical = e.target.dataset.chemical;
                this.openOfferModal(chemical, 'buy');
            });
        });

        // Buy now buttons (delegated)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('buy-now-btn')) {
                const { offerId, chemical, price, quantity, seller } = e.target.dataset;
                this.buyOffer(offerId, chemical, parseFloat(price), parseInt(quantity), seller);
            }

            // Sell to buttons (delegated)
            if (e.target.classList.contains('sell-to-btn')) {
                const { offerId, chemical, price, quantity, buyer } = e.target.dataset;
                this.sellToBuyOrder(offerId, chemical, parseFloat(price), parseInt(quantity), buyer);
            }
        });

        // Modal controls
        document.getElementById('offer-cancel-btn').addEventListener('click', () => {
            this.closeOfferModal();
        });

        document.getElementById('offer-submit-btn').addEventListener('click', () => {
            this.submitOffer();
        });

        // Update total when quantity/price changes
        document.getElementById('offer-quantity').addEventListener('input', () => this.updateOfferTotal());
        document.getElementById('offer-price').addEventListener('input', () => this.updateOfferTotal());

        // Spinner buttons for quantity
        document.getElementById('quantity-minus').addEventListener('click', () => {
            const input = document.getElementById('offer-quantity');
            const current = parseInt(input.value) || 0;
            if (current > 1) {
                input.value = current - 1;
                this.updateOfferTotal();
            }
        });

        document.getElementById('quantity-plus').addEventListener('click', () => {
            const input = document.getElementById('offer-quantity');
            const current = parseInt(input.value) || 0;
            const max = parseInt(document.getElementById('offer-available').textContent.replace(/,/g, '')) || 0;
            if (current < max) {
                input.value = current + 1;
                this.updateOfferTotal();
            }
        });

        // Spinner buttons for price
        document.getElementById('price-minus').addEventListener('click', () => {
            const input = document.getElementById('offer-price');
            const current = parseFloat(input.value) || 0;
            if (current > 0.01) {
                input.value = Math.max(0, current - 0.50).toFixed(2);
                this.updateOfferTotal();
            }
        });

        document.getElementById('price-plus').addEventListener('click', () => {
            const input = document.getElementById('offer-price');
            const current = parseFloat(input.value) || 0;
            input.value = (current + 0.50).toFixed(2);
            this.updateOfferTotal();
        });

        // Notifications
        document.getElementById('notifications-btn').addEventListener('click', () => {
            document.getElementById('notifications-panel').classList.toggle('hidden');
        });

        document.getElementById('close-notif-btn').addEventListener('click', () => {
            document.getElementById('notifications-panel').classList.add('hidden');
        });

        // Settings
        document.getElementById('settings-btn').addEventListener('click', () => {
            document.getElementById('settings-modal').classList.remove('hidden');
        });

        document.getElementById('settings-close-btn').addEventListener('click', () => {
            document.getElementById('settings-modal').classList.add('hidden');
        });

        document.getElementById('toggle-hints-btn').addEventListener('click', () => {
            this.toggleTradingHints();
        });
    }

    /**
     * Open offer modal
     */
    openOfferModal(chemical, type) {
        this.currentOfferModal = { chemical, type };

        const modal = document.getElementById('offer-modal');
        const title = document.getElementById('offer-modal-title');
        const chemicalInput = document.getElementById('offer-chemical');
        const availableSpan = document.getElementById('offer-available');
        const shadowHint = document.getElementById('offer-shadow-hint');
        const priceLabel = document.getElementById('offer-price-label');

        title.textContent = type === 'sell' ? 'Create Sell Order' : 'Create Buy Order';
        chemicalInput.value = chemical;

        if (type === 'sell') {
            priceLabel.textContent = 'Minimum Price per Gallon ($)';
            availableSpan.textContent = this.formatNumber(this.inventory[chemical] || 0);
        } else {
            priceLabel.textContent = 'Maximum Price per Gallon ($)';
            availableSpan.textContent = this.formatNumber(this.profile.currentFunds || 0) + ' available funds';
        }

        shadowHint.textContent = this.formatNumber(this.shadowPrices[chemical] || 0);

        // Clear inputs
        document.getElementById('offer-quantity').value = '';
        document.getElementById('offer-price').value = '';
        document.getElementById('offer-total').textContent = '0.00';

        // Add ARIA attributes
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'offer-modal-title');

        modal.classList.remove('hidden');

        // Focus first input
        setTimeout(() => {
            document.getElementById('offer-quantity').focus();
        }, 100);

        // Add keyboard listener for Esc key
        this.offerModalKeyHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeOfferModal();
            }
        };
        document.addEventListener('keydown', this.offerModalKeyHandler);
    }

    /**
     * Close offer modal
     */
    closeOfferModal() {
        const modal = document.getElementById('offer-modal');
        modal.classList.add('hidden');
        modal.removeAttribute('role');
        modal.removeAttribute('aria-modal');
        modal.removeAttribute('aria-labelledby');

        // Remove keyboard listener
        if (this.offerModalKeyHandler) {
            document.removeEventListener('keydown', this.offerModalKeyHandler);
            this.offerModalKeyHandler = null;
        }

        this.currentOfferModal = null;
    }

    /**
     * Update offer total
     */
    updateOfferTotal() {
        const quantity = parseFloat(document.getElementById('offer-quantity').value) || 0;
        const price = parseFloat(document.getElementById('offer-price').value) || 0;
        const total = quantity * price;

        document.getElementById('offer-total').textContent = this.formatNumber(total);
    }

    /**
     * Submit offer
     */
    async submitOffer() {
        if (!this.currentOfferModal) return;

        const chemical = this.currentOfferModal.chemical;
        const type = this.currentOfferModal.type;
        const quantity = parseFloat(document.getElementById('offer-quantity').value);
        const price = parseFloat(document.getElementById('offer-price').value);

        // Validation
        if (!quantity || quantity <= 0) {
            this.showToast('Please enter a valid quantity', 'error');
            return;
        }

        if (price === null || price === undefined || price < 0) {
            this.showToast('Please enter a valid price', 'error');
            return;
        }

        if (type === 'sell') {
            if (quantity > this.inventory[chemical]) {
                this.showToast('Insufficient inventory', 'error');
                return;
            }

            try {
                const response = await fetch('/api/offers/create.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chemical, quantity, minPrice: price })
                });

                const data = await response.json();

                if (data.success) {
                    this.showToast('Sell order created successfully!', 'success');
                    this.closeOfferModal();
                    await this.loadMarketplace();
                } else {
                    throw new Error(data.error);
                }
            } catch (error) {
                console.error('Failed to create sell order:', error);
                this.showToast('Failed to create sell order: ' + error.message, 'error');
            }
        } else {
            // Buy order
            const totalCost = quantity * price;
            if (totalCost > this.profile.currentFunds) {
                this.showToast('Insufficient funds', 'error');
                return;
            }

            try {
                const response = await fetch('/api/offers/bid.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chemical, quantity, maxPrice: price })
                });

                const data = await response.json();

                if (data.success) {
                    this.showToast('Buy order created successfully!', 'success');
                    this.closeOfferModal();
                    await this.loadMarketplace();
                } else {
                    throw new Error(data.error);
                }
            } catch (error) {
                console.error('Failed to create buy order:', error);
                this.showToast('Failed to create buy order: ' + error.message, 'error');
            }
        }
    }

    /**
     * Buy an offer
     */
    async buyOffer(offerId, chemical, price, quantity, seller) {
        const total = price * quantity;

        const confirmed = await this.showConfirm(
            `Buy ${quantity} gallons of ${chemical} from ${seller} for $${this.formatNumber(total)}?`,
            'Confirm Purchase'
        );
        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch('/api/trades/execute.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ offerId, quantity })
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Trade executed successfully!', 'success');
                await this.loadProfile();
                await this.loadMarketplace();
                await this.loadNotifications();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Failed to execute trade:', error);
            this.showToast('Failed to execute trade: ' + error.message, 'error');
        }
    }

    /**
     * Sell to a buy order
     */
    async sellToBuyOrder(buyOrderId, chemical, price, quantity, buyer) {
        const total = price * quantity;

        const confirmed = await this.showConfirm(
            `Sell ${quantity} gallons of ${chemical} to ${buyer} for $${this.formatNumber(total)}?`,
            'Confirm Sale'
        );
        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch('/api/trades/execute.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ offerId: buyOrderId, quantity })
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Trade executed successfully!', 'success');
                await this.loadProfile();
                await this.loadMarketplace();
                await this.loadNotifications();
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Failed to execute trade:', error);
            this.showToast('Failed to execute trade: ' + error.message, 'error');
        }
    }

    /**
     * Start polling for updates
     */
    startPolling() {
        this.pollingInterval = setInterval(async () => {
            await this.loadMarketplace();
            await this.loadNotifications();
        }, this.pollingFrequency);
    }

    /**
     * Stop polling
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const colors = {
            success: 'bg-green-600',
            error: 'bg-red-600',
            info: 'bg-blue-600'
        };

        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.textContent = message;

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            requestAnimationFrame(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(0)';
            });
        });

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }

    /**
     * Format number with commas
     */
    formatNumber(num) {
        if (num === null || num === undefined) return '0';
        return parseFloat(num).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    }

    /**
     * Format time ago
     */
    formatTimeAgo(timestamp) {
        const seconds = Math.floor(Date.now() / 1000 - timestamp);
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return Math.floor(seconds / 60) + ' minutes ago';
        if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
        return Math.floor(seconds / 86400) + ' days ago';
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new MarketplaceApp();
    app.init();
});
