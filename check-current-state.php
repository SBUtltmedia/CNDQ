<?php
/**
 * Check the CURRENT state of advertisements
 */

require_once __DIR__ . '/lib/AdvertisementManager.php';
require_once __DIR__ . '/lib/MarketplaceAggregator.php';

echo "=== CURRENT MARKETPLACE STATE ===\n";
echo "Timestamp: " . date('Y-m-d H:i:s') . "\n\n";

$ads = AdvertisementManager::getAdvertisementsByChemical();

echo "Buy Advertisements by Chemical:\n";
foreach (['C', 'N', 'D', 'Q'] as $chem) {
    $buyAds = $ads[$chem]['buy'] ?? [];
    echo "  Chemical {$chem}: " . count($buyAds) . " buy ads\n";
    foreach ($buyAds as $ad) {
        echo "    - {$ad['teamName']} (ID: {$ad['id']})\n";
        echo "      teamId: {$ad['teamId']}\n";
        echo "      status: {$ad['status']}\n";
    }
}

echo "\n=== API RESPONSE SIMULATION ===\n";
echo "What /api/advertisements/list.php returns:\n\n";

echo json_encode([
    'success' => true,
    'advertisements' => $ads
], JSON_PRETTY_PRINT);

echo "\n\n=== BROWSER INSTRUCTIONS ===\n";
echo "1. Open DevTools (F12)\n";
echo "2. Go to Console tab\n";
echo "3. Type: app.advertisements\n";
echo "4. Press Enter\n";
echo "5. Check if it shows the same data as above\n";
echo "\nIf it's different or undefined:\n";
echo "  - The frontend isn't loading the data\n";
echo "  - Check for JavaScript errors in Console\n";
echo "  - Check Network tab for /api/advertisements/list.php call\n";
echo "\n";
?>
