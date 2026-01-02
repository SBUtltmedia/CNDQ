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
        
        $isBuyerActing = ($actingTeamId === $buyerId);
        $counterpartyId = $isBuyerActing ? $sellerId : $buyerId;

        if ($sellerId === $buyerId) return ['success' => false, 'message' => 'Cannot trade with yourself'];
        
        try {
            $actorStorage = new TeamStorage($actingTeamId);
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
            }

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