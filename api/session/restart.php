<?php
/**
 * Public Restart Game API
 * POST: Restarts the game with existing NPC count
 * ONLY allowed if the game is already finished
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

    // Safety: Only allow non-admins to restart if game is actually finished
    // or if the user IS an admin.
    require_once __DIR__ . '/../../userData.php';
    $isGameFinished = $state['gameFinished'] ?? false;
    
    if (!$isGameFinished && !isAdmin()) {
        http_response_code(403);
        echo json_encode(['error' => 'Game is still in progress. Only admins can restart early.']);
        exit;
    }

    $newState = $sessionManager->restartGame();

    echo json_encode([
        'success' => true,
        'message' => 'Game restarted successfully!',
        'session' => $newState
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
