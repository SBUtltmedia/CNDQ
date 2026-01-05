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
        $db = Database::getInstance();

        // CLEANUP: Clear all market activity before next session
        try {
            $db->beginTransaction();
            
            // 1. Clear Negotiations (Pending only? Or all? User said "all buy requests/negotiations should be cleared")
            // Assuming we clear PENDING ones. Completed ones are history.
            // But user said "cleared for all users at the start of a new session".
            // Let's clear PENDING negotiations to stop carry-over.
            // We can leave history if we want, but "cleared" implies visual removal.
            // Let's stick to clearing pending ones so history remains.
            $db->execute("DELETE FROM negotiation_offers WHERE negotiation_id IN (SELECT id FROM negotiations WHERE status = 'pending')");
            $db->execute("DELETE FROM negotiations WHERE status = 'pending'");

            // 2. Clear Marketplace (Buy Orders, Offers, Ads)
            // We need to clear the events that build the current state.
            // Simplest way is to clear the snapshot and emit "remove" events? 
            // Or just wipe the active state tables/snapshot.
            // Since `MarketplaceAggregator` uses `marketplace_events`, we should technically append "remove" events
            // OR we can just wipe the `marketplace_snapshot` and assumes the aggregator respects it.
            // BUT `MarketplaceAggregator` rebuilds from events if snapshot is missing.
            // So we should probably soft-delete or add a "session_reset" event?
            // "No-M" philosophy says events are immutable history.
            // But "cleared at start of new session" implies a state reset.
            
            // Let's go with the user's request: "cleared".
            // To effectively clear the *current view*, we update the snapshot to empty.
            // And to prevent rebuilding from old events, we might need a "cut-off" or just wipe the old events if they are ephemeral.
            // Marketplace ads are ephemeral.
            
            // Delete ephemeral marketplace events to prevent them from reappearing on rebuild
            $db->execute("DELETE FROM marketplace_events"); 
            
            // Reset snapshot
            $db->execute("UPDATE marketplace_snapshot SET offers = '[]', buy_orders = '[]', ads = '[]', updated_at = ? WHERE id = 1", [time()]);
            
            // Clear team buy orders/offers/ads from their local state?
            // This is harder because it's distributed.
            // But the UI reads from the Aggregator (MarketplaceAggregator).
            // So clearing the Aggregator (snapshot + events) clears the global view.
            
            $db->commit();
        } catch (Exception $e) {
            $db->rollback();
            error_log("SessionManager: Failed to clear market data: " . $e->getMessage());
        }

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
                
                // Correction: The original code had:
                // 'D' => ($deicerGallons * LPSolver::DEICER_D) + ($solventGallons * LPSolver::SOLVENT_D),
                // I should keep it identical to original unless I know it's a bug.
                // The prompt says "Make `runProductionForAllTeams` public." I should try to preserve the logic exactly.
                
                // Let's re-read the original file content to be safe about the 'D' line.
                // Original: 'D' => ($deicerGallons * LPSolver::DEICER_D) + ($solventGallons * LPSolver::SOLVENT_D),
                
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
        $this->storage->setSessionData([
            'tradingDuration' => (int)$seconds,
            'phaseStartedAt' => time()
        ]);
        return $this->storage->getSystemState();
    }

    public function toggleGameStop($stopped) {
        $this->storage->setSessionData(['gameStopped' => (bool)$stopped]);
        return $this->storage->getSystemState();
    }

    public function updateNpcLastRun() {
        $this->storage->setSessionData(['npcLastRun' => time()]);
        return $this->getState();
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
            'gameStopped' => true // Game starts in stopped state after reset
        ]);
        return $this->storage->getSystemState();
    }
}