import { state, calculateCurrentState, checkProductionLimit } from './state.js';
import { DEFAULT_INVENTORY } from './config.js';
import { syncProduction } from './api.js';

export function render(isSyncRequired = true) {
    const { profit, balance } = calculateCurrentState();
    
    // Financials
    const totalBalanceEl = document.getElementById('total-balance');
    const totalProfitEl = document.getElementById('total-profit');
    const startingFundEl = document.getElementById('starting-fund');

    if (totalBalanceEl) totalBalanceEl.textContent = balance.toLocaleString();
    if (totalProfitEl) totalProfitEl.textContent = profit.toLocaleString();
    if (startingFundEl) startingFundEl.textContent = state.startingFund.toLocaleString();

    // Inventory Grid
    const grid = document.getElementById('inventory-grid');
    if (grid) {
        grid.innerHTML = '';
        Object.entries(state.inventory).forEach(([key, value]) => {
            const perc = (value / DEFAULT_INVENTORY[key]) * 100;
            const isLow = perc < 15;
            grid.insertAdjacentHTML('beforeend', `
                <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-[10px] font-bold text-slate-400 tracking-widest uppercase">${key}</span>
                    </div>
                    <div class="text-xl font-bold">${value.toFixed(0)}<span class="text-[10px] text-slate-400 ml-1">GAL</span></div>
                    <div class="w-full bg-slate-100 h-1.5 mt-2 rounded-full overflow-hidden">
                        <div class="h-full transition-width duration-500 ${isLow ? 'bg-amber-500' : 'bg-indigo-500'}" style="width: ${perc}%"></div>
                    </div>
                </div>
            `);
        });
    }

    // Controls
    const deicerCountEl = document.getElementById('deicer-count');
    const solventCountEl = document.getElementById('solvent-count');

    if (deicerCountEl) deicerCountEl.textContent = state.counts.deicer;
    if (solventCountEl) solventCountEl.textContent = state.counts.solvent;

    const deicerPossible = checkProductionLimit('deicer');
    const solventPossible = checkProductionLimit('solvent');

    const deicerPlus = document.getElementById('deicer-plus');
    const solventPlus = document.getElementById('solvent-plus');
    const deicerMinus = document.getElementById('deicer-minus');
    const solventMinus = document.getElementById('solvent-minus');

    if (deicerPlus) deicerPlus.disabled = !deicerPossible;
    if (solventPlus) solventPlus.disabled = !solventPossible;
    if (deicerMinus) deicerMinus.disabled = state.counts.deicer <= 0;
    if (solventMinus) solventMinus.disabled = state.counts.solvent <= 0;

    const deicerWarning = document.getElementById('deicer-warning');
    const solventWarning = document.getElementById('solvent-warning');

    if (deicerWarning) deicerWarning.classList.toggle('hidden', deicerPossible);
    if (solventWarning) solventWarning.classList.toggle('hidden', solventPossible);

    // Footer
    const totalVol = (state.counts.deicer * 50) + (state.counts.solvent * 20);
    const totalRemaining = Object.values(state.inventory).reduce((a, b) => a + b, 0);
    const utilization = ((4000 - totalRemaining) / 4000 * 100).toFixed(1);

    const totalVolEl = document.getElementById('total-vol');
    const utilizationEl = document.getElementById('utilization');

    if (totalVolEl) totalVolEl.textContent = totalVol.toLocaleString();
    if (utilizationEl) utilizationEl.textContent = utilization + '%';

    if (isSyncRequired) syncProduction();
}
