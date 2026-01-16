<?php
// Mock environment
$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['email'] = 'test_mail1@stonybrook.edu'; // Initiator

// Set up input
$inputData = [
    'responderId' => 'test_mail2@stonybrook.edu',
    'chemical' => 'C',
    'quantity' => 100,
    'price' => 5.00,
    'type' => 'buy',
    'adId' => 'mock_ad_id' // Mock ad ID
];

// Mock database and classes
require_once __DIR__ . '/../lib/Database.php';
require_once __DIR__ . '/../lib/NegotiationManager.php';
require_once __DIR__ . '/../lib/TeamStorage.php';
require_once __DIR__ . '/../lib/AdvertisementManager.php';
require_once __DIR__ . '/../lib/SessionManager.php';

// Create a mock ad for test_mail2 so adId is valid-ish
$adManager = new AdvertisementManager('test_mail2@stonybrook.edu');
$result = $adManager->postAdvertisement('C', 'buy');
$realAdId = $result['ads'][0]['id'] ?? 'failed_to_create_ad';
echo "Created mock Ad: $realAdId\n";

$inputData['adId'] = $realAdId;

// Simulate initiate.php logic
try {
    $currentUserEmail = 'test_mail1@stonybrook.edu';
    $responderId = $inputData['responderId'];
    $adId = $inputData['adId'];
    $chemical = $inputData['chemical'];
    $quantity = $inputData['quantity'];
    $price = $inputData['price'];
    $type = $inputData['type'];

    echo "Initiating negotiation...\n";
    echo "Initiator: $currentUserEmail\n";
    echo "Responder: $responderId\n";
    echo "Ad ID: $adId\n";

    $initiatorStorage = new TeamStorage($currentUserEmail);
    $initiatorProfile = $initiatorStorage->getProfile();

    $responderStorage = new TeamStorage($responderId);
    $responderProfile = $responderStorage->getProfile();

    $sessionManager = new SessionManager();
    $sessionState = $sessionManager->getState();
    $currentSession = $sessionState['currentSession'];

    $negotiationManager = new NegotiationManager();

    $negotiation = $negotiationManager->createNegotiation(
        $currentUserEmail,
        $initiatorProfile['teamName'] ?? $currentUserEmail,
        $responderId,
        $responderProfile['teamName'] ?? $responderId,
        $chemical,
        [
            'quantity' => $quantity,
            'price' => $price
        ],
        $currentSession,
        $type,
        $adId
    );

    echo "SUCCESS! Negotiation created: " . $negotiation['id'] . "\n";

} catch (Exception $e) {
    echo "CAUGHT EXCEPTION: " . $e->getMessage() . "\n";
    echo "Trace:\n" . $e->getTraceAsString() . "\n";
}
