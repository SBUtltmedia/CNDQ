<?php
/**
 * Leaderboard API
 * GET: Get team standings ranked by ROI percentage
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../../userData.php';
require_once __DIR__ . '/../../lib/SessionManager.php';

try {
    $sessionManager = new SessionManager();
    $currentSession = $sessionManager->getState();

    // Get all teams
    $teamsDir = __DIR__ . '/../../data/teams';
    $standings = [];

    if (is_dir($teamsDir)) {
        $teamDirs = glob($teamsDir . '/*', GLOB_ONLYDIR);

        foreach ($teamDirs as $teamDir) {
            $profileFile = $teamDir . '/profile.json';

            if (file_exists($profileFile)) {
                $profile = json_decode(file_get_contents($profileFile), true);

                if ($profile && isset($profile['startingFunds']) && isset($profile['currentFunds'])) {
                    $startingFunds = $profile['startingFunds'];
                    $currentFunds = $profile['currentFunds'];
                    $profit = $currentFunds - $startingFunds;
                    $roi = $startingFunds > 0 ? (($profit / $startingFunds) * 100) : 0;

                    $standings[] = [
                        'teamName' => $profile['teamName'] ?? 'Unknown Team',
                        'teamId' => $profile['email'], // Hidden from display, for reference
                        'startingFunds' => $startingFunds,
                        'currentFunds' => $currentFunds,
                        'profit' => $profit,
                        'roi' => $roi,
                        'lastActive' => $profile['lastActive'] ?? 0
                    ];
                }
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
        'session' => $currentSession['currentSession'],
        'phase' => $currentSession['phase'],
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
