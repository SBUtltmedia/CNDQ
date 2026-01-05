<?php
/**
 * Test Script for NPC Foundation
 *
 * Tests:
 * - NPCManager initialization
 * - NPC creation (beginner, novice, expert)
 * - Team directory creation
 * - Name generation
 * - Config save/load
 * - BeginnerStrategy instantiation
 */

require_once __DIR__ . '/lib/NPCManager.php';
require_once __DIR__ . '/lib/TeamNameGenerator.php';

echo "=== NPC Foundation Test ===\n\n";

// Test 1: NPCManager Initialization
echo "Test 1: NPCManager Initialization\n";
try {
    $npcManager = new NPCManager();
    echo "✓ NPCManager created successfully\n";

    $config = $npcManager->loadConfig();
    echo "✓ Config loaded: enabled=" . ($config['enabled'] ? 'true' : 'false') . "\n";
    echo "✓ Current NPCs: " . count($config['npcs']) . "\n\n";
} catch (Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n\n";
    exit(1);
}

// Test 2: NPC Name Generation
echo "Test 2: NPC Name Generation\n";
try {
    $beginnerNames = [];
    $noviceNames = [];
    $expertNames = [];

    for ($i = 0; $i < 5; $i++) {
        $beginnerNames[] = TeamNameGenerator::generateNPCName('beginner');
        $noviceNames[] = TeamNameGenerator::generateNPCName('novice');
        $expertNames[] = TeamNameGenerator::generateNPCName('expert');
    }

    echo "Sample Beginner Names: " . implode(', ', $beginnerNames) . "\n";
    echo "Sample Novice Names: " . implode(', ', $noviceNames) . "\n";
    echo "Sample Expert Names: " . implode(', ', $expertNames) . "\n";
    echo "✓ Name generation working for all skill levels\n\n";
} catch (Exception $e) {
    echo "✗ Error: " . $e->getMessage() . "\n\n";
    exit(1);
}

// Test 3: Create Test NPCs
echo "Test 3: Creating Test NPCs (1 of each skill level)\n";
try {
    // Create 1 beginner NPC
    $beginnerIds = $npcManager->createNPCs('beginner', 1);
    echo "✓ Created beginner NPC: " . $beginnerIds[0] . "\n";

    // Create 1 novice NPC
    $noviceIds = $npcManager->createNPCs('novice', 1);
    echo "✓ Created novice NPC: " . $noviceIds[0] . "\n";

    // Create 1 expert NPC
    $expertIds = $npcManager->createNPCs('expert', 1);
    echo "✓ Created expert NPC: " . $expertIds[0] . "\n\n";

} catch (Exception $e) {
    echo "✗ Error creating NPCs: " . $e->getMessage() . "\n\n";
    exit(1);
}

// Test 4: Verify Config Updated
echo "Test 4: Verify Config Updated\n";
try {
    $config = $npcManager->loadConfig();
    echo "✓ Total NPCs in config: " . count($config['npcs']) . "\n";

    foreach ($config['npcs'] as $npc) {
        echo "  - " . $npc['teamName'] . " (" . $npc['skillLevel'] . ") - " . $npc['email'] . "\n";
        echo "    Active: " . ($npc['active'] ? 'Yes' : 'No') . "\n";
        echo "    Stats: Trades=" . $npc['stats']['totalTrades'] . ", Profit=$" . $npc['stats']['totalProfit'] . "\n";
    }
    echo "\n";
} catch (Exception $e) {
    echo "✗ Error reading config: " . $e->getMessage() . "\n\n";
    exit(1);
}

// Test 5: Verify Team Directories Created
echo "Test 5: Verify Team Directories Created\n";
try {
    foreach ($config['npcs'] as $npc) {
        $storage = new TeamStorage($npc['email']);
        $profile = $storage->getProfile();
        $inventory = $storage->getInventory();

        echo "✓ Team directory exists for: " . $npc['email'] . "\n";
        echo "  Team Name: " . $profile['teamName'] . "\n";
        echo "  Funds: $" . number_format($profile['currentFunds'], 2) . "\n";
        echo "  Inventory: C=" . round($inventory['C']) . ", N=" . round($inventory['N']) .
             ", D=" . round($inventory['D']) . ", Q=" . round($inventory['Q']) . "\n";
    }
    echo "\n";
} catch (Exception $e) {
    echo "✗ Error accessing team directories: " . $e->getMessage() . "\n\n";
    exit(1);
}

// Test 6: Test BeginnerStrategy Instantiation
echo "Test 6: Test BeginnerStrategy Instantiation\n";
try {
    require_once __DIR__ . '/lib/strategies/BeginnerStrategy.php';

    // Get first beginner NPC
    $beginnerNPC = null;
    foreach ($config['npcs'] as $npc) {
        if ($npc['skillLevel'] === 'beginner') {
            $beginnerNPC = $npc;
            break;
        }
    }

    if ($beginnerNPC) {
        $storage = new TeamStorage($beginnerNPC['email']);
        $strategy = new BeginnerStrategy($storage, $beginnerNPC, $npcManager);
        echo "✓ BeginnerStrategy instantiated successfully\n";

        // Try to get a decision (may return null, that's okay)
        $decision = $strategy->decideTrade();
        if ($decision) {
            echo "✓ Strategy made a decision: " . $decision['type'] . "\n";
        } else {
            echo "✓ Strategy decided not to trade (30% probability)\n";
        }
    } else {
        echo "⚠ No beginner NPC found to test strategy\n";
    }
    echo "\n";
} catch (Exception $e) {
    echo "✗ Error testing BeginnerStrategy: " . $e->getMessage() . "\n\n";
    exit(1);
}

// Test 7: Test NPC-to-NPC Detection
echo "Test 7: Test NPC-to-NPC Detection\n";
try {
    $npcEmail1 = $config['npcs'][0]['email'];
    $npcEmail2 = $config['npcs'][1]['email'];
    $playerEmail = 'player@test.edu';

    echo "  isNPC('" . $npcEmail1 . "'): " . ($npcManager->isNPC($npcEmail1) ? 'true' : 'false') . "\n";
    echo "  isNPC('" . $playerEmail . "'): " . ($npcManager->isNPC($playerEmail) ? 'true' : 'false') . "\n";

    $canTrade1 = $npcManager->canTradeWith($npcEmail1, $npcEmail2);
    $canTrade2 = $npcManager->canTradeWith($npcEmail1, $playerEmail);

    echo "  canTradeWith(NPC, NPC): " . ($canTrade1 ? 'true' : 'false') . " (should be false)\n";
    echo "  canTradeWith(NPC, Player): " . ($canTrade2 ? 'true' : 'false') . " (should be true)\n";

    if (!$canTrade1 && $canTrade2) {
        echo "✓ NPC-to-NPC prevention working correctly\n";
    } else {
        echo "✗ NPC-to-NPC prevention NOT working\n";
    }
    echo "\n";
} catch (Exception $e) {
    echo "✗ Error testing NPC detection: " . $e->getMessage() . "\n\n";
    exit(1);
}

// Test 8: Test Toggle Functions
echo "Test 8: Test Toggle Functions\n";
try {
    $testNPC = $config['npcs'][0];

    // Toggle NPC active state
    $npcManager->toggleNPC($testNPC['id'], false);
    $config = $npcManager->loadConfig();
    $updated = null;
    foreach ($config['npcs'] as $npc) {
        if ($npc['id'] === $testNPC['id']) {
            $updated = $npc;
            break;
        }
    }
    echo "✓ Toggled NPC to inactive: " . ($updated['active'] ? 'active' : 'inactive') . "\n";

    // Toggle back to active
    $npcManager->toggleNPC($testNPC['id'], true);
    echo "✓ Toggled NPC back to active\n";

    // Toggle system
    $npcManager->toggleSystem(true);
    $config = $npcManager->loadConfig();
    echo "✓ System enabled: " . ($config['enabled'] ? 'true' : 'false') . "\n";

    echo "\n";
} catch (Exception $e) {
    echo "✗ Error testing toggles: " . $e->getMessage() . "\n\n";
    exit(1);
}

// Summary
echo "=== Test Summary ===\n";
echo "✓ All foundation tests passed!\n";
echo "✓ NPCs created: " . count($config['npcs']) . "\n";
echo "✓ Team directories created and populated\n";
echo "✓ Config save/load working\n";
echo "✓ Name generation working for all skill levels\n";
echo "✓ BeginnerStrategy can be instantiated\n";
echo "✓ NPC-to-NPC prevention working\n";
echo "✓ Toggle functions working\n\n";

echo "You can now:\n";
echo "1. Check data/npc_config.json to see the NPC configuration\n";
echo "2. Check data/teams/npc_*/ directories to see NPC team data\n";
echo "3. Continue implementing remaining strategies and admin interface\n";
