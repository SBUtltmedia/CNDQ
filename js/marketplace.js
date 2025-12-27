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
     * Post advertisement (interest to buy or sell)
     */
    async postAdvertisement(chemical, type) {
        try {
            const response = await fetch('/api/advertisements/post.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chemical, type })
            });

            const data = await response.json();

            if (data.success) {
                this.showToast(`Posted interest to ${type} ${chemical}`, 'success');
                await this.loadAdvertisements();
            } else {
                throw new Error(data.error || 'Failed to post advertisement');
            }
        } catch (error) {
            console.error('Failed to post advertisement:', error);
            this.showToast('Failed to post advertisement: ' + error.message, 'error');
        }
    }

    /**
     * Open negotiation modal
     */
    openNegotiationModal() {
        const modal = document.getElementById('negotiation-modal');
        modal.classList.remove('hidden');
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');

        // Show list view by default
        this.showNegotiationListView();

        // Render negotiations in modal
        this.renderNegotiationsInModal();
    }

    /**
     * Close negotiation modal
     */
    closeNegotiationModal() {
        const modal = document.getElementById('negotiation-modal');
        modal.classList.add('hidden');
        modal.removeAttribute('role');
        modal.removeAttribute('aria-modal');
    }

    /**
     * Show negotiation list view in modal
     */
    showNegotiationListView() {
        document.getElementById('negotiation-list-view').classList.remove('hidden');
        document.getElementById('negotiation-detail-view').classList.add('hidden');
        document.getElementById('start-negotiation-view').classList.add('hidden');
    }

    /**
     * Render negotiations in modal
     */
    renderNegotiationsInModal() {
        const pending = this.myNegotiations.filter(n => n.status === 'pending');
        const completed = this.myNegotiations.filter(n => n.status !== 'pending');

        // Render pending
        const pendingContainer = document.getElementById('pending-negotiations');
        if (pending.length === 0) {
            pendingContainer.innerHTML = '<p class="text-gray-300 text-center py-4">No pending negotiations</p>';
        } else {
            pendingContainer.innerHTML = pending.map(neg => {
                const otherTeam = neg.initiatorId === this.currentUser ? neg.responderName : neg.initiatorName;
                const lastOffer = neg.offers[neg.offers.length - 1];
                const isMyTurn = neg.lastOfferBy !== this.currentUser;

                return `
                    <div class="bg-gray-600 rounded p-3 cursor-pointer hover:bg-gray-550 transition"
                         onclick="app.viewNegotiationDetail('${neg.id}')">
                        <div class="flex items-center justify-between mb-1">
                            <div class="font-semibold text-sm">Chemical ${neg.chemical}</div>
                            ${isMyTurn ?
                                '<span class="px-2 py-1 bg-green-600 text-white rounded text-xs font-semibold">Your Turn</span>' :
                                '<span class="px-2 py-1 bg-gray-500 text-gray-200 rounded text-xs">Waiting</span>'
                            }
                        </div>
                        <div class="text-xs text-gray-300">${otherTeam}</div>
                        <div class="text-xs text-gray-300">Latest: ${lastOffer.quantity} gal @ $${lastOffer.price.toFixed(2)}</div>
                    </div>
                `;
            }).join('');
        }

        // Render completed
        const completedContainer = document.getElementById('completed-negotiations');
        if (completed.length === 0) {
            completedContainer.innerHTML = '<p class="text-gray-300 text-center py-4">No completed negotiations</p>';
        } else {
            completedContainer.innerHTML = completed.map(neg => {
                const otherTeam = neg.initiatorId === this.currentUser ? neg.responderName : neg.initiatorName;
                const lastOffer = neg.offers[neg.offers.length - 1];
                const statusBadge = neg.status === 'accepted' ?
                    '<span class="px-2 py-1 bg-green-600 text-white rounded text-xs font-semibold">Accepted</span>' :
                    '<span class="px-2 py-1 bg-red-600 text-white rounded text-xs font-semibold">Rejected</span>';

                return `
                    <div class="bg-gray-600 rounded p-3 cursor-pointer hover:bg-gray-550 transition"
                         onclick="app.viewNegotiationDetail('${neg.id}')">
                        <div class="flex items-center justify-between mb-1">
                            <div class="font-semibold text-sm">Chemical ${neg.chemical}</div>
                            ${statusBadge}
                        </div>
                        <div class="text-xs text-gray-300">${otherTeam}</div>
                        <div class="text-xs text-gray-300">Final: ${lastOffer.quantity} gal @ $${lastOffer.price.toFixed(2)}</div>
                    </div>
                `;
            }).join('');
        }
    }

    /**
     * View negotiation detail
     */
    viewNegotiationDetail(negotiationId) {
        const negotiation = this.myNegotiations.find(n => n.id === negotiationId);
        if (!negotiation) return;

        this.currentNegotiation = negotiation;

        // Show detail view
        document.getElementById('negotiation-list-view').classList.add('hidden');
        document.getElementById('negotiation-detail-view').classList.remove('hidden');
        document.getElementById('start-negotiation-view').classList.add('hidden');

        // Set header
        document.getElementById('detail-chemical').textContent = `Chemical ${negotiation.chemical}`;
        const otherTeam = negotiation.initiatorId === this.currentUser ? negotiation.responderName : negotiation.initiatorName;
        document.getElementById('detail-participants').textContent = `Negotiation with ${otherTeam}`;

        // Set status badge
        const statusBadge = document.getElementById('detail-status-badge');
        if (negotiation.status === 'pending') {
            statusBadge.textContent = 'Pending';
            statusBadge.className = 'px-3 py-1 rounded-full text-sm font-semibold bg-yellow-600 text-white';
        } else if (negotiation.status === 'accepted') {
            statusBadge.textContent = 'Accepted';
            statusBadge.className = 'px-3 py-1 rounded-full text-sm font-semibold bg-green-600 text-white';
        } else {
            statusBadge.textContent = 'Rejected';
            statusBadge.className = 'px-3 py-1 rounded-full text-sm font-semibold bg-red-600 text-white';
        }

        // Render offer history
        const historyContainer = document.getElementById('offer-history');
        historyContainer.innerHTML = negotiation.offers.map((offer, idx) => {
            const isFromMe = offer.fromTeamId === this.currentUser;
            const alignment = isFromMe ? 'ml-auto' : 'mr-auto';
            const bgColor = isFromMe ? 'bg-blue-700' : 'bg-gray-600';

            return `
                <div class="max-w-xs ${alignment} ${bgColor} rounded-lg p-3">
                    <div class="font-semibold text-sm">${offer.fromTeamName}</div>
                    <div class="text-xs text-gray-200">
                        ${offer.quantity} gal @ $${offer.price.toFixed(2)}/gal
                    </div>
                    <div class="text-xs font-bold text-green-400">
                        Total: $${(offer.quantity * offer.price).toFixed(2)}
                    </div>
                    <div class="text-xs text-gray-300 mt-1">
                        ${new Date(offer.createdAt * 1000).toLocaleString()}
                    </div>
                </div>
            `;
        }).join('');

        // Show/hide action buttons based on state
        const isMyTurn = negotiation.lastOfferBy !== this.currentUser && negotiation.status === 'pending';
        const counterForm = document.getElementById('counter-offer-form');
        const actions = document.getElementById('negotiation-actions');
        const waiting = document.getElementById('waiting-message');

        counterForm.classList.add('hidden');

        if (negotiation.status !== 'pending') {
            // Negotiation is complete
            actions.classList.add('hidden');
            waiting.classList.add('hidden');
        } else if (isMyTurn) {
            // My turn to respond
            actions.classList.remove('hidden');
            waiting.classList.add('hidden');

            // Set shadow price hint
            const shadowHint = document.getElementById('counter-shadow-hint');
            shadowHint.textContent = this.shadowPrices[negotiation.chemical].toFixed(2);
        } else {
            // Waiting for other team
            actions.classList.add('hidden');
            waiting.classList.remove('hidden');
        }
    }

    /**
     * Start new negotiation with a team
     */
    startNewNegotiation(teamId, teamName, chemical, type) {
        // Show start negotiation view
        document.getElementById('negotiation-list-view').classList.add('hidden');
        document.getElementById('negotiation-detail-view').classList.add('hidden');
        document.getElementById('start-negotiation-view').classList.remove('hidden');

        // Set fields
        document.getElementById('new-neg-team').value = teamName;
        document.getElementById('new-neg-chemical').value = chemical;
        document.getElementById('new-neg-shadow-hint').textContent = this.shadowPrices[chemical].toFixed(2);

        // Store in temp state
        this.tempNegotiation = { teamId, teamName, chemical, type };
    }

    /**
     * Submit new negotiation
     */
    async submitNewNegotiation() {
        const quantity = parseFloat(document.getElementById('new-neg-quantity').value);
        const price = parseFloat(document.getElementById('new-neg-price').value);

        if (!quantity || quantity <= 0) {
            this.showToast('Please enter a valid quantity', 'error');
            return;
        }

        if (price === null || price < 0) {
            this.showToast('Please enter a valid price', 'error');
            return;
        }

        try {
            const response = await fetch('/api/negotiations/initiate.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    responderId: this.tempNegotiation.teamId,
                    chemical: this.tempNegotiation.chemical,
                    quantity,
                    price
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Negotiation started', 'success');
                await this.loadNegotiations();
                this.showNegotiationListView();
                this.renderNegotiationsInModal();
            } else {
                throw new Error(data.error || 'Failed to start negotiation');
            }
        } catch (error) {
            console.error('Failed to start negotiation:', error);
            this.showToast('Failed to start negotiation: ' + error.message, 'error');
        }
    }

    /**
     * Make counter-offer
     */
    async makeCounterOffer() {
        const quantity = parseFloat(document.getElementById('counter-quantity').value);
        const price = parseFloat(document.getElementById('counter-price').value);

        if (!quantity || quantity <= 0) {
            this.showToast('Please enter a valid quantity', 'error');
            return;
        }

        if (price === null || price < 0) {
            this.showToast('Please enter a valid price', 'error');
            return;
        }

        try {
            const response = await fetch('/api/negotiations/counter.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    negotiationId: this.currentNegotiation.id,
                    quantity,
                    price
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Counter-offer sent', 'success');
                await this.loadNegotiations();
                this.viewNegotiationDetail(this.currentNegotiation.id);
            } else {
                throw new Error(data.error || 'Failed to send counter-offer');
            }
        } catch (error) {
            console.error('Failed to send counter-offer:', error);
            this.showToast('Failed to send counter-offer: ' + error.message, 'error');
        }
    }

    /**
     * Accept negotiation offer
     */
    async acceptNegotiation() {
        const confirmed = await this.showConfirm('Accept this offer and execute the trade?', 'Accept Offer');
        if (!confirmed) return;

        try {
            const response = await fetch('/api/negotiations/accept.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    negotiationId: this.currentNegotiation.id
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Trade executed successfully!', 'success');
                await this.loadNegotiations();
                await this.loadProfile(); // Refresh inventory
                this.closeNegotiationModal();
            } else {
                throw new Error(data.error || 'Failed to accept offer');
            }
        } catch (error) {
            console.error('Failed to accept offer:', error);
            this.showToast('Failed to accept offer: ' + error.message, 'error');
        }
    }

    /**
     * Reject/cancel negotiation
     */
    async rejectNegotiation() {
        const confirmed = await this.showConfirm('Cancel this negotiation?', 'Cancel Negotiation');
        if (!confirmed) return;

        try {
            const response = await fetch('/api/negotiations/reject.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    negotiationId: this.currentNegotiation.id
                })
            });

            const data = await response.json();

            if (data.success) {
                this.showToast('Negotiation cancelled', 'success');
                await this.loadNegotiations();
                this.showNegotiationListView();
                this.renderNegotiationsInModal();
            } else {
                throw new Error(data.error || 'Failed to cancel negotiation');
            }
        } catch (error) {
            console.error('Failed to cancel negotiation:', error);
            this.showToast('Failed to cancel negotiation: ' + error.message, 'error');
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

        // Post sell/buy interest buttons
        document.querySelectorAll('.post-sell-interest-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chemical = e.target.dataset.chemical;
                this.postAdvertisement(chemical, 'sell');
            });
        });

        document.querySelectorAll('.post-buy-interest-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chemical = e.target.dataset.chemical;
                this.postAdvertisement(chemical, 'buy');
            });
        });

        // Negotiate buttons (delegated)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('negotiate-btn')) {
                const { teamId, teamName, chemical, type } = e.target.dataset;
                this.openNegotiationModal();
                setTimeout(() => this.startNewNegotiation(teamId, teamName, chemical, type), 100);
            }
        });

        // View all negotiations button
        document.getElementById('view-all-negotiations-btn').addEventListener('click', () => {
            this.openNegotiationModal();
        });

        // Negotiation modal controls
        document.getElementById('negotiation-modal-close-btn').addEventListener('click', () => {
            this.closeNegotiationModal();
        });

        document.getElementById('back-to-list-btn').addEventListener('click', () => {
            this.showNegotiationListView();
            this.renderNegotiationsInModal();
        });

        document.getElementById('back-from-new-btn').addEventListener('click', () => {
            this.showNegotiationListView();
            this.renderNegotiationsInModal();
        });

        // Negotiation actions
        document.getElementById('submit-new-negotiation-btn').addEventListener('click', () => {
            this.submitNewNegotiation();
        });

        document.getElementById('show-counter-form-btn').addEventListener('click', () => {
            document.getElementById('negotiation-actions').classList.add('hidden');
            document.getElementById('counter-offer-form').classList.remove('hidden');
        });

        document.getElementById('submit-counter-btn').addEventListener('click', () => {
            this.makeCounterOffer();
        });

        document.getElementById('accept-offer-btn').addEventListener('click', () => {
            this.acceptNegotiation();
        });

        document.getElementById('reject-offer-btn').addEventListener('click', () => {
            this.rejectNegotiation();
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
     * Start polling for updates
     */
    startPolling() {
        this.pollingInterval = setInterval(async () => {
            await this.loadAdvertisements();
            await this.loadNegotiations();
            await this.loadNotifications();
            await this.checkSessionPhase(); // Trigger auto-advance if enabled
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
     * Check session phase (triggers auto-advance if enabled)
     * This runs silently in the background to ensure auto-advance works
     * even when admin dashboard isn't open
     */
    async checkSessionPhase() {
        try {
            const response = await fetch('/api/admin/session.php');
            if (response.ok) {
                const data = await response.json();
                // Session state checked - auto-advance will trigger if time expired
                // We don't need to do anything with the response, just calling
                // SessionManager::getState() is enough to trigger auto-advance
            }
        } catch (error) {
            // Silently fail - this is a background check
            // If the user isn't admin, they'll get 403 which is fine
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
