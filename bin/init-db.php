#!/usr/bin/env php
<?php
/**
 * Database Initialization Script
 *
 * Ensures the SQLite database is initialized and ready.
 * Safe to run multiple times - won't reset existing data.
 *
 * Usage:
 *   php bin/init-db.php
 */

require_once __DIR__ . '/../lib/Database.php';

echo "CNDQ Database Initialization\n";
echo "============================\n\n";

try {
    // Get database instance - this triggers auto-initialization if needed
    $db = Database::getInstance();

    $dbPath = $db->getPath();
    $dbSize = $db->getSize();

    if ($dbSize === 0) {
        echo "✓ Database created: $dbPath\n";
        echo "✓ Schema initialized from data/schema.sql\n";
    } else {
        echo "✓ Database exists: $dbPath\n";
        echo "✓ Size: " . round($dbSize / 1024, 2) . " KB\n";
    }

    // Verify tables exist
    $stats = $db->getStats();
    echo "\nDatabase Tables:\n";
    foreach ($stats['tables'] as $table => $count) {
        echo "  - $table: $count rows\n";
    }

    echo "\n✅ Database is ready!\n";
    echo "\nDatabase location: $dbPath\n";

    // Check if data/ is a symlink
    $dataDir = dirname($dbPath);
    if (is_link($dataDir)) {
        $target = readlink($dataDir);
        echo "Note: data/ is a symlink to: $target\n";
    }

} catch (Exception $e) {
    echo "\n❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
