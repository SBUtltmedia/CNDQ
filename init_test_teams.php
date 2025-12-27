<?php
/**
 * Initialize test teams for development
 * Creates 5 test teams with starting inventory and funds
 */

require_once __DIR__ . '/lib/TeamStorage.php';

echo "Initializing test teams...\n\n";

$testTeams = [
    'team1@example.com' => 'Alpha Team',
    'team2@example.com' => 'Beta Team',
    'team3@example.com' => 'Gamma Team',
    'team4@example.com' => 'Delta Team',
    'team5@example.com' => 'Epsilon Team'
];

foreach ($testTeams as $email => $teamName) {
    try {
        echo "Creating: $teamName ($email)... ";

        $storage = new TeamStorage($email);

        // Set team name
        $storage->setTeamName($teamName);

        // Set starting funds
        $storage->setFunds(10000);

        // Set inventory (varied amounts for testing)
        $storage->updateInventory(function($inv) use ($email) {
            // Give different teams different starting inventory
            $multiplier = (int)substr($email, 4, 1); // Extract number from email
            $inv['C'] = 800 + ($multiplier * 50);
            $inv['N'] = 700 + ($multiplier * 40);
            $inv['D'] = 600 + ($multiplier * 30);
            $inv['Q'] = 500 + ($multiplier * 20);
            $inv['transactionsSinceLastShadowCalc'] = 0;
            return $inv;
        });

        echo "✓ SUCCESS\n";

        // Show inventory
        $inv = $storage->getInventory();
        echo "  Inventory: C={$inv['C']}, N={$inv['N']}, D={$inv['D']}, Q={$inv['Q']}\n";

    } catch (Exception $e) {
        echo "✗ ERROR: " . $e->getMessage() . "\n";
    }
}

echo "\n✅ Test teams initialized!\n";
echo "\nYou can now test with:\n";
echo "- http://localhost/CNDQ/test_apis.php\n";
echo "- Or use cookie override: document.cookie = 'mock_mail=team2@example.com'\n";
