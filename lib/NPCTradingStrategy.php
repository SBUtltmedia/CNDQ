<?php
/**
 * NPCTradingStrategy - Abstract base class for NPC trading strategies
 *
 * Defines the interface for NPC trading logic and provides shared utilities
 */

require_once __DIR__ . '/TeamStorage.php';
require_once __DIR__ . '/MarketplaceAggregator.php';
require_once __DIR__ . '/TradeExecutor.php';
require_once __DIR__ . '/LPSolver.php';

abstract class NPCTradingStrategy
{
    protected $storage;
    protected $npc;
    protected $npcManager;
    protected $profile;
    protected $inventory;

    /**
     * Constructor
     *
     * @param TeamStorage $storage Team storage for this NPC
     * @param array $npc NPC configuration
     * @param NPCManager $npcManager Reference to NPC manager
     */
    public function __construct($storage, $npc, $npcManager)
    {
        $this->storage = $storage;
        $this->npc = $npc;
        $this->npcManager = $npcManager;
        $this->profile = $storage->getProfile();
        $this->inventory = $storage->getInventory();
    }

    /**
     * Decide what trade action to take
     * Must be implemented by concrete strategies
     *
     * @return array|null Trade action or null if no action
     */
    abstract public function decideTrade();

    /**
     * Respond to incoming negotiations
     * Must be implemented by concrete strategies
     *
     * @return array|null Negotiation response action or null
     */
    abstract public function respondToNegotiations();

    /**
     * Check if NPC should trade based on inventory levels
     *
     * @return bool
     */
    protected function shouldTradeBasedOnInventory()
    {
        $lowThreshold = $this->npc['tradeThresholds']['lowInventory'];
        $excessThreshold = $this->npc['tradeThresholds']['excessInventory'];

        foreach (['C', 'N', 'D', 'Q'] as $chemical) {
            $amount = $this->inventory[$chemical] ?? 0;

            if ($amount < $lowThreshold || $amount > $excessThreshold) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get current market offers for all chemicals
     *
     * @return array Offers grouped by chemical
     */
    protected function getMarketOffers()
    {
        $aggregator = new MarketplaceAggregator();
        $offersByChemical = $aggregator->getOffersByChemical();

        // Filter out this NPC's own offers and other NPC offers
        $filteredOffers = [];
        foreach ($offersByChemical as $chemical => $offers) {
            $filteredOffers[$chemical] = array_filter($offers, function ($offer) {
                // Exclude own offers and other NPC offers
                return $offer['sellerId'] !== $this->npc['email'] &&
                       !$this->npcManager->isNPC($offer['sellerId']);
            });
        }

        return $filteredOffers;
    }

    /**
     * Get current market buy orders for all chemicals
     *
     * @return array Buy orders grouped by chemical
     */
    protected function getMarketBuyOrders()
    {
        $aggregator = new MarketplaceAggregator();
        $buyOrdersByChemical = $aggregator->getBuyOrdersByChemical();

        // Filter out this NPC's own buy orders and other NPCs
        $filteredBuyOrders = [];
        foreach ($buyOrdersByChemical as $chemical => $orders) {
            $filteredBuyOrders[$chemical] = array_filter($orders, function ($order) {
                // Exclude own orders and other NPC orders
                return $order['buyerId'] !== $this->npc['email'] &&
                       !$this->npcManager->isNPC($order['buyerId']);
            });
        }

        return $filteredBuyOrders;
    }

    /**
     * Check if NPC has sufficient funds for a purchase
     *
     * @param float $totalCost Total cost of purchase
     * @return bool
     */
    protected function hasSufficientFunds($totalCost)
    {
        $currentFunds = $this->profile['currentFunds'] ?? 0;
        return $currentFunds >= $totalCost;
    }

    /**
     * Check if NPC has sufficient inventory to sell
     *
     * @param string $chemical Chemical type
     * @param float $quantity Quantity to sell
     * @return bool
     */
    protected function hasSufficientInventory($chemical, $quantity)
    {
        $current = $this->inventory[$chemical] ?? 0;
        return $current >= $quantity;
    }

    /**
     * Get chemical with lowest inventory
     *
     * @return string Chemical type (C, N, D, or Q)
     */
    protected function getLowestInventoryChemical()
    {
        $chemicals = ['C' => $this->inventory['C'],
                      'N' => $this->inventory['N'],
                      'D' => $this->inventory['D'],
                      'Q' => $this->inventory['Q']];

        asort($chemicals);
        return key($chemicals);
    }

    /**
     * Get chemical with highest inventory
     *
     * @return string Chemical type (C, N, D, or Q)
     */
    protected function getHighestInventoryChemical()
    {
        $chemicals = ['C' => $this->inventory['C'],
                      'N' => $this->inventory['N'],
                      'D' => $this->inventory['D'],
                      'Q' => $this->inventory['Q']];

        arsort($chemicals);
        return key($chemicals);
    }

    /**
     * Find cheapest offer for a chemical
     *
     * @param string $chemical Chemical type
     * @param array $offers Market offers
     * @return array|null Cheapest offer or null
     */
    protected function findCheapestOffer($chemical, $offers)
    {
        if (empty($offers[$chemical])) {
            return null;
        }

        $cheapest = null;
        foreach ($offers[$chemical] as $offer) {
            // Skip offers from other NPCs
            if ($this->npcManager->isNPC($offer['sellerId'])) {
                continue;
            }

            if ($cheapest === null || $offer['minPrice'] < $cheapest['minPrice']) {
                $cheapest = $offer;
            }
        }

        return $cheapest;
    }

    /**
     * Find highest buy order for a chemical
     *
     * @param string $chemical Chemical type
     * @param array $buyOrders Market buy orders
     * @return array|null Highest buy order or null
     */
    protected function findHighestBuyOrder($chemical, $buyOrders)
    {
        if (empty($buyOrders[$chemical])) {
            return null;
        }

        $highest = null;
        foreach ($buyOrders[$chemical] as $order) {
            // Already filtered NPCs in getMarketBuyOrders
            if ($highest === null || $order['maxPrice'] > $highest['maxPrice']) {
                $highest = $order;
            }
        }

        return $highest;
    }

    /**
     * Calculate shadow prices for current inventory
     *
     * @return array Shadow prices for C, N, D, Q
     */
    protected function calculateShadowPrices()
    {
        $solver = new LPSolver();
        $result = $solver->solve($this->inventory);

        // Check if shadow prices exist in result
        if (!isset($result['shadowPrices']) || !is_array($result['shadowPrices'])) {
            return null;
        }

        return [
            'C' => $result['shadowPrices']['C'] ?? 0,
            'N' => $result['shadowPrices']['N'] ?? 0,
            'D' => $result['shadowPrices']['D'] ?? 0,
            'Q' => $result['shadowPrices']['Q'] ?? 0
        ];
    }

    /**
     * Generate random number within range
     *
     * @param float $min Minimum value
     * @param float $max Maximum value
     * @return float Random value
     */
    protected function randomFloat($min, $max)
    {
        return $min + mt_rand() / mt_getrandmax() * ($max - $min);
    }

    /**
     * Get random chemical
     *
     * @return string Chemical type
     */
    protected function randomChemical()
    {
        $chemicals = ['C', 'N', 'D', 'Q'];
        return $chemicals[array_rand($chemicals)];
    }

    /**
     * Get pending negotiations where NPC is the responder
     *
     * @return array Pending negotiations
     */
    protected function getPendingNegotiations()
    {
        $negotiationManager = $this->npcManager->getNegotiationManager();
        $allNegotiations = $negotiationManager->getTeamNegotiations($this->npc['email']);

        // Filter to only those where NPC is the responder
        return array_filter($allNegotiations, function($neg) {
            return $neg['responderId'] === $this->npc['email'];
        });
    }
}
