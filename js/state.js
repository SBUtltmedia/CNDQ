import { DEFAULT_INVENTORY, RECIPES } from './config.js';

export let state = {
    displayName: 'Loading...',
    counts: { deicer: 0, solvent: 0 },
    startingFund: 0,
    initialCapital: 0,
    inventory: { ...DEFAULT_INVENTORY },
    baseInventory: { ...DEFAULT_INVENTORY }, // This is now 'initialInventory' from backend
    netProfit: 0,
    roi: 0
};

export function updateState(newState) {
    // Map backend 'initial_inventory' to 'baseInventory' if present
    if (newState.initialInventory) {
        newState.baseInventory = newState.initialInventory;
    }
    
    state = { ...state, ...newState };
    
    // Fallback if baseInventory is missing
    if (!state.baseInventory) {
        state.baseInventory = { ...DEFAULT_INVENTORY };
    }
    
    // Calculate performance metrics immediately
    const start = state.initialCapital || 1; // avoid divide by zero
    state.netProfit = state.startingFund - state.initialCapital;
    state.roi = (state.netProfit / start) * 100;
}

export function calculateCurrentState() {
    // This function was used for client-side simulation, 
    // but now we rely mostly on server state.
    // However, for the calculator or predictions, we might still use it.
    
    // Calculate Projected Profits (Legacy logic, mostly unused now)
    const profit = (state.counts.deicer * RECIPES.deicer.profit) + (state.counts.solvent * RECIPES.solvent.profit);
    const balance = state.startingFund;

    return { profit, balance, netProfit: state.netProfit, roi: state.roi };
}

export function checkProductionLimit(key) {
    const recipe = RECIPES[key];
    return Object.entries(recipe.composition).every(([ing, ratio]) => {
        const needed = ratio * recipe.drumSize;
        return state.inventory[ing] >= needed; // Check against current calculated inventory
    });
}