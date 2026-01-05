#!/usr/bin/env php
<?php
/**
 * Calculate Shadow Prices for NPCs
 *
 * NPCs need shadow prices to make intelligent trading decisions.
 * This script calculates and updates shadow prices for all active NPCs.
 */

require_once __DIR__ . '/../lib/TeamStorage.php';
require_once __DIR__ . '/../lib/LPSolver.php';
require_once __DIR__ . '/../lib/NPCManager.php';

echo "CNDQ NPC Shadow Price Calculator\n";
echo "=================================\n\n";

try {
    $npcManager = new NPCManager();
    $config = $npcManager->loadConfig();

    if (!$config['enabled']) {
        echo "❌ NPCs are disabled in config\n";
        exit(1);
    }

    $npcs = $config['npcs'];
    if (empty($npcs)) {
        echo "❌ No NPCs found in config\n";
        exit(1);
    }

    echo "Found " . count($npcs) . " NPCs\n\n";

    foreach ($npcs as $npc) {
        if (!$npc['active']) {
            echo "⏭️  Skipping inactive NPC: {$npc['teamName']}\n";
            continue;
        }

        echo "Processing: {$npc['teamName']} ({$npc['email']})\n";

        $storage = new TeamStorage($npc['email']);
        $state = $storage->getState();

        // Check current inventory
        $inventory = $state['inventory'] ?? ['C' => 0, 'N' => 0, 'D' => 0, 'Q' => 0];
        echo "  Current inventory: C={$inventory['C']}, N={$inventory['N']}, D={$inventory['D']}, Q={$inventory['Q']}\n";

        // Calculate shadow prices
        $solver = new LPSolver();
        $result = $solver->getShadowPrices($inventory);

        if (isset($result['shadowPrices'])) {
            $shadowPrices = $result['shadowPrices'];
            echo "  Calculated shadow prices: ";
            echo "C=\${$shadowPrices['C']}, ";
            echo "N=\${$shadowPrices['N']}, ";
            echo "D=\${$shadowPrices['D']}, ";
            echo "Q=\${$shadowPrices['Q']}\n";

            // Update shadow prices in storage
            $storage->updateShadowPrices($shadowPrices);
            echo "  ✅ Shadow prices updated\n\n";
        } else {
            echo "  ⚠️  Could not calculate shadow prices (feasible: {$result['feasible']})\n\n";
        }
    }

    echo "✅ All NPCs processed!\n";

} catch (Exception $e) {
    echo "\n❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
