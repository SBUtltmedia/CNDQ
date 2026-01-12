#!/usr/bin/env php
<?php
/**
 * Check Database Schema Version
 *
 * Checks if the database schema is up to date
 *
 * Usage:
 *   php bin/check-schema.php
 */

require_once __DIR__ . '/../lib/Database.php';

echo "Database Schema Version Check\n";
echo "==============================\n\n";

try {
    $db = Database::getInstance();

    // Get current version from database
    $result = $db->getPdo()->query("SELECT value FROM config WHERE key = 'schema_version'")->fetch(PDO::FETCH_ASSOC);
    $currentVersion = $result ? (int)json_decode($result['value']) : 0;

    // Get expected version from file
    $versionFile = __DIR__ . '/../lib/schema_version.txt';
    $expectedVersion = file_exists($versionFile) ? (int)trim(file_get_contents($versionFile)) : 1;

    echo "Current schema version:  $currentVersion\n";
    echo "Expected schema version: $expectedVersion\n\n";

    if ($currentVersion < $expectedVersion) {
        echo "⚠️  Schema update needed!\n";
        echo "\nTo update, run one of:\n";
        echo "  1. Restart the application (auto-update on next request)\n";
        echo "  2. php bin/apply-schema.php (manual update)\n";
        exit(1);
    } elseif ($currentVersion > $expectedVersion) {
        echo "⚠️  Database schema is NEWER than expected!\n";
        echo "This could happen if you rolled back code but not the database.\n";
        exit(1);
    } else {
        echo "✅ Schema is up to date!\n";
    }

} catch (Exception $e) {
    echo "\n❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
