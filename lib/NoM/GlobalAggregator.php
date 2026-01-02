<?php
/**
 * GlobalAggregator - Aggregates state across all teams
 */
namespace NoM;

require_once __DIR__ . '/Aggregator.php';

class GlobalAggregator {
    private $teamsDir;

    public function __construct() {
        $this->teamsDir = __DIR__ . '/../../data/teams';
    }

    /**
     * Get the global state by aggregating all team states
     */
    /**
     * Process pending reflections (cross-team events)
     */
    public function processReflections() {
        $dirs = array_filter(glob($this->teamsDir . '/*'), 'is_dir');
        $processedCount = 0;

        foreach ($dirs as $dir) {
            $state = Aggregator::aggregate($dir);
            $teamId = $state['profile']['email'];
            if (!$teamId) continue;

            $transactions = $state['transactions'] ?? [];
            foreach ($transactions as $txn) {
                if (!empty($txn['isPendingReflection'])) {
                    $this->reflectTransaction($teamId, $txn);
                    $processedCount++;
                }
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

        require_once __DIR__ . '/TeamStorage.php';
        $counterpartyStorage = new TeamStorage($counterpartyId);
        $actorStorage = new TeamStorage($actorId);

        // 1. Check if already reflected to counterparty to avoid duplicates
        $cpState = $counterpartyStorage->getState();
        foreach ($cpState['transactions'] as $cpTxn) {
            if ($cpTxn['transactionId'] === $transactionId) {
                // Already reflected, just clear the flag on actor
                $actorStorage->emitEvent('mark_reflected', ['transactionId' => $transactionId]);
                return;
            }
        }

        // 2. Emit reflected event to counterparty
        $role = ($txn['role'] === 'buyer') ? 'seller' : 'buyer';
        $quantity = $txn['quantity'];
        $chemical = $txn['chemical'];
        $totalAmount = $txn['totalAmount'];

        if ($role === 'seller') {
            // Actor was buyer, so counterparty is seller
            $counterpartyStorage->adjustChemical($chemical, -$quantity);
            $counterpartyStorage->updateFunds($totalAmount);
        } else {
            // Actor was seller, so counterparty is buyer
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

        $counterpartyStorage->addNotification([
            'type' => 'trade_completed',
            'message' => ($role === 'seller' ? "Sold" : "Bought") . " $quantity gallons of $chemical for $" . number_format($totalAmount, 2)
        ]);

        // 3. Mark as reflected on actor
        $actorStorage->emitEvent('mark_reflected', ['transactionId' => $transactionId]);
    }
}
