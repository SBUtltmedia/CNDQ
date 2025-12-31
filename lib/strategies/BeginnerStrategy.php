<?php
/**
 * BeginnerStrategy - Random trading logic for beginner NPCs
 *
 * Trading behavior:
 * - 30% chance to trade each cycle
 * - Random buy/sell decisions
 * - Safety limits: Max 30% funds per trade, max 40% inventory
 * - Random prices between $1.50-$5.00/gal
 */

require_once __DIR__ . '/../NPCTradingStrategy.php';

class BeginnerStrategy extends NPCTradingStrategy
{
    const TRADE_PROBABILITY = 0.3;      // 30% chance to trade
    const MAX_FUNDS_PERCENT = 0.3;      // Max 30% of funds per trade
    const MAX_INVENTORY_PERCENT = 0.4;  // Max 40% of inventory per trade
    const MIN_PRICE = 1.50;
    const MAX_PRICE = 5.00;

    /**
     * Decide what trade action to take
     * Beginners trade randomly with safety limits
     *
     * @return array|null Trade action or null
     */
    public function decideTrade()
    {
        // Random chance to trade (30%)
        if ($this->randomFloat(0, 1) > self::TRADE_PROBABILITY) {
            return null; // Don't trade this cycle
        }

        // Randomly decide to buy or sell
        $action = (mt_rand(0, 1) === 0) ? 'buy' : 'sell';

        if ($action === 'buy') {
            return $this->decideBuy();
        } else {
            return $this->decideSell();
        }
    }

    /**
     * Decide to buy a chemical
     */
    private function decideBuy()
    {
        // Pick random chemical
        $chemical = $this->randomChemical();

        // Random quantity between 50-200 gallons
        $quantity = mt_rand(50, 200);

        // Random price willing to pay
        $maxPrice = $this->randomFloat(self::MIN_PRICE, self::MAX_PRICE);

        $totalCost = $quantity * $maxPrice;

        // Safety check: Don't spend more than 30% of funds
        $maxAffordable = $this->profile['currentFunds'] * self::MAX_FUNDS_PERCENT;
        if ($totalCost > $maxAffordable) {
            $quantity = floor($maxAffordable / $maxPrice);
            if ($quantity < 10) {
                return null; // Too small, skip
            }
        }

        // Check if there are affordable offers
        $offers = $this->getMarketOffers();
        $cheapestOffer = $this->findCheapestOffer($chemical, $offers);

        if ($cheapestOffer && $cheapestOffer['minPrice'] <= $maxPrice) {
            // Accept existing offer
            $acceptQuantity = min($quantity, $cheapestOffer['quantity']);

            if (!$this->hasSufficientFunds($acceptQuantity * $cheapestOffer['minPrice'])) {
                return null;
            }

            return [
                'type' => 'accept_offer',
                'offerId' => $cheapestOffer['id'],
                'sellerId' => $cheapestOffer['sellerId'],
                'chemical' => $chemical,
                'quantity' => $acceptQuantity,
                'price' => $cheapestOffer['minPrice']
            ];
        }

        // Post buy order if can't find offer
        if ($this->hasSufficientFunds($quantity * $maxPrice)) {
            return [
                'type' => 'create_buy_order',
                'chemical' => $chemical,
                'quantity' => $quantity,
                'maxPrice' => $maxPrice
            ];
        }

        return null;
    }

    /**
     * Decide to sell a chemical
     */
    private function decideSell()
    {
        // Pick random chemical
        $chemical = $this->randomChemical();

        // Check if we have inventory
        $available = $this->inventory[$chemical] ?? 0;
        if ($available < 10) {
            return null; // Not enough to sell
        }

        // Sell up to 40% of inventory, minimum 50, max 200 gallons
        $maxSellable = $available * self::MAX_INVENTORY_PERCENT;
        $quantity = min($maxSellable, mt_rand(50, 200));
        $quantity = max(10, $quantity); // At least 10 gallons

        if ($quantity > $available) {
            $quantity = $available;
        }

        // Random price
        $minPrice = $this->randomFloat(self::MIN_PRICE, self::MAX_PRICE);

        // Check if there are buy orders
        $buyOrders = $this->getMarketBuyOrders();
        $highestBuyOrder = $this->findHighestBuyOrder($chemical, $buyOrders);

        if ($highestBuyOrder && $highestBuyOrder['maxPrice'] >= $minPrice) {
            // Accept buy order
            $sellQuantity = min($quantity, $highestBuyOrder['quantity']);

            if (!$this->hasSufficientInventory($chemical, $sellQuantity)) {
                return null;
            }

            return [
                'type' => 'accept_buy_order',
                'buyOrderId' => $highestBuyOrder['id'],
                'buyerId' => $highestBuyOrder['buyerId'],
                'chemical' => $chemical,
                'quantity' => $sellQuantity,
                'price' => $highestBuyOrder['maxPrice']
            ];
        }

        return null;
    }

    /**
     * Respond to incoming negotiations
     * Beginners respond randomly
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

        // Random chance to respond (30%)
        if ($this->randomFloat(0, 1) > self::TRADE_PROBABILITY) {
            return null; // Don't respond this cycle
        }

        // Random decision: 40% accept, 40% counter, 20% reject
        $decision = $this->randomFloat(0, 1);
        $type = $negotiation['type'] ?? 'buy';

        if ($decision < 0.2) {
            // Reject
            return [
                'type' => 'reject_negotiation',
                'negotiationId' => $negotiation['id']
            ];
        } else if ($decision < 0.6) {
            // Accept if we can afford it or have inventory
            $chemical = $negotiation['chemical'];
            $quantity = $latestOffer['quantity'];
            $price = $latestOffer['price'];

            if ($type === 'buy') {
                // Initiator is buying, NPC is selling
                if ($this->hasSufficientInventory($chemical, $quantity)) {
                    return [
                        'type' => 'accept_negotiation',
                        'negotiationId' => $negotiation['id']
                    ];
                }
            } else {
                // Initiator is selling, NPC is buying
                if ($this->hasSufficientFunds($quantity * $price)) {
                    return [
                        'type' => 'accept_negotiation',
                        'negotiationId' => $negotiation['id']
                    ];
                }
            }

            // Can't fulfill/afford, reject
            return [
                'type' => 'reject_negotiation',
                'negotiationId' => $negotiation['id']
            ];
        } else {
            // Counter offer with random adjustments
            $chemical = $negotiation['chemical'];
            $currentQuantity = $latestOffer['quantity'];
            $currentPrice = $latestOffer['price'];

            // Adjust quantity ±20%
            $newQuantity = round($currentQuantity * $this->randomFloat(0.8, 1.2));
            $newQuantity = max(10, $newQuantity);

            // Adjust price ±15%
            $newPrice = round($currentPrice * $this->randomFloat(0.85, 1.15), 2);
            $newPrice = max(self::MIN_PRICE, min(self::MAX_PRICE, $newPrice));

            if ($type === 'buy') {
                // Check if we can fulfill
                if (!$this->hasSufficientInventory($chemical, $newQuantity)) {
                    // Counter with what we have
                    $available = $this->inventory[$chemical] ?? 0;
                    if ($available < 10) {
                        return [
                            'type' => 'reject_negotiation',
                            'negotiationId' => $negotiation['id']
                        ];
                    }
                    $newQuantity = min($newQuantity, floor($available * self::MAX_INVENTORY_PERCENT));
                }
            } else {
                // Check if we can afford
                if (!$this->hasSufficientFunds($newQuantity * $newPrice)) {
                    $maxAffordable = floor($this->profile['currentFunds'] * self::MAX_FUNDS_PERCENT / $newPrice);
                    $newQuantity = min($newQuantity, $maxAffordable);
                    if ($newQuantity < 10) {
                        return [
                            'type' => 'reject_negotiation',
                            'negotiationId' => $negotiation['id']
                        ];
                    }
                }
            }

            return [
                'type' => 'counter_negotiation',
                'negotiationId' => $negotiation['id'],
                'quantity' => $newQuantity,
                'price' => $newPrice
            ];
        }
    }
}
