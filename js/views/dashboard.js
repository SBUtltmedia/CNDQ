import { state, updateState } from '../state.js';
import { marketPoller } from '../marketPolling.js';

export default class DashboardView {
    async render() {
        return `
        <!-- Financial Summary -->
        <section class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div class="bg-indigo-600 p-6 rounded-2xl text-white shadow-lg">
                <p class="text-indigo-100 text-xs uppercase font-bold mb-1">Total Bank Balance</p>
                <h3 class="text-3xl font-black currency" id="total-balance">Loading...</h3>
            </div>
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <p class="text-slate-400 text-xs uppercase font-bold mb-1">Net Profit (ROI)</p>
                <h3 class="text-3xl font-black text-emerald-600 currency" id="total-profit">0</h3>
            </div>
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <p class="text-slate-400 text-xs uppercase font-bold mb-1">Initial Capital</p>
                <h3 class="text-3xl font-black text-slate-800 currency" id="starting-fund">0</h3>
            </div>
        </section>

        <!-- Inventory Grid -->
        <section class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8" id="inventory-grid">
            <!-- Dynamically injected -->
        </section>

        <!-- Product Controls -->
        <div class="grid md:grid-cols-2 gap-6">
            <!-- Deicer Card -->
            <div class="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
                <div class="h-2 bg-blue-500"></div>
                <div class="p-6">
                    <div class="flex justify-between items-start mb-6">
                        <div>
                            <h2 class="text-xl font-bold text-slate-800">Deicer</h2>
                            <p class="text-slate-500 text-sm">50 Gallon Drum • <span class="text-emerald-600 font-bold">+$100 Profit</span></p>
                        </div>
                        <div class="bg-slate-50 p-3 rounded-lg border border-slate-100 text-blue-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                        </div>
                    </div>
                    <div class="bg-slate-50 rounded-xl p-4 text-center border border-slate-200">
                        <div id="deicer-count" class="text-3xl font-black text-slate-800">0</div>
                        <div class="text-[10px] uppercase font-bold text-slate-400 mb-2">Drums Produced</div>
                        <div id="production-status-deicer" class="text-xs font-medium text-slate-500 bg-slate-200 rounded-full px-3 py-1 inline-block">
                            Waiting for production phase...
                        </div>
                    </div>
                </div>
            </div>

            <!-- Solvent Card -->
            <div class="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
                <div class="h-2 bg-emerald-500"></div>
                <div class="p-6">
                    <div class="flex justify-between items-start mb-6">
                        <div>
                            <h2 class="text-xl font-bold text-slate-800">Solvent</h2>
                            <p class="text-slate-500 text-sm">20 Gallon Drum • <span class="text-emerald-600 font-bold">+$60 Profit</span></p>
                        </div>
                        <div class="bg-slate-50 p-3 rounded-lg border border-slate-100 text-emerald-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                        </div>
                    </div>
                    <div class="bg-slate-50 rounded-xl p-4 text-center border border-slate-200">
                        <div id="solvent-count" class="text-3xl font-black text-slate-800">0</div>
                        <div class="text-[10px] uppercase font-bold text-slate-400 mb-2">Drums Produced</div>
                        <div id="production-status-solvent" class="text-xs font-medium text-slate-500 bg-slate-200 rounded-full px-3 py-1 inline-block">
                            Waiting for production phase...
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Summary Footer -->
        <footer class="mt-12 p-6 bg-slate-900 rounded-2xl text-white shadow-xl">
            <div class="grid grid-cols-2 md:grid-cols-3 gap-6 text-center md:text-left">
                <div>
                    <p class="text-slate-400 text-xs uppercase font-bold mb-1">Production Volume</p>
                    <p class="text-2xl font-bold"><span id="total-vol">0</span> <span class="text-sm font-normal">gal</span></p>
                </div>
                <div>
                    <p class="text-slate-400 text-xs uppercase font-bold mb-1">Resource Utilization</p>
                    <p class="text-2xl font-bold" id="utilization">0.0%</p>
                </div>
                <div class="col-span-2 md:col-span-1 flex flex-col items-center md:items-start">
                    <p class="text-slate-400 text-xs uppercase font-bold mb-1">Session Status</p>
                    <div class="flex items-center gap-2" id="sync-status">
                        <div class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                        <p class="text-sm font-medium">Live</p>
                    </div>
                </div>
            </div>
        </footer>
        `;
    }

    async mount() {
        this.updateCallback = (data) => this.handleUpdate(data);
        marketPoller.subscribe(this.updateCallback);
        // Trigger immediate update if data exists
        this.updateUI();
    }

    unmount() {
        marketPoller.unsubscribe(this.updateCallback);
    }

    handleUpdate(data) {
        if (!data.success) return;

        // Update State
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
        updateState(newState);

        this.updateUI();
    }

    updateUI() {
        // Financials
        const totalBalanceEl = document.getElementById('total-balance');
        const totalProfitEl = document.getElementById('total-profit'); 
        const startingFundEl = document.getElementById('starting-fund');

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
        const totalVolEl = document.getElementById('total-vol');
        if (totalVolEl) totalVolEl.textContent = totalVol.toLocaleString();
        
        // Session Status Cards
        this.updateSessionCards(state.sessionState);
    }

    updateSessionCards(phase) {
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
}
