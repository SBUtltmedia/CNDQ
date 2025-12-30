<?php
/**
 * NPC 5-Session Test via PHP
 *
 * Simulates 5 complete sessions with NPCs trading automatically
 * This bypasses browser/puppeteer issues
 */

require_once __DIR__ . '/lib/NPCManager.php';
require_once __DIR__ . '/lib/SessionManager.php';
require_once __DIR__ . '/lib/TeamStorage.php';

echo "🎮 CNDQ 5-Session NPC Test\n";
echo str_repeat('=', 70) . "\n\n";

// Initialize
$npcManager = new NPCManager();
$sessionManager = new SessionManager();

// Enable NPC system
echo "📋 Step 1: Enable NPC System\n";
$npcManager->toggleSystem(true);
echo "   ✓ NPC system enabled\n\n";

// Check initial NPC status
echo "📋 Step 2: Initial NPC Status\n";
$npcList = $npcManager->listNPCs();
echo "   Total NPCs: " . count($npcList['npcs']) . "\n";
foreach ($npcList['npcs'] as $npc) {
    $funds = number_format($npc['currentFunds'] ?? 0, 2);
    $trades = $npc['stats']['totalTrades'] ?? 0;
    echo "   - {$npc['teamName']} ({$npc['skillLevel']}): \${$funds}, {$trades} trades\n";
}
echo "\n";

// Enable auto-advance
echo "📋 Step 3: Enable Auto-Advance\n";
$sessionManager->setAutoAdvance(true);
$sessionManager->setTradingDuration(30); // 30 seconds for faster testing
$sessionManager->setProductionDuration(3); // 3 seconds
echo "   ✓ Auto-advance enabled (30s trading, 3s production)\n\n";

// Run 5 sessions
echo "📋 Step 4: Running 5 Sessions\n";
echo str_repeat('─', 70) . "\n\n";

$startSession = $sessionManager->getState()['currentSession'];
$targetSession = $startSession + 5;

$sessionStats = [];

while (true) {
    $state = $sessionManager->getState();
    $currentSession = $state['currentSession'];

    // Stop after 5 sessions
    if ($currentSession >= $targetSession) {
        break;
    }

    $phase = $state['phase'];
    $timeRemaining = $state['timeRemaining'];

    // Print session header on phase change
    static $lastPhase = null;
    static $lastSession = null;

    if ($currentSession !== $lastSession || $phase !== $lastPhase) {
        echo "\n🎯 Session $currentSession - " . strtoupper($phase) . " Phase\n";
        echo str_repeat('─', 70) . "\n";

        if ($phase === 'production') {
            echo "   ⚙️  Auto-production running...\n";
        } else {
            echo "   💰 Trading phase active (NPCs trading every 10 seconds)...\n";
        }

        $lastPhase = $phase;
        $lastSession = $currentSession;
    }

    // Show countdown for trading phase
    if ($phase === 'trading' && $timeRemaining > 0 && $timeRemaining % 10 === 0) {
        echo "   ⏱  {$timeRemaining}s remaining...\n";

        // Check NPC activity every 10 seconds
        $npcList = $npcManager->listNPCs();
        $totalTrades = array_sum(array_map(fn($n) => $n['stats']['totalTrades'] ?? 0, $npcList['npcs']));
        echo "   🤖 Total NPC trades so far: $totalTrades\n";
    }

    // Record session stats at end of trading phase
    if ($phase === 'trading' && $timeRemaining === 0) {
        $npcList = $npcManager->listNPCs();
        $sessionStats[$currentSession] = [
            'totalTrades' => array_sum(array_map(fn($n) => $n['stats']['totalTrades'] ?? 0, $npcList['npcs'])),
            'totalProfit' => array_sum(array_map(fn($n) => $n['stats']['totalProfit'] ?? 0, $npcList['npcs']))
        ];
    }

    sleep(1);

    // Safety timeout (5 minutes max)
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

// Final NPC Statistics
echo "📊 Final NPC Statistics:\n";
echo str_repeat('─', 70) . "\n";

$npcList = $npcManager->listNPCs();
$totalTrades = 0;
$totalProfit = 0;

foreach ($npcList['npcs'] as $npc) {
    $trades = $npc['stats']['totalTrades'] ?? 0;
    $profit = $npc['stats']['totalProfit'] ?? 0;
    $funds = $npc['currentFunds'] ?? 0;

    $totalTrades += $trades;
    $totalProfit += $profit;

    echo "\n{$npc['teamName']} (" . strtoupper($npc['skillLevel']) . ")\n";
    echo "├─ Trades: $trades\n";
    echo "├─ Profit: \$" . number_format($profit, 2) . "\n";
    echo "├─ Funds: \$" . number_format($funds, 2) . "\n";
    echo "└─ Inventory: C=" . round($npc['inventory']['C'] ?? 0) .
         " N=" . round($npc['inventory']['N'] ?? 0) .
         " D=" . round($npc['inventory']['D'] ?? 0) .
         " Q=" . round($npc['inventory']['Q'] ?? 0) . "\n";
}

echo "\n" . str_repeat('─', 70) . "\n";
echo "📈 Aggregate Statistics:\n";
echo "   Total NPC Trades: $totalTrades\n";
echo "   Total NPC Profit: \$" . number_format($totalProfit, 2) . "\n";
echo "   Avg Trades per NPC: " . number_format($totalTrades / count($npcList['npcs']), 1) . "\n";
echo "   Avg Profit per NPC: \$" . number_format($totalProfit / count($npcList['npcs']), 2) . "\n";

echo "\n✅ Test Complete!\n";
echo "\n💡 You can view the results in the admin panel at:\n";
echo "   http://cndq.test/admin.html\n\n";
