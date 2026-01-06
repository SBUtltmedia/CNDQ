<?php
require_once __DIR__ . '/../lib/LPSolver.php';

$solver = new LPSolver();

// Daring Rhino Inventory
$inventory = ['C' => 1288, 'N' => 843, 'D' => 1993, 'Q' => 1682];
echo "--- Daring Rhino Case ---
";
$result = $solver->solve($inventory);
print_r($result);

