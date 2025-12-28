<?php
/**
 * Session Manager
 *
 * Manages game sessions (rounds) and phases:
 * - Production Phase: Automatic LP production runs for all teams
 * - Trading Phase: Market is open for trades
 */

class SessionManager {
    private $sessionFile;

    public function __construct() {
        $this->sessionFile = __DIR__ . '/../data/session_state.json';
        $this->ensureSessionFileExists();
    }

    private function ensureSessionFileExists() {
        if (!file_exists($this->sessionFile)) {
            $initialState = [
                'currentSession' => 1,
                'phase' => 'production', // 'production' or 'trading'
                'autoAdvance' => true, // DEFAULT: Auto-advance enabled for autonomous play
                'productionDuration' => 5, // Brief pause (5s) while auto-production runs
                'tradingDuration' => 60, // 1 minute for testing
                'phaseStartedAt' => time(),
                'history' => []
            ];

            $dir = dirname($this->sessionFile);
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }

            file_put_contents($this->sessionFile, json_encode($initialState, JSON_PRETTY_PRINT));
        }
    }

    /**
     * Get current session state
     */
    public function getState() {
        $data = json_decode(file_get_contents($this->sessionFile), true);

        // Ensure productionDuration exists (for backwards compatibility)
        if (!isset($data['productionDuration'])) {
            $data['productionDuration'] = 5;
        }

        // Calculate time remaining based on current phase
        if ($data['phase'] === 'production') {
            $elapsed = time() - $data['phaseStartedAt'];
            $data['timeRemaining'] = max(0, $data['productionDuration'] - $elapsed);

            // Auto-run production on first entry to production phase
            if ($data['autoAdvance'] && !isset($data['productionRun'])) {
                // Mark that we've run production for this phase
                $this->runAutoProduction();
            }

            // Auto-advance if time expired and auto-advance is enabled
            if ($data['autoAdvance'] && $data['timeRemaining'] === 0) {
                return $this->advancePhase();
            }
        }

        if ($data['phase'] === 'trading') {
            $elapsed = time() - $data['phaseStartedAt'];
            $data['timeRemaining'] = max(0, $data['tradingDuration'] - $elapsed);

            // Auto-advance if time expired and auto-advance is enabled
            if ($data['autoAdvance'] && $data['timeRemaining'] === 0) {
                return $this->advancePhase();
            }
        }

        return $data;
    }

    /**
     * Check if trading is currently allowed
     */
    public function isTradingAllowed() {
        $state = $this->getState();
        return $state['phase'] === 'trading';
    }

    /**
     * Check if production is currently allowed
     */
    public function isProductionAllowed() {
        $state = $this->getState();
        return $state['phase'] === 'production';
    }

    /**
     * Advance to next phase
     * Production -> Trading -> (new session) Production
     */
    public function advancePhase() {
        $fp = fopen($this->sessionFile, 'c+');
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            throw new Exception('Could not acquire lock on session file');
        }

        $data = json_decode(fread($fp, filesize($this->sessionFile) ?: 1), true);

        // Record history
        $data['history'][] = [
            'session' => $data['currentSession'],
            'phase' => $data['phase'],
            'endedAt' => time(),
            'duration' => time() - $data['phaseStartedAt']
        ];

        // Advance phase
        switch ($data['phase']) {
            case 'production':
                // Production -> Trading
                $data['phase'] = 'trading';
                // Clear production run flag
                unset($data['productionRun']);
                break;
            case 'trading':
                // Trading -> Next Session with Production phase
                $data['currentSession']++;
                $data['phase'] = 'production';
                // Clear production run flag for new session
                unset($data['productionRun']);
                break;
        }

        $data['phaseStartedAt'] = time();

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        return $data;
    }

    /**
     * Run automatic production for all teams
     * Called once when production phase starts with auto-advance enabled
     */
    private function runAutoProduction() {
        // Mark production as run for this phase
        $fp = fopen($this->sessionFile, 'c+');
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            return;
        }

        $data = json_decode(fread($fp, filesize($this->sessionFile) ?: 1), true);
        $data['productionRun'] = time();

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        // Scan all team directories and run production for each
        require_once __DIR__ . '/TeamStorage.php';
        require_once __DIR__ . '/LPSolver.php';

        $teamsDir = __DIR__ . '/../data/teams';
        if (!is_dir($teamsDir)) {
            error_log("Auto-production: teams directory not found");
            return;
        }

        $teamDirs = array_filter(glob($teamsDir . '/*'), 'is_dir');
        $teamsProcessed = 0;
        $totalRevenue = 0;
        $sessionNumber = $data['currentSession'];

        foreach ($teamDirs as $teamDir) {
            $email = basename($teamDir);

            try {
                $storage = new TeamStorage($email);
                $inventory = $storage->getInventory();

                // Skip teams with no inventory
                if (empty($inventory['C']) && empty($inventory['N']) &&
                    empty($inventory['D']) && empty($inventory['Q'])) {
                    continue;
                }

                // Run LP solver
                $solver = new LPSolver();
                $result = $solver->solve($inventory);

                $deicerGallons = $result['deicer'];
                $solventGallons = $result['solvent'];
                $revenue = $result['maxProfit'];

                // Skip if no production possible
                if ($revenue <= 0) {
                    continue;
                }

                // Calculate chemicals consumed
                $consumed = [
                    'C' => $deicerGallons * LPSolver::DEICER_C,
                    'N' => ($deicerGallons * LPSolver::DEICER_N) + ($solventGallons * LPSolver::SOLVENT_N),
                    'D' => ($deicerGallons * LPSolver::DEICER_D) + ($solventGallons * LPSolver::SOLVENT_D),
                    'Q' => $solventGallons * LPSolver::SOLVENT_Q
                ];

                // Update inventory (subtract consumed chemicals)
                $storage->updateInventory(function($inv) use ($consumed) {
                    $inv['C'] = max(0, $inv['C'] - $consumed['C']);
                    $inv['N'] = max(0, $inv['N'] - $consumed['N']);
                    $inv['D'] = max(0, $inv['D'] - $consumed['D']);
                    $inv['Q'] = max(0, $inv['Q'] - $consumed['Q']);
                    $inv['updatedAt'] = time();
                    // Don't increment transaction counter for automatic production
                    return $inv;
                });

                // Credit revenue to team
                $storage->updateProfile(function($profile) use ($revenue, $sessionNumber) {
                    $profile['currentFunds'] += $revenue;

                    // Set starting funds on first production (Session 1)
                    if ($sessionNumber == 1 && $profile['startingFunds'] == 0) {
                        $profile['startingFunds'] = $revenue;
                    }

                    return $profile;
                });

                // Record production in history
                $storage->addProduction([
                    'type' => 'automatic_session',
                    'sessionNumber' => $sessionNumber,
                    'deicer' => $deicerGallons,
                    'solvent' => $solventGallons,
                    'revenue' => $revenue,
                    'chemicalsConsumed' => $consumed,
                    'note' => "Automatic production for session $sessionNumber"
                ]);

                $teamsProcessed++;
                $totalRevenue += $revenue;

            } catch (Exception $e) {
                error_log("Auto-production failed for team $email: " . $e->getMessage());
            }
        }

        error_log("Auto-production completed for session $sessionNumber: $teamsProcessed teams, \$$totalRevenue total revenue");
    }

    /**
     * Set phase directly (admin override)
     */
    public function setPhase($phase) {
        if (!in_array($phase, ['production', 'trading'])) {
            throw new Exception('Invalid phase');
        }

        $fp = fopen($this->sessionFile, 'c+');
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            throw new Exception('Could not acquire lock');
        }

        $data = json_decode(fread($fp, filesize($this->sessionFile) ?: 1), true);
        $data['phase'] = $phase;
        $data['phaseStartedAt'] = time();

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        return $data;
    }

    /**
     * Toggle auto-advance
     */
    public function setAutoAdvance($enabled) {
        $fp = fopen($this->sessionFile, 'c+');
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            throw new Exception('Could not acquire lock');
        }

        $data = json_decode(fread($fp, filesize($this->sessionFile) ?: 1), true);
        $data['autoAdvance'] = (bool)$enabled;

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        return $data;
    }

    /**
     * Set production duration (in seconds)
     */
    public function setProductionDuration($seconds) {
        $fp = fopen($this->sessionFile, 'c+');
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            throw new Exception('Could not acquire lock');
        }

        $data = json_decode(fread($fp, filesize($this->sessionFile) ?: 1), true);
        $data['productionDuration'] = (int)$seconds;

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        return $data;
    }

    /**
     * Set trading duration (in seconds)
     */
    public function setTradingDuration($seconds) {
        $fp = fopen($this->sessionFile, 'c+');
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            throw new Exception('Could not acquire lock');
        }

        $data = json_decode(fread($fp, filesize($this->sessionFile) ?: 1), true);
        $data['tradingDuration'] = (int)$seconds;

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        return $data;
    }

    /**
     * Reset to session 1
     */
    public function reset() {
        $fp = fopen($this->sessionFile, 'c+');
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            throw new Exception('Could not acquire lock');
        }

        $data = [
            'currentSession' => 1,
            'phase' => 'production',
            'autoAdvance' => false,
            'productionDuration' => 5,
            'tradingDuration' => 60,
            'phaseStartedAt' => time(),
            'history' => []
        ];

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        return $data;
    }
}
