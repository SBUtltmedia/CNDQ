================================================================                
NO-M ARCHITECTURE PHILOSOPHY: FILESYSTEM-AS-STATE
================================================================

1. CORE PHILOSOPHY
The "No-M" model rejects the traditional Relational Database (the 'M' in LAMP) 
in favor of OS-Native Data Management. By leveraging the filesystem as a 
high-performance, hierarchical key-value store, we eliminate the overhead 
of RDBMS management while gaining native concurrency and security.

- Sovereignty: Every user is a directory; every data point is a file. 
  This maps 1:1 to identity providers like Shibboleth (EPPN).
- Atomic Isolation: Write-conflicts are physically impossible because 
  users only ever write to their own isolated namespaces.
- Event Sourcing: Instead of updating a single row, clients emit "events" 
  (JSON payloads). This provides a natural audit log and state recovery.
- Zero Migration: The schema is the directory structure. Evolving data 
  structures requires no "alter table" commands—only logic updates in 
  the aggregator.

2. INFRASTRUCTURE MAPPING
----------------------------------------------------------------
Component       | Implementation               | Role
----------------|------------------------------|----------------
Identity        | $_SERVER['REMOTE_USER']      | Primary Key
Storage         | Linux Filesystem (XFS/EXT4)  | The Database
Table           | User Directory (/data/eppn/) | Namespace
Row/Key         | JSON File (time_event.json)  | Discrete Data
Index           | PHP glob() / scandir()       | Query Engine
----------------------------------------------------------------

3. THE REDUCTION FUNCTION (THE AGGREGATOR)
The "Aggregator" is the brain of the system. It crawls the user 
directories, treats individual files as a stream of events, and 
reduces them into a single, authoritative state object.

<?php
/**
 * Reducer: Aggregates distributed JSON events into a single Game State.
 */
function aggregateGameState(string $storagePath): array {
    $gameState = [
        'last_update' => 0,
        'players' => [],
        'events_processed' => 0,
        'recent_messages' => []
    ];

    // 1. Get all user directories (EPPNs)
    $userDirs = array_filter(glob($storagePath . '/*'), 'is_dir');

    foreach ($userDirs as $dir) {
        $eppn = basename($dir);
        
        // Initialize player in state
        if (!isset($gameState['players'][$eppn])) {
            $gameState['players'][$eppn] = ['pos' => [0,0], 'score' => 0];
        }
        
        // 2. Fetch all JSON files in this user's namespace
        // Sorting ensures chronological order
        $events = glob("$dir/*.json");
        sort($events); 

        foreach ($events as $file) {
            $content = file_get_contents($file);
            $payload = json_decode($content, true);

            if ($payload) {
                // 3. Reduction Logic (State Machine)
                $type = $payload['type'] ?? 'generic';
                
                switch ($type) {
                    case 'move':
                        $gameState['players'][$eppn]['pos'] = $payload['coords'];
                        break;
                    case 'score':
                        $gameState['players'][$eppn]['score'] += $payload['value'];
                        break;
                    case 'chat':
                        $gameState['recent_messages'][] = [
                            'user' => $eppn,
                            'msg' => $payload['text']
                        ];
                        break;
                }
                
                $gameState['events_processed']++;
                $gameState['last_update'] = max($gameState['last_update'], filemtime($file));
            }
        }
    }
    return $gameState;
}
?>

4. PERFORMANCE & SCALING STRATEGY
To ensure the system handles polling efficiently (~100 users):

- State Caching: The aggregator should only run if the filesystem has 
  changed. Compare the mtime of the root directory with the mtime 
  of a 'cached_state.json'.
- Atomic Writes: To prevent reading a half-written file, the UI emission 
  script must use rename():
    
    $tmp = tempnam($userDir, 'tmp_');
    file_put_contents($tmp, $jsonData);
    rename($tmp, $userDir . "/event_" . microtime(true) . ".json");

- In-Memory Optimization: On Linux, these small files will reside in 
  the Page Cache, meaning the "Aggregation" is effectively happening 
  in RAM, not on physical disk platters.

5. SECURITY
- Directory access is governed by the PHP user, but namespaces are 
  enforced by the 'eppn' derived from the Shibboleth session.
- Users cannot overwrite other users' files because the file path 
  is constructed strictly from the validated session variable.

6. THE SHUT-IN & THE WORLD TURNER (OPTIMIZED FLOW)
To solve performance bottlenecks (O(N) scanning per user), we adopt the 
"Shut-In" model for users and a "World Turner" role for the Admin.

A. The "Shut-In" (User)
The user is like a shut-in who never leaves their room (directory).
- **View:** They verify ONLY their own state (`data/teams/<eppn>/`) and a 
  cached "Window to the World" (`data/public_market_snapshot.json`).
- **Action:** They never calculate the world state. They push "Intention Slips" 
  (Event JSONs) under the door into the hallway (Shared Event Log).
- **Delivery:** Results (Profit, Production) are slid under their door 
  by the World Turner.

B. The "World Turner" (Admin/Cron)
A special, singleton process that makes the world spin.
- **Responsibility:**
  1.  **Aggregates:** Scans the hallway (Shared Events), builds the 
      `public_market_snapshot.json`, and updates `market_stats.json`.
  2.  **Executes:** Matches trades if clearing logic is centralized.
  3.  **Produces:** When the session timer expires, IT runs the `LPSolver` 
      for everyone and deposits "Production Result" events into user folders.
  4.  **Advances:** Updates `session_state.json`.

This ensures that 100 users hitting the site results in 100 simple 
JSON reads, not 100 global directory scans.
================================================================