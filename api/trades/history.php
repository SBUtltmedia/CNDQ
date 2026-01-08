<?php
/**
 * Transaction History API
 * GET: Returns list of all transactions for the current team
 */

require_once __DIR__ . '/../../lib/TeamStorage.php';
require_once __DIR__ . '/../../userData.php';

header('Content-Type: application/json');

$currentUserEmail = getCurrentUserEmail();

if (!$currentUserEmail || trim($currentUserEmail) === '') {
    http_response_code(401);
    echo json_encode(['error' => 'Not authenticated']);
    exit;
}

try {
    $storage = new TeamStorage($currentUserEmail);
    $history = $storage->getTransactions(); // returns ['transactions' => [...]]

    echo json_encode([
        'success' => true,
        'transactions' => $history['transactions'] ?? []
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Server error',
        'message' => $e->getMessage()
    ]);
}
