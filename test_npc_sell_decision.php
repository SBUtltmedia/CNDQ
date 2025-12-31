#!/usr/bin/env php
<?php
/**
 * Test if NPCs can see and respond to user's buy orders
 */

require_once __DIR__ . '/lib/TeamStorage.php';
require_once __DIR__ . '/lib/NPCManager.php';
require_once __DIR__ . '/lib/MarketplaceAggregator.php';

echo "=== Testing NPC Sell Decisions ===\n\n";

// Get NPC config
$npcManager = new NPCManager();
$npcsData = $npcManager->listNPCs();

foreach ($npcsData['npcs'] as $npc) {
    if (!$npc['active']) {
        continue;
    }

    echo "Testing {$npc['teamName']} ({$npc['skillLevel']})...\n";

    // Get NPC inventory
    $storage = new TeamStorage($npc['email']);
    $inventory = $storage->getInventory();
    $profile = $storage->getProfile();

    echo "  Inventory: C={$inventory['C']} N={$inventory['N']} D={$inventory['D']} Q={$inventory['Q']}\n";
    echo "  Funds: \${$profile['currentFunds']}\n";

    // Check what buy orders they can see
    $aggregator = new MarketplaceAggregator();
    $buyOrders = $aggregator->getBuyOrdersByChemical();

    // Check each chemical
    foreach (['C', 'N', 'D', 'Q'] as $chem) {
        $available = $inventory[$chem] ?? 0;
        $orders = $buyOrders[$chem] ?? [];

        // Filter out own orders and other NPC orders
        $validOrders = array_filter($orders, function($order) use ($npc) {
            $isOwnOrder = $order['buyerId'] === $npc['email'];
            $isNPCOrder = strpos($order['buyerId'], 'npc_') === 0;
            return !$isOwnOrder && !$isNPCOrder;
        });

        if ($available >= 100 && !empty($validOrders)) {
            $highestOrder = reset($validOrders); // Already sorted by price
            echo "  ✓ CAN SELL $chem: Has {$available} gal, highest buy order is \${$highestOrder['maxPrice']}/gal from {$highestOrder['buyerName']}\n";
        }
    }

    echo "\n";
}

echo "=== End Test ===\n";
