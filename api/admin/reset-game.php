<?php
/**
 * Admin Reset Game API
 *
 * POST: Reset all game data while keeping team registrations
 * This allows the same players to start fresh from scratch
 */

header('Content-Type: application/json');
require_once __DIR__ . '/../../userData.php';
require_once __DIR__ . '/../../lib/SessionManager.php';
require_once __DIR__ . '/../../lib/TeamStorage.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ADMIN ONLY
if (!isAdmin()) {
    http_response_code(403);
    echo json_encode(['error' => 'Admin privileges required']);
    exit;
}

try {
    $teamsDir = __DIR__ . '/../../data/teams';
    $resetCount = 0;
    $errors = [];

    if (!is_dir($teamsDir)) {
        throw new Exception('Teams directory not found');
    }

    $teamDirs = glob($teamsDir . '/*', GLOB_ONLYDIR);

    foreach ($teamDirs as $teamDir) {
        $teamEmail = basename($teamDir);

        try {
            // Read current profile to keep email and teamName
            $profileFile = $teamDir . '/profile.json';
            if (!file_exists($profileFile)) {
                continue;
            }

            $profile = json_decode(file_get_contents($profileFile), true);

            // Reset profile but keep identity
            $resetProfile = [
                'email' => $profile['email'],
                'teamName' => $profile['teamName'] ?? $profile['email'],
                'startingFunds' => 0, // Will be set on first production
                'currentFunds' => 0,
                'createdAt' => $profile['createdAt'] ?? time(),
                'lastActive' => time(),
                'settings' => [],
                'lastModified' => time()
            ];
            file_put_contents($profileFile, json_encode($resetProfile, JSON_PRETTY_PRINT));

            // Reset inventory with random starting amounts (500-2000 gallons each)
            // Matches Excel template: =RANDBETWEEN(5,20) * 100
            $inventoryFile = $teamDir . '/inventory.json';
            $resetInventory = [
                'C' => rand(500, 2000),
                'N' => rand(500, 2000),
                'D' => rand(500, 2000),
                'Q' => rand(500, 2000),
                'transactionsSinceLastShadowCalc' => 0,
                'lastModified' => time()
            ];
            file_put_contents($inventoryFile, json_encode($resetInventory, JSON_PRETTY_PRINT));

            // Clear production history
            $productionFile = $teamDir . '/production_history.json';
            $resetProduction = [
                'history' => [],
                'lastModified' => time()
            ];
            file_put_contents($productionFile, json_encode($resetProduction, JSON_PRETTY_PRINT));

            // Clear advertisements
            $adsFile = $teamDir . '/advertisements.json';
            $resetAds = [
                'ads' => [],
                'lastModified' => time()
            ];
            file_put_contents($adsFile, json_encode($resetAds, JSON_PRETTY_PRINT));

            // Clear shadow prices (use direct properties, not nested structure)
            $shadowFile = $teamDir . '/shadow_prices.json';
            $resetShadow = [
                'C' => 0,
                'N' => 0,
                'D' => 0,
                'Q' => 0,
                'calculatedAt' => time(),
                'lastModified' => time()
            ];
            file_put_contents($shadowFile, json_encode($resetShadow, JSON_PRETTY_PRINT));

            // Clear negotiations (if exists)
            $negotiationsDir = $teamDir . '/negotiations';
            if (is_dir($negotiationsDir)) {
                $files = glob($negotiationsDir . '/*.json');
                foreach ($files as $file) {
                    unlink($file);
                }
            }

            $resetCount++;

        } catch (Exception $e) {
            $errors[] = "$teamEmail: " . $e->getMessage();
        }
    }

    // Reset session to session 1, production phase
    $sessionManager = new SessionManager();
    $sessionManager->reset();

    echo json_encode([
        'success' => true,
        'message' => 'Game reset complete. All teams can start fresh!',
        'teamsReset' => $resetCount,
        'errors' => $errors
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Server error',
        'message' => $e->getMessage()
    ]);
}
