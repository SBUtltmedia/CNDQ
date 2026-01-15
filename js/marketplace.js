/**
 * CNDQ Marketplace SPA
 * Single Page Application for Chemical Trading
 */

// Import web components (cache-busting v4)
import './components/chemical-card.js?v=7';
import './components/advertisement-item.js?v=7';
import './components/negotiation-card.js';
import './components/offer-bubble.js';
import './components/notification-manager.js';
import './components/leaderboard-modal.js';

// Import API client
import { api } from './api.js';

class MarketplaceApp {
    constructor() {
        // State
        this.currentUser = null;
        this.profile = null;
        this.inventory = { C: 0, N: 0, D: 0, Q: 0 };
        this.shadowPrices = { C: 0, N: 0, D: 0, Q: 0 };
        this.advertisements = { C: { buy: [], sell: [] }, N: { buy: [], sell: [] }, D: { buy: [], sell: [] }, Q: { buy: [], sell: [] } };
        this.myNegotiations = [];
        this.notifications = [];
        this.settings = { showTradingHints: false };
        this.productionResultsShown = false; // Flag to prevent showing modal multiple times

        // Polling
        this.pollingInterval = null;
        this.timerInterval = null;
        this.pollingFrequency = 3000; // 3 seconds

        // Track when page loaded to filter out old toasts
        this.pageLoadTime = Date.now() / 1000; // Unix timestamp in seconds
        this.lastServerTimeRemaining = 0;
        this.gameStopped = true;
        this.wasGameStopped = false; // Track previous game stopped state for reload trigger
        this.gameFinished = false;

        // Modal state
        this.currentNegotiation = null;
        this.focusBeforeModal = null;
        this.currentModal = null;

        // Track pending ad posts to prevent race conditions
        this.pendingAdPosts = new Set();

        // Track seen global trades to avoid duplicate toasts
        this.processedGlobalTrades = new Set();
        this.seenCompletedNegotiations = new Set();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('Initializing marketplace...');

            // 1. Setup UI event listeners immediately (responsive UI first)
            console.log('Setting up UI event listeners...');
            this.setupEventListeners();
            console.log('✓ UI listeners setup');

            // 2. Wait for custom elements to be defined
            await Promise.all([
                customElements.whenDefined('chemical-card'),
                customElements.whenDefined('advertisement-item'),
                customElements.whenDefined('negotiation-card'),
                customElements.whenDefined('offer-bubble')
            ]);
            console.log('✓ Web components defined');

            // 3. Load data (async chain)
            console.log('Loading initial data...');
            await Promise.all([
                this.loadProfile(),
                this.loadShadowPrices(),
                this.loadAdvertisements(),
                this.loadNegotiations(),
                this.loadTransactions(),
                this.loadNotifications(),
                this.loadSettings()
            ]);
            console.log('✓ Initial data loaded');

            // Load saved theme
            this.loadSavedTheme();

            // Check for production results
            await this.checkSessionPhase();

            // Start polling
            this.startPolling();
            console.log('✓ Polling started');

            // Hide loading, show app
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay?.classList.add('hidden');
            console.log('✓ Marketplace initialized successfully');

        } catch (error) {
            console.error('Failed to initialize marketplace:', error);
            // Hide loading even on error so user can at least see what's wrong
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay?.classList.add('hidden');
            
            this.showToast('Initialization error: ' + error.message, 'error');
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
            dialog?.classList.remove('hidden');
            dialog.setAttribute('role', 'alertdialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-labelledby', 'confirm-title');
            dialog.setAttribute('aria-describedby', 'confirm-message');

            // Focus the cancel button initially for safety
            setTimeout(() => cancelBtn.focus(), 100);

            const cleanup = () => {
                dialog?.classList.add('hidden');
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

        // Update inventory on chemical-card components
        ['C', 'N', 'D', 'Q'].forEach(chem => {
            const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
            if (card) {
                card.inventory = this.inventory[chem];
            }
        });

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
                this.shadowPrices = {
                    ...data.shadowPrices,
                    maxProfit: data.maxProfit || 0  // Include maxProfit for success metric calculation
                };
                this.ranges = data.ranges || {}; // Store ranges
                console.log('Shadow prices loaded:', this.shadowPrices);
                this.updateShadowPricesUI();

                // Render financial summary now that shadow prices are available
                this.renderFinancialSummary();
            } else {
                console.warn('No shadow prices in API response:', data);
            }
        } catch (error) {
            console.error('Failed to load shadow prices:', error);
            // Don't block on shadow price errors - use defaults
            this.shadowPrices = { C: 0, N: 0, D: 0, Q: 0, maxProfit: 0 };
        }
    }

    /**
     * Update shadow prices in UI
     */
    updateShadowPricesUI() {
        ['C', 'N', 'D', 'Q'].forEach(chem => {
            const price = this.shadowPrices[chem] || 0;
            // Update header shadow prices
            document.getElementById(`shadow-${chem}`).textContent = this.formatCurrency(price);

            // Update chemical card shadow prices via component properties
            const card = document.querySelector(`chemical-card[chemical="${chem}"]`);
            if (card) {
                card.shadowPrice = price;
                if (this.ranges && this.ranges[chem]) {
                    card.ranges = this.ranges[chem];
                }
            }
        });
    }

    /**
     * Update staleness indicator
     */
    updateStalenessIndicator(level, count) {
        const indicator = document.getElementById('staleness-indicator');
        const warning = document.getElementById('staleness-warning');
        const recalcBtn = document.getElementById('recalc-shadow-btn');

        // Store for theme changes
        this.lastStalenessLevel = level;
        this.lastStalenessCount = count;

        if (level === 'fresh') {
            if (indicator) indicator.innerHTML = '<span class="staleness-fresh">✓ Fresh</span>';
            if (warning) warning?.classList.add('hidden');
            // Disable and grey out button when fresh
            if (recalcBtn) {
                recalcBtn.disabled = true;
                recalcBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
                recalcBtn.classList.add('bg-gray-600', 'cursor-not-allowed', 'opacity-50');
            }
        } else if (level === 'warning') {
            if (indicator) indicator.innerHTML = '<span class="staleness-warning">⚠ Stale (1 trade ago)</span>';
            if (warning) {
                warning?.classList.remove('hidden');
                warning.className = 'mt-3 p-3 rounded text-sm badge-warning';
                warning.textContent = '💡 Tip: Your inventory changed! Shadow prices may be outdated. Click [Recalculate] to update them.';
            }
            // Enable button when stale
            if (recalcBtn) {
                recalcBtn.disabled = false;
                recalcBtn.classList.remove('bg-gray-600', 'cursor-not-allowed', 'opacity-50');
                recalcBtn.classList.add('bg-green-600', 'hover:bg-green-700');
            }
        } else if (level === 'stale') {
            if (indicator) indicator.innerHTML = `<span class="staleness-stale">✗ Very Stale (${count} trades ago)</span>`;
            if (warning) {
                warning?.classList.remove('hidden');
                warning.className = 'mt-3 p-3 rounded text-sm badge-error';
                warning.textContent = `⚠️ Warning: Shadow prices are very stale (last calculated before ${count} transactions). Your valuations may be inaccurate!`;
            }
            // Enable button when very stale
            if (recalcBtn) {
                recalcBtn.disabled = false;
                recalcBtn.classList.remove('bg-gray-600', 'cursor-not-allowed', 'opacity-50');
                recalcBtn.classList.add('bg-green-600', 'hover:bg-green-700');
            }
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
            this.shadowPrices = {
                ...data.shadowPrices,
                maxProfit: data.maxProfit || 0
            };
            this.ranges = data.ranges || {}; // Update ranges
            this.updateShadowPricesUI();

            // Clear local staleness tracked state
            this.lastStalenessLevel = 'fresh';
            this.lastStalenessCount = 0;

            // Reload profile to get fresh staleness indicator from server
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
            console.log('📢 Loaded advertisements:', this.advertisements);
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
            this.renderNegotiations(); // This will handle the logic
        } catch (error) {
            console.error('Failed to load negotiations:', error);
        }
    }

    /**
     * Load transaction history
     */
    async loadTransactions() {
        try {
            const data = await api.get('api/trades/history.php');
            if (data.success) {
                this.transactions = data.transactions || [];
                this.renderFinancialSummary();
            }
        } catch (error) {
            console.error('Failed to load transactions:', error);
        }
    }

    /**
     * Render Financial Summary Panel
     */
    renderFinancialSummary() {
        if (!this.transactions || !this.profile) return;

        // If shadow prices haven't loaded yet, wait for them
        if (!this.shadowPrices || !this.shadowPrices.hasOwnProperty('maxProfit')) {
            console.log('Waiting for shadow prices to load before rendering financial summary...');
            return;
        }

        let salesRevenue = 0;
        let purchaseCosts = 0;

        this.transactions.forEach(t => {
            const amount = parseFloat(t.totalAmount) || 0;
            if (t.role === 'seller') {
                salesRevenue += amount;
            } else if (t.role === 'buyer') {
                purchaseCosts += amount;
            }
        });

        const tradingNet = salesRevenue - purchaseCosts;

        // Financial Summary:
        // - currentFunds: Current money (realized profit from trading)
        const realizedProfit = (this.profile.currentFunds || 0) - (this.profile.startingFunds || 0);

        // Inventory Value (Projected Production):
        const hasProduction = (this.profile.productions?.length ?? 0) > 0;
        const projectedRevenue = this.shadowPrices?.maxProfit || 0;
        const inventoryValue = hasProduction ? (realizedProfit - tradingNet) : projectedRevenue;

        // Total Projected Value:
        const totalValue = realizedProfit + (hasProduction ? 0 : projectedRevenue);

        // Success Metric: % Improvement over initial production potential
        const initialPotential = this.profile.initialProductionPotential || 0;
        let percentImprovement = 0;
        if (initialPotential > 0) {
            percentImprovement = ((totalValue - initialPotential) / initialPotential) * 100;
        }

        // Calculate delta from last transaction
        // Simple approach: The delta is just the financial impact of the last transaction
        let inventoryDelta = 0;
        let totalDelta = 0;

        if (this.transactions.length > 0) {
            const lastTransaction = this.transactions[this.transactions.length - 1];
            const lastAmount = Math.abs(lastTransaction.totalAmount || (lastTransaction.quantity * lastTransaction.pricePerGallon));

            // For sellers: positive delta (gained money)
            // For buyers: negative delta (spent money)
            if (lastTransaction.role === 'seller') {
                totalDelta = lastAmount;
                inventoryDelta = lastAmount;
            } else if (lastTransaction.role === 'buyer') {
                totalDelta = -lastAmount;
                inventoryDelta = -lastAmount;
            }

            console.log('[DEBUG] Financial Delta from Last Transaction:', {
                transactionCount: this.transactions.length,
                lastTransaction: {
                    role: lastTransaction.role,
                    chemical: lastTransaction.chemical,
                    quantity: lastTransaction.quantity,
                    pricePerGallon: lastTransaction.pricePerGallon,
                    totalAmount: lastAmount
                },
                inventoryDelta,
                totalDelta
            });
        } else {
            console.log('[DEBUG] No transactions yet, deltas = 0');
        }

        // Update DOM
        const els = {
            inventory: document.getElementById('fin-production-rev'),
            inventoryDelta: document.getElementById('fin-production-delta'),
            totalValue: document.getElementById('fin-net-profit'),
            totalDelta: document.getElementById('fin-total-delta'),
            improvement: document.getElementById('fin-improvement'),
            improvementBadge: document.getElementById('improvement-badge')
        };

        if (els.inventory) {
            els.inventory.textContent = this.formatCurrency(inventoryValue);
        }

        if (els.inventoryDelta) {
            const deltaSign = inventoryDelta >= 0 ? '+' : '';
            const deltaColor = inventoryDelta >= 0 ? 'text-green-400' : 'text-red-400';
            els.inventoryDelta.textContent = inventoryDelta !== 0 ? `${deltaSign}${this.formatCurrency(inventoryDelta)} from last trade` : 'No change yet';
            els.inventoryDelta.className = `text-[10px] uppercase mt-1 ${inventoryDelta !== 0 ? deltaColor : 'text-gray-500'}`;
        }

        if (els.totalValue) {
            els.totalValue.textContent = this.formatCurrency(totalValue);
            els.totalValue.className = `text-2xl font-mono font-bold z-10 ${totalValue >= 0 ? 'text-green-400' : 'text-red-400'}`;
        }

        if (els.totalDelta) {
            const deltaSign = totalDelta >= 0 ? '+' : '';
            const deltaColor = totalDelta >= 0 ? 'text-green-400' : 'text-red-400';
            els.totalDelta.textContent = totalDelta !== 0 ? `${deltaSign}${this.formatCurrency(totalDelta)} from last trade` : 'No change yet';
            els.totalDelta.className = `text-[10px] uppercase mt-1 z-10 ${totalDelta !== 0 ? deltaColor : 'text-gray-400'}`;
        }

        // Display Growth Badge
        if (els.improvement) {
            const sign = percentImprovement >= 0 ? '+' : '';
            els.improvement.textContent = `${sign}${percentImprovement.toFixed(1)}%`;
            els.improvement.className = `text-sm font-mono font-bold ml-1 ${percentImprovement >= 0 ? 'text-green-400' : 'text-red-400'}`;

            if (els.improvementBadge) {
                els.improvementBadge.classList.remove('hidden');
            }
        }
    }

    /**
     * Render Transaction History Table
     */
    renderTransactionHistoryTable() {
        const tbody = document.getElementById('history-table-body');
        const emptyMsg = document.getElementById('history-empty-msg');
        
        if (!tbody) return;

        tbody.innerHTML = '';

        if (!this.transactions || this.transactions.length === 0) {
            emptyMsg?.classList.remove('hidden');
            return;
        }

        emptyMsg?.classList.add('hidden');

        // Sort by time desc
        const sorted = [...this.transactions].sort((a, b) => b.timestamp - a.timestamp);

        sorted.forEach(t => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-700/50 transition';
            
            const date = new Date(t.timestamp * 1000);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            const isSale = t.role === 'seller';
            const typeColor = isSale ? 'text-green-400' : 'text-blue-400';
            const typeIcon = isSale ? '↗' : '↙';
            
            row.innerHTML = `
                <td class="py-3 font-mono text-gray-400">${timeStr}</td>
                <td class="py-3 font-bold ${typeColor}">${typeIcon} ${isSale ? 'SALE' : 'BUY'}</td>
                <td class="py-3 font-bold">Chemical ${t.chemical}</td>
                <td class="py-3 text-right font-mono">${this.formatNumber(t.quantity)}</td>
                <td class="py-3 text-right font-mono">${this.formatCurrency(t.pricePerGallon)}</td>
                <td class="py-3 text-right font-mono font-bold text-white">${this.formatCurrency(t.totalAmount)}</td>
                <td class="py-3 pl-4 text-gray-400">vs ${t.counterparty || 'Unknown'}</td>
            `;
            
            tbody.appendChild(row);
        });
    }

    openTransactionHistory() {
        this.renderTransactionHistoryTable();
        this.openModalAccessible('history-modal');
    }

    closeTransactionHistory() {
        this.closeModalAccessible('history-modal');
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
                // Access ranges from this.ranges, not this.shadowPrices
                card.ranges = this.ranges?.[chemical] || { allowableIncrease: 0, allowableDecrease: 0 };

                // Filter buy ads: only show if player has inventory to fulfill the request
                // If inventory is 0, hide all buy requests (can't sell what you don't have)
                const allBuyAds = this.advertisements[chemical]?.buy || [];
                const myInventory = this.inventory[chemical] || 0;
                const buyAds = myInventory > 0 ? allBuyAds : [];

                card.buyAds = buyAds;
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

        // Show pending negotiations OR newly completed ones that haven't been dismissed
        const pendingOrNew = this.myNegotiations.filter(n => 
            n.status === 'pending' || 
            (n.status !== 'pending' && !this.seenCompletedNegotiations.has(n.id))
        ).slice(0, 5);

        if (pendingOrNew.length === 0) {
            container.innerHTML = '<p class="text-gray-300 text-center py-8">No pending negotiations</p>';
        } else {
            container.innerHTML = '';
            pendingOrNew.forEach(neg => {
                const card = document.createElement('negotiation-card');
                card.negotiation = neg;
                card.currentUserId = this.currentUser;
                card.context = 'summary';
                // If it's completed and not yet seen, show the synopsis view
                if (neg.status !== 'pending' && !this.seenCompletedNegotiations.has(neg.id)) {
                    card.setAttribute('show-synopsis', true);
                }
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
        console.log(`📋 Opening Buy Request Modal for ${chemical}`);
        window.LAST_OPENED_MODAL = chemical;
        // Don't open if production modal is visible (it should block everything)
        if (this.isProductionModalBlocking()) {
            console.log('⚠️ Production modal is open - blocking offer modal');
            return;
        }

        const modal = document.getElementById('offer-modal');
        document.getElementById('offer-chemical').value = `Chemical ${chemical}`;
        document.getElementById('offer-shadow-hint').textContent = this.formatCurrency(this.shadowPrices[chemical]);
        document.getElementById('offer-quantity').value = 100;
        document.getElementById('offer-quantity-slider').value = 100;
        document.getElementById('offer-price').value = '5.00';

        // Store current chemical for later
        this.currentOfferChemical = chemical;

        // Update funds and total
        document.getElementById('offer-current-funds').textContent = this.formatCurrency(this.profile.currentFunds);
        this.updateBuyRequestTotal();

        modal?.classList.remove('hidden');
    }

    /**
     * Update buy request total and validate funds
     */
    updateBuyRequestTotal() {
        const quantity = parseInt(document.getElementById('offer-quantity').value) || 0;
        const price = parseFloat(document.getElementById('offer-price').value) || 0;
        const total = quantity * price;

        document.getElementById('offer-total').textContent = this.formatCurrency(total);
        
        // Calculate Profit Delta (Buying: (ShadowPrice - Price) * Quantity)
        const shadowPrice = this.shadowPrices[this.currentOfferChemical] || 0;
        const profitDelta = (shadowPrice - price) * quantity;
        const deltaEl = document.getElementById('offer-profit-delta');
        if (deltaEl) {
            deltaEl.textContent = (profitDelta >= 0 ? '+' : '') + this.formatCurrency(profitDelta);
            deltaEl.className = `font-bold ${profitDelta >= 0 ? 'text-green-400' : 'text-red-400'}`;
        }

        // Sensitivity Warning (Buying: check allowableIncrease)
        const range = this.ranges?.[this.currentOfferChemical];
        const warningEl = document.getElementById('offer-sensitivity-warning');
        if (range && warningEl) {
            if (quantity > range.allowableIncrease) {
                warningEl?.classList.remove('hidden');
            } else {
                warningEl?.classList.add('hidden');
            }
        }

        // Funds display in modal now shows projected profit improvement
        document.getElementById('offer-current-funds').textContent = this.formatCurrency(this.profile.currentFunds);

        const submitBtn = document.getElementById('offer-submit-btn');
        const warning = document.getElementById('insufficient-funds-warning');

        // NEW MODEL: Infinite Capital. 
        // We never disable the button or show "insufficient funds".
        warning?.classList.add('hidden');
        submitBtn.disabled = false;
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

        try {
            const response = await api.offers.bid(chemical, quantity, maxPrice);

            if (response.success) {
                this.showToast(`Buy request posted for ${quantity} gallons of ${chemical}`, 'success');
                
                // Teachable moment: Remind about stale shadow prices
                if (this.lastStalenessLevel === 'stale') {
                    this.showToast('💡 Tip: Prices change as you trade! Recalculate shadow prices to see how this buy request affects your production value.', 'info', 6000);
                }

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
        document.getElementById('offer-modal')?.classList.add('hidden');
        this.currentOfferChemical = null;
    }

    /**
     * Open respond to buy request modal
     */
    openRespondModal(buyerTeamId, buyerTeamName, chemical, adId) {
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
            chemical,
            adId
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
        document.getElementById('respond-shadow-price').textContent = this.formatCurrency(yourShadowPrice);

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

        modal?.classList.remove('hidden');
    }

    /**
     * Update respond modal total and validate inventory
     */
    updateRespondTotal() {
        const quantity = parseInt(document.getElementById('respond-quantity').value) || 0;
        const price = parseFloat(document.getElementById('respond-price').value) || 0;
        const total = quantity * price;

        document.getElementById('respond-total').textContent = this.formatCurrency(total);

        // Calculate Profit Delta (Selling: (Price - ShadowPrice) * Quantity)
        const chemical = this.currentRespondContext?.chemical;
        const shadowPrice = this.shadowPrices[chemical] || 0;
        const profitDelta = (price - shadowPrice) * quantity;
        const deltaEl = document.getElementById('respond-profit-delta');
        if (deltaEl) {
            deltaEl.textContent = (profitDelta >= 0 ? '+' : '') + this.formatCurrency(profitDelta);
            deltaEl.className = `font-bold ${profitDelta >= 0 ? 'text-green-400' : 'text-red-400'}`;
        }

        // Sensitivity Warning (Selling: check allowableDecrease)
        const range = this.ranges?.[chemical];
        const warningEl = document.getElementById('respond-sensitivity-warning');
        if (range && warningEl) {
            if (quantity > range.allowableDecrease) {
                warningEl?.classList.remove('hidden');
            } else {
                warningEl?.classList.add('hidden');
            }
        }

        const submitBtn = document.getElementById('respond-submit-btn');
        const warning = document.getElementById('insufficient-inventory-warning');

        const yourInventory = this.inventory[chemical] || 0;

        if (quantity > yourInventory) {
            warning?.classList.remove('hidden');
            submitBtn.disabled = true;
        } else {
            warning?.classList.add('hidden');
            submitBtn.disabled = false;
        }
    }

    /**
     * Submit response to buy request (initiate negotiation)
     */
    async submitRespondOffer() {
        if (!this.currentRespondContext) return;

        const { buyerTeamId, buyerTeamName, chemical, adId } = this.currentRespondContext;
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
            const response = await api.negotiations.initiate(buyerTeamId, chemical, quantity, price, 'sell', adId);

            if (response.success) {
                this.showToast(`Offer sent to ${buyerTeamName} for ${quantity} gallons of ${chemical}`, 'success');
                
                // Teachable moment: Remind about stale shadow prices
                if (this.lastStalenessLevel === 'stale') {
                    this.showToast('💡 Tip: Before sending more offers, recalculate your shadow prices. Your inventory has changed!', 'info', 6000);
                }

                this.closeRespondModal();
                await this.loadNegotiations();
                await this.loadAdvertisements(); // Refresh to remove the ad we just responded to
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
        document.getElementById('respond-modal')?.classList.add('hidden');
        this.currentRespondContext = null;
    }

    /**
     * Check if production modal is currently blocking other modals
     */
    isProductionModalBlocking() {
        const productionModal = document.getElementById('production-results-modal');
        if (!productionModal || !productionModal.classList) return false;
        const isBlocking = !productionModal?.classList.contains('hidden');
        if (isBlocking) {
            console.warn('⚠️ UI Blocked: Production modal is currently visible.');
        }
        return isBlocking;
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
        modal?.classList.remove('hidden');
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
        modal?.classList.add('hidden');
        modal.removeAttribute('role');
        modal.removeAttribute('aria-modal');
    }

    /**
     * Show negotiation list view in modal
     */
    showNegotiationListView() {
        document.getElementById('negotiation-list-view')?.classList.remove('hidden');
        document.getElementById('negotiation-detail-view')?.classList.add('hidden');
        document.getElementById('start-negotiation-view')?.classList.add('hidden');
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
            // Show newest completed first
            completed.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            
            completed.forEach(neg => {
                const card = document.createElement('negotiation-card');
                card.negotiation = neg;
                card.currentUserId = this.currentUser;
                card.context = 'list';
                // If it's completed and not yet seen, show the synopsis view
                if (!this.seenCompletedNegotiations.has(neg.id)) {
                    card.setAttribute('show-synopsis', true);
                }
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
        document.getElementById('negotiation-list-view')?.classList.add('hidden');
        document.getElementById('negotiation-detail-view')?.classList.remove('hidden');
        document.getElementById('start-negotiation-view')?.classList.add('hidden');

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
        historyContainer.innerHTML = '';
        
        negotiation.offers.forEach((offer) => {
            const bubble = document.createElement('offer-bubble');
            bubble.offer = offer;
            bubble.isFromMe = offer.fromTeamId === this.currentUser;
            historyContainer.appendChild(bubble);
        });

        // Show/hide action buttons based on state
        const isMyTurn = negotiation.lastOfferBy !== this.currentUser && negotiation.status === 'pending';
        const counterForm = document.getElementById('counter-offer-form');
        const actions = document.getElementById('negotiation-actions');
        const waiting = document.getElementById('waiting-message');

        counterForm?.classList.add('hidden');

        if (negotiation.status !== 'pending') {
            // Negotiation is complete
            actions?.classList.add('hidden');
            waiting?.classList.add('hidden');
        } else if (isMyTurn) {
            // My turn to respond
            actions?.classList.remove('hidden');
            waiting?.classList.add('hidden');

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

            // Display shadow price range information
            const rangeDisplay = document.getElementById('haggle-range-display');
            if (rangeDisplay && this.ranges && this.ranges[negotiation.chemical]) {
                const range = this.ranges[negotiation.chemical];
                const decrease = range.allowableDecrease || 0;
                const increase = range.allowableIncrease || 0;
                const isRangeZero = (increase + decrease) < 1;

                if (isRangeZero) {
                    rangeDisplay.textContent = 'N/A (Low Inventory)';
                } else {
                    const increaseText = increase >= 9000 ? '∞' : increase.toFixed(0);
                    rangeDisplay.textContent = `[-${decrease.toFixed(0)}, +${increaseText}] gal`;
                }
            }

            // Set Price Range (0% to 300% of shadow price)
            priceSlider.min = 0;
            priceSlider.max = Math.ceil(shadowVal * 3);
            priceSlider.step = 0.1;
            priceSlider.value = latestOffer.price;
            document.getElementById('haggle-price-display').textContent = this.formatCurrency(latestOffer.price);

            this.updateHaggleUI(shadowVal, isBuyer);
        } else {
            // Waiting for other team
            actions?.classList.add('hidden');
            waiting?.classList.remove('hidden');
        }
    }

    /**
     * Start new negotiation with a team
     */
    startNewNegotiation(teamId, teamName, chemical, type) {
        // Show start negotiation view
        document.getElementById('negotiation-list-view')?.classList.add('hidden');
        document.getElementById('negotiation-detail-view')?.classList.add('hidden');
        document.getElementById('start-negotiation-view')?.classList.remove('hidden');

        // Set fields
        document.getElementById('new-neg-team').value = teamName;
        document.getElementById('new-neg-chemical').value = chemical;
        const shadowPrice = this.shadowPrices[chemical] || 0;
        document.getElementById('new-neg-shadow-hint').textContent = this.formatCurrency(shadowPrice);

        // Store in temp state
        this.tempNegotiation = { teamId, teamName, chemical, type };

        // Initialize values
        const qtyInput = document.getElementById('new-neg-quantity');
        const qtySlider = document.getElementById('new-neg-quantity-slider');
        const priceInput = document.getElementById('new-neg-price');
        
        // Determine max quantity
        let maxQty = 2000;
        if (type === 'sell') {
            const inventory = this.inventory[chemical] || 0;
            maxQty = Math.floor(inventory);
        }

        qtySlider.max = maxQty;
        // Default to 100 or max if less
        const defaultQty = Math.min(100, maxQty);
        qtySlider.value = defaultQty;
        qtyInput.value = defaultQty;
        
        // Initialize price
        priceInput.value = Math.max(shadowPrice, 5.00).toFixed(2);
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

            // Teachable moment: Remind about stale shadow prices
            if (this.lastStalenessLevel === 'stale') {
                this.showToast('💡 Tip: Your inventory changed! Are you sure your offer is still profitable? Recalculate shadow prices to be sure.', 'info', 6000);
            }

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
        const total = quantity * price;
        const chemical = this.currentNegotiation.chemical;

        if (!quantity || quantity <= 0) {
            this.showToast('Please enter a valid quantity', 'error');
            return;
        }

        // Determine if current user is buying or selling
        const type = this.currentNegotiation.type || 'buy';
        const isSelling = (this.currentNegotiation.initiatorId === this.currentUser && type === 'sell') || 
                          (this.currentNegotiation.responderId === this.currentUser && type === 'buy');

        // Check feasibility
        if (isSelling) {
            const currentInv = this.inventory[chemical] || 0;
            if (currentInv < quantity) {
                this.showToast(`Insufficient inventory for this counter-offer!`, 'error');
                return;
            }
        } else {
            // NEW MODEL: Infinite Capital.
            // Buyer can always send an offer regardless of funds.
        }

        try {
            // First send the reaction (ghost player event)
            await api.post('api/negotiations/react.php', {
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
        const negotiation = this.currentNegotiation;
        const lastOffer = negotiation.offers[negotiation.offers.length - 1];
        const chemical = negotiation.chemical;
        const quantity = lastOffer.quantity;
        const price = lastOffer.price;
        const total = quantity * price;

        // Determine if current user is buying or selling
        const type = negotiation.type || 'buy';
        const isSelling = (negotiation.initiatorId === this.currentUser && type === 'sell') || 
                          (negotiation.responderId === this.currentUser && type === 'buy');

        // Check feasibility
        if (isSelling) {
            const currentInv = this.inventory[chemical] || 0;
            if (currentInv < quantity) {
                this.showToast(`Insufficient inventory! You need ${quantity} gallons of ${chemical} but only have ${currentInv.toFixed(1)}.`, 'error');
                return;
            }
        } else {
            // NEW MODEL: Infinite Capital. 
            // Buyer can always accept an offer regardless of funds.
        }

        const confirmed = await this.showConfirm('Accept this offer and execute the trade?', 'Accept Offer');
        if (!confirmed) return;

        try {
            const response = await api.negotiations.accept(this.currentNegotiation.id);
            const heat = response.trade?.heat;

            if (heat) {
                if (heat.isHot) {
                    this.showToast(`🔥 HOT TRADE! Value created: ${this.formatCurrency(heat.total)}`, 'hot', 5000);
                } else if (heat.isCold) {
                    this.showToast(`❄️ COLD TRADE! Value destroyed: ${this.formatCurrency(Math.abs(heat.total))}`, 'cold', 5000);
                } else {
                    this.showToast('Trade executed successfully!', 'success');
                }
            } else {
                this.showToast('Trade executed successfully!', 'success');
            }

            // Teachable moment: Remind about stale shadow prices
            if (this.lastStalenessLevel === 'stale') {
                this.showToast('💡 Tip: You\'ve made several trades without updating your valuations. Recalculate shadow prices to see your new optimal strategy!', 'info', 6000);
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
            if (data && data.success) {
                this.notifications = data.notifications;
                
                // Update component
                const notifManager = document.getElementById('notification-manager');
                if (notifManager) {
                    notifManager.notifications = data.notifications;
                    notifManager.unreadCount = data.unreadCount || 0;
                }
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
        }
    }

    /**
     * Handle clicking a notification
     */
    async handleNotificationClick(notifId) {
        // Find notification
        const notif = this.notifications.find(n => n.id === notifId);
        if (!notif) return;

        // Mark as read (optimistic)
        notif.read = true;
        
        // Refresh UI
        const notifManager = document.getElementById('notification-manager');
        if (notifManager) {
            notifManager.notifications = [...this.notifications];
        }

        // Action based on type
        if (notif.type.toLowerCase() === 'negotiation' || notif.type.toLowerCase() === 'offer') {
            this.openNegotiationModal();
        }
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
        document.getElementById('haggle-price-display').textContent = this.formatCurrency(price);
        document.getElementById('haggle-total').textContent = this.formatCurrency(total);

        // Calculate Profit Delta
        const type = this.currentNegotiation.type || 'buy';
        const userIsSelling = (this.currentNegotiation.initiatorId === this.currentUser && type === 'sell') ||
                            (this.currentNegotiation.responderId === this.currentUser && type === 'buy');
        
        const profitDelta = userIsSelling ? (price - shadowPrice) * qty : (shadowPrice - price) * qty;
        const deltaEl = document.getElementById('haggle-profit-delta');
        if (deltaEl) {
            deltaEl.textContent = (profitDelta >= 0 ? '+' : '') + this.formatCurrency(profitDelta);
            deltaEl.className = `font-bold ${profitDelta >= 0 ? 'text-green-400' : 'text-red-400'}`;
        }

        // Sensitivity Warning
        const range = this.ranges?.[this.currentNegotiation.chemical];
        const warningEl = document.getElementById('haggle-sensitivity-warning');
        if (range && warningEl) {
            const limit = userIsSelling ? range.allowableDecrease : range.allowableIncrease;
            if (qty > limit) {
                warningEl?.classList.remove('hidden');
            } else {
                warningEl?.classList.add('hidden');
            }
        }

        // Real-time Resource Validation
        const errorEl = document.getElementById('haggle-error');
        const submitBtn = document.getElementById('submit-counter-btn');
        let hasError = false;
        let errorMsg = '';

        if (userIsSelling) {
            const currentInv = this.inventory[this.currentNegotiation.chemical] || 0;
            if (qty > currentInv) {
                hasError = true;
                errorMsg = `⚠️ INSUFFICIENT ${this.currentNegotiation.chemical}: ${currentInv.toFixed(1)} gal available`;
            }
        } else {
            // NEW MODEL: Infinite Capital. 
            // Buyer can always make an offer regardless of funds.
            hasError = false;
        }

        if (hasError) {
            errorEl.textContent = errorMsg;
            errorEl?.classList.remove('hidden');
            submitBtn.disabled = true;
            submitBtn?.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            errorEl?.classList.add('hidden');
            submitBtn.disabled = false;
            submitBtn?.classList.remove('opacity-50', 'cursor-not-allowed');
        }

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
                modalContent?.classList.add('animate-shake');
                setTimeout(() => modalContent?.classList.remove('animate-shake'), 500);
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
            const { teamId, teamName, chemical, type, adId } = e.detail;

            // If responding to a buy request, use special respond modal
            if (type === 'buy') {
                this.openRespondModal(teamId, teamName, chemical, adId);
            } else if (type === 'sell') {
                // If initiating negotiation with a seller (we want to buy from them)
                this.openNegotiationModal();
                this.startNewNegotiation(teamId, teamName, chemical, 'buy');
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

        // Event listener for dismissing a synopsis card
        document.addEventListener('dismiss-synopsis', (e) => {
            const { negotiationId } = e.detail;
            this.seenCompletedNegotiations.add(negotiationId);
            // Re-render the views to show the normal card now
            this.renderNegotiations();
            this.renderNegotiationsInModal();
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

        // Start New Negotiation Sliders & Buttons
        document.getElementById('new-neg-quantity-slider').addEventListener('input', (e) => {
            document.getElementById('new-neg-quantity').value = e.target.value;
        });

        document.getElementById('new-neg-quantity').addEventListener('input', (e) => {
            document.getElementById('new-neg-quantity-slider').value = e.target.value;
        });

        document.getElementById('new-neg-qty-plus').addEventListener('click', () => {
            const input = document.getElementById('new-neg-quantity');
            const slider = document.getElementById('new-neg-quantity-slider');
            // Respect max from slider
            const max = parseFloat(slider.max);
            const val = Math.min(max, parseInt(input.value) + 10);
            input.value = val;
            slider.value = val;
        });

        document.getElementById('new-neg-qty-minus').addEventListener('click', () => {
            const input = document.getElementById('new-neg-quantity');
            const slider = document.getElementById('new-neg-quantity-slider');
            const val = Math.max(1, parseInt(input.value) - 10);
            input.value = val;
            slider.value = val;
        });

        document.getElementById('new-neg-price-plus').addEventListener('click', () => {
            const input = document.getElementById('new-neg-price');
            input.value = (parseFloat(input.value) + 0.5).toFixed(2);
        });

        document.getElementById('new-neg-price-minus').addEventListener('click', () => {
            const input = document.getElementById('new-neg-price');
            input.value = Math.max(0, parseFloat(input.value) - 0.5).toFixed(2);
        });

        // Negotiation actions
        document.getElementById('submit-new-negotiation-btn').addEventListener('click', () => {
            this.submitNewNegotiation();
        });

        document.getElementById('show-counter-form-btn').addEventListener('click', () => {
            document.getElementById('negotiation-actions')?.classList.add('hidden');
            document.getElementById('counter-offer-form')?.classList.remove('hidden');
        });

        document.getElementById('submit-counter-btn').addEventListener('click', () => {
            this.makeCounterOffer();
        });

        document.getElementById('cancel-counter-btn').addEventListener('click', () => {
            document.getElementById('counter-offer-form')?.classList.add('hidden');
            document.getElementById('negotiation-actions')?.classList.remove('hidden');
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
        const notifManager = document.getElementById('notification-manager');
        if (notifManager) {
            notifManager.addEventListener('notification-click', (e) => {
                const notif = e.detail.notification;
                this.handleNotificationClick(notif.id);
            });
        }

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

        // Production Results Modal event listeners
        document.getElementById('prod-result-close').addEventListener('click', () => {
            this.closeProductionResults();
        });

        document.getElementById('prod-result-continue').addEventListener('click', () => {
            this.closeProductionResults();
        });

        // Game Over Overlay event listeners
        document.getElementById('restart-game-btn').addEventListener('click', () => {
            this.restartGame();
        });

        // Transaction History
        const viewHistoryBtn = document.getElementById('view-history-btn');
        if (viewHistoryBtn) {
            viewHistoryBtn.addEventListener('click', () => {
                this.openTransactionHistory();
            });
        }

        const historyCloseBtn = document.getElementById('history-close-btn');
        if (historyCloseBtn) {
            historyCloseBtn.addEventListener('click', () => {
                this.closeTransactionHistory();
            });
        }

        const tabLeaderboard = document.getElementById('tab-leaderboard');
        const tabHistory = document.getElementById('tab-history');
        const contentLeaderboard = document.getElementById('content-leaderboard');
        const contentHistory = document.getElementById('content-history');

        if (tabLeaderboard && tabHistory) {
            tabLeaderboard.addEventListener('click', () => {
                tabLeaderboard.className = 'px-12 py-4 font-black uppercase tracking-widest border-b-4 border-purple-500 text-purple-400 transition-all';
                tabHistory.className = 'px-12 py-4 font-black uppercase tracking-widest border-b-4 border-transparent text-gray-500 hover:text-gray-300 transition-all';
                contentLeaderboard?.classList.remove('hidden');
                contentHistory?.classList.add('hidden');
            });

            tabHistory.addEventListener('click', () => {
                tabHistory.className = 'px-12 py-4 font-black uppercase tracking-widest border-b-4 border-purple-500 text-purple-400 transition-all';
                tabLeaderboard.className = 'px-12 py-4 font-black uppercase tracking-widest border-b-4 border-transparent text-gray-500 hover:text-gray-300 transition-all';
                contentHistory?.classList.remove('hidden');
                contentLeaderboard?.classList.add('hidden');
            });
        }
    }


    /**
     * Start polling for updates
     */
    startPolling() {
        if (this.pollingInterval) return;

        const poll = async () => {
            try {
                // Run these in parallel but catch individual errors so one doesn't block others
                await Promise.all([
                    this.loadProfile().catch(e => console.error('Profile poll failed', e)),
                    this.loadAdvertisements().catch(e => console.error('Ad poll failed', e)),
                    this.loadNegotiations().catch(e => console.error('Neg poll failed', e)),
                    this.loadNotifications().catch(e => console.error('Notif poll failed', e)),
                    this.checkSessionPhase().catch(e => console.error('Session poll failed', e)),
                    this.loadTransactions().catch(e => console.error('Txn poll failed', e))
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

        // Local timer update every second
        if (!this.timerInterval) {
            this.timerInterval = setInterval(() => {
                if (!this.gameStopped && this.lastServerTimeRemaining > 0) {
                    this.lastServerTimeRemaining--;
                    this.updateTimerDisplay(this.lastServerTimeRemaining);
                }
            }, 1000);
        }
    }

    /**
     * Stop polling
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    /**
     * Check session phase (triggers auto-advance if enabled)
     */
    async checkSessionPhase() {
        try {
            const data = await api.session.getStatus();
            await this._processSessionData(data);
        } catch (error) {
            console.error('🚨 CRITICAL ERROR in checkSessionPhase:', error);
            console.error(error.stack);
        }
    }

    async _processSessionData(data) {
        try {
            console.log(`[Session] Polled: Session=${data.session}, Phase=${data.phase}, Time=${data.timeRemaining}, Stopped=${data.gameStopped}`);
            
            // DETECT HARD RESET: If current session is 1 but we thought we were further ahead,
            // or if we have profile data but the server session is 1 and we haven't handled a reset yet.
            if (this.lastSessionNumber && data.session < this.lastSessionNumber && data.session === 1) {
                console.log('🔄 Session reset detected (New Game started). Reloading UI...');
                window.location.reload();
                return;
            }
            this.lastSessionNumber = data.session;

            this.gameStopped = data.gameStopped;
            this.lastServerTimeRemaining = data.timeRemaining;

            // Check for game finished state (End Screen)
            const gameOverOverlay = document.getElementById('game-over-overlay');
            if (data.gameFinished) {
                if (gameOverOverlay && gameOverOverlay.classList && gameOverOverlay?.classList.contains('hidden')) {
                    gameOverOverlay?.classList.remove('hidden');
                    await this.renderGameOverStats();
                }
                this.gameFinished = true;
                return; // Stop processing other updates if game is finished
            } else {
                if (gameOverOverlay && gameOverOverlay.classList) gameOverOverlay?.classList.add('hidden');
                this.gameFinished = false;
            }

            // Check for game stopped state (Market Closed)
            const mainApp = document.getElementById('app');
            const closedOverlay = document.getElementById('market-closed-overlay');
            if (data.gameStopped) {
                this.wasGameStopped = true; // Track that game is stopped

                // Close any open modals when market closes
                this.closeAllModals();

                if (closedOverlay && closedOverlay.classList) closedOverlay?.classList.remove('hidden');
                if (mainApp && mainApp.classList) mainApp?.classList.add('hidden');
                return; // Stop processing other updates if game is stopped
            } else {
                // Game is running - check if it was previously stopped
                if (this.wasGameStopped === true) {
                    console.log('🎮 Game started! Performing hard refresh to clear cache...');
                    window.location.reload(true); // Force reload from server, not cache
                    return;
                }
                this.wasGameStopped = false;
                if (closedOverlay && closedOverlay.classList) closedOverlay?.classList.add('hidden');
                if (mainApp && mainApp.classList) mainApp?.classList.remove('hidden');
            }

            // Update UI elements
            const phaseEl = document.getElementById('current-phase');
            if (phaseEl) {
                phaseEl.textContent = data.phase;
                if (data.gameStopped) {
                    phaseEl.className = 'text-xs text-red-400 uppercase font-bold';
                } else {
                    phaseEl.className = 'text-xs text-green-400 uppercase font-bold';
                }
            }

            // Process Global Trades/Events for Toasts
            if (data.recentTrades && Array.isArray(data.recentTrades)) {
                // Process in reverse (oldest first) so they stack correctly
                [...data.recentTrades].reverse().forEach(event => {
                    // Support both transactionId (trades) and eventId (joins)
                    const uniqueId = event.transactionId || event.eventId;

                    if (uniqueId && !this.processedGlobalTrades.has(uniqueId)) {
                        this.processedGlobalTrades.add(uniqueId);

                        // Get event timestamp (trades use timestamp, joins use joinedAt)
                        const eventTime = event.timestamp || event.joinedAt;

                        // Only show toasts for events that happened after page load
                        // This prevents toast flood on refresh/late join
                        if (eventTime && eventTime >= this.pageLoadTime) {
                            if (event.type === 'join') {
                                // Team Joined Event
                                if (event.teamName !== (this.profile?.teamName)) { // Don't toast my own join (I know I joined)
                                    this.showToast(`👋 Team ${event.teamName} has joined the game!`, 'info', 5000);
                                }
                            } else {
                                // Trade Event
                                // Don't toast if I was part of it (I already got a personal toast/notif)
                                const involvesMe = event.sellerId === this.currentUser || event.buyerId === this.currentUser;

                                if (!involvesMe) {
                                    const isHot = event.heat?.isHot;
                                    const icon = isHot ? '🔥 ' : '📦 ';
                                    const message = `${icon}${event.sellerName} sold ${this.formatNumber(event.quantity)} gal of ${event.chemical} to ${event.buyerName}`;
                                    const type = isHot ? 'hot' : 'info';
                                    this.showToast(message, type, 4000);
                                }
                            }
                        }
                    }
                });

                // Cleanup memory: keep only last 100 IDs

                // Cleanup memory: keep only last 100 IDs
                if (this.processedGlobalTrades.size > 100) {
                    const tradesArray = Array.from(this.processedGlobalTrades);
                    this.processedGlobalTrades = new Set(tradesArray.slice(-100));
                }
            }

            // Update Timer
            this.updateTimerDisplay(data.timeRemaining);

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
            console.error('🚨 ERROR in _processSessionData:', error);
            throw error;
        }
    }

    /**
     * Update the timer display
     */
    updateTimerDisplay(timeRemaining) {
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        const timerEl = document.getElementById('session-timer');
        if (timerEl) {
            timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            
            // To prevent label shifting when time decreases (e.g. 1000:00 to 99:59),
            // we ensure the timer box never shrinks below the maximum width it has reached.
            const currentWidth = timerEl.offsetWidth;
            const currentMin = parseFloat(timerEl.style.minWidth) || 0;
            if (currentWidth > currentMin) {
                timerEl.style.minWidth = currentWidth + 'px';
            }
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
            const data = await api.get(`api/production/results.php?session=${sessionNumber}`);

            // Populate modal with data
            const sessionNum = data.sessionNumber || sessionNumber;
            document.getElementById('prod-result-session').textContent = sessionNum;

            // Set title: "Initial Potential" for initial load, "Final Results" for session completions
            const titleElement = document.getElementById('prod-result-title');
            const revenueNote = document.getElementById('revenue-note');
            if (isInitial) {
                titleElement.innerHTML = `Round Baseline Potential`;
                if (revenueNote) revenueNote.textContent = 'Initial inventory potential';
            } else {
                titleElement.innerHTML = `Final Round Results`;
                if (revenueNote) revenueNote.textContent = 'Total value after optimization';
            }

            document.getElementById('prod-result-deicer').textContent = this.formatNumber(data.production.deicer);
            document.getElementById('prod-result-solvent').textContent = this.formatNumber(data.production.solvent);
            document.getElementById('prod-result-revenue').textContent = this.formatCurrency(data.revenue);

            // Chemicals consumed
            document.getElementById('prod-result-chem-C').textContent = this.formatNumber(data.chemicalsConsumed.C);
            document.getElementById('prod-result-chem-N').textContent = this.formatNumber(data.chemicalsConsumed.N);
            document.getElementById('prod-result-chem-D').textContent = this.formatNumber(data.chemicalsConsumed.D);
            document.getElementById('prod-result-chem-Q').textContent = this.formatNumber(data.chemicalsConsumed.Q);

            // Optimization Analysis (Sensitivity Report)
            const constraintsList = document.getElementById('prod-constraints-list');
            const shadowPricesList = document.getElementById('prod-shadow-prices-list');
            
            if (data.constraints && constraintsList) {
                constraintsList.innerHTML = '';
                ['C', 'N', 'D', 'Q'].forEach(chem => {
                    const c = data.constraints[chem];
                    const isBinding = c.status === 'Binding';
                    const div = document.createElement('div');
                    div.className = `flex justify-between items-center p-2 rounded ${isBinding ? 'bg-red-900/30 border border-red-800' : 'bg-green-900/30 border border-green-800'}`;
                    
                    div.innerHTML = `
                        <span class="font-bold ${isBinding ? 'text-red-400' : 'text-green-400'}">Chemical ${chem}</span>
                        <div class="text-right">
                            <span class="text-xs text-gray-400 block">${isBinding ? 'Bottleneck (0 Excess)' : `Excess: ${this.formatNumber(c.slack)} gal`}</span>
                            <span class="font-bold text-sm text-white">${c.status}</span>
                        </div>
                    `;
                    constraintsList.appendChild(div);
                });
            }

            if (data.shadowPrices && shadowPricesList) {
                shadowPricesList.innerHTML = '';
                ['C', 'N', 'D', 'Q'].forEach(chem => {
                    const sp = data.shadowPrices[chem];
                    const isValuable = sp > 0;
                    const div = document.createElement('div');
                    div.className = `p-3 rounded border ${isValuable ? 'bg-purple-900/30 border-purple-500/50' : 'bg-gray-700/50 border-gray-600'}`;
                    
                    // Interpret range if available
                    let rangeInfo = '';
                    if (data.ranges && data.ranges[chem]) {
                        const r = data.ranges[chem];
                        const inc = r.allowableIncrease > 9000 ? '∞' : this.formatNumber(r.allowableIncrease);
                        rangeInfo = `<div class="text-[10px] text-gray-500 mt-1">Range: -${this.formatNumber(r.allowableDecrease)} / +${inc}</div>`;
                    }

                    div.innerHTML = `
                        <div class="flex justify-between items-baseline mb-1">
                            <span class="text-sm font-bold text-gray-300">Chem ${chem}</span>
                            <span class="text-lg font-mono font-bold ${isValuable ? 'text-purple-400' : 'text-gray-500'}">${this.formatCurrency(sp)}</span>
                        </div>
                        <div class="text-xs ${isValuable ? 'text-purple-300' : 'text-gray-400'}">
                            ${isValuable ? 'High Value - BUY MORE!' : 'Low Value - SELL EXCESS'}
                        </div>
                        ${rangeInfo}
                    `;
                    shadowPricesList.appendChild(div);
                });
            }

            // Current status
            document.getElementById('prod-result-current-funds').textContent = this.formatCurrency(data.currentFunds);
            document.getElementById('prod-result-inv-C').textContent = this.formatNumber(data.currentInventory.C);
            document.getElementById('prod-result-inv-N').textContent = this.formatNumber(data.currentInventory.N);
            document.getElementById('prod-result-inv-D').textContent = this.formatNumber(data.currentInventory.D);
            document.getElementById('prod-result-inv-Q').textContent = this.formatNumber(data.currentInventory.Q);

            // Transition from "in progress" to "complete" state
            const modal = document.getElementById('production-results-modal');
            const prodInProgress = document.getElementById('production-in-progress');
            const prodComplete = document.getElementById('production-complete');

            modal?.classList.remove('hidden');
            prodInProgress?.classList.add('hidden');
            prodComplete?.classList.remove('hidden');

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

        modal?.classList.add('hidden');
        prodInProgress?.classList.add('hidden');
        prodComplete?.classList.add('hidden');

        // Acknowledge production to server (clears productionJustRan flag)
        try {
            await api.post('api/session/status.php', { acknowledgeProduction: true });
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
            const newFunds = this.formatCurrency(this.profile.currentFunds);
            if (fundsEl.textContent !== newFunds) {
                fundsEl?.classList.remove('animate-success-pop');
                void fundsEl.offsetWidth; // Trigger reflow
                fundsEl?.classList.add('animate-success-pop');
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
    openLeaderboard() {
        const modal = document.getElementById('leaderboard-modal');
        if (modal) {
            modal.currentTeamId = this.currentUser;
            modal.open();
            this.currentModal = { id: 'leaderboard-modal' }; // Maintain compatibility with closeCurrentModal
        }
    }

    /**
     * Close leaderboard modal
     */
    closeLeaderboard() {
        const modal = document.getElementById('leaderboard-modal');
        if (modal) {
            modal.close();
            this.currentModal = null;
        }
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
        modal?.classList.remove('hidden');
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
            button?.classList.add('ring-2', 'ring-white', 'ring-opacity-50');
            button.setAttribute('aria-pressed', 'true');
        }
    }

    /**
     * Close modal and restore focus
     */
    closeModalAccessible(modalId) {
        const modal = document.getElementById(modalId);
        modal?.classList.add('hidden');
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
            button?.classList.remove('ring-2', 'ring-white', 'ring-opacity-50');
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
     * Close all modals (used when market closes)
     */
    closeAllModals() {
        // Close negotiation modal if open
        const negotiationModal = document.getElementById('negotiation-modal');
        if (negotiationModal && !negotiationModal.classList.contains('hidden')) {
            this.closeNegotiationModal();
        }

        // Close offer modal if open
        const offerModal = document.getElementById('offer-modal');
        if (offerModal && !offerModal.classList.contains('hidden')) {
            this.closeOfferModal();
        }

        // Close other modals
        const modals = ['settings-modal', 'leaderboard-modal', 'production-guide-modal', 'history-modal'];
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal && !modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
            }
        });

        // Clear current modal state
        this.currentModal = null;
        this.currentNegotiation = null;
    }

    /**
     * Render stats for the end game screen
     */
    async renderGameOverStats() {
        console.log('🏁 Game Over: Rendering final results...');
        await Promise.all([
            this.renderFinalLeaderboard(),
            this.renderFinalHistory()
        ]);
    }

    /**
     * Render the final leaderboard in end screen
     */
    async renderFinalLeaderboard() {
        const container = document.getElementById('final-leaderboard-container');
        if (!container) return;

        try {
            const data = await api.leaderboard.getStandings();
            if (!data.success) return;

            container.innerHTML = data.standings.map((team, index) => `
                <div class="bg-gray-700/50 p-6 rounded-xl flex items-center justify-between border ${team.email === this.currentUser ? 'border-purple-500 bg-purple-900/20' : 'border-gray-600'}">
                    <div class="flex items-center gap-6">
                        <div class="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center font-black text-2xl ${index < 3 ? 'text-yellow-400' : 'text-gray-400'}">
                            ${index + 1}
                        </div>
                        <div>
                            <div class="font-black text-xl uppercase tracking-tight">${team.teamName} ${team.email === this.currentUser ? '<span class="text-xs bg-purple-600 px-2 py-0.5 rounded ml-2">YOU</span>' : ''}</div>
                            <div class="text-xs text-gray-400 font-mono">${team.totalTrades} trades executed</div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-3xl font-black ${team.percentChange >= 0 ? 'text-green-400' : 'text-red-400'} font-mono">
                            ${team.percentChange >= 0 ? '+' : ''}${team.percentChange.toFixed(1)}%
                        </div>
                        <div class="text-sm font-bold text-gray-400 uppercase tracking-widest">Success Score</div>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load final leaderboard:', error);
            container.innerHTML = '<p class="text-red-400 text-center">Failed to load leaderboard results</p>';
        }
    }

    /**
     * Render personal activity history in end screen
     */
    async renderFinalHistory() {
        const container = document.getElementById('final-history-container');
        if (!container) return;

        try {
            const data = await api.notifications.list();
            if (!data.success || !data.notifications.length) {
                container.innerHTML = '<p class="text-gray-500 text-center py-12 italic">No activity recorded for this simulation.</p>';
                return;
            }

            container.innerHTML = data.notifications.map(notif => `
                <div class="bg-gray-700/30 p-4 rounded-lg border-l-4 border-blue-500">
                    <div class="text-sm text-gray-200">${notif.message}</div>
                    <div class="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-widest">${this.formatTimeAgo(notif.createdAt)}</div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load final history:', error);
            container.innerHTML = '<p class="text-red-400 text-center">Failed to load activity history</p>';
        }
    }

    /**
     * Restart the game
     */
    async restartGame() {
        const confirmed = await this.showConfirm(
            'This will reset the entire simulation for ALL players and start over with the current NPC count. Are you sure?',
            'Restart Simulation'
        );

        if (!confirmed) return;

        try {
            const btn = document.getElementById('restart-game-btn');
            btn.disabled = true;
            btn.textContent = 'Restarting...';

            const data = await api.post('api/session/restart.php');

            if (data.success) {
                this.showToast('Simulation restarted! Reloading...', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                this.showToast(data.error || 'Failed to restart', 'error');
                btn.disabled = false;
                btn.textContent = 'Restart Simulation';
            }
        } catch (error) {
            console.error('Restart failed:', error);
            this.showToast('Network error during restart', 'error');
        }
    }

    /**
     * Format number with commas
     */
    formatNumber(num) {
        if (num === null || num === undefined) return '0';
        const parsed = parseFloat(num);
        if (isNaN(parsed)) return '0';
        // Fix negative zero display issue
        const value = Object.is(parsed, -0) ? 0 : parsed;
        return value.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    }

    /**
     * Format currency with correct negative sign placement (-$100 vs $-100)
     */
    formatCurrency(num) {
        if (num === null || num === undefined) return '$0.00';
        const parsed = parseFloat(num);
        if (isNaN(parsed)) return '$0.00';
        const value = Object.is(parsed, -0) ? 0 : parsed;
        const formatted = Math.abs(value).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return (value < 0 ? '-$' : '$') + formatted;
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

// Global initialization
const startMarketplace = () => {
    if (window.appInitialized) return;
    window.appInitialized = true;
    
    console.log('🚀 Starting Marketplace Application...');
    const app = new MarketplaceApp();
    window.app = app;
    app.init();

    // Health check - detect team wipe
    setInterval(async () => {
        try {
            const data = await api.team.getProfile();
            // Detect if team was reset (new creation date)
            if (window.app && window.app.profile && data.profile.createdAt > window.app.profile.createdAt) {
                console.log('🔄 Team reset detected (New Game). Reloading...');
                window.location.reload();
            }
        } catch (error) {
            console.log('⚠️ Session lost or team deleted - reloading...');
            window.location.reload();
        }
    }, 5000);

    // NPC Heartbeat
    setInterval(async () => {
        try {
            await api.admin.getSession();
        } catch (error) {
            // Silently ignore
        }
    }, 5000);
};

// Handle all ready states
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    startMarketplace();
} else {
    document.addEventListener('DOMContentLoaded', startMarketplace);
}
