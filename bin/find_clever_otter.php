#!/usr/bin/env php
<?php
require_once __DIR__ . '/../lib/TeamStorage.php';
require_once __DIR__ . '/../lib/Database.php';

$db = Database::getInstance();
$teams = $db->query('SELECT DISTINCT team_email FROM team_events');

echo "Searching for Clever/Otter teams...\n";
foreach ($teams as $row) {
    $storage = new TeamStorage($row['team_email']);
    $profile = $storage->getProfile();
    $teamName = $profile['teamName'] ?? 'Unknown';
    if (strpos($teamName, 'Clever') !== false || strpos($teamName, 'Otter') !== false) {
        echo "  Found: $teamName ({$row['team_email']})\n";

        // Check their buy orders
        $state = $storage->getState();
        $buyOrders = $state['buyOrders'] ?? [];
        if (!empty($buyOrders)) {
            echo "    Buy orders:\n";
            foreach ($buyOrders as $order) {
                echo "      - {$order['quantity']} gal of {$order['chemical']} at \${$order['maxPrice']}/gal max\n";
            }
        } else {
            echo "    No buy orders\n";
        }

        // Check their inventory
        $inventory = $state['inventory'] ?? [];
        echo "    Inventory: C={$inventory['C']}, N={$inventory['N']}, D={$inventory['D']}, Q={$inventory['Q']}\n";
    }
}
