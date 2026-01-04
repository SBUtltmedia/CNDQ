<?php
/**
 * Leaderboard API
 * GET: Get team standings ranked by ROI percentage
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../../userData.php';
require_once __DIR__ . '/../../lib/SessionManager.php';
require_once __DIR__ . '/../../lib/MarketplaceAggregator.php';

try {
    $sessionManager = new SessionManager();
    $sessionState = $sessionManager->getState();

    // Use MarketplaceAggregator to get team statistics from SQLite
    $marketplace = new MarketplaceAggregator();
    $stats = $marketplace->getTeamStatistics();

    $standings = [];

    foreach ($stats as $teamStat) {
        // Skip the system team
        if ($teamStat['email'] === 'system') continue;

        $standings[] = [
            'teamName' => $teamStat['teamName'],
            'teamId' => $teamStat['email'],
            'startingFunds' => $teamStat['startingFunds'],
            'currentFunds' => $teamStat['currentFunds'],
            'profit' => $teamStat['currentFunds'] - $teamStat['startingFunds'],
            'roi' => $teamStat['percentChange'],
            'inventory' => $teamStat['inventory'],
            'totalTrades' => $teamStat['totalTrades']
        ];
    }

    // Sort by ROI descending (highest ROI first)
    // Use currentFunds as a tie-breaker if ROI is equal
    usort($standings, function($a, $b) {
        if (abs($b['roi'] - $a['roi']) < 0.0001) {
            return $b['currentFunds'] <=> $a['currentFunds'];
        }
        return $b['roi'] <=> $a['roi'];
    });

    // Add rank
    foreach ($standings as $index => &$team) {
        $team['rank'] = $index + 1;
    }

    echo json_encode([
        'success' => true,
        'session' => $sessionState['currentSession'],
        'phase' => $sessionState['phase'],
        'standings' => $standings,
        'totalTeams' => count($standings)
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Server error',
        'message' => $e->getMessage()
    ]);
}
