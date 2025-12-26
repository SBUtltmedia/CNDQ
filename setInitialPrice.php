<?php
require_once 'userData.php';
require_once 'fileHelpers.php';

header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
$offerId = $input['offer_id'] ?? '';
$buyerId = $input['buyer_id'] ?? '';
$price = floatval($input['price'] ?? 0);
$sellerId = getCurrentUserEmail();

// Update Seller's Offer (Seller is current user)
updateUserOffers($sellerId, function($offers) use ($offerId, $buyerId, $price) {
    foreach ($offers as &$offer) {
        if ($offer['offer_id'] === $offerId) {
            $offer['status'] = 'negotiating';
            $offer['active_negotiation'] = [
                'buyer_id' => $buyerId,
                'current_price' => $price,
                'last_action' => 'seller_initial_price',
                'history' => [
                    ['action' => 'initial_price', 'price' => $price, 'timestamp' => time()]
                ]
            ];
        }
    }
    return $offers;
});

sendNotification($buyerId, [
    'message' => "Seller set initial price to $$price",
    'offer_id' => $offerId,
    'type' => 'price_update'
]);

echo json_encode(['success' => true]);