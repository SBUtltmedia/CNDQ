<?php
/**
 * NoviceStrategy - Threshold-based trading logic for novice NPCs
 *
 * Trading behavior:
 * - Trades when inventory is low (<300 gal) or excess (>1800 gal)
 * - Buy threshold: $2.50/gal max
 * - Sell threshold: $3.00/gal min
 * - Methodical approach with fixed price limits
 */

require_once __DIR__ . '/../NPCTradingStrategy.php';

class NoviceStrategy extends NPCTradingStrategy
{
    const BUY_THRESHOLD = 2.50;         // Max price willing to pay
    const SELL_THRESHOLD = 3.00;        // Min price to accept
    const LOW_INVENTORY = 300;          // Trade when inventory below this
    const EXCESS_INVENTORY = 1800;      // Trade when inventory above this
    const BUY_QUANTITY_MIN = 200;       // Minimum buy quantity
    const BUY_QUANTITY_MAX = 400;       // Maximum buy quantity
    const SELL_QUANTITY_MIN = 200;      // Minimum sell quantity
    const SELL_QUANTITY_MAX = 500;      // Maximum sell quantity

    /**
     * Decide what trade action to take
     * Novices trade based on inventory levels and price thresholds
     *
     * @return array|null Trade action or null
     */
    public function decideTrade()
    {
        // Check each chemical for low inventory or excess
        foreach (['C', 'N', 'D', 'Q'] as $chemical) {
            $amount = $this->inventory[$chemical] ?? 0;

            if ($amount < self::LOW_INVENTORY) {
                // Low inventory - try to buy
                $action = $this->tryToBuy($chemical);
                if ($action) {
                    return $action;
                }
            } elseif ($amount > self::EXCESS_INVENTORY) {
                // Excess inventory - try to sell
                $action = $this->tryToSell($chemical);
                if ($action) {
                    return $action;
                }
            }
        }

        return null; // No action needed
    }

    /**
     * Try to buy a chemical at or below threshold price
     */
    private function tryToBuy($chemical)
    {
        $offers = $this->getMarketOffers();
        $cheapestOffer = $this->findCheapestOffer($chemical, $offers);

        // Check if there's an offer at or below our buy threshold
        if ($cheapestOffer && $cheapestOffer['minPrice'] <= self::BUY_THRESHOLD) {
            // Determine quantity - buy enough to reach reasonable level
            $currentAmount = $this->inventory[$chemical] ?? 0;
            $targetAmount = (self::LOW_INVENTORY + self::EXCESS_INVENTORY) / 2; // Mid-range
            $desiredQuantity = min(
                self::BUY_QUANTITY_MAX,
                max(self::BUY_QUANTITY_MIN, $targetAmount - $currentAmount)
            );

            // Don't buy more than available
            $quantity = min($desiredQuantity, $cheapestOffer['quantity']);

            // Check if we can afford it
            $totalCost = $quantity * $cheapestOffer['minPrice'];
            if (!$this->hasSufficientFunds($totalCost)) {
                // Reduce quantity to what we can afford
                $quantity = floor($this->profile['currentFunds'] * 0.8 / $cheapestOffer['minPrice']);
                if ($quantity < 50) {
                    return null; // Too small
                }
            }

            return [
                'type' => 'accept_offer',
                'offerId' => $cheapestOffer['id'],
                'sellerId' => $cheapestOffer['sellerId'],
                'chemical' => $chemical,
                'quantity' => $quantity,
                'price' => $cheapestOffer['minPrice']
            ];
        }

        // No suitable offer - post buy order at threshold price
        $quantity = mt_rand(self::BUY_QUANTITY_MIN, self::BUY_QUANTITY_MAX);
        $totalCost = $quantity * self::BUY_THRESHOLD;

        if ($this->hasSufficientFunds($totalCost)) {
            return [
                'type' => 'create_buy_order',
                'chemical' => $chemical,
                'quantity' => $quantity,
                'maxPrice' => self::BUY_THRESHOLD
            ];
        }

        return null;
    }

    /**
     * Try to sell a chemical at or above threshold price
     */
    private function tryToSell($chemical)
    {
        $buyOrders = $this->getMarketBuyOrders();
        $highestBuyOrder = $this->findHighestBuyOrder($chemical, $buyOrders);

        // Check if there's a buy order at or above our sell threshold
        if ($highestBuyOrder && $highestBuyOrder['maxPrice'] >= self::SELL_THRESHOLD) {
            // Determine quantity - sell excess down to reasonable level
            $currentAmount = $this->inventory[$chemical] ?? 0;
            $targetAmount = (self::LOW_INVENTORY + self::EXCESS_INVENTORY) / 2; // Mid-range
            $excessAmount = $currentAmount - $targetAmount;

            $desiredQuantity = min(
                self::SELL_QUANTITY_MAX,
                max(self::SELL_QUANTITY_MIN, $excessAmount)
            );

            // Don't sell more than buyer wants
            $quantity = min($desiredQuantity, $highestBuyOrder['quantity']);

            // Check if we have enough inventory
            if (!$this->hasSufficientInventory($chemical, $quantity)) {
                $quantity = $this->inventory[$chemical] * 0.5; // Sell half
                if ($quantity < 50) {
                    return null; // Too small
                }
            }

            return [
                'type' => 'accept_buy_order',
                'buyOrderId' => $highestBuyOrder['id'],
                'buyerId' => $highestBuyOrder['buyerId'],
                'chemical' => $chemical,
                'quantity' => $quantity,
                'price' => $highestBuyOrder['maxPrice']
            ];
        }

        // No suitable buy order - post sell offer at threshold price
        $currentAmount = $this->inventory[$chemical] ?? 0;
        $quantity = min(
            self::SELL_QUANTITY_MAX,
            max(self::SELL_QUANTITY_MIN, ($currentAmount - self::EXCESS_INVENTORY) * 0.5)
        );

        if ($this->hasSufficientInventory($chemical, $quantity)) {
            return [
                'type' => 'create_sell_offer',
                'chemical' => $chemical,
                'quantity' => $quantity,
                'minPrice' => self::SELL_THRESHOLD
            ];
        }

        return null;
    }
}
