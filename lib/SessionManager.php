<?php
/**
 * Session Manager - Refactored for Single-Round "Infinite Capital" Model
 * 
 * Key Concepts:
 * - Single Round: The game consists of one trading period followed by a final production run.
 * - Auto-Cycle: Optional 24/7 mode where the game automatically restarts after finishing.
 * - Finalize Game: Closes the market and runs the final production.
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

        // Process NPCs if during trading phase and not stopped
        if (!($data['gameStopped'] ?? true)) {
            $lastNpcRun = $data['npcLastRun'] ?? 0;
            if (time() - $lastNpcRun >= 10) { // 10-second throttling
                try {
                    require_once __DIR__ . '/NPCManager.php';
                    $npcManager = new NPCManager();
                    if ($npcManager->isEnabled()) {
                        // Update last run time BEFORE running to prevent concurrent runs
                        $this->updateNpcLastRun();
                        
                        // 1. Process reflections (ensure NPCs have latest state from previous human actions)
                        try {
                            require_once __DIR__ . '/GlobalAggregator.php';
                            $aggregator = new GlobalAggregator();
                            $aggregator->processReflections();
                        } catch (Exception $e) {
                            error_log("SessionManager: Pre-NPC reflection processing failed: " . $e->getMessage());
                        }

                        // 2. Run cycle - NPCs will react to negotiations and post ads
                        $npcManager->runTradingCycle($data['currentSession']);
                        
                        // 3. Process reflections again (update human counterparties with NPC actions)
                        try {
                            $aggregator->processReflections();
                        } catch (Exception $e) {
                            error_log("SessionManager: Post-NPC reflection processing failed: " . $e->getMessage());
                        }

                        // Refresh data after NPC actions
                        $data = $this->storage->getSystemState();
                        $calculateTimeRemaining($data);
                    }
                } catch (Exception $e) {
                    error_log("SessionManager: NPC processing failed: " . $e->getMessage());
                }
            }
        }

        // Auto-Cycle Logic (formerly Auto-Advance)
        // Uses 'autoAdvance' key for backward compatibility, but conceptually it is Auto-Cycle
        if (($data['autoAdvance'] ?? false)) {
            // 1. Auto-Finalize: If trading and time expired
            if (!($data['gameStopped'] ?? true) && !($data['gameFinished'] ?? false) && ($data['timeRemaining'] ?? 0) <= 0) {
                // Time ran out -> Finalize Game
                $this->finalizeGame();
                $data = $this->storage->getSystemState(); // Refresh local data
            }
            
            // 2. Auto-Start-New-Game: If finished and time expired
            if (($data['gameFinished'] ?? false)) {
                $endedAt = $data['productionJustRan'] ?? 0;
                $restartDelay = 60; // 60 seconds to view results
                if (time() - $endedAt > $restartDelay) {
                    $this->startNewGame();
                    $data = $this->storage->getSystemState(); // Refresh local data
                    
                    // Re-calculate time remaining for the new game
                    $calculateTimeRemaining($data);
                }
            }
        }

        return $data;
    }

    public function isTradingAllowed() {
        return true; // Always trading now - no production phase
    }

    /**
     * Finalize Game (formerly advanceSession)
     * Closes the market and runs the final production.
     */
    public function finalizeGame() {
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

    // Alias for backward compatibility
    public function advanceSession() { return $this->finalizeGame(); }

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
                    'constraints' => $result['constraints'],
                    'shadowPrices' => $result['shadowPrices'],
                    'ranges' => $result['ranges'],
                    'note' => "Final production run. Game over."
                ]);
            } catch (Exception $e) { continue; }
        }
    }

    /**
     * Update Projections (formerly runProductionForAllTeams)
     * Calculates projected profit without consuming inventory.
     */
    public function updateProjections($sessionNumber) {
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
                    'constraints' => $result['constraints'],
                    'shadowPrices' => $result['shadowPrices'],
                    'ranges' => $result['ranges'],
                    'note' => "Projected potential for session $sessionNumber"
                ]);
            } catch (Exception $e) { continue; }
        }
    }

    // Alias for backward compatibility
    public function runProductionForAllTeams($sessionNumber) { return $this->updateProjections($sessionNumber); }

    public function setPhase($phase) {
        $phase = strtoupper($phase);
        $updates = ['phase' => $phase, 'phaseStartedAt' => time()];
        if ($phase === 'PRODUCTION') {
            $updates['productionRun'] = null;
        }
        $this->storage->setSessionData($updates);
        return $this->storage->getSystemState();
    }

    public function setAutoCycleMode($enabled) {
        $this->storage->setSessionData(['autoAdvance' => (bool)$enabled]);
        return $this->storage->getSystemState();
    }

    // Alias
    public function setAutoAdvance($enabled) { return $this->setAutoCycleMode($enabled); }

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
     * Start New Game (formerly restartGame)
     * Resets the entire world and starts a fresh session.
     * Preserves NPC count.
     */
    public function startNewGame() {
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

    // Alias for backward compatibility
    public function restartGame() { return $this->startNewGame(); }

    public function updateNpcLastRun() {
        $this->storage->setSessionData(['npcLastRun' => time()]);
        return $this->storage->getSystemState();
    }

    public function reset($tradingDuration = 120) {
        $this->storage->setSessionData([
            'currentSession' => 1,
            'phase' => 'TRADING',
            'autoAdvance' => true,
            'productionDuration' => 0, // Not used in new model but kept for compatibility
            'tradingDuration' => (int)$tradingDuration,
            'phaseStartedAt' => time(),
            'productionRun' => null,
            'productionJustRan' => null, // Don't show modal at start
            'gameStopped' => false, // Game starts immediately for 24/7 loop
            'gameFinished' => false
        ]);
        return $this->storage->getSystemState();
    }
}
