<?php
/**
 * Test shadow price calculation with depleted inventory
 */

require_once __DIR__ . '/lib/LPSolver.php';

echo "=== Testing Shadow Prices with Depleted Inventory ===\n\n";

// Current inventory for test_mail1@stonybrook.edu
$inventory = [
    'C' => 90.91,
    'N' => 0.001,  // Nearly depleted
    'D' => 0.001,  // Nearly depleted
    'Q' => 272.73
];

echo "Current Inventory:\n";
echo "  C: {$inventory['C']}\n";
echo "  N: {$inventory['N']}\n";
echo "  D: {$inventory['D']}\n";
echo "  Q: {$inventory['Q']}\n\n";

$solver = new LPSolver();

// Check baseline production
$baseline = $solver->solve($inventory);
echo "Baseline Production:\n";
echo "  Deicer: {$baseline['deicer']} gallons\n";
echo "  Solvent: {$baseline['solvent']} gallons\n";
echo "  Profit: \${$baseline['maxProfit']}\n\n";

// Calculate shadow prices
$result = $solver->getShadowPrices($inventory);
echo "Shadow Prices (Finite Difference Method):\n";
echo "  C: \${$result['shadowPrices']['C']}\n";
echo "  N: \${$result['shadowPrices']['N']}\n";
echo "  D: \${$result['shadowPrices']['D']}\n";
echo "  Q: \${$result['shadowPrices']['Q']}\n\n";

// Now test with 1 more gallon of N
$inventoryPlusN = $inventory;
$inventoryPlusN['N'] += 1.0;
$resultPlusN = $solver->solve($inventoryPlusN);
echo "With +1 gallon of N:\n";
echo "  Deicer: {$resultPlusN['deicer']} gallons\n";
echo "  Solvent: {$resultPlusN['solvent']} gallons\n";
echo "  Profit: \${$resultPlusN['maxProfit']}\n";
echo "  Profit increase: \$" . ($resultPlusN['maxProfit'] - $baseline['maxProfit']) . "\n\n";

// Now test with 1 more gallon of D
$inventoryPlusD = $inventory;
$inventoryPlusD['D'] += 1.0;
$resultPlusD = $solver->solve($inventoryPlusD);
echo "With +1 gallon of D:\n";
echo "  Deicer: {$resultPlusD['deicer']} gallons\n";
echo "  Solvent: {$resultPlusD['solvent']} gallons\n";
echo "  Profit: \${$resultPlusD['maxProfit']}\n";
echo "  Profit increase: \$" . ($resultPlusD['maxProfit'] - $baseline['maxProfit']) . "\n\n";

// Test with healthy inventory
echo "\n=== Testing with Healthy Inventory ===\n\n";
$healthyInventory = [
    'C' => 1000,
    'N' => 1000,
    'D' => 1000,
    'Q' => 1000
];

echo "Healthy Inventory:\n";
echo "  C: {$healthyInventory['C']}\n";
echo "  N: {$healthyInventory['N']}\n";
echo "  D: {$healthyInventory['D']}\n";
echo "  Q: {$healthyInventory['Q']}\n\n";

$healthyResult = $solver->getShadowPrices($healthyInventory);
echo "Shadow Prices:\n";
echo "  C: \${$healthyResult['shadowPrices']['C']}\n";
echo "  N: \${$healthyResult['shadowPrices']['N']}\n";
echo "  D: \${$healthyResult['shadowPrices']['D']}\n";
echo "  Q: \${$healthyResult['shadowPrices']['Q']}\n\n";

echo "Max Profit: \${$healthyResult['maxProfit']}\n";
