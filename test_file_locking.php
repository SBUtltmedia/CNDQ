<?php
/**
 * Demonstrates file locking behavior
 */

$testFile = __DIR__ . '/test_lock.txt';

// Create test file
file_put_contents($testFile, "Initial content\n");

echo "=== File Locking Demo ===\n\n";

// Simulate Process A holding a lock
echo "Process A: Opening file and acquiring lock...\n";
$fpA = fopen($testFile, 'c+');
if (flock($fpA, LOCK_EX)) {
    echo "Process A: Got lock! Writing...\n";
    fwrite($fpA, "Process A writes at " . time() . "\n");
    fflush($fpA);

    echo "Process A: Sleeping for 5 seconds (simulating slow operation)...\n";
    sleep(5);

    // Try to get lock in same process (this will fail)
    echo "\nProcess B (same script): Trying to get lock with LOCK_EX | LOCK_NB (non-blocking)...\n";
    $fpB = fopen($testFile, 'c+');
    if (flock($fpB, LOCK_EX | LOCK_NB)) {
        echo "Process B: Got lock! (This shouldn't happen)\n";
        flock($fpB, LOCK_UN);
    } else {
        echo "Process B: Lock is busy! (Returns FALSE immediately with LOCK_NB)\n";
        echo "Process B: If we didn't use LOCK_NB, we would WAIT here forever...\n";
    }
    fclose($fpB);

    echo "\nProcess A: Releasing lock...\n";
    flock($fpA, LOCK_UN);
    fclose($fpA);
    echo "Process A: Lock released!\n";
}

echo "\n=== Key Points ===\n";
echo "1. flock(\$fp, LOCK_EX) - Blocks (waits) until lock is available\n";
echo "2. flock(\$fp, LOCK_EX | LOCK_NB) - Returns FALSE immediately if busy\n";
echo "3. Locks auto-release when file closes or process terminates\n";
echo "4. Multiple processes can wait in line - they'll acquire lock in order\n";

// Cleanup
unlink($testFile);
