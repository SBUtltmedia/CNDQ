<?php
require_once __DIR__ . '/../lib/Database.php';

try {
    $db = Database::getInstance();
    
    // Check if column exists
    $cols = $db->query("PRAGMA table_info(marketplace_snapshot)");
    $hasColumn = false;
    foreach ($cols as $col) {
        if ($col['name'] === 'recent_trades') {
            $hasColumn = true;
            break;
        }
    }

    if (!$hasColumn) {
        echo "Adding missing column 'recent_trades'...
";
        $db->execute("ALTER TABLE marketplace_snapshot ADD COLUMN recent_trades TEXT DEFAULT '[]'");
        echo "Column added successfully.
";
    } else {
        echo "Column 'recent_trades' already exists.
";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}

