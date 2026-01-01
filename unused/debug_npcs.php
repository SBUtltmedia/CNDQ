#!/usr/bin/env php
<?php
/**
 * Debug NPC System
 */

require_once __DIR__ . '/lib/SessionManager.php';
require_once __DIR__ . '/lib/NPCManager.php';

echo "=== NPC System Debug ===\n\n";

// 1. Check session state
$sessionManager = new SessionManager();
$state = $sessionManager->getState();

echo "1. Session State:\n";
echo "   Phase: {$state['phase']}\n";
echo "   Session: {$state['currentSession']}\n";
echo "   Auto-advance: " . ($state['autoAdvance'] ? 'ON' : 'OFF') . "\n";
echo "   Time remaining: {$state['timeRemaining']}s\n";
echo "   NPC last run: " . ($state['npcLastRun'] ?? 'never') . "\n";
$timeSinceNPC = isset($state['npcLastRun']) ? (time() - $state['npcLastRun']) : 999;
echo "   Time since NPC run: {$timeSinceNPC}s\n\n";

// 2. Check NPC config
$npcManager = new NPCManager();
echo "2. NPC System:\n";
echo "   Enabled: " . ($npcManager->isEnabled() ? 'YES' : 'NO') . "\n";

$result = $npcManager->listNPCs();
$npcs = $result['npcs'];
echo "   Total NPCs: " . count($npcs) . "\n";
$activeCount = count(array_filter($npcs, fn($n) => $n['active']));
echo "   Active NPCs: {$activeCount}\n\n";

// 3. List NPCs
if (!empty($npcs)) {
    echo "3. NPC Details:\n";
    foreach ($npcs as $npc) {
        echo "   - {$npc['teamName']} ({$npc['skillLevel']})\n";
        echo "     Email: {$npc['email']}\n";
        echo "     Active: " . ($npc['active'] ? 'YES' : 'NO') . "\n";
        echo "     Funds: $" . ($npc['currentFunds'] ?? 0) . "\n";
        echo "     Inventory: C=" . ($npc['inventory']['C'] ?? 0) .
             " N=" . ($npc['inventory']['N'] ?? 0) .
             " D=" . ($npc['inventory']['D'] ?? 0) .
             " Q=" . ($npc['inventory']['Q'] ?? 0) . "\n";
        echo "     Trades: " . ($npc['stats']['totalTrades'] ?? 0) . "\n\n";
    }
}

// 4. Check marketplace ads
$adsFile = __DIR__ . '/data/marketplace/active_offers.json';
if (file_exists($adsFile)) {
    $adsData = json_decode(file_get_contents($adsFile), true);
    $ads = $adsData['ads'] ?? [];
    echo "4. Active Marketplace Ads: " . count($ads) . "\n";
    foreach ($ads as $ad) {
        echo "   - {$ad['teamName']}: {$ad['type']} {$ad['chemical']}\n";
    }
} else {
    echo "4. No marketplace ads file\n";
}
echo "\n";

// 5. Try to manually run NPC cycle
echo "5. Manually Running NPC Cycle:\n";
if ($state['phase'] !== 'trading') {
    echo "   ⚠️  Cannot run - phase is '{$state['phase']}' (must be 'trading')\n";
} elseif (!$npcManager->isEnabled()) {
    echo "   ⚠️  Cannot run - NPC system is disabled\n";
} elseif ($activeCount === 0) {
    echo "   ⚠️  Cannot run - no active NPCs\n";
} else {
    echo "   ✓ Attempting to run trading cycle...\n";
    try {
        $npcManager->runTradingCycle($state['currentSession']);
        echo "   ✓ Trading cycle completed!\n";

        // Check if ads were created
        if (file_exists($adsFile)) {
            $newAdsData = json_decode(file_get_contents($adsFile), true);
            $newAds = $newAdsData['ads'] ?? [];
            echo "   ✓ Total ads after run: " . count($newAds) . "\n";
        }
    } catch (Exception $e) {
        echo "   ❌ Error: " . $e->getMessage() . "\n";
        echo "   Stack trace:\n";
        echo $e->getTraceAsString() . "\n";
    }
}

echo "\n=== End Debug ===\n";
