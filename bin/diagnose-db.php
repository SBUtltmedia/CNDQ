#!/usr/bin/env php
<?php
/**
 * Diagnose Database Issues
 *
 * Checks why schema might not be applied
 */

echo "Database Diagnostic Tool\n";
echo "========================\n\n";

// Check schema file
$schemaFile = __DIR__ . '/../lib/schema.sql';
echo "1. Schema File Check:\n";
echo "   Path: $schemaFile\n";
if (file_exists($schemaFile)) {
    $size = filesize($schemaFile);
    echo "   ✓ Exists (size: $size bytes)\n";
    $lines = count(file($schemaFile));
    echo "   ✓ Lines: $lines\n";
} else {
    echo "   ❌ NOT FOUND!\n";
    exit(1);
}

// Check data directory
echo "\n2. Data Directory Check:\n";
$dataDir = __DIR__ . '/../data';
echo "   Path: $dataDir\n";
if (is_link($dataDir)) {
    $target = readlink($dataDir);
    echo "   ⚡ Is symlink to: $target\n";
    if (is_dir($target)) {
        echo "   ✓ Target exists\n";
    } else {
        echo "   ❌ Target does not exist!\n";
    }
} elseif (is_dir($dataDir)) {
    echo "   ✓ Is directory\n";
} else {
    echo "   ❌ Does not exist!\n";
}

// Check database file
echo "\n3. Database File Check:\n";
$dbPath = $dataDir . '/cndq.db';
echo "   Path: $dbPath\n";
if (file_exists($dbPath)) {
    $size = filesize($dbPath);
    echo "   ✓ Exists (size: $size bytes)\n";

    // Check if it's a new/empty database
    if ($size < 10000) {
        echo "   ⚠️  Very small - might not have schema applied\n";
    }
} else {
    echo "   ℹ️  Does not exist yet\n";
}

// Try to connect and check tables
echo "\n4. Database Connection Check:\n";
try {
    require_once __DIR__ . '/../lib/Database.php';
    $db = Database::getInstance();
    echo "   ✓ Connection successful\n";

    $tables = $db->query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    echo "   Tables found: " . count($tables) . "\n";

    if (empty($tables)) {
        echo "   ❌ No tables! Schema was not applied.\n";
        echo "\n5. Attempting to apply schema...\n";

        $schema = file_get_contents($schemaFile);
        $db->getPdo()->exec($schema);
        echo "   ✓ Schema applied!\n";

        // Re-check tables
        $tables = $db->query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
        echo "   Tables now: " . count($tables) . "\n";
        foreach ($tables as $table) {
            echo "     - " . $table['name'] . "\n";
        }
    } else {
        echo "   ✓ Tables present:\n";
        foreach ($tables as $table) {
            echo "     - " . $table['name'] . "\n";
        }
    }

} catch (Exception $e) {
    echo "   ❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}

echo "\n✅ Diagnostic complete!\n";
