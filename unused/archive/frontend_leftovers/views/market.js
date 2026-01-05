import { 
    createOffer, 
    expressInterest, 
    setInitialPrice, 
    respondToOffer, 
    counterOffer, 
    cancelOffer 
} from '../api.js';
import { marketPoller } from '../marketPolling.js';
import { getShadowPrices } from '../solver.js';
import { state, updateState } from '../state.js';

export default class MarketView {
    constructor() {
        this.currentShadowPrices = { C: 0, N: 0, D: 0, Q: 0 };
        this.currentOffers = [];
        this.activeNegotiations = [];
        this.isTradingOpen = true;
        this.notifications = [];
    }

    async render() {
        return `
    <div class="max-w-7xl mx-auto p-4 flex gap-4">
        <!-- Left Sidebar: Shadow Prices -->
        <aside class="w-64 flex-shrink-0">
            <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sticky top-20">
                <div class="flex justify-between items-center mb-3">
                    <h2 class="text-lg font-bold text-slate-900">Shadow Prices</h2>
                    <button id="refresh-shadow-prices" class="p-1 hover:bg-slate-100 rounded transition-colors" title="Refresh">
                        <svg class="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                        </svg>
                    </button>
                </div>
                <p class="text-xs text-slate-500 mb-4">Value of +1 gallon</p>
                <div class="space-y-3">
                    <div class="flex justify-between items-center">
                        <span class="text-sm font-medium text-slate-600">Liquid C</span>
                        <span id="sp-c" class="text-sm shadow-price-medium">$0.00</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm font-medium text-slate-600">Liquid N</span>
                        <span id="sp-n" class="text-sm shadow-price-medium">$0.00</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm font-medium text-slate-600">Liquid D</span>
                        <span id="sp-d" class="text-sm shadow-price-medium">$0.00</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm font-medium text-slate-600">Liquid Q</span>
                        <span id="sp-q" class="text-sm shadow-price-medium">$0.00</span>
                    </div>
                </div>
                <div class="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                    <p class="text-xs text-indigo-900 font-medium mb-1">Trading Tip:</p>
                    <p class="text-xs text-indigo-700">Sell if price > shadow price. Buy if price < shadow price.</p>
                </div>
            </div>
        </aside>

        <!-- Main Content -->
        <main class="flex-1 relative">
            <!-- Market Closed Overlay -->
            <div id="market-closed-overlay" class="hidden fixed inset-0 bg-gray-900/95 z-[100] flex flex-col items-center justify-center text-white backdrop-blur-sm">
                <div class="text-center p-8 max-w-2xl mx-auto">
                    <div class="mb-6 text-red-500">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-24 w-24 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h1 class="text-5xl font-bold mb-6 text-white tracking-tight">Marketplace Closed</h1>
                    <p class="text-2xl text-gray-300 mb-8" id="market-status-text">Trading session has ended.</p>
                    <div class="animate-pulse text-indigo-400 font-mono text-lg">Waiting for next session...</div>
                </div>
            </div>

            <!-- Tabs -->
            <div class="bg-white rounded-t-xl border border-slate-200 border-b-0">
                <div class="flex border-b border-slate-200">
                    <button class="tab px-6 py-3 text-sm tab-active" data-tab="available">Available Offers</button>
                    <button class="tab px-6 py-3 text-sm" data-tab="my-offers">My Offers</button>
                    <button class="tab px-6 py-3 text-sm" data-tab="negotiations">Active Negotiations</button>
                </div>
            </div>

            <!-- Tab Content -->
            <div class="bg-white rounded-b-xl border border-slate-200 p-6">
                <!-- Available Offers Tab -->
                <div id="tab-available" class="tab-content">
                    <div id="available-offers-list" class="space-y-3">
                        <!-- Offers will be inserted here -->
                    </div>
                    <div id="no-offers-msg" class="text-center py-12 text-slate-400 hidden">
                        No offers available at this time
                    </div>
                </div>

                <!-- My Offers Tab -->
                <div id="tab-my-offers" class="tab-content hidden">
                    <div class="mb-4">
                        <button id="create-offer-btn" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm">
                            Create Sell Offer
                        </button>
                    </div>
                    <div id="my-offers-list" class="space-y-3">
                        <!-- User's offers will be inserted here -->
                    </div>
                    <div id="no-my-offers-msg" class="text-center py-12 text-slate-400 hidden">
                        You have no active offers
                    </div>
                </div>

                <!-- Active Negotiations Tab -->
                <div id="tab-negotiations" class="tab-content hidden">
                    <div id="negotiations-list" class="space-y-4">
                        <!-- Active negotiations will be inserted here -->
                    </div>
                    <div id="no-negotiations-msg" class="text-center py-12 text-slate-400 hidden">
                        No active negotiations
                    </div>
                </div>
            </div>
        </main>
    </div>

    <!-- Create Offer Modal -->
    <div id="create-offer-modal" class="fixed inset-0 bg-black/50 hidden items-center justify-center z-50">
        <div class="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
            <h3 class="text-xl font-bold mb-4">Create Sell Offer</h3>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Chemical</label>
                    <select id="offer-chemical" class="w-full border border-slate-300 rounded-lg p-2">
                        <option value="C">Liquid C</option>
                        <option value="N">Liquid N</option>
                        <option value="D">Liquid D</option>
                        <option value="Q">Liquid Q</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Quantity (gallons)</label>
                    <input type="number" id="offer-quantity" class="w-full border border-slate-300 rounded-lg p-2" min="1" value="100">
                    <p class="text-xs text-slate-500 mt-1">Available: <span id="available-quantity">0</span> gallons</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-1">Reserve Price (minimum you'll accept)</label>
                    <input type="number" id="offer-reserve-price" class="w-full border border-slate-300 rounded-lg p-2" min="0" step="0.01" value="10">
                    <p class="text-xs text-slate-500 mt-1">Your shadow price: $<span id="offer-shadow-price">0.00</span></p>
                </div>
            </div>
            <div class="flex justify-end gap-2 mt-6">
                <button id="close-create-offer-modal" class="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                <button id="confirm-create-offer" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">Create Offer</button>
            </div>
        </div>
    </div>

    <!-- Express Interest Modal -->
    <div id="interest-modal" class="fixed inset-0 bg-black/50 hidden items-center justify-center z-50">
        <div class="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
            <h3 class="text-xl font-bold mb-4">Express Interest</h3>
            <p class="text-slate-600 mb-4">You're expressing interest in this offer. The seller will be notified and can set an initial price for you.</p>
            <div class="bg-slate-50 p-4 rounded-lg mb-4">
                <p class="text-sm"><span class="font-medium">Chemical:</span> <span id="interest-chemical"></span></p>
                <p class="text-sm"><span class="font-medium">Quantity:</span> <span id="interest-quantity"></span> gallons</p>
                <p class="text-sm"><span class="font-medium">Your shadow price:</span> $<span id="interest-shadow-price"></span></p>
            </div>
            <div class="flex justify-end gap-2">
                <button id="close-interest-modal" class="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                <button id="confirm-interest" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm">Confirm Interest</button>
            </div>
        </div>
    </div>

    <!-- Set Price Modal (Seller) -->
    <div id="set-price-modal" class="fixed inset-0 bg-black/50 hidden items-center justify-center z-50">
        <div class="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
            <h3 class="text-xl font-bold mb-4">Set Initial Price</h3>
            <p class="text-slate-600 mb-4">A buyer has expressed interest. Set your starting price.</p>
            <div class="bg-slate-50 p-4 rounded-lg mb-4">
                <p class="text-sm"><span class="font-medium">Buyer:</span> <span id="price-buyer"></span></p>
                <p class="text-sm"><span class="font-medium">Chemical:</span> <span id="price-chemical"></span></p>
                <p class="text-sm"><span class="font-medium">Quantity:</span> <span id="price-quantity"></span> gallons</p>
                <p class="text-sm"><span class="font-medium">Reserve price:</span> $<span id="price-reserve"></span></p>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-slate-700 mb-1">Your Price</label>
                <input type="number" id="initial-price" class="w-full border border-slate-300 rounded-lg p-2" min="0" step="0.01">
                <p class="text-xs text-slate-500 mt-1">Must be >= reserve price</p>
            </div>
            <div class="flex justify-end gap-2">
                <button id="close-set-price-modal" class="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                <button id="confirm-price" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">Set Price</button>
            </div>
        </div>
    </div>

    <!-- Respond to Offer Modal (Buyer) -->
    <div id="respond-modal" class="fixed inset-0 bg-black/50 hidden items-center justify-center z-50">
        <div class="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
            <h3 class="text-xl font-bold mb-4">Respond to Offer</h3>
            <div class="bg-slate-50 p-4 rounded-lg mb-4">
                <p class="text-sm"><span class="font-medium">Seller:</span> <span id="respond-seller"></span></p>
                <p class="text-sm"><span class="font-medium">Chemical:</span> <span id="respond-chemical"></span></p>
                <p class="text-sm"><span class="font-medium">Quantity:</span> <span id="respond-quantity"></span> gallons</p>
                <p class="text-lg font-bold text-indigo-600 mt-2">Price: $<span id="respond-price"></span></p>
                <p class="text-sm mt-1"><span class="font-medium">Your shadow price:</span> $<span id="respond-shadow-price"></span></p>
            </div>
            <div class="flex justify-end gap-2">
                <button id="reject-offer" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm">Reject</button>
                <button id="accept-offer" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm">Accept</button>
            </div>
        </div>
    </div>

    <!-- Counter Offer Modal (Seller) -->
    <div id="counter-modal" class="fixed inset-0 bg-black/50 hidden items-center justify-center z-50">
        <div class="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
            <h3 class="text-xl font-bold mb-4">Counter Offer</h3>
            <p class="text-slate-600 mb-4">The buyer rejected your offer. You can counter with a lower price.</p>
            <div class="bg-slate-50 p-4 rounded-lg mb-4">
                <p class="text-sm"><span class="font-medium">Previous price:</span> $<span id="counter-previous"></span></p>
                <p class="text-sm"><span class="font-medium">Reserve price:</span> $<span id="counter-reserve"></span></p>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-slate-700 mb-1">New Price</label>
                <input type="number" id="counter-price" class="w-full border border-slate-300 rounded-lg p-2" min="0" step="0.01">
                <p class="text-xs text-slate-500 mt-1">Must be < previous price and >= reserve price</p>
            </div>
            <div class="flex justify-end gap-2">
                <button id="close-counter-modal" class="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                <button id="confirm-counter" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">Send Counter</button>
            </div>
        </div>
    </div>
        `;
    }

    async mount() {
        this.updateCallback = (data) => this.handleUpdate(data);
        marketPoller.subscribe(this.updateCallback);
        
        // Cache DOM elements
        this.els = {
            spC: document.getElementById('sp-c'),
            spN: document.getElementById('sp-n'),
            spD: document.getElementById('sp-d'),
            spQ: document.getElementById('sp-q'),
            refreshShadowPricesBtn: document.getElementById('refresh-shadow-prices'),
            tabs: document.querySelectorAll('.tab'),
            tabContents: document.querySelectorAll('.tab-content'),
            availableOffersList: document.getElementById('available-offers-list'),
            myOffersList: document.getElementById('my-offers-list'),
            negotiationsList: document.getElementById('negotiations-list'),
            noOffersMsg: document.getElementById('no-offers-msg'),
            noMyOffersMsg: document.getElementById('no-my-offers-msg'),
            noNegotiationsMsg: document.getElementById('no-negotiations-msg'),
            createOfferBtn: document.getElementById('create-offer-btn'),
            createOfferModal: document.getElementById('create-offer-modal'),
            interestModal: document.getElementById('interest-modal'),
            setPriceModal: document.getElementById('set-price-modal'),
            respondModal: document.getElementById('respond-modal'),
            counterModal: document.getElementById('counter-modal'),
            marketClosedOverlay: document.getElementById('market-closed-overlay'),
            marketStatusText: document.getElementById('market-status-text')
        };

        this.setupEventListeners();
        
        // Expose helpers for inline onclicks (though we should avoid them, legacy HTML has them)
        // I will re-attach them to window for now.
        window.openInterestModal = (offerId, chemical, quantity) => this.openInterestModal(offerId, chemical, quantity);
        window.openSetPriceModal = (offerId, buyerId, chemical, quantity, reservePrice) => this.openSetPriceModal(offerId, buyerId, chemical, quantity, reservePrice);
        window.openRespondModal = (offerId, sellerId, chemical, quantity, price) => this.openRespondModal(offerId, sellerId, chemical, quantity, price);
        window.openCounterModal = (offerId, currentPrice, reservePrice) => this.openCounterModal(offerId, currentPrice, reservePrice);
        window.handleCancelOffer = (offerId) => this.handleCancelOffer(offerId);

        // Immediate update if data available
        this.updateShadowPrices();
    }

    unmount() {
        marketPoller.unsubscribe(this.updateCallback);
    }

    handleUpdate(data) {
        if (!data.success) return;
        
        // Handle Session State
        if (data.session_state) {
            const phase = data.session_state.gameStopped ? 'STOPPED' : 'TRADING'; // Prioritize gameStopped flag
            this.isTradingOpen = (phase === 'TRADING');
            this.updateMarketStatus(phase);
        }

        // Update Global State
        const newState = {
            displayName: data.display_name,
            startingFund: data.user_fund,
            inventory: data.user_inventory,
        };
        updateState(newState);

        // Update Local State
        this.updateShadowPrices(); // Recalcs using new inventory from state
        
        // Update Lists
        this.updateAvailableOffers(data.available_offers);
        this.updateMyOffers(data.my_offers);
        this.updateNegotiations(data.active_negotiations);
    }

    setupEventListeners() {
        this.els.tabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        this.els.refreshShadowPricesBtn.addEventListener('click', () => this.updateShadowPrices());

        this.els.createOfferBtn.addEventListener('click', () => {
            this.updateModalShadowPrice('offer-shadow-price', document.getElementById('offer-chemical').value);
            document.getElementById('available-quantity').textContent = state.inventory[document.getElementById('offer-chemical').value] || 0;
            this.toggleModal(this.els.createOfferModal, true);
        });

        document.getElementById('confirm-create-offer').addEventListener('click', () => this.handleCreateOffer());
        document.getElementById('offer-chemical').addEventListener('change', (e) => {
            this.updateModalShadowPrice('offer-shadow-price', e.target.value);
            document.getElementById('available-quantity').textContent = state.inventory[e.target.value] || 0;
        });

        // Modal Close Buttons
        document.getElementById('close-create-offer-modal').addEventListener('click', () => this.toggleModal(this.els.createOfferModal, false));
        document.getElementById('close-interest-modal').addEventListener('click', () => this.toggleModal(this.els.interestModal, false));
        document.getElementById('close-set-price-modal').addEventListener('click', () => this.toggleModal(this.els.setPriceModal, false));
        document.getElementById('close-counter-modal').addEventListener('click', () => this.toggleModal(this.els.counterModal, false));

        // Action Buttons
        document.getElementById('confirm-interest').addEventListener('click', () => this.handleExpressInterest());
        document.getElementById('confirm-price').addEventListener('click', () => this.handleSetPrice());
        document.getElementById('accept-offer').addEventListener('click', () => this.handleRespondToOffer('accept'));
        document.getElementById('reject-offer').addEventListener('click', () => this.handleRespondToOffer('reject'));
        document.getElementById('confirm-counter').addEventListener('click', () => this.handleCounterOffer());
    }

    updateMarketStatus(status) {
        if (status === 'TRADING') {
            this.els.marketClosedOverlay.classList.add('hidden');
            this.els.createOfferBtn.disabled = false;
            this.els.createOfferBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            this.els.marketClosedOverlay.classList.remove('hidden');
            this.els.marketStatusText.textContent = (status === 'STOPPED') ? "Game is currently stopped." : "Trading session has ended.";
            this.els.createOfferBtn.disabled = true;
            this.els.createOfferBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    }

    updateShadowPrices() {
        const result = getShadowPrices(state.inventory);
        this.currentShadowPrices = result.shadowPrices;

        this.renderShadowPrice(this.els.spC, this.currentShadowPrices.C);
        this.renderShadowPrice(this.els.spN, this.currentShadowPrices.N);
        this.renderShadowPrice(this.els.spD, this.currentShadowPrices.D);
        this.renderShadowPrice(this.els.spQ, this.currentShadowPrices.Q);
    }

    renderShadowPrice(el, price) {
        if (!el) return;
        el.textContent = `$${price.toFixed(2)}`;
        el.className = 'text-sm font-bold ' + this.getShadowPriceColor(price);
    }

    getShadowPriceColor(price) {
        if (price > 15) return 'text-emerald-600';
        if (price < 5) return 'text-red-600';
        return 'text-amber-600';
    }

    switchTab(tabId) {
        this.els.tabs.forEach(t => {
            if (t.dataset.tab === tabId) t.classList.add('tab-active');
            else t.classList.remove('tab-active');
        });

        this.els.tabContents.forEach(c => c.classList.add('hidden'));
        document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    }

    toggleModal(modal, show) {
        if (show) modal.classList.remove('hidden'), modal.classList.add('flex');
        else modal.classList.add('hidden'), modal.classList.remove('flex');
    }

    updateModalShadowPrice(elementId, chemical) {
        const el = document.getElementById(elementId);
        if (!el) return;
        const price = this.currentShadowPrices[chemical] || 0;
        el.textContent = price.toFixed(2);
        el.className = 'font-bold ' + this.getShadowPriceColor(price);
    }

    // --- Data Updates ---

    updateAvailableOffers(offers) {
        const container = this.els.availableOffersList;
        container.innerHTML = '';

        if (offers.length === 0) {
            this.els.noOffersMsg.classList.remove('hidden');
        } else {
            this.els.noOffersMsg.classList.add('hidden');
            offers.forEach(offer => {
                const sp = this.currentShadowPrices[offer.chemical] || 0;
                const spColor = this.getShadowPriceColor(sp);
                const disabledAttr = !this.isTradingOpen ? 'disabled' : '';
                const disabledClass = !this.isTradingOpen ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-200';

                const div = document.createElement('div');
                div.className = 'bg-slate-50 border border-slate-200 p-4 rounded-lg flex justify-between items-center';
                div.innerHTML = `
                    <div>
                        <div class="font-bold text-lg text-slate-800">${offer.quantity} gal Liquid ${offer.chemical}</div>
                        <div class="text-sm text-slate-500">Seller: ${offer.seller_id}</div>
                        <div class="text-xs mt-1">Your SP: <span class="${spColor}">$${sp.toFixed(2)}</span></div>
                    </div>
                    <button class="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-medium transition-colors ${disabledClass}"
                        ${disabledAttr}
                        onclick="window.openInterestModal('${offer.offer_id}', '${offer.chemical}', ${offer.quantity})">
                        Express Interest
                    </button>
                `;
                container.appendChild(div);
            });
        }
    }

    updateMyOffers(offers) {
        const container = this.els.myOffersList;
        container.innerHTML = '';

        if (offers.length === 0) {
            this.els.noMyOffersMsg.classList.remove('hidden');
        } else {
            this.els.noMyOffersMsg.classList.add('hidden');
            offers.forEach(offer => {
                const div = document.createElement('div');
                div.className = 'bg-white border border-slate-200 p-4 rounded-lg shadow-sm';
                
                let buyersHtml = '';
                if (offer.interested_buyers && offer.interested_buyers.length > 0) {
                    buyersHtml = '<div class="mt-3 pt-3 border-t border-slate-100"><p class="text-xs font-bold text-slate-500 mb-2">INTERESTED BUYERS:</p><div class="space-y-2">';
                    offer.interested_buyers.forEach(buyer => {
                        buyersHtml += `
                            <div class="flex justify-between items-center bg-slate-50 p-2 rounded">
                                <span class="text-sm font-medium">${buyer.buyer_id}</span>
                                <button class="text-xs px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                    onclick="window.openSetPriceModal('${offer.offer_id}', '${buyer.buyer_id}', '${offer.chemical}', ${offer.quantity}, ${offer.reserve_price})">
                                    Set Price
                                </button>
                            </div>
                        `;
                    });
                    buyersHtml += '</div></div>';
                }

                div.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div>
                            <div class="font-bold text-lg text-slate-800">${offer.quantity} gal Liquid ${offer.chemical}</div>
                            <div class="text-sm text-slate-500">Reserve: $${offer.reserve_price}</div>
                            <div class="text-xs mt-1 inline-block px-2 py-1 rounded bg-slate-100 text-slate-600 uppercase tracking-wide">${offer.status}</div>
                        </div>
                        <button class="text-red-500 hover:text-red-700 text-sm font-medium" onclick="window.handleCancelOffer('${offer.offer_id}')">
                            Cancel
                        </button>
                    </div>
                    ${buyersHtml}
                `;
                container.appendChild(div);
            });
        }
    }

    updateNegotiations(negotiations) {
        const container = this.els.negotiationsList;
        container.innerHTML = '';

        if (negotiations.length === 0) {
            this.els.noNegotiationsMsg.classList.remove('hidden');
        } else {
            this.els.noNegotiationsMsg.classList.add('hidden');
            negotiations.forEach(neg => {
                const isBuyer = neg.role === 'buyer';
                const sp = this.currentShadowPrices[neg.chemical] || 0;
                const spColor = this.getShadowPriceColor(sp);
                
                let actionHtml = '';
                if (isBuyer) {
                    if (neg.last_action === 'seller_initial_price' || neg.last_action === 'seller_counter') {
                        actionHtml = `
                            <div class="mt-3 flex justify-end gap-2">
                                <button class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm"
                                    onclick="window.openRespondModal('${neg.offer_id}', '${neg.counterparty}', '${neg.chemical}', ${neg.quantity}, ${neg.current_price})">
                                    Respond to Offer ($${neg.current_price})
                                </button>
                            </div>
                        `;
                    } else if (neg.last_action === 'buyer_reject') {
                        actionHtml = `<div class="mt-2 text-sm text-amber-600 italic">Waiting for seller to counter...</div>`;
                    }
                } else {
                    if (neg.last_action === 'buyer_reject') {
                        actionHtml = `
                            <div class="mt-3 flex justify-end gap-2">
                                <button class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm"
                                    onclick="window.openCounterModal('${neg.offer_id}', ${neg.current_price}, ${neg.reserve_price || 0})">
                                    Counter Offer (Current: $${neg.current_price})
                                </button>
                            </div>
                        `;
                    } else {
                         actionHtml = `<div class="mt-2 text-sm text-slate-500 italic">Waiting for buyer response...</div>`;
                    }
                }

                const div = document.createElement('div');
                div.className = 'bg-white border border-indigo-100 p-4 rounded-lg shadow-sm';
                div.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h4 class="font-bold text-indigo-900">${isBuyer ? 'Buying' : 'Selling'} ${neg.quantity} gal Liquid ${neg.chemical}</h4>
                            <p class="text-sm text-slate-600">With: ${neg.counterparty}</p>
                        </div>
                        <div class="text-right">
                            <div class="text-xl font-bold text-slate-800">$${neg.current_price}</div>
                            <div class="text-xs text-slate-500">per gallon</div>
                        </div>
                    </div>
                    
                    <div class="flex justify-between items-center text-xs text-slate-500 mt-2 p-2 bg-slate-50 rounded">
                         <span>Your Shadow Price: <strong class="${spColor}">$${sp.toFixed(2)}</strong></span>
                         <span>Last Action: ${neg.last_action}</span>
                    </div>

                    ${actionHtml}
                `;
                container.appendChild(div);
            });
        }
    }

    // --- Modal Actions ---
    
    openInterestModal(offerId, chemical, quantity) {
        document.getElementById('interest-chemical').textContent = `Liquid ${chemical}`;
        document.getElementById('interest-quantity').textContent = quantity;
        document.getElementById('interest-shadow-price').textContent = (this.currentShadowPrices[chemical] || 0).toFixed(2);
        this.els.interestModal.dataset.offerId = offerId;
        this.toggleModal(this.els.interestModal, true);
    }

    openSetPriceModal(offerId, buyerId, chemical, quantity, reservePrice) {
        document.getElementById('price-buyer').textContent = buyerId;
        document.getElementById('price-chemical').textContent = `Liquid ${chemical}`;
        document.getElementById('price-quantity').textContent = quantity;
        document.getElementById('price-reserve').textContent = reservePrice;
        const input = document.getElementById('initial-price');
        input.value = '';
        input.min = reservePrice;
        this.els.setPriceModal.dataset.offerId = offerId;
        this.els.setPriceModal.dataset.buyerId = buyerId;
        this.toggleModal(this.els.setPriceModal, true);
    }

    openRespondModal(offerId, sellerId, chemical, quantity, price) {
        document.getElementById('respond-seller').textContent = sellerId;
        document.getElementById('respond-chemical').textContent = `Liquid ${chemical}`;
        document.getElementById('respond-quantity').textContent = quantity;
        document.getElementById('respond-price').textContent = price;
        document.getElementById('respond-shadow-price').textContent = (this.currentShadowPrices[chemical] || 0).toFixed(2);
        this.els.respondModal.dataset.offerId = offerId;
        this.toggleModal(this.els.respondModal, true);
    }

    openCounterModal(offerId, currentPrice, reservePrice) {
        document.getElementById('counter-previous').textContent = currentPrice;
        document.getElementById('counter-reserve').textContent = reservePrice;
        const input = document.getElementById('counter-price');
        input.value = '';
        input.max = currentPrice - 0.01;
        input.min = reservePrice;
        this.els.counterModal.dataset.offerId = offerId;
        this.toggleModal(this.els.counterModal, true);
    }

    async handleCancelOffer(offerId) {
        if (!confirm('Are you sure you want to cancel this offer?')) return;
        try {
            const res = await cancelOffer(offerId);
            if (res.success) {
                marketPoller.poll();
            } else {
                alert('Failed to cancel offer: ' + res.message);
            }
        } catch (e) {
            console.error(e);
        }
    }

    // --- Async Actions ---

    async handleCreateOffer() {
        const chemical = document.getElementById('offer-chemical').value;
        const quantity = parseInt(document.getElementById('offer-quantity').value);
        const reservePrice = parseFloat(document.getElementById('offer-reserve-price').value);

        if (quantity <= 0 || isNaN(quantity)) return alert('Invalid quantity');
        if (reservePrice < 0 || isNaN(reservePrice)) return alert('Invalid price');
        if (quantity > (state.inventory[chemical] || 0)) return alert('Insufficient inventory');

        try {
            const res = await createOffer(chemical, quantity, reservePrice);
            if (res.success) {
                this.toggleModal(this.els.createOfferModal, false);
                this.switchTab('my-offers');
                marketPoller.poll();
            } else {
                alert(res.message);
            }
        } catch (e) {
            console.error(e);
        }
    }

    async handleExpressInterest() {
        const offerId = this.els.interestModal.dataset.offerId;
        try {
            const res = await expressInterest(offerId);
            if (res.success) {
                this.toggleModal(this.els.interestModal, false);
                alert('Interest expressed! Waiting for seller to set price.');
                marketPoller.poll();
            } else {
                alert(res.message);
            }
        } catch (e) {
            console.error(e);
        }
    }

    async handleSetPrice() {
        const offerId = this.els.setPriceModal.dataset.offerId;
        const buyerId = this.els.setPriceModal.dataset.buyerId;
        const price = parseFloat(document.getElementById('initial-price').value);

        if (isNaN(price) || price < 0) return alert('Invalid price');

        try {
            const res = await setInitialPrice(offerId, buyerId, price);
            if (res.success) {
                this.toggleModal(this.els.setPriceModal, false);
                this.switchTab('negotiations');
                marketPoller.poll();
            } else {
                alert(res.message);
            }
        } catch (e) {
            console.error(e);
        }
    }

    async handleRespondToOffer(action) {
        const offerId = this.els.respondModal.dataset.offerId;
        try {
            const res = await respondToOffer(offerId, action);
            if (res.success) {
                this.toggleModal(this.els.respondModal, false);
                if (action === 'accept') alert('Trade completed successfully!');
                marketPoller.poll();
            } else {
                alert(res.message);
            }
        } catch (e) {
            console.error(e);
        }
    }

    async handleCounterOffer() {
        const offerId = this.els.counterModal.dataset.offerId;
        const price = parseFloat(document.getElementById('counter-price').value);

        if (isNaN(price) || price < 0) return alert('Invalid price');

        try {
            const res = await counterOffer(offerId, price);
            if (res.success) {
                this.toggleModal(this.els.counterModal, false);
                alert('Counter offer sent!');
                marketPoller.poll();
            } else {
                alert(res.message);
            }
        } catch (e) {
            console.error(e);
        }
    }
}
