<?php
/**
 * Public Session Status API
 * GET: Returns current session number, phase, and time remaining.
 * Triggers auto-advance logic if enabled.
 */

require_once __DIR__ . '/../../lib/SessionManager.php';
header('Content-Type: application/json');

try {
    $sessionManager = new SessionManager();
    $state = $sessionManager->getState(); // This call triggers auto-advance logic

    echo json_encode([
        'success' => true,
        'session' => $state['currentSession'],
        'phase' => $state['phase'],
        'timeRemaining' => $state['timeRemaining'] ?? 0,
        'autoAdvance' => $state['autoAdvance'] ?? false
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
