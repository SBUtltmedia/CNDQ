<?php
/**
 * Polling endpoint for real-time market updates
 * NOW AGGREGATES DATA FROM ALL USER FOLDERS
 */

require_once 'userData.php';
require_once 'fileHelpers.php';

header('Content-Type: application/json');

$userEmail = getCurrentUserEmail();
$userData = getUserData($userEmail);

if (!$userData) {
    // If user doesn't exist yet (first load), return empty structure
    $userData = [
        'inventory' => ['C'=>0,'N'=>0,'D'=>0,'Q'=>0], 
        'startingFund' => 0,
        'notifications' => []
    ];
}

$lastPoll = intval($_GET['lastPoll'] ?? 0);
$currentTime = time();

// Aggregate Offers from ALL users
$allOffers = [];
$dataDir = __DIR__ . '/data/users';
$users = glob($dataDir . '/*', GLOB_ONLYDIR);

foreach ($users as $userDir) {
    $offersFile = $userDir . '/offers.json';
    if (file_exists($offersFile)) {
        $userOffers = json_decode(file_get_contents($offersFile), true) ?: [];
        $allOffers = array_merge($allOffers, $userOffers);
    }
}

// Filter offers
$activeOffers = array_filter($allOffers, function($offer) use ($lastPoll) {
    if ($offer['status'] === 'cancelled') return false;
    if ($offer['status'] === 'completed') {
        return isset($offer['completed_at']) && ($offer['completed_at'] > $lastPoll);
    }
    return true;
});

// Categorize
$myOffers = [];
$availableOffers = [];
$myNegotiations = [];

foreach ($activeOffers as $offer) {
    if ($offer['seller_id'] === $userEmail) {
        $myOffers[] = $offer;
        if (isset($offer['active_negotiation'])) {
            $myNegotiations[] = [
                'offer_id' => $offer['offer_id'],
                'role' => 'seller',
                'chemical' => $offer['chemical'],
                'quantity' => $offer['quantity'],
                'current_price' => $offer['active_negotiation']['current_price'],
                'last_action' => $offer['active_negotiation']['last_action'],
                'counterparty' => $offer['active_negotiation']['buyer_id'],
                'history' => $offer['active_negotiation']['history']
            ];
        }
    } else if (isset($offer['active_negotiation']) && $offer['active_negotiation']['buyer_id'] === $userEmail) {
        $availableOffers[] = $offer;
        $myNegotiations[] = [
            'offer_id' => $offer['offer_id'],
            'role' => 'buyer',
            'chemical' => $offer['chemical'],
            'quantity' => $offer['quantity'],
            'current_price' => $offer['active_negotiation']['current_price'],
            'last_action' => $offer['active_negotiation']['last_action'],
            'counterparty' => $offer['seller_id'],
            'history' => $offer['active_negotiation']['history']
        ];
    } else if ($offer['status'] === 'open') {
        $availableOffers[] = $offer;
    }
}

// Notifications
$notifications = array_filter($userData['notifications'] ?? [], function($notif) use ($lastPoll) {
    return ($notif['timestamp'] > $lastPoll);
});
usort($notifications, function($a, $b) { return $b['timestamp'] - $a['timestamp']; });

$allUnread = array_filter($userData['notifications'] ?? [], function($n) { return !($n['read'] ?? false); });

// Session State (Always Open)
$sessionState = ['state' => 'TRADING'];

echo json_encode([
    'success' => true,
    'timestamp' => $currentTime,
    'my_offers' => array_values($myOffers),
    'available_offers' => array_values($availableOffers),
    'active_negotiations' => array_values($myNegotiations),
    'notifications' => array_values($notifications),
    'notification_count' => count($allUnread),
    'user_inventory' => $userData['inventory'] ?? [],
    'initial_inventory' => $userData['initialInventory'] ?? [],
    'user_fund' => $userData['startingFund'] ?? 0,
    'initial_capital' => $userData['initialCapital'] ?? 0,
    'display_name' => $userData['displayName'] ?? 'Team',
    'last_production' => $userData['lastProduction'] ?? null,
    'shadow_prices' => $userData['shadowPrices'] ?? null,
    'session_state' => $sessionState
]);