<?php
/**
 * List Advertisements API
 * GET: Get all active advertisements grouped by chemical
 */

require_once __DIR__ . '/../../lib/AdvertisementManager.php';
require_once __DIR__ . '/../../userData.php';

header('Content-Type: application/json');

$currentUserEmail = getCurrentUserEmail();

if (!$currentUserEmail) {
    http_response_code(401);
    echo json_encode(['error' => 'Not authenticated']);
    exit;
}

try {
    $advertisements = AdvertisementManager::getAdvertisementsByChemical();

    // Filter out current user's own ads from the response (they'll see their own separately)
    foreach ($advertisements as $chemical => &$types) {
        foreach ($types as $type => &$ads) {
            $ads = array_values(array_filter($ads, function($ad) use ($currentUserEmail) {
                return $ad['teamId'] !== $currentUserEmail;
            }));
        }
    }

    echo json_encode([
        'success' => true,
        'advertisements' => $advertisements
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Server error',
        'message' => $e->getMessage()
    ]);
}
