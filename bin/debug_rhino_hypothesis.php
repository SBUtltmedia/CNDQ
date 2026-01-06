<?php
require_once __DIR__ . '/../lib/LPSolver.php';
$solver = new LPSolver();

// Hypothesis: Low Q case
$inventory = ['C' => 1000, 'N' => 10, 'D' => 1000, 'Q' => 0];
echo "--- Low Q Case ---
";
$result = $solver->solve($inventory);
print_r($result);

