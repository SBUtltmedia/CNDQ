<?php
/**
 * Test script for auto-production functionality
 */

require_once __DIR__ . '/lib/SessionManager.php';
require_once __DIR__ . '/lib/TeamStorage.php';

echo "=== Testing Auto-Production ===\n\n";

// Get initial state
$sessionMgr = new SessionManager();
$state = $sessionMgr->getState();

echo "Current Session: " . $state['currentSession'] . "\n";
echo "Current Phase: " . $state['phase'] . "\n";
echo "Auto-advance: " . ($state['autoAdvance'] ? 'enabled' : 'disabled') . "\n\n";

// Check a sample team's state before
$sampleTeam = 'test_mail1@stonybrook.edu';
echo "Checking team: $sampleTeam\n";

$storage = new TeamStorage($sampleTeam);
$inventory = $storage->getInventory();
$profile = $storage->getProfile();
$history = $storage->getProductionHistory();

echo "Before:\n";
echo "  Inventory: C={$inventory['C']}, N={$inventory['N']}, D={$inventory['D']}, Q={$inventory['Q']}\n";
echo "  Funds: \${$profile['currentFunds']}\n";
echo "  Production records: " . count($history['productions']) . "\n\n";

// Enable auto-advance and set to production phase
echo "Enabling auto-advance...\n";
$sessionMgr->setAutoAdvance(true);

echo "Advancing phase...\n";
$newState = $sessionMgr->advancePhase();
echo "  -> Session: " . $newState['currentSession'] . ", Phase: " . $newState['phase'] . "\n";

// Keep advancing until we reach production phase (Trading -> Closed -> Production)
while ($newState['phase'] !== 'production') {
    echo "Advancing to production phase (current: {$newState['phase']})...\n";
    $newState = $sessionMgr->advancePhase();
    echo "  -> Session: " . $newState['currentSession'] . ", Phase: " . $newState['phase'] . "\n";
}

// Trigger getState() which should run auto-production
echo "\nTriggering getState() to run auto-production...\n";
$finalState = $sessionMgr->getState();
echo "Final state: Session {$finalState['currentSession']}, Phase: {$finalState['phase']}\n";

// Check if productionRun flag was set
if (isset($finalState['productionRun'])) {
    echo "Production timestamp: " . date('Y-m-d H:i:s', $finalState['productionRun']) . "\n";
}

// Check the team's state after
echo "\nChecking team: $sampleTeam after production\n";
$inventory = $storage->getInventory();
$profile = $storage->getProfile();
$history = $storage->getProductionHistory();

echo "After:\n";
echo "  Inventory: C={$inventory['C']}, N={$inventory['N']}, D={$inventory['D']}, Q={$inventory['Q']}\n";
echo "  Funds: \${$profile['currentFunds']}\n";
echo "  Production records: " . count($history['productions']) . "\n";

if (!empty($history['productions'])) {
    echo "\nLatest production record:\n";
    $latest = end($history['productions']);
    echo "  Type: {$latest['type']}\n";
    echo "  Session: {$latest['sessionNumber']}\n";
    echo "  Deicer: {$latest['deicer']} gallons\n";
    echo "  Solvent: {$latest['solvent']} gallons\n";
    echo "  Revenue: \${$latest['revenue']}\n";
}

echo "\n=== Test Complete ===\n";
