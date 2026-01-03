<?php
/**
 * Leaderboard API
 * GET: Get team standings ranked by ROI percentage
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../../userData.php';
require_once __DIR__ . '/../../lib/SessionManager.php';
require_once __DIR__ . '/../../lib/TeamStorage.php';

try {
    $sessionManager = new SessionManager();
    $sessionState = $sessionManager->getState();

    // Get all teams
    $teamsDir = __DIR__ . '/../../data/teams';
    $standings = [];

    if (is_dir($teamsDir)) {
        $teamDirs = array_filter(glob($teamsDir . '/*'), 'is_dir');

        foreach ($teamDirs as $teamDir) {
            $email = basename($teamDir);
            
            // Skip the system team
            if ($email === 'system') continue;
            
            try {
                // Use TeamStorage to leverage the cache
                $storage = new TeamStorage($email);
                $state = $storage->getState();
                $profile = $state['profile'];

                if ($profile) {
                    $currentFunds = $profile['currentFunds'] ?? 0;
                    $startingFunds = $profile['startingFunds'] ?? 0;
                    
                    // If startingFunds is 0, it means we should use
                    // the first production revenue as our real baseline for ROI.
                    if ($startingFunds <= 0 && !empty($state['productions'])) {
                        $startingFunds = $state['productions'][0]['revenue'] ?? 0;
                    }

                    $profit = $currentFunds - $startingFunds;
                    $roi = $startingFunds > 0 ? (($profit / $startingFunds) * 100) : 0;

                    $standings[] = [
                        'teamName' => $profile['teamName'] ?? 'Unknown Team',
                        'teamId' => $profile['email'] ?? $email,
                        'startingFunds' => $startingFunds,
                        'currentFunds' => $currentFunds,
                        'profit' => $profit,
                        'roi' => $roi,
                        'lastActive' => $profile['lastActive'] ?? 0
                    ];
                }
            } catch (Exception $e) {
                // Skip teams with errors
                error_log("Error processing team $email for leaderboard: " . $e->getMessage());
                continue;
            }
        }
    }

    // Sort by ROI descending (highest ROI first)
    usort($standings, function($a, $b) {
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
