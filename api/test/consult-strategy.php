<?php
/**
 * Consult Strategy Endpoint
 * 
 * "Strategy Oracle" for Automated UI Testing.
 * Allows a real player (test bot) to ask the Expert NPC logic:
 * "What would you do in my shoes?"
 * 
 * Usage:
 * GET /api/test/consult-strategy.php?skill=expert
 */

// Include common setup
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../userData.php';
require_once __DIR__ . '/../../lib/Database.php';
require_once __DIR__ . '/../../lib/TeamStorage.php';
require_once __DIR__ . '/../../lib/NPCManager.php';
require_once __DIR__ . '/../../lib/NPCStrategyFactory.php';

// Set header
header('Content-Type: application/json');

// 1. Authentication
$userEmail = getCurrentUserEmail();
if (!$userEmail || $userEmail === 'dev_user@localhost') {
    // In many local setups dev_user@localhost is the default, but for tests 
    // we want a specific user via mock_mail.
    if (!isset($_COOKIE['mock_mail'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Not authenticated via mock_mail']);
        exit;
    }
}
$skillLevel = $_GET['skill'] ?? 'expert';

try {
    // 2. Initialize Storage for Real User
    $storage = new TeamStorage($userEmail);
    $profile = $storage->getProfile();

    // 3. Synthesize "NPC Configuration" for this User
    // We trick the strategy into thinking this user is an NPC
    $npcConfig = [
        'id' => 'simulated_player',
        'email' => $userEmail,
        'teamName' => $profile['teamName'] ?? 'Simulated Player',
        'skillLevel' => $skillLevel,
        // Zero variability for deterministic testing results, 
        // or small amount to test robustness. Let's use 0 for the Oracle.
        'variability' => 0.0, 
        'tradeThresholds' => [
            'lowInventory' => 300,
            'excessInventory' => 1800
        ]
    ];

    // 4. Instantiate Manager and Strategy via Factory
    $npcManager = new NPCManager();
    $strategy = NPCStrategyFactory::createStrategy($storage, $npcConfig, $npcManager);

    // 5. Get Recommendations
    
    // A. Check for Negotiation Responses (Highest Priority)
    $negotiationAction = $strategy->respondToNegotiations();
    
    // B. Check for New Trade Decisions
    $tradeAction = null;
    if (!$negotiationAction) {
        $tradeAction = $strategy->decideTrade();
    }

    echo json_encode([
        'success' => true,
        'user' => $userEmail,
        'strategy' => get_class($strategy),
        'recommendation' => [
            'negotiation_action' => $negotiationAction,
            'trade_action' => $tradeAction
        ],
        'debug' => [
            'inventory' => $storage->getInventory(),
            'shadow_prices' => $storage->getShadowPrices()
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
}
