<?php
require_once __DIR__ . '/../lib/Database.php';

try {
    $db = Database::getInstance();
    $columns = $db->query("PRAGMA table_info(negotiations)");
    
    echo "Columns in 'negotiations' table:\n";
    $hasAdId = false;
    foreach ($columns as $col) {
        echo "- " . $col['name'] . " (" . $col['type'] . ")\n";
        if ($col['name'] === 'ad_id') {
            $hasAdId = true;
        }
    }
    
    if ($hasAdId) {
        echo "\nSUCCESS: 'ad_id' column exists.\n";
    } else {
        echo "\nFAILURE: 'ad_id' column is MISSING.\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

