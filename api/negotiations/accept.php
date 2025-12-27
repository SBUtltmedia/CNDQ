<?php
/**
 * Accept Offer API
 * POST: Accept the current offer and execute trade
 * Body: { negotiationId: "neg_..." }
 */

require_once __DIR__ . '/../../lib/NegotiationManager.php';
require_once __DIR__ . '/../../lib/TradeExecutor.php';
require_once __DIR__ . '/../../lib/SessionManager.php';
require_once __DIR__ . '/../../userData.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$currentUserEmail = getCurrentUserEmail();

if (!$currentUserEmail || $currentUserEmail === 'dev_user') {
    http_response_code(401);
    echo json_encode(['error' => 'Not authenticated']);
    exit;
}

// Check if trading is allowed
$sessionManager = new SessionManager();
if (!$sessionManager->isTradingAllowed()) {
    $state = $sessionManager->getState();
    http_response_code(403);
    echo json_encode([
        'error' => 'Trading not allowed',
        'message' => 'Market is currently ' . $state['phase'] . '.',
        'currentPhase' => $state['phase']
    ]);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

$negotiationId = $input['negotiationId'] ?? null;

if (!$negotiationId) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing negotiation ID']);
    exit;
}

try {
    $negotiationManager = new NegotiationManager();

    // Accept the negotiation (marks as accepted)
    $negotiation = $negotiationManager->acceptNegotiation($negotiationId, $currentUserEmail);

    // Get the final offer
    $finalOffer = end($negotiation['offers']);

    // Determine buyer and seller based on who made the last offer
    // The person who made the offer is selling TO the acceptor
    $lastOfferBy = $negotiation['lastOfferBy'];

    if ($lastOfferBy === $negotiation['initiatorId']) {
        // Initiator made the offer, responder is accepting
        $sellerId = $negotiation['initiatorId'];
        $buyerId = $negotiation['responderId'];
    } else {
        // Responder made the offer, initiator is accepting
        $sellerId = $negotiation['responderId'];
        $buyerId = $negotiation['initiatorId'];
    }

    // Execute the trade
    $executor = new TradeExecutor();
    $trade = $executor->executeTrade(
        $sellerId,
        $buyerId,
        $negotiation['chemical'],
        $finalOffer['quantity'],
        $finalOffer['price']
    );

    echo json_encode([
        'success' => true,
        'message' => 'Trade executed successfully!',
        'trade' => $trade,
        'negotiation' => $negotiation
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'error' => 'Failed to execute trade',
        'message' => $e->getMessage()
    ]);
}
