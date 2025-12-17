import { DEFAULT_INVENTORY, RECIPES } from './config.js';

export let state = {
    counts: { deicer: 0, solvent: 0 },
    startingFund: 0,
    inventory: { ...DEFAULT_INVENTORY },
    baseInventory: { ...DEFAULT_INVENTORY }
};

export function updateState(newState) {
    // Handle migration/initialization
    // If loading from a file that doesn't have baseInventory, assume DEFAULT_INVENTORY (legacy behavior)
    // UNLESS it's a new system file which tracks baseInventory.
    
    // We merge newState into state. 
    // If newState has baseInventory, it overrides.
    // If not, we keep the current state.baseInventory (which defaults to DEFAULT).
    
    // Special case: If newState is completely replacing state (like from a file load)
    // and keys are missing, we should be careful. 
    // But usually newState is just the JSON content.
    
    state = { ...state, ...newState };
    
    // Ensure baseInventory exists if not provided
    if (!state.baseInventory) {
        state.baseInventory = { ...DEFAULT_INVENTORY };
    }
}

export function calculateCurrentState() {
    // Start from the base inventory (snapshot at beginning of session)
    const currentInv = { ...state.baseInventory };
    
    Object.keys(state.counts).forEach(key => {
        const recipe = RECIPES[key];
        const count = state.counts[key];
        Object.entries(recipe.composition).forEach(([ing, ratio]) => {
            currentInv[ing] -= (ratio * recipe.drumSize * count);
        });
    });
    state.inventory = currentInv;

    // Calculate Projected Profits
    // Production does NOT cost money from the fund (per user instruction)
    // Fund only decreases when buying (future feature).
    const profit = (state.counts.deicer * RECIPES.deicer.profit) + (state.counts.solvent * RECIPES.solvent.profit);
    const balance = state.startingFund;

    return { profit, balance };
}

export function checkProductionLimit(key) {
    const recipe = RECIPES[key];
    return Object.entries(recipe.composition).every(([ing, ratio]) => {
        const needed = ratio * recipe.drumSize;
        return state.inventory[ing] >= needed; // Check against current calculated inventory
    });
}