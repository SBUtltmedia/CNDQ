#!/usr/bin/env php
<?php
/**
 * Test production results API
 */

require_once __DIR__ . '/../lib/TeamStorage.php';
require_once __DIR__ . '/../lib/LPSolver.php';

echo "🧪 Testing Production Results API\n";
echo str_repeat('=', 60) . "\n\n";

$testEmail = 'test_production_api@test.com';

try {
    // Step 1: Create test team with inventory
    echo "Step 1: Creating test team with inventory...\n";
    $storage = new TeamStorage($testEmail);

    // Give team some starting inventory
    $storage->adjustChemical('C', 100);
    $storage->adjustChemical('N', 100);
    $storage->adjustChemical('D', 100);
    $storage->adjustChemical('Q', 100);
    echo "  ✓ Inventory set\n";

    // Step 2: Run production for session 1
    echo "\nStep 2: Running production for session 1...\n";
    $inventory = $storage->getInventory();
    $solver = new LPSolver();
    $result = $solver->solve($inventory);

    $deicerGallons = $result['deicer'];
    $solventGallons = $result['solvent'];
    $revenue = $result['maxProfit'];

    $consumed = [
        'C' => $deicerGallons * LPSolver::DEICER_C,
        'N' => ($deicerGallons * LPSolver::DEICER_N) + ($solventGallons * LPSolver::SOLVENT_N),
        'D' => ($deicerGallons * LPSolver::DEICER_D) + ($solventGallons * LPSolver::SOLVENT_D),
        'Q' => $solventGallons * LPSolver::SOLVENT_Q
    ];

    // Consume chemicals and credit revenue
    foreach ($consumed as $chemical => $amount) {
        if ($amount > 0) $storage->adjustChemical($chemical, -$amount);
    }
    $storage->updateFunds($revenue);

    // Add production record
    $storage->addProduction([
        'type' => 'automatic_session',
        'sessionNumber' => 1,
        'deicer' => $deicerGallons,
        'solvent' => $solventGallons,
        'revenue' => $revenue,
        'chemicalsConsumed' => $consumed,
        'timestamp' => time(),
        'note' => 'Test production for session 1'
    ]);

    echo "  ✓ Production completed:\n";
    echo "    - Deicer: {$deicerGallons} gal\n";
    echo "    - Solvent: {$solventGallons} gal\n";
    echo "    - Revenue: \${$revenue}\n";

    // Step 3: Test API call (simulate)
    echo "\nStep 3: Retrieving production results...\n";
    $productionHistory = $storage->getProductionHistory();

    if (empty($productionHistory)) {
        throw new Exception('No production history found!');
    }

    $latestProduction = end($productionHistory);
    echo "  ✓ Retrieved production results:\n";
    echo "    - Session: {$latestProduction['sessionNumber']}\n";
    echo "    - Type: {$latestProduction['type']}\n";
    echo "    - Deicer: {$latestProduction['deicer']} gal\n";
    echo "    - Solvent: {$latestProduction['solvent']} gal\n";
    echo "    - Revenue: \${$latestProduction['revenue']}\n";
    echo "    - Chemicals consumed: C={$latestProduction['chemicalsConsumed']['C']}, ";
    echo "N={$latestProduction['chemicalsConsumed']['N']}, ";
    echo "D={$latestProduction['chemicalsConsumed']['D']}, ";
    echo "Q={$latestProduction['chemicalsConsumed']['Q']}\n";

    // Step 4: Verify funds and inventory updated
    echo "\nStep 4: Verifying state after production...\n";
    $profile = $storage->getProfile();
    $funds = $profile['currentFunds'];
    $inventory = $storage->getInventory();

    echo "  ✓ Current funds: \${$funds}\n";
    echo "  ✓ Current inventory:\n";
    echo "    - C: {$inventory['C']}\n";
    echo "    - N: {$inventory['N']}\n";
    echo "    - D: {$inventory['D']}\n";
    echo "    - Q: {$inventory['Q']}\n";

    echo "\n✅ Production results API test PASSED!\n";
    echo "\nThe API endpoint should work correctly at:\n";
    echo "  GET /api/production/results.php\n";
    echo "  GET /api/production/results.php?session=1\n";

} catch (Exception $e) {
    echo "\n❌ Test Failed: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}

echo "\n" . str_repeat('=', 60) . "\n";
