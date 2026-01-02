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

        if ($data['autoAdvance']) {
            // Log for debugging
            // error_log("SessionManager: Phase={$data['phase']}, TimeRemaining=" . ($data['timeRemaining'] ?? 'N/A'));
        }

        // Calculate time remaining based on current phase
        if ($data['phase'] === 'production') {
            $elapsed = time() - $data['phaseStartedAt'];
            $data['timeRemaining'] = max(0, $data['productionDuration'] - $elapsed);

            // Auto-run production on first entry to production phase
            if ($data['autoAdvance'] && !isset($data['productionRun'])) {
                error_log("SessionManager: Auto-running production for session " . $data['currentSession']);
                $this->runAutoProduction();
                // Reload state
                $data = $this->storage->getSystemState();
                $elapsed = time() - $data['phaseStartedAt'];
                $data['timeRemaining'] = max(0, $data['productionDuration'] - $elapsed);
            }

            // Auto-advance if time expired
            if ($data['autoAdvance'] && $data['timeRemaining'] <= 0) {
                error_log("SessionManager: Time expired in production phase. Advancing...");
                return $this->advancePhase();
            }
        }

        if ($data['phase'] === 'trading') {
            $elapsed = time() - $data['phaseStartedAt'];
            $data['timeRemaining'] = max(0, $data['tradingDuration'] - $elapsed);

            // Auto-advance if time expired
            if ($data['autoAdvance'] && $data['timeRemaining'] <= 0) {
                error_log("SessionManager: Time expired in trading phase. Advancing...");
                return $this->advancePhase();
            }
        }

        return $data;
    }

    public function isTradingAllowed() {
        return $this->getState()['phase'] === 'trading';
    }

    public function isProductionAllowed() {
        return $this->getState()['phase'] === 'production';
    }

    /**
     * Advance to next phase
     */
    public function advancePhase() {
        $data = $this->storage->getSystemState();
        $updates = [];

        switch ($data['phase']) {
            case 'production':
                $updates['phase'] = 'trading';
                $updates['productionRun'] = null; // Clear for next round
                error_log("SessionManager: Transitioning Production -> Trading");
                break;
            case 'trading':
                $updates['currentSession'] = $data['currentSession'] + 1;
                $updates['phase'] = 'production';
                $updates['productionRun'] = null;
                error_log("SessionManager: Transitioning Trading -> Production (Session " . ($data['currentSession'] + 1) . ")");
                break;
        }

        $updates['phaseStartedAt'] = time();
        $this->storage->setSessionData($updates);
        
        return array_merge($data, $updates);
    }

    /**
     * Run automatic production for all teams
     */
    private function runAutoProduction() {
        $data = $this->storage->getSystemState();
        if (isset($data['productionRun'])) return;

        // Mark as run
        $this->storage->setSessionData(['productionRun' => time()]);

        require_once __DIR__ . '/TeamStorage.php';
        require_once __DIR__ . '/LPSolver.php';

        $teamsDir = __DIR__ . '/../data/teams';
        if (!is_dir($teamsDir)) return;

        $teamDirs = array_filter(glob($teamsDir . '/*'), 'is_dir');
        $sessionNumber = $data['currentSession'];

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
            'phase' => 'production',
            'autoAdvance' => true,
            'productionDuration' => 10,
            'tradingDuration' => 120,
            'phaseStartedAt' => time(),
            'productionRun' => null
        ]);
        return $this->storage->getSystemState();
    }
}