<?php
/**
 * TradeExecutor - Refactored for No-M (Filesystem-as-State)
 * 
 * Instead of direct file updates and locking, this class emits discrete events 
 * to both buyer and seller folders. The Aggregator handles the state reduction.
 */

require_once __DIR__ . '/TeamStorage.php';

class TradeExecutor {

    /**
     * Execute a trade - Refactored for No-M sovereignty.
     * Only writes to the directory of the team initiating the execution.
     */
    public function executeTrade($sellerId, $buyerId, $chemical, $quantity, $pricePerGallon, $offerId = null, $actingTeamId = null) {
        // If actingTeamId not provided, assume buyer (most common case: accepting an offer)
        if (!$actingTeamId) $actingTeamId = $buyerId;
        
        error_log("TradeExecutor: executeTrade called. Seller: $sellerId, Buyer: $buyerId, Actor: $actingTeamId, Chem: $chemical, Qty: $quantity");

        $isBuyerActing = ($actingTeamId === $buyerId);
        $counterpartyId = $isBuyerActing ? $sellerId : $buyerId;
        error_log("TradeExecutor: isBuyerActing: " . ($isBuyerActing ? 'YES' : 'NO') . ", Counterparty: $counterpartyId");

        if ($sellerId === $buyerId) return ['success' => false, 'message' => 'Cannot trade with yourself'];
        
        try {
            $actorStorage = new TeamStorage($actingTeamId);
            $counterpartyStorage = new TeamStorage($counterpartyId);
            
            // Validate Actor
            $totalCost = $quantity * $pricePerGallon;
            
            if ($isBuyerActing) {
                // Buyer Actor: needs funds - CHECK REMOVED (Infinite Capital)
                $funds = $actorStorage->getProfile()['currentFunds'] ?? 0;
                /*
                if ($funds < $totalCost) {
                    throw new Exception("You have insufficient funds (need $" . number_format($totalCost, 2) . ", have $" . number_format($funds, 2) . ")");
                }
                */
                // Seller Counterparty: needs inventory
                $inv = $counterpartyStorage->getInventory()[$chemical] ?? 0;
                if ($inv < $quantity) {
                    throw new Exception("The seller has insufficient inventory to fulfill this trade.");
                }
            } else {
                // Seller Actor: needs inventory
                $inv = $actorStorage->getInventory()[$chemical] ?? 0;
                if ($inv < $quantity) {
                    throw new Exception("You have insufficient inventory (need $quantity, have $inv)");
                }
                // Buyer Counterparty: needs funds - CHECK REMOVED (Infinite Capital)
                $funds = $counterpartyStorage->getProfile()['currentFunds'] ?? 0;
                /*
                if ($funds < $totalCost) {
                    throw new Exception("The buyer has insufficient funds to fulfill this trade.");
                }
                */
            }

            // Debug: Log pre-trade state
            $preInventory = $actorStorage->getInventory();
            $preFunds = $actorStorage->getProfile()['currentFunds'] ?? 0;
            error_log("TradeExecutor: Pre-Trade Inventory: " . json_encode($preInventory) . ", Funds: $preFunds");

            $totalCost = $quantity * $pricePerGallon;
            $transactionId = 'trade_' . time() . '_' . bin2hex(random_bytes(4));

            // Calculate Trade Heat (Mutually Beneficial vs Detrimental)
            $sellerStorage = new TeamStorage($sellerId);
            $buyerStorage = new TeamStorage($buyerId);
            $sellerShadow = $sellerStorage->getShadowPrices()[$chemical] ?? 0;
            $buyerShadow = $buyerStorage->getShadowPrices()[$chemical] ?? 0;
            
            $sellerGain = $pricePerGallon - $sellerShadow;
            $buyerGain = $buyerShadow - $pricePerGallon;
            $totalHeat = ($sellerGain + $buyerGain) * $quantity;
            $isHot = ($sellerGain > 0 && $buyerGain > 0);

            // Actor-specific events
            $counterpartyName = $counterpartyStorage->getTeamName();

            if ($isBuyerActing) {
                // Buyer is acting: they lose money, gain chemicals
                $actorStorage->adjustChemical($chemical, $quantity);
                $actorStorage->updateFunds(-$totalCost);
                $actorStorage->addTransaction([
                    'transactionId' => $transactionId,
                    'role' => 'buyer',
                    'chemical' => $chemical,
                    'quantity' => $quantity,
                    'pricePerGallon' => $pricePerGallon,
                    'totalAmount' => $totalCost,
                    'counterparty' => $sellerId,
                    'offerId' => $offerId,
                    'isPendingReflection' => true, // Signal for System Aggregator
                    'heat' => [
                        'total' => $totalHeat,
                        'isHot' => $isHot,
                        'sellerGain' => $sellerGain,
                        'buyerGain' => $buyerGain
                    ]
                ]);
                
                $actorStorage->addNotification([
                    'type' => 'trade_completed',
                    'message' => "Bought $quantity gallons of $chemical from $counterpartyName for $" . number_format($totalCost, 2)
                ]);
            } else {
                // Seller is acting: they lose chemicals, gain money
                $actorStorage->adjustChemical($chemical, -$quantity);
                $actorStorage->updateFunds($totalCost);
                $actorStorage->addTransaction([
                    'transactionId' => $transactionId,
                    'role' => 'seller',
                    'chemical' => $chemical,
                    'quantity' => $quantity,
                    'pricePerGallon' => $pricePerGallon,
                    'totalAmount' => $totalCost,
                    'counterparty' => $buyerId,
                    'offerId' => $offerId,
                    'isPendingReflection' => true, // Signal for System Aggregator
                    'heat' => [
                        'total' => $totalHeat,
                        'isHot' => $isHot,
                        'sellerGain' => $sellerGain,
                        'buyerGain' => $buyerGain
                    ]
                ]);

                $actorStorage->addNotification([
                    'type' => 'trade_completed',
                    'message' => "Sold $quantity gallons of $chemical to $counterpartyName for $" . number_format($totalCost, 2)
                ]);
            }
            
            // Debug: Log post-trade state
            // Force state refresh to verify write
            $postInventory = $actorStorage->getInventory();
            $postFunds = $actorStorage->getProfile()['currentFunds'] ?? 0;
            error_log("TradeExecutor: Post-Trade Inventory: " . json_encode($postInventory) . ", Funds: $postFunds");

            // ... cleanup ...

            return [
                'success' => true,
                'message' => 'Trade execution recorded. Counterparty update pending.',
                'transactionId' => $transactionId,
                'heat' => [
                    'total' => $totalHeat,
                    'isHot' => $isHot,
                    'sellerGain' => $sellerGain,
                    'buyerGain' => $buyerGain
                ]
            ];

        } catch (Exception $e) {
            error_log("TradeExecutor: Exception: " . $e->getMessage());
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * Minimal validation for the UI
     */
    public function validateTrade($sellerId, $buyerId, $chemical, $quantity, $pricePerGallon) {
        $seller = new TeamStorage($sellerId);
        $buyer = new TeamStorage($buyerId);
        
        $hasInventory = ($seller->getInventory()[$chemical] ?? 0) >= $quantity;
        // Funds check removed for Infinite Capital model
        //$hasFunds = ($buyer->getProfile()['currentFunds'] ?? 0) >= ($quantity * $pricePerGallon);

        if (!$hasInventory) return ['valid' => false, 'reason' => 'Insufficient inventory'];
        //if (!$hasFunds) return ['valid' => false, 'reason' => 'Insufficient funds'];

        return ['valid' => true];
    }
}