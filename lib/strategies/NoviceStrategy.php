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

        return null;
    }

    /**
     * Respond to incoming negotiations
     * Novices respond based on inventory levels and price thresholds
     */
    public function respondToNegotiations()
    {
        $pendingNegotiations = $this->getPendingNegotiations();

        if (empty($pendingNegotiations)) {
            return null;
        }

        // Only respond to the first pending negotiation
        $negotiation = array_values($pendingNegotiations)[0];
        $latestOffer = end($negotiation['offers']);

        $chemical = $negotiation['chemical'];
        $quantity = $latestOffer['quantity'];
        $price = $latestOffer['price'];
        $currentInventory = $this->inventory[$chemical] ?? 0;
        $type = $negotiation['type'] ?? 'buy';

        if ($type === 'buy') {
            // Initiator is buying, so NPC is selling
            // Accept if:
            // 1. We have excess inventory (>1800)
            // 2. Price is at or above our sell threshold ($3.00)
            // 3. We can fulfill the order

            if ($currentInventory > self::EXCESS_INVENTORY &&
                $price >= self::SELL_THRESHOLD &&
                $this->hasSufficientInventory($chemical, $quantity)) {

                return [
                    'type' => 'accept_negotiation',
                    'negotiationId' => $negotiation['id']
                ];
            }

            // Counter offer if we have excess inventory but price is below threshold
            if ($currentInventory > self::EXCESS_INVENTORY) {
                // We have excess to sell, but price needs to be higher

                // Determine quantity we're willing to sell
                $targetAmount = (self::LOW_INVENTORY + self::EXCESS_INVENTORY) / 2;
                $excessAmount = $currentInventory - $targetAmount;
                $counterQuantity = min(
                    self::SELL_QUANTITY_MAX,
                    max(self::SELL_QUANTITY_MIN, $excessAmount, $quantity)
                );

                // Counter with our threshold price
                $counterPrice = self::SELL_THRESHOLD;

                if ($this->hasSufficientInventory($chemical, $counterQuantity)) {
                    return [
                        'type' => 'counter_negotiation',
                        'negotiationId' => $negotiation['id'],
                        'quantity' => $counterQuantity,
                        'price' => $counterPrice
                    ];
                }
            }

            // If we don't have excess inventory or can't fulfill, reject
            if (!$this->hasSufficientInventory($chemical, $quantity) ||
                $currentInventory < self::EXCESS_INVENTORY) {

                return [
                    'type' => 'reject_negotiation',
                    'negotiationId' => $negotiation['id']
                ];
            }
        } else {
            // Initiator is selling, so NPC is buying
            // Accept if:
            // 1. We have low inventory (<300)
            // 2. Price is at or below our buy threshold ($2.50)
            // 3. We have sufficient funds

            if ($currentInventory < self::LOW_INVENTORY &&
                $price <= self::BUY_THRESHOLD &&
                $this->hasSufficientFunds($quantity * $price)) {

                return [
                    'type' => 'accept_negotiation',
                    'negotiationId' => $negotiation['id']
                ];
            }

            // Counter if price is too high but we need inventory
            if ($currentInventory < self::LOW_INVENTORY) {
                $counterPrice = self::BUY_THRESHOLD;
                $targetAmount = (self::LOW_INVENTORY + self::EXCESS_INVENTORY) / 2;
                $counterQuantity = min(self::BUY_QUANTITY_MAX, $targetAmount - $currentInventory);

                if ($this->hasSufficientFunds($counterQuantity * $counterPrice)) {
                    return [
                        'type' => 'counter_negotiation',
                        'negotiationId' => $negotiation['id'],
                        'quantity' => $counterQuantity,
                        'price' => $counterPrice
                    ];
                }
            }
            
            return [
                'type' => 'reject_negotiation',
                'negotiationId' => $negotiation['id']
            ];
        }

        // Counter with adjusted terms if price is close but not quite there
        if ($type === 'buy' && $price >= self::SELL_THRESHOLD * 0.9) {
            $counterQuantity = min($quantity, floor($currentInventory * 0.3));
            $counterPrice = self::SELL_THRESHOLD;

            if ($counterQuantity >= 50) {
                return [
                    'type' => 'counter_negotiation',
                    'negotiationId' => $negotiation['id'],
                    'quantity' => $counterQuantity,
                    'price' => $counterPrice
                ];
            }
        }

        // Reject if offer is not favorable
        return [
            'type' => 'reject_negotiation',
            'negotiationId' => $negotiation['id']
        ];
    }
}
