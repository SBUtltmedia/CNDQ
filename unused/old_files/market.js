import { 
    createOffer, 
    expressInterest, 
    setInitialPrice, 
    respondToOffer, 
    counterOffer, 
    cancelOffer 
} from './api.js';
import { marketPoller } from './marketPolling.js';
import { getShadowPrices } from './solver.js';

// State
let currentUser = {
    inventory: { C: 0, N: 0, D: 0, Q: 0 },
    funds: 0,
    email: 'loading...'
};
let currentShadowPrices = { C: 0, N: 0, D: 0, Q: 0 };
let currentOffers = [];
let activeNegotiations = [];
let notifications = [];

// DOM Elements
const els = {
    teamName: document.getElementById('team-name'),
    teamFunds: document.getElementById('team-funds'),
    notificationBtn: document.getElementById('notification-btn'),
    notificationCount: document.getElementById('notification-count'),
    notificationPanel: document.getElementById('notification-panel'),
    notificationList: document.getElementById('notification-list'),
    
    // Shadow Price Panel
    spC: document.getElementById('sp-c'),
    spN: document.getElementById('sp-n'),
    spD: document.getElementById('sp-d'),
    spQ: document.getElementById('sp-q'),
    refreshShadowPricesBtn: document.getElementById('refresh-shadow-prices'),

    // Tabs
    tabs: document.querySelectorAll('.tab'),
    tabContents: document.querySelectorAll('.tab-content'),
    
    // Lists
    availableOffersList: document.getElementById('available-offers-list'),
    myOffersList: document.getElementById('my-offers-list'),
    negotiationsList: document.getElementById('negotiations-list'),
    
    // Empty States
    noOffersMsg: document.getElementById('no-offers-msg'),
    noMyOffersMsg: document.getElementById('no-my-offers-msg'),
    noNegotiationsMsg: document.getElementById('no-negotiations-msg'),

    // Buttons
    createOfferBtn: document.getElementById('create-offer-btn'),
    
    // Modals
    createOfferModal: document.getElementById('create-offer-modal'),
    interestModal: document.getElementById('interest-modal'),
    setPriceModal: document.getElementById('set-price-modal'),
    respondModal: document.getElementById('respond-modal'),
    counterModal: document.getElementById('counter-modal'),
    
    // Status Banner
    marketStatusBanner: document.getElementById('market-status-banner'),
    marketStatusText: document.getElementById('market-status-text')
};

// --- Initialization ---

async function init() {
    // Start Polling
    marketPoller.subscribe(handleMarketUpdate);
    await marketPoller.start();

    // Event Listeners
    setupEventListeners();
    
    // Global functions for inline HTML handlers
    window.closeCreateOfferModal = () => toggleModal(els.createOfferModal, false);
    window.closeInterestModal = () => toggleModal(els.interestModal, false);
    window.closeSetPriceModal = () => toggleModal(els.setPriceModal, false);
    window.closeCounterModal = () => toggleModal(els.counterModal, false);
}

function setupEventListeners() {
    // Tabs
    els.tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Notification Toggle
    els.notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        els.notificationPanel.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!els.notificationPanel.contains(e.target) && !els.notificationBtn.contains(e.target)) {
            els.notificationPanel.classList.add('hidden');
        }
    });

    // Shadow Price Refresh
    els.refreshShadowPricesBtn.addEventListener('click', updateShadowPrices);

    // Create Offer
    els.createOfferBtn.addEventListener('click', () => {
        updateModalShadowPrice('offer-shadow-price', document.getElementById('offer-chemical').value);
        document.getElementById('available-quantity').textContent = currentUser.inventory[document.getElementById('offer-chemical').value] || 0;
        toggleModal(els.createOfferModal, true);
    });

    document.getElementById('confirm-create-offer').addEventListener('click', handleCreateOffer);
    document.getElementById('offer-chemical').addEventListener('change', (e) => {
        updateModalShadowPrice('offer-shadow-price', e.target.value);
        document.getElementById('available-quantity').textContent = currentUser.inventory[e.target.value] || 0;
    });

    // Other Modal Actions
    document.getElementById('confirm-interest').addEventListener('click', handleExpressInterest);
    document.getElementById('confirm-price').addEventListener('click', handleSetPrice);
    document.getElementById('accept-offer').addEventListener('click', () => handleRespondToOffer('accept'));
    document.getElementById('reject-offer').addEventListener('click', () => handleRespondToOffer('reject'));
    document.getElementById('confirm-counter').addEventListener('click', handleCounterOffer);
}

// --- Data Handling ---

let isTradingOpen = true;

function handleMarketUpdate(data) {
    if (!data.success) return;
    
    // Handle Session State
    if (data.session_state) {
        const state = data.session_state.state;
        isTradingOpen = (state === 'TRADING');
        updateMarketStatus(state);
    }

    // Update User Info
    currentUser.inventory = data.user_inventory;
    currentUser.funds = data.user_fund;
    currentUser.displayName = data.display_name;
    
    els.teamName.textContent = currentUser.displayName || currentUser.email;
    els.teamFunds.textContent = `$${parseFloat(currentUser.funds).toFixed(2)}`;
    
    // Update Shadow Prices (if inventory changed)
    updateShadowPrices();

    // Update Lists
    updateAvailableOffers(data.available_offers);
    updateMyOffers(data.my_offers);
    updateNegotiations(data.active_negotiations);

    // Update Notifications
    if (data.notifications && data.notifications.length > 0) {
        // Merge and deduplicate
        const newIds = new Set(data.notifications.map(n => n.id));
        const oldFiltered = notifications.filter(n => !newIds.has(n.id));
        notifications = [...data.notifications, ...oldFiltered];
        
        // Sort by timestamp desc
        notifications.sort((a, b) => b.timestamp - a.timestamp);
        
        // Limit to 50
        if (notifications.length > 50) notifications = notifications.slice(0, 50);
    }
    
    updateNotifications(notifications, data.notification_count);
}

function updateMarketStatus(state) {
    if (state === 'TRADING') {
        els.marketStatusBanner.classList.add('hidden');
        els.createOfferBtn.disabled = false;
        els.createOfferBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        els.marketStatusBanner.classList.remove('hidden');
        els.marketStatusText.textContent = `Current Phase: ${state}. Trading is paused.`;
        
        els.createOfferBtn.disabled = true;
        els.createOfferBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

function updateShadowPrices() {
    const result = getShadowPrices(currentUser.inventory);
    currentShadowPrices = result.shadowPrices;

    renderShadowPrice(els.spC, currentShadowPrices.C);
    renderShadowPrice(els.spN, currentShadowPrices.N);
    renderShadowPrice(els.spD, currentShadowPrices.D);
    renderShadowPrice(els.spQ, currentShadowPrices.Q);
}

function renderShadowPrice(el, price) {
    el.textContent = `$${price.toFixed(2)}`;
    el.className = 'text-sm font-bold ' + getShadowPriceColor(price);
}

function getShadowPriceColor(price) {
    if (price > 15) return 'text-emerald-600'; // High value (Buy)
    if (price < 5) return 'text-red-600';     // Low value (Sell)
    return 'text-amber-600';                  // Medium
}

// --- UI Updates ---

function switchTab(tabId) {
    els.tabs.forEach(t => {
        if (t.dataset.tab === tabId) t.classList.add('tab-active');
        else t.classList.remove('tab-active');
    });

    els.tabContents.forEach(c => c.classList.add('hidden'));
    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
}

function updateAvailableOffers(offers) {
    currentOffers = offers;
    const container = els.availableOffersList;
    container.innerHTML = '';

    if (offers.length === 0) {
        els.noOffersMsg.classList.remove('hidden');
    } else {
        els.noOffersMsg.classList.add('hidden');
        offers.forEach(offer => {
            const div = document.createElement('div');
            div.className = 'bg-slate-50 border border-slate-200 p-4 rounded-lg flex justify-between items-center';
            
            const sp = currentShadowPrices[offer.chemical] || 0;
            const spColor = getShadowPriceColor(sp);
            
            const disabledAttr = !isTradingOpen ? 'disabled' : '';
            const disabledClass = !isTradingOpen ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-200';

            div.innerHTML = `
                <div>
                    <div class="font-bold text-lg text-slate-800">${offer.quantity} gal Liquid ${offer.chemical}</div>
                    <div class="text-sm text-slate-500">Seller: ${offer.seller_id}</div>
                    <div class="text-xs mt-1">Your SP: <span class="${spColor}">$${sp.toFixed(2)}</span></div>
                </div>
                <button class="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-medium transition-colors ${disabledClass}"
                    ${disabledAttr}
                    onclick="openInterestModal('${offer.offer_id}', '${offer.chemical}', ${offer.quantity})">
                    Express Interest
                </button>
            `;
            container.appendChild(div);
        });
    }
}

function updateMyOffers(offers) {
    const container = els.myOffersList;
    container.innerHTML = '';

    if (offers.length === 0) {
        els.noMyOffersMsg.classList.remove('hidden');
    } else {
        els.noMyOffersMsg.classList.add('hidden');
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
                                onclick="openSetPriceModal('${offer.offer_id}', '${buyer.buyer_id}', '${offer.chemical}', ${offer.quantity}, ${offer.reserve_price})">
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
                    <button class="text-red-500 hover:text-red-700 text-sm font-medium" onclick="handleCancelOffer('${offer.offer_id}')">
                        Cancel
                    </button>
                </div>
                ${buyersHtml}
            `;
            container.appendChild(div);
        });
    }
}

function updateNegotiations(negotiations) {
    activeNegotiations = negotiations;
    const container = els.negotiationsList;
    container.innerHTML = '';

    if (negotiations.length === 0) {
        els.noNegotiationsMsg.classList.remove('hidden');
    } else {
        els.noNegotiationsMsg.classList.add('hidden');
        negotiations.forEach(neg => {
            const isBuyer = neg.role === 'buyer';
            const sp = currentShadowPrices[neg.chemical] || 0;
            const spColor = getShadowPriceColor(sp);
            
            const div = document.createElement('div');
            div.className = 'bg-white border border-indigo-100 p-4 rounded-lg shadow-sm';
            
            let actionHtml = '';
            
            // Buyer Logic
            if (isBuyer) {
                if (neg.last_action === 'seller_initial_price' || neg.last_action === 'seller_counter') {
                    actionHtml = `
                        <div class="mt-3 flex justify-end gap-2">
                            <button class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm"
                                onclick="openRespondModal('${neg.offer_id}', '${neg.counterparty}', '${neg.chemical}', ${neg.quantity}, ${neg.current_price})">
                                Respond to Offer ($${neg.current_price})
                            </button>
                        </div>
                    `;
                } else if (neg.last_action === 'buyer_reject') {
                    actionHtml = `<div class="mt-2 text-sm text-amber-600 italic">Waiting for seller to counter...</div>`;
                }
            } 
            // Seller Logic
            else {
                if (neg.last_action === 'buyer_reject') {
                    actionHtml = `
                        <div class="mt-3 flex justify-end gap-2">
                            <button class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm"
                                onclick="openCounterModal('${neg.offer_id}', ${neg.current_price}, ${neg.reserve_price || 0})">
                                Counter Offer (Current: $${neg.current_price})
                            </button>
                        </div>
                    `;
                } else {
                     actionHtml = `<div class="mt-2 text-sm text-slate-500 italic">Waiting for buyer response...</div>`;
                }
            }

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

function updateNotifications(list, count) {
    els.notificationCount.textContent = count;
    els.notificationCount.classList.toggle('hidden', count === 0);
    
    els.notificationList.innerHTML = list.map(n => `
        <div class="p-3 hover:bg-slate-50 transition-colors">
            <p class="text-sm text-slate-800">${n.message}</p>
            <p class="text-xs text-slate-400 mt-1">${new Date(n.timestamp * 1000).toLocaleTimeString()}</p>
        </div>
    `).join('') || '<div class="p-4 text-center text-sm text-slate-400">No notifications</div>';
}

// --- Modal Logic ---

function toggleModal(modal, show) {
    if (show) modal.classList.remove('hidden'), modal.classList.add('flex');
    else modal.classList.add('hidden'), modal.classList.remove('flex');
}

function updateModalShadowPrice(elementId, chemical) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const price = currentShadowPrices[chemical] || 0;
    el.textContent = price.toFixed(2);
    el.className = 'font-bold ' + getShadowPriceColor(price);
}

// --- Action Handlers ---

// Available on Window for HTML onclick
window.openInterestModal = (offerId, chemical, quantity) => {
    document.getElementById('interest-chemical').textContent = `Liquid ${chemical}`;
    document.getElementById('interest-quantity').textContent = quantity;
    document.getElementById('interest-shadow-price').textContent = (currentShadowPrices[chemical] || 0).toFixed(2);
    
    // Store data on the modal for the confirm button
    els.interestModal.dataset.offerId = offerId;
    
    toggleModal(els.interestModal, true);
};

window.openSetPriceModal = (offerId, buyerId, chemical, quantity, reservePrice) => {
    document.getElementById('price-buyer').textContent = buyerId;
    document.getElementById('price-chemical').textContent = `Liquid ${chemical}`;
    document.getElementById('price-quantity').textContent = quantity;
    document.getElementById('price-reserve').textContent = reservePrice;
    
    const input = document.getElementById('initial-price');
    input.value = '';
    input.min = reservePrice;
    
    els.setPriceModal.dataset.offerId = offerId;
    els.setPriceModal.dataset.buyerId = buyerId;
    
    toggleModal(els.setPriceModal, true);
};

window.openRespondModal = (offerId, sellerId, chemical, quantity, price) => {
    document.getElementById('respond-seller').textContent = sellerId;
    document.getElementById('respond-chemical').textContent = `Liquid ${chemical}`;
    document.getElementById('respond-quantity').textContent = quantity;
    document.getElementById('respond-price').textContent = price;
    document.getElementById('respond-shadow-price').textContent = (currentShadowPrices[chemical] || 0).toFixed(2);
    
    els.respondModal.dataset.offerId = offerId;
    
    toggleModal(els.respondModal, true);
};

window.openCounterModal = (offerId, currentPrice, reservePrice) => {
    document.getElementById('counter-previous').textContent = currentPrice;
    document.getElementById('counter-reserve').textContent = reservePrice;
    
    const input = document.getElementById('counter-price');
    input.value = '';
    input.max = currentPrice - 0.01;
    input.min = reservePrice;
    
    els.counterModal.dataset.offerId = offerId;
    
    toggleModal(els.counterModal, true);
};

window.handleCancelOffer = async (offerId) => {
    if (!confirm('Are you sure you want to cancel this offer?')) return;
    try {
        const res = await cancelOffer(offerId);
        if (res.success) {
            marketPoller.poll(); // Force immediate update
        } else {
            alert('Failed to cancel offer: ' + res.message);
        }
    } catch (e) {
        alert('Error cancelling offer');
        console.error(e);
    }
};

// Internal Handlers tied to buttons

async function handleCreateOffer() {
    const chemical = document.getElementById('offer-chemical').value;
    const quantity = parseInt(document.getElementById('offer-quantity').value);
    const reservePrice = parseFloat(document.getElementById('offer-reserve-price').value);

    if (quantity <= 0 || isNaN(quantity)) return alert('Invalid quantity');
    if (reservePrice < 0 || isNaN(reservePrice)) return alert('Invalid price');
    if (quantity > (currentUser.inventory[chemical] || 0)) return alert('Insufficient inventory');

    try {
        const res = await createOffer(chemical, quantity, reservePrice);
        if (res.success) {
            toggleModal(els.createOfferModal, false);
            switchTab('my-offers');
            marketPoller.poll();
        } else {
            alert(res.message);
        }
    } catch (e) {
        alert('Error creating offer');
        console.error(e);
    }
}

async function handleExpressInterest() {
    const offerId = els.interestModal.dataset.offerId;
    try {
        const res = await expressInterest(offerId);
        if (res.success) {
            toggleModal(els.interestModal, false);
            alert('Interest expressed! Waiting for seller to set price.');
            marketPoller.poll();
        } else {
            alert(res.message);
        }
    } catch (e) {
        alert('Error expressing interest');
        console.error(e);
    }
}

async function handleSetPrice() {
    const offerId = els.setPriceModal.dataset.offerId;
    const buyerId = els.setPriceModal.dataset.buyerId;
    const price = parseFloat(document.getElementById('initial-price').value);

    if (isNaN(price) || price < 0) return alert('Invalid price');

    try {
        const res = await setInitialPrice(offerId, buyerId, price);
        if (res.success) {
            toggleModal(els.setPriceModal, false);
            switchTab('negotiations');
            marketPoller.poll();
        } else {
            alert(res.message);
        }
    } catch (e) {
        alert('Error setting price');
        console.error(e);
    }
}

async function handleRespondToOffer(action) {
    const offerId = els.respondModal.dataset.offerId;
    try {
        const res = await respondToOffer(offerId, action);
        if (res.success) {
            toggleModal(els.respondModal, false);
            if (action === 'accept') {
                alert('Trade completed successfully!');
            }
            marketPoller.poll();
        } else {
            alert(res.message);
        }
    } catch (e) {
        alert('Error responding to offer');
        console.error(e);
    }
}

async function handleCounterOffer() {
    const offerId = els.counterModal.dataset.offerId;
    const price = parseFloat(document.getElementById('counter-price').value);

    if (isNaN(price) || price < 0) return alert('Invalid price');

    try {
        const res = await counterOffer(offerId, price);
        if (res.success) {
            toggleModal(els.counterModal, false);
            alert('Counter offer sent!');
            marketPoller.poll();
        } else {
            alert(res.message);
        }
    } catch (e) {
        alert('Error sending counter offer');
        console.error(e);
    }
}

// Start app
init();