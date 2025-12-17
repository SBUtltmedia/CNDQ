import { state, updateState } from './state.js';
import { fetchSessionState } from './api.js';
import { render } from './ui.js';
import { DEFAULT_INVENTORY } from './config.js';

async function initSession() {
    try {
        const savedState = await fetchSessionState();
        if (savedState) {
            updateState(savedState);
        } else {
             // Start New Session
             updateState({
                startingFund: Math.floor(Math.random() * 10001) + 10000,
                counts: { deicer: 0, solvent: 0 },
                inventory: { ...DEFAULT_INVENTORY }
             });
        }
    } catch (e) {
        // Fallback
        updateState({ startingFund: 15000 });
        console.warn("Could not reach getState.php, using defaults.");
    }
    render(false);
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const deicerPlus = document.getElementById('deicer-plus');
    const deicerMinus = document.getElementById('deicer-minus');
    const solventPlus = document.getElementById('solvent-plus');
    const solventMinus = document.getElementById('solvent-minus');
    const resetBtn = document.getElementById('reset-btn');

    if (deicerPlus) deicerPlus.addEventListener('click', () => { state.counts.deicer++; render(); });
    if (deicerMinus) deicerMinus.addEventListener('click', () => { state.counts.deicer--; render(); });
    if (solventPlus) solventPlus.addEventListener('click', () => { state.counts.solvent++; render(); });
    if (solventMinus) solventMinus.addEventListener('click', () => { state.counts.solvent--; render(); });

    if (resetBtn) resetBtn.addEventListener('click', () => {
        updateState({
            startingFund: Math.floor(Math.random() * 10001) + 10000,
            counts: { deicer: 0, solvent: 0 }
        });
        render();
    });

    initSession();
});
