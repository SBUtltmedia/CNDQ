<?php
/**
 * Migration Script - Move existing user_*.json files to new team directory structure
 *
 * Run this once to migrate from old structure to new team-centric structure.
 * Usage: php migrate_to_new_structure.php
 */

require_once __DIR__ . '/lib/TeamStorage.php';

echo "=== CNDQ Data Migration Script ===\n\n";

$dataDir = __DIR__ . '/data';
$oldUserFiles = glob($dataDir . '/user_*.json');

if (empty($oldUserFiles)) {
    echo "No user_*.json files found in data/ directory.\n";
    echo "Nothing to migrate.\n";
    exit(0);
}

echo "Found " . count($oldUserFiles) . " user files to migrate:\n";
foreach ($oldUserFiles as $file) {
    echo "  - " . basename($file) . "\n";
}

echo "\nStarting migration...\n\n";

$migrated = 0;
$skipped = 0;
$errors = 0;

foreach ($oldUserFiles as $oldFile) {
    $filename = basename($oldFile);

    // Extract email from filename (user_EMAIL.json)
    if (preg_match('/^user_(.+)\.json$/', $filename, $matches)) {
        $email = $matches[1];

        echo "Migrating: $email... ";

        try {
            // Read old file
            $oldData = json_decode(file_get_contents($oldFile), true);

            if (!$oldData) {
                echo "SKIPPED (invalid JSON)\n";
                $skipped++;
                continue;
            }

            // Create new team storage
            $storage = new TeamStorage($email);

            // Migrate profile data
            if (isset($oldData['startingFund'])) {
                $storage->updateProfile(function($profile) use ($oldData, $email) {
                    $profile['email'] = $email;
                    $profile['teamName'] = $oldData['teamName'] ?? $email;
                    $profile['startingFunds'] = $oldData['startingFund'] ?? 10000;
                    $profile['currentFunds'] = $oldData['startingFund'] ?? 10000;
                    $profile['createdAt'] = time();
                    $profile['lastActive'] = time();
                    return $profile;
                });
            }

            // Migrate inventory
            if (isset($oldData['inventory'])) {
                $storage->updateInventory(function($inv) use ($oldData) {
                    $inv['C'] = $oldData['inventory']['C'] ?? 0;
                    $inv['N'] = $oldData['inventory']['N'] ?? 0;
                    $inv['D'] = $oldData['inventory']['D'] ?? 0;
                    $inv['Q'] = $oldData['inventory']['Q'] ?? 0;
                    $inv['updatedAt'] = time();
                    $inv['transactionsSinceLastShadowCalc'] = 0;
                    return $inv;
                });
            } elseif (isset($oldData['baseInventory'])) {
                $storage->updateInventory(function($inv) use ($oldData) {
                    $inv['C'] = $oldData['baseInventory']['C'] ?? 0;
                    $inv['N'] = $oldData['baseInventory']['N'] ?? 0;
                    $inv['D'] = $oldData['baseInventory']['D'] ?? 0;
                    $inv['Q'] = $oldData['baseInventory']['Q'] ?? 0;
                    $inv['updatedAt'] = time();
                    $inv['transactionsSinceLastShadowCalc'] = 0;
                    return $inv;
                });
            }

            // Migrate notifications
            if (isset($oldData['notifications']) && is_array($oldData['notifications'])) {
                foreach ($oldData['notifications'] as $notif) {
                    if (is_array($notif)) {
                        $storage->addNotification($notif);
                    }
                }
            }

            echo "SUCCESS\n";
            $migrated++;

            // Rename old file to .bak
            rename($oldFile, $oldFile . '.bak');

        } catch (Exception $e) {
            echo "ERROR: " . $e->getMessage() . "\n";
            $errors++;
        }
    }
}

echo "\n=== Migration Complete ===\n";
echo "Migrated: $migrated\n";
echo "Skipped: $skipped\n";
echo "Errors: $errors\n";

if ($migrated > 0) {
    echo "\nOld files have been renamed to *.json.bak\n";
    echo "You can safely delete them after verifying the migration.\n";
}

echo "\nNew team directories created in: data/teams/\n";
