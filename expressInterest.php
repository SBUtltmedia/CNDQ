<?php
require_once 'userData.php';
require_once 'fileHelpers.php';

header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
$offerId = $input['offer_id'] ?? '';
$buyerId = getCurrentUserEmail();

// We need to find the seller to update their offer file.
// Since offer ID doesn't explicitly contain seller ID in our generator (it's random),
// we might have a problem unless we encode seller in ID or search all.
// Hack: Let's assume the frontend passes the seller_id too, or we search.
// Better: update createOffer to encode seller in ID.
// Re-reading createOffer.php: $offerId = 'offer_' . uniqid() ...
// Let's Change createOffer.php to include seller info?
// OR: The frontend usually has the offer object which has seller_id.
// Let's ask the frontend to send seller_id.
// BUT: Existing frontend calls expressInterest(offerId).
// We should update frontend or scan. Scanning is fast enough for small number of users.

// Scan all user folders to find the offer
$dataDir = __DIR__ . '/data/users';
$found = false;
$sellerEmail = null;

$users = glob($dataDir . '/*', GLOB_ONLYDIR);
foreach ($users as $userDir) {
    // We can't easily guess email from safe folder name in all cases (e.g. special chars), 
    // but we can try reading the offers file.
    $offersFile = $userDir . '/offers.json';
    if (!file_exists($offersFile)) continue;
    
    $offers = json_decode(file_get_contents($offersFile), true) ?: [];
    foreach ($offers as $offer) {
        if ($offer['offer_id'] === $offerId) {
            $sellerEmail = $offer['seller_id'];
            $found = true;
            break 2;
        }
    }
}

if (!$found) {
    echo json_encode(['success' => false, 'message' => 'Offer not found']);
    exit;
}

// Update Seller's Offer
updateUserOffers($sellerEmail, function($offers) use ($offerId, $buyerId) {
    foreach ($offers as &$offer) {
        if ($offer['offer_id'] === $offerId) {
            // Add buyer if not exists
            $exists = false;
            foreach ($offer['interested_buyers'] as $buyer) {
                if ($buyer['buyer_id'] === $buyerId) {
                    $exists = true; 
                    break;
                }
            }
            if (!$exists) {
                $offer['interested_buyers'][] = [
                    'buyer_id' => $buyerId,
                    'timestamp' => time()
                ];
            }
        }
    }
    return $offers;
});

// Notify Seller
sendNotification($sellerEmail, [
    'message' => "Team $buyerId is interested in your offer",
    'offer_id' => $offerId,
    'type' => 'buyer_interest'
]);

echo json_encode(['success' => true]);