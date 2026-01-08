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
     * THE WORLD TURNER LOGIC (Consolidated)
     * This is the "Heartbeat" of the game.
     * It is called by the CLI daemon (1s interval) and the UI API (3s interval).
     * Returns true if any significant change occurred.
     */
    public function rotateWorld() {
        $state = $this->storage->getSystemState();
        $changed = false;

        // 1. MARKETPLACE AGGREGATION
        // We only do this if it's been more than 2 seconds since the last one
        // or if explicitly needed.
        require_once __DIR__ . '/MarketplaceAggregator.php';
        $aggregator = new MarketplaceAggregator();
        $aggregator->generateSnapshot();

        // 2. SESSION MANAGEMENT
        // Calculate current time remaining
        $elapsed = time() - ($state['phaseStartedAt'] ?? time());
        $timeRemaining = max(0, ($state['tradingDuration'] ?? 120) - $elapsed);

        // Auto-advance if time expired
        if (($state['autoAdvance'] ?? false) && $timeRemaining <= 0 && !($state['gameStopped'] ?? true)) {
            $this->advanceSession();
            require_once __DIR__ . '/WS.php';
            WS::push('session_advanced');
            $changed = true;
        }

        // 3. NPC LOGIC
        if (!($state['gameStopped'] ?? true)) {
            $lastNpcRun = $state['npcLastRun'] ?? 0;
            if (time() - $lastNpcRun >= 10) { // 10-second throttling
                try {
                    require_once __DIR__ . '/NPCManager.php';
                    $npcManager = new NPCManager();
                    if ($npcManager->isEnabled()) {
                        // Update last run time BEFORE running to prevent concurrent runs
                        $this->updateNpcLastRun();
                        
                        // Process reflections and run cycle
                        require_once __DIR__ . '/GlobalAggregator.php';
                        $globalAgg = new GlobalAggregator();
                        $globalAgg->processReflections();

                        $npcManager->runTradingCycle($state['currentSession']);
                        
                        $globalAgg->processReflections();
                        $changed = true;
                    }
                } catch (Exception $e) {
                    error_log("rotateWorld: NPC processing failed: " . $e->getMessage());
                }
            }
        }

        // If something changed, poke browsers via WS
        if ($changed) {
            require_once __DIR__ . '/WS.php';
            WS::marketplaceUpdated();
        }

        return $changed;
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

        return $data;
    }

    public function isTradingAllowed() {
        return true; // Always trading now - no production phase
    }

    /**
     * End of session logic
     */
    public function advanceSession() {
        $data = $this->storage->getSystemState();
        
        // Stop the game when session ends
        $this->storage->setSessionData([
            'gameStopped' => true,
            'gameFinished' => true,
            'productionJustRan' => time()
        ]);

        // Run one final production for all teams (this time it IS final)
        $this->runFinalProductionForAllTeams($data['currentSession']);

        return $this->storage->getSystemState();
    }

    /**
     * Run FINAL production for all teams (consumes inventory)
     */
    public function runFinalProductionForAllTeams($sessionNumber) {
        require_once __DIR__ . '/TeamStorage.php';
        require_once __DIR__ . '/LPSolver.php';
        require_once __DIR__ . '/Database.php';

        $db = Database::getInstance();
        $teams = $db->query('SELECT DISTINCT team_email FROM team_events');
        
        foreach ($teams as $teamRow) {
            $email = $teamRow['team_email'];
            if ($email === 'system') continue;

            try {
                $storage = new TeamStorage($email);
                $inventory = $storage->getInventory();
                
                $solver = new LPSolver();
                $result = $solver->solve($inventory);
                $revenue = $result['maxProfit'];

                // FINAL PRODUCTION: Consumes inventory and adds funds
                $consumed = [
                    'C' => $result['deicer'] * LPSolver::DEICER_C,
                    'N' => ($result['deicer'] * LPSolver::DEICER_N) + ($result['solvent'] * LPSolver::SOLVENT_N),
                    'D' => ($result['deicer'] * LPSolver::DEICER_D) + ($result['solvent'] * LPSolver::SOLVENT_D),
                    'Q' => $result['solvent'] * LPSolver::SOLVENT_Q
                ];
                
                foreach ($consumed as $chem => $amount) {
                    if ($amount > 0) $storage->adjustChemical($chem, -$amount);
                }

                $storage->updateFunds($revenue);

                $storage->addProduction([
                    'type' => 'final_production',
                    'sessionNumber' => $sessionNumber,
                    'deicer' => $result['deicer'],
                    'solvent' => $result['solvent'],
                    'revenue' => $revenue,
                    'chemicalsConsumed' => $consumed,
                    'note' => "Final production run. Game over."
                ]);
            } catch (Exception $e) { continue; }
        }
    }

    /**
     * Run production for all teams
     */
    public function runProductionForAllTeams($sessionNumber) {
        require_once __DIR__ . '/TeamStorage.php';
        require_once __DIR__ . '/LPSolver.php';
        require_once __DIR__ . '/Database.php';

        // Get all teams from database
        $db = Database::getInstance();
        $teams = $db->query('SELECT DISTINCT team_email FROM team_events');
        if (empty($teams)) return;

        foreach ($teams as $teamRow) {
            $email = $teamRow['team_email'];
            if ($email === 'system') continue;

            try {
                $storage = new TeamStorage($email);
                $inventory = $storage->getInventory();
                if (empty($inventory['C']) && empty($inventory['N'])) continue;

                $solver = new LPSolver();
                $result = $solver->solve($inventory);
                $revenue = $result['maxProfit'];

                // NEW MODEL: In-session production is just a projection. 
                // NO inventory is consumed and NO funds are credited until the final end of game.
                
                $storage->addProduction([
                    'type' => 'session_projection',
                    'sessionNumber' => $sessionNumber,
                    'deicer' => $result['deicer'],
                    'solvent' => $result['solvent'],
                    'revenue' => $revenue,
                    'note' => "Projected potential for session $sessionNumber"
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
        $this->storage->setSessionData([
            'tradingDuration' => (int)$seconds,
            'phaseStartedAt' => time()
        ]);
        return $this->storage->getSystemState();
    }

    public function toggleGameStop($stopped) {
        $updates = ['gameStopped' => (bool)$stopped];
        
        // If starting the game, reset the phase timer so it doesn't immediately expire
        if (!$stopped) {
            $updates['phaseStartedAt'] = time();
            $updates['gameFinished'] = false; // Ensure finished is false if manually started
        }
        
        $this->storage->setSessionData($updates);
        return $this->storage->getSystemState();
    }

    /**
     * Restart the game - can be called by anyone when game is finished
     * Preserves NPC count
     */
    public function restartGame() {
        require_once __DIR__ . '/NPCManager.php';
        require_once __DIR__ . '/Database.php';
        
        $npcManager = new NPCManager();
        $npcConfig = $npcManager->loadConfig();
        $npcSkillLevels = array_column($npcConfig['npcs'] ?? [], 'skillLevel');
        
        $db = Database::getInstance();
        $db->beginTransaction();
        try {
            $db->getPdo()->exec('PRAGMA foreign_keys = OFF');
            $db->execute('DELETE FROM team_state_cache');
            $db->execute('DELETE FROM team_snapshots');
            $db->execute('DELETE FROM team_events');
            $db->execute('DELETE FROM marketplace_events');
            $db->execute('UPDATE marketplace_snapshot SET offers = ?, buy_orders = ?, ads = ?, recent_trades = ?, updated_at = ? WHERE id = 1',
                ['[]', '[]', '[]', '[]', time()]);
            $db->execute('DELETE FROM negotiation_offers');
            $db->execute('DELETE FROM negotiations');
            $db->execute('DELETE FROM config WHERE key != ?', ['admin_config']);
            $db->getPdo()->exec('PRAGMA foreign_keys = ON');
            $db->commit();
        } catch (Exception $e) {
            $db->rollback();
            throw $e;
        }

        // Recreate NPCs
        $npcManager->toggleSystem(true);
        foreach ($npcSkillLevels as $level) {
            $npcManager->createNPCs($level, 1);
        }

        return $this->reset();
    }

    public function updateNpcLastRun() {
        $this->storage->setSessionData(['npcLastRun' => time()]);
        return $this->storage->getSystemState();
    }

    public function reset($tradingDuration = 120) {
        $this->storage->setSessionData([
            'currentSession' => 1,
            'phase' => 'trading',
            'autoAdvance' => true,
            'productionDuration' => 0, // Not used in new model but kept for compatibility
            'tradingDuration' => (int)$tradingDuration,
            'phaseStartedAt' => time(),
            'productionRun' => null,
            'productionJustRan' => time(), // Set flag so modal shows initial production on first load
            'gameStopped' => true, // Game starts in stopped state after reset
            'gameFinished' => false
        ]);
        return $this->storage->getSystemState();
    }
}