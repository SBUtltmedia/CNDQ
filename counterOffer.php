<?php
require_once 'userData.php';
require_once 'fileHelpers.php';

header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
$offerId = $input['offer_id'] ?? '';
$newPrice = floatval($input['new_price'] ?? 0);
$sellerId = getCurrentUserEmail();

// Update Seller's Offer
$buyerId = null;

updateUserOffers($sellerId, function($offers) use ($offerId, $newPrice, &$buyerId) {
    foreach ($offers as &$offer) {
        if ($offer['offer_id'] === $offerId) {
            $buyerId = $offer['active_negotiation']['buyer_id'] ?? null;
            $offer['active_negotiation']['current_price'] = $newPrice;
            $offer['active_negotiation']['last_action'] = 'seller_counter';
            $offer['active_negotiation']['history'][] = [
                'action' => 'counter_offer', 
                'price' => $newPrice, 
                'timestamp' => time()
            ];
        }
    }
    return $offers;
});

if ($buyerId) {
    sendNotification($buyerId, [
        'message' => "Counter offer received: $$newPrice",
        'offer_id' => $offerId,
        'type' => 'counter_offer'
    ]);
}

echo json_encode(['success' => true]);