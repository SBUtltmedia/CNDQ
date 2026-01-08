<?php
require_once __DIR__ . '/../lib/Database.php';

try {
    $db = Database::getInstance();
    echo "Connected to database: " . $db->getPath() . "\n";
    
    $cols = $db->query("PRAGMA table_info(marketplace_snapshot)");
    echo "Columns in 'marketplace_snapshot':\n";
    foreach ($cols as $col) {
        echo "- " . $col['name'] . " (" . $col['type'] . ")\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}

