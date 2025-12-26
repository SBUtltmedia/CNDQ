<?php
/**
 * Logic to run automatic production for all users
 * NOW DECENTRALIZED: Iterates through user folders
 */

require_once 'fileHelpers.php';
require_once 'userData.php';

function runAutomaticProduction() {
    $dataDir = __DIR__ . '/data/users';
    $users = glob($dataDir . '/*', GLOB_ONLYDIR);
    
    $results = [];

    foreach ($users as $userDir) {
        // Safe email is the directory name
        $safeEmail = basename($userDir);
        // We can reconstruct the real email if we stored it in the JSON, which we should have.
        // Or we just update based on file path.
        
        $filePath = $userDir . '/data.json';
        if (!file_exists($filePath)) continue;

        updateJsonFile($filePath, function($userData) {
            // Use current inventory for production
            $inv = $userData['inventory'] ?? ['C'=>0,'N'=>0,'D'=>0,'Q'=>0];
            
            // Solver Logic (Simplex / Corner Points for 2 variables)
            $bestProfit = -1;
            $bestD = 0;
            $bestS = 0;
            
            $C = $inv['C'] ?? 0;
            $N = $inv['N'] ?? 0;
            $D = $inv['D'] ?? 0;
            $Q = $inv['Q'] ?? 0;
            
            // Constraints:
            // 0.5d <= C
            // 0.3d + 0.25s <= N
            // 0.2d + 0.35s <= D
            // 0.4s <= Q
            $lines = [
                ['a' => 1, 'b' => 0, 'c' => 0], // d=0
                ['a' => 0, 'b' => 1, 'c' => 0], // s=0
                ['a' => 0.5, 'b' => 0, 'c' => $C],
                ['a' => 0.3, 'b' => 0.25, 'c' => $N],
                ['a' => 0.2, 'b' => 0.35, 'c' => $D],
                ['a' => 0, 'b' => 0.4, 'c' => $Q]
            ];
            
            $points = [];
            for ($i = 0; $i < count($lines); $i++) {
                for ($j = $i + 1; $j < count($lines); $j++) {
                    $l1 = $lines[$i];
                    $l2 = $lines[$j];
                    $det = $l1['a'] * $l2['b'] - $l2['a'] * $l1['b'];
                    if (abs($det) < 1e-9) continue;
                    $d = ($l1['c'] * $l2['b'] - $l2['c'] * $l1['b']) / $det;
                    $s = ($l1['a'] * $l2['c'] - $l2['a'] * $l1['c']) / $det;
                    $points[] = ['d' => $d, 's' => $s];
                }
            }
            
            foreach ($points as $p) {
                $d = $p['d']; $s = $p['s'];
                if ($d < -1e-5 || $s < -1e-5) continue;
                if (0.5 * $d > $C + 1e-5) continue;
                if (0.3 * $d + 0.25 * $s > $N + 1e-5) continue;
                if (0.2 * $d + 0.35 * $s > $D + 1e-5) continue;
                if (0.4 * $s > $Q + 1e-5) continue;
                
                $profit = ($d * 100) + ($s * 60);
                if ($profit > $bestProfit) {
                    $bestProfit = $profit;
                    $bestD = $d;
                    $bestS = $s;
                }
            }
            
            // Floor to discrete units (drums)
            $d = floor(max(0, $bestD));
            $s = floor(max(0, $bestS));
            
            // Update Inventory (subtract used materials)
            $userData['inventory']['C'] -= (0.5 * $d);
            $userData['inventory']['N'] -= (0.3 * $d + 0.25 * $s);
            $userData['inventory']['D'] -= (0.2 * $d + 0.35 * $s);
            $userData['inventory']['Q'] -= (0.4 * $s);
            
            // Ensure no negative inventory due to rounding
            foreach($userData['inventory'] as &$val) $val = max(0, $val);

            // Record results
            $profit = ($d * 100) + ($s * 60);
            $userData['lastProduction'] = [
                'deicer' => $d,
                'solvent' => $s,
                'revenue' => $profit,
                'timestamp' => time()
            ];
            
            // Update Bank Account (Starting Fund)
            $userData['startingFund'] += $profit;
            
            return $userData;
        });
        
        $results[] = $safeEmail;
    }
    return $results;
}

if (basename($_SERVER['PHP_SELF']) == 'executeAutomaticProduction.php') {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $res = runAutomaticProduction();
        echo json_encode(['success' => true, 'updated_users' => $res]);
    }
}