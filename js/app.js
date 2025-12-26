import { state, updateState } from './state.js';
import { render } from './ui.js';

// Polling Interval
const POLL_INTERVAL = 3000;

async function fetchUpdates() {
    try {
        const res = await fetch('getMarketUpdates.php');
        const data = await res.json();
        
        if (data.success) {
            // Map backend data to frontend state structure
            const newState = {
                displayName: data.display_name,
                startingFund: data.user_fund,
                initialCapital: data.initial_capital,
                inventory: data.user_inventory,
                initialInventory: data.initial_inventory,
                counts: { 
                    deicer: data.last_production ? data.last_production.deicer : 0, 
                    solvent: data.last_production ? data.last_production.solvent : 0 
                },
                sessionState: data.session_state ? data.session_state.state : 'UNKNOWN'
            };

            // If user has lastProduction data and we are in/past PRODUCTION state
            // we could show those counts. 
            // We can't easily get 'lastProduction' from getMarketUpdates yet... 
            // I should add 'lastProduction' to getMarketUpdates response.
            
            updateState(newState);
            render();
            updateSessionBadge(newState.sessionState);
        }
    } catch (e) {
        console.error("Polling error", e);
    }
    
    setTimeout(fetchUpdates, POLL_INTERVAL);
}

function updateSessionBadge(phase) {
    const badge = document.getElementById('session-phase-badge');
    if (badge) {
        badge.textContent = `Phase: ${phase}`;
        // Color coding
        badge.className = 'px-2 py-0.5 rounded text-xs font-bold transition-colors duration-300 ';
        switch(phase) {
            case 'SETUP': badge.className += 'bg-slate-200 text-slate-600'; break;
            case 'PRODUCTION': badge.className += 'bg-blue-200 text-blue-800'; break;
            case 'TRADING': badge.className += 'bg-emerald-200 text-emerald-800'; break;
            case 'DAY_END': badge.className += 'bg-amber-200 text-amber-800'; break;
            default: badge.className += 'bg-gray-200 text-gray-800';
        }
    }
    
    // Also update the status text in the cards
    const deicerStatus = document.getElementById('production-status-deicer');
    const solventStatus = document.getElementById('production-status-solvent');
    
    if (deicerStatus && solventStatus) {
        if (phase === 'PRODUCTION') {
            deicerStatus.textContent = "Production in Progress...";
            deicerStatus.className = "text-xs font-medium text-blue-700 bg-blue-100 rounded-full px-3 py-1 inline-block animate-pulse";
            solventStatus.textContent = "Production in Progress...";
            solventStatus.className = "text-xs font-medium text-blue-700 bg-blue-100 rounded-full px-3 py-1 inline-block animate-pulse";
        } else if (phase === 'TRADING' || phase === 'DAY_END') {
             deicerStatus.textContent = "Production Complete";
             deicerStatus.className = "text-xs font-medium text-emerald-700 bg-emerald-100 rounded-full px-3 py-1 inline-block";
             solventStatus.textContent = "Production Complete";
             solventStatus.className = "text-xs font-medium text-emerald-700 bg-emerald-100 rounded-full px-3 py-1 inline-block";
        } else {
             deicerStatus.textContent = "Waiting for production phase...";
             deicerStatus.className = "text-xs font-medium text-slate-500 bg-slate-200 rounded-full px-3 py-1 inline-block";
             solventStatus.textContent = "Waiting for production phase...";
             solventStatus.className = "text-xs font-medium text-slate-500 bg-slate-200 rounded-full px-3 py-1 inline-block";
        }
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Reset button is now handled by Admin, but we kept it in UI? 
    // The UI button says "Reset Session". 
    // In strict mode, students shouldn't reset. 
    // Let's hide it or make it just a refresh.
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) resetBtn.style.display = 'none'; // Hide for students

    fetchUpdates();
});