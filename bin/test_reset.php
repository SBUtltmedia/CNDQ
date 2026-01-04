<?php
/**
 * Test the reset-game functionality
 */

// Simulate POST request and admin
$_SERVER['REQUEST_METHOD'] = 'POST';
$_COOKIE['mock_mail'] = 'admin@stonybrook.edu';

// Capture output
ob_start();
require __DIR__ . '/../api/admin/reset-game.php';
$output = ob_get_clean();

echo "Reset API Response:\n";
echo $output . "\n";

// Check database stats
require __DIR__ . '/../lib/Database.php';
$db = Database::getInstance();
$stats = $db->getStats();

echo "\nDatabase Statistics After Reset:\n";
echo "Size: " . $stats['size_mb'] . " MB\n";
echo "Tables:\n";
foreach ($stats['tables'] as $table => $count) {
    echo "  - $table: $count rows\n";
}
