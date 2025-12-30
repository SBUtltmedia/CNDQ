<?php
/**
 * ExpertStrategy - Shadow price-based trading logic for expert NPCs
 *
 * Trading behavior:
 * - Uses LP solver to calculate shadow prices
 * - Buy when market price < shadow price × 0.95 (5% margin)
 * - Sell when market price > shadow price × 1.05 (5% margin)
 * - Recalculates shadow prices every 2 trades
 * - Trades in larger quantities with aggressive pricing
 */

require_once __DIR__ . '/../NPCTradingStrategy.php';

class ExpertStrategy extends NPCTradingStrategy
{
    const BUY_MARGIN = 0.95;            // Buy at 95% of shadow price
    const SELL_MARGIN = 1.05;           // Sell at 105% of shadow price
    const MIN_QUANTITY = 300;           // Minimum trade quantity
    const MAX_QUANTITY = 800;           // Maximum trade quantity
    const RECALC_INTERVAL = 2;          // Recalculate shadow prices every N trades

    private $shadowPrices = null;
    private $tradesSinceRecalc = 0;

    /**
     * Decide what trade action to take
     * Experts use shadow price analysis to identify profitable opportunities
     *
     * @return array|null Trade action or null
     */
    public function decideTrade()
    {
        // Recalculate shadow prices if needed
        if ($this->shadowPrices === null || $this->tradesSinceRecalc >= self::RECALC_INTERVAL) {
            $this->shadowPrices = $this->calculateShadowPrices();
            $this->tradesSinceRecalc = 0;

            if (!$this->shadowPrices) {
                // LP solver failed, fall back to simple logic
                return $this->fallbackTrade();
            }
        }

        // Look for buy opportunities (market price below shadow price)
        $buyAction = $this->findBuyOpportunity();
        if ($buyAction) {
            $this->tradesSinceRecalc++;
            return $buyAction;
        }

        // Look for sell opportunities (market price above shadow price)
        $sellAction = $this->findSellOpportunity();
        if ($sellAction) {
            $this->tradesSinceRecalc++;
            return $sellAction;
        }

        return null; // No profitable opportunities
    }

    /**
     * Find buy opportunity where market price < shadow price
     */
    private function findBuyOpportunity()
    {
        $offers = $this->getMarketOffers();

        // Check each chemical for underpriced offers
        foreach (['C', 'N', 'D', 'Q'] as $chemical) {
            $shadowPrice = $this->shadowPrices[$chemical] ?? 0;
            if ($shadowPrice <= 0) {
                continue; // Invalid shadow price
            }

            $targetPrice = $shadowPrice * self::BUY_MARGIN;
            $cheapestOffer = $this->findCheapestOffer($chemical, $offers);

            if ($cheapestOffer && $cheapestOffer['minPrice'] < $targetPrice) {
                // Found underpriced offer - calculate optimal quantity
                $currentAmount = $this->inventory[$chemical] ?? 0;

                // Experts trade larger quantities
                $quantity = $this->calculateBuyQuantity($chemical, $currentAmount);

                // Don't buy more than available
                $quantity = min($quantity, $cheapestOffer['quantity']);

                // Check if we can afford it
                $totalCost = $quantity * $cheapestOffer['minPrice'];
                if (!$this->hasSufficientFunds($totalCost)) {
                    // Try to afford smaller quantity
                    $quantity = floor($this->profile['currentFunds'] * 0.7 / $cheapestOffer['minPrice']);
                    if ($quantity < 100) {
                        continue; // Too small
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

            // No cheap offer found - post strategic buy order
            if ($shadowPrice > 0 && $currentAmount < 1500) {
                $quantity = $this->calculateBuyQuantity($chemical, $currentAmount);
                $bidPrice = $shadowPrice * self::BUY_MARGIN;

                if ($this->hasSufficientFunds($quantity * $bidPrice)) {
                    return [
                        'type' => 'create_buy_order',
                        'chemical' => $chemical,
                        'quantity' => $quantity,
                        'maxPrice' => round($bidPrice, 2)
                    ];
                }
            }
        }

        return null;
    }

    /**
     * Find sell opportunity where market price > shadow price
     */
    private function findSellOpportunity()
    {
        $buyOrders = $this->getMarketBuyOrders();

        // Check each chemical for overpriced buy orders
        foreach (['C', 'N', 'D', 'Q'] as $chemical) {
            $shadowPrice = $this->shadowPrices[$chemical] ?? 0;
            if ($shadowPrice <= 0) {
                continue; // Invalid shadow price
            }

            $targetPrice = $shadowPrice * self::SELL_MARGIN;
            $highestBuyOrder = $this->findHighestBuyOrder($chemical, $buyOrders);

            if ($highestBuyOrder && $highestBuyOrder['maxPrice'] > $targetPrice) {
                // Found overpriced buy order - calculate optimal quantity
                $currentAmount = $this->inventory[$chemical] ?? 0;

                if ($currentAmount < 100) {
                    continue; // Not enough to sell
                }

                // Experts sell strategically
                $quantity = $this->calculateSellQuantity($chemical, $currentAmount);

                // Don't sell more than buyer wants
                $quantity = min($quantity, $highestBuyOrder['quantity']);

                // Check if we have enough inventory
                if (!$this->hasSufficientInventory($chemical, $quantity)) {
                    $quantity = floor($currentAmount * 0.6); // Sell 60%
                    if ($quantity < 100) {
                        continue; // Too small
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

            // No high buy order found - post strategic sell offer
            if ($shadowPrice > 0 && $currentAmount > 500) {
                $quantity = $this->calculateSellQuantity($chemical, $currentAmount);
                $askPrice = $shadowPrice * self::SELL_MARGIN;

                if ($this->hasSufficientInventory($chemical, $quantity)) {
                    return [
                        'type' => 'create_sell_offer',
                        'chemical' => $chemical,
                        'quantity' => $quantity,
                        'minPrice' => round($askPrice, 2)
                    ];
                }
            }
        }

        return null;
    }

    /**
     * Calculate optimal buy quantity based on shadow price and inventory
     */
    private function calculateBuyQuantity($chemical, $currentAmount)
    {
        // Target inventory level based on shadow price
        // Higher shadow price = more valuable = buy more
        $shadowPrice = $this->shadowPrices[$chemical] ?? 3.0;

        // Calculate target based on value
        $avgShadowPrice = array_sum($this->shadowPrices) / 4;
        $relativeValue = $shadowPrice / $avgShadowPrice;

        // More valuable chemicals get higher target inventory
        $targetInventory = 1000 + ($relativeValue * 500);

        $desiredQuantity = max(
            self::MIN_QUANTITY,
            min(self::MAX_QUANTITY, $targetInventory - $currentAmount)
        );

        return floor($desiredQuantity);
    }

    /**
     * Calculate optimal sell quantity based on shadow price and inventory
     */
    private function calculateSellQuantity($chemical, $currentAmount)
    {
        // Sell more of less valuable chemicals
        $shadowPrice = $this->shadowPrices[$chemical] ?? 3.0;

        $avgShadowPrice = array_sum($this->shadowPrices) / 4;
        $relativeValue = $shadowPrice / $avgShadowPrice;

        // Less valuable chemicals can be sold more aggressively
        $sellPercent = min(0.5, 0.3 / $relativeValue);

        $desiredQuantity = max(
            self::MIN_QUANTITY,
            min(self::MAX_QUANTITY, $currentAmount * $sellPercent)
        );

        return floor($desiredQuantity);
    }

    /**
     * Fallback trading logic when LP solver fails
     */
    private function fallbackTrade()
    {
        // Use simple logic based on inventory levels
        foreach (['C', 'N', 'D', 'Q'] as $chemical) {
            $amount = $this->inventory[$chemical] ?? 0;

            // Buy if low
            if ($amount < 400) {
                $offers = $this->getMarketOffers();
                $cheapestOffer = $this->findCheapestOffer($chemical, $offers);

                if ($cheapestOffer && $cheapestOffer['minPrice'] <= 3.50) {
                    $quantity = min(500, $cheapestOffer['quantity']);
                    if ($this->hasSufficientFunds($quantity * $cheapestOffer['minPrice'])) {
                        return [
                            'type' => 'accept_offer',
                            'offerId' => $cheapestOffer['id'],
                            'sellerId' => $cheapestOffer['sellerId'],
                            'chemical' => $chemical,
                            'quantity' => $quantity,
                            'price' => $cheapestOffer['minPrice']
                        ];
                    }
                }
            }

            // Sell if excess
            if ($amount > 1500) {
                $buyOrders = $this->getMarketBuyOrders();
                $highestBuyOrder = $this->findHighestBuyOrder($chemical, $buyOrders);

                if ($highestBuyOrder && $highestBuyOrder['maxPrice'] >= 2.50) {
                    $quantity = min(500, $highestBuyOrder['quantity'], $amount * 0.4);
                    if ($this->hasSufficientInventory($chemical, $quantity)) {
                        return [
                            'type' => 'accept_buy_order',
                            'buyOrderId' => $highestBuyOrder['id'],
                            'buyerId' => $highestBuyOrder['buyerId'],
                            'chemical' => $chemical,
                            'quantity' => $quantity,
                            'price' => $highestBuyOrder['maxPrice']
                        ];
                    }
                }
            }
        }

        return null; // No action
    }
}
