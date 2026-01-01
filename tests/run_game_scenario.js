#!/usr/bin/env node

const RobustGameSimulation = require('./robust-game-simulation');

async function runScenario() {
    console.log('🚀 Starting Comprehensive Game Scenario Test...');
    
    const config = {
        // Base URL where the app is running
        baseUrl: 'http://cndq.test/CNDQ', 
        
        // Run headful to see what's happening (set to true for debugging)
        headless: true, 
        
        // Keep browser open on failure
        keepOpen: false
    };

    const simulation = new RobustGameSimulation(config);
    const result = await simulation.run();

    if (result.success) {
        console.log('\n✅ Test Scenario PASSED');
        process.exit(0);
    } else {
        console.error('\n❌ Test Scenario FAILED');
        console.error(result.error);
        process.exit(1);
    }
}

runScenario().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
