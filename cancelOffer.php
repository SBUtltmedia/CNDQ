<?php
require_once 'userData.php';
require_once 'fileHelpers.php';

header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
$offerId = $input['offer_id'] ?? '';
$sellerId = getCurrentUserEmail();

updateUserOffers($sellerId, function($offers) use ($offerId) {
    foreach ($offers as &$offer) {
        if ($offer['offer_id'] === $offerId) {
            $offer['status'] = 'cancelled';
        }
    }
    return $offers;
});

echo json_encode(['success' => true]);