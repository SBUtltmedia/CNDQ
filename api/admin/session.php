<?php
/**
 * Admin Session Control API
 *
 * GET: Get current session state
 * POST: Update session (advance, set phase, toggle auto-advance)
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../../userData.php';
require_once __DIR__ . '/../../lib/SessionManager.php';

$sessionManager = new SessionManager();

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        // Get current session state (public - triggers auto-advance if enabled)
        $state = $sessionManager->getState();

        echo json_encode([
            'success' => true,
            'session' => $state
        ]);

    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // ADMIN ONLY for modifications
        if (!isAdmin()) {
            http_response_code(403);
            echo json_encode(['error' => 'Admin privileges required']);
            exit;
        }
        $input = json_decode(file_get_contents('php://input'), true);
        $action = $input['action'] ?? null;

        switch ($action) {
            case 'advance':
                // Advance to next session (runs production and increments session)
                $state = $sessionManager->advanceSession();
                echo json_encode([
                    'success' => true,
                    'message' => 'Advanced to session ' . $state['currentSession'],
                    'session' => $state
                ]);
                break;

            case 'setPhase':
                // Set phase directly
                $phase = $input['phase'] ?? null;
                if (!$phase) {
                    throw new Exception('Phase required');
                }
                $state = $sessionManager->setPhase($phase);
                echo json_encode([
                    'success' => true,
                    'message' => 'Phase set to ' . $phase,
                    'session' => $state
                ]);
                break;

            case 'setAutoAdvance':
                // Toggle auto-advance
                $enabled = $input['enabled'] ?? false;
                $state = $sessionManager->setAutoAdvance($enabled);
                echo json_encode([
                    'success' => true,
                    'message' => 'Auto-advance ' . ($enabled ? 'enabled' : 'disabled'),
                    'session' => $state
                ]);
                break;

            case 'setProductionDuration':
                // Set production duration
                $seconds = $input['seconds'] ?? 60;
                $state = $sessionManager->setProductionDuration($seconds);
                echo json_encode([
                    'success' => true,
                    'message' => 'Production duration set to ' . $seconds . ' seconds',
                    'session' => $state
                ]);
                break;

            case 'setTradingDuration':
                // Set trading duration
                $seconds = $input['seconds'] ?? 600;
                $state = $sessionManager->setTradingDuration($seconds);
                echo json_encode([
                    'success' => true,
                    'message' => 'Trading duration set to ' . $seconds . ' seconds',
                    'session' => $state
                ]);
                break;

            case 'reset':
                // Reset to session 1
                $state = $sessionManager->reset();
                echo json_encode([
                    'success' => true,
                    'message' => 'Session reset to 1',
                    'session' => $state
                ]);
                break;

            default:
                throw new Exception('Invalid action');
        }

    } else {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Server error',
        'message' => $e->getMessage()
    ]);
}
