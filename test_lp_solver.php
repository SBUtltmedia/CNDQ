<?php
/**
 * Test script for LP Solver
 * Verifies that the LP solver produces correct shadow prices
 */

require_once __DIR__ . '/lib/LPSolver.php';

echo "=== LP Solver Test ===\n\n";

// Test Case 1: Balanced inventory
$inventory1 = ['C' => 1000, 'N' => 1000, 'D' => 1000, 'Q' => 1000];
echo "Test 1: Balanced inventory (1000 of each)\n";
echo "Inventory: C=1000, N=1000, D=1000, Q=1000\n";

$solver = new LPSolver();
$result1 = $solver->getShadowPrices($inventory1);

echo "\nOptimal Production Mix:\n";
echo "  Deicer:  " . $result1['optimalMix']['deicer'] . " gallons\n";
echo "  Solvent: " . $result1['optimalMix']['solvent'] . " gallons\n";
echo "\nMaximum Profit: $" . number_format($result1['maxProfit'], 2) . "\n";
echo "\nShadow Prices (marginal value per gallon):\n";
echo "  C: $" . number_format($result1['shadowPrices']['C'], 2) . "\n";
echo "  N: $" . number_format($result1['shadowPrices']['N'], 2) . "\n";
echo "  D: $" . number_format($result1['shadowPrices']['D'], 2) . "\n";
echo "  Q: $" . number_format($result1['shadowPrices']['Q'], 2) . "\n";

echo "\n" . str_repeat("-", 50) . "\n\n";

// Test Case 2: Low C inventory (C is scarce)
$inventory2 = ['C' => 500, 'N' => 1000, 'D' => 1000, 'Q' => 1000];
echo "Test 2: Low C inventory (scarcity)\n";
echo "Inventory: C=500, N=1000, D=1000, Q=1000\n";

$result2 = $solver->getShadowPrices($inventory2);

echo "\nOptimal Production Mix:\n";
echo "  Deicer:  " . $result2['optimalMix']['deicer'] . " gallons\n";
echo "  Solvent: " . $result2['optimalMix']['solvent'] . " gallons\n";
echo "\nMaximum Profit: $" . number_format($result2['maxProfit'], 2) . "\n";
echo "\nShadow Prices:\n";
echo "  C: $" . number_format($result2['shadowPrices']['C'], 2) . " (should be HIGH - C is scarce)\n";
echo "  N: $" . number_format($result2['shadowPrices']['N'], 2) . "\n";
echo "  D: $" . number_format($result2['shadowPrices']['D'], 2) . "\n";
echo "  Q: $" . number_format($result2['shadowPrices']['Q'], 2) . "\n";

echo "\n" . str_repeat("-", 50) . "\n\n";

// Test Case 3: After a trade (sold 200g of C)
$inventory3 = ['C' => 800, 'N' => 1000, 'D' => 1000, 'Q' => 1000];
echo "Test 3: After selling C (inventory changed)\n";
echo "Inventory: C=800, N=1000, D=1000, Q=1000\n";

$result3 = $solver->getShadowPrices($inventory3);

echo "\nOptimal Production Mix:\n";
echo "  Deicer:  " . $result3['optimalMix']['deicer'] . " gallons\n";
echo "  Solvent: " . $result3['optimalMix']['solvent'] . " gallons\n";
echo "\nMaximum Profit: $" . number_format($result3['maxProfit'], 2) . "\n";
echo "\nShadow Prices:\n";
echo "  C: $" . number_format($result3['shadowPrices']['C'], 2) . "\n";
echo "  N: $" . number_format($result3['shadowPrices']['N'], 2) . "\n";
echo "  D: $" . number_format($result3['shadowPrices']['D'], 2) . "\n";
echo "  Q: $" . number_format($result3['shadowPrices']['Q'], 2) . "\n";

echo "\n" . str_repeat("-", 50) . "\n\n";

// Verify shadow price changes
echo "Shadow Price Comparison (demonstrating staleness):\n";
echo "When C changes from 1000 → 800:\n";
echo "  C shadow price changed: $" . number_format($result1['shadowPrices']['C'], 2) .
     " → $" . number_format($result3['shadowPrices']['C'], 2) .
     " (" . ($result3['shadowPrices']['C'] > $result1['shadowPrices']['C'] ? "INCREASED" : "DECREASED") . ")\n";

echo "\nThis demonstrates why students must recalculate after trades!\n";

echo "\n=== Test Complete ===\n";
