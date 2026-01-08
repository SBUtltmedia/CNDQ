<?php
/**
 * THE WORLD TURNER
 * 
 * This script is the heartbeat of the CNDQ simulation.
 * It is the "Admin" process that:
 * 1. Aggregates the Marketplace into a cached snapshot.
 * 2. Checks the Session Timer and runs Production/Advances Session.
 * 3. Runs NPC Trading Logic.
 * 
 * Usage: php bin/world_turner.php
 */

require_once __DIR__ . '/../lib/SessionManager.php';

// Set unlimited execution time
set_time_limit(0);

$sessionManager = new SessionManager();

echo "[" . date('Y-m-d H:i:s') . "] World Turner started.\n";

while (true) {
    $loopStart = microtime(true);
    
    try {
        // --- THE UNIFIED TICK ---
        $sessionManager->rotateWorld();

    } catch (Exception $e) {
        echo "[" . date('Y-m-d H:i:s') . "] ERROR: " . $e->getMessage() . "\n";
        // Continue loop despite errors
    }
    
    // Sleep to prevent CPU thrashing (1 second tick)
    $elapsed = microtime(true) - $loopStart;
    $sleepTime = max(0, 1000000 - ($elapsed * 1000000)); // 1 second - elapsed
    usleep((int)$sleepTime);
    
    // Optional: Echo a dot to show life every 10 ticks
    static $tick = 0;
    if (++$tick % 10 === 0) {
        echo ".";
    }
}
