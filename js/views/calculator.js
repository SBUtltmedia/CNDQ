import { getShadowPrices } from '../solver.js';
import { state } from '../state.js';

export default class CalculatorView {
    async render() {
        return `
        <div class="max-w-4xl mx-auto">
            <h1 class="text-3xl font-bold text-slate-800 mb-8">Optimization Calculator</h1>
            
            <div class="grid md:grid-cols-2 gap-8">
                <!-- Input Section -->
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 class="text-xl font-bold mb-4">Inventory Inputs</h2>
                    <div class="space-y-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-bold text-slate-700 mb-1">Liquid C</label>
                                <input type="number" id="inv-c" class="w-full border rounded p-2" value="0">
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-slate-700 mb-1">Liquid N</label>
                                <input type="number" id="inv-n" class="w-full border rounded p-2" value="0">
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-slate-700 mb-1">Liquid D</label>
                                <input type="number" id="inv-d" class="w-full border rounded p-2" value="0">
                            </div>
                            <div>
                                <label class="block text-sm font-bold text-slate-700 mb-1">Liquid Q</label>
                                <input type="number" id="inv-q" class="w-full border rounded p-2" value="0">
                            </div>
                        </div>
                        <button id="load-btn" class="w-full py-2 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 text-sm font-medium">Load My Current Inventory</button>
                        <button id="calc-btn" class="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-md">Calculate Optimal Mix</button>
                    </div>
                </div>

                <!-- Results Section -->
                <div class="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 class="text-xl font-bold mb-4">Optimization Results</h2>
                    
                    <div class="mb-6">
                        <p class="text-xs uppercase font-bold text-slate-400 mb-1">Max Potential Profit</p>
                        <div class="text-3xl font-black text-emerald-600" id="res-profit">$0</div>
                    </div>

                    <div class="grid grid-cols-2 gap-4 mb-6">
                        <div class="bg-blue-50 p-3 rounded-lg border border-blue-100">
                            <p class="text-xs text-blue-800 font-bold mb-1">Optimal Deicer</p>
                            <p class="text-xl font-bold" id="res-deicer">0</p>
                            <p class="text-xs text-slate-500">Drums</p>
                        </div>
                        <div class="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                            <p class="text-xs text-emerald-800 font-bold mb-1">Optimal Solvent</p>
                            <p class="text-xl font-bold" id="res-solvent">0</p>
                            <p class="text-xs text-slate-500">Drums</p>
                        </div>
                    </div>

                    <div>
                        <h3 class="text-sm font-bold text-slate-800 mb-3 border-b pb-2">Shadow Prices (Value of +1 gal)</h3>
                        <div class="space-y-2">
                            <div class="flex justify-between items-center">
                                <span class="font-medium text-slate-600">Liquid C</span>
                                <span class="font-bold text-slate-800" id="sp-c">$0.00</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="font-medium text-slate-600">Liquid N</span>
                                <span class="font-bold text-slate-800" id="sp-n">$0.00</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="font-medium text-slate-600">Liquid D</span>
                                <span class="font-bold text-slate-800" id="sp-d">$0.00</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="font-medium text-slate-600">Liquid Q</span>
                                <span class="font-bold text-slate-800" id="sp-q">$0.00</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    async mount() {
        document.getElementById('calc-btn').addEventListener('click', () => this.calculate());
        document.getElementById('load-btn').addEventListener('click', () => this.loadInventory());
        
        // Auto-load if we have state
        this.loadInventory();
    }

    calculate() {
        const inv = {
            C: parseFloat(document.getElementById('inv-c').value) || 0,
            N: parseFloat(document.getElementById('inv-n').value) || 0,
            D: parseFloat(document.getElementById('inv-d').value) || 0,
            Q: parseFloat(document.getElementById('inv-q').value) || 0
        };

        const result = getShadowPrices(inv);

        document.getElementById('res-profit').textContent = result.maxProfit.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        document.getElementById('res-deicer').textContent = result.optimalMix.deicer.toFixed(2);
        document.getElementById('res-solvent').textContent = result.optimalMix.solvent.toFixed(2);

        ['C', 'N', 'D', 'Q'].forEach(chem => {
            document.getElementById(`sp-${chem.toLowerCase()}`).textContent = result.shadowPrices[chem].toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        });
    }

    loadInventory() {
        if (state && state.inventory) {
            document.getElementById('inv-c').value = state.inventory.C;
            document.getElementById('inv-n').value = state.inventory.N;
            document.getElementById('inv-d').value = state.inventory.D;
            document.getElementById('inv-q').value = state.inventory.Q;
            
            // Trigger calc
            this.calculate();
        }
    }
}
