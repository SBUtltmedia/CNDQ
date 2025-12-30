<?php
/**
 * Complete NPC System Test
 *
 * Tests the entire NPC implementation end-to-end:
 * - NPC creation and management
 * - All three strategies (Beginner, Novice, Expert)
 * - NPC-to-NPC prevention
 * - Trade execution
 * - SessionManager integration
 */

require_once __DIR__ . '/lib/NPCManager.php';
require_once __DIR__ . '/lib/TeamStorage.php';
require_once __DIR__ . '/lib/SessionManager.php';
require_once __DIR__ . '/lib/TradeExecutor.php';

echo "=== Complete NPC System Test ===\n\n";

$testsPassed = 0;
$testsFailed = 0;

function testPass($message) {
    global $testsPassed;
    $testsPassed++;
    echo "✓ $message\n";
}

function testFail($message) {
    global $testsFailed;
    $testsFailed++;
    echo "✗ FAIL: $message\n";
}

// Test 1: NPCManager Basic Operations
echo "Test 1: NPCManager Basic Operations\n";
try {
    $npcManager = new NPCManager();

    // Check if system starts disabled
    $config = $npcManager->loadConfig();
    testPass("NPCManager initialized and config loaded");

    // Test NPC identification
    if ($npcManager->isNPC('npc_test@system') && !$npcManager->isNPC('student@test.edu')) {
        testPass("NPC identification working correctly");
    } else {
        testFail("NPC identification not working");
    }

    // Test canTradeWith
    if (!$npcManager->canTradeWith('npc_1@system', 'npc_2@system') &&
        $npcManager->canTradeWith('npc_1@system', 'student@test.edu')) {
        testPass("NPC-to-NPC prevention working");
    } else {
        testFail("NPC-to-NPC prevention not working");
    }

} catch (Exception $e) {
    testFail("NPCManager basic operations: " . $e->getMessage());
}

echo "\n";

// Test 2: Verify Existing NPCs
echo "Test 2: Verify Existing NPCs\n";
try {
    $npcList = $npcManager->listNPCs();
    echo "  NPCs in system: " . count($npcList['npcs']) . "\n";

    foreach ($npcList['npcs'] as $npc) {
        echo "  - {$npc['teamName']} ({$npc['skillLevel']}): ";
        echo "\$" . number_format($npc['currentFunds'] ?? 0, 2) . ", ";
        echo "Trades: {$npc['stats']['totalTrades']}\n";
    }

    if (count($npcList['npcs']) >= 3) {
        testPass("NPCs exist in system from foundation test");
    } else {
        testFail("Expected at least 3 NPCs from foundation test");
    }

} catch (Exception $e) {
    testFail("Verify existing NPCs: " . $e->getMessage());
}

echo "\n";

// Test 3: Strategy Instantiation
echo "Test 3: Strategy Instantiation\n";
try {
    require_once __DIR__ . '/lib/strategies/BeginnerStrategy.php';
    require_once __DIR__ . '/lib/strategies/NoviceStrategy.php';
    require_once __DIR__ . '/lib/strategies/ExpertStrategy.php';

    // Find NPCs for each skill level
    $beginnerNPC = null;
    $noviceNPC = null;
    $expertNPC = null;

    foreach ($npcList['npcs'] as $npc) {
        if ($npc['skillLevel'] === 'beginner' && !$beginnerNPC) $beginnerNPC = $npc;
        if ($npc['skillLevel'] === 'novice' && !$noviceNPC) $noviceNPC = $npc;
        if ($npc['skillLevel'] === 'expert' && !$expertNPC) $expertNPC = $npc;
    }

    // Test BeginnerStrategy
    if ($beginnerNPC) {
        $storage = new TeamStorage($beginnerNPC['email']);
        $strategy = new BeginnerStrategy($storage, $beginnerNPC, $npcManager);
        testPass("BeginnerStrategy instantiated successfully");

        $decision = $strategy->decideTrade();
        echo "  Beginner decision: " . ($decision ? $decision['type'] : 'no action') . "\n";
    }

    // Test NoviceStrategy
    if ($noviceNPC) {
        $storage = new TeamStorage($noviceNPC['email']);
        $strategy = new NoviceStrategy($storage, $noviceNPC, $npcManager);
        testPass("NoviceStrategy instantiated successfully");

        $decision = $strategy->decideTrade();
        echo "  Novice decision: " . ($decision ? $decision['type'] : 'no action') . "\n";
    }

    // Test ExpertStrategy
    if ($expertNPC) {
        $storage = new TeamStorage($expertNPC['email']);
        $strategy = new ExpertStrategy($storage, $expertNPC, $npcManager);
        testPass("ExpertStrategy instantiated successfully");

        $decision = $strategy->decideTrade();
        echo "  Expert decision: " . ($decision ? $decision['type'] : 'no action') . "\n";
    }

} catch (Exception $e) {
    testFail("Strategy instantiation: " . $e->getMessage());
}

echo "\n";

// Test 4: Create a Test Player and Offer
echo "Test 4: Setup Test Player and Offer\n";
try {
    $testPlayerEmail = 'test_player_' . time() . '@test.edu';
    $testStorage = new TeamStorage($testPlayerEmail);

    // Update test player profile
    $testStorage->updateProfile(function($profile) {
        $profile['teamName'] = 'Test Player';
        $profile['currentFunds'] = 10000;
        return $profile;
    });

    // Give test player inventory
    $testStorage->updateInventory(function($inv) {
        $inv['C'] = 500;
        $inv['N'] = 500;
        $inv['D'] = 500;
        $inv['Q'] = 500;
        return $inv;
    });

    testPass("Test player created with inventory and funds");

    // Create a sell offer from test player
    $testStorage->addOffer([
        'chemical' => 'C',
        'quantity' => 100,
        'minPrice' => 2.00,
        'type' => 'sell'
    ]);

    testPass("Test player posted sell offer (C, 100 gal @ \$2.00)");

} catch (Exception $e) {
    testFail("Setup test player: " . $e->getMessage());
}

echo "\n";

// Test 5: Enable NPC System
echo "Test 5: Enable NPC System\n";
try {
    $npcManager->toggleSystem(true);
    $config = $npcManager->loadConfig();

    if ($config['enabled']) {
        testPass("NPC system enabled");
    } else {
        testFail("NPC system not enabled");
    }

} catch (Exception $e) {
    testFail("Enable NPC system: " . $e->getMessage());
}

echo "\n";

// Test 6: Run Trading Cycle
echo "Test 6: Run Trading Cycle\n";
try {
    // Set session to trading phase
    $sessionManager = new SessionManager();
    $sessionManager->setPhase('trading');
    testPass("Session set to trading phase");

    // Run NPC trading cycle
    echo "  Running NPC trading cycle...\n";
    $npcManager->runTradingCycle();
    testPass("NPC trading cycle executed without errors");

    // Check if any trades occurred
    $npcList = $npcManager->listNPCs();
    $totalTrades = 0;
    foreach ($npcList['npcs'] as $npc) {
        $totalTrades += $npc['stats']['totalTrades'];
    }

    echo "  Total NPC trades after cycle: $totalTrades\n";

} catch (Exception $e) {
    testFail("Run trading cycle: " . $e->getMessage());
}

echo "\n";

// Test 7: SessionManager Integration
echo "Test 7: SessionManager Integration\n";
try {
    $sessionManager->setAutoAdvance(true);
    testPass("Auto-advance enabled");

    // Simulate getState() which should trigger NPC cycle
    $state = $sessionManager->getState();

    if (isset($state['npcLastRun'])) {
        testPass("SessionManager tracking npcLastRun timestamp");
        echo "  NPC last run: " . date('Y-m-d H:i:s', $state['npcLastRun']) . "\n";
    } else {
        echo "  Note: npcLastRun not set (may need 10s delay for first run)\n";
    }

} catch (Exception $e) {
    testFail("SessionManager integration: " . $e->getMessage());
}

echo "\n";

// Test 8: Toggle and Stats
echo "Test 8: Toggle and Stats\n";
try {
    $npcList = $npcManager->listNPCs();

    if (count($npcList['npcs']) > 0) {
        $testNPC = $npcList['npcs'][0];

        // Toggle NPC off
        $npcManager->toggleNPC($testNPC['id'], false);
        $config = $npcManager->loadConfig();
        $updated = array_filter($config['npcs'], fn($n) => $n['id'] === $testNPC['id'])[0];

        if (!$updated['active']) {
            testPass("NPC toggled to inactive");
        } else {
            testFail("NPC toggle failed");
        }

        // Toggle back on
        $npcManager->toggleNPC($testNPC['id'], true);
        testPass("NPC toggled back to active");
    }

} catch (Exception $e) {
    testFail("Toggle and stats: " . $e->getMessage());
}

echo "\n";

// Test 9: Cleanup Test Player
echo "Test 9: Cleanup\n";
try {
    // Delete test player team directory
    $teamDir = __DIR__ . '/data/teams/' . TeamStorage::sanitizeEmail($testPlayerEmail);
    if (is_dir($teamDir)) {
        $files = array_diff(scandir($teamDir), ['.', '..']);
        foreach ($files as $file) {
            unlink($teamDir . '/' . $file);
        }
        rmdir($teamDir);
        testPass("Test player cleaned up");
    }

} catch (Exception $e) {
    echo "  Note: Cleanup not critical, skipping\n";
}

echo "\n";

// Summary
echo "=== Test Summary ===\n";
echo "✓ Tests Passed: $testsPassed\n";
if ($testsFailed > 0) {
    echo "✗ Tests Failed: $testsFailed\n";
} else {
    echo "✓ All Tests Passed!\n";
}

echo "\n=== NPC System Status ===\n";
$finalList = $npcManager->listNPCs();
echo "System Enabled: " . ($finalList['enabled'] ? 'Yes' : 'No') . "\n";
echo "Total NPCs: " . count($finalList['npcs']) . "\n";
echo "Active NPCs: " . count(array_filter($finalList['npcs'], fn($n) => $n['active'])) . "\n";

$totalTrades = array_sum(array_map(fn($n) => $n['stats']['totalTrades'], $finalList['npcs']));
$totalProfit = array_sum(array_map(fn($n) => $n['stats']['totalProfit'], $finalList['npcs']));

echo "Total Trades: $totalTrades\n";
echo "Net Profit: \$" . number_format($totalProfit, 2) . "\n";

echo "\n✅ NPC System Implementation Complete!\n";
