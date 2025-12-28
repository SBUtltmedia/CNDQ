<?php
/**
 * Test script to reset the game via command line
 */

require_once __DIR__ . '/userData.php';
require_once __DIR__ . '/lib/SessionManager.php';
require_once __DIR__ . '/lib/TeamStorage.php';

echo "🎮 Resetting CNDQ Game...\n\n";

try {
    $teamsDir = __DIR__ . '/data/teams';
    $resetCount = 0;
    $errors = [];

    if (!is_dir($teamsDir)) {
        throw new Exception('Teams directory not found');
    }

    $teamDirs = glob($teamsDir . '/*', GLOB_ONLYDIR);
    echo "Found " . count($teamDirs) . " teams to reset\n\n";

    foreach ($teamDirs as $teamDir) {
        $teamEmail = basename($teamDir);
        echo "Resetting: $teamEmail\n";

        try {
            // Read current profile to keep email and teamName
            $profileFile = $teamDir . '/profile.json';
            if (!file_exists($profileFile)) {
                echo "  ⚠️  No profile found, skipping\n";
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
                'settings' => [
                    'showTradingHints' => false,
                    'hasSeenShadowPriceTip' => false
                ],
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
            echo "  ✓ Inventory: C={$resetInventory['C']}, N={$resetInventory['N']}, D={$resetInventory['D']}, Q={$resetInventory['Q']}\n";

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
            echo "  ✓ Reset complete\n\n";

        } catch (Exception $e) {
            $errors[] = "$teamEmail: " . $e->getMessage();
            echo "  ❌ Error: " . $e->getMessage() . "\n\n";
        }
    }

    // Reset session to session 1, production phase
    echo "Resetting session state...\n";
    $sessionManager = new SessionManager();
    $sessionManager->reset();
    echo "✓ Session reset to session 1\n\n";

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    echo "✅ Game reset complete!\n";
    echo "   Teams reset: $resetCount\n";
    if (!empty($errors)) {
        echo "   Errors: " . count($errors) . "\n";
        foreach ($errors as $error) {
            echo "     - $error\n";
        }
    }
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

} catch (Exception $e) {
    echo "❌ Fatal error: " . $e->getMessage() . "\n";
    exit(1);
}
