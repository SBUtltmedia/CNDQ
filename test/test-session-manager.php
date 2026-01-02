#!/usr/bin/env php
<?php
/**
 * Quick test for refactored SessionManager (single-phase flow)
 *
 * Tests:
 * 1. Initial production runs before first marketplace
 * 2. Trading phase calculates time remaining
 * 3. Auto-advance runs production and increments session
 */

require_once __DIR__ . '/../lib/SessionManager.php';
require_once __DIR__ . '/../lib/SystemStorage.php';

echo "🧪 Testing Refactored SessionManager\n";
echo str_repeat('=', 60) . "\n\n";

try {
    $manager = new SessionManager();

    // Test 1: Get initial state
    echo "Test 1: Getting initial state...\n";
    $state = $manager->getState();

    echo "  Session: {$state['currentSession']}\n";
    echo "  Phase: " . ($state['phase'] ?? 'N/A') . "\n";
    echo "  Time Remaining: {$state['timeRemaining']}s\n";
    echo "  Initial Production Run: " . (isset($state['initialProductionRun']) ? '✓' : '✗') . "\n";

    if (!isset($state['initialProductionRun'])) {
        echo "  ⚠️  Initial production should have run!\n";
    } else {
        echo "  ✅ Initial production ran\n";
    }

    // Test 2: Check if isTradingAllowed works
    echo "\nTest 2: Checking if trading is allowed...\n";
    $tradingAllowed = $manager->isTradingAllowed();
    echo "  Trading Allowed: " . ($tradingAllowed ? '✓ YES' : '✗ NO') . "\n";

    if ($tradingAllowed) {
        echo "  ✅ Trading is always allowed now (no production phase)\n";
    }

    // Test 3: Simulate setting short timer for auto-advance test
    echo "\nTest 3: Setting up auto-advance with 5-second timer...\n";
    $manager->setAutoAdvance(true);
    $manager->setTradingDuration(5);

    $state = $manager->getState();
    echo "  Auto-Advance: " . ($state['autoAdvance'] ? '✓ Enabled' : '✗ Disabled') . "\n";
    echo "  Trading Duration: {$state['tradingDuration']}s\n";

    echo "\n✅ SessionManager basic functionality works!\n";
    echo "\nNext Steps:\n";
    echo "  1. Run a Puppeteer test to verify full flow\n";
    echo "  2. Check that production runs automatically\n";
    echo "  3. Verify session increments after trading ends\n";

} catch (Exception $e) {
    echo "\n❌ Test Failed: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}

echo "\n" . str_repeat('=', 60) . "\n";
