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
