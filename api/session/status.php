<?php
/**
 * Public Session Status API
 */

require_once __DIR__ . '/../../lib/SessionManager.php';
require_once __DIR__ . '/../../lib/MarketplaceAggregator.php';
header('Content-Type: application/json');

ob_start();

$responseData = null;

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $sessionManager = new SessionManager();

    // Trigger the consolidated world rotation
    $sessionManager->rotateWorld();

    // Get current state
    $state = $sessionManager->getState();

    // Get recent trades for global notifications
    $aggregator = new MarketplaceAggregator();
    $cached = $aggregator->getCachedMarketplaceData(5);
    $recentTrades = $cached['recentTrades'] ?? [];
    
    // If cache is stale/missing, get live
    if (empty($recentTrades)) {
        $allMarket = $aggregator->getAggregatedFromEvents();
        $recentTrades = $allMarket['recentTrades'] ?? [];
    }

    $responseData = [
        'success' => true,
        'session' => $state['currentSession'] ?? 1,
        'phase' => $state['phase'] ?? 'trading',
        'timeRemaining' => $state['timeRemaining'] ?? 0,
        'autoAdvance' => $state['autoAdvance'] ?? false,
        'productionJustRan' => $state['productionJustRan'] ?? null,
        'gameStopped' => $state['gameStopped'] ?? true,
        'gameFinished' => $state['gameFinished'] ?? false,
        'recentTrades' => $recentTrades
    ];

} catch (\Throwable $e) {
    http_response_code(500);
    $responseData = [
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ];
}

$unexpectedOutput = ob_get_clean();
if (!empty($unexpectedOutput) && trim($unexpectedOutput) !== '') {
    error_log("Unexpected output in api/session/status.php: " . $unexpectedOutput);
}

echo json_encode($responseData);
