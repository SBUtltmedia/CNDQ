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
    
    // Debug NPC trigger logic explicitly
    $sessionFile = __DIR__ . '/../data/session_state.json';
    $data = json_decode(file_get_contents($sessionFile), true);
    $npcLastRun = $data['npcLastRun'] ?? 0;
    $timeSince = time() - $npcLastRun;
    
    echo "  NPC Last Run: $npcLastRun (Ago: {$timeSince}s)\n";
    
    if ($state['phase'] === 'trading') {
        if ($timeSince < 10) {
            echo "  ⚠ Skipped: Recently run ($timeSince < 10s)\n";
        } else {
             // It should have run in getState(). If timeSince is still large, it failed to update timestamp
             // or getState didn't trigger it (e.g. NPCManager disabled)
             require_once __DIR__ . '/../lib/NPCManager.php';
             $mgr = new NPCManager();
             if (!$mgr->isEnabled()) {
                 echo "  ⚠ Skipped: NPC System Disabled\n";
             } else {
                 echo "  ✓ Cycle attempted (Timestamp should have updated)\n";
             }
        }
    }

} catch (Exception $e) {
    echo "  ERROR: " . $e->getMessage() . "\n";
}

echo "\n";
