<?php
/**
 * List Advertisements API
 * GET: Get all active advertisements grouped by chemical
 */

require_once __DIR__ . '/../../lib/ListingManager.php';
require_once __DIR__ . '/../../userData.php';

header('Content-Type: application/json');

$currentUserEmail = getCurrentUserEmail();

if (!$currentUserEmail) {
    http_response_code(401);
    echo json_encode(['error' => 'Not authenticated']);
    exit;
}

try {
    $listings = ListingManager::getListingsByChemical();

    // Include user's own ads so they can see their buy/sell requests
    // The frontend will mark them with isMyAd flag for special display

    echo json_encode([
        'success' => true,
        'listings' => $listings
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Server error',
        'message' => $e->getMessage()
    ]);
}
