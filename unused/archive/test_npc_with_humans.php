<?php
/**
 * NPC Test with Simulated Human Activity
 *
 * Resets game to Session 1 and simulates active student trading
 */

require_once __DIR__ . '/lib/NPCManager.php';
require_once __DIR__ . '/lib/SessionManager.php';
require_once __DIR__ . '/lib/TeamStorage.php';
require_once __DIR__ . '/lib/TradeExecutor.php';

echo "🎮 CNDQ NPC Test with Simulated Human Trading\n";
echo str_repeat('=', 70) . "\n\n";

// Step 1: Reset game state to Session 1
echo "📋 Step 1: Resetting Game State\n";
$sessionManager = new SessionManager();
$sessionFile = __DIR__ . '/data/session_state.json';

$freshState = [
    'currentSession' => 1,
    'phase' => 'trading',
    'phaseStartedAt' => time(),
    'tradingDuration' => 30,
    'productionDuration' => 3,
    'autoAdvance' => true,
    'npcLastRun' => 0
];

file_put_contents($sessionFile, json_encode($freshState, JSON_PRETTY_PRINT));
echo "   ✓ Reset to Session 1\n\n";

// Step 2: Create/Reset Human Player Teams
echo "📋 Step 2: Creating Simulated Human Players\n";

$humanPlayers = [
    'student1@university.edu' => 'Market Maven',
    'student2@university.edu' => 'Trade Titan',
    'student3@university.edu' => 'Deal Seeker',
    'student4@university.edu' => 'Price Hunter',
    'student5@university.edu' => 'Chemical Czar'
];

foreach ($humanPlayers as $email => $teamName) {
    $storage = new TeamStorage($email);

    // Reset profile with starting funds
    $storage->updateProfile(function($profile) use ($teamName) {
        $profile['teamName'] = $teamName;
        $profile['startingFunds'] = 10000;
        $profile['currentFunds'] = 10000;
        $profile['createdAt'] = time();
        $profile['lastActive'] = time();
        return $profile;
    });

    // Set starting inventory
    $storage->updateInventory(function($inv) {
        return ['C' => 500, 'N' => 500, 'D' => 500, 'Q' => 500];
    });

    echo "   ✓ Created: $teamName ($email)\n";
}
echo "\n";

// Step 3: Post Initial Market Offers (simulate students posting offers)
echo "📋 Step 3: Simulating Student Market Activity\n";

function postRandomOffers($email, $teamName) {
    $storage = new TeamStorage($email);

    // Randomly post sell offers
    $chemicals = ['C', 'N', 'D', 'Q'];
    $numOffers = rand(1, 2);

    for ($i = 0; $i < $numOffers; $i++) {
        $chemical = $chemicals[array_rand($chemicals)];
        $quantity = rand(100, 300);
        $minPrice = rand(20, 60) / 10; // $2.00 - $6.00

        $storage->addOffer([
            'chemical' => $chemical,
            'quantity' => $quantity,
            'minPrice' => $minPrice,
            'type' => 'sell'
        ]);

        echo "   📤 $teamName posted SELL: {$quantity} gal $chemical at \$" . number_format($minPrice, 2) . "/gal min\n";
    }

    // Randomly post buy orders
    $numBuyOrders = rand(1, 2);

    for ($i = 0; $i < $numBuyOrders; $i++) {
        $chemical = $chemicals[array_rand($chemicals)];
        $quantity = rand(100, 300);
        $maxPrice = rand(25, 70) / 10; // $2.50 - $7.00

        $storage->addBuyOrder([
            'chemical' => $chemical,
            'quantity' => $quantity,
            'maxPrice' => $maxPrice,
            'sessionNumber' => 1
        ]);

        echo "   📥 $teamName posted BUY: {$quantity} gal $chemical at \$" . number_format($maxPrice, 2) . "/gal max\n";
    }
}

// Post offers for each human player
foreach ($humanPlayers as $email => $teamName) {
    postRandomOffers($email, $teamName);
}
echo "\n";

// Step 4: Enable NPC System
echo "📋 Step 4: Enabling NPC System\n";
$npcManager = new NPCManager();
$npcManager->toggleSystem(true);

// Ensure all NPCs are active
$npcList = $npcManager->listNPCs();
foreach ($npcList['npcs'] as $npc) {
    $npcManager->toggleNPC($npc['id'], true);
    echo "   ✓ Enabled: {$npc['teamName']} ({$npc['skillLevel']})\n";
}
echo "\n";

// Step 5: Run 5 Sessions with Active Trading
echo "📋 Step 5: Running 5 Sessions with Human + NPC Trading\n";
echo str_repeat('─', 70) . "\n\n";

$targetSession = 6; // Run through sessions 1-5

// Track initial NPC stats
$initialNPCStats = [];
foreach ($npcList['npcs'] as $npc) {
    $initialNPCStats[$npc['id']] = [
        'trades' => $npc['stats']['totalTrades'] ?? 0,
        'profit' => $npc['stats']['totalProfit'] ?? 0
    ];
}

$sessionTradeCount = [];

while (true) {
    $state = $sessionManager->getState();
    $currentSession = $state['currentSession'];

    if ($currentSession >= $targetSession) {
        break;
    }

    $phase = $state['phase'];
    $timeRemaining = $state['timeRemaining'];

    static $lastPhase = null;
    static $lastSession = null;

    if ($currentSession !== $lastSession || $phase !== $lastPhase) {
        echo "\n🎯 Session $currentSession - " . strtoupper($phase) . " Phase\n";
        echo str_repeat('─', 70) . "\n";

        if ($phase === 'production') {
            echo "   ⚙️  Production phase...\n";

            // Simulate human production
            foreach ($humanPlayers as $email => $teamName) {
                $storage = new TeamStorage($email);
                $storage->updateInventory(function($inv) {
                    // Simple production: add 50 of each chemical
                    $inv['C'] = ($inv['C'] ?? 0) + 50;
                    $inv['N'] = ($inv['N'] ?? 0) + 50;
                    $inv['D'] = ($inv['D'] ?? 0) + 50;
                    $inv['Q'] = ($inv['Q'] ?? 0) + 50;
                    return $inv;
                });
            }
        } else {
            echo "   💰 Trading phase - NPCs and humans trading...\n";

            // Humans post new offers each trading phase
            if ($timeRemaining === 30) {
                echo "   📢 Students posting new offers...\n";
                foreach ($humanPlayers as $email => $teamName) {
                    // 50% chance to post new offer
                    if (rand(0, 1) === 1) {
                        postRandomOffers($email, $teamName);
                    }
                }
            }
        }

        $lastPhase = $phase;
        $lastSession = $currentSession;
    }

    // Show NPC activity every 10 seconds during trading
    if ($phase === 'trading' && $timeRemaining > 0 && $timeRemaining % 10 === 0) {
        echo "   ⏱  {$timeRemaining}s remaining...\n";

        $npcList = $npcManager->listNPCs();
        foreach ($npcList['npcs'] as $npc) {
            $newTrades = $npc['stats']['totalTrades'] - ($initialNPCStats[$npc['id']]['trades'] ?? 0);
            if ($newTrades > 0) {
                echo "   🤖 {$npc['teamName']} ({$npc['skillLevel']}): {$newTrades} trades total\n";
            }
        }
    }

    sleep(1);

    // Safety timeout (5 minutes)
    static $startTime = null;
    if ($startTime === null) $startTime = time();
    if (time() - $startTime > 300) {
        echo "\n⚠️  Test timeout (5 minutes exceeded)\n";
        break;
    }
}

echo "\n" . str_repeat('=', 70) . "\n";
echo "🏁 5 Sessions Complete!\n";
echo str_repeat('=', 70) . "\n\n";

// Final Statistics
echo "📊 Final NPC Statistics:\n";
echo str_repeat('─', 70) . "\n";

$npcList = $npcManager->listNPCs();
$totalNPCTrades = 0;

foreach ($npcList['npcs'] as $npc) {
    $tradesThisTest = $npc['stats']['totalTrades'] - ($initialNPCStats[$npc['id']]['trades'] ?? 0);
    $profitThisTest = $npc['stats']['totalProfit'] - ($initialNPCStats[$npc['id']]['profit'] ?? 0);

    $totalNPCTrades += $tradesThisTest;

    echo "\n{$npc['teamName']} (" . strtoupper($npc['skillLevel']) . "):\n";
    echo "├─ Trades This Test: $tradesThisTest\n";
    echo "├─ Profit This Test: \$" . number_format($profitThisTest, 2) . "\n";
    echo "├─ Current Funds: \$" . number_format($npc['currentFunds'], 2) . "\n";
    echo "└─ Inventory: C=" . round($npc['inventory']['C'] ?? 0) .
         " N=" . round($npc['inventory']['N'] ?? 0) .
         " D=" . round($npc['inventory']['D'] ?? 0) .
         " Q=" . round($npc['inventory']['Q'] ?? 0) . "\n";
}

echo "\n" . str_repeat('─', 70) . "\n";
echo "📈 Summary:\n";
echo "   Total NPC Trades: $totalNPCTrades\n";
echo "   Avg Trades per NPC: " . number_format($totalNPCTrades / count($npcList['npcs']), 1) . "\n";

// Show human player stats
echo "\n" . str_repeat('─', 70) . "\n";
echo "📊 Human Player Final Stats:\n";
echo str_repeat('─', 70) . "\n";

foreach ($humanPlayers as $email => $teamName) {
    $storage = new TeamStorage($email);
    $profile = $storage->getProfile();
    $inventory = $storage->getInventory();

    echo "\n$teamName:\n";
    echo "├─ Funds: \$" . number_format($profile['currentFunds'], 2) .
         " (change: \$" . number_format($profile['currentFunds'] - 10000, 2) . ")\n";
    echo "└─ Inventory: C=" . round($inventory['C'] ?? 0) .
         " N=" . round($inventory['N'] ?? 0) .
         " D=" . round($inventory['D'] ?? 0) .
         " Q=" . round($inventory['Q'] ?? 0) . "\n";
}

echo "\n✅ Test Complete!\n\n";
echo "💡 This test simulated a real classroom environment with:\n";
echo "   - 5 human student teams posting offers and buy orders\n";
echo "   - 3 NPCs (Beginner, Novice, Expert) trading automatically\n";
echo "   - 5 complete sessions from fresh start\n\n";
