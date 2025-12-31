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
    $state = $sessionManager->getState(); // This triggers NPCs if conditions are met

    echo "  Phase: {$state['phase']}\n";
    echo "  Auto-advance: " . ($state['autoAdvance'] ? 'ON' : 'OFF') . "\n";
    echo "  Time remaining: {$state['timeRemaining']}s\n";

    if ($state['phase'] === 'trading' && $state['autoAdvance']) {
        echo "  ✓ NPCs should be trading\n";
    } else {
        echo "  - NPCs not active (wrong phase or auto-advance off)\n";
    }

} catch (Exception $e) {
    echo "  ERROR: " . $e->getMessage() . "\n";
}

echo "\n";
