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
    const TRADE_PROBABILITY = 1.0;      // 100% chance to trade in simulation
    const MAX_FUNDS_PERCENT = 0.8;      // Aggressive
    const MAX_INVENTORY_PERCENT = 0.8;  // Aggressive
    const MIN_PRICE = 0.50;
    const MAX_PRICE = 20.00;

    /**
     * Decide what trade action to take
     * Beginners trade randomly with safety limits
     *
     * @return array|null Trade action or null
     */
    public function decideTrade()
    {
        // Always try to respond to market ads (sell to RPCs)
        return $this->respondToMarketAds();
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

        foreach ($buyAds as $ad) {
            // Only respond to non-NPC buy requests
            if ($this->npcManager->isNPC($ad['buyerId'])) {
                continue;
            }

            // Check if already negotiating with this team for this chemical
            if ($this->hasPendingNegotiationWith($ad['buyerId'], $ad['chemical'])) {
                continue;
            }

            $chemical = $ad['chemical'];
            $available = $this->inventory[$chemical] ?? 0;

            // Leniency: even with small inventory, respond in simulation
            if ($available < 10) {
                continue;
            }

            // Always respond if we have anything
            $offerPrice = round($ad['maxPrice'] * 0.9, 2); // Slightly lower than their max
            $offerQty = min($ad['quantity'], floor($available * 0.5));

            if ($offerQty < 1) continue;

            error_log("NPC {$this->npc['teamName']} responding to buy ad for $chemical from {$ad['buyerName']}");

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

        return null;
    }

    /**
     * Respond to incoming negotiations
     * For simulation, ALWAYS ACCEPT to verify loop completion
     */
    public function respondToNegotiations()
    {
        $pendingNegotiations = $this->getPendingNegotiations();
        if (empty($pendingNegotiations)) return null;

        $negotiation = array_values($pendingNegotiations)[0];
        
        return [
            'type' => 'accept_negotiation',
            'negotiationId' => $negotiation['id']
        ];
    }
}
