import { state } from './state.js';

export function render() {
    // Header
    const teamNameEl = document.querySelector('h1');
    if (teamNameEl && state.displayName && !teamNameEl.textContent.includes(state.displayName)) {
        // Just append or replace if we have a specific span. 
        // For now, let's look for a specific container or just set title if simple.
        // Actually, index.html has "Enterprise Manager". Let's change "Enterprise Manager" to Team Name?
        // Or better, find the subtitle.
        // Let's assume we can inject it into the header safely if we find a placeholder.
        // Existing index.html doesn't have a team name placeholder in header. 
        // We'll leave it for market.html or add one if needed.
    }

    // Financials
    const totalBalanceEl = document.getElementById('total-balance');
    const totalProfitEl = document.getElementById('total-profit'); 
    const startingFundEl = document.getElementById('starting-fund');

    // Update Labels to reflect new reality
    const profitLabel = totalProfitEl?.previousElementSibling;
    if (profitLabel) profitLabel.textContent = "Net Profit (ROI)";
    
    const capitalLabel = startingFundEl?.previousElementSibling;
    if (capitalLabel) capitalLabel.textContent = "Initial Capital";

    if (totalBalanceEl) totalBalanceEl.textContent = state.startingFund.toLocaleString();
    
    if (totalProfitEl) {
        const sign = state.netProfit >= 0 ? '+' : '';
        const color = state.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600';
        totalProfitEl.className = `text-3xl font-black currency ${color}`;
        totalProfitEl.textContent = `${sign}${state.netProfit.toLocaleString()} (${state.roi.toFixed(1)}%)`;
    }
    
    if (startingFundEl) startingFundEl.textContent = state.initialCapital.toLocaleString();

    // Inventory Grid
    const grid = document.getElementById('inventory-grid');
    if (grid) {
        grid.innerHTML = '';
        Object.entries(state.inventory).forEach(([key, value]) => {
            // Use baseInventory for percentage calculation if available
            const base = state.baseInventory && state.baseInventory[key] ? state.baseInventory[key] : 1;
            const perc = Math.min(100, Math.max(0, (value / base) * 100));
            const isLow = perc < 15;
            
            grid.insertAdjacentHTML('beforeend', `
                <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-[10px] font-bold text-slate-400 tracking-widest uppercase">${key}</span>
                        <span class="text-[10px] text-slate-400">${value.toFixed(0)} / ${base}</span>
                    </div>
                    <div class="text-xl font-bold">${value.toFixed(0)}<span class="text-[10px] text-slate-400 ml-1">GAL</span></div>
                    <div class="w-full bg-slate-100 h-1.5 mt-2 rounded-full overflow-hidden">
                        <div class="h-full transition-width duration-500 ${isLow ? 'bg-amber-500' : 'bg-indigo-500'}" style="width: ${perc}%"></div>
                    </div>
                </div>
            `);
        });
    }

    // Production Counts
    const deicerCountEl = document.getElementById('deicer-count');
    const solventCountEl = document.getElementById('solvent-count');

    if (deicerCountEl) deicerCountEl.textContent = state.counts.deicer;
    if (solventCountEl) solventCountEl.textContent = state.counts.solvent;

    // Footer Stats
    const totalVol = (state.counts.deicer * 50) + (state.counts.solvent * 20);
    // Utilization is hard to calc without base, let's just show total volume
    const totalVolEl = document.getElementById('total-vol');
    if (totalVolEl) totalVolEl.textContent = totalVol.toLocaleString();
    
    const utilizationEl = document.getElementById('utilization');
    if (utilizationEl) utilizationEl.textContent = '-';
    
    // Sync status is handled by app.js polling now
    const syncStatusEl = document.getElementById('sync-status');
    if (syncStatusEl) {
        syncStatusEl.innerHTML = `<div class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div><p class="text-sm font-medium">Live</p>`;
    }
}