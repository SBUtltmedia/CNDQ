import { state } from './state.js';

export async function fetchSessionState() {
    try {
        const response = await fetch('getState.php');
        if (response.status === 404) {
             return null;
        } else {
            return await response.json();
        }
    } catch (e) {
        console.warn("Could not reach getState.php, using defaults.");
        throw e;
    }
}

export async function syncProduction(retries = 3, delay = 1000) {
    const statusEl = document.getElementById('sync-status');
    if (!statusEl) return;

    statusEl.innerHTML = `<div class="w-2 h-2 rounded-full bg-blue-400 animate-spin"></div><p class="text-sm font-medium">Syncing...</p>`;

    try {
        const response = await fetch('production.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state)
        });

        if (!response.ok) throw new Error();

        statusEl.innerHTML = `<div class="w-2 h-2 rounded-full bg-green-400"></div><p class="text-sm font-medium">Progress Saved</p>`;
        setTimeout(() => {
            statusEl.innerHTML = `<div class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div><p class="text-sm font-medium">Session Active</p>`;
        }, 2000);

    } catch (error) {
        if (retries > 0) {
            setTimeout(() => syncProduction(retries - 1, delay * 2), delay);
        } else {
            statusEl.innerHTML = `<div class="w-2 h-2 rounded-full bg-red-500"></div><p class="text-sm font-medium">Sync Error</p>`;
        }
    }
}

// Market Negotiation API Functions
export async function createOffer(chemical, quantity, reservePrice) {
    const response = await fetch('createOffer.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chemical, quantity, reserve_price: reservePrice })
    });
    return await response.json();
}

export async function expressInterest(offerId) {
    const response = await fetch('expressInterest.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: offerId })
    });
    return await response.json();
}

export async function setInitialPrice(offerId, buyerId, price) {
    const response = await fetch('setInitialPrice.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: offerId, buyer_id: buyerId, price })
    });
    return await response.json();
}

export async function respondToOffer(offerId, action) {
    const response = await fetch('respondToOffer.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: offerId, action })
    });
    return await response.json();
}

export async function counterOffer(offerId, newPrice) {
    const response = await fetch('counterOffer.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: offerId, new_price: newPrice })
    });
    return await response.json();
}

export async function cancelOffer(offerId) {
    const response = await fetch('cancelOffer.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: offerId })
    });
    return await response.json();
}

export async function getMarketUpdates(lastPoll = 0) {
    const response = await fetch(`getMarketUpdates.php?lastPoll=${lastPoll}`);
    return await response.json();
}
