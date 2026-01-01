<?php
/**
 * List Negotiations API
 * GET: Get current user's active negotiations
 */

require_once __DIR__ . '/../../lib/NegotiationManager.php';
require_once __DIR__ . '/../../userData.php';

header('Content-Type: application/json');

$currentUserEmail = getCurrentUserEmail();

if (!$currentUserEmail) {
    http_response_code(401);
    echo json_encode(['error' => 'Not authenticated']);
    exit;
}

try {
    $negotiationManager = new NegotiationManager();
    $negotiations = $negotiationManager->getTeamNegotiations($currentUserEmail);

    echo json_encode([
        'success' => true,
        'negotiations' => $negotiations
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Server error',
        'message' => $e->getMessage()
    ]);
}
