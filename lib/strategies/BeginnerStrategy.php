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
        // Always try to respond to market ads (sell to RPCs)
        $action = $this->respondToMarketAds();
        if ($action) {
            return $action;
        }
        
        // If no market ads to respond to, randomly decide to make a new offer (e.g., post a buy order)
        // This makes beginners also active buyers on occasion.
        /* DISABLED: NPCs should not submit buy requests
        if ($this->randomFloat(0, 1) < 0.2) { // 20% chance to post a buy order
             return $this->decideBuy();
        }
        */

        return null; // No action needed
    }

    /**
     * Decide to buy a chemical
     */
    private function decideBuy()
    {
        // Pick random chemical
        $chemical = $this->randomChemical();
        $targetQuantity = mt_rand(50, 200);
        $maxPrice = $this->randomFloat(self::MIN_PRICE, self::MAX_PRICE);

        if ($this->hasSufficientFunds($targetQuantity * $maxPrice)) {
            return [
                'type' => 'create_buy_order',
                'chemical' => $chemical,
                'quantity' => $targetQuantity,
                'maxPrice' => round($maxPrice, 2)
            ];
        }
        return null;
    }

    /**
     * Scan marketplace for human ads and initiate negotiation
     */
    private function respondToMarketAds()
    {
        $aggregator = new MarketplaceAggregator();
        $buyAds = $aggregator->getActiveBuyOrders();

        if (empty($buyAds)) {
            return null;
        }

        // Shuffle to be random
        shuffle($buyAds);

        foreach ($buyAds as $ad) {
            // Only respond to non-NPC buy requests
            if ($this->npcManager->isNPC($ad['buyerId'])) {
                continue;
            }

            $chemical = $ad['chemical'];
            $available = $this->inventory[$chemical] ?? 0;

            // Only sell if we have a reasonable amount (e.g., > 100 gallons)
            if ($available < 100) {
                error_log("NPC {$this->npc['teamName']} ignored buy ad for $chemical: only $available gallons available.");
                continue;
            }

            // Price should be between our min price and the buyer's max price
            $offerPrice = $this->randomFloat(self::MIN_PRICE, max(self::MIN_PRICE, $ad['maxPrice']));
            $offerQty = min($ad['quantity'], floor($available * self::MAX_INVENTORY_PERCENT)); // Offer a fraction of our inventory

            if ($offerQty < 50) {
                error_log("NPC {$this->npc['teamName']} ignored buy ad for $chemical: offerQty $offerQty too low.");
                continue;
            }

            error_log("NPC {$this->npc['teamName']} responding to buy ad for $chemical from {$ad['buyerName']}");

            return [
                'type' => 'initiate_negotiation',
                'responderId' => $ad['buyerId'],
                'responderName' => $ad['buyerName'],
                'chemical' => $chemical,
                'quantity' => $offerQty,
                'price' => round($offerPrice, 2)
            ];
        }

        return null;
    }

    /**
     * Respond to incoming negotiations
     * Beginners respond based on simple heuristics
     */
    public function respondToNegotiations()
    {
        $pendingNegotiations = $this->getPendingNegotiations();
        if (empty($pendingNegotiations)) return null;

        $negotiation = array_values($pendingNegotiations)[0];
        $latestOffer = end($negotiation['offers']);
        $chemical = $negotiation['chemical'];
        $price = $latestOffer['price'];
        $type = $negotiation['type'] ?? 'buy'; // from initiator's perspective

        // Determine NPC role
        // If initiator is buying, NPC is selling
        $role = ($type === 'buy') ? 'seller' : 'buyer';
        
        $evaluation = $this->evaluateOffer($chemical, $price, $role);

        if ($evaluation['action'] === 'accept') {
            return [
                'type' => 'accept_negotiation',
                'negotiationId' => $negotiation['id']
            ];
        } elseif ($evaluation['action'] === 'counter') {
            // Counter with something closer to fair
            $shadowPrice = $this->calculateShadowPrices()[$chemical] ?? 2.0;
            $counterPrice = ($role === 'seller') ? $shadowPrice * 1.1 : $shadowPrice * 0.9;
            return [
                'type' => 'counter_negotiation',
                'negotiationId' => $negotiation['id'],
                'quantity' => $latestOffer['quantity'],
                'price' => round($counterPrice, 2)
            ];
        }
        
        return [
            'type' => 'reject_negotiation',
            'negotiationId' => $negotiation['id']
        ];
    }
}
