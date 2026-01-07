<?php
/**
 * Trigger NPC Trading Cycle API
 * GET: Force all NPCs to run one trading cycle
 * ADMIN ONLY
 */

require_once __DIR__ . '/../../../lib/NPCManager.php';
require_once __DIR__ . '/../../../lib/SessionManager.php';
require_once __DIR__ . '/../../../userData.php';

header('Content-Type: application/json');

if (!isAdmin()) {
    http_response_code(403);
    echo json_encode(['error' => 'Admin privileges required']);
    exit;
}

try {
    $npcManager = new NPCManager();
    $sessionManager = new SessionManager();
    $state = $sessionManager->getState();

    if ($state['gameStopped'] ?? true) {
        echo json_encode([
            'success' => false,
            'message' => 'Game is stopped. NPCs will not trade.'
        ]);
        exit;
    }

    // Run the cycle
    $npcManager->runTradingCycle($state['currentSession']);
    
    // Update last run time to prevent immediate re-triggering by heartbeat
    $sessionManager->updateNpcLastRun();

    echo json_encode([
        'success' => true,
        'message' => 'NPC trading cycle triggered successfully',
        'session' => $state['currentSession']
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Server error',
        'message' => $e->getMessage()
    ]);
}
