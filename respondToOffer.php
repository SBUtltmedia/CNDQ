<?php
require_once 'userData.php';
require_once 'fileHelpers.php';

header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);
$offerId = $input['offer_id'] ?? '';
$action = $input['action'] ?? ''; // 'accept' or 'reject'
$buyerId = getCurrentUserEmail();

// Find Seller (Scan again, or pass in request)
// We'll scan for robustness
$dataDir = __DIR__ . '/data/users';
$found = false;
$sellerEmail = null;
$offerDetails = null;

$users = glob($dataDir . '/*', GLOB_ONLYDIR);
foreach ($users as $userDir) {
    $offersFile = $userDir . '/offers.json';
    if (!file_exists($offersFile)) continue;
    
    $offers = json_decode(file_get_contents($offersFile), true) ?: [];
    foreach ($offers as $offer) {
        if ($offer['offer_id'] === $offerId) {
            $sellerEmail = $offer['seller_id'];
            $offerDetails = $offer;
            $found = true;
            break 2;
        }
    }
}

if (!$found) {
    echo json_encode(['success' => false, 'message' => 'Offer not found']);
    exit;
}

if ($action === 'accept') {
    $price = $offerDetails['active_negotiation']['current_price'];
    
    // Execute Trade (Atomic Lock)
    $res = executeTrade($sellerEmail, $buyerId, $offerDetails['chemical'], $offerDetails['quantity'], $price);
    
    if ($res['success']) {
        // Update Offer Status to Completed
        updateUserOffers($sellerEmail, function($offers) use ($offerId) {
            foreach ($offers as &$offer) {
                if ($offer['offer_id'] === $offerId) {
                    $offer['status'] = 'completed';
                    $offer['completed_at'] = time();
                }
            }
            return $offers;
        });
        
        sendNotification($sellerEmail, [
            'message' => "Offer accepted by $buyerId",
            'offer_id' => $offerId,
            'type' => 'trade_completed'
        ]);
        
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => $res['message']]);
    }
} else {
    // Reject
    updateUserOffers($sellerEmail, function($offers) use ($offerId) {
        foreach ($offers as &$offer) {
            if ($offer['offer_id'] === $offerId) {
                $offer['active_negotiation']['last_action'] = 'buyer_reject';
                $offer['active_negotiation']['history'][] = [
                    'action' => 'reject', 
                    'timestamp' => time()
                ];
            }
        }
        return $offers;
    });
    
    sendNotification($sellerEmail, [
        'message' => "Offer rejected by $buyerId",
        'offer_id' => $offerId,
        'type' => 'offer_rejected'
    ]);
    
    echo json_encode(['success' => true]);
}