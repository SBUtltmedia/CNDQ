#!/usr/bin/env php
<?php
/**
 * Debug test to trace initial production logic
 */

require_once __DIR__ . '/../lib/SessionManager.php';

echo "Debug: Testing initial production check\n";
echo "========================================\n\n";

$manager = new SessionManager();

echo "Step 1: Calling getState()...\n";
$state = $manager->getState();

echo "Step 2: Checking state contents:\n";
echo "  - currentSession: {$state['currentSession']}\n";
echo "  - initialProductionRun isset: " . (isset($state['initialProductionRun']) ? 'YES' : 'NO') . "\n";
echo "  - initialProductionRun value: " . ($state['initialProductionRun'] ?? 'NOT SET') . "\n";

if (!isset($state['initialProductionRun'])) {
    echo "\n❌ Initial production did NOT run (flag not set)\n";
} else {
    echo "\n✅ Initial production flag is set to: {$state['initialProductionRun']}\n";
}

echo "\n========================================\n";
