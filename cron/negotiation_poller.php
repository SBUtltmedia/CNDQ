<?php
/**
 * Negotiation Poller (Cron Script)
 *
 * Polls all user-pair negotiations for agreements and creates transactions.
 * Should run every 30-60 seconds via cron.
 *
 * Cron entry example:
 * * * * * * cd /path/to/CNDQ && php cron/negotiation_poller.php >> logs/negotiation_poller.log 2>&1
 */

require_once __DIR__ . '/../lib/UserPairNegotiationManager.php';

$startTime = microtime(true);
$manager = new UserPairNegotiationManager();

echo "[" . date('Y-m-d H:i:s') . "] Starting negotiation polling...\n";

try {
    // Poll for agreements
    $agreements = $manager->pollForAgreements();

    if (!empty($agreements)) {
        echo "  ✓ Processed " . count($agreements) . " agreement(s):\n";
        foreach ($agreements as $negotiationId) {
            echo "    - $negotiationId\n";
        }
    } else {
        echo "  No agreements found.\n";
    }

    // Cleanup stale negotiations (run less frequently)
    // Only run on minute 0 (once per hour)
    if ((int)date('i') === 0) {
        echo "  Running stale negotiation cleanup...\n";
        $cleaned = $manager->cleanupStaleNegotiations();
        echo "  ✓ Cleaned up $cleaned stale negotiation(s)\n";
    }

    $duration = round((microtime(true) - $startTime) * 1000, 2);
    echo "[" . date('Y-m-d H:i:s') . "] Completed in {$duration}ms\n\n";

} catch (Exception $e) {
    echo "  ✗ ERROR: " . $e->getMessage() . "\n";
    echo "  Stack trace:\n" . $e->getTraceAsString() . "\n\n";
    exit(1);
}

exit(0);
