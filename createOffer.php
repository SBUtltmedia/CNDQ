<?php
require_once 'userData.php';
require_once 'fileHelpers.php';

header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
$chemical = $input['chemical'] ?? '';
$quantity = intval($input['quantity'] ?? 0);
$reservePrice = floatval($input['reserve_price'] ?? 0);

$userEmail = getCurrentUserEmail();

// Validate
$userData = getUserData($userEmail);
if (($userData['inventory'][$chemical] ?? 0) < $quantity) {
    echo json_encode(['success' => false, 'message' => 'Insufficient inventory']);
    exit;
}

// Create Offer Object
$offerId = 'offer_' . uniqid() . '_' . time();
$newOffer = [
    'offer_id' => $offerId,
    'seller_id' => $userEmail,
    'chemical' => $chemical,
    'quantity' => $quantity,
    'reserve_price' => $reservePrice,
    'status' => 'open',
    'created_at' => time(),
    'interested_buyers' => []
];

// Save to User's Offers File
updateUserOffers($userEmail, function($offers) use ($newOffer) {
    $offers[] = $newOffer;
    return $offers;
});

echo json_encode(['success' => true, 'offer_id' => $offerId]);