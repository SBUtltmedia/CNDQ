#!/usr/bin/env php
<?php
/**
 * Apply Schema to Existing Database
 *
 * Use this if the database exists but tables are missing
 *
 * Usage:
 *   php bin/apply-schema.php
 */

require_once __DIR__ . '/../lib/Database.php';

echo "Apply Database Schema\n";
echo "=====================\n\n";

try {
    $db = Database::getInstance();
    $schemaFile = __DIR__ . '/../lib/schema.sql';

    if (!file_exists($schemaFile)) {
        echo "❌ Schema file not found: $schemaFile\n";
        exit(1);
    }

    echo "Reading schema from: $schemaFile\n";
    $schema = file_get_contents($schemaFile);

    // Execute schema
    $db->getPdo()->exec($schema);

    echo "✅ Schema applied successfully!\n\n";

    // Verify tables
    $stats = $db->getStats();
    echo "Database Tables:\n";
    foreach ($stats['tables'] as $table => $count) {
        echo "  ✓ $table: $count rows\n";
    }

    echo "\n✅ Database is ready!\n";

} catch (Exception $e) {
    echo "\n❌ Error: " . $e->getMessage() . "\n";
    echo "\nIf tables already exist, this is normal.\n";
    echo "The database should still be functional.\n";
    exit(1);
}
