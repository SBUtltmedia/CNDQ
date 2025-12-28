<?php
/**
 * Fix startingFunds for all teams based on their Session 1 production revenue
 */

$teamsDir = __DIR__ . '/data/teams';
$fixed = 0;
$errors = [];

echo "Fixing startingFunds for all teams...\n\n";

$teamDirs = glob($teamsDir . '/*', GLOB_ONLYDIR);

foreach ($teamDirs as $teamDir) {
    $teamEmail = basename($teamDir);

    try {
        // Read profile
        $profileFile = $teamDir . '/profile.json';
        if (!file_exists($profileFile)) {
            continue;
        }

        $profile = json_decode(file_get_contents($profileFile), true);

        // Only fix if startingFunds is currently 0
        if ($profile['startingFunds'] != 0) {
            echo "$teamEmail: Already has startingFunds = \${$profile['startingFunds']}, skipping\n";
            continue;
        }

        // Read production history
        $productionFile = $teamDir . '/production_history.json';
        if (!file_exists($productionFile)) {
            echo "$teamEmail: No production history, skipping\n";
            continue;
        }

        $productionData = json_decode(file_get_contents($productionFile), true);

        // Find Session 1 production
        $session1Revenue = null;
        if (isset($productionData['productions'])) {
            foreach ($productionData['productions'] as $production) {
                if (isset($production['sessionNumber']) && $production['sessionNumber'] == 1) {
                    $session1Revenue = $production['revenue'];
                    break;
                }
            }
        }

        if ($session1Revenue === null) {
            echo "$teamEmail: No Session 1 production found, skipping\n";
            continue;
        }

        // Update startingFunds
        $profile['startingFunds'] = $session1Revenue;
        $profile['lastModified'] = time();

        file_put_contents($profileFile, json_encode($profile, JSON_PRETTY_PRINT));

        echo "$teamEmail: Set startingFunds = \$" . number_format($session1Revenue, 2) . "\n";
        $fixed++;

    } catch (Exception $e) {
        $errors[] = "$teamEmail: " . $e->getMessage();
        echo "ERROR - $teamEmail: " . $e->getMessage() . "\n";
    }
}

echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
echo "✓ Fixed $fixed teams\n";

if (!empty($errors)) {
    echo "\nErrors:\n";
    foreach ($errors as $error) {
        echo "  - $error\n";
    }
}
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
