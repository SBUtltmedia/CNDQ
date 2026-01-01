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
     * Execute a trade between seller and buyer via events
     */
    public function executeTrade($sellerId, $buyerId, $chemical, $quantity, $pricePerGallon, $offerId = null) {
        // Basic Validation
        if ($sellerId === $buyerId) return ['success' => false, 'message' => 'Cannot trade with yourself'];
        if ($quantity <= 0) return ['success' => false, 'message' => 'Quantity must be positive'];

        try {
            $sellerStorage = new TeamStorage($sellerId);
            $buyerStorage = new TeamStorage($buyerId);

            $totalCost = $quantity * $pricePerGallon;
            $transactionId = 'trade_' . time() . '_' . bin2hex(random_bytes(4));

            // --- SELLER EVENTS ---
            $sellerStorage->adjustChemical($chemical, -$quantity);
            $sellerStorage->updateFunds($totalCost);
            $sellerStorage->addTransaction([
                'transactionId' => $transactionId,
                'role' => 'seller',
                'chemical' => $chemical,
                'quantity' => $quantity,
                'pricePerGallon' => $pricePerGallon,
                'totalAmount' => $totalCost,
                'counterparty' => $buyerId,
                'offerId' => $offerId
            ]);
            $sellerStorage->addNotification([
                'type' => 'trade_completed',
                'message' => "Sold $quantity gallons of $chemical for $" . number_format($totalCost, 2)
            ]);

            // --- BUYER EVENTS ---
            $buyerStorage->adjustChemical($chemical, $quantity);
            $buyerStorage->updateFunds(-$totalCost);
            $buyerStorage->addTransaction([
                'transactionId' => $transactionId,
                'role' => 'buyer',
                'chemical' => $chemical,
                'quantity' => $quantity,
                'pricePerGallon' => $pricePerGallon,
                'totalAmount' => $totalCost,
                'counterparty' => $sellerId,
                'offerId' => $offerId
            ]);
            $buyerStorage->addNotification([
                'type' => 'trade_completed',
                'message' => "Bought $quantity gallons of $chemical for $" . number_format($totalCost, 2)
            ]);

            // Calculate Trade Heat (Mutually Beneficial vs Detrimental)
            $sellerShadow = $sellerStorage->getShadowPrices()[$chemical] ?? 0;
            $buyerShadow = $buyerStorage->getShadowPrices()[$chemical] ?? 0;
            
            $sellerGain = $pricePerGallon - $sellerShadow;
            $buyerGain = $buyerShadow - $pricePerGallon;
            $totalHeat = ($sellerGain + $buyerGain) * $quantity;

            // ... Clean up offer logic ...
            if ($offerId) {
                if (strpos($offerId, 'buy_') === 0) {
                    $buyerStorage->removeBuyOrder($offerId);
                } else {
                    $sellerStorage->removeOffer($offerId);
                }
            }

            return [
                'success' => true,
                'message' => 'Trade events emitted successfully',
                'transactionId' => $transactionId,
                'heat' => [
                    'total' => $totalHeat,
                    'isHot' => ($sellerGain > 0 && $buyerGain > 0),
                    'isCold' => ($sellerGain < 0 && $buyerGain < 0),
                    'sellerGain' => $sellerGain,
                    'buyerGain' => $buyerGain
                ]
            ];

        } catch (Exception $e) {
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
        $hasFunds = ($buyer->getProfile()['currentFunds'] ?? 0) >= ($quantity * $pricePerGallon);

        if (!$hasInventory) return ['valid' => false, 'reason' => 'Insufficient inventory'];
        if (!$hasFunds) return ['valid' => false, 'reason' => 'Insufficient funds'];

        return ['valid' => true];
    }
}