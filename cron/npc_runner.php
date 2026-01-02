#!/usr/bin/env php
<?php
/**
 * NPC Runner Cron Job
 *
 * Run this every minute via cron to keep NPCs active even when no one is online:
 * * * * * * /usr/bin/php /path/to/CNDQ/cron/npc_runner.php >> /path/to/logs/npc.log 2>&1
 */

require_once __DIR__ . '/../lib/SessionManager.php';

echo "[" . date('Y-m-d H:i:s') . "] Running NPC cycle...\n";

try {
    $sessionManager = new SessionManager();
    require_once __DIR__ . '/../lib/NPCManager.php';
    $npcManager = new NPCManager();

    if (!$npcManager->isEnabled()) {
        echo "  ⚠ Skipped: NPC System Disabled\n";
        exit;
    }

    // Run 5 cycles (every 10 seconds) to fill a 1-minute cron window
    // This ensures NPCs are active without needing high-frequency cron
    require_once __DIR__ . '/../lib/NoM/GlobalAggregator.php';
    $globalAggregator = new NoM\GlobalAggregator();

    for ($i = 0; $i < 6; $i++) {
        $state = $sessionManager->getState();
        echo "[" . date('H:i:s') . "] Cycle " . ($i+1) . " - Phase: {$state['phase']}\n";

        // 1. Process trade reflections (System Aggregator role)
        $reflections = $globalAggregator->processReflections();
        if ($reflections > 0) {
            echo "  ✓ Processed $reflections pending trade reflections\n";
        }

        // 2. Run NPC Trading Cycle
        if ($state['phase'] === 'trading') {
            echo "  ✓ Running NPC Trading Cycle...\n";
            $npcManager->runTradingCycle();
            
            // Update last run timestamp in session state
            $sessionManager->updateNpcLastRun();
        } else {
            echo "  ⚠ Skipped: Not in trading phase\n";
        }

        if ($i < 5) sleep(10);
    }

} catch (Exception $e) {
    echo "  ERROR: " . $e->getMessage() . "\n";
}

echo "\n";
