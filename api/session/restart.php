<?php
/**
 * Public Restart Game API
 * POST: Restarts the game with existing NPC count
 * Allowed when: game is finished, game is stopped (market closed), or user is admin
 */

require_once __DIR__ . '/../../lib/SessionManager.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

try {
    $sessionManager = new SessionManager();
    $state = $sessionManager->getState();

    // Safety: Allow restart if game is finished OR if game is stopped (market closed)
    // This allows unattended operation where users can restart themselves
    require_once __DIR__ . '/../../userData.php';
    $isGameFinished = $state['gameFinished'] ?? false;
    $isGameStopped = $state['gameStopped'] ?? true;

    // Allow restart if: admin, game finished, OR game is stopped (market closed)
    if (!$isGameFinished && !$isGameStopped && !isAdmin()) {
        http_response_code(403);
        echo json_encode(['error' => 'Game is still in progress. Wait for market to close or contact admin.']);
        exit;
    }

    $sessionManager->restartGame();

    // Auto-start the game so users don't have to wait for admin
    $newState = $sessionManager->toggleGameStop(false);

    echo json_encode([
        'success' => true,
        'message' => 'Game restarted and started!',
        'session' => $newState
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
