<?php
/**
 * TradeExecutor - Handles atomic trade execution between two teams
 *
 * Ensures trades are executed atomically with proper locking to prevent race conditions.
 * Updates both teams' inventory, funds, and transaction history.
 */

require_once __DIR__ . '/TeamStorage.php';

class TradeExecutor {

    /**
     * Execute a trade between seller and buyer
     *
     * @param string $sellerId Seller's email
     * @param string $buyerId Buyer's email
     * @param string $chemical Chemical being traded (C, N, D, or Q)
     * @param float $quantity Quantity in gallons
     * @param float $pricePerGallon Price per gallon
     * @param string|null $offerId Optional offer ID to mark as completed
     * @return array Result with success status and message
     */
    public function executeTrade($sellerId, $buyerId, $chemical, $quantity, $pricePerGallon, $offerId = null) {
        // Validate inputs
        if (!in_array($chemical, ['C', 'N', 'D', 'Q'])) {
            return [
                'success' => false,
                'message' => 'Invalid chemical type'
            ];
        }

        if ($quantity <= 0 || $pricePerGallon < 0) {
            return [
                'success' => false,
                'message' => 'Invalid quantity or price'
            ];
        }

        if ($sellerId === $buyerId) {
            return [
                'success' => false,
                'message' => 'Cannot trade with yourself'
            ];
        }

        try {
            // Create storage objects for both teams
            $sellerStorage = new TeamStorage($sellerId);
            $buyerStorage = new TeamStorage($buyerId);

            // Lock both team directories in alphabetical order to prevent deadlock
            $locks = $this->acquireLocks($sellerId, $buyerId);

            if (!$locks['success']) {
                return [
                    'success' => false,
                    'message' => 'Failed to acquire locks: ' . $locks['message']
                ];
            }

            try {
                // Get current state
                $sellerInventory = $sellerStorage->getInventory();
                $buyerProfile = $buyerStorage->getProfile();
                $sellerProfile = $sellerStorage->getProfile();

                $totalCost = $quantity * $pricePerGallon;

                // Validation
                if (!isset($sellerInventory[$chemical])) {
                    throw new Exception("Invalid chemical: $chemical");
                }

                if ($sellerInventory[$chemical] < $quantity) {
                    throw new Exception("Seller has insufficient inventory (has {$sellerInventory[$chemical]}, needs $quantity)");
                }

                if ($buyerProfile['currentFunds'] < $totalCost) {
                    throw new Exception("Buyer has insufficient funds (has {$buyerProfile['currentFunds']}, needs $totalCost)");
                }

                // Execute trade - Update seller
                $sellerStorage->adjustChemical($chemical, -$quantity);
                $sellerStorage->updateFunds($totalCost);

                // Execute trade - Update buyer
                $buyerStorage->adjustChemical($chemical, $quantity);
                $buyerStorage->updateFunds(-$totalCost);

                // Create transaction ID
                $transactionId = 'trade_' . time() . '_' . bin2hex(random_bytes(4));

                // Log transaction for seller
                $sellerStorage->addTransaction([
                    'transactionId' => $transactionId,
                    'role' => 'seller',
                    'chemical' => $chemical,
                    'quantity' => $quantity,
                    'pricePerGallon' => $pricePerGallon,
                    'totalAmount' => $totalCost,
                    'counterparty' => $buyerId,
                    'counterpartyName' => $buyerProfile['teamName'] ?? $buyerId,
                    'offerId' => $offerId
                ]);

                // Log transaction for buyer
                $buyerStorage->addTransaction([
                    'transactionId' => $transactionId,
                    'role' => 'buyer',
                    'chemical' => $chemical,
                    'quantity' => $quantity,
                    'pricePerGallon' => $pricePerGallon,
                    'totalAmount' => $totalCost,
                    'counterparty' => $sellerId,
                    'counterpartyName' => $sellerProfile['teamName'] ?? $sellerId,
                    'offerId' => $offerId
                ]);

                // Send notifications
                $sellerStorage->addNotification([
                    'type' => 'trade_completed',
                    'message' => "Sold $quantity gallons of $chemical to {$buyerProfile['teamName']} for $" . number_format($totalCost, 2),
                    'details' => [
                        'transactionId' => $transactionId,
                        'chemical' => $chemical,
                        'quantity' => $quantity,
                        'totalAmount' => $totalCost,
                        'counterparty' => $buyerId
                    ]
                ]);

                $buyerStorage->addNotification([
                    'type' => 'trade_completed',
                    'message' => "Bought $quantity gallons of $chemical from {$sellerProfile['teamName']} for $" . number_format($totalCost, 2),
                    'details' => [
                        'transactionId' => $transactionId,
                        'chemical' => $chemical,
                        'quantity' => $quantity,
                        'totalAmount' => $totalCost,
                        'counterparty' => $sellerId
                    ]
                ]);

                // Mark offer/buy order as completed if provided
                if ($offerId) {
                    try {
                        // Determine if this is a buy order or sell offer based on ID prefix
                        $isBuyOrder = strpos($offerId, 'buy_') === 0;

                        if ($isBuyOrder) {
                            // This was a buy order - remove it from buyer's buy orders
                            $buyerStorage->removeBuyOrder($offerId);
                        } else {
                            // This was a sell offer - mark as completed in seller's offers
                            $sellerStorage->updateOffer($offerId, ['status' => 'completed']);
                        }
                    } catch (Exception $e) {
                        // Offer/buy order might not exist, that's okay
                        error_log("Could not update offer/buy order status: " . $e->getMessage());
                    }
                }

                // Log to global trades log
                $this->logGlobalTrade([
                    'transactionId' => $transactionId,
                    'sellerId' => $sellerId,
                    'sellerName' => $sellerProfile['teamName'] ?? $sellerId,
                    'buyerId' => $buyerId,
                    'buyerName' => $buyerProfile['teamName'] ?? $buyerId,
                    'chemical' => $chemical,
                    'quantity' => $quantity,
                    'pricePerGallon' => $pricePerGallon,
                    'totalAmount' => $totalCost,
                    'timestamp' => time()
                ]);

                $result = [
                    'success' => true,
                    'message' => 'Trade executed successfully',
                    'transactionId' => $transactionId,
                    'details' => [
                        'chemical' => $chemical,
                        'quantity' => $quantity,
                        'pricePerGallon' => $pricePerGallon,
                        'totalCost' => $totalCost
                    ]
                ];

            } finally {
                // Always release locks
                $this->releaseLocks($locks['locks']);
            }

            return $result;

        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => $e->getMessage()
            ];
        }
    }

    /**
     * Acquire locks for both teams in alphabetical order
     * This prevents deadlocks
     */
    private function acquireLocks($sellerId, $buyerId) {
        $locks = [];

        // Sort emails to always lock in same order
        $emails = [$sellerId, $buyerId];
        sort($emails);

        try {
            foreach ($emails as $email) {
                $storage = new TeamStorage($email);
                $lockFile = $storage->getTeamDirectory() . '/.lock';

                $fp = fopen($lockFile, 'c');
                if (!$fp) {
                    throw new Exception("Failed to create lock file for $email");
                }

                if (!flock($fp, LOCK_EX | LOCK_NB)) {
                    throw new Exception("Failed to acquire lock for $email");
                }

                $locks[$email] = $fp;
            }

            return [
                'success' => true,
                'locks' => $locks
            ];

        } catch (Exception $e) {
            // Release any locks we did acquire
            foreach ($locks as $fp) {
                flock($fp, LOCK_UN);
                fclose($fp);
            }

            return [
                'success' => false,
                'message' => $e->getMessage(),
                'locks' => []
            ];
        }
    }

    /**
     * Release all locks
     */
    private function releaseLocks($locks) {
        foreach ($locks as $fp) {
            flock($fp, LOCK_UN);
            fclose($fp);
        }
    }

    /**
     * Log trade to global trades log
     */
    private function logGlobalTrade($tradeData) {
        $logFile = __DIR__ . '/../data/marketplace/completed_trades.json';

        // Ensure directory exists
        $dir = dirname($logFile);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        // Initialize file if it doesn't exist
        if (!file_exists($logFile)) {
            file_put_contents($logFile, json_encode(['trades' => []], JSON_PRETTY_PRINT));
        }

        // Append trade with file locking
        $fp = fopen($logFile, 'c+');
        if ($fp && flock($fp, LOCK_EX)) {
            $size = filesize($logFile);
            $content = $size > 0 ? fread($fp, $size) : '';
            $data = json_decode($content, true) ?: ['trades' => []];

            $data['trades'][] = $tradeData;

            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
            fflush($fp);

            flock($fp, LOCK_UN);
            fclose($fp);
        }
    }

    /**
     * Check if a trade would be valid (without executing)
     * Useful for validation before showing confirmation dialog
     */
    public function validateTrade($sellerId, $buyerId, $chemical, $quantity, $pricePerGallon) {
        try {
            if (!in_array($chemical, ['C', 'N', 'D', 'Q'])) {
                return ['valid' => false, 'reason' => 'Invalid chemical'];
            }

            if ($quantity <= 0) {
                return ['valid' => false, 'reason' => 'Quantity must be positive'];
            }

            if ($pricePerGallon < 0) {
                return ['valid' => false, 'reason' => 'Price cannot be negative'];
            }

            $sellerStorage = new TeamStorage($sellerId);
            $buyerStorage = new TeamStorage($buyerId);

            $sellerInventory = $sellerStorage->getInventory();
            $buyerProfile = $buyerStorage->getProfile();

            if ($sellerInventory[$chemical] < $quantity) {
                return [
                    'valid' => false,
                    'reason' => 'Insufficient inventory',
                    'available' => $sellerInventory[$chemical]
                ];
            }

            $totalCost = $quantity * $pricePerGallon;
            if ($buyerProfile['currentFunds'] < $totalCost) {
                return [
                    'valid' => false,
                    'reason' => 'Insufficient funds',
                    'available' => $buyerProfile['currentFunds'],
                    'required' => $totalCost
                ];
            }

            return [
                'valid' => true,
                'totalCost' => $totalCost
            ];

        } catch (Exception $e) {
            return [
                'valid' => false,
                'reason' => $e->getMessage()
            ];
        }
    }
}
