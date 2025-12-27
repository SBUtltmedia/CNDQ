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

    foreach ($allTeams as $team) {
        $inventory = $team['inventory'] ?? [];
        $offers = $team['offers'] ?? [];

        // Count active (unsold) offers
        $activeOffers = count(array_filter($offers, function($offer) {
            return $offer['status'] === 'active';
        }));

        // Count completed trades
        $totalTrades = count(array_filter($offers, function($offer) {
            return $offer['status'] === 'sold';
        }));

        $teamSummaries[] = [
            'email' => $team['email'],
            'teamName' => $team['teamName'] ?? 'Unknown Team',
            'funds' => $team['funds'] ?? 0,
            'inventory' => [
                'C' => $inventory['C'] ?? 0,
                'N' => $inventory['N'] ?? 0,
                'D' => $inventory['D'] ?? 0,
                'Q' => $inventory['Q'] ?? 0
            ],
            'activeOffers' => $activeOffers,
            'totalTrades' => $totalTrades,
            'lastUpdated' => $inventory['updatedAt'] ?? null
        ];
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
