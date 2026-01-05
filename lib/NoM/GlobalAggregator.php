<?php
/**
 * GlobalAggregator - Aggregates state across all teams
 * SQLite Implementation
 */
namespace NoM;

require_once __DIR__ . '/../Database.php';
require_once __DIR__ . '/../TeamStorage.php';

class GlobalAggregator {
    private $db;

    public function __construct() {
        $this->db = \Database::getInstance();
    }

    /**
     * Process pending reflections (cross-team events)
     */
    public function processReflections() {
        // Get all teams that have ever had an event
        $teams = $this->db->query('SELECT DISTINCT team_email FROM team_events');
        $processedCount = 0;

        foreach ($teams as $row) {
            $teamId = $row['team_email'];
            if (!$teamId || $teamId === 'system') continue;

            try {
                $storage = new \TeamStorage($teamId);
                $state = $storage->getState();

                $transactions = $state['transactions'] ?? [];
                foreach ($transactions as $txn) {
                    if (!empty($txn['isPendingReflection'])) {
                        $this->reflectTransaction($teamId, $txn);
                        $processedCount++;
                    }
                }
            } catch (\Exception $e) {
                error_log("GlobalAggregator: Failed to process reflections for $teamId: " . $e->getMessage());
            }
        }
        return $processedCount;
    }

    /**
     * Reflect a transaction to the counterparty
     */
    private function reflectTransaction($actorId, $txn) {
        $counterpartyId = $txn['counterparty'];
        $transactionId = $txn['transactionId'];

        $counterpartyStorage = new \TeamStorage($counterpartyId);
        $actorStorage = new \TeamStorage($actorId);

        // 1. Check if already reflected to counterparty to avoid duplicates
        $cpState = $counterpartyStorage->getState();
        $cpTransactions = $cpState['transactions'] ?? [];
        foreach ($cpTransactions as $cpTxn) {
            if (($cpTxn['transactionId'] ?? '') === $transactionId) {
                // Already reflected, just clear the flag on actor
                $actorStorage->emitEvent('mark_reflected', ['transactionId' => $transactionId]);
                return;
            }
        }

        // 2. Emit reflected event to counterparty
        $role = ($txn['role'] === 'buyer') ? 'seller' : 'buyer';
        $quantity = $txn['quantity'];
        $chemical = $txn['chemical'];
        $totalAmount = $txn['totalAmount']; // Amount is always positive here

        // Note: adjustChemical and updateFunds accept negative values for deductions
        if ($role === 'seller') {
            // Actor was buyer, so counterparty is seller
            // Seller loses chemicals, gains money
            $counterpartyStorage->adjustChemical($chemical, -$quantity);
            $counterpartyStorage->updateFunds($totalAmount);
        } else {
            // Actor was seller, so counterparty is buyer
            // Buyer gains chemicals, loses money
            $counterpartyStorage->adjustChemical($chemical, $quantity);
            $counterpartyStorage->updateFunds(-$totalAmount);
        }

        $counterpartyStorage->addTransaction([
            'transactionId' => $transactionId,
            'role' => $role,
            'chemical' => $chemical,
            'quantity' => $quantity,
            'pricePerGallon' => $txn['pricePerGallon'],
            'totalAmount' => $totalAmount,
            'counterparty' => $actorId,
            'offerId' => $txn['offerId'] ?? null,
            'isReflection' => true,
            'heat' => $txn['heat'] ?? null
        ]);

        $actorName = $actorStorage->getTeamName();

        $counterpartyStorage->addNotification([
            'type' => 'trade_completed',
            'message' => ($role === 'seller' ? "Sold" : "Bought") . " $quantity gallons of $chemical " . ($role === 'seller' ? "to" : "from") . " $actorName for $" . number_format($totalAmount, 2)
        ]);

        // 3. Mark as reflected on actor
        $actorStorage->emitEvent('mark_reflected', ['transactionId' => $transactionId]);
        
        error_log("GlobalAggregator: Reflected transaction $transactionId from $actorId to $counterpartyId");
    }
}
