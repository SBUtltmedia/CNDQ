<?php
require_once __DIR__ . '/../lib/LPSolver.php';
$solver = new LPSolver();

// Hypothesis: Q=0, N=0, but plenty of C and D
$inventory = ['C' => 1000, 'N' => 0, 'D' => 1000, 'Q' => 0];
echo "--- Q=0, N=0 Case ---
";
$result = $solver->solve($inventory);
print_r($result);

