#!/usr/bin/env php
<?php
/**
 * Test MarketplaceAggregator to see if it can find buy orders
 */

require_once __DIR__ . '/lib/MarketplaceAggregator.php';

echo "=== MarketplaceAggregator Test ===\n\n";

$aggregator = new MarketplaceAggregator();

// Get all buy orders
$allBuyOrders = $aggregator->getActiveBuyOrders();
echo "1. Total Active Buy Orders: " . count($allBuyOrders) . "\n";

foreach ($allBuyOrders as $buyOrder) {
    echo "   - {$buyOrder['buyerName']} ({$buyOrder['buyerId']})\n";
    echo "     Chemical: {$buyOrder['chemical']}\n";
    echo "     Quantity: {$buyOrder['quantity']}\n";
    echo "     Max Price: \${$buyOrder['maxPrice']}\n";
    echo "     Status: {$buyOrder['status']}\n\n";
}

// Get buy orders by chemical
$buyOrdersByChemical = $aggregator->getBuyOrdersByChemical();
echo "\n2. Buy Orders by Chemical:\n";
foreach (['C', 'N', 'D', 'Q'] as $chem) {
    $count = count($buyOrdersByChemical[$chem] ?? []);
    echo "   $chem: $count buy orders\n";
    foreach (($buyOrdersByChemical[$chem] ?? []) as $order) {
        echo "      * {$order['buyerName']}: {$order['quantity']} gal @ \${$order['maxPrice']}/gal\n";
    }
}

echo "\n=== End Test ===\n";
