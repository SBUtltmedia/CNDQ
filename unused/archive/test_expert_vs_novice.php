<?php
/**
 * Test Expert vs Novice NPCs Only
 *
 * Removes Beginner NPC to see if Expert trades more actively
 */

require_once __DIR__ . '/lib/NPCManager.php';
require_once __DIR__ . '/lib/SessionManager.php';

echo "🎮 Expert vs Novice NPC Test\n";
echo str_repeat('=', 70) . "\n\n";

$npcManager = new NPCManager();
$sessionManager = new SessionManager();

// Step 1: List current NPCs
echo "📋 Step 1: Current NPCs\n";
$npcList = $npcManager->listNPCs();
foreach ($npcList['npcs'] as $npc) {
    echo "   - {$npc['teamName']} ({$npc['skillLevel']}): " . ($npc['active'] ? 'ACTIVE' : 'INACTIVE') . "\n";
}
echo "\n";

// Step 2: Disable Beginner NPCs
echo "📋 Step 2: Disabling Beginner NPCs\n";
foreach ($npcList['npcs'] as $npc) {
    if ($npc['skillLevel'] === 'beginner') {
        $npcManager->toggleNPC($npc['id'], false);
        echo "   ✓ Disabled: {$npc['teamName']}\n";
    }
}
echo "\n";

// Step 3: Verify only Novice and Expert are active
echo "📋 Step 3: Active NPCs (after disabling beginners)\n";
$npcList = $npcManager->listNPCs();
$activeCount = 0;
foreach ($npcList['npcs'] as $npc) {
    if ($npc['active']) {
        echo "   - {$npc['teamName']} ({$npc['skillLevel']}): \${$npc['currentFunds']}, {$npc['stats']['totalTrades']} trades\n";
        $activeCount++;
    }
}
echo "   Total Active: $activeCount\n\n";

// Step 4: Enable auto-advance
echo "📋 Step 4: Enable Auto-Advance\n";
$sessionManager->setAutoAdvance(true);
$sessionManager->setTradingDuration(30);
$sessionManager->setProductionDuration(3);
echo "   ✓ Auto-advance enabled (30s trading, 3s production)\n\n";

// Step 5: Run 5 sessions
echo "📋 Step 5: Running 5 Sessions (Expert vs Novice only)\n";
echo str_repeat('─', 70) . "\n\n";

$startSession = $sessionManager->getState()['currentSession'];
$targetSession = $startSession + 5;

// Record initial stats
$initialStats = [];
foreach ($npcList['npcs'] as $npc) {
    if ($npc['active']) {
        $initialStats[$npc['id']] = [
            'trades' => $npc['stats']['totalTrades'] ?? 0,
            'profit' => $npc['stats']['totalProfit'] ?? 0
        ];
    }
}

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
            echo "   ⚙️  Auto-production running...\n";
        } else {
            echo "   💰 Trading phase active...\n";
        }

        $lastPhase = $phase;
        $lastSession = $currentSession;
    }

    if ($phase === 'trading' && $timeRemaining > 0 && $timeRemaining % 10 === 0) {
        echo "   ⏱  {$timeRemaining}s remaining...\n";

        $npcList = $npcManager->listNPCs();
        foreach ($npcList['npcs'] as $npc) {
            if ($npc['active']) {
                $newTrades = $npc['stats']['totalTrades'] - ($initialStats[$npc['id']]['trades'] ?? 0);
                echo "   🤖 {$npc['teamName']} ({$npc['skillLevel']}): $newTrades new trades\n";
            }
        }
    }

    sleep(1);

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
echo "📊 Final NPC Statistics (Trades This Test):\n";
echo str_repeat('─', 70) . "\n";

$npcList = $npcManager->listNPCs();
foreach ($npcList['npcs'] as $npc) {
    if ($npc['active']) {
        $tradesThisTest = $npc['stats']['totalTrades'] - ($initialStats[$npc['id']]['trades'] ?? 0);
        $profitThisTest = $npc['stats']['totalProfit'] - ($initialStats[$npc['id']]['profit'] ?? 0);

        echo "\n{$npc['teamName']} (" . strtoupper($npc['skillLevel']) . "):\n";
        echo "├─ New Trades: $tradesThisTest\n";
        echo "├─ New Profit: \$" . number_format($profitThisTest, 2) . "\n";
        echo "├─ Total Trades: {$npc['stats']['totalTrades']}\n";
        echo "├─ Total Profit: \$" . number_format($npc['stats']['totalProfit'], 2) . "\n";
        echo "└─ Current Funds: \$" . number_format($npc['currentFunds'], 2) . "\n";
    }
}

// Re-enable Beginner NPCs
echo "\n" . str_repeat('─', 70) . "\n";
echo "📋 Re-enabling Beginner NPCs for future tests...\n";
$npcList = $npcManager->listNPCs();
foreach ($npcList['npcs'] as $npc) {
    if ($npc['skillLevel'] === 'beginner') {
        $npcManager->toggleNPC($npc['id'], true);
        echo "   ✓ Re-enabled: {$npc['teamName']}\n";
    }
}

echo "\n✅ Test Complete!\n\n";
