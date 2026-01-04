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

    // Handle POST requests to acknowledge production results
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        if (isset($input['acknowledgeProduction']) && $input['acknowledgeProduction'] === true) {
            // Clear the productionJustRan flag
            require_once __DIR__ . '/../../lib/SystemStorage.php';
            $storage = new SystemStorage();
            $storage->setSessionData(['productionJustRan' => null]);

            echo json_encode(['success' => true, 'message' => 'Production acknowledged']);
            exit;
        }
    }

    $state = $sessionManager->getState();

    // Auto-advance if time expired and auto-advance is enabled
    if (($state['autoAdvance'] ?? false) && ($state['timeRemaining'] ?? 0) <= 0) {
        $state = $sessionManager->advanceSession();
    }

    echo json_encode([
        'success' => true,
        'session' => $state['currentSession'],
        'phase' => $state['phase'],
        'timeRemaining' => $state['timeRemaining'] ?? 0,
        'autoAdvance' => $state['autoAdvance'] ?? false,
        'productionJustRan' => $state['productionJustRan'] ?? null
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
