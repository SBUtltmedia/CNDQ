<?php
/**
 * Session Manager - Refactored for No-M (Filesystem-as-State)
 * 
 * Now uses SystemStorage to manage session state via events in data/teams/system/
 */

require_once __DIR__ . '/SystemStorage.php';

class SessionManager {
    private $storage;

    public function __construct() {
        $this->storage = new SystemStorage();
    }

    /**
     * Get current session state
     */
    public function getState() {
        $data = $this->storage->getSystemState();

        // Helper function to calculate time remaining
        $calculateTimeRemaining = function(&$data) {
            $elapsed = time() - $data['phaseStartedAt'];
            $data['timeRemaining'] = max(0, $data['tradingDuration'] - $elapsed);
        };

        // Calculate initial time remaining
        $calculateTimeRemaining($data);

        // Run initial production if never run (game start)
        if (!isset($data['initialProductionRun'])) {
            error_log("SessionManager: Running initial production before first marketplace");
            $this->runProductionForAllTeams($data['currentSession']);
            $this->storage->setSessionData(['initialProductionRun' => time()]);
            $data = $this->storage->getSystemState();
            $calculateTimeRemaining($data);
        }

        // Process NPCs if enabled (throttled to prevent redundant runs)
        $npcConfigFile = __DIR__ . '/../data/npc_config.json';
        $npcSettings = file_exists($npcConfigFile) ? json_decode(file_get_contents($npcConfigFile), true) : [];
        if (($npcSettings['enabled'] ?? false)) {
            $lastRun = $data['npcLastRun'] ?? 0;
            $now = time();

            // Run NPCs at most once every 10 seconds (prevents redundant processing with multiple clients)
            if ($now - $lastRun >= 10) {
                error_log("SessionManager: Auto-processing NPCs (last run: {$lastRun}, now: {$now})");
                require_once __DIR__ . '/NPCManager.php';
                $npcManager = new NPCManager();
                $npcManager->runTradingCycle($data['currentSession']);
                $this->updateNpcLastRun();
                // Reload state after NPC processing
                $data = $this->storage->getSystemState();
                $calculateTimeRemaining($data);
            }
        }

        // Auto-advance if time expired: Run production, increment session, start new trading
        if ($data['autoAdvance'] && $data['timeRemaining'] <= 0) {
            error_log("SessionManager: Trading session {$data['currentSession']} complete. Running production...");

            // Run production for this session
            $this->runProductionForAllTeams($data['currentSession']);

            // Increment session and reset timer
            $newSession = $data['currentSession'] + 1;
            $updates = [
                'currentSession' => $newSession,
                'phaseStartedAt' => time(),
                'productionJustRan' => time() // Flag for client to show results modal
            ];

            $this->storage->setSessionData($updates);
            error_log("SessionManager: Session {$newSession} starting");

            return array_merge($data, $updates);
        }

        return $data;
    }

    public function isTradingAllowed() {
        return true; // Always trading now - no production phase
    }

    /**
     * Manual session advance (for admin)
     */
    public function advanceSession() {
        $data = $this->storage->getSystemState();

        // Run production for current session
        $this->runProductionForAllTeams($data['currentSession']);

        // Increment session
        $newSession = $data['currentSession'] + 1;
        $updates = [
            'currentSession' => $newSession,
            'phaseStartedAt' => time(),
            'productionJustRan' => time()
        ];

        $this->storage->setSessionData($updates);
        error_log("SessionManager: Manually advanced to session {$newSession}");

        return array_merge($data, $updates);
    }

    /**
     * Run production for all teams
     */
    private function runProductionForAllTeams($sessionNumber) {
        require_once __DIR__ . '/TeamStorage.php';
        require_once __DIR__ . '/LPSolver.php';

        $teamsDir = __DIR__ . '/../data/teams';
        if (!is_dir($teamsDir)) return;

        $teamDirs = array_filter(glob($teamsDir . '/*'), 'is_dir');

        foreach ($teamDirs as $teamDir) {
            $email = basename($teamDir);
            if ($email === 'system') continue;

            try {
                $storage = new TeamStorage($email);
                $inventory = $storage->getInventory();
                if (empty($inventory['C']) && empty($inventory['N'])) continue;

                $solver = new LPSolver();
                $result = $solver->solve($inventory);
                if ($result['maxProfit'] <= 0) continue;

                $deicerGallons = $result['deicer'];
                $solventGallons = $result['solvent'];
                $revenue = $result['maxProfit'];

                $consumed = [
                    'C' => $deicerGallons * LPSolver::DEICER_C,
                    'N' => ($deicerGallons * LPSolver::DEICER_N) + ($solventGallons * LPSolver::SOLVENT_N),
                    'D' => ($deicerGallons * LPSolver::DEICER_D) + ($solventGallons * LPSolver::SOLVENT_D),
                    'Q' => $solventGallons * LPSolver::SOLVENT_Q
                ];

                foreach ($consumed as $chemical => $amount) {
                    if ($amount > 0) $storage->adjustChemical($chemical, -$amount);
                }

                // Credit revenue to team
                $storage->updateFunds($revenue);

                $storage->addProduction([
                    'type' => 'automatic_session',
                    'sessionNumber' => $sessionNumber,
                    'deicer' => $deicerGallons,
                    'solvent' => $solventGallons,
                    'revenue' => $revenue,
                    'chemicalsConsumed' => $consumed,
                    'note' => "Automatic production for session $sessionNumber"
                ]);
            } catch (Exception $e) { continue; }
        }
    }

    public function setPhase($phase) {
        $updates = ['phase' => $phase, 'phaseStartedAt' => time()];
        if ($phase === 'production') {
            $updates['productionRun'] = null;
        }
        $this->storage->setSessionData($updates);
        return $this->storage->getSystemState();
    }

    public function setAutoAdvance($enabled) {
        $this->storage->setSessionData(['autoAdvance' => (bool)$enabled]);
        return $this->storage->getSystemState();
    }

    public function setProductionDuration($seconds) {
        $this->storage->setSessionData(['productionDuration' => (int)$seconds]);
        return $this->storage->getSystemState();
    }

    public function setTradingDuration($seconds) {
        $this->storage->setSessionData(['tradingDuration' => (int)$seconds]);
        return $this->storage->getSystemState();
    }

    public function updateNpcLastRun() {
        $this->storage->setSessionData(['npcLastRun' => time()]);
    }

    public function reset() {
        $this->storage->setSessionData([
            'currentSession' => 1,
            'phase' => 'trading',
            'autoAdvance' => true,
            'productionDuration' => 0, // Not used in new model but kept for compatibility
            'tradingDuration' => 120,
            'phaseStartedAt' => time(),
            'productionRun' => null
        ]);
        return $this->storage->getSystemState();
    }
}