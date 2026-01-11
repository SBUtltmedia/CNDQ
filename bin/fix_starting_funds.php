#!/usr/bin/env php
<?php
/**
 * Fix Starting Funds for Existing Teams
 *
 * Teams should have startingFunds set to their first production revenue.
 * This script fixes existing teams by setting their startingFunds = currentFunds,
 * which resets their ROI to 0% as a new baseline.
 *
 * NOTE: This is a one-time migration. New teams will automatically have
 * startingFunds set correctly during their first production run.
 *
 * Usage:
 *   php bin/fix_starting_funds.php
 */

require_once __DIR__ . '/../lib/TeamStorage.php';
require_once __DIR__ . '/../lib/Database.php';

echo "Fix Starting Funds Migration\n";
echo "=============================\n\n";

try {
    $db = Database::getInstance();
    // Get all teams including 'system' - we'll check if it's a real team
    $teams = $db->query('SELECT DISTINCT team_email FROM team_events');

    if (empty($teams)) {
        echo "No teams found in database.\n";
        exit(0);
    }

    echo "Found " . count($teams) . " teams\n\n";

    $fixed = 0;
    $skipped = 0;

    foreach ($teams as $row) {
        $email = $row['team_email'];
        $storage = new TeamStorage($email);
        $profile = $storage->getProfile();

        $teamName = $profile['teamName'] ?? 'Unknown';
        $startingFunds = $profile['startingFunds'] ?? 0;
        $currentFunds = $profile['currentFunds'] ?? 0;

        // Only fix teams with startingFunds = 0
        if ($startingFunds == 0 && $currentFunds > 0) {
            // Set starting funds to current funds (resets ROI to 0%)
            $storage->emitEvent('set_funds', [
                'amount' => $currentFunds,
                'is_starting' => true
            ]);

                    $currentStr = ($currentFunds < 0 ? '-$' : '$') . number_format(abs($currentFunds), 2);
                    echo "✓ Fixed: $teamName - Set starting funds to $currentStr\n";
                    $fixed++;
                } else {
                    $startingStr = ($startingFunds < 0 ? '-$' : '$') . number_format(abs($startingFunds), 2);
                    echo "⏭  Skipped: $teamName - Already has proper starting funds ($startingStr)\n";
                    $skipped++;
                }    }

    echo "\n" . str_repeat('-', 50) . "\n";
    echo "✅ Migration complete!\n";
    echo "   Fixed: $fixed teams\n";
    echo "   Skipped: $skipped teams\n\n";
    echo "Teams' ROI calculations will now work correctly.\n";
    echo "All fixed teams start with 0% ROI from their current funds.\n";

} catch (Exception $e) {
    echo "\n❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
