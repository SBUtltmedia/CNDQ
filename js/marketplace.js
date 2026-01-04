/**
 * CNDQ Marketplace SPA
 * Single Page Application for Chemical Trading
 */

// Import web components
import './components/chemical-card.js';
import './components/advertisement-item.js';
import './components/negotiation-card.js';
import './components/offer-bubble.js';

// Import API client
import { api } from './api.js';

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
        this.productionResultsShown = false; // Flag to prevent showing modal multiple times

        // Polling
        this.pollingInterval = null;
        this.pollingFrequency = 3000; // 3 seconds

        // Modal state
        this.currentNegotiation = null;
        this.focusBeforeModal = null;
        this.currentModal = null;

        // Track pending ad posts to prevent race conditions
        this.pendingAdPosts = new Set();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('Initializing marketplace...');

            // Wait for custom elements to be defined
            await Promise.all([
                customElements.whenDefined('chemical-card'),
                customElements.whenDefined('advertisement-item'),
                customElements.whenDefined('negotiation-card'),
                customElements.whenDefined('offer-bubble')
            ]);
            console.log('✓ Web components defined');

            // Load team profile
            console.log('Loading profile...');
            await this.loadProfile();
            console.log('✓ Profile loaded');

            // Load shadow prices
            console.log('Loading shadow prices...');
            await this.loadShadowPrices();
            console.log('✓ Shadow prices loaded');

            // Load advertisements and negotiations
            console.log('Loading advertisements...');
            await this.loadAdvertisements();
            console.log('✓ Advertisements loaded');

            console.log('Loading negotiations...');
            await this.loadNegotiations();
            console.log('✓ Negotiations loaded');

            // Load notifications
            console.log('Loading notifications...');
            await this.loadNotifications();
            console.log('✓ Notifications loaded');

            // Load settings
            console.log('Loading settings...');
            await this.loadSettings();
            console.log('✓ Settings loaded');

            // Setup event listeners
            console.log('Setting up event listeners...');
            this.setupEventListeners();
            console.log('✓ Event listeners setup');

            // Load saved theme
            console.log('Loading saved theme...');
            this.loadSavedTheme();
            console.log('✓ Theme loaded');

            // Check for production results BEFORE showing app
            await this.checkSessionPhase();

            // Start polling
            this.startPolling();
            console.log('✓ Polling started');

            // Hide loading, show app
            document.getElementById('loading-overlay').classList.add('hidden');
            console.log('✓ Marketplace initialized successfully');

        } catch (error) {
            console.error('Failed to initialize marketplace:', error);
            console.error('Error stack:', error.stack);
            alert('Failed to load marketplace. Please refresh the page.\n\nError: ' + error.message);
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
        const data = await api.team.getProfile();

        this.profile = data.profile;
        this.inventory = data.inventory;
        this.currentUser = this.profile.email;

        // Update UI
        document.getElementById('team-name').textContent = this.profile.teamName || this.profile.email;
        this.renderFunds();

        // Inventory is now displayed inside chemical-card components
        // No need to update separate inv-* elements

        // Update staleness indicator
        this.updateStalenessIndicator(data.inventory.stalenessLevel, data.inventory.transactionsSinceLastShadowCalc);
    }

    /**
     * Load shadow prices
     */
    async loadShadowPrices() {
        try {
            const data = await api.production.getShadowPrices();
            console.log('Shadow prices API response:', data);

            if (data && data.shadowPrices) {
                this.shadowPrices = data.shadowPrices;
                console.log('Shadow prices loaded:', this.shadowPrices);
                this.updateShadowPricesUI();
            } else {
                console.warn('No shadow prices in API response:', data);
            }
        } catch (error) {
            console.error('Failed to load shadow prices:', error);
            // Don't block on shadow price errors - use defaults
            this.shadowPrices = { C: 0, N: 0, D: 0, Q: 0 };
        }
    }

    /**
     * Update shadow prices in UI
     */
    updateShadowPricesUI() {
        ['C', 'N', 'D', 'Q'].forEach(chem => {
            const price = this.shadowPrices[chem] || 0;
            // Update header shadow prices
            document.getElementById(`shadow-${chem}`).textContent = this.formatNumber(price);

            // Update chemical card shadow prices via component properties
            const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
            if (card) {
                card.shadowPrice = price;
            }
        });
    }

    /**
     * Update staleness indicator
     */
    updateStalenessIndicator(level, count) {
        const indicator = document.getElementById('staleness-indicator');
        const warning = document.getElementById('staleness-warning');

        // Store for theme changes
        this.lastStalenessLevel = level;
        this.lastStalenessCount = count;

        if (level === 'fresh') {
            indicator.innerHTML = '<span class="staleness-fresh">✓ Fresh</span>';
            warning.classList.add('hidden');
        } else if (level === 'warning') {
            indicator.innerHTML = '<span class="staleness-warning">⚠ Stale (1 trade ago)</span>';
            warning.classList.remove('hidden');
            warning.className = 'mt-3 p-3 rounded text-sm badge-warning';
            warning.textContent = '💡 Tip: Your inventory changed! Shadow prices may be outdated. Click [Recalculate] to update them.';
        } else if (level === 'stale') {
            indicator.innerHTML = `<span class="staleness-stale">✗ Very Stale (${count} trades ago)</span>`;
            warning.classList.remove('hidden');
            warning.className = 'mt-3 p-3 rounded text-sm badge-error';
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
            const data = await api.production.getShadowPrices();
            this.shadowPrices = data.shadowPrices;
            this.updateShadowPricesUI();

            // Reload profile to get fresh staleness indicator
            await this.loadProfile();

            this.showToast('Shadow prices updated successfully', 'success');
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
            const data = await api.advertisements.list();
            this.advertisements = data.advertisements;
            this.renderAdvertisements();
        } catch (error) {
            console.error('Failed to load advertisements:', error);
        }
    }

    /**
     * Load negotiations from API
     */
    async loadNegotiations() {
        try {
            const data = await api.negotiations.list();
            this.myNegotiations = data.negotiations || [];
            this.renderNegotiations();
        } catch (error) {
            console.error('Failed to load negotiations:', error);
        }
    }

    /**
     * Render advertisement board
     */
    /**
     * Render advertisement board using web components
     */
    renderAdvertisements() {
        ['C', 'N', 'D', 'Q'].forEach(chemical => {
            const card = document.querySelector(`chemical-card[chemical="${chemical}"]`);
            if (card) {
                // Lit properties are case-sensitive
                card.currentUserId = this.currentUser;
                card.inventory = this.inventory[chemical];
                card.shadowPrice = this.shadowPrices[chemical];
                card.buyAds = this.advertisements[chemical]?.buy || [];
            }
        });
    }

    /**
     * Render negotiations summary using web components
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
            container.innerHTML = '';
            pending.forEach(neg => {
                const card = document.createElement('negotiation-card');
                card.negotiation = neg;
                card.currentUserId = this.currentUser;
                card.context = 'summary';
                container.appendChild(card);
            });
        }
    }

    /**
     * Post advertisement (interest to buy)
     */
    async postAdvertisement(chemical, type = 'buy') {
        const adKey = `${chemical}-buy`;

        // Check if already posting this ad (prevent race condition)
        if (this.pendingAdPosts.has(adKey)) {
            this.showToast(`Already posting buy advertisement for Chemical ${chemical}...`, 'warning');
            return;
        }

        // Check if user already has an active advertisement for this chemical
        const existingAds = this.advertisements[chemical]?.['buy'] || [];
        const hasActiveAd = existingAds.some(ad => ad.teamId === this.currentUser);

        if (hasActiveAd) {
            this.showToast(`You already have an active buy advertisement for Chemical ${chemical}`, 'warning');
            return;
        }

        try {
            // Mark as pending to prevent duplicate clicks
            this.pendingAdPosts.add(adKey);

            const response = await api.advertisements.post(chemical, 'buy');

            // Check if the returned ad was just created or already existed
            const returnedAd = response.advertisement;
            const isNewAd = returnedAd && (Date.now() - returnedAd.createdAt * 1000) < 2000; // Created within last 2 seconds

            if (isNewAd) {
                this.showToast(`Posted interest to buy ${chemical}`, 'success');
            } else {
                this.showToast(`You already have an active buy advertisement for Chemical ${chemical}`, 'warning');
            }

            // Wait for advertisements to reload so duplicate check works on next click
            await this.loadAdvertisements();
        } catch (error) {
            console.error('Failed to post advertisement:', error);
            this.showToast('Failed to post advertisement: ' + error.message, 'error');
        } finally {
            // Always remove pending flag
            this.pendingAdPosts.delete(adKey);
        }
    }

    /**
     * Open buy request modal
     */
    openBuyRequestModal(chemical) {
        // Don't open if production modal is visible (it should block everything)
        if (this.isProductionModalBlocking()) {
            console.log('⚠️ Production modal is open - blocking offer modal');
            return;
        }

        const modal = document.getElementById('offer-modal');
        document.getElementById('offer-chemical').value = `Chemical ${chemical}`;
        document.getElementById('offer-shadow-hint').textContent = this.shadowPrices[chemical].toFixed(2);
        document.getElementById('offer-quantity').value = 100;
        document.getElementById('offer-quantity-slider').value = 100;
        document.getElementById('offer-price').value = '5.00';

        // Store current chemical for later
        this.currentOfferChemical = chemical;

        // Update funds and total
        this.updateBuyRequestTotal();

        modal.classList.remove('hidden');
    }

    /**
     * Update buy request total and validate funds
     */
    updateBuyRequestTotal() {
        const quantity = parseInt(document.getElementById('offer-quantity').value) || 0;
        const price = parseFloat(document.getElementById('offer-price').value) || 0;
        const total = quantity * price;

        document.getElementById('offer-total').textContent = total.toFixed(2);
        document.getElementById('offer-current-funds').textContent = '$' + this.profile.currentFunds.toFixed(2);

        const submitBtn = document.getElementById('offer-submit-btn');
        const warning = document.getElementById('insufficient-funds-warning');

        if (total > this.profile.currentFunds) {
            warning.classList.remove('hidden');
            submitBtn.disabled = true;
        } else {
            warning.classList.add('hidden');
            submitBtn.disabled = false;
        }
    }

    /**
     * Submit buy request
     */
    async submitBuyRequest() {
        const chemical = this.currentOfferChemical;
        const quantity = parseInt(document.getElementById('offer-quantity').value);
        const maxPrice = parseFloat(document.getElementById('offer-price').value);

        if (!chemical || quantity <= 0 || maxPrice < 0) {
            this.showToast('Invalid input', 'error');
            return;
        }

        const total = quantity * maxPrice;
        if (total > this.profile.currentFunds) {
            this.showToast('Insufficient funds', 'error');
            return;
        }

        try {
            const response = await api.offers.bid(chemical, quantity, maxPrice);

            if (response.success) {
                this.showToast(`Buy request posted for ${quantity} gallons of ${chemical}`, 'success');
                this.closeOfferModal();
                await this.loadAdvertisements();
            } else {
                this.showToast(response.message || 'Failed to post buy request', 'error');
            }
        } catch (error) {
            console.error('Failed to submit buy request:', error);
            this.showToast('Failed to post buy request: ' + error.message, 'error');
        }
    }

    /**
     * Close offer modal
     */
    closeOfferModal() {
        document.getElementById('offer-modal').classList.add('hidden');
        this.currentOfferChemical = null;
    }

    /**
     * Open respond to buy request modal
     */
    openRespondModal(buyerTeamId, buyerTeamName, chemical) {
        // Don't open if production modal is visible (it should block everything)
        if (this.isProductionModalBlocking()) {
            console.log('⚠️ Production modal is open - blocking respond modal');
            return;
        }

        const modal = document.getElementById('respond-modal');

        // Store context for later
        this.currentRespondContext = {
            buyerTeamId,
            buyerTeamName,
            chemical
        };

        // Set buyer info
        document.getElementById('respond-buyer-name').textContent = buyerTeamName;
        document.getElementById('respond-chemical').textContent = `Chemical ${chemical}`;

        // Get buy request details from advertisements
        const buyAds = this.advertisements[chemical]?.buy || [];
        const buyRequest = buyAds.find(ad => ad.teamId === buyerTeamId);

        // Set request details (if we have them - otherwise use defaults)
        // Note: Current advertisement system doesn't store quantity/price, so we'll use defaults
        document.getElementById('respond-requested-qty').textContent = '?';
        document.getElementById('respond-max-price').textContent = '?';

        // Set your inventory and shadow price
        const yourInventory = this.inventory[chemical] || 0;
        const yourShadowPrice = this.shadowPrices[chemical] || 0;

        document.getElementById('respond-your-inventory').textContent = yourInventory.toLocaleString();
        document.getElementById('respond-shadow-price').textContent = yourShadowPrice.toFixed(2);

        // Set slider max to inventory
        document.getElementById('respond-quantity-slider').max = yourInventory;
        document.getElementById('respond-quantity').max = yourInventory;

        // Initialize with reasonable defaults
        const defaultQty = Math.min(100, yourInventory);
        document.getElementById('respond-quantity').value = defaultQty;
        document.getElementById('respond-quantity-slider').value = defaultQty;
        document.getElementById('respond-price').value = Math.max(yourShadowPrice, 1).toFixed(2);

        // Update total
        this.updateRespondTotal();

        modal.classList.remove('hidden');
    }

    /**
     * Update respond modal total and validate inventory
     */
    updateRespondTotal() {
        const quantity = parseInt(document.getElementById('respond-quantity').value) || 0;
        const price = parseFloat(document.getElementById('respond-price').value) || 0;
        const total = quantity * price;

        document.getElementById('respond-total').textContent = total.toFixed(2);

        const submitBtn = document.getElementById('respond-submit-btn');
        const warning = document.getElementById('insufficient-inventory-warning');

        const chemical = this.currentRespondContext?.chemical;
        const yourInventory = this.inventory[chemical] || 0;

        if (quantity > yourInventory) {
            warning.classList.remove('hidden');
            submitBtn.disabled = true;
        } else {
            warning.classList.add('hidden');
            submitBtn.disabled = false;
        }
    }

    /**
     * Submit response to buy request (initiate negotiation)
     */
    async submitRespondOffer() {
        if (!this.currentRespondContext) return;

        const { buyerTeamId, buyerTeamName, chemical } = this.currentRespondContext;
        const quantity = parseInt(document.getElementById('respond-quantity').value);
        const price = parseFloat(document.getElementById('respond-price').value);

        const yourInventory = this.inventory[chemical] || 0;

        if (quantity <= 0 || price < 0) {
            this.showToast('Invalid quantity or price', 'error');
            return;
        }

        if (quantity > yourInventory) {
            this.showToast('Insufficient inventory', 'error');
            return;
        }

        try {
            // Initiate negotiation with the buyer. User is responding to a buy request,
            // so from the user's perspective (the initiator of this negotiation), it's a 'sell'.
            const response = await api.negotiations.initiate(buyerTeamId, chemical, quantity, price, 'sell');

            if (response.success) {
                this.showToast(`Offer sent to ${buyerTeamName} for ${quantity} gallons of ${chemical}`, 'success');
                this.closeRespondModal();
                await this.loadNegotiations();
            } else {
                this.showToast(response.message || 'Failed to send offer', 'error');
            }
        } catch (error) {
            console.error('Failed to submit respond offer:', error);
            this.showToast('Failed to send offer: ' + error.message, 'error');
        }
    }

    /**
     * Close respond modal
     */
    closeRespondModal() {
        document.getElementById('respond-modal').classList.add('hidden');
        this.currentRespondContext = null;
    }

    /**
     * Check if production modal is currently blocking other modals
     */
    isProductionModalBlocking() {
        const productionModal = document.getElementById('production-results-modal');
        return productionModal && !productionModal.classList.contains('hidden');
    }

    /**
     * Open negotiation modal
     */
    openNegotiationModal() {
        // Don't open if production modal is visible (it should block everything)
        if (this.isProductionModalBlocking()) {
            console.log('⚠️ Production modal is open - blocking negotiation modal');
            return;
        }

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
            pendingContainer.innerHTML = '';
            pending.forEach(neg => {
                const card = document.createElement('negotiation-card');
                card.negotiation = neg;
                card.currentUserId = this.currentUser;
                card.context = 'list';
                pendingContainer.appendChild(card);
            });
        }

        // Render completed
        const completedContainer = document.getElementById('completed-negotiations');
        if (completed.length === 0) {
            completedContainer.innerHTML = '<p class="text-gray-300 text-center py-4">No completed negotiations</p>';
        } else {
            completedContainer.innerHTML = '';
            completed.forEach(neg => {
                const card = document.createElement('negotiation-card');
                card.negotiation = neg;
                card.currentUserId = this.currentUser;
                card.context = 'list';
                completedContainer.appendChild(card);
            });
        }
    }

    /**
     * View negotiation detail
     */
    viewNegotiationDetail(negotiationId) {
        const negotiation = this.myNegotiations.find(n => n.id === negotiationId);
        if (!negotiation) {
            console.error('Negotiation not found:', negotiationId);
            return;
        }

        // CRITICAL: Ensure the modal is actually open
        this.openNegotiationModal();

        this.currentNegotiation = negotiation;

        // Show detail view
        document.getElementById('negotiation-list-view').classList.add('hidden');
        document.getElementById('negotiation-detail-view').classList.remove('hidden');
        document.getElementById('start-negotiation-view').classList.add('hidden');

        // Set header
        document.getElementById('detail-chemical').textContent = `Chemical ${negotiation.chemical}`;
        const otherTeam = negotiation.initiatorId === this.currentUser ? negotiation.responderName : negotiation.initiatorName;
        
        // Determine if user is buying or selling
        const type = negotiation.type || 'buy';
        const isBuyer = (negotiation.initiatorId === this.currentUser && type === 'buy') || 
                        (negotiation.responderId === this.currentUser && type === 'sell');
        const roleText = isBuyer ? '<span class="text-blue-400 font-bold ml-2">BUYING</span>' : '<span class="text-green-400 font-bold ml-2">SELLING</span>';
        
        document.getElementById('detail-participants').innerHTML = `Negotiation with ${otherTeam} • ${roleText}`;

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

            // Initialize Haggle Sliders (Witcher 3 Style)
            const shadowVal = this.shadowPrices[negotiation.chemical] || 2.0;
            const inventoryVal = this.inventory[negotiation.chemical] || 0;
            const latestOffer = negotiation.offers[negotiation.offers.length - 1];

            const qtySlider = document.getElementById('haggle-qty-slider');
            const priceSlider = document.getElementById('haggle-price-slider');
            
            // Set Quantity Range
            const maxQty = isBuyer ? 2000 : Math.floor(inventoryVal); // Buyer max is arbitrary/funds-based, Seller max is inventory
            document.getElementById('haggle-qty-max').textContent = maxQty;
            qtySlider.min = 1;
            qtySlider.max = maxQty;
            qtySlider.value = latestOffer.quantity;
            document.getElementById('haggle-qty-display').textContent = latestOffer.quantity;

            // Set Price Range (0% to 300% of shadow price)
            priceSlider.min = 0;
            priceSlider.max = Math.ceil(shadowVal * 3);
            priceSlider.step = 0.1;
            priceSlider.value = latestOffer.price;
            document.getElementById('haggle-price-display').textContent = latestOffer.price.toFixed(2);

            this.updateHaggleUI(shadowVal, isBuyer);
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
            await api.negotiations.initiate(
                this.tempNegotiation.teamId,
                this.tempNegotiation.chemical,
                quantity,
                price,
                this.tempNegotiation.type || 'buy'
            );
            this.showToast('Negotiation started', 'success');
            await this.loadNegotiations();
            this.showNegotiationListView();
            this.renderNegotiationsInModal();
        } catch (error) {
            console.error('Failed to start negotiation:', error);
            this.showToast('Failed to start negotiation: ' + error.message, 'error');
        }
    }

    async makeCounterOffer() {
        const quantity = parseFloat(document.getElementById('haggle-qty-slider').value);
        const price = parseFloat(document.getElementById('haggle-price-slider').value);
        const reaction = parseFloat(document.getElementById('haggle-reaction-slider').value);

        if (!quantity || quantity <= 0) {
            this.showToast('Please enter a valid quantity', 'error');
            return;
        }

        try {
            // First send the reaction (ghost player event)
            await api.post('/api/negotiations/react.php', {
                negotiationId: this.currentNegotiation.id,
                level: reaction
            });

            await api.negotiations.counter(this.currentNegotiation.id, quantity, price);
            this.showToast('Counter-offer sent', 'success');
            await this.loadNegotiations();
            this.viewNegotiationDetail(this.currentNegotiation.id);
        } catch (error) {
            console.error('Failed to send counter-offer:', error);
            this.showToast('Failed to send counter-offer: ' + error.message, 'error');
        }
    }

    /**
     * Analyze trade quality based on shadow prices
     */
    analyzeTradeQuality(negotiation) {
        const chemical = negotiation.chemical;
        const shadowPrice = this.shadowPrices[chemical];
        const lastOffer = negotiation.offers[negotiation.offers.length - 1];
        const tradePrice = lastOffer.price;
        const quantity = lastOffer.quantity;

        // Determine if current user is buying or selling
        // type is from initiator's perspective
        const type = negotiation.type || 'buy';
        const isSelling = (negotiation.initiatorId === this.currentUser && type === 'sell') || 
                          (negotiation.responderId === this.currentUser && type === 'buy');

        // Calculate percentage difference from shadow price
        const priceDiff = ((tradePrice - shadowPrice) / shadowPrice) * 100;

        let quality = 'neutral';
        let message = '';

        // Only show special toasts if shadow price is meaningful (> 0)
        if (shadowPrice > 0) {
            if (isSelling) {
                // Selling: Good if price > shadow price
                if (priceDiff >= 25) {
                    quality = 'excellent';
                    message = `Excellent sale! ${priceDiff.toFixed(0)}% above optimal value ($${tradePrice.toFixed(2)} vs $${shadowPrice.toFixed(2)} shadow price)`;
                } else if (priceDiff >= 10) {
                    quality = 'good';
                    message = `Good sale! ${priceDiff.toFixed(0)}% above shadow price ($${tradePrice.toFixed(2)} vs $${shadowPrice.toFixed(2)})`;
                } else if (priceDiff <= -25) {
                    quality = 'bad';
                    message = `Poor sale! ${Math.abs(priceDiff).toFixed(0)}% below optimal value ($${tradePrice.toFixed(2)} vs $${shadowPrice.toFixed(2)} shadow price)`;
                } else if (priceDiff <= -10) {
                    quality = 'warning';
                    message = `Below-market sale: ${Math.abs(priceDiff).toFixed(0)}% under shadow price ($${tradePrice.toFixed(2)} vs $${shadowPrice.toFixed(2)})`;
                }
            } else {
                // Buying: Good if price < shadow price
                if (priceDiff <= -25) {
                    quality = 'excellent';
                    message = `Excellent purchase! ${Math.abs(priceDiff).toFixed(0)}% below optimal value ($${tradePrice.toFixed(2)} vs $${shadowPrice.toFixed(2)} shadow price)`;
                } else if (priceDiff <= -10) {
                    quality = 'good';
                    message = `Good purchase! ${Math.abs(priceDiff).toFixed(0)}% below shadow price ($${tradePrice.toFixed(2)} vs $${shadowPrice.toFixed(2)})`;
                } else if (priceDiff >= 25) {
                    quality = 'bad';
                    message = `Overpaid! ${priceDiff.toFixed(0)}% above optimal value ($${tradePrice.toFixed(2)} vs $${shadowPrice.toFixed(2)} shadow price)`;
                } else if (priceDiff >= 10) {
                    quality = 'warning';
                    message = `Above-market purchase: ${priceDiff.toFixed(0)}% over shadow price ($${tradePrice.toFixed(2)} vs $${shadowPrice.toFixed(2)})`;
                }
            }
        }

        return { quality, message, priceDiff, isSelling };
    }

    /**
     * Accept negotiation offer
     */
    async acceptNegotiation() {
        const confirmed = await this.showConfirm('Accept this offer and execute the trade?', 'Accept Offer');
        if (!confirmed) return;

        try {
            const response = await api.negotiations.accept(this.currentNegotiation.id);
            const heat = response.trade?.heat;

            if (heat) {
                if (heat.isHot) {
                    this.showToast(`🔥 HOT TRADE! Value created: $${this.formatNumber(heat.total)}`, 'hot', 5000);
                } else if (heat.isCold) {
                    this.showToast(`❄️ COLD TRADE! Value destroyed: $${this.formatNumber(Math.abs(heat.total))}`, 'cold', 5000);
                } else {
                    this.showToast('Trade executed successfully!', 'success');
                }
            } else {
                this.showToast('Trade executed successfully!', 'success');
            }

            await this.loadNegotiations();
            await this.loadProfile(); // Refresh inventory
            await this.loadShadowPrices(); // Refresh shadow prices
            this.closeNegotiationModal();
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
            await api.negotiations.reject(this.currentNegotiation.id);
            this.showToast('Negotiation cancelled', 'success');
            await this.loadNegotiations();
            this.showNegotiationListView();
            this.renderNegotiationsInModal();
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
            const data = await api.notifications.list();
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
            const data = await api.team.getSettings();
            this.settings = data.settings;
            // Settings UI update not needed for marketplace view
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }


    /**
     * Update the Haggle (Witcher 3) UI visuals
     */
    updateHaggleUI(shadowPrice, isBuyer) {
        const qty = parseFloat(document.getElementById('haggle-qty-slider').value);
        const price = parseFloat(document.getElementById('haggle-price-slider').value);
        const reaction = parseFloat(document.getElementById('haggle-reaction-slider').value);
        const total = qty * price;

        document.getElementById('haggle-qty-display').textContent = qty;
        document.getElementById('haggle-price-display').textContent = price.toFixed(2);
        document.getElementById('haggle-total').textContent = total.toFixed(2);

        // Player Reaction Label
        const reactionLabel = document.getElementById('reaction-label');
        if (reaction > 80) { reactionLabel.textContent = "Offended"; reactionLabel.className = "text-red-500 font-bold"; }
        else if (reaction > 50) { reactionLabel.textContent = "Disappointed"; reactionLabel.className = "text-yellow-500 font-bold"; }
        else if (reaction > 20) { reactionLabel.textContent = "Wary"; reactionLabel.className = "text-blue-400 font-bold"; }
        else { reactionLabel.textContent = "Neutral"; reactionLabel.className = "text-blue-300 font-bold"; }

        // Persistent NPC Patience (Loaded from state)
        const negId = this.currentNegotiation.id;
        const negState = this.profile.negotiationStates?.[negId] || { patience: 100 };
        
        // Calculate "Predicted" patience drain if we send this offer
        const ratio = price / Math.max(0.01, shadowPrice);
        const type = this.currentNegotiation.type || 'buy';
        const userIsSelling = (this.currentNegotiation.initiatorId === this.currentUser && type === 'sell') || 
                            (this.currentNegotiation.responderId === this.currentUser && type === 'buy');

        // Show the persistent bar
        const patienceBar = document.getElementById('patience-bar');
        const patienceVal = document.getElementById('patience-value');
        const patiencePercent = Math.max(0, negState.patience);
        
        patienceBar.style.width = `${patiencePercent}%`;
        patienceVal.textContent = `${patiencePercent}%`;

        if (patiencePercent < 30) {
            patienceBar.className = "h-full bg-red-600 animate-pulse";
            // Trigger shake if they keep pushing
            const modalContent = document.querySelector('#negotiation-modal > div');
            if (modalContent) {
                modalContent.classList.add('animate-shake');
                setTimeout(() => modalContent.classList.remove('animate-shake'), 500);
            }
        } else if (patiencePercent < 60) {
            patienceBar.className = "h-full bg-yellow-500";
        } else {
            patienceBar.className = "h-full bg-emerald-500";
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

        // Web Component Events: Post interest (from chemical-card)
        document.addEventListener('post-interest', (e) => {
            const { chemical, type } = e.detail;
            if (type === 'buy') {
                this.openBuyRequestModal(chemical);
            } else {
                // Sell is disabled in simplified version
                this.showToast('Selling is disabled. Only buy requests are supported.', 'info');
            }
        });

        // Buy Request Modal event listeners
        document.getElementById('offer-cancel-btn').addEventListener('click', () => {
            this.closeOfferModal();
        });

        document.getElementById('offer-submit-btn').addEventListener('click', () => {
            this.submitBuyRequest();
        });

        // Sync slider and number input
        document.getElementById('offer-quantity-slider').addEventListener('input', (e) => {
            document.getElementById('offer-quantity').value = e.target.value;
            this.updateBuyRequestTotal();
        });

        document.getElementById('offer-quantity').addEventListener('input', (e) => {
            document.getElementById('offer-quantity-slider').value = e.target.value;
            this.updateBuyRequestTotal();
        });

        document.getElementById('offer-price').addEventListener('input', () => {
            this.updateBuyRequestTotal();
        });

        // +/- buttons
        document.getElementById('quantity-plus').addEventListener('click', () => {
            const input = document.getElementById('offer-quantity');
            input.value = parseInt(input.value) + 10;
            document.getElementById('offer-quantity-slider').value = input.value;
            this.updateBuyRequestTotal();
        });

        document.getElementById('quantity-minus').addEventListener('click', () => {
            const input = document.getElementById('offer-quantity');
            input.value = Math.max(1, parseInt(input.value) - 10);
            document.getElementById('offer-quantity-slider').value = input.value;
            this.updateBuyRequestTotal();
        });

        document.getElementById('price-plus').addEventListener('click', () => {
            const input = document.getElementById('offer-price');
            input.value = (parseFloat(input.value) + 0.5).toFixed(2);
            this.updateBuyRequestTotal();
        });

        document.getElementById('price-minus').addEventListener('click', () => {
            const input = document.getElementById('offer-price');
            input.value = Math.max(0, parseFloat(input.value) - 0.5).toFixed(2);
            this.updateBuyRequestTotal();
        });

        // Web Component Events: Negotiate (from advertisement-item)
        document.addEventListener('negotiate', (e) => {
            const { teamId, teamName, chemical, type } = e.detail;

            // If responding to a buy request, use special respond modal
            if (type === 'buy') {
                this.openRespondModal(teamId, teamName, chemical);
            }
        });

        // Respond Modal event listeners
        document.getElementById('respond-cancel-btn').addEventListener('click', () => {
            this.closeRespondModal();
        });

        document.getElementById('respond-submit-btn').addEventListener('click', () => {
            this.submitRespondOffer();
        });

        // Sync slider and number input for respond modal
        document.getElementById('respond-quantity-slider').addEventListener('input', (e) => {
            document.getElementById('respond-quantity').value = e.target.value;
            this.updateRespondTotal();
        });

        document.getElementById('respond-quantity').addEventListener('input', (e) => {
            document.getElementById('respond-quantity-slider').value = e.target.value;
            this.updateRespondTotal();
        });

        document.getElementById('respond-price').addEventListener('input', () => {
            this.updateRespondTotal();
        });

        // +/- buttons for respond modal
        document.getElementById('respond-qty-plus').addEventListener('click', () => {
            const input = document.getElementById('respond-quantity');
            input.value = parseInt(input.value) + 10;
            document.getElementById('respond-quantity-slider').value = input.value;
            this.updateRespondTotal();
        });

        document.getElementById('respond-qty-minus').addEventListener('click', () => {
            const input = document.getElementById('respond-quantity');
            input.value = Math.max(1, parseInt(input.value) - 10);
            document.getElementById('respond-quantity-slider').value = input.value;
            this.updateRespondTotal();
        });

        document.getElementById('respond-price-plus').addEventListener('click', () => {
            const input = document.getElementById('respond-price');
            input.value = (parseFloat(input.value) + 0.5).toFixed(2);
            this.updateRespondTotal();
        });

        document.getElementById('respond-price-minus').addEventListener('click', () => {
            const input = document.getElementById('respond-price');
            input.value = Math.max(0, parseFloat(input.value) - 0.5).toFixed(2);
            this.updateRespondTotal();
        });

        // Web Component Events: View negotiation detail (from negotiation-card)
        document.addEventListener('view-detail', (e) => {
            const { negotiationId } = e.detail;
            console.log('📢 View-detail caught for:', negotiationId);
            this.viewNegotiationDetail(negotiationId);
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

        document.getElementById('cancel-counter-btn').addEventListener('click', () => {
            document.getElementById('counter-offer-form').classList.add('hidden');
            document.getElementById('negotiation-actions').classList.remove('hidden');
        });

        // Haggle Slider Listeners
        document.getElementById('haggle-qty-slider').addEventListener('input', () => {
            const shadowVal = this.shadowPrices[this.currentNegotiation.chemical] || 2.0;
            this.updateHaggleUI(shadowVal);
        });

        document.getElementById('haggle-price-slider').addEventListener('input', () => {
            const shadowVal = this.shadowPrices[this.currentNegotiation.chemical] || 2.0;
            this.updateHaggleUI(shadowVal);
        });

        document.getElementById('haggle-reaction-slider').addEventListener('input', () => {
            const shadowVal = this.shadowPrices[this.currentNegotiation.chemical] || 2.0;
            this.updateHaggleUI(shadowVal);
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
            this.openSettings();
        });

        document.getElementById('settings-close-btn').addEventListener('click', () => {
            this.closeSettings();
        });

        document.getElementById('theme-selector').addEventListener('change', (e) => {
            this.setTheme(e.target.value);
        });

        // Leaderboard
        document.getElementById('leaderboard-btn').addEventListener('click', () => {
            this.openLeaderboard();
        });

        document.getElementById('leaderboard-modal-close-btn').addEventListener('click', () => {
            this.closeLeaderboard();
        });

        // Production Guide
        document.getElementById('production-guide-btn').addEventListener('click', () => {
            this.openProductionGuide();
        });

        document.getElementById('production-guide-close-btn').addEventListener('click', () => {
            this.closeProductionGuide();
        });

        document.getElementById('production-guide-ok-btn').addEventListener('click', () => {
            this.closeProductionGuide();
        });

        document.getElementById('manual-refresh-session').addEventListener('click', () => {
            this.checkSessionPhase();
            this.showToast('Session status refreshed', 'info');
        });

        // Production Results Modal event listeners
        document.getElementById('prod-result-close').addEventListener('click', () => {
            this.closeProductionResults();
        });

        document.getElementById('prod-result-continue').addEventListener('click', () => {
            this.closeProductionResults();
        });
    }


    /**
     * Start polling for updates
     */
    startPolling() {
        if (this.pollingInterval) return;

        const poll = async () => {
            try {
                await Promise.all([
                    this.loadAdvertisements(),
                    this.loadNegotiations(),
                    this.loadNotifications(),
                    this.checkSessionPhase()
                ]);
            } catch (error) {
                console.warn('⚠️ Polling error, pausing for one cycle:', error.message);
                if (error.message.includes('404')) {
                    console.error('🚫 Critical 404 detected. Stopping poll to prevent request storm.');
                    this.stopPolling();
                }
            }
        };

        this.pollingInterval = setInterval(poll, this.pollingFrequency);
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
     */
    async checkSessionPhase() {
        try {
            const data = await api.session.getStatus();
            console.log(`[Session] Polled: Session=${data.session}, Phase=${data.phase}, Time=${data.timeRemaining}`);
            
            // Update UI elements
            document.getElementById('session-num-display').textContent = data.session;

            // Update Timer
            const minutes = Math.floor(data.timeRemaining / 60);
            const seconds = data.timeRemaining % 60;
            document.getElementById('session-timer').textContent =
                `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            // Check for production results to display
            if (data.productionJustRan && !this.productionResultsShown) {
                console.log('✨ Production just completed! Showing results modal...');
                this.productionResultsShown = true;
                // Session 1 = "Start Session 1" (initial production)
                // Session 2 = "End Session 1" (session 1 just ended)
                // Session 3 = "End Session 2" (session 2 just ended)
                const isInitial = data.session === 1;
                const productionSession = data.session === 1 ? 1 : data.session - 1;
                await this.showProductionResults(productionSession, isInitial);
                await this.loadProfile(); // Refresh to show updated inventory/funds
            }

        } catch (error) {
            console.error('Failed to check session status:', error);
        }
    }

    /**
     * Open settings modal
     */
    openSettings() {
        this.openModalAccessible('settings-modal');
    }

    /**
     * Close settings modal
     */
    closeSettings() {
        this.closeModalAccessible('settings-modal');
    }

    /**
     * Show production results modal (transition from "in progress" to "complete" state)
     */
    async showProductionResults(sessionNumber, isInitial = false) {
        try {
            // Fetch production results from API
            const response = await fetch(`/CNDQ/api/production/results.php?session=${sessionNumber}`);
            if (!response.ok) {
                console.error('Failed to fetch production results:', response.statusText);
                return;
            }

            const data = await response.json();

            // Populate modal with data
            const sessionNum = data.sessionNumber || sessionNumber;
            document.getElementById('prod-result-session').textContent = sessionNum;

            // Set title: "Start Session 1" for initial load, "End Session X" for session completions
            const titleElement = document.getElementById('prod-result-title');
            if (isInitial) {
                titleElement.innerHTML = `Start Session <span id="prod-result-session">${sessionNum}</span>`;
            } else {
                titleElement.innerHTML = `End Session <span id="prod-result-session">${sessionNum}</span>`;
            }

            document.getElementById('prod-result-deicer').textContent = this.formatNumber(data.production.deicer);
            document.getElementById('prod-result-solvent').textContent = this.formatNumber(data.production.solvent);
            document.getElementById('prod-result-revenue').textContent = this.formatNumber(data.revenue);

            // Chemicals consumed
            document.getElementById('prod-result-chem-C').textContent = this.formatNumber(data.chemicalsConsumed.C);
            document.getElementById('prod-result-chem-N').textContent = this.formatNumber(data.chemicalsConsumed.N);
            document.getElementById('prod-result-chem-D').textContent = this.formatNumber(data.chemicalsConsumed.D);
            document.getElementById('prod-result-chem-Q').textContent = this.formatNumber(data.chemicalsConsumed.Q);

            // Current status
            document.getElementById('prod-result-current-funds').textContent = this.formatNumber(data.currentFunds);
            document.getElementById('prod-result-inv-C').textContent = this.formatNumber(data.currentInventory.C);
            document.getElementById('prod-result-inv-N').textContent = this.formatNumber(data.currentInventory.N);
            document.getElementById('prod-result-inv-D').textContent = this.formatNumber(data.currentInventory.D);
            document.getElementById('prod-result-inv-Q').textContent = this.formatNumber(data.currentInventory.Q);

            // Transition from "in progress" to "complete" state
            const modal = document.getElementById('production-results-modal');
            const prodInProgress = document.getElementById('production-in-progress');
            const prodComplete = document.getElementById('production-complete');

            modal.classList.remove('hidden');
            prodInProgress.classList.add('hidden');
            prodComplete.classList.remove('hidden');

            console.log('✅ Production results modal displayed (complete state)');
        } catch (error) {
            console.error('Error showing production results:', error);
        }
    }

    /**
     * Close production results modal
     */
    async closeProductionResults() {
        const modal = document.getElementById('production-results-modal');
        const prodInProgress = document.getElementById('production-in-progress');
        const prodComplete = document.getElementById('production-complete');

        modal.classList.add('hidden');
        prodInProgress.classList.add('hidden');
        prodComplete.classList.add('hidden');

        // Acknowledge production to server (clears productionJustRan flag)
        try {
            await fetch('/CNDQ/api/session/status.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ acknowledgeProduction: true })
            });
        } catch (error) {
            console.error('Failed to acknowledge production:', error);
        }

        // Reset flags so they can show again next time
        this.productionResultsShown = false;
        this.productionModalShown = false;

        // Refresh profile to show updated funds/inventory
        this.loadProfile();

        console.log('✅ Production results modal closed');
    }

    /**
     * Render current funds
     */
    renderFunds() {
        const fundsEl = document.getElementById('current-funds');
        if (fundsEl && this.profile) {
            const newFunds = '$' + this.formatNumber(this.profile.currentFunds);
            if (fundsEl.textContent !== newFunds) {
                fundsEl.classList.remove('animate-success-pop');
                void fundsEl.offsetWidth; // Trigger reflow
                fundsEl.classList.add('animate-success-pop');
            }
            fundsEl.textContent = newFunds;
        }
    }

    /**
     * Set and persist theme
     */
    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('cndq-theme', theme);
    }

    /**
     * Load saved theme from localStorage
     */
    loadSavedTheme() {
        const savedTheme = localStorage.getItem('cndq-theme') || 'dark';
        this.setTheme(savedTheme);
        document.getElementById('theme-selector').value = savedTheme;
    }

    /**
     * Open leaderboard modal
     */
    async openLeaderboard() {
        this.openModalAccessible('leaderboard-modal');
        await this.loadLeaderboard();
    }

    /**
     * Close leaderboard modal
     */
    closeLeaderboard() {
        this.closeModalAccessible('leaderboard-modal');
    }

    /**
     * Open production guide modal
     */
    openProductionGuide() {
        this.openModalAccessible('production-guide-modal');
    }

    /**
     * Close production guide modal
     */
    closeProductionGuide() {
        this.closeModalAccessible('production-guide-modal');
    }

    /**
     * Load and display leaderboard
     */
    async loadLeaderboard() {
        const leaderboardBody = document.getElementById('leaderboard-body');
        leaderboardBody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-400">Loading...</td></tr>';

        try {
            const data = await api.leaderboard.getStandings();

            // Update session info
            document.getElementById('leaderboard-session').textContent = data.session;
            document.getElementById('leaderboard-phase').textContent = data.phase;

            // Render standings
            if (data.standings.length === 0) {
                leaderboardBody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-400">No teams yet</td></tr>';
                return;
            }

            leaderboardBody.innerHTML = data.standings.map(team => {
                const isCurrentTeam = team.teamName === this.profile.teamName;
                const profitClass = team.profit >= 0 ? (isCurrentTeam ? 'text-green-light' : 'text-green-400') : (isCurrentTeam ? 'text-red-light' : 'text-red-400');
                const roiClass = team.roi >= 0 ? (isCurrentTeam ? 'text-green-light' : 'text-green-400') : (isCurrentTeam ? 'text-red-light' : 'text-red-400');
                const rowClass = isCurrentTeam ? 'bg-yellow-900 bg-opacity-20 border-l-4 border-yellow-500' : '';
                const textClass = isCurrentTeam ? 'text-white-always' : 'text-white';

                // Medal emoji for top 3
                let rankDisplay = team.rank;
                if (team.rank === 1) rankDisplay = '🥇 1';
                else if (team.rank === 2) rankDisplay = '🥈 2';
                else if (team.rank === 3) rankDisplay = '🥉 3';

                return `
                    <tr class="${rowClass}">
                        <td class="px-4 py-3 font-bold text-xl ${textClass}">${rankDisplay}</td>
                        <td class="px-4 py-3 font-semibold ${isCurrentTeam ? 'text-white-always' : 'text-white'}">${team.teamName}${isCurrentTeam ? ' (You)' : ''}</td>
                        <td class="px-4 py-3 text-right font-semibold ${textClass}">$${this.formatNumber(team.currentFunds)}</td>
                        <td class="px-4 py-3 text-right font-semibold ${profitClass}">${team.profit >= 0 ? '+' : ''}$${this.formatNumber(team.profit)}</td>
                        <td class="px-4 py-3 text-right font-bold text-lg ${roiClass}">${team.roi >= 0 ? '+' : ''}${this.formatNumber(team.roi)}%</td>
                    </tr>
                `;
            }).join('');

        } catch (error) {
            console.error('Failed to load leaderboard:', error);
            leaderboardBody.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-red-400">Failed to load leaderboard</td></tr>';
        }
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = 3000) {
        const colors = {
            success: 'bg-green-600',
            error: 'bg-red-600',
            info: 'bg-blue-600',
            warning: 'bg-yellow-600',
            excellent: 'bg-gradient-to-r from-green-500 to-emerald-600',
            bad: 'bg-gradient-to-r from-red-500 to-rose-600',
            hot: 'bg-gradient-to-r from-orange-500 to-red-600 shadow-orange-500/50',
            cold: 'bg-gradient-to-r from-cyan-400 to-blue-600 shadow-blue-500/50'
        };

        const icons = {
            success: '✓',
            error: '✗',
            info: 'ℹ',
            warning: '⚠',
            excellent: '🎉',
            bad: '⚠️',
            hot: '🔥',
            cold: '❄️'
        };

        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out flex items-center gap-2`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');

        // Add icon if special type
        if (icons[type]) {
            const iconSpan = document.createElement('span');
            iconSpan.textContent = icons[type];
            iconSpan.className = 'text-xl';
            toast.appendChild(iconSpan);
        }

        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;
        toast.appendChild(messageSpan);

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

        // Remove after specified duration
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    }

    /**
     * Trap focus inside modal for accessibility
     */
    trapFocus(modalElement) {
        const focusableElements = modalElement.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        const handleTab = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey && document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                } else if (!e.shiftKey && document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            } else if (e.key === 'Escape') {
                this.closeCurrentModal();
            }
        };

        modalElement.addEventListener('keydown', handleTab);

        // Focus first element
        if (firstElement) {
            firstElement.focus();
        }

        return () => modalElement.removeEventListener('keydown', handleTab);
    }

    /**
     * Open modal with focus management
     */
    openModalAccessible(modalId) {
        // Don't open if production modal is visible (it should block everything)
        if (this.isProductionModalBlocking()) {
            console.log(`⚠️ Production modal is open - blocking ${modalId}`);
            return;
        }

        this.focusBeforeModal = document.activeElement;
        const modal = document.getElementById(modalId);
        this.currentModal = modal;
        modal.classList.remove('hidden');
        this.trapFocus(modal);

        // Add active state to the button that opened this modal
        const buttonMap = {
            'settings-modal': 'settings-btn',
            'leaderboard-modal': 'leaderboard-btn',
            'production-guide-modal': 'production-guide-btn'
        };

        const buttonId = buttonMap[modalId];
        if (buttonId) {
            const button = document.getElementById(buttonId);
            button.classList.add('ring-2', 'ring-white', 'ring-opacity-50');
            button.setAttribute('aria-pressed', 'true');
        }
    }

    /**
     * Close modal and restore focus
     */
    closeModalAccessible(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.add('hidden');
        this.currentModal = null;

        // Remove active state from the button
        const buttonMap = {
            'settings-modal': 'settings-btn',
            'leaderboard-modal': 'leaderboard-btn',
            'production-guide-modal': 'production-guide-btn'
        };

        const buttonId = buttonMap[modalId];
        if (buttonId) {
            const button = document.getElementById(buttonId);
            button.classList.remove('ring-2', 'ring-white', 'ring-opacity-50');
            button.setAttribute('aria-pressed', 'false');
        }

        if (this.focusBeforeModal) {
            this.focusBeforeModal.focus();
            this.focusBeforeModal = null;
        }
    }

    /**
     * Close currently open modal (for ESC key)
     */
    closeCurrentModal() {
        if (this.currentModal) {
            const modalId = this.currentModal.id;

            // Call appropriate close method
            if (modalId === 'settings-modal') this.closeSettings();
            else if (modalId === 'leaderboard-modal') this.closeLeaderboard();
            else if (modalId === 'production-guide-modal') this.closeProductionGuide();
            else if (modalId === 'negotiation-modal') this.closeNegotiationModal();
            else if (modalId === 'offer-modal') this.closeOfferModal();
        }
    }

    /**
     * Format number with commas
     */
    formatNumber(num) {
        if (num === null || num === undefined) return '0';
        const parsed = parseFloat(num);
        // Fix negative zero display issue
        const value = Object.is(parsed, -0) ? 0 : parsed;
        return value.toLocaleString('en-US', {
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
    window.app = app;
    app.init();

    // Auto-detect if admin deleted teams - reload to get new team
    setInterval(async () => {
        try {
            await api.team.getProfile();
        } catch (error) {
            // If team deleted, force reload to create new team
            console.log('⚠️ Team deleted by admin - reloading to get new team...');
            window.location.reload();
        }
    }, 5000); // Check every 5 seconds

    // Poll session state to trigger NPCs (they run every 10s when trading phase is active)
    // This ensures NPCs work even when admin panel isn't open
    setInterval(async () => {
        try {
            await api.admin.getSession();
        } catch (error) {
            // Silently ignore - user might not be admin, but the call still triggers NPCs server-side
        }
    }, 5000); // Poll every 5 seconds
});
