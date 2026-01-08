/**
 * WebSocket Stress Test
 * 
 * Spawns many concurrent connections and floods the system with refresh signals.
 * Monitors for responsiveness and process stability. 
 * 
 * Usage:
 *   $env:NODE_PATH='C:\Users\pauls\HerdRoot\CNDQ\node_modules'
 *   node tests/stress-test-ws.js
 */

const WebSocket = require('ws');
const axios = require('axios');

const CONFIG = {
    wsUrl: 'ws://cndq.test/CNDQ/ws',
    pushUrl: 'http://127.0.0.1:8081',
    concurrentClients: 10, // Start with 10
    messagesPerClient: 20,
    pushInterval: 100 // ms
};

async function main() {
    console.log(`\n🚀 Starting WebSocket Stress Test`);
    console.log(`=================================`);
    console.log(`Target: ${CONFIG.wsUrl}`);
    console.log(`Clients: ${CONFIG.concurrentClients}`);
    console.log(`=================================\n`);

    const clients = [];
    let messagesReceived = 0;

    // 1. Spawn Clients
    console.log(`📡 Connecting ${CONFIG.concurrentClients} clients...`);
    for (let i = 0; i < CONFIG.concurrentClients; i++) {
        const ws = new WebSocket(CONFIG.wsUrl, {
            headers: {
                'X-Remote-User': `stress-test-user-${i}@test.com`
            }
        });

        ws.on('message', (data) => {
            messagesReceived++;
        });

        ws.on('error', (err) => {
            console.error(`❌ Client ${i} error:`, err.message);
        });

        const connected = new Promise((resolve) => {
            ws.on('open', () => {
                resolve();
            });
        });

        clients.push({ ws, connected });
    }

    await Promise.all(clients.map(c => c.connected));
    console.log(`✅ All ${CONFIG.concurrentClients} clients connected.`);

    // 2. Start Flooding Internal Push API
    console.log(`🌊 Flooding internal push API...`);
    const totalPushes = 20;
    let successfulPushes = 0;

    for (let i = 0; i < totalPushes; i++) {
        try {
            await axios.post(CONFIG.pushUrl, {
                type: 'marketplace_updated',
                iteration: i
            });
            successfulPushes++;
            process.stdout.write('.');
        } catch (error) {
            process.stdout.write('F');
        }
        await new Promise(r => setTimeout(r, CONFIG.pushInterval));
    }

    console.log(`\n\n📊 Metrics after flood:`);
    console.log(`------------------------`);
    console.log(`Total Pushes Attempted: ${totalPushes}`);
    console.log(`Successful Pushes:      ${successfulPushes}`);
    console.log(`Expected Messages:      ${successfulPushes * CONFIG.concurrentClients}`);
    
    // Wait a bit for final deliveries
    await new Promise(r => setTimeout(r, 2000));
    console.log(`Actual Messages Recvd:  ${messagesReceived}`);

    const efficiency = (messagesReceived / (successfulPushes * CONFIG.concurrentClients)) * 100;
    console.log(`Delivery Efficiency:    ${efficiency.toFixed(2)}%`);

    if (efficiency > 95) {
        console.log(`\n✅ PASS: WebSocket server handled the load with high efficiency.`);
    } else {
        console.log(`\n❌ FAIL: High message loss detected.`);
    }

    // Cleanup
    clients.forEach(c => c.ws.close());
    process.exit(efficiency > 95 ? 0 : 1);
}

main().catch(console.error);
