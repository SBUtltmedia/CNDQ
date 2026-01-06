<?php
/**
 * Admin Endpoint: List All Teams
 *
 * ADMIN-ONLY: Returns overview of all teams in the system
 *
 * Response:
 * {
 *   "teams": [
 *     {
 *       "email": "team1@example.com",
 *       "teamName": "Alpha Team",
 *       "funds": 10000,
 *       "inventory": { "C": 850, "N": 740, "D": 630, "Q": 520 },
 *       "activeOffers": 2,
 *       "totalTrades": 5
 *     }
 *   ]
 * }
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../../userData.php';
require_once __DIR__ . '/../../lib/MarketplaceAggregator.php';

// SECURITY: Admin-only endpoint
if (!isAdmin()) {
    http_response_code(403);
    echo json_encode([
        'error' => 'Forbidden',
        'message' => 'This endpoint requires admin privileges'
    ]);
    exit;
}

try {
    $aggregator = new MarketplaceAggregator();
    $allTeams = $aggregator->getAllTeams();

    $teamSummaries = [];

    foreach ($allTeams as $teamInfo) {
        try {
            $storage = new TeamStorage($teamInfo['email']);
            $state = $storage->getState();
            
            $profile = $state['profile'] ?? [];
            $inventory = $state['inventory'] ?? [];
            $transactions = $state['transactions'] ?? [];
            $offers = $state['offers'] ?? [];

            $startingPotential = $profile['startingFunds'] ?? 0;
            $currentPotential = $state['shadowPrices']['maxProfit'] ?? 0;
            
            // Calculate improvement
            $improvement = $currentPotential - $startingPotential;

            $teamSummaries[] = [
                'email' => $teamInfo['email'],
                'teamName' => $profile['teamName'] ?? $teamInfo['teamName'] ?? 'Unknown Team',
                'funds' => round($improvement, 2), // Labelled as funds for legacy compatibility but contains improvement
                'inventory' => [
                    'C' => max(0, round($inventory['C'] ?? 0, 4)),
                    'N' => max(0, round($inventory['N'] ?? 0, 4)),
                    'D' => max(0, round($inventory['D'] ?? 0, 4)),
                    'Q' => max(0, round($inventory['Q'] ?? 0, 4))
                ],
                'activeOffers' => count($offers),
                'totalTrades' => count($transactions),
                'lastUpdated' => $inventory['updatedAt'] ?? null
            ];
        } catch (Exception $e) {
            continue;
        }
    }

    echo json_encode([
        'teams' => $teamSummaries,
        'totalTeams' => count($teamSummaries),
        'timestamp' => time()
    ], JSON_PRETTY_PRINT);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Server error',
        'message' => $e->getMessage()
    ]);
}
