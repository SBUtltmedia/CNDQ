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
    const MIN_QUANTITY = 50;            // Minimum trade quantity
    const MAX_QUANTITY = 500;           // Maximum trade quantity
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
                // If LP solver fails, Expert cannot operate
                return null;
            }
        }

        // 1. Look for human buy requests (advertisements) to sell into
        $adAction = $this->respondToMarketAds();
        if ($adAction) {
            $this->tradesSinceRecalc++;
            return $adAction;
        }

        // 2. Look for opportunities to buy needed chemicals (high shadow price)
        $buyAction = $this->tryToBuy();
        if ($buyAction) {
            $this->tradesSinceRecalc++;
            return $buyAction;
        }

        // 3. Look for opportunities to sell excess chemicals (low shadow price)
        $sellAction = $this->tryToSell();
        if ($sellAction) {
            $this->tradesSinceRecalc++;
            return $sellAction;
        }

        return null; // No profitable opportunities
    }

    /**
     * Scan the marketplace for human buy requests and initiate negotiations
     */
    private function respondToMarketAds()
    {
        $aggregator = new MarketplaceAggregator();
        $buyOrders = $aggregator->getActiveBuyOrders(); 

        // Ensure we have shadow prices
        if ($this->shadowPrices === null) {
            $this->shadowPrices = $this->calculateShadowPrices();
        }

        if (!$this->shadowPrices) {
            return null;
        }

        foreach ($buyOrders as $ad) {
            // Skip if it's an NPC
            if ($this->npcManager->isNPC($ad['buyerId'])) {
                continue;
            }

            // Check if already negotiating
            if ($this->hasPendingNegotiationWith($ad['buyerId'], $ad['chemical'])) {
                continue;
            }

            $chemical = $ad['chemical'];
            $shadowPrice = $this->shadowPrices[$chemical] ?? 0;
            
            // Experts only sell if price > shadow price and have sufficient inventory
            $minSellPrice = $shadowPrice * self::SELL_MARGIN;
            $targetPrice = $ad['maxPrice'] ?? 0;

            if ($targetPrice >= $minSellPrice && $this->hasSufficientInventory($chemical, self::MIN_QUANTITY)) {
                // Found a good buyer! Initiate negotiation
                $offerPrice = round(max($minSellPrice, $targetPrice * 0.98), 2); // Offer slightly below buyer's max, but above our min
                $offerQty = min($ad['quantity'], $this->calculateSellQuantity($chemical, $this->inventory[$chemical]));

                if ($offerQty >= self::MIN_QUANTITY) {
                    return [
                        'type' => 'initiate_negotiation',
                        'responderId' => $ad['buyerId'],
                        'responderName' => $ad['buyerName'],
                        'chemical' => $chemical,
                        'quantity' => $offerQty,
                        'price' => $offerPrice,
                        'adId' => $ad['id']
                    ];
                }
            }
        }

        return null;
    }

    /**
     * Try to buy a chemical when shadow price is high
     * NPC posts a BUY REQUEST to the market
     */
    private function tryToBuy() {
        if ($this->shadowPrices === null) {
            $this->shadowPrices = $this->calculateShadowPrices();
        }
        if (!$this->shadowPrices) {
            return null;
        }

        foreach (['C', 'N', 'D', 'Q'] as $chemical) {
            $shadowPrice = $this->shadowPrices[$chemical] ?? 0;
            $currentAmount = $this->inventory[$chemical] ?? 0;

            // Only post buy request if shadow price is high and inventory is low
            if ($shadowPrice > 2.0 && $currentAmount < 1000) { 
                $maxBuyPrice = round($shadowPrice * self::BUY_MARGIN, 2);
                $quantity = $this->calculateBuyQuantity($chemical, $currentAmount);

                if ($quantity >= self::MIN_QUANTITY && $this->hasSufficientFunds($quantity * $maxBuyPrice)) {
                    return [
                        'type' => 'create_buy_order',
                        'chemical' => $chemical,
                        'quantity' => $quantity,
                        'maxPrice' => $maxBuyPrice
                    ];
                }
            }
        }
        return null;
    }

    /**
     * Try to sell a chemical when it is a remainder
     * Expert NPCs sell anything NOT used in the current optimal production mix
     */
    private function tryToSell() {
        if ($this->shadowPrices === null) {
            $this->shadowPrices = $this->calculateShadowPrices();
        }
        
        // Use the LP Solver result from calculating shadow prices
        $inventory = $this->inventory;
        $solver = new LPSolver();
        $result = $solver->solve($inventory);
        
        $deicer = $result['deicer'];
        $solvent = $result['solvent'];
        
        // Calculate what will be consumed
        $willConsume = [
            'C' => ($deicer * LPSolver::DEICER_C),
            'N' => ($deicer * LPSolver::DEICER_N) + ($solvent * LPSolver::SOLVENT_N),
            'D' => ($deicer * LPSolver::DEICER_D) + ($solvent * LPSolver::SOLVENT_D),
            'Q' => ($solvent * LPSolver::SOLVENT_Q)
        ];

        foreach (['C', 'N', 'D', 'Q'] as $chemical) {
            $currentAmount = $inventory[$chemical] ?? 0;
            $neededForProduction = $willConsume[$chemical] ?? 0;
            $surplus = $currentAmount - $neededForProduction;

            // If we have more than 10 gallons of leftovers, sell it!
            if ($surplus > 10) {
                // Look for buyers (buy orders)
                $buyOrders = $this->getMarketBuyOrders();
                $highestBuyOrder = $this->findHighestBuyOrder($chemical, $buyOrders);

                if ($highestBuyOrder) {
                    $quantity = min($surplus, $highestBuyOrder['quantity']);
                    if ($quantity >= 1 && $this->hasSufficientInventory($chemical, $quantity)) {
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
        $relativeValue = ($avgShadowPrice > 0) ? ($shadowPrice / $avgShadowPrice) : 1.0;

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
        $relativeValue = ($avgShadowPrice > 0) ? ($shadowPrice / $avgShadowPrice) : 1.0;

        // Less valuable chemicals can be sold more aggressively
        $sellPercent = min(0.5, 0.3 / max(0.1, $relativeValue));

        $desiredQuantity = max(
            self::MIN_QUANTITY,
            min(self::MAX_QUANTITY, $currentAmount * $sellPercent)
        );

        return floor($desiredQuantity);
    }

    /**
     * Respond to incoming negotiations
     * Experts use shadow price analysis to make optimal decisions
     */
    public function respondToNegotiations()
    {
        $pendingNegotiations = $this->getPendingNegotiations();

        if (empty($pendingNegotiations)) {
            return null;
        }

        // Recalculate shadow prices if needed
        if ($this->shadowPrices === null) {
            $this->shadowPrices = $this->calculateShadowPrices();
            if (!$this->shadowPrices) {
                // LP solver failed, Expert cannot operate
                return null;
            }
        }

        // Only respond to the first pending negotiation
        $negotiation = array_values($pendingNegotiations)[0];
        $latestOffer = end($negotiation['offers']);

        $chemical = $negotiation['chemical'];
        $quantity = $latestOffer['quantity'];
        $price = $latestOffer['price'];
        $type = $negotiation['type'] ?? 'buy'; // From initiator's perspective

        $shadowPrice = $this->shadowPrices[$chemical] ?? 0;

        if ($shadowPrice <= 0) {
            // Invalid shadow price, Expert cannot operate
            return null;
        }

        // NPC is the initiator of a sell negotiation (RPC posted buy ad, NPC responded with sell offer)
        if ($negotiation['initiatorId'] === $this->npc['email'] && $type === 'sell') {
            // NPC is seller, RPC is buyer. RPC countered our sell offer.
            $optimalSellPrice = $shadowPrice * self::SELL_MARGIN;
            if ($price >= $optimalSellPrice * 0.95) { // Accept if price is close to our optimal
                if ($this->hasSufficientInventory($chemical, $quantity)) {
                    return [
                        'type' => 'accept_negotiation',
                        'negotiationId' => $negotiation['id']
                    ];
                }
            }
            // Counter if price is too low but within acceptable range
            if ($price < $optimalSellPrice * 0.95 && $price >= $shadowPrice * 0.9) {
                 // Add a random reaction level (offended vs neutral)
                 $reaction = ($price < $shadowPrice) ? rand(60, 90) : rand(10, 40);
                 $this->npcManager->runTradingCycleAction($this->npc, [
                    'type' => 'add_reaction',
                    'negotiationId' => $negotiation['id'],
                    'level' => $reaction
                 ]);

                 return [
                    'type' => 'counter_negotiation',
                    'negotiationId' => $negotiation['id'],
                    'quantity' => $quantity,
                    'price' => round($optimalSellPrice, 2)
                ];
            }
        }
        // NPC is the responder, meaning the RPC initiated the negotiation (RPC wants to sell to NPC or buy from NPC).
        else {
            // RPC wants to buy from NPC (type 'buy' from RPC perspective, so NPC is seller)
            if ($type === 'buy') {
                $optimalSellPrice = $shadowPrice * self::SELL_MARGIN;
                if ($price >= $optimalSellPrice && $this->hasSufficientInventory($chemical, $quantity)) {
                    return [
                        'type' => 'accept_negotiation',
                        'negotiationId' => $negotiation['id']
                    ];
                }
                // Counter if price is too low but we have excess and it's still profitable
                if ($this->hasSufficientInventory($chemical, $quantity) && $price >= $shadowPrice * 0.9) {
                    $reaction = ($price < $shadowPrice) ? rand(50, 80) : rand(0, 30);
                    $this->npcManager->runTradingCycleAction($this->npc, [
                        'type' => 'add_reaction',
                        'negotiationId' => $negotiation['id'],
                        'level' => $reaction
                    ]);

                    return [
                        'type' => 'counter_negotiation',
                        'negotiationId' => $negotiation['id'],
                        'quantity' => $quantity,
                        'price' => round($optimalSellPrice, 2)
                    ];
                }
            }
            // RPC wants to sell to NPC (type 'sell' from RPC perspective, so NPC is buyer)
            else {
                $optimalBuyPrice = $shadowPrice * self::BUY_MARGIN;
                if ($price <= $optimalBuyPrice && $this->hasSufficientFunds($quantity * $price)) {
                    return [
                        'type' => 'accept_negotiation',
                        'negotiationId' => $negotiation['id']
                    ];
                }
                // Counter if price is too high but we need it and can afford it at optimal price
                if ($this->hasSufficientFunds($quantity * $price) && $price <= $shadowPrice * 1.1) {
                    $reaction = ($price > $shadowPrice) ? rand(50, 80) : rand(0, 30);
                    $this->npcManager->runTradingCycleAction($this->npc, [
                        'type' => 'add_reaction',
                        'negotiationId' => $negotiation['id'],
                        'level' => $reaction
                    ]);

                    return [
                        'type' => 'counter_negotiation',
                        'negotiationId' => $negotiation['id'],
                        'quantity' => $quantity,
                        'price' => round($optimalBuyPrice, 2)
                    ];
                }
            }
        }
        
                // Instead of flat rejection, try one last counter-offer at our optimal threshold.
        
                if ($type === 'buy') {
        
                    // NPC is seller.
        
                    $price = round($shadowPrice * self::SELL_MARGIN, 2);
        
                    if ($this->hasSufficientInventory($chemical, $quantity)) {
        
                        return [
        
                            'type' => 'counter_negotiation',
        
                            'negotiationId' => $negotiation['id'],
        
                            'quantity' => $quantity,
        
                            'price' => $price
        
                        ];
        
                    }
        
                } else {
        
                    // NPC is buyer.
        
                    $price = round($shadowPrice * self::BUY_MARGIN, 2);
        
                    if ($this->hasSufficientFunds($quantity * $price)) {
        
                        return [
        
                            'type' => 'counter_negotiation',
        
                            'negotiationId' => $negotiation['id'],
        
                            'quantity' => $quantity,
        
                            'price' => $price
        
                        ];
        
                    }
        
                }
        
        
        
                // Default to reject only if we can't even afford/provide the optimal price
        
                return [
        
                    'type' => 'reject_negotiation',
        
                    'negotiationId' => $negotiation['id']
        
                ];
        
            }
        
        }
